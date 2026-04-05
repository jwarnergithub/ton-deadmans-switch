import { formatShareBasisPoints, formatTonAddress, formatTonNetwork } from "../lib/format";
import { sameTonAddress } from "../lib/tonCenter";
import type { AppState } from "../state/appState";

type Props = {
  state: AppState;
};

function getBeneficiaryStatus(index: number, payoutIndex?: number, completed?: boolean) {
  if (completed) {
    return "Paid";
  }

  if (payoutIndex === undefined) {
    return "Scheduled";
  }

  if (index < payoutIndex) {
    return "Paid";
  }

  if (index === payoutIndex) {
    return "Next";
  }

  return "Pending";
}

function formatNanoToTon(value: string) {
  const amount = BigInt(value || "0");
  const whole = amount / 1_000_000_000n;
  const fraction = (amount % 1_000_000_000n).toString().padStart(9, "0").replace(/0+$/, "");
  return fraction ? `${whole}.${fraction}` : whole.toString();
}

function getPayoutGuidance(state: AppState["contractState"]) {
  const expired = state?.getters?.liveness?.expired;
  const completed = state?.getters?.liveness?.completed;

  if (completed) {
    return "Payout is complete.";
  }

  if (expired) {
    return "This contract is expired. If payout is not finished, top up the contract if needed and send resume payout.";
  }

  return "This contract is still waiting for the next owner liveness ping. The owner can also cancel it before expiry if payout has not started.";
}

function isConnectedWalletBeneficiary(state: AppState["contractState"], walletAddress: string) {
  if (!state?.decodedState || !walletAddress) {
    return false;
  }

  return state.decodedState.beneficiaries.some((beneficiary) =>
    sameTonAddress(beneficiary.address, walletAddress),
  );
}

