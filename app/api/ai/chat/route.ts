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
- For email composition, ALWAYS respond with a raw JSON object (no markdown formatting) using this structure:
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

// Add these helper functions at the top level
const detectUserAction = (message: string | undefined) => {
  if (!message) return null;
  
  // Check for explicit commands
  const lowerMessage = message.toLowerCase().trim();
  if (lowerMessage === 'send' || lowerMessage.startsWith('send ')) {
    return 'send';
  }
  
  // Try JSON parsing as fallback
  try {
    const jsonMatch = message.match(/{[\s\S]*?}/);
    if (jsonMatch) {
      const parsed = JSON.parse(jsonMatch[0]);
      return parsed.action === 'send' ? 'send' : null;
    }
  } catch (err) {
    console.log('Failed to parse user message for action:', err);
  }
  
  return null;
};

const extractJsonFromResponse = (text: string) => {
  // Try parsing as raw JSON first
  try {
    return JSON.parse(text);
  } catch {
    // If that fails, try to extract JSON from markdown
    const jsonMatch = text.match(/```(?:json)?\s*(\{[\s\S]*?\})\s*```/);
    if (jsonMatch) {
      try {
        return JSON.parse(jsonMatch[1]);
      } catch {
        return null;
      }
    }
  }
  return null;
};

const validateEmailData = (email: any) => {
  if (!email || typeof email !== 'object') return false;
  if (!Array.isArray(email.to) || email.to.length === 0) return false;
  if (!email.subject || typeof email.subject !== 'string') return false;
  if (!email.content || typeof email.content !== 'string') return false;
  return true;
};

export async function POST(req: Request) {
  try {
    const session = await auth(authOptions);
    if (!session) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
    }

    const { message, context } = await req.json();

    const emailContext = context.email ? `
Current Email Context:
Subject: ${context.email.subject}
From: ${context.email.from}
To: ${context.email.to}
Date: ${context.email.date}
Content: ${context.email.body}

Please use this email context to provide more relevant and accurate responses.
` : '';

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

    const result = await chat.sendMessage(message);
    const response = await result.response;
    const text = response.text();

    let type = 'query';
    let metadata = {};
    let content = text;

    // Get the last user message for action inference
    const lastUserMessage = context.messages?.slice().reverse().find((msg: any) => msg.role === 'user')?.content;
    const userAction = detectUserAction(lastUserMessage);

    // Try to parse the AI response
    const parsedResponse = extractJsonFromResponse(text);
    
    if (parsedResponse) {
      // Handle email composition
      if (parsedResponse.type === 'compose') {
        // Validate email data
        if (!validateEmailData(parsedResponse.email)) {
          content = 'Invalid email data. Please provide valid recipient, subject, and content.';
          type = 'error';
          metadata = {
            error: {
              message: 'Invalid email data structure',
              details: 'Missing required fields or invalid format'
            }
          };
        } else {
          type = 'compose';
          const finalAction = userAction || parsedResponse.action;
          
          // Only send if explicitly confirmed by user
          if (finalAction === 'send') {
            try {
              const baseUrl = process.env.NEXTAUTH_URL || 'http://localhost:3001';
              const emailResponse = await fetch(`${baseUrl}/api/gmail/send`, {
                method: 'POST',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify(parsedResponse.email),
              });

              console.log('Email response status:', emailResponse.status);
              const responseData = await emailResponse.json();
              console.log('Email response data:', responseData);

              if (!emailResponse.ok) {
                throw new Error(responseData.details || responseData.message || 'Failed to send email');
              }

              content = `Email sent successfully to ${parsedResponse.email.to.join(', ')}`;
              metadata = {
                composeData: parsedResponse.email,
                action: 'sent',
                emailResult: responseData
              };
            } catch (error: any) {
              console.error('Email sending error:', error);
              content = error.message || 'Failed to send email. Please try again.';
              type = 'error';
              metadata = {
                composeData: parsedResponse.email,
                action: 'error',
                error: {
                  message: error.message,
                  details: error.details
                }
              };
            }
          } else {
            // Request confirmation
            content = `Please confirm sending email to ${parsedResponse.email.to.join(', ')}`;
            metadata = {
              composeData: parsedResponse.email,
              action: 'confirm',
              requiresConfirmation: true
            };
          }
        }
      }
    } else {
      // Handle non-JSON responses
      if (text.toLowerCase().includes('summary')) {
        type = 'summary';
      } else if (userAction === 'send') {
        // If user explicitly said "send" but AI didn't return JSON
        content = 'I need more information to send the email. Please provide recipient, subject, and content.';
        type = 'error';
        metadata = {
          error: {
            message: 'Missing email details',
            details: 'Please provide all required email information'
          }
        };
      }
    }

    return NextResponse.json({
      content,
      type,
      metadata,
    });
  } catch (error) {
    console.error('Chat API error:', error);
    return NextResponse.json({ error: 'Failed to process chat message' }, { status: 500 });
  }
}
