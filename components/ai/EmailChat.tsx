'use client';

import { useState, useRef, useEffect } from 'react';
import { useChat } from '@/contexts/ChatContext';
import { Button } from '@/components/ui/button';
import { Card } from '@/components/ui/card';
import { Input } from '@/components/ui/input';
import { ScrollArea } from '@/components/ui/scroll-area';
import { SendIcon, Loader2, Check, X, Wand2, Sparkles, Tag } from 'lucide-react';
import DOMPurify from 'dompurify';
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from '@/components/ui/dialog';
import { useEmailCategories } from '@/hooks/useEmailCategories'
import { v4 as uuidv4 } from 'uuid';
import { cn } from '@/lib/utils'
import { type EmailCategory } from '@/types/email'

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

export type MessageType = 'text' | 'email' | 'compose' | 'compose-assist' | 'categorize' | 'error' | 'system' | 'query'

export interface ChatMessage {
  id: string
  role: 'user' | 'assistant' | 'system'
  content: string
  type: MessageType
  metadata?: {
    email?: {
      to: string
      subject: string
      content: string
      status: 'draft' | 'sent' | 'failed'
    }
    composeMode?: 'full' | 'assist'
    partialContent?: string
    action?: 'confirm' | 'cancel'
    category?: {
      email: string
      category: EmailCategory
      confidence: number
      reasoning: string
    }
    composeData?: {
      to: string[]
      subject: string
      content: string
      attachments?: File[]
    }
  }
  timestamp: Date
  read?: boolean
}

