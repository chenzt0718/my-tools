/**
 * Toolbar logic - file open/save, validation, sheet switching.
 * Communicates with the Python Flask backend.
 */

class Toolbar {
  constructor(elements, callbacks = {}) {
    this.el = elements;
    this.cb = callbacks;
    this.sheets = [];
    this.activeSheet = '';
    this.filename = '';

    this._bind();
  }

  _bind() {
    this.el.btnOpen.addEventListener('click', () => this.el.fileInput.click());
    this.el.fileInput.addEventListener('change', e => this._openFile(e));
    this.el.btnSave.addEventListener('click', () => this._saveFile());
    this.el.btnValidate.addEventListener('click', () => this._showValidate());
    this.el.btnClearColor.addEventListener('click', () => this._clearColors());
    this.el.btnRunValidate.addEventListener('click', () => this._runValidate());
    this.el.btnCloseValidate.addEventListener('click', () => this._hideValidate());
  }

  setFileLoaded(filename, sheets, activeSheet) {
    this.filename = filename;
    this.sheets = sheets;
    this.activeSheet = activeSheet;

    this.el.fileInfo.textContent = filename;
    this.el.btnSave.disabled = false;
    this.el.btnValidate.disabled = false;
    this.el.btnClearColor.disabled = false;

    this._renderSheetTabs();
  }

  _renderSheetTabs() {
    this.el.sheetTabs.innerHTML = '';
    for (const s of this.sheets) {
      const tab = document.createElement('span');
      tab.className = 'sheet-tab' + (s === this.activeSheet ? ' active' : '');
      tab.textContent = s;
      tab.addEventListener('click', () => {
        this.activeSheet = s;
        this._renderSheetTabs();
        if (this.cb.onSheetSwitch) this.cb.onSheetSwitch(s);
      });
      this.el.sheetTabs.appendChild(tab);
    }
  }

  async _openFile(e) {
    const file = e.target.files[0];
    if (!file) return;

    // For browser security, we can't get the real path.
    // Instead, upload the file to the backend.
    this.el.statusText.textContent = '正在打开文件...';

    const formData = new FormData();
    formData.append('file', file);

    try {
      const resp = await fetch('/api/open_file', { method: 'POST', body: formData });
      const data = await resp.json();
      if (data.error) {
        this.el.statusText.textContent = '错误: ' + data.error;
        return;
      }
      this.el.statusText.textContent = '文件已加载: ' + data.filename;
      this.setFileLoaded(data.filename, data.sheets.map(s => s.name), data.active_sheet);
      if (this.cb.onFileLoaded) this.cb.onFileLoaded(data);
    } catch (err) {
      this.el.statusText.textContent = '加载失败: ' + err.message;
    }

    e.target.value = '';
  }

  async _saveFile() {
    this.el.statusText.textContent = '正在保存...';
    try {
      const resp = await fetch('/api/save', { method: 'POST' });
      const data = await resp.json();
      if (data.error) {
        this.el.statusText.textContent = '错误: ' + data.error;
      } else {
        this.el.statusText.textContent = data.message + ' — ' + data.filename;
      }
    } catch (err) {
      this.el.statusText.textContent = '保存失败: ' + err.message;
    }
  }

  _showValidate() {
    this.el.validateDialog.style.display = '';
    this.el.validateResult.innerHTML = '';
  }

  _hideValidate() {
    this.el.validateDialog.style.display = 'none';
  }

  async _runValidate() {
    const checks = this.el.validateDialog.querySelectorAll('.rule-check:checked');
    const rules = [];
    checks.forEach(cb => {
      try { rules.push(JSON.parse(cb.dataset.rule)); } catch (e) {}
    });

    if (rules.length === 0) {
      this.el.validateResult.innerHTML = '<div class="validate-issue">请选择至少一条校验规则</div>';
      return;
    }

    const sheetData = [];
    for (const row of this.cb.getSheetData()) {
      sheetData.push(row);
    }

    this.el.validateResult.innerHTML = '校验中...';
    try {
      const resp = await fetch('/api/validate', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ rules, sheet_data: sheetData }),
      });
      const data = await resp.json();

      if (data.count === 0) {
        this.el.validateResult.innerHTML = '<div style="color:#6bcb77;padding:4px;">✅ 校验通过，未发现问题</div>';
        if (this.cb.onValidationResult) this.cb.onValidationResult([]);
      } else {
        let html = `<div style="color:#ff6b6b;padding:4px;margin-bottom:8px;">发现 ${data.count} 个问题：</div>`;
        for (const issue of data.issues) {
          html += `<div class="validate-issue">${issue.message}</div>`;
        }
        this.el.validateResult.innerHTML = html;
        if (this.cb.onValidationResult) this.cb.onValidationResult(data.issues);
      }
    } catch (err) {
      this.el.validateResult.innerHTML = '<div class="validate-issue">校验请求失败: ' + err.message + '</div>';
    }
  }

  _clearColors() {
    if (this.cb.onClearColors) this.cb.onClearColors();
  }
}
