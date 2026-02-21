from flask          import Flask, jsonify, request
from flask_cors     import CORS
from rotas.rotas    import *
from db.securety    import require_auth

app = Flask(__name__)
app.json.sort_keys = False
app.json.ensure_ascii = False
CORS(app, resources={r"/*": {"origins": "*"}})

etapas = etapas()

@app.route('/vendas')
@require_auth
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
@require_auth
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

    if resultado > 0:
        return jsonify({"success": True}), 200
    else:
        return jsonify({"error": "Nenhuma linha atualizada"}), 400

@app.route('/entregues/finalizados')
@require_auth
def contratos_finalizados():
    results = finalizados()
    return jsonify(results)

@app.route('/consulta', methods=['POST'])
@require_auth
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
@require_auth
def salvar_observacao():
    try:
        dados = request.json

        id_kanban = dados.get("id_lote")
        texto_obs = dados.get("observacao", "").strip()

        if not id_kanban:
            return jsonify({"error": "id_lote não informado"}), 400

        observacao(texto_obs, id_kanban)

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
@require_auth
def criar_contrato_especial():
    data = request.get_json(force=True) or {}

    tipo = data.get("tipo")
    id_lote = data.get("id_lote")
    codcli = data.get("codcli")
    usuario = data.get("usuario") 

    if not all([tipo, id_lote, codcli, usuario]):
        return jsonify({"error": "Dados incompletos"}), 400

    resultado = criar_contrato(tipo, id_lote, codcli, usuario)

    if resultado:
        return jsonify({"message": "Contrato especial criado com sucesso"}), 201

if __name__ == '__main__':
    app.run(debug=True, host='0.0.0.0', port=5010)

