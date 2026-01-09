// ============================================================================
// Types & Interfaces
// ============================================================================
import type { Canvas } from "canvas";
export interface FileData {
	processData?: {
		dataUrl?: string;
	};
	entity?: {
		signedUrl?: string;
		mimeType?: string;
	};
}

export interface ModulateNodeConfig {
	hue?: number;
	saturation?: number;
	lightness?: number;
	brightness?: number;
}

export interface PaintNodeConfig {
	width: number;
	height: number;
	backgroundColor?: number;
}

export interface ImageResult {
	dataUrl: string;
	width: number;
	height: number;
}

export interface GLContext {
	gl: WebGLRenderingContext;
	canvas: Canvas | HTMLCanvasElement;
	id: string;
}

// ============================================================================
// Shader Programs
// ============================================================================

const VERTEX_SHADER = `
    attribute vec2 a_position;
    attribute vec2 a_texCoord;
    varying vec2 v_texCoord;
    uniform vec2 u_resolution;
    
    void main() {
        vec2 pos = (a_position / u_resolution) * 2.0 - 1.0;
        pos.y = -pos.y;
        gl_Position = vec4(pos, 0.0, 1.0);
        v_texCoord = a_texCoord;
    }
`;

// Oklab color space conversion shaders
const OKLAB_FUNCTIONS = `
    vec3 linear_srgb_to_oklab(vec3 c) {
        float l = 0.4122214708 * c.r + 0.5363325363 * c.g + 0.0514459929 * c.b;
        float m = 0.2119034982 * c.r + 0.6806995451 * c.g + 0.1073969566 * c.b;
        float s = 0.0883024619 * c.r + 0.2817188376 * c.g + 0.6299787005 * c.b;

        float l_ = pow(l, 1.0/3.0);
        float m_ = pow(m, 1.0/3.0);
        float s_ = pow(s, 1.0/3.0);

        return vec3(
            0.2104542553 * l_ + 0.7936177850 * m_ - 0.0040720468 * s_,
            1.9779984951 * l_ - 2.4285922050 * m_ + 0.4505937099 * s_,
            0.0259040371 * l_ + 0.7827717662 * m_ - 0.8086757660 * s_
        );
    }

    vec3 oklab_to_linear_srgb(vec3 c) {
        float l_ = c.x + 0.3963377774 * c.y + 0.2158037573 * c.z;
        float m_ = c.x - 0.1055613458 * c.y - 0.0638541728 * c.z;
        float s_ = c.x - 0.0894841775 * c.y - 1.2914855480 * c.z;

        float l = l_ * l_ * l_;
        float m = m_ * m_ * m_;
        float s = s_ * s_ * s_;

        return vec3(
            +4.0767416621 * l - 3.3077115913 * m + 0.2309699292 * s,
            -1.2684380046 * l + 2.6097574011 * m - 0.3413193965 * s,
            -0.0041960863 * l - 0.7034186147 * m + 1.7076147010 * s
        );
    }

    vec3 rgb_to_hsl(vec3 color) {
        float maxC = max(max(color.r, color.g), color.b);
        float minC = min(min(color.r, color.g), color.b);
        float delta = maxC - minC;
        
        float h = 0.0;
        float s = 0.0;
        float l = (maxC + minC) / 2.0;
        
        if (delta > 0.0001) {
            s = l < 0.5 ? delta / (maxC + minC) : delta / (2.0 - maxC - minC);
            
            if (color.r >= maxC) {
                h = (color.g - color.b) / delta;
            } else if (color.g >= maxC) {
                h = 2.0 + (color.b - color.r) / delta;
            } else {
                h = 4.0 + (color.r - color.g) / delta;
            }
            h /= 6.0;
            if (h < 0.0) h += 1.0;
        }
        
        return vec3(h, s, l);
    }

    vec3 hsl_to_rgb(vec3 hsl) {
        float h = hsl.x;
        float s = hsl.y;
        float l = hsl.z;
        
        float c = (1.0 - abs(2.0 * l - 1.0)) * s;
        float x = c * (1.0 - abs(mod(h * 6.0, 2.0) - 1.0));
        float m = l - c / 2.0;
        
        vec3 rgb;
        if (h < 1.0/6.0) {
            rgb = vec3(c, x, 0.0);
        } else if (h < 2.0/6.0) {
            rgb = vec3(x, c, 0.0);
        } else if (h < 3.0/6.0) {
            rgb = vec3(0.0, c, x);
        } else if (h < 4.0/6.0) {
            rgb = vec3(0.0, x, c);
        } else if (h < 5.0/6.0) {
            rgb = vec3(x, 0.0, c);
        } else {
            rgb = vec3(c, 0.0, x);
        }
        
        return rgb + m;
    }
`;

