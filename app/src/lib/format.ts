import { Address } from "@ton/core";

type TonAddressFormatOptions = {
  chain?: string;
};

export const FIVE_MINUTE_TEST_DURATION_MONTHS = 5 / (30 * 24 * 60);

function isTestnetChain(chain?: string) {
  return chain === "-3";
}

export function formatTonAddress(address: string, options?: TonAddressFormatOptions) {
  if (!address) {
    return "Not connected";
  }

  try {
    return Address.parse(address).toString({
      testOnly: isTestnetChain(options?.chain),
      bounceable: false,
    });
  } catch {
    return address;
  }
}

export function shortAddress(address: string, options?: TonAddressFormatOptions) {
  const friendlyAddress = formatTonAddress(address, options);

  if (friendlyAddress.length <= 12) {
    return friendlyAddress;
  }

  return `${friendlyAddress.slice(0, 6)}...${friendlyAddress.slice(-6)}`;
}

export function formatMonths(months: number) {
  if (months === FIVE_MINUTE_TEST_DURATION_MONTHS) {
    return "5 minutes";
  }

  return `${months} month${months === 1 ? "" : "s"}`;
}

export function addMonthsToNow(months: number) {
  const next = new Date();

  if (months === FIVE_MINUTE_TEST_DURATION_MONTHS) {
    next.setMinutes(next.getMinutes() + 5);
    return next.toISOString();
  }

  next.setMonth(next.getMonth() + months);
  return next.toISOString();
}

export function sumTonAmounts(amounts: string[]) {
  const total = amounts.reduce((sum, value) => sum + (Number(value) || 0), 0);
  return total.toFixed(2);
}

export function sumPercentages(percentages: string[]) {
  const total = percentages.reduce((sum, value) => sum + (Number(value) || 0), 0);
  return total.toFixed(2);
}

export function formatShareBasisPoints(shareBasisPoints: number) {
  return (shareBasisPoints / 100).toFixed(2).replace(/\.00$/, "");
}

export function formatTonNetwork(chain?: string) {
  if (chain === "-3") {
    return "TON Testnet";
  }

  if (chain === "-239") {
    return "TON Mainnet";
  }

  return chain ? `TON network ${chain}` : "Wallet default";
}
