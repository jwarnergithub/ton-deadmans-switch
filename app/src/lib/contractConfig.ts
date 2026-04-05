import { createDeadMansSwitchInitPackage } from "../../../shared/deadMansSwitchInit";
import type { DeadMansSwitchConfig } from "../types/app";

export function prepareInitPackageFromConfig(config: DeadMansSwitchConfig) {
  return createDeadMansSwitchInitPackage({
    ownerAddress: config.ownerAddress,
    livenessCode: config.livenessCode,
    livenessDurationMonths: config.livenessDurationMonths,
    beneficiaries: config.beneficiaries.map((beneficiary) => ({
      address: beneficiary.address,
      sharePercentage: beneficiary.percentage,
    })),
  });
}
