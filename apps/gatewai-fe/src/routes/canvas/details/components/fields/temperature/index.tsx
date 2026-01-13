import { Info } from "lucide-react";
import { type JSX, memo, type ReactNode } from "react";
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
	TooltipTrigger,
} from "@/components/ui/tooltip";

type TemperatureFieldProps<T extends FieldValues> = {
	control: Control<T>;
	name: FieldPath<T>;
	label?: string;
	info?: ReactNode;
} & Pick<UseControllerProps<T>, "rules">;

function TemperatureFieldInner<T extends FieldValues>({
	control,
	name,
	info,
	label = "Temperature",
}: TemperatureFieldProps<T>): JSX.Element {
	return (
		<FormField
			control={control}
			name={name}
			render={({ field }) => (
				<FormItem>
					<div className="flex items-center justify-between">
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
						<span className="text-sm text-muted-foreground">
							{field?.value?.toFixed(1) ?? "1.0"}
						</span>
					</div>
					<FormControl>
						<Slider
							min={0}
							max={2}
							step={0.1}
							value={[field?.value ?? 1]}
							onValueChange={(value) => field.onChange(value[0])}
						/>
					</FormControl>
					<FormMessage />
				</FormItem>
			)}
		/>
	);
}

const TemperatureField = memo(TemperatureFieldInner) as <T extends FieldValues>(
	props: TemperatureFieldProps<T>,
) => JSX.Element;

export { TemperatureField };
