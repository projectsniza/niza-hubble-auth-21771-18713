import { createRoot } from "react-dom/client";
import App from "./App.tsx";
import "./index.css";
import { installChunkReloadHandler } from "./lib/chunkReload";

// Recover automatically when a new version was deployed while the app was open
installChunkReloadHandler();

createRoot(document.getElementById("root")!).render(<App />);
