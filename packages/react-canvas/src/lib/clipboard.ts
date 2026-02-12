import { toast } from "sonner";

export async function copyTextToClipboard(text: string) {
	try {
		await navigator.clipboard.writeText(text);
		toast.info("Text copied to clipboard.");
	} catch (err) {
		toast.error("Failed to copy.");
		console.error("Failed to copy: ", err);
	}
}
