import type { DataType } from "@gatewai/db";


export type FileData = {
  /**
   * Signed AWS/GCS URL
   */
    url?: string;
    name: string;
    bucket: string;
    mimeType: string;
    fileSize: number;
    mediaSize?: {
      width: number;
      height: number;
    };
    duration?: number; // in seconds
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

  export type ToggleResult = {
    parts: [OutputItem<boolean, "Boolean">];
  }

  export type FileResult = SelectItemType & {
    parts: OutputItem<FileData, "File">[];
  }

  export type ImagesResult = SelectItemType & {
    parts: OutputItem<FileData, "Image">[];
  }

  export type GPTImage1Result = ImagesResult;

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

  export type ThreeDResult = SelectItemType & {
    parts: [OutputItem<FileData, "File">];
  }

  export type PainterResult = {
    parts: [OutputItem<FileData, "Image">, OutputItem<FileData, "Mask">,];
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

  export type NodeResult =
    | TextResult
    | ToggleResult
    | FileResult
    | ImagesResult
    | GPTImage1Result
    | MaskResult
    | NumberResult
    | LLMResult
    | ResizeResult
    | ThreeDResult
    | PainterResult
    | BlurResult
    | CompositorResult
    | DescriberResult;