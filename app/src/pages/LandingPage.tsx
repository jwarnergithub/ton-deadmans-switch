import type { AppState } from "../state/appState";

type Props = {
  state: AppState;
};

export function LandingPage({ state }: Props) {
  const { wallet, actions } = state;

  return (
    <section className="hero">
      <div className="hero-copy">
        <p className="eyebrow">Static TON dApp scaffold</p>
        <h2>Set up a TON dead man's switch contract and deploy your own vault instance.</h2>
        <p>
          Prepare the contract terms, deploy from your own wallet, and manage the live vault directly
          from the browser without any backend, bot, or watcher service.
        </p>
        <div className="hero-actions">
          {!wallet.isConnected && (
            <button className="button" onClick={actions.connectWallet}>
              Connect wallet
            </button>
          )}
          <button className="button button-secondary" onClick={() => actions.navigate("configure")}>
            Prepare Contract
          </button>
        </div>
      </div>

      <div className="panel">
        <h3>Scope right now</h3>
        <ul className="plain-list">
          <li>Static web app ready for GitHub Pages hosting</li>
          <li>Direct wallet-based deployment and contract actions</li>
          <li>TON-only payouts for the current MVP</li>
          <li>Manual Telegram Saved Messages reminder flow after deploy</li>
        </ul>
      </div>
    </section>
  );
}
