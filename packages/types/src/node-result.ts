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

  export type DataForType<R extends DataType> =
    R extends "Text" ? string :
    R extends "Number" ? number :
    R extends "Boolean" ? boolean :
    R extends "Image" | "Video" | "Audio" | "File" | "Mask" | "VideoLayer" ? FileData :
    R extends "DesignLayer" ? string | FileData :
    R extends "Any" ? string | number | boolean | FileData :
    never;

  export type OutputItem<R extends DataType> = {
    type: R;
    data: DataForType<R>;
    outputHandleId: string;
  }

  export type SelectItemType = {
    selectedIndex: number;
  }

  export type TextResult = {
    parts: [OutputItem<"Text">];
  }

  export type ToggleResult = {
    parts: [OutputItem<"Boolean">];
  }

  export type FileResult = SelectItemType & {
    parts: OutputItem<"File">[];
  }

  export type ImagesResult = SelectItemType & {
    parts: OutputItem<"Image">[];
  }

  export type GPTImage1Result = ImagesResult;

  export type MaskResult = SelectItemType & {
    parts: OutputItem<"Mask">[];
  }

  export type NumberResult = {
    parts: [OutputItem<"Number">];
  }

  export type LLMResult = {
    parts: [OutputItem<"Text">];
  }

  export type ResizeResult = {
    parts: [OutputItem<"Image" | "Video">];
  }

  export type ThreeDResult = SelectItemType & {
    parts: [OutputItem<"File">];
  }

  export type PainterResult = {
    parts: [OutputItem<"Image">, OutputItem<"Mask">];
  }

  export type BlurResult = {
    parts: [OutputItem<"Image">];
  }

  export type CompositorResult = {
    parts: [OutputItem<"Image">];
  }

  export type DescriberResult = {
    parts: [OutputItem<"Text">];
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