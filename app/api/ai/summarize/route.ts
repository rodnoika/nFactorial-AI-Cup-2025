import { NextRequest, NextResponse } from 'next/server';
import { z } from 'zod';
import { generateText } from '@/lib/ai/gemini';
import crypto from 'crypto';

// Cache configuration with stale-while-revalidate
const CACHE_DURATION = 60 * 60; // 1 hour in seconds
const STALE_WHILE_REVALIDATE = 60 * 60 * 24; // 24 hours in seconds
const cache = new Map<string, { 
  summary: string; 
  timestamp: number; 
  etag: string;
}>();

// Rate limiting (throttle) with exponential backoff
let lastRequestTime = 0;
const MIN_INTERVAL = 1000; // 1 request per second
const MAX_INTERVAL = 10000; // 10 seconds max
let currentInterval = MIN_INTERVAL;

const inputSchema = z.object({
  content: z.string().min(1, 'Email content is required'),
  type: z.enum(['brief', 'detailed', 'action-items']).optional().default('brief'),
});

// Get model configuration based on summary type
function getModelConfig(type: 'brief' | 'detailed' | 'action-items') {
  switch (type) {
    case 'brief':
      return { 
        temperature: 0.3, 
        maxTokens: 1024
      };
    case 'detailed':
      return { 
        temperature: 0.5, 
        maxTokens: 2048
      };
    case 'action-items':
      return { 
        temperature: 0.2, 
        maxTokens: 1024
      };
  }
}

// Generate cache key with content hash
function getCacheKey(content: string, type: string): string {
  const hash = crypto.createHash('sha256').update(content).digest('hex');
  return `${type}:${hash}`;
}

// Generate ETag for cache validation
function generateETag(summary: string): string {
  return crypto.createHash('md5').update(summary).digest('hex');
}

// Check cache with stale-while-revalidate
function getCachedResponse(cacheKey: string, ifNoneMatch?: string): { 
  summary: string; 
  etag: string;
  isStale: boolean;
} | null {
  const cached = cache.get(cacheKey);
  if (!cached) return null;

  const now = Date.now();
  const age = (now - cached.timestamp) / 1000; // Age in seconds
  
  // Check if ETag matches
  if (ifNoneMatch && ifNoneMatch === cached.etag) {
    return null; // Not modified
  }

  // Return stale response if within revalidate window
  if (age > CACHE_DURATION && age <= STALE_WHILE_REVALIDATE) {
    return { ...cached, isStale: true };
  }

  // Return fresh response
  if (age <= CACHE_DURATION) {
    return { ...cached, isStale: false };
  }

  // Cache expired
  cache.delete(cacheKey);
  return null;
}

// Cache response with ETag
function cacheResponse(cacheKey: string, summary: string) {
  const etag = generateETag(summary);
  cache.set(cacheKey, {
    summary,
    timestamp: Date.now(),
    etag
  });
  return etag;
}

export async function POST(request: NextRequest) {
  try {
    // Throttle with exponential backoff
    const now = Date.now();
    if (now - lastRequestTime < currentInterval) {
      currentInterval = Math.min(currentInterval * 1.5, MAX_INTERVAL);
      return NextResponse.json(
        { error: 'Too many requests, please slow down.' },
        {
          status: 429,
          headers: {
            'Cache-Control': 'no-store',
            'Retry-After': Math.ceil(currentInterval / 1000).toString(),
          },
        }
      );
    }
    lastRequestTime = now;
    currentInterval = Math.max(MIN_INTERVAL, currentInterval * 0.8); // Gradually reduce backoff

    const body = await request.json();
    const { content, type } = inputSchema.parse(body);

    // Check cache with ETag
    const cacheKey = getCacheKey(content, type);
    const ifNoneMatch = request.headers.get('if-none-match') || undefined;
    const cached = getCachedResponse(cacheKey, ifNoneMatch);
    
    if (cached) {
      const headers: Record<string, string> = {
        'Cache-Control': `public, max-age=${CACHE_DURATION}, stale-while-revalidate=${STALE_WHILE_REVALIDATE}`,
        'ETag': cached.etag,
        'X-Cache': cached.isStale ? 'STALE' : 'HIT'
      };

      // If stale, trigger revalidation in background
      if (cached.isStale) {
        generateText(getPrompt(content, type), getModelConfig(type))
          .then(result => {
            if (result.text) {
              cacheResponse(cacheKey, result.text);
            }
          })
          .catch(console.error);
      }

      return NextResponse.json(
        { summary: cached.summary },
        { headers }
      );
    }

    // Get model configuration based on summary type
    const modelConfig = getModelConfig(type);

    // Generate summary using pro model
    const result = await generateText(getPrompt(content, type), modelConfig);

    // Handle errors
    if (result.error) {
      const status = result.error.includes('Rate limit') ? 429 : 500;
      const headers: Record<string, string> = {
        'Cache-Control': 'no-store',
      };

      if (result.retryAfter) {
        headers['Retry-After'] = Math.ceil(result.retryAfter / 1000).toString();
      }

      return NextResponse.json(
        { error: result.error },
        { status, headers }
      );
    }

    if (!result.text) {
      return NextResponse.json(
        { error: 'Failed to generate summary' },
        {
          status: 500,
          headers: { 'Cache-Control': 'no-store' },
        }
      );
    }

    // Cache the result with ETag
    const etag = cacheResponse(cacheKey, result.text);

    return NextResponse.json(
      { summary: result.text },
      {
        headers: {
          'Cache-Control': `public, max-age=${CACHE_DURATION}, stale-while-revalidate=${STALE_WHILE_REVALIDATE}`,
          'ETag': etag,
          'X-Cache': 'MISS'
        },
      }
    );
  } catch (error) {
    console.error('Error in summarize endpoint:', error);

    if (error instanceof z.ZodError) {
      return NextResponse.json(
        { error: 'Invalid request body', details: error.errors },
        {
          status: 400,
          headers: { 'Cache-Control': 'no-store' },
        }
      );
    }

    return NextResponse.json(
      { error: 'Internal server error' },
      {
        status: 500,
        headers: { 'Cache-Control': 'no-store' },
      }
    );
  }
}

// Helper function to generate prompts
function getPrompt(content: string, type: 'brief' | 'detailed' | 'action-items'): string {
  switch (type) {
    case 'brief':
      return `Summarize this email in 2-3 sentences, focusing on the main points:\n\n${content}`;
    case 'detailed':
      return `Provide a detailed summary of this email, including key points, context, and important details. Structure the summary in clear sections:\n\n${content}`;
    case 'action-items':
      return `Extract and list all action items, tasks, or requests from this email. Format each item clearly and include any deadlines or priorities mentioned:\n\n${content}`;
  }
}
