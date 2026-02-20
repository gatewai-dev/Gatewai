import { z } from "zod";
export declare const TextNodeConfigSchema: z.ZodObject<
	{
		content: z.ZodDefault<z.ZodString>;
	},
	"strict",
	z.ZodTypeAny,
	{
		content: string;
	},
	{
		content?: string | undefined;
	}
>;
export type TextNodeConfig = z.infer<typeof TextNodeConfigSchema>;
