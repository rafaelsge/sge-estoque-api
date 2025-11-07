# Etapa 1: imagem base oficial do Node
FROM node:18-alpine

# Define o diretório de trabalho
WORKDIR /app

# Copia arquivos de dependência
COPY package*.json ./

# Instala dependências (produção)
RUN npm install --production

# Copia o restante do código
COPY . .

# Expõe a porta usada pela API
EXPOSE 3001

# Comando padrão de inicialização
CMD ["npm", "start"]
