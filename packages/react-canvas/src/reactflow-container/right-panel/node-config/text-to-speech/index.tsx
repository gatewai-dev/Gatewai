import {
	type TextToSpeechNodeConfig,
	TextToSpeechNodeConfigSchema,
	TTS_LANGUAGES,
	TTS_NODE_MODELS,
	TTS_VOICE_NAMES,
} from "@gatewai/node-text-to-speech";
import type { NodeEntityType } from "@gatewai/react-store";
import {
	Button,
	Form,
	FormControl,
	FormDescription,
	FormField,
	FormItem,
	FormLabel,
	FormMessage,
	Input,
} from "@gatewai/ui-kit";
import { zodResolver } from "@hookform/resolvers/zod";
import { debounce, isEqual } from "lodash";
import { Plus, Trash2 } from "lucide-react";
import { memo, useEffect, useMemo } from "react";
import { useFieldArray, useForm } from "react-hook-form";
import { cn } from "@/lib/utils";
import { useCanvasCtx } from "@/routes/canvas/details/ctx/canvas-ctx";
import { SelectField } from "../../../../components/fields/select";

const TextToSpeechNodeConfigComponent = memo(
	({ node }: { node: NodeEntityType }) => {
		const { onNodeConfigUpdate } = useCanvasCtx();
		const updateConfig = useMemo(
			() =>
				debounce((cfg: TextToSpeechNodeConfig) => {
					onNodeConfigUpdate({ id: node.id, newConfig: cfg });
				}, 500),
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
			resolver: zodResolver(TextToSpeechNodeConfigSchema),
			mode: "onChange",
			defaultValues: defaultValue,
		});

		const { fields, append, remove } = useFieldArray({
			control: form.control,
			name: "speakerConfig",
		});

		useEffect(() => {
			if (node?.config) {
				const currentValues = form.getValues();
				if (!isEqual(defaultValue, currentValues)) {
					form.reset(defaultValue);
				}
			}
		}, [node, form, defaultValue]);

		useEffect(() => {
			const subscription = form.watch((value) => {
				const val = TextToSpeechNodeConfigSchema.safeParse(value);
				if (val.success && !isEqual(val.data, nodeConfig)) {
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
						options={TTS_NODE_MODELS}
					/>
					<SelectField
						control={form.control}
						name="languageCode"
						label="Language"
						placeholder="Select a language (optional)"
						options={["Auto-detect", ...TTS_LANGUAGES]}
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
									options={TTS_VOICE_NAMES}
								/>
							</div>
						))}
					</div>
				</form>
			</Form>
		);
	},
);

export { TextToSpeechNodeConfigComponent };
