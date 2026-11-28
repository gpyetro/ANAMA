// Rótulos de exibição. Não alteram os valores enviados ou recebidos da API.
const STATUS_LABELS: Record<string, string> = {
  EM_MONTAGEM: "Em montagem",
  CONCLUIDA: "Concluída",
  ENTREGUE: "Entregue",
  PENDENTE: "Pendente",
  EM_ROTA: "Em rota",
  APROVADA: "Aprovada",
  REJEITADA: "Rejeitada",
  ATIVO: "Ativo",
  INATIVO: "Inativo",
  ENTREGA: "Entrega",
  CESTA_CONCLUIDA: "Cesta concluída",
  DOACAO: "Doação",
  DOACAO_CONFIRMADA: "Doação confirmada",
  ONG: "Organização",
  FAMILIA: "Família",
  DOADOR: "Doador",
  ADMIN: "Administrador",
};

export function statusLabel(value?: string | null): string {
  if (!value) return "";
  return (
    STATUS_LABELS[value] ??
    value
      .toLowerCase()
      .replace(/_/g, " ")
      .replace(/^./, (c) => c.toUpperCase())
  );
}

export function shortCode(code?: string | null): string {
  return code ? code.slice(0, 8).toUpperCase() : "";
}
