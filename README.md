# ANAMÃ — Plataforma digital de doações fracionadas

**Projeto acadêmico — TCC do curso Técnico em Desenvolvimento de Sistemas, ETEC Zona Leste (2026).**

O ANAMÃ é um protótipo que integra uma aplicação web, um aplicativo móvel e uma API para apoiar doações fracionadas de cestas básicas, a gestão demonstrativa de organizações parceiras e o acompanhamento de solicitações de auxílio.

> **Atenção:** pagamentos e entregas são **simulados** no protótipo. A aplicação **não cobra dinheiro**, não comprova entregas físicas e **não deve ser exposta publicamente sem adequações de segurança e privacidade**.

## Equipe e origem do projeto

- Enzo de Lima Lombardi
- Pedro Henrique Amaro Rodrigues
- Pedro Moraes Veloso
- Pyetro Gabriel Cordeiro Felizardo
- Orientação: Prof. Marcelo Collado — ETEC Zona Leste

O código foi desenvolvido pelo grupo e contém evolução da base versionada no repositório original da equipe, `velosopedro/anama` (commit `3475d73`), com módulos adicionais e ajustes realizados durante os ensaios acadêmicos.

## Estrutura

```text
apps/
  api/       API REST em Node.js, Express, TypeScript, Prisma e PostgreSQL
  web/       Interface web em React, TypeScript e Vite
  mobile/    Aplicativo React Native com Expo SDK 58
scripts/     Rotinas de verificação integrada
```

O repositório usa **npm workspaces**. A branch principal é `main`.

## Funcionalidades implementadas no protótipo

- Cadastro e autenticação por perfil (doador, família, ONG e administrador).
- Solicitação e acompanhamento de cestas básicas por famílias.
- Doações por valor ou item, com confirmação ou recusa **simulada** em ambiente de desenvolvimento.
- Atualização do progresso da cesta após confirmação simulada; prevenção de contribuições acima da meta.
- Homologação de ONGs, vinculação de cestas, indicadores de acompanhamento e controle demonstrativo de estoque.
- Agendamento e acompanhamento de entregas por estados (`PENDENTE`, `EM_ROTA`, `ENTREGUE`), sem comprovação de entrega física.
- Notificações armazenadas no PostgreSQL.
- Atualização da interface web por Server-Sent Events (SSE), com consulta periódica alternativa.
- Prévia **aproximada** da ordem de paradas por distância Haversine e heurística do vizinho mais próximo; **não** é um mapa rodoviário.

## Requisitos do ambiente de desenvolvimento

- Windows com Node.js e npm compatíveis com as dependências do projeto.
- PostgreSQL local (os ensaios da equipe foram feitos com PostgreSQL 17).
- Visual Studio Code e Git.
- Expo Go no celular compatível com o **Expo SDK 58**, para os testes do aplicativo mobile.
- Computador e celular na mesma rede local durante os ensaios no dispositivo físico.

## Configuração inicial (PowerShell)

Na raiz do projeto:

```powershell
npm.cmd install
Copy-Item apps/api/.env.example apps/api/.env
Copy-Item apps/web/.env.example apps/web/.env
Copy-Item apps/mobile/.env.example apps/mobile/.env
```

Edite **apenas os arquivos `.env` locais**, que são ignorados pelo Git. Em `apps/api/.env`, configure credenciais próprias do banco de **teste**, `JWT_SECRET`, `ENCRYPTION_KEY` e senhas das contas de demonstração. **Nunca envie senhas, tokens, dados de famílias ou `.env` reais para o GitHub.**

No arquivo `apps/mobile/.env`, ajuste `EXPO_PUBLIC_API_URL` para o IP da máquina na rede local. `localhost` não aponta para o computador quando o aplicativo é executado num celular físico.

Prepare o banco PostgreSQL e, a partir da raiz, execute:

```powershell
npm.cmd run db:generate
npm.cmd run db:migrate
npm.cmd run db:seed
npm.cmd run db:demo
```

O nome da base e as credenciais são configurados pela variável privada `DATABASE_URL`; o repositório não inclui banco com dados reais.

## Executar

Abra terminais independentes na raiz do projeto:

```powershell
npm.cmd run dev:api
```

```powershell
npm.cmd run dev:web
```

```powershell
npm.cmd run dev:mobile
```

Endereços padrão de desenvolvimento:

- Saúde da API: `http://localhost:3333/health`
- Web: `http://localhost:5173`
- API REST: `http://localhost:3333/api/v1`
- Mobile: QR Code apresentado pelo Expo CLI, com celular na mesma rede local.

## Testes e verificações

```powershell
npm.cmd run test:rules
npm.cmd run build:api
npm.cmd run build:web
npm.cmd run typecheck --workspace=@anama/mobile
Push-Location apps/mobile
npx.cmd expo-doctor
Pop-Location
```

**Observação:** os comandos são instruções de verificação, não garantia de que todos passaram nesta ou em outras máquinas. Os resultados devem ser registrados por quem executou os testes. Os ensaios acompanhados pela equipe incluíram autenticação, cestas, doações simuladas, sincronização entre web e iPhone, estoque, entregas demonstrativas e autorização por perfil.

O teste integrado `npm.cmd run test:smoke` altera dados de um banco de testes. Leia `scripts/smoke-api.mjs` e execute **somente** em base descartável e com confirmação explícita; não execute em base real.

## Segurança, privacidade e limites

- **Não existe integração com instituição financeira, PIX, gateway real ou webhook de pagamento** neste protótipo.
- O endpoint de simulação de pagamento só é habilitado em ambiente não produtivo.
- O ambiente de desenvolvimento foi executado por HTTP local. Uma implantação externa exigiria HTTPS e revisão de autenticação, autorizações, dados pessoais, segredos e vulnerabilidades de dependências.
- O projeto implementa proteções específicas (incluindo autenticação por perfil e cifragem de endereços armazenados), mas isso **não constitui certificação de conformidade integral à LGPD**.
- Estados como `ENTREGUE` indicam a transição registrada no sistema de demonstração, não a comprovação de entrega física.
- A prévia de rotas usa distâncias geográficas aproximadas, não itinerários viários reais.

## Versionamento

O repositório privado `gpyetro/ANAMA` foi iniciado na branch `main` com o commit `6b47d61`, que registra o protótipo web, a API e o aplicativo móvel. Novas alterações devem ser revisadas antes de `git add`, `git commit` e `git push`, com atenção especial a arquivos confidenciais.

## Documentação do TCC

A monografia da penúltima entrega apresenta referencial teórico, pesquisa de campo anonimizada, requisitos, diagramas UML, modelagem do banco, desenvolvimento, testes e limitações do protótipo. As evidências visuais devem retratar **apenas estados observados em execução**, sem representar pagamentos e entregas reais.
