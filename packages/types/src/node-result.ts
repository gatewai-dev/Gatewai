import type { DataType } from "@gatewai/db";


export type FileData = {
    url?: string; // Signed AWS S3 URL
    name: string;
    bucket: string;
    mimeType: string;
    size: number;
}

  export type OutputItem<T extends FileData | string | boolean | number, R extends DataType> = {
    type: R;
    data: T;
  }

  export type SelectItemType = {
    selectedIndex: number;
  }

  export type TextResult = {
    parts: [OutputItem<string, "Text">];
  }

  export type ImageResult = {
    parts: [OutputItem<FileData, "Image">];
  }

  export type ToggleResult = {
    parts: [OutputItem<boolean, "Boolean">];
  }

  export type FileResult = SelectItemType & {
    parts: OutputItem<FileData, "File">[];
  }

  export type GPTImage1Result = SelectItemType & {
    parts: OutputItem<FileData, "Image">[];
  }

  export type MaskResult = SelectItemType & {
    parts: OutputItem<FileData, "Image">[];
  }

  export type NumberResult = {
    parts: [OutputItem<number, "Number">];
  }

  export type LLMResult = {
    parts: [OutputItem<string, "Text">];
  }

  export type ResizeResult = {
    parts: [OutputItem<FileData, "Image" | "Video">];
  }

  export type CrawlerResult = SelectItemType & {
    parts: OutputItem<string, "Text">[];
  }

  export type BlurResult = {
    parts: [OutputItem<FileData, "Image">];
  }

  export type CompositorResult = {
    parts: [OutputItem<FileData, "Image">];
  }

  export type DescriberResult = {
    parts: [OutputItem<string, "Text">];
  }