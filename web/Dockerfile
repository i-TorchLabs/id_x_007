FROM node:24-alpine AS builder
WORKDIR /app
RUN yarn config set registry https://registry.npmmirror.com
COPY package.json yarn.lock ./
RUN yarn install --frozen-lockfile
COPY . .
RUN yarn build

FROM node:24-alpine
WORKDIR /app
RUN apk add --no-cache tzdata \
    && ln -sf /usr/share/zoneinfo/Asia/Shanghai /etc/localtime
ENV TZ=Asia/Shanghai
COPY --from=builder /app ./
EXPOSE 2000
CMD ["yarn", "start"]
