import { Route, Routes } from "react-router";
import { CanvasHome } from "./home";
import { CanvasDetails } from "./details";

function CanvasRouter() {
  return (<Routes>
    <Route index element={<CanvasHome />} />
    <Route path=":id" element={<CanvasDetails />} />
  </Routes>);
}

export { CanvasRouter };