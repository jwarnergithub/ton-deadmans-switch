import { useEffect, useMemo, useState } from "react";
import { useTonConnectUI, useTonWallet } from "@tonconnect/ui-react";
import { parseDeadMansSwitchDataCellBase64 } from "../../../shared/deadMansSwitchInit";
import { DEFAULT_CONFIG } from "../lib/constants";
import { buildMockDeployment } from "../lib/mockTon";
import {
  buildCancelTransactionRequest,
  buildDeployTransactionRequest,
  buildOwnerPingTransactionRequest,
  buildResumePayoutTransactionRequest,
  buildTopUpTransactionRequest,
  buildTriggerExpiryTransactionRequest,
} from "../lib/tonConnect";
import {
  fetchContractAccountInfo,
  fetchContractGetterState,
  getCellHashHex,
  normalizeTonAddress,
  sameTonAddress,
} from "../lib/tonCenter";
import { formatTonAddress } from "../lib/format";
import type {
  BeneficiaryDraft,
  ContractActionType,
  DeadMansSwitchConfig,
  ContractLookupState,
  DeploymentDraft,
  DeploymentStatus,
  RouteKey,
  WalletState,
} from "../types/app";

const validRoutes: RouteKey[] = [
  "landing",
  "configure",
  "review",
  "deploy",
  "summary",
];

function parseRouteFromHash(hash: string): RouteKey {
  const normalized = hash.replace("#", "");
  return validRoutes.includes(normalized as RouteKey) ? (normalized as RouteKey) : "landing";
}

function syncBeneficiaryCount(
  beneficiaries: BeneficiaryDraft[],
  nextCount: number,
): BeneficiaryDraft[] {
  const next = [...beneficiaries];

  while (next.length < nextCount) {
    next.push({
      id: `beneficiary-${next.length + 1}`,
      address: "",
      percentage: "",
      usdtAmount: "",
      xaut0Amount: "",
    });
  }

  return next.slice(0, nextCount);
}

const STORAGE_KEYS = {
  config: "ton-dms-config",
  deployment: "ton-dms-deployment",
  contractLookup: "ton-dms-contract-lookup",
  ownerPingMessage: "ton-dms-owner-ping-message",
} as const;

function readStorageValue<T>(key: string, fallback: T) {
  try {
    const raw = window.localStorage.getItem(key);
    return raw ? (JSON.parse(raw) as T) : fallback;
  } catch {
    return fallback;
  }
}

function hydrateConfig() {
  const stored = readStorageValue<Partial<DeadMansSwitchConfig>>(STORAGE_KEYS.config, {});
  const beneficiaryCount = stored.beneficiaryCount ?? DEFAULT_CONFIG.beneficiaryCount;

  return {
    ...DEFAULT_CONFIG,
    ...stored,
    beneficiaries: syncBeneficiaryCount(
      stored.beneficiaries ?? DEFAULT_CONFIG.beneficiaries,
      beneficiaryCount,
    ),
  } satisfies DeadMansSwitchConfig;
}

