export function resolveMimeTypeFromDataUrl(dataUrl: string) {
	const match = dataUrl.match(/^data:(image\/[^;]+);base64,/);
	if (match?.[1]) {
		return match?.[1];
	}
}
