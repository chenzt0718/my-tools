/**
 * Main application logic - ties CanvasGrid, Toolbar, cell editing, and context menu together.
 */

(function () {
  // DOM elements
  const el = {
    // Toolbar
    btnOpen: document.getElementById('btnOpen'),
    btnSave: document.getElementById('btnSave'),
    btnValidate: document.getElementById('btnValidate'),
    btnClearColor: document.getElementById('btnClearColor'),
    fileInfo: document.getElementById('fileInfo'),
    encryptionBadge: document.getElementById('encryptionBadge'),
    sheetTabs: document.getElementById('sheetTabs'),
    fileInput: document.getElementById('fileInput'),
    statusText: document.getElementById('statusText'),
    cellPosition: document.getElementById('cellPosition'),
    statsContent: document.getElementById('statsContent'),

    // Grid
    gridContainer: document.getElementById('gridContainer'),
    gridWrapper: document.getElementById('gridWrapper'),
    gridCanvas: document.getElementById('gridCanvas'),

    // Editor overlay
    cellEditor: document.getElementById('cellEditor'),

    // Context menu
    contextMenu: document.getElementById('contextMenu'),

    // Validate dialog
    validateDialog: document.getElementById('validateDialog'),
    btnRunValidate: document.getElementById('btnRunValidate'),
    btnCloseValidate: document.getElementById('btnCloseValidate'),
    validateResult: document.getElementById('validateResult'),

    // Status bar
    statsContent: document.getElementById('statsContent'),
  };

  // State
  let grid = null;
  let toolbar = null;
  let sheetsData = [];      // All sheet data from backend
  let sheetNames = [];
  let activeSheetName = '';
  let editingCell = null;   // {row, col} or null

  // ── Initialize Grid ────────────────────────────────────

  grid = new CanvasGrid(el.gridContainer, el.gridWrapper, el.gridCanvas, {
    onSelectionChange(cells) {
      updateStatsPanel(cells);
      updateCellPosition();
    },
    onCellEdit(row, col, value, x, y, w, h) {
      startCellEdit(row, col, value, x, y, w, h);
    },
    onContextMenu(hit, clientX, clientY) {
      showContextMenu(hit, clientX, clientY);
    },
  });

  // ── Initialize Toolbar ─────────────────────────────────

  toolbar = new Toolbar({
    btnOpen: el.btnOpen,
    btnSave: el.btnSave,
    btnValidate: el.btnValidate,
    btnClearColor: el.btnClearColor,
    fileInfo: el.fileInfo,
    sheetTabs: el.sheetTabs,
    fileInput: el.fileInput,
    encryptionBadge: el.encryptionBadge,
    statusText: el.statusText,
    validateDialog: el.validateDialog,
    btnRunValidate: el.btnRunValidate,
    btnCloseValidate: el.btnCloseValidate,
    validateResult: el.validateResult,
  }, {
    onFileLoaded(data) {
      sheetsData = data.sheets;
      sheetNames = data.sheets.map(s => s.name);
      activeSheetName = data.active_sheet;
      loadSheet(activeSheetName);

      // Update encryption indicators
      if (data.encrypted) {
        el.encryptionBadge.style.display = '';
        el.fileInfo.textContent = data.display_name || data.filename;
        el.btnSave.textContent = '🔒 加密保存';
        el.btnSave.title = '加密后保存文件';
      } else {
        el.encryptionBadge.style.display = 'none';
        el.btnSave.textContent = '💾 保存';
        el.btnSave.title = '';
      }
    },
    onSheetSwitch(name) {
      activeSheetName = name;
      loadSheet(name);
    },
    getSheetData() {
      return grid ? grid.data : [];
    },
    onValidationResult(issues) {
      grid.highlightCells(issues);
    },
    onClearColors() {
      grid.clearAllColors();
      // Also clear on backend
      for (const row of grid.data) {
        if (!row) continue;
        for (let c = 0; c < row.length; c++) {
          if (row[c] && row[c].bg) {
            fetch('/api/cell/color', {
              method: 'POST',
              headers: { 'Content-Type': 'application/json' },
              body: JSON.stringify({ sheet: activeSheetName, col: c + 1, row: grid.data.indexOf(row) + 1, color: null }),
            });
          }
        }
      }
    },
  });

  // ── Sheet Loading ──────────────────────────────────────

  function loadSheet(name) {
    const sheet = sheetsData.find(s => s.name === name);
    if (!sheet) return;
    activeSheetName = name;
    grid.setData(sheet);
    el.statusText.textContent = '工作表: ' + name;
  }

  // ── Cell Editing ───────────────────────────────────────

  function startCellEdit(row, col, value, x, y, w, h) {
    // Position the editor overlay
    const editor = el.cellEditor;
    editor.style.left = x + 'px';
    editor.style.top = y + 'px';
    editor.style.width = Math.max(w, 60) + 'px';
    editor.style.height = h + 'px';
    editor.style.display = '';
    editor.textContent = value !== null && value !== undefined ? String(value) : '';
    editor.focus();
    // Select all text
    const range = document.createRange();
    range.selectNodeContents(editor);
    const sel = window.getSelection();
    sel.removeAllRanges();
    sel.addRange(range);

    editingCell = { row, col };
  }

  function finishCellEdit(commit) {
    const editor = el.cellEditor;
    if (!editingCell) {
      editor.style.display = 'none';
      return;
    }

    const { row, col } = editingCell;

    if (commit) {
      const newValue = editor.textContent.trim();

      // Update local data
      if (!grid.data[row]) grid.data[row] = [];
      if (!grid.data[row][col]) grid.data[row][col] = {};
      grid.data[row][col].value = newValue === '' ? null : newValue;

      // Send to backend
      fetch('/api/cell/update', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          sheet: activeSheetName,
          col: col + 1,
          row: row + 1,
          value: newValue === '' ? null : newValue,
        }),
      }).catch(() => {});

      el.statusText.textContent = '单元格已修改 (未保存)';
    }

    editor.style.display = 'none';
    editingCell = null;
    grid.render();
  }

  el.cellEditor.addEventListener('keydown', (e) => {
    if (e.key === 'Enter' && !e.shiftKey) {
      e.preventDefault();
      finishCellEdit(true);
    } else if (e.key === 'Escape') {
      e.preventDefault();
      finishCellEdit(false);
    }
  });

  el.cellEditor.addEventListener('blur', () => {
    finishCellEdit(true);
  });

  // ── Context Menu ───────────────────────────────────────

  function showContextMenu(hit, clientX, clientY) {
    const menu = el.contextMenu;
    if (!hit || (hit.type !== 'cell' && hit.type !== 'row-header' && hit.type !== 'col-header')) {
      menu.style.display = 'none';
      return;
    }

    // Store target for color action
    menu._targetHit = hit;

    menu.style.display = '';
    menu.style.left = clientX + 'px';
    menu.style.top = clientY + 'px';

    // Keep menu within viewport
    const mr = menu.getBoundingClientRect();
    if (mr.right > window.innerWidth) menu.style.left = (clientX - mr.width) + 'px';
    if (mr.bottom > window.innerHeight) menu.style.top = (clientY - mr.height) + 'px';
  }

  el.contextMenu.addEventListener('click', (e) => {
    const item = e.target.closest('.menu-item');
    if (!item) return;

    const color = item.dataset.color;
    const hit = el.contextMenu._targetHit;
    el.contextMenu.style.display = 'none';

    if (!hit) return;

    // Get affected cells
    let cells = [];
    if (hit.type === 'row-header') {
      for (let c = 0; c < grid.colCount; c++) cells.push({ row: hit.row, col: c });
    } else if (hit.type === 'col-header') {
      for (let r = 0; r < grid.rowCount; r++) cells.push({ row: r, col: hit.col });
    } else if (hit.type === 'cell') {
      const sel = grid.getSelection();
      if (sel) {
        cells = grid.getSelectionCells();
      } else {
        cells = [{ row: hit.row, col: hit.col }];
      }
    }

    for (const cell of cells) {
      grid.setCellColor(cell.row, cell.col, color || null);

      // Send to backend
      fetch('/api/cell/color', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          sheet: activeSheetName,
          col: cell.col + 1,
          row: cell.row + 1,
          color: color || null,
        }),
      }).catch(() => {});
    }

    el.statusText.textContent = color ? `已标记 ${cells.length} 个单元格` : `已清除 ${cells.length} 个单元格颜色`;
  });

  // Close context menu on click elsewhere
  document.addEventListener('click', (e) => {
    if (!el.contextMenu.contains(e.target)) {
      el.contextMenu.style.display = 'none';
    }
  });

  // ── Stats Panel ────────────────────────────────────────

  async function updateStatsPanel(cells) {
    if (!cells || cells.length === 0) {
      el.statsContent.textContent = '选择单元格以查看统计信息';
      return;
    }

    const numCells = cells.filter(c => {
      const v = c.value;
      return v !== null && v !== undefined && v !== '' && !isNaN(Number(v));
    });

    if (numCells.length === 0) {
      el.statsContent.textContent = `已选 ${cells.length} 个单元格 | 无有效数值`;
      return;
    }

    try {
      const resp = await fetch('/api/stats', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ cells }),
      });
      const stats = await resp.json();

      if (stats.count === 0) {
        el.statsContent.textContent = `已选 ${cells.length} 个单元格 | 无有效数值`;
      } else {
        el.statsContent.textContent =
          `已选 ${cells.length} 格 | ` +
          `计数: ${stats.count} | ` +
          `求和: ${stats.sum?.toLocaleString()} | ` +
          `均值: ${stats.avg} | ` +
          `中位数: ${stats.median} | ` +
          `最小: ${stats.min} | ` +
          `最大: ${stats.max}` +
          (stats.stdev ? ` | 标准差: ${stats.stdev}` : '');
      }
    } catch (err) {
      el.statsContent.textContent = `已选 ${cells.length} 个单元格`;
    }
  }

  function updateCellPosition() {
    const sel = grid.getSelection();
    if (sel) {
      const c1 = grid._colLetter(sel.c1);
      const c2 = grid._colLetter(sel.c2);
      if (sel.r1 === sel.r2 && sel.c1 === sel.c2) {
        el.cellPosition.textContent = `${c1}${sel.r1 + 1}`;
      } else {
        el.cellPosition.textContent = `${c1}${sel.r1 + 1}:${c2}${sel.r2 + 1}`;
      }
    } else if (grid.selectedRow >= 0) {
      el.cellPosition.textContent = `行 ${grid.selectedRow + 1}`;
    } else if (grid.selectedCol >= 0) {
      el.cellPosition.textContent = `列 ${grid._colLetter(grid.selectedCol)}`;
    } else {
      el.cellPosition.textContent = '—';
    }
  }

  // ── Keyboard Shortcuts ─────────────────────────────────

  document.addEventListener('keydown', (e) => {
    if (editingCell) return; // Don't intercept when editing

    if ((e.ctrlKey || e.metaKey) && e.key === 's') {
      e.preventDefault();
      toolbar._saveFile();
    }
  });

})();
