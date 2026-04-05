import { buildInitConfig } from "../wrappers/DeadMansSwitchVault";

// Placeholder deployment entry point.
// This uses the shared deterministic JSON init package until real TON cell encoding is added.
export function prepareDeploymentExample() {
  return buildInitConfig({
    ownerAddress: "0:1111111111111111111111111111111111111111111111111111111111111111",
    livenessCode: "manual check-in phrase",
    livenessDurationMonths: 6,
    beneficiaries: [
      {
        address: "0:2222222222222222222222222222222222222222222222222222222222222222",
        tonAmount: "1",
      },
    ],
    minimumReserveFloorTon: "0.5",
    version: 1,
  });
}
