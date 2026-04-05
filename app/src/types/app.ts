import type {
  DeadMansSwitchInitPackage,
  ParsedDeadMansSwitchInitState,
} from "../../../shared/deadMansSwitchInit";
import type { ContractGetterState, TonCenterAccountInfo } from "../lib/tonCenter";

export type TonAddress = string;

export type BeneficiaryDraft = {
  id: string;
  address: TonAddress;
  percentage: string;
  usdtAmount: string;
  xaut0Amount: string;
};

export type DeadMansSwitchConfig = {
  ownerAddress: TonAddress;
  beneficiaryCount: number;
  livenessCode: string;
  livenessDurationMonths: number;
  reservePlanningHorizonYears: number;
  beneficiaries: BeneficiaryDraft[];
};

export type DeploymentStatus =
  | "idle"
  | "building"
  | "prepared"
  | "awaiting-wallet"
  | "success"
  | "error";

export type DeploymentDraft = {
  contractAddress: string;
  nextDueDateIso: string;
  configuredLivenessCode: string;
  estimatedReserveTon: string;
  reservePlanningHorizonYears: number;
  deployAmountNano: string;
  deployAmountTon: string;
  reserveTargets: Array<{
    years: number;
    estimatedTon: string;
    reserveFloorTon: string;
    livenessBudgetTon: string;
    payoutRecoveryBufferTon: string;
  }>;
  reserveModel: {
    livenessChecksPerYear: number;
    tonPerLivenessCheck: string;
    payoutRecoveryBufferTon: string;
    notes: string[];
  };
  reminderText: string;
  initPackage: DeadMansSwitchInitPackage;
  compiledCodeHashHex: string;
  stateInitBase64: string;
  codeCellBase64: string;
  dataCellBase64: string;
  walletRequest?: {
    from: string;
    network?: string;
    validUntil: number;
    requestedAtIso: string;
    signedTransactionBoc: string;
  };
};

export type WalletState = {
  isConnected: boolean;
  address: string;
  walletName: string;
  chain?: string;
};

export type ContractActionType = "owner-ping" | "trigger-expiry" | "resume-payout" | "top-up" | "cancel";

export type ContractActionState = {
  amountTon: string;
  livenessMessage: string;
  status: "idle" | "sending" | "success" | "error";
  error: string;
  lastAction?: {
    type: ContractActionType;
    requestedAtIso: string;
    signedTransactionBoc: string;
  };
};

export type ContractLookupState = {
  address: string;
  normalizedAddress: string;
  network?: string;
  fetchedAtIso: string;
  account: TonCenterAccountInfo;
  getters?: ContractGetterState;
  decodedState?: ParsedDeadMansSwitchInitState;
  contractKind: "matching" | "inactive" | "not-matching" | "unknown";
  issues: string[];
  matchesCompiledCode?: boolean;
  matchesPreparedData?: boolean;
  diagnostics: {
    deploymentAddressMatches?: boolean;
    onChainCodePresent: boolean;
    onChainDataPresent: boolean;
    onChainCodeHashHex?: string;
    onChainDataHashHex?: string;
    expectedCodeHashHex?: string;
    getterError?: string;
  };
};

export type RouteKey =
  | "landing"
  | "configure"
  | "review"
  | "deploy"
  | "summary";
