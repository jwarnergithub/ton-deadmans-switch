import React from "react";
import ReactDOM from "react-dom/client";
import { TonConnectUIProvider } from "@tonconnect/ui-react";
import "./polyfills";
import { App } from "./App";
import { ErrorBoundary } from "./components/ErrorBoundary";
import { getTonConnectManifestUrl } from "./lib/tonConnect";
import "./styles.css";

ReactDOM.createRoot(document.getElementById("root")!).render(
  <React.StrictMode>
    <ErrorBoundary>
      <TonConnectUIProvider
        manifestUrl={getTonConnectManifestUrl()}
        actionsConfiguration={{
          skipRedirectToWallet: "never",
          modals: ["before", "success", "error"],
          notifications: ["before", "success", "error"],
        }}
      >
        <App />
      </TonConnectUIProvider>
    </ErrorBoundary>
  </React.StrictMode>,
);
