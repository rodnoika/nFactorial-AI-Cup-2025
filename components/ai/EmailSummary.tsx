'use client';

import { useState } from 'react';
import { Button } from '@/components/ui/button';
import { Card } from '@/components/ui/card';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { Skeleton } from '@/components/ui/skeleton';
import { formatSummary, extractActionItems } from '@/lib/ai/formatting';
import DOMPurify from 'dompurify';

interface EmailSummaryProps {
  emailId: string;
  subject: string;
  content: string;
  onSummaryGenerated?: (summary: string) => void;
}

interface SummaryResponse {
  summary: string;
  type: 'brief' | 'detailed' | 'action-items';
}

export function EmailSummary({ emailId, subject, content, onSummaryGenerated }: EmailSummaryProps) {
  const [summary, setSummary] = useState<string | null>(null);
  const [type, setType] = useState<'brief' | 'detailed' | 'action-items'>('brief');
  const [isLoading, setIsLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [retryAfter, setRetryAfter] = useState<number | null>(null);

  const generateSummary = async (summaryType: 'brief' | 'detailed' | 'action-items') => {
    if (!content) {
      setError('No email content available to summarize');
      return;
    }

    setIsLoading(true);
    setError(null);
    setRetryAfter(null);

    try {
      const response = await fetch('/api/ai/summarize', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          emailId,
          subject,
          content,
          type: summaryType,
        }),
      });

      if (!response.ok) {
        const error = await response.json();
        if (response.status === 429) {
          setRetryAfter(error.retryAfter);
          setError('Rate limit exceeded. Please try again later.');
        } else {
          setError(error.message || 'Failed to generate summary');
        }
        return;
      }

      const data: SummaryResponse = await response.json();
      const sanitizedSummary = DOMPurify.sanitize(data.summary, {
        ALLOWED_TAGS: ['h2', 'p', 'ul', 'li', 'strong', 'em', 'br'],
        ALLOWED_ATTR: ['class'],
      });
      
      setSummary(sanitizedSummary);
      onSummaryGenerated?.(sanitizedSummary);
    } catch (err) {
      setError('Failed to generate summary. Please try again.');
      console.error('Summary generation error:', err);
    } finally {
      setIsLoading(false);
    }
  };

  const handleTypeChange = (value: string) => {
    const newType = value as 'brief' | 'detailed' | 'action-items';
    setType(newType);
    generateSummary(newType);
  };

  const getActionItems = () => {
    if (!summary || type !== 'action-items') return null;
    const items = extractActionItems(summary);
    return (
      <div className="mt-4 space-y-4">
        {items.high.length > 0 && (
          <div>
            <h3 className="text-lg font-semibold text-red-600 mb-2">High Priority</h3>
            <ul className="list-disc list-inside space-y-1">
              {items.high.map((item: string, i: number) => (
                <li key={i} className="text-gray-700">{item}</li>
              ))}
            </ul>
          </div>
        )}
        {items.medium.length > 0 && (
          <div>
            <h3 className="text-lg font-semibold text-yellow-600 mb-2">Medium Priority</h3>
            <ul className="list-disc list-inside space-y-1">
              {items.medium.map((item: string, i: number) => (
                <li key={i} className="text-gray-700">{item}</li>
              ))}
            </ul>
          </div>
        )}
        {items.low.length > 0 && (
          <div>
            <h3 className="text-lg font-semibold text-green-600 mb-2">Low Priority</h3>
            <ul className="list-disc list-inside space-y-1">
              {items.low.map((item: string, i: number) => (
                <li key={i} className="text-gray-700">{item}</li>
              ))}
            </ul>
          </div>
        )}
      </div>
    );
  };

  const renderSummaryContent = () => {
    if (!summary) return null;

    return (
      <div 
        className="prose prose-sm max-w-none dark:prose-invert"
        dangerouslySetInnerHTML={{ __html: summary }}
      />
    );
  };

  return (
    <Card className="p-4">
      <div className="mb-4 flex items-center justify-between">
        <h2 className="text-lg font-semibold text-gray-900 dark:text-white">Summary</h2>
        <Select value={type} onValueChange={handleTypeChange}>
          <SelectTrigger className="w-[180px]">
            <SelectValue placeholder="Select type" />
          </SelectTrigger>
          <SelectContent>
            <SelectItem value="brief">Brief Summary</SelectItem>
            <SelectItem value="detailed">Detailed Summary</SelectItem>
            <SelectItem value="action-items">Action Items</SelectItem>
          </SelectContent>
        </Select>
      </div>

      {isLoading ? (
        <div className="space-y-3">
          <Skeleton className="h-4 w-3/4" />
          <Skeleton className="h-4 w-full" />
          <Skeleton className="h-4 w-5/6" />
        </div>
      ) : error ? (
        <div className="rounded-md bg-red-50 p-4 text-sm text-red-700 dark:bg-red-900/50 dark:text-red-200">
          <p>{error}</p>
          {retryAfter && (
            <p className="mt-2">
              Please try again in {Math.ceil(retryAfter / 1000)} seconds.
            </p>
          )}
        </div>
      ) : summary ? (
        renderSummaryContent()
      ) : (
        <div className="text-center">
          <Button
            onClick={() => generateSummary(type)}
            disabled={isLoading}
            className="w-full"
          >
            Generate Summary
          </Button>
        </div>
      )}
    </Card>
  );
} 