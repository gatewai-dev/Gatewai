import { Info } from "lucide-react";
import { memo, type ReactNode } from "react";
import type {
	Control,
	FieldPath,
	FieldValues,
	UseControllerProps,
} from "react-hook-form";
import {
	FormControl,
	FormField,
	FormItem,
	FormLabel,
	FormMessage,
} from "@/components/ui/form";
import {
	Select,
	SelectContent,
	SelectItem,
	SelectTrigger,
	SelectValue,
} from "@/components/ui/select";
import {
	Tooltip,
	TooltipContent,
	TooltipProvider,
	TooltipTrigger,
} from "@/components/ui/tooltip";

type SelectFieldProps<T extends FieldValues> = {
	control: Control<T>;
	name: FieldPath<T>;
	label: string;
	placeholder: string;
	options: string[];
	info?: ReactNode;
} & Pick<UseControllerProps<T>, "rules">; // Optional: Add rules if needed for validation

const SelectField = memo(
	<T extends FieldValues>({
		control,
		name,
		label,
		placeholder,
		options,
		info,
	}: SelectFieldProps<T>) => {
		return (
			<FormField
				control={control}
				name={name}
				render={({ field }) => (
					<FormItem>
						<div className="flex items-center space-x-2">
							<FormLabel>{label}</FormLabel>
							{info && (
								<Tooltip>
									<TooltipTrigger asChild>
										<Info className="h-4 w-4 text-muted-foreground cursor-help" />
									</TooltipTrigger>
									<TooltipContent>{info}</TooltipContent>
								</Tooltip>
							)}
						</div>
						<Select onValueChange={field.onChange} value={field.value}>
							<FormControl>
								<SelectTrigger>
									<SelectValue placeholder={placeholder} />
								</SelectTrigger>
							</FormControl>
							<SelectContent>
								{options.map((option) => (
									<SelectItem key={`${option}_${name}_cfg`} value={option}>
										{option}
									</SelectItem>
								))}
							</SelectContent>
						</Select>
						<FormMessage />
					</FormItem>
				)}
			/>
		);
	},
);

export { SelectField };
