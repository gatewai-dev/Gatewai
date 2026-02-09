import { zodResolver } from "@hookform/resolvers/zod";
import { motion } from "framer-motion";
import { AlertCircle, Loader2 } from "lucide-react";
import { useState } from "react";
import { useForm } from "react-hook-form";
import { z } from "zod";
import { Alert, AlertDescription } from "@gatewai/ui-kit";
import { Button } from "@gatewai/ui-kit";
import {
	Form,
	FormControl,
	FormField,
	FormItem,
	FormLabel,
	FormMessage,
} from "@gatewai/ui-kit";
import { Input } from "@gatewai/ui-kit";
import { authClient } from "@/lib/auth-client";

const formSchema = z
	.object({
		name: z.string().min(2, {
			message: "Name must be at least 2 characters.",
		}),
		email: z.string().email({
			message: "Please enter a valid email address.",
		}),
		password: z.string().min(8, {
			message: "Password must be at least 8 characters.",
		}),
		confirmPassword: z.string().min(8, {
			message: "Password must be at least 8 characters.",
		}),
	})
	.refine((data) => data.password === data.confirmPassword, {
		message: "Passwords don't match",
		path: ["confirmPassword"],
	});

type FormValues = z.infer<typeof formSchema>;

interface SignUpFormProps {
	onSuccess?: () => void;
	onError?: (error: Error) => void;
}

function SignUpForm({ onSuccess, onError }: SignUpFormProps) {
	const [isLoading, setIsLoading] = useState<boolean>(false);
	const [error, setError] = useState<string | null>(null);
	const form = useForm<FormValues>({
		resolver: zodResolver(formSchema),
		defaultValues: {
			name: "",
			email: "",
			password: "",
			confirmPassword: "",
		},
	});

	const handleSubmit = async (values: FormValues): Promise<void> => {
		setIsLoading(true);
		setError(null);

		try {
			const result = await authClient.signUp.email({
				email: values.email,
				password: values.password,
				name: values.name,
			});

			if (result.error) {
				throw new Error(result.error.message);
			}

			onSuccess?.();
		} catch (err) {
			const errorMessage =
				err instanceof Error
					? err.message
					: "Failed to sign up. Please try again.";

			setError(errorMessage);
			onError?.(err instanceof Error ? err : new Error(errorMessage));
		} finally {
			setIsLoading(false);
		}
	};

	return (
		<div className="grid gap-6">
			{error && (
				<motion.div
					initial={{ opacity: 0, y: -10 }}
					animate={{ opacity: 1, y: 0 }}
					exit={{ opacity: 0, y: -10 }}
				>
					<Alert variant="destructive">
						<AlertCircle className="h-4 w-4" />
						<AlertDescription>{error}</AlertDescription>
					</Alert>
				</motion.div>
			)}

			<Form {...form}>
				<form onSubmit={form.handleSubmit(handleSubmit)} className="space-y-4">
					<FormField
						control={form.control}
						name="name"
						render={({ field }) => (
							<FormItem>
								<FormLabel className="sr-only">Name</FormLabel>
								<FormControl>
									<Input
										placeholder="Full Name"
										type="text"
										autoComplete="name"
										disabled={isLoading}
										className="h-12 bg-background border-input hover:border-sidebar-primary/50 focus:border-sidebar-primary transition-all duration-300"
										{...field}
									/>
								</FormControl>
								<FormMessage />
							</FormItem>
						)}
					/>

					<FormField
						control={form.control}
						name="email"
						render={({ field }) => (
							<FormItem>
								<FormLabel className="sr-only">Email</FormLabel>
								<FormControl>
									<Input
										placeholder="name@example.com"
										type="email"
										autoComplete="email"
										disabled={isLoading}
										className="h-12 bg-background border-input hover:border-sidebar-primary/50 focus:border-sidebar-primary transition-all duration-300"
										{...field}
									/>
								</FormControl>
								<FormMessage />
							</FormItem>
						)}
					/>

					<FormField
						control={form.control}
						name="password"
						render={({ field }) => (
							<FormItem>
								<FormLabel className="sr-only">Password</FormLabel>
								<FormControl>
									<Input
										placeholder="Password"
										type="password"
										autoComplete="new-password"
										disabled={isLoading}
										className="h-12 bg-background border-input hover:border-sidebar-primary/50 focus:border-sidebar-primary transition-all duration-300"
										{...field}
									/>
								</FormControl>
								<FormMessage />
							</FormItem>
						)}
					/>

					<FormField
						control={form.control}
						name="confirmPassword"
						render={({ field }) => (
							<FormItem>
								<FormLabel className="sr-only">Confirm Password</FormLabel>
								<FormControl>
									<Input
										placeholder="Confirm Password"
										type="password"
										autoComplete="new-password"
										disabled={isLoading}
										className="h-12 bg-background border-input hover:border-sidebar-primary/50 focus:border-sidebar-primary transition-all duration-300"
										{...field}
									/>
								</FormControl>
								<FormMessage />
							</FormItem>
						)}
					/>

					<Button
						type="submit"
						className="w-full h-12 font-medium tracking-wide shadow-lg shadow-primary/25 hover:shadow-primary/40 transition-all duration-300"
						disabled={isLoading}
					>
						{isLoading ? (
							<>
								<Loader2 className="mr-2 h-4 w-4 animate-spin" />
								Creating account...
							</>
						) : (
							"Create Account"
						)}
					</Button>
				</form>
			</Form>
		</div>
	);
}

export { SignUpForm };
