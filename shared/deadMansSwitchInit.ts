import { Address, beginCell, Cell, Dictionary } from "@ton/core";

export type DeadMansSwitchDraftBeneficiary = {
  address: string;
  sharePercentage: string;
};

export type DeadMansSwitchDraftInput = {
  ownerAddress: string;
  livenessCode: string;
  livenessDurationMonths: number;
  beneficiaries: DeadMansSwitchDraftBeneficiary[];
  minimumReserveFloorTon?: string;
  version?: number;
};

export type SerializedBeneficiary = {
  index: number;
  address: string;
  shareBasisPoints: number;
  usdtAmountStubNano: string;
  xaut0AmountStubNano: string;
};

export type DeadMansSwitchSerializableInit = {
  owner: string;
  livenessIntervalSeconds: number;
  lastLivenessAt: number;
  livenessCodeHashHex: string;
  beneficiaryCount: number;
  beneficiaries: SerializedBeneficiary[];
  payoutIndex: number;
  payoutPoolSnapshotNano: string;
  expired: boolean;
  completed: boolean;
  minimumReserveFloorNano: string;
  version: number;
  phase: "ton-only";
};

export type DeadMansSwitchInitPackage = {
  codec: "ton-deadmans-switch/init/v3-cell";
  opcode: number;
  fingerprintHex: string;
  canonicalJson: string;
  config: DeadMansSwitchSerializableInit;
  dataCellBase64: string;
  dataCellHex: string;
  dataCellBits: number;
  dataCellRefs: number;
  beneficiariesDictCellBase64: string;
  beneficiariesDictCellHex: string;
  warnings: string[];
};

export type ParsedDeadMansSwitchInitState = DeadMansSwitchSerializableInit;

const NANO_MULTIPLIER = 1_000_000_000n;
const FALLBACK_MINIMUM_RESERVE_NANO = 1_500_000_000n;
const INIT_OPCODE = 0x1000;
const FULL_SHARE_BASIS_POINTS = 10_000;

function normalizeAddress(address: string) {
  return address.trim();
}

function monthsToSeconds(months: number) {
  return Math.round(months * 30 * 24 * 60 * 60);
}

function parseTonAmountToNano(input: string) {
  const trimmed = input.trim();

  if (!trimmed) {
    return 0n;
  }

  if (!/^\d+(\.\d+)?$/.test(trimmed)) {
    throw new Error(`Invalid TON amount: "${input}"`);
  }

  const [wholePart, fractionPart = ""] = trimmed.split(".");
  const fraction = `${fractionPart}000000000`.slice(0, 9);
  return BigInt(wholePart) * NANO_MULTIPLIER + BigInt(fraction);
}

function parsePercentageToBasisPoints(input: string) {
  const trimmed = input.trim();

  if (!trimmed) {
    return 0;
  }

  if (!/^\d+(\.\d{1,2})?$/.test(trimmed)) {
    throw new Error(`Invalid beneficiary percentage: "${input}"`);
  }

  const [wholePart, fractionPart = ""] = trimmed.split(".");
  const whole = Number(wholePart);
  const fraction = Number(`${fractionPart}00`.slice(0, 2));
  const basisPoints = whole * 100 + fraction;

  if (basisPoints < 0 || basisPoints > FULL_SHARE_BASIS_POINTS) {
    throw new Error(`Beneficiary percentage must stay between 0 and 100: "${input}"`);
  }

  return basisPoints;
}

function stableStringify(value: unknown): string {
  if (value === null || typeof value !== "object") {
    return JSON.stringify(value);
  }

  if (Array.isArray(value)) {
    return `[${value.map((item) => stableStringify(item)).join(",")}]`;
  }

  const entries = Object.entries(value as Record<string, unknown>).sort(([left], [right]) =>
    left.localeCompare(right),
  );

  return `{${entries
    .map(([key, entryValue]) => `${JSON.stringify(key)}:${stableStringify(entryValue)}`)
    .join(",")}}`;
}

function bytesToHex(bytes: Uint8Array) {
  return Array.from(bytes, (byte) => byte.toString(16).padStart(2, "0")).join("");
}

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

function cellToBase64(cell: Cell) {
  return bytesToBase64(cell.toBoc());
}

function cellToHex(cell: Cell) {
  return bytesToHex(cell.toBoc());
}

function cellHashHex(cell: Cell) {
  return `0x${bytesToHex(cell.hash())}`;
}

function parseAddress(address: string) {
  try {
    return Address.parse(address);
  } catch {
    throw new Error(`Invalid TON address: "${address}"`);
  }
}

function canonicalizeAddress(address: string) {
  return parseAddress(address).toRawString();
}

