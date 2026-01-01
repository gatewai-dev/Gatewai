import type { ModulateNodeConfig } from "@gatewai/types";
import { Filter, GlProgram } from "pixi.js";

// Custom Modulate Filter that matches sharp npm package
class ModulateFilter extends Filter {
	constructor(config: ModulateNodeConfig) {
		const fragmentShader = `
			precision mediump float;

			varying vec2 vTextureCoord;

			uniform sampler2D uTexture;
			uniform float uBrightness;
			uniform float uSaturation;
			uniform float uHue;
			uniform float uLightness;

			// RGB to HSL conversion
			vec3 rgb2hsl(vec3 color) {
				float maxVal = max(max(color.r, color.g), color.b);
				float minVal = min(min(color.r, color.g), color.b);
				float delta = maxVal - minVal;

				float h = 0.0;
				float s = 0.0;
				float l = (maxVal + minVal) / 2.0;

				if (delta != 0.0) {
					s = l < 0.5 ? delta / (maxVal + minVal) : delta / (2.0 - maxVal - minVal);

					if (color.r == maxVal) {
						h = (color.g - color.b) / delta + (color.g < color.b ? 6.0 : 0.0);
					} else if (color.g == maxVal) {
						h = (color.b - color.r) / delta + 2.0;
					} else {
						h = (color.r - color.g) / delta + 4.0;
					}
					h /= 6.0;
				}

				return vec3(h, s, l);
			}

			// HSL to RGB conversion
			float hue2rgb(float p, float q, float t) {
				if (t < 0.0) t += 1.0;
				if (t > 1.0) t -= 1.0;
				if (t < 1.0/6.0) return p + (q - p) * 6.0 * t;
				if (t < 1.0/2.0) return q;
				if (t < 2.0/3.0) return p + (q - p) * (2.0/3.0 - t) * 6.0;
				return p;
			}

			vec3 hsl2rgb(vec3 hsl) {
				float h = hsl.x;
				float s = hsl.y;
				float l = hsl.z;

				if (s == 0.0) {
					return vec3(l, l, l);
				}

				float q = l < 0.5 ? l * (1.0 + s) : l + s - l * s;
				float p = 2.0 * l - q;

				return vec3(
					hue2rgb(p, q, h + 1.0/3.0),
					hue2rgb(p, q, h),
					hue2rgb(p, q, h - 1.0/3.0)
				);
			}

			void main() {
				vec4 color = texture2D(uTexture, vTextureCoord);

				// Convert to HSL
				vec3 hsl = rgb2hsl(color.rgb);

				// Apply hue rotation (in degrees, convert to 0-1 range)
				hsl.x = mod(hsl.x + uHue / 360.0, 1.0);

				// Apply saturation (additive, clamped)
				hsl.y = clamp(hsl.y + uSaturation, 0.0, 1.0);

				// Apply lightness (additive, clamped)
				hsl.z = clamp(hsl.z + uLightness, 0.0, 1.0);

				// Convert back to RGB
				vec3 rgb = hsl2rgb(hsl);

				// Apply brightness (additive)
				rgb += uBrightness;

				// Clamp to valid range
				rgb = clamp(rgb, 0.0, 1.0);

				gl_FragColor = vec4(rgb, color.a);
			}
		`;

		const glProgram = GlProgram.from({
			vertex: `
				precision mediump float;
				
				attribute vec2 aPosition;
				varying vec2 vTextureCoord;
				
				uniform vec4 uInputSize;
				uniform vec4 uOutputFrame;
				uniform vec4 uOutputTexture;
				
				vec4 filterVertexPosition() {
					vec2 position = aPosition * uOutputFrame.zw + uOutputFrame.xy;
					position.x = position.x * (2.0 / uOutputTexture.x) - 1.0;
					position.y = position.y * (2.0 * uOutputTexture.z / uOutputTexture.y) - uOutputTexture.z;
					return vec4(position, 0.0, 1.0);
				}
				
				vec2 filterTextureCoord() {
					return aPosition * (uOutputFrame.zw * uInputSize.zw);
				}
				
				void main() {
					gl_Position = filterVertexPosition();
					vTextureCoord = filterTextureCoord();
				}
			`,
			fragment: fragmentShader,
		});

		super({
			glProgram,
			resources: {
				modulateUniforms: {
					uBrightness: { value: config.brightness ?? 0.0, type: "f32" },
					uSaturation: { value: config.saturation ?? 0.0, type: "f32" },
					uHue: { value: config.hue ?? 0.0, type: "f32" },
					uLightness: { value: config.lightness ?? 0.0, type: "f32" },
				},
			},
		});
	}

	get brightness(): number {
		return this.resources.modulateUniforms.uniforms.uBrightness;
	}

	set brightness(value: number) {
		this.resources.modulateUniforms.uniforms.uBrightness = value;
	}

	get saturation(): number {
		return this.resources.modulateUniforms.uniforms.uSaturation;
	}

	set saturation(value: number) {
		this.resources.modulateUniforms.uniforms.uSaturation = value;
	}

	get hue(): number {
		return this.resources.modulateUniforms.uniforms.uHue;
	}

	set hue(value: number) {
		this.resources.modulateUniforms.uniforms.uHue = value;
	}

	get lightness(): number {
		return this.resources.modulateUniforms.uniforms.uLightness;
	}

	set lightness(value: number) {
		this.resources.modulateUniforms.uniforms.uLightness = value;
	}
}

export { ModulateFilter };
