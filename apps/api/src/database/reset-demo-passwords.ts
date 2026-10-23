
import { prisma } from "./prisma.js";
import { hashPassword } from "../shared/security/password.js";

async function main() {
  const senha = process.env.DEMO_PASSWORD;

  if (!senha || senha.length < 8) {
    throw new Error("Configure DEMO_PASSWORD com pelo menos 8 caracteres no .env.");
  }

  const senhaHash = await hashPassword(senha);

  const emails = [
    "doador.demo@anama.local",
    "familia.demo@anama.local",
    "ong.demo@anama.local",
  ];

  for (const email of emails) {
    const resultado = await prisma.usuario.updateMany({
      where: { email },
      data: { senhaHash },
    });

    console.log(
      email,
      resultado.count === 1 ? "senha atualizada" : "usuário não encontrado"
    );
  }

  console.log("Atualização das contas de demonstração concluída.");
}

main()
  .catch((erro) => {
    console.error("Erro ao atualizar as senhas:", erro);
    process.exitCode = 1;
  })
  .finally(async () => {
    await prisma.$disconnect();
  });
