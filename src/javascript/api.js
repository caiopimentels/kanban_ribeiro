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