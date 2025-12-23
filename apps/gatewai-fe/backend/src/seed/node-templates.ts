import { NodeType, ProcessEnvironment, DataType, HandleType, PrismaClient } from "@gatewai/db";

export async function SEED_createNodeTemplates(prisma: PrismaClient) {
  // Text: no input, single output Text
  await prisma.nodeTemplate.create({
    data: {
      type: NodeType.Text,
      displayName: 'Text',
      description: 'A basic text node',
      processEnvironment: ProcessEnvironment.Server,
      tokenPrice: 0.0,
      variableInputs: false,
      variableOutputs: false,
      templateHandles: {
        create: [
          { type: HandleType.Output, dataType: DataType.Text, label: "Text" }
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
      processEnvironment: ProcessEnvironment.Browser,
      tokenPrice: 0.0,
      variableInputs: false,
      variableOutputs: false,
      templateHandles: {
        create: [
          { type: HandleType.Input, dataType: DataType.File, required: true, label: 'File (video/image)' }
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
      processEnvironment: ProcessEnvironment.Server,
      tokenPrice: 0.0,
      variableInputs: false,
      variableOutputs: false,
      templateHandles: {
        create: [
          { type: HandleType.Output, dataType: DataType.File, label: "File" }
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
      processEnvironment: ProcessEnvironment.Server,
      tokenPrice: 0.0,
      variableInputs: false,
      variableOutputs: false,
      templateHandles: {
        create: [
          { type: HandleType.Input, dataType: DataType.File, required: true, label: "File" }
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
      processEnvironment: ProcessEnvironment.Browser,
      tokenPrice: 0.0,
      variableInputs: false,
      variableOutputs: false,
      templateHandles: {
        create: [
          { type: HandleType.Output, dataType: DataType.Boolean, label: "Yes/No" }
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
      processEnvironment: ProcessEnvironment.Server,
      tokenPrice: 0.0,
      variableInputs: false,
      variableOutputs: false,
      templateHandles: {
        create: [
          { type: HandleType.Input, dataType: DataType.Text, required: true, label: "Link" },
          { type: HandleType.Output, dataType: DataType.Text, label: "HTML content (Text)" }
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
      processEnvironment: ProcessEnvironment.Browser,
      tokenPrice: 0.0,
      variableInputs: false,
      variableOutputs: false,
      templateHandles: {
        create: [
          { type: HandleType.Input, dataType: DataType.File, required: true, label: "Image/Video" },
          { type: HandleType.Output, dataType: DataType.File, label: "Resized Image/Video" }
        ]
      },
      defaultConfig: {},
    }
  });

  // Agent: starts with single text input but user can add more inputs file / text etc., assuming one text output, variableInputs true
  await prisma.nodeTemplate.create({
    data: {
      type: NodeType.Agent,
      displayName: 'Agent',
      description: 'An agent node with variable inputs starting with text',
      processEnvironment: ProcessEnvironment.Server,
      tokenPrice: 0.0,
      variableInputs: true,
      variableOutputs: false,
      templateHandles: {
        create: [
          { type: HandleType.Input, dataType: DataType.Text, required: true, label: 'Instructions' },
          { type: HandleType.Output, dataType: DataType.Text, label: "Text Output" }
        ]
      },
      defaultConfig: undefined,
    }
  });

  // ThreeD: not specified, assuming text input for description, file output for 3D model
  await prisma.nodeTemplate.create({
    data: {
      type: NodeType.ThreeD,
      displayName: 'ThreeD',
      description: 'A 3D processing node',
      processEnvironment: ProcessEnvironment.Browser,
      tokenPrice: 0.0,
      variableInputs: false,
      variableOutputs: false,
      templateHandles: {
        create: [
          { type: HandleType.Input, dataType: DataType.Text, required: true, label: "Prompt" },
          { type: HandleType.Output, dataType: DataType.File, label: "3D File" }
        ]
      },
      defaultConfig: undefined,
    }
  });

  // Painter: image input, mask and image output
  await prisma.nodeTemplate.create({
    data: {
      type: NodeType.Painter,
      displayName: 'Painter',
      description: 'A painter node with image input and mask/image outputs',
      processEnvironment: ProcessEnvironment.Browser,
      tokenPrice: 0.0,
      variableInputs: false,
      variableOutputs: false,
      templateHandles: {
        create: [
          { type: HandleType.Input, dataType: DataType.Image, required: true, label: null },
          { type: HandleType.Output, dataType: DataType.Mask, label: null },
          { type: HandleType.Output, dataType: DataType.Image, label: null }
        ]
      },
      defaultConfig: undefined,
    }
  });

  // Blur: image input, image output
  await prisma.nodeTemplate.create({
    data: {
      type: NodeType.Blur,
      displayName: 'Blur',
      description: 'A blur effect node',
      processEnvironment: ProcessEnvironment.Browser,
      tokenPrice: 0.0,
      variableInputs: false,
      variableOutputs: false,
      templateHandles: {
        create: [
          { type: HandleType.Input, dataType: DataType.Image, required: true, label: null },
          { type: HandleType.Output, dataType: DataType.Image, label: "Blurred Image" }
        ]
      },
      defaultConfig: {
        blurAmount: 0
      },
    }
  });

  // Compositor: multiple image / text inputs starts with single image, assuming variableInputs true, one image output
  await prisma.nodeTemplate.create({
    data: {
      type: NodeType.Compositor,
      displayName: 'Compositor',
      description: 'A compositor node with variable inputs starting with image',
      processEnvironment: ProcessEnvironment.Browser,
      tokenPrice: 0.0,
      variableInputs: true,
      variableOutputs: false,
      templateHandles: {
        create: [
          { type: HandleType.Input, dataType: DataType.Image, required: true, label: 'Image' },
          { type: HandleType.Output, dataType: DataType.Image, label: "Output Image" }
        ]
      },
      defaultConfig: {
        canvasWidth: 512,
        canvasHeight: 512
      },
    }
  });

  // Describer: not specified, assuming image input, text output (e.g., image describer)
  await prisma.nodeTemplate.create({
    data: {
      type: NodeType.Describer,
      displayName: 'Describer',
      description: 'A describer node for images',
      processEnvironment: ProcessEnvironment.Server,
      tokenPrice: 0.0,
      variableInputs: false,
      variableOutputs: false,
      templateHandles: {
        create: [
          { type: HandleType.Input, dataType: DataType.Image, required: true, label: null },
          { type: HandleType.Output, dataType: DataType.Text, label: null }
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
      processEnvironment: ProcessEnvironment.Server,
      tokenPrice: 0.0,
      variableInputs: false,
      variableOutputs: false,
      templateHandles: {
        create: [
          { type: HandleType.Input, dataType: DataType.Text, required: true, label: null },
          { type: HandleType.Output, dataType: DataType.Text, label: null }
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
      processEnvironment: ProcessEnvironment.Browser,
      tokenPrice: 0.0,
      variableInputs: false,
      variableOutputs: false,
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
      processEnvironment: ProcessEnvironment.Server,
      tokenPrice: 0.0,
      variableInputs: false,
      variableOutputs: false,
      templateHandles: {
        create: [
          { type: HandleType.Output, dataType: DataType.Number, label: null }
        ]
      },
      defaultConfig: undefined,
    }
  });

  // GPTImage1: one text input, one image output
  await prisma.nodeTemplate.create({
    data: {
      type: NodeType.GPTImage1,
      displayName: 'GPT Image 1',
      description: 'A GPT image generation node',
      processEnvironment: ProcessEnvironment.Server,
      tokenPrice: 0.0,
      variableInputs: false,
      variableOutputs: false,
      templateHandles: {
        create: [
          { type: HandleType.Input, dataType: DataType.Text, required: true, label: null },
          { type: HandleType.Output, dataType: DataType.Image, label: null }
        ]
      },
      defaultConfig: {
        transparentBackground: true,
        quality: "auto",
        size: "1024x1024",
      },
    }
  });

  // LLM: prompt input required (Text), system prompt input optional (Text), Image input optional, one text output
  await prisma.nodeTemplate.create({
    data: {
      type: NodeType.LLM,
      displayName: 'LLM',
      description: 'An LLM node with prompt and optional inputs',
      processEnvironment: ProcessEnvironment.Server,
      tokenPrice: 0.0,
      variableInputs: false,
      variableOutputs: false,
      templateHandles: {
        create: [
          { type: HandleType.Input, dataType: DataType.Text, required: true, label: 'Prompt' },
          { type: HandleType.Input, dataType: DataType.Text, required: false, label: 'System Prompt' },
          { type: HandleType.Input, dataType: DataType.Image, required: false, label: 'Image' },
          { type: HandleType.Output, dataType: DataType.Text, label: null }
        ]
      },
      defaultConfig: {
        reasoning: {
          effort: "low",
        },
        model: "gpt-5",
      },
    }
  });
}