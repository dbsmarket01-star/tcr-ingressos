export type StockSnapshot = {
  totalQuantity: number;
  soldQuantity: number;
  reservedQuantity: number;
};

export function getAvailableQuantity(stock: StockSnapshot) {
  return Math.max(stock.totalQuantity - stock.soldQuantity - stock.reservedQuantity, 0);
}

export function canReserveQuantity(stock: StockSnapshot, requestedQuantity: number) {
  return requestedQuantity > 0 && requestedQuantity <= getAvailableQuantity(stock);
}
