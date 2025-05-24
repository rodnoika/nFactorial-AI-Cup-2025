import { marked, Renderer, MarkedOptions, Tokens } from 'marked';

export type SummaryType = 'brief' | 'detailed' | 'action-items';

interface FormattingOptions {
  type: SummaryType;
  content: string;
}

// Custom renderer for marked to add Tailwind classes
class CustomRenderer extends Renderer {
  // Add escape method from marked's utils
  private escape(html: string): string {
    return html
      .replace(/&/g, '&amp;')
      .replace(/</g, '&lt;')
      .replace(/>/g, '&gt;')
      .replace(/"/g, '&quot;')
      .replace(/'/g, '&#39;');
  }

  heading({ tokens, depth }: Tokens.Heading): string {
    const headingClasses: Record<number, string> = {
      1: 'text-2xl font-bold mb-4 text-gray-900',
      2: 'text-xl font-semibold mb-3 text-gray-800',
      3: 'text-lg font-medium mb-2 text-gray-700',
    };
    const classes = headingClasses[depth] || 'text-base font-medium mb-2 text-gray-600';
    const text = this.parser.parseInline(tokens);
    return `<h${depth} class="${classes}">${text}</h${depth}>`;
  }

  paragraph({ tokens }: Tokens.Paragraph): string {
    const text = this.parser.parseInline(tokens);
    return `<p class="mb-4 text-gray-700 leading-relaxed">${text}</p>`;
  }

  list(token: Tokens.List): string {
    const listClass = token.ordered
      ? 'list-decimal list-inside mb-4 text-gray-700 space-y-1' 
      : 'list-disc list-inside mb-4 text-gray-700 space-y-1';
    const tag = token.ordered ? 'ol' : 'ul';
    const body = token.items.map(item => this.listitem(item)).join('');
    return `<${tag} class="${listClass}">${body}</${tag}>`;
  }

  listitem(item: Tokens.ListItem): string {
    const text = this.parser.parseInline(item.tokens);
    return `<li class="mb-1">${text}</li>`;
  }

  strong({ tokens }: Tokens.Strong): string {
    const text = this.parser.parseInline(tokens);
    return `<strong class="font-semibold text-gray-900">${text}</strong>`;
  }

  em({ tokens }: Tokens.Em): string {
    const text = this.parser.parseInline(tokens);
    return `<em class="italic text-gray-800">${text}</em>`;
  }

  code({ text, lang, escaped }: Tokens.Code): string {
    const className = lang ? `language-${lang}` : '';
    return `<code class="bg-gray-100 px-1 py-0.5 rounded text-sm font-mono ${className}">${escaped ? text : this.escape(text)}</code>`;
  }

  blockquote({ tokens }: Tokens.Blockquote): string {
    const text = this.parser.parseInline(tokens);
    return `<blockquote class="border-l-4 border-gray-300 pl-4 italic text-gray-600 mb-4">${text}</blockquote>`;
  }
}

const renderer = new CustomRenderer();

// Configure marked options
const markedOptions: MarkedOptions = {
  renderer,
  gfm: true,
  breaks: true,
};

marked.setOptions(markedOptions);

export function formatSummary({ type, content }: FormattingOptions): string {
  // First, ensure the content has proper markdown structure based on type
  const structuredContent = ensureMarkdownStructure(type, content);
  
  // Then convert to HTML with our custom renderer
  return marked.parse(structuredContent) as string;
}

function ensureMarkdownStructure(type: SummaryType, content: string): string {
  switch (type) {
    case 'brief':
      return formatBriefSummary(content);
    case 'detailed':
      return formatDetailedSummary(content);
    case 'action-items':
      return formatActionItems(content);
    default:
      return content;
  }
}

function formatBriefSummary(content: string): string {
  // Ensure the content has proper headers and structure
  if (!content.includes('##')) {
    return `## Summary\n${content}\n\n## Key Points\n• ${content.split('. ').join('\n• ')}`;
  }
  return content;
}

function formatDetailedSummary(content: string): string {
  // Ensure proper section headers
  if (!content.includes('##')) {
    const sections = content.split('\n\n');
    return `## Overview\n${sections[0]}\n\n## Key Details\n${sections.slice(1).join('\n\n')}`;
  }
  return content;
}

function formatActionItems(content: string): string {
  // Ensure proper task list format
  if (!content.includes('##')) {
    const items = content.split('\n').filter(line => line.trim().length > 0);
    const formattedItems = items.map(item => {
      if (item.startsWith('-')) return item;
      if (item.startsWith('•')) return item.replace('•', '-');
      return `- ${item}`;
    });
    
    return `## Action Items\n\n### High Priority\n${formattedItems.join('\n')}`;
  }
  return content;
}

// Helper function to extract action items with priorities
export function extractActionItems(content: string): {
  high: string[];
  medium: string[];
  low: string[];
} {
  const items = {
    high: [] as string[],
    medium: [] as string[],
    low: [] as string[],
  };

  const lines = content.split('\n');
  let currentPriority: keyof typeof items = 'medium';

  for (const line of lines) {
    if (line.includes('### High Priority')) {
      currentPriority = 'high';
      continue;
    }
    if (line.includes('### Medium Priority')) {
      currentPriority = 'medium';
      continue;
    }
    if (line.includes('### Low Priority')) {
      currentPriority = 'low';
      continue;
    }

    if (line.startsWith('-') || line.startsWith('•')) {
      items[currentPriority].push(line.replace(/^[-•]\s*/, '').trim());
    }
  }

  return items;
}

// Helper function to get summary preview
export function getSummaryPreview(content: string, maxLength: number = 150): string {
  const plainText = content.replace(/[#*`-]/g, '').trim();
  if (plainText.length <= maxLength) return plainText;
  return plainText.slice(0, maxLength) + '...';
} 