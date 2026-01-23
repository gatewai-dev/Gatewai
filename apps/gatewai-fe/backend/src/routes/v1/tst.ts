import { type Schema, Type } from "@google/genai";
import { z } from "zod";

const MCPToolSchema = z.object({
	type: z.literal("object"),
	properties: z.record(z.unknown()).optional(),
	required: z.string().array().optional(),
});

type MCPToolSchema = z.infer<typeof MCPToolSchema>;

function toGeminiType(mcpType: string): Type {
	console.log({ mcpType });
	switch (mcpType.toLowerCase()) {
		case "text":
		case "string":
			return Type.STRING;
		case "number":
			return Type.NUMBER;
		case "boolean":
			return Type.BOOLEAN;
		case "integer":
			return Type.INTEGER;
		case "array":
			return Type.ARRAY;
		case "object":
			return Type.OBJECT;
		default:
			return Type.TYPE_UNSPECIFIED;
	}
}

export function toGeminiSchema(mcpSchema?: MCPToolSchema): Schema | undefined {
	if (!mcpSchema) {
		return undefined;
	}

	function recursiveConvert(mcp: any): Schema {
		// Handle nullable types
		if (!mcp.type && mcp.anyOf && Array.isArray(mcp.anyOf)) {
			const nonNullOption = mcp.anyOf.find((opt: any) => {
				const t = opt.type;
				return t !== "null" && t !== "NULL";
			});
			if (nonNullOption) {
				mcp = nonNullOption;
			}
		}

		// Infer unknown types
		if (!mcp.type) {
			if (mcp.properties || mcp.$ref) {
				mcp.type = "object";
			} else if (mcp.items) {
				mcp.type = "array";
			} else if (mcp.enum) {
				// Handle enum types (like z.enum())
				mcp.type = "string";
			}
		}
		console.log({ mcp });
		const geminiType = toGeminiType(mcp.type);
		const geminiSchema: Schema = {
			type: geminiType,
			description: mcp.description,
		};

		// Handle enum values
		if (mcp.enum && Array.isArray(mcp.enum)) {
			geminiSchema.enum = mcp.enum;
		}

		if (geminiType === Type.OBJECT) {
			geminiSchema.properties = {};
			if (mcp.properties) {
				for (const name in mcp.properties) {
					geminiSchema.properties[name] = recursiveConvert(
						mcp.properties[name],
					);
				}
			}
			geminiSchema.required = mcp.required;
		} else if (geminiType === Type.ARRAY) {
			if (mcp.items) {
				geminiSchema.items = recursiveConvert(mcp.items);
			}
		}

		return geminiSchema;
	}

	return recursiveConvert(mcpSchema);
}
