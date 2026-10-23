/** Pure monetary and item rules; all calculations use integer cents. */
export const toCents = (amount) => {
  if (typeof amount !== 'number' || !Number.isFinite(amount) || amount <= 0 || Math.round(amount * 100) / 100 !== amount) throw new RangeError('Valor monetário inválido');
  return Math.round(amount * 100);
};
export const fromCents = (cents) => cents / 100;
export function calculateItemCents(selected, catalog) {
  const unique = new Set(); let cents = 0;
  for (const { idItem, quantidade } of selected) {
    if (!Number.isSafeInteger(idItem) || idItem < 1 || !Number.isSafeInteger(quantidade) || quantidade < 1 || unique.has(idItem)) throw new RangeError('Itens inválidos ou duplicados');
    unique.add(idItem);
    const item = catalog.find(it => it.idItem === idItem);
    if (!item || quantidade > item.quantidadeNecessaria - item.quantidadeArrecadada) throw new RangeError('Quantidade indisponível');
    cents += Math.round(item.valorMedio * 100) * quantidade;
  }
  if (!cents || !Number.isSafeInteger(cents)) throw new RangeError('Valor da contribuição inválido');
  return cents;
}
export function remainingCents(goal, confirmed) { return Math.max(0, Math.round(goal * 100) - Math.round(confirmed * 100)); }
export function nextDeliveryStatus(current, next) { return (current === 'PENDENTE' && next === 'EM_ROTA') || (current === 'EM_ROTA' && next === 'ENTREGUE'); }
