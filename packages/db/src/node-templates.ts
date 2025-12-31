import { DataType, HandleType, NodeType, type PrismaClient } from "./client";

export async function SEED_createNodeTemplates(prisma: PrismaClient) {
	await prisma.nodeTemplate.create({
		data: {
			type: NodeType.Agent,
			displayName: "AI Agent",
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
			defaultConfig: {
				maxTurns: 10,
				model: "anthropict/claude-opus-4.5",
			},
		},
	});
	// Text: no input, single output Text
	await prisma.nodeTemplate.create({
		data: {
			type: NodeType.Text,
			displayName: "Text",
			description: "A basic text node",
			tokenPrice: 0.0,
			variableInputs: false,
			variableOutputs: false,
			isTerminalNode: false,
			isTransient: false,
			templateHandles: {
				create: [
					{
						type: HandleType.Output,
						dataTypes: [DataType.Text],
						label: "Text",
					},
				],
			},
			defaultConfig: undefined,
		},
	});

	await prisma.nodeTemplate.create({
		data: {
			type: NodeType.Preview,
			displayName: "Preview",
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
						dataTypes: [DataType.File],
						required: true,
						label: "File (video/image)",
					},
				],
			},
			defaultConfig: undefined,
		},
	});

	// File: no input, one output File
	await prisma.nodeTemplate.create({
		data: {
			type: NodeType.File,
			displayName: "Import",
			description: "Upload your media",
			tokenPrice: 0.0,
			variableInputs: false,
			variableOutputs: false,
			isTerminalNode: false,
			isTransient: false,
			templateHandles: {
				create: [
					{
						type: HandleType.Output,
						dataTypes: [DataType.File],
						label: "File",
					},
				],
			},
			defaultConfig: undefined,
		},
	});

	// Export: one input File, no output
	await prisma.nodeTemplate.create({
		data: {
			type: NodeType.Export,
			displayName: "Export",
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
						dataTypes: [DataType.File],
						required: true,
						label: "File",
					},
				],
			},
			defaultConfig: undefined,
		},
	});

	// Toggle: no input, one output Boolean
	await prisma.nodeTemplate.create({
		data: {
			type: NodeType.Toggle,
			displayName: "Toggle",
			description: "A toggle for True/False data type",
			tokenPrice: 0.0,
			variableInputs: false,
			variableOutputs: false,
			isTerminalNode: false,
			isTransient: false,
			templateHandles: {
				create: [
					{
						type: HandleType.Output,
						dataTypes: [DataType.Boolean],
						label: "Yes/No",
					},
				],
			},
			defaultConfig: undefined,
		},
	});

	await prisma.nodeTemplate.create({
		data: {
			type: NodeType.Resize,
			displayName: "Resize",
			description: "Resize media",
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
			defaultConfig: undefined,
		},
	});

	// Paint: image input, mask and image output
	await prisma.nodeTemplate.create({
		data: {
			type: NodeType.Paint,
			displayName: "Paint",
			description: "Draw on media",
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

	// Blur: image input, image output
	await prisma.nodeTemplate.create({
		data: {
			type: NodeType.Blur,
			displayName: "Blur",
			description: "Apply blur to media",
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
						label: "Blurred Image",
					},
				],
			},
			defaultConfig: {
				blurAmount: 0,
			},
		},
	});

	await prisma.nodeTemplate.create({
		data: {
			type: NodeType.Modulate,
			displayName: "Modulate",
			description: "Apply Modulate adjustments to a media",
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
			defaultConfig: {
				hue: 0,
				saturation: 0,
				lightness: 0,
				brightness: 0,
			},
		},
	});

	await prisma.nodeTemplate.create({
		data: {
			type: NodeType.Crop,
			displayName: "Crop",
			description: "Crop media",
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
			defaultConfig: {
				leftPercentage: 0,
				topPercentage: 0,
				widthPercentage: 100,
				heightPercentage: 100,
			},
		},
	});

	// Compositor: multiple image / text inputs starts with single image, assuming variableInputs true, one image output
	await prisma.nodeTemplate.create({
		data: {
			type: NodeType.Compositor,
			displayName: "Compositor",
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
			defaultConfig: {
				canvasWidth: 1024,
				canvasHeight: 1024,
			},
		},
	});

	// Note: no input or output
	await prisma.nodeTemplate.create({
		data: {
			type: NodeType.Note,
			displayName: "Sticky Note",
			description: "A sticky note",
			tokenPrice: 0.0,
			variableInputs: false,
			variableOutputs: false,
			isTerminalNode: false,
			isTransient: false,
			templateHandles: {
				create: [],
			},
			defaultConfig: {
				backgroundColor: "#ffff88",
				textColor: "#000000",
			},
		},
	});

	// Number: no input, one number output
	await prisma.nodeTemplate.create({
		data: {
			type: NodeType.Number,
			displayName: "Number",
			description: "A number input node",
			tokenPrice: 0.0,
			variableInputs: false,
			variableOutputs: false,
			isTerminalNode: false,
			isTransient: false,
			templateHandles: {
				create: [
					{
						type: HandleType.Output,
						dataTypes: [DataType.Number],
						label: "Number",
					},
				],
			},
			defaultConfig: undefined,
		},
	});

	// ImageGen: one text input, one image output
	await prisma.nodeTemplate.create({
		data: {
			type: NodeType.ImageGen,
			displayName: "Multimodal Image",
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
			defaultConfig: {
				model: "google/gemini-3-pro-image",
			},
		},
	});

	// LLM: prompt input required (Text), system prompt input optional (Text), Image input optional, one text output
	await prisma.nodeTemplate.create({
		data: {
			type: NodeType.LLM,
			displayName: "LLM",
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
			defaultConfig: {
				model: "openai/gpt-5.2",
				temperature: 0,
			},
		},
	});
}
