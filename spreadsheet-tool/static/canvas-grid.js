/**
 * Canvas-based spreadsheet grid rendering engine.
 * WPS-style display with row/col headers, selection, editing, and coloring.
 */

const ROW_HEADER_W = 50;
const COL_HEADER_H = 28;
const DEFAULT_CELL_W = 90;
const CELL_H = 28;
const HEADER_BG = '#f5f5f5';
const HEADER_BORDER = '#c0c0c0';
const GRID_LINE = '#d4d4d4';
const SELECTION_BORDER = '#1a73e8';
const SELECTION_FILL = 'rgba(26, 115, 232, 0.08)';
const HEADER_TEXT = '#555';

class CanvasGrid {
  constructor(container, wrapper, canvas, callbacks = {}) {
    this.container = container;
    this.wrapper = wrapper;
    this.canvas = canvas;
    this.ctx = canvas.getContext('2d');
    this.cb = callbacks;

    this.data = [];           // Array of arrays of cell objects {value, bg, bold}
    this.rowCount = 0;
    this.colCount = 0;
    this.colWidths = [];      // Pixel widths per column (indexed by col)
    this.mergedCells = [];

    // Selection state
    this.selection = null;    // {r1, c1, r2, c2} or null
    this.anchorCell = null;   // Starting cell for drag selection
    this.selectedRow = -1;    // Full row selection (-1 = none)
    this.selectedCol = -1;    // Full column selection

    // Scroll position
    this.scrollX = 0;
    this.scrollY = 0;

    // PPI scale
    this.dpr = window.devicePixelRatio || 1;

    this._bindEvents();
    this._resize();
  }

  // ── Public API ────────────────────────────────────────

  setData(sheetData) {
    if (!sheetData) return;
    this.data = sheetData.rows || [];
    this.rowCount = sheetData.max_row || this.data.length;
    this.colCount = sheetData.max_col || (this.data[0] ? this.data[0].length : 0);
    this.mergedCells = sheetData.merged || [];

    // Build column widths
    this.colWidths = [];
    const cw = sheetData.col_widths || {};
    for (let i = 0; i < this.colCount; i++) {
      const letter = this._colLetter(i);
      // openpyxl width units to pixels (approx)
      const w = cw[letter] ? cw[letter] * 7.5 + 5 : DEFAULT_CELL_W;
      this.colWidths.push(Math.max(40, w));
    }

    // Ensure rowCount/colCount at least match data
    if (this.data.length > this.rowCount) this.rowCount = this.data.length;
    for (const row of this.data) {
      if (row.length > this.colCount) this.colCount = row.length;
    }

    this._updateCanvasSize();
    this.selection = null;
    this.anchorCell = null;
    this.selectedRow = -1;
    this.selectedCol = -1;
    this.render();
  }

  getSelection() { return this.selection; }
  getSelectedRow() { return this.selectedRow; }
  getSelectedCol() { return this.selectedCol; }

  getSelectionCells() {
    const cells = [];
    if (this.selectedRow >= 0) {
      for (let c = 0; c < this.colCount; c++) {
        cells.push({ row: this.selectedRow, col: c, value: this._cellValue(this.selectedRow, c) });
      }
    } else if (this.selectedCol >= 0) {
      for (let r = 0; r < this.rowCount; r++) {
        cells.push({ row: r, col: this.selectedCol, value: this._cellValue(r, this.selectedCol) });
      }
    } else if (this.selection) {
      const { r1, c1, r2, c2 } = this.selection;
      for (let r = r1; r <= r2; r++) {
        for (let c = c1; c <= c2; c++) {
          cells.push({ row: r, col: c, value: this._cellValue(r, c) });
        }
      }
    }
    return cells;
  }

  setCellColor(row, col, color) {
    if (!this.data[row]) this.data[row] = [];
    if (!this.data[row][col]) this.data[row][col] = {};
    this.data[row][col].bg = color || null;
    this.render();
  }

  clearAllColors() {
    for (const row of this.data) {
      if (!row) continue;
      for (const cell of row) {
        if (cell && cell.bg) cell.bg = null;
      }
    }
    this.render();
  }

