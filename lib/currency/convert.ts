import { convert } from "cashify";
import type { RatesTable } from "./exchange-rate-provider";

export class UnsupportedCurrencyError extends Error {
  constructor(currency: string) {
    super(`Unsupported currency: ${currency}`);
    this.name = "UnsupportedCurrencyError";
  }
}

function assertCurrencySupported(currency: string, base: string, rates: RatesTable) {
  if (currency === base) return;
  if (!(currency in rates)) {
    throw new UnsupportedCurrencyError(currency);
  }
}

export function convertCurrency(
  amount: number,
  from: string,
  to: string,
  base: string,
  rates: RatesTable
): number {
  const fromCode = from.toUpperCase();
  const toCode = to.toUpperCase();

  if (fromCode === toCode) {
    return amount;
  }

  assertCurrencySupported(fromCode, base, rates);
  assertCurrencySupported(toCode, base, rates);

  const converted = convert(amount, {
    from: fromCode,
    to: toCode,
    base,
    rates,
  });

  return Math.round(converted * 100) / 100;
}
