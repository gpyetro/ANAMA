import "dotenv/config";
import { defineConfig, env } from "prisma/config";

// Prisma CLI usa a URL direta nas migracoes cloud.
// Sem DIRECT_URL, mantem compatibilidade com o PostgreSQL local.
export default defineConfig({
  schema: "prisma/schema.prisma",
  migrations: { path: "prisma/migrations" },
  datasource: {
    url: process.env.DIRECT_URL || env("DATABASE_URL"),
  },
});
