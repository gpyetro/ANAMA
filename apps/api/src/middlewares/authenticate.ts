import type { RequestHandler } from "express";

import { AppError } from "../shared/errors/app-error.js";
import { verifyAuthToken } from "../shared/security/token.js";
import { prisma } from "../database/prisma.js";

export const authenticate: RequestHandler = async (
  request,
  _response,
  next,
) => {
  const authorization = request.headers.authorization;

  if (!authorization) {
    next(
      new AppError(
        "Token de autenticação não informado.",
        401,
        "AUTH_TOKEN_MISSING",
      ),
    );

    return;
  }

  const [scheme, token] = authorization.split(" ");

  if (scheme !== "Bearer" || !token) {
    next(
      new AppError(
        "Formato do token inválido.",
        401,
        "INVALID_AUTHORIZATION_HEADER",
      ),
    );

    return;
  }

  try {
    const tokenData = await verifyAuthToken(token);
    const user = await prisma.usuario.findUnique({ where: { idUsuario: tokenData.idUsuario }, select: { tipo: true, status: true } });
    if (!user || user.status !== "ATIVO" || user.tipo !== tokenData.tipo) {
      next(new AppError("Conta inativa ou token desatualizado", 401, "ACCOUNT_INVALID"));
      return;
    }
    request.auth = tokenData;
    next();
  } catch (error) {
    next(error);
  }
};
