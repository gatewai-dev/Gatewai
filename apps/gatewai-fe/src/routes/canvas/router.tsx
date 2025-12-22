import { Route, Routes } from "react-router";
import { CanvasDetails } from "./details";

function CanvasRouter() {
  return (<Routes>
    <Route path=":canvasId" element={<CanvasDetails />} />
  </Routes>);
}

export { CanvasRouter };