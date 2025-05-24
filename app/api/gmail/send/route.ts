import { NextRequest, NextResponse } from 'next/server';
import { sendEmail } from '@/lib/gmail';

export async function POST(request: NextRequest) {
  try {
    const { to, subject, body, htmlBody } = await request.json();

    if (!to || !subject || !body) {
      return NextResponse.json(
        { error: 'Missing required fields' },
        { status: 400 }
      );
    }

    await sendEmail(to, subject, body, htmlBody);
    return NextResponse.json({ success: true });
  } catch (error) {
    console.error('Error sending email:', error);
    return NextResponse.json(
      { error: 'Failed to send email' },
      { status: 500 }
    );
  }
} 