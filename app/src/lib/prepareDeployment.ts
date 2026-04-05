import { prepareDeadMansSwitchVaultStateInit } from "../../../wrappers/DeadMansSwitchVault";
import { addMonthsToNow, FIVE_MINUTE_TEST_DURATION_MONTHS } from "./format";
import { prepareInitPackageFromConfig } from "./contractConfig";
import type { DeadMansSwitchConfig, DeploymentDraft } from "../types/app";

const RESERVE_TARGET_YEARS = [5, 10, 15, 20, 25];
const TON_PER_LIVENESS_CHECK = 0.05;
const PAYOUT_RECOVERY_BUFFER_TON = 0.3;

function formatTonAmount(value: number) {
  return value.toFixed(2);
}

function formatNanoToTon(nano: string) {
  const value = BigInt(nano);
  const whole = value / 1_000_000_000n;
  const fraction = (value % 1_000_000_000n).toString().padStart(9, "0").replace(/0+$/, "");
  return fraction ? `${whole}.${fraction}` : whole.toString();
}

export function prepareDeploymentPreview(config: DeadMansSwitchConfig): DeploymentDraft {
  const initPackage = prepareInitPackageFromConfig(config);
  const preparedStateInit = prepareDeadMansSwitchVaultStateInit({
    ownerAddress: config.ownerAddress,
    livenessCode: config.livenessCode,
    livenessDurationMonths: config.livenessDurationMonths,
    beneficiaries: config.beneficiaries.map((beneficiary) => ({
      address: beneficiary.address,
      sharePercentage: beneficiary.percentage,
    })),
  });
  const reserveFloorTon = Number(formatNanoToTon(initPackage.config.minimumReserveFloorNano));
  const isShortTestInterval = config.livenessDurationMonths === FIVE_MINUTE_TEST_DURATION_MONTHS;
  const livenessChecksPerYear = isShortTestInterval
    ? 1
    : Math.max(1, Math.ceil(12 / Math.max(config.livenessDurationMonths, 1)));

  const reserveTargets = RESERVE_TARGET_YEARS.map((years) => {
    const livenessBudgetTon = years * livenessChecksPerYear * TON_PER_LIVENESS_CHECK;
    const estimatedTon = reserveFloorTon + livenessBudgetTon + PAYOUT_RECOVERY_BUFFER_TON;

    return {
      years,
      estimatedTon: formatTonAmount(estimatedTon),
      reserveFloorTon: formatTonAmount(reserveFloorTon),
      livenessBudgetTon: formatTonAmount(livenessBudgetTon),
      payoutRecoveryBufferTon: formatTonAmount(PAYOUT_RECOVERY_BUFFER_TON),
    };
  });

  const contractAddress = preparedStateInit.address.toString();
  const nextDueDateIso = addMonthsToNow(config.livenessDurationMonths);
  const selectedReserveTarget =
    reserveTargets.find((target) => target.years === config.reservePlanningHorizonYears) ??
    reserveTargets[0];
  const estimatedReserveTon = selectedReserveTarget?.estimatedTon ?? formatTonAmount(reserveFloorTon);
  const deployAmountNano = initPackage.config.minimumReserveFloorNano;
  const deployAmountTon = formatNanoToTon(deployAmountNano);
  const reminderText = [
    "TON Dead Man's Switch reminder",
    `Contract: ${contractAddress}`,
    `Liveness code: ${config.livenessCode || "(set before deploy)"}`,
    `Next due date: ${new Date(nextDueDateIso).toLocaleString()}`,
  ].join("\n");

  return {
    contractAddress,
    nextDueDateIso,
    configuredLivenessCode: config.livenessCode,
    estimatedReserveTon,
    reservePlanningHorizonYears: selectedReserveTarget?.years ?? config.reservePlanningHorizonYears,
    deployAmountNano,
    deployAmountTon,
    reserveTargets,
    reserveModel: {
      livenessChecksPerYear,
      tonPerLivenessCheck: formatTonAmount(TON_PER_LIVENESS_CHECK),
      payoutRecoveryBufferTon: formatTonAmount(PAYOUT_RECOVERY_BUFFER_TON),
      notes: [
        "Estimate = reserve floor + expected owner liveness-call budget + one small payout recovery buffer.",
        "This is a planning heuristic only. Actual TON fees, storage costs, and wallet behavior can change over time.",
        "Beneficiaries receive percentage shares of the contract balance available at expiry. This estimate is only for long-term operating reserve planning.",
        ...(isShortTestInterval
          ? ["The 5-minute interval is a temporary local testing mode. Reserve planning numbers are not meaningful for production."]
          : []),
      ],
    },
    reminderText,
    initPackage,
    compiledCodeHashHex: preparedStateInit.codeHashHex,
    stateInitBase64: preparedStateInit.stateInitBase64,
    codeCellBase64: preparedStateInit.codeBase64,
    dataCellBase64: preparedStateInit.dataBase64,
  };
}
