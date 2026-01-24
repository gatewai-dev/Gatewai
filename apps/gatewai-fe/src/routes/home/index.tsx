import { Gemini } from "@lobehub/icons";
import { Link } from "react-router";
import { GatewaiLogo } from "@/components/ui/gatewai-logo";

function HomePage() {
	return (
		<div className="w-screen h-screen flex items-center justify-center">
			<div className="flex flex-col items-center gap-6">
				<GatewaiLogo className="size-32 text-primary" />
				<Link className="underline underline-offset-4" to="/canvas">
					Click Navigate your Workspace
				</Link>
				<div className=" flex flex-col items-center">
					<span>Powered by</span> <Gemini.Color className="size-4" />
				</div>
			</div>
		</div>
	);
}

export { HomePage };
