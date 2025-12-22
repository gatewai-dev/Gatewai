import { NodeType, ProcessEnvironment, DataType, PrismaClient } from "@gatewai/db";

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
      inputTypes: {
        create: []
      },
      outputTypes: {
        create: [
          { outputType: DataType.Text, label: null }
        ]
      }
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
      inputTypes: {
        create: [
          { inputType: DataType.File, required: true, label: 'File (video/image)' }
        ]
      },
      outputTypes: {
        create: []
      }
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
      inputTypes: {
        create: []
      },
      outputTypes: {
        create: [
          { outputType: DataType.File, label: null }
        ]
      }
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
      inputTypes: {
        create: [
          { inputType: DataType.File, required: true, label: null }
        ]
      },
      outputTypes: {
        create: []
      }
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
      inputTypes: {
        create: []
      },
      outputTypes: {
        create: [
          { outputType: DataType.Boolean, label: null }
        ]
      }
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
      inputTypes: {
        create: [
          { inputType: DataType.Text, required: true, label: null }
        ]
      },
      outputTypes: {
        create: [
          { outputType: DataType.Text, label: null }
        ]
      }
    }
  });

  // Resize: file input / file output (video/image), using File for both
  await prisma.nodeTemplate.create({
    data: {
      type: NodeType.Resize,
      displayName: 'Resize',
      description: 'A resize node for video/image files',
      processEnvironment: ProcessEnvironment.Server,
      tokenPrice: 0.0,
      variableInputs: false,
      variableOutputs: false,
      inputTypes: {
        create: [
          { inputType: DataType.File, required: true, label: null }
        ]
      },
      outputTypes: {
        create: [
          { outputType: DataType.File, label: null }
        ]
      }
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
      inputTypes: {
        create: [
          { inputType: DataType.Text, required: true, label: 'Initial Text' }
        ]
      },
      outputTypes: {
        create: [
          { outputType: DataType.Text, label: null }
        ]
      }
    }
  });

  // ThreeD: not specified, assuming text input for description, file output for 3D model
  await prisma.nodeTemplate.create({
    data: {
      type: NodeType.ThreeD,
      displayName: 'ThreeD',
      description: 'A 3D processing node',
      processEnvironment: ProcessEnvironment.Server,
      tokenPrice: 0.0,
      variableInputs: false,
      variableOutputs: false,
      inputTypes: {
        create: [
          { inputType: DataType.Text, required: true, label: null }
        ]
      },
      outputTypes: {
        create: [
          { outputType: DataType.File, label: null }
        ]
      }
    }
  });

  // Mask: not specified, assuming image input, mask output
  await prisma.nodeTemplate.create({
    data: {
      type: NodeType.Mask,
      displayName: 'Mask',
      description: 'A mask generation node',
      processEnvironment: ProcessEnvironment.Server,
      tokenPrice: 0.0,
      variableInputs: false,
      variableOutputs: false,
      inputTypes: {
        create: [
          { inputType: DataType.Image, required: true, label: null }
        ]
      },
      outputTypes: {
        create: [
          { outputType: DataType.Mask, label: null }
        ]
      }
    }
  });

  // Painter: image input, mask and image output
  await prisma.nodeTemplate.create({
    data: {
      type: NodeType.Painter,
      displayName: 'Painter',
      description: 'A painter node with image input and mask/image outputs',
      processEnvironment: ProcessEnvironment.Server,
      tokenPrice: 0.0,
      variableInputs: false,
      variableOutputs: false,
      inputTypes: {
        create: [
          { inputType: DataType.Image, required: true, label: null }
        ]
      },
      outputTypes: {
        create: [
          { outputType: DataType.Mask, label: null },
          { outputType: DataType.Image, label: null }
        ]
      }
    }
  });

  // Blur: image input, image output
  await prisma.nodeTemplate.create({
    data: {
      type: NodeType.Blur,
      displayName: 'Blur',
      description: 'A blur effect node',
      processEnvironment: ProcessEnvironment.Server,
      tokenPrice: 0.0,
      variableInputs: false,
      variableOutputs: false,
      inputTypes: {
        create: [
          { inputType: DataType.Image, required: true, label: null }
        ]
      },
      outputTypes: {
        create: [
          { outputType: DataType.Image, label: null }
        ]
      }
    }
  });

  // Compositor: multiple image / text inputs starts with single image, assuming variableInputs true, one image output
  await prisma.nodeTemplate.create({
    data: {
      type: NodeType.Compositor,
      displayName: 'Compositor',
      description: 'A compositor node with variable inputs starting with image',
      processEnvironment: ProcessEnvironment.Server,
      tokenPrice: 0.0,
      variableInputs: true,
      variableOutputs: false,
      inputTypes: {
        create: [
          { inputType: DataType.Image, required: true, label: 'Initial Image' }
        ]
      },
      outputTypes: {
        create: [
          { outputType: DataType.Image, label: null }
        ]
      }
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
      inputTypes: {
        create: [
          { inputType: DataType.Image, required: true, label: null }
        ]
      },
      outputTypes: {
        create: [
          { outputType: DataType.Text, label: null }
        ]
      }
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
      inputTypes: {
        create: [
          { inputType: DataType.Text, required: true, label: null }
        ]
      },
      outputTypes: {
        create: [
          { outputType: DataType.Text, label: null }
        ]
      }
    }
  });

  // Note: no input or output
  await prisma.nodeTemplate.create({
    data: {
      type: NodeType.Note,
      displayName: 'Note',
      description: 'A note node',
      processEnvironment: ProcessEnvironment.Browser,
      tokenPrice: 0.0,
      variableInputs: false,
      variableOutputs: false,
      inputTypes: {
        create: []
      },
      outputTypes: {
        create: []
      }
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
      inputTypes: {
        create: []
      },
      outputTypes: {
        create: [
          { outputType: DataType.Number, label: null }
        ]
      }
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
      inputTypes: {
        create: [
          { inputType: DataType.Text, required: true, label: null }
        ]
      },
      outputTypes: {
        create: [
          { outputType: DataType.Image, label: null }
        ]
      }
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
      inputTypes: {
        create: [
          { inputType: DataType.Text, required: true, label: 'Prompt' },
          { inputType: DataType.Text, required: false, label: 'System Prompt' },
          { inputType: DataType.Image, required: false, label: 'Image' }
        ]
      },
      outputTypes: {
        create: [
          { outputType: DataType.Text, label: null }
        ]
      }
    }
  });
}