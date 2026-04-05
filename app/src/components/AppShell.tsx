import { APP_COPY } from "../lib/constants";
import { formatTonNetwork, shortAddress } from "../lib/format";
import type { AppState } from "../state/appState";
import { DeployPage } from "../pages/DeployPage";
import { LandingPage } from "../pages/LandingPage";
import { PostDeploySummaryPage } from "../pages/PostDeploySummaryPage";
import { ConfigurationPage } from "../pages/ConfigurationPage";

type Props = {
  state: AppState;
};

export function AppShell({ state }: Props) {
  const { route, wallet, actions } = state;

  return (
    <div className="app-shell">
      <header className="topbar">
        <div>
          <h1>{APP_COPY.appTitle}</h1>
          <p className="subtitle">{APP_COPY.appSubtitle}</p>
        </div>
        <div className="wallet-card">
          <span className="wallet-label">Wallet</span>
          <strong>{shortAddress(wallet.address, { chain: wallet.chain })}</strong>
          <span className="wallet-meta">{wallet.walletName || "TON Connect not linked yet"}</span>
          <span className="wallet-meta">{formatTonNetwork(wallet.chain)}</span>
          {wallet.isConnected ? (
            <button className="button button-secondary" onClick={actions.disconnectWallet}>
              Disconnect
            </button>
          ) : (
            <button className="button" onClick={actions.connectWallet}>
              Connect Wallet
            </button>
          )}
        </div>
      </header>

      <nav className="nav-tabs" aria-label="Main navigation">
        {[
          ["landing", "Home"],
          ["configure", "Prepare Contract"],
          ["deploy", "Finalize Contract Terms"],
          ["summary", "Summary"],
        ].map(([key, label]) => (
          <button
            key={key}
            className={`nav-tab ${route === key ? "nav-tab-active" : ""}`}
            onClick={() => actions.navigate(key as typeof route)}
          >
            {label}
          </button>
        ))}
      </nav>

      <main className="page-shell">
        {route === "landing" && <LandingPage state={state} />}
        {route === "configure" && <ConfigurationPage state={state} />}
        {route === "review" && <DeployPage state={state} />}
        {route === "deploy" && <DeployPage state={state} />}
        {route === "summary" && <PostDeploySummaryPage state={state} />}
      </main>
    </div>
  );
}
