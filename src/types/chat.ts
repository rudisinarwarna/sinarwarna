export type CreativeModeId = 'general' | 'copywriting' | 'design' | 'campaign';

export type ThinkingDepth = 'fast' | 'deep';

export interface ImageAttachment {
  id: string;
  name: string;
  mimeType: string;
  /** Base64 encoded data without data URI prefix */
  data: string;
  /** Data URL for rendering preview in UI */
  previewUrl: string;
}

export interface ChatMessage {
  id: string;
  role: 'user' | 'model';
  text: string;
  attachments?: ImageAttachment[];
  attachmentNames?: string[];
  createdAt: number;
  error?: string;
}

export interface Conversation {
  id: string;
  title: string;
  mode: CreativeModeId;
  messages: ChatMessage[];
  updatedAt: number;
}

export interface CreativeModeConfig {
  id: CreativeModeId;
  label: string;
  shortLabel: string;
  description: string;
  placeholder: string;
}

export interface StarterPrompt {
  id: string;
  mode: CreativeModeId;
  title: string;
  prompt: string;
}
