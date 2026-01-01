/**
 * Singleton font loader for document
 */
class FontManager {
	private static instance: FontManager | null = null;
	private loadedFonts: Set<string> = new Set();

	private constructor() {}

	public static getInstance(): FontManager {
		if (!FontManager.instance) {
			FontManager.instance = new FontManager();
		}
		return FontManager.instance;
	}

	public async loadFont(family: string, url: string): Promise<void> {
		if (this.loadedFonts.has(family)) return;

		const fontId = `pixi-font-${family}`;
		if (document.getElementById(fontId)) return;

		const style = document.createElement("style");
		style.id = fontId;
		style.innerHTML = `
      @font-face {
        font-family: "${family}";
        src: url("${url}");
      }
    `;
		document.head.appendChild(style);

		try {
			await document.fonts.load(`1em "${family}"`);
			await document.fonts.ready;
			this.loadedFonts.add(family);
		} catch (e) {
			console.warn(`Font load failed for ${family}:`, e);
		}
	}
}

const fontManager = FontManager.getInstance();

export { fontManager, FontManager };
