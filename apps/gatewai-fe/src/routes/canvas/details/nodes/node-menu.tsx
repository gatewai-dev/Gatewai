import {
	makeSelectNodeById,
	type NodeEntityType,
	updateNodeEntity,
	useAppDispatch,
	useAppSelector,
} from "@gatewai/react-store";
import {
	Button,
	Dialog,
	DialogContent,
	DialogFooter,
	DialogHeader,
	DialogTitle,
	DropdownMenu,
	DropdownMenuContent,
	DropdownMenuGroup,
	DropdownMenuItem,
	DropdownMenuSeparator,
	DropdownMenuShortcut,
	DropdownMenuTrigger,
	Form,
	FormControl,
	FormField,
	FormItem,
	FormLabel,
	FormMessage,
	Input,
} from "@gatewai/ui-kit";
import { zodResolver } from "@hookform/resolvers/zod";
import { MenuIcon } from "lucide-react";
import { memo, useState } from "react";
import { useForm } from "react-hook-form";
import { z } from "zod";
import { copyTextToClipboard } from "@/lib/clipboard";
import { useCanvasCtx } from "../../../../../../../packages/react-canvas/src/canvas-ctx";

type RenameNodeDialogProps = {
	nodeId: string;
	currentName: string;
	open: boolean;
	onOpenChange: (open: boolean) => void;
};

const renameSchema = z.object({
	name: z.string().min(1, "Name is required"),
});

const RenameNodeDialog = memo(
	({ nodeId, currentName, open, onOpenChange }: RenameNodeDialogProps) => {
		const dispatch = useAppDispatch();

		const form = useForm<z.infer<typeof renameSchema>>({
			resolver: zodResolver(renameSchema),
			defaultValues: { name: currentName },
		});

		const onSubmit = (data: z.infer<typeof renameSchema>) => {
			dispatch(
				updateNodeEntity({
					id: nodeId,
					changes: { name: data.name },
				}),
			);
			onOpenChange(false);
		};

		return (
			<Dialog open={open} onOpenChange={onOpenChange}>
				<DialogContent>
					<DialogHeader>
						<DialogTitle>Rename Node</DialogTitle>
					</DialogHeader>
					<Form {...form}>
						<form onSubmit={form.handleSubmit(onSubmit)} className="space-y-4">
							<FormField
								control={form.control}
								name="name"
								render={({ field }) => (
									<FormItem>
										<FormLabel>Name</FormLabel>
										<FormControl>
											<Input {...field} />
										</FormControl>
										<FormMessage />
									</FormItem>
								)}
							/>
							<DialogFooter>
								<Button type="submit">Save</Button>
							</DialogFooter>
						</form>
					</Form>
				</DialogContent>
			</Dialog>
		);
	},
);

const NodeMenu = memo((props: { id: NodeEntityType["id"] }) => {
	const { onNodesDelete, duplicateNodes } = useCanvasCtx();
	const [renameOpen, setRenameOpen] = useState(false);
	const isMac = /Mac|iPod|iPhone|iPad/.test(navigator.userAgent);
	const node = useAppSelector(makeSelectNodeById(props.id));
	const currentName = node?.name || "";

	return (
		<>
			<DropdownMenu>
				<DropdownMenuTrigger asChild>
					<Button size="xs" variant="ghost">
						<MenuIcon />{" "}
					</Button>
				</DropdownMenuTrigger>
				<DropdownMenuContent className="w-64" align="start">
					<DropdownMenuGroup>
						<DropdownMenuItem onClick={() => setRenameOpen(true)}>
							Rename
						</DropdownMenuItem>
						<DropdownMenuItem onClick={() => duplicateNodes([props.id])}>
							Duplicate
							<DropdownMenuShortcut className="italic text-[11px]">
								{isMac ? "⌘ D" : "ctrl + d"}
							</DropdownMenuShortcut>
						</DropdownMenuItem>
						<DropdownMenuItem onClick={() => copyTextToClipboard(props.id)}>
							Copy ID
						</DropdownMenuItem>
						<DropdownMenuSeparator />
						<DropdownMenuItem onClick={() => onNodesDelete([props.id])}>
							Delete
							<DropdownMenuShortcut className="italic text-[11px]">
								delete / backspace
							</DropdownMenuShortcut>
						</DropdownMenuItem>
					</DropdownMenuGroup>
				</DropdownMenuContent>
			</DropdownMenu>
			<RenameNodeDialog
				nodeId={props.id}
				currentName={currentName}
				open={renameOpen}
				onOpenChange={setRenameOpen}
			/>
		</>
	);
});

export { NodeMenu };
