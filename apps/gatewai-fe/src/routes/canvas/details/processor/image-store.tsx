class ImageStore {
	private static instance: ImageStore | null = null;

	private store: Map<string, string> = new Map(); // hash -> dataUrl
	private nodeHashes: Map<string, string> = new Map(); // nodeId -> hash

	private constructor() {}

	public static getInstance(): ImageStore {
		if (!ImageStore.instance) {
			ImageStore.instance = new ImageStore();
		}
		return ImageStore.instance;
	}

	public async addBase64(nodeId: string, dataUrl: string): Promise<void> {
		const hash = await this.computeHash(dataUrl);
		if (!this.store.has(hash)) {
			this.store.set(hash, dataUrl);
		}
		this.nodeHashes.set(nodeId, hash);
	}

	public async addUrl(nodeId: string, url: string): Promise<void> {
		if (!this.store.has(url)) {
			this.store.set(url, url);
		}
		this.nodeHashes.set(nodeId, url);
	}

	public getHashForNode(nodeId: string): string | undefined {
		return this.nodeHashes.get(nodeId);
	}

	public getDataUrlForHash(hash: string): string | undefined {
		return this.store.get(hash);
	}

	private async computeHash(dataUrl: string): Promise<string> {
		const base64 = dataUrl.split(",")[1];
		if (!base64) throw new Error("Invalid data URL");
		const binaryString = atob(base64);
		const len = binaryString.length;
		const bytes = new Uint8Array(len);
		for (let i = 0; i < len; i++) {
			bytes[i] = binaryString.charCodeAt(i);
		}
		const hashBuffer = await crypto.subtle.digest("SHA-256", bytes);
		const hashArray = Array.from(new Uint8Array(hashBuffer));
		return hashArray.map((b) => b.toString(16).padStart(2, "0")).join("");
	}
}

const imageStore = ImageStore.getInstance();

export { imageStore };
