import { marked } from 'marked';
import DOMPurify from 'isomorphic-dompurify';

/**
 * Render markdown to HTML, then sanitize. Scenario / model transcript content
 * is treated as untrusted for XSS purposes even when bundled as JSON.
 */
export function safeMarkdownHtml(markdown: string): string {
	const raw = marked.parse(markdown, { async: false }) as string;
	return DOMPurify.sanitize(raw);
}
