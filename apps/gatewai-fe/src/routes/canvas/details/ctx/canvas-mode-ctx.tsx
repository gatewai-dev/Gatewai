import { createContext, type ReactNode, useContext, useState } from "react";
import { useHotkeys } from "react-hotkeys-hook";

type CanvasMode = "select" | "pan";

interface CanvasModeContextType {
	mode: CanvasMode;
	setMode: (mode: CanvasMode) => void;
	isSpacePressed: boolean;
	effectivePan: boolean;
	/** The actual stored mode (not affected by temporary overrides) */
	baseMode: CanvasMode;
}

const CanvasModeContext = createContext<CanvasModeContextType | null>(null);

export const useCanvasMode = () => {
	const context = useContext(CanvasModeContext);
	if (!context) {
		throw new Error("useCanvasMode must be used within a CanvasModeProvider");
	}
	return context;
};

export const CanvasModeProvider = ({ children }: { children: ReactNode }) => {
	const [baseMode, setBaseMode] = useState<CanvasMode>("select");
	const [isSpacePressed, setIsSpacePressed] = useState(false);

	// Track key press timing for short-press vs long-press detection

	// V key - toggles select mode
	useHotkeys(
		["v", "V"],
		(e) => {
			e.preventDefault();
			setBaseMode("select");
		},
		{ keydown: true },
	);

	// H key - toggles pan (hand) mode
	useHotkeys(
		["h", "H"],
		(e) => {
			e.preventDefault();
			setBaseMode("pan");
		},
		{ keydown: true },
	);

	// Space key - temporary pan mode
	useHotkeys(
		"space",
		(e) => {
			e.preventDefault();
			setIsSpacePressed(true);
		},
		{ keydown: true },
	);

	useHotkeys(
		"space",
		(e) => {
			e.preventDefault();
			setIsSpacePressed(false);
		},
		{ keyup: true },
	);

	// Derived effective mode considering temporary overrides
	// Priority: Space/MiddleMouse > base mode
	const effectiveMode: CanvasMode = (() => {
		// Space and middle mouse always force pan mode
		if (isSpacePressed) {
			return "pan";
		}
		return baseMode;
	})();

	const effectivePan = effectiveMode === "pan";

	return (
		<CanvasModeContext.Provider
			value={{
				mode: effectiveMode,
				setMode: setBaseMode,
				isSpacePressed,
				effectivePan,
				baseMode,
			}}
		>
			{children}
		</CanvasModeContext.Provider>
	);
};
