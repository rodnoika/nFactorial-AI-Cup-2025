'use client';

import { Button } from '@/components/ui/button';
import { MessageCircle } from 'lucide-react';
import { cn } from '@/lib/utils';

interface ChatButtonProps {
  onClick: () => void;
  unreadCount?: number;
  className?: string;
}

export function ChatButton({ onClick, unreadCount = 0, className }: ChatButtonProps) {
  return (
    <Button
      onClick={onClick}
      size="icon"
      className={cn(
        'fixed bottom-6 right-6 h-14 w-14 rounded-full shadow-lg transition-all hover:scale-105',
        className
      )}
    >
      <MessageCircle className="h-6 w-6" />
      {unreadCount > 0 && (
        <span className="absolute -right-1 -top-1 flex h-5 w-5 items-center justify-center rounded-full bg-red-500 text-xs text-white">
          {unreadCount}
        </span>
      )}
    </Button>
  );
} 