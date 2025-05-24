'use client';

import { useEffect } from 'react';
import { X } from 'lucide-react';
import { cn } from '@/lib/utils';
import { EmailChat } from '@/components/ai/EmailChat';

interface ChatDrawerProps {
  isOpen: boolean;
  onClose: () => void;
  className?: string;
}

export function ChatDrawer({ isOpen, onClose, className }: ChatDrawerProps) {
  // Close drawer on escape key
  useEffect(() => {
    const handleEscape = (e: KeyboardEvent) => {
      if (e.key === 'Escape') onClose();
    };

    if (isOpen) {
      document.addEventListener('keydown', handleEscape);
    }

    return () => {
      document.removeEventListener('keydown', handleEscape);
    };
  }, [isOpen, onClose]);

  // Prevent body scroll when drawer is open
  useEffect(() => {
    if (isOpen) {
      document.body.style.overflow = 'hidden';
    } else {
      document.body.style.overflow = 'unset';
    }

    return () => {
      document.body.style.overflow = 'unset';
    };
  }, [isOpen]);

  return (
    <>
      {/* Backdrop */}
      {isOpen && (
        <div
          className="fixed inset-0 z-40 bg-black/50 transition-opacity"
          onClick={onClose}
          aria-hidden="true"
        />
      )}

      {/* Drawer */}
      <div
        className={cn(
          'fixed right-0 top-0 z-50 h-full w-full max-w-md transform bg-background shadow-xl transition-transform duration-300 ease-in-out md:w-96',
          isOpen ? 'translate-x-0' : 'translate-x-full',
          className
        )}
      >
        <div className="flex h-full flex-col">
          <div className="flex items-center justify-between border-b p-4">
            <h2 className="text-lg font-semibold">Email Assistant</h2>
            <button
              onClick={onClose}
              className="rounded-full p-2 hover:bg-muted"
              aria-label="Close chat"
            >
              <X className="h-5 w-5" />
            </button>
          </div>
          <div className="flex-1 overflow-hidden">
            <EmailChat />
          </div>
        </div>
      </div>
    </>
  );
} 