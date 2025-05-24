import { NextResponse } from 'next/server';
import auth from 'next-auth';
import { authOptions } from '@/lib/auth';
import { google } from 'googleapis';
import { OAuth2Client } from 'google-auth-library';

async function getOAuthClient(accessToken: string) {
  const oauth2Client = new OAuth2Client();
  oauth2Client.setCredentials({
    access_token: accessToken,
  });
  return oauth2Client;
}

export async function POST(req: Request) {
  try {
    const session = await auth(authOptions);
    if (!session?.accessToken) {
      return NextResponse.json(
        { error: 'Unauthorized' },
        { status: 401 }
      );
    }

    const { to, subject, content, attachments } = await req.json();

    if (!to || !subject || !content) {
      return NextResponse.json(
        { error: 'Missing required fields' },
        { status: 400 }
      );
    }

    const oauth2Client = await getOAuthClient(session.accessToken as string);
    const gmail = google.gmail({ version: 'v1', auth: oauth2Client });

    // Create email message
    const emailLines = [
      `To: ${to.join(', ')}`,
      'Content-Type: text/html; charset=utf-8',
      'MIME-Version: 1.0',
      `Subject: ${subject}`,
      '',
      content,
    ];

    const email = emailLines.join('\r\n').trim();
    const encodedEmail = Buffer.from(email)
      .toString('base64')
      .replace(/\+/g, '-')
      .replace(/\//g, '_')
      .replace(/=+$/, '');

    // Send the email
    const response = await gmail.users.messages.send({
      userId: 'me',
      requestBody: {
        raw: encodedEmail,
      },
    });

    return NextResponse.json({
      messageId: response.data.id,
      threadId: response.data.threadId,
    });
  } catch (error) {
    console.error('Email sending error:', error);
    return NextResponse.json(
      { error: 'Failed to send email' },
      { status: 500 }
    );
  }
} 