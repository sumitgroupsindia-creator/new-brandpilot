export type DynamicFieldType = 'text' | 'email' | 'url' | 'tel' | 'image';

export type ImageBackgroundMode = 'with' | 'without';

export interface DynamicFieldDefinition {
  key: string;
  label: string;
  type: DynamicFieldType;
  defaultValue: string;
  supportsBackgroundRemoval?: boolean;
  x?: number;
  y?: number;
  width?: number;
  height?: number;
  font?: string;
  fontSize?: number;
  color?: string;
  lineHeight?: number;
  justification?: string;
}

export interface DynamicFrameFieldValues {
  text: Record<string, string>;
  imagePreviewUrl: Record<string, string>;
  imageDataUrl: Record<string, string>;
  imageBackgroundMode: Record<string, ImageBackgroundMode>;
}

export interface FrameTemplateLayer {
  type?: string;
  name?: string;
  text?: string;
  src?: string;
  x?: number;
  y?: number;
  width?: number;
  height?: number;
  font?: string;
  size?: number;
  color?: string;
  fill?: string;
  lineHeight?: number;
  justification?: string;
  opacity?: number;
  radius?: number;
}

export interface FrameInputImageValue {
  dataUrl: string;
  backgroundMode: ImageBackgroundMode;
}

export interface FrameInputDraft {
  text: Record<string, string>;
  images: Record<string, FrameInputImageValue>;
}
