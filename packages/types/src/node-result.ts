import type { DataType, FileAsset } from "@gatewai/db";


  export type FileData = {
    entity?: FileAsset;
    dataUrl?: string;
  }

  export type DataForType<R extends DataType> =
    R extends "Text" ? string :
    R extends "Number" ? number :
    R extends "Boolean" ? boolean :
    R extends "Image" | "Video" | "Audio" | "File" | "Mask" | "VideoLayer" ? FileData :
    R extends "DesignLayer" ? string | FileData :
    R extends "VideoLayer" ? FileData :
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

  export type MultipleOutputResult = {
    selectedOutputIndex: number;
  }

  // Just to avoid weird gymnastics about typing
  export type SingleOutputResult = {
    selectedOutputIndex: 0;
  }

  export type TextResult = SingleOutputResult & {
    outputs: [{ items: [OutputItem<"Text">] }];
  }

  export type ToggleResult = SingleOutputResult & {
    outputs: [{ items: [OutputItem<"Boolean">] }];
  }

  export type FileResult = MultipleOutputResult & {
    outputs: { items: [OutputItem<"File">] }[];
  }

  export type ImagesResult = MultipleOutputResult & {
    outputs: { items: [OutputItem<"Image">] }[];
  }

  export type ImageGenResult = ImagesResult;

  export type MaskResult = MultipleOutputResult & {
    outputs: { items: [OutputItem<"Mask">] }[];
  }

  export type NumberResult = SingleOutputResult & {
    outputs: [{ items: [OutputItem<"Number">] }];
  }

  export type LLMResult = SingleOutputResult & {
    outputs: [{ items: [OutputItem<"Text">] }];
  }

  export type ResizeResult = SingleOutputResult & {
    outputs: [{ items: [OutputItem<"Image" | "Video">] }];
  }

  export type ThreeDResult = MultipleOutputResult & {
    outputs: { items: [OutputItem<"File">] }[];
  }

  export type PainterResult = SingleOutputResult & {
    outputs: [{ items: [OutputItem<"Image">, OutputItem<"Mask">] }];
  }

  export type BlurResult = SingleOutputResult & {
    outputs: [{ items: [OutputItem<"Image">] }];
  }

  export type CompositorResult = SingleOutputResult & {
    outputs: [{ items: [OutputItem<"Image">] }];
  }

  export type DescriberResult = SingleOutputResult& {
    outputs: [{ items: [OutputItem<"Text">] }];
  }

  export type NodeResult =
    | TextResult
    | ToggleResult
    | FileResult
    | ImagesResult
    | ImageGenResult
    | MaskResult
    | NumberResult
    | LLMResult
    | ResizeResult
    | ThreeDResult
    | PainterResult
    | BlurResult
    | CompositorResult
    | DescriberResult;