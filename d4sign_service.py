import os
import re
import uuid
import json
from io import BytesIO
from pathlib import Path
from datetime import datetime
from typing import Any, Dict, List, Tuple

import fitz  # PyMuPDF
import requests
from dotenv import load_dotenv


# ============================================================
# D4Sign - Serviço (sem servidor separado)
#
# Este arquivo é a parte "útil" do antigo projeto de assinatura.
# Ele é chamado pela rota /d4sign/enviar do próprio Kanban.
# ============================================================

BASE_DIR = Path(__file__).resolve().parent
UPLOAD_DIR = BASE_DIR / "d4sign_uploads"
LOG_DIR = BASE_DIR / "d4sign_logs"
UPLOAD_DIR.mkdir(exist_ok=True)
LOG_DIR.mkdir(exist_ok=True)

load_dotenv(BASE_DIR / ".env")

D4SIGN_TOKEN = os.getenv("D4SIGN_TOKEN", "").strip()
D4SIGN_CRYPTKEY = os.getenv("D4SIGN_CRYPTKEY", "").strip()


# 🔒 Ajuste os cofres conforme os seus UUIDs reais
COFRES: Dict[str, Dict[str, str]] = {
    "pendentes_pagamento": {"uuid_safe": "598e7271-76f9-40a7-aa40-6c81d813ece7", "label": "Pendentes (Pagamento)"},
    "parque_dos_ipes": {"uuid_safe": "5142e9a8-7f99-4f78-8a2e-a6efa6dc4fc3", "label": "Loteamento Parque dos Ipês"},
    "pendentes_assinatura": {"uuid_safe": "8f7f8354-9d83-49e2-b657-5f8131c66b69", "label": "Pendentes (Assinatura)"},
    "loteamento_ribeiro": {"uuid_safe": "414f9169-f164-441d-9576-e80040793597", "label": "Loteamento Ribeiro"},
    "loteamento_primavera": {"uuid_safe": "db77738f-862b-4f09-a32f-041a1b37332f", "label": "Loteamento Primavera"},
}


def _norm(txt: str) -> str:
    return " ".join((txt or "").replace("\xa0", " ").split())


def _limpa_nome_pessoa(nome: str) -> str:
    nome = _norm(nome)
    nome = re.sub(r"^(sr\.?\s*\(a\)?|sra\.?\s*\(a\)?|sr\.?|sra\.?)\s+", "", nome, flags=re.I)
    nome = re.sub(r"\b\d{3,}\b", "", nome)
    nome = _norm(nome)
    return nome.strip(" ,;-.\t")


def limpar_nome_pessoa(nome: str) -> str:
    return _limpa_nome_pessoa(nome)


def px72_to_px96(v: float) -> int:
    return int(round(v * (96.0 / 72.0)))


def d4sign_headers() -> dict:
    if not D4SIGN_TOKEN or not D4SIGN_CRYPTKEY:
        raise RuntimeError("Faltam D4SIGN_TOKEN e/ou D4SIGN_CRYPTKEY no .env do Kanban.")
    return {"tokenAPI": D4SIGN_TOKEN, "cryptKey": D4SIGN_CRYPTKEY}


def salvar_log(evento: str, detalhes: dict) -> str:
    ts = datetime.now().strftime("%Y%m%d_%H%M%S")
    fname = f"{ts}_{evento}_{uuid.uuid4().hex[:8]}.json"
    path = LOG_DIR / fname
    payload = {
        "evento": evento,
        "timestamp": datetime.now().isoformat(),
        **(detalhes or {}),
    }
    path.write_text(json.dumps(payload, ensure_ascii=False, indent=2), encoding="utf-8")
    return str(path)


def sanitize_filename_piece(s: str, max_len: int = 60) -> str:
    s = _norm(s)
    s = re.sub(r"[^a-zA-Z0-9À-ÿ_\-\. ]+", " ", s)
    s = re.sub(r"\s+", " ", s).strip()
    s = s.replace(" ", "_")
    return s[:max_len] if s else "SEM_NOME"


def build_nome_arquivo(codvendedor: str, cliente_nome: str, lote: str) -> str:
    # regra pedida: codvendedor + NOME DO CLIENTE + n do lote
    p1 = sanitize_filename_piece(codvendedor, 20)
    p2 = sanitize_filename_piece(cliente_nome, 80)
    p3 = sanitize_filename_piece(lote, 30)
    return f"{p1} - {p2} {p3}.pdf"


