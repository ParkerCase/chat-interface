// src/index.js
import React from "react";
import { createRoot } from "react-dom/client"; // Change this import
import "./index.css";
import "./styles/theme.css";

import "./base.css";

import App from "./App";
import ErrorBoundary from "./components/ErrorBoundary";
import * as serviceWorkerRegistration from "./serviceWorkerRegistration";

// Replace ReactDOM.render with createRoot
const container = document.getElementById("root");
const root = createRoot(container);
root.render(
  <React.StrictMode>
    <ErrorBoundary>
      <App />
    </ErrorBoundary>
  </React.StrictMode>
);

// If you want your app to work offline and load faster, you can change
// unregister() to register() below. Note this comes with some pitfalls.
// Learn more about service workers: https://cra.link/PWA
serviceWorkerRegistration.unregister();
