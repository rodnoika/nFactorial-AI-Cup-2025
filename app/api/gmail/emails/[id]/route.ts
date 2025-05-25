import { NextRequest, NextResponse } from 'next/server';
import { getEmailDetails, markAsRead, deleteEmail } from '@/lib/gmail';

export async function GET(
  request: NextRequest,
  context: { params: Promise<{ id: string }> }
) {
  try {
    const { id } = await context.params;
    const email = await getEmailDetails(id);
    return NextResponse.json(email);
  } catch (error) {
    console.error('Error fetching email details:', error);
    return NextResponse.json(
      { error: 'Failed to fetch email details' },
      { status: 500 }
    );
  }
}

export async function POST(
  request: NextRequest,
  context: { params: Promise<{ id: string }> }
) {
  try {
    const { id } = await context.params;
    const body = await request.json();
    const { action } = body;

    if (action === 'markAsRead') {
      await markAsRead(id);
      return NextResponse.json({ success: true });
    } else if (action === 'delete') {
      await deleteEmail(id);
      return NextResponse.json({ success: true });
    }

    return NextResponse.json(
      { error: 'Invalid action' },
      { status: 400 }
    );
  } catch (error) {
    console.error('Error processing email action:', error);
    return NextResponse.json(
      { error: 'Failed to process email action' },
      { status: 500 }
    );
  }
} 