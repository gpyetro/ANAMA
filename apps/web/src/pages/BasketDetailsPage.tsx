import { useEffect, useState } from "react";

import { Link, useParams } from "react-router-dom";

import { ProgressBar } from "../components/baskets/ProgressBar";

import { ApiError, apiRequest } from "../services/api";
import { useAuth } from "../contexts/AuthContext";
import { useLiveUpdates } from "../hooks/useLiveUpdates";

import type { Basket, BasketResponse } from "../types/basket";

function formatCurrency(value: number) {
  return new Intl.NumberFormat("pt-BR", {
    style: "currency",
    currency: "BRL",
  }).format(value);
}

export function BasketDetailsPage() {
  const { id } = useParams();
  const { user } = useAuth();

  const [basket, setBasket] = useState<Basket | null>(null);

  const [loading, setLoading] = useState(true);

  const [error, setError] = useState("");

  const reloadBasket = () => {
    async function loadBasket() {
      try {
        const response = await apiRequest<BasketResponse>(`/baskets/${id}`);

        setBasket(response.basket);
      } catch (error) {
        if (error instanceof ApiError) {
          setError(error.message);
        } else {
          setError("Não foi possível carregar a cesta.");
        }
      } finally {
        setLoading(false);
      }
    }

    if (id) { void loadBasket(); }
  };
  useEffect(reloadBasket, [id]);
  useLiveUpdates(reloadBasket);

  if (loading) {
    return (
      <section className="page-section">
        <div className="feedback-card">Carregando cesta...</div>
      </section>
    );
  }

  if (error || !basket) {
    return (
      <section className="page-section">
        <Link to="/" className="back-link">
          ← Voltar
        </Link>

        <div className="feedback-card error">
          {error || "Cesta não encontrada."}
        </div>
      </section>
    );
  }

  return (
    <section className="basket-details-page">
      <Link to="/" className="back-link">
        ← Voltar para as cestas
      </Link>

      <div className="basket-details-header">
        <div>
          <span className="eyebrow">Cesta #{basket.idCesta}</span>

          <h1>Família {basket.codigoFamilia}</h1>

          <p>Acompanhe os itens necessários e o progresso desta cesta.</p>
        </div>

        <span className="status-badge">{basket.status === "EM_MONTAGEM" ? "Em montagem" : basket.status === "CONCLUIDA" ? "Concluída" : basket.status === "ENTREGUE" ? "Entregue" : basket.status}</span>
      </div>

      {user?.tipo === "DOADOR" &&
  basket.status === "EM_MONTAGEM" &&
  import.meta.env.VITE_DEMO_MODE !== "true" && (
    <Link className="primary-link" to={`/donate/${basket.idCesta}`}>
      Contribuir com esta cesta
    </Link>
  )}

{user?.tipo === "DOADOR" &&
  basket.status === "EM_MONTAGEM" &&
  import.meta.env.VITE_DEMO_MODE === "true" && (
    <p role="note">
      Ambiente acadêmico demonstrativo. As contribuições
      financeiras estão indisponíveis nesta versão hospedada.
      Nenhuma cobrança real é realizada.
    </p>
  )}
      <div className="basket-summary-card">
        <div className="summary-values">
          <div>
            <span>Arrecadado</span>

            <strong>{formatCurrency(basket.valorArrecadado)}</strong>
          </div>

          <div>
            <span>Valor estimado</span>

            <strong>{formatCurrency(basket.valorEstimado)}</strong>
          </div>
        </div>

        <ProgressBar value={basket.percentual} />
      </div>

      <div className="section-heading">
        <div>
          <span className="eyebrow">Composição</span>

          <h2>Itens necessários</h2>
        </div>
      </div>

      <div className="basket-items-list">
        {basket.itens.map((item) => {
          const itemProgress =
            item.quantidadeNecessaria > 0
              ? Math.min(
                  100,
                  (item.quantidadeArrecadada / item.quantidadeNecessaria) * 100,
                )
              : 0;

          return (
            <article key={item.idItem} className="basket-item">
              <div className="basket-item-main">
                <div>
                  <strong>{item.nome}</strong>

                  <span>{item.categoria}</span>
                </div>

                <div className="item-quantity">
                  <strong>
                    {item.quantidadeArrecadada}/{item.quantidadeNecessaria}
                  </strong>

                  <span>unidades</span>
                </div>
              </div>

              <ProgressBar value={itemProgress} />

              <span className="item-value">
                Valor médio: {formatCurrency(item.valorMedio)}
              </span>
            </article>
          );
        })}
      </div>
    </section>
  );
}
