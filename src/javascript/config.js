/**
 * Configurações globais do front.
 * Mantém valores centralizados e fáceis de trocar.
 */

const hostname = location.hostname;

let API_BASE;

if (
  hostname.startsWith('192.168.') ||
  hostname.startsWith('10.') ||
  hostname === 'localhost'
) {
  API_BASE = `http://192.168.1.24:5010`;
} else {
  API_BASE = 'http://madribeiro.ddns.net:5010';
}

export const CONFIG = {
  API_BASE,
  HOLD_MS_TOUCH: 250,
  MOVE_TOL_TOUCH: 10,
  DEBOUNCE_OBS_MS: 600,

  COLUNAS: [
    { id: 'lotes-bloqueados',    nome: 'Bloqueados' },
    { id: 'contrato-gerado',     nome: 'Contrato Gerado' },
    { id: 'assinado-cliente',    nome: 'Assinado Cliente' },
    { id: 'aguardando-retirada', nome: 'Aguardando Retirada' },
    { id: 'entregue',            nome: 'Entregue' }
  ],

  ORDEM_ETAPAS: ['contrato-gerado','assinado-cliente','aguardando-retirada','entregue'],
};