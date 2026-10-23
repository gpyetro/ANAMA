import { Router } from "express";
import { z } from "zod";
import { prisma } from "../../database/prisma.js";
import { authenticate } from "../../middlewares/authenticate.js";
import { AppError } from "../../shared/errors/app-error.js";

export const notificationRoutes = Router();
notificationRoutes.use(authenticate);
notificationRoutes.get("/", async (req, res) => {
  if (!req.auth) throw new AppError("Não autenticado", 401);
  const notifications = await prisma.notificacao.findMany({ where: { idUsuario: req.auth.idUsuario }, orderBy: { idNotificacao: "desc" }, take: 100 });
  res.json({ notifications });
});
notificationRoutes.patch("/read-all", async (req, res) => {
  if (!req.auth) throw new AppError("Não autenticado", 401);
  await prisma.notificacao.updateMany({ where: { idUsuario: req.auth.idUsuario, lida: false }, data: { lida: true } });
  res.json({ ok: true });
});
notificationRoutes.patch("/:id/read", async (req, res) => {
  if (!req.auth) throw new AppError("Não autenticado", 401);
  const id = z.coerce.number().int().positive().parse(req.params.id);
  const result = await prisma.notificacao.updateMany({ where: { idNotificacao: id, idUsuario: req.auth.idUsuario }, data: { lida: true } });
  if (!result.count) throw new AppError("Notificação não encontrada", 404, "NOTIFICATION_NOT_FOUND");
  res.json({ ok: true });
});
