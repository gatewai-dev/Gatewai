import { logger } from "@gatewai/core";
import type { GatewaiNodeManifest, NodeProcessorConstructor } from "./types.js";

/**
 * Central registry for node processors and manifests.
 */
export class NodeRegistry {
	private processors = new Map<string, NodeProcessorConstructor>();
	private manifests = new Map<string, GatewaiNodeManifest>();

	/**
	 * Register a node manifest. If it has a backendProcessor,
	 * that processor will be registered for execution.
	 */
	register(manifest: GatewaiNodeManifest): void {
		if (this.manifests.has(manifest.type)) {
			logger.warn(
				`[NodeRegistry] Overwriting existing registration for node type: ${manifest.type}`,
			);
		}

		this.manifests.set(manifest.type, manifest);

		if (manifest.backendProcessor) {
			this.processors.set(manifest.type, manifest.backendProcessor);
		}
	}

	/**
	 * Register a raw processor function for a node type.
	 * Used for inline/passthrough processors that don't have full manifests.
	 */
	registerProcessor(type: string, processor: NodeProcessorConstructor): void {
		this.processors.set(type, processor);
	}

	/**
	 * Get the processor for a node type.
	 */
	getProcessor(type: string): NodeProcessorConstructor | undefined {
		return this.processors.get(type);
	}

	/**
	 * Get the manifest for a node type.
	 */
	getManifest(type: string): GatewaiNodeManifest | undefined {
		return this.manifests.get(type);
	}

	/**
	 * Get all registered manifests.
	 */
	getAllManifests(): GatewaiNodeManifest[] {
		return Array.from(this.manifests.values());
	}

	/**
	 * Check if a processor is registered for a node type.
	 */
	hasProcessor(type: string): boolean {
		return this.processors.has(type);
	}

	/**
	 * Get the count of registered processors.
	 */
	get processorCount(): number {
		return this.processors.size;
	}

	/**
	 * Get the count of registered manifests.
	 */
	get manifestCount(): number {
		return this.manifests.size;
	}
}

/**
 * Singleton node registry instance.
 */
export const nodeRegistry = new NodeRegistry();
