'use client';

import { useEmail } from '@/contexts/EmailContext';
import { format } from 'date-fns';
import { useRouter } from 'next/navigation';
import { EmailSummary } from '@/components/ai/EmailSummary';

export function EmailDetail() {
  const { state, dispatch } = useEmail();
  const router = useRouter();

  if (!state.selectedEmail) {
    return (
      <div className="flex h-full items-center justify-center text-gray-500">
        Select an email to view its content
      </div>
    );
  }

  const { from, to, subject, date, body, htmlBody, attachments } = state.selectedEmail;

  const handleBack = () => {
    dispatch({ type: 'SET_SELECTED_EMAIL', payload: null });
    router.back();
  };

  return (
    <div className="flex h-full flex-col">
      <div className="sticky top-0 z-10 border-b border-gray-200 bg-white p-4 shadow-sm dark:border-gray-700 dark:bg-gray-800">
        <div className="flex items-center gap-4">
          <button
            onClick={handleBack}
            className="rounded p-2 text-gray-500 hover:bg-gray-100 dark:text-gray-400 dark:hover:bg-gray-700"
          >
            <svg
              xmlns="http://www.w3.org/2000/svg"
              className="h-5 w-5"
              viewBox="0 0 20 20"
              fill="currentColor"
            >
              <path
                fillRule="evenodd"
                d="M9.707 16.707a1 1 0 01-1.414 0l-6-6a1 1 0 010-1.414l6-6a1 1 0 011.414 1.414L5.414 9H17a1 1 0 110 2H5.414l4.293 4.293a1 1 0 010 1.414z"
                clipRule="evenodd"
              />
            </svg>
          </button>
          <h1 className="text-xl font-semibold text-gray-900 dark:text-white">
            {subject}
          </h1>
        </div>
      </div>
      
      <div className="flex-1 overflow-y-auto p-4">
        <div className="mx-auto max-w-3xl space-y-6">
          <div className="mb-6 space-y-4">
            <div className="flex items-start justify-between">
              <div>
                <p className="text-sm text-gray-500 dark:text-gray-400">From</p>
                <p className="text-gray-900 dark:text-white">{from}</p>
              </div>
              <div className="text-right">
                <p className="text-sm text-gray-500 dark:text-gray-400">Date</p>
                <p className="text-gray-900 dark:text-white">
                  {format(new Date(date), 'MMM d, yyyy h:mm a')}
                </p>
              </div>
            </div>
            <div>
              <p className="text-sm text-gray-500 dark:text-gray-400">To</p>
              <p className="text-gray-900 dark:text-white">{to}</p>
            </div>
          </div>

          <EmailSummary email={state.selectedEmail} />

          {attachments && attachments.length > 0 && (
            <div className="mb-6">
              <h2 className="mb-2 text-sm font-medium text-gray-900 dark:text-white">
                Attachments
              </h2>
              <div className="space-y-2">
                {attachments.map((attachment) => (
                  <div
                    key={attachment.id}
                    className="flex items-center gap-2 rounded-lg border border-gray-200 p-2 dark:border-gray-700"
                  >
                    <svg
                      xmlns="http://www.w3.org/2000/svg"
                      className="h-5 w-5 text-gray-400"
                      viewBox="0 0 20 20"
                      fill="currentColor"
                    >
                      <path
                        fillRule="evenodd"
                        d="M8 4a3 3 0 00-3 3v4a5 5 0 0010 0V7a1 1 0 112 0v4a7 7 0 11-14 0V7a5 5 0 0110 0v4a3 3 0 11-6 0V7a1 1 0 012 0v4a1 1 0 102 0V7a3 3 0 00-3-3z"
                        clipRule="evenodd"
                      />
                    </svg>
                    <span className="text-sm text-gray-900 dark:text-white">
                      {attachment.filename}
                    </span>
                    <span className="text-xs text-gray-500 dark:text-gray-400">
                      ({Math.round(attachment.size / 1024)} KB)
                    </span>
                  </div>
                ))}
              </div>
            </div>
          )}
          
          <div className="prose prose-sm max-w-none dark:prose-invert">
            {htmlBody ? (
              <div dangerouslySetInnerHTML={{ __html: htmlBody }} />
            ) : (
              <p className="whitespace-pre-wrap">{body}</p>
            )}
          </div>
        </div>
      </div>
    </div>
  );
} 