/**
 * Estado “em memória” da tela (front).
 * Aqui fica tudo o que o Kanban precisa para operar sem reload.
 */

import { CONFIG } from './config.js';

export const ESTADO = {
  usuarioId: null,
  // filtros por coluna (mantém sua lógica atual)
  filtrosPorColuna: {},

  colunas: CONFIG.COLUNAS,
  ordemEtapas: CONFIG.ORDEM_ETAPAS,
};

export function setUsuarioId(id) {
  ESTADO.usuarioId = id;
}

export function idxColuna(id) {
  return ESTADO.colunas.findIndex(c => c.id === id);
}

export function etapasAFrenteDo(destino) {
  const i = ESTADO.ordemEtapas.indexOf(destino);
  return i < 0 ? [] : ESTADO.ordemEtapas.slice(i + 1);
}