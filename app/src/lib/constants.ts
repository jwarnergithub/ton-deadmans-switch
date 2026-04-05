import type { BeneficiaryDraft, DeadMansSwitchConfig } from "../types/app";

const createBeneficiary = (index: number): BeneficiaryDraft => ({
  id: `beneficiary-${index + 1}`,
  address: "",
  percentage: "",
  usdtAmount: "",
  xaut0Amount: "",
});

export const DEFAULT_BENEFICIARY_COUNT = 2;

export const DEFAULT_CONFIG: DeadMansSwitchConfig = {
  ownerAddress: "",
  beneficiaryCount: DEFAULT_BENEFICIARY_COUNT,
  livenessCode: "",
  livenessDurationMonths: 6,
  reservePlanningHorizonYears: 5,
  beneficiaries: Array.from({ length: DEFAULT_BENEFICIARY_COUNT }, (_, index) =>
    createBeneficiary(index),
  ),
};

export const PHASE_ONE_NOTES = {
  usdt: "USDT support is planned for a later phase and is intentionally disabled in this scaffold.",
  xaut0: "XAUT0 support is planned for a later phase and is intentionally disabled in this scaffold.",
};

export const APP_COPY = {
  appTitle: "TON Dead Man's Switch",
  appSubtitle:
    "Create a TON inheritance vault that the owner keeps alive with periodic check-ins and beneficiaries can execute if those check-ins stop.",
};
