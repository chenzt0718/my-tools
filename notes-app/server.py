"""Markdown Notes App - Flask backend with filesystem-based note storage."""

import os
import re
from datetime import datetime
from pathlib import Path

from flask import Flask, jsonify, render_template, request

app = Flask(__name__)

NOTES_DIR = os.path.join(os.path.dirname(__file__), "notes")
os.makedirs(NOTES_DIR, exist_ok=True)


def safe_filename(name: str) -> str:
    name = re.sub(r'[<>:"/\\|?*]', '', name)
    name = name.strip().replace(' ', '-')
    return name if name else 'untitled'


@app.route("/")
def index():
    return render_template("index.html")


@app.route("/api/notes", methods=["GET"])
def list_notes():
    notes = []
    for f in sorted(Path(NOTES_DIR).glob("*.md"), key=lambda p: p.stat().st_mtime, reverse=True):
        stat = f.stat()
        with open(f, 'r', encoding='utf-8') as fh:
            first_line = fh.readline().lstrip('#').strip()
        notes.append({
            "filename": f.name,
            "title": first_line or f.stem,
            "modified": datetime.fromtimestamp(stat.st_mtime).strftime("%Y-%m-%d %H:%M"),
        })
    return jsonify(notes)


@app.route("/api/notes", methods=["POST"])
def create_note():
    data = request.get_json()
    title = data.get("title", "untitled")
    filename = safe_filename(title) + ".md"

    filepath = os.path.join(NOTES_DIR, filename)
    if os.path.exists(filepath):
        base = safe_filename(title)
        i = 1
        while os.path.exists(os.path.join(NOTES_DIR, f"{base}-{i}.md")):
            i += 1
        filename = f"{base}-{i}.md"
        filepath = os.path.join(NOTES_DIR, filename)

    content = f"# {title}\n\n"
    with open(filepath, 'w', encoding='utf-8') as f:
        f.write(content)

    return jsonify({"filename": filename, "title": title, "content": content})


@app.route("/api/notes/<path:filename>", methods=["GET"])
def read_note(filename):
    # Security: prevent directory traversal
    filepath = os.path.normpath(os.path.join(NOTES_DIR, filename))
    if not filepath.startswith(os.path.normpath(NOTES_DIR)):
        return jsonify({"error": "路径非法"}), 403

    if not os.path.exists(filepath):
        return jsonify({"error": "文件不存在"}), 404

    with open(filepath, 'r', encoding='utf-8') as f:
        content = f.read()

    first_line = content.split('\n')[0].lstrip('#').strip()
    return jsonify({"filename": os.path.basename(filename), "title": first_line, "content": content})


@app.route("/api/notes/<path:filename>", methods=["PUT"])
def update_note(filename):
    filepath = os.path.normpath(os.path.join(NOTES_DIR, filename))
    if not filepath.startswith(os.path.normpath(NOTES_DIR)):
        return jsonify({"error": "路径非法"}), 403
    if not os.path.exists(filepath):
        return jsonify({"error": "文件不存在"}), 404

    data = request.get_json()
    content = data.get("content", "")
    with open(filepath, 'w', encoding='utf-8') as f:
        f.write(content)

    return jsonify({"status": "ok"})


@app.route("/api/notes/<path:filename>", methods=["DELETE"])
def delete_note(filename):
    filepath = os.path.normpath(os.path.join(NOTES_DIR, filename))
    if not filepath.startswith(os.path.normpath(NOTES_DIR)):
        return jsonify({"error": "路径非法"}), 403
    if not os.path.exists(filepath):
        return jsonify({"error": "文件不存在"}), 404

    os.unlink(filepath)
    return jsonify({"status": "ok"})


if __name__ == "__main__":
    port = int(os.environ.get("PORT", 5001))
    app.run(host="0.0.0.0", port=port, debug=False)
