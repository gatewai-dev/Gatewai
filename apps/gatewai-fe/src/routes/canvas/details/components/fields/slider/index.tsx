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
import { Slider } from "@/components/ui/slider";
import {
	Tooltip,
	TooltipContent,
	TooltipProvider,
	TooltipTrigger,
} from "@/components/ui/tooltip";

type SliderFieldProps<T extends FieldValues> = {
	control: Control<T>;
	name: FieldPath<T>;
	label: string;
	min: number;
	max: number;
	step: number;
	info?: ReactNode;
} & Pick<UseControllerProps<T>, "rules">;

const SliderField = memo(
	<T extends FieldValues>({
		control,
		name,
		label,
		min,
		max,
		step,
		info,
	}: SliderFieldProps<T>) => {
		return (
			<FormField
				control={control}
				name={name}
				render={({ field }) => (
					<FormItem>
						<div className="flex items-center space-x-2">
							<FormLabel>
								{label}: {field.value}
							</FormLabel>
							{info && (
								<TooltipProvider>
									<Tooltip>
										<TooltipTrigger asChild>
											<Info className="h-4 w-4 text-muted-foreground cursor-help" />
										</TooltipTrigger>
										<TooltipContent>{info}</TooltipContent>
									</Tooltip>
								</TooltipProvider>
							)}
						</div>
						<FormControl>
							<Slider
								min={min}
								max={max}
								step={step}
								value={[field.value ?? 0]}
								onValueChange={(vals) => field.onChange(vals[0])}
							/>
						</FormControl>
						<FormMessage />
					</FormItem>
				)}
			/>
		);
	},
);

export { SliderField };