const MODULATE_FRAGMENT_SHADER = `
    precision highp float;
    varying vec2 v_texCoord;
    uniform sampler2D u_texture;
    uniform float u_hue;
    uniform float u_saturation;
    uniform float u_lightness;
    uniform float u_brightness;
    
    ${OKLAB_FUNCTIONS}
    
    void main() {
        vec4 color = texture2D(u_texture, v_texCoord);
        
        if (color.a < 0.001) {
            gl_FragColor = color;
            return;
        }
        
        vec3 rgb = color.rgb;
        
        // Apply brightness in RGB space
        if (abs(u_brightness - 1.0) > 0.001) {
            rgb *= u_brightness;
        }
        
        // Apply hue shift in HSL space
        if (abs(u_hue) > 0.1) {
            vec3 hsl = rgb_to_hsl(rgb);
            hsl.x = mod(hsl.x + u_hue / 360.0, 1.0);
            rgb = hsl_to_rgb(hsl);
        }
        
        // Apply saturation in HSL space
        if (abs(u_saturation - 1.0) > 0.001) {
            vec3 hsl = rgb_to_hsl(rgb);
            hsl.y *= u_saturation;
            hsl.y = clamp(hsl.y, 0.0, 1.0);
            rgb = hsl_to_rgb(hsl);
        }
        
        // Apply lightness in Oklab space
        if (abs(u_lightness - 1.0) > 0.001) {
            vec3 oklab = linear_srgb_to_oklab(rgb);
            oklab.x *= u_lightness;
            oklab.x = clamp(oklab.x, 0.0, 1.0);
            rgb = oklab_to_linear_srgb(oklab);
        }
        
        rgb = clamp(rgb, 0.0, 1.0);
        gl_FragColor = vec4(rgb, color.a);
    }
`;

const BLUR_FRAGMENT_SHADER = `
    precision highp float;
    varying vec2 v_texCoord;
    uniform sampler2D u_texture;
    uniform vec2 u_resolution;
    uniform float u_blurSize;
    uniform vec2 u_direction;
    
    void main() {
        vec2 texelSize = 1.0 / u_resolution;
        vec4 color = vec4(0.0);
        float total = 0.0;
        
        float blur = u_blurSize;
        int samples = int(ceil(blur * 3.0));
        
        for (int i = -32; i <= 32; i++) {
            if (abs(float(i)) > blur * 3.0) continue;
            
            float offset = float(i);
            float weight = exp(-0.5 * pow(offset / blur, 2.0));
            vec2 sampleCoord = v_texCoord + offset * texelSize * u_direction;
            
            color += texture2D(u_texture, sampleCoord) * weight;
            total += weight;
        }
        
        gl_FragColor = color / total;
    }
`;

const SIMPLE_FRAGMENT_SHADER = `
    precision highp float;
    varying vec2 v_texCoord;
    uniform sampler2D u_texture;
    
    void main() {
        gl_FragColor = texture2D(u_texture, v_texCoord);
    }
`;

const MASK_FRAGMENT_SHADER = `
    precision highp float;
    varying vec2 v_texCoord;
    uniform sampler2D u_baseTexture;
    uniform sampler2D u_maskTexture;
    uniform bool u_hasBase;
    
    void main() {
        vec4 maskColor = texture2D(u_maskTexture, v_texCoord);
        
        if (u_hasBase) {
            vec4 baseColor = texture2D(u_baseTexture, v_texCoord);
            // Blend base with mask on top
            gl_FragColor = mix(baseColor, maskColor, maskColor.a);
        } else {
            gl_FragColor = maskColor;
        }
    }
`;

