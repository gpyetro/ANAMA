import { Router } from "express";

import { authenticate } from "../../middlewares/authenticate.js";
import { authorize } from "../../middlewares/authorize.js";
import { prisma } from "../../database/prisma.js";
import { AppError } from "../../shared/errors/app-error.js";
import { basketService } from "./basket.service.js";

import {
  getBasket,
  listActiveBaskets,
  listCatalogItems,
} from "./basket.controller.js";

export const basketRoutes = Router();

basketRoutes.use(authenticate);

basketRoutes.get("/", listActiveBaskets);

basketRoutes.get("/catalog/items", listCatalogItems);

basketRoutes.get("/mine", authorize("FAMILIA"), async (req, res) => {
  if (!req.auth) throw new AppError("Não autenticado", 401);
  const family = await prisma.familia.findUnique({ where: { idUsuario: req.auth.idUsuario } });
  if (!family) throw new AppError("Família não encontrada", 404);
  const rows = await prisma.cesta.findMany({ where: { idFamilia: family.idFamilia }, orderBy: { createdAt: "desc" }, take: 50, select: { idCesta: true, status: true, valorEstimado: true, createdAt: true } });
  res.json({ baskets: rows.map(b => ({ ...b, valorEstimado: Number(b.valorEstimado) })) });
});

basketRoutes.get("/:id", getBasket);
