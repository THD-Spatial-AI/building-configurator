import { createRoot } from "react-dom/client";
import App from "./app/App.tsx";
import { BuildingConfiguratorProvider } from "./app/lib/provider";
import { demoHttp, ensureDemoSession } from "./demoClient";
import "./styles/index.css";

ensureDemoSession();

createRoot(document.getElementById("root")!).render(
  <BuildingConfiguratorProvider http={demoHttp}>
    <App />
  </BuildingConfiguratorProvider>,
);
