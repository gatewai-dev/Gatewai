import { memo } from "react";
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

type TemperatureFieldProps<T extends FieldValues> = {
	control: Control<T>;
	name: FieldPath<T>;
	label?: string;
} & Pick<UseControllerProps<T>, "rules">;

const TemperatureField = memo(
	<T extends FieldValues>({
		control,
		name,
		label = "Temperature",
	}: TemperatureFieldProps<T>) => {
		return (
			<FormField
				control={control}
				name={name}
				render={({ field }) => (
					<FormItem>
						<div className="flex items-center justify-between">
							<FormLabel>{label}</FormLabel>
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
	},
);

export { TemperatureField };
