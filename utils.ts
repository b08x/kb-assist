
/**
 * @license
 * SPDX-License-Identifier: Apache-2.0
*/

export const generateId = () => Date.now().toString(36) + Math.random().toString(36).substring(2);

/**
 * Story 3: Structured Markdown Export
 * Converts HTML content to valid Markdown.
 */
export const convertToMarkdown = (html: string): string => {
    const parser = new DOMParser();
    const doc = parser.parseFromString(html, 'text/html');
    
    // Remove all style tags
    doc.querySelectorAll('style').forEach(s => s.remove());
    
    const walk = (node: Node, depth: number = 0): string => {
        let text = "";
        node.childNodes.forEach(child => {
            if (child.nodeType === Node.TEXT_NODE) {
                text += child.textContent;
            } else if (child.nodeType === Node.ELEMENT_NODE) {
                const el = child as HTMLElement;
                const tag = el.tagName.toLowerCase();
                
                switch(tag) {
                    case 'h1': text += `\n# ${walk(el)}\n\n`; break;
                    case 'h2': text += `\n## ${walk(el)}\n\n`; break;
                    case 'h3': text += `\n### ${walk(el)}\n\n`; break;
                    case 'p': text += `${walk(el)}\n\n`; break;
                    case 'ul': text += `\n${walk(el, depth + 1)}\n`; break;
                    case 'ol': text += `\n${walk(el, depth + 1)}\n`; break;
                    case 'li': {
                        const parent = el.parentElement?.tagName.toLowerCase();
                        const prefix = parent === 'ol' ? '1. ' : '- ';
                        const indent = '  '.repeat(Math.max(0, depth - 1));
                        text += `${indent}${prefix}${walk(el)}\n`;
                        break;
                    }
                    case 'pre': text += `\n\`\`\`\n${el.textContent?.trim()}\n\`\`\`\n\n`; break;
                    case 'code': text += `\`${walk(el)}\``; break;
                    case 'strong':
                    case 'b': text += `**${walk(el)}**`; break;
                    case 'em':
                    case 'i': text += `*${walk(el)}*`; break;
                    case 'a': text += `[${walk(el)}](${el.getAttribute('href') || '#'})`; break;
                    case 'table': {
                        const rows = Array.from(el.querySelectorAll('tr'));
                        rows.forEach((row, i) => {
                            const cells = Array.from(row.querySelectorAll('th, td'));
                            text += `| ${cells.map(c => walk(c).replace(/\n/g, ' ').trim()).join(' | ')} |\n`;
                            if (i === 0) {
                                text += `| ${cells.map(() => '---').join(' | ')} |\n`;
                            }
                        });
                        text += '\n';
                        break;
                    }
                    case 'br': text += '\n'; break;
                    case 'div':
                    case 'section':
                    case 'article':
                    case 'nav':
                    case 'body':
                        text += walk(el, depth);
                        break;
                    default:
                        text += walk(el, depth);
                }
            }
        });
        return text;
    };
    
    // Process the body content and clean up multiple newlines
    const result = walk(doc.body).replace(/\n{3,}/g, '\n\n').trim();
    return result;
};
