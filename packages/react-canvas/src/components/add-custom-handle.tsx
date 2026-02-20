import { generateId } from "@gatewai/core";
import type { DataType } from "@gatewai/db";
import type { NodeEntityType } from "@gatewai/react-store";
import {
	type HandleEntityType,
	makeSelectHandlesByNodeId,
	useAppSelector,
} from "@gatewai/react-store";
import {
	Button,
	Dialog,
	DialogContent,
	DialogHeader,
	DialogTitle,
	DialogTrigger,
	Form,
	FormControl,
	FormField,
	FormItem,
	FormLabel,
	FormMessage,
	Input,
	Select,
	SelectContent,
	SelectItem,
	SelectTrigger,
	SelectValue,
	Textarea,
} from "@gatewai/ui-kit";
import { zodResolver } from "@hookform/resolvers/zod";
import { PlusIcon } from "lucide-react";
import { memo, useMemo, useState } from "react";
import { useForm } from "react-hook-form";
import { z } from "zod";
import { useCanvasCtx } from "../index.js";

const InputTypes = ["Image", "Text", "Audio", "Video"] as const;
const OutputTypes = ["Image", "Text", "Audio", "Video"] as const;

const LookupDataTypes = {
	Input: InputTypes,
	Output: OutputTypes,
} as const;

type CustomHandleButtonProps = {
	nodeId: NodeEntityType["id"];
	type: HandleEntityType["type"];
	dataTypes?: DataType[];
	disabled?: boolean;
	label?: string;
	placeholder?: string;
};

function AddCustomHandleButtonBase(props: CustomHandleButtonProps) {
	const OPTIONS = useMemo(() => {
		return (
			props?.dataTypes ??
			LookupDataTypes[props.type as keyof typeof LookupDataTypes]
		);
	}, [props.dataTypes, props.type]);
	const selectHandles = useMemo(
		() => makeSelectHandlesByNodeId(props.nodeId),
		[props.nodeId],
	);
	const existingHandles = useAppSelector((state) => selectHandles(state));
	const enumValues = OPTIONS as unknown as [string, ...string[]];

	const { createNewHandle } = useCanvasCtx();
	const [open, setOpen] = useState(false);
	const formSchema = z.object({
		dataType: z.enum(enumValues),
		label: z.string(),
		description: z.string().optional(),
	});

	type FormValues = z.infer<typeof formSchema>;

	const form = useForm<FormValues>({
		resolver: zodResolver(formSchema),
		defaultValues: {
			dataType: OPTIONS[0],
			label: "",
			description: "",
		},
	});

	const onSubmit = (values: FormValues) => {
		const ioHandles = existingHandles.filter((f) => f.type === props.type);
		// Careful with -Infinity
		const maxOrder = Math.max(...ioHandles.map((m) => m.order));
		const newHandleOrder = (maxOrder ?? -1) + 1;
		const handleEntity: HandleEntityType = {
			id: generateId(),
			nodeId: props.nodeId,
			dataTypes: [values.dataType as DataType],
			type: props.type,
			required: false,
			order: Math.max(newHandleOrder, 0),
			templateHandleId: null,
			label: values.label,
			description: values.description?.trim() || null,
			createdAt: new Date().toISOString(),
			updatedAt: new Date().toISOString(),
		};
		createNewHandle(handleEntity);
		form.reset();
		setOpen(false);
	};

	return (
		<Dialog open={open} onOpenChange={setOpen}>
			<DialogTrigger asChild>
				<Button disabled={props.disabled} variant="ghost" size="sm">
					<PlusIcon /> {props.label ?? `Add ${props.type}`}
				</Button>
			</DialogTrigger>
			<DialogContent>
				<DialogHeader>
					<DialogTitle>New {props.type} Handle</DialogTitle>
				</DialogHeader>
				<Form {...form}>
					<form onSubmit={form.handleSubmit(onSubmit)} className="space-y-4">
						<FormField
							control={form.control}
							name="dataType"
							render={({ field }) => (
								<FormItem>
									<FormLabel>Data Type</FormLabel>
									<Select
										disabled={props.dataTypes && props.dataTypes?.length <= 1}
										onValueChange={field.onChange}
										defaultValue={field.value}
									>
										<FormControl>
											<SelectTrigger>
												<SelectValue placeholder="Select data type" />
											</SelectTrigger>
										</FormControl>
										<SelectContent>
											{OPTIONS.map((opt: string) => (
												<SelectItem key={opt} value={opt}>
													{opt}
												</SelectItem>
											))}
										</SelectContent>
									</Select>
									<FormMessage />
								</FormItem>
							)}
						/>
						<FormField
							control={form.control}
							name="label"
							render={({ field }) => (
								<FormItem>
									<FormLabel>Label</FormLabel>
									<FormControl>
										<Input
											placeholder={props.placeholder ?? "E.g. Product Image"}
											{...field}
											value={field.value ?? ""}
										/>
									</FormControl>
									<FormMessage />
								</FormItem>
							)}
						/>
						<FormField
							control={form.control}
							name="description"
							render={({ field }) => (
								<FormItem>
									<FormLabel>Description</FormLabel>
									<FormControl>
										<Textarea
											placeholder={
												"Optional description. Add context for AI Agents."
											}
											{...field}
											value={field.value ?? ""}
										/>
									</FormControl>
									<FormMessage />
								</FormItem>
							)}
						/>
						<Button type="submit">Create</Button>
					</form>
				</Form>
			</DialogContent>
		</Dialog>
	);
}

export const AddCustomHandleButton = memo(AddCustomHandleButtonBase);
