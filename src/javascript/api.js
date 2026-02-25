/**
 * Camada de API: todas as requisições ao Flask ficam aqui.
 * Facilita debugar e evita espalhar fetch pelo projeto.
 */

import { CONFIG } from './config.js';

function headersAuth() {
  return {
    'Content-Type': 'application/json',
    'Authorization': 'Bearer ' + (window.KANBAN_TOKEN || '')
  };
}

function headersAuthNoContentType() {
  // Para multipart/form-data o browser define o Content-Type com boundary.
  return {
    'Authorization': 'Bearer ' + (window.KANBAN_TOKEN || '')
  };
}

export async function apiGet(path) {
  const res = await fetch(`${CONFIG.API_BASE}${path}`, { headers: headersAuth() });
  const data = await res.json().catch(() => ({}));
  if (!res.ok) throw new Error(data?.error || `HTTP ${res.status}`);
  return data;
}

export async function apiPost(path, body) {
  const res = await fetch(`${CONFIG.API_BASE}${path}`, {
    method: 'POST',
    headers: headersAuth(),
    body: JSON.stringify(body || {})
  });
  const data = await res.json().catch(() => ({}));
  if (!res.ok) throw new Error(data?.error || `HTTP ${res.status}`);
  return data;
}

export function buscarVendasPendentes() {
  return apiGet('/vendas');
}

export function buscarBloqueados() {
  return apiGet('/bloqueado');
}

export function buscarEntreguesFinalizados() {
  return apiGet('/entregues/finalizados');
}

export function atualizarEtapa({ etapa, usuario, id_lote }) {
  return apiPost('/atualizar', { etapa, usuario, id_lote });
}

export function registrarEtiqueta({ etiqueta, usuario, id_lote }) {
  return apiPost('/atualizar', { etapa: etiqueta, usuario, id_lote });
}

export function limparFrente({ usuario, id_lote, etapas }) {
  // se você já tem essa rota no backend, mantenha
  return apiPost('/limpar-frente', { usuario, id_lote, etapas });
}

export function salvarObservacao({ id_lote, usuario, observacao }) {
  return apiPost('/observacao', { id_lote, usuario, observacao });
}

export function consultarLote({ id_lote }) {
  return apiPost('/consulta', { id_lote });
}

export function criarEspecial({ tipo, id_lote, codcli, usuario }) {
  return apiPost('/criar-especial', { tipo, id_lote, codcli, usuario });
}

// Envio D4Sign com progresso via NDJSON (stream)
export async function enviarContratoD4SignStream(formData, onProgress) {
  const url = `${CONFIG.API_BASE}/d4sign/enviar`;

  const resp = await fetch(url, {
    method: "POST",
    headers: headersAuthNoContentType(),
    body: formData,
  });

  // Se o backend retornou erro sem stream
  if (!resp.ok && !resp.body) {
    const txt = await resp.text();
    let json = null;
    try { json = JSON.parse(txt); } catch {}
    throw new Error((json && (json.error || json.message)) || txt || `HTTP ${resp.status}`);
  }

  // Se não veio body stream, fallback JSON
  if (!resp.body) {
    const txt = await resp.text();
    let json = null;
    try { json = JSON.parse(txt); } catch {}
    if (!resp.ok) throw new Error((json && (json.error || json.message)) || txt || `HTTP ${resp.status}`);
    return json;
  }

  const reader = resp.body.getReader();
  const decoder = new TextDecoder("utf-8");
  let buffer = "";
  let finalResult = null;

  while (true) {
    const { value, done } = await reader.read();
    if (done) break;

    buffer += decoder.decode(value, { stream: true });

    let idx;
    while ((idx = buffer.indexOf("\n")) >= 0) {
      const line = buffer.slice(0, idx).trim();
      buffer = buffer.slice(idx + 1);
      if (!line) continue;

      let evt;
      try {
        evt = JSON.parse(line);
      } catch {
        continue; // ignora linha quebrada
      }

      if (evt.type === "progress" && typeof onProgress === "function") {
        onProgress(evt.pct, evt.msg, evt);
      }
      if (evt.type === "result") {
        finalResult = evt;
      }
    }
  }

  if (!finalResult) throw new Error("Servidor não retornou resultado final.");
  if (!finalResult.ok) throw new Error(finalResult.error || "Falha no envio.");
  return finalResult;
}