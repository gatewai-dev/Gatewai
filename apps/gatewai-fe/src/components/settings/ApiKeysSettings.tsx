import { zodResolver } from "@hookform/resolvers/zod";
import { Check, Copy, Loader2, Plus, Trash2 } from "lucide-react";
import { useState } from "react";
import { useForm } from "react-hook-form";
import { toast } from "sonner";
import { z } from "zod";
import { Button } from "@/components/ui/button";
import {
	Dialog,
	DialogContent,
	DialogDescription,
	DialogHeader,
	DialogTitle,
} from "@/components/ui/dialog";
import {
	Form,
	FormControl,
	FormField,
	FormItem,
	FormMessage,
} from "@/components/ui/form";
import { Input } from "@/components/ui/input";
import {
	Table,
	TableBody,
	TableCell,
	TableHead,
	TableHeader,
	TableRow,
} from "@/components/ui/table";
import {
	Tooltip,
	TooltipContent,
	TooltipTrigger,
} from "@/components/ui/tooltip";
import {
	useCreateApiKeyMutation,
	useDeleteApiKeyMutation,
	useGetApiKeysQuery,
} from "@/store/api-keys";
import { Separator } from "../ui/separator";

interface ApiKeysSettingsProps {
	open: boolean;
	onOpenChange: (open: boolean) => void;
}

const formSchema = z.object({
	name: z.string().min(1, "Name is required").max(50, "Name is too long"),
});

type FormValues = z.infer<typeof formSchema>;

