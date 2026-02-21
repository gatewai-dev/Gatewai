/**
 * Helper to get media duration in seconds from a file URL or Blob.
 */
export async function getMediaDurationAsSec(src: string): Promise<number> {
	return new Promise((resolve, reject) => {
		const video = document.createElement("video");
		video.preload = "metadata";
		video.onloadedmetadata = () => {
			resolve(video.duration);
		};
		video.onerror = () => {
			reject(new Error("Failed to load media metadata"));
		};
		video.src = src;
	});
}
