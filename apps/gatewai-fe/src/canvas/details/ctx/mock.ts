import type { LLMResult, GPTImage1Result } from "@gatewai/types";
import type { Node } from "@xyflow/react";

export const mock_nodes: Node[] = [
  {
    id: "1",
    position: {
      x: 300,
      y: 360,
    },
    width: 300,
    height: 200,
    type: 'Text',
    data: {
      result: {
        parts: [{
          type: 'Text',
          data: 'Create a text prompt for GTA 6 advertisement banner image.',
        }]
      } as LLMResult,
      template: {
        outputTypes: [
          {
            "id": "i22",
            outputType: 'Text',
            label: 'Text',
          }
        ]
      }
    }
  },
  {
    id: "2",
    position: {
      x: 700,
      y: 360,
    },
    width: 300,
    type: 'LLM',
    data: {
      result: {
        parts: [{
          type: 'Text',
          data: 'LLM output',
        }]
      } as LLMResult,
      template: {
        inputTypes: [
          {
            "id": "s1",
            inputType: 'Text',
            label: 'Prompt',
          }
        ],
        outputTypes: [
          {
            "id": "i22",
            outputType: 'Text',
            label: 'Output',
          }
        ]
      }
    }
  },
  {
    id: "3",
    position: {
      x: 700,
      y: 760,
    },
    width: 300,
    type: 'GPTImage1',
    data: {
      template: {
        inputTypes: [
          {
            "id": "s13",
            inputType: 'Text',
            label: 'Prompt',
          }
        ],
        outputTypes: [
          {
            "id": "i232",
            outputType: 'Image',
            label: 'Image',
          }
        ]
      },
      result: {
          selectedIndex: 0,
          parts: [{
            type: 'Image',
            data: {
              mediaSize: {
                width: 512,
                height: 512,
              },
              name: 'First Image',
              bucket: 'default',
              fileSize: 2048,
              mimeType: 'image/png',
              url: "https://placehold.co/512x512",
            }
          },{
            type: 'Image',
            data: {
              mediaSize: {
                width: 1024,
                height: 1024,
              },
              name: 'Second Image',
              bucket: 'default',
              fileSize: 2048,
              mimeType: 'image/png',
              url: "https://placehold.co/1024x1024",
            }
          },]
        } as GPTImage1Result,
    }
  }
];