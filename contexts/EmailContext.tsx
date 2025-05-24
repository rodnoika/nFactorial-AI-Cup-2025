"use client"
import { createContext, useContext, useReducer, ReactNode } from 'react';
import { Email, EmailDetail } from '@/lib/gmail';

interface EmailState {
  emails: Email[];
  selectedEmail: EmailDetail | null;
  loading: boolean;
  error: string | null;
  nextPageToken: string | undefined;
}

type EmailAction =
  | { type: 'SET_EMAILS'; payload: { emails: Email[]; nextPageToken?: string } }
  | { type: 'APPEND_EMAILS'; payload: { emails: Email[]; nextPageToken?: string } }
  | { type: 'SET_SELECTED_EMAIL'; payload: EmailDetail | null }
  | { type: 'SET_LOADING'; payload: boolean }
  | { type: 'SET_ERROR'; payload: string | null }
  | { type: 'MARK_AS_READ'; payload: string }
  | { type: 'DELETE_EMAIL'; payload: string };

const initialState: EmailState = {
  emails: [],
  selectedEmail: null,
  loading: false,
  error: null,
  nextPageToken: undefined,
};

function emailReducer(state: EmailState, action: EmailAction): EmailState {
  switch (action.type) {
    case 'SET_EMAILS':
      return {
        ...state,
        emails: action.payload.emails,
        nextPageToken: action.payload.nextPageToken,
        loading: false,
        error: null,
      };
    case 'APPEND_EMAILS':
      return {
        ...state,
        emails: [...state.emails, ...action.payload.emails],
        nextPageToken: action.payload.nextPageToken,
        loading: false,
        error: null,
      };
    case 'SET_SELECTED_EMAIL':
      return {
        ...state,
        selectedEmail: action.payload,
      };
    case 'SET_LOADING':
      return {
        ...state,
        loading: action.payload,
        error: null,
      };
    case 'SET_ERROR':
      return {
        ...state,
        loading: false,
        error: action.payload,
      };
    case 'MARK_AS_READ':
      return {
        ...state,
        emails: state.emails.map((email) =>
          email.id === action.payload
            ? { ...email, isRead: true }
            : email
        ),
        selectedEmail: state.selectedEmail?.id === action.payload
          ? { ...state.selectedEmail, isRead: true }
          : state.selectedEmail,
      };
    case 'DELETE_EMAIL':
      return {
        ...state,
        emails: state.emails.filter((email) => email.id !== action.payload),
        selectedEmail: state.selectedEmail?.id === action.payload
          ? null
          : state.selectedEmail,
      };
    default:
      return state;
  }
}

const EmailContext = createContext<{
  state: EmailState;
  dispatch: React.Dispatch<EmailAction>;
} | null>(null);

export function EmailProvider({ children }: { children: ReactNode }) {
  const [state, dispatch] = useReducer(emailReducer, initialState);

  return (
    <EmailContext.Provider value={{ state, dispatch }}>
      {children}
    </EmailContext.Provider>
  );
}

export function useEmail() {
  const context = useContext(EmailContext);
  if (!context) {
    throw new Error('useEmail must be used within an EmailProvider');
  }
  return context;
} 