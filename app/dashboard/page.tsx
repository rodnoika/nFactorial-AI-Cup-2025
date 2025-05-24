"use client";

import { EmailDetail } from '@/components/EmailDetail';
import { EmailList } from '@/components/EmailList';
import { ComposeEmail } from '@/components/ComposeEmail';
import { useState } from 'react';

export default function DashboardPage() {
  const [isComposing, setIsComposing] = useState(false);

  return (
    <div className="flex h-screen flex-col">
      <header className="border-b border-gray-200 bg-white px-4 py-3 shadow-sm dark:border-gray-700 dark:bg-gray-800">
        <div className="mx-auto flex max-w-7xl items-center justify-between">
          <h1 className="text-xl font-semibold text-gray-900 dark:text-white">
            Gmail Dashboard
          </h1>
          <button
            onClick={() => setIsComposing(true)}
            className="inline-flex items-center rounded-md bg-blue-600 px-4 py-2 text-sm font-medium text-white shadow-sm hover:bg-blue-700 focus:outline-none focus:ring-2 focus:ring-blue-500 focus:ring-offset-2"
          >
            <svg
              xmlns="http://www.w3.org/2000/svg"
              className="mr-2 h-5 w-5"
              viewBox="0 0 20 20"
              fill="currentColor"
            >
              <path
                fillRule="evenodd"
                d="M10 3a1 1 0 011 1v5h5a1 1 0 110 2h-5v5a1 1 0 11-2 0v-5H4a1 1 0 110-2h5V4a1 1 0 011-1z"
                clipRule="evenodd"
              />
            </svg>
            Compose
          </button>
        </div>
      </header>
      <main className="flex flex-1 overflow-hidden">
        <div className="w-1/3 border-r border-gray-200 dark:border-gray-700">
          <EmailList />
        </div>
        <div className="flex-1">
          <EmailDetail />
        </div>
      </main>
      {isComposing && <ComposeEmail onClose={() => setIsComposing(false)} />}
    </div>
  );
} 