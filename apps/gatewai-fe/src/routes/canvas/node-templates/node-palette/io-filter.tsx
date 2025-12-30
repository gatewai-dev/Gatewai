// src/node-palette/DataTypeMultiSelect.tsx

import { Check, ChevronsUpDown } from "lucide-react";
import { useEffect, useState } from "react";
import { Button } from "@/components/ui/button";
import { Command, CommandGroup, CommandItem } from "@/components/ui/command";
import {
	Popover,
	PopoverContent,
	PopoverTrigger,
} from "@/components/ui/popover";
import { cn } from "@/lib/utils";
import { useNodeTemplates } from "../node-templates.ctx";
import { useNodePalette } from "./node-palette.ctx";

export function DataTypeMultiSelect() {
	const { fromTypes, toTypes, setFromTypes, setToTypes } = useNodePalette();
	const [open, setOpen] = useState(false);
	const [localFromTypes, setLocalFromTypes] = useState(fromTypes);
	const [localToTypes, setLocalToTypes] = useState(toTypes);
	const { nodeTemplates } = useNodeTemplates();

	// Dynamically populate all unique data types from nodeTemplates
	const templateHandles = Array.from(
		new Set(nodeTemplates?.flatMap((tmp) => tmp.templateHandles)),
	);
	const inputDataTypes = new Set(
		templateHandles
			.filter((f) => f.type === "Input")
			.flatMap((m) => m.dataTypes),
	);
	const outputDataTypes = new Set(
		templateHandles
			.filter((f) => f.type === "Output")
			.flatMap((m) => m.dataTypes),
	);

	useEffect(() => {
		if (open) {
			setLocalFromTypes(fromTypes);
			setLocalToTypes(toTypes);
		}
	}, [open, fromTypes, toTypes]);

	const toggleFromType = (type: string) => {
		setLocalFromTypes((prev) =>
			prev.includes(type) ? prev.filter((t) => t !== type) : [...prev, type],
		);
	};

	const toggleToType = (type: string) => {
		setLocalToTypes((prev) =>
			prev.includes(type) ? prev.filter((t) => t !== type) : [...prev, type],
		);
	};

	const applyChanges = () => {
		setFromTypes(localFromTypes);
		setToTypes(localToTypes);
	};

	const displayFrom = fromTypes.length ? fromTypes.join(" ") : "Input";
	const displayTo = toTypes.length ? toTypes.join(" ") : "Output";

	return (
		<Popover
			open={open}
			onOpenChange={(newOpen) => {
				setOpen(newOpen);
				if (!newOpen) {
					applyChanges();
				}
			}}
		>
			<PopoverTrigger asChild>
				<Button
					variant="outline"
					size="sm"
					role="combobox"
					aria-expanded={open}
					className="w-full justify-between"
				>
					From {displayFrom} to {displayTo}
					<ChevronsUpDown className="ml-2 h-4 w-4 shrink-0 opacity-50" />
				</Button>
			</PopoverTrigger>
			<PopoverContent className="w-full p-0">
				<Command className="max-h-[400px] overflow-y-auto">
					<CommandGroup heading="From">
						{Array.from(inputDataTypes).map((type) => (
							<CommandItem key={type} onSelect={() => toggleFromType(type)}>
								<Check
									className={cn(
										"mr-2 h-4 w-4",
										localFromTypes.includes(type) ? "opacity-100" : "opacity-0",
									)}
								/>
								{type}
							</CommandItem>
						))}
					</CommandGroup>
					<CommandGroup heading="To">
						{Array.from(outputDataTypes).map((type) => (
							<CommandItem key={type} onSelect={() => toggleToType(type)}>
								<Check
									className={cn(
										"mr-2 h-4 w-4",
										localToTypes.includes(type) ? "opacity-100" : "opacity-0",
									)}
								/>
								{type}
							</CommandItem>
						))}
					</CommandGroup>
				</Command>
			</PopoverContent>
		</Popover>
	);
}
