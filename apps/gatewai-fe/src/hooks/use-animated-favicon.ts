import { useCallback, useEffect, useRef } from "react";

/**
 * Hook to animate the favicon when tasks are running.
 * Creates a wave animation effect through the 6 dots of the Gatewai logo.
 */
export function useAnimatedFavicon(isAnimating: boolean) {
	const animationRef = useRef<number | null>(null);
	const originalFaviconRef = useRef<string | null>(null);
	const linkElementRef = useRef<HTMLLinkElement | null>(null);

	// Store dot positions from the original SVG (normalized 0-1)
	const dots = [
		{ cx: 2, cy: 2 }, // top-left
		{ cx: 22, cy: 2 }, // top-right
		{ cx: 2, cy: 22 }, // bottom-left
		{ cx: 22, cy: 22 }, // bottom-right
		{ cx: 22, cy: 12 }, // middle-right
		{ cx: 12, cy: 12 }, // center
	];

	const generateAnimatedSvg = useCallback(
		(time: number) => {
			const primaryL = 89.992;
			const primaryC = 0.16568;
			const primaryH = 110.075;

			// Interpolation factor oscillates between 0 and 1
			const t = (Math.sin(time * 3) + 1) / 2;

			// Interpolate between gray and primary color globally
			// gray: oklch(50% 0 0)
			const l = 50 + t * (primaryL - 50);
			const c = t * primaryC;
			const h = primaryH;
			const color = `oklch(${l}% ${c} ${h})`;

			// Generate circles with uniform color
			const circles = dots
				.map((dot) => {
					return `<circle cx="${dot.cx}" cy="${dot.cy}" r="3" fill="${color}" stroke="none" />`;
				})
				.join("\n    ");

			const svg = `<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 24 24" fill="none" stroke="${color}" stroke-width="3" stroke-linecap="square" stroke-linejoin="miter">
    <title>Gatewai Logo</title>
    <path d="M 2 2 L 22 2" />
    <path d="M 2 2 L 2 22" />
    <path d="M 2 22 L 22 22" />
    <path d="M 22 22 L 22 12" />
    <path d="M 12 12 L 22 12" />
    ${circles}
</svg>`;

			return `data:image/svg+xml,${encodeURIComponent(svg)}`;
		},
		[dots],
	);

	const startAnimation = useCallback(() => {
		let startTime: number | null = null;

		const animate = (timestamp: number) => {
			if (startTime === null) {
				startTime = timestamp;
			}

			const elapsed = (timestamp - startTime) / 1000;
			const svgDataUri = generateAnimatedSvg(elapsed);

			if (linkElementRef.current) {
				linkElementRef.current.href = svgDataUri;
			}

			animationRef.current = requestAnimationFrame(animate);
		};

		animationRef.current = requestAnimationFrame(animate);
	}, [generateAnimatedSvg]);

	const stopAnimation = useCallback(() => {
		if (animationRef.current !== null) {
			cancelAnimationFrame(animationRef.current);
			animationRef.current = null;
		}

		// Restore original favicon
		if (linkElementRef.current && originalFaviconRef.current) {
			linkElementRef.current.href = originalFaviconRef.current;
		}
	}, []);

	useEffect(() => {
		// Find the favicon link element
		const linkElement =
			document.querySelector<HTMLLinkElement>('link[rel="icon"]');
		if (!linkElement) return;

		linkElementRef.current = linkElement;

		// Store the original favicon href
		if (!originalFaviconRef.current) {
			originalFaviconRef.current = linkElement.href;
		}

		if (isAnimating) {
			startAnimation();
		} else {
			stopAnimation();
		}

		return () => {
			stopAnimation();
		};
	}, [isAnimating, startAnimation, stopAnimation]);
}
