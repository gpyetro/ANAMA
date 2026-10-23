import type { Request, Response } from "express";
import { z } from "zod";
import { prisma } from "../../database/prisma.js";
import { AppError } from "../../shared/errors/app-error.js";
import { encryptAddress } from "../../shared/security/private-address.js";
const schema = z.object({ endereco: z.string().trim().min(10).max(450), latitude: z.number().min(-90).max(90).optional(), longitude: z.number().min(-180).max(180).optional() }).refine(v => (v.latitude == null) === (v.longitude == null), {message:"Forneça ambas as coordenadas"});
export async function updateMyAddress(req: Request, res: Response) {
  if (!req.auth) throw new AppError("Não autenticado", 401);
  const input = schema.parse(req.body);
  const family = await prisma.familia.findUnique({ where: { idUsuario: req.auth.idUsuario } });
  if (!family) throw new AppError("Família não encontrada",404);
  const encrypted = encryptAddress(input.endereco);
  await prisma.enderecoFamilia.upsert({
    where: { idFamilia: family.idFamilia },
    create: { idFamilia: family.idFamilia, enderecoProtegido: encrypted, latitude: input.latitude ?? null, longitude: input.longitude ?? null },
    update: { enderecoProtegido: encrypted, latitude: input.latitude ?? null, longitude: input.longitude ?? null },
  });
  res.json({ ok: true, message: "Endereço armazenado com proteção de acesso." });
}
