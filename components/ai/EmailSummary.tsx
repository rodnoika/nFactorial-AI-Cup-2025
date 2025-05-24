'use client';

import { useState, useCallback } from 'react';
import { EmailDetail } from '@/lib/gmail';
import { useDebouncedCallback } from 'use-debounce';

type SummaryType = 'brief' | 'detailed' | 'action-items';
type ModelType = 'pro' | 'flash';

interface EmailSummaryProps {
  email: EmailDetail;
  onClose?: () => void;
}

interface SummaryResponse {
  summary: string;
  model: ModelType;
  error?: string;
}

export function EmailSummary({ email, onClose }: EmailSummaryProps) {
  const [summary, setSummary] = useState<string>('');
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [type, setType] = useState<SummaryType>('brief');
  const [retryCount, setRetryCount] = useState(0);
  const [retryAfter, setRetryAfter] = useState<number | null>(null);
  const [model, setModel] = useState<ModelType>('pro');

  // Debounced summary generation to prevent rapid requests
  const debouncedGenerateSummary = useDebouncedCallback(
    async (summaryType: SummaryType) => {
      try {
        setLoading(true);
        setError(null);
        setType(summaryType);

        const response = await fetch('/api/ai/summarize', {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({
            content: email.body || email.htmlBody || email.snippet,
            type: summaryType,
          }),
        });

        const data = await response.json() as SummaryResponse;

        if (!response.ok) {
          // Handle rate limit errors
          if (response.status === 429) {
            const retryAfter = parseInt(response.headers.get('Retry-After') || '5', 10);
            setRetryAfter(retryAfter);
            setModel(response.headers.get('X-Model') as ModelType || 'pro');
            setError(`Rate limit reached. Please wait ${retryAfter} seconds before trying again.`);
            
            // Auto-retry after the specified delay if we haven't retried too many times
            if (retryCount < 2) {
              setTimeout(() => {
                setRetryCount(prev => prev + 1);
                debouncedGenerateSummary(summaryType);
              }, retryAfter * 1000);
              return;
            }
          } else {
            throw new Error(data.error || 'Failed to generate summary');
          }
        }

        setSummary(data.summary);
        setModel(data.model);
        setRetryCount(0);
        setRetryAfter(null);
      } catch (err) {
        setError(err instanceof Error ? err.message : 'Failed to generate summary');
        setSummary('');
      } finally {
        setLoading(false);
      }
    },
    500 // 500ms debounce delay
  );

  const handleSummaryTypeChange = useCallback((summaryType: SummaryType) => {
    setRetryCount(0);
    setRetryAfter(null);
    debouncedGenerateSummary(summaryType);
  }, [debouncedGenerateSummary]);

  return (
    <div className="rounded-lg border border-gray-200 bg-white p-4 shadow-sm dark:border-gray-700 dark:bg-gray-800">
      <div className="mb-4 flex items-center justify-between">
        <div className="flex items-center gap-2">
          <h3 className="text-lg font-semibold text-gray-900 dark:text-white">
            AI Summary
          </h3>
          {model && (
            <span className="rounded-full bg-blue-100 px-2 py-0.5 text-xs font-medium text-blue-800 dark:bg-blue-900 dark:text-blue-300">
              {model === 'pro' ? 'Pro' : 'Flash'}
            </span>
          )}
        </div>
        <div className="flex gap-2">
          <button
            onClick={() => handleSummaryTypeChange('brief')}
            disabled={loading || (!!retryAfter && retryCount >= 2)}
            className={`rounded px-3 py-1 text-sm ${
              type === 'brief'
                ? 'bg-primary text-white'
                : 'bg-gray-100 text-gray-700 hover:bg-gray-200 dark:bg-gray-700 dark:text-gray-300 dark:hover:bg-gray-600'
            } disabled:opacity-50 disabled:cursor-not-allowed`}
          >
            Brief
          </button>
          <button
            onClick={() => handleSummaryTypeChange('detailed')}
            disabled={loading || (!!retryAfter && retryCount >= 2)}
            className={`rounded px-3 py-1 text-sm ${
              type === 'detailed'
                ? 'bg-primary text-white'
                : 'bg-gray-100 text-gray-700 hover:bg-gray-200 dark:bg-gray-700 dark:text-gray-300 dark:hover:bg-gray-600'
            } disabled:opacity-50 disabled:cursor-not-allowed`}
          >
            Detailed
          </button>
          <button
            onClick={() => handleSummaryTypeChange('action-items')}
            disabled={loading || (!!retryAfter && retryCount >= 2)}
            className={`rounded px-3 py-1 text-sm ${
              type === 'action-items'
                ? 'bg-primary text-white'
                : 'bg-gray-100 text-gray-700 hover:bg-gray-200 dark:bg-gray-700 dark:text-gray-300 dark:hover:bg-gray-600'
            } disabled:opacity-50 disabled:cursor-not-allowed`}
          >
            Action Items
          </button>
        </div>
        {onClose && (
          <button
            onClick={onClose}
            className="ml-2 rounded p-1 text-gray-400 hover:bg-gray-100 hover:text-gray-500 dark:hover:bg-gray-700"
          >
            <svg
              xmlns="http://www.w3.org/2000/svg"
              className="h-5 w-5"
              viewBox="0 0 20 20"
              fill="currentColor"
            >
              <path
                fillRule="evenodd"
                d="M4.293 4.293a1 1 0 011.414 0L10 8.586l4.293-4.293a1 1 0 111.414 1.414L11.414 10l4.293 4.293a1 1 0 01-1.414 1.414L10 11.414l-4.293 4.293a1 1 0 01-1.414-1.414L8.586 10 4.293 5.707a1 1 0 010-1.414z"
                clipRule="evenodd"
              />
            </svg>
          </button>
        )}
      </div>

      {loading ? (
        <div className="flex items-center justify-center py-8">
          <div className="h-8 w-8 animate-spin rounded-full border-4 border-primary border-t-transparent" />
        </div>
      ) : error ? (
        <div className="rounded-lg bg-red-50 p-4 text-red-700 dark:bg-red-900/20 dark:text-red-400">
          {error}
          {retryAfter && retryCount < 2 && (
            <div className="mt-2 text-sm">
              Retrying in {retryAfter} seconds...
            </div>
          )}
        </div>
      ) : summary ? (
        <div className="prose prose-sm max-w-none dark:prose-invert">
          <div className="whitespace-pre-wrap">{summary}</div>
        </div>
      ) : (
        <div className="flex items-center justify-center py-8 text-gray-500 dark:text-gray-400">
          Select a summary type to generate
        </div>
      )}
    </div>
  );
} 