function buildWarnings(input: DeadMansSwitchDraftInput, totalShareBasisPoints: number) {
  const warnings = [
    "This package now includes a real TON data cell BOC, but it still does not include compiled contract code or StateInit.",
    "The liveness code hash is currently derived from a TON cell hash of the UTF-8 string and must match the final contract parser.",
    "USDT and XAUT0 fields stay reserved as zero-value stubs during phase 1.",
  ];

  if (totalShareBasisPoints !== FULL_SHARE_BASIS_POINTS) {
    warnings.push("Beneficiary percentages should add up to exactly 100% before deployment.");
  }

  if (input.beneficiaries.length > 1) {
    warnings.push("Beneficiaries are serialized in display order and the contract will pay them in that same order.");
  }

  return warnings;
}

function buildBeneficiaryEntryCell(beneficiary: SerializedBeneficiary) {
  return beginCell()
    .storeAddress(Address.parse(beneficiary.address))
    .storeUint(beneficiary.shareBasisPoints, 16)
    .storeCoins(BigInt(beneficiary.usdtAmountStubNano))
    .storeCoins(BigInt(beneficiary.xaut0AmountStubNano))
    .endCell();
}

function buildBeneficiariesDictionary(beneficiaries: SerializedBeneficiary[]) {
  const dictionary = Dictionary.empty(Dictionary.Keys.Uint(16), Dictionary.Values.Cell());

  beneficiaries.forEach((beneficiary) => {
    dictionary.set(beneficiary.index, buildBeneficiaryEntryCell(beneficiary));
  });

  return dictionary;
}

function buildBeneficiariesDictionaryCell(beneficiaries: SerializedBeneficiary[]) {
  const dictionary = buildBeneficiariesDictionary(beneficiaries);
  return beginCell().storeDict(dictionary).endCell();
}

function buildDataCell(config: DeadMansSwitchSerializableInit) {
  const beneficiariesDictionary = buildBeneficiariesDictionary(config.beneficiaries);

  return beginCell()
    .storeAddress(Address.parse(config.owner))
    .storeUint(config.livenessIntervalSeconds, 32)
    .storeUint(config.lastLivenessAt, 64)
    .storeUint(BigInt(config.livenessCodeHashHex), 256)
    .storeUint(config.beneficiaryCount, 16)
    .storeDict(beneficiariesDictionary)
    .storeUint(config.payoutIndex, 16)
    .storeCoins(BigInt(config.payoutPoolSnapshotNano))
    .storeBit(config.expired)
    .storeBit(config.completed)
    .storeCoins(BigInt(config.minimumReserveFloorNano))
    .storeUint(config.version, 16)
    .endCell();
}

function parseBeneficiaryEntryCell(index: number, cell: Cell): SerializedBeneficiary {
  const slice = cell.beginParse();

  const wallet = slice.loadAddress();
  const shareBasisPoints = slice.loadUint(16);
  const usdtAmountStubNano = slice.loadCoins().toString();
  const xaut0AmountStubNano = slice.loadCoins().toString();
  slice.endParse();

  return {
    index,
    address: wallet.toRawString(),
    shareBasisPoints,
    usdtAmountStubNano,
    xaut0AmountStubNano,
  };
}

export function parseDeadMansSwitchDataCell(dataCell: Cell): ParsedDeadMansSwitchInitState {
  const slice = dataCell.beginParse();
  const owner = slice.loadAddress().toRawString();
  const livenessIntervalSeconds = slice.loadUint(32);
  const lastLivenessAt = Number(slice.loadUintBig(64));
  const livenessCodeHashHex = `0x${slice.loadUintBig(256).toString(16).padStart(64, "0")}`;
  const beneficiaryCount = slice.loadUint(16);
  const beneficiariesDict = slice.loadDict(Dictionary.Keys.Uint(16), Dictionary.Values.Cell());
  const payoutIndex = slice.loadUint(16);
  const payoutPoolSnapshotNano = slice.loadCoins().toString();
  const expired = slice.loadBit();
  const completed = slice.loadBit();
  const minimumReserveFloorNano = slice.loadCoins().toString();
  const version = slice.loadUint(16);
  slice.endParse();

  const beneficiaries = beneficiariesDict
    .keys()
    .sort((left, right) => left - right)
    .map((index) => {
      const cell = beneficiariesDict.get(index);

      if (!cell) {
        throw new Error(`Missing beneficiary entry for index ${index}.`);
      }

      return parseBeneficiaryEntryCell(index, cell);
    });

  return {
    owner,
    livenessIntervalSeconds,
    lastLivenessAt,
    livenessCodeHashHex,
    beneficiaryCount,
    beneficiaries,
    payoutIndex,
    payoutPoolSnapshotNano,
    expired,
    completed,
    minimumReserveFloorNano,
    version,
    phase: "ton-only",
  };
}