export function ApiKeysSettings({ open, onOpenChange }: ApiKeysSettingsProps) {
	const { data, isLoading } = useGetApiKeysQuery();
	const [createApiKey, { isLoading: isCreating }] = useCreateApiKeyMutation();
	const [deleteApiKey, { isLoading: isDeleting }] = useDeleteApiKeyMutation();
	const [createdKey, setCreatedKey] = useState<{
		name: string;
		fullKey: string;
	} | null>(null);
	const [isCopied, setIsCopied] = useState(false);

	const form = useForm<FormValues>({
		resolver: zodResolver(formSchema),
		defaultValues: {
			name: "",
		},
	});

	const onSubmit = async (values: FormValues) => {
		try {
			const result = await createApiKey({ name: values.name }).unwrap();
			setCreatedKey({ name: values.name, fullKey: result.fullKey });
			form.reset();
			toast.success("API Key created successfully");
		} catch (error) {
			console.error(error);
			toast.error("Failed to create API key");
		}
	};

	const handleDelete = async (id: string) => {
		try {
			await deleteApiKey(id).unwrap();
			toast.success("API Key deleted successfully");
		} catch (error: any) {
			console.error(error);
			toast.error(error.message || "Failed to delete API key");
		}
	};

	const copyToClipboard = (text: string) => {
		navigator.clipboard.writeText(text);
		toast.success("Copied to clipboard");
		setIsCopied(true);
		setTimeout(() => setIsCopied(false), 2000);
	};

	const keys = data?.keys || [];

	return (
		<Dialog open={open} onOpenChange={onOpenChange}>
			<DialogContent className="max-w-3xl">
				<DialogHeader>
					<DialogTitle>API Keys</DialogTitle>
					<DialogDescription>
						Manage your API keys for accessing Gatewai programmatically.
					</DialogDescription>
				</DialogHeader>

				<div className="space-y-6">
					{/* Create New Key Form */}
					<Form {...form}>
						<form
							onSubmit={form.handleSubmit(onSubmit)}
							className="flex gap-4 items-start"
						>
							<FormField
								control={form.control}
								name="name"
								render={({ field }) => (
									<FormItem className="flex-1 max-w-sm">
										<FormControl>
											<Input
												placeholder="Key Name (e.g. CI/CD)"
												{...field}
												className="h-9"
											/>
										</FormControl>
										<FormMessage />
									</FormItem>
								)}
							/>
							<Button type="submit" className="mt-[1px]" disabled={isCreating}>
								{isCreating ? (
									<>
										<Loader2 className="mr-2 h-4 w-4 animate-spin" />
										Creating...
									</>
								) : (
									<>
										<Plus className="mr-2 h-4 w-4" /> Create Key
									</>
								)}
							</Button>
						</form>
					</Form>
					{/* New Key Display */}
					{createdKey && (
						<div className="rounded-lg border bg-muted/50 transition-all animate-in fade-in slide-in-from-top-2">
							<div className="flex flex-col gap-1.5 mb-4">
								<h4 className="text-sm font-medium leading-none tracking-tight">
									New API Key Created
								</h4>
								<p className="text-xs text-muted-foreground">
									Please copy this key now. For security reasons, it will not be
									shown again.
								</p>
							</div>

							<div className="flex items-center gap-2">
								<div className="relative flex-1 group">
									<div className="absolute inset-y-0 left-0 flex items-center pl-3 pointer-events-none">
										<span className="text-xs text-muted-foreground font-mono">
											Secret Key
										</span>
									</div>
									<Input
										readOnly
										value="gte_•••••••••••••••••••••••"
										className="font-mono text-xs pl-20 bg-background text-muted-foreground"
									/>
								</div>
								<Button
									variant="ghost"
									className="shrink-0"
									onClick={() => copyToClipboard(createdKey.fullKey)}
								>
									{isCopied ? <Check /> : <Copy />}
								</Button>
							</div>
						</div>
					)}
					<Separator />

					{/* Keys List */}
					<div className="rounded-md border">
						<Table>
							<TableHeader>
								<TableRow>
									<TableHead>Name</TableHead>
									<TableHead>Prefix</TableHead>
									<TableHead>Created</TableHead>
									<TableHead>Last Used</TableHead>
									<TableHead className="text-right">Actions</TableHead>
								</TableRow>
							</TableHeader>
							<TableBody>
								{isLoading ? (
									<TableRow>
										<TableCell
											colSpan={5}
											className="text-center py-8 text-muted-foreground"
										>
											<Loader2 className="h-6 w-6 animate-spin mx-auto mb-2 opacity-50" />
											Loading keys...
										</TableCell>
									</TableRow>
								) : keys.length === 0 ? (
									<TableRow>
										<TableCell
											colSpan={5}
											className="text-center py-8 text-muted-foreground"
										>
											No API keys found. Create one to get started.
										</TableCell>
									</TableRow>
								) : (
									keys.map((key) => (
										<TableRow key={key.id}>
											<TableCell className="font-medium">{key.name}</TableCell>
											<TableCell className="font-mono text-xs text-muted-foreground">
												{key.prefix}...
											</TableCell>
											<TableCell className="text-sm text-muted-foreground">
												{new Date(key.createdAt).toLocaleDateString()}
											</TableCell>
											<TableCell className="text-sm text-muted-foreground">
												{key.lastUsedAt
													? new Date(key.lastUsedAt).toLocaleDateString()
													: "Never"}
											</TableCell>
											<TableCell className="text-right">
												{keys.length <= 1 ? (
													<Tooltip>
														<TooltipTrigger asChild>
															<span tabIndex={0} className="inline-block">
																<Button
																	variant="ghost"
																	size="icon"
																	className="text-muted-foreground opacity-50"
																	disabled
																>
																	<Trash2 className="h-4 w-4" />
																</Button>
															</span>
														</TooltipTrigger>
														<TooltipContent side="left">
															<p>
																Cannot delete the last key.
																<br />
																Create a new one first.
															</p>
														</TooltipContent>
													</Tooltip>
												) : (
													<Button
														variant="ghost"
														size="icon"
														className="text-muted-foreground hover:text-destructive hover:bg-destructive/10"
														onClick={() => handleDelete(key.id)}
														disabled={isDeleting}
													>
														<Trash2 className="h-4 w-4" />
													</Button>
												)}
											</TableCell>
										</TableRow>
									))
								)}
							</TableBody>
						</Table>
					</div>
				</div>
			</DialogContent>
		</Dialog>
	);
}
