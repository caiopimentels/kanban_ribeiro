/**
 * Entrada principal do Kanban:
 * - carrega pendentes (/vendas)
 * - carrega bloqueados (/bloqueado)
 * - instala modal único e drag/drop
 * - usa event delegation pra click nos cards
 */

import { buscarVendasPendentes, buscarBloqueados, buscarEntreguesFinalizados } from './api.js';
import { setUsuarioId, ESTADO } from './estado.js';
import { renderizarVendas, renderizarBloqueados, atualizarContagem } from './board.js';
import { abrirModalVenda } from './modal_unico.js';
import { instalarDragDropDesktop, instalarDragDropTouch } from './drag_drop.js';
import { abrirFiltroModal, instalarFiltroModal, aplicarFiltroDaColuna as aplicar} from './filtros.js';

function limparBoard() {
  document.querySelectorAll('.kanban .kanban-cards').forEach(c => c.innerHTML = '');
}

/**
 * Carrega tudo que aparece no board (pendentes + bloqueados).
 * Mantém a mesma usabilidade do seu sistema, mas com menos custo.
 */
async function carregarBoard() {
  limparBoard();

  const vendas = await buscarVendasPendentes();
  renderizarVendas(vendas);

  const bloqueados = await buscarBloqueados();
  renderizarBloqueados(bloqueados);

  atualizarContagem();
}

/**
 * Clique no card (event delegation):
 * abre modal único usando os dados guardados no card._venda
 */
function instalarClickCards() {
  document.addEventListener('click', (e) => {
    const card = e.target.closest('.kanban-card');
    if (!card) return;

    // evita conflito com drag (se estiver arrastando)
    if (card.classList.contains('dragging')) return;

    const venda = card._venda;
    if (!venda) return;

    const finalizado = card.dataset.finalizado === '1';
    abrirModalVenda(venda, { finalizado });
  });
}

/**
 * Inicialização geral.
 */
document.addEventListener('DOMContentLoaded', async () => {
  const usuarioId = document.getElementById('txtLogin')?.value;
  setUsuarioId(usuarioId);

  instalarClickCards();
  instalarDragDropDesktop();
  instalarDragDropTouch();
  registrarCliquesGlobais();
  instalarModalContratoEspecial();

  try {
    await carregarBoard();
  } catch (err) {
    console.error('Erro ao carregar board:', err);
    alert('Erro ao carregar o Kanban. Veja o console.');
  }
});

export function registrarCliquesGlobais() {
  document.addEventListener('click', (ev) => {

    // ✅ botão de filtro (ícone)
    const btnFiltro = ev.target.closest('.fa-filter, [data-acao="abrir-filtro"]');
    if (btnFiltro) {
      ev.preventDefault();
      abrirFiltroModal(btnFiltro); // sua função já usa e.currentTarget/closest
      return;
    }

    // ✅ botão "Adicionar contrato" (modal especial)
    const btnAdd = ev.target.closest('.create-card-btn, [data-acao="novo-contrato"]');
    if (btnAdd) {
      ev.preventDefault();
      const modal = document.getElementById('create-special-modal');
      if (modal) modal.showModal();
      return;
    }

    // ✅ clique no card abre modal único (se você já não tem isso)
    const card = ev.target.closest('.kanban-card');
    if (card && card._venda) {
      abrirModalVenda(card._venda, { finalizado: card.dataset.finalizado === '1' });
    }
  });
}

instalarFiltroModal(async (mostrar) => {
  const col = document.querySelector('#entregue .kanban-cards');
  if (!col) return;

  col.innerHTML = '';

  if (mostrar) {
    const finalizados = await buscarEntreguesFinalizados();
    // Renderiza finalizados forçando coluna entregue e marcando finalizado
    renderizarVendas(finalizados.map(v => ({ ...v, __forcarColuna: 'entregue', __finalizado: 1 })));
  } else {
    await carregarBoard();
  }

  atualizarContagem();
});

function instalarModalContratoEspecial() {
  const modal = document.getElementById('create-special-modal');
  const form = document.getElementById('create-special-form');
  const submitBtn = document.getElementById('create-special-submit');
  if (!modal || !form || !submitBtn) return;

  // fechar
  modal.addEventListener('click', (e) => {
    if (e.target.closest('.close-modal')) modal.close();
    if (e.target === modal) modal.close();
  });

  form.addEventListener('submit', async (e) => {
    e.preventDefault();

    const id_lote = document.getElementById('create-codcli')?.value?.trim();
    const tipoSel = document.getElementById('create-tipo');
    const tipo = tipoSel?.value;

    if (!id_lote || !tipo) {
      alert('Informe o NUMPED e o tipo.');
      return;
    }

    submitBtn.disabled = true;
    const txtOriginal = submitBtn.textContent;
    submitBtn.textContent = 'Consultando...';

    try {
      // 1) consulta
      const res1 = await fetch(`${location.protocol}//${location.hostname}:5010/consulta`, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          'Authorization': 'Bearer ' + window.KANBAN_TOKEN
        },
        body: JSON.stringify({ id_lote })
      });
      if (!res1.ok) throw new Error('Lote não encontrado (consulta).');

      const arr = await res1.json();
      const info = Array.isArray(arr) ? arr[0] : arr;

      const tipoLabel = tipoSel.options[tipoSel.selectedIndex]?.text || tipo;
      const msg =
        `Confirma a criação do contrato de ${tipoLabel.toUpperCase()} para ${info.nome} do lote ${info.quadra}-${String(info.lote).padStart(2,'0')}${info.parte ? '/' + info.parte : ''} no ${info.empreendimento}?`;

      if (!confirm(msg)) return;

      // 2) cria
      submitBtn.textContent = 'Criando...';
      const res2 = await fetch(`${location.protocol}//${location.hostname}:5010/criar-especial`, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          'Authorization': 'Bearer ' + window.KANBAN_TOKEN
        },
        body: JSON.stringify({
          tipo,
          id_lote,
          codcli: info.codcli,
          usuario: ESTADO.usuarioId
        })
      });
      if (!res2.ok) throw new Error('Falha ao criar o contrato.');

      alert('Contrato especial criado com sucesso!');
      modal.close();

      // recarrega board (sem F5)
      await carregarBoard();

    } catch (err) {
      alert('Erro: ' + err.message);
      console.error(err);
    } finally {
      submitBtn.disabled = false;
      submitBtn.textContent = txtOriginal;
    }
  });
}