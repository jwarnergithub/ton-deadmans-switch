import { PHASE_ONE_NOTES } from "../lib/constants";
import type { AppState } from "../state/appState";

type Props = {
  state: AppState;
};

export function BeneficiaryTable({ state }: Props) {
  const { config, actions } = state;

  return (
    <div className="panel">
      <div className="section-header">
        <div>
          <h3>Beneficiaries</h3>
          <p>Set each beneficiary's percentage share. The total should add up to exactly 100%.</p>
        </div>
      </div>

      <div className="beneficiary-grid">
        <div className="grid-head">Address</div>
        <div className="grid-head">Share %</div>
        <div className="grid-head">USDT</div>
        <div className="grid-head">XAUT0</div>

        {config.beneficiaries.map((beneficiary, index) => (
          <div className="grid-row" key={beneficiary.id}>
            <input
              aria-label={`Beneficiary ${index + 1} address`}
              value={beneficiary.address}
              onChange={(event) =>
                actions.updateBeneficiary(index, { address: event.target.value })
              }
              placeholder="EQ..."
            />
            <input
              aria-label={`Beneficiary ${index + 1} share percentage`}
              value={beneficiary.percentage}
              onChange={(event) =>
                actions.updateBeneficiary(index, { percentage: event.target.value })
              }
              placeholder="50"
            />
            <input disabled value={beneficiary.usdtAmount} placeholder="Upcoming" title={PHASE_ONE_NOTES.usdt} />
            <input disabled value={beneficiary.xaut0Amount} placeholder="Upcoming" title={PHASE_ONE_NOTES.xaut0} />
          </div>
        ))}
      </div>
    </div>
  );
}