export function parseDeadMansSwitchDataCellBase64(dataCellBase64: string) {
  return parseDeadMansSwitchDataCell(Cell.fromBase64(dataCellBase64));
}

export function createDeadMansSwitchInitPackage(
  input: DeadMansSwitchDraftInput,
): DeadMansSwitchInitPackage {
  const owner = canonicalizeAddress(normalizeAddress(input.ownerAddress));
  const livenessCode = input.livenessCode.trim();

  if (!owner) {
    throw new Error("Owner address is required before preparing init config.");
  }

  if (!livenessCode) {
    throw new Error("Liveness code is required before preparing init config.");
  }

  if (input.beneficiaries.length === 0) {
    throw new Error("At least one beneficiary is required.");
  }

  const beneficiaries = input.beneficiaries.map((beneficiary, index) => {
    const address = canonicalizeAddress(normalizeAddress(beneficiary.address));

    if (!address) {
      throw new Error(`Beneficiary ${index + 1} address is required.`);
    }

    return {
      index,
      address,
      shareBasisPoints: parsePercentageToBasisPoints(beneficiary.sharePercentage),
      usdtAmountStubNano: "0",
      xaut0AmountStubNano: "0",
    };
  });

  const totalShareBasisPoints = beneficiaries.reduce(
    (sum, beneficiary) => sum + beneficiary.shareBasisPoints,
    0,
  );

  if (totalShareBasisPoints !== FULL_SHARE_BASIS_POINTS) {
    throw new Error("Beneficiary percentages must add up to exactly 100%.");
  }

  const minimumReserveFloorNano =
    input.minimumReserveFloorTon?.trim()
      ? parseTonAmountToNano(input.minimumReserveFloorTon)
      : FALLBACK_MINIMUM_RESERVE_NANO;

  const livenessCodeHashCell = beginCell().storeStringTail(livenessCode).endCell();

  const config: DeadMansSwitchSerializableInit = {
    owner,
    livenessIntervalSeconds: monthsToSeconds(input.livenessDurationMonths),
    lastLivenessAt: 0,
    livenessCodeHashHex: cellHashHex(livenessCodeHashCell),
    beneficiaryCount: beneficiaries.length,
    beneficiaries,
    payoutIndex: 0,
    payoutPoolSnapshotNano: "0",
    expired: false,
    completed: false,
    minimumReserveFloorNano: minimumReserveFloorNano.toString(),
    version: input.version ?? 1,
    phase: "ton-only",
  };

  const canonicalJson = stableStringify(config);
  const beneficiariesDictCell = buildBeneficiariesDictionaryCell(config.beneficiaries);
  const dataCell = buildDataCell(config);

  return {
    codec: "ton-deadmans-switch/init/v3-cell",
    opcode: INIT_OPCODE,
    fingerprintHex: cellHashHex(dataCell),
    canonicalJson,
    config,
    dataCellBase64: cellToBase64(dataCell),
    dataCellHex: cellToHex(dataCell),
    dataCellBits: dataCell.bits.length,
    dataCellRefs: dataCell.refs.length,
    beneficiariesDictCellBase64: cellToBase64(beneficiariesDictCell),
    beneficiariesDictCellHex: cellToHex(beneficiariesDictCell),
    warnings: buildWarnings(input, totalShareBasisPoints),
  };
}

export function createOwnerPingPackage(livenessMessage: string) {
  const normalizedMessage = livenessMessage.trim();
  const livenessHash = beginCell().storeStringTail(normalizedMessage).endCell();

  return {
    opcode: 0x1001,
    livenessMessage: normalizedMessage,
    livenessCodeHashHex: cellHashHex(livenessHash),
    bodyBase64: cellToBase64(
      beginCell()
        .storeUint(0x1001, 32)
        .storeStringTail(normalizedMessage)
        .endCell(),
    ),
  };
}

export function createTriggerExpiryPackage() {
  const body = beginCell().storeUint(0x1002, 32).endCell();

  return {
    opcode: 0x1002,
    bodyBase64: cellToBase64(body),
  };
}

export function createResumePayoutPackage() {
  const body = beginCell().storeUint(0x1003, 32).endCell();

  return {
    opcode: 0x1003,
    bodyBase64: cellToBase64(body),
  };
}

export function createCancelVaultPackage() {
  const body = beginCell().storeUint(0x1006, 32).endCell();

  return {
    opcode: 0x1006,
    bodyBase64: cellToBase64(body),
  };
}
