FROM node:24-alpine AS builder
WORKDIR /app
RUN npm config set registry https://registry.npmmirror.com
COPY package.json package-lock.json ./
RUN npm ci
COPY . .
RUN npm run build

FROM node:24-alpine
WORKDIR /app
RUN apk add --no-cache tzdata \
    && ln -sf /usr/share/zoneinfo/Asia/Shanghai /etc/localtime
ENV TZ=Asia/Shanghai
RUN npm config set registry https://registry.npmmirror.com
COPY --from=builder /app ./
EXPOSE 2000
CMD ["npm", "start"]
