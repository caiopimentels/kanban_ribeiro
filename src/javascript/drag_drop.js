/**
 * Drag & Drop:
 * - Desktop: HTML5 drag/drop
 * - Touch (iPad): long-press para arrastar (mantém scroll)
 */

import { isTouch } from './utils.js';
import { idxColuna, etapasAFrenteDo, ESTADO } from './estado.js';
import { atualizarEtapa, limparFrente } from './api.js';
import { atualizarContagem } from './board.js';
import { CONFIG } from './config.js';

let colunaOrigemDrag = null;

// ===== Desktop drag/drop (event delegation) =====

export function instalarDragDropDesktop() {
  document.addEventListener('dragstart', (e) => {
    const card = e.target.closest('.kanban-card');
    if (!card) return;

    card.classList.add('dragging');
    colunaOrigemDrag = card.closest('.kanban-column')?.id || null;

    if (e.dataTransfer) {
      e.dataTransfer.effectAllowed = 'move';
      e.dataTransfer.setData('text/plain', card.getAttribute('id_lote') || '1');
    }
  });

  document.addEventListener('dragend', (e) => {
    const card = e.target.closest('.kanban-card');
    if (!card) return;
    card.classList.remove('dragging');
    colunaOrigemDrag = null;
    atualizarContagem();
  });

  document.querySelectorAll('.kanban-cards').forEach(col => {
    col.addEventListener('dragover', (e) => {
      e.preventDefault();
      col.classList.add('cards-hover');
      if (e.dataTransfer) e.dataTransfer.dropEffect = 'move';
    });

    col.addEventListener('dragleave', () => col.classList.remove('cards-hover'));

    col.addEventListener('drop', async (e) => {
      col.classList.remove('cards-hover');

      const card = document.querySelector('.kanban-card.dragging');
      if (!card) return;

      const destino = col.closest('.kanban-column')?.id;
      const id_lote = card.getAttribute('id_lote');
      if (!destino || !id_lote) return;

      const origemId = colunaOrigemDrag || card.closest('.kanban-column')?.id;
      const origemContainer = origemId ? document.querySelector(`#${origemId} .kanban-cards`) : null;

      col.appendChild(card);

      try {
        const voltar = origemId && idxColuna(destino) < idxColuna(origemId);
        if (voltar) {
          const etapas = etapasAFrenteDo(destino);
          if (etapas.length) {
            await limparFrente({ usuario: ESTADO.usuarioId, id_lote, etapas });
          }
        }

        await atualizarEtapa({ etapa: destino, usuario: ESTADO.usuarioId, id_lote });
      } catch (err) {
        console.error('Falha ao mover. Voltando...', err);
        if (origemContainer) origemContainer.appendChild(card);
        alert('Não foi possível mover o contrato. Verifique a conexão e tente novamente.');
      } finally {
        atualizarContagem();
      }
    });
  });
}

// ===== Touch drag/drop (long press) =====
export function instalarDragDropTouch() {
  if (!isTouch()) return;

  let cardAtivo = null;
  let origemColuna = null;

  let holdTimer = null;
  let startX = 0, startY = 0;
  let arrastando = false;
  let pointerIdAtivo = null;

  const limparHover = () => {
    document.querySelectorAll('.kanban-cards').forEach(c => c.classList.remove('cards-hover'));
  };

  const limparHold = () => {
    if (holdTimer) clearTimeout(holdTimer);
    holdTimer = null;
  };

  const iniciarArrasto = (card, e) => {
    arrastando = true;
    cardAtivo = card;
    origemColuna = card.closest('.kanban-column')?.id || null;
    pointerIdAtivo = e.pointerId;

    // 🔥 quando vira drag, bloqueia scroll/gestos
    cardAtivo.style.touchAction = 'none';
    cardAtivo.classList.add('dragging');

    // 🔥 captura o pointer para não perder o gesto pro scroll
    try { cardAtivo.setPointerCapture(pointerIdAtivo); } catch {}
  };

  document.addEventListener('pointerdown', (e) => {
    if (e.pointerType !== 'touch') return;

    const card = e.target.closest('.kanban-card');
    if (!card) return;

    // ✅ até virar drag, mantém scroll normal
    card.style.touchAction = 'pan-y';

    arrastando = false;
    cardAtivo = null;
    origemColuna = null;
    pointerIdAtivo = null;

    startX = e.clientX;
    startY = e.clientY;

    limparHold();

    // ✅ segura X ms -> vira drag SEM soltar o dedo
    holdTimer = setTimeout(() => {
      iniciarArrasto(card, e);
    }, CONFIG.HOLD_MS_TOUCH);

  }, { passive: true }); // ok: a gente só bloqueia no MOVE quando virou drag

  document.addEventListener('pointermove', (e) => {
    if (e.pointerType !== 'touch') return;

    // ainda não virou drag: se mexeu muito, era scroll -> cancela hold
    if (!arrastando) {
      const dx = Math.abs(e.clientX - startX);
      const dy = Math.abs(e.clientY - startY);
      if (dx > CONFIG.MOVE_TOL_TOUCH || dy > CONFIG.MOVE_TOL_TOUCH) {
        limparHold();
      }
      return;
    }

    // ✅ virou drag: agora bloqueia scroll
    e.preventDefault();

    const el = document.elementFromPoint(e.clientX, e.clientY);
    const coluna = el?.closest('.kanban-cards');

    limparHover();
    if (coluna) coluna.classList.add('cards-hover');

  }, { passive: false });

  async function finalizar(e) {
    if (e.pointerType !== 'touch') return;

    // se não virou drag, só limpa timer
    if (!arrastando || !cardAtivo) {
      limparHold();
      return;
    }

    e.preventDefault();
    limparHold();

    const el = document.elementFromPoint(e.clientX, e.clientY);
    const coluna = el?.closest('.kanban-cards');

    // limpa UI
    cardAtivo.classList.remove('dragging');
    limparHover();

    // restaura scroll normal no card
    cardAtivo.style.touchAction = 'pan-y';

    // solta pointer capture
    try { cardAtivo.releasePointerCapture(pointerIdAtivo); } catch {}

    if (coluna) {
      const destino = coluna.closest('.kanban-column')?.id;
      const id_lote = cardAtivo.getAttribute('id_lote');

      if (destino && id_lote) {
        coluna.appendChild(cardAtivo);

        try {
          const voltar = origemColuna && idxColuna(destino) < idxColuna(origemColuna);
          if (voltar) {
            const etapas = etapasAFrenteDo(destino);
            if (etapas.length) {
              await limparFrente({ usuario: ESTADO.usuarioId, id_lote, etapas });
            }
          }

          await atualizarEtapa({ etapa: destino, usuario: ESTADO.usuarioId, id_lote });

        } catch (err) {
          console.error('Erro ao mover (touch):', err);
        } finally {
          atualizarContagem();
        }
      }
    }

    // reset estado
    arrastando = false;
    cardAtivo = null;
    origemColuna = null;
    pointerIdAtivo = null;
  }

  document.addEventListener('pointerup', finalizar, { passive: false });

  document.addEventListener('pointercancel', (e) => {
    limparHold();
    limparHover();

    if (cardAtivo) {
      cardAtivo.classList.remove('dragging');
      cardAtivo.style.touchAction = 'pan-y';
      try { cardAtivo.releasePointerCapture(pointerIdAtivo); } catch {}
    }

    arrastando = false;
    cardAtivo = null;
    origemColuna = null;
    pointerIdAtivo = null;

  }, { passive: true });
}