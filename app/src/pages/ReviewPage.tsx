import { formatMonths, formatTonAddress, sumPercentages } from "../lib/format";
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

export function ReviewPage({ state }: Props) {
  const { config, actions } = state;

  return (
    <section className="page-grid">
      <div className="panel">
        <h2>Review before deploy</h2>
        <dl className="summary-list">
          <div>
            <dt>Owner</dt>
            <dd>{config.ownerAddress ? formatTonAddress(config.ownerAddress) : "Not set"}</dd>
          </div>
          <div>
            <dt>Liveness interval</dt>
            <dd>{formatMonths(config.livenessDurationMonths)}</dd>
          </div>
          <div>
            <dt>Liveness code</dt>
            <dd>{config.livenessCode || "Not set"}</dd>
          </div>
          <div>
            <dt>Total TON payout</dt>
            <dd>{sumPercentages(config.beneficiaries.map((item) => item.percentage))}%</dd>
          </div>
        </dl>
      </div>

      <div className="panel">
        <h3>Beneficiary order</h3>
        <ol className="ordered-list">
          {config.beneficiaries.map((beneficiary, index) => (
            <li key={beneficiary.id}>
              #{index + 1}: {beneficiary.address ? formatTonAddress(beneficiary.address) : "Unset address"} for {beneficiary.percentage || "0"}%
            </li>
          ))}
        </ol>
      </div>

      <WarningList warnings={warnings} />

      <div className="panel action-panel">
        <button className="button button-secondary" onClick={() => actions.navigate("configure")}>
          Back to edit
        </button>
        <button className="button" onClick={() => actions.navigate("deploy")}>
          Continue to deploy
        </button>
      </div>
    </section>
  );
}