  highlightCells(issues) {
    // issues: [{row, col, message}]
    this._highlights = new Map();
    for (const issue of issues) {
      const key = `${issue.row},${issue.col}`;
      this._highlights.set(key, issue.message);
    }
    this.render();
  }

  clearHighlights() {
    this._highlights = null;
    this.render();
  }

  // ── Rendering ─────────────────────────────────────────

  _totalWidth() {
    return ROW_HEADER_W + this.colWidths.reduce((s, w) => s + w, 0);
  }

  _totalHeight() {
    return COL_HEADER_H + (this.rowCount + 1) * CELL_H; // +1 extra row
  }

  _updateCanvasSize() {
    const tw = this._totalWidth();
    const th = this._totalHeight();
    const cw = this.wrapper.clientWidth;
    const ch = this.wrapper.clientHeight;
    const w = Math.max(tw, cw);
    const h = Math.max(th, ch);

    this.canvas.style.width = w + 'px';
    this.canvas.style.height = h + 'px';
    this.canvas.width = w * this.dpr;
    this.canvas.height = h * this.dpr;
    this.ctx.setTransform(this.dpr, 0, 0, this.dpr, 0, 0);
  }

  render() {
    const ctx = this.ctx;
    const w = this.canvas.width / this.dpr;
    const h = this.canvas.height / this.dpr;
    const sx = this.wrapper.scrollLeft;
    const sy = this.wrapper.scrollTop;

    this.scrollX = sx;
    this.scrollY = sy;

    ctx.clearRect(0, 0, w, h);

    // Calculate visible column range
    let x = ROW_HEADER_W;
    let visStartCol = 0;
    let visEndCol = this.colCount - 1;
    let colXStart = ROW_HEADER_W;
    for (let c = 0; c < this.colCount; c++) {
      if (x + this.colWidths[c] >= sx && x <= sx + w) {
        if (c < visStartCol || c === 0) { visStartCol = c; colXStart = x; }
        visEndCol = c;
      }
      x += this.colWidths[c];
    }
    // Expand slightly
    visStartCol = Math.max(0, visStartCol - 1);
    visEndCol = Math.min(this.colCount - 1, visEndCol + 1);

    // Visible row range
    const visStartRow = Math.max(0, Math.floor(sy / CELL_H) - 1);
    const visEndRow = Math.min(this.rowCount - 1, Math.floor((sy + h) / CELL_H) + 1);

    this._drawCells(ctx, visStartRow, visEndRow, visStartCol, visEndCol, sx, sy, w, h);
    this._drawHeaders(ctx, visStartRow, visEndRow, visStartCol, visEndCol, sx, sy);
    this._drawSelection(ctx, sx, sy);
  }

  _drawCells(ctx, r1, r2, c1, c2, sx, sy, vw, vh) {
    // Fill white background
    ctx.fillStyle = '#ffffff';
    ctx.fillRect(ROW_HEADER_W, COL_HEADER_H, vw - ROW_HEADER_W, vh - COL_HEADER_H);

    // Grid lines
    ctx.strokeStyle = GRID_LINE;
    ctx.lineWidth = 0.5;

    // Draw cells
    for (let r = r1; r <= r2; r++) {
      const y = COL_HEADER_H + r * CELL_H;
      for (let c = c1; c <= c2; c++) {
        const x = this._colX(c);
        const cw = this.colWidths[c] || DEFAULT_CELL_W;
        const cell = this._cell(r, c);
        const val = cell ? cell.value : null;

        // Background color
        if (cell && cell.bg) {
          ctx.fillStyle = cell.bg;
          ctx.fillRect(x, y, cw, CELL_H);
        }

        // Highlight from validation
        const hlKey = `${r + 1},${c + 1}`;
        if (this._highlights && this._highlights.has(hlKey)) {
          ctx.fillStyle = 'rgba(255, 107, 107, 0.25)';
          ctx.fillRect(x, y, cw, CELL_H);
        }

        // Selection fill
        if (this._isCellSelected(r, c)) {
          ctx.fillStyle = SELECTION_FILL;
          ctx.fillRect(x, y, cw, CELL_H);
        }

        // Text
        if (val !== null && val !== undefined && val !== '') {
          ctx.fillStyle = '#222';
          ctx.font = (cell && cell.bold ? 'bold ' : '') + '13px -apple-system, BlinkMacSystemFont, "Microsoft YaHei", sans-serif';
          ctx.textBaseline = 'middle';

          const text = String(val);
          const maxW = cw - 8;
          ctx.save();
          ctx.beginPath();
          ctx.rect(x + 4, y, maxW, CELL_H);
          ctx.clip();
          ctx.fillText(text, x + 4, y + CELL_H / 2);
          ctx.restore();
        }

        // Grid line (right)
        ctx.strokeStyle = GRID_LINE;
        ctx.beginPath();
        ctx.moveTo(x + cw, y);
        ctx.lineTo(x + cw, y + CELL_H);
        ctx.stroke();
      }

      // Horizontal grid line
      ctx.strokeStyle = GRID_LINE;
      ctx.beginPath();
      ctx.moveTo(ROW_HEADER_W, y + CELL_H);
      ctx.lineTo(this._colX(c2) + (this.colWidths[c2] || DEFAULT_CELL_W), y + CELL_H);
      ctx.stroke();
    }
  }

