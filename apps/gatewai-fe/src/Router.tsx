import { Routes, Route } from "react-router";
import { CanvasRouter } from "./routes/canvas/router";
import { CanvasHome } from "./routes/canvas/home";
import { AuthRouter } from "./routes/auth/router";

function AppRouter() {
  return (<Routes>
        <Route index element={<CanvasHome />} />
        <Route path="/canvas/*" element={<CanvasRouter />} />
        <Route path="*" element={<AuthRouter />} />
   </Routes>);
}

export { AppRouter };