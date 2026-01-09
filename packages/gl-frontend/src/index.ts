import { type GLContext, WebGLImageProcessor } from "@yodes/gl";

const createGLContext = (width: number, height: number): GLContext => {
	const canvas = document.createElement("canvas");
	canvas.width = width;
	canvas.height = height;
	const gl = canvas.getContext("webgl", {
		premultipliedAlpha: false,
		alpha: true,
		preserveDrawingBuffer: true,
	});
	if (!gl) throw new Error("WebGL not supported");
	return {
		gl,
		canvas,
		id: Math.random().toString(36).substring(2, 9),
	};
};

const loadImageBitmap = async (url: string): Promise<ImageBitmap> => {
	const response = await fetch(url);
	const blob = await response.blob();
	return createImageBitmap(blob);
};

const glFrontendProcessor = new WebGLImageProcessor(
	createGLContext,
	loadImageBitmap,
);

export { glFrontendProcessor };
