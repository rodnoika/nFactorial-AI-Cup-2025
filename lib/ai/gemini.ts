import { GoogleGenerativeAI, GenerativeModel, HarmCategory, HarmBlockThreshold } from '@google/generative-ai';

// Rate limiting configuration with sliding window
interface RateLimitState {
  requests: number[];  // Timestamps of recent requests
  windowSize: number;  // Window size in milliseconds
  maxRequests: number; // Maximum requests allowed in the window
  backoffMultiplier: number; // For exponential backoff
}

// Rate limit configuration for pro model
const rateLimit: RateLimitState = {
  requests: [],
  windowSize: 60000, // 1 minute window
  maxRequests: 10,   // Conservative limit for pro model
  backoffMultiplier: 1.5
};

// Circuit breaker state
interface CircuitBreakerState {
  failures: number;
  lastFailureTime: number;
  isOpen: boolean;
  resetTimeout: number;
}

const circuitBreaker: CircuitBreakerState = {
  failures: 0,
  lastFailureTime: 0,
  isOpen: false,
  resetTimeout: 30000 // 30 seconds
};

// Sliding window rate limiting with exponential backoff
function checkRateLimit(): { allowed: boolean; retryAfter: number } {
  const now = Date.now();
  const windowStart = now - rateLimit.windowSize;
  
  // Remove requests outside the current window
  rateLimit.requests = rateLimit.requests.filter(timestamp => timestamp > windowStart);
  
  // Check circuit breaker
  if (circuitBreaker.isOpen) {
    const timeSinceLastFailure = now - circuitBreaker.lastFailureTime;
    if (timeSinceLastFailure > circuitBreaker.resetTimeout) {
      circuitBreaker.isOpen = false;
      circuitBreaker.failures = 0;
    } else {
      return { allowed: false, retryAfter: circuitBreaker.resetTimeout - timeSinceLastFailure };
    }
  }
  
  // Check if we're within limits
  if (rateLimit.requests.length >= rateLimit.maxRequests) {
    const oldestRequest = rateLimit.requests[0];
    const nextAvailableTime = oldestRequest + rateLimit.windowSize;
    const retryAfter = Math.max(0, nextAvailableTime - now);
    return { allowed: false, retryAfter };
  }
  
  return { allowed: true, retryAfter: 0 };
}

// Add a request to the rate limit window with exponential backoff
function addRequest(success: boolean) {
  if (success) {
    circuitBreaker.failures = Math.max(0, circuitBreaker.failures - 1);
    if (circuitBreaker.failures === 0) {
      circuitBreaker.isOpen = false;
    }
  } else {
    circuitBreaker.failures++;
    circuitBreaker.lastFailureTime = Date.now();
    if (circuitBreaker.failures >= 3) {
      circuitBreaker.isOpen = true;
    }
  }
  
  rateLimit.requests.push(Date.now());
}

// Calculate time until next available request with exponential backoff
function getTimeUntilNextRequest(): number {
  if (circuitBreaker.isOpen) {
    return circuitBreaker.resetTimeout;
  }
  
  if (rateLimit.requests.length < rateLimit.maxRequests) {
    return 0;
  }
  
  const oldestRequest = rateLimit.requests[0];
  const nextAvailableTime = oldestRequest + rateLimit.windowSize;
  const baseWait = Math.max(0, nextAvailableTime - Date.now());
  
  // Apply exponential backoff based on failure count
  return baseWait * Math.pow(rateLimit.backoffMultiplier, circuitBreaker.failures);
}

export interface GeminiResponse {
  text?: string;
  error?: string;
  retryAfter?: number;
}

if (!process.env.GEMINI_API_KEY) {
  throw new Error('GEMINI_API_KEY environment variable is not set');
}

const genAI = new GoogleGenerativeAI(process.env.GEMINI_API_KEY);

