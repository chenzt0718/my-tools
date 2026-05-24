#!/bin/bash
# ============================================================
#  表格工具 启动脚本
#  双击此文件即可运行
#  或运行: bash setup.sh --all  创建桌面图标
# ============================================================

# 如果不在终端中运行，自动打开终端窗口重新执行
if [ ! -t 0 ] && [ -z "$IN_TERMINAL" ]; then
    export IN_TERMINAL=1
    if command -v x-terminal-emulator &>/dev/null; then
        x-terminal-emulator -e "bash -c 'cd \"$(dirname \"$0\")\" && bash run.sh; read -p \"按回车关闭...\"'" &
        exit 0
    elif command -v gnome-terminal &>/dev/null; then
        gnome-terminal -- bash -c "cd '$(dirname "$0")' && bash run.sh; read -p '按回车关闭...'"
        exit 0
    elif command -v mate-terminal &>/dev/null; then
        mate-terminal -- bash -c "cd '$(dirname "$0")' && bash run.sh; read -p '按回车关闭...'"
        exit 0
    elif command -v xfce4-terminal &>/dev/null; then
        xfce4-terminal --command "bash -c 'cd \"$(dirname \"$0\")\" && bash run.sh; read -p \"按回车关闭...\"'"
        exit 0
    elif command -v konsole &>/dev/null; then
        konsole -e bash -c "cd '$(dirname "$0")' && bash run.sh; read -p '按回车关闭...'" &
        exit 0
    elif command -v lxterminal &>/dev/null; then
        lxterminal -e "bash -c 'cd \"$(dirname \"$0\")\" && bash run.sh; read -p \"按回车关闭...\"'" &
        exit 0
    fi
    # 如果没有可用终端，继续在当前环境启动（后台模式）
fi

set -e

SCRIPT_DIR="$(cd "$(dirname "$0")" && pwd)"
cd "$SCRIPT_DIR"

# Python 检测
if command -v python3 &>/dev/null; then
    PYTHON=python3
elif command -v python &>/dev/null; then
    PYTHON=python
else
    echo "错误: 未找到 Python，请安装 Python 3.8+"
    echo "  Ubuntu/Kylin: sudo apt install python3 python3-pip"
    read -p "按回车键退出..."
    exit 1
fi

# 自动安装依赖（离线模式：从本地 offline-deps/ 安装）
DEPS_DIR="$SCRIPT_DIR/offline-deps"
if ! $PYTHON -c "import flask, openpyxl, pandas" 2>/dev/null; then
    echo "检测到缺少依赖，正在从本地安装（无需联网）..."
    if [ -d "$DEPS_DIR" ] && ls "$DEPS_DIR"/*.whl &>/dev/null 2>&1; then
        $PYTHON -m pip install --no-index --find-links="$DEPS_DIR" flask openpyxl pandas xlrd --quiet 2>&1 && \
            echo "依赖安装完成（离线模式）。" || {
            echo "离线安装失败，尝试在线安装..."
            $PYTHON -m pip install flask openpyxl pandas xlrd --quiet && \
                echo "依赖安装完成（在线模式）。" || {
                echo "依赖安装失败，请手动执行:"
                echo "  $PYTHON -m pip install --no-index --find-links='$DEPS_DIR' flask openpyxl pandas xlrd"
                read -p "按回车键退出..."
                exit 1
            }
        }
    else
        echo "未找到离线依赖包，尝试在线安装..."
        $PYTHON -m pip install flask openpyxl pandas xlrd --quiet && \
            echo "依赖安装完成（在线模式）。" || {
            echo "依赖安装失败。请确保存在 $DEPS_DIR 目录或网络连接正常。"
            read -p "按回车键退出..."
            exit 1
        }
    fi
fi

# 端口检测
PORT=5000
port_in_use() {
    ($PYTHON -c "import socket; s=socket.socket(); s.bind(('127.0.0.1',$PORT)); s.close()" 2>/dev/null) && return 1 || return 0
}

if port_in_use; then
    echo "服务已在端口 $PORT 运行，直接打开浏览器..."
else
    echo "正在启动服务..."
    $PYTHON server.py &
    SERVER_PID=$!

    # 等待服务就绪（最多 5 秒）
    for i in $(seq 1 15); do
        if ! port_in_use; then
            break
        fi
        sleep 0.3
    done
    echo "服务已就绪。"
fi

# 打开浏览器
URL="http://127.0.0.1:$PORT"
if command -v xdg-open &>/dev/null; then
    xdg-open "$URL" &
elif command -v gnome-open &>/dev/null; then
    gnome-open "$URL" &
elif command -v open &>/dev/null; then
    open "$URL" &
else
    echo "请手动打开浏览器访问: $URL"
fi

echo ""
echo "  ╔══════════════════════════════════╗"
echo "  ║       表格工具 v1.0             ║"
echo "  ║   $URL          ║"
echo "  ║   关闭此窗口即停止服务           ║"
echo "  ╚══════════════════════════════════╝"
echo ""

# 保持运行
if [ -n "$SERVER_PID" ]; then
    wait $SERVER_PID 2>/dev/null
elif [ "$IN_TERMINAL" = "1" ]; then
    read -p "按回车键关闭..." dummy
fi
