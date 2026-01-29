import { zodResolver } from "@hookform/resolvers/zod";
import { AlertCircle, Loader2 } from "lucide-react";
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
		<div className="flex items-center justify-center min-h-screen p-4  ">
			<Card className="w-full max-w-md  shadow-xl  backdrop-blur-sm">
				<CardHeader className="space-y-3 pb-8">
					<CardTitle className="text-3xl font-semibold tracking-tight text-center flex flex-col items-center justify-center">
						<GatewaiLogo className="size-24 text-primary" /> Demo
					</CardTitle>
					<CardDescription className="text-center">
						Please use the login credentials in hackathon submission.
					</CardDescription>
				</CardHeader>
				<CardContent className="space-y-6">
					{error && (
						<Alert variant="destructive">
							<AlertCircle className="h-4 w-4" />
							<AlertDescription className="">{error}</AlertDescription>
						</Alert>
					)}

					<Form {...form}>
						<div className="space-y-5">
							<FormField
								control={form.control}
								name="email"
								render={({ field }) => (
									<FormItem>
										<FormLabel className="text-sm font-medium">Email</FormLabel>
										<FormControl>
											<Input
												placeholder="demo@email.com"
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
												placeholder="Enter your password"
												type="password"
												autoComplete="current-password"
												disabled={isLoading}
												className="h-11  transition-colors"
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
										Signing in...
									</>
								) : (
									"Sign in"
								)}
							</Button>
						</div>
					</Form>
				</CardContent>
			</Card>
		</div>
	);
}

export { SignInForm };