export function ContractViewPage({ state }: Props) {
  const {
    contractLookup,
    contractState,
    contractStateError,
    contractStateLoading,
    contractAction,
    deployment,
    wallet,
    actions,
  } = state;

  const matchedDeployment = deployment && sameTonAddress(contractLookup, deployment.contractAddress) ? deployment : null;
  const canUseLiveActions = Boolean(
    wallet.isConnected &&
      contractState &&
      sameTonAddress(contractState.address, contractLookup) &&
      contractState.contractKind === "matching",
  );
  const beneficiaryWalletCanTriggerExpiry = isConnectedWalletBeneficiary(contractState, wallet.address);
  const nextDueAt = contractState?.getters?.liveness?.nextDueAt;
  const expiryWindowReached = nextDueAt ? Date.now() >= nextDueAt * 1000 : false;

  return (
    <section className="page-grid">
      <div className="panel">
        <h2>Contract view</h2>
        <p>
          Use this page to inspect any existing TON address after a refresh or to look up a contract
          someone already deployed. It will tell you whether the address is inactive, looks like this
          dead man's switch contract, or appears to be some other contract entirely.
        </p>
        <label className="field">
          <span>Contract address</span>
          <input
            value={contractLookup}
            onChange={(event) => actions.setContractLookup(event.target.value)}
            placeholder="EQ..."
          />
        </label>
        {deployment && (
          <p className="subtitle">
            Tip: use the deployed contract address shown on the summary page:{" "}
            {formatTonAddress(deployment.contractAddress, { chain: wallet.chain })}
          </p>
        )}
        <div className="hero-actions">
          <button className="button" onClick={() => actions.refreshContractState(contractLookup)}>
            Load live state
          </button>
        </div>
        <p className="subtitle">Wallet network: {formatTonNetwork(wallet.chain)}</p>
        {contractStateLoading && <p className="subtitle">Loading live chain data...</p>}
        {contractStateError && <p className="error-text">{contractStateError}</p>}
      </div>

      <div className="panel">
        <h3>Current state</h3>
        {contractState && sameTonAddress(contractState.address, contractLookup) ? (
          <>
            {contractState.issues.length > 0 && (
              <div className="panel panel-warning">
                <h4>Lookup notes</h4>
                <ul className="warning-list">
                  {contractState.issues.map((issue) => (
                    <li key={issue}>{issue}</li>
                  ))}
                </ul>
              </div>
            )}
            <dl className="summary-list">
              <div>
                <dt>Address type</dt>
                <dd>
                  {contractState.contractKind === "matching"
                    ? "Looks like this app's contract"
                    : contractState.contractKind === "inactive"
                      ? "Valid address, but inactive account"
                      : contractState.contractKind === "not-matching"
                        ? "Active account, but not recognized as this contract"
                        : "Unknown"}
                </dd>
              </div>
              <div>
                <dt>Lookup network</dt>
                <dd>{formatTonNetwork(contractState.network)}</dd>
              </div>
              <div>
                <dt>Lifecycle state</dt>
                <dd>{contractState.account.lifecycleState}</dd>
              </div>
              <div>
                <dt>Balance</dt>
                <dd>{contractState.account.balanceTon} TON</dd>
              </div>
              <div>
                <dt>Last transaction LT</dt>
                <dd>{contractState.account.lastTransactionLt || "Unavailable"}</dd>
              </div>
              <div>
                <dt>Sync time</dt>
                <dd>
                  {contractState.account.syncUtime
                    ? new Date(contractState.account.syncUtime * 1000).toLocaleString()
                    : "Unavailable"}
                </dd>
              </div>
              <div>
                <dt>Expired</dt>
                <dd>{contractState.getters?.liveness ? (contractState.getters.liveness.expired ? "Yes" : "No") : "Unavailable"}</dd>
              </div>
              <div>
                <dt>Completed</dt>
                <dd>{contractState.getters?.liveness ? (contractState.getters.liveness.completed ? "Yes" : "No") : "Unavailable"}</dd>
              </div>
              <div>
                <dt>Next due date</dt>
                <dd>
                  {contractState.getters?.liveness?.nextDueAt
                    ? new Date(contractState.getters.liveness.nextDueAt * 1000).toLocaleString()
                    : "Unavailable"}
                </dd>
              </div>
              <div>
                <dt>Payout cursor</dt>
                <dd>{contractState.getters?.payout ? contractState.getters.payout.payoutIndex : "Unavailable"}</dd>
              </div>
              <div>
                <dt>Reserve floor</dt>
                <dd>
                  {contractState.getters?.payout
                    ? `${contractState.getters.payout.minimumReserveFloorTon} TON`
                    : "Unavailable"}
                </dd>
              </div>
              <div>
                <dt>Payout guidance</dt>
                <dd>{getPayoutGuidance(contractState)}</dd>
              </div>
            </dl>
            <details className="debug-details">
              <summary>Advanced diagnostics</summary>
              <dl className="summary-list">
                <div>
                  <dt>Compiled code match</dt>
                  <dd>{contractState.matchesCompiledCode === undefined ? "Unknown" : contractState.matchesCompiledCode ? "Yes" : "No"}</dd>
                </div>
                <div>
                  <dt>Deployment address match</dt>
                  <dd>
                    {contractState.diagnostics.deploymentAddressMatches === undefined
                      ? "Unknown"
                      : contractState.diagnostics.deploymentAddressMatches
                        ? "Yes"
                        : "No"}
                  </dd>
                </div>
                <div>
                  <dt>Prepared data match</dt>
                  <dd>{contractState.matchesPreparedData === undefined ? "Unknown" : contractState.matchesPreparedData ? "Yes" : "No"}</dd>
                </div>
                <div>
                  <dt>On-chain code cell</dt>
                  <dd>{contractState.diagnostics.onChainCodePresent ? "Present" : "Unavailable"}</dd>
                </div>
                <div>
                  <dt>On-chain data cell</dt>
                  <dd>{contractState.diagnostics.onChainDataPresent ? "Present" : "Unavailable"}</dd>
                </div>
                <div>
                  <dt>Expected code hash</dt>
                  <dd>{contractState.diagnostics.expectedCodeHashHex || "Unavailable"}</dd>
                </div>
                <div>
                  <dt>On-chain code hash</dt>
                  <dd>{contractState.diagnostics.onChainCodeHashHex || "Unavailable"}</dd>
                </div>
                <div>
                  <dt>On-chain data hash</dt>
                  <dd>{contractState.diagnostics.onChainDataHashHex || "Unavailable"}</dd>
                </div>
                <div>
                  <dt>Getter diagnostic</dt>
                  <dd>{contractState.diagnostics.getterError || "Getters loaded successfully"}</dd>
                </div>
              </dl>
            </details>
            {contractState.decodedState && (
              <>
                <h3>Beneficiary schedule</h3>
                <dl className="summary-list">
                  {contractState.decodedState.beneficiaries.map((beneficiary) => (
                    <div key={`${beneficiary.index}-${beneficiary.address}`}>
                      <dt>Beneficiary {beneficiary.index + 1}</dt>
                      <dd>
                        {formatTonAddress(beneficiary.address, { chain: contractState.network })}
                        {" • "}
                        {formatShareBasisPoints(beneficiary.shareBasisPoints)}%
                        {" • "}
                        {getBeneficiaryStatus(
                          beneficiary.index,
                          contractState.getters?.payout?.payoutIndex,
                          contractState.getters?.liveness?.completed,
                        )}
                      </dd>
                    </div>
                  ))}
                </dl>
              </>
            )}
          </>
        ) : matchedDeployment ? (
          <dl className="summary-list">
            <div>
              <dt>Expired</dt>
              <dd>No</dd>
            </div>
            <div>
              <dt>Completed</dt>
              <dd>No</dd>
            </div>
            <div>
              <dt>Next due date estimate</dt>
              <dd>{new Date(matchedDeployment.nextDueDateIso).toLocaleString()}</dd>
            </div>
            <div>
              <dt>Payout cursor</dt>
              <dd>0</dd>
            </div>
          </dl>
        ) : (
          <p>No contract data loaded yet.</p>
        )}
      </div>

      <div className="panel">
        <h3>Live actions</h3>
        <p>
          Use these only after loading a live contract. The app sends a real TON Connect request and
          then refreshes on-chain state.
        </p>
        <label className="field">
          <span>Small TON amount to cover the contract call</span>
          <input
            value={contractAction.amountTon}
            onChange={(event) => actions.setContractActionAmountTon(event.target.value)}
            placeholder="0.05"
          />
        </label>
        <p className="subtitle">
          Most wallets require a small non-zero TON amount for contract calls. This is for execution,
          not an extra payout amount.
        </p>
        <label className="field">
          <span>Owner ping liveness message</span>
          <input
            value={contractAction.livenessMessage}
            onChange={(event) => actions.setOwnerPingMessage(event.target.value)}
            placeholder="Enter the configured liveness code"
          />
        </label>
        <div className="hero-actions">
          <button
            className="button"
            onClick={actions.sendTopUp}
            disabled={!canUseLiveActions || contractAction.status === "sending"}
          >
            Top up contract
          </button>
          <button
            className="button button-secondary"
            onClick={actions.sendCancel}
            disabled={
              !canUseLiveActions ||
              contractAction.status === "sending" ||
              contractState?.getters?.liveness?.expired === true ||
              contractState?.getters?.liveness?.completed === true ||
              (contractState?.getters?.payout?.payoutIndex ?? 0) > 0
            }
          >
            Cancel vault
          </button>
          <button
            className="button"
            onClick={actions.sendOwnerPing}
            disabled={!canUseLiveActions || contractAction.status === "sending"}
          >
            Send owner ping
          </button>
          <button
            className="button"
            onClick={actions.sendTriggerExpiry}
            disabled={
              !canUseLiveActions ||
              contractAction.status === "sending" ||
              contractState?.getters?.liveness?.expired === true ||
              !beneficiaryWalletCanTriggerExpiry ||
              !expiryWindowReached
            }
          >
            Trigger dead man switch
          </button>
          <button
            className="button"
            onClick={actions.sendResumePayout}
            disabled={
              !canUseLiveActions ||
              contractAction.status === "sending" ||
              contractState?.getters?.liveness?.expired !== true ||
              contractState?.getters?.liveness?.completed === true
            }
          >
            Continue stalled payout
          </button>
        </div>
        {!wallet.isConnected && (
          <p className="subtitle">Connect a TON wallet before sending a live contract action.</p>
        )}
        {wallet.isConnected && contractState && contractState.contractKind !== "matching" && (
          <p className="subtitle">
            Live actions stay disabled until the loaded address looks like this app's contract.
          </p>
        )}
        {canUseLiveActions && !beneficiaryWalletCanTriggerExpiry && (
          <p className="subtitle">
            Trigger dead man switch is only available when the connected wallet is one of the configured beneficiaries.
          </p>
        )}
        {canUseLiveActions && beneficiaryWalletCanTriggerExpiry && !expiryWindowReached && nextDueAt && (
          <p className="subtitle">
            Trigger dead man switch becomes available after the liveness deadline passes at{" "}
            {new Date(nextDueAt * 1000).toLocaleString()}.
          </p>
        )}
        {canUseLiveActions &&
          !contractState?.getters?.liveness?.expired &&
          (contractState?.getters?.payout?.payoutIndex ?? 0) === 0 && (
            <p className="subtitle">
              Cancel vault is owner-only and only works before expiry and before any payout has started.
            </p>
          )}
        {contractState?.getters?.liveness?.expired && contractState.getters.liveness.completed !== true && (
          <p className="subtitle">
            If payout does not finish in one call, send additional TON to this contract and then use
            resume payout again.
          </p>
        )}
        {contractAction.status === "success" && contractAction.lastAction && (
          <p className="subtitle">
            Last action: {contractAction.lastAction.type} at{" "}
            {new Date(contractAction.lastAction.requestedAtIso).toLocaleString()}
          </p>
        )}
        {contractAction.error && <p className="error-text">{contractAction.error}</p>}
      </div>
    </section>
  );
}
