import { NextResponse } from 'next/server';
import auth from 'next-auth';
import { authOptions } from '@/lib/auth';
import { google } from 'googleapis';
import { OAuth2Client } from 'google-auth-library';

interface EmailError {
  code: number;
  message: string;
  details?: string;
}

async function getOAuthClient(accessToken: string, refreshToken?: string) {
  const oauth2Client = new OAuth2Client(
    process.env.GOOGLE_CLIENT_ID,
    process.env.GOOGLE_CLIENT_SECRET,
    process.env.NEXTAUTH_URL
  );

  oauth2Client.setCredentials({
    access_token: accessToken,
    refresh_token: refreshToken,
  });

  oauth2Client.on('tokens', (tokens) => {
    if (tokens.refresh_token) {
      console.log('New refresh token received');
    }
    if (tokens.access_token) {
      console.log('New access token received');
    }
  });

  return oauth2Client;
}

function createEmailMessage(to: string[], subject: string, content: string) {
  const boundary = 'foo_bar_baz';
  const mimeEmail = [
    'MIME-Version: 1.0',
    `Content-Type: multipart/alternative; boundary=${boundary}`,
    `To: ${to.join(', ')}`,
    `Subject: ${subject}`,
    '',
    `--${boundary}`,
    'Content-Type: text/plain; charset=utf-8',
    '',
    content.replace(/<[^>]*>/g, ''), 
    '',
    `--${boundary}`,
    'Content-Type: text/html; charset=utf-8',
    '',
    content,
    '',
    `--${boundary}--`,
  ].join('\r\n');

  return Buffer.from(mimeEmail)
    .toString('base64')
    .replace(/\+/g, '-')
    .replace(/\//g, '_')
    .replace(/=+$/, '');
}

export async function POST(req: Request) {
  try {
    const session = await auth(authOptions);
    if (!session?.accessToken) {
      const error: EmailError = {
        code: 401,
        message: 'Unauthorized',
        details: 'No access token found in session',
      };
      console.error('Auth error:', error);
      return NextResponse.json(error, { status: 401 });
    }

    const { to, subject, content, attachments } = await req.json();

    if (!to || !subject || !content) {
      const error: EmailError = {
        code: 400,
        message: 'Missing required fields',
        details: 'To, subject, and content are required',
      };
      console.error('Validation error:', error);
      return NextResponse.json(error, { status: 400 });
    }

    const oauth2Client = await getOAuthClient(
      session.accessToken as string,
      session.refreshToken as string
    );

    try {
      const gmail = google.gmail({ version: 'v1', auth: oauth2Client });
      const encodedEmail = createEmailMessage(to, subject, content);

      const response = await gmail.users.messages.send({
        userId: 'me',
        requestBody: {
          raw: encodedEmail,
        },
      });

      console.log('Email sent successfully:', {
        messageId: response.data.id,
        threadId: response.data.threadId,
      });

      return NextResponse.json({
        messageId: response.data.id,
        threadId: response.data.threadId,
      });
    } catch (apiError: any) {
      const error: EmailError = {
        code: apiError.code || 500,
        message: apiError.message || 'Failed to send email',
        details: apiError.errors?.[0]?.message || 'Unknown error occurred',
      };

      if (apiError.code === 401) {
        error.message = 'Authentication failed';
        error.details = 'Access token expired or invalid. Please sign in again.';
      } else if (apiError.code === 403) {
        error.message = 'Permission denied';
        error.details = 'Insufficient permissions to send email';
      } else if (apiError.code === 429) {
        error.message = 'Rate limit exceeded';
        error.details = 'Too many requests. Please try again later.';
      }

      console.error('Gmail API error:', error);
      return NextResponse.json(error, { status: error.code });
    }
  } catch (error: any) {
    const serverError: EmailError = {
      code: 500,
      message: 'Internal server error',
      details: error.message || 'An unexpected error occurred',
    };
    console.error('Server error:', serverError);
    return NextResponse.json(serverError, { status: 500 });
  }
} 