export function EmailChat() {
  const { messages, addMessage, isLoading, setIsLoading, selectedEmail } = useChat();
  const [input, setInput] = useState('');
  const [showConfirmDialog, setShowConfirmDialog] = useState(false);
  const [pendingEmail, setPendingEmail] = useState<any>(null);
  const [partialContent, setPartialContent] = useState('');
  const [showPartialInput, setShowPartialInput] = useState(false);
  const scrollRef = useRef<HTMLDivElement>(null);
  const inputRef = useRef<HTMLInputElement>(null);
  const [composeMode, setComposeMode] = useState<'full' | 'assist' | null>(null);
  const { categorizeEmail, isLoading: isCategorizing } = useEmailCategories()

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
          type: 'text',
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
        type: 'text',
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
        type: 'text',
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
      type: 'text',
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
        type: 'text',
      });
    } finally {
      if (!showConfirmDialog) {
        setIsLoading(false);
        inputRef.current?.focus();
      }
    }
  };

  const handleCategorize = async (email: string) => {
    const result = await categorizeEmail({ email })
    if (result) {
      addMessage({
        role: 'assistant',
        content: `Email ${email} categorized as ${result.category.name} with ${Math.round(result.confidence * 100)}% confidence.`,
        type: 'categorize' as const,
        metadata: {
          category: {
            email,
            category: result.category,
            confidence: result.confidence,
            reasoning: result.metadata?.reasoning || ''
          }
        }
      })
    }
  }

  const handleImprove = () => {
    setShowPartialInput(true);
    inputRef.current?.focus();
  };

  const handleGenerate = () => {
    handleComposeMode('full');
  };

  const handlePartialSubmit = () => {
    if (!partialContent.trim()) return;
    handleComposeMode('assist');
    setShowPartialInput(false);
    setPartialContent('');
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
          {message.type === 'categorize' && message.metadata?.category && (
            <div className="mt-2 rounded-md bg-background/50 p-2 text-sm">
              <div className="font-medium">
                Category: {message.metadata.category.category.name}
              </div>
              <div className="text-muted-foreground">
                Confidence: {Math.round(message.metadata.category.confidence * 100)}%
              </div>
              {message.metadata.category.reasoning && (
                <div className="mt-1 text-xs text-muted-foreground">
                  {message.metadata.category.reasoning}
                </div>
              )}
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
    <div className="flex h-full flex-col gap-4">
      <div className="flex-1 overflow-hidden">
        <ScrollArea className="h-full">
          <div className="flex flex-col gap-4 p-4">
            {messages.map(message => (
              <div
                key={message.id}
                className={cn(
                  'flex w-full',
                  message.role === 'user' ? 'justify-end' : 'justify-start'
                )}
              >
                <div
                  className={cn(
                    'flex max-w-[85%] flex-col gap-2 rounded-lg p-3',
                    message.role === 'user'
                      ? 'bg-primary text-primary-foreground'
                      : 'bg-muted'
                  )}
                >
                  <div className="break-words whitespace-pre-wrap">
                    {message.content}
                  </div>
                  {message.type === 'categorize' && message.metadata?.category && (
                    <div className="mt-2 rounded-md bg-background/50 p-2 text-sm">
                      <div className="font-medium">
                        Category: {message.metadata.category.category.name}
                      </div>
                      <div className="text-muted-foreground">
                        Confidence: {Math.round(message.metadata.category.confidence * 100)}%
                      </div>
                      {message.metadata.category.reasoning && (
                        <div className="mt-1 text-xs text-muted-foreground">
                          {message.metadata.category.reasoning}
                        </div>
                      )}
                    </div>
                  )}
                  <div className="text-xs opacity-70">
                    {message.timestamp.toLocaleTimeString()}
                  </div>
                </div>
              </div>
            ))}
          </div>
        </ScrollArea>
      </div>

      <div className="border-t p-4">
        <form onSubmit={handleSubmit} className="flex flex-col gap-4">
          {showPartialInput ? (
            <div className="flex flex-col gap-2">
              <Input
                value={partialContent}
                onChange={e => setPartialContent(e.target.value)}
                placeholder="Enter your draft email content..."
                disabled={isLoading}
                className="flex-1"
              />
              <div className="flex gap-2">
                <Button
                  type="button"
                  variant="outline"
                  onClick={() => {
                    setShowPartialInput(false);
                    setPartialContent('');
                  }}
                >
                  Cancel
                </Button>
                <Button
                  type="button"
                  onClick={handlePartialSubmit}
                  disabled={isLoading || !partialContent.trim()}
                >
                  {isLoading ? (
                    <Loader2 className="h-4 w-4 animate-spin" />
                  ) : (
                    <>
                      <Wand2 className="mr-2 h-4 w-4" />
                      Improve Draft
                    </>
                  )}
                </Button>
              </div>
            </div>
          ) : (
            <>
              <div className="flex gap-2">
                <Input
                  value={input}
                  onChange={e => setInput(e.target.value)}
                  placeholder="Type a message..."
                  disabled={isLoading || isCategorizing}
                  className="flex-1"
                />
                <Button type="submit" disabled={isLoading || isCategorizing || !input.trim()}>
                  {isLoading ? <Loader2 className="h-4 w-4 animate-spin" /> : 'Send'}
                </Button>
              </div>
              <div className="flex flex-wrap gap-2">
                <Button
                  type="button"
                  variant="outline"
                  onClick={() => handleCategorize(input)}
                  disabled={isCategorizing || !input.includes('@')}
                >
                  {isCategorizing ? (
                    <Loader2 className="h-4 w-4 animate-spin" />
                  ) : (
                    <>
                      <Tag className="mr-2 h-4 w-4" />
                      Categorize Email
                    </>
                  )}
                </Button>
                <Button
                  type="button"
                  variant="outline"
                  onClick={handleImprove}
                  disabled={isLoading}
                >
                  <Wand2 className="mr-2 h-4 w-4" />
                  Improve
                </Button>
                <Button
                  type="button"
                  variant="outline"
                  onClick={handleGenerate}
                  disabled={isLoading}
                >
                  <Sparkles className="mr-2 h-4 w-4" />
                  Generate
                </Button>
              </div>
            </>
          )}
        </form>
      </div>

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
    </div>
  );
} 