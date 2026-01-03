import { DataType, HandleType, NodeType, type PrismaClient } from "./client";

export async function SEED_createNodeTemplates(prisma: PrismaClient) {
	// GENERATIVE
	await prisma.nodeTemplate.create({
		data: {
			type: NodeType.Agent,
			displayName: "AI Agent",
			category: "Generative",
			subcategory: "AI Models",
			description: "A multi-modal AI agent.",
			tokenPrice: 0.0,
			variableInputs: false,
			variableOutputs: false,
			isTerminalNode: true,
			isTransient: false,
			templateHandles: {
				create: [
					{
						type: HandleType.Input,
						dataTypes: [DataType.Text],
						label: "System Prompt",
						required: true,
					},
					{
						type: HandleType.Input,
						dataTypes: [DataType.Text],
						label: "Instructions",
						required: true,
					},
				],
			},
			defaultConfig: { maxTurns: 10, model: "anthropict/claude-opus-4.5" },
		},
	});

	await prisma.nodeTemplate.create({
		data: {
			type: NodeType.LLM,
			displayName: "LLM",
			category: "Generative",
			subcategory: "AI Models",
			description: "Run a LLM model",
			tokenPrice: 0.0,
			variableInputs: false,
			variableOutputs: false,
			isTerminalNode: true,
			isTransient: false,
			templateHandles: {
				create: [
					{
						type: HandleType.Input,
						dataTypes: [DataType.Text],
						required: true,
						label: "Prompt",
					},
					{
						type: HandleType.Input,
						dataTypes: [DataType.Text],
						required: false,
						label: "System Prompt",
					},
					{
						type: HandleType.Input,
						dataTypes: [DataType.Image],
						required: false,
						label: "Image",
					},
					{
						type: HandleType.Output,
						dataTypes: [DataType.Text],
						label: "Text",
					},
				],
			},
			defaultConfig: { model: "openai/gpt-5.2", temperature: 0 },
		},
	});

	await prisma.nodeTemplate.create({
		data: {
			type: NodeType.ImageGen,
			displayName: "Multimodal Image",
			category: "Generative",
			subcategory: "AI Models",
			description: "Generate images using text prompt and reference image(s)",
			tokenPrice: 0.0,
			variableInputs: false,
			variableOutputs: false,
			isTerminalNode: true,
			isTransient: false,
			templateHandles: {
				create: [
					{
						type: HandleType.Input,
						dataTypes: [DataType.Text],
						required: true,
						label: "Prompt",
					},
					{
						type: HandleType.Input,
						dataTypes: [DataType.Image],
						required: false,
						label: "Reference Image",
					},
					{
						type: HandleType.Output,
						dataTypes: [DataType.Image],
						label: "Image",
					},
				],
			},
			defaultConfig: { model: "google/gemini-3-pro-image" },
		},
	});

	// INPUT/OUTPUT
	const ioNodes = [
		{
			type: NodeType.Text,
			name: "Text",
			sub: "Data Entry",
			out: DataType.Text,
		},
		{
			type: NodeType.Number,
			name: "Number",
			sub: "Data Entry",
			out: DataType.Number,
		},
		{
			type: NodeType.Toggle,
			name: "Toggle",
			sub: "Data Entry",
			out: DataType.Boolean,
		},
		{ type: NodeType.File, name: "Import", sub: "Files", out: DataType.File },
	];

	for (const node of ioNodes) {
		await prisma.nodeTemplate.create({
			data: {
				type: node.type,
				displayName: node.name,
				category: "Input/Output",
				subcategory: node.sub,
				description: `A basic ${node.name.toLowerCase()} node`,
				tokenPrice: 0.0,
				variableInputs: false,
				variableOutputs: false,
				isTerminalNode: false,
				isTransient: false,
				templateHandles: {
					create: [
						{
							type: HandleType.Output,
							dataTypes: [node.out],
							label: node.name,
						},
					],
				},
			},
		});
	}

	await prisma.nodeTemplate.create({
		data: {
			type: NodeType.Export,
			displayName: "Export",
			category: "Input/Output",
			subcategory: "Files",
			description: "A UI download / API output node",
			tokenPrice: 0.0,
			variableInputs: false,
			variableOutputs: false,
			isTerminalNode: false,
			isTransient: true,
			templateHandles: {
				create: [
					{
						type: HandleType.Input,
						dataTypes: [
							DataType.Text,
							DataType.Image,
							DataType.Video,
							DataType.Audio,
							DataType.Mask,
						],
						required: true,
						label: "Input",
					},
				],
			},
		},
	});

	// PROCESSING
	const processingNodes = [
		{ type: NodeType.Resize, name: "Resize", sub: "Image Labelling" },
		{
			type: NodeType.Blur,
			name: "Blur",
			sub: "Effects",
			config: { blurAmount: 0 },
		},
		{
			type: NodeType.Modulate,
			name: "Modulate",
			sub: "Effects",
			config: { hue: 0, saturation: 1, lightness: 1, brightness: 1 },
		},
		{
			type: NodeType.Crop,
			name: "Crop",
			sub: "Image Labelling",
			config: {
				leftPercentage: 0,
				topPercentage: 0,
				widthPercentage: 100,
				heightPercentage: 100,
			},
		},
	];

	for (const node of processingNodes) {
		await prisma.nodeTemplate.create({
			data: {
				type: node.type,
				displayName: node.name,
				category: "Processing",
				subcategory: node.sub,
				description: `${node.name} node`,
				tokenPrice: 0.0,
				variableInputs: false,
				variableOutputs: false,
				isTerminalNode: false,
				isTransient: true,
				templateHandles: {
					create: [
						{
							type: HandleType.Input,
							dataTypes: [DataType.Image],
							required: true,
							label: "Image",
						},
						{
							type: HandleType.Output,
							dataTypes: [DataType.Image],
							label: "Result",
						},
					],
				},
				defaultConfig: node.config,
			},
		});
	}

	await prisma.nodeTemplate.create({
		data: {
			type: NodeType.Paint,
			displayName: "Paint",
			category: "Processing",
			subcategory: "Image Labelling",
			description: "Draw / Fill Mask on Image",
			tokenPrice: 0.0,
			variableInputs: false,
			variableOutputs: false,
			isTerminalNode: false,
			isTransient: true,
			templateHandles: {
				create: [
					{
						type: HandleType.Input,
						dataTypes: [DataType.Image],
						label: "Background Image",
					},
					{
						type: HandleType.Output,
						dataTypes: [DataType.Image],
						label: "Image",
					},
					{
						type: HandleType.Output,
						dataTypes: [DataType.Mask],
						label: "Mask",
					},
				],
			},
			defaultConfig: {
				width: 1024,
				height: 1024,
				maintainAspect: true,
				backgroundColor: "#000",
			},
		},
	});

	// LAYOUT / UTILS
	await prisma.nodeTemplate.create({
		data: {
			type: NodeType.Compositor,
			displayName: "Compositor",
			category: "Layout",
			subcategory: "Composition",
			description: "Compose an image using image or text",
			tokenPrice: 0.0,
			variableInputs: true,
			variableOutputs: false,
			isTerminalNode: false,
			isTransient: true,
			templateHandles: {
				create: [
					{
						type: HandleType.Input,
						dataTypes: [DataType.Image],
						required: true,
						label: "Image",
					},
					{
						type: HandleType.Output,
						dataTypes: [DataType.Image],
						label: "Output Image",
					},
				],
			},
			defaultConfig: { width: 1024, height: 1024 },
		},
	});

	await prisma.nodeTemplate.create({
		data: {
			type: NodeType.Preview,
			displayName: "Preview",
			category: "Layout",
			subcategory: "Tools",
			description: "Preview your media",
			tokenPrice: 0.0,
			variableInputs: false,
			variableOutputs: false,
			isTerminalNode: false,
			isTransient: true,
			templateHandles: {
				create: [
					{
						type: HandleType.Input,
						dataTypes: [
							DataType.Video,
							DataType.Image,
							DataType.Text,
							DataType.Audio,
						],
						required: true,
						label: "Input",
					},
				],
			},
		},
	});

	await prisma.nodeTemplate.create({
		data: {
			type: NodeType.Note,
			displayName: "Sticky Note",
			category: "Layout",
			subcategory: "Tools",
			description: "A sticky note",
			tokenPrice: 0.0,
			variableInputs: false,
			variableOutputs: false,
			isTerminalNode: false,
			isTransient: false,
			templateHandles: { create: [] },
			defaultConfig: { backgroundColor: "#ffff88", textColor: "#000000" },
		},
	});
}
