FROM node:24-alpine AS builder
WORKDIR /app
# 内网仅华为云镜像可达：registry 改为华为云 npm 源
RUN yarn config set registry https://repo.huaweicloud.com/repository/npm/
COPY package.json yarn.lock ./
# 关键：yarn v1 按 yarn.lock 中已解析的 URL 下载（不理会 registry 配置），
# 必须把 lockfile 里的 registry.yarnpkg.com / npmjs / npmmirror 一并改写到华为云，
# 否则卡死在 "Fetching packages..."。URL 改写不影响版本与 integrity 校验。
RUN sed -i \
        -e 's|https://registry.yarnpkg.com|https://repo.huaweicloud.com/repository/npm|g' \
        -e 's|https://registry.npmjs.org|https://repo.huaweicloud.com/repository/npm|g' \
        -e 's|https://registry.npmmirror.com|https://repo.huaweicloud.com/repository/npm|g' \
        yarn.lock \
    && yarn install --frozen-lockfile --network-timeout 600000
COPY . .
RUN yarn build

FROM node:24-alpine
WORKDIR /app
# 内网环境无法访问 dl-cdn.alpinelinux.org：apk 源改走华为云镜像
RUN sed -i 's|dl-cdn.alpinelinux.org|repo.huaweicloud.com|g' /etc/apk/repositories \
    && apk add --no-cache tzdata \
    && ln -sf /usr/share/zoneinfo/Asia/Shanghai /etc/localtime
ENV TZ=Asia/Shanghai
COPY --from=builder /app ./
EXPOSE 2000
CMD ["yarn", "start"]