// ============================================================================
// WebGL Utilities
// ============================================================================

function compileShader(
	gl: WebGLRenderingContext,
	source: string,
	type: number,
): WebGLShader {
	const shader = gl.createShader(type);
	if (!shader) throw new Error("Failed to create shader");

	gl.shaderSource(shader, source);
	gl.compileShader(shader);

	if (!gl.getShaderParameter(shader, gl.COMPILE_STATUS)) {
		const info = gl.getShaderInfoLog(shader);
		gl.deleteShader(shader);
		throw new Error(`Shader compilation failed: ${info}`);
	}

	return shader;
}

function createProgram(
	gl: WebGLRenderingContext,
	vertexSource: string,
	fragmentSource: string,
): WebGLProgram {
	const vertexShader = compileShader(gl, vertexSource, gl.VERTEX_SHADER);
	const fragmentShader = compileShader(gl, fragmentSource, gl.FRAGMENT_SHADER);

	const program = gl.createProgram();
	if (!program) throw new Error("Failed to create program");

	gl.attachShader(program, vertexShader);
	gl.attachShader(program, fragmentShader);
	gl.linkProgram(program);

	if (!gl.getProgramParameter(program, gl.LINK_STATUS)) {
		const info = gl.getProgramInfoLog(program);
		gl.deleteProgram(program);
		throw new Error(`Program linking failed: ${info}`);
	}

	gl.deleteShader(vertexShader);
	gl.deleteShader(fragmentShader);

	return program;
}

function createTexture(
	gl: WebGLRenderingContext,
	image: any,
	width?: number,
	height?: number,
): WebGLTexture {
	const texture = gl.createTexture();
	if (!texture) throw new Error("Failed to create texture");

	gl.bindTexture(gl.TEXTURE_2D, texture);
	gl.texParameteri(gl.TEXTURE_2D, gl.TEXTURE_WRAP_S, gl.CLAMP_TO_EDGE);
	gl.texParameteri(gl.TEXTURE_2D, gl.TEXTURE_WRAP_T, gl.CLAMP_TO_EDGE);
	gl.texParameteri(gl.TEXTURE_2D, gl.TEXTURE_MIN_FILTER, gl.LINEAR);
	gl.texParameteri(gl.TEXTURE_2D, gl.TEXTURE_MAG_FILTER, gl.LINEAR);

	if (image) {
		gl.texImage2D(gl.TEXTURE_2D, 0, gl.RGBA, gl.RGBA, gl.UNSIGNED_BYTE, image);
	} else if (width && height) {
		gl.texImage2D(
			gl.TEXTURE_2D,
			0,
			gl.RGBA,
			width,
			height,
			0,
			gl.RGBA,
			gl.UNSIGNED_BYTE,
			null,
		);
	}

	return texture;
}

function createFramebuffer(
	gl: WebGLRenderingContext,
	texture: WebGLTexture,
): WebGLFramebuffer {
	const framebuffer = gl.createFramebuffer();
	if (!framebuffer) throw new Error("Failed to create framebuffer");

	gl.bindFramebuffer(gl.FRAMEBUFFER, framebuffer);
	gl.framebufferTexture2D(
		gl.FRAMEBUFFER,
		gl.COLOR_ATTACHMENT0,
		gl.TEXTURE_2D,
		texture,
		0,
	);

	const status = gl.checkFramebufferStatus(gl.FRAMEBUFFER);
	if (status !== gl.FRAMEBUFFER_COMPLETE) {
		throw new Error(`Framebuffer incomplete: ${status}`);
	}

	return framebuffer;
}

