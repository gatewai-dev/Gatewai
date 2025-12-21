import { PrismaClient, NodeType } from '@gatewai/db';

const prisma = new PrismaClient();

async function main() {
  const templates = [
    { type: NodeType.Prompt, displayName: 'Prompt', description: 'Basic text node', variableInputs: false, variableOutputs: false, inputTypes: [], outputTypes: [{ outputType: NodeType.Prompt }] },
    { type: NodeType.Image, displayName: 'Image', description: 'Image asset node', variableInputs: false, variableOutputs: false, inputTypes: [], outputTypes: [{ outputType: NodeType.Image }] },
    { type: NodeType.Video, displayName: 'Video', description: 'Video asset node', variableInputs: false, variableOutputs: false, inputTypes: [], outputTypes: [{ outputType: NodeType.Video }] },
    { type: NodeType.Audio, displayName: 'Audio', description: 'Audio asset node', variableInputs: false, variableOutputs: false, inputTypes: [], outputTypes: [{ outputType: NodeType.Audio }] },
    { type: NodeType.File, displayName: 'File', description: 'Generic file node', variableInputs: false, variableOutputs: false, inputTypes: [], outputTypes: [{ outputType: NodeType.File }] },
    { type: NodeType.Link, displayName: 'Link', description: 'URL link node', variableInputs: false, variableOutputs: false, inputTypes: [], outputTypes: [{ outputType: NodeType.Link }] },
    { type: NodeType.Group, displayName: 'Group', description: 'Container for nodes', variableInputs: true, variableOutputs: true, inputTypes: [{ inputType: NodeType.Array }], outputTypes: [{ outputType: NodeType.Array }] },
    { type: NodeType.Agent, displayName: 'Agent', description: 'AI agent node', variableInputs: true, variableOutputs: false, inputTypes: [{ inputType: NodeType.Prompt }], outputTypes: [{ outputType: NodeType.Prompt }] },
    { type: NodeType.ThreeD, displayName: '3D', description: '3D model node', variableInputs: false, variableOutputs: false, inputTypes: [], outputTypes: [{ outputType: NodeType.ThreeD }] },
    { type: NodeType.Mask, displayName: 'Mask', description: 'Masking node', variableInputs: false, variableOutputs: false, inputTypes: [{ inputType: NodeType.Image }], outputTypes: [{ outputType: NodeType.Image }] },
    { type: NodeType.Painter, displayName: 'Painter', description: 'Painting/editing node', variableInputs: false, variableOutputs: false, inputTypes: [{ inputType: NodeType.Image }], outputTypes: [{ outputType: NodeType.Image }] },
    { type: NodeType.Blur, displayName: 'Blur', description: 'Blur effect node', variableInputs: false, variableOutputs: false, inputTypes: [{ inputType: NodeType.Image }], outputTypes: [{ outputType: NodeType.Image }] },
    { type: NodeType.Compositor, displayName: 'Compositor', description: 'Compositing node', variableInputs: true, variableOutputs: false, inputTypes: [{ inputType: NodeType.Image }], outputTypes: [{ outputType: NodeType.Image }] },
    { type: NodeType.Describer, displayName: 'Describer', description: 'Description generator', variableInputs: false, variableOutputs: false, inputTypes: [{ inputType: NodeType.Image }], outputTypes: [{ outputType: NodeType.Prompt }] },
    { type: NodeType.Router, displayName: 'Router', description: 'Routing node', variableInputs: false, variableOutputs: true, inputTypes: [{ inputType: NodeType.Array }], outputTypes: [{ outputType: NodeType.Array }] },
    { type: NodeType.Array, displayName: 'Array', description: 'Array/container node', variableInputs: true, variableOutputs: true, inputTypes: [{ inputType: NodeType.Array }], outputTypes: [{ outputType: NodeType.Array }] },
  ];

  for (const t of templates) {
    await prisma.nodeTemplate.upsert({
      where: { type: t.type },
      update: {},
      create: {
        type: t.type,
        displayName: t.displayName,
        description: t.description,
        variableInputs: t.variableInputs,
        variableOutputs: t.variableOutputs,
        inputTypes: { create: t.inputTypes },
        outputTypes: { create: t.outputTypes },
      },
    });
  }
}

main()
  .catch((e) => console.error(e))
  .finally(async () => await prisma.$disconnect());