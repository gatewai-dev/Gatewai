import { BookOpen } from "lucide-react";
import { Button } from "@/components/ui/button";
import {
	Dialog,
	DialogContent,
	DialogHeader,
	DialogTitle,
	DialogTrigger,
} from "@/components/ui/dialog";
import {
	Tooltip,
	TooltipContent,
	TooltipTrigger,
} from "@/components/ui/tooltip";
import { dataTypeColors } from "@/config/colors";
import { cn } from "@/lib/utils";
import { MarkdownRenderer } from "../../components/markdown-renderer";

const SHORTCUTS_CONTENT = `
### Navigation & Shortcuts

| Action | Shortcut |
| :--- | :--- |
| **Pan Canvas** | \`Space\` + \`Drag\` / \`Middle Click\` + \`Drag\` |
| **Zoom** | \`Ctrl\` + \`Scroll\` / \`Pinch\` |
| **Select Multiple** | \`Shift\` + \`Drag\` |
| **Delete Node** | \`Backspace\` / \`Delete\` |

### Node Interactions

- **Connect Nodes**: Drag from a source handle to a target handle.
- **Disconnect**: Click on a connection line and press \`Backspace\` or \`Delete\`.
`;

const TERMINAL_NODES_CONTENT = `
### Terminal Nodes

Some nodes are marked as **Terminal Nodes** (e.g., Image Generation, Video Processing).

- These nodes run exclusively on the **backend**.
- They require a **manual trigger** (Run button) to execute.
- Make sure all required are connected before running.
`;

export function GuidesDialog({ isCollapsed }: { isCollapsed: boolean }) {
	return (
		<Dialog>
			<Tooltip>
				<TooltipTrigger asChild>
					<DialogTrigger asChild>
						<Button
							variant="ghost"
							className={cn(
								"flex items-center gap-3 rounded-xl px-2 py-2 w-full text-muted-foreground transition-colors hover:bg-muted hover:text-foreground",
								isCollapsed ? "justify-center" : "justify-start",
							)}
						>
							<BookOpen className="size-5 shrink-0" />
							{!isCollapsed && (
								<span className="text-sm font-medium animate-in fade-in slide-in-from-left-2">
									Guides
								</span>
							)}
						</Button>
					</DialogTrigger>
				</TooltipTrigger>
				{isCollapsed && <TooltipContent side="right">Guides</TooltipContent>}
			</Tooltip>

			<DialogContent className="max-w-3xl max-h-[85vh] overflow-y-auto">
				<DialogHeader>
					<DialogTitle>Gatewai Canvas Guide</DialogTitle>
				</DialogHeader>

				<div className="grid gap-8 py-4">
					{/* Navigation and Shortcuts */}
					<section>
						<MarkdownRenderer markdown={SHORTCUTS_CONTENT} />
					</section>

					{/* Color Coding */}
					<section>
						<h3 className="text-lg font-semibold mb-4">Data Types & Colors</h3>
						<div className="grid grid-cols-2 sm:grid-cols-3 md:grid-cols-4 gap-4">
							{Object.entries(dataTypeColors).map(([type, colors]) => (
								<div
									key={type}
									className="flex items-center gap-3 p-2 rounded-lg border border-border bg-card/50"
								>
									<div
										className={cn("size-4 rounded-full shadow-sm", colors.bg)}
										style={{ backgroundColor: colors.hex }}
									/>
									<span className="text-sm font-medium">{type}</span>
								</div>
							))}
						</div>
					</section>

					{/* Terminal Nodes */}
					<section>
						<MarkdownRenderer markdown={TERMINAL_NODES_CONTENT} />
					</section>
				</div>
			</DialogContent>
		</Dialog>
	);
}