function setupQuad(gl: WebGLRenderingContext, program: WebGLProgram) {
	const positionBuffer = gl.createBuffer();
	gl.bindBuffer(gl.ARRAY_BUFFER, positionBuffer);
	const positions = new Float32Array([0, 0, 1, 0, 0, 1, 0, 1, 1, 0, 1, 1]);
	gl.bufferData(gl.ARRAY_BUFFER, positions, gl.STATIC_DRAW);

	const positionLoc = gl.getAttribLocation(program, "a_position");
	gl.enableVertexAttribArray(positionLoc);
	gl.vertexAttribPointer(positionLoc, 2, gl.FLOAT, false, 0, 0);

	const texCoordBuffer = gl.createBuffer();
	gl.bindBuffer(gl.ARRAY_BUFFER, texCoordBuffer);
	const texCoords = new Float32Array([0, 0, 1, 0, 0, 1, 0, 1, 1, 0, 1, 1]);
	gl.bufferData(gl.ARRAY_BUFFER, texCoords, gl.STATIC_DRAW);

	const texCoordLoc = gl.getAttribLocation(program, "a_texCoord");
	gl.enableVertexAttribArray(texCoordLoc);
	gl.vertexAttribPointer(texCoordLoc, 2, gl.FLOAT, false, 0, 0);
}

function extractDataURL(
	gl: WebGLRenderingContext,
	width: number,
	height: number,
): string {
	const pixels = new Uint8Array(width * height * 4);
	gl.readPixels(0, 0, width, height, gl.RGBA, gl.UNSIGNED_BYTE, pixels);

	// Flip vertically
	const flipped = new Uint8Array(width * height * 4);
	for (let y = 0; y < height; y++) {
		for (let x = 0; x < width; x++) {
			const srcIdx = (y * width + x) * 4;
			const dstIdx = ((height - 1 - y) * width + x) * 4;
			flipped[dstIdx] = pixels[srcIdx];
			flipped[dstIdx + 1] = pixels[srcIdx + 1];
			flipped[dstIdx + 2] = pixels[srcIdx + 2];
			flipped[dstIdx + 3] = pixels[srcIdx + 3];
		}
	}

	if (isNode) {
		const { createCanvas } = require("canvas");
		const canvas = createCanvas(width, height);
		const ctx = canvas.getContext("2d");
		const imageData = ctx.createImageData(width, height);
		imageData.data.set(flipped);
		ctx.putImageData(imageData, 0, 0);
		return canvas.toDataURL("image/png");
	} else {
		const canvas = document.createElement("canvas");
		canvas.width = width;
		canvas.height = height;
		const ctx = canvas.getContext("2d")!;
		const imageData = ctx.createImageData(width, height);
		imageData.data.set(flipped);
		ctx.putImageData(imageData, 0, 0);
		return canvas.toDataURL("image/png");
	}
}

// ============================================================================
// Resource Pool
// ============================================================================

class GLContextPool {
	private pool: GLContext[] = [];
	private inUse = new Set<string>();
	private maxSize = 4;
	private minSize = 2;

	/**
	 * @param createGLContext GL context factory
	 */
	constructor(
		private createGLContext: (width: number, height: number) => GLContext,
	) {}

	async acquire(width: number, height: number): Promise<GLContext> {
		let context = this.pool.find((ctx) => !this.inUse.has(ctx.id));

		if (!context) {
			if (this.pool.length < this.maxSize) {
				context = this.createGLContext(width, height);
				this.pool.push(context);
			} else {
				await new Promise((resolve) => setTimeout(resolve, 50));
				return this.acquire(width, height);
			}
		}

		// Resize if needed
		if (context.canvas) {
			context.canvas.width = width;
			context.canvas.height = height;
		}
		context.gl.viewport(0, 0, width, height);

		this.inUse.add(context.id);
		return context;
	}

	release(context: GLContext) {
		this.inUse.delete(context.id);
	}

	destroy() {
		this.pool.forEach((ctx) => {
			const ext = ctx.gl.getExtension("WEBGL_lose_context");
			if (ext) ext.loseContext();
		});
		this.pool = [];
		this.inUse.clear();
	}
}

export class WebGLImageProcessor {
	private pool: GLContextPool;
	private concurrencyLimit = 3;
	private activeProcesses = 0;
	private queue: Array<() => void> = [];

	constructor(
		createGLContext: (width: number, height: number) => GLContext,
		private loadImageBitmap: (url: string) => Promise<ImageBitmap | any>,
	) {
		this.pool = new GLContextPool(createGLContext);
	}

	private async withLimit<T>(fn: () => Promise<T>): Promise<T> {
		while (this.activeProcesses >= this.concurrencyLimit) {
			await new Promise<void>((resolve) => this.queue.push(resolve));
		}

		this.activeProcesses++;
		try {
			return await fn();
		} finally {
			this.activeProcesses--;
			const next = this.queue.shift();
			if (next) next();
		}
	}

