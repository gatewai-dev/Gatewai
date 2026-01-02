import type { ModulateNodeConfig } from "@gatewai/types";
import { Filter, GlProgram } from "pixi.js";

/**
 * Perceptually accurate Modulate Filter for PIXI.js
 * Matches Node 'sharp' behavior using Oklab color space and multiplicative math.
 */
class ModulateFilter extends Filter {
	constructor(config: ModulateNodeConfig) {
		const fragmentShader = `
            precision mediump float;

            varying vec2 vTextureCoord;
            uniform sampler2D uTexture;

            // Multipliers (Identity = 1.0)
            uniform float uBrightness;
            uniform float uSaturation;
            uniform float uLightness;
            // Offset (Identity = 0.0)
            uniform float uHue;

            // RGB to Oklab conversion
            vec3 rgb2oklab(vec3 c) {
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

            // Oklab to RGB conversion
            vec3 oklab2rgb(vec3 c) {
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

            void main() {
                vec4 texColor = texture2D(uTexture, vTextureCoord);
                
                // 1. Convert to Oklab
                vec3 lab = rgb2oklab(texColor.rgb);
                
                // 2. Polar conversion for Hue/Chroma (Saturation) manipulation
                float chroma = sqrt(lab.y * lab.y + lab.z * lab.z);
                float hue = atan(lab.z, lab.y);
                
                // 3. Apply Modulations
                // Perceptual Lightness (Multiplicative)
                lab.x = clamp(lab.x * uLightness, 0.0, 1.0);
                
                // Chroma / Saturation (Multiplicative)
                chroma = clamp(chroma * uSaturation, 0.0, 1.0);
                
                // Hue (Additive rotation in degrees)
                hue += uHue * (3.14159265 / 180.0);
                
                // 4. Back to Lab components
                lab.y = chroma * cos(hue);
                lab.z = chroma * sin(hue);
                
                // 5. Back to RGB
                vec3 rgb = oklab2rgb(lab);
                
                // 6. Apply Brightness (Final RGB multiplier)
                rgb = clamp(rgb * uBrightness, 0.0, 1.0);
                
                gl_FragColor = vec4(rgb, texColor.a);
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
					uBrightness: { value: config.brightness ?? 1.0, type: "f32" },
					uSaturation: { value: config.saturation ?? 1.0, type: "f32" },
					uHue: { value: config.hue ?? 0.0, type: "f32" },
					uLightness: { value: config.lightness ?? 1.0, type: "f32" },
				},
			},
		});
	}

	// Getters and Setters
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
