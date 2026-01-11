export async function copyTextToClipboard(text: string) {
	try {
		await navigator.clipboard.writeText(text);
		console.log("Text copied to clipboard");
	} catch (err) {
		console.error("Failed to copy: ", err);
	}
}
