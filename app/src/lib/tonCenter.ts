import { Address, Cell } from "@ton/core";

export type TonCenterAccountInfo = {
  lifecycleState: "uninitialized" | "active" | "frozen" | "unknown";
  balanceNano: string;
  balanceTon: string;
  codeBase64?: string;
  dataBase64?: string;
  lastTransactionLt?: string;
  lastTransactionHash?: string;
  syncUtime?: number;
};

export type ContractGetterState = {
  liveness?: {
    lastLivenessAt: number;
    livenessIntervalSeconds: number;
    expired: boolean;
    completed: boolean;
    nextDueAt?: number;
  };
  payout?: {
    payoutIndex: number;
    beneficiaryCount: number;
    minimumReserveFloorNano: string;
    minimumReserveFloorTon: string;
  };
};

type TonCenterEnvelope<T> = {
  ok: boolean;
  result: T;
  error?: string;
  code?: number;
};

type TonCenterV3StackEntry = {
  type: string;
  value: unknown;
};

type TonCenterRunGetMethodResult = {
  gas_used?: number;
  exit_code: number;
  stack: TonCenterV3StackEntry[];
  error?: string;
};

type TonCenterAddressInformation = {
  balance: string;
  code?: string;
  data?: string;
  state?: "uninitialized" | "active" | "frozen";
  sync_utime?: number;
  last_transaction_id?: {
    lt?: string;
    hash?: string;
  };
};

function getTonCenterBaseUrl(network?: string) {
  return network === "-3"
    ? "https://testnet.toncenter.com/api/v2"
    : "https://toncenter.com/api/v2";
}

function getTonCenterV3BaseUrl(network?: string) {
  return network === "-3" ? "https://testnet.toncenter.com/api/v3" : "https://toncenter.com/api/v3";
}

const TON_CENTER_MIN_REQUEST_INTERVAL_MS = 2000;
const TON_CENTER_MAX_RETRIES = 3;
const TON_CENTER_RETRY_BACKOFF_MS = 2500;

let tonCenterQueue: Promise<void> = Promise.resolve();
let lastTonCenterRequestAt = 0;

function delay(ms: number) {
  return new Promise<void>((resolve) => window.setTimeout(resolve, ms));
}

async function scheduleTonCenterRequest() {
  const now = Date.now();
  const waitMs = Math.max(0, TON_CENTER_MIN_REQUEST_INTERVAL_MS - (now - lastTonCenterRequestAt));

  if (waitMs > 0) {
    await delay(waitMs);
  }

  lastTonCenterRequestAt = Date.now();
}

async function withTonCenterRateLimit<T>(task: () => Promise<T>) {
  const run = tonCenterQueue.then(async () => {
    await scheduleTonCenterRequest();
    return task();
  });

  tonCenterQueue = run.then(
    () => undefined,
    () => undefined,
  );

  return run;
}

function shouldRetryTonCenterFailure(status?: number, bodyText?: string) {
  if (status === 429 || status === 500 || status === 502 || status === 503 || status === 504) {
    return true;
  }

  if (!bodyText) {
    return false;
  }

  const normalized = bodyText.toLowerCase();
  return normalized.includes("timeout") || normalized.includes("ratelimit") || normalized.includes("rate limit");
}

async function fetchWithTonCenterRetry(input: RequestInfo | URL, init?: RequestInit) {
  let lastError: Error | undefined;

  for (let attempt = 0; attempt < TON_CENTER_MAX_RETRIES; attempt += 1) {
    try {
      const response = await withTonCenterRateLimit(() => fetch(input, init));

      if (response.ok) {
        return response;
      }

      const responseText = await response.text().catch(() => "");

      if (attempt < TON_CENTER_MAX_RETRIES - 1 && shouldRetryTonCenterFailure(response.status, responseText)) {
        await delay(TON_CENTER_RETRY_BACKOFF_MS * (attempt + 1));
        continue;
      }

      throw new Error(
        `TON Center request failed with status ${response.status}${responseText ? `: ${responseText}` : "."}`,
      );
    } catch (error) {
      lastError = error instanceof Error ? error : new Error("TON Center request failed.");

      if (attempt < TON_CENTER_MAX_RETRIES - 1 && shouldRetryTonCenterFailure(undefined, lastError.message)) {
        await delay(TON_CENTER_RETRY_BACKOFF_MS * (attempt + 1));
        continue;
      }

      throw lastError;
    }
  }

  throw lastError ?? new Error("TON Center request failed.");
}

function nanoToTon(value: string) {
  const amount = BigInt(value || "0");
  const whole = amount / 1_000_000_000n;
  const fraction = (amount % 1_000_000_000n).toString().padStart(9, "0").replace(/0+$/, "");
  return fraction ? `${whole}.${fraction}` : whole.toString();
}

export function normalizeTonAddress(address: string) {
  const trimmed = address.trim();

  if (!trimmed) {
    throw new Error("Enter a TON contract address first.");
  }

  try {
    return Address.parse(trimmed).toRawString();
  } catch {
    throw new Error("This does not look like a valid TON address.");
  }
}

