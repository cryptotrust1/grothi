// Email Designer Types — Brevo-style drag-and-drop email builder
// JSON data model for storing and rendering email designs

export interface EmailGlobalStyles {
  bodyWidth: number;
  backgroundColor: string;
  contentBackgroundColor: string;
  fontFamily: string;
  headingColor: string;
  textColor: string;
  linkColor: string;
  buttonBackgroundColor: string;
  buttonTextColor: string;
  buttonBorderRadius: number;
  paddingTop: number;
  paddingBottom: number;
}

export interface EmailSection {
  id: string;
  columns: EmailColumn[];
  backgroundColor: string;
  paddingTop: number;
  paddingRight: number;
  paddingBottom: number;
  paddingLeft: number;
}

export interface EmailColumn {
  id: string;
  width: number; // percentage 0-100
  blocks: EmailBlock[];
}

export type EmailBlockType = 'text' | 'heading' | 'image' | 'button' | 'divider' | 'spacer' | 'social' | 'html';

export interface TextBlock {
  type: 'text';
  id: string;
  content: string;
  align: 'left' | 'center' | 'right';
  fontSize: number;
  color: string;
  lineHeight: number;
  paddingTop: number;
  paddingBottom: number;
  paddingLeft: number;
  paddingRight: number;
}

export interface HeadingBlock {
  type: 'heading';
  id: string;
  content: string;
  level: 1 | 2 | 3;
  align: 'left' | 'center' | 'right';
  color: string;
  paddingTop: number;
  paddingBottom: number;
  paddingLeft: number;
  paddingRight: number;
}

export interface ImageBlock {
  type: 'image';
  id: string;
  src: string;
  alt: string;
  width: number; // percentage 0-100
  align: 'left' | 'center' | 'right';
  link: string;
  borderRadius: number;
  paddingTop: number;
  paddingBottom: number;
  paddingLeft: number;
  paddingRight: number;
}

export interface ButtonBlock {
  type: 'button';
  id: string;
  text: string;
  url: string;
  align: 'left' | 'center' | 'right';
  backgroundColor: string;
  textColor: string;
  borderRadius: number;
  fontSize: number;
  fullWidth: boolean;
  paddingTop: number;
  paddingBottom: number;
  paddingLeft: number;
  paddingRight: number;
}

export interface DividerBlock {
  type: 'divider';
  id: string;
  color: string;
  thickness: number;
  width: number; // percentage 0-100
  style: 'solid' | 'dashed' | 'dotted';
  paddingTop: number;
  paddingBottom: number;
}

export interface SpacerBlock {
  type: 'spacer';
  id: string;
  height: number;
}

export interface SocialNetwork {
  platform: string;
  url: string;
  label: string;
}

export interface SocialBlock {
  type: 'social';
  id: string;
  networks: SocialNetwork[];
  align: 'left' | 'center' | 'right';
  iconSize: number;
  iconStyle: 'color' | 'dark' | 'light';
  paddingTop: number;
  paddingBottom: number;
}

export interface HtmlBlock {
  type: 'html';
  id: string;
  content: string;
  paddingTop: number;
  paddingBottom: number;
  paddingLeft: number;
  paddingRight: number;
}

export type EmailBlock =
  | TextBlock
  | HeadingBlock
  | ImageBlock
  | ButtonBlock
  | DividerBlock
  | SpacerBlock
  | SocialBlock
  | HtmlBlock;

export interface EmailDesign {
  globalStyles: EmailGlobalStyles;
  sections: EmailSection[];
}

// ============ DEFAULTS ============

export const DEFAULT_GLOBAL_STYLES: EmailGlobalStyles = {
  bodyWidth: 600,
  backgroundColor: '#f4f4f7',
  contentBackgroundColor: '#ffffff',
  fontFamily: 'Arial, Helvetica, sans-serif',
  headingColor: '#1a1a2e',
  textColor: '#4a4a68',
  linkColor: '#6366f1',
  buttonBackgroundColor: '#6366f1',
  buttonTextColor: '#ffffff',
  buttonBorderRadius: 6,
  paddingTop: 40,
  paddingBottom: 40,
};

let _blockIdCounter = 0;
export function generateId(): string {
  _blockIdCounter++;
  return `b${Date.now().toString(36)}${_blockIdCounter.toString(36)}${Math.random().toString(36).slice(2, 6)}`;
}

