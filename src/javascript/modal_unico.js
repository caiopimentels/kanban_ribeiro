/**
 * Modal único:
 * - Renderiza o HTML do modal ao clicar no card
 * - Remove badges já aplicadas (pela fonte real: venda.badges)
 * - Salva observação sem reload
 */

import { formatarData, formatarHorario, normalizarClasseBadge } from './utils.js';
import { registrarEtiqueta, salvarObservacao, enviarContratoD4SignStream} from './api.js';
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

  // regra: se já tem físico ou digital (inclui manual), remove os dois botões
  if (existentes.has('contrato-fisico') || existentes.has('contrato-digital') || existentes.has('contrato-digital-manual')) {
    modal.querySelectorAll('.modal-status .badge.contrato-fisico, .modal-status .badge.contrato-digital')
      .forEach(b => b.remove());
  }
}

function configurarObservacao(modal, venda) {
  const campo = modal.querySelector('.observacao-input');
  if (!campo) return;

  const algumFinalizado = !!document.querySelector(
    `.kanban-card[id_lote="${venda.id}"][data-finalizado="1"]`
  );

  const finalizado =
    modal.dataset.finalizado === '1' || algumFinalizado;

  if (finalizado) {
    campo.disabled = true;
    campo.classList.add('obs-bloqueada');
    return;
  }

  campo.disabled = false;
  campo.classList.remove('obs-bloqueada');

  const valorOriginal = campo.value;

  const salvar = async () => {
    const texto = campo.value.trim();

    if (texto === valorOriginal.trim()) return;

    try {
      await salvarObservacao({
        id_lote: venda.id,
        usuario: ESTADO.usuarioId,
        observacao: texto
      });

      const cards = document.querySelectorAll(
        `.kanban-card[id_lote="${venda.id}"]`
      );

      cards.forEach(c => {
        c.dataset.obs = texto;
        if (c._venda) c._venda.OBS = texto;
      });

    } catch (err) {
      console.error('Erro ao salvar observação:', err);
    }
  };

  campo.addEventListener('blur', salvar);

  campo.addEventListener('keydown', (e) => {
    if (e.key === 'Escape') {
      campo.value = valorOriginal;
      campo.blur();
    }
  });
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
    // 1️⃣ DIGITAL → abre modal de envio D4Sign
    // - Só aplica a etiqueta se o D4Sign confirmar recebimento
    // - Permite "Digital (manual)" se o envio falhar / já foi enviado fora
    // ============================
    if (etapa === 'contrato-digital') {
      abrirModalD4Sign({ venda, modalVenda: modal, cardVenda: card, btnDigital: btn });
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

// modal_unico.js (arquivo inteiro)

// ===================================================
// D4SIGN MODAL - bind único + sem refresh
// ===================================================

let vendaAtualContexto = null;

export function abrirModalD4Sign(contexto) {
  console.log("[D4SIGN] CONTEXTO:", contexto);
  const venda = contexto?.venda || contexto;

  if (!venda) {
    console.error("[D4SIGN] sem venda no contexto:", contexto);
    alert("Não encontrei os dados da venda para envio.");
    return;
  }

  // ✅ campos reais do seu objeto
  const id_lote = venda.id_lote;               // ex: 953
  const lote = venda.lote || "";               // ex: QE-03
  const clienteRaw = venda.cliente || "";      // ex: "1220 - EDILSON ..."
  const vendedorRaw = venda.vendedor || "";    // ex: "52 - ALINE ..."
  const id_venda = venda.id || "";    // ex: "52 - ALINE ..."

  // nome do cliente (sem "1220 - ")
  const cliente_nome =
    clienteRaw.replace(/^\s*\d+\s*-\s*/i, "").trim() || clienteRaw.trim();

  // codvendedor (pega o número antes do hífen)
  const codvendedor = (vendedorRaw.match(/^\s*(\d+)\s*-/)?.[1] || "").trim();

  // ✅ contexto global usado pela etiqueta
  vendaAtualContexto = { id_lote, lote, cliente_nome, codvendedor, venda, id_venda };

  const dlg = document.getElementById("d4sign-modal");
  if (!dlg) return;

  const form = dlg.querySelector("#d4sign-form");
  const btnManual = dlg.querySelector("#d4_manual_btn");
  const btnEnviar = dlg.querySelector("#d4_enviar");
  const filePdf = dlg.querySelector("#d4_pdf");

  const statusEl = dlg.querySelector("#d4_status");
  const barEl = dlg.querySelector("#d4_bar");

  if (!form) return;

  const sleep = (ms) => new Promise((r) => setTimeout(r, ms));

  function setProgress(pct, msg) {
    if (barEl) barEl.style.width = `${pct}%`;
    if (statusEl) statusEl.textContent = msg || "";
  }

  function setLoading(loading) {
    if (btnEnviar) btnEnviar.disabled = loading;
    if (btnManual) btnManual.disabled = loading;
    dlg.dataset.locked = loading ? "1" : "0";
  }

  // ✅ impedir ESC enquanto envia (bind único)
  if (!dlg.dataset.cancelBound) {
    dlg.addEventListener("cancel", (e) => {
      if (dlg.dataset.locked === "1") e.preventDefault();
    });
    dlg.dataset.cancelBound = "1";
  }

  // ✅ evitar bind duplicado de submit
  if (form.dataset.bound === "1") {
    setProgress(0, "Aguardando envio...");
    dlg.showModal();
    return;
  }
  form.dataset.bound = "1";

  window.closeD4Modal = () => {
    if (dlg.dataset.locked === "1") return;
    dlg.close();
  };

  form.addEventListener("submit", async (ev) => {
    ev.preventDefault();
    ev.stopPropagation();

    try {
      if (!id_lote) {
        console.error("[D4SIGN] venda sem id_lote:", venda);
        alert("Esta venda não tem id_lote. Verifique o mapeamento do backend.");
        return;
      }

      if (!filePdf?.files?.[0]) {
        alert("Selecione o PDF do contrato.");
        return;
      }

      const fd = new FormData();
      fd.append("pdf", filePdf.files[0]);

      // ✅ dados certos para o backend montar o nome do arquivo
      fd.append("id_lote", String(id_lote));
      fd.append("codvendedor", codvendedor || "");
      fd.append("cliente_nome", cliente_nome || "");
      fd.append("lote", lote || "");

      // campos do formulário
      const vendedorEmail = dlg.querySelector("#d4_email_vendedor")?.value || "";
      const compradoresEmails = dlg.querySelector("#d4_emails_compradores")?.value || "";
      const cofre = dlg.querySelector("#d4_cofre")?.value || "";

      fd.append("vendedor_email", vendedorEmail.trim());
      fd.append("compradores_emails", compradoresEmails.trim());
      fd.append("cofre_key", cofre.trim());

      setLoading(true);
      setProgress(2, "Iniciando envio...");

      // ✅ usa API padrão com stream
      const final = await enviarContratoD4SignStream(fd, (pct, msg) => {
        setProgress(pct, msg);
      });

      if (!final?.ok) throw new Error(final?.error || "Falha no envio.");

      setProgress(98, "Registrando etiqueta no Kanban...");
      await aplicarEtiquetaDigital({ manual: false });

      setProgress(100, "✅ Sucesso! Atualizando...");
      await sleep(2500);
      location.reload();
    } catch (e) {
      console.error("[D4SIGN] erro:", e);
      alert(e?.message || "Erro ao enviar para o D4Sign.");
    } finally {
      setLoading(false);
    }
  });

  // ✅ bind único do manual (senão duplica ao abrir o modal várias vezes)
  if (btnManual && !btnManual.dataset.bound) {
    btnManual.addEventListener("click", async (ev) => {
      ev.preventDefault();
      ev.stopPropagation();
      if (dlg.dataset.locked === "1") return;

      try {
        if (!id_lote) {
          alert("Esta venda não tem id_lote. Não consigo marcar etiqueta.");
          return;
        }

        setLoading(true);
        setProgress(95, "Registrando etiqueta (manual)...");
        await aplicarEtiquetaDigital({ manual: true });

        setProgress(100, "✅ Marcado! Atualizando...");
        await sleep(2500);
        location.reload();
      } catch (e) {
        console.error("[D4SIGN] manual erro:", e);
        alert(e?.message || "Erro ao marcar manual.");
      } finally {
        setLoading(false);
      }
    });

    btnManual.dataset.bound = "1";
  }

  setProgress(0, "Aguardando envio...");
  dlg.showModal();
}

async function aplicarEtiquetaDigital({ manual = false } = {}) {
  const usuario = document.getElementById("txtLogin")?.value || "";
  const id_venda = vendaAtualContexto?.id_venda; // backend espera como "id_lote"

  if (!id_venda) throw new Error("id_venda não encontrado para registrar etiqueta.");
  if (!usuario) throw new Error("usuário não encontrado (txtLogin).");

  // 1) sempre registra contrato-digital (mesmo no manual)
  await registrarEtiqueta({
    etiqueta: "contrato-digital",
    usuario,
    id_lote: id_venda,
  });

  // 2) regra nova: ao marcar Digital, marca Autenticado também
  await registrarEtiqueta({
    etiqueta: "Autenticado",
    usuario,
    id_lote: id_venda,
  });

  // Atualiza memória local (pra UI não “desgrudar” antes do reload)
  try {
    const venda = vendaAtualContexto?.venda;
    if (venda) {
      venda.badges = venda.badges || {};
      venda.badges["contrato-digital"] = 1;
      venda.badges["Autenticado"] = 1;
    }
  } catch {}

  return true;
}