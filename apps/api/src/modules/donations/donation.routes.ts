import { Router } from "express";
import { z } from "zod";
import { prisma } from "../../database/prisma.js";
import { authenticate } from "../../middlewares/authenticate.js";
import { authorize } from "../../middlewares/authorize.js";
import { AppError } from "../../shared/errors/app-error.js";
import { calculateItemCents, fromCents, remainingCents, toCents } from "../../shared/domain/donation-math.mjs";
import { broadcast, notify } from "../updates/updates.js";
import { env } from "../../config/env.js";

const newDonation = z.discriminatedUnion("tipo", [
  z.object({ tipo: z.literal("VALOR"), idCesta: z.number().int().positive(), valor: z.number().positive().max(100000) }),
  z.object({ tipo: z.literal("ITEM"), idCesta: z.number().int().positive(), itens: z.array(z.object({ idItem: z.number().int().positive(), quantidade: z.number().int().positive().max(1000) })).min(1).max(30) }),
]);
const donationId = z.coerce.number().int().positive();

export const donationRoutes = Router();
donationRoutes.use(authenticate, authorize("DOADOR"));

donationRoutes.get("/me", async (req, res) => {
  if (!req.auth) throw new AppError("Não autenticado", 401);
  const donations = await prisma.doacao.findMany({
    where: { idDoador: req.auth.idUsuario }, include: { pagamentos: true, itens: { include: { item: true } } },
    orderBy: { createdAt: "desc" }, take: 100,
  });
  res.json({ donations });
});

donationRoutes.post("/", async (req, res) => {
  if (!req.auth) throw new AppError("Não autenticado", 401);
  const input = newDonation.parse(req.body);
  const basket = await prisma.cesta.findUnique({
    where: { idCesta: input.idCesta }, include: { itens: { include: { item: true } } },
  });
  if (!basket || basket.status !== "EM_MONTAGEM") throw new AppError("Cesta indisponível", 409, "BASKET_NOT_ACTIVE");
  const confirmed = await prisma.doacao.aggregate({ where: { idCesta: basket.idCesta, status: "CONFIRMADA" }, _sum: { valorTotal: true } });
  const left = remainingCents(Number(basket.valorEstimado), Number(confirmed._sum.valorTotal ?? 0));
  if (left <= 0) throw new AppError("Cesta já foi completada", 409, "BASKET_FULL");
  let cents: number;
  let items: { idItem: number; quantidade: number }[] = [];
  try {
    if (input.tipo === "VALOR") {
      cents = toCents(input.valor);
    } else {
      items = input.itens;
      cents = calculateItemCents(items, basket.itens.map(row => ({
        idItem: row.idItem, valorMedio: Number(row.item.valorMedio),
        quantidadeNecessaria: row.quantidadeNecessaria, quantidadeArrecadada: row.quantidadeArrecadada,
      })));
    }
  } catch { throw new AppError("Valor ou itens inválidos para esta cesta", 400, "INVALID_DONATION"); }
  if (cents > left) throw new AppError(`A contribuição ultrapassa a meta restante de R$ ${fromCents(left).toFixed(2)}`, 409, "OVERFUNDING");
  const donation = await prisma.doacao.create({
    data: {
      idDoador: req.auth.idUsuario, idCesta: basket.idCesta, tipo: input.tipo,
      valorTotal: fromCents(cents),
      itens: { create: items.map(item => ({ idItem: item.idItem, quantidade: item.quantidade })) },
      pagamentos: { create: { gateway: "SIMULADOR_ACADEMICO", status: "PENDENTE", valor: fromCents(cents) } },
    }, include: { pagamentos: true, itens: true },
  });
  res.status(201).json({ donation, paymentMode: "SIMULADO", message: "Contribuição aguardando confirmação em ambiente de demonstração." });
});

