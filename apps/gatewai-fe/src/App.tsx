import { HelmetProvider } from "react-helmet-async";
import { AppRouter } from "./Router";
import "@xyflow/react/dist/style.css";
import { Provider as StoreProvider } from "react-redux";
import { WebGLGuard } from "./components/guards/webgl-guard";
import { Toaster } from "./components/ui/sonner";
import { TooltipProvider } from "./components/ui/tooltip";
import { store } from "./store";

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
