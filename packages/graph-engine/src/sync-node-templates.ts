import { logger } from "@gatewai/core";
import type { PrismaClient } from "@gatewai/db";
import { nodeRegistry } from "./node-registry.js";

/**
 * Synchronise DB NodeTemplate rows from the in-memory manifest registry.
 *
 * For every registered manifest, ensures a NodeTemplate exists (keyed by unique `type`).
 * If the template already exists, it is NOT updated to preserve existing configurations.
 * This replaces the previous seed-based approach.
 */
export async function syncNodeTemplates(prisma: PrismaClient) {
	const manifests = nodeRegistry.getAllManifests();
	if (manifests.length === 0) {
		logger.warn("[syncNodeTemplates] No manifests registered – skipping.");
		return;
	}

	let synced = 0;

	for (const m of manifests) {
		const allHandles = [
			...m.handles.inputs.map((h) => ({ ...h, type: "Input" as const })),
			...m.handles.outputs.map((h) => ({ ...h, type: "Output" as const })),
		];

		const templateData = {
			displayName: m.displayName,
			description: m.description ?? null,
			category: m.category ?? null,
			subcategory: m.subcategory ?? null,
			showInQuickAccess: m.showInQuickAccess ?? false,
			showInSidebar: m.showInSidebar ?? true,
			isTerminalNode: m.isTerminal,
			isTransient: m.isTransient ?? false,
			variableInputs: m.variableInputs?.enabled ?? false,
			variableInputDataTypes: (m.variableInputs?.dataTypes) ?? [],
			variableOutputs: m.variableOutputs?.enabled ?? false,
			variableOutputDataTypes: (m.variableOutputs?.dataTypes) ?? [],
			defaultConfig: (m.defaultConfig) ?? undefined,
		};

		const existing = await prisma.nodeTemplate.findUnique({
			where: { type: m.type },
		});

		if (!existing) {
			// Create new template + handles
			await prisma.nodeTemplate.create({
				data: {
					type: m.type,
					...templateData,
					templateHandles: {
						create: allHandles.map((h) => ({
							type: h.type,
							dataTypes: h.dataTypes,
							label: h.label,
							required: h.required ?? false,
							order: h.order,
							description: h.description ?? null,
						})),
					},
				},
			});
			synced++;
			logger.info(`[syncNodeTemplates] Created template: ${m.type}`);
		}
	}

	logger.info(`[syncNodeTemplates] Synced ${synced} template(s).`);
}
