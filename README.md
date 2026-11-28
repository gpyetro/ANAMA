# ANAMÃ — Plataforma digital de doações fracionadas

**Projeto acadêmico — TCC do curso Técnico em Desenvolvimento de Sistemas, ETEC Zona Leste (2026).**

O ANAMÃ é um protótipo que integra uma aplicação web, um aplicativo móvel e uma API para apoiar doações fracionadas de cestas básicas, a gestão demonstrativa de organizações parceiras e o acompanhamento de solicitações de auxílio.

> **Atenção:** pagamentos e entregas são **simulados**. A aplicação **não cobra dinheiro** e não comprova entregas físicas. A versão online é uma **demonstração acadêmica**, com contas fictícias e sem dados reais de famílias.

## Demonstração online

| Parte | Endereço | Hospedagem |
| --- | --- | --- |
| Web | https://anama-web-demo.vercel.app | Vercel |
| API (saúde) | https://anama-api-demo.onrender.com/health | Render |
| Banco de dados | PostgreSQL gerenciado | Neon |
| Aplicativo | Expo Go no celular, conectado à API do Render | Expo |

- O Render gratuito hiberna quando fica sem uso. O primeiro acesso pode levar até 1 minuto; abra o endereço `/health` antes de usar.
- Em produção, o cadastro público fica bloqueado: o acesso é feito apenas com as contas de demonstração da equipe.
- O deploy é automático a partir da branch `pitch-cloud`.

## Equipe e origem do projeto

- Enzo de Lima Lombardi
- Pedro Henrique Amaro Rodrigues
- Pedro Moraes Veloso
- Pyetro Gabriel Cordeiro Felizardo
- Orientação: Prof. Marcelo Collado — ETEC Zona Leste

O código foi desenvolvido pelo grupo e contém evolução da base versionada no repositório original da equipe, `velosopedro/anama` (commit `3475d73`), com módulos adicionais e ajustes realizados durante os ensaios acadêmicos.

## Arquitetura

```text
Web (React, Vercel)  ──┐
                       ├──>  API REST (Node.js/Express, Render)  ──>  PostgreSQL (Prisma, Neon)
App (Expo, Expo Go) ───┘
```

A Web e o aplicativo nunca acessam o banco diretamente: toda leitura e escrita passa pela API, que concentra autenticação, autorização por perfil e regras de negócio.

## Estrutura

```text
apps/
  api/       API REST em Node.js, Express, TypeScript, Prisma e PostgreSQL
  web/       Interface web em React, TypeScript e Vite
  mobile/    Aplicativo React Native com Expo SDK 58
scripts/     Rotinas de verificação integrada
```

O repositório usa **npm workspaces**.

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

## Identidade visual

- Paleta e componentes da Web centralizados em `apps/web/src/styles/global.css` (variáveis no início do arquivo); o aplicativo usa a mesma paleta em `apps/mobile/App.tsx`.
- Favicon: `apps/web/public/favicon.ico`. Para trocar, substitua apenas esse arquivo.
- Logo: `apps/web/public/logo-anama.png` (emblema), `apps/web/public/logo-anama-completa.png` (com o nome) e `apps/mobile/assets/logo-anama.png`.
- Foto do banner da tela inicial: `apps/web/public/hero-cestas.jpg` e `apps/mobile/assets/hero-cestas.jpg`.

## Testar o aplicativo no celular (Expo Go)

O aplicativo usa a API publicada no Render, então só é preciso um computador para servir o app ao Expo Go.

```powershell
git clone https://github.com/gpyetro/ANAMA.git
cd ANAMA
git checkout pitch-cloud
npm.cmd install
Set-Content -Path apps/mobile/.env -Value "EXPO_PUBLIC_API_URL=https://anama-api-demo.onrender.com/api/v1" -Encoding ascii
cd apps/mobile
npx.cmd expo start --clear
```

Escaneie o QR Code com o Expo Go (compatível com o **Expo SDK 58**). Se o celular não conectar na mesma rede, use `npx.cmd expo start --tunnel`.

## Desenvolvimento local (opcional)

Requisitos: Node.js e npm, PostgreSQL local (os ensaios da equipe usaram PostgreSQL 17), Visual Studio Code e Git.

Na raiz do projeto:

```powershell
npm.cmd install
Copy-Item apps/api/.env.example apps/api/.env
Copy-Item apps/web/.env.example apps/web/.env
Copy-Item apps/mobile/.env.example apps/mobile/.env
```

Edite **apenas os arquivos `.env` locais**, que são ignorados pelo Git. Em `apps/api/.env`, configure credenciais próprias do banco de **teste**, `JWT_SECRET`, `ENCRYPTION_KEY` e senhas das contas de demonstração. **Nunca envie senhas, tokens, dados de famílias ou `.env` reais para o GitHub.**

Para usar o aplicativo com a API local, ajuste `EXPO_PUBLIC_API_URL` em `apps/mobile/.env` para o IP do computador na rede local. `localhost` não aponta para o computador quando o aplicativo roda num celular físico.

Prepare o banco PostgreSQL e, a partir da raiz, execute:

```powershell
npm.cmd run db:generate
npm.cmd run db:migrate
npm.cmd run db:seed
npm.cmd run db:demo
```

Em terminais separados:

```powershell
npm.cmd run dev:api
npm.cmd run dev:web
npm.cmd run dev:mobile
```

Endereços locais: API `http://localhost:3333/api/v1` (saúde em `/health`) e Web `http://localhost:5173`.

## Testes e verificações

```powershell
npm.cmd run test:rules
npm.cmd run build:api
npm.cmd run build:web
npm.cmd run typecheck --workspace=@anama/mobile
```

`test:rules` executa 6 testes automatizados das regras de doação, entrega e rota. Os ensaios acompanhados pela equipe incluíram autenticação, cestas, doações simuladas, sincronização entre web e iPhone, estoque, entregas demonstrativas e autorização por perfil.

O teste integrado `npm.cmd run test:smoke` altera dados do banco. Leia `scripts/smoke-api.mjs` e execute **somente** em base descartável; nunca no banco da demonstração.

## Segurança, privacidade e limites

- **Não existe integração com instituição financeira, PIX, gateway real ou webhook de pagamento.**
- O endpoint de simulação de pagamento só é habilitado fora do ambiente de produção.
- A demonstração online usa HTTPS, CORS restrito ao domínio oficial da Web, cabeçalhos de segurança (Helmet), senhas com hash (bcrypt) e autenticação por token JWT.
- O projeto implementa proteções específicas, incluindo pseudonimização das famílias, autorização por perfil e cifragem de endereços armazenados, mas isso **não constitui certificação de conformidade integral à LGPD**.
- Estados como `ENTREGUE` indicam a transição registrada no sistema de demonstração, não a comprovação de entrega física.
- A prévia de rotas usa distâncias geográficas aproximadas, não itinerários viários reais.

## Versionamento

- `pitch-cloud`: versão publicada (Vercel e Render).
- `main`: versão de referência do projeto.
- `refinamento-visual-final`: histórico do refinamento visual da versão final.

Alterações devem ser revisadas antes de `git add`, `git commit` e `git push`, com atenção a arquivos confidenciais.

## Documentação do TCC

A monografia apresenta referencial teórico, pesquisa de campo anonimizada (n = 100), requisitos, diagramas UML, modelagem do banco, desenvolvimento, testes e limitações do protótipo.
