import {
	Alert,
	AlertDescription,
	Button,
	Form,
	FormControl,
	FormField,
	FormItem,
	FormLabel,
	FormMessage,
	Input,
} from "@gatewai/ui-kit";
import { zodResolver } from "@hookform/resolvers/zod";
import { motion } from "framer-motion";
import { AlertCircle, Loader2 } from "lucide-react";
import { useState } from "react";
import { useForm } from "react-hook-form";
import { z } from "zod";
import { authClient } from "@/lib/auth-client";

const formSchema = z.object({
	email: z.string().email({
		message: "Please enter a valid email address.",
	}),
	password: z.string().min(8, {
		message: "Password must be at least 8 characters.",
	}),
});

type FormValues = z.infer<typeof formSchema>;

interface SignInFormProps {
	onSuccess?: () => void;
	onError?: (error: Error) => void;
}

function SignInForm({ onSuccess, onError }: SignInFormProps) {
	const [isLoading, setIsLoading] = useState<boolean>(false);
	const [error, setError] = useState<string | null>(null);

	const form = useForm<FormValues>({
		resolver: zodResolver(formSchema),
		defaultValues: {
			email: "demo@gatewai.studio",
			password: "",
		},
	});

	const handleSubmit = async (values: FormValues): Promise<void> => {
		setIsLoading(true);
		setError(null);

		try {
			const result = await authClient.signIn.email({
				email: values.email,
				password: values.password,
				rememberMe: true,
			});

			if (result.error) {
				throw new Error(result.error.message);
			}

			onSuccess?.();
		} catch (err) {
			const errorMessage =
				err instanceof Error
					? err.message
					: "Failed to sign in. Please try again.";

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
						name="email"
						render={({ field }) => (
							<FormItem>
								<FormLabel className="sr-only">Email</FormLabel>
								<FormControl>
									<Input
										placeholder="name@example.com"
										type="email"
										autoCapitalize="none"
										autoComplete="email"
										autoCorrect="off"
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
										autoComplete="current-password"
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
								Signing in...
							</>
						) : (
							"Sign In with Email"
						)}
					</Button>
				</form>
			</Form>
		</div>
	);
}

export { SignInForm };
