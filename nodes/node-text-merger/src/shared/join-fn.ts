export function joinText(values: unknown[], separator: string): string {
	return values
		.filter((v): v is NonNullable<typeof v> => v !== null && v !== undefined)
		.map((v) => String(v))
		.join(separator);
}
