import { useReactFlow } from "@xyflow/react";
import { useHotkeys } from "react-hotkeys-hook";

function useZoomHotkeys() {
	const { zoomIn, zoomOut, zoomTo, fitView } = useReactFlow();

	// Zoom hotkeys
	useHotkeys(
		"ctrl+plus, meta+plus, ctrl+=, meta+=",
		(e) => {
			e.preventDefault();
			zoomIn();
		},
		{ preventDefault: true },
		[zoomIn],
	);

	useHotkeys(
		"ctrl+minus, meta+minus",
		(e) => {
			e.preventDefault();
			zoomOut();
		},
		{ preventDefault: true },
		[zoomOut],
	);

	useHotkeys(
		"ctrl+0, meta+0",
		(e) => {
			e.preventDefault();
			zoomTo(1);
		},
		{ preventDefault: true },
		[zoomTo],
	);

	useHotkeys(
		"ctrl+1, meta+1",
		(e) => {
			e.preventDefault();
			fitView();
		},
		{ preventDefault: true },
		[fitView],
	);
}

export { useZoomHotkeys };
