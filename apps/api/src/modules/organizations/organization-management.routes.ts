import { Router } from "express";
import { z } from "zod";
import { prisma } from "../../database/prisma.js";
import { authenticate } from "../../middlewares/authenticate.js";
import { authorize } from "../../middlewares/authorize.js";
import { requireApprovedOrganization } from "../../middlewares/require-approved-organization.js";
import { AppError } from "../../shared/errors/app-error.js";
import { broadcast } from "../updates/updates.js";

const positiveId = z.coerce.number().int().positive();
const stockSchema = z.object({ quantidadeDisponivel: z.number().int().min(0) });

export const organizationManagementRoutes = Router();
organizationManagementRoutes.use(authenticate, authorize("ONG"), requireApprovedOrganization);
async function myOrg(idUsuario: number) {
  const org = await prisma.ong.findUnique({ where: { idUsuario } });
  if (!org || org.statusVerificacao !== "APROVADA") throw new AppError("ONG não homologada", 403, "ORGANIZATION_NOT_APPROVED");
  return org;
}

organizationManagementRoutes.get("/dashboard", async (req, res) => {
  if (!req.auth) throw new AppError("Não autenticado", 401);
  const org = await myOrg(req.auth.idUsuario);
  const baskets = await prisma.cesta.findMany({ where: { idOng: org.idOng }, include: { itens: { include: { item: true } }, familia: { select: { codigoPublico: true } } }, orderBy: { createdAt: "desc" } });
  const donations = await prisma.doacao.aggregate({ where: { idCesta: { in: baskets.map(b => b.idCesta) }, status: "CONFIRMADA" }, _sum: { valorTotal: true }, _count: true });
  const deliveries = await prisma.entrega.count({ where: { idOng: org.idOng, status: { not: "ENTREGUE" } } });
  const stocked = await prisma.estoqueOng.count({ where: { idOng: org.idOng } });
  res.json({ organization: { idOng: org.idOng, nomeFantasia: org.nomeFantasia }, totals: { cestas: baskets.length, concluidas: baskets.filter(b => b.status === "CONCLUIDA").length, valorArrecadado: Number(donations._sum.valorTotal ?? 0), numeroDoacoes: donations._count, entregasAbertas: deliveries, itensEmEstoque: stocked }, baskets });
});

organizationManagementRoutes.get("/inventory", async (req, res) => {
  if (!req.auth) throw new AppError("Não autenticado", 401);
  const org = await myOrg(req.auth.idUsuario);
  const items = await prisma.item.findMany({ orderBy: { nome: "asc" }, include: { estoques: { where: { idOng: org.idOng } } } });
  res.json({ inventory: items.map(item => ({ idItem: item.idItem, nome: item.nome, categoria: item.categoria, quantidadeDisponivel: item.estoques[0]?.quantidadeDisponivel ?? 0, quantidadeReservada: item.estoques[0]?.quantidadeReservada ?? 0 })) });
});

organizationManagementRoutes.put("/inventory/:idItem", async (req, res) => {
  if (!req.auth) throw new AppError("Não autenticado", 401);
  const org = await myOrg(req.auth.idUsuario);
  const idItem = positiveId.parse(req.params.idItem);
  const input = stockSchema.parse(req.body);
  const exists = await prisma.item.findUnique({ where: { idItem } });
  if (!exists) throw new AppError("Item não encontrado", 404, "ITEM_NOT_FOUND");
  const stock = await prisma.$transaction(async tx => {
    const existing = await tx.estoqueOng.findUnique({ where: { idOng_idItem: { idOng: org.idOng, idItem } } });
    if (existing && input.quantidadeDisponivel < existing.quantidadeReservada) throw new AppError("O estoque não pode ficar abaixo das reservas", 409, "STOCK_BELOW_RESERVATIONS");
    return tx.estoqueOng.upsert({ where: { idOng_idItem: { idOng: org.idOng, idItem } }, create: { idOng: org.idOng, idItem, quantidadeDisponivel: input.quantidadeDisponivel }, update: input });
  }, { isolationLevel: "Serializable" });
  broadcast({ type: "stock_updated" });
  res.json({ stock });
});

organizationManagementRoutes.post("/baskets/:id/claim", async (req, res) => {
  if (!req.auth) throw new AppError("Não autenticado", 401);
  const org = await myOrg(req.auth.idUsuario);
  const idCesta = positiveId.parse(req.params.id);
  const updated = await prisma.cesta.updateMany({ where: { idCesta, idOng: null, status: { in: ["EM_MONTAGEM", "CONCLUIDA"] } }, data: { idOng: org.idOng } });
  if (updated.count !== 1) throw new AppError("Cesta inexistente ou vinculada a outra ONG", 409, "BASKET_NOT_CLAIMABLE");
  broadcast({ type: "basket_updated", id: idCesta });
  res.json({ ok: true, idCesta, idOng: org.idOng });
});

organizationManagementRoutes.get("/unassigned-baskets", async (req, res) => {
  if (!req.auth) throw new AppError("Não autenticado", 401);
  await myOrg(req.auth.idUsuario);
  const baskets = await prisma.cesta.findMany({ where: { idOng: null, status: { in: ["EM_MONTAGEM", "CONCLUIDA"] } }, select: { idCesta: true, status: true, valorEstimado: true }, take: 100, orderBy: { createdAt: "desc" } });
  res.json({ baskets: baskets.map(b => ({ ...b, valorEstimado: Number(b.valorEstimado) })) });
});
