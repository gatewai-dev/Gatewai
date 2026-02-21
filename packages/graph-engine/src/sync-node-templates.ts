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

	// 1. Identify and remove obsolete templates
	const existingTemplates = await prisma.nodeTemplate.findMany({
		select: { id: true, type: true },
	});
	const manifestTypes = new Set(manifests.map((m) => m.type));
	const templatesToRemove = existingTemplates.filter(
		(t) => !manifestTypes.has(t.type),
	);

	if (templatesToRemove.length > 0) {
		logger.info(
			`[syncNodeTemplates] Removing ${templatesToRemove.length} obsolete templates...`,
		);
		for (const t of templatesToRemove) {
			// Must delete nodes first due to onDelete: Restrict
			const deletedNodes = await prisma.node.deleteMany({
				where: { templateId: t.id },
			});
			if (deletedNodes.count > 0) {
				logger.info(
					`[syncNodeTemplates] Deleted ${deletedNodes.count} nodes of type ${t.type}`,
				);
			}

			await prisma.nodeTemplate.delete({
				where: { id: t.id },
			});
			logger.info(`[syncNodeTemplates] Deleted template: ${t.type}`);
		}
	}

	if (manifests.length === 0) {
		if (templatesToRemove.length === 0) {
			logger.warn("[syncNodeTemplates] No manifests registered – skipping.");
		}
		return;
	}

	let synced = 0;

	for (const m of manifests) {
		const allHandles = [
			...(m.handles?.inputs?.map((h) => ({ ...h, type: "Input" as const })) ??
				[]),
			...(m.handles?.outputs?.map((h) => ({ ...h, type: "Output" as const })) ??
				[]),
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
			variableInputDataTypes: m.variableInputs?.dataTypes ?? [],
			variableOutputs: m.variableOutputs?.enabled ?? false,
			variableOutputDataTypes: m.variableOutputs?.dataTypes ?? [],
			defaultConfig: (m.defaultConfig as any) ?? undefined,
		};

		const existing = await prisma.nodeTemplate.findUnique({
			where: { type: m.type },
			include: { templateHandles: true },
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
			logger.info(`[syncNodeTemplates] Created template: ${m.type}`);
		} else {
			// Update existing template metadata
			await prisma.nodeTemplate.update({
				where: { id: existing.id },
				data: templateData,
			});

			// Sync Handles
			const existingHandles = existing.templateHandles;
			const manifestHandleKeys = new Set(
				allHandles.map((h) => `${h.type}:${h.label}`),
			);

			// Identify handles to remove
			const handlesToRemove = existingHandles.filter(
				(h) => !manifestHandleKeys.has(`${h.type}:${h.label}`),
			);

			for (const h of handlesToRemove) {
				// Must delete actual Handles first due to onDelete: Restrict
				const deletedHandles = await prisma.handle.deleteMany({
					where: { templateHandleId: h.id },
				});

				if (deletedHandles.count > 0) {
					logger.info(
						`[syncNodeTemplates] Removed ${deletedHandles.count} handles of type ${h.type}:${h.label} from nodes`,
					);
				}

				await prisma.nodeTemplateHandle.delete({
					where: { id: h.id },
				});
				logger.info(
					`[syncNodeTemplates] Removed handle definition ${h.label} (${h.type}) from ${m.type}`,
				);
			}

			// Upsert handles (Create or Update)
			for (const h of allHandles) {
				const existingHandle = existingHandles.find(
					(eh) => eh.type === h.type && eh.label === h.label,
				);

				const handleData = {
					dataTypes: h.dataTypes,
					required: h.required ?? false,
					order: h.order,
					description: h.description ?? null,
				};

				if (existingHandle) {
					// Update
					await prisma.nodeTemplateHandle.update({
						where: { id: existingHandle.id },
						data: handleData,
					});
				} else {
					// Create
					await prisma.nodeTemplateHandle.create({
						data: {
							templateId: existing.id,
							type: h.type,
							label: h.label,
							...handleData,
						},
					});
					logger.info(
						`[syncNodeTemplates] Added handle ${h.label} (${h.type}) to ${m.type}`,
					);
				}
			}
		}
		synced++;
	}

	logger.info(`[syncNodeTemplates] Synced ${synced} template(s).`);
}
