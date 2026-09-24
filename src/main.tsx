import { createRoot } from "react-dom/client";
import App from "./app/App.tsx";
import { ensureDemoSession } from "./demoClient";
import "./styles/index.css";

ensureDemoSession();

createRoot(document.getElementById("root")!).render(
  <App />,
);
