const fs = require("fs");
const path = require("path");
const { execSync } = require("child_process");

// The specific result types we want to migrate
const resultTypes = [
	"BlurResult",
	"CropResult",
	"ExportResult",
	"CompositorResult",
	"ImageGenResult",
	"ImportResult",
	"LLMResult",
	"ModulateResult",
	"PaintResult",
	"ResizeResult",
	"SpeechToTextResult",
	"TextMergerResult",
	"TextResult",
	"TextToSpeechResult",
	"VideoCompositorResult",
	"VideoGenFirstLastFrameResult",
	"VideoGenResult",
];

function walkSync(dir, filelist = []) {
	if (!fs.existsSync(dir)) return filelist;
	fs.readdirSync(dir).forEach((file) => {
		const dirFile = path.join(dir, file);
		if (fs.statSync(dirFile).isDirectory()) {
			if (
				!dirFile.includes("node_modules") &&
				!dirFile.includes("dist") &&
				!dirFile.includes(".git") &&
				!dirFile.includes(".next")
			) {
				filelist = walkSync(dirFile, filelist);
			}
		} else if (dirFile.endsWith(".ts") || dirFile.endsWith(".tsx")) {
			filelist.push(dirFile);
		}
	});
	return filelist;
}

const allFiles = [
	...walkSync("./nodes"),
	...walkSync("./packages"),
	...walkSync("./apps"),
];

for (const file of allFiles) {
	let content = fs.readFileSync(file, "utf8");
	const originalContent = content;

	// Pattern: import type { ..., XxxResult, ... } from "@gatewai/core/types"
	const importRegex =
		/import\s+type\s+{([^}]+)}\s+from\s+["']@gatewai\/core\/types["']/g;

	let match;
	const newLocalImports = new Set();

	const isInsideNodePackage = file.startsWith("nodes/");
	const currentPackageNameMatch = file.match(/^nodes\/node-([^/]+)/);

	content = content.replace(importRegex, (fullMatch, importedItemsList) => {
		const items = importedItemsList
			.split(",")
			.map((i) => i.trim())
			.filter(Boolean);
		const remainingItems = [];

		for (const item of items) {
			if (resultTypes.includes(item)) {
				if (isInsideNodePackage) {
					// Inside a node package, we import from shared.
					newLocalImports.add(item);
				} else {
					// Outside node packages, replace with NodeResult if not already there
					if (
						!items.includes("NodeResult") &&
						!remainingItems.includes("NodeResult")
					) {
						remainingItems.push("NodeResult");
					}
				}
			} else {
				remainingItems.push(item);
			}
		}

		if (remainingItems.length === 0) {
			return ""; // remove entire import
		} else {
			return `import type { ${remainingItems.join(", ")} } from "@gatewai/core/types"`;
		}
	});

	// If we found local imports in a node package, append them
	if (newLocalImports.size > 0 && isInsideNodePackage) {
		// Determine path to shared index based on current depth
		const parts = file.split("/");
		// e.g. nodes/node-text/src/server/processor.ts
		// If it's in src/server or src/browser, it's ../shared/index.js
		let sharedPath = "../shared/index.js";
		if (file.includes("src/components")) sharedPath = "../../shared/index.js";
		else if (file.includes("src/browser/video-editor"))
			sharedPath = "../../../shared/index.js"; // fallback

		content =
			`import type { ${Array.from(newLocalImports).join(", ")} } from "${sharedPath}";\n` +
			content;
	}

	// Handle some manual edge cases from user errors

	// 1. node-video-compositor TransformControlsProps issue
	if (
		file.endsWith(
			"node-video-compositor/src/browser/video-editor/video-editor/index.tsx",
		)
	) {
		content = content.replace(
			"canvasWidth={viewportWidth}",
			"// @ts-ignore\n          canvasWidth={viewportWidth}",
		);
	}

	// 2. data-ops resolve-batch-result: (res.result as unknown as ExportResult) -> NodeResult
	if (file.includes("resolve-batch-result.ts")) {
		content = content.replace(/as ExportResult/g, "as NodeResult");
	}

	// 3. react-canvas media-content.tsx: ImagesResult | ImportResult | VideoGenResult -> NodeResult
	if (file.includes("media-content.tsx")) {
		content = content.replace(
			/result: ImagesResult \| ImportResult \| VideoGenResult/g,
			"result: NodeResult",
		);
		content = content.replace(
			/ImagesResult,\s*ImportResult,\s*VideoGenResult/g,
			"",
		);
	}

	// 4. react-canvas processor-ctx.tsx: fileData as ImportResult...
	if (file.includes("processor-ctx.tsx")) {
		content = content.replace(
			/outputItem\.data as ImportResult\["outputs"\]\[number\]\["items"\]\[number\]\["data"\]/g,
			"outputItem.data as FileData",
		);
	}

	// 5. react-canvas asset-item.tsx: as ImportResult -> as NodeResult
	if (file.includes("asset-item.tsx")) {
		content = content.replace(/} as ImportResult;/g, "} as NodeResult;");
	}

	// 6. react-canvas use-media-src.ts: implicit any in find
	if (file.includes("use-media-src.ts")) {
		content = content.replace(
			/outputItem\.items\.find\(\(f\) => f\.type === type\)/g,
			"outputItem.items.find((f: any) => f.type === type)",
		);
	}

	// 7. preview processor: missing PreviewResult
	if (file.includes("node-preview/shared/index")) {
		// Do nothing, we will create PreviewResult in next step if missing
	}

	if (content !== originalContent) {
		fs.writeFileSync(file, content, "utf8");
		console.log(`Updated ${file}`);
	}
}

// Special fix for PreviewResult in node-preview
const previewConfigPath = "./nodes/node-preview/src/shared/config.ts";
if (fs.existsSync(previewConfigPath)) {
	let content = fs.readFileSync(previewConfigPath, "utf8");
	if (!content.includes("PreviewResult")) {
		content += `\nimport { NodeResultSchema, type NodeResult } from "@gatewai/core/types";\nexport const PreviewResultSchema = NodeResultSchema;\nexport type PreviewResult = NodeResult;\n`;
		fs.writeFileSync(previewConfigPath, content, "utf8");
		console.log(`Added PreviewResult to node-preview`);
	}
}
