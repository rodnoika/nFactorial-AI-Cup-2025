'use client';

import { useEmail } from '@/contexts/EmailContext';
import { useRouter } from 'next/navigation';
import { useState } from 'react';
import { useChat } from '@/contexts/ChatContext';
import { Button } from '@/components/ui/button';
import { Wand2, Sparkles } from 'lucide-react';

interface ComposeEmailProps {
  onClose: () => void;
}

// Add logging utility
const log = {
  info: (message: string, data?: any) => {
    console.log(`[ComposeEmail] [INFO] ${new Date().toISOString()} - ${message}`, data ? JSON.stringify(data, null, 2) : '');
  },
  error: (message: string, error?: any) => {
    console.error(`[ComposeEmail] [ERROR] ${new Date().toISOString()} - ${message}`, error ? JSON.stringify(error, null, 2) : '');
  },
  warn: (message: string, data?: any) => {
    console.warn(`[ComposeEmail] [WARN] ${new Date().toISOString()} - ${message}`, data ? JSON.stringify(data, null, 2) : '');
  }
};

export function ComposeEmail({ onClose }: ComposeEmailProps) {
  const router = useRouter();
  const { dispatch } = useEmail();
  const { addMessage, setIsLoading } = useChat();
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [formData, setFormData] = useState({
    to: '',
    subject: '',
    body: '',
  });

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    log.info('Starting email submission', { 
      hasRecipient: !!formData.to,
      hasSubject: !!formData.subject,
      contentLength: formData.body.length
    });

    setError(null);
    setIsSubmitting(true);

    try {
      log.info('Making API request to send email');
      const response = await fetch('/api/gmail/send', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
        },
        body: JSON.stringify(formData),
      });

      if (!response.ok) {
        const data = await response.json();
        log.error('Email send failed', { status: response.status, error: data.error });
        throw new Error(data.error || 'Failed to send email');
      }

      log.info('Email sent successfully');
      dispatch({ type: 'SET_SELECTED_EMAIL', payload: null });
      onClose();
      router.refresh();
    } catch (err) {
      log.error('Error during email submission', err);
      setError(err instanceof Error ? err.message : 'Failed to send email');
    } finally {
      setIsSubmitting(false);
    }
  };

  const handleChange = (
    e: React.ChangeEvent<HTMLInputElement | HTMLTextAreaElement>
  ) => {
    const { name, value } = e.target;
    log.info('Form field changed', { field: name, valueLength: value.length });
    setFormData((prev) => ({ ...prev, [name]: value }));
  };

  const handleAIAssist = async (mode: 'full' | 'assist') => {
    log.info('Starting AI assistance', { 
      mode, 
      hasRecipient: !!formData.to,
      hasSubject: !!formData.subject,
      contentLength: formData.body.length
    });

    if (!formData.to || !formData.subject) {
      log.warn('Missing required fields for AI assistance', { 
        hasRecipient: !!formData.to,
        hasSubject: !!formData.subject
      });
      setError('Please provide recipient and subject before using AI assistance');
      return;
    }

    setIsLoading(true);
    try {
      const message = {
        role: 'user' as const,
        content: JSON.stringify({
          type: 'compose',
          action: mode === 'full' ? 'generate' : 'improve',
          mode,
          email: {
            to: [formData.to],
            subject: formData.subject,
            content: mode === 'assist' ? formData.body : ''
          }
        }),
        type: 'compose' as const
      };

      log.info('Making API request for AI assistance');
      const response = await fetch('/api/ai/chat', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          message: message.content,
          context: {
            email: {
              to: formData.to,
              subject: formData.subject,
              body: formData.body
            }
          }
        }),
      });

      if (!response.ok) {
        throw new Error('Failed to get AI assistance');
      }

      const data = await response.json();
      log.info('Received AI assistance response', { 
        type: data.type,
        hasMetadata: !!data.metadata,
        composeMode: mode
      });
      
      if (data.type === 'compose' && data.metadata?.composeData) {
        log.info('Updating form with AI-generated content');
        setFormData(prev => ({
          ...prev,
          body: data.metadata.composeData.content
        }));
      }
    } catch (err) {
      log.error('Error during AI assistance', err);
      setError(err instanceof Error ? err.message : 'Failed to get AI assistance');
    } finally {
      setIsLoading(false);
    }
  };

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-black bg-opacity-50 p-4">
      {/* eslint-disable-next-line jsx-a11y/no-noninteractive-element-interactions */}
      <div className="w-full max-w-2xl rounded-lg bg-white shadow-xl dark:bg-gray-800">
        <div className="flex items-center justify-between border-b border-gray-200 p-4 dark:border-gray-700">
          <h2 className="text-lg font-semibold text-gray-900 dark:text-white">
            New Message
          </h2>
          <div className="flex items-center gap-2">
            <Button
              variant="outline"
              size="sm"
              onClick={() => handleAIAssist('full')}
              disabled={isSubmitting || !formData.to || !formData.subject}
              className="flex items-center gap-2"
              aria-label="Generate email content using AI"
            >
              <Sparkles className="h-4 w-4" aria-hidden="true" />
              Generate
            </Button>
            <Button
              variant="outline"
              size="sm"
              onClick={() => handleAIAssist('assist')}
              disabled={isSubmitting || !formData.to || !formData.subject || !formData.body}
              className="flex items-center gap-2"
              aria-label="Improve existing email content using AI"
            >
              <Wand2 className="h-4 w-4" aria-hidden="true" />
              Improve
            </Button>
            <button
              onClick={onClose}
              className="rounded p-2 text-gray-500 hover:bg-gray-100 dark:text-gray-400 dark:hover:bg-gray-700"
              aria-label="Close compose email"
            >
              <svg
                xmlns="http://www.w3.org/2000/svg"
                className="h-5 w-5"
                viewBox="0 0 20 20"
                fill="currentColor"
                aria-hidden="true"
              >
                <path
                  fillRule="evenodd"
                  d="M4.293 4.293a1 1 0 011.414 0L10 8.586l4.293-4.293a1 1 0 111.414 1.414L11.414 10l4.293 4.293a1 1 0 01-1.414 1.414L10 11.414l-4.293 4.293a1 1 0 01-1.414-1.414L8.586 10 4.293 5.707a1 1 0 010-1.414z"
                  clipRule="evenodd"
                />
              </svg>
            </button>
          </div>
        </div>
        <form onSubmit={handleSubmit} className="p-4">
          <div className="space-y-4">
            <div>
              <label
                htmlFor="to"
                className="block text-sm font-medium text-gray-700 dark:text-gray-300"
              >
                To
              </label>
              <input
                type="email"
                id="to"
                name="to"
                required
                value={formData.to}
                onChange={handleChange}
                className="mt-1 block w-full rounded-md border border-gray-300 px-3 py-2 shadow-sm focus:border-blue-500 focus:outline-none focus:ring-1 focus:ring-blue-500 dark:border-gray-600 dark:bg-gray-700 dark:text-white"
                placeholder="recipient@example.com"
              />
            </div>
            <div>
              <label
                htmlFor="subject"
                className="block text-sm font-medium text-gray-700 dark:text-gray-300"
              >
                Subject
              </label>
              <input
                type="text"
                id="subject"
                name="subject"
                required
                value={formData.subject}
                onChange={handleChange}
                className="mt-1 block w-full rounded-md border border-gray-300 px-3 py-2 shadow-sm focus:border-blue-500 focus:outline-none focus:ring-1 focus:ring-blue-500 dark:border-gray-600 dark:bg-gray-700 dark:text-white"
                placeholder="Enter subject"
              />
            </div>
            <div>
              <label
                htmlFor="body"
                className="block text-sm font-medium text-gray-700 dark:text-gray-300"
              >
                Message
              </label>
              <textarea
                id="body"
                name="body"
                required
                value={formData.body}
                onChange={handleChange}
                rows={10}
                className="mt-1 block w-full rounded-md border border-gray-300 px-3 py-2 shadow-sm focus:border-blue-500 focus:outline-none focus:ring-1 focus:ring-blue-500 dark:border-gray-600 dark:bg-gray-700 dark:text-white"
                placeholder="Type your message here..."
              />
            </div>
            {error && (
              <div 
                className="rounded-md bg-red-50 p-4 text-sm text-red-700 dark:bg-red-900/50 dark:text-red-200"
                role="alert"
                aria-live="polite"
              >
                {error}
              </div>
            )}
          </div>
          <div className="mt-6 flex justify-end gap-3">
            <button
              type="button"
              onClick={onClose}
              className="rounded-md border border-gray-300 bg-white px-4 py-2 text-sm font-medium text-gray-700 shadow-sm hover:bg-gray-50 focus:outline-none focus:ring-2 focus:ring-blue-500 focus:ring-offset-2 dark:border-gray-600 dark:bg-gray-700 dark:text-gray-300 dark:hover:bg-gray-600"
              aria-label="Cancel composing email"
            >
              Cancel
            </button>
            <button
              type="submit"
              disabled={isSubmitting}
              className="inline-flex items-center rounded-md border border-transparent bg-blue-600 px-4 py-2 text-sm font-medium text-white shadow-sm hover:bg-blue-700 focus:outline-none focus:ring-2 focus:ring-blue-500 focus:ring-offset-2 disabled:cursor-not-allowed disabled:opacity-50"
              aria-label={isSubmitting ? "Sending email..." : "Send email"}
            >
              {isSubmitting ? (
                <>
                  <svg
                    className="mr-2 h-4 w-4 animate-spin"
                    xmlns="http://www.w3.org/2000/svg"
                    fill="none"
                    viewBox="0 0 24 24"
                  >
                    <circle
                      className="opacity-25"
                      cx="12"
                      cy="12"
                      r="10"
                      stroke="currentColor"
                      strokeWidth="4"
                    />
                    <path
                      className="opacity-75"
                      fill="currentColor"
                      d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4zm2 5.291A7.962 7.962 0 014 12H0c0 3.042 1.135 5.824 3 7.938l3-2.647z"
                    />
                  </svg>
                  Sending...
                </>
              ) : (
                'Send'
              )}
            </button>
          </div>
        </form>
      </div>
    </div>
  );
} 