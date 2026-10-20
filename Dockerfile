
# Etapa 1: Compilar a aplicação Angular
FROM node:16-alpine AS build

WORKDIR /app

# Copia as dependências primeiro para aproveitar o cache
COPY package*.json ./
RUN npm install

COPY package.json package-lock.json ./

RUN npm config set fetch-retries 5 \
    && npm config set fetch-retry-mintimeout 20000 \
    && npm config set fetch-retry-maxtimeout 120000 \
    && npm config set fetch-timeout 300000

RUN npm ci --no-audit --no-fund

# Copia o código-fonte
COPY . .

# Gera o build de produção
RUN npm run build -- --prod

# Etapa 2: Servir com Nginx
FROM nginx:alpine

# Remove a configuração padrão
RUN rm /etc/nginx/conf.d/default.conf

# Adiciona a configuração do Nginx
COPY nginx.conf /etc/nginx/conf.d/default.conf

# Copia os arquivos compilados
COPY --from=build /app/dist/sf2player /usr/share/nginx/html

EXPOSE 80

CMD ["nginx", "-g", "daemon off;"]
