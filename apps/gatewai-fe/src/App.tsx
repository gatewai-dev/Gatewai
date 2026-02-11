import { HelmetProvider } from "react-helmet-async";
import { AppRouter } from "./Router";
import "@xyflow/react/dist/style.css";
import { store } from "@gatewai/react-store";
import { Toaster, TooltipProvider } from "@gatewai/ui-kit";
import { Provider as StoreProvider } from "react-redux";
import { WebGLGuard } from "./components/guards/webgl-guard";

function App() {
	return (
		<HelmetProvider>
			<WebGLGuard>
				<StoreProvider store={store}>
					<TooltipProvider>
						<AppRouter />
					</TooltipProvider>
				</StoreProvider>
				<Toaster />
			</WebGLGuard>
		</HelmetProvider>
	);
}

export default App;
