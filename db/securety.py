import mysql.connector, logging, os, base64, hmac, hashlib, time
from flask          import Flask, jsonify, request, g

TOKEN_LEEWAY = 60
KANBAN_SECRET = os.getenv('SECRET_PATH')


def base64url_decode(data: str) -> bytes:
    padding = '=' * (-len(data) % 4)
    return base64.urlsafe_b64decode(data + padding)

def verify_token(token: str):
    try:
        payload_b64, sig_b64 = token.split('.', 1)
    except ValueError:
        print("Token sem ponto:", token)
        return None

    try:
        payload_bytes = base64url_decode(payload_b64)
        sig_bytes     = base64url_decode(sig_b64)
    except Exception as e:
        print("Erro base64:", e)
        return None

    payload = payload_bytes.decode('utf-8', errors='ignore').strip()
    if not payload:
        print("Payload vazio")
        return None

    try:
        user_id_str, exp_str = payload.split(':', 1)
        user_id = int(user_id_str)
        exp     = int(exp_str)
    except ValueError:
        print("Payload inválido:", payload)
        return None

    expected_sig = hmac.new(
        KANBAN_SECRET.encode('utf-8'),
        payload_bytes,
        hashlib.sha256
    ).digest()

    if not hmac.compare_digest(expected_sig, sig_bytes):
        print("Assinatura inválida")
        return None

    agora = int(time.time())
    if agora > exp + TOKEN_LEEWAY:
        print(f"Token expirado para user_id={user_id}, exp={exp}, agora={agora}")
        return None

    print(f"Token OK para user_id={user_id}, expira_em={exp}")
    return user_id

def require_auth(f):
    from functools import wraps

    @wraps(f)
    def wrapper(*args, **kwargs):
        auth_header = request.headers.get("Authorization", "")
        if not auth_header.startswith("Bearer "):
            return jsonify({"error": "Token de autorizacao ausente ou invalido"}), 402

        token = auth_header[len("Bearer "):].strip()
        user_id = verify_token(token)
        if not user_id:
            return jsonify({"error": "Token Invalido"}), 401

        g.user_id = user_id
        return f(*args, **kwargs)

    return wrapper
