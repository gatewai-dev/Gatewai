import { AppRouter } from "./Router";
import "@xyflow/react/dist/style.css";
import { Provider as StoreProvider } from "react-redux";
import { Toaster } from "./components/ui/sonner";
import { TooltipProvider } from "./components/ui/tooltip";
import { CanvasListProvider } from "./routes/canvas/ctx/canvas-list.ctx";
import { store } from "./store";

function App() {
	return (
		<>
			<StoreProvider store={store}>
				<CanvasListProvider>
					<TooltipProvider>
						<AppRouter />
					</TooltipProvider>
				</CanvasListProvider>
			</StoreProvider>
			<Toaster />
		</>
	);
}

export default App;
