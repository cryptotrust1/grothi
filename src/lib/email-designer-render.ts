// Email Designer HTML Renderer
// Converts EmailDesign JSON to email-compatible HTML (table-based, inline styles)

import type {
  EmailDesign,
  EmailSection,
  EmailColumn,
  EmailBlock,
  EmailGlobalStyles,
  TextBlock,
  HeadingBlock,
  ImageBlock,
  ButtonBlock,
  DividerBlock,
  SpacerBlock,
  SocialBlock,
  HtmlBlock,
} from './email-designer-types';

// Social media icon SVGs (simple, email-compatible)
const SOCIAL_ICONS: Record<string, { color: string; letter: string }> = {
  facebook: { color: '#1877F2', letter: 'f' },
  twitter: { color: '#000000', letter: 'X' },
  instagram: { color: '#E4405F', letter: 'ig' },
  linkedin: { color: '#0A66C2', letter: 'in' },
  youtube: { color: '#FF0000', letter: 'YT' },
  tiktok: { color: '#000000', letter: 'TT' },
  pinterest: { color: '#E60023', letter: 'P' },
  threads: { color: '#000000', letter: '@' },
};

function esc(s: string): string {
  return s.replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;').replace(/"/g, '&quot;');
}

function renderTextBlock(block: TextBlock, gs: EmailGlobalStyles): string {
  const color = block.color || gs.textColor;
  return `<td style="padding:${block.paddingTop}px ${block.paddingRight}px ${block.paddingBottom}px ${block.paddingLeft}px;text-align:${block.align};font-family:${gs.fontFamily};font-size:${block.fontSize}px;line-height:${block.lineHeight};color:${color};">
  ${block.content}
</td>`;
}

function renderHeadingBlock(block: HeadingBlock, gs: EmailGlobalStyles): string {
  const color = block.color || gs.headingColor;
  const sizes: Record<number, number> = { 1: 28, 2: 22, 3: 18 };
  const fontSize = sizes[block.level] || 28;
  const tag = `h${block.level}`;
  return `<td style="padding:${block.paddingTop}px ${block.paddingRight}px ${block.paddingBottom}px ${block.paddingLeft}px;text-align:${block.align};">
  <${tag} style="margin:0;font-family:${gs.fontFamily};font-size:${fontSize}px;font-weight:700;color:${color};line-height:1.3;">${esc(block.content)}</${tag}>
</td>`;
}

function renderImageBlock(block: ImageBlock, gs: EmailGlobalStyles): string {
  if (!block.src) {
    return `<td style="padding:${block.paddingTop}px ${block.paddingRight}px ${block.paddingBottom}px ${block.paddingLeft}px;text-align:${block.align};color:#999;font-family:${gs.fontFamily};font-size:14px;">
  <div style="background:#f0f0f0;padding:40px;border-radius:4px;text-align:center;">No image selected</div>
</td>`;
  }
  const imgStyle = `max-width:100%;width:${block.width}%;height:auto;display:block;${block.borderRadius ? `border-radius:${block.borderRadius}px;` : ''}`;
  const imgTag = `<img src="${esc(block.src)}" alt="${esc(block.alt)}" style="${imgStyle}" />`;
  const wrapped = block.link ? `<a href="${esc(block.link)}" target="_blank">${imgTag}</a>` : imgTag;
  return `<td style="padding:${block.paddingTop}px ${block.paddingRight}px ${block.paddingBottom}px ${block.paddingLeft}px;text-align:${block.align};">
  ${wrapped}
</td>`;
}

function renderButtonBlock(block: ButtonBlock, gs: EmailGlobalStyles): string {
  const bg = block.backgroundColor || gs.buttonBackgroundColor;
  const textColor = block.textColor || gs.buttonTextColor;
  const br = block.borderRadius ?? gs.buttonBorderRadius;
  const widthStyle = block.fullWidth ? 'display:block;width:100%;text-align:center;' : 'display:inline-block;';
  return `<td style="padding:${block.paddingTop}px ${block.paddingRight}px ${block.paddingBottom}px ${block.paddingLeft}px;text-align:${block.align};">
  <!--[if mso]><v:roundrect xmlns:v="urn:schemas-microsoft-com:vml" href="${esc(block.url)}" style="height:44px;v-text-anchor:middle;${block.fullWidth ? 'width:100%;' : 'width:auto;'}" arcsize="${Math.round(br / 44 * 100)}%" strokecolor="${bg}" fillcolor="${bg}"><center style="color:${textColor};font-family:${gs.fontFamily};font-size:${block.fontSize}px;font-weight:600;">${esc(block.text)}</center></v:roundrect><![endif]-->
  <!--[if !mso]><!-->
  <a href="${esc(block.url)}" target="_blank" style="${widthStyle}background-color:${bg};color:${textColor};font-family:${gs.fontFamily};font-size:${block.fontSize}px;font-weight:600;text-decoration:none;padding:12px 28px;border-radius:${br}px;mso-hide:all;">${esc(block.text)}</a>
  <!--<![endif]-->
</td>`;
}

