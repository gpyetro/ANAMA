import { Router } from "express";
import { z } from "zod";
import { prisma } from "../../database/prisma.js";
import { authenticate } from "../../middlewares/authenticate.js";
import { authorize } from "../../middlewares/authorize.js";
import { requireApprovedOrganization } from "../../middlewares/require-approved-organization.js";
import { AppError } from "../../shared/errors/app-error.js";
import { nextDeliveryStatus } from "../../shared/domain/donation-math.mjs";
import { broadcast, notify } from "../updates/updates.js";
import { planRoute } from "../../shared/domain/route-math.mjs";

const deliveryInput = z.object({ idCesta: z.number().int().positive(), dataAgendada: z.string().datetime({ offset: true }) });
const statusInput = z.object({ status: z.enum(["EM_ROTA", "ENTREGUE"]) });
const positionSchema = z.object({ latitude: z.coerce.number().min(-90).max(90), longitude: z.coerce.number().min(-180).max(180) });
const positiveId = z.coerce.number().int().positive();

export const deliveryRoutes = Router();
deliveryRoutes.use(authenticate, authorize("ONG"), requireApprovedOrganization);
async function getOrg(idUsuario: number) {
  const org = await prisma.ong.findUnique({ where: { idUsuario } });
  if (!org || org.statusVerificacao !== "APROVADA") throw new AppError("ONG não homologada", 403, "ORGANIZATION_NOT_APPROVED");
  return org;
}

const includeDelivery = { cesta: { include: { familia: { select: { codigoPublico: true, endereco: { select: { latitude: true, longitude: true } } } }, itens: { include: { item: true } } } } } as const;

deliveryRoutes.get("/", async (req, res) => {
  if (!req.auth) throw new AppError("Não autenticado", 401);
  const org = await getOrg(req.auth.idUsuario);
  const deliveries = await prisma.entrega.findMany({ where: { idOng: org.idOng }, include: includeDelivery, orderBy: { dataAgendada: "asc" } });
  res.json({ deliveries });
});

deliveryRoutes.post("/", async (req, res) => {
  if (!req.auth) throw new AppError("Não autenticado", 401);
  const org = await getOrg(req.auth.idUsuario);
  const input = deliveryInput.parse(req.body);
  const dataAgendada = new Date(input.dataAgendada);
  if (dataAgendada.getTime() < Date.now() - 60000) throw new AppError("A data da entrega deve estar no futuro", 400, "INVALID_DELIVERY_DATE");
  const delivery = await prisma.$transaction(async tx => {
    const basket = await tx.cesta.findUnique({ where: { idCesta: input.idCesta }, include: { itens: true, entrega: true } });
    if (!basket || basket.idOng !== org.idOng || basket.status !== "CONCLUIDA" || basket.entrega) throw new AppError("Cesta não disponível para agendamento", 409, "BASKET_NOT_DELIVERABLE");
    for (const item of basket.itens) {
      const stock = await tx.estoqueOng.findUnique({ where: { idOng_idItem: { idOng: org.idOng, idItem: item.idItem } } });
      if (!stock || stock.quantidadeDisponivel - stock.quantidadeReservada < item.quantidadeNecessaria) throw new AppError(`Estoque insuficiente para o item ${item.idItem}`, 409, "INSUFFICIENT_STOCK");
    }
    for (const item of basket.itens) {
      await tx.estoqueOng.update({ where: { idOng_idItem: { idOng: org.idOng, idItem: item.idItem } }, data: { quantidadeReservada: { increment: item.quantidadeNecessaria } } });
    }
    return tx.entrega.create({ data: { idOng: org.idOng, idCesta: input.idCesta, dataAgendada } });
  }, { isolationLevel: "Serializable", timeout: 15000 });
  broadcast({ type: "delivery_updated", id: delivery.idEntrega });
  res.status(201).json({ delivery });
});

deliveryRoutes.patch("/:id/status", async (req, res) => {
  if (!req.auth) throw new AppError("Não autenticado", 401);
  const org = await getOrg(req.auth.idUsuario);
  const idEntrega = positiveId.parse(req.params.id);
  const { status } = statusInput.parse(req.body);
  const result = await prisma.$transaction(async tx => {
    const delivery = await tx.entrega.findUnique({ where: { idEntrega }, include: { cesta: { include: { itens: true, familia: true } } } });
    if (!delivery || delivery.idOng !== org.idOng) throw new AppError("Entrega não encontrada", 404, "DELIVERY_NOT_FOUND");
    if (!nextDeliveryStatus(delivery.status, status)) throw new AppError("Transição inválida do status de entrega", 409, "INVALID_DELIVERY_STATUS");
    if (status === "ENTREGUE") {
      for (const item of delivery.cesta.itens) {
        const stock = await tx.estoqueOng.findUnique({ where: { idOng_idItem: { idOng: org.idOng, idItem: item.idItem } } });
        if (!stock || stock.quantidadeReservada < item.quantidadeNecessaria || stock.quantidadeDisponivel < item.quantidadeNecessaria) throw new AppError("Estoque reservado inconsistente", 409, "STOCK_INCONSISTENT");
        await tx.estoqueOng.update({ where: { idOng_idItem: { idOng: org.idOng, idItem: item.idItem } }, data: { quantidadeReservada: { decrement: item.quantidadeNecessaria }, quantidadeDisponivel: { decrement: item.quantidadeNecessaria } } });
      }
      await tx.cesta.update({ where: { idCesta: delivery.idCesta }, data: { status: "ENTREGUE" } });
    }
    const updated = await tx.entrega.update({ where: { idEntrega }, data: { status } });
    return { updated, familyUser: delivery.cesta.familia.idUsuario, idCesta: delivery.idCesta };
  }, { isolationLevel: "Serializable", timeout: 15000 });
  await notify(result.familyUser, "ENTREGA", `Sua cesta #${result.idCesta} teve o status atualizado para ${status}.`);
  broadcast({ type: "delivery_updated", id: result.updated.idEntrega });
  broadcast({ type: "basket_updated", id: result.idCesta });
  res.json({ delivery: result.updated });
});

deliveryRoutes.get("/route-preview", async (req, res) => {
  if (!req.auth) throw new AppError("Não autenticado", 401);
  const org = await getOrg(req.auth.idUsuario);
  const origin = positionSchema.parse(req.query);
  const deliveries = await prisma.entrega.findMany({ where: { idOng: org.idOng, status: { in: ["PENDENTE", "EM_ROTA"] } }, include: { cesta: { include: { familia: { select: { codigoPublico: true, endereco: { select: { latitude: true, longitude: true } } } } } } } });
  const mapped = deliveries.flatMap(d => {
    const point = d.cesta.familia.endereco;
    return point?.latitude != null && point?.longitude != null ? [{ idEntrega: d.idEntrega, codigoFamilia: d.cesta.familia.codigoPublico, latitude: Number(point.latitude), longitude: Number(point.longitude) }] : [];
  });
  // Distâncias geodésicas estimadas, não percurso em ruas. Dados restritos à ONG homologada.
  const planned = planRoute(origin, mapped);
  res.json({ ...planned, semCoordenadas: deliveries.length - mapped.length, aviso: "Ordem aproximada por distância em linha reta; não é navegação rodoviária." });
});