def extrair_vendedor_e_compradores(pdf_path: Path) -> Tuple[str, List[str]]:
    doc = fitz.open(str(pdf_path))
    try:
        page = doc[0]
        texto = _norm(page.get_text("text"))

        vendedor_nome = ""
        m_v = re.search(r"COMPROMITENTE\s+VENDEDORA:\s*(.+?)\s*,", texto, flags=re.I)
        if m_v:
            vendedor_nome = _limpa_nome_pessoa(m_v.group(1))
            vendedor_nome = re.sub(r"^\s*I\.?\s*1\.?\s*", "", vendedor_nome, flags=re.I).strip()

        compradores: List[str] = []
        encontrados = re.findall(
            r"(?:\be\s+)?(?:Sr\.?\s*\(a\)?|Sra\.?\s*\(a\)?|Sr\.?|Sra\.?)\s+([^,]+?)\s*,",
            texto,
            flags=re.I,
        )

        for nome in encontrados:
            nome = _limpa_nome_pessoa(nome)
            if not nome:
                continue
            if sum(ch.isdigit() for ch in nome) >= 3:
                continue
            if len(nome.split()) < 2:
                continue
            if nome not in compradores:
                compradores.append(nome)

        return vendedor_nome, compradores
    finally:
        doc.close()


def build_pins_regras(
    pdf_path: Path,
    vendedor_nome: str,
    compradores: List[Dict[str, str]],
    vendedor_email: str,
) -> List[Dict[str, Any]]:
    doc = fitz.open(str(pdf_path))
    pins: List[Dict[str, Any]] = []

    vend_rub_x, vend_rub_y = 30, 720
    canto_comp_x, canto_comp_y = 30, 630

    H_SPACING = 120
    V_SPACING = 55
    label_comp = "Compromissário(a)(s) Comprador(a)(es):"

    for i, page in enumerate(doc, start=1):
        occ_l = page.search_for(label_comp)
        tem_label = bool(occ_l)

        if i == 1:
            # vendedor rubrica
            pins.append({
                "email": vendedor_email,
                "page": i,
                "position_x": px72_to_px96(vend_rub_x),
                "position_y": px72_to_px96(vend_rub_y),
                "page_width": 794,
                "page_height": 1123,
                "type": 1,
            })

            # compradores empilhados
            for idx, comprador in enumerate(compradores):
                email = (comprador.get("email") or "").strip().lower()
                if not email:
                    continue
                pins.append({
                    "email": email,
                    "page": i,
                    "position_x": px72_to_px96(canto_comp_x),
                    "position_y": px72_to_px96(canto_comp_y - (idx * V_SPACING)),
                    "page_width": 794,
                    "page_height": 1123,
                    "type": 1,
                })
            continue

        # vendedor: tenta assinatura no nome, senão rubrica
        vend_assinou = False
        if vendedor_nome:
            occ_v = page.search_for(vendedor_nome)
            if occ_v:
                b = occ_v[0]
                pins.append({
                    "email": vendedor_email,
                    "page": i,
                    "position_x": px72_to_px96(b.x0),
                    "position_y": px72_to_px96(b.y0 - 40),
                    "page_width": 794,
                    "page_height": 1123,
                    "type": 0,
                })
                vend_assinou = True

        if not vend_assinou:
            pins.append({
                "email": vendedor_email,
                "page": i,
                "position_x": px72_to_px96(vend_rub_x),
                "position_y": px72_to_px96(vend_rub_y),
                "page_width": 794,
                "page_height": 1123,
                "type": 1,
            })

        # compradores
        if tem_label:
            for b in occ_l:
                base_x = b.x1 + 10
                base_y = b.y0 - 10
                for idx, comprador in enumerate(compradores):
                    email = (comprador.get("email") or "").strip().lower()
                    if not email:
                        continue
                    pins.append({
                        "email": email,
                        "page": i,
                        "position_x": px72_to_px96(base_x + (idx * H_SPACING)),
                        "position_y": px72_to_px96(base_y - 20),
                        "page_width": 794,
                        "page_height": 1123,
                        "type": 1,
                    })

        compradores_sem_nome: List[str] = []
        for comprador in compradores:
            nome = (comprador.get("nome") or "").strip()
            email = (comprador.get("email") or "").strip().lower()
            if not email:
                continue
            occ_nome = page.search_for(nome) if nome else []
            if occ_nome:
                b = occ_nome[0]
                pins.append({
                    "email": email,
                    "page": i,
                    "position_x": px72_to_px96(b.x0),
                    "position_y": px72_to_px96(b.y0 - 40),
                    "page_width": 794,
                    "page_height": 1123,
                    "type": 0,
                })
            else:
                compradores_sem_nome.append(email)

        if not tem_label:
            for idx, email in enumerate(compradores_sem_nome):
                pins.append({
                    "email": email,
                    "page": i,
                    "position_x": px72_to_px96(canto_comp_x),
                    "position_y": px72_to_px96(canto_comp_y - (idx * V_SPACING)),
                    "page_width": 794,
                    "page_height": 1123,
                    "type": 1,
                })

    doc.close()
    return pins