  _drawHeaders(ctx, r1, r2, c1, c2, sx, sy) {
    // Top-left corner
    ctx.fillStyle = HEADER_BG;
    ctx.fillRect(0, 0, ROW_HEADER_W, COL_HEADER_H);
    ctx.strokeStyle = HEADER_BORDER;
    ctx.strokeRect(0, 0, ROW_HEADER_W, COL_HEADER_H);

    // Column headers
    ctx.fillStyle = HEADER_BG;
    ctx.fillRect(ROW_HEADER_W, 0, this._totalWidth() - ROW_HEADER_W, COL_HEADER_H);

    ctx.fillStyle = HEADER_TEXT;
    ctx.font = '12px -apple-system, BlinkMacSystemFont, "Microsoft YaHei", sans-serif';
    ctx.textAlign = 'center';
    ctx.textBaseline = 'middle';

    for (let c = c1; c <= c2; c++) {
      const x = this._colX(c);
      const cw = this.colWidths[c] || DEFAULT_CELL_W;
      // Header bg
      if (c === this.selectedCol) {
        ctx.fillStyle = '#d0dff5';
        ctx.fillRect(x, 0, cw, COL_HEADER_H);
        ctx.fillStyle = HEADER_TEXT;
      }
      // Border
      ctx.strokeStyle = HEADER_BORDER;
      ctx.strokeRect(x, 0, cw, COL_HEADER_H);
      // Text
      ctx.fillText(this._colLetter(c), x + cw / 2, COL_HEADER_H / 2);
    }

    // Row headers
    for (let r = r1; r <= r2; r++) {
      const y = COL_HEADER_H + r * CELL_H;
      if (r === this.selectedRow) {
        ctx.fillStyle = '#d0dff5';
      } else {
        ctx.fillStyle = HEADER_BG;
      }
      ctx.fillRect(0, y, ROW_HEADER_W, CELL_H);
      ctx.strokeStyle = HEADER_BORDER;
      ctx.strokeRect(0, y, ROW_HEADER_W, CELL_H);
      ctx.fillStyle = HEADER_TEXT;
      ctx.fillText(String(r + 1), ROW_HEADER_W / 2, y + CELL_H / 2);
    }

    ctx.textAlign = 'start';
  }

