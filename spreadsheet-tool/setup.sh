#!/bin/bash
# ============================================================
#  表格工具 安装脚本
#  用法: bash setup.sh [--desktop]
#   --desktop  创建桌面快捷方式
#   --all      安装依赖 + 桌面快捷方式 + 应用菜单
# ============================================================

set -e

SCRIPT_DIR="$(cd "$(dirname "$0")" && pwd)"
INSTALL_DIR="$SCRIPT_DIR"
APP_NAME="表格工具"

# 颜色
GREEN='\033[0;32m'
YELLOW='\033[1;33m'
RED='\033[0;31m'
NC='\033[0m'

echo "=========================================="
echo "  $APP_NAME - 安装向导"
echo "=========================================="
echo ""

# ── Python 检查 ─────────────────────────────────
if command -v python3 &>/dev/null; then
    PYTHON=python3
elif command -v python &>/dev/null; then
    PYTHON=python
else
    echo -e "${RED}[错误] 未找到 Python。${NC}"
    echo "  请先安装: sudo apt install python3 python3-pip"
    exit 1
fi

echo -e "${GREEN}[1/4]${NC} Python: $($PYTHON --version)"

# ── 安装依赖（离线优先）─────────────────────────
echo -e "${GREEN}[2/4]${NC} 安装 Python 依赖..."
DEPS_DIR="$INSTALL_DIR/offline-deps"
if [ -d "$DEPS_DIR" ] && ls "$DEPS_DIR"/*.whl &>/dev/null 2>&1; then
    echo "  使用本地离线依赖包..."
    $PYTHON -m pip install --no-index --find-links="$DEPS_DIR" flask openpyxl pandas xlrd --quiet 2>/dev/null && \
        echo "  依赖安装完成（离线模式）" || {
        echo -e "${YELLOW}  离线安装失败，尝试在线安装...${NC}"
        $PYTHON -m pip install flask openpyxl pandas xlrd --quiet 2>/dev/null && \
            echo "  依赖安装完成（在线模式）" || \
            echo -e "${RED}  依赖安装失败${NC}"
    }
else
    echo "  未找到离线依赖包，尝试在线安装..."
    $PYTHON -m pip install flask openpyxl pandas xlrd --quiet 2>/dev/null && \
        echo "  依赖安装完成（在线模式）" || \
        echo -e "${RED}  依赖安装失败，请检查网络或确保 offline-deps/ 目录存在${NC}"
fi

# ── 设置执行权限 ────────────────────────────────
echo -e "${GREEN}[3/4]${NC} 设置文件权限..."
chmod +x "$INSTALL_DIR/run.sh" 2>/dev/null || true

# ── 生成 .desktop 文件 ──────────────────────────
DESKTOP_SRC="$INSTALL_DIR/spreadsheet-tool.desktop"
DESKTOP_DST="$HOME/.local/share/applications/spreadsheet-tool.desktop"

echo -e "${GREEN}[4/4]${NC} 配置应用菜单..."

# 替换占位符
sed "s|__INSTALL_DIR__|$INSTALL_DIR|g" "$DESKTOP_SRC" > "$DESKTOP_DST"
echo "  应用菜单已安装"

# 桌面快捷方式
if [[ "$*" == *"--desktop"* ]] || [[ "$*" == *"--all"* ]]; then
    cp "$DESKTOP_DST" "$HOME/Desktop/spreadsheet-tool.desktop" 2>/dev/null && \
        chmod +x "$HOME/Desktop/spreadsheet-tool.desktop" 2>/dev/null && \
        echo "  桌面快捷方式已创建" || \
        echo -e "${YELLOW}  桌面快捷方式创建失败 (可能桌面路径不同)${NC}"
fi

# 生成图标
$PYTHON "$INSTALL_DIR/gen_icon.py" 2>/dev/null && \
    cp "$INSTALL_DIR/icon.png" "$INSTALL_DIR/icon" 2>/dev/null && \
    echo "  图标已生成" || \
    echo -e "${YELLOW}  图标生成跳过${NC}"

# 刷新桌面数据库
update-desktop-database "$HOME/.local/share/applications/" 2>/dev/null || true

echo ""
echo "=========================================="
echo -e "  ${GREEN}安装完成!${NC}"
echo ""
echo "  启动方式："
echo "    1. 双击 run.sh"
echo "    2. 在应用菜单中搜索 '表格工具'"
[[ "$*" == *"--desktop"* || "$*" == *"--all"* ]] && echo "    3. 双击桌面的快捷方式"
echo ""
echo "  卸载: 删除此目录即可"
echo "=========================================="
