import { ReserveEstimateTable } from "../components/ReserveEstimateTable";
import { formatMonths, formatShareBasisPoints, formatTonAddress, formatTonNetwork } from "../lib/format";
import { sameTonAddress } from "../lib/tonCenter";
import type { AppState } from "../state/appState";

type Props = {
  state: AppState;
};

async function copyText(text: string) {
  await navigator.clipboard.writeText(text);
}

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
    return "Payout is complete. No further action is needed.";
  }

  if (expired) {
    return "This contract is expired. A beneficiary can trigger it with the word 'trigger' from a wallet comment, and if payout stalls later they can continue it after topping up if needed.";
  }

  return "The contract is still active. The owner can keep it alive by sending the configured liveness code from their wallet comment before the due date, or cancel the vault before expiry if payout has not started.";
}

function isConnectedWalletBeneficiary(state: AppState["contractState"], walletAddress: string) {
  if (!state?.decodedState || !walletAddress) {
    return false;
  }

  return state.decodedState.beneficiaries.some((beneficiary) =>
    sameTonAddress(beneficiary.address, walletAddress),
  );
}

function getAddressTypeLabel(state: AppState["contractState"]) {
  if (!state) {
    return "Unavailable";
  }

  if (state.contractKind === "matching") {
    return "Looks like this app's contract";
  }

  if (state.contractKind === "inactive") {
    return "Valid address, but inactive account";
  }

  if (state.contractKind === "not-matching") {
    return "Active account, but not recognized as this contract";
  }

  return "Unknown";
}

