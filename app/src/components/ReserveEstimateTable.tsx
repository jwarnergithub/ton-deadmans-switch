import type { DeploymentDraft } from "../types/app";

type Props = {
  deployment: DeploymentDraft;
};

export function ReserveEstimateTable({ deployment }: Props) {
  return (
    <div className="panel">
      <h3>Estimated reserve planning table</h3>
      <p>
        These are planning estimates only. The model assumes a fixed small TON cost per owner
        liveness check plus one payout recovery buffer, on top of the contract reserve floor.
      </p>
      <table className="estimate-table">
        <thead>
          <tr>
            <th>Longevity target</th>
            <th>Estimated TON reserve</th>
            <th>Reserve floor</th>
            <th>Liveness budget</th>
            <th>Recovery buffer</th>
          </tr>
        </thead>
        <tbody>
          {deployment.reserveTargets.map((target) => (
            <tr
              key={target.years}
              className={target.years === deployment.reservePlanningHorizonYears ? "estimate-row-selected" : ""}
            >
              <td>{target.years} years</td>
              <td>{target.estimatedTon} TON</td>
              <td>{target.reserveFloorTon} TON</td>
              <td>{target.livenessBudgetTon} TON</td>
              <td>{target.payoutRecoveryBufferTon} TON</td>
            </tr>
          ))}
        </tbody>
      </table>
      <p className="subtitle">
        Selected estimated reserve target: {deployment.estimatedReserveTon} TON for{" "}
        {deployment.reservePlanningHorizonYears} years.
      </p>
      <dl className="summary-list">
        <div>
          <dt>Assumed liveness checks per year</dt>
          <dd>{deployment.reserveModel.livenessChecksPerYear}</dd>
        </div>
        <div>
          <dt>Assumed TON per liveness check</dt>
          <dd>{deployment.reserveModel.tonPerLivenessCheck} TON</dd>
        </div>
        <div>
          <dt>Payout recovery buffer</dt>
          <dd>{deployment.reserveModel.payoutRecoveryBufferTon} TON</dd>
        </div>
      </dl>
      <ul className="warning-list">
        {deployment.reserveModel.notes.map((note) => (
          <li key={note}>{note}</li>
        ))}
      </ul>
    </div>
  );
}
