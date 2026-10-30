import { Router } from "express";

import { env } from "../../config/env.js";
import { authenticate } from "../../middlewares/authenticate.js";
import { login, me, register } from "./auth.controller.js";

export const authRoutes = Router();

// Nao receber cadastros ou dados pessoais de visitantes na demonstracao publica.
// Contas ficticias sao criadas previamente, apenas no banco de testes.
authRoutes.post(
  "/register",
  (_request, response, next) => {
    if (env.NODE_ENV === "production") {
      response.status(403).json({
        error: {
          code: "PUBLIC_REGISTRATION_DISABLED",
          message: "Cadastro indisponivel nesta demonstracao academica.",
        },
      });
      return;
    }
    next();
  },
  register,
);

authRoutes.post("/login", login);
authRoutes.get("/me", authenticate, me);
