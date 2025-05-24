'use client';

import { useEffect, useState } from 'react';
import { useEmail } from '@/contexts/EmailContext';
import { Email } from '@/lib/gmail';
import { format } from 'date-fns';
import { useRouter, useSearchParams } from 'next/navigation';
import { useDebounce } from '@/hooks/useDebounce';

export function EmailList() {
  const { state, dispatch } = useEmail();
  const router = useRouter();
  const searchParams = useSearchParams();
  const [searchQuery, setSearchQuery] = useState(searchParams.get('q') || '');
  const debouncedSearch = useDebounce(searchQuery, 300);

  useEffect(() => {
    const fetchEmails = async () => {
      try {
        dispatch({ type: 'SET_LOADING', payload: true });
        const response = await fetch(`/api/gmail/emails?q=${encodeURIComponent(debouncedSearch)}`);
        if (!response.ok) throw new Error('Failed to fetch emails');
        const data = await response.json();
        if (data.error) throw new Error(data.error);
        dispatch({ type: 'SET_EMAILS', payload: data });
      } catch (error) {
        console.error('Error fetching emails:', error);
        dispatch({ type: 'SET_ERROR', payload: error instanceof Error ? error.message : 'Failed to fetch emails' });
      } finally {
        dispatch({ type: 'SET_LOADING', payload: false });
      }
    };

    fetchEmails();
  }, [debouncedSearch, dispatch]);

  useEffect(() => {
    const params = new URLSearchParams(searchParams.toString());
    if (debouncedSearch) {
      params.set('q', debouncedSearch);
    } else {
      params.delete('q');
    }
    router.push(`?${params.toString()}`);
  }, [debouncedSearch, router, searchParams]);

  const handleEmailClick = async (email: Email) => {
    try {
      dispatch({ type: 'SET_LOADING', payload: true });
      const response = await fetch(`/api/gmail/emails/${email.id}`);
      if (!response.ok) throw new Error('Failed to fetch email details');
      const emailDetail = await response.json();
      dispatch({ type: 'SET_SELECTED_EMAIL', payload: emailDetail });

      if (!email.isRead) {
        await fetch(`/api/gmail/emails/${email.id}`, {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({ action: 'markAsRead' }),
        });
        dispatch({ type: 'MARK_AS_READ', payload: email.id });
      }
    } catch (error) {
      dispatch({ type: 'SET_ERROR', payload: 'Failed to fetch email details' });
    }
  };

  const handleDelete = async (emailId: string, e: React.MouseEvent) => {
    e.stopPropagation();
    try {
      const response = await fetch(`/api/gmail/emails/${emailId}`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ action: 'delete' }),
      });
      if (!response.ok) throw new Error('Failed to delete email');
      dispatch({ type: 'DELETE_EMAIL', payload: emailId });
    } catch (error) {
      dispatch({ type: 'SET_ERROR', payload: 'Failed to delete email' });
    }
  };

  return (
    <div className="flex h-full flex-col">
      <div className="sticky top-0 z-10 bg-white p-4 shadow-sm dark:bg-gray-800">
        <input
          type="search"
          placeholder="Search emails..."
          value={searchQuery}
          onChange={(e) => setSearchQuery(e.target.value)}
          className="w-full rounded-lg border border-gray-300 px-4 py-2 focus:border-primary focus:outline-none focus:ring-1 focus:ring-primary dark:border-gray-600 dark:bg-gray-700 dark:text-white"
        />
      </div>
      <div className="flex-1 overflow-y-auto">
        {state.loading && state.emails.length === 0 ? (
          <div className="flex h-full items-center justify-center">
            <div className="h-8 w-8 animate-spin rounded-full border-4 border-primary border-t-transparent" />
          </div>
        ) : state.error ? (
          <div className="flex h-full items-center justify-center text-red-500">
            {state.error}
          </div>
        ) : state.emails.length === 0 ? (
          <div className="flex h-full items-center justify-center text-gray-500">
            No emails found
          </div>
        ) : (
          <ul className="divide-y divide-gray-200 dark:divide-gray-700">
            {state.emails.map((email) => (
              <li
                key={email.id}
                onClick={() => handleEmailClick(email)}
                className={`cursor-pointer p-4 hover:bg-gray-50 dark:hover:bg-gray-700 ${
                  !email.isRead ? 'bg-blue-50 dark:bg-blue-900/20' : ''
                } ${state.selectedEmail?.id === email.id ? 'bg-gray-100 dark:bg-gray-700' : ''}`}
              >
                <div className="flex items-start justify-between">
                  <div className="flex-1">
                    <div className="flex items-center gap-2">
                      <span className="font-medium text-gray-900 dark:text-white">
                        {email.from}
                      </span>
                      {!email.isRead && (
                        <span className="h-2 w-2 rounded-full bg-blue-500" />
                      )}
                    </div>
                    <p className="mt-1 text-sm text-gray-900 dark:text-white">
                      {email.subject}
                    </p>
                    <p className="mt-1 text-sm text-gray-500 dark:text-gray-400">
                      {email.snippet}
                    </p>
                  </div>
                  <div className="ml-4 flex flex-col items-end gap-2">
                    <span className="text-sm text-gray-500 dark:text-gray-400">
                      {format(new Date(email.date), 'MMM d, h:mm a')}
                    </span>
                    <button
                      onClick={(e) => handleDelete(email.id, e)}
                      className="rounded p-1 text-gray-400 hover:bg-gray-100 hover:text-red-500 dark:hover:bg-gray-600"
                    >
                      <svg
                        xmlns="http://www.w3.org/2000/svg"
                        className="h-5 w-5"
                        viewBox="0 0 20 20"
                        fill="currentColor"
                      >
                        <path
                          fillRule="evenodd"
                          d="M9 2a1 1 0 00-.894.553L7.382 4H4a1 1 0 000 2v10a2 2 0 002 2h8a2 2 0 002-2V6a1 1 0 100-2h-3.382l-.724-1.447A1 1 0 0011 2H9zM7 8a1 1 0 012 0v6a1 1 0 11-2 0V8zm5-1a1 1 0 00-1 1v6a1 1 0 102 0V8a1 1 0 00-1-1z"
                          clipRule="evenodd"
                        />
                      </svg>
                    </button>
                  </div>
                </div>
              </li>
            ))}
          </ul>
        )}
      </div>
      {state.nextPageToken && (
        <div className="border-t border-gray-200 p-4 dark:border-gray-700">
          <button
            onClick={async () => {
              try {
                dispatch({ type: 'SET_LOADING', payload: true });
                const response = await fetch(
                  `/api/gmail/emails?pageToken=${state.nextPageToken}`
                );
                if (!response.ok) throw new Error('Failed to fetch more emails');
                const data = await response.json();
                dispatch({ type: 'APPEND_EMAILS', payload: data });
              } catch (error) {
                dispatch({ type: 'SET_ERROR', payload: 'Failed to fetch more emails' });
              }
            }}
            className="w-full rounded-lg bg-primary px-4 py-2 text-white hover:bg-primary/90"
          >
            Load More
          </button>
        </div>
      )}
    </div>
  );
} 