'use client';

import { useState, useRef, useEffect } from 'react';
import { useChat } from '@/contexts/ChatContext';
import { Button } from '@/components/ui/button';
import { Card } from '@/components/ui/card';
import { Input } from '@/components/ui/input';
import { ScrollArea } from '@/components/ui/scroll-area';
import { SendIcon, Loader2, Check, X } from 'lucide-react';
import DOMPurify from 'dompurify';
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from '@/components/ui/dialog';

export function EmailChat() {
  const { messages, addMessage, isLoading, setIsLoading, selectedEmail } = useChat();
  const [input, setInput] = useState('');
  const [showConfirmDialog, setShowConfirmDialog] = useState(false);
  const [pendingEmail, setPendingEmail] = useState<any>(null);
  const scrollRef = useRef<HTMLDivElement>(null);
  const inputRef = useRef<HTMLInputElement>(null);

  useEffect(() => {
    if (scrollRef.current) {
      scrollRef.current.scrollTop = scrollRef.current.scrollHeight;
    }
  }, [messages]);

  const handleEmailConfirmation = async (confirmed: boolean) => {
    if (!pendingEmail) return;

    if (confirmed) {
      // Update the action to 'send' and resend the message
      const confirmMessage = {
        role: 'user' as const,
        content: JSON.stringify({
          type: 'compose',
          action: 'send',
          email: pendingEmail.composeData
        }),
        type: 'compose' as const
      };

      addMessage(confirmMessage);
      setInput('');
      setIsLoading(true);

      try {
        const response = await fetch('/api/ai/chat', {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({
            message: confirmMessage.content,
            context: {
              messages: messages.slice(-5),
              email: selectedEmail ? {
                id: selectedEmail.id,
                subject: selectedEmail.subject,
                from: selectedEmail.from,
                to: selectedEmail.to,
                date: selectedEmail.date,
                body: selectedEmail.body,
                htmlBody: selectedEmail.htmlBody,
              } : null,
            },
          }),
        });

        if (!response.ok) {
          throw new Error('Failed to get response');
        }

        const data = await response.json();
        addMessage({
          role: 'assistant',
          content: data.content,
          type: data.type,
          metadata: data.metadata,
        });
      } catch (error) {
        console.error('Chat error:', error);
        addMessage({
          role: 'system',
          content: 'Sorry, I encountered an error while sending the email. Please try again.',
          type: 'error',
        });
      } finally {
        setIsLoading(false);
        setShowConfirmDialog(false);
        setPendingEmail(null);
        inputRef.current?.focus();
      }
    } else {
      addMessage({
        role: 'system',
        content: 'Email sending cancelled.',
        type: 'system',
      });
      setShowConfirmDialog(false);
      setPendingEmail(null);
    }
  };

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!input.trim() || isLoading) return;

    const userMessage = input.trim();
    setInput('');
    addMessage({
      role: 'user',
      content: userMessage,
      type: 'query',
    });

    setIsLoading(true);
    try {
      const response = await fetch('/api/ai/chat', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          message: userMessage,
          context: {
            messages: messages.slice(-5),
            email: selectedEmail ? {
              id: selectedEmail.id,
              subject: selectedEmail.subject,
              from: selectedEmail.from,
              to: selectedEmail.to,
              date: selectedEmail.date,
              body: selectedEmail.body,
              htmlBody: selectedEmail.htmlBody,
            } : null,
          },
        }),
      });

      if (!response.ok) {
        throw new Error('Failed to get response');
      }

      const data = await response.json();

      // Handle email composition confirmation
      if (data.type === 'compose' && data.metadata?.action === 'confirm') {
        setPendingEmail(data.metadata);
        setShowConfirmDialog(true);
        addMessage({
          role: 'assistant',
          content: 'Please confirm the email details before sending:',
          type: 'compose',
          metadata: data.metadata,
        });
      } else {
        const sanitizedContent = DOMPurify.sanitize(data.content, {
          ALLOWED_TAGS: ['p', 'br', 'strong', 'em', 'ul', 'li', 'a'],
          ALLOWED_ATTR: ['href', 'target'],
        });

        addMessage({
          role: 'assistant',
          content: sanitizedContent,
          type: data.type,
          metadata: data.metadata,
        });
      }
    } catch (error) {
      console.error('Chat error:', error);
      addMessage({
        role: 'system',
        content: 'Sorry, I encountered an error. Please try again.',
        type: 'error',
      });
    } finally {
      if (!showConfirmDialog) {
        setIsLoading(false);
        inputRef.current?.focus();
      }
    }
  };

  const renderMessage = (message: typeof messages[0]) => {
    const isUser = message.role === 'user';
    const isSystem = message.role === 'system';
    const isCompose = message.type === 'compose';

    return (
      <div
        key={message.id}
        className={`flex ${isUser ? 'justify-end' : 'justify-start'} mb-4`}
      >
        <div
          className={`max-w-[80%] rounded-lg px-4 py-2 ${
            isUser
              ? 'bg-primary text-primary-foreground'
              : isSystem
              ? 'bg-muted text-muted-foreground'
              : isCompose
              ? 'bg-blue-50 dark:bg-blue-900/20 border border-blue-200 dark:border-blue-800'
              : 'bg-card text-card-foreground border'
          }`}
        >
          {message.role === 'assistant' ? (
            <div
              className="prose prose-sm dark:prose-invert max-w-none"
              dangerouslySetInnerHTML={{ __html: message.content }}
            />
          ) : (
            <p className="whitespace-pre-wrap">{message.content}</p>
          )}
          {isCompose && message.metadata?.composeData && (
            <div className="mt-2 text-sm border-t pt-2">
              <p><strong>To:</strong> {message.metadata.composeData.to.join(', ')}</p>
              <p><strong>Subject:</strong> {message.metadata.composeData.subject}</p>
              <p><strong>Content:</strong></p>
              <div className="mt-1 p-2 bg-white dark:bg-gray-800 rounded">
                {message.metadata.composeData.content}
              </div>
            </div>
          )}
          <div className="text-xs opacity-70 mt-1">
            {new Date(message.timestamp).toLocaleTimeString()}
          </div>
        </div>
      </div>
    );
  };

  return (
    <>
      <Card className="flex flex-col h-[600px]">
        <div className="p-4 border-b">
          <h2 className="text-lg font-semibold">Email Assistant</h2>
        </div>
        <ScrollArea ref={scrollRef} className="flex-1 p-4">
          <div className="space-y-4">
            {messages.map(renderMessage)}
            {isLoading && (
              <div className="flex justify-start mb-4">
                <div className="bg-card text-card-foreground border rounded-lg px-4 py-2">
                  <Loader2 className="h-4 w-4 animate-spin" />
                </div>
              </div>
            )}
          </div>
        </ScrollArea>
        <form onSubmit={handleSubmit} className="p-4 border-t">
          <div className="flex gap-2">
            <Input
              ref={inputRef}
              value={input}
              onChange={(e) => setInput(e.target.value)}
              placeholder="Ask about your emails or compose a new one..."
              disabled={isLoading}
              className="flex-1"
            />
            <Button type="submit" disabled={isLoading || !input.trim()}>
              <SendIcon className="h-4 w-4" />
            </Button>
          </div>
        </form>
      </Card>

      <Dialog open={showConfirmDialog} onOpenChange={setShowConfirmDialog}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle>Confirm Email</DialogTitle>
            <DialogDescription>
              Please review the email details before sending:
            </DialogDescription>
          </DialogHeader>
          {pendingEmail?.composeData && (
            <div className="space-y-4">
              <div>
                <p className="font-medium">To:</p>
                <p className="text-sm">{pendingEmail.composeData.to.join(', ')}</p>
              </div>
              <div>
                <p className="font-medium">Subject:</p>
                <p className="text-sm">{pendingEmail.composeData.subject}</p>
              </div>
              <div>
                <p className="font-medium">Content:</p>
                <div className="mt-1 p-2 bg-gray-50 dark:bg-gray-800 rounded text-sm">
                  {pendingEmail.composeData.content}
                </div>
              </div>
            </div>
          )}
          <DialogFooter>
            <Button
              variant="outline"
              onClick={() => handleEmailConfirmation(false)}
            >
              <X className="h-4 w-4 mr-2" />
              Cancel
            </Button>
            <Button
              onClick={() => handleEmailConfirmation(true)}
              disabled={isLoading}
            >
              {isLoading ? (
                <Loader2 className="h-4 w-4 mr-2 animate-spin" />
              ) : (
                <Check className="h-4 w-4 mr-2" />
              )}
              Send Email
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </>
  );
} 