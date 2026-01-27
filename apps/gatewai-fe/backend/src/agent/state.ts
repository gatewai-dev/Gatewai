import { EventEmitter } from "node:events";

class CanvasAgentStateManager extends EventEmitter {
	private lockedCanvases = new Set<string>();

	lock(canvasId: string) {
		this.lockedCanvases.add(canvasId);
	}

	unlock(canvasId: string) {
		this.lockedCanvases.delete(canvasId);
	}

	isLocked(canvasId: string) {
		return this.lockedCanvases.has(canvasId);
	}

	notifyPatch(canvasId: string, patchId: string) {
		this.emit("patch", canvasId, patchId);
	}
}

export const canvasAgentState = new CanvasAgentStateManager();