def upload_documento_d4sign(pdf_path: Path, safe_uuid: str, workflow: str = "2") -> Dict[str, Any]:
    endpoint = f"https://secure.d4sign.com.br/api/v1/documents/{safe_uuid}/upload/"
    files = {
        "file": (pdf_path.name, open(pdf_path, "rb"), "application/pdf"),
        "workflow": workflow,
    }

    try:
        r = requests.post(endpoint, headers=d4sign_headers(), files=files, timeout=90)
        data = None
        try:
            data = r.json()
        except Exception:
            data = None
        ok = (r.status_code == 200)
        res = {"ok": ok, "status_code": r.status_code, "data": data, "text": r.text if data is None else None}
        salvar_log("upload", {"endpoint": endpoint, "pdf": pdf_path.name, "safe_uuid": safe_uuid, "result": res})
        return res
    except Exception as e:
        salvar_log("upload_exception", {"endpoint": endpoint, "pdf": pdf_path.name, "safe_uuid": safe_uuid, "error": str(e)})
        return {"ok": False, "status_code": None, "data": None, "text": str(e)}


def criar_lista_signatarios(uuid_doc: str, vendedor_email: str, compradores: List[Dict[str, str]]) -> Dict[str, Any]:
    endpoint = f"https://secure.d4sign.com.br/api/v1/documents/{uuid_doc}/createlist"
    headers = {**d4sign_headers(), "accept": "application/json", "content-type": "application/json"}

    signers = [
        {
            "email": vendedor_email,
            "act": "1",
            "foreign": "0",
            "certificadoicpbr": "0",
            "assinatura_presencial": "0",
            "docauth": "0",
            "docauthandselfie": "0",
            "embed_methodauth": "email",
        }
    ]

    for c in compradores:
        email = (c.get("email") or "").strip().lower()
        if not email:
            continue
        signers.append({
            "email": email,
            "act": "1",
            "foreign": "0",
            "certificadoicpbr": "0",
            "assinatura_presencial": "0",
            "docauth": "0",
            "docauthandselfie": "1",
            "embed_methodauth": "email",
        })

    r = requests.post(endpoint, headers=headers, json={"signers": signers}, timeout=30)
    data = r.json()
    if r.status_code != 200:
        salvar_log("createlist_error", {"endpoint": endpoint, "status": r.status_code, "data": data})
        raise RuntimeError(f"Falha ao criar lista de signatários ({r.status_code}): {data}")
    salvar_log("createlist", {"endpoint": endpoint, "status": r.status_code, "data": data})
    return data


def add_pins_d4sign(uuid_doc: str, pins: List[Dict[str, Any]]) -> Dict[str, Any]:
    endpoint = f"https://secure.d4sign.com.br/api/v1/documents/{uuid_doc}/addpins"
    headers = {**d4sign_headers(), "accept": "application/json", "content-type": "application/json"}
    r = requests.post(endpoint, headers=headers, json={"pins": pins}, timeout=60)
    data = r.json()
    if r.status_code != 200:
        salvar_log("addpins_error", {"endpoint": endpoint, "status": r.status_code, "data": data})
        raise RuntimeError(f"Falha ao adicionar pins ({r.status_code}): {data}")
    salvar_log("addpins", {"endpoint": endpoint, "status": r.status_code, "data": data, "pins_count": len(pins)})
    return data