export function useAppState() {
  const walletAccount = useTonWallet();
  const [tonConnectUI] = useTonConnectUI();
  const [route, setRoute] = useState<RouteKey>(() => parseRouteFromHash(window.location.hash));
  const [config, setConfig] = useState<DeadMansSwitchConfig>(() => hydrateConfig());
  const [deploymentStatus, setDeploymentStatus] = useState<DeploymentStatus>("idle");
  const [deployment, setDeployment] = useState<DeploymentDraft | null>(() =>
    readStorageValue<DeploymentDraft | null>(STORAGE_KEYS.deployment, null),
  );
  const [contractLookup, setContractLookup] = useState(() =>
    readStorageValue<string>(STORAGE_KEYS.contractLookup, ""),
  );
  const [deploymentError, setDeploymentError] = useState("");
  const [contractState, setContractState] = useState<ContractLookupState | null>(null);
  const [contractStateError, setContractStateError] = useState("");
  const [contractStateLoading, setContractStateLoading] = useState(false);
  const [contractActionAmountTon, setContractActionAmountTon] = useState("0.05");
  const [ownerPingMessage, setOwnerPingMessage] = useState(() =>
    readStorageValue<string>(STORAGE_KEYS.ownerPingMessage, ""),
  );
  const [contractActionStatus, setContractActionStatus] = useState<"idle" | "sending" | "success" | "error">("idle");
  const [contractActionError, setContractActionError] = useState("");
  const [lastContractAction, setLastContractAction] = useState<
    | {
        type: ContractActionType;
        requestedAtIso: string;
        signedTransactionBoc: string;
      }
    | undefined
  >(undefined);

  const wallet: WalletState = useMemo(
    () => ({
      isConnected: Boolean(walletAccount),
      address: walletAccount?.account.address ?? "",
      walletName: walletAccount?.device.appName ?? "",
      chain: walletAccount?.account.chain,
    }),
    [walletAccount],
  );

  useEffect(() => {
    const onHashChange = () => {
      setRoute(parseRouteFromHash(window.location.hash));
    };

    window.addEventListener("hashchange", onHashChange);
    return () => window.removeEventListener("hashchange", onHashChange);
  }, []);

  useEffect(() => {
    if (wallet.address) {
      setConfig((current) => ({
        ...current,
        ownerAddress: formatTonAddress(wallet.address, { chain: wallet.chain }),
      }));
    }
  }, [wallet.address, wallet.chain]);

  useEffect(() => {
    setOwnerPingMessage((current) => {
      if (!config.livenessCode) {
        return current;
      }

      if (!current || current.length <= 1) {
        return config.livenessCode;
      }

      return current;
    });
  }, [config.livenessCode]);

  useEffect(() => {
    window.localStorage.setItem(STORAGE_KEYS.config, JSON.stringify(config));
  }, [config]);

  useEffect(() => {
    if (deployment) {
      window.localStorage.setItem(STORAGE_KEYS.deployment, JSON.stringify(deployment));
    } else {
      window.localStorage.removeItem(STORAGE_KEYS.deployment);
    }
  }, [deployment]);

  useEffect(() => {
    if (contractLookup) {
      window.localStorage.setItem(STORAGE_KEYS.contractLookup, JSON.stringify(contractLookup));
    } else {
      window.localStorage.removeItem(STORAGE_KEYS.contractLookup);
    }
  }, [contractLookup]);

  useEffect(() => {
    if (ownerPingMessage) {
      window.localStorage.setItem(STORAGE_KEYS.ownerPingMessage, JSON.stringify(ownerPingMessage));
    } else {
      window.localStorage.removeItem(STORAGE_KEYS.ownerPingMessage);
    }
  }, [ownerPingMessage]);

  async function loadContractState(targetAddress: string, network?: string) {
    const normalizedAddress = normalizeTonAddress(targetAddress);
    const account = await fetchContractAccountInfo(normalizedAddress, network);
    const issues: string[] = [];
    let getters: ContractLookupState["getters"];
    let decodedState: ContractLookupState["decodedState"];
    let getterError: string | undefined;
    const deploymentAddressMatches = deployment
      ? sameTonAddress(deployment.contractAddress, normalizedAddress)
      : undefined;
    const onChainCodeHashHex = getCellHashHex(account.codeBase64);
    const onChainDataHashHex = getCellHashHex(account.dataBase64);

    if (account.lifecycleState === "uninitialized") {
      issues.push("This address is valid, but no contract is deployed there yet.");
    } else if (account.lifecycleState === "frozen") {
      issues.push("This account is frozen, so live getter reads are not available.");
    } else if (account.lifecycleState === "unknown") {
      issues.push("TON Center returned an unknown account state for this address.");
    }

    if (account.lifecycleState === "active") {
      try {
        getters = await fetchContractGetterState(normalizedAddress, network);
      } catch (error) {
        getterError =
          error instanceof Error ? error.message : "Live getters did not match this app's expected contract interface.";
        issues.push(getterError);
      }

      if (account.dataBase64) {
        try {
          decodedState = parseDeadMansSwitchDataCellBase64(account.dataBase64);
        } catch {
          issues.push("The on-chain data cell could not be decoded as this dead man's switch layout.");
        }
      } else {
        issues.push("This active account did not expose a readable data cell.");
      }
    }

    const contractKind =
      account.lifecycleState !== "active"
        ? "inactive"
        : getters || decodedState
          ? "matching"
          : issues.length > 0
            ? "not-matching"
            : "unknown";

    const displayAddress = formatTonAddress(normalizedAddress, { chain: network });
    setContractLookup(displayAddress);
    setContractState({
      address: normalizedAddress,
      normalizedAddress,
      network,
      fetchedAtIso: new Date().toISOString(),
      getters,
      decodedState,
      contractKind,
      issues,
      matchesCompiledCode:
        deployment && deploymentAddressMatches
          ? account.codeBase64 === deployment.codeCellBase64
          : undefined,
      matchesPreparedData:
        deployment && deploymentAddressMatches
          ? account.dataBase64 === deployment.dataCellBase64
          : undefined,
      diagnostics: {
        deploymentAddressMatches,
        onChainCodePresent: Boolean(account.codeBase64),
        onChainDataPresent: Boolean(account.dataBase64),
        onChainCodeHashHex,
        onChainDataHashHex,
        expectedCodeHashHex: deployment?.compiledCodeHashHex,
        getterError,
      },
      account,
    });
  }

  const actions = useMemo(
    () => ({
      navigate(nextRoute: RouteKey) {
        setRoute(nextRoute);
        window.location.hash = nextRoute;
      },
      async connectWallet() {
        await tonConnectUI.openModal();
      },
      async disconnectWallet() {
        await tonConnectUI.disconnect();
        },
      updateConfig(patch: Partial<DeadMansSwitchConfig>) {
        setConfig((current) => {
          const nextCount = patch.beneficiaryCount ?? current.beneficiaryCount;
          const merged = {
            ...current,
            ...patch,
          };

          return {
            ...merged,
            beneficiaries: syncBeneficiaryCount(
              patch.beneficiaries ?? merged.beneficiaries,
              nextCount,
            ),
          };
        });
      },
      updateBeneficiary(index: number, patch: Partial<BeneficiaryDraft>) {
        setConfig((current) => ({
          ...current,
          beneficiaries: current.beneficiaries.map((entry, entryIndex) =>
            entryIndex === index ? { ...entry, ...patch } : entry,
          ),
        }));
      },
      async startDeployment() {
        setDeploymentError("");
        setDeploymentStatus("building");
        setOwnerPingMessage(config.livenessCode);
        try {
          await new Promise((resolve) => window.setTimeout(resolve, 500));
          setDeployment(buildMockDeployment(config));
          setDeploymentStatus("prepared");
        } catch (error) {
          setDeploymentStatus("error");
          setDeploymentError(error instanceof Error ? error.message : "Failed to prepare deployment config.");
        }
      },
      async requestDeploymentTransaction() {
        setDeploymentError("");

        if (!wallet.address) {
          setDeploymentStatus("error");
          setDeploymentError("Connect a TON wallet before requesting deployment.");
          return;
        }

        try {
          const preparedDeployment = deployment ?? buildMockDeployment(config);
          setOwnerPingMessage(config.livenessCode);
          const request = buildDeployTransactionRequest(
            preparedDeployment,
            wallet.address,
            wallet.chain,
          );
          setDeployment(preparedDeployment);
          setDeploymentStatus("awaiting-wallet");
          const result = await tonConnectUI.sendTransaction(request);
          setDeployment({
            ...preparedDeployment,
            walletRequest: {
              from: request.from ?? wallet.address,
              network: request.network,
              validUntil: request.validUntil,
              requestedAtIso: new Date().toISOString(),
              signedTransactionBoc: result.boc,
            },
          });
          setContractStateLoading(true);
          setContractStateError("");
          try {
            await loadContractState(preparedDeployment.contractAddress, wallet.chain);
          } catch (lookupError) {
            setContractStateError(
              lookupError instanceof Error
                ? lookupError.message
                : "Unable to fetch live contract state after wallet request.",
            );
          } finally {
            setContractStateLoading(false);
          }
          setDeploymentStatus("success");
          setRoute("summary");
          window.location.hash = "summary";
        } catch (error) {
          tonConnectUI.closeModal();
          setDeploymentStatus("error");
          setDeploymentError(
            error instanceof Error ? error.message : "Wallet transaction request failed.",
          );
        }
      },
      failDeployment() {
        setDeploymentStatus("error");
        setDeploymentError("Simulated wallet rejection.");
      },
      resetDeployment() {
        setDeploymentStatus("idle");
        setDeployment(null);
        setDeploymentError("");
        setContractState(null);
        setContractStateError("");
        setContractStateLoading(false);
        setOwnerPingMessage(config.livenessCode);
      },
      setContractLookup,
      async refreshContractState(address?: string) {
        const rawTargetAddress = address ?? contractLookup ?? deployment?.contractAddress ?? "";

        if (!rawTargetAddress) {
          setContractStateError("Enter or prepare a contract address before loading live state.");
          return;
        }

        setContractStateLoading(true);
        setContractStateError("");

        try {
          await loadContractState(rawTargetAddress, wallet.chain);
        } catch (error) {
          setContractStateError(
            error instanceof Error ? error.message : "Unable to fetch live contract state.",
          );
        } finally {
          setContractStateLoading(false);
        }
      },
      setContractActionAmountTon,
      setOwnerPingMessage,
      clearContractActionFeedback() {
        setContractActionStatus("idle");
        setContractActionError("");
      },
      async sendOwnerPing() {
        const targetAddress = contractState?.address ?? deployment?.contractAddress ?? contractLookup;

        if (!wallet.address) {
          setContractActionStatus("error");
          setContractActionError("Connect a TON wallet before sending an owner ping.");
          return;
        }

        if (!targetAddress) {
          setContractActionStatus("error");
          setContractActionError("Load a contract before sending an owner ping.");
          return;
        }

        try {
          setContractActionStatus("sending");
          setContractActionError("");
          const request = buildOwnerPingTransactionRequest({
            contractAddress: targetAddress,
            walletAddress: wallet.address,
            network: wallet.chain,
            amountTon: contractActionAmountTon,
            livenessMessage: ownerPingMessage,
          });
          const result = await tonConnectUI.sendTransaction(request);
          setLastContractAction({
            type: "owner-ping",
            requestedAtIso: new Date().toISOString(),
            signedTransactionBoc: result.boc,
          });
          setContractActionStatus("success");
          setContractStateLoading(true);
          try {
            await loadContractState(targetAddress, wallet.chain);
          } finally {
            setContractStateLoading(false);
          }
        } catch (error) {
          tonConnectUI.closeModal();
          setContractActionStatus("error");
          setContractActionError(
            error instanceof Error ? error.message : "Owner ping transaction request failed.",
          );
        }
      },
      async sendTriggerExpiry() {
        const targetAddress = contractState?.address ?? deployment?.contractAddress ?? contractLookup;

        if (!wallet.address) {
          setContractActionStatus("error");
          setContractActionError("Connect a TON wallet before triggering expiry.");
          return;
        }

        if (!targetAddress) {
          setContractActionStatus("error");
          setContractActionError("Load a contract before triggering expiry.");
          return;
        }

        try {
          setContractActionStatus("sending");
          setContractActionError("");
          const request = buildTriggerExpiryTransactionRequest({
            contractAddress: targetAddress,
            walletAddress: wallet.address,
            network: wallet.chain,
            amountTon: contractActionAmountTon,
          });
          const result = await tonConnectUI.sendTransaction(request);
          setLastContractAction({
            type: "trigger-expiry",
            requestedAtIso: new Date().toISOString(),
            signedTransactionBoc: result.boc,
          });
          setContractActionStatus("success");
          setContractStateLoading(true);
          try {
            await loadContractState(targetAddress, wallet.chain);
          } finally {
            setContractStateLoading(false);
          }
        } catch (error) {
          tonConnectUI.closeModal();
          setContractActionStatus("error");
          setContractActionError(
            error instanceof Error ? error.message : "Expiry trigger transaction request failed.",
          );
        }
      },
      async sendResumePayout() {
        const targetAddress = contractState?.address ?? deployment?.contractAddress ?? contractLookup;

        if (!wallet.address) {
          setContractActionStatus("error");
          setContractActionError("Connect a TON wallet before resuming payout.");
          return;
        }

        if (!targetAddress) {
          setContractActionStatus("error");
          setContractActionError("Load a contract before resuming payout.");
          return;
        }

        try {
          setContractActionStatus("sending");
          setContractActionError("");
          const request = buildResumePayoutTransactionRequest({
            contractAddress: targetAddress,
            walletAddress: wallet.address,
            network: wallet.chain,
            amountTon: contractActionAmountTon,
          });
          const result = await tonConnectUI.sendTransaction(request);
          setLastContractAction({
            type: "resume-payout",
            requestedAtIso: new Date().toISOString(),
            signedTransactionBoc: result.boc,
          });
          setContractActionStatus("success");
          setContractStateLoading(true);
          try {
            await loadContractState(targetAddress, wallet.chain);
          } finally {
            setContractStateLoading(false);
          }
        } catch (error) {
          tonConnectUI.closeModal();
          setContractActionStatus("error");
          setContractActionError(
            error instanceof Error ? error.message : "Resume payout transaction request failed.",
          );
        }
      },
      async sendTopUp() {
        const targetAddress = contractState?.address ?? deployment?.contractAddress ?? contractLookup;

        if (!wallet.address) {
          setContractActionStatus("error");
          setContractActionError("Connect a TON wallet before topping up the contract.");
          return;
        }

        if (!targetAddress) {
          setContractActionStatus("error");
          setContractActionError("Load a contract before sending a top-up.");
          return;
        }

        try {
          setContractActionStatus("sending");
          setContractActionError("");
          const request = buildTopUpTransactionRequest({
            contractAddress: targetAddress,
            walletAddress: wallet.address,
            network: wallet.chain,
            amountTon: contractActionAmountTon,
          });
          const result = await tonConnectUI.sendTransaction(request);
          setLastContractAction({
            type: "top-up",
            requestedAtIso: new Date().toISOString(),
            signedTransactionBoc: result.boc,
          });
          setContractActionStatus("success");
          setContractStateLoading(true);
          try {
            await loadContractState(targetAddress, wallet.chain);
          } finally {
            setContractStateLoading(false);
          }
        } catch (error) {
          tonConnectUI.closeModal();
          setContractActionStatus("error");
          setContractActionError(
            error instanceof Error ? error.message : "Top-up transaction request failed.",
          );
        }
      },
      async sendCancel() {
        const targetAddress = contractState?.address ?? deployment?.contractAddress ?? contractLookup;

        if (!wallet.address) {
          setContractActionStatus("error");
          setContractActionError("Connect a TON wallet before cancelling the contract.");
          return;
        }

        if (!targetAddress) {
          setContractActionStatus("error");
          setContractActionError("Load a contract before requesting cancellation.");
          return;
        }

        try {
          setContractActionStatus("sending");
          setContractActionError("");
          const request = buildCancelTransactionRequest({
            contractAddress: targetAddress,
            walletAddress: wallet.address,
            network: wallet.chain,
            amountTon: contractActionAmountTon,
          });
          const result = await tonConnectUI.sendTransaction(request);
          setLastContractAction({
            type: "cancel",
            requestedAtIso: new Date().toISOString(),
            signedTransactionBoc: result.boc,
          });
          setContractActionStatus("success");
          setContractStateLoading(true);
          try {
            await loadContractState(targetAddress, wallet.chain);
          } catch {
            setContractState(null);
            setContractLookup(formatTonAddress(targetAddress, { chain: wallet.chain }));
          } finally {
            setContractStateLoading(false);
          }
        } catch (error) {
          tonConnectUI.closeModal();
          setContractActionStatus("error");
          setContractActionError(
            error instanceof Error ? error.message : "Cancel transaction request failed.",
          );
        }
      },
    }),
    [
      config,
      contractLookup,
      contractState?.address,
      contractActionAmountTon,
      deployment,
      ownerPingMessage,
      tonConnectUI,
      wallet.address,
      wallet.chain,
    ],
  );

  return {
    route,
    wallet,
    config,
    deploymentStatus,
    deployment,
    contractLookup,
    contractState,
    contractStateError,
    contractStateLoading,
    contractAction: {
      amountTon: contractActionAmountTon,
      livenessMessage: ownerPingMessage,
      status: contractActionStatus,
      error: contractActionError,
      lastAction: lastContractAction,
    },
    deploymentError,
    actions,
  };
}

export type AppState = ReturnType<typeof useAppState>;
