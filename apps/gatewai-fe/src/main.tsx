import { StrictMode } from "react";
import { createRoot } from "react-dom/client";
import "./index.css";
import { BrowserRouter } from "react-router";
import { scan } from "react-scan";
import App from "./App.tsx";

scan({
	enabled: true,
});

const root = document.getElementById("root");
if (!root) {
	throw new Error("Root not found");
}
createRoot(root).render(
	<StrictMode>
		<BrowserRouter>
			<App />
		</BrowserRouter>
	</StrictMode>,
);
