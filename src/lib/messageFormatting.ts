/**
 * Message formatting utilities for pure client-side zero-knowledge chat.
 * Provides:
 * - URL detection and clickable links WITHOUT previews (no external requests, no OpenGraph metadata)
 * - Inline code and code block formatting
 * - Date grouping and separator formatting
 */

export type SegmentType = 'text' | 'link' | 'code' | 'codeblock';

export interface MessageSegment {
  type: SegmentType;
  content: string;
  href?: string;
}

// Regex to capture markdown code blocks ```code```, inline code `code`, or URLs
// URLs start with http://, https://, or www.
const CODE_BLOCK_REGEX = /^```([\s\S]*?)```/;
const INLINE_CODE_REGEX = /^`([^`\n]+)`/;
const URL_REGEX = /^(https?:\/\/[^\s<>"'()]+|www\.[^\s<>"'()]+)/i;

/**
 * Clean up trailing punctuation often accidentally included in URL matching (e.g. "Visit https://example.com.")
 */
function cleanUrl(rawUrl: string): { cleanedUrl: string; trailingText: string } {
  let url = rawUrl;
  let trailing = '';

  const trailingPunctuation = /[.,;:!?)]+$/;
  const match = url.match(trailingPunctuation);
  if (match) {
    trailing = match[0];
    url = url.slice(0, url.length - trailing.length);
  }

  return { cleanedUrl: url, trailingText: trailing };
}

/**
 * Parses message plaintext into structured segments (text, link, inline code, code block).
 * Note: Under zero-knowledge privacy rules, NO metadata or previews are fetched.
 */
export function parseMessageSegments(content: string): MessageSegment[] {
  if (!content) return [];

  const segments: MessageSegment[] = [];
  let remaining = content;

  while (remaining.length > 0) {
    // 1. Check for triple backtick code block at current position
    const codeBlockMatch = remaining.match(CODE_BLOCK_REGEX);
    if (codeBlockMatch) {
      segments.push({
        type: 'codeblock',
        content: codeBlockMatch[1],
      });
      remaining = remaining.slice(codeBlockMatch[0].length);
      continue;
    }

    // 2. Check for inline code `...`
    const inlineCodeMatch = remaining.match(INLINE_CODE_REGEX);
    if (inlineCodeMatch) {
      segments.push({
        type: 'code',
        content: inlineCodeMatch[1],
      });
      remaining = remaining.slice(inlineCodeMatch[0].length);
      continue;
    }

    // 3. Check for URL
    const urlMatch = remaining.match(URL_REGEX);
    if (urlMatch) {
      const { cleanedUrl, trailingText } = cleanUrl(urlMatch[0]);
      if (cleanedUrl) {
        const href = cleanedUrl.toLowerCase().startsWith('www.')
          ? `https://${cleanedUrl}`
          : cleanedUrl;

        segments.push({
          type: 'link',
          content: cleanedUrl,
          href,
        });
      }

      const consumedLength = cleanedUrl.length;
      remaining = trailingText + remaining.slice(urlMatch[0].length);
      if (consumedLength === 0) {
        // Fallback progress to avoid infinite loop
        segments.push({ type: 'text', content: remaining[0] });
        remaining = remaining.slice(1);
      }
      continue;
    }

    // 4. Otherwise, consume text until next delimiter (`, http, or www)
    const nextDelimiterIndex = findNextDelimiter(remaining);
    if (nextDelimiterIndex === -1) {
      // Rest is pure text
      segments.push({
        type: 'text',
        content: remaining,
      });
      break;
    } else if (nextDelimiterIndex === 0) {
      // Delimiter was not matched by specific parsers, consume single character
      segments.push({
        type: 'text',
        content: remaining[0],
      });
      remaining = remaining.slice(1);
    } else {
      segments.push({
        type: 'text',
        content: remaining.slice(0, nextDelimiterIndex),
      });
      remaining = remaining.slice(nextDelimiterIndex);
    }
  }

  // Merge contiguous text segments for cleaner virtual DOM
  return mergeAdjacentTextSegments(segments);
}

function findNextDelimiter(text: string): number {
  const matches: number[] = [];

  const backtickIndex = text.indexOf('`');
  if (backtickIndex !== -1) matches.push(backtickIndex);

  const httpIndex = text.search(/https?:\/\//i);
  if (httpIndex !== -1) matches.push(httpIndex);

  const wwwIndex = text.search(/\bwww\./i);
  if (wwwIndex !== -1) matches.push(wwwIndex);

  if (matches.length === 0) return -1;
  return Math.min(...matches);
}

function mergeAdjacentTextSegments(segments: MessageSegment[]): MessageSegment[] {
  const merged: MessageSegment[] = [];
  for (const seg of segments) {
    const last = merged[merged.length - 1];
    if (last && last.type === 'text' && seg.type === 'text') {
      last.content += seg.content;
    } else {
      merged.push({ ...seg });
    }
  }
  return merged;
}

/**
 * Checks if two timestamps fall on the exact same calendar day (local time).
 */
export function isSameDay(timestampA: number, timestampB: number): boolean {
  const a = new Date(timestampA);
  const b = new Date(timestampB);
  return (
    a.getFullYear() === b.getFullYear() &&
    a.getMonth() === b.getMonth() &&
    a.getDate() === b.getDate()
  );
}

/**
 * Formats a message timestamp into a friendly date divider label:
 * - "Today"
 * - "Yesterday"
 * - "Monday, October 24, 2026" / "October 24, 2026"
 */
export function formatDateDivider(timestamp: number): string {
  const date = new Date(timestamp);
  const now = new Date();

  // Reset hours to midnight for pure day difference calculation
  const startOfToday = new Date(now.getFullYear(), now.getMonth(), now.getDate()).getTime();
  const startOfDate = new Date(date.getFullYear(), date.getMonth(), date.getDate()).getTime();

  const diffDays = Math.round((startOfToday - startOfDate) / (1000 * 60 * 60 * 24));

  if (diffDays === 0) {
    return 'Today';
  } else if (diffDays === 1) {
    return 'Yesterday';
  } else {
    // Formatted date string
    return date.toLocaleDateString(undefined, {
      weekday: 'short',
      month: 'short',
      day: 'numeric',
      year: date.getFullYear() !== now.getFullYear() ? 'numeric' : undefined,
    });
  }
}
