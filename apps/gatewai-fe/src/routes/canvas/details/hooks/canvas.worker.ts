// canvas.worker.ts

type WorkerMessage =
	| { type: "INIT_CANVAS"; payload: { canvas: OffscreenCanvas } }
	| {
			type: "DRAW_IMAGE";
			payload: {
				imageUrl: string;
				zoom: number;
				canvasWidth: number;
				dpr: number;
			};
	  }
	| { type: "CLEAR" };

let canvas: OffscreenCanvas | null = null;
let gl: WebGLRenderingContext | null = null;
let program: WebGLProgram | null = null;

// Helper to create shaders
function createShader(gl: WebGLRenderingContext, type: number, source: string) {
	const shader = gl.createShader(type);
	if (!shader) {
		throw new Error("Could not create shader");
	}
	gl.shaderSource(shader, source);
	gl.compileShader(shader);
	return shader;
}

const vsSource = `
    attribute vec2 a_position;
    attribute vec2 a_texCoord;
    varying vec2 v_texCoord;
    void main() {
        gl_Position = vec4(a_position, 0, 1);
        v_texCoord = a_texCoord;
    }
`;

const fsSource = `
    precision mediump float;
    uniform sampler2D u_image;
    varying vec2 v_texCoord;
    void main() {
        gl_FragColor = texture2D(u_image, v_texCoord);
    }
`;

self.onmessage = async (e: MessageEvent<WorkerMessage>) => {
	const { type } = e.data;

	switch (type) {
		case "INIT_CANVAS": {
			canvas = e.data.payload.canvas;
			gl = canvas.getContext("webgl", { antialias: true, alpha: true });
			if (!gl) return;

			// Initialize Shaders and Program
			const vs = createShader(gl, gl.VERTEX_SHADER, vsSource);
			const fs = createShader(gl, gl.FRAGMENT_SHADER, fsSource);
			program = gl.createProgram();
			gl.attachShader(program, vs);
			gl.attachShader(program, fs);
			gl.linkProgram(program);
			break;
		}
		case "DRAW_IMAGE": {
			if (!gl || !canvas || !program) return;
			const { imageUrl, canvasWidth, zoom, dpr } = e.data.payload;

			try {
				const response = await fetch(imageUrl);
				const blob = await response.blob();
				const bitmap = await createImageBitmap(blob);

				const aspectRatio = bitmap.height / bitmap.width;
				const cssHeight = canvasWidth * aspectRatio;

				// Set internal resolution
				canvas.width = canvasWidth * zoom * dpr;
				canvas.height = cssHeight * zoom * dpr;

				gl.viewport(0, 0, canvas.width, canvas.height);
				gl.clearColor(0, 0, 0, 0);
				gl.clear(gl.COLOR_BUFFER_BIT);

				// biome-ignore lint/correctness/useHookAtTopLevel: Not a hook
				gl.useProgram(program);

				// Setup Buffers (Rectangle for the image)
				const positionBuffer = gl.createBuffer();
				gl.bindBuffer(gl.ARRAY_BUFFER, positionBuffer);
				gl.bufferData(
					gl.ARRAY_BUFFER,
					new Float32Array([-1, -1, 1, -1, -1, 1, -1, 1, 1, -1, 1, 1]),
					gl.STATIC_DRAW,
				);

				const texCoordBuffer = gl.createBuffer();
				gl.bindBuffer(gl.ARRAY_BUFFER, texCoordBuffer);
				gl.bufferData(
					gl.ARRAY_BUFFER,
					new Float32Array([0, 1, 1, 1, 0, 0, 0, 0, 1, 1, 1, 0]),
					gl.STATIC_DRAW,
				);

				// Create and bind Texture
				const texture = gl.createTexture();
				gl.bindTexture(gl.TEXTURE_2D, texture);

				// Essential: Upload the bitmap to GPU
				gl.texImage2D(
					gl.TEXTURE_2D,
					0,
					gl.RGBA,
					gl.RGBA,
					gl.UNSIGNED_BYTE,
					bitmap,
				);

				// Texture parameters
				gl.texParameteri(gl.TEXTURE_2D, gl.TEXTURE_WRAP_S, gl.CLAMP_TO_EDGE);
				gl.texParameteri(gl.TEXTURE_2D, gl.TEXTURE_WRAP_T, gl.CLAMP_TO_EDGE);
				gl.texParameteri(gl.TEXTURE_2D, gl.TEXTURE_MIN_FILTER, gl.LINEAR);

				// Final draw call
				const posLoc = gl.getAttribLocation(program, "a_position");
				gl.enableVertexAttribArray(posLoc);
				gl.bindBuffer(gl.ARRAY_BUFFER, positionBuffer);
				gl.vertexAttribPointer(posLoc, 2, gl.FLOAT, false, 0, 0);

				const texLoc = gl.getAttribLocation(program, "a_texCoord");
				gl.enableVertexAttribArray(texLoc);
				gl.bindBuffer(gl.ARRAY_BUFFER, texCoordBuffer);
				gl.vertexAttribPointer(texLoc, 2, gl.FLOAT, false, 0, 0);

				gl.drawArrays(gl.TRIANGLES, 0, 6);

				self.postMessage({
					type: "CANVAS_INITIALIZED",
					payload: { renderHeight: cssHeight },
				});

				bitmap.close();
			} catch (err) {
				console.error("WebGL Draw Error:", err);
			}
			break;
		}
	}
};