export function createDefaultBlock(type: EmailBlockType): EmailBlock {
  const id = generateId();
  switch (type) {
    case 'text':
      return { type: 'text', id, content: '<p>Write your text here. Use merge tags like {{firstName}} for personalization.</p>', align: 'left', fontSize: 16, color: '', lineHeight: 1.6, paddingTop: 10, paddingBottom: 10, paddingLeft: 20, paddingRight: 20 };
    case 'heading':
      return { type: 'heading', id, content: 'Your Heading', level: 1, align: 'left', color: '', paddingTop: 10, paddingBottom: 10, paddingLeft: 20, paddingRight: 20 };
    case 'image':
      return { type: 'image', id, src: '', alt: 'Image', width: 100, align: 'center', link: '', borderRadius: 0, paddingTop: 10, paddingBottom: 10, paddingLeft: 20, paddingRight: 20 };
    case 'button':
      return { type: 'button', id, text: 'Click Here', url: '{{targetUrl}}', align: 'center', backgroundColor: '', textColor: '', borderRadius: 6, fontSize: 16, fullWidth: false, paddingTop: 15, paddingBottom: 15, paddingLeft: 20, paddingRight: 20 };
    case 'divider':
      return { type: 'divider', id, color: '#e5e7eb', thickness: 1, width: 100, style: 'solid', paddingTop: 15, paddingBottom: 15 };
    case 'spacer':
      return { type: 'spacer', id, height: 30 };
    case 'social':
      return { type: 'social', id, networks: [
        { platform: 'facebook', url: '', label: 'Facebook' },
        { platform: 'twitter', url: '', label: 'Twitter' },
        { platform: 'instagram', url: '', label: 'Instagram' },
        { platform: 'linkedin', url: '', label: 'LinkedIn' },
      ], align: 'center', iconSize: 32, iconStyle: 'color', paddingTop: 15, paddingBottom: 15 };
    case 'html':
      return { type: 'html', id, content: '<!-- Your custom HTML here -->', paddingTop: 10, paddingBottom: 10, paddingLeft: 20, paddingRight: 20 };
  }
}

export function createSection(columnWidths: number[] = [100]): EmailSection {
  return {
    id: generateId(),
    columns: columnWidths.map(w => ({
      id: generateId(),
      width: w,
      blocks: [],
    })),
    backgroundColor: '',
    paddingTop: 0,
    paddingRight: 0,
    paddingBottom: 0,
    paddingLeft: 0,
  };
}

export function createEmptyDesign(): EmailDesign {
  return {
    globalStyles: { ...DEFAULT_GLOBAL_STYLES },
    sections: [],
  };
}

// Column layout presets
export const COLUMN_LAYOUTS = [
  { label: '1 Column', widths: [100], icon: '█' },
  { label: '2 Columns', widths: [50, 50], icon: '██' },
  { label: '2 Columns (1/3 + 2/3)', widths: [33, 67], icon: '▐█' },
  { label: '2 Columns (2/3 + 1/3)', widths: [67, 33], icon: '█▌' },
  { label: '3 Columns', widths: [33, 34, 33], icon: '███' },
] as const;

export const BLOCK_TYPES: { type: EmailBlockType; label: string; icon: string }[] = [
  { type: 'heading', label: 'Heading', icon: 'H' },
  { type: 'text', label: 'Text', icon: 'T' },
  { type: 'image', label: 'Image', icon: '🖼' },
  { type: 'button', label: 'Button', icon: '▢' },
  { type: 'divider', label: 'Divider', icon: '—' },
  { type: 'spacer', label: 'Spacer', icon: '↕' },
  { type: 'social', label: 'Social', icon: '@' },
  { type: 'html', label: 'HTML', icon: '</>' },
];

export const FONT_OPTIONS = [
  { label: 'Arial', value: 'Arial, Helvetica, sans-serif' },
  { label: 'Georgia', value: 'Georgia, Times, serif' },
  { label: 'Helvetica', value: 'Helvetica, Arial, sans-serif' },
  { label: 'Tahoma', value: 'Tahoma, Geneva, sans-serif' },
  { label: 'Times New Roman', value: "'Times New Roman', Times, serif" },
  { label: 'Trebuchet MS', value: "'Trebuchet MS', sans-serif" },
  { label: 'Verdana', value: 'Verdana, Geneva, sans-serif' },
  { label: 'Courier New', value: "'Courier New', monospace" },
];

export const SOCIAL_PLATFORMS = [
  { platform: 'facebook', label: 'Facebook', color: '#1877F2' },
  { platform: 'twitter', label: 'X (Twitter)', color: '#000000' },
  { platform: 'instagram', label: 'Instagram', color: '#E4405F' },
  { platform: 'linkedin', label: 'LinkedIn', color: '#0A66C2' },
  { platform: 'youtube', label: 'YouTube', color: '#FF0000' },
  { platform: 'tiktok', label: 'TikTok', color: '#000000' },
  { platform: 'pinterest', label: 'Pinterest', color: '#E60023' },
  { platform: 'threads', label: 'Threads', color: '#000000' },
];
