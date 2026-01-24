import { zodResolver } from "@hookform/resolvers/zod";
import { AlertCircle, Loader2, UserPlus } from "lucide-react";
import { useState } from "react";
import { useForm } from "react-hook-form";
import { z } from "zod";
import { Alert, AlertDescription } from "@/components/ui/alert";
import { Button } from "@/components/ui/button";
import {
	Card,
	CardContent,
	CardDescription,
	CardHeader,
	CardTitle,
} from "@/components/ui/card";
import {
	Form,
	FormControl,
	FormField,
	FormItem,
	FormLabel,
	FormMessage,
} from "@/components/ui/form";
import { GatewaiLogo } from "@/components/ui/gatewai-logo";
import { Input } from "@/components/ui/input";
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
		<div className="flex items-center justify-center min-h-screen p-4">
			<Card className="w-full max-w-md shadow-xl backdrop-blur-sm">
				<CardHeader className="space-y-3 pb-8">
					<CardTitle className="text-3xl font-semibold tracking-tight text-center flex flex-col items-center justify-center">
						<GatewaiLogo className="size-24 text-primary" /> Demo
					</CardTitle>
					<CardDescription className="text-center">
						Create your account to get started
					</CardDescription>
				</CardHeader>
				<CardContent className="space-y-6">
					{error && (
						<Alert variant="destructive">
							<AlertCircle className="h-4 w-4" />
							<AlertDescription>{error}</AlertDescription>
						</Alert>
					)}

					<Form {...form}>
						<div className="space-y-5">
							<FormField
								control={form.control}
								name="name"
								render={({ field }) => (
									<FormItem>
										<FormLabel className="text-sm font-medium">Name</FormLabel>
										<FormControl>
											<Input
												placeholder="John Doe"
												type="text"
												autoComplete="name"
												disabled={isLoading}
												className="h-11 transition-colors"
												{...field}
											/>
										</FormControl>
										<FormMessage className="text-xs" />
									</FormItem>
								)}
							/>

							<FormField
								control={form.control}
								name="email"
								render={({ field }) => (
									<FormItem>
										<FormLabel className="text-sm font-medium">Email</FormLabel>
										<FormControl>
											<Input
												placeholder="you@example.com"
												type="email"
												autoComplete="email"
												disabled={isLoading}
												className="h-11 transition-colors"
												{...field}
											/>
										</FormControl>
										<FormMessage className="text-xs" />
									</FormItem>
								)}
							/>

							<FormField
								control={form.control}
								name="password"
								render={({ field }) => (
									<FormItem>
										<FormLabel className="text-sm font-medium">
											Password
										</FormLabel>
										<FormControl>
											<Input
												placeholder="Create a password"
												type="password"
												autoComplete="new-password"
												disabled={isLoading}
												className="h-11 transition-colors"
												{...field}
											/>
										</FormControl>
										<FormMessage className="text-xs" />
									</FormItem>
								)}
							/>

							<FormField
								control={form.control}
								name="confirmPassword"
								render={({ field }) => (
									<FormItem>
										<FormLabel className="text-sm font-medium">
											Confirm Password
										</FormLabel>
										<FormControl>
											<Input
												placeholder="Confirm your password"
												type="password"
												autoComplete="new-password"
												disabled={isLoading}
												className="h-11 transition-colors"
												{...field}
											/>
										</FormControl>
										<FormMessage className="text-xs" />
									</FormItem>
								)}
							/>

							<Button
								type="button"
								onClick={form.handleSubmit(handleSubmit)}
								className="w-full h-11 font-medium shadow-lg shadow-blue-500/30 hover:shadow-xl hover:shadow-blue-600/40 transition-all duration-200"
								disabled={isLoading}
							>
								{isLoading ? (
									<>
										<Loader2 className="mr-2 h-4 w-4 animate-spin" />
										Creating account...
									</>
								) : (
									<>
										<UserPlus className="mr-2 h-4 w-4" />
										Sign up
									</>
								)}
							</Button>
						</div>
					</Form>
				</CardContent>
			</Card>
		</div>
	);
}

export { SignUpForm };
