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

const detectUserAction = (message: string | undefined) => {
  if (!message) return null;
  
  const lowerMessage = message.toLowerCase().trim();
  if (lowerMessage === 'send' || lowerMessage.startsWith('send ')) {
    return 'send';
  }
  
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
  try {
    return JSON.parse(text);
  } catch {
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

const composePrompts = {
  full: `You are an AI email assistant. Generate a professional email based on the following details:
- Recipient: {to}
- Subject: {subject}
- Context: {context}

Generate a complete, well-structured email that is:
1. Professional and appropriate for the context
2. Clear and concise
3. Properly formatted with greeting and signature
4. Tailored to the recipient and subject
You are an AI assistant integrated into a production system. You must respond strictly in valid JSON, with no extra commentary, headers, explanations, or formatting. Your entire output MUST be a single valid JSON object, as shown below.
Return the response in the following JSON format:
{
  "type": "compose",
  "email": {
    "to": ["recipient@example.com"],
    "subject": "Email Subject",
    "content": "Email content with proper formatting"
  },
  "action": "confirm"
}`,

  assist: `You are an AI email assistant. Help improve and complete this email draft:
- Recipient: {to}
- Subject: {subject}
- Current Draft: {partialContent}
- Context: {context}

Analyze the draft and provide an improved version that:
1. Maintains the original intent and tone
2. Improves clarity and professionalism
3. Adds any missing important elements
4. Fixes any grammatical or structural issues
You are an AI assistant integrated into a production system. You must respond strictly in valid JSON, with no extra commentary, headers, explanations, or formatting. Your entire output MUST be a single valid JSON object, as shown below.

Return the response in the following JSON format:
{
  "type": "compose",
  "email": {
    "to": ["recipient@example.com"],
    "subject": "Email Subject",
    "content": "Improved email content"
  },
  "action": "confirm"
}`
} as const;

type ComposeMode = keyof typeof composePrompts;

const log = {
  info: (message: string, data?: any) => {
    console.log(`[INFO] ${new Date().toISOString()} - ${message}`, data ? JSON.stringify(data, null, 2) : '');
  },
  error: (message: string, error?: any) => {
    console.error(`[ERROR] ${new Date().toISOString()} - ${message}`, error ? JSON.stringify(error, null, 2) : '');
  },
  warn: (message: string, data?: any) => {
    console.warn(`[WARN] ${new Date().toISOString()} - ${message}`, data ? JSON.stringify(data, null, 2) : '');
  }
};

export async function POST(req: Request) {
  const requestId = Math.random().toString(36).substring(7);
  log.info(`[${requestId}] Starting chat request processing`);

  try {
    const session = await auth(authOptions);
    if (!session) {
      log.warn(`[${requestId}] Unauthorized request attempt`);
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
    }

    const { message, context } = await req.json();
    log.info(`[${requestId}] Received request`, { 
      messageType: typeof message === 'string' ? 'text' : 'json',
      hasContext: !!context,
      contextType: context?.email ? 'email' : 'chat'
    });

    let parsedMessage;
    try {
      parsedMessage = typeof message === 'string' ? JSON.parse(message) : message;
    } catch (err) {
      parsedMessage = { type: 'text', content: message };
    }

    log.info(`[${requestId}] Parsed message`, { 
      type: parsedMessage.type,
      action: parsedMessage.action,
      mode: parsedMessage.mode
    });

    let prompt = SYSTEM_PROMPT;
    let generationConfig = {
      temperature: 0.7,
      topK: 40,
      topP: 0.95,
      maxOutputTokens: 1024,
    };

    // Handle compose requests with specific prompts
    if (parsedMessage.type === 'compose') {
      const emailContext = context?.email || {};
      const mode = (parsedMessage.mode || 'full') as ComposeMode;
      
      if (mode === 'full' || mode === 'assist') {
        const template = composePrompts[mode];
        prompt = template
          .replace('{to}', emailContext.to || parsedMessage.email?.to?.[0] || '')
          .replace('{subject}', emailContext.subject || parsedMessage.email?.subject || '')
          .replace('{context}', emailContext.body || '')
          .replace('{partialContent}', parsedMessage.email?.content || '');

        generationConfig = {
          temperature: 0.7,
          topK: 40,
          topP: 0.95,
          maxOutputTokens: 2048,
        };
      }
    }

    const emailContext = context.email ? `
Current Email Context:
Subject: ${context.email.subject}
From: ${context.email.from}
To: ${context.email.to}
Date: ${context.email.date}
Content: ${context.email.body}

Please use this email context to provide more relevant and accurate responses.
` : '';

    log.info(`[${requestId}] Starting chat with AI model`, { 
      promptType: parsedMessage.type,
      mode: parsedMessage.mode,
      hasEmailContext: !!context.email
    });

    let messageToSend;
    if (parsedMessage.type === 'compose') {
      const emailData = parsedMessage.email || {};
      messageToSend = `Please help me ${parsedMessage.action || 'improve'} this email:
To: ${emailData.to?.join(', ') || ''}
Subject: ${emailData.subject || ''}
Content: ${emailData.content || ''}

Context: ${context?.email?.body || ''}`;

      log.info(`[${requestId}] Formatted compose message`, { 
        action: parsedMessage.action,
        mode: parsedMessage.mode,
        messageLength: messageToSend.length
      });
    } else {
      messageToSend = parsedMessage.content;
    }

    const chat = model.startChat({
      history: [
        {
          role: 'user',
          parts: [{ text: prompt + emailContext }],
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
      generationConfig,
    });

    try {
      const result = await chat.sendMessage(messageToSend);
      const response = await result.response;
      const text = response.text();
      
      log.info(`[${requestId}] Received AI response`, { 
        responseLength: text.length,
        hasJson: text.includes('{') && text.includes('}'),
        firstChars: text.substring(0, 100)
      });

      let type = 'query';
      let metadata = {};
      let content = text;

      const lastUserMessage = context.messages?.slice().reverse().find((msg: any) => msg.role === 'user')?.content;
      const userAction = detectUserAction(lastUserMessage);
      log.info(`[${requestId}] Detected user action`, { userAction });

      const parsedResponse = extractJsonFromResponse(text);
      
      if (parsedResponse) {
        log.info(`[${requestId}] Successfully parsed JSON response`, { 
          type: parsedResponse.type,
          action: parsedResponse.action
        });

        if (parsedResponse.type === 'compose') {
          if (!validateEmailData(parsedResponse.email)) {
            log.error(`[${requestId}] Invalid email data structure`, parsedResponse.email);
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
            log.info(`[${requestId}] Processing email composition`, { 
              action: finalAction,
              recipient: parsedResponse.email.to,
              subject: parsedResponse.email.subject
            });
            
            if (finalAction === 'send') {
              try {
                log.info(`[${requestId}] Attempting to send email`);
                const baseUrl = process.env.NEXTAUTH_URL || 'http://localhost:3001';
                const emailResponse = await fetch(`${baseUrl}/api/gmail/send`, {
                  method: 'POST',
                  headers: { 'Content-Type': 'application/json' },
                  body: JSON.stringify(parsedResponse.email),
                });

                log.info(`[${requestId}] Email send response`, { 
                  status: emailResponse.status,
                  ok: emailResponse.ok
                });

                const responseData = await emailResponse.json();

                if (!emailResponse.ok) {
                  throw new Error(responseData.details || responseData.message || 'Failed to send email');
                }

                log.info(`[${requestId}] Email sent successfully`);
                content = `Email sent successfully to ${parsedResponse.email.to.join(', ')}`;
                metadata = {
                  composeData: parsedResponse.email,
                  action: 'sent',
                  emailResult: responseData
                };
              } catch (error: any) {
                log.error(`[${requestId}] Email sending failed`, error);
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
              log.info(`[${requestId}] Requesting email confirmation`);
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
        log.info(`[${requestId}] Processing non-JSON response`);
        if (text.toLowerCase().includes('summary')) {
          type = 'summary';
        } else if (userAction === 'send') {
          log.warn(`[${requestId}] User requested send but AI didn't return JSON`);
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

      log.info(`[${requestId}] Sending final response`, { type, hasMetadata: !!metadata });
      return NextResponse.json({
        content,
        type,
        metadata,
      });
    } catch (error) {
      log.error(`[${requestId}] Chat API error`, error);
      return NextResponse.json({ error: 'Failed to process chat message' }, { status: 500 });
    }
  } catch (error) {
    log.error(`[${requestId}] Chat API error`, error);
    return NextResponse.json({ error: 'Failed to process chat message' }, { status: 500 });
  }
}
