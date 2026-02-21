const fs = require("fs");

function replaceInFile(file, regex, replaceFn) {
	let content = fs.readFileSync(file, "utf8");
	const org = content;
	content = content.replace(regex, replaceFn);
	if (content !== org) {
		fs.writeFileSync(file, content);
		console.log("Fixed", file);
	}
}

// 1. media-content.tsx
const mcFile = "./packages/react-canvas/src/nodes/common/media-content.tsx";
replaceInFile(
	mcFile,
	/outputItem\(\?\)\.data\(\?\)\.entity/g,
	"(outputItem?.data as FileData)?.entity",
);
replaceInFile(
	mcFile,
	/outputItem\?\.data\?\.entity/g,
	"(outputItem?.data as FileData)?.entity",
);
replaceInFile(
	mcFile,
	/outputItem\.data\.entity/g,
	"(outputItem.data as FileData).entity",
);
replaceInFile(
	mcFile,
	/outputItem\.data\?.entity/g,
	"(outputItem.data as FileData)?.entity",
);

// 2. add missing imports if necessary
let mcContent = fs.readFileSync(mcFile, "utf8");
if (!mcContent.includes("FileData")) {
	mcContent = mcContent.replace(
		'import type { NodeResult } from "@gatewai/core/types";',
		'import type { NodeResult, FileData } from "@gatewai/core/types";',
	);
	fs.writeFileSync(mcFile, mcContent);
}
