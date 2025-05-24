import { google } from 'googleapis';
import { auth } from '@/app/auth';
import { gmail_v1 } from 'googleapis';

const gmail = google.gmail('v1');

export interface Email {
  id: string;
  threadId: string;
  snippet: string;
  from: string;
  to: string;
  subject: string;
  date: string;
  isRead: boolean;
  labels: string[];
}

export interface EmailDetail extends Email {
  body: string;
  htmlBody?: string;
  attachments?: Array<{
    id: string;
    filename: string;
    mimeType: string;
    size: number;
  }>;
}

export async function getGmailClient() {
  const session = await auth();
  
  if (!session?.accessToken) {
    throw new Error('Not authenticated');
  }

  const oauth2Client = new google.auth.OAuth2();
  oauth2Client.setCredentials({
    access_token: session.accessToken,
  });

  return { gmail, auth: oauth2Client };
}

export async function getEmails(maxResults = 10, pageToken?: string, query?: string) {
  try {
    const { gmail, auth } = await getGmailClient();

    const response = await gmail.users.messages.list({
      userId: 'me',
      maxResults,
      pageToken,
      q: query,
      auth,
    });

    if (!response.data.messages) {
      return { messages: [], nextPageToken: undefined };
    }

    const messages = await Promise.all(
      response.data.messages.map(async (message) => {
        const details = await gmail.users.messages.get({
          userId: 'me',
          id: message.id!,
          auth,
        });

        const headers = details.data.payload?.headers;
        const subject = headers?.find((h) => h.name === 'Subject')?.value || '(No subject)';
        const from = headers?.find((h) => h.name === 'From')?.value || 'Unknown';
        const date = headers?.find((h) => h.name === 'Date')?.value || new Date().toISOString();

        return {
          id: message.id!,
          threadId: message.threadId!,
          subject,
          from,
          date,
          snippet: details.data.snippet || '',
          isRead: !details.data.labelIds?.includes('UNREAD'),
        };
      })
    );

    return {
      messages,
      nextPageToken: response.data.nextPageToken || undefined,
    };
  } catch (error: any) {
    if (error.response?.status === 401) {
      throw new Error('Authentication required. Please sign in again.');
    }
    throw error;
  }
}

export async function getEmailDetails(id: string) {
  try {
    const { gmail, auth } = await getGmailClient();

    const response = await gmail.users.messages.get({
      userId: 'me',
      id,
      auth,
    });

    const message = response.data;
    const headers = message.payload?.headers;
    const subject = headers?.find((h) => h.name === 'Subject')?.value || '(No subject)';
    const from = headers?.find((h) => h.name === 'From')?.value || 'Unknown';
    const to = headers?.find((h) => h.name === 'To')?.value || '';
    const date = headers?.find((h) => h.name === 'Date')?.value || new Date().toISOString();

    let body = '';
    let htmlBody = '';

    if (message.payload?.parts) {
      for (const part of message.payload.parts) {
        if (part.mimeType === 'text/plain' && part.body?.data) {
          body = Buffer.from(part.body.data, 'base64').toString();
        } else if (part.mimeType === 'text/html' && part.body?.data) {
          htmlBody = Buffer.from(part.body.data, 'base64').toString();
        }
      }
    } else if (message.payload?.body?.data) {
      body = Buffer.from(message.payload.body.data, 'base64').toString();
    }

    const attachments = message.payload?.parts?.filter(
      (part) => part.filename && part.filename.length > 0
    ) || [];

    return {
      id: message.id!,
      threadId: message.threadId!,
      subject,
      from,
      to,
      date,
      body,
      htmlBody,
      attachments: attachments.map((attachment) => ({
        id: attachment.body?.attachmentId!,
        filename: attachment.filename!,
        mimeType: attachment.mimeType!,
        size: attachment.body?.size || 0,
      })),
    };
  } catch (error: any) {
    if (error.response?.status === 401) {
      throw new Error('Authentication required. Please sign in again.');
    }
    throw error;
  }
}

export async function sendEmail(to: string, subject: string, body: string, htmlBody?: string) {
    try {
      const { gmail, auth } = await getGmailClient();
  
      const message = [
        'Content-Type: text/html; charset=utf-8',
        'MIME-Version: 1.0',
        `To: ${to}`,
        'From: me',
        `Subject: ${subject}`,
        '',
        htmlBody || body,
      ].join('\n');
  
      const encodedMessage = Buffer.from(message)
        .toString('base64')
        .replace(/\+/g, '-')
        .replace(/\//g, '_')
        .replace(/=+$/, '');
  
      console.log('Sending email:', { to, subject });
  
      await gmail.users.messages.send({
        userId: 'me',
        requestBody: {
          raw: encodedMessage,
        },
        auth,
      });
  
      console.log('Email sent successfully');
    } catch (error: any) {
      console.error('Failed to send email:', error);
      throw error;
    }
  }
  

export async function markAsRead(id: string) {
  try {
    const { gmail, auth } = await getGmailClient();

    await gmail.users.messages.modify({
      userId: 'me',
      id,
      requestBody: {
        removeLabelIds: ['UNREAD'],
      },
      auth,
    });
  } catch (error: any) {
    if (error.response?.status === 401) {
      throw new Error('Authentication required. Please sign in again.');
    }
    throw error;
  }
}

export async function deleteEmail(id: string) {
  try {
    const { gmail, auth } = await getGmailClient();

    await gmail.users.messages.trash({
      userId: 'me',
      id,
      auth,
    });
  } catch (error: any) {
    if (error.response?.status === 401) {
      throw new Error('Authentication required. Please sign in again.');
    }
    throw error;
  }
} 