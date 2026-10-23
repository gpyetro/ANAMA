export declare function toCents(amount: number): number;
export declare function fromCents(cents: number): number;
export declare function calculateItemCents(selected: {idItem: number; quantidade: number}[], catalog: {idItem: number; valorMedio: number; quantidadeNecessaria: number; quantidadeArrecadada: number}[]): number;
export declare function remainingCents(goal: number, confirmed: number): number;
export declare function nextDeliveryStatus(current: string, next: string): boolean;
