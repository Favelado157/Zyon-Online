# Legend Online Ultra

Backend TypeScript (executado direto pelo Node 24+, sem build) + Fastify (porta 8080) e PostgreSQL 17.

## Login do cliente Flash

1. Portal: `POST /api/v1/auth/login` → token de sessao.
2. Portal: `POST /api/v1/play/launch {serverId}` → `token` (ticket de 5 min) e `configUrl`.
3. Cliente baixa `/api/v1/play/config/{id}.xml` (enderecos nossos e chave RSA do servidor).
4. Cliente: `POST /login` com `p = RSA(usuario|ticket|tempPassword|userId)` → `userId`, `Address`, `Port`.
5. Personagem novo: `/visualizeregister` (nome e classe; `icon` 1-6 define classe e sexo).
6. Socket (porta `socket_port` do servidor, ex. 9201; TCP, WebSocket `/socket` e policy Flash na mesma porta):
   `20001 LoginReqMsg{key = md5(tempPassword), ekeys}` troca a chave da cifra nos dois sentidos e responde 3841, 3 `PlayerMsg`, 150 `ArmyMsg`.
   `8224` (carga) responde os 9 pacotes que `LoginInitDataAccept` espera (4245, 4233, 4160, 4173, 4176, 4156, 4157, 4153, 4154) mais 150 e 100.
   `8224 user=true` responde 112 (quests), 4598, 150 e 6 `LoginStateMsg`.

## Protocolo

- `data/protocol/schema.json`: 1 667 mensagens geradas dos `.as` do cliente (`node tools/gen-proto.ts`), por `pacote.Nome` (ha 16 nomes repetidos, ex. `simple.PropertyMsg`).
- `data/protocol/opcodes.json`: opcode para mensagem (`node tools/gen-opcodes.ts`).
- Opcodes que o cliente manda sem handler vao para `audit.unhandled_opcodes` (lista de trabalho).
- `20010` chega a cada 60 s do relogio do cliente; intervalo menor gera alerta `speed_hack`.
- `/cdn/code_md5.dat` e `/cdn/res_md5.dat` usam os manifests compactados da referencia Rust em `.docs/legend-online-main/index`; regenere-os ao atualizar esses manifests.

## Logs

O terminal usa `pino-pretty`: cada linha mostra horario e nivel (`[INFO]`, `[PROBLEM]`, `[ERROR]`), e URLs HTTP aparecem sem query string para nao expor tickets ou chaves de sessao.

## Configuracao

`.env` tem so `PORT`, `DATABASE_URL`, `APP_SECRET` (chave mestra) e o admin inicial. O resto fica no banco:
`liveops.settings` (URLs publicas, duracao de sessoes, taxas) e `core.secrets` (Stripe, SMTP), cifrado com AES-256-GCM e editado em `/api/admin/secrets`.
Para gravar um segredo pelo terminal: `SECRET_VALUE=... node --env-file=.env tools/set-secret.ts stripe.secret_key`. O `db:reset` preserva os segredos.

Admin: `POST /api/admin/auth/login`, `GET /api/admin/auth/me` (permissoes por papel).

## Arquitetura do Projeto

### Estrutura de Pastas

