
from db.conexao         import executar_query

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

def atualizar_carne():
    boleto = atualizar_vendas()
    clientes = [(row['cliente'].split()[0], row['id_lote']) for row in boleto]

    if not clientes:
        return 0
    
    placeholders = ','.join(["(%s, %s)"] * len(clientes))
    params = [x for par in clientes for x in par]

    query_parcelas = f'''
        SELECT 
            cc.numped,
            cc.codcli
        FROM contasareceber cc
        JOIN cadcli c ON cc.codcli = c.codcli
        JOIN lot_controle_contrato lcc ON lcc.id_lote = cc.numped AND lcc.codcli = cc.codcli
        WHERE (cc.codcli, cc.numped) IN ({placeholders})
            AND cc.parcela BETWEEN 1 AND 12
            AND cc.boleto_nosso_numero IS NOT NULL
            AND lcc.tipo_especial = 'V'
            AND lcc.user_etq_entrada_paga IS NULL
            AND lcc.dt_etq_entrada_paga IS NULL
        GROUP BY cc.numped, cc.codcli, c.razao
        '''

    resultado = executar_query(query_parcelas, params)

    boleto = [(row['numped'], row['codcli']) for row in resultado]
    print(boleto)
    if boleto:
        query = f'''
            UPDATE lot_controle_contrato
            SET user_etq_entrada_paga = %s,
                dt_etq_entrada_paga = NOW()
            WHERE id_lote = %s
            AND codcli  = %s
            AND user_etq_entrada_paga IS NULL
            AND dt_etq_entrada_paga IS NULL
        '''

        dados = [(40, id_lote, codcli) for (id_lote, codcli) in boleto]
        resultado = executar_query(query, dados)

def inicializacao_kanban():
    atualizar = '''
        INSERT INTO lot_controle_contrato (id_lote, codcli, TIPO_ESPECIAL, codvendedor, data_compra)
        SELECT ll.id, ll.codcli, ll.situacao, ll.codvendedor, ll.data_compra
        FROM lot_lotes ll
        WHERE ll.situacao = 'V'
          AND ll.data_compra >= '2025-05-01'
          AND NOT EXISTS (
              SELECT 1 FROM lot_controle_contrato lcc
              WHERE lcc.id_lote = ll.id and lcc.codcli = ll.codcli
          );
    '''
    executar_query(atualizar)

def limpar_nova_venda():
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
    executar_query(limpar)

def query_base():
    selecao  = (
        ''' concat(c.codcli, " - ", c.razao) as cliente,
            c.codcli, 
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
            le.fantasia,
            lv.nome AS nome_vendedor, 
            c.dtcadastro,
            lcc.*,''')
    
    colunas = (
    ''' JOIN cadcli c 
            ON ll.CODCLI = c.CODCLI
        JOIN lot_empreendimento le  
            ON ll.ID_EMPREENDIMENTO = le.ID
        JOIN lot_vendedores lv2 
            ON c.rca = lv2.login 
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
            ON lcc.USER_ETQ_RETIRADA = autenticado.login''')

    return selecao, colunas


def atualizar_vendas():
    selecao, colunas = query_base()
    query = f'''
        SELECT 
            {selecao}
            ll.quadra,
            ll.lote,
            ll.parte,
            case when c2.parcela = 0 then c2.valorpago else 0 end as entrada
        FROM lot_lotes ll
        LEFT JOIN contasareceber c2
        	ON c2.numped = ll.id
        JOIN lot_controle_contrato lcc  
            ON ll.ID = lcc.ID_lote 
        {colunas}
        WHERE ( 
            lcc.data_entregue IS null and not
            (ll.codcli = 15 AND ll.codvendedor = 4) and not ll.codcli = 15 and not ll.situacao <> 'V'
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
        ORDER BY ll.DATA_COMPRA ASC '''
    consulta = executar_query(query)
    resultado = contratos(consulta)
    return resultado

def bloqueados():
    query = '''
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
    '''
    resultado = executar_query(query)
    return resultado

def badges():
    clientes = atualizar_vendas()

    clientes = [row['ID'] for row in clientes]

    if not clientes:
        return []

    placeholders = ",".join(["%s"] * len(clientes))
    params = clientes

    query = f"""
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
        WHERE id IN ({placeholders})
    """

    rows = executar_query(query, params)

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

    return resultado

def consultar_lote(id_lote):
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

    row = executar_query(query, (id_lote,))

    return row

def observacao(obs, id_kanban):
    query = '''
        UPDATE lot_controle_contrato lcc
            SET OBS = %s
            WHERE id = %s
    '''
    linhas = executar_query(query, (obs, id_kanban))

    return linhas > 0

def atualizar_coluna(set_parts, params, id_lote):
    query = f'''
        UPDATE lot_controle_contrato lcc
            SET {', '.join(set_parts)}
            WHERE id = %s
    '''

    params.append(id_lote)
    linha = executar_query(query, tuple(params))

    return linha > 0

