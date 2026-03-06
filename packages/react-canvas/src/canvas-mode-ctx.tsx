import {
	createContext,
	type ReactNode,
	useContext,
	useRef,
	useState,
} from "react";
import { useHotkeys } from "react-hotkeys-hook";

type CanvasMode = "select" | "pan";

interface CanvasModeContextType {
	mode: CanvasMode;
	setMode: (mode: CanvasMode) => void;
	isSpacePressed: boolean;
	effectivePan: boolean;
	/** The actual stored mode (not affected by temporary overrides) */
	baseMode: CanvasMode;
	setIsMiddleMousePressed: (pressed: boolean) => void;
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
	const [isMiddleMousePressed, setIsMiddleMousePressed] = useState(false);
	const [isVPressed, setIsVPressed] = useState(false);
	const lastVPressTime = useRef(0);

	// Track key press timing for short-press vs long-press detection

	// V key - toggles select mode
	useHotkeys(
		["v", "V"],
		(e) => {
			if (e.repeat) return;
			setIsVPressed(true);
			lastVPressTime.current = Date.now();
		},
		{ keydown: true },
	);

	useHotkeys(
		["v", "V"],
		() => {
			setIsVPressed(false);
			if (Date.now() - lastVPressTime.current < 200) {
				setBaseMode("select");
			}
		},
		{ keyup: true },
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

	const effectiveMode: CanvasMode = (() => {
		if (isSpacePressed || isMiddleMousePressed) {
			return "pan";
		}
		if (isVPressed) {
			return "select";
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
				setIsMiddleMousePressed,
			}}
		>
			{children}
		</CanvasModeContext.Provider>
	);
};
