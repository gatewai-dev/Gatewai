import { AppRouter } from "./Router";
import "@xyflow/react/dist/style.css";
import { Provider as StoreProvider } from "react-redux";
import { Toaster } from "./components/ui/sonner";
import { CanvasListProvider } from "./routes/canvas/ctx/canvas-list.ctx";
import { store } from "./store";

function App() {
	return (
		<>
			<StoreProvider store={store}>
				<CanvasListProvider>
					<AppRouter />
				</CanvasListProvider>
			</StoreProvider>
			<Toaster />
		</>
	);
}

export default App;
