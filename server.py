from flask          import Flask, jsonify, request, g
from flask_cors     import CORS
import mysql.connector, logging, os, base64, hmac, hashlib, time
from rotas.rotas import *

logging.basicConfig(level=logging.DEBUG)

app = Flask(__name__)
app.json.sort_keys = False
app.json.ensure_ascii = False
CORS(app)

'''
TOKEN_LEEWAY = 60
BASE_PATH = os.path.dirname(os.path.dirname(os.path.dirname(__file__)))
SECRET_PATH = os.getenv('SECRET_PATH')

with open(SECRET_PATH, "r") as f:
    KANBAN_SECRET = f.read().strip()

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
'''

@app.route('/vendas')
#@require_auth
def get_vendas():

    limpar_nova_venda()
    inicializacao_kanban()
    atualizar_carne()

    results = atualizar_vendas()

    return jsonify(results)


@app.route('/bloqueado')
#@require_auth
def bloqueado():

    results = bloqueados()
    return jsonify(results)


@app.route('/atualizar', methods=['POST'])
#@require_auth
def atualizar_kanban():
    data = request.get_json(force=True)

    etapa = data.get("etapa")
    usuario = data.get("usuario")
    id_lote = data.get("id_lote")
    
    ordem_etapas = ['contrato-gerado', 'entrada-paga', 'aguardando-retirada', 'entregue']

    if not isinstance(etapa, str) or etapa not in etapas:
        return jsonify({"error": f"Etapa inválida: {etapa}"}), 400

    if not usuario or not id_lote:
        return jsonify({"error": "usuario e id_lote são obrigatórios"}), 400

    col_user_dest, col_data_dest = etapas[etapa]

    set_parts = [f"{col_user_dest} = %s", f"{col_data_dest} = NOW()"]
    params = [usuario]

    resultado = atualizar_coluna(set_parts, params, id_lote)

    return resultado > 0

@app.route('/badges')
#@require_auth
def get_badges():
    
    results = badges()
    return jsonify(results)

@app.route('/entregues/finalizados')
#@require_auth
def contratos_finalizados():
    results = finalizados()

    return jsonify(results)

@app.route('/consulta', methods=['POST'])
#@require_auth
def consulta_contrato():
    data = request.get_json(force=True) or {}
    id_lote = data.get("id_lote")

    if not id_lote:
        return jsonify({"error": "id_lote é obrigatório"}), 400

    row = consultar_lote(id_lote)

    if not row:
        return jsonify({"error": "Lote não encontrado"}), 404

    return jsonify(row), 200


@app.route('/observacao', methods=['POST'])
#@require_auth
def salvar_observacao():
    try:
        dados = request.json

        id_kanban = dados.get("id_lote")
        observacao = dados.get("observacao", "").strip()

        if not id_kanban:
            return jsonify({"error": "id_lote não informado"}), 400

        observacao(observacao, id_kanban)

        return jsonify({
            "status": "ok",
            "mensagem": "Observação salva com sucesso",
            "id_lote": id_kanban,
            "observacao": observacao
        }), 200

    except Exception as e:
        print("Erro /observacao:", e)
        return jsonify({"error": str(e)}), 500


@app.route('/criar-especial', methods=['POST'])
#@require_auth
def criar_contrato_especial():
    data = request.get_json(force=True) or {}

    tipo = data.get("tipo")
    id_lote = data.get("id_lote")
    codcli = data.get("codcli")
    usuario = data.get("usuario") 

    if not all([tipo, id_lote, codcli, usuario]):
        return jsonify({"error": "Dados incompletos"}), 400

    resultado = criar_contrato()

    if resultado:
        return jsonify({"message": "Contrato especial criado com sucesso"}), 201

if __name__ == '__main__':
    app.run(debug=True, host='0.0.0.0', port=5010)