```
legend-online-ultra/
├── apps/
│   ├── server/          # Backend Fastify + WebSocket (porta 8080)
│   │   ├── src/
│   │   │   ├── game/    # Lógica do jogo (batalhas, guildas, itens, etc.)
│   │   │   ├── handlers/ # Handlers de opcodes (itens, guildas, castelo, etc.)
│   │   │   ├── routes/   # Rotas HTTP (bridge, admin, stripe, etc.)
│   │   │   ├── services/ # Agendadores, eventos, etc.
│   │   │   ├── test/     # Testes automatizados
│   │   │   └── index.ts  # Entry point
│   │   └── test/        # Testes de integração
│   │
│   ├── web/             # Frontend Next.js (Portal Web)
│   │   ├── src/
│   │   │   ├── app/      # App Router (Next.js 15)
│   │   │   ├── components/
│   │   │   ├── services/
│   │   │   └── lib/
│   │   └── package.json
│   │
│   └── launcher/        # Launcher AIR/Flash (legacy)
│
├── packages/
│   ├── db/              # Package de banco de dados
│   │   ├── migrations/  # DDL versionado
│   │   ├── seeds/       # Seeds idempotentes
│   │   └── src/         # Utils de DB
│   │
│   └── protocol/        # Codec Protobuf + schemas
│
├── data/
│   ├── protocol/        # Schemas gerados (schema.json, opcodes.json)
│   └── templates/       # 292 listas originais (tempinfos, Legend Online BR)
│
├── cdn/                 # Assets do cliente (descompactar zip do Google Drive)
│   ├── xml/             # Templates do jogo (tempinfos.xml, etc.)
│   ├── swf/             # Assets Flash
│   ├── icon/            # Ícones do jogo
│   ├── map/             # Mapas
│   └── ...              # Demais assets
│
├── .docs/               # Referencia histórica (somente consulta)
│   ├── legend-online-main/      # Fonte confiavel
│   ├── old-legend-ultra/        # Versão anterior
│   └── Wartune Reborn/          # Referência Wartune Reborn
│
├── tools/               # Scripts utilitários
├── compose.yaml         # Docker Compose (PostgreSQL 17 + Redis)
├── package.json         # Workspace root (npm workspaces)
├── tsconfig.json        # TypeScript config
└── .env                 # Variáveis de ambiente
```

## Como subir o container Docker em desenvolvimento

### Pré-requisitos

