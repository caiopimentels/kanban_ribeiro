from flask          import Flask, jsonify, request, Response, stream_with_context
from flask_cors     import CORS
from rotas.rotas    import *
from db.securety    import require_auth
from d4sign_service import enviar_para_d4sign
import os, json

app = Flask(__name__)
app.json.sort_keys = False
app.json.ensure_ascii = False
CORS(app, resources={r"/*": {"origins": "*"}})

etapas = etapas()

COFRES = json.loads(os.getenv("COFRES_JSON", "{}") or "{}")

def resolve_uuid_safe(cofre_key: str) -> str | None:
    info = COFRES.get(cofre_key)
    if not info:
        return None
    return info.get("uuid_safe")

@app.route('/vendas')
@require_auth
def get_vendas():

    limpar_nova_venda()
    inicializacao_kanban()

    results = atualizar_vendas()
    atualizar_carne(results)

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

        sucesso = observacao(texto_obs, id_kanban)

        return jsonify({
            "status": "ok",
            "mensagem": "Observação salva com sucesso",
            "id_lote": id_kanban,
            "observacao": texto_obs,
            "atualizado": bool(sucesso)
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


from flask import Response, stream_with_context
import json

@app.route('/d4sign/enviar', methods=['POST'])
def d4sign_enviar():
    def emit(pct, msg, extra=None):
        data = {"type": "progress", "pct": pct, "msg": msg}
        if extra: data.update(extra)
        return (json.dumps(data, ensure_ascii=False) + "\n").encode("utf-8")

    @stream_with_context
    def gen():
        try:
            yield emit(5, "Recebendo arquivo e validações...")

            pdf_file = request.files['pdf']
            payload = {
                "id_lote": (request.form.get('id_lote') or '').strip(),
                "codvendedor": (request.form.get('codvendedor') or '').strip(),
                "cliente_nome": (request.form.get('cliente_nome') or '').strip(),
                "lote": (request.form.get('lote') or '').strip(),
                "vendedor_email": (request.form.get('vendedor_email') or '').strip(),
                "compradores_emails": (request.form.get('compradores_emails') or '').strip(),
                "cofre_key": (request.form.get('cofre_key') or '').strip(),
            }

            yield emit(10, "Resolvendo cofre...")
            yield emit(11, "DEBUG cofres", {
                "cofre_key_recebido": payload["cofre_key"],
                "cofres_keys": list(COFRES.keys()),
                "cofres_len": len(COFRES)
            })
            uuid_safe = resolve_uuid_safe(payload["cofre_key"])
            if not uuid_safe:
                yield (json.dumps({"type":"result","ok":False,"error":"Cofre inválido."})+"\n").encode("utf-8")
                return
            payload["uuid_safe"] = uuid_safe

            # ↓↓↓ aqui você chama uma versão do envio que também "emite" etapas ↓↓↓
            def on_step(pct, msg, extra=None):
                # repassa pro stream
                nonlocal_yield.append(emit(pct, msg, extra))

            # truque pra conseguir yield dentro do callback
            nonlocal_yield = []
            def flush_steps():
                while nonlocal_yield:
                    yield nonlocal_yield.pop(0)

            yield emit(20, "Salvando PDF...")
            # dentro do enviar_para_d4sign, você chama callback por etapa
            result = enviar_para_d4sign(pdf_file, payload, step_cb=lambda p,m,e=None: nonlocal_yield.append(emit(p,m,e)))

            # flush do que ficou pendente
            yield from flush_steps()

            if not result.get("ok"):
                yield (json.dumps({"type":"result","ok":False,"error":result.get("error")})+"\n").encode("utf-8")
                return

            yield emit(100, "Concluído!", {"uuid_doc": result.get("uuid_doc")})
            yield (json.dumps({"type":"result","ok":True, **result})+"\n").encode("utf-8")

        except Exception as e:
            yield (json.dumps({"type":"result","ok":False,"error":str(e)})+"\n").encode("utf-8")

    return Response(gen(), mimetype="application/x-ndjson")


if __name__ == '__main__':
    app.run(debug=True, host='0.0.0.0', port=5010)

