#!/usr/bin/env bash
# id_x_007 一键停止清理
set -euo pipefail

PLUGIN="id_x_007"

# 1. 逆序停止并删除容器（数据库为外部库，不在清理范围）
for c in haproxy web service; do
    if podman container exists "${PLUGIN}_${c}"; then
        podman stop "${PLUGIN}_${c}" || true
        podman rm "${PLUGIN}_${c}"
    fi
done

# 2. 删除 Pod
if podman pod exists "${PLUGIN}"; then
    podman pod rm "${PLUGIN}"
fi

echo "清理完成"
