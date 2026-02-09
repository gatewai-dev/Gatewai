import { formatDistanceToNow } from "date-fns";
import {
	Clock,
	FileText,
	LayoutGrid,
	List,
	Network,
	Plus,
	Search,
	Sparkles,
	Trash2,
} from "lucide-react";

import { useEffect, useRef, useState } from "react";
import { Helmet } from "react-helmet-async";
import { Link, useNavigate } from "react-router";
import { toast } from "sonner";
import {
	AlertDialog,
	AlertDialogAction,
	AlertDialogCancel,
	AlertDialogContent,
	AlertDialogDescription,
	AlertDialogFooter,
	AlertDialogHeader,
	AlertDialogTitle,
	AlertDialogTrigger,
} from "@gatewai/ui-kit";
import { Button } from "@gatewai/ui-kit";
import { Input } from "@gatewai/ui-kit";
import { Skeleton } from "@gatewai/ui-kit";
import { cn } from "@/lib/utils";
import type { CanvasListRPC } from "@/rpc/types";
import { CanvasListProvider, useCanvasListCtx } from "../ctx/canvas-list.ctx";

function CanvasHomeImpl() {
	const {
		canvasList: rawCanvasList,
		isLoading,
		isError,
		searchQuery,
		setSearchQuery,
		createCanvas,
		isCreating,
	} = useCanvasListCtx();

	// Local state for immediate input updates
	const [localSearchQuery, setLocalSearchQuery] = useState(searchQuery);
	const debounceTimerRef = useRef<NodeJS.Timeout | null>(null);

	// Sync local state with context state when context changes externally
	useEffect(() => {
		setLocalSearchQuery(searchQuery);
	}, [searchQuery]);

	// Debounce the search query updates
	useEffect(() => {
		// Clear existing timer
		if (debounceTimerRef.current) {
			clearTimeout(debounceTimerRef.current);
		}

		// Set new timer to update context after 300ms
		debounceTimerRef.current = setTimeout(() => {
			setSearchQuery(localSearchQuery);
		}, 300);

		// Cleanup on unmount or when localSearchQuery changes
		return () => {
			if (debounceTimerRef.current) {
				clearTimeout(debounceTimerRef.current);
			}
		};
	}, [localSearchQuery, setSearchQuery]);

	// Client-side filtering based on search query
	const canvasList = rawCanvasList?.filter((canvas) =>
		canvas.name.toLowerCase().includes(searchQuery.toLowerCase()),
	);

	const nav = useNavigate();
	const [view, setView] = useState<"grid" | "list">("grid");

	const handleCreateCanvas = async () => {
		try {
			const result = await createCanvas("untitled").unwrap();
			nav(`/canvas/${result.id}`);
		} catch (error) {
			toast.error("Failed to create canvas, please try again later.");
		}
	};

	const handleClearSearch = () => {
		setLocalSearchQuery("");
		setSearchQuery("");
	};

	if (isError) {
		return (
			<div className="flex h-[80vh] flex-col items-center justify-center">
				<div className="rounded-2xl bg-destructive/5 p-8 text-center backdrop-blur-sm border border-destructive/10">
					<p className="text-xl font-medium text-destructive">
						System Unavailable
					</p>
					<p className="text-muted-foreground mt-2">
						We're having trouble reaching the workspace cloud.
					</p>
					<Button
						variant="outline"
						className="mt-6"
						onClick={() => window.location.reload()}
					>
						Retry Connection
					</Button>
				</div>
			</div>
		);
	}

	return (
		<div className="min-h-screen bg-[#FAFAFA] dark:bg-[#09090B] selection:bg-primary/10">
			<Helmet>
				<title>Canvases - Gatewai</title>
			</Helmet>
			<div className="max-w-7xl mx-auto px-6 py-12 lg:px-12 space-y-12">
				{/* Apple-style Hero Header */}
				<header className="flex flex-col md:flex-row justify-between items-end gap-6">
					<div className="space-y-2">
						<h1 className="text-4xl font-semibold tracking-tight text-foreground">
							Canvases
						</h1>
						<p className="text-lg text-muted-foreground font-medium">
							Your creative engine, organized.
						</p>
					</div>
				</header>

				{/* Controls: Glassmorphism Blur */}
				<div className="sticky top-6 z-20 flex flex-col sm:flex-row items-center justify-between gap-4 p-2 bg-white/60 dark:bg-zinc-900/60 backdrop-blur-xl border border-white/20 dark:border-zinc-800/50 rounded-2xl shadow-sm">
					<div className="relative w-full sm:w-80 group">
						<Search
							className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-muted-foreground group-focus-within:text-primary transition-colors"
							aria-hidden="true"
						/>
						<Input
							placeholder="Search by name..."
							value={localSearchQuery}
							onChange={(e) => setLocalSearchQuery(e.target.value)}
							className="pl-10 bg-transparent border-none focus-visible:ring-0 text-base"
							aria-label="Search canvases by name"
						/>
					</div>

					<fieldset
						className="flex items-center gap-1.5 p-1 bg-zinc-100/50 dark:bg-zinc-800/50 rounded-xl"
						aria-label="View options"
					>
						<ViewButton
							active={view === "grid"}
							onClick={() => setView("grid")}
							label="Grid view"
						>
							<LayoutGrid className="h-4 w-4" />
						</ViewButton>
						<ViewButton
							active={view === "list"}
							onClick={() => setView("list")}
							label="List view"
						>
							<List className="h-4 w-4" />
						</ViewButton>
					</fieldset>
				</div>

				{/* Content Grid */}
				{isLoading ? (
					<output
						className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 xl:grid-cols-4 gap-6"
						aria-label="Loading canvases"
					>
						{[...Array(8)].map((_, i) => (
							<Skeleton
								key={`skeleton-${
									// biome-ignore lint/suspicious/noArrayIndexKey: No other props
									i
								}`}
								className="h-48 rounded-3xl"
							/>
						))}
					</output>
				) : canvasList && canvasList.length > 0 ? (
					<div
						className={cn(
							"transition-all duration-500",
							view === "grid"
								? "grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 xl:grid-cols-4 gap-6"
								: "space-y-3",
						)}
					>
						{/* Create New Card (Grid View Only) */}
						{view === "grid" && (
							<button
								onClick={handleCreateCanvas}
								disabled={isCreating}
								className={cn(
									"group relative aspect-4/3 rounded-4xl border-2 border-dashed border-zinc-200 dark:border-zinc-800",
									"bg-transparent hover:border-primary/50 hover:bg-primary/5 transition-all duration-300",
									"flex flex-col items-center justify-center gap-4 cursor-pointer outline-none focus-visible:ring-2 focus-visible:ring-primary",
									isCreating && "opacity-50 cursor-wait",
								)}
								aria-label="Create new canvas"
							>
								<div className="h-14 w-14 rounded-2xl bg-white dark:bg-zinc-800 shadow-sm flex items-center justify-center group-hover:scale-110 group-hover:shadow-md transition-all duration-300 group-hover:text-primary">
									<Plus className="h-7 w-7" />
								</div>
								<span className="font-semibold text-zinc-600 dark:text-zinc-400 group-hover:text-primary transition-colors">
									Create New Canvas
								</span>
							</button>
						)}

						{canvasList.map((canvas) => (
							<CanvasCard key={canvas.id} canvas={canvas} view={view} />
						))}
					</div>
				) : (
					<EmptyState
						isSearch={searchQuery.length > 0}
						onClear={handleClearSearch}
						onCreate={handleCreateCanvas}
					/>
				)}
			</div>
		</div>
	);
}