  _drawSelection(ctx, sx, sy) {
    if (this.selectedRow >= 0) {
      const y = COL_HEADER_H + this.selectedRow * CELL_H;
      const totalW = this._totalWidth() - ROW_HEADER_W;
      if (y + CELL_H >= sy && y <= sy + this.canvas.height / this.dpr) {
        ctx.strokeStyle = SELECTION_BORDER;
        ctx.lineWidth = 2;
        ctx.strokeRect(ROW_HEADER_W, y, totalW, CELL_H);
        ctx.lineWidth = 1;
      }
    }
    if (this.selectedCol >= 0) {
      const x = this._colX(this.selectedCol);
      const cw = this.colWidths[this.selectedCol] || DEFAULT_CELL_W;
      const totalH = this.rowCount * CELL_H;
      if (x + cw >= sx && x <= sx + this.canvas.width / this.dpr) {
        ctx.strokeStyle = SELECTION_BORDER;
        ctx.lineWidth = 2;
        ctx.strokeRect(x, COL_HEADER_H, cw, totalH);
        ctx.lineWidth = 1;
      }
    }
    if (this.selection) {
      const { r1, c1, r2, c2 } = this.selection;
      const x1 = this._colX(c1);
      const y1 = COL_HEADER_H + r1 * CELL_H;
      const x2 = this._colX(c2) + (this.colWidths[c2] || DEFAULT_CELL_W);
      const y2 = COL_HEADER_H + (r2 + 1) * CELL_H;

      if (x2 >= sx && x1 <= sx + this.canvas.width / this.dpr &&
          y2 >= sy && y1 <= sy + this.canvas.height / this.dpr) {
        ctx.strokeStyle = SELECTION_BORDER;
        ctx.lineWidth = 2;
        ctx.strokeRect(x1, y1, x2 - x1, y2 - y1);
        ctx.lineWidth = 1;

        // Fill handle at bottom-right
        ctx.fillStyle = SELECTION_BORDER;
        ctx.fillRect(x2 - 5, y2 - 5, 6, 6);
      }
    }
  }

  // ── Coordinate Helpers ────────────────────────────────

  _colX(col) {
    let x = ROW_HEADER_W;
    for (let c = 0; c < col && c < this.colWidths.length; c++) {
      x += this.colWidths[c];
    }
    return x;
  }

  _colLetter(idx) {
    let result = '';
    let n = idx;
    while (n >= 0) {
      result = String.fromCharCode(65 + (n % 26)) + result;
      n = Math.floor(n / 26) - 1;
    }
    return result;
  }

  _cell(r, c) {
    if (r < 0 || r >= this.data.length) return null;
    const row = this.data[r];
    if (!row || c < 0 || c >= row.length) return null;
    return row[c];
  }

  _cellValue(r, c) {
    const cell = this._cell(r, c);
    return cell ? cell.value : null;
  }

  /** Canvas pixel coords → grid (row, col), or {header:'row'|'col', index} */
  cellFromPoint(px, py) {
    const totalW = this._totalWidth();
    const totalH = this._totalHeight();

    // Check row header
    if (px >= 0 && px < ROW_HEADER_W && py >= COL_HEADER_H) {
      const row = Math.floor((py - COL_HEADER_H) / CELL_H);
      if (row >= 0 && row < this.rowCount) {
        return { type: 'row-header', row };
      }
    }

    // Check column header
    if (py >= 0 && py < COL_HEADER_H && px >= ROW_HEADER_W) {
      let cx = ROW_HEADER_W;
      for (let c = 0; c < this.colCount; c++) {
        const cw = this.colWidths[c] || DEFAULT_CELL_W;
        if (px >= cx && px < cx + cw) {
          return { type: 'col-header', col: c };
        }
        cx += cw;
      }
    }

    // Check top-left corner
    if (px >= 0 && px < ROW_HEADER_W && py >= 0 && py < COL_HEADER_H) {
      return { type: 'corner' };
    }

    // Grid cells
    if (px >= ROW_HEADER_W && py >= COL_HEADER_H) {
      let cx = ROW_HEADER_W;
      for (let c = 0; c < this.colCount; c++) {
        const cw = this.colWidths[c] || DEFAULT_CELL_W;
        if (px >= cx && px < cx + cw) {
          const row = Math.floor((py - COL_HEADER_H) / CELL_H);
          if (row >= 0 && row < this.rowCount) {
            return { type: 'cell', row, col: c };
          }
        }
        cx += cw;
      }
    }

    return null;
  }

  _isCellSelected(r, c) {
    if (this.selectedRow === r) return true;
    if (this.selectedCol === c) return true;
    if (this.selection) {
      const { r1, c1, r2, c2 } = this.selection;
      return r >= r1 && r <= r2 && c >= c1 && c <= c2;
    }
    return false;
  }

  // ── Events ─────────────────────────────────────────────