// Initialize pro model
const proModel = genAI.getGenerativeModel({ 
  model: "gemini-1.5-pro",
  generationConfig: {
    temperature: 0.5,  // Balanced temperature for general use
    topK: 40,
    topP: 0.95,
    maxOutputTokens: 2048, // Increased for more detailed responses
  }
});

// Cache for storing responses
const responseCache = new Map<string, { response: GeminiResponse; timestamp: number }>();
const CACHE_DURATION = 60 * 60 * 1000; // 1 hour in milliseconds

export async function generateText(prompt: string, options: { 
  temperature?: number;
  maxTokens?: number;
} = {}): Promise<GeminiResponse> {
  const {
    temperature,
    maxTokens
  } = options;

  // Generate cache key
  const cacheKey = `pro:${temperature || 'default'}:${maxTokens || 'default'}:${prompt}`;
  const cached = responseCache.get(cacheKey);
  if (cached && Date.now() - cached.timestamp < CACHE_DURATION) {
    return cached.response;
  }

  try {
    const { allowed, retryAfter } = checkRateLimit();
    if (!allowed) {
      return {
        error: 'Rate limit exceeded. Please try again in a moment.',
        retryAfter
      };
    }

    const selectedModel = proModel;
    if (temperature) {
      selectedModel.generationConfig.temperature = temperature;
    }
    if (maxTokens) {
      selectedModel.generationConfig.maxOutputTokens = maxTokens;
    }

    const result = await selectedModel.generateContent(prompt);
    const response = await result.response;
    const responseData = { text: response.text() };
    
    addRequest(true);
    responseCache.set(cacheKey, { response: responseData, timestamp: Date.now() });
    return responseData;

  } catch (error: any) {
    console.error('Error generating text with Gemini:', error);
    
    // Handle rate limit errors with detailed logging
    if (error.status === 429) {
      const retryAfter = getTimeUntilNextRequest();
      addRequest(false);
      
      // Log detailed rate limit information
      console.log('Rate limit exceeded:', {
        error: error.message,
        metadata: error.errorDetails?.[0]?.metadata,
        retryAfter
      });
      
      return {
        error: 'Too many requests. Please wait a moment before trying again.',
        retryAfter
      };
    }
    
    if (error.message?.includes('API key')) {
      return {
        error: 'Invalid API key. Please check your configuration.'
      };
    }

    addRequest(false);
    return {
      error: 'Failed to generate text. Please try again later.'
    };
  }
}

export async function generateEmailSummary(emailContent: string): Promise<GeminiResponse> {
  const prompt = `Please provide a concise summary of the following email. Focus on key points, action items, and important details. Format the summary in a clear, structured way:

Email Content:
${emailContent}

Summary:`;

  return generateText(prompt);
}

export async function generateSmartReply(emailContent: string, tone: 'formal' | 'casual' = 'formal'): Promise<GeminiResponse> {
  const prompt = `Based on the following email, generate a ${tone} reply that is professional and appropriate. Consider the context and maintain a natural conversation flow:

Email Content:
${emailContent}

${tone.charAt(0).toUpperCase() + tone.slice(1)} Reply:`;

  return generateText(prompt);
}

export async function enhanceEmailContent(content: string): Promise<GeminiResponse> {
  const prompt = `Please review and enhance the following email content. Improve clarity, grammar, and tone while maintaining the original message. Provide both the enhanced version and a brief explanation of the changes:

Original Content:
${content}

Enhanced Version:`;

  return generateText(prompt);
}

export async function generateEmailTemplate(context: string, type: 'formal' | 'casual'): Promise<GeminiResponse> {
  const prompt = `Generate a ${type} email template based on the following context. The template should be professional, clear, and adaptable:

Context:
${context}

Template:`;

  return generateText(prompt);
}

export async function analyzeEmailPatterns(emails: string[]): Promise<GeminiResponse> {
  const prompt = `Analyze the following email patterns and provide insights about communication style, common themes, and potential improvements. Focus on actionable insights:

Email Samples:
${emails.join('\n\n')}

Analysis:`;

  return generateText(prompt);
} 