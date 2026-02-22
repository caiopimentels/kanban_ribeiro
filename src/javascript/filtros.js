/**
 * Filtros:
 * - Mantém estado por coluna
 * - Aplica display none nos cards sem reload
 * (Implementação completa depende do HTML do seu modal de filtros)
 */

import { ESTADO } from './estado.js';
import { atualizarContagem } from './board.js';
import { toYMD, normalizarClasseBadge } from './utils.js';

export function aplicarFiltroDaColuna(colunaId, filtro) {
  // filtro = { corretores[], empreendimentos[], etiquetas[], dataInicio, dataFinal }
  ESTADO.filtrosPorColuna[colunaId] = filtro;

  const cards = Array.from(document.querySelectorAll(`#${colunaId} .kanban-card`));

  cards.forEach(card => {
    card.style.removeProperty('display');

    // corretores
    if (filtro.corretores?.length) {
      const txt = (card.querySelector('.card-corretor')?.innerText || '').toLowerCase();
      if (!filtro.corretores.some(c => txt.includes(c))) { card.style.display = 'none'; return; }
    }

    // empreendimentos
    if (filtro.empreendimentos?.length) {
      const txt = (card.querySelector('.card-empreendimento')?.innerText || '').toLowerCase();
      if (!filtro.empreendimentos.some(e => txt.includes(e))) { card.style.display = 'none'; return; }
    }

    // etiquetas
    if (filtro.etiquetas?.length) {
      const ok = filtro.etiquetas.some(et => card.querySelector(`.badge-cards .badge.${CSS.escape(normalizarClasseBadge(et))}`));
      if (!ok) { card.style.display = 'none'; return; }
    }

    // datas
    if (filtro.dataInicio || filtro.dataFinal) {
      const raw = colunaId === 'lotes-bloqueados' ? card.dataset.dataBloqueio : card.dataset.dataVenda;
      const ymd = toYMD(raw);
      if (!ymd) { card.style.display = 'none'; return; }
      if (filtro.dataInicio && ymd < filtro.dataInicio) { card.style.display = 'none'; return; }
      if (filtro.dataFinal  && ymd > filtro.dataFinal)  { card.style.display = 'none'; return; }
    }
  });

  atualizarContagem();
}

export function abrirFiltroModal(botaoOuIcone) {
  const coluna = botaoOuIcone?.closest?.('.kanban-column') || botaoOuIcone?.closest?.('button')?.closest?.('.kanban-column');
  const modal = document.getElementById('filtro-modal');
  if (!coluna || !modal) return;

  modal.dataset.colunaAlvo = coluna.id;

  // só mostra checkbox em ENTREGUE
  const campoFinalizados = modal.querySelector('#campo-finalizados');
  if (campoFinalizados) campoFinalizados.style.display = (coluna.id === 'entregue') ? '' : 'none';

  modal.showModal();
}

export function instalarFiltroModal(onFinalizadosToggle) {
  const modal = document.getElementById('filtro-modal');
  const btnAplicar = document.getElementById('filtro-actions');
  if (!modal || !btnAplicar) return;

  // fechar
  modal.addEventListener('click', (e) => {
    if (e.target.closest('.close-modal')) modal.close();
    if (e.target === modal) modal.close();
  });

  btnAplicar.addEventListener('click', async (e) => {
    e.preventDefault();

    const colunaId = modal.dataset.colunaAlvo;
    if (!colunaId) return;

    const mostrarFinalizados = !!document.getElementById('mostrar-finalizados')?.checked;

    // ✅ monta filtro do modal (se seus inputs forem chipify, ajuste aqui)
    const corretoresTxt = (document.getElementById('filtro-corretor')?.value || '').trim();
    const empreTxt      = (document.getElementById('filtro-empreendimento')?.value || '').trim();
    const etiquetaTxt   = (document.getElementById('filtro-etiquetas')?.value || '').trim();

    const dataInicio = document.getElementById('filtro-data-inicio')?.value || '';
    const dataFinal  = document.getElementById('filtro-data-final')?.value  || '';

    const corretores      = corretoresTxt ? corretoresTxt.split(',').map(s => s.trim().toLowerCase()).filter(Boolean) : [];
    const empreendimentos = empreTxt      ? empreTxt.split(',').map(s => s.trim().toLowerCase()).filter(Boolean) : [];
    const etiquetas       = etiquetaTxt   ? etiquetaTxt.split(',').map(s => s.trim()).filter(Boolean) : [];

    const filtro = { corretores, empreendimentos, etiquetas, dataInicio, dataFinal, mostrarFinalizados };

    // ✅ salva estado por coluna (pra lembrar depois)
    ESTADO.filtrosPorColuna[colunaId] = filtro;

    // ✅ aplica filtro SOMENTE na coluna alvo
    aplicarFiltroDaColuna(colunaId, filtro);

    // ✅ se for ENTREGUE e existir callback, chama para carregar finalizados
    if (colunaId === 'entregue' && typeof onFinalizadosToggle === 'function') {
      await onFinalizadosToggle(mostrarFinalizados);
      // depois de mexer na lista de cards da coluna, reaplica filtro local nela
      aplicarFiltroDaColuna(colunaId, filtro);
    }

    modal.close();
  });
}