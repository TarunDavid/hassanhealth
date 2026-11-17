"""Envelope encryption: every file gets its own random key; that key is encrypted with a master key
that lives in an environment secret, never in the database or the repository."""
import json
import os
import stat

from cryptography.fernet import Fernet, InvalidToken
from django.conf import settings
from django.core.exceptions import ImproperlyConfigured

_master = None


def master() -> Fernet:
    global _master
    if _master is not None:
        return _master
    key = settings.RECORDS_MASTER_KEY
    if not key:
        if not settings.DEBUG:
            raise ImproperlyConfigured("RECORDS_MASTER_KEY must be set when DJANGO_DEBUG=0")
        # Development only: generate a key once into a gitignored file next to manage.py
        p = settings.BASE_DIR / ".dev_master_key"
        if not p.exists():
            p.write_text(Fernet.generate_key().decode())
            try:
                os.chmod(p, stat.S_IRUSR | stat.S_IWUSR)
            except OSError:
                pass
        key = p.read_text().strip()
    _master = Fernet(key.encode() if isinstance(key, str) else key)
    return _master


def reset_master_for_tests():
    global _master
    _master = None


def encrypt_file(data: bytes) -> tuple[bytes, str]:
    fk = Fernet.generate_key()
    return Fernet(fk).encrypt(data), master().encrypt(fk).decode()


def decrypt_file(ciphertext: bytes, key_enc: str) -> bytes:
    fk = master().decrypt(key_enc.encode())
    return Fernet(fk).decrypt(ciphertext)


def encrypt_json(obj) -> str:
    return master().encrypt(json.dumps(obj, ensure_ascii=False).encode()).decode()


def decrypt_json(token: str):
    try:
        return json.loads(master().decrypt(token.encode()))
    except InvalidToken:
        return {}
