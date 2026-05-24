#!/bin/bash
# ============================================================
#  离线打包脚本
#  将项目和所有依赖打包为 .tar.gz，复制到离线电脑即可使用
#
#  用法: bash pack.sh
#  输出: spreadsheet-tool-offline.tar.gz
# ============================================================

set -e

SCRIPT_DIR="$(cd "$(dirname "$0")" && pwd)"
cd "$SCRIPT_DIR"

OUTPUT="spreadsheet-tool-offline.tar.gz"
TEMP_DIR="/tmp/spreadsheet-pack"
PKG_NAME="spreadsheet-tool"

echo "=========================================="
echo "  表格工具 - 离线打包"
echo "=========================================="

# ── 1. 下载所有依赖 ────────────────────────────
echo "[1/4] 准备离线依赖..."
DEPS_DIR="$SCRIPT_DIR/offline-deps"
mkdir -p "$DEPS_DIR"

if command -v python3 &>/dev/null; then
    PYTHON=python3
elif command -v python &>/dev/null; then
    PYTHON=python
else
    echo "错误: 未找到 Python"
    exit 1
fi

echo "  下载 Python 包到 offline-deps/ ..."
$PYTHON -m pip download flask openpyxl pandas xlrd -d "$DEPS_DIR" --quiet 2>/dev/null
echo "  基础依赖下载完成"

# 尝试下载 Linux 平台的编译包（跨平台）
echo "  尝试下载 Linux 平台依赖..."
for pyver in 38 310; do
    $PYTHON -m pip download \
        --platform manylinux2014_x86_64 \
        --platform manylinux_2_17_x86_64 \
        --only-binary :all: \
        --python-version $pyver \
        --implementation cp \
        numpy pandas markupsafe \
        -d "$DEPS_DIR" --quiet 2>/dev/null || true
done
echo "  依赖准备完成 ($(ls -1 "$DEPS_DIR"/*.whl 2>/dev/null | wc -l) 个文件)"

# ── 2. 生成图标 ─────────────────────────────────
echo "[2/4] 生成图标..."
$PYTHON gen_icon.py 2>/dev/null && echo "  图标已生成" || echo "  跳过图标"

# ── 3. 清理临时文件 ─────────────────────────────
echo "[3/4] 清理临时文件..."
rm -rf "$SCRIPT_DIR/__pycache__" 2>/dev/null || true
find "$SCRIPT_DIR" -name "*.pyc" -delete 2>/dev/null || true
rm -f "$SCRIPT_DIR/icon" 2>/dev/null || true
echo "  清理完成"

# ── 4. 打包 ─────────────────────────────────────
echo "[4/4] 打包为 $OUTPUT ..."

rm -rf "$TEMP_DIR" 2>/dev/null || true
mkdir -p "$TEMP_DIR/$PKG_NAME"

# 复制必要文件
cp -r "$SCRIPT_DIR"/*.py "$TEMP_DIR/$PKG_NAME/" 2>/dev/null || true
cp -r "$SCRIPT_DIR"/*.sh "$TEMP_DIR/$PKG_NAME/" 2>/dev/null || true
cp -r "$SCRIPT_DIR"/*.desktop "$TEMP_DIR/$PKG_NAME/" 2>/dev/null || true
cp -r "$SCRIPT_DIR"/*.txt "$TEMP_DIR/$PKG_NAME/" 2>/dev/null || true
cp -r "$SCRIPT_DIR"/*.svg "$TEMP_DIR/$PKG_NAME/" 2>/dev/null || true
cp -r "$SCRIPT_DIR"/*.png "$TEMP_DIR/$PKG_NAME/" 2>/dev/null || true
cp -r "$SCRIPT_DIR"/offline-deps "$TEMP_DIR/$PKG_NAME/"
cp -r "$SCRIPT_DIR"/static "$TEMP_DIR/$PKG_NAME/"
cp -r "$SCRIPT_DIR"/templates "$TEMP_DIR/$PKG_NAME/"

# 打包
cd "$TEMP_DIR"
tar czf "$SCRIPT_DIR/$OUTPUT" "$PKG_NAME"

# 清理临时目录
rm -rf "$TEMP_DIR"

# ── 完成 ─────────────────────────────────────────
SIZE=$(du -h "$SCRIPT_DIR/$OUTPUT" | cut -f1)
echo ""
echo "=========================================="
echo "  打包完成!"
echo "  文件: $OUTPUT"
echo "  大小: $SIZE"
echo ""
echo "  ┌─────────────────────────────────────┐"
echo "  │  离线安装步骤 (目标电脑上):         │"
echo "  │                                     │"
echo "  │  1. 复制 $OUTPUT 到目标电脑         │"
echo "  │  2. tar xzf $OUTPUT                 │"
echo "  │  3. cd $PKG_NAME                    │"
echo "  │  4. bash setup.sh --all             │"
echo "  │  5. 双击 run.sh 或桌面图标           │"
echo "  │                                     │"
echo "  │  前提: 目标电脑需已安装 Python 3.8+ │"
echo "  └─────────────────────────────────────┘"
echo "=========================================="