- **Docker Desktop** (Windows/Mac) ou **Docker Engine** (Linux)
- **Node.js 24+** (recomendado via [fnm](https://github.com/Schniz/fnm) ou [nvm](https://github.com/nvm-sh/nvm))
- **pnpm** (`npm install -g pnpm`)
- **PostgreSQL 17** (via Docker Compose)

### 1. Preparar o CDN

> **⚠️ IMPORTANTE**: O CDN **não** está versionado no Git (arquivos binários grandes).

1. Baixe o CDN do Google Drive: **[https://drive.google.com/drive/folders/1bZgq2mxs229cvX-_oSzQR2UidITp59LT?usp=sharing]**
2. Descompacte o zip **na raiz do projeto** (deve criar a pasta `cdn/`):
   ```bash
   # Exemplo no Windows (PowerShell):
   Expand-Archive -Path "cdn.zip" -DestinationPath "D:\Legend Online Ultra"
   
   # Exemplo no Linux/Mac:
   unzip cdn.zip -d "D:/Legend Online Ultra"
   ```
   
   A estrutura final deve ser:
   ```
   D:\Legend Online Ultra\cdn\
   ├── xml\
   ├── swf\
   ├── icon\
   ├── map\
   └── ...
   ```

### 2. Subir o banco de dados (PostgreSQL + Redis)

```bash
# Na raiz do projeto
docker compose up -d
```

Isso sobe:
- **PostgreSQL 17** na porta `5432` (banco `legend_online`, usuário `legend`, senha do `.env`)
- **Redis 7** na porta `6379` (para sessões e cache)

Verifique se subiu:
```bash
docker compose ps
docker compose logs -f db
```

### 3. Instalar dependências

```bash
# Na raiz do projeto (usa npm workspaces)
npm install
```

### 4. Configurar variáveis de ambiente

Copie o `.env.example` para `.env` e ajuste:

```bash
cp .env.example .env
```

Principais variáveis no `.env`:

```env
# Porta do servidor Fastify
PORT=8080

# Banco de dados
DATABASE_URL=postgresql://legend:senha@localhost:5432/legend_online?schema=public

# Chave mestra para criptografia (gere uma segura!)
APP_SECRET=sua_chave_mestra_super_secreta_aqui

# Admin inicial
ADMIN_EMAIL=admin@legend.local
ADMIN_PASSWORD=redrook
```

### 5. Preparar o banco de dados

```bash
# Executa migrações + seeds
npm run db:migrate
npm run db:seed
```

Ou reset completo (apaga tudo e recria):
```bash
npm run db:reset
```

### 6. Iniciar o servidor em desenvolvimento

```bash
# Modo dev com hot reload (watch mode)
npm run dev
```

O servidor sobe em:
- **HTTP/WebSocket**: `http://localhost:8080`
- **Socket TCP**: porta definida no banco (`socket_port` = 9201 padrão)
- **WebSocket**: `ws://localhost:8080/socket`
- **Flash Policy**: porta 8080

### 7. Acessar painel admin

- **URL**: `http://localhost:8080/admin` (ou rota configurada)
- **Login**: `admin` / `redrook`

## Como iniciar os servidores

### Desenvolvimento (com hot reload)

```bash
# Terminal 1 - Banco de dados
docker compose up -d

# Terminal 2 - Servidor backend (hot reload)
npm run dev

# Terminal 3 (opcional) - Frontend Next.js
npm run dev:portal
```

### Produção

```bash
# Build do frontend
npm run build:portal

# Iniciar servidor (sem watch)
npm run start
```

### Comandos úteis

```bash
# Ver logs do banco
docker compose logs -f db

# Parar tudo
docker compose down

# Reset completo do banco (CUIDADO: apaga dados!)
npm run db:reset

# Testes
npm test

# Type check
npm run typecheck

# Regenerar schemas do protocolo
npm run gen:proto
npm run gen:opcodes
```

## CDN - Assets do Cliente

O CDN **não está no Git** (arquivos binários ~2GB).

1. **Download**: [https://drive.google.com/drive/folders/1bZgq2mxs229cvX-_oSzQR2UidITp59LT?usp=sharing]
2. **Descompacte na raiz**: Cria pasta `cdn/` com ~53.000 arquivos
3. **Estrutura esperada**:
   ```
   cdn/
   ├── xml/           # tempinfos.xml, constainfight.xml, etc.
   ├── swf/           # Assets Flash (.swf)
   ├── icon/          # Ícones do jogo
   ├── map/           # Mapas
   ├── equip/         # Equipamentos
   ├── avatar/        # Avatares
   ├── equip_show/    # Visualização de equipamentos
   ├── skilleffect/   # Efeitos de skills
   └── ...            # Demais assets
   ```
4. **Regenerar manifests** após atualizar CDN:
   ```bash
   # Atualizar code_md5.dat e res_md5.dat
   node tools/update-cdn-manifests.ts
   ```

## Admin Panel

- **URL**: `http://localhost:8080/admin`
- **Login padrão**: `admin` / `redrook`
- **Permissões**: Configuradas em `core.admin_permissions`

## Troubleshooting

### Porta 8080 ocupada
```bash
# Verificar e matar processo
netstat -ano | findstr :8080
taskkill /PID <PID> /F
```

### Banco não conecta
```bash
# Verificar se container está saudável
docker compose ps
docker compose logs db

# Recriar container
docker compose down -v && docker compose up -d
```

### CDN não carrega
- Verifique se `cdn/` existe na raiz
- Verifique permissões de leitura
- Confira `code_md5.dat` e `res_md5.dat` estão atualizados

### Templates não carregam
- Verifique se `cdn/xml/tempinfos.xml` existe
- Confira logs: `[ERROR] lista ItemTempInfos nao carregada`

---

## Login Padrão Painel Admin

| Campo | Valor |
|-------|-------|
| **Usuário** | `admin` |
| **Senha** | `redrook` |

---

## Referências

- `.docs/legend-online-main/` - Fonte confiável (código original)
- `.docs/old-legend-ultra/` - Versão anterior do projeto
- `.docs/Wartune Reborn/` - Referência Wartune Reborn (consulta)
- `data/templates/` - 292 listas originais (tempinfos, Legend Online BR)
- `cdn/` - Assets do cliente (descompactar zip do Google Drive)
