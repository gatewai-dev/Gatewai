export function resolveMimeTypeFromDataUrl(dataUrl: string) {
	const match = dataUrl.match(/^data:(image\/[^;]+);base64,/);
	if (match?.[1]) {
		return match?.[1];
	}
}

/**
 * Fetches a file from a URL and converts it to a base64 string
 * required for Gemini InlineData.
 */
export async function urlToBase64(url: string): Promise<string> {
	const response = await fetch(url);
	if (!response.ok)
		throw new Error(`Failed to fetch image: ${response.statusText}`);
	const arrayBuffer = await response.arrayBuffer();
	return Buffer.from(arrayBuffer).toString("base64");
}
