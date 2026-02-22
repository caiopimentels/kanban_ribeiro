/**
 * Responsável por:
 * - Renderizar cards nas colunas
 * - Atualizar contagens
 * - Determinar coluna destino
 * - Manter referência da venda no card (card._venda)
 */

import { CONFIG } from './config.js';
import { normalizarClasseBadge, formatarData, formatarHorario } from './utils.js';

export function determinarColuna(venda) {
  if (venda.colunas?.entregue?.data) return 'entregue';
  if (venda.colunas?.['aguardando-retirada']?.data) return 'aguardando-retirada';
  if (venda.colunas?.['assinado-cliente']?.data) return 'assinado-cliente';
  return 'contrato-gerado';
}

function descricaoContrato(venda) {
  let empreendimento = venda.fantasia || '';
  if (empreendimento.startsWith('LOTEAMENTO')) {
    empreendimento = `LOT. ${empreendimento.split(' ').slice(1).join(' ')}`;
  }
  const t = (venda.tipo_contrato || 'V').trim().toUpperCase();
  if (t === 'T') return `TRANSFERENCIA - ${empreendimento}`;
  if (t === 'D') return `DISTRATO - ${empreendimento}`;
  return `VENDA - ${empreendimento}`;
}

/**
 * Cria o elemento do card (sem modal).
 * Guarda a venda em memória dentro do card: card._venda = venda
 */
export function criarCardVenda(venda, { finalizado = false } = {}) {
  const card = document.createElement('div');
  card.className = 'kanban-card';
  card.setAttribute('draggable', 'true');
  card.setAttribute('id_lote', venda.id);
  card.dataset.obs = (venda.OBS || '').trim();
  card.dataset.vendaId = String(venda.id);
  card._venda = venda;

  if (finalizado) card.dataset.finalizado = '1';

  if (venda.dt_compra) card.dataset.dataVenda = venda.dt_compra;
  if (venda.datasituacao) card.dataset.dataBloqueio = venda.datasituacao;

  const desc = descricaoContrato(venda);
  card.innerHTML = window.templateCardVenda(venda, desc);

  // regra SPC: você marcava como pendente se não vier no backend
  const spcVal = (venda.badges?.['consulta-spc'] ?? '').toString().trim();
  if (!spcVal && venda.tipo_contrato !== 'D') {
    card.classList.add('spc-pendente');
  }

  // badges vindas do backend: renderiza no card (sem duplicar)
  aplicarBadgesNoCard(card, venda);

  // seu comportamento: tirar o chip visual “consulta-spc” do card
  // (mantemos a mesma usabilidade que você já tinha)
  const btnSPC = card.querySelector('.badge-cards .badge.consulta-spc');
  if (btnSPC) btnSPC.remove();

  // ✅ marca finalizado no DOM
  if (venda.__finalizado) {
    card.dataset.finalizado = '1';
  } else {
    card.removeAttribute('data-finalizado');
  }

  // ✅ guarda a venda no card (modal usa isso)
  card._venda = { ...venda, __finalizado: !!venda.__finalizado };
  
  return card;
}

/**
 * Aplica badges vindas do backend na área de badges do card.
 * Evita duplicatas e aplica regras especiais (pagamento ok remove entrada confirmada).
 */
export function aplicarBadgesNoCard(card, venda) {
  const badgeContainer = card.querySelector('.badge-cards');
  if (!badgeContainer) return;

  const badges = Object.keys(venda.badges || {})
  .map(normalizarClasseBadge)
  .filter(et => et !== 'consulta-spc'); // ✅ nunca desenha SPC no card

  for (const etapa of badges) {
    if (badgeContainer.querySelector(`.badge.${CSS.escape(etapa)}`)) continue;

    const badge = document.createElement('span');
    badge.className = `badge ${etapa}`;

    if (etapa === 'contrato-fisico') badge.textContent = 'Fisico';
    else if (etapa === 'contrato-digital') badge.textContent = 'Digital';
    else badge.textContent = etapa.replace(/-/g, ' ');

    badgeContainer.appendChild(badge);

    if (etapa === 'Pagamento-OK') {
      const entradaBadge = badgeContainer.querySelector('.badge.Entrada-Confirmada');
      if (entradaBadge) entradaBadge.remove();
    }
  }
}

/**
 * Atualiza a contagem de cards visíveis em cada coluna.
 */
export function atualizarContagem() {
  for (const col of CONFIG.COLUNAS) {
    const colunaEl = document.getElementById(col.id);
    if (!colunaEl) continue;
    const titulo = colunaEl.querySelector('h2');
    const cards = Array.from(colunaEl.querySelectorAll('.kanban-card'))
      .filter(c => window.getComputedStyle(c).display !== 'none');
    if (titulo) titulo.innerText = `${col.nome} (${cards.length})`;
  }
}

/**
 * Renderiza uma lista de vendas dentro do Kanban.
 * Usa DocumentFragment para performance (menos reflow).
 */
export function renderizarVendas(vendas) {
  for (const venda of vendas) {
    
    const colunaId = determinarColuna(venda);
    const container = document.querySelector(`#${colunaId} .kanban-cards`);
    if (!container) continue;

    container.appendChild(criarCardVenda(venda));
    
  }
}

export function renderizarBloqueados(vendas) {
  const container = document.querySelector('#lotes-bloqueados .kanban-cards');
  if (!container) return;

  const frag = document.createDocumentFragment();
  for (const v of vendas) {
    const card = document.createElement('div');
    card.className = 'kanban-card';
    card.setAttribute('draggable', 'true');
    card.setAttribute('id_lote', v.id);
    card.dataset.dataBloqueio = v.datasituacao || '';
    card._venda = v;

    card.innerHTML = `
      <div class="badge-cards"></div>
      <div class="dados-card">
        <p class="card-title">${v.codvendedor} - ${v.nome_vendedor} (${v.quadra}-${v.lote})</p>
        <div class="card-dados">
          <div class="card-empreendimento">${v.fantasia || ''}</div>
          <div class="card-bloqueado">Data Bloqueio: ${formatarData(v.datasituacao)} ${formatarHorario(v.datasituacao)}</div>
        </div>
      </div>`;
    frag.appendChild(card);
  }
  container.appendChild(frag);
}