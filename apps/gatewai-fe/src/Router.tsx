import { Routes, Route } from "react-router";
import { CanvasRouter } from "./canvas/router";

function AppRouter() {
  return (<Routes>
        <Route path="/canvas/*" element={<CanvasRouter />} />
   </Routes>);
}

export { AppRouter };