import { NextRequest, NextResponse } from 'next/server';
import { generateText } from '@/lib/ai/gemini';
import { type SummaryType } from '@/lib/ai/formatting';

interface SummarizeRequest {
  emailId: string;
  subject: string;
  content: string;
  type: SummaryType;
}

interface CacheEntry {
  summary: string;
  timestamp: number;
}

// In-memory cache with 1-hour expiration
const cache = new Map<string, CacheEntry>();
const CACHE_DURATION = 60 * 60 * 1000; // 1 hour in milliseconds

function getCacheKey(emailId: string, type: SummaryType): string {
  return `${emailId}:${type}`;
}

function getCachedResponse(emailId: string, type: SummaryType): string | null {
  const key = getCacheKey(emailId, type);
  const entry = cache.get(key);
  
  if (!entry) return null;
  
  // Check if cache entry is still valid
  if (Date.now() - entry.timestamp > CACHE_DURATION) {
    cache.delete(key);
    return null;
  }
  
  return entry.summary;
}

function cacheResponse(emailId: string, type: SummaryType, summary: string): void {
  const key = getCacheKey(emailId, type);
  cache.set(key, {
    summary,
    timestamp: Date.now(),
  });
}

function getModelConfig(type: SummaryType) {
  switch (type) {
    case 'brief':
      return {
        temperature: 0.3,
        maxOutputTokens: 150,
      };
    case 'detailed':
      return {
        temperature: 0.5,
        maxOutputTokens: 500,
      };
    case 'action-items':
      return {
        temperature: 0.4,
        maxOutputTokens: 300,
      };
    default:
      return {
        temperature: 0.5,
        maxOutputTokens: 300,
      };
  }
}

function generatePrompt(type: SummaryType, subject: string, content: string): string {
  switch (type) {
    case 'brief':
      return `Summarize the following email in 2-3 concise sentences, focusing on the main points and key information:

Subject: ${subject}

Content:
${content}

Provide a brief summary that captures the essence of the message.`;
    
    case 'detailed':
      return `Provide a detailed summary of the following email, breaking it down into clear sections:

Subject: ${subject}

Content:
${content}

Structure your summary with the following sections:
1. Overview: A high-level summary of the main topic
2. Key Details: Important information and context
3. Important Points: Specific details that need attention
4. Conclusion: Any final thoughts or next steps

Use markdown formatting for better readability.`;
    
    case 'action-items':
      return `Extract and organize action items from the following email, prioritizing them by importance:

Subject: ${subject}

Content:
${content}

Format your response as a markdown list with the following sections:
### High Priority
- List urgent items that need immediate attention

### Medium Priority
- List important items that can be addressed soon

### Low Priority
- List items that can be addressed when time permits

For each item, include any relevant deadlines or dependencies if mentioned.`;
    
    default:
      return `Summarize the following email:

Subject: ${subject}

Content:
${content}

Provide a clear and concise summary of the main points.`;
  }
}

export async function POST(request: NextRequest) {
  try {
    const { emailId, subject, content, type } = await request.json() as SummarizeRequest;

    if (!emailId || !content) {
      return NextResponse.json(
        { error: 'Missing required fields' },
        { status: 400 }
      );
    }

    // Check cache first
    const cachedSummary = getCachedResponse(emailId, type);
    if (cachedSummary) {
      return NextResponse.json({ summary: cachedSummary, type });
    }

    // Generate summary using Gemini
    const prompt = generatePrompt(type, subject, content);
    const config = getModelConfig(type);
    
    const response = await generateText(prompt, config);
    if (!response.text) {
      throw new Error(response.error || 'Failed to generate summary');
    }

    // Cache the response
    cacheResponse(emailId, type, response.text);

    return NextResponse.json({ summary: response.text, type });
  } catch (error) {
    console.error('Error generating summary:', error);
    
    if (error instanceof Error) {
      // Handle rate limit errors
      if (error.message.includes('429')) {
        const retryAfter = parseInt(error.message.match(/retry after (\d+)/i)?.[1] || '60', 10);
        return NextResponse.json(
          { error: 'Rate limit exceeded', retryAfter },
          { status: 429 }
        );
      }
      
      return NextResponse.json(
        { error: error.message },
        { status: 500 }
      );
    }
    
    return NextResponse.json(
      { error: 'Failed to generate summary' },
      { status: 500 }
    );
  }
}
 