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

  export type Output = {
    items: OutputItem<DataType>[];
  }

  export type SelectItemType = {
    selectedOutputIndex: number;
  }

  export type TextResult = {
    outputs: [{ items: [OutputItem<"Text">] }];
  }

  export type ToggleResult = {
    outputs: [{ items: [OutputItem<"Boolean">] }];
  }

  export type FileResult = SelectItemType & {
    outputs: { items: [OutputItem<"File">] }[];
  }

  export type ImagesResult = SelectItemType & {
    outputs: { items: [OutputItem<"Image">] }[];
  }

  export type GPTImage1Result = ImagesResult;

  export type MaskResult = SelectItemType & {
    outputs: { items: [OutputItem<"Mask">] }[];
  }

  export type NumberResult = {
    outputs: [{ items: [OutputItem<"Number">] }];
  }

  export type LLMResult = {
    outputs: [{ items: [OutputItem<"Text">] }];
  }

  export type ResizeResult = {
    outputs: [{ items: [OutputItem<"Image" | "Video">] }];
  }

  export type ThreeDResult = SelectItemType & {
    outputs: { items: [OutputItem<"File">] }[];
  }

  export type PainterResult = {
    outputs: [{ items: [OutputItem<"Image">, OutputItem<"Mask">] }];
  }

  export type BlurResult = {
    outputs: [{ items: [OutputItem<"Image">] }];
  }

  export type CompositorResult = {
    outputs: [{ items: [OutputItem<"Image">] }];
  }

  export type DescriberResult = {
    outputs: [{ items: [OutputItem<"Text">] }];
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