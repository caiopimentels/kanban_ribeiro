/**
 * Modal único:
 * - Renderiza o HTML do modal ao clicar no card
 * - Remove badges já aplicadas (pela fonte real: venda.badges)
 * - Salva observação sem reload
 */

import { formatarData, formatarHorario, normalizarClasseBadge } from './utils.js';
import { registrarEtiqueta, salvarObservacao } from './api.js';
import { ESTADO } from './estado.js';
import { atualizarContagem, aplicarBadgesNoCard } from './board.js';

function montarBarraBadges(modal) {
  const div = document.createElement('div');
  div.innerHTML = `
    <div class="modal-status">
      <div class="badge Autenticado"><span>Autenticado</span></div>
      <div class="badge Pagamento-OK"><span>Pagamento OK</span></div>
      <div class="badge Carne-Gerado"><span>Carnê Gerado</span></div>
      <div class="badge Arquivado"><span>Arquivado</span></div>
      <div class="badge contrato-fisico"><span>Fisico</span></div>
      <div class="badge contrato-digital"><span>Digital</span></div>
      <div class="badge Impresso"><span>Impresso</span></div>
      <div class="badge consulta-spc"><span>Consulta SPC</span></div>
    </div>`;
  modal.appendChild(div);
}

function removerBadgesJaAplicadas(modal, venda) {
  const existentes = new Set(Object.keys(venda.badges || {}).map(normalizarClasseBadge));

  // remove botões do modal que já estão no backend
  existentes.forEach(cls => {
    const btn = modal.querySelector(`.modal-status .badge.${CSS.escape(cls)}`);
    if (btn) btn.remove();
  });

  // regra: se já tem físico ou digital, remove os dois botões
  if (existentes.has('contrato-fisico') || existentes.has('contrato-digital')) {
    modal.querySelectorAll('.modal-status .badge.contrato-fisico, .modal-status .badge.contrato-digital')
      .forEach(b => b.remove());
  }
}

function configurarObservacao(modal, venda) {
  const campo = modal.querySelector('.observacao-input');
  if (!campo) return;

  const algumFinalizado = !!document.querySelector(`.kanban-card[id_lote="${venda.id}"][data-finalizado="1"]`);
  const finalizado = modal.dataset.finalizado === '1' || algumFinalizado;
  if (finalizado) {
    campo.disabled = true;
    campo.classList.add('obs-bloqueada');
    return;
  }

  campo.disabled = false;
  campo.classList.remove('obs-bloqueada');

  let t = null;

  const salvar = async () => {
    const texto = campo.value.trim();

    try {
      const resp = await salvarObservacao({
        id_lote: venda.id,
        usuario: ESTADO.usuarioId,
        observacao: texto
      });

      location.reload()

      // ✅ atualiza TODOS os cards desse id_lote (pode haver duplicado)
      const cards = document.querySelectorAll(`.kanban-card[id_lote="${venda.id}"]`);
      cards.forEach(c => {
        c.dataset.obs = valorSalvo;
        if (c._venda) c._venda.OBS = valorSalvo;
      });

      // ✅ garante que o campo está com o valor salvo
      campo.value = valorSalvo;

    } catch (err) {
      console.error('Erro ao salvar observação:', err);
    }
  };

  campo.onblur = salvar;
  campo.oninput = () => {
    clearTimeout(t);
    t = setTimeout(salvar, 600);
  };
}