export function PostDeploySummaryPage({ state }: Props) {
  const {
    config,
    deployment,
    contractLookup,
    contractState,
    contractStateError,
    contractStateLoading,
    contractAction,
    wallet,
    actions,
  } = state;

  const targetAddress = contractLookup || deployment?.contractAddress || "";
  const matchedDeployment =
    deployment && targetAddress && sameTonAddress(targetAddress, deployment.contractAddress)
      ? deployment
      : null;
  const liveStateMatchesTarget =
    contractState && targetAddress ? sameTonAddress(contractState.address, targetAddress) : false;
  const beneficiaryWalletCanTriggerExpiry = isConnectedWalletBeneficiary(contractState, wallet.address);
  const nextDueAt = contractState?.getters?.liveness?.nextDueAt;
  const expiryWindowReached = nextDueAt ? Date.now() >= nextDueAt * 1000 : false;
  const canUseLiveActions = Boolean(
    wallet.isConnected &&
      contractState &&
      liveStateMatchesTarget &&
      contractState.contractKind === "matching",
  );

  return (
    <section className="page-grid">
      <div className="panel">
        <h2>Summary</h2>
        <p>
          Use this page for a fresh deployment or to reopen any existing contract later by address.
        </p>
        <p className="subtitle">Wallet network: {formatTonNetwork(wallet.chain)}</p>
        {contractStateLoading && <p className="subtitle">Loading live chain data...</p>}
        {contractStateError && <p className="error-text">{contractStateError}</p>}

        <h3>Live contract status</h3>
        {liveStateMatchesTarget && contractState ? (
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
                <dd>{getAddressTypeLabel(contractState)}</dd>
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
                <dt>Expired</dt>
                <dd>
                  {contractState.getters?.liveness
                    ? contractState.getters.liveness.expired
                      ? "Yes"
                      : "No"
                    : "Unavailable"}
                </dd>
              </div>
              <div>
                <dt>Completed</dt>
                <dd>
                  {contractState.getters?.liveness
                    ? contractState.getters.liveness.completed
                      ? "Yes"
                      : "No"
                    : "Unavailable"}
                </dd>
              </div>
              <div>
                <dt>Next due date</dt>
                <dd>
                  {contractState.getters?.liveness?.nextDueAt
                    ? new Date(contractState.getters.liveness.nextDueAt * 1000).toLocaleString()
                    : matchedDeployment
                      ? new Date(matchedDeployment.nextDueDateIso).toLocaleString()
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
                <dt>Last transaction LT</dt>
                <dd>{contractState.account.lastTransactionLt || "Unavailable"}</dd>
              </div>
              <div>
                <dt>Fetched at</dt>
                <dd>{new Date(contractState.fetchedAtIso).toLocaleString()}</dd>
              </div>
              <div>
                <dt>Payout guidance</dt>
                <dd>{getPayoutGuidance(contractState)}</dd>
              </div>
            </dl>
            {contractState.decodedState && (
              <>
                <h4>Beneficiary schedule</h4>
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
        ) : (
          <p>
            {targetAddress
              ? "Load live state to inspect this contract."
              : "Enter a contract address or use the latest deployment address to inspect a live contract."}
          </p>
        )}
      </div>

      <div className="panel">
        <h3>Contract actions</h3>
        <p>
          Use these after loading a live contract. The app sends a real TON Connect request and then
          refreshes on-chain state.
        </p>
        <p className="subtitle">
          Direct wallet workflow: the owner can send the exact liveness code as a wallet comment with a
          small TON amount, and after expiry a beneficiary can send the word <strong>trigger</strong> as a
          wallet comment with a small TON amount to trigger the dead man switch.
        </p>
        <label className="field">
          <span>Contract address</span>
          <input
            value={targetAddress}
            onChange={(event) => actions.setContractLookup(event.target.value)}
            placeholder="EQ..."
          />
        </label>
        <div className="hero-actions">
          {deployment && (
            <button
              className="button button-secondary"
              onClick={() =>
                actions.setContractLookup(
                  formatTonAddress(deployment.contractAddress, {
                    chain: deployment.walletRequest?.network ?? wallet.chain,
                  }),
                )
              }
            >
              Use latest deployed address
            </button>
          )}
          <button className="button" onClick={() => actions.refreshContractState(targetAddress)}>
            Load live state
          </button>
        </div>
        <p className="subtitle">
          Configured liveness code: {deployment?.configuredLivenessCode || config.livenessCode || "Not set"}
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
          <p className="subtitle">Connect a TON wallet before sending any live contract action.</p>
        )}
        {wallet.isConnected && contractState && contractState.contractKind !== "matching" && (
          <p className="subtitle">
            Live actions stay disabled until the loaded address looks like this app's contract.
          </p>
        )}
        {canUseLiveActions && contractState?.getters?.liveness?.expired && contractState.getters.liveness.completed !== true && (
          <p className="subtitle">
            This contract is expired and payout is not complete. If a payout run stops early, top up the
            contract and try resume payout again.
          </p>
        )}
        {canUseLiveActions &&
          !contractState?.getters?.liveness?.expired &&
          (contractState?.getters?.payout?.payoutIndex ?? 0) === 0 && (
            <p className="subtitle">
              Cancel vault is owner-only and only works before expiry and before any payout has started.
            </p>
          )}
        {wallet.isConnected && !beneficiaryWalletCanTriggerExpiry && (
          <p className="subtitle">
            Trigger dead man switch is only available when the connected wallet is one of the configured beneficiaries.
          </p>
        )}
        {wallet.isConnected && beneficiaryWalletCanTriggerExpiry && !expiryWindowReached && nextDueAt && (
          <p className="subtitle">
            Trigger dead man switch becomes available after the liveness deadline passes at{" "}
            {new Date(nextDueAt * 1000).toLocaleString()}.
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

      {deployment && <ReserveEstimateTable deployment={deployment} />}

      {deployment && (
        <div className="panel">
          <h3>Telegram Saved Messages reminder</h3>
          <p>
            This app does not send reminders for the user. After deploy, the user should create a manual
            reminder in Telegram Saved Messages using the text below.
          </p>
          <pre className="copy-block">{deployment.reminderText}</pre>
          <div className="hero-actions">
            <button className="button" onClick={() => copyText(deployment.reminderText)}>
              Copy reminder text
            </button>
            <button
              className="button button-secondary"
              onClick={() =>
                copyText(
                  formatTonAddress(deployment.contractAddress, {
                    chain: deployment.walletRequest?.network ?? wallet.chain,
                  }),
                )
              }
            >
              Copy contract address
            </button>
          </div>
          <ol className="ordered-list">
            <li>Open Telegram and go to Saved Messages.</li>
            <li>Paste the reminder text.</li>
            <li>Create a manual reminder for the next due date shown above.</li>
          </ol>
        </div>
      )}

      {deployment && (
        <div className="panel">
          <details className="debug-details">
            <summary>Debug deployment details</summary>
            <p>Data cell BOC (base64)</p>
            <pre className="copy-block">{deployment.initPackage.dataCellBase64}</pre>
            {deployment.walletRequest?.signedTransactionBoc && (
              <>
                <p>Signed transaction BOC (base64)</p>
                <pre className="copy-block">{deployment.walletRequest.signedTransactionBoc}</pre>
              </>
            )}
            <ul className="warning-list">
              {deployment.initPackage.warnings.map((warning) => (
                <li key={warning}>{warning}</li>
              ))}
            </ul>
          </details>
        </div>
      )}
    </section>
  );
}
