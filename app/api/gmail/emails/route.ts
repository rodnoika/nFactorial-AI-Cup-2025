import { NextRequest, NextResponse } from 'next/server';
import { getEmails } from '@/lib/gmail';

export async function GET(request: NextRequest) {
  try {
    const searchParams = request.nextUrl.searchParams;
    const pageToken = searchParams.get('pageToken') || undefined;
    const maxResults = Number(searchParams.get('maxResults')) || 20;
    const query = searchParams.get('q') || undefined;

    const { messages, nextPageToken } = await getEmails(maxResults, pageToken, query);
    return NextResponse.json({
      emails: messages,
      nextPageToken,
    });
  } catch (error) {
    console.error('Error fetching emails:', error);
    return NextResponse.json(
      { error: 'Failed to fetch emails' },
      { status: 500 }
    );
  }
} 