def finalizados():
    selecao, colunas = query_base()
    query =  f'''
            SELECT
            {selecao}
            COALESCE(ll.quadra, lll.quadra) as quadra, 
            coalesce(ll.lote, lll.lote) as lote,
            ll.parte,
            ll.data_compra, 
            ll.codvendedor
        FROM lot_controle_contrato lcc
        LEFT JOIN lot_lotes ll  
            ON ll.ID = lcc.ID_lote
        left join lot_lotes_logs lll 
        	on lcc.id_lote = lll.id
        	and lll.CODCLI = lcc.codcli
        	and lll.SITUACAO = 'V'
        {colunas}
        where lcc.DATA_ENTREGUE is not null 
        '''
    consulta = executar_query(query)
    resultado = contratos(consulta)
    return resultado

def criar_contrato(tipo, id_lote, codcli, usuario):
    query = ('''
        INSERT INTO lot_controle_contrato
            (id_lote, codcli, TIPO_ESPECIAL, codvendedor, data_compra)
        VALUES (%s, %s, %s, %s, NOW())
    ''')

    params = (tipo, id_lote, codcli, usuario)
    resultado = executar_query(query, params)

    return resultado > 0

def contratos(consulta):
    resultado = []
    for i in consulta:
        resultados = {
           'id': i['ID'],
           'id_lote': i['ID_LOTE'],
           'lote': None,
           'cliente': i['cliente'],
           'tipo_contrato': i['TIPO_ESPECIAL'],
           'entrada': 0.00,
           'fantasia': i['fantasia'],
           'dt_compra': i['data_compra'],
           'cadastro': {
               'user': f"{i['rca']} - {i['nome_usuario']}",
               'data': i['dtcadastro']
               },
           'vendedor': f"{i['codvendedor']} - {i['nome_vendedor']}",
           'colunas': {},
           'badges':{},
           'obs': i['OBS']
        }

        if i.get('parte') != 0 and i.get('parte'):
            resultados['lote'] = f'{i['quadra']}-{i['lote']:02}/{i['parte']}'
        else:
            resultados['lote'] = f'{i['quadra']}-{i['lote']:02}'

        if i.get('entrada') and i.get('TIPO_ESPECIAL') == 'V':
            resultados['entrada'] = i['entrada']

        if i.get('USER_ENTRADA_PAGA'):
            resultados['colunas']['assinado-cliente'] = {
                    'user': i['USER_ENTRADA_PAGA'],
                    'data': i['DATA_ENTRADA_PAGA']
                }
        
        if i.get('USER_RETIRADA'):
            resultados['colunas']['aguardando-retirada'] ={
                    'user': i['USER_RETIRADA'],
                    'data': i['DATA_RETIRADA']
                }
        
        if i.get('USER_ENTREGUE'):
            resultados['colunas']['entregue'] = {
                    'user': f"{i['USER_ENTREGUE']} - {i['nome_entregue']}",
                    'data': i['DATA_ENTREGUE']
                }

        if i.get('USER_ETQ_ASSINATURA_DIRETOR'):
            resultados['badges']['digitalizado'] = {
                    'user': f"{i['USER_ETQ_ASSINATURA_DIRETOR']} - {i['nome_digitalizado']}",
                    'data': i['DT_ETQ_ASSINATURA_DIRETOR']
                }
            
        if i.get('USER_ETQ_ENTREGUE'):
            resultados['badges']['pagamento-OK'] = {
                    'user': f"{i['USER_ETQ_ENTREGUE']} - {i['nome_pagamento']}",
                    'data': i['DT_ETQ_ENTREGUE']
                }
        
        if i.get('USER_ETQ_ENTRADA_PAGA'):
            resultados['badges']['carne-gerado']  ={
                    'user': f"{i['USER_ETQ_ENTRADA_PAGA']} - {i['nome_carne']}",
                    'data': i['DT_ETQ_ENTRADA_PAGA']  
               }

        if i.get('USER_ETQ_RETIRADA'):
            resultados['badges']['autenticado'] = {
                    'user': f"{i['USER_ETQ_RETIRADA']} - {i['nome_autenticado']}",
                    'data': i['DT_ETQ_RETIRADA']  
               }
            
        if i.get('USER_IMPRESSO'):   
            resultados['badges']['impresso'] = {
                    'user': f"{i['USER_IMPRESSO']} - {i['nome_impresso']}",
                    'data': i['DATA_IMPRESSO']  
               }
       
        if i.get('USER_ASSINATURA_DIRETOR'):
            resultados['badges']['contrato-fisico'] = {
                        'user': f"{i['USER_ASSINATURA_DIRETOR']} - {i['nome_fisico']}",
                        'data': i['DATA_ASSINATURA_DIRETOR']  
        }
            
        if i.get('USER_CONTRATO_DIGITAL'):
            resultados['badges']['contrato-digital'] = {
                        'user': f"{i['USER_CONTRATO_DIGITAL']} - {i['nome_digital']}",
                        'data': i['DATA_CONTRATO_DIGITAL'] 
        }    
                       
        resultado.append(resultados)
    
    return resultado
