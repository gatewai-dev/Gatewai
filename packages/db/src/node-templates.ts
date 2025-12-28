import { DataType, HandleType, NodeType, type PrismaClient } from "./client";



export async function SEED_createNodeTemplates(prisma: PrismaClient) {
  // Text: no input, single output Text
  await prisma.nodeTemplate.create({
    data: {
      type: NodeType.Agent,
      displayName: 'AI Agent',
      description: 'A multi-modal AI agent.',
      tokenPrice: 0.0,
      variableInputs: false,
      variableOutputs: false,
      isTerminalNode: true,
      isTransient: false,
      templateHandles: {
        create: [
          { type: HandleType.Input, dataTypes: [DataType.Text], label: "System Prompt", required: true },
          { type: HandleType.Input, dataTypes: [DataType.Text], label: "Instructions", required: true },
        ]
      },
      defaultConfig: {
        maxTurns: 10,
        model: "anthropict/claude-opus-4.5",
      },
    }
  });
  // Text: no input, single output Text
  await prisma.nodeTemplate.create({
    data: {
      type: NodeType.Text,
      displayName: 'Text',
      description: 'A basic text node',
      tokenPrice: 0.0,
      variableInputs: false,
      variableOutputs: false,
      isTerminalNode: true,
      isTransient: false,
      templateHandles: {
        create: [
          { type: HandleType.Output, dataTypes: [DataType.Text], label: "Text" }
        ]
      },
      defaultConfig: undefined,
    }
  });

  // Preview: only file input (video, image), assuming no output, input File (generic for video/image)
  await prisma.nodeTemplate.create({
    data: {
      type: NodeType.Preview,
      displayName: 'Preview',
      description: 'A preview node for files like video or image',
      tokenPrice: 0.0,
      variableInputs: false,
      variableOutputs: false,
      isTerminalNode: false,
      isTransient: true,
      templateHandles: {
        create: [
          { type: HandleType.Input, dataTypes: [DataType.File], required: true, label: 'File (video/image)' }
        ]
      },
      defaultConfig: undefined,
    }
  });

  // File: no input, one output File
  await prisma.nodeTemplate.create({
    data: {
      type: NodeType.File,
      displayName: 'File',
      description: 'A file output node',
      tokenPrice: 0.0,
      variableInputs: false,
      variableOutputs: false,
      isTerminalNode: true,
      isTransient: false,
      templateHandles: {
        create: [
          { type: HandleType.Output, dataTypes: [DataType.File], label: "File" }
        ]
      },
      defaultConfig: undefined,
    }
  });

  // Export: one input File, no output
  await prisma.nodeTemplate.create({
    data: {
      type: NodeType.Export,
      displayName: 'Export',
      description: 'An export node for files',
      tokenPrice: 0.0,
      variableInputs: false,
      variableOutputs: false,
      isTerminalNode: false,
      isTransient: true,
      templateHandles: {
        create: [
          { type: HandleType.Input, dataTypes: [DataType.File], required: true, label: "File" }
        ]
      },
      defaultConfig: undefined,
    }
  });

  // Toggle: no input, one output Boolean
  await prisma.nodeTemplate.create({
    data: {
      type: NodeType.Toggle,
      displayName: 'Toggle',
      description: 'A toggle node for boolean output',
      tokenPrice: 0.0,
      variableInputs: false,
      variableOutputs: false,
      isTerminalNode: true,
      isTransient: false,
      templateHandles: {
        create: [
          { type: HandleType.Output, dataTypes: [DataType.Boolean], label: "Yes/No" }
        ]
      },
      defaultConfig: undefined,
    }
  });

  // Crawler: one input Text, one output Text
  await prisma.nodeTemplate.create({
    data: {
      type: NodeType.Crawler,
      displayName: 'Crawler',
      description: 'A crawler node with text in/out',
      tokenPrice: 0.0,
      variableInputs: false,
      variableOutputs: false,
      isTerminalNode: true,
      isTransient: false,
      templateHandles: {
        create: [
          { type: HandleType.Input, dataTypes: [DataType.Text], required: true, label: "Link" },
          { type: HandleType.Output, dataTypes: [DataType.Text], label: "HTML content (Text)" }
        ]
      },
      defaultConfig: undefined,
    }
  });

  // Resize: file input / file output (video/image), using File for both
  await prisma.nodeTemplate.create({
    data: {
      type: NodeType.Resize,
      displayName: 'Resize',
      description: 'A resize node for video/image files',
      tokenPrice: 0.0,
      variableInputs: false,
      variableOutputs: false,
      isTerminalNode: true,
      isTransient: true,
      templateHandles: {
        create: [
          { type: HandleType.Input, dataTypes: [DataType.Image, DataType.Video, DataType.Mask], required: true, label: "Image" },
          { type: HandleType.Output, dataTypes: [DataType.File], label: "Result" }
        ]
      },
      defaultConfig: undefined,
    }
  });

  // Paint: image input, mask and image output
  await prisma.nodeTemplate.create({
    data: {
      type: NodeType.Paint,
      displayName: 'Paint',
      description: 'A painter node with image input and mask/image outputs',
      tokenPrice: 0.0,
      variableInputs: false,
      variableOutputs: false,
      isTerminalNode: false,
      isTransient: false,
      templateHandles: {
        create: [
          { type: HandleType.Input, dataTypes: [DataType.Image], label: "Background Image" },
          { type: HandleType.Output, dataTypes: [DataType.Image], label: 'Image' },
          { type: HandleType.Output, dataTypes: [DataType.Mask], label: 'Mask' },
        ]
      },
      defaultConfig: {
        width: 1024,
        height: 1024,
        backgroundColor: '#000'
      },
    }
  });

  // Blur: image input, image output
  await prisma.nodeTemplate.create({
    data: {
      type: NodeType.Blur,
      displayName: 'Blur',
      description: 'A blur effect node',
      tokenPrice: 0.0,
      variableInputs: false,
      variableOutputs: false,
      isTerminalNode: true,
      isTransient: true,
      templateHandles: {
        create: [
          { type: HandleType.Input, dataTypes: [DataType.Image], required: true, label: 'Image' },
          { type: HandleType.Output, dataTypes: [DataType.Image], label: "Blurred Image" }
        ]
      },
      defaultConfig: {
        blurAmount: 0
      },
    }
  });
  await prisma.nodeTemplate.create({
    data: {
      type: NodeType.Crop,
      displayName: 'Crop',
      description: 'Crop images',
      tokenPrice: 0.0,
      variableInputs: false,
      variableOutputs: false,
      isTerminalNode: true,
      isTransient: true,
      templateHandles: {
        create: [
          { type: HandleType.Input, dataTypes: [DataType.Image], required: true, label: 'Image' },
          { type: HandleType.Output, dataTypes: [DataType.Image], label: "Result" }
        ]
      },
      defaultConfig: {
        leftPercentage: 0,
        topPercentage: 0,
        widthPercentage: 100,
        heightPercentage: 100,
      },
    }
  });

  // Compositor: multiple image / text inputs starts with single image, assuming variableInputs true, one image output
  await prisma.nodeTemplate.create({
    data: {
      type: NodeType.Compositor,
      displayName: 'Compositor',
      description: 'A compositor node with multiple image inputs',
      tokenPrice: 0.0,
      variableInputs: true,
      variableOutputs: false,
      isTerminalNode: false,
      isTransient: true,
      templateHandles: {
        create: [
          { type: HandleType.Input, dataTypes: [DataType.Image], required: true, label: 'Image' },
          { type: HandleType.Output, dataTypes: [DataType.Image], label: "Output Image" }
        ]
      },
      defaultConfig: {
        canvasWidth: 1024,
        canvasHeight: 1024
      },
    }
  });

  // Describer: not specified, assuming image input, text output (e.g., image describer)
  await prisma.nodeTemplate.create({
    data: {
      type: NodeType.Describer,
      displayName: 'Describer',
      description: 'A describer node for images',
      tokenPrice: 0.0,
      variableInputs: false,
      variableOutputs: false,
      isTerminalNode: true,
      isTransient: false,
      templateHandles: {
        create: [
          { type: HandleType.Input, dataTypes: [DataType.Image], required: true, label: 'Image' },
          { type: HandleType.Output, dataTypes: [DataType.Text], label: 'Text' }
        ]
      },
      defaultConfig: undefined,
    }
  });

  // Router: single input of any kind, single output of any kind, using Text for both
  await prisma.nodeTemplate.create({
    data: {
      type: NodeType.Router,
      displayName: 'Router',
      description: 'A router node with text in/out',
      tokenPrice: 0.0,
      variableInputs: false,
      variableOutputs: false,
      isTerminalNode: false,
      isTransient: true,
      templateHandles: {
        create: [
          { type: HandleType.Input, dataTypes: [DataType.Text], required: true, label: 'Input' },
          { type: HandleType.Output, dataTypes: [DataType.Text], label: 'Output' }
        ]
      },
      defaultConfig: undefined,
    }
  });

  // Note: no input or output
  await prisma.nodeTemplate.create({
    data: {
      type: NodeType.Note,
      displayName: 'Sticky Note',
      description: 'A sticky note',
      tokenPrice: 0.0,
      variableInputs: false,
      variableOutputs: false,
      isTerminalNode: false,
      isTransient: false,
      templateHandles: {
        create: []
      },
      defaultConfig: {
        backgroundColor: "#ffff88",
        textColor: "#000000",
      },
    }
  });

  // Number: no input, one number output
  await prisma.nodeTemplate.create({
    data: {
      type: NodeType.Number,
      displayName: 'Number',
      description: 'A number output node',
      tokenPrice: 0.0,
      variableInputs: false,
      variableOutputs: false,
      isTerminalNode: false,
      isTransient: false,
      templateHandles: {
        create: [
          { type: HandleType.Output, dataTypes: [DataType.Number], label: 'Number' }
        ]
      },
      defaultConfig: undefined,
    }
  });

  // ImageGen: one text input, one image output
  await prisma.nodeTemplate.create({
    data: {
      type: NodeType.ImageGen,
      displayName: 'Multimodal Image Generation',
      description: 'Generate images using text prompt and reference images',
      tokenPrice: 0.0,
      variableInputs: false,
      variableOutputs: false,
      isTerminalNode: true,
      isTransient: false,
      templateHandles: {
        create: [
          { type: HandleType.Input, dataTypes: [DataType.Text], required: true, label: 'Prompt' },
          { type: HandleType.Input, dataTypes: [DataType.Image], required: false, label: 'Reference Image 1' },
          { type: HandleType.Output, dataTypes: [DataType.Image], label: 'Image' }
        ]
      },
      defaultConfig: {
        model: 'google/gemini-3-pro-image'
      },
    }
  });

  // LLM: prompt input required (Text), system prompt input optional (Text), Image input optional, one text output
  await prisma.nodeTemplate.create({
    data: {
      type: NodeType.LLM,
      displayName: 'LLM',
      description: 'Run a LLM model',
      tokenPrice: 0.0,
      variableInputs: false,
      variableOutputs: false,
      isTerminalNode: true,
      isTransient: false,
      templateHandles: {
        create: [
          { type: HandleType.Input, dataTypes: [DataType.Text], required: true, label: 'Prompt' },
          { type: HandleType.Input, dataTypes: [DataType.Text], required: false, label: 'System Prompt' },
          { type: HandleType.Input, dataTypes: [DataType.Image], required: false, label: 'Image' },
          { type: HandleType.Output, dataTypes: [DataType.Text], label: 'Text' }
        ]
      },
      defaultConfig: {
        model: "openai/gpt-5-chat",
        temperature: 0,
      },
    }
  });
}