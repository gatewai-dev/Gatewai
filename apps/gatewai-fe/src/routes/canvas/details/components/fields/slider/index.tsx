import {
	FormControl,
	FormField,
	FormItem,
	FormLabel,
	FormMessage,
	Slider,
	Tooltip,
	TooltipContent,
	TooltipTrigger,
} from "@gatewai/ui-kit";
import { Info } from "lucide-react";
import { type JSX, memo } from "react";
import type { Control, FieldPath, FieldValues } from "react-hook-form";

type SliderFieldProps<T extends FieldValues> = {
	control: Control<T>;
	name: FieldPath<T>;
	label?: string;
	min?: number;
	max?: number;
	step?: number;
	info?: string;
};

function SliderFieldInner<T extends FieldValues>({
	control,
	name,
	label,
	min,
	max,
	step,
	info,
}: SliderFieldProps<T>): JSX.Element {
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
							<Tooltip>
								<TooltipTrigger asChild>
									<Info className="h-4 w-4 text-muted-foreground cursor-help" />
								</TooltipTrigger>
								<TooltipContent>{info}</TooltipContent>
							</Tooltip>
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
}

// Memoize and cast to maintain generic support in JSX
const SliderField = memo(SliderFieldInner) as <T extends FieldValues>(
	props: SliderFieldProps<T>,
) => JSX.Element;

export { SliderField };
