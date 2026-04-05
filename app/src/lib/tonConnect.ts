import {
  createCancelVaultPackage,
  createOwnerPingPackage,
  createResumePayoutPackage,
  createTriggerExpiryPackage,
} from "../../../shared/deadMansSwitchInit";
import { Address } from "@ton/core";
import type { DeploymentDraft } from "../types/app";

export type TonConnectSendTransactionRequest = {
  validUntil: number;
  network?: string;
  from?: string;
  messages: Array<{
    address: string;
    amount: string;
    stateInit?: string;
    payload?: string;
  }>;
};

export function getTonConnectManifestUrl() {
  return new URL("tonconnect-manifest.json", window.location.origin + import.meta.env.BASE_URL).toString();
}

function parseTonAmountToNano(input: string) {
  const trimmed = input.trim();

  if (!trimmed) {
    throw new Error("A TON amount is required for this contract action.");
  }

  if (!/^\d+(\.\d+)?$/.test(trimmed)) {
    throw new Error(`Invalid TON amount: "${input}"`);
  }

  const [wholePart, fractionPart = ""] = trimmed.split(".");
  const fraction = `${fractionPart}000000000`.slice(0, 9);
  return (BigInt(wholePart) * 1_000_000_000n + BigInt(fraction)).toString();
}

function toTonConnectAddress(address: string) {
  try {
    return Address.parse(address).toString();
  } catch {
    throw new Error(`Invalid TON address for wallet transaction: "${address}"`);
  }
}

export function buildDeployTransactionRequest(
  deployment: DeploymentDraft,
  walletAddress: string,
  network?: string,
): TonConnectSendTransactionRequest {
  return {
    validUntil: Math.floor(Date.now() / 1000) + 60 * 10,
    network,
    from: walletAddress,
    messages: [
      {
        address: toTonConnectAddress(deployment.contractAddress),
        amount: deployment.deployAmountNano,
        stateInit: deployment.stateInitBase64,
      },
    ],
  };
}

export function buildContractActionTransactionRequest(args: {
  contractAddress: string;
  walletAddress: string;
  network?: string;
  amountTon: string;
  payloadBase64?: string;
}) {
  return {
    validUntil: Math.floor(Date.now() / 1000) + 60 * 10,
    network: args.network,
    from: args.walletAddress,
    messages: [
      {
        address: toTonConnectAddress(args.contractAddress),
        amount: parseTonAmountToNano(args.amountTon),
        payload: args.payloadBase64,
      },
    ],
  } satisfies TonConnectSendTransactionRequest;
}

export function buildOwnerPingTransactionRequest(args: {
  contractAddress: string;
  walletAddress: string;
  network?: string;
  amountTon: string;
  livenessMessage: string;
}) {
  const payload = createOwnerPingPackage(args.livenessMessage);

  return buildContractActionTransactionRequest({
    contractAddress: args.contractAddress,
    walletAddress: args.walletAddress,
    network: args.network,
    amountTon: args.amountTon,
    payloadBase64: payload.bodyBase64,
  });
}

export function buildTriggerExpiryTransactionRequest(args: {
  contractAddress: string;
  walletAddress: string;
  network?: string;
  amountTon: string;
}) {
  const payload = createTriggerExpiryPackage();

  return buildContractActionTransactionRequest({
    contractAddress: args.contractAddress,
    walletAddress: args.walletAddress,
    network: args.network,
    amountTon: args.amountTon,
    payloadBase64: payload.bodyBase64,
  });
}

export function buildResumePayoutTransactionRequest(args: {
  contractAddress: string;
  walletAddress: string;
  network?: string;
  amountTon: string;
}) {
  const payload = createResumePayoutPackage();

  return buildContractActionTransactionRequest({
    contractAddress: args.contractAddress,
    walletAddress: args.walletAddress,
    network: args.network,
    amountTon: args.amountTon,
    payloadBase64: payload.bodyBase64,
  });
}

export function buildTopUpTransactionRequest(args: {
  contractAddress: string;
  walletAddress: string;
  network?: string;
  amountTon: string;
}) {
  return buildContractActionTransactionRequest({
    contractAddress: args.contractAddress,
    walletAddress: args.walletAddress,
    network: args.network,
    amountTon: args.amountTon,
  });
}

export function buildCancelTransactionRequest(args: {
  contractAddress: string;
  walletAddress: string;
  network?: string;
  amountTon: string;
}) {
  const payload = createCancelVaultPackage();

  return buildContractActionTransactionRequest({
    contractAddress: args.contractAddress,
    walletAddress: args.walletAddress,
    network: args.network,
    amountTon: args.amountTon,
    payloadBase64: payload.bodyBase64,
  });
}
