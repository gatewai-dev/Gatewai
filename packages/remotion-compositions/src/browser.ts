import { GetAssetEndpoint } from "@gatewai/core/browser";
import type { VirtualMediaData } from "@gatewai/core/types";

/**
 * Resolve the actual playable URL from a VirtualMediaData.
 * Walks down the tree to find the 'source' operation.
 * Supports legacy formats for backward compatibility.
 */
export function resolveMediaSourceUrlBrowser(
	vv: VirtualMediaData,
): string | undefined {
	if (!vv) return undefined;

	// New structure: leaf source node
	if (vv.operation?.op === "source") {
		const source = vv.operation.source;
		if (source?.entity) {
			return GetAssetEndpoint(source.entity) as string;
		}
		return source?.processData?.dataUrl;
	}

	// New structure: walk down children (assuming single path for non-compose)
	if (vv.children?.length > 0) {
		return resolveMediaSourceUrlBrowser(vv.children[0]);
	}

	return undefined;
}
