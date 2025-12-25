import { Routes, Route } from "react-router";
import { CanvasRouter } from "./routes/canvas/router";
import { CanvasHome } from "./routes/canvas/home";
import { AuthRouter } from "./routes/auth/router";
import { AuthGuard } from "./routes/auth/auth-guard";

function AppRouter() {
  return (
    <Routes>
      <Route index element={ <AuthGuard><CanvasHome /></AuthGuard>} />
      <Route path="/canvas/*" element={ <AuthGuard><CanvasRouter /></AuthGuard>} />
      <Route path="*" element={<AuthRouter />} />
    </Routes>);
}

export { AppRouter };