function renderDividerBlock(block: DividerBlock): string {
  return `<td style="padding:${block.paddingTop}px 20px ${block.paddingBottom}px 20px;">
  <table width="${block.width}%" cellpadding="0" cellspacing="0" border="0" align="center">
    <tr><td style="border-top:${block.thickness}px ${block.style} ${block.color};font-size:1px;line-height:1px;">&nbsp;</td></tr>
  </table>
</td>`;
}

function renderSpacerBlock(block: SpacerBlock): string {
  return `<td style="height:${block.height}px;font-size:1px;line-height:${block.height}px;">&nbsp;</td>`;
}

function renderSocialBlock(block: SocialBlock, gs: EmailGlobalStyles): string {
  const icons = block.networks
    .filter(n => n.url)
    .map(n => {
      const info = SOCIAL_ICONS[n.platform] || { color: '#666', letter: (n.platform && n.platform.length > 0) ? n.platform[0].toUpperCase() : '?' };
      const iconColor = block.iconStyle === 'dark' ? '#333333' : block.iconStyle === 'light' ? '#ffffff' : info.color;
      const bgColor = block.iconStyle === 'light' ? '#333333' : 'transparent';
      return `<td style="padding:0 6px;">
        <a href="${esc(n.url)}" target="_blank" title="${esc(n.label)}" style="text-decoration:none;">
          <div style="display:inline-block;width:${block.iconSize}px;height:${block.iconSize}px;border-radius:50%;background-color:${bgColor};border:2px solid ${iconColor};text-align:center;line-height:${block.iconSize}px;font-family:${gs.fontFamily};font-size:${Math.round(block.iconSize * 0.4)}px;font-weight:700;color:${iconColor};">${info.letter}</div>
        </a>
      </td>`;
    })
    .join('\n');

  return `<td style="padding:${block.paddingTop}px 20px ${block.paddingBottom}px 20px;text-align:${block.align};">
  <table cellpadding="0" cellspacing="0" border="0" align="${block.align}" style="margin:0 auto;">
    <tr>${icons}</tr>
  </table>
</td>`;
}

function renderHtmlBlock(block: HtmlBlock): string {
  return `<td style="padding:${block.paddingTop}px ${block.paddingRight}px ${block.paddingBottom}px ${block.paddingLeft}px;">
  ${block.content}
</td>`;
}

function renderBlock(block: EmailBlock, gs: EmailGlobalStyles): string {
  switch (block.type) {
    case 'text': return renderTextBlock(block, gs);
    case 'heading': return renderHeadingBlock(block, gs);
    case 'image': return renderImageBlock(block, gs);
    case 'button': return renderButtonBlock(block, gs);
    case 'divider': return renderDividerBlock(block);
    case 'spacer': return renderSpacerBlock(block);
    case 'social': return renderSocialBlock(block, gs);
    case 'html': return renderHtmlBlock(block);
    default: return `<td style="padding:10px;color:#999;font-size:12px;">Unknown block</td>`;
  }
}

function renderColumn(column: EmailColumn, gs: EmailGlobalStyles): string {
  const blocks = column.blocks.map(block => {
    return `<tr>${renderBlock(block, gs)}</tr>`;
  }).join('\n');

  return `<td width="${column.width}%" valign="top" style="vertical-align:top;">
  <table width="100%" cellpadding="0" cellspacing="0" border="0">
    ${blocks}
  </table>
</td>`;
}

function renderSection(section: EmailSection, gs: EmailGlobalStyles): string {
  const bgStyle = section.backgroundColor ? `background-color:${section.backgroundColor};` : '';
  const padding = `padding:${section.paddingTop}px ${section.paddingRight}px ${section.paddingBottom}px ${section.paddingLeft}px;`;

  if (section.columns.length === 1) {
    const column = section.columns[0];
    const blocks = column.blocks.map(block => {
      return `<tr>${renderBlock(block, gs)}</tr>`;
    }).join('\n');

    return `<tr>
  <td style="${bgStyle}${padding}">
    <table width="100%" cellpadding="0" cellspacing="0" border="0">
      ${blocks}
    </table>
  </td>
</tr>`;
  }

  // Multi-column layout
  const cols = section.columns.map(col => renderColumn(col, gs)).join('\n');

  return `<tr>
  <td style="${bgStyle}${padding}">
    <!--[if mso]><table width="100%" cellpadding="0" cellspacing="0" border="0"><tr><![endif]-->
    <table width="100%" cellpadding="0" cellspacing="0" border="0">
      <tr>${cols}</tr>
    </table>
    <!--[if mso]></tr></table><![endif]-->
  </td>
</tr>`;
}

/**
 * Render an EmailDesign to email-compatible HTML
 */
export function renderEmailDesign(design: EmailDesign): string {
  const gs = design.globalStyles;
  const sections = design.sections.map(s => renderSection(s, gs)).join('\n');

  return `<!DOCTYPE html>
<html lang="en" xmlns="http://www.w3.org/1999/xhtml" xmlns:v="urn:schemas-microsoft-com:vml" xmlns:o="urn:schemas-microsoft-com:office:office">
<head>
<meta charset="UTF-8">
<meta name="viewport" content="width=device-width, initial-scale=1.0">
<meta http-equiv="X-UA-Compatible" content="IE=edge">
<meta name="x-apple-disable-message-reformatting">
<meta name="format-detection" content="telephone=no,address=no,email=no,date=no,url=no">
<title>{{subject}}</title>
<!--[if mso]><xml><o:OfficeDocumentSettings><o:AllowPNG/><o:PixelsPerInch>96</o:PixelsPerInch></o:OfficeDocumentSettings></xml><![endif]-->
<style>
  body, table, td { font-family: ${gs.fontFamily}; -webkit-text-size-adjust: 100%; -ms-text-size-adjust: 100%; }
  body { margin: 0; padding: 0; width: 100% !important; }
  table { border-collapse: collapse; mso-table-lspace: 0pt; mso-table-rspace: 0pt; }
  img { -ms-interpolation-mode: bicubic; border: 0; outline: none; text-decoration: none; }
  a { color: ${gs.linkColor}; }
  a[x-apple-data-detectors] { color: inherit !important; text-decoration: none !important; }
  @media only screen and (max-width: ${gs.bodyWidth + 40}px) {
    .email-container { width: 100% !important; max-width: 100% !important; }
    .email-container td { padding-left: 16px !important; padding-right: 16px !important; }
    .stack-column { display: block !important; width: 100% !important; }
    img { max-width: 100% !important; height: auto !important; }
  }
</style>
</head>
<body style="margin:0;padding:0;background-color:${gs.backgroundColor};font-family:${gs.fontFamily};">
<table role="presentation" width="100%" cellpadding="0" cellspacing="0" border="0" style="background-color:${gs.backgroundColor};">
  <tr>
    <td align="center" style="padding:${gs.paddingTop}px 16px ${gs.paddingBottom}px 16px;">
      <!--[if mso]><table role="presentation" width="${gs.bodyWidth}" cellpadding="0" cellspacing="0" border="0"><tr><td><![endif]-->
      <table role="presentation" class="email-container" width="${gs.bodyWidth}" cellpadding="0" cellspacing="0" border="0" style="max-width:${gs.bodyWidth}px;width:100%;background-color:${gs.contentBackgroundColor};border-radius:8px;overflow:hidden;">
        ${sections}
      </table>
      <!--[if mso]></td></tr></table><![endif]-->
    </td>
  </tr>
</table>
</body>
</html>`;
}

/**
 * Generate plain text version from design
 */
export function renderEmailDesignText(design: EmailDesign): string {
  const lines: string[] = [];

  for (const section of design.sections) {
    for (const column of section.columns) {
      for (const block of column.blocks) {
        switch (block.type) {
          case 'text':
            lines.push(block.content.replace(/<[^>]*>/g, '').trim());
            lines.push('');
            break;
          case 'heading':
            lines.push(block.content.toUpperCase());
            lines.push('');
            break;
          case 'button':
            lines.push(`${block.text}: ${block.url}`);
            lines.push('');
            break;
          case 'divider':
            lines.push('---');
            lines.push('');
            break;
          case 'social':
            for (const n of block.networks) {
              if (n.url) lines.push(`${n.label}: ${n.url}`);
            }
            lines.push('');
            break;
          case 'image':
            if (block.alt) lines.push(`[Image: ${block.alt}]`);
            break;
          case 'spacer':
            lines.push('');
            break;
        }
      }
    }
  }

  return lines.join('\n').trim();
}
