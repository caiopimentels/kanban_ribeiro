from flask          import Flask, jsonify, request, g
from flask_cors     import CORS
import mysql.connector, logging, os, base64, hmac, hashlib, time

logging.basicConfig(level=logging.DEBUG)

app = Flask(__name__)
CORS(app)

TOKEN_LEEWAY = 60
BASE_PATH = os.path.dirname(os.path.dirname(os.path.dirname(__file__)))
SECRET_PATH = os.path.join(BASE_PATH, "kanban_secret.key")

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

def get_connection():
    return mysql.connector.connect(
    host='192.168.1.5',
    user='caio',
    password='Ca$io2024',
    database='sislote'
)

etapas = {
    "assinado-cliente": ("USER_ENTRADA_PAGA", "DATA_ENTRADA_PAGA"),
    "aguardando-retirada": ("USER_RETIRADA", "DATA_RETIRADA"),
    "entregue": ("USER_ENTREGUE", "DATA_ENTREGUE"),
    "Digitalizado": ("USER_ETQ_ASSINATURA_DIRETOR", "DT_ETQ_ASSINATURA_DIRETOR"),
    "Pagamento-OK": ("USER_ETQ_ENTREGUE", "DT_ETQ_ENTREGUE"),
    "Carne-Gerado": ("USER_ETQ_ENTRADA_PAGA", "DT_ETQ_ENTRADA_PAGA"),
    "Autenticado": ("USER_ETQ_RETIRADA", "DT_ETQ_RETIRADA"),
    "Fisico":  ("USER_ASSINATURA_DIRETOR", "DATA_ASSINATURA_DIRETOR"),
    "Digital": ("USER_CONTRATO_DIGITAL", "DATA_CONTRATO_DIGITAL"),
    "Impresso": ("USER_IMPRESSO", "DATA_IMPRESSO"),
}

@app.route('/vendas')
@require_auth
def get_vendas():
    conn = get_connection()
    cursor = conn.cursor(dictionary=True)
    query = """
            SELECT 
            lcc.id,
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
            ll.quadra, 
            ll.lote, 
            ll.parte, 
            lv.nome AS nome_vendedor, 
            le.fantasia,
            case when c2.parcela = 0 then c2.valorpago else 0 end as entrada,
            lcc.*
        FROM lot_lotes ll
        LEFT JOIN contasareceber c2
        	ON c2.numped = ll.id 
        JOIN cadcli c 
            ON ll.CODCLI = c.CODCLI
        JOIN lot_empreendimento le  
            ON ll.ID_EMPREENDIMENTO = le.ID
        JOIN lot_vendedores lv2 
            ON c.rca = lv2.login 
        JOIN lot_controle_contrato lcc  
            ON ll.ID = lcc.ID_lote 
        JOIN lot_vendedores lv 
            ON lcc.codvendedor = lv.login 
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
        WHERE ( 
            lcc.data_entregue IS null and not
            (ll.codcli = 15 AND ll.codvendedor = 4)
            )
        OR (
            lcc.DATA_ENTREGUE IS NOT NULL 
            AND (      lcc.DT_ETQ_ENTRADA_PAGA IS NULL
                    OR lcc.DT_ETQ_ASSINATURA_DIRETOR IS NULL
                    OR lcc.DT_ETQ_RETIRADA IS NULL
                    OR lcc.DT_ETQ_ENTREGUE IS NULL
                    OR lcc.OBS IS NULL
                    OR lcc.OBS = ''
                    OR CHAR_LENGTH(TRIM(lcc.OBS)) < 8)
            )
        GROUP BY c.CODCLI, ll.id
        ORDER BY ll.DATA_COMPRA ASC
    """
    inicializar_kanban()

    cursor.execute(query)
    results = cursor.fetchall()
    

    cursor.close()
    conn.close()
    return jsonify(results)


@app.route('/bloqueado')
@require_auth
def bloqueado():
    conn = get_connection()
    cursor = conn.cursor(dictionary=True)
    query = """
        select ll.id,
               ll.codcli,
               c.razao,
               c.rca,
               lv2.nome AS nome_usuario,
               ll.datasituacao,
               ll.quadra,
               ll.lote,
               ll.data_compra,
               ll.codvendedor,
               lv.nome AS nome_vendedor,
               ll.parte,
               le.fantasia
        from lot_lotes ll
        join cadcli c on ll.CODCLI = c.CODCLI
        join lot_empreendimento le  on ll.ID_EMPREENDIMENTO = le.ID
        join lot_vendedores lv on ll.CODVENDEDOR = lv.login
        join lot_vendedores lv2 on c.rca = lv2.login
        where ll.SITUACAO = 'B' and not
        	  (ll.CODCLI = 15  and ll.codvendedor = 4) and ll.PARTE <> 99
       	order by ll.datasituacao asc
    """
    cursor.execute(query)
    results = cursor.fetchall()
    return jsonify(results)
    cursor.close()
    conn.close()

