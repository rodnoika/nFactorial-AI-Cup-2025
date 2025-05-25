'use client';

import { createContext, useContext, useState, ReactNode } from 'react';
import { v4 as uuidv4 } from 'uuid';
import { type EmailCategory, type EmailContact } from '@/types/email'

export interface ChatMessage {
  id: string;
  role: 'user' | 'assistant' | 'system';
  content: string;
  type: 'text' | 'email' | 'compose' | 'compose-assist' | 'categorize';
  metadata?: {
    email?: {
      to: string;
      subject: string;
      content: string;
      status: 'draft' | 'sent' | 'failed';
    };
    composeMode?: 'full' | 'assist';
    partialContent?: string;
    action?: 'confirm' | 'cancel';
    category?: {
      email: string;
      category: EmailCategory;
      confidence: number;
      reasoning: string;
    };
    composeData?: {
      to: string[];
      subject: string;
      content: string;
      attachments?: File[];
    };
  };
  timestamp: Date;
  read?: boolean;
}

interface ChatContextType {
  messages: ChatMessage[];
  currentEmail: any | null;
  addMessage: (message: Omit<ChatMessage, 'id' | 'timestamp'>) => void;
  clearChat: () => void;
  setCurrentEmail: (email: any | null) => void;
  isLoading: boolean;
  setIsLoading: (loading: boolean) => void;
  isDrawerOpen: boolean;
  toggleDrawer: () => void;
  closeDrawer: () => void;
  openDrawer: () => void;
  unreadCount: number;
  markAllAsRead: () => void;
  selectedEmail: any | null; 
  setSelectedEmail: (email: any | null) => void; 
}

const ChatContext = createContext<ChatContextType | undefined>(undefined);

export function ChatProvider({ children }: { children: ReactNode }) {
  const [messages, setMessages] = useState<ChatMessage[]>([]);
  const [currentEmail, setCurrentEmail] = useState<any | null>(null);
  const [selectedEmail, setSelectedEmail] = useState<any | null>(null); 
  const [isLoading, setIsLoading] = useState(false);
  const [isDrawerOpen, setIsDrawerOpen] = useState(false);

  const addMessage = (message: Omit<ChatMessage, 'id' | 'timestamp'>) => {
    const newMessage: ChatMessage = {
      ...message,
      id: uuidv4(),
      timestamp: new Date(),
      read: false,
    };
    setMessages((prev) => [...prev, newMessage]);
  };

  const clearChat = () => {
    setMessages([]);
    setCurrentEmail(null);
    setSelectedEmail(null); 
  };

  const toggleDrawer = () => setIsDrawerOpen((prev) => !prev);
  const closeDrawer = () => setIsDrawerOpen(false);
  const openDrawer = () => setIsDrawerOpen(true);

  const unreadCount = messages.filter((msg) => !msg.read && msg.role === 'assistant').length;

  const markAllAsRead = () => {
    setMessages((prev) =>
      prev.map((msg) => (msg.role === 'assistant' ? { ...msg, read: true } : msg))
    );
  };

  return (
    <ChatContext.Provider
      value={{
        messages,
        currentEmail,
        addMessage,
        clearChat,
        setCurrentEmail,
        isLoading,
        setIsLoading,
        isDrawerOpen,
        toggleDrawer,
        closeDrawer,
        openDrawer,
        unreadCount,
        markAllAsRead,
        selectedEmail, 
        setSelectedEmail,
      }}
    >
      {children}
    </ChatContext.Provider>
  );
}

export function useChat() {
  const context = useContext(ChatContext);
  if (context === undefined) {
    throw new Error('useChat must be used within a ChatProvider');
  }
  return context;
} 