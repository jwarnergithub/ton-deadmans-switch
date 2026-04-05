import type { CompilerConfig } from "@ton/blueprint";

export const compile: CompilerConfig = {
  lang: "tolk",
  entrypoint: "contracts/DeadMansSwitchVault.tolk",
  withStackComments: true,
  withSrcLineComments: true,
  experimentalOptions: "",
};