@app.route('/inicializar-kanban')
@require_auth
def inicializar_kanban():
    conn = get_connection()
    cursor = conn.cursor()

    atualizar = '''
        INSERT INTO lot_controle_contrato (id_lote, codcli, TIPO_ESPECIAL, codvendedor, data_compra)
        SELECT ll.id, ll.codcli, ll.situacao, ll.codvendedor, ll.data_compra
        FROM lot_lotes ll
        WHERE ll.situacao = 'V'
          AND ll.data_compra >= '2025-05-01'
          AND NOT EXISTS (
              SELECT 1 FROM lot_controle_contrato lcc
              WHERE lcc.id_lote = ll.id
          );
    '''

    limpar = '''
        UPDATE lot_controle_contrato lcc
        JOIN lot_lotes ll ON ll.id = lcc.id_lote
        SET
          lcc.codcli                        = ll.codcli,
          lcc.codvendedor                   = NULL,
          lcc.data_compra                   = NULL,
          lcc.USER_ENTRADA_PAGA             = NULL,
          lcc.DATA_ENTRADA_PAGA             = NULL,
          lcc.USER_RETIRADA                 = NULL,
          lcc.DATA_RETIRADA                 = NULL,
          lcc.USER_ENTREGUE                 = NULL,
          lcc.DATA_ENTREGUE                 = NULL,
          lcc.USER_ETQ_ASSINATURA_DIRETOR   = NULL,
          lcc.DT_ETQ_ASSINATURA_DIRETOR     = NULL,
          lcc.USER_ETQ_ENTREGUE             = NULL,
          lcc.DT_ETQ_ENTREGUE               = NULL,
          lcc.USER_ETQ_ENTRADA_PAGA         = NULL,
          lcc.DT_ETQ_ENTRADA_PAGA           = NULL,
          lcc.USER_ETQ_RETIRADA             = NULL,
          lcc.DT_ETQ_RETIRADA               = NULL,
          lcc.USER_ASSINATURA_DIRETOR       = NULL,
          lcc.DATA_ASSINATURA_DIRETOR       = NULL,
          lcc.USER_CONTRATO_DIGITAL         = NULL,
          lcc.DATA_CONTRATO_DIGITAL         = NULL,
          lcc.USER_IMPRESSO                 = NULL,
          lcc.DATA_IMPRESSO                 = NULL
        WHERE
          lcc.TIPO_ESPECIAL = 'V' AND (
          (lcc.codcli IS NULL AND ll.codcli IS NOT NULL)
          OR (lcc.codcli IS NOT NULL AND ll.codcli IS NOT NULL AND lcc.codcli <> ll.codcli)
          );
    '''

    cursor.execute(atualizar)
    cursor.execute(limpar)
    conn.commit()


@app.route('/atualizar', methods=['POST'])
@require_auth
def atualizar_kanban():
    data = request.get_json(force=True)
    app.logger.debug(f"DEBUG /atualizar recebido: {data}")

    etapa = data.get("etapa")
    usuario = data.get("usuario")
    id_lote = data.get("id_lote")
    limpar_frente = bool(data.get("limpar_frente"))

    ordem_etapas = ['contrato-gerado', 'entrada-paga', 'aguardando-retirada', 'entregue']

    if not isinstance(etapa, str) or etapa not in etapas:
        return jsonify({"error": f"Etapa inválida: {etapa}"}), 400

    if not usuario or not id_lote:
        return jsonify({"error": "usuario e id_lote são obrigatórios"}), 400

    col_user_dest, col_data_dest = etapas[etapa]

    # monta SET dinâmico
    set_parts = [f"{col_user_dest} = %s", f"{col_data_dest} = NOW()"]
    params = [usuario]

    if limpar_frente:
        try:
            idx_dest = ordem_etapas.index(etapa)
        except ValueError:
            return jsonify({"error": "Etapa não está na ordem canônica"}), 400

        etapas_a_frente = ordem_etapas[idx_dest+1:]
        for et in etapas_a_frente:
            if et in etapas:
                col_u, col_d = etapas[et]
                set_parts.append(f"{col_u} = NULL")
                set_parts.append(f"{col_d} = NULL")

    query = f"UPDATE lot_controle_contrato SET {', '.join(set_parts)} WHERE id = %s"
    params.append(id_lote)

    conn = get_connection()
    cursor = conn.cursor()
    cursor.execute(query, tuple(params))
    conn.commit()
    cursor.close()
    conn.close()

    return jsonify({"message": "Etapa atualizada com sucesso"})