	async getImageBuffer(imageInput: FileData): Promise<Buffer> {
		if (imageInput.processData?.dataUrl) {
			const base64 =
				imageInput.processData.dataUrl.split(";base64,").pop() ?? "";
			return Buffer.from(base64, "base64");
		} else if (imageInput.entity?.signedUrl) {
			const response = await fetch(imageInput.entity.signedUrl);
			return Buffer.from(await response.arrayBuffer());
		} else {
			throw new Error("Invalid image input");
		}
	}

	getMimeType(imageInput: FileData): string {
		if (imageInput.entity?.mimeType) return imageInput.entity.mimeType;
		if (imageInput.processData?.dataUrl) {
			const match = imageInput.processData.dataUrl.match(
				/^data:(image\/[^;]+);base64,/,
			);
			if (match?.[1]) return match[1];
		}
		throw new Error("Could not determine mime type");
	}

	bufferToDataUrl(buffer: Buffer, mimeType: string): string {
		return `data:${mimeType};base64,${buffer.toString("base64")}`;
	}

	async getImageDimensions(
		imageUrl: string,
	): Promise<{ width: number; height: number }> {
		const image = await this.loadImageBitmap(imageUrl);
		return { width: image.width, height: image.height };
	}

	async processModulate(
		imageUrl: string,
		config: ModulateNodeConfig,
		signal?: AbortSignal,
	): Promise<ImageResult> {
		return this.withLimit(async () => {
			if (signal?.aborted) throw new DOMException("Cancelled", "AbortError");

			const image = await this.loadImageBitmap(imageUrl);
			if (signal?.aborted) throw new DOMException("Cancelled", "AbortError");

			const { width, height } = image;
			const context = await this.pool.acquire(width, height);

			try {
				const { gl } = context;
				const program = createProgram(
					gl,
					VERTEX_SHADER,
					MODULATE_FRAGMENT_SHADER,
				);

				gl.useProgram(program);
				setupQuad(gl, program);

				const texture = createTexture(gl, image);
				gl.activeTexture(gl.TEXTURE0);
				gl.bindTexture(gl.TEXTURE_2D, texture);
				gl.uniform1i(gl.getUniformLocation(program, "u_texture"), 0);

				gl.uniform2f(
					gl.getUniformLocation(program, "u_resolution"),
					width,
					height,
				);
				gl.uniform1f(gl.getUniformLocation(program, "u_hue"), config.hue ?? 0);
				gl.uniform1f(
					gl.getUniformLocation(program, "u_saturation"),
					config.saturation ?? 1,
				);
				gl.uniform1f(
					gl.getUniformLocation(program, "u_lightness"),
					config.lightness ?? 1,
				);
				gl.uniform1f(
					gl.getUniformLocation(program, "u_brightness"),
					config.brightness ?? 1,
				);

				gl.clearColor(0, 0, 0, 0);
				gl.clear(gl.COLOR_BUFFER_BIT);
				gl.drawArrays(gl.TRIANGLES, 0, 6);

				if (signal?.aborted) throw new DOMException("Cancelled", "AbortError");

				const dataUrl = extractDataURL(gl, width, height);

				gl.deleteTexture(texture);
				gl.deleteProgram(program);

				return { dataUrl, width, height };
			} finally {
				this.pool.release(context);
			}
		});
	}