def enviar_para_d4sign(pdf_file, payload: Dict[str, str], step_cb=None) -> Dict[str, Any]:
    step_cb = step_cb or (lambda pct, msg, extra=None: None)
    """Retorna: { ok: bool, uuid_doc?, arquivo?, cofre?, error? }"""

    step_cb(5, "Preparando arquivo...")
    codvendedor = (payload.get("codvendedor") or "").strip()
    cliente_nome = (payload.get("cliente_nome") or "").strip()
    lote = (payload.get("lote") or "").strip()
    vendedor_email = (payload.get("vendedor_email") or "").strip().lower()
    compradores_emails_raw = (payload.get("compradores_emails") or "").strip()

    if not vendedor_email:
        return {"ok": False, "error": "Informe o e-mail do vendedor."}

    cofre_key = (payload.get("cofre_key") or "").strip()
    uuid_safe = (payload.get("uuid_safe") or "").strip()

    if uuid_safe:
        safe_uuid = uuid_safe
    else:
        # fallback para compatibilidade antiga
        if cofre_key not in COFRES:
            return {"ok": False, "error": "Cofre inválido."}
        safe_uuid = COFRES[cofre_key]["uuid_safe"]

    emails = [e.strip().lower() for e in compradores_emails_raw.split(";") if e.strip()]
    if not emails:
        return {"ok": False, "error": "Informe os e-mails dos compradores (separados por ';')."}

    # salva PDF com nome padrão pedido
    fname = build_nome_arquivo(codvendedor, cliente_nome, lote)
    pdf_path = UPLOAD_DIR / fname

    try:
        pdf_file.save(pdf_path)
        step_cb(15, "PDF salvo. Extraindo assinaturas...")  
    except Exception:
        # fallback (FileStorage pode ser stream)
        data = pdf_file.read() if hasattr(pdf_file, "read") else None
        if data:
            pdf_path.write_bytes(data)
        else:
            return {"ok": False, "error": "Não foi possível salvar o PDF."}
    # extrai nomes do PDF
    step_cb(25, "Extraindo assinaturas do contrato...")
    vendedor_nome_pdf, compradores_nomes = extrair_vendedor_e_compradores(pdf_path)
    step_cb(35, f"Assinaturas encontradas: {len(compradores_nomes)} comprador(es).")
    if not compradores_nomes:
        return {"ok": False, "error": "Não consegui identificar os compradores no PDF (página 1)."}

    if len(emails) != len(compradores_nomes):
        return {
            "ok": False,
            "error": (
                f"Quantidade de e-mails ({len(emails)}) não confere com compradores no contrato ({len(compradores_nomes)}). "
                f"Compradores detectados: {', '.join(compradores_nomes)}"
            ),
        }

    compradores: List[Dict[str, str]] = []
    for i, nome in enumerate(compradores_nomes):
        compradores.append({"nome": limpar_nome_pessoa(nome), "email": emails[i]})

    safe_uuid = COFRES[cofre_key]["uuid_safe"]

    # 1) upload
    step_cb(50, "Enviando documento para o D4Sign...")
    result_upload = upload_documento_d4sign(pdf_path, safe_uuid)
    step_cb(65, "Documento enviado. Criando lista de signatários...")

    if not result_upload.get("ok"):
        msg = (result_upload.get("data") or {}).get("message") or result_upload.get("text") or "Erro desconhecido no upload." 
        return {"ok": False, "error": f"D4Sign: {msg}", "arquivo": fname, "cofre": cofre_key}

    uuid_doc = (result_upload.get("data") or {}).get("uuid")
    if not uuid_doc:
        return {"ok": False, "error": "D4Sign não retornou uuid do documento.", "arquivo": fname, "cofre": cofre_key}

    # 2) lista
    try:
        step_cb(75, "Criando lista de signatários...")
        criar_lista_signatarios(uuid_doc, vendedor_email=vendedor_email, compradores=compradores)
    except Exception as e:
        return {"ok": False, "error": f"Erro ao criar lista de signatários: {e}", "uuid_doc": uuid_doc, "arquivo": fname, "cofre": cofre_key}

    # 3) pins
    try:
        step_cb(85, "Marcando pontos de assinatura...")
        pins = build_pins_regras(
            pdf_path=pdf_path,
            vendedor_nome=vendedor_nome_pdf,
            compradores=compradores,
            vendedor_email=vendedor_email,
        )
        add_pins_d4sign(uuid_doc, pins)
    except Exception as e:
        return {"ok": False, "error": f"Erro ao adicionar pins: {e}", "uuid_doc": uuid_doc, "arquivo": fname, "cofre": cofre_key}
    
    step_cb(100, "Finalizado com sucesso!")
    return {"ok": True, "uuid_doc": uuid_doc, "arquivo": fname, "cofre": cofre_key}
