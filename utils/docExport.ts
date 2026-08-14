
import { 
  Document, 
  Packer, 
  Paragraph, 
  TextRun, 
  HeadingLevel, 
  AlignmentType, 
  ShadingType, 
  Table, 
  TableRow, 
  TableCell, 
  WidthType, 
  BorderStyle, 
  ImageRun, 
  PageBreak, 
  LevelFormat,
  UnderlineType
} from 'docx';
import saveAs from 'file-saver';

/**
 * Utility to convert hex colors or basic color names to hex for docx
 */
const getHexColor = (color: string | null): string | undefined => {
  if (!color) return undefined;
  if (color.startsWith('#')) return color.replace('#', '');
  if (color.startsWith('rgb')) {
    const parts = color.match(/\d+/g);
    if (parts && parts.length >= 3) {
      return parts.slice(0, 3).map(x => parseInt(x).toString(16).padStart(2, '0')).join('').toUpperCase();
    }
  }
  const map: Record<string, string> = {
    'blue': '0563C1', // Standard Word Hyperlink Blue
    'red': 'EF4444',
    'green': '10B981',
    'gray': '71717A'
  };
  return map[color.toLowerCase()];
};

/**
 * Helper to convert base64 string to Uint8Array
 */
const base64ToUint8Array = (base64: string): Uint8Array => {
  const binaryString = window.atob(base64.replace(/\s/g, ''));
  const bytes = new Uint8Array(binaryString.length);
  for (let i = 0; i < binaryString.length; i++) {
    bytes[i] = binaryString.charCodeAt(i);
  }
  return bytes;
};

