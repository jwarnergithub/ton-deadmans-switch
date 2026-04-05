import { prepareDeploymentPreview } from "./prepareDeployment";
import type { DeadMansSwitchConfig, DeploymentDraft } from "../types/app";

export function buildMockDeployment(config: DeadMansSwitchConfig): DeploymentDraft {
  return prepareDeploymentPreview(config);
}