@app.route('/badges')
@require_auth
def get_badges():
    conn = get_connection()
    cursor = conn.cursor(dictionary=True)

    query = """
       SELECT
            id as id_lote,
            USER_ENTRADA_PAGA,
            USER_ASSINATURA_DIRETOR,
            USER_CONTRATO_DIGITAL,
            USER_RETIRADA,
            USER_ENTREGUE,
            USER_ETQ_ENTRADA_PAGA,
            USER_ETQ_ASSINATURA_DIRETOR,
            USER_ETQ_RETIRADA,
            USER_ETQ_ENTREGUE,
            USER_IMPRESSO
        FROM lot_controle_contrato
    """

    cursor.execute(query)
    rows = cursor.fetchall()

    resultado = []
    for row in rows:
        badges = []
        
        if row["USER_ETQ_ENTRADA_PAGA"]:
            badges.append("Carne-Gerado")
        if row["USER_ETQ_ASSINATURA_DIRETOR"]:
            badges.append("Digitalizado")
        if row["USER_ETQ_RETIRADA"]:
            badges.append("Autenticado")
        if row["USER_ETQ_ENTREGUE"]:
            badges.append("Pagamento-OK")
        if row["USER_ASSINATURA_DIRETOR"]:
            badges.append("Fisico")
        if row["USER_CONTRATO_DIGITAL"]:
            badges.append("Digital")
        if row["USER_IMPRESSO"]:
            badges.append("Impresso")

        resultado.append({
            "id_lote": row["id_lote"],
            "badges": badges
        })

    return jsonify(resultado)

@app.route('/entregues/finalizados')
@require_auth
def contratos_finalizados():
    conn = get_connection()
    cursor = conn.cursor(dictionary=True)
    
    query = '''
SELECT 
            lcc.id, 
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
    cursor.execute(query)
    results = cursor.fetchall()
    return jsonify(results)

@app.route('/consulta', methods=['POST'])
@require_auth
def consulta_contrato():
    data = request.get_json(force=True) or {}
    id_lote = data.get("id_lote")

    if not id_lote:
        return jsonify({"error": "id_lote é obrigatório"}), 400

    conn = get_connection()
    cursor = conn.cursor(dictionary=True)

    query = '''
        SELECT  
            ll.codcli,
            ll.quadra,
            ll.lote,
            c.razao as nome,
            ll.parte,
            le.FANTASIA as empreendimento
        FROM lot_lotes ll
        join cadcli c on c.codcli = ll.codcli
        join lot_empreendimento le on le.id = ll.ID_EMPREENDIMENTO 
        where ll.id = %s
    '''

    cursor.execute(query, (id_lote,))
    row = cursor.fetchone()

    cursor.close()
    conn.close()

    if not row:
        return jsonify({"error": "Lote não encontrado"}), 404

    return jsonify(row), 200


@app.route('/observacao', methods=['POST'])
@require_auth
def salvar_observacao():
    try:
        dados = request.json

        id_lote = dados.get("id_lote")
        observacao = dados.get("observacao", "").strip()

        if not id_lote:
            return jsonify({"error": "id_lote não informado"}), 400

        conn = get_connection()
        cursor = conn.cursor()

        sql = """
            UPDATE lot_controle_contrato lcc
               SET OBS = %s
             WHERE id = %s
        """
        cursor.execute(sql, (observacao, id_lote))
        conn.commit()
        cursor.close()
        conn.close()

        return jsonify({
            "status": "ok",
            "mensagem": "Observação salva com sucesso",
            "id_lote": id_lote,
            "observacao": observacao
        })

    except Exception as e:
        print("Erro /observacao:", e)
        return jsonify({"error": str(e)}), 500


@app.route('/criar-especial', methods=['POST'])
@require_auth
def criar_contrato_especial():
    data = request.get_json(force=True) or {}

    tipo = data.get("tipo")
    id_lote = data.get("id_lote")
    codcli = data.get("codcli")
    usuario = data.get("usuario") 

    if not all([tipo, id_lote, codcli, usuario]):
        return jsonify({"error": "Dados incompletos"}), 400

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

    return jsonify({"message": "Contrato especial criado com sucesso"}), 201

if __name__ == '__main__':
    app.run(debug=False,host='0.0.0.0', port=5010)