	async processBlur(
		imageUrl: string,
		options: { blurSize: number },
		signal?: AbortSignal,
	): Promise<ImageResult> {
		return this.withLimit(async () => {
			if (signal?.aborted) throw new DOMException("Cancelled", "AbortError");

			const image = await this.loadImageBitmap(imageUrl);
			if (signal?.aborted) throw new DOMException("Cancelled", "AbortError");

			const { width, height } = image;
			const context = await this.pool.acquire(width, height);

			try {
				const { gl } = context;
				const program = createProgram(gl, VERTEX_SHADER, BLUR_FRAGMENT_SHADER);

				gl.useProgram(program);
				setupQuad(gl, program);

				const inputTexture = createTexture(gl, image);
				const tempTexture = createTexture(gl, null, width, height);
				const tempFramebuffer = createFramebuffer(gl, tempTexture);

				// Horizontal pass
				gl.bindFramebuffer(gl.FRAMEBUFFER, tempFramebuffer);
				gl.activeTexture(gl.TEXTURE0);
				gl.bindTexture(gl.TEXTURE_2D, inputTexture);
				gl.uniform1i(gl.getUniformLocation(program, "u_texture"), 0);
				gl.uniform2f(
					gl.getUniformLocation(program, "u_resolution"),
					width,
					height,
				);
				gl.uniform1f(
					gl.getUniformLocation(program, "u_blurSize"),
					options.blurSize,
				);
				gl.uniform2f(gl.getUniformLocation(program, "u_direction"), 1, 0);
				gl.drawArrays(gl.TRIANGLES, 0, 6);

				// Vertical pass
				gl.bindFramebuffer(gl.FRAMEBUFFER, null);
				gl.activeTexture(gl.TEXTURE0);
				gl.bindTexture(gl.TEXTURE_2D, tempTexture);
				gl.uniform2f(gl.getUniformLocation(program, "u_direction"), 0, 1);
				gl.clearColor(0, 0, 0, 0);
				gl.clear(gl.COLOR_BUFFER_BIT);
				gl.drawArrays(gl.TRIANGLES, 0, 6);

				if (signal?.aborted) throw new DOMException("Cancelled", "AbortError");

				const dataUrl = extractDataURL(gl, width, height);

				gl.deleteTexture(inputTexture);
				gl.deleteTexture(tempTexture);
				gl.deleteFramebuffer(tempFramebuffer);
				gl.deleteProgram(program);

				return { dataUrl, width, height };
			} finally {
				this.pool.release(context);
			}
		});
	}

	async processResize(
		imageUrl: string,
		options: { width?: number; height?: number },
		signal?: AbortSignal,
	): Promise<ImageResult> {
		return this.withLimit(async () => {
			if (signal?.aborted) throw new DOMException("Cancelled", "AbortError");

			const image = await this.loadImageBitmap(imageUrl);
			if (signal?.aborted) throw new DOMException("Cancelled", "AbortError");

			const targetWidth = options.width ?? image.width;
			const targetHeight = options.height ?? image.height;

			const context = await this.pool.acquire(targetWidth, targetHeight);

			try {
				const { gl } = context;
				const program = createProgram(
					gl,
					VERTEX_SHADER,
					SIMPLE_FRAGMENT_SHADER,
				);

				gl.useProgram(program);
				setupQuad(gl, program);

				const texture = createTexture(gl, image);
				gl.activeTexture(gl.TEXTURE0);
				gl.bindTexture(gl.TEXTURE_2D, texture);
				gl.uniform1i(gl.getUniformLocation(program, "u_texture"), 0);
				gl.uniform2f(
					gl.getUniformLocation(program, "u_resolution"),
					targetWidth,
					targetHeight,
				);

				gl.clearColor(0, 0, 0, 0);
				gl.clear(gl.COLOR_BUFFER_BIT);
				gl.drawArrays(gl.TRIANGLES, 0, 6);

				if (signal?.aborted) throw new DOMException("Cancelled", "AbortError");

				const dataUrl = extractDataURL(gl, targetWidth, targetHeight);

				gl.deleteTexture(texture);
				gl.deleteProgram(program);

				return { dataUrl, width: targetWidth, height: targetHeight };
			} finally {
				this.pool.release(context);
			}
		});
	}

