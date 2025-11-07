# Usa a imagem base oficial do Node.js (versão leve e estável)
FROM node:22.17.0-alpine

# Define o diretório de trabalho dentro do container
WORKDIR /app

# Copia os arquivos de dependência
COPY package*.json ./

# Instala apenas as dependências de produção
RUN npm install --production

# Copia o restante do código da API
COPY . .

# Expõe a porta onde a API vai rodar
EXPOSE 3001

# Define o comando padrão para iniciar o servidor
CMD ["npm", "start"]
