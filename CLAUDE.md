# CLAUDE.md

This file provides guidance to Claude Code (claude.ai/code) when working with code in this repository.

**交流语言：始终使用中文（简体中文）回复用户。**

## AI 协作风格

- **用户角色**：有多年技术开发经验，正在学习 AI/Claude Code。解释技术决策时说明原因，帮助用户理解 AI 的思考过程
- **任务拆解**：复杂任务先拆成小步骤，用任务列表跟踪进度，每完成一步汇报
- **先问后改**：涉及架构变更或破坏性操作时，先说明方案再动手。小修改（修 bug、加日志、改文案）可直接执行
- **代码输出**：默认不写注释，只在 WHY 非显而易见时加一行短注释。不改代码格式/空白
- **UI 设计**：用户偏好深色主题。新 UI 组件默认 dark mode

## 代码约定

- Python 后端：Flask 单文件优先，不引入 ORM/重型框架，保持依赖最少
- 前端：原生 JS/HTML/CSS，不引入 React/Vue 等框架，除非项目规模确实需要
- 安全：永远不使用 eval()、innerHTML、shell 拼接。文件操作做好路径校验防止目录穿越
- 命名：Python 用 snake_case，JS 用 camelCase，HTML/CSS class 用 kebab-case
- 错误处理：只在系统边界（用户输入、文件 I/O、HTTP 请求）做校验和错误处理。内部代码信任类型/框架保证
- 不要为「未来可能需要」做抽象。三个相似的东西再提取公共函数

## 安全红线

- 密钥/Token 绝不写入代码或提交到 git（`.env` / 环境变量，`.gitignore` 确认排除）
- 文件操作路径必须校验，防止 `../../../etc/passwd` 目录穿越
- 用户输入在展示前做 XSS 过滤
- 加密模块的 TODO 挡板在正式上线前必须替换为真实加密

## 常用工作流

```bash
# 启动表格工具开发
cd spreadsheet-tool && python server.py

# 查看 git 状态（每次改代码前先看）
git status

# 快速验证 API
curl -s http://127.0.0.1:5000/api/stats | python -m json.tool

# 安装依赖
pip install flask openpyxl pandas xlrd
```

## 项目概述

两个独立工具：
- **表格工具** (`spreadsheet-tool/`) — Flask + Canvas 的类 WPS 电子表格编辑器，支持加密文件
- **番茄钟** (`pomodoro.html`) — 独立单文件的番茄工作法计时器

## 开发命令

```bash
# 启动表格工具后端（需要 Python 3.8+, Flask, openpyxl, pandas, xlrd）
cd spreadsheet-tool
python server.py                # Flask 开发模式，127.0.0.1:5000，debug=True
python start.py                 # 生产模式启动 + 自动打开浏览器

# 离线依赖管理
pip install --no-index --find-links=offline-deps flask openpyxl pandas xlrd

# Linux 快速启动
bash spreadsheet-tool/run.sh    # 自动检测依赖、安装、启动服务
bash spreadsheet-tool/setup.sh --all  # 安装 + 创建桌面快捷方式

# 番茄钟
# 直接浏览器打开 pomodoro.html，无构建步骤
```

## 架构

### 表格工具

**后端 (`server.py`)** — 单文件 Flask 应用，内存状态管理（无数据库）：
- `_current_wb` / `_current_path` — 当前打开的 openpyxl Workbook 和路径
- `_modified_cells` — dict，key 为 `"SheetName!col,row"`，存储未保存的单元格修改
- `_cell_colors` — dict，同格式存储单元格背景色
- `_encryption_info` — dict，加密文件的上下文（原文件名、密钥、加密/解密临时文件路径）

API 路由：`/api/open_file` (上传), `/api/save`, `/api/cell/update`, `/api/cell/color`, `/api/validate`, `/api/stats`, `/api/encryption_status`

**加密挡板 (`crypto_stub.py`)** — 加解密模块，所有 TODO 标记处待替换为真实 HTTPS API：
- `fetch_decrypt_key` / `fetch_encrypt_key` — 基于文件路径 hash 生成固定密钥（挡板）
- `decrypt_file` — base64 解码（挡板模拟解密），失败时当明文处理
- `encrypt_file` — base64 编码（挡板模拟加密）
- 加密文件通过 `.enc` / `.xlsx.enc` 后缀识别，解密后存为临时文件，保存时重新加密覆盖

**前端** — 纯原生 JS，无框架，三个模块按顺序加载：
1. `canvas-grid.js` — `CanvasGrid` 类：Canvas 渲染引擎，处理网格绘制、滚动视口裁剪、选区、行列头、单元格编辑触发、右键菜单
2. `toolbar.js` — `Toolbar` 类：文件上传/保存、校验弹窗、工作表切换标签
3. `app.js` — IIFE 胶水层：初始化 Grid + Toolbar，连接回调，管理单元格编辑器和状态栏

关键交互流：前端通过 `FormData` 上传文件到 `/api/open_file` → 后端返回 JSON（sheets 数据）→ `CanvasGrid.setData()` 渲染 → 单元格编辑/着色通过 `/api/cell/update` 和 `/api/cell/color` 暂存内存 → 保存时 `/api/save` 一次性写入

Canvas 渲染使用可见区域裁剪 (`visStartRow/Col` ~ `visEndRow/Col`)，支持 HiDPI (`devicePixelRatio`)。无虚拟滚动 — 行列数较大时直接渲染大 canvas。

### 番茄钟

单 HTML 文件，零依赖。状态机：`work → shortBreak → work → ... → longBreak`（每 4 个番茄后长休息）。预设 25/45/60 分钟。使用 Web Audio API 播放完成提示音，Notification API 发送桌面通知。

## 注意事项

- 所有 UI 文本为中文，面向中文用户
- 离线依赖包同时包含 Windows 和 Linux 的 wheel（cp310-win_amd64 和 manylinux），`run.sh` 中离线安装优先
- `offline-deps/` 在 `.gitignore` 中被排除，不上传版本库
- 加密功能当前使用 base64 挡板，`crypto_stub.py` 中每个函数都有明确 TODO 标记待替换的位置
