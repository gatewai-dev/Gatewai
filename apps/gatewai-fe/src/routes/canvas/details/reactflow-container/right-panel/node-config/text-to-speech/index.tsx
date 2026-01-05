import {
	type TextToSpeechNodeConfig,
	TextToSpeechNodeConfigSchema,
	TTS_LANGUAGES,
	TTS_NODE_MODELS,
	TTS_VOICE_NAMES,
} from "@gatewai/types";
import { zodResolver } from "@hookform/resolvers/zod";
import { Plus, Trash2 } from "lucide-react";
import { memo, useCallback, useEffect, useMemo } from "react";
import { useFieldArray, useForm } from "react-hook-form";
import { z } from "zod";
import { Button } from "@/components/ui/button";
import {
	Form,
	FormControl,
	FormDescription,
	FormField,
	FormItem,
	FormLabel,
	FormMessage,
} from "@/components/ui/form";
import { Input } from "@/components/ui/input";
import { cn } from "@/lib/utils";
import { useCanvasCtx } from "@/routes/canvas/details/ctx/canvas-ctx";
import type { NodeEntityType } from "@/store/nodes";
import { SelectField } from "../../../../components/fields/select";

const resolvedSchema = TextToSpeechNodeConfigSchema.superRefine((data, ctx) => {
	const config = data.speakerConfig ?? [];
	if (config.length === 2) {
		const [c1, c2] = config;
		const s1 = c1.speaker.trim();
		const s2 = c2.speaker.trim();
		if (s1 === "") {
			ctx.addIssue({
				code: z.ZodIssueCode.too_small,
				minimum: 1,
				type: "string",
				inclusive: true,
				message: "Speaker name is required",
				path: ["speakerConfig", 0, "speaker"],
			});
		}
		if (s2 === "") {
			ctx.addIssue({
				code: z.ZodIssueCode.too_small,
				minimum: 1,
				type: "string",
				inclusive: true,
				message: "Speaker name is required",
				path: ["speakerConfig", 1, "speaker"],
			});
		}
		if (s1 !== "" && s2 !== "" && s1 === s2) {
			ctx.addIssue({
				code: z.ZodIssueCode.custom,
				message: "Speaker names must be unique",
				path: ["speakerConfig", 1, "speaker"],
			});
		}
	}
});

const TextToSpeechNodeConfigComponent = memo(
	({ node }: { node: NodeEntityType }) => {
		const { onNodeConfigUpdate } = useCanvasCtx();
		console.log({ onNodeConfigUpdate });
		const updateConfig = useCallback(
			(cfg: TextToSpeechNodeConfig) => {
				onNodeConfigUpdate({ id: node.id, newConfig: cfg });
			},
			[node.id, onNodeConfigUpdate],
		);
		const nodeConfig = node.config as unknown as TextToSpeechNodeConfig;

		const defaultValue = useMemo(
			() => ({
				model: nodeConfig?.model ?? "gemini-2.5-flash-preview-tts",
				languageCode: nodeConfig?.languageCode,
				speakerConfig: nodeConfig?.speakerConfig ?? [
					{ speaker: "", voiceName: TTS_VOICE_NAMES[0] },
				],
			}),
			[nodeConfig],
		);

		const form = useForm<TextToSpeechNodeConfig>({
			resolver: zodResolver(resolvedSchema),
			mode: "onChange",
			defaultValues: defaultValue,
		});

		const { fields, append, remove } = useFieldArray({
			control: form.control,
			name: "speakerConfig",
		});

		useEffect(() => {
			if (node?.config) {
				form.reset(nodeConfig as TextToSpeechNodeConfig);
			}
		}, [node, form, nodeConfig]);

		useEffect(() => {
			const subscription = form.watch((value) => {
				const val = resolvedSchema.safeParse(value);
				if (val.success && !deepEqual(val.data, nodeConfig)) {
					updateConfig(val.data);
				}
			});
			return () => subscription.unsubscribe();
		}, [form, updateConfig, nodeConfig]);

		const handleAddSpeaker = () => {
			if (fields.length < 2) {
				append({ speaker: "", voiceName: TTS_VOICE_NAMES[0] });
			}
		};

		const handleRemoveSpeaker = (index: number) => {
			remove(index);
			if (fields.length === 2) {
				// After remove, length will be 1
				form.setValue(`speakerConfig.0.speaker`, "");
			}
		};

		return (
			<Form {...form}>
				<form className="space-y-6">
					<SelectField
						control={form.control}
						name="model"
						label="Model"
						placeholder="Select a TTS model"
						options={TTS_NODE_MODELS.map((model) => model)}
					/>
					<SelectField
						control={form.control}
						name="languageCode"
						label="Language"
						placeholder="Select a language (optional)"
						options={["Auto-detect", ...TTS_LANGUAGES.map((lang) => lang)]}
					/>
					<div className="space-y-4">
						<div className="flex items-center justify-between">
							<FormLabel>Speaker Configuration</FormLabel>
							{fields.length < 2 && (
								<Button
									type="button"
									variant="outline"
									size="sm"
									onClick={handleAddSpeaker}
									className="flex items-center gap-1"
								>
									<Plus className="h-4 w-4" />
									Add Speaker
								</Button>
							)}
						</div>
						<FormDescription>
							Configure up to 2 speakers. For multi-speaker, provide unique
							names that match how they appear in the text prompt (e.g., Joe:
							Hello!).
						</FormDescription>
						{fields.map((field, index) => (
							<div
								key={field.id}
								className={cn(
									"border rounded-md p-4 space-y-4",
									index > 0 && "mt-4",
								)}
							>
								<div className="flex items-center justify-between">
									<h4 className="text-sm font-medium">Speaker {index + 1}</h4>
									{index > 0 && (
										<Button
											type="button"
											variant="ghost"
											size="sm"
											onClick={() => handleRemoveSpeaker(index)}
											className="text-destructive hover:text-destructive/90"
										>
											<Trash2 className="h-4 w-4" />
										</Button>
									)}
								</div>
								{fields.length > 1 && (
									<FormField
										control={form.control}
										name={`speakerConfig.${index}.speaker`}
										render={({ field }) => (
											<FormItem>
												<FormLabel>Speaker Name</FormLabel>
												<FormControl>
													<Input placeholder="e.g., Narrator" {...field} />
												</FormControl>
												<FormDescription>
													The name as it appears in the prompt (case-sensitive).
												</FormDescription>
												<FormMessage />
											</FormItem>
										)}
									/>
								)}
								<SelectField
									control={form.control}
									name={`speakerConfig.${index}.voiceName`}
									label="Voice"
									placeholder="Select a voice"
									options={TTS_VOICE_NAMES.map((voice) => voice)}
								/>
							</div>
						))}
					</div>
				</form>
			</Form>
		);
	},
);

// Helper function for deep equality check (since watch triggers on shallow changes)
function deepEqual(obj1: any, obj2: any): boolean {
	if (obj1 === obj2) return true;
	if (
		typeof obj1 !== "object" ||
		typeof obj2 !== "object" ||
		obj1 == null ||
		obj2 == null
	)
		return false;
	const keys1 = Object.keys(obj1);
	const keys2 = Object.keys(obj2);
	if (keys1.length !== keys2.length) return false;
	for (const key of keys1) {
		if (!keys2.includes(key) || !deepEqual(obj1[key], obj2[key])) return false;
	}
	return true;
}

export { TextToSpeechNodeConfigComponent };
