import type { DataType } from "@gatewai/db";
import { zodResolver } from "@hookform/resolvers/zod";
import type { NodeProps } from "@xyflow/react";
import { PlusIcon } from "lucide-react";
import { useMemo, useState } from "react";
import { useForm } from "react-hook-form";
import { z } from "zod";
import { Button } from "@/components/ui/button";
import {
	Dialog,
	DialogContent,
	DialogHeader,
	DialogTitle,
	DialogTrigger,
} from "@/components/ui/dialog";
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
import {
	Select,
	SelectContent,
	SelectItem,
	SelectTrigger,
	SelectValue,
} from "@/components/ui/select";
import { Textarea } from "@/components/ui/textarea";
import { generateId } from "@/lib/idgen";
import type { HandleEntityType } from "@/store/handles";
import { useCanvasCtx } from "../ctx/canvas-ctx";
import type { AnyNode } from "../nodes/node-props";

const InputTypes = ["Image", "Text", "Audio", "Video"] as const;
const OutputTypes = ["Image", "Text", "Audio", "Video"] as const;

const LookupDataTypes = {
	Input: InputTypes,
	Output: OutputTypes,
} as const;

type CustomHandleButtonProps = {
	nodeProps: NodeProps<AnyNode>;
	type: HandleEntityType["type"];
	dataTypes?: DataType[];
};

function AddCustomHandleButton(props: CustomHandleButtonProps) {
	const OPTIONS = useMemo(() => {
		return props.dataTypes ?? LookupDataTypes[props.type];
	}, [props.dataTypes, props.type]);

	if (!OPTIONS || OPTIONS.length === 0) {
		throw new Error(
			"AddCustomHandleButton: OPTIONS must contain at least one dataType",
		);
	}
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
		const handleEntity: HandleEntityType = {
			id: generateId(),
			nodeId: props.nodeProps.id,
			dataTypes: [values.dataType as DataType],
			type: props.type,
			required: false,
			order: 2,
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
				<Button variant="ghost" size="sm">
					<PlusIcon /> Add {props.type}
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
											{OPTIONS.map((opt) => (
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
											placeholder="E.g. Product Image"
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

export { AddCustomHandleButton };
