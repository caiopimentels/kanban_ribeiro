from flask          import Flask, jsonify, request, g
from flask_cors     import CORS
import mysql.connector, logging, os, base64, hmac, hashlib, time
from rotas.rotas import *

logging.basicConfig(level=logging.DEBUG)

app = Flask(__name__)
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
    '''
    conn = get_connection()
    cursor = conn.cursor(dictionary=True)
    '''
    query = '''
        SELECT 
            ll.codcli, 
            c.razao, 
            c.rca,
            lv2.nome AS nome_usuario,
            autenticado.nome AS nome_autenticado,
            pagamento.nome AS nome_pagamento,
            carne.nome AS nome_carne,
            digitalizado.nome AS nome_digitalizado,
            entregue.nome AS nome_entregue,
            fisico.nome AS nome_fisico,
            digital.nome AS nome_digital,
            impresso.nome AS nome_impresso,
            c.dtcadastro,
            COALESCE(ll.quadra, lll.quadra) as quadra, 
            coalesce(ll.lote, lll.lote) as lote, 
            ll.data_compra, 
            ll.codvendedor,
            ll.parte,
            lv.nome AS nome_vendedor, 
            le.fantasia,
            lcc.*
        FROM lot_controle_contrato lcc
        LEFT JOIN lot_lotes ll  
            ON ll.ID = lcc.ID_lote
        left join lot_lotes_logs lll 
        	on lcc.id_lote = lll.id
        	and lll.CODCLI = lcc.codcli
        	and lll.SITUACAO = 'V'
        JOIN cadcli c 
            ON  c.CODCLI = lcc.CODCLI
        left JOIN lot_empreendimento le  
            ON ll.ID_EMPREENDIMENTO = le.ID
        JOIN lot_vendedores lv 
            ON lcc.CODVENDEDOR = lv.login 
        JOIN lot_vendedores lv2 
            ON c.rca = lv2.login 
        LEFT JOIN lot_vendedores entregue 
            ON lcc.USER_ENTREGUE = entregue.login
        LEFT JOIN lot_vendedores carne 
            ON lcc.USER_ETQ_ENTRADA_PAGA = carne.login
        LEFT JOIN lot_vendedores pagamento 
            ON lcc.USER_ETQ_ENTREGUE = pagamento.login
        LEFT JOIN lot_vendedores digitalizado 
            ON lcc.USER_ETQ_ASSINATURA_DIRETOR = digitalizado.login
        LEFT JOIN lot_vendedores fisico 
            ON lcc.USER_ASSINATURA_DIRETOR = fisico.login
        LEFT JOIN lot_vendedores digital 
            ON lcc.USER_CONTRATO_DIGITAL = digital.login
        LEFT JOIN lot_vendedores impresso 
            ON lcc.USER_IMPRESSO = impresso.login
        LEFT JOIN lot_vendedores autenticado 
            ON lcc.USER_ETQ_RETIRADA = autenticado.login
        where lcc.DATA_ENTREGUE is not null 
        '''
    '''
    cursor.execute(query)
    results = cursor.fetchall()
    return jsonify(results)'''

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

    '''
    conn = get_connection()
    cursor = conn.cursor()

    cursor.execute("""
        INSERT INTO lot_controle_contrato
            (id_lote, codcli, TIPO_ESPECIAL, codvendedor, data_compra)
        VALUES (%s, %s, %s, %s, NOW())
    """, (id_lote, codcli, tipo, usuario))

    conn.commit()
    cursor.close()
    conn.close()

    return jsonify({"message": "Contrato especial criado com sucesso"}), 201'''

if __name__ == '__main__':
    app.run(debug=True, host='0.0.0.0', port=5010)

