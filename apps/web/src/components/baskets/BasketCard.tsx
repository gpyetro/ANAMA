import { Link } from "react-router-dom";

import type { Basket } from "../../types/basket";

import { ProgressBar } from "./ProgressBar";
import { shortCode, statusLabel } from "../../utils/labels";

interface BasketCardProps {
  basket: Basket;
}

function formatCurrency(value: number) {
  return new Intl.NumberFormat("pt-BR", {
    style: "currency",
    currency: "BRL",
  }).format(value);
}

export function BasketCard({ basket }: BasketCardProps) {
  return (
    <article className="basket-card">
      <div className="basket-card-header">
        <div>
          <span className="basket-label">Família {shortCode(basket.codigoFamilia)}</span>

          <h2>Cesta #{basket.idCesta}</h2>
        </div>

        <span className="status-badge">{statusLabel(basket.status) || "Em montagem"}</span>
      </div>

      <div className="basket-values">
        <div>
          <span>Arrecadado</span>

          <strong>{formatCurrency(basket.valorArrecadado)}</strong>
        </div>

        <div>
          <span>Meta</span>

          <strong>{formatCurrency(basket.valorEstimado)}</strong>
        </div>
      </div>

      <ProgressBar value={basket.percentual} />

      <div className="basket-card-footer">
        <span>{basket.itens.length} itens</span>

        <Link className="basket-link" to={`/baskets/${basket.idCesta}`}>
          Ver cesta
        </Link>
      </div>
    </article>
  );
}
