import {
  Address,
  beginCell,
  Cell,
  Contract,
  ContractABI,
  storeStateInit,
  type StateInit,
  contractAddress,
  type ContractProvider,
  type Sender,
  SendMode,
} from "@ton/core";
import { deadMansSwitchVaultCompiled } from "../build/DeadMansSwitchVault.compiled";
import {
  createCancelVaultPackage,
  createDeadMansSwitchInitPackage,
  createOwnerPingPackage,
  createResumePayoutPackage,
  createTriggerExpiryPackage,
} from "../shared/deadMansSwitchInit";

import type { DeadMansSwitchDraftInput } from "../shared/deadMansSwitchInit";

export type { DeadMansSwitchDraftInput as DeadMansSwitchInitConfig } from "../shared/deadMansSwitchInit";

export type DeadMansSwitchPreparedStateInit = {
  code: Cell;
  data: Cell;
  init: StateInit;
  address: Address;
  codeHashHex: string;
  codeBase64: string;
  dataBase64: string;
  stateInitBase64: string;
};

function bytesToBase64(bytes: Uint8Array) {
  const alphabet = "ABCDEFGHIJKLMNOPQRSTUVWXYZabcdefghijklmnopqrstuvwxyz0123456789+/";
  let output = "";

  for (let index = 0; index < bytes.length; index += 3) {
    const a = bytes[index] ?? 0;
    const b = bytes[index + 1] ?? 0;
    const c = bytes[index + 2] ?? 0;
    const chunk = (a << 16) | (b << 8) | c;

    output += alphabet[(chunk >> 18) & 63];
    output += alphabet[(chunk >> 12) & 63];
    output += index + 1 < bytes.length ? alphabet[(chunk >> 6) & 63] : "=";
    output += index + 2 < bytes.length ? alphabet[chunk & 63] : "=";
  }

  return output;
}

export const DeadMansSwitchOpcodes = {
  init: 0x1000,
  ownerPing: 0x1001,
  triggerExpiry: 0x1002,
  resumePayout: 0x1003,
  topUp: 0x1004,
  getState: 0x1005,
  cancel: 0x1006,
} as const;

export function buildInitConfig(config: DeadMansSwitchDraftInput) {
  return createDeadMansSwitchInitPackage(config);
}

export function deadMansSwitchVaultConfigToCell(config: DeadMansSwitchDraftInput) {
  return Cell.fromBase64(createDeadMansSwitchInitPackage(config).dataCellBase64);
}

export function getDeadMansSwitchVaultCodeCell() {
  return Cell.fromHex(deadMansSwitchVaultCompiled.hex);
}

export function prepareDeadMansSwitchVaultStateInit(
  config: DeadMansSwitchDraftInput,
  workchain = 0,
): DeadMansSwitchPreparedStateInit {
  const code = getDeadMansSwitchVaultCodeCell();
  const data = deadMansSwitchVaultConfigToCell(config);
  const init: StateInit = { code, data };
  const address = contractAddress(workchain, init);
  const stateInitCell = beginCell().store(storeStateInit(init)).endCell();

  return {
    code,
    data,
    init,
    address,
    codeHashHex: deadMansSwitchVaultCompiled.hash,
    codeBase64: bytesToBase64(code.toBoc()),
    dataBase64: bytesToBase64(data.toBoc()),
    stateInitBase64: bytesToBase64(stateInitCell.toBoc()),
  };
}

export function buildOwnerPingPayload(livenessMessage: string) {
  return createOwnerPingPackage(livenessMessage);
}

export function buildTriggerExpiryPayload() {
  return createTriggerExpiryPackage();
}

export function buildResumePayoutPayload() {
  return createResumePayoutPackage();
}

export function buildCancelVaultPayload() {
  return createCancelVaultPackage();
}

export class DeadMansSwitchVault implements Contract {
  readonly abi: ContractABI = { name: "DeadMansSwitchVault" };

  constructor(readonly address: Address, readonly init?: StateInit) {}

  static createFromAddress(address: Address) {
    return new DeadMansSwitchVault(address);
  }

  static createFromConfig(config: DeadMansSwitchDraftInput, code: Cell, workchain = 0) {
    const data = deadMansSwitchVaultConfigToCell(config);
    const init = { code, data };

    return new DeadMansSwitchVault(contractAddress(workchain, init), init);
  }

  static createFromPreparedConfig(config: DeadMansSwitchDraftInput, workchain = 0) {
    const prepared = prepareDeadMansSwitchVaultStateInit(config, workchain);
    return new DeadMansSwitchVault(prepared.address, prepared.init);
  }

  async sendDeploy(provider: ContractProvider, via: Sender, value: bigint) {
    await provider.internal(via, {
      value,
      sendMode: SendMode.PAY_GAS_SEPARATELY,
      body: beginCell().endCell(),
    });
  }

  async sendOwnerPing(provider: ContractProvider, via: Sender, value: bigint, livenessMessage: string) {
    const payload = buildOwnerPingPayload(livenessMessage);

    return provider.internal(via, {
      value,
      sendMode: SendMode.PAY_GAS_SEPARATELY,
      body: Cell.fromBase64(payload.bodyBase64),
    });
  }

  async sendTriggerExpiry(provider: ContractProvider, via: Sender, value: bigint) {
    const payload = buildTriggerExpiryPayload();

    return provider.internal(via, {
      value,
      sendMode: SendMode.PAY_GAS_SEPARATELY,
      body: Cell.fromBase64(payload.bodyBase64),
    });
  }

  async sendResumePayout(provider: ContractProvider, via: Sender, value: bigint) {
    const payload = buildResumePayoutPayload();

    return provider.internal(via, {
      value,
      sendMode: SendMode.PAY_GAS_SEPARATELY,
      body: Cell.fromBase64(payload.bodyBase64),
    });
  }

  async sendCancel(provider: ContractProvider, via: Sender, value: bigint) {
    const payload = buildCancelVaultPayload();

    return provider.internal(via, {
      value,
      sendMode: SendMode.PAY_GAS_SEPARATELY,
      body: Cell.fromBase64(payload.bodyBase64),
    });
  }

  async getLivenessStatus(provider: ContractProvider) {
    const result = await provider.get("get_liveness_status", []);

    return {
      lastLivenessAt: result.stack.readNumber(),
      livenessIntervalSeconds: result.stack.readNumber(),
      expired: result.stack.readBoolean(),
      completed: result.stack.readBoolean(),
    };
  }

  async getPayoutProgress(provider: ContractProvider) {
    const result = await provider.get("get_payout_progress", []);

    return {
      payoutIndex: result.stack.readNumber(),
      beneficiaryCount: result.stack.readNumber(),
      minimumReserveFloorNano: result.stack.readBigNumber(),
    };
  }

  async getBeneficiary(provider: ContractProvider, index: number) {
    const result = await provider.get("get_beneficiary", [{ type: "int", value: BigInt(index) }]);

    return {
      wallet: result.stack.readAddress(),
      shareBasisPoints: result.stack.readNumber(),
      usdtAmountStubNano: result.stack.readBigNumber(),
      xaut0AmountStubNano: result.stack.readBigNumber(),
    };
  }
}