// Este endpoint NUNCA recebe dinheiro real e não é montado em produção.
if (env.NODE_ENV !== "production") {
  donationRoutes.post("/:id/simulate-payment", async (req, res) => {
    if (!req.auth) throw new AppError("Não autenticado", 401);
    const id = donationId.parse(req.params.id);
    const { resultado } = z.object({ resultado: z.enum(["APROVADO", "RECUSADO"]) }).parse(req.body);
    const authId = req.auth.idUsuario;
    const result = await prisma.$transaction(async (tx) => {
      const donation = await tx.doacao.findUnique({ where: { idDoacao: id }, include: { itens: true, pagamentos: { orderBy: { idPagamento: "desc" } }, cesta: true } });
      if (!donation || donation.idDoador !== authId) throw new AppError("Contribuição não encontrada", 404, "DONATION_NOT_FOUND");
      if (donation.status === "CONFIRMADA") return { donation, completed: donation.cesta.status === "CONCLUIDA", idCesta: donation.idCesta, unchanged: true };
      const pendingPayment = donation.pagamentos.find(p => p.status === "PENDENTE");
      if (!pendingPayment) throw new AppError("Não há tentativa de pagamento pendente", 409, "PAYMENT_NOT_PENDING");
      if (resultado === "RECUSADO") {
        await tx.pagamento.update({ where: { idPagamento: pendingPayment.idPagamento }, data: { status: "RECUSADO" } });
        return { donation, completed: false, idCesta: donation.idCesta, declined: true };
      }
      const basket = await tx.cesta.findUnique({ where: { idCesta: donation.idCesta }, include: { itens: true } });
      if (!basket || basket.status !== "EM_MONTAGEM") throw new AppError("Cesta não aceita contribuições", 409, "BASKET_NOT_ACTIVE");
      const aggregate = await tx.doacao.aggregate({ where: { idCesta: donation.idCesta, status: "CONFIRMADA" }, _sum: { valorTotal: true } });
      const remaining = remainingCents(Number(basket.valorEstimado), Number(aggregate._sum.valorTotal ?? 0));
      const amount = toCents(Number(donation.valorTotal));
      if (amount > remaining) throw new AppError("Meta da cesta não comporta essa contribuição. Solicite outra.", 409, "OVERFUNDING");
      for (const item of donation.itens) {
        const basketItem = basket.itens.find(it => it.idItem === item.idItem);
        if (!basketItem || item.quantidade > basketItem.quantidadeNecessaria - basketItem.quantidadeArrecadada) {
          throw new AppError("Quantidade já preenchida por outra doação", 409, "ITEM_OVERFUNDING");
        }
        await tx.cestaItem.update({ where: { idCesta_idItem: { idCesta: donation.idCesta, idItem: item.idItem } }, data: { quantidadeArrecadada: { increment: item.quantidade } } });
      }
      await tx.pagamento.update({ where: { idPagamento: pendingPayment.idPagamento }, data: { status: "APROVADO", transactionId: `ACADEMICO-${pendingPayment.idPagamento}` } });
      const confirmedDonation = await tx.doacao.update({ where: { idDoacao: id }, data: { status: "CONFIRMADA" } });
      const completed = amount === remaining;
      if (completed) await tx.cesta.update({ where: { idCesta: donation.idCesta }, data: { status: "CONCLUIDA" } });
      return { donation: confirmedDonation, completed, idCesta: donation.idCesta };
    }, { isolationLevel: "Serializable", timeout: 15000 });
    if (!("unchanged" in result) && !("declined" in result)) {
      broadcast({ type: "basket_updated", id: result.idCesta });
      if (result.completed) {
        const basket = await prisma.cesta.findUnique({ where: { idCesta: result.idCesta } });
        const orgs = basket?.idOng
          ? await prisma.ong.findMany({ where: { idOng: basket.idOng }, select: { idUsuario: true } })
          : await prisma.ong.findMany({ where: { statusVerificacao: "APROVADA" }, select: { idUsuario: true } });
        await Promise.all(orgs.map(o => notify(o.idUsuario, "CESTA_CONCLUIDA", `A cesta #${result.idCesta} atingiu sua meta.`)));
      }
    }
    res.json({ paymentMode: "SIMULADO", ...result });
  });
}

donationRoutes.post("/:id/retry-payment", async (req, res) => {
  if (!req.auth) throw new AppError("Não autenticado", 401);
  const id = donationId.parse(req.params.id);
  const donation = await prisma.doacao.findUnique({ where: { idDoacao: id }, include: { pagamentos: true } });
  if (!donation || donation.idDoador !== req.auth.idUsuario) throw new AppError("Contribuição não encontrada", 404, "DONATION_NOT_FOUND");
  if (donation.status !== "PENDENTE" || donation.pagamentos.some(p => p.status === "APROVADO" || p.status === "PENDENTE")) {
    throw new AppError("Não é possível tentar novamente", 409, "PAYMENT_RETRY_NOT_ALLOWED");
  }
  const payment = await prisma.pagamento.create({ data: { idDoacao: id, gateway: "SIMULADOR_ACADEMICO", status: "PENDENTE", valor: donation.valorTotal } });
  res.status(201).json({ payment, paymentMode: "SIMULADO" });
});