export const exportToDocx = async (htmlContent: string, title: string) => {
  const parser = new DOMParser();
  const doc = parser.parseFromString(htmlContent, 'text/html');
  const body = doc.body;
  const children: any[] = [];

  /**
   * Recursive parser that flattens nested block structures into docx-compatible nodes.
   * Returns an array of docx nodes (Paragraph, Table, ImageRun, TextRun).
   */
  const parseNode = (node: Node, options: any = { listLevel: -1, isTOC: false }): any[] => {
    const results: any[] = [];

    if (node.nodeType === Node.TEXT_NODE) {
      const text = node.textContent || '';
      if (text.trim() || text === ' ') {
        return [new TextRun({
          text: text,
          bold: options.bold,
          italics: options.italics,
          color: options.color,
          font: options.font || "Arial",
          size: options.size || 22,
          shading: options.shading,
          underline: options.underline,
        })];
      }
      return [];
    }

    if (node.nodeType === Node.ELEMENT_NODE) {
      const element = node as HTMLElement;
      const tag = element.tagName.toLowerCase();
      const classList = element.classList;
      const style = element.style;

      // Handle images
      if (tag === 'img') {
        const src = element.getAttribute('src');
        if (src && src.startsWith('data:image')) {
          try {
            const base64Data = src.split(',')[1];
            const imageBuffer = base64ToUint8Array(base64Data);
            return [new ImageRun({
              data: imageBuffer,
              transformation: { width: 550, height: 350 },
            } as any)];
          } catch (e) {
            console.error("Image processing error:", e);
            return [new TextRun({ text: "[Image Error]", color: "EF4444" })];
          }
        }
        return [];
      }

      const newOptions = { ...options };
      if (tag === 'strong' || tag === 'b') newOptions.bold = true;
      if (tag === 'em' || tag === 'i') newOptions.italics = true;
      if (tag === 'u') newOptions.underline = { type: UnderlineType.SINGLE };
      
      // Story 2: Implement Hyperlink Visual Styles
      if (tag === 'a') {
          newOptions.color = '0563C1'; // Official MS Word Hyperlink Blue
          newOptions.underline = { type: UnderlineType.SINGLE };
      }
      
      if (style.color) newOptions.color = getHexColor(style.color);

      // Handle Code
      if (tag === 'code') {
        newOptions.font = "Courier New";
        if (!options.isInsidePre) {
           newOptions.color = "DB2777";
           newOptions.shading = { fill: "F3F4F6", type: ShadingType.CLEAR, color: "auto" };
        }
      }

      // Handle Tables
      if (tag === 'table') {
        const rows: TableRow[] = [];
        const tableElement = element as HTMLTableElement;
        
        Array.from(tableElement.rows).forEach(tr => {
          const cells: TableCell[] = [];
          Array.from(tr.cells).forEach(td => {
            const cellChildren: any[] = [];
            
            td.childNodes.forEach(child => {
              const nodes = parseNode(child, newOptions);
              nodes.forEach(n => {
                if (n instanceof Paragraph || n instanceof Table) {
                  cellChildren.push(n);
                } else if (n instanceof TextRun || n instanceof ImageRun) {
                  cellChildren.push(new Paragraph({ children: [n] }));
                }
              });
            });

            // Story 2: Emphasize Table Headers
            // Header cells get a thicker bottom border (size 12), data cells get size 6.
            const isHeader = td.tagName.toLowerCase() === 'th';
            const borderSize = isHeader ? 12 : 6;

            // Story 1: Implement "Row Divider" Table Style
            // Removing top, left, and right borders to achieve a clean horizontal-divider aesthetic.
            // Story 3: Adjust Table Cell Whitespace
            // Updated margins from 100 to 150 for better spacing.
            cells.push(new TableCell({
              children: cellChildren.length > 0 ? cellChildren : [new Paragraph("")],
              shading: isHeader ? { fill: "F9FAFB" } : undefined,
              borders: {
                top: { style: BorderStyle.NONE },
                bottom: { style: BorderStyle.SINGLE, size: borderSize, color: "E5E7EB" },
                left: { style: BorderStyle.NONE },
                right: { style: BorderStyle.NONE },
              },
              verticalAlign: AlignmentType.CENTER,
              margins: { top: 150, bottom: 150, left: 150, right: 150 },
            }));
          });
          if (cells.length > 0) rows.push(new TableRow({ children: cells }));
        });
        return rows.length > 0 ? [new Table({ rows, width: { size: 100, type: WidthType.PERCENTAGE } })] : [];
      }

      // Handle Block Containers (p, h1-4, div, li, pre, hr, ul, ol, nav)
      if (['p', 'h1', 'h2', 'h3', 'h4', 'li', 'div', 'pre', 'hr', 'ul', 'ol', 'nav'].includes(tag)) {
        if (tag === 'hr' || classList.contains('page-break')) {
            return [new Paragraph({ children: [new PageBreak()], spacing: { before: 0, after: 0 } })];
        }

        // Story 4: Detect Table of Contents context
        let isTOC = options.isTOC;
        if (tag === 'nav') isTOC = true;
        
        // Wrapper tags like ul, ol should just return their parsed children
        if (tag === 'ul' || tag === 'ol') {
            const innerResults: any[] = [];
            
            // Story 4: Check if this list is a TOC based on the preceding header
            const prevText = element.previousElementSibling?.textContent?.toLowerCase() || '';
            const listIsTOC = isTOC || prevText.includes('table of contents');
            
            const deeperOptions = { ...newOptions, listLevel: newOptions.listLevel + 1, isTOC: listIsTOC };
            element.childNodes.forEach(child => {
                innerResults.push(...parseNode(child, deeperOptions));
            });
            return innerResults;
        }

        let heading: any = undefined;
        let shading: any = undefined;
        let borders: any = undefined;
        let textColor = newOptions.color;

        if (tag === 'h1') { 
          heading = HeadingLevel.HEADING_1; 
          borders = { bottom: { style: BorderStyle.SINGLE, size: 12, color: "E5E7EB" } }; 
          textColor = "1D4ED8"; 
          newOptions.bold = true;
          newOptions.size = 36; 
        } else if (tag === 'h2') {
          heading = HeadingLevel.HEADING_2;
          textColor = "111827"; 
          newOptions.bold = true;
          newOptions.size = 30; 
        } else if (tag === 'h3') {
          heading = HeadingLevel.HEADING_3;
          textColor = "374151"; 
          newOptions.bold = true;
          newOptions.size = 24; 
        }

        if (classList.contains('warning')) {
          shading = { fill: "FEF2F2", type: ShadingType.CLEAR, color: "auto" };
          borders = { left: { style: BorderStyle.SINGLE, size: 32, color: "EF4444", space: 10 } };
          textColor = "991B1B";
        } else if (classList.contains('metadata')) {
          shading = { fill: "EFF6FF", type: ShadingType.CLEAR, color: "auto" };
          borders = { left: { style: BorderStyle.SINGLE, size: 32, color: "3B82F6", space: 10 } };
          textColor = "1E40AF";
        } else if (classList.contains('lesson-learned')) {
          shading = { fill: "FFFBEB", type: ShadingType.CLEAR, color: "auto" };
          borders = { left: { style: BorderStyle.SINGLE, size: 40, color: "F59E0B", space: 10 } };
          textColor = "B45309";
        } else if (tag === 'pre') {
          shading = { fill: "111827", type: ShadingType.CLEAR, color: "auto" };
          newOptions.font = "Courier New";
          newOptions.isInsidePre = true; 
          textColor = "E5E7EB";
        }

        let numbering: any = undefined;
        if (tag === 'li') {
          const parentTag = element.parentElement?.tagName.toLowerCase();
          const level = Math.max(0, Math.min(newOptions.listLevel, 8)); // docx supports 9 levels
          numbering = { 
              reference: parentTag === 'ol' ? "main-numbering" : "main-bullets", 
              level: level 
          };
        }

        const childNodes = Array.from(element.childNodes);
        const runs: any[] = [];
        const blockElements: any[] = [];

        childNodes.forEach(child => {
          const parsed = parseNode(child, { ...newOptions, color: textColor });
          parsed.forEach(p => {
            if (p instanceof Paragraph || p instanceof Table) {
                blockElements.push(p);
            } else {
                runs.push(p);
            }
          });
        });

        // Special handling for pure block-container divs with no shading/borders
        if ((tag === 'div' || tag === 'nav') && !shading && !borders && classList.length === 0) {
            const final = [];
            if (runs.length > 0) final.push(new Paragraph({ children: runs }));
            final.push(...blockElements);
            return final;
        }

        // Story 4: Standardize TOC Heading Spacing - reduce spacing for TOC items
        const spacing = options.isTOC 
            ? { before: 0, after: 0 } 
            : { before: tag === 'h1' ? 400 : 180, after: 180 };

        const primaryPara = new Paragraph({
          children: runs.length > 0 ? runs : (blockElements.length === 0 ? [new TextRun("")] : []),
          heading,
          numbering,
          shading,
          border: borders,
          spacing: spacing,
        });

        const out = [];
        if (runs.length > 0 || blockElements.length === 0) {
            out.push(primaryPara);
        }
        out.push(...blockElements);
        return out;
      }

      // Default: iterate and return children
      const results: any[] = [];
      element.childNodes.forEach(child => {
        results.push(...parseNode(child, newOptions));
      });
      return results;
    }
    return results;
  };

  body.childNodes.forEach(node => {
    const nodes = parseNode(node);
    nodes.forEach(n => {
      if (n instanceof Paragraph || n instanceof Table) {
        children.push(n);
      } else if (n instanceof TextRun || n instanceof ImageRun) {
        children.push(new Paragraph({ children: [n], spacing: { before: 120, after: 120 } }));
      }
    });
  });

  const docx = new Document({
    numbering: {
      config: [
        { 
          reference: "main-numbering", 
          levels: Array.from({ length: 9 }, (_, i) => ({
            level: i,
            format: LevelFormat.DECIMAL,
            text: `%${i + 1}.`,
            alignment: AlignmentType.START,
            style: {
                paragraph: {
                    indent: { left: 720 * (i + 1), hanging: 360 },
                },
            },
          }))
        },
        { 
          reference: "main-bullets", 
          levels: Array.from({ length: 9 }, (_, i) => ({
            level: i,
            format: LevelFormat.BULLET,
            text: i % 2 === 0 ? "\u2022" : "\u25CB", // Toggle bullet style
            alignment: AlignmentType.START,
            style: {
                paragraph: {
                    indent: { left: 720 * (i + 1), hanging: 360 },
                },
            },
          }))
        },
      ],
    },
    sections: [{
      properties: { page: { margin: { top: 1440, right: 1440, bottom: 1440, left: 1440 } } },
      children: children,
    }],
  });

  const blob = await Packer.toBlob(docx);
  saveAs(blob, `${title.replace(/\s+/g, '_')}.docx`);
};
