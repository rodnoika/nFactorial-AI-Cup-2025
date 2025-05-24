import { NextResponse } from 'next/server';
import { GoogleGenerativeAI } from '@google/generative-ai';
import auth from 'next-auth';
import { authOptions } from '@/lib/auth';

const genAI = new GoogleGenerativeAI(process.env.GEMINI_API_KEY!);

const model = genAI.getGenerativeModel({ model: 'gemini-1.5-pro' });

const SYSTEM_PROMPT = `You are an AI email assistant that helps users manage their emails. You can:
1. Answer questions about email content
2. Generate email summaries
3. Help compose and send new emails
4. Extract action items from emails

When helping with email composition and sending:
- If the user wants to send an email, ask for recipient, subject, and content if not provided
- Format the response as a JSON object with the following structure when composing an email:
  {
    "type": "compose",
    "action": "send" | "confirm",
    "email": {
      "to": string[],
      "subject": string,
      "content": string,
      "attachments": string[]
    }
  }
- For confirmation, set action to "confirm" and wait for user approval
- For sending, set action to "send" and include all required fields
- Always maintain a professional and helpful tone
- Validate email addresses before sending
- Confirm with the user before sending any email

When summarizing emails:
- Provide brief, detailed, or action-item focused summaries
- Highlight key points and deadlines
- Extract important information

Always maintain a professional and helpful tone.`;

export async function POST(req: Request) {
  try {
    const session = await auth(authOptions);
    if (!session) {
      return NextResponse.json(
        { error: 'Unauthorized' },
        { status: 401 }
      );
    }

    const { message, context } = await req.json();
    
    // Create email context prompt if email is available
    const emailContext = context.email ? `
Current Email Context:
Subject: ${context.email.subject}
From: ${context.email.from}
To: ${context.email.to}
Date: ${context.email.date}
Content: ${context.email.body}

Please use this email context to provide more relevant and accurate responses.
` : '';

    // Start a chat session
    const chat = model.startChat({
      history: [
        {
          role: 'user',
          parts: [{ text: SYSTEM_PROMPT + emailContext }],
        },
        {
          role: 'model',
          parts: [{ text: 'I understand. I will help you manage your emails effectively.' }],
        },
        ...(context.messages || []).map((msg: any) => ({
          role: msg.role === 'assistant' ? 'model' : 'user',
          parts: [{ text: msg.content }],
        })),
      ],
      generationConfig: {
        temperature: 0.7,
        topK: 40,
        topP: 0.95,
        maxOutputTokens: 1024,
      },
    });

    // Send the message and get the response
    const result = await chat.sendMessage(message);
    const response = await result.response;
    const text = response.text();

    // Try to parse the response as JSON for email composition
    let type = 'query';
    let metadata = {};
    let content = text;

    try {
      const parsedResponse = JSON.parse(text);
      if (parsedResponse.type === 'compose') {
        type = 'compose';
        metadata = {
          composeData: parsedResponse.email,
          action: parsedResponse.action
        };

        // If action is 'send', attempt to send the email
        if (parsedResponse.action === 'send') {
          try {
            const emailResponse = await fetch('/api/email/send', {
              method: 'POST',
              headers: { 'Content-Type': 'application/json' },
              body: JSON.stringify(parsedResponse.email),
            });

            if (!emailResponse.ok) {
              throw new Error('Failed to send email');
            }

            const emailResult = await emailResponse.json();
            content = `Email sent successfully to ${parsedResponse.email.to.join(', ')}`;
            metadata = {
              ...metadata,
              emailResult
            };
          } catch (error) {
            console.error('Email sending error:', error);
            content = 'Failed to send email. Please try again.';
            type = 'error';
          }
        }
      }
    } catch (e) {
      // If parsing fails, treat as regular chat response
      if (text.toLowerCase().includes('summary')) {
        type = 'summary';
      }
    }

    return NextResponse.json({
      content,
      type,
      metadata,
    });
  } catch (error) {
    console.error('Chat API error:', error);
    return NextResponse.json(
      { error: 'Failed to process chat message' },
      { status: 500 }
    );
  }
} 