export const TransactionTypes = ["eip1559", "eip2930", "legacy"] as const;
export type TransactionType = (typeof TransactionTypes)[number];
