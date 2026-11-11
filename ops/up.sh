#!/usr/bin/env bash
# id_x_007 一键启动（幂等，已存在则跳过）
# 数据库：直连外部 PostgreSQL（ops/.env 的 DB_* 配置），不再启动 db 容器；
# 表结构与预置数据由后端启动时自动创建/播种（create_all + seed_*，幂等）。
set -euo pipefail

PLUGIN="id_x_007"
HOST_PORT=8007
OPS_DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")" && pwd)"
REPO_ROOT="$(cd "${OPS_DIR}/../../.." && pwd)"

# 1. .env 检查
if [ ! -f "${OPS_DIR}/.env" ]; then
    cp "${OPS_DIR}/.env.example" "${OPS_DIR}/.env"
    echo "已生成 ${OPS_DIR}/.env，请填写外部数据库 DB_* 等配置后重新执行本脚本"
    exit 0
fi
set -a; source "${OPS_DIR}/.env"; set +a

# 2. 外部数据库配置校验 + 连通性预检
for var in DB_HOST DB_NAME DB_USERNAME DB_PASSWORD; do
    if [ -z "${!var:-}" ]; then
        echo "错误: ops/.env 缺少外部数据库配置 ${var}" >&2
        exit 1
    fi
done
DB_PORT="${DB_PORT:-5432}"
# 容错：剔除 Windows 编辑器引入的 CR 与首尾空白（否则 TCP/psycopg2 连接都会失败）
for var in DB_HOST DB_PORT DB_NAME DB_USERNAME DB_PASSWORD; do
    val="${!var}"
    val="${val//$'\r'/}"
    val="$(echo "${val}" | xargs)"
    printf -v "${var}" '%s' "${val}"
done

# TCP 探测（3s 超时）：依工具可用性逐个回退，避免个别 bash 禁用 /dev/tcp 造成假阴性
probe_db() {
    if command -v pg_isready >/dev/null 2>&1; then
        pg_isready -h "${DB_HOST}" -p "${DB_PORT}" -t 3 >/dev/null 2>&1 && return 0
    fi
    if command -v nc >/dev/null 2>&1; then
        nc -z -w 3 "${DB_HOST}" "${DB_PORT}" >/dev/null 2>&1 && return 0
    fi
    if command -v python3 >/dev/null 2>&1; then
        python3 -c "import socket,sys; s=socket.socket(); s.settimeout(3); s.connect(('${DB_HOST}', int('${DB_PORT}')))" 2>/dev/null && return 0
    fi
    timeout 3 bash -c "exec 3<>/dev/tcp/${DB_HOST}/${DB_PORT}" 2>/dev/null && return 0
    return 1
}

if [ "${SKIP_DB_CHECK:-}" = "1" ]; then
    echo "SKIP_DB_CHECK=1，跳过宿主机侧数据库连通性预检"
elif [ "${DB_HOST}" = "host.containers.internal" ]; then
    # 该域名仅容器内可解析，宿主机侧无法预检，跳过（由容器内探测兜底）
    echo "DB_HOST=host.containers.internal，跳过宿主机侧连通性预检"
else
    echo "检测外部数据库连通性 ${DB_HOST}:${DB_PORT} ..."
    db_ok=0
    for _ in $(seq 1 5); do
        if probe_db; then db_ok=1; break; fi
        sleep 2
    done
    if [ "${db_ok}" != "1" ]; then
        echo "错误: 宿主机无法 TCP 直连 ${DB_HOST}:${DB_PORT}（ping 通不代表端口通）" >&2
        echo "排查: 1) 在本机执行 psql \"host=${DB_HOST} port=${DB_PORT} user=${DB_USERNAME} dbname=${DB_NAME}\" -c 'select 1' 验证；" >&2
        echo "      2) 若 psql 也失败，多为数据库服务器防火墙未放行本机 IP，或 postgresql.conf 的" >&2
        echo "         listen_addresses / 端口不对；放行后重试。" >&2
        echo "      3) 确认宿主机确实可连，可 SKIP_DB_CHECK=1 ./up.sh 跳过本预检。" >&2
        exit 1
    fi
fi

# 3. 构建镜像
if [ "${1:-}" = "--build" ] || ! podman image exists "${PLUGIN}_service"; then
    podman build --format docker -t "${PLUGIN}_service" -f "${OPS_DIR}/Dockerfile.service" "${REPO_ROOT}"
fi
if [ "${1:-}" = "--build" ] || ! podman image exists "${PLUGIN}_web"; then
    podman build --format docker -t "${PLUGIN}_web" "${OPS_DIR}/../web"
fi

# 4. Pod（已存在则跳过）
if ! podman pod exists "${PLUGIN}"; then
    # 宿主机 8007 -> pod 8080（HAProxy 统一入口）
    podman pod create --name "${PLUGIN}" \
        -p "${HOST_PORT}:8080"
fi

# 日志目录（审计/引擎日志按天轮转落盘宿主，容器重建不丢失）
mkdir -p "${OPS_DIR}/../logs"
chmod 1777 "${OPS_DIR}/../logs"

# 5. 逐容器启动（已存在则跳过）
if ! podman container exists "${PLUGIN}_service"; then
    podman run -d --pod "${PLUGIN}" --name "${PLUGIN}_service" \
        -e DB_NAME="${DB_NAME}" \
        -e DB_HOST="${DB_HOST}" \
        -e DB_PORT="${DB_PORT}" \
        -e DB_USERNAME="${DB_USERNAME}" \
        -e DB_PASSWORD="${DB_PASSWORD}" \
        -e ADMIN_USERNAME="${ADMIN_USERNAME:-}" \
        -e ADMIN_PASSWORD="${ADMIN_PASSWORD:-}" \
        -e PROJECT_PATH=/app/i-Core \
        -e TZ=Asia/Shanghai \
        -v "${OPS_DIR}/../logs:/app/i-Core/logs" \
        "${PLUGIN}_service"
fi

# 容器内部连通性探测：宿主机通 ≠ 容器通（rootless NAT / 防火墙 FORWARD 链 / MTU 均可能拦截）
echo "检测容器内部 -> ${DB_HOST}:${DB_PORT} 连通性 ..."
container_db_ok=0
for _ in $(seq 1 5); do
    if podman exec "${PLUGIN}_service" python -c "import socket; s=socket.socket(); s.settimeout(3); s.connect(('${DB_HOST}', int('${DB_PORT}')))" 2>/dev/null; then
        container_db_ok=1
        break
    fi
    sleep 2
done
if [ "${container_db_ok}" = "1" ]; then
    echo "容器内部连接数据库正常"
else
    echo "警告: 容器内部无法 TCP 直连 ${DB_HOST}:${DB_PORT}（宿主机侧预检已通过则多为容器网络问题）" >&2
    echo "排查: 1) rootless podman 查看网络后端: podman info --format '{{.Host.NetworkBackend}}'" >&2
    echo "         pasta 后端偶发 MTU/路由问题，可改 slirp4netns 对比: 删除 pod 后" >&2
    echo "         podman pod create --network slirp4netns ... 重建；" >&2
    echo "      2) rootful 部署检查 firewalld/nftables 是否拦截容器源网段的 FORWARD/MASQUERADE；" >&2
    echo "      3) 数据库侧 pg_hba.conf 须放行宿主机 IP（容器出站经 NAT 后源地址即宿主机 IP）；" >&2
    echo "      4) 看后端具体报错: podman logs ${PLUGIN}_service" >&2
fi

if ! podman container exists "${PLUGIN}_web"; then
    podman run -d --pod "${PLUGIN}" --name "${PLUGIN}_web" "${PLUGIN}_web"
fi

if ! podman container exists "${PLUGIN}_haproxy"; then
    podman run -d --pod "${PLUGIN}" --name "${PLUGIN}_haproxy" \
        -e SERVICE_HOST=127.0.0.1 \
        -e WEB_HOST=127.0.0.1 \
        -v "${OPS_DIR}/haproxy.cfg:/usr/local/etc/haproxy/haproxy.cfg:ro" \
        docker.io/library/haproxy:3.0
fi

echo "启动完成: http://localhost:${HOST_PORT}（数据库: ${DB_HOST}:${DB_PORT}/${DB_NAME}）"
