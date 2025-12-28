import { useState } from "react";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { AlertCircle, Loader2 } from "lucide-react";
import { authClient } from "@/lib/auth-client";
import { Alert, AlertDescription } from "@/components/ui/alert";

interface SignInFormProps {
	onSuccess?: () => void;
	onError?: (error: Error) => void;
}

function SignInForm({ onSuccess, onError }: SignInFormProps) {
	const [isLoading, setIsLoading] = useState<boolean>(false);
	const [error, setError] = useState<string | null>(null);

	const handleGoogleSignIn = async (): Promise<void> => {
		setIsLoading(true);
		setError(null);
		try {
			const result = await authClient.signIn.social({
				provider: "google",
			});
			if (result.error) {
				throw new Error(result.error.message);
			}

			// Handle successful sign in
			onSuccess?.();
		} catch (err) {
			const errorMessage =
				err instanceof Error ? err.message : "Failed to sign in with Google.";

			setError(errorMessage);
			onError?.(err instanceof Error ? err : new Error(errorMessage));
		} finally {
			setIsLoading(false);
		}
	};

	return (
		<div className="flex items-center justify-center min-h-screen p-4">
			<Card className="w-full max-w-md shadow-lg">
				<CardHeader className="space-y-1">
					<CardTitle className="text-2xl font-bold tracking-tight">
						Welcome
					</CardTitle>
				</CardHeader>
				<CardContent>
					{error && (
						<Alert variant="destructive">
							<AlertCircle className="h-4 w-4" />
							<AlertDescription>{error}</AlertDescription>
						</Alert>
					)}
					<Button
						variant="outline"
						type="button"
						className="w-full"
						disabled={isLoading}
						onClick={handleGoogleSignIn}
					>
						{isLoading ? (
							<Loader2 className="mr-2 h-4 w-4 animate-spin" />
						) : null}
						Sign in with Google
					</Button>
				</CardContent>
			</Card>
		</div>
	);
}

export { SignInForm };
