# ANAMÃ — plataforma solidária (protótipo acadêmico)

Base de código preservada do projeto da equipe ANAMÃ (repositório de origem: https://github.com/velosopedro/anama, commit `3475d73`). Esta cópia adiciona módulos de doação fracionada, pagamento **exclusivamente simulado**, estoque, acompanhamento de entregas, notificações, painel web e aplicativo mobile Expo. Créditos do grupo original mantidos.

**IMPORTANTE — estado de validação:** o código foi ampliado e as regras puras possuem testes automáticos; a instalação de pacotes, o build completo, o banco PostgreSQL em funcionamento e a aplicação mobile em dispositivo real **não puderam ser executados neste ambiente**, por indisponibilidade de acesso ao registro do npm e ausência de um servidor PostgreSQL. O grupo precisa executar os comandos abaixo e corrigir eventuais incompatibilidades antes de apresentar o sistema como homologado. Não há gateway financeiro real, nem cobrança de usuários.

## Pré-requisitos

- Node.js **22.13+**, npm e PostgreSQL (instância local, com banco e usuário próprios para testes).
- No celular: **Expo Go** compatível com Expo SDK **57**, ou ambiente Android configurado para rodar a aplicação.
- PC e celular na mesma rede local; nunca use a senha do banco ou a chave JWT em repositório público.

## 1 — Instalação (Windows PowerShell)

Abra a pasta `anama` no VS Code. No terminal PowerShell, a partir da raiz:

```powershell
node -v
npm -v
npm install
```

O comando `npm install` cria um `package-lock.json` novo, coerente com o app Expo acrescentado. **Não use `npm ci` na primeira instalação desta cópia.** Depois de instalar e testar, salve o novo lockfile no Git.

## 2 — Configurar API e banco

1. Crie um banco PostgreSQL vazio e um usuário com permissão nesse banco. Exemplo ilustrativo de nome: `anama_dev`.
2. Copie `apps/api/.env.example` para `apps/api/.env`.
3. Edite somente o arquivo privado `.env` com `DATABASE_URL` válido, `JWT_SECRET` aleatório com pelo menos 32 caracteres, `ENCRYPTION_KEY` distinto com pelo menos 32 caracteres e `CORS_ORIGIN=http://localhost:5173`.
4. Defina `ADMIN_NAME`, `ADMIN_EMAIL`, `ADMIN_PASSWORD` e `DEMO_PASSWORD` somente nesse `.env`. Nunca compartilhe as credenciais.
5. No terminal execute:

```powershell
cd apps/api
npx prisma generate --config prisma7.config.ts
npx prisma migrate deploy --config prisma7.config.ts
npm run db:seed
npm run db:demo
cd ../..
```

A segunda migração adiciona o vínculo da cesta com a ONG. Os dados de demonstração têm contas **somente para uso local**: altere qualquer senha de exemplo antes de expor o sistema em rede compartilhada.

## 3 — Iniciar API e site

Abra dois terminais na raiz:

```powershell
# Terminal 1
npm run dev:api
```

```powershell
# Terminal 2
npm run dev:web
```

A API usa `http://localhost:3333/health` e o site usa `http://localhost:5173`, por padrão. No site, crie uma conta de família, doador e ONG. Para usar a ONG, entre como ADMIN e aprove o cadastro. A partir daí, solicite uma cesta, abra como doador e realize contribuição pelo **simulador**, nunca com dinheiro verdadeiro.

## 4 — App mobile Expo

1. Copie `apps/mobile/.env.example` para `apps/mobile/.env`.
2. Se usar **emulador Android**, configure `EXPO_PUBLIC_API_URL=http://10.0.2.2:3333/api/v1`.
3. Se usar **celular físico**, substitua por `http://IP_DO_SEU_NOTBOOK_NA_REDE:3333/api/v1` e permita a conexão no firewall local somente na rede confiável.
4. Execute na raiz:

```powershell
npm run dev:mobile
```

A tela de login, solicitação de auxílio, doação simulada, listagem, estoque da ONG, notificações e atualização de entrega estão no aplicativo. O agendamento de nova entrega e a rota completa são geridos pela versão web da ONG.

**Expo SDK 57:** React Native 0.86, React 19.2.3, Node.js 22.13+. Documentação: https://docs.expo.dev/versions/v57.0.0/ . A versão do Expo Go instalada deve ser compatível.

## 5 — Testes

```powershell
npm run test:rules
npm run build:api
npm run build:web
```

Para o teste integrado, use apenas banco de teste descartável e os dados do admin configurados anteriormente. O script altera o banco, criando contas e doações **simuladas**:

```powershell
$env:RUN_SMOKE_CONFIRM="1"
$env:ADMIN_EMAIL="seu-admin-de-teste@example.test"
$env:ADMIN_PASSWORD="sua-senha-local-de-teste"
npm run test:smoke
```

**Atenção:** o script de smoke depende de API e PostgreSQL em execução; os testes de regras (`test:rules`) não dependem de banco.

## Funcionalidades principais

- API REST: autenticação com validação e senha hash; cadastro dos perfis; homologação de ONGs.
- Família: solicitação e composição de cesta; armazenamento cifrado do endereço da família.
- Doador: contribuição em item ou valor, transação pendente, aprovação/recusa simuladas, nova tentativa e progresso de cesta.
- ONG: vinculação de cestas sem responsável, painel de indicadores, estoque físico, reserva automática na criação de entrega e mudança de status da entrega; planejamento aproximado por coordenadas com método do vizinho mais próximo.
- Notificações persistentes e atualização de telas via Server-Sent Events (SSE) e polling de segurança.
- Mobile: aplicativo Expo com perfis e operações centrais.

## Segurança e limites de escopo

- **Não existe pagamento real.** `POST /api/v1/donations/:id/simulate-payment` só é habilitado quando `NODE_ENV != production`. Para uso externo seria obrigatório integrar gateway regulamentado e autenticar webhooks no servidor.
- Em desenvolvimento local é utilizado HTTP. Para exposição na internet, configurar **HTTPS**, política de cookies/sessão segura, monitoramento, logs adequados, rate limits, proteção contra ataques web e gestão de segredos. A simples execução local não comprova conformidade integral à LGPD.
- Endereços são protegidos com AES-256-GCM; não publique o `.env` ou coordenadas pessoais. A rota de planejamento de entregas devolve **distâncias aproximadas em linha reta**, não navegação rodoviária.
- O servidor mantém progresso financeiro a partir apenas de pagamentos simulados aprovados e usa transação `Serializable` para evitar confirmar contribuições concorrentes acima da meta.
- A conclusão do fluxo físico pressupõe abastecimento manual do estoque real no painel da ONG; não significa que produtos foram comprados ou entregues de verdade.
- Ao documentar o TCC, use somente operações realmente reproduzidas pelo grupo e valide os dados antes de compartilhar capturas.

## Organização

- `apps/api` — API Express/Prisma/PostgreSQL.
- `apps/web` — frontend React/Vite.
- `apps/mobile` — aplicativo React Native/Expo.
- `apps/api/test` — testes de regras de negócio (Node test runner).
- `scripts/smoke-api.mjs` — teste manual integrado, apenas com banco de testes.

## Próximas verificações antes da entrega escolar

Executar `npm install`, migrações, builds, testes e navegação real web/mobile; registrar os erros encontrados, corrigir eventuais incompatibilidades; conferir permissões, privacidade e consistência das doações. Integrar meio de pagamento verdadeiro somente se o projeto ultrapassar o escopo acadêmico e houver requisitos legais, operacionais e aprovação adequada.