// Sub-components for cleaner structure

function ViewButton({
	active,
	onClick,
	children,
	label,
}: {
	active: boolean;
	onClick: () => void;
	children: React.ReactNode;
	label: string;
}) {
	return (
		<Button
			onClick={onClick}
			className={cn(
				"p-2 rounded-lg transition-all duration-200",
				active
					? "bg-white dark:bg-zinc-700 shadow-sm text-foreground"
					: "text-muted-foreground hover:text-foreground",
			)}
			aria-label={label}
			aria-pressed={active}
			variant="ghost"
		>
			{children}
		</Button>
	);
}

function CanvasCard({
	canvas,
	view,
}: {
	canvas: CanvasListRPC[number];
	view: "grid" | "list";
}) {
	const nodeCount = canvas._count?.nodes || 0;
	const timeAgo = formatDistanceToNow(new Date(canvas.updatedAt));

	const { deleteCanvas } = useCanvasListCtx();
	const [isDeleteDialogOpen, setIsDeleteDialogOpen] = useState(false);

	const handleDelete = async (e: React.MouseEvent) => {
		e.preventDefault();
		e.stopPropagation();
		try {
			await deleteCanvas(canvas.id);
			setIsDeleteDialogOpen(false);
		} catch (error) {
			console.error("Failed to delete canvas:", error);
		}
	};

	if (view === "list") {
		return (
			<div className="group relative">
				<Link
					to={`/canvas/${canvas.id}`}
					className="flex items-center justify-between p-4 bg-white dark:bg-zinc-900 border border-zinc-200 dark:border-zinc-800 rounded-2xl hover:border-primary/40 hover:shadow-md transition-all cursor-pointer w-full text-left pr-20"
					aria-label={`Open canvas ${canvas.name}, edited ${timeAgo} ago, ${nodeCount} nodes`}
				>
					<div className="flex items-center gap-4">
						<div
							className="w-10 h-10 rounded-xl bg-zinc-100 dark:bg-zinc-800 flex items-center justify-center group-hover:bg-primary/10 transition-colors"
							aria-hidden="true"
						>
							<Network className="h-5 w-5 text-zinc-500 group-hover:text-primary" />
						</div>
						<div>
							<h3 className="font-semibold text-zinc-900 dark:text-zinc-100">
								{canvas.name}
							</h3>
							<p className="text-xs text-muted-foreground">
								Edited {timeAgo} ago
							</p>
						</div>
					</div>
					<div className="flex items-center gap-6 text-sm text-muted-foreground">
						<div className="flex items-center gap-1.5">
							<FileText className="h-3.5 w-3.5" aria-hidden="true" />
							<span>{nodeCount} nodes</span>
						</div>
					</div>
				</Link>
				<div className="absolute right-4 top-1/2 -translate-y-1/2 opacity-0 group-hover:opacity-100 transition-opacity">
					<AlertDialog
						open={isDeleteDialogOpen}
						onOpenChange={setIsDeleteDialogOpen}
					>
						<AlertDialogTrigger asChild>
							<Button
								variant="ghost"
								size="icon"
								className="h-8 w-8 text-muted-foreground hover:text-destructive hover:bg-destructive/10"
								onClick={(e) => {
									e.preventDefault();
									e.stopPropagation();
									setIsDeleteDialogOpen(true);
								}}
							>
								<Trash2 className="h-4 w-4" />
							</Button>
						</AlertDialogTrigger>
						<AlertDialogContent>
							<AlertDialogHeader>
								<AlertDialogTitle>Are you absolutely sure?</AlertDialogTitle>
								<AlertDialogDescription>
									This action cannot be undone. This will permanently delete the
									canvas named{" "}
									<span className="font-medium">"{canvas.name}"</span> and
									remove all its data.
								</AlertDialogDescription>
							</AlertDialogHeader>
							<AlertDialogFooter>
								<AlertDialogCancel onClick={(e) => e.stopPropagation()}>
									Cancel
								</AlertDialogCancel>
								<AlertDialogAction
									onClick={handleDelete}
									className="bg-destructive text-destructive-foreground hover:bg-destructive/90"
								>
									Delete
								</AlertDialogAction>
							</AlertDialogFooter>
						</AlertDialogContent>
					</AlertDialog>
				</div>
			</div>
		);
	}

	return (
		<div className="group relative">
			<Link
				to={`/canvas/${canvas.id}`}
				className="relative aspect-4/3 rounded-4xl p-6 border border-zinc-200 dark:border-zinc-800 bg-white dark:bg-zinc-900/50 hover:bg-white/80 dark:hover:bg-zinc-900/80 hover:shadow-2xl hover:-translate-y-1 transition-all duration-300 cursor-pointer overflow-hidden block backdrop-blur-sm"
				aria-label={`Open canvas ${canvas.name}, edited ${timeAgo} ago, ${nodeCount} nodes`}
			>
				<div className="flex flex-col h-full justify-between relative z-10">
					<div className="flex items-center gap-3">
						{/* Icon Box */}
						<div
							className="p-3 rounded-2xl bg-zinc-100 dark:bg-zinc-800 group-hover:bg-primary group-hover:text-white transition-all duration-500 shadow-sm"
							aria-hidden="true"
						>
							<Network className="h-6 w-6" />
						</div>

						{/* Open badge (appears on hover) */}
						<div className="opacity-0 group-hover:opacity-100 transition-all duration-300 px-3 py-1 bg-primary/10 text-primary text-[10px] font-bold tracking-wider uppercase rounded-full">
							Open
						</div>
					</div>

					<div className="space-y-1">
						<h3 className="text-xl font-semibold tracking-tight text-foreground group-hover:text-primary transition-colors truncate pr-8">
							{canvas.name}
						</h3>
						<div className="flex items-center gap-1.5 text-[11px] font-medium text-muted-foreground group-hover:text-muted-foreground/80 transition-colors">
							<div className="flex items-center gap-1">
								<Clock className="h-3 w-3" aria-hidden="true" />
								{timeAgo} ago
							</div>
							<div
								className="w-1 h-1 rounded-full bg-zinc-300 dark:bg-zinc-700"
								aria-hidden="true"
							/>
							<div className="flex items-center gap-1">
								<FileText className="h-3 w-3" aria-hidden="true" />
								{nodeCount} nodes
							</div>
						</div>
					</div>
				</div>
				{/* Subtle background glow on hover */}
				<div
					className="absolute -bottom-12 -right-12 w-40 h-40 bg-primary/10 rounded-full blur-3xl opacity-0 group-hover:opacity-100 transition-opacity duration-500"
					aria-hidden="true"
				/>
			</Link>
			<div className="absolute top-4 right-4 z-20 opacity-0 group-hover:opacity-100 transition-opacity duration-200">
				<AlertDialog
					open={isDeleteDialogOpen}
					onOpenChange={setIsDeleteDialogOpen}
				>
					<AlertDialogTrigger asChild>
						<Button
							variant="ghost"
							size="icon"
							className="h-8 w-8 text-muted-foreground hover:text-destructive hover:bg-destructive/10 bg-white/50 backdrop-blur-sm dark:bg-black/50"
							onClick={(e) => {
								e.preventDefault();
								e.stopPropagation();
								setIsDeleteDialogOpen(true);
							}}
						>
							<Trash2 className="h-4 w-4" />
						</Button>
					</AlertDialogTrigger>
					<AlertDialogContent>
						<AlertDialogHeader>
							<AlertDialogTitle>Are you absolutely sure?</AlertDialogTitle>
							<AlertDialogDescription>
								This action cannot be undone. This will permanently delete the
								canvas named{" "}
								<span className="font-medium">"{canvas.name}"</span> and remove
								all its data.
							</AlertDialogDescription>
						</AlertDialogHeader>
						<AlertDialogFooter>
							<AlertDialogCancel onClick={(e) => e.stopPropagation()}>
								Cancel
							</AlertDialogCancel>
							<AlertDialogAction
								onClick={handleDelete}
								className="bg-destructive text-destructive-foreground hover:bg-destructive/90"
							>
								Delete
							</AlertDialogAction>
						</AlertDialogFooter>
					</AlertDialogContent>
				</AlertDialog>
			</div>
		</div>
	);
}