function configurarClickBadges(modal, venda) {
  const status = modal.querySelector('.modal-status');
  if (!status) return;

  status.onclick = async (ev) => {
    const btn = ev.target.closest('.badge');
    if (!btn) return;

    const etapa = btn.classList[1];
    if (!etapa) return;

    const id_lote = venda.id;
    const card = document.querySelector(`.kanban-card[id_lote="${id_lote}"]`);
    if (!card) return;

    venda.badges = venda.badges || {};

    // ============================
    // 1️⃣ DIGITAL → aplica AUTENTICADO
    // ============================
    if (etapa === 'contrato-digital') {
      await aplicarBadgeNormal({ modal, venda, card, etapa: 'contrato-digital', btn });

      const btnAut = modal.querySelector('.modal-status .badge.Autenticado');
      if (btnAut) {
        await aplicarBadgeNormal({
          modal,
          venda,
          card,
          etapa: 'Autenticado',
          btn: btnAut
        });
      }

      // remove fisico também
      modal.querySelectorAll('.modal-status .badge.contrato-fisico')
        .forEach(b => b.remove());

      return;
    }

    // ============================
    // 2️⃣ FISICO → aplica IMPRESSO
    // ============================
    if (etapa === 'contrato-fisico') {
      await aplicarBadgeNormal({ modal, venda, card, etapa: 'contrato-fisico', btn });

      const btnImp = modal.querySelector('.modal-status .badge.Impresso');
      if (btnImp) {
        await aplicarBadgeNormal({
          modal,
          venda,
          card,
          etapa: 'Impresso',
          btn: btnImp
        });
      }

      modal.querySelectorAll('.modal-status .badge.contrato-digital')
        .forEach(b => b.remove());

      return;
    }

    // ============================
    // 3️⃣ CONSULTA-SPC → NÃO vai pro card
    // ============================
    if (etapa === 'consulta-spc') {

      venda.badges['consulta-spc'] = 1;

      // remove apenas a classe visual de pendente
      card.classList.remove('spc-pendente');

      btn.remove();

      try {
        await registrarEtiqueta({
          etiqueta: 'consulta-spc',
          usuario: ESTADO.usuarioId,
          id_lote
        });
      } catch (err) {
        console.error('Erro SPC:', err);
        // rollback visual
        card.classList.add('spc-pendente');
      }

      return;
    }

    // ============================
    // 4️⃣ BADGE NORMAL
    // ============================
    await aplicarBadgeNormal({ modal, venda, card, etapa, btn });
  };
}

export function abrirModalVenda(venda, { finalizado = false } = {}) {
  const modal = document.getElementById('modal-unico');
  if (!modal) return;

  // limpa e renderiza base
  modal.innerHTML = '';
  // ✅ Detecta finalizado pelo card (mais confiável que depender do parâmetro)
  const card = document.querySelector(`.kanban-card[id_lote="${venda.id}"]`);

  const ehFinalizado =
    finalizado === true ||
    venda.__finalizado === true ||
    card?.dataset.finalizado === '1';

  if (ehFinalizado) modal.dataset.finalizado = '1';
  else delete modal.dataset.finalizado;

  modal.innerHTML = window.templateModalVenda(venda, formatarData, formatarHorario);

  montarBarraBadges(modal);

  // regra distrato: remove carnê
  if (venda.tipo_contrato === 'D') {
    modal.querySelectorAll('.modal-status .badge.Carne-Gerado').forEach(b => b.remove());
  }

  removerBadgesJaAplicadas(modal, venda);
  configurarClickBadges(modal, venda);
  configurarObservacao(modal, venda);

  // fechar (sem acumular listener)
  modal.onclick = (ev) => {
    if (ev.target === modal) modal.close();
    if (ev.target.closest('.close-modal')) modal.close();
  };

  modal.showModal();
}

async function aplicarBadgeNormal({ modal, venda, card, etapa, btn }) {
  venda.badges = venda.badges || {};
  venda.badges[etapa] = 1;

  // aplica visual no card
  aplicarBadgesNoCard(card, venda);

  // remove do modal
  if (btn) btn.remove();

  try {
    await registrarEtiqueta({
      etiqueta: etapa,
      usuario: ESTADO.usuarioId,
      id_lote: venda.id
    });

    atualizarContagem();

  } catch (err) {
    console.error('Erro ao registrar etiqueta:', err);

    // rollback simples: reabre o modal com o estado atual
    // (como esta função está no mesmo arquivo, ela enxerga abrirModalVenda)
    abrirModalVenda(venda, { finalizado: card.dataset.finalizado === '1' });
  }
}