export const colorToRgb = (color: string): [number, number, number] => {
	const canvas = document.createElement("canvas");
	canvas.width = 1;
	canvas.height = 1;
	const ctx = canvas.getContext("2d");
	if (!ctx) return [0, 0, 0];
	ctx.fillStyle = color;
	ctx.fillRect(0, 0, 1, 1);
	const [r, g, b] = ctx.getImageData(0, 0, 1, 1).data;
	return [r, g, b];
};

export const colorsSimilar = (
	c1: [number, number, number, number],
	c2: [number, number, number, number],
	tol: number,
): boolean => {
	if (c1[3] === 0 || c2[3] === 0) {
		return c1[3] === c2[3];
	}
	return (
		Math.max(
			Math.abs(c1[0] - c2[0]),
			Math.abs(c1[1] - c2[1]),
			Math.abs(c1[2] - c2[2]),
		) <= tol
	);
};

export const getPixel = (
	data: Uint8ClampedArray,
	x: number,
	y: number,
	w: number,
): [number, number, number, number] => {
	const i = (y * w + x) * 4;
	return [data[i], data[i + 1], data[i + 2], data[i + 3]];
};

export const setPixel = (
	data: Uint8ClampedArray,
	x: number,
	y: number,
	w: number,
	r: number,
	g: number,
	b: number,
	a: number,
) => {
	const i = (y * w + x) * 4;
	data[i] = r;
	data[i + 1] = g;
	data[i + 2] = b;
	data[i + 3] = a;
};
