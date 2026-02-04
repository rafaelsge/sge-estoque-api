###############################################
### STAGE 1 — BUILDER (compila TypeScript)
###############################################
FROM node:22.17.0-bullseye AS builder

WORKDIR /app

# Copia dependências
COPY package*.json ./

# Instala tudo (inclui devDependencies)
RUN npm install

# Copia restante do projeto
COPY tsconfig.json ./
COPY prisma ./prisma
COPY src ./src


# Compila TS → JS
RUN npm run build


###############################################
### STAGE 2 — RUNNER (produção)
###############################################
FROM node:22.17.0-bullseye AS production

WORKDIR /app

# Copia somente dependências
COPY package*.json ./

# Instala apenas dependências de produção
RUN npm install --omit=dev

# Copia Prisma Client gerado
COPY --from=builder /app/node_modules/.prisma /app/node_modules/.prisma
COPY --from=builder /app/node_modules/@prisma /app/node_modules/@prisma

# Copia arquivos compilados
COPY --from=builder /app/dist ./dist

# Copia schema (caso precise no runtime)
COPY prisma ./prisma

# Porta da API
EXPOSE 3001

# Start
CMD ["node", "dist/index.js"]
