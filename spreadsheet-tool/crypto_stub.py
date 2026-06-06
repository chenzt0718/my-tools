"""
加密/解密模块
==============
使用 AES-128-CBC + HMAC-SHA256 (Fernet) 对文件进行真实加解密。
密钥通过 HTTPS API 获取（当前使用基于文件路径 + 主密钥的本地派生作为过渡方案）。

流程:
  打开: 加密文件 → [API获取密钥] → 解密到临时文件 → openpyxl读取 → 删除临时文件
  保存: 修改数据 → 写入临时文件 → [API获取密钥] → 加密 → 覆盖原文件 → 删除临时文件
"""

import base64
import hashlib
import os
import tempfile

from cryptography.fernet import Fernet

# ─── 配置 ──────────────────────────────────────────────────────────
# 加密模式开关: True = 启用加密流程, False = 明文模式
ENCRYPTION_ENABLED = True

# 加密文件后缀识别
ENCRYPTED_EXTENSIONS = {".enc", ".encrypted", ".xlsx.enc"}

# 主密钥：优先从环境变量读取，否则使用固定盐值（生产环境必须设置 ENCRYPTION_SECRET）
_MASTER_SECRET = os.environ.get("ENCRYPTION_SECRET", "spreadsheet-tool-default-salt").encode()


def is_encrypted_file(filepath: str) -> bool:
    """判断文件是否需要解密处理。"""
    if not ENCRYPTION_ENABLED:
        return False
    fname = filepath.lower()
    return any(fname.endswith(ext) for ext in ENCRYPTED_EXTENSIONS)


def strip_encryption_suffix(filepath: str) -> str:
    """去掉加密后缀，还原原始文件名。"""
    fname = filepath
    for ext in ENCRYPTED_EXTENSIONS:
        if fname.lower().endswith(ext):
            return fname[: -len(ext)]
    return fname


# ─── 密钥管理 ──────────────────────────────────────────────────────

def _derive_key(filepath: str) -> bytes:
    """基于文件路径 + 主密钥派生 Fernet 兼容的 32 字节密钥。"""
    digest = hashlib.sha256(_MASTER_SECRET + filepath.encode()).digest()
    return base64.urlsafe_b64encode(digest)


def fetch_decrypt_key(filepath: str) -> bytes:
    """
    获取解密密钥。
    当前为本地密钥派生，未来可替换为 HTTPS API 调用：
        import requests
        resp = requests.post(
            "https://api.example.com/v1/decrypt-key",
            json={"file_path": filepath, "client_id": CLIENT_ID},
            headers={"Authorization": f"Bearer {API_TOKEN}"},
            timeout=10,
        )
        resp.raise_for_status()
        return resp.json()["key"]
    """
    return _derive_key(filepath)


def fetch_encrypt_key(filepath: str) -> bytes:
    """
    获取加密密钥。
    当前为本地密钥派生，未来可替换为 HTTPS API 调用。
    """
    return _derive_key(filepath)


# ─── 加解密 ────────────────────────────────────────────────────────

def decrypt_file(encrypted_path: str, key: bytes) -> str:
    """
    解密文件到临时路径，返回临时文件路径。
    调用方负责在使用后删除临时文件。
    """
    tmp = tempfile.NamedTemporaryFile(delete=False, suffix=".xlsx")
    try:
        with open(encrypted_path, "rb") as f:
            ciphertext = f.read()

        cipher = Fernet(key)
        plaintext = cipher.decrypt(ciphertext)

        tmp.write(plaintext)
    finally:
        tmp.close()

    return tmp.name


def encrypt_file(source_path: str, key: bytes) -> str:
    """
    加密文件，返回加密后的文件路径。
    调用方负责在使用后将加密文件移动到目标位置。
    """
    tmp = tempfile.NamedTemporaryFile(delete=False, suffix=".enc")
    try:
        with open(source_path, "rb") as f:
            plaintext = f.read()

        cipher = Fernet(key)
        ciphertext = cipher.encrypt(plaintext)

        tmp.write(ciphertext)
    finally:
        tmp.close()

    return tmp.name


def delete_temp_file(filepath: str) -> None:
    """安全删除临时文件。"""
    try:
        if os.path.exists(filepath):
            os.unlink(filepath)
    except OSError:
        pass  # 删除失败不影响主流程