function EmptyState({
	isSearch,
	onClear,
	onCreate,
}: {
	isSearch: boolean;
	onClear: () => void;
	onCreate: () => void;
}) {
	return (
		<div className="flex flex-col items-center justify-center py-24 text-center">
			<div
				className="w-20 h-20 rounded-3xl bg-zinc-100 dark:bg-zinc-800 flex items-center justify-center mb-6"
				aria-hidden="true"
			>
				{isSearch ? (
					<Search className="h-8 w-8 text-muted-foreground" />
				) : (
					<Sparkles className="h-8 w-8 text-muted-foreground" />
				)}
			</div>
			<h3 className="text-2xl font-semibold mb-2">
				{isSearch ? "No matches found" : "Start your next project"}
			</h3>
			<p className="text-muted-foreground max-w-sm mb-8">
				{isSearch
					? "We couldn't find any canvases matching your search. Try a different keyword."
					: "Create a canvas to start mapping out your workflow with AI-powered nodes."}
			</p>
			{isSearch ? (
				<Button
					variant="link"
					onClick={onClear}
					className="text-primary font-semibold"
				>
					Clear search query
				</Button>
			) : (
				<Button size="lg" onClick={onCreate} className="rounded-full px-8">
					Create your first canvas
				</Button>
			)}
		</div>
	);
}

function CanvasHome() {
	return (
		<CanvasListProvider>
			<CanvasHomeImpl />
		</CanvasListProvider>
	);
}

export { CanvasHome };
