"""
加密/解密挡板模块 (Crypto Stub)
===============================
实际环境中需要通过 HTTPS API 获取密钥进行加解密。
当前 API 服务未就绪，所有 API 调用处用挡板模拟，标记 TODO 待替换。

流程:
  打开: 加密文件 → [API获取密钥] → 解密到临时文件 → openpyxl读取 → 删除临时文件
  保存: 修改数据 → 写入临时文件 → [API获取密钥] → 加密 → 覆盖原文件 → 删除临时文件
"""

import base64
import hashlib
import os
import tempfile

# ─── 配置 ──────────────────────────────────────────────────────────
# 加密模式开关: True = 启用加密流程, False = 明文模式
ENCRYPTION_ENABLED = True

# 加密文件后缀识别
ENCRYPTED_EXTENSIONS = {".enc", ".encrypted", ".xlsx.enc"}


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


# ─── 密钥获取 (挡板) ──────────────────────────────────────────────

def fetch_decrypt_key(filepath: str) -> str:
    """
    从 HTTPS API 获取解密密钥。

    TODO: 替换为真实 API 调用，示例：
        import requests
        resp = requests.post(
            "https://api.example.com/v1/decrypt-key",
            json={"file_path": filepath, "client_id": CLIENT_ID},
            headers={"Authorization": f"Bearer {API_TOKEN}"},
            timeout=10,
        )
        resp.raise_for_status()
        return resp.json()["key"]

    挡板实现: 基于文件路径 hash 生成一个固定密钥，确保同一文件每次获取相同密钥。
    """
    # ================================================================
    # TODO: 替换上面的挡板实现为真实 HTTPS API 调用
    # ================================================================
    hash_val = hashlib.sha256(filepath.encode()).hexdigest()
    return hash_val[:32]  # 32字节密钥 (AES-256)


def fetch_encrypt_key(filepath: str) -> str:
    """
    从 HTTPS API 获取加密密钥（可能与解密密钥相同或不同）。

    TODO: 替换为真实 API 调用，示例：
        import requests
        resp = requests.post(
            "https://api.example.com/v1/encrypt-key",
            json={"file_path": filepath, "client_id": CLIENT_ID},
            headers={"Authorization": f"Bearer {API_TOKEN}"},
            timeout=10,
        )
        resp.raise_for_status()
        return resp.json()["key"]

    挡板实现: 复用 fetch_decrypt_key (对称加密场景)。
    """
    # ================================================================
    # TODO: 替换上面的挡板实现为真实 HTTPS API 调用
    # ================================================================
    return fetch_decrypt_key(filepath)


# ─── 加解密 (挡板) ─────────────────────────────────────────────────

def decrypt_file(encrypted_path: str, key: str) -> str:
    """
    解密文件到临时路径，返回临时文件路径。
    调用方负责在使用后删除临时文件。

    TODO: 替换为真实解密逻辑，示例：
        from cryptography.fernet import Fernet
        with open(encrypted_path, 'rb') as f:
            ciphertext = f.read()
        cipher = Fernet(key.encode() if len(key)==44 else base64.urlsafe_b64encode(key.encode()))
        plaintext = cipher.decrypt(ciphertext)
        tmp = tempfile.NamedTemporaryFile(delete=False, suffix='.xlsx')
        tmp.write(plaintext)
        tmp.close()
        return tmp.name

    挡板实现: base64 解码（模拟"解密"），使得 base64 编码的文件可以被"解密"读取。
    """
    # ================================================================
    # TODO: 替换上面的挡板实现为真实解密逻辑
    # ================================================================
    tmp = tempfile.NamedTemporaryFile(delete=False, suffix=".xlsx")
    try:
        with open(encrypted_path, "rb") as f:
            data = f.read()

        # 挡板: 尝试 base64 解码，如果失败则当作明文直接写入
        try:
            plaintext = base64.b64decode(data)
        except Exception:
            # 不是 base64，直接当明文处理（方便开发测试）
            plaintext = data

        tmp.write(plaintext)
    finally:
        tmp.close()

    return tmp.name


def encrypt_file(source_path: str, key: str) -> str:
    """
    加密文件，返回加密后的文件路径。
    调用方负责在使用后将加密文件移动到目标位置。

    TODO: 替换为真实加密逻辑，示例：
        from cryptography.fernet import Fernet
        with open(source_path, 'rb') as f:
            plaintext = f.read()
        cipher = Fernet(key.encode() if len(key)==44 else base64.urlsafe_b64encode(key.encode()))
        ciphertext = cipher.encrypt(plaintext)
        tmp = tempfile.NamedTemporaryFile(delete=False, suffix='.enc')
        tmp.write(ciphertext)
        tmp.close()
        return tmp.name

    挡板实现: base64 编码（模拟"加密"）。
    """
    # ================================================================
    # TODO: 替换上面的挡板实现为真实加密逻辑
    # ================================================================
    tmp = tempfile.NamedTemporaryFile(delete=False, suffix=".enc")
    try:
        with open(source_path, "rb") as f:
            plaintext = f.read()

        # 挡板: base64 编码
        ciphertext = base64.b64encode(plaintext)
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
