// Node.js / Bun environment - use headless-gl
import { type GLContext, WebGLImageProcessor } from "@yodes/gl";
import { Image } from "canvas";
import gl from "gl";

const createGLContext = (width: number, height: number): GLContext => {
	const glContext = gl(width, height, {
		preserveDrawingBuffer: true,
		premultipliedAlpha: false,
		alpha: true,
	});
	return {
		gl: glContext,
		canvas: null,
		id: Math.random().toString(36).substring(2, 9),
	};
};

const loadImageBitmap = async (url: string): Promise<Image> => {
	const img = new Image();

	if (url.startsWith("data:")) {
		// Data URL
		const base64 = url.split(",")[1];
		const buffer = Buffer.from(base64, "base64");
		img.src = buffer;
	} else {
		// Remote URL
		const response = await fetch(url);
		const arrayBuffer = await response.arrayBuffer();
		img.src = Buffer.from(arrayBuffer);
	}

	return img;
};

const glBackendProcessor = new WebGLImageProcessor(
	createGLContext,
	loadImageBitmap,
);

export { glBackendProcessor };
