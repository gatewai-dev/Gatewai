import { SVG_HELPERS_CODE } from "./nodes/node-svg/src/server/svg-helpers.ts";

try {
	// Test 1: Syntactic correctness
	// Wrap in an async function or just eval directly if it's just const/function declarations
	new Function(SVG_HELPERS_CODE);
	console.log("✅ SVG_HELPERS_CODE is syntactically valid.");

	// Test 2: Logic check for namespaceSvgIds (where the most complex escapes were)
	// We'll extract specifically the namespaceSvgIds function from the code string
	// by prefixing it with a mock environment if needed, or by using a regex to find it.
	// Actually, let's just eval the whole thing in a sandbox-like object
	const sandbox = {};
	const evalCode =
		SVG_HELPERS_CODE +
		"\n sandbox.namespaceSvgIds = namespaceSvgIds; sandbox.svgBodyWithoutDefs = svgBodyWithoutDefs;";
	new Function("sandbox", evalCode)(sandbox);

	const testSvg = `
<svg>
  <defs>
    <linearGradient id="grad1">
      <stop offset="0%" stop-color="red" />
    </linearGradient>
  </defs>
  <rect fill="url(#grad1)" />
  <use href="#grad1" />
</svg>
  `.trim();

	const namespaced = sandbox.namespaceSvgIds(testSvg, "_suffix");
	console.log("Test SVG Namespacing:");
	console.log(namespaced);

	if (
		namespaced.includes('id="grad1_suffix"') &&
		namespaced.includes('fill="url(#grad1_suffix)"') &&
		namespaced.includes('href="#grad1_suffix"')
	) {
		console.log("✅ namespaceSvgIds works correctly.");
	} else {
		console.log("❌ namespaceSvgIds failed logic test.");
		process.exit(1);
	}

	// Test 3: svgBodyWithoutDefs
	const withoutDefs = sandbox.svgBodyWithoutDefs(testSvg);
	if (!withoutDefs.includes("<defs>") && withoutDefs.includes("<rect")) {
		console.log("✅ svgBodyWithoutDefs works correctly.");
	} else {
		console.log("❌ svgBodyWithoutDefs failed logic test.");
		process.exit(1);
	}
} catch (e) {
	console.error("❌ Verification failed with error:");
	console.error(e);
	process.exit(1);
}
