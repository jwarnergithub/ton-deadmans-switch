import { FIVE_MINUTE_TEST_DURATION_MONTHS, formatMonths, sumPercentages } from "../lib/format";
import type { AppState } from "../state/appState";
import { BeneficiaryTable } from "../components/BeneficiaryTable";

type Props = {
  state: AppState;
};

export function ConfigurationPage({ state }: Props) {
  const { config, actions } = state;
  const totalPercentage = sumPercentages(config.beneficiaries.map((item) => item.percentage));

  return (
    <section className="page-grid">
      <div className="panel">
        <h2>Configuration</h2>
        <p>Collect user-specific init data for the shared contract and define how the final balance should be split.</p>

        <label className="field">
          <span>Owner wallet address</span>
          <input
            value={config.ownerAddress}
            onChange={(event) => actions.updateConfig({ ownerAddress: event.target.value })}
            placeholder="EQ..."
          />
        </label>

        <div className="field-row">
          <label className="field">
            <span>Number of beneficiaries</span>
            <input
              type="number"
              min="1"
              max="10"
              value={config.beneficiaryCount}
              onChange={(event) =>
                actions.updateConfig({ beneficiaryCount: Number(event.target.value) || 1 })
              }
            />
          </label>

          <label className="field">
            <span>Liveness duration</span>
            <select
              value={config.livenessDurationMonths}
              onChange={(event) =>
                actions.updateConfig({ livenessDurationMonths: Number(event.target.value) })
              }
            >
              {[FIVE_MINUTE_TEST_DURATION_MONTHS, 1, 3, 6, 12, 24].map((months) => (
                <option key={months} value={months}>
                  {formatMonths(months)}
                </option>
              ))}
            </select>
          </label>
        </div>

        <label className="field">
          <span>Reserve planning horizon</span>
          <select
            value={config.reservePlanningHorizonYears}
            onChange={(event) =>
              actions.updateConfig({ reservePlanningHorizonYears: Number(event.target.value) })
            }
          >
            {[5, 10, 15, 20, 25].map((years) => (
              <option key={years} value={years}>
                {years} years
              </option>
            ))}
          </select>
          <small className="field-note">
            This only changes the estimated reserve target shown in the app. It does not change the contract logic.
          </small>
        </label>

        <label className="field">
          <span>Liveness code or message</span>
          <textarea
            rows={4}
            value={config.livenessCode}
            onChange={(event) => actions.updateConfig({ livenessCode: event.target.value })}
            placeholder="Enter the exact phrase the owner must send later."
          />
        </label>
      </div>

      <BeneficiaryTable state={state} />

      <div className="panel">
        <h3>Beneficiary split summary</h3>
        <p>{config.beneficiaryCount} beneficiaries configured</p>
        <p>Total beneficiary allocation: {totalPercentage}%</p>
        <button className="button" onClick={() => actions.navigate("deploy")}>
          Continue to deployment
        </button>
      </div>
    </section>
  );
}
