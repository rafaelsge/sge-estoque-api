# ---------- STAGE 1: Build ----------
FROM node:22.17.0-bullseye AS builder

WORKDIR /app

# Copia pacotes
COPY package*.json ./

# Instala dependências (inclui devDependencies para compilar TS)
RUN npm install

# Copia tudo para o builder
COPY tsconfig.json ./
COPY prisma ./prisma
COPY src ./src

# Gera prisma client
RUN npx prisma generate

# Compila TS para JS
RUN npm run build


# ---------- STAGE 2: Production ----------
FROM node:22.17.0-bullseye AS production

WORKDIR /app

# Instala apenas dependências de produção
COPY package*.json ./
RUN npm install --omit=dev

# Copia o Prisma Client já gerado
COPY --from=builder /app/node_modules/.prisma /app/node_modules/.prisma
COPY --from=builder /app/node_modules/@prisma /app/node_modules/@prisma

# Copia os arquivos compilados
COPY --from=builder /app/dist ./dist

# Copia prisma schema (às vezes necessário)
COPY --from=builder /app/prisma ./prisma

# Inicia a aplicação
CMD ["node", "dist/index.js"]
