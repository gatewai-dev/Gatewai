import {
	FormControl,
	FormField,
	FormItem,
	FormLabel,
	FormMessage,
	Select,
	SelectContent,
	SelectItem,
	SelectTrigger,
	SelectValue,
	Tooltip,
	TooltipContent,
	TooltipTrigger,
} from "../../ui";
import { Info } from "lucide-react";
import { type JSX, memo, type ReactNode } from "react";
import type {
	Control,
	FieldPath,
	FieldValues,
	UseControllerProps,
} from "react-hook-form";

type SelectFieldProps<T extends FieldValues> = {
	control: Control<T>;
	name: FieldPath<T>;
	label: string;
	placeholder: string;
	options: string[] | ReadonlyArray<string>;
	info?: ReactNode;
	disabled?: boolean;
} & Pick<UseControllerProps<T>, "rules">;

function SelectFieldInner<T extends FieldValues>({
	control,
	name,
	disabled,
	label,
	placeholder,
	options,
	info,
}: SelectFieldProps<T>): JSX.Element {
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
					<Select
						disabled={disabled}
						onValueChange={field.onChange}
						value={field.value}
					>
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
}

const SelectField = memo(SelectFieldInner) as <T extends FieldValues>(
	props: SelectFieldProps<T>,
) => JSX.Element;

export { SelectField };