export function sameTonAddress(left?: string, right?: string) {
  if (!left || !right) {
    return false;
  }

  try {
    return normalizeTonAddress(left) === normalizeTonAddress(right);
  } catch {
    return false;
  }
}

export function getCellHashHex(base64?: string) {
  if (!base64) {
    return undefined;
  }

  try {
    return Cell.fromBase64(base64).hash().toString("hex");
  } catch {
    return undefined;
  }
}

async function fetchTonCenter<T>(path: string, network?: string) {
  const response = await fetchWithTonCenterRetry(`${getTonCenterBaseUrl(network)}${path}`);

  const payload = (await response.json()) as TonCenterEnvelope<T>;

  if (!payload.ok) {
    throw new Error(payload.error || "TON Center returned an error.");
  }

  return payload.result;
}

async function runGetMethod(
  address: string,
  method: string,
  network?: string,
): Promise<TonCenterRunGetMethodResult> {
  const response = await fetchWithTonCenterRetry(`${getTonCenterV3BaseUrl(network)}/runGetMethod`, {
    method: "POST",
    headers: {
      "Content-Type": "application/json",
    },
    body: JSON.stringify({
      address,
      method,
      stack: [],
    }),
  });

  return (await response.json()) as TonCenterRunGetMethodResult;
}

function parseStackNumber(entry: TonCenterV3StackEntry | undefined) {
  if (!entry || (entry.type !== "num" && entry.type !== "int")) {
    throw new Error("Unexpected getter stack entry type.");
  }

  const rawValue =
    typeof entry.value === "string"
      ? entry.value
      : typeof entry.value === "number" || typeof entry.value === "bigint"
        ? String(entry.value)
        : Array.isArray(entry.value) && entry.value.length > 0
          ? String(entry.value[entry.value.length - 1])
          : entry.value && typeof entry.value === "object" && "value" in entry.value
            ? String((entry.value as { value?: unknown }).value)
            : String(entry.value);

  const normalizedValue = rawValue.trim().replace(/^"+|"+$/g, "");

  try {
    if (/^-?0x[0-9a-f]+$/i.test(normalizedValue)) {
      const isNegative = normalizedValue.startsWith("-");
      const hexDigits = normalizedValue.replace(/^-?0x/i, "");
      const parsed = BigInt(`0x${hexDigits}`);
      return isNegative ? -parsed : parsed;
    }

    return BigInt(normalizedValue);
  } catch {
    throw new Error(
      `Getter stack number could not be parsed: type=${entry.type}, value=${JSON.stringify(entry.value)}.`,
    );
  }
}

function parseStackBool(entry: TonCenterV3StackEntry | undefined) {
  return parseStackNumber(entry) !== 0n;
}

export async function fetchContractAccountInfo(
  address: string,
  network?: string,
): Promise<TonCenterAccountInfo> {
  const addressState = await fetchTonCenter<string>(
    `/getAddressState?address=${encodeURIComponent(address)}`,
    network,
  );
  const addressInformation = await fetchTonCenter<TonCenterAddressInformation>(
    `/getAddressInformation?address=${encodeURIComponent(address)}`,
    network,
  );

  return {
    lifecycleState:
      addressState === "active" || addressState === "uninitialized" || addressState === "frozen"
        ? addressState
        : "unknown",
    balanceNano: addressInformation.balance ?? "0",
    balanceTon: nanoToTon(addressInformation.balance ?? "0"),
    codeBase64: addressInformation.code,
    dataBase64: addressInformation.data,
    lastTransactionLt: addressInformation.last_transaction_id?.lt,
    lastTransactionHash: addressInformation.last_transaction_id?.hash,
    syncUtime: addressInformation.sync_utime,
  };
}

export async function fetchContractGetterState(
  address: string,
  network?: string,
): Promise<ContractGetterState> {
  const livenessResult = await runGetMethod(address, "get_liveness_status", network);
  const payoutResult = await runGetMethod(address, "get_payout_progress", network);

  if (livenessResult.exit_code !== 0) {
    throw new Error(`Getter get_liveness_status failed with exit code ${livenessResult.exit_code}.`);
  }

  if (payoutResult.exit_code !== 0) {
    throw new Error(`Getter get_payout_progress failed with exit code ${payoutResult.exit_code}.`);
  }

  const lastLivenessAt = Number(parseStackNumber(livenessResult.stack[0]));
  const livenessIntervalSeconds = Number(parseStackNumber(livenessResult.stack[1]));
  const expired = parseStackBool(livenessResult.stack[2]);
  const completed = parseStackBool(livenessResult.stack[3]);
  const payoutIndex = Number(parseStackNumber(payoutResult.stack[0]));
  const beneficiaryCount = Number(parseStackNumber(payoutResult.stack[1]));
  const minimumReserveFloorNano = parseStackNumber(payoutResult.stack[2]).toString();

  return {
    liveness: {
      lastLivenessAt,
      livenessIntervalSeconds,
      expired,
      completed,
      nextDueAt: lastLivenessAt > 0 ? lastLivenessAt + livenessIntervalSeconds : undefined,
    },
    payout: {
      payoutIndex,
      beneficiaryCount,
      minimumReserveFloorNano,
      minimumReserveFloorTon: nanoToTon(minimumReserveFloorNano),
    },
  };
}
