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
	Switch,
	Tooltip,
	TooltipContent,
	TooltipTrigger,
} from "../../ui";

type SwitchFieldProps<T extends FieldValues> = {
	control: Control<T>;
	name: FieldPath<T>;
	label: string;
	info?: ReactNode;
} & Pick<UseControllerProps<T>, "rules">;

const SwitchField = memo(
	<T extends FieldValues>({
		control,
		name,
		label,
		info,
	}: SwitchFieldProps<T>) => {
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
						<FormControl>
							<Switch checked={field.value} onCheckedChange={field.onChange} />
						</FormControl>
						<FormMessage />
					</FormItem>
				)}
			/>
		);
	},
);

export { SwitchField };
