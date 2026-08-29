import React from "react";
import ReactDOM from "react-dom/client";

// Side-effect import: this attaches window.storage before App ever renders.
// See src/lib/storage.js for why this exists.
import "./lib/storage.js";

import App from "./App.jsx";
import ErrorBoundary from "./components/ErrorBoundary.jsx";
import "./index.css";

ReactDOM.createRoot(document.getElementById("root")).render(
  <React.StrictMode>
    <ErrorBoundary>
      <App />
    </ErrorBoundary>
  </React.StrictMode>
);

// Production only — registering this against Vite's own dev server would
// cache dev output and fight HMR. See public/sw.js for what it caches and
// why (offline app-shell for a coach with no signal at the pitch).
if (import.meta.env.PROD && "serviceWorker" in navigator) {
  window.addEventListener("load", () => navigator.serviceWorker.register("/sw.js"));
}
