import { Info } from "lucide-react";
import { memo } from "react";
import type { Control, FieldValues, Path } from "react-hook-form";
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
	TooltipTrigger,
} from "@/components/ui/tooltip";

type SliderFieldProps<TFieldValues extends FieldValues = FieldValues> = {
	control: Control<TFieldValues>;
	name: Path<TFieldValues>;
	label?: string;
	min?: number;
	max?: number;
	step?: number;
	info?: string;
};

const SliderField = memo(function SliderField<
	TFieldValues extends FieldValues = FieldValues,
>({
	control,
	name,
	label,
	min,
	max,
	step,
	info,
}: SliderFieldProps<TFieldValues>) {
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
});

export { SliderField };