	async processCrop(
		imageUrl: string,
		options: {
			leftPercentage: number;
			topPercentage: number;
			widthPercentage: number;
			heightPercentage: number;
		},
		signal?: AbortSignal,
	): Promise<ImageResult> {
		return this.withLimit(async () => {
			if (signal?.aborted) throw new DOMException("Cancelled", "AbortError");

			const image = await this.loadImageBitmap(imageUrl);
			if (signal?.aborted) throw new DOMException("Cancelled", "AbortError");

			const origWidth = image.width;
			const origHeight = image.height;

			const leftNorm = options.leftPercentage / 100;
			const topNorm = options.topPercentage / 100;
			const widthNorm = options.widthPercentage / 100;
			const heightNorm = options.heightPercentage / 100;

			const cropWidth = Math.floor(origWidth * widthNorm);
			const cropHeight = Math.floor(origHeight * heightNorm);

			if (cropWidth <= 0 || cropHeight <= 0) {
				throw new Error("Invalid crop parameters");
			}

			const context = await this.pool.acquire(cropWidth, cropHeight);

			try {
				const { gl } = context;
				const program = createProgram(
					gl,
					VERTEX_SHADER,
					SIMPLE_FRAGMENT_SHADER,
				);

				gl.useProgram(program);

				// Create custom texture coordinates for cropping
				const positionBuffer = gl.createBuffer();
				gl.bindBuffer(gl.ARRAY_BUFFER, positionBuffer);
				gl.bufferData(
					gl.ARRAY_BUFFER,
					new Float32Array([
						0,
						0,
						cropWidth,
						0,
						0,
						cropHeight,
						0,
						cropHeight,
						cropWidth,
						0,
						cropWidth,
						cropHeight,
					]),
					gl.STATIC_DRAW,
				);

				const positionLoc = gl.getAttribLocation(program, "a_position");
				gl.enableVertexAttribArray(positionLoc);
				gl.vertexAttribPointer(positionLoc, 2, gl.FLOAT, false, 0, 0);

				const texCoordBuffer = gl.createBuffer();
				gl.bindBuffer(gl.ARRAY_BUFFER, texCoordBuffer);
				gl.bufferData(
					gl.ARRAY_BUFFER,
					new Float32Array([
						leftNorm,
						topNorm,
						leftNorm + widthNorm,
						topNorm,
						leftNorm,
						topNorm + heightNorm,
						leftNorm,
						topNorm + heightNorm,
						leftNorm + widthNorm,
						topNorm,
						leftNorm + widthNorm,
						topNorm + heightNorm,
					]),
					gl.STATIC_DRAW,
				);

				const texCoordLoc = gl.getAttribLocation(program, "a_texCoord");
				gl.enableVertexAttribArray(texCoordLoc);
				gl.vertexAttribPointer(texCoordLoc, 2, gl.FLOAT, false, 0, 0);

				const texture = createTexture(gl, image);
				gl.activeTexture(gl.TEXTURE0);
				gl.bindTexture(gl.TEXTURE_2D, texture);
				gl.uniform1i(gl.getUniformLocation(program, "u_texture"), 0);
				gl.uniform2f(
					gl.getUniformLocation(program, "u_resolution"),
					cropWidth,
					cropHeight,
				);

				gl.clearColor(0, 0, 0, 0);
				gl.clear(gl.COLOR_BUFFER_BIT);
				gl.drawArrays(gl.TRIANGLES, 0, 6);

				if (signal?.aborted) throw new DOMException("Cancelled", "AbortError");

				const dataUrl = extractDataURL(gl, cropWidth, cropHeight);

				gl.deleteTexture(texture);
				gl.deleteProgram(program);

				return { dataUrl, width: cropWidth, height: cropHeight };
			} finally {
				this.pool.release(context);
			}
		});
	}

