import { EventEmitter } from "node:events";

class CanvasAgentStateManager extends EventEmitter {
	private lockedCanvases = new Set<string>();

	lock(canvasId: string) {
		this.lockedCanvases.add(canvasId);
		this.emit("change", canvasId, true);
	}

	unlock(canvasId: string) {
		this.lockedCanvases.delete(canvasId);
		this.emit("change", canvasId, false);
	}

	isLocked(canvasId: string) {
		return this.lockedCanvases.has(canvasId);
	}
}

export const canvasAgentState = new CanvasAgentStateManager();
