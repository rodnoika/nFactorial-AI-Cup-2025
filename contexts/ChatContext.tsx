'use client';

import { createContext, useContext, useState, ReactNode } from 'react';
import { v4 as uuidv4 } from 'uuid';

export interface ChatMessage {
  id: string;
  role: 'user' | 'assistant' | 'system';
  content: string;
  timestamp: Date;
  type?: 'summary' | 'compose' | 'query' | 'error' | 'system';
  metadata?: {
    emailId?: string;
    summaryType?: 'brief' | 'detailed' | 'action-items';
    composeData?: {
      to: string[];
      subject: string;
      content: string;
      attachments?: File[];
    };
    action?: 'send' | 'confirm';
    emailResult?: any;
  };
  read?: boolean;
}

interface ChatContextType {
  messages: ChatMessage[];
  currentEmail: any | null; // TODO: Replace with proper Email type
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
  selectedEmail: any | null; // Add selectedEmail to context
  setSelectedEmail: (email: any | null) => void; // Add setter for selectedEmail
}

const ChatContext = createContext<ChatContextType | undefined>(undefined);

export function ChatProvider({ children }: { children: ReactNode }) {
  const [messages, setMessages] = useState<ChatMessage[]>([]);
  const [currentEmail, setCurrentEmail] = useState<any | null>(null);
  const [selectedEmail, setSelectedEmail] = useState<any | null>(null); // Add selectedEmail state
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
    setSelectedEmail(null); // Clear selected email when chat is cleared
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
        selectedEmail, // Add selectedEmail to provider value
        setSelectedEmail, // Add setter to provider value
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