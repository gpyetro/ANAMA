import { EventEmitter } from "node:events";
import type { Request, Response } from "express";
import { prisma } from "../../database/prisma.js";
import { AppError } from "../../shared/errors/app-error.js";

const events = new EventEmitter();
events.setMaxListeners(1000);
export type Update = { type: "basket_updated" | "notification" | "delivery_updated" | "stock_updated"; id?: number; userId?: number };
export function broadcast(update: Update) { events.emit("update", update); }
export async function notify(idUsuario: number, tipo: string, mensagem: string) {
  await prisma.notificacao.create({ data: { idUsuario, tipo, mensagem } });
  broadcast({ type: "notification", userId: idUsuario });
}
export function streamUpdates(req: Request, res: Response) {
  if (!req.auth) throw new AppError("Não autenticado", 401);
  const idUsuario = req.auth.idUsuario;
  res.status(200);
  res.setHeader("Content-Type", "text/event-stream");
  res.setHeader("Cache-Control", "no-cache, no-transform");
  res.setHeader("Connection", "keep-alive");
  res.flushHeaders?.();
  res.write("retry: 3000\n\n");
  const handler = (update: Update) => {
    if (update.userId && update.userId !== idUsuario) return;
    res.write(`event: change\ndata: ${JSON.stringify(update)}\n\n`);
  };
  events.on("update", handler);
  const timer = setInterval(() => res.write(": heartbeat\n\n"), 25000);
  req.on("close", () => { clearInterval(timer); events.off("update", handler); });
}
export const updateFilter = streamUpdates;