  _bindEvents() {
    this.canvas.addEventListener('mousedown', e => this._onMouseDown(e));
    this.canvas.addEventListener('mousemove', e => this._onMouseMove(e));
    this.canvas.addEventListener('mouseup', () => this._dragging = false);
    this.canvas.addEventListener('dblclick', e => this._onDblClick(e));
    this.canvas.addEventListener('contextmenu', e => this._onContextMenu(e));
    window.addEventListener('resize', () => this._resize());
    this.wrapper.addEventListener('scroll', () => this.render());
  }

  _resize() {
    this._updateCanvasSize();
    this.render();
  }

  _canvasCoords(e) {
    const rect = this.canvas.getBoundingClientRect();
    return {
      x: e.clientX - rect.left + this.scrollX,
      y: e.clientY - rect.top + this.scrollY,
      clientX: e.clientX,
      clientY: e.clientY,
    };
  }

  _onMouseDown(e) {
    const { x, y } = this._canvasCoords(e);
    const hit = this.cellFromPoint(x, y);
    if (!hit) return;

    this._dragging = true;

    if (hit.type === 'row-header') {
      this.selectedRow = hit.row;
      this.selectedCol = -1;
      this.selection = null;
    } else if (hit.type === 'col-header') {
      this.selectedCol = hit.col;
      this.selectedRow = -1;
      this.selection = null;
    } else if (hit.type === 'cell') {
      this.selectedRow = -1;
      this.selectedCol = -1;

      if (e.shiftKey && this.selection) {
        // Extend selection
        const s = this.selection;
        this.selection = {
          r1: Math.min(s.r1, hit.row), c1: Math.min(s.c1, hit.col),
          r2: Math.max(s.r2, hit.row), c2: Math.max(s.c2, hit.col),
        };
      } else {
        this.selection = { r1: hit.row, c1: hit.col, r2: hit.row, c2: hit.col };
        this.anchorCell = { row: hit.row, col: hit.col };
      }
    } else if (hit.type === 'corner') {
      // Select all
      this.selectedRow = -1;
      this.selectedCol = -1;
      this.selection = { r1: 0, c1: 0, r2: this.rowCount - 1, c2: this.colCount - 1 };
    }

    this.render();

    if (this.cb.onSelectionChange) {
      this.cb.onSelectionChange(this.getSelectionCells());
    }
  }

  _onMouseMove(e) {
    if (!this._dragging) return;
    const { x, y } = this._canvasCoords(e);
    const hit = this.cellFromPoint(x, y);
    if (!hit || hit.type !== 'cell') return;

    if (this.selectedRow >= 0) {
      // Extending row selection
    } else if (this.selectedCol >= 0) {
      // Extending col selection
    } else {
      this.selection = {
        r1: Math.min(this.anchorCell.row, hit.row),
        c1: Math.min(this.anchorCell.col, hit.col),
        r2: Math.max(this.anchorCell.row, hit.row),
        c2: Math.max(this.anchorCell.col, hit.col),
      };
      this.render();
    }
  }

  _onDblClick(e) {
    const { x, y, clientX, clientY } = this._canvasCoords(e);
    const hit = this.cellFromPoint(x, y);
    if (!hit || hit.type !== 'cell') return;

    if (this.cb.onCellEdit) {
      const cellX = this._colX(hit.col) - this.scrollX;
      const cellY = COL_HEADER_H + hit.row * CELL_H - this.scrollY;
      const cw = this.colWidths[hit.col] || DEFAULT_CELL_W;
      const val = this._cellValue(hit.row, hit.col);
      this.cb.onCellEdit(hit.row, hit.col, val, cellX, cellY, cw, CELL_H);
    }
  }

  _onContextMenu(e) {
    e.preventDefault();
    const { x, y, clientX, clientY } = this._canvasCoords(e);
    const hit = this.cellFromPoint(x, y);

    // Select the cell on right-click
    if (hit && hit.type === 'cell') {
      this.selectedRow = -1;
      this.selectedCol = -1;
      this.selection = { r1: hit.row, c1: hit.col, r2: hit.row, c2: hit.col };
      this.render();
    }

    if (this.cb.onContextMenu) {
      this.cb.onContextMenu(hit, clientX, clientY);
    }
  }
}
