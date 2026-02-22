/**
 * Funções utilitárias (datas, normalização, etc)
 */

export function isTouch() {
  return window.matchMedia('(pointer: coarse)').matches;
}

export function normalizarClasseBadge(txt) {
  // "Pagamento OK" -> "Pagamento-OK"
  return (txt || '').toString().trim().replace(/\s+/g, '-');
}

export function formatarData(dataIso) {
  const d = new Date(dataIso);
  if (isNaN(d)) return '';
  const dia = String(d.getUTCDate()).padStart(2, '0');
  const mes = String(d.getUTCMonth() + 1).padStart(2, '0');
  const ano = d.getUTCFullYear();
  return `${dia}/${mes}/${ano}`;
}

export function formatarHorario(dataIso) {
  const d = new Date(dataIso);
  if (isNaN(d)) return '';
  const h = String(d.getUTCHours()).padStart(2, '0');
  const m = String(d.getUTCMinutes()).padStart(2, '0');
  const s = String(d.getUTCSeconds()).padStart(2, '0');
  return `${h}:${m}:${s}`;
}

export function toYMD(iso) {
  if (!iso) return '';
  const d = new Date(iso);
  if (isNaN(d)) return '';
  const y = d.getFullYear();
  const m = String(d.getMonth()+1).padStart(2,'0');
  const da= String(d.getDate()).padStart(2,'0');
  return `${y}-${m}-${da}`;
}