import { formatMonths, formatTonAddress, formatTonNetwork, shortAddress, sumPercentages } from "../lib/format";
import type { AppState } from "../state/appState";
import { WarningList } from "../components/WarningList";

type Props = {
  state: AppState;
};

const warnings = [
  "The contract does not wake itself up automatically after expiry.",
  "Someone must send a message after expiry to trigger payout.",
  "Reserve and gas estimates are approximations only.",
  "Beneficiaries are paid in order, so later entries may wait if reserve is low.",
  "Telegram reminders are manual user convenience features only.",
];

export function DeployPage({ state }: Props) {
  const { config, deploymentStatus, deployment, deploymentError, wallet, actions } = state;

  return (
    <section className="page-grid">
      <div className="panel">
        <h2>Review Deployment Contract</h2>
        <p>
          Review the contract details, prepare the deployment, then send the wallet transaction when
          everything looks right.
        </p>
        <dl className="summary-list">
          <div>
            <dt>Owner</dt>
            <dd>{config.ownerAddress ? formatTonAddress(config.ownerAddress, { chain: wallet.chain }) : "Not set"}</dd>
          </div>
          <div>
            <dt>Liveness interval</dt>
            <dd>{formatMonths(config.livenessDurationMonths)}</dd>
          </div>
          <div>
            <dt>Reserve planning horizon</dt>
            <dd>{config.reservePlanningHorizonYears} years</dd>
          </div>
          <div>
            <dt>Liveness code</dt>
            <dd>{config.livenessCode || "Not set"}</dd>
          </div>
          <div>
            <dt>Total beneficiary allocation</dt>
            <dd>{sumPercentages(config.beneficiaries.map((item) => item.percentage))}%</dd>
          </div>
        </dl>
        <dl className="summary-list">
          <div>
            <dt>Beneficiary list</dt>
            <dd></dd>
          </div>
        </dl>
        <ol className="ordered-list">
          {config.beneficiaries.map((beneficiary, index) => (
            <li key={beneficiary.id}>
              #{index + 1}: {beneficiary.address ? shortAddress(beneficiary.address, { chain: wallet.chain }) : "Unset address"} • {beneficiary.percentage || "0"}%
            </li>
          ))}
        </ol>
        {deployment && (
          <>
            <dl className="summary-list">
              <div>
                <dt>Contract address</dt>
                <dd>{formatTonAddress(deployment.contractAddress, { chain: deployment.walletRequest?.network ?? wallet.chain })}</dd>
              </div>
              <div>
                <dt>Minimum deploy amount</dt>
                <dd>{deployment.deployAmountTon} TON</dd>
              </div>
              <div>
                <dt>Wallet network</dt>
                <dd>{formatTonNetwork(wallet.chain)}</dd>
              </div>
              <div>
                <dt>Next liveness due date</dt>
                <dd>{new Date(deployment.nextDueDateIso).toLocaleString()}</dd>
              </div>
              <div>
                <dt>Suggested minimal gas funding after deployment</dt>
                <dd>{deployment.estimatedReserveTon} TON for {deployment.reservePlanningHorizonYears} years</dd>
              </div>
            </dl>
            <p className="subtitle">
              The wallet deploy request uses the minimum deploy amount. Suggested minimal gas funding after deployment
              is optional and not required for contract activation.
            </p>
          </>
        )}
        <div className="hero-actions">
          <button className="button button-secondary" onClick={() => actions.navigate("configure")}>
            Back to edit
          </button>
        </div>
      </div>

      <div className="page-stack">
        <div className="panel">
          <h3>Current deployment step</h3>
          <div className="status-stack">
            <div className={`status-chip ${deploymentStatus === "prepared" ? "active" : ""}`}>Prepared</div>
            <div className={`status-chip ${deploymentStatus === "awaiting-wallet" ? "active" : ""}`}>
              Await wallet confirmation
            </div>
            <div className={`status-chip ${deploymentStatus === "success" ? "active" : ""}`}>Requested</div>
            <div className={`status-chip ${deploymentStatus === "error" ? "active" : ""}`}>Failure</div>
          </div>
          <div className="hero-actions">
            <button className="button" onClick={actions.startDeployment}>
            Finalize Contract Terms
            </button>
            <button className="button" onClick={actions.requestDeploymentTransaction}>
              Deploy contract
            </button>
            <button className="button button-secondary" onClick={actions.resetDeployment}>
              Reset
            </button>
          </div>
          {!wallet.isConnected && (
            <p className="subtitle">Connect a TON wallet before requesting the deployment transaction.</p>
          )}
          {wallet.isConnected && (
            <p className="subtitle">Current wallet network: {formatTonNetwork(wallet.chain)}</p>
          )}
          {wallet.chain === "-239" && (
            <p className="network-inline-warning">
              Mainnet warning: this app is still experimental and only lightly tested on live
              network flows. Use small amounts and deploy carefully.
            </p>
          )}
          {deploymentError && <p className="error-text">{deploymentError}</p>}
        </div>

        <div className="panel">
          <h3>Important warnings</h3>
          <WarningList warnings={warnings} />
        </div>
      </div>
    </section>
  );
}