	async processMask(
		config: PaintNodeConfig,
		imageUrl: string | undefined,
		maskUrl?: string,
		signal?: AbortSignal,
	): Promise<{
		imageWithMask: ImageResult;
		onlyMask: ImageResult;
	}> {
		return this.withLimit(async () => {
			if (signal?.aborted) throw new DOMException("Cancelled", "AbortError");

			let widthToUse: number;
			let heightToUse: number;
			let baseImage = null;

			if (imageUrl) {
				baseImage = await this.loadImageBitmap(imageUrl);
				if (signal?.aborted) throw new DOMException("Cancelled", "AbortError");
				widthToUse = baseImage.width;
				heightToUse = baseImage.height;
			} else {
				widthToUse = config.width;
				heightToUse = config.height;
			}

			let maskImage = null;
			if (maskUrl) {
				maskImage = await this.loadImageBitmap(maskUrl);
				if (signal?.aborted) throw new DOMException("Cancelled", "AbortError");
			}

			const context = await this.pool.acquire(widthToUse, heightToUse);

			try {
				const { gl } = context;
				const program = createProgram(gl, VERTEX_SHADER, MASK_FRAGMENT_SHADER);

				gl.useProgram(program);
				setupQuad(gl, program);

				let baseTexture: WebGLTexture | null = null;
				let maskTexture: WebGLTexture | null = null;

				if (baseImage) {
					baseTexture = createTexture(gl, baseImage);
				} else if (config.backgroundColor !== undefined) {
					// Create solid color texture
					const r = ((config.backgroundColor >> 16) & 0xff) / 255;
					const g = ((config.backgroundColor >> 8) & 0xff) / 255;
					const b = (config.backgroundColor & 0xff) / 255;
					const colorData = new Uint8Array(widthToUse * heightToUse * 4);
					for (let i = 0; i < colorData.length; i += 4) {
						colorData[i] = r * 255;
						colorData[i + 1] = g * 255;
						colorData[i + 2] = b * 255;
						colorData[i + 3] = 255;
					}
					baseTexture = gl.createTexture()!;
					gl.bindTexture(gl.TEXTURE_2D, baseTexture);
					gl.texImage2D(
						gl.TEXTURE_2D,
						0,
						gl.RGBA,
						widthToUse,
						heightToUse,
						0,
						gl.RGBA,
						gl.UNSIGNED_BYTE,
						colorData,
					);
					gl.texParameteri(gl.TEXTURE_2D, gl.TEXTURE_WRAP_S, gl.CLAMP_TO_EDGE);
					gl.texParameteri(gl.TEXTURE_2D, gl.TEXTURE_WRAP_T, gl.CLAMP_TO_EDGE);
					gl.texParameteri(gl.TEXTURE_2D, gl.TEXTURE_MIN_FILTER, gl.LINEAR);
					gl.texParameteri(gl.TEXTURE_2D, gl.TEXTURE_MAG_FILTER, gl.LINEAR);
				}

				if (maskImage) {
					maskTexture = createTexture(gl, maskImage);
				}

				// Render only mask first
				gl.uniform1i(gl.getUniformLocation(program, "u_hasBase"), 0);
				if (maskTexture) {
					gl.activeTexture(gl.TEXTURE1);
					gl.bindTexture(gl.TEXTURE_2D, maskTexture);
					gl.uniform1i(gl.getUniformLocation(program, "u_maskTexture"), 1);
				}

				gl.clearColor(0, 0, 0, 0);
				gl.clear(gl.COLOR_BUFFER_BIT);
				gl.drawArrays(gl.TRIANGLES, 0, 6);

				if (signal?.aborted) throw new DOMException("Cancelled", "AbortError");
				const onlyMaskDataUrl = extractDataURL(gl, widthToUse, heightToUse);

				// Render with base and mask
				gl.uniform1i(
					gl.getUniformLocation(program, "u_hasBase"),
					baseTexture ? 1 : 0,
				);
				if (baseTexture) {
					gl.activeTexture(gl.TEXTURE0);
					gl.bindTexture(gl.TEXTURE_2D, baseTexture);
					gl.uniform1i(gl.getUniformLocation(program, "u_baseTexture"), 0);
				}

				gl.clearColor(0, 0, 0, 0);
				gl.clear(gl.COLOR_BUFFER_BIT);
				gl.drawArrays(gl.TRIANGLES, 0, 6);

				if (signal?.aborted) throw new DOMException("Cancelled", "AbortError");
				const imageWithMaskDataUrl = extractDataURL(
					gl,
					widthToUse,
					heightToUse,
				);

				if (baseTexture) gl.deleteTexture(baseTexture);
				if (maskTexture) gl.deleteTexture(maskTexture);
				gl.deleteProgram(program);

				return {
					imageWithMask: {
						dataUrl: imageWithMaskDataUrl,
						width: widthToUse,
						height: heightToUse,
					},
					onlyMask: {
						dataUrl: onlyMaskDataUrl,
						width: widthToUse,
						height: heightToUse,
					},
				};
			} finally {
				this.pool.release(context);
			}
		});
	}

	destroy() {
		this.pool.destroy();
	}
}
