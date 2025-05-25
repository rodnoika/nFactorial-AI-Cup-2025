'use client';

import { useState, useRef, useEffect } from 'react';
import { useChat } from '@/contexts/ChatContext';
import { Button } from '@/components/ui/button';
import { Card } from '@/components/ui/card';
import { Input } from '@/components/ui/input';
import { ScrollArea } from '@/components/ui/scroll-area';
import { SendIcon, Loader2, Check, X, Wand2, Sparkles } from 'lucide-react';
import DOMPurify from 'dompurify';
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from '@/components/ui/dialog';

const log = {
  info: (message: string, data?: any) => {
    console.log(`[EmailChat] [INFO] ${new Date().toISOString()} - ${message}`, data ? JSON.stringify(data, null, 2) : '');
  },
  error: (message: string, error?: any) => {
    console.error(`[EmailChat] [ERROR] ${new Date().toISOString()} - ${message}`, error ? JSON.stringify(error, null, 2) : '');
  },
  warn: (message: string, data?: any) => {
    console.warn(`[EmailChat] [WARN] ${new Date().toISOString()} - ${message}`, data ? JSON.stringify(data, null, 2) : '');
  }
};

export function EmailChat() {
  const { messages, addMessage, isLoading, setIsLoading, selectedEmail } = useChat();
  const [input, setInput] = useState('');
  const [showConfirmDialog, setShowConfirmDialog] = useState(false);
  const [pendingEmail, setPendingEmail] = useState<any>(null);
  const scrollRef = useRef<HTMLDivElement>(null);
  const inputRef = useRef<HTMLInputElement>(null);
  const [composeMode, setComposeMode] = useState<'full' | 'assist' | null>(null);
  const [partialContent, setPartialContent] = useState('');

  useEffect(() => {
    if (scrollRef.current) {
      scrollRef.current.scrollTop = scrollRef.current.scrollHeight;
    }
  }, [messages]);

  const handleEmailConfirmation = async (confirmed: boolean) => {
    if (!pendingEmail) return;

    log.info('Processing email confirmation', { confirmed, pendingEmail });

    if (confirmed) {
      const confirmMessage = {
        role: 'user' as const,
        content: JSON.stringify({
          type: 'compose',
          action: 'send',
          email: pendingEmail.composeData
        }),
        type: 'compose' as const
      };

      log.info('Sending confirmation message', { messageType: confirmMessage.type });
      addMessage(confirmMessage);
      setInput('');
      setIsLoading(true);

      try {
        log.info('Making API request to send email');
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
        log.info('Received API response', { type: data.type, hasMetadata: !!data.metadata });
        
        addMessage({
          role: 'assistant',
          content: data.content,
          type: data.type,
          metadata: data.metadata,
        });
      } catch (error) {
        log.error('Error during email confirmation', error);
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
      log.info('Email sending cancelled by user');
      addMessage({
        role: 'system',
        content: 'Email sending cancelled.',
        type: 'system',
      });
      setShowConfirmDialog(false);
      setPendingEmail(null);
    }
  };

  const handleComposeMode = async (mode: 'full' | 'assist') => {
    log.info('Starting composition mode', { mode, hasPartialContent: !!partialContent });
    setComposeMode(mode);
    const message = {
      role: 'user' as const,
      content: JSON.stringify({
        type: 'compose',
        action: mode === 'full' ? 'generate' : 'improve',
        mode,
        partialContent: mode === 'assist' ? partialContent : undefined
      }),
      type: 'compose' as const
    };

    addMessage(message);
    setIsLoading(true);

    try {
      log.info('Making API request for composition');
      const response = await fetch('/api/ai/chat', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          message: message.content,
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
      log.info('Received composition response', { 
        type: data.type, 
        hasMetadata: !!data.metadata,
        composeMode: mode 
      });

      addMessage({
        role: 'assistant',
        content: data.content,
        type: data.type,
        metadata: {
          ...data.metadata,
          composeMode: mode
        },
      });
    } catch (error) {
      log.error('Error during composition', error);
      addMessage({
        role: 'system',
        content: 'Sorry, I encountered an error while composing the email. Please try again.',
        type: 'error',
      });
    } finally {
      setIsLoading(false);
      setComposeMode(null);
    }
  };

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!input.trim() || isLoading) return;

    const userMessage = input.trim();
    log.info('Processing user message', { 
      messageLength: userMessage.length,
      hasSelectedEmail: !!selectedEmail 
    });

    setInput('');
    addMessage({
      role: 'user',
      content: userMessage,
      type: 'query',
    });

    setIsLoading(true);
    try {
      log.info('Making API request for chat');
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
      log.info('Received chat response', { 
        type: data.type, 
        hasMetadata: !!data.metadata,
        requiresConfirmation: data.metadata?.action === 'confirm'
      });

      if (data.type === 'compose' && data.metadata?.action === 'confirm') {
        log.info('Showing confirmation dialog');
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
      log.error('Error during chat', error);
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
        className={`flex ${isUser ? 'justify-end' : 'justify-start'} mb-4 w-full table-row`}
      >
        <div
          className={`relative flex flex-col max-w-[85%] min-w-0 w-auto table-cell rounded-lg px-4 py-2 ${
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
              className="prose prose-sm dark:prose-invert max-w-none break-words whitespace-pre-wrap flex-1 w-full overflow-hidden"
              dangerouslySetInnerHTML={{ __html: message.content }}
            />
          ) : (
            <div className="flex flex-col min-w-0 w-full flex-1">
              <p className="whitespace-pre-wrap break-all overflow-hidden text-sm flex-1 w-full">
                {message.content}
              </p>
            </div>
          )}
          {isCompose && message.metadata?.composeData && (
            <div className="mt-2 text-sm border-t pt-2 space-y-2 flex flex-col w-full">
              <p className="break-all flex-shrink-0 w-full overflow-hidden"><strong>To:</strong> {message.metadata.composeData.to.join(', ')}</p>
              <p className="break-words flex-shrink-0 w-full overflow-hidden"><strong>Subject:</strong> {message.metadata.composeData.subject}</p>
              <p className="flex-shrink-0 w-full overflow-hidden"><strong>Content:</strong></p>
              <div className="mt-1 p-2 bg-white dark:bg-gray-800 rounded whitespace-pre-wrap break-words flex-1 w-full overflow-hidden">
                {message.metadata.composeData.content}
              </div>
            </div>
          )}
          <div className="text-xs opacity-70 mt-1 flex-shrink-0 w-full overflow-hidden">
            {new Date(message.timestamp).toLocaleTimeString()}
          </div>
        </div>
      </div>
    );
  };

  const CompositionControls = () => (
    <div className="flex gap-2 mb-4">
      <Button
        variant="outline"
        onClick={() => handleComposeMode('full')}
        disabled={isLoading}
        className="flex items-center gap-2"
      >
        <Sparkles className="h-4 w-4" />
        Generate Full Email
      </Button>
      <Button
        variant="outline"
        onClick={() => handleComposeMode('assist')}
        disabled={isLoading || !partialContent.trim()}
        className="flex items-center gap-2"
      >
        <Wand2 className="h-4 w-4" />
        Help Me Write
      </Button>
    </div>
  );

  return (
    <>
      <Card className="flex flex-col h-[600px] w-full">
        <div className="p-4 border-b">
          <h2 className="text-lg font-semibold">Email Assistant</h2>
        </div>
        <ScrollArea ref={scrollRef} className="flex-1 p-4 w-full">
          <div className="space-y-4 w-full min-w-full table">
            {messages.map(renderMessage)}
            {isLoading && (
              <div className="flex justify-start mb-4 w-full">
                <div className="bg-card text-card-foreground border rounded-lg px-4 py-2">
                  <Loader2 className="h-4 w-4 animate-spin" />
                </div>
              </div>
            )}
          </div>
        </ScrollArea>
        <form onSubmit={handleSubmit} className="p-4 border-t space-y-4 w-full">
          <CompositionControls />
          <div className="flex gap-2 w-full">
            <Input
              ref={inputRef}
              value={input}
              onChange={(e) => {
                setInput(e.target.value);
                if (composeMode === 'assist') {
                  setPartialContent(e.target.value);
                }
              }}
              placeholder="Ask about your emails or compose a new one..."
              disabled={isLoading}
              className="flex-1 min-w-0"
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