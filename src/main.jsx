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
