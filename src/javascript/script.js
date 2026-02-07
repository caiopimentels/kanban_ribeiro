document.addEventListener('DOMContentLoaded', () => {
  puxarvendas();
});

/*
const API_BASE = location.hostname.startsWith('192.168.') || location.hostname === '10.10.10.5'
  ? 'http://192.168.1.5:5010' 
  : 'http://madribeiro.ddns.net:5010';

const USUARIO_ID = document.getElementById('txtLogin').value;
*/
const API_BASE = 'http://192.168.2.63:5010';

const USUARIO_ID = 40

const colunas = [
  { id: 'lotes-bloqueados',     nome: 'Bloqueados' },
  { id: 'contrato-gerado',      nome: 'Contrato Gerado' },
  { id: 'assinado-cliente',     nome: 'Assinado Cliente' },
  { id: 'aguardando-retirada',  nome: 'Aguardando Retirada' },
  { id: 'entregue',             nome: 'Entregue' }
];

function idxCol(id) { return colunas.findIndex(c => c.id === id); }

let filtroColunaAlvo = null;
const estadoFiltros = {};

function atualizarContagem() {
  colunas.forEach(coluna => {
    const colunaElemento = document.getElementById(coluna.id);
    if (!colunaElemento) return;
    const titulo = colunaElemento.querySelector('h2');
    const visiveis = Array.from(colunaElemento.querySelectorAll('.kanban-card'))
      .filter(c => window.getComputedStyle(c).display !== 'none');
    if (titulo) titulo.innerText = `${coluna.nome} (${visiveis.length})`;
  });
}

let colunaOrigemDoDrag = null;

function handleDragStart(e){
  e.currentTarget.classList.add('dragging');
  colunaOrigemDoDrag = e.currentTarget.closest('.kanban-column')?.id || null;
}
function handleDragEnd(e){
  e.currentTarget.classList.remove('dragging');
  colunaOrigemDoDrag = null;
  location.reload();
  atualizarContagem();
}

function handleDragOver(e)  { e.preventDefault(); e.currentTarget.classList.add('cards-hover'); }
function handleDragLeave(e) { e.currentTarget.classList.remove('cards-hover'); }

async function handleDrop(e){
  e.currentTarget.classList.remove('cards-hover');
  const dragCard = document.querySelector('.kanban-card.dragging');
  if(!dragCard) return;

  const colunaDestino = e.currentTarget.closest('.kanban-column')?.id;
  const id_lote = dragCard.getAttribute('id_lote');
  if(!colunaDestino || !id_lote) return;

  e.currentTarget.appendChild(dragCard);

  try{
    const voltar = colunaOrigemDoDrag && idxCol(colunaDestino) < idxCol(colunaOrigemDoDrag);
    if (voltar) {
      const etapas = etapasAFrenteDo(colunaDestino);
      if (etapas.length) {
        await limparFrenteNoServidor({ usuario: USUARIO_ID, id_lote, etapas });
      }
    }
    await atualizarEtapaNoServidor({ etapa: colunaDestino, usuario: USUARIO_ID, id_lote });
  } catch(err) {

  } finally {
    atualizarContagem();
  }
}


function adicionarListenersCards() {
  document.querySelectorAll('.kanban-card').forEach(card => {
    card.removeEventListener('dragstart', handleDragStart);
    card.removeEventListener('dragend', handleDragEnd);
    card.addEventListener('dragstart', handleDragStart);
    card.addEventListener('dragend', handleDragEnd);

    card.removeEventListener('click', abrirModal);
    card.addEventListener('click', abrirModal);
  });
}
function adicionarListenersColunas() {
  document.querySelectorAll('.kanban-cards').forEach(column => {
    column.removeEventListener('dragover', handleDragOver);
    column.removeEventListener('dragleave', handleDragLeave);
    column.removeEventListener('drop', handleDrop);

    column.addEventListener('dragover', handleDragOver);
    column.addEventListener('dragleave', handleDragLeave);
    column.addEventListener('drop', handleDrop);
  });
}

function abrirModal(e) {
  const modalId = e.currentTarget.getAttribute('data-modal');
  const modal = document.getElementById(modalId);
  if (modal) modal.showModal();
}
function adicionarListenersFecharModais() {
  document.querySelectorAll('.close-modal').forEach(button => {
    button.onclick = () => {
      const modalId = button.getAttribute('data-modal');
      const modal = document.getElementById(modalId);
      if (modal) modal.close();
    };
  });
}

function modalstatus() {
  document.querySelectorAll('dialog .modal-status .badge').forEach(badge => {
    badge.onclick = async (event) => {
      const badgeEl = event.currentTarget;
      const modal = badgeEl.closest('dialog');
      if (!modal) return;

      const modalId = modal.id;
      const card = document.querySelector(`.kanban-card[data-modal="${modalId}"]`);
      if (!card) return;

      const badgeCards = card.querySelector('.badge-cards');
      if (!badgeCards) return;

      const etapa = badgeEl.classList[1];
      const id_lote = card.getAttribute('id_lote');

      if (etapa === 'contrato-fisico'){
        const digitalNoModal = modal.querySelector('.modal-status .badge.contrato-digital');
        if (digitalNoModal) digitalNoModal.remove();
          const jaTemImpresso = badgeCards.querySelector('.badge.Impresso');
        if (!jaTemImpresso) {
          const impBtn = modal.querySelector('.modal-status .badge.Impresso');
          if (impBtn) {
            setTimeout(() => impBtn.click(), 0);
         }
       }
      }

      if (etapa === 'contrato-digital'){
        const fisicoNoModal = modal.querySelector('.modal-status .badge.contrato-fisico');
        if (fisicoNoModal) fisicoNoModal.remove();
          const jaTemAutenticado = badgeCards.querySelector('.badge.Autenticado');
        if (!jaTemAutenticado) {
          const autBtn = modal.querySelector('.modal-status .badge.Autenticado');
          if (autBtn) {
            setTimeout(() => autBtn.click(), 0);
         }
       }
      }

      const cloned = badgeEl.cloneNode(true);
      badgeCards.appendChild(cloned);
      badgeEl.style.display = 'none';

      try {
        await registrarEtiquetaNoServidor({ etiqueta: etapa, usuario: USUARIO_ID, id_lote });
        cloned.onclick = badge.onclick;
        location.reload();
      } catch (err) {
        cloned.remove();
        badgeEl.style.display = '';
      }

      atualizarContagem();
    };
  });
  atualizarContagem();
}

(function ensureChipCSS(){
  if (document.getElementById('chipify-style')) return;
  const st = document.createElement('style');
  st.id = 'chipify-style';
  document.head.appendChild(st);
})();

function chipifyById(id, options, initial=[]) {
  const original = document.getElementById(id);
  if (!original) return null;

  const placeholder = original.getAttribute('placeholder') || '';
  const cls = original.className || '';
  const cs = getComputedStyle(original);

  const wrapper = document.createElement('div');
  wrapper.id = id;
  wrapper.className = (cls ? cls + ' ' : '') + 'chip-field';
  wrapper.style.border = cs.border;
  wrapper.style.borderRadius = cs.borderRadius;
  wrapper.style.background = cs.backgroundColor;
  wrapper.style.width = cs.width;
  wrapper.style.maxHeight = cs.maxHeight;
  wrapper.style.padding = cs.padding;
  wrapper.style.boxShadow = cs.boxShadow;

  original.parentNode.insertBefore(wrapper, original);

  const tag = original.tagName.toLowerCase();
  let optionList = Array.isArray(options) ? [...options] : [];
  if (tag === 'select' && !optionList.length) {
    optionList = Array.from(original.options).map(o => o.value).filter(Boolean);
  }
  original.remove();

  const chipBox = document.createElement('div');
  chipBox.className = 'chip-box';
  wrapper.appendChild(chipBox);

  const input = document.createElement('input');
  input.type = 'text';
  input.className = 'chip-input';
  input.placeholder = placeholder;
  chipBox.appendChild(input);

  const dd = document.createElement('div');
  dd.className = 'chipify-dd ' + cls;
  wrapper.appendChild(dd);

  function getValores(){ return Array.from(chipBox.querySelectorAll('.chip')).map(c => c.dataset.value); }

  function renderDropdown(f=''){
    const lista = optionList
      .filter(v => !getValores().includes(v))
      .filter(v => (v||'').toLowerCase().includes((f||'').toLowerCase()));
    dd.innerHTML = '';
    if (!lista.length){ dd.style.display='none'; return; }
    lista.forEach(txt => {
      const item = document.createElement('div');
      item.className = 'chipify-dd-item';
      item.textContent = txt;
      item.onclick = () => { addChip(txt, {keepFocus:true, keepDD:true}); };
      dd.appendChild(item);
    });
    dd.style.display = 'block';
  }

  function addChip(valor, opts={}){
    valor = (valor||'').trim();
    if (!valor || getValores().includes(valor)){ if(opts.keepFocus) input.focus(); if(opts.keepDD) renderDropdown(input.value); return; }
    const chip = document.createElement('span');
    chip.className = 'chip';
    chip.dataset.value = valor;
    chip.textContent = valor;
    const x = document.createElement('button');
    x.type='button'; x.textContent='×'; x.title='Remover';
    x.onclick = () => { chip.remove(); input.focus(); renderDropdown(input.value); };
    chip.appendChild(x);
    chipBox.insertBefore(chip, input);
    input.value='';
    if(opts.keepFocus) input.focus();
    if(opts.keepDD) renderDropdown('');
  }

  (initial||[]).forEach(v => addChip(v));

  input.addEventListener('focus', () => renderDropdown(input.value));
  input.addEventListener('input', () => renderDropdown(input.value));
  input.addEventListener('keydown', (e) => {
    if ((e.key === 'Enter' || e.key === ',' || e.key === 'Tab') && input.value.trim()){
      e.preventDefault();
      addChip(input.value.trim(), {keepFocus:true, keepDD:true});
    }
    if (e.key === 'Backspace' && !input.value && chipBox.querySelectorAll('.chip').length){
      e.preventDefault();
      const chips = chipBox.querySelectorAll('.chip');
      chips[chips.length-1].remove();
      renderDropdown(input.value);
    }
  });
  document.addEventListener('click', (ev)=>{ if(!wrapper.contains(ev.target)) dd.style.display='none'; });

  return { getValores, setOpcoes:(ops)=>{ optionList=[...(ops||[])]; renderDropdown(input.value); }, focus:()=>input.focus() };
}

function coletarOpcoesDosCards(tipo, colunaId = null) {
  const escopo = colunaId ? document.querySelector(`#${colunaId}`) : document;
  const set = new Set();
  if (tipo === 'corretor') {
    const cards = escopo.querySelectorAll('.kanban-card');
    cards.forEach(card => {
      const el = card.querySelector('.card-corretor');
      let t = (el?.innerText || '').trim();
      if (!t) {
        const ttl = (card.querySelector('.card-title')?.innerText || '').trim();
        if (ttl.includes('(')) t = ttl.split('(')[0].trim();
        else t = ttl;
      }
      if (t) set.add(t);
    });
  } else if (tipo === 'empreendimento') {
    escopo.querySelectorAll('.kanban-card .card-empreendimento').forEach(el => { const t=(el.innerText||'').trim(); if (t) set.add(t); });
  } else if (tipo === 'etiqueta') {
    escopo.querySelectorAll('.kanban-card .badge-cards .badge').forEach(b => { const t=(b.innerText||'').trim(); if (t) set.add(t); });
  }
  return Array.from(set).sort((a,b)=>a.localeCompare(b,'pt-BR'));
}

let chipCorretor, chipEmpreendimento, chipEtiqueta;

function adicionarListenersFiltros() {
  document.querySelectorAll('.kanban-column .add-card i.fa-filter').forEach(icon => {
    icon.onclick = abrirFiltroModal;
  });

const aplicar = document.getElementById('filtro-actions');
if (aplicar) {
  aplicar.onclick = async (e) => {
    e.preventDefault();

    try {
      if (filtroColunaAlvo === 'entregue') {
        const mostrarFinalizados = document.getElementById('mostrar-finalizados').checked;

        if (mostrarFinalizados) {
          // Busca finalizados na sua rota Flask
          const res = await fetch(`${API_BASE}/entregues/finalizados`, {method: 'GET', headers: {'Authorization': 'Bearer ' + window.KANBAN_TOKEN},});
          if (!res.ok) throw new Error('Falha ao buscar finalizados');
          const vendasFinalizadas = await res.json();

          // Renderiza só a coluna de entregues com os finalizados
          renderizarEntreguesFinalizados(vendasFinalizadas);
        } else {
          // Restaura o board padrão
          document.querySelector('#entregue .kanban-cards').innerHTML = '';
          // Recarrega tudo (sua função já preenche todas as colunas)
          // Se quiser otimizar, poderia só repintar entregues a partir de /vendas
          document.querySelectorAll('.kanban .kanban-cards').forEach(c=> c.innerHTML='');
          await puxarvendas();
        }
      }

      // aplica também os demais filtros locais (corretor, data, etc.)
      await aplicarFiltro();

    } catch (err) {
      console.error('Erro ao aplicar filtro de entregues:', err);
      alert('Erro ao atualizar entregues/finalizados. Veja o console.');
    } finally {
      document.getElementById('filtro-modal').close();
    }
  };
  atualizarContagem();
}

}

function abrirFiltroModal(e) {
  const filtroModal = document.getElementById('filtro-modal');
  const campoFinalizados = document.getElementById('campo-finalizados');
  const campoEtiquetas = document.querySelector('.filter-etiquetas');

  const btn = e.currentTarget.closest('button');
  const coluna = btn.closest('.kanban-column');
  filtroColunaAlvo = coluna?.id || null;

  campoFinalizados.style.display = (filtroColunaAlvo === 'entregue') ? 'block' : 'none';
  const semEtiqueta = (filtroColunaAlvo === 'lotes-bloqueados');
  if (campoEtiquetas) campoEtiquetas.style.display = semEtiqueta ? 'none' : '';

  const s = estadoFiltros[filtroColunaAlvo] || {};
  document.getElementById('mostrar-finalizados').checked = !!s.mostrarFinalizados;
  document.getElementById('filtro-data-inicio').value = s.dataInicio || '';
  document.getElementById('filtro-data-final').value  = s.dataFinal  || '';

  const opCorretor = coletarOpcoesDosCards('corretor', filtroColunaAlvo);
  const opEmp      = coletarOpcoesDosCards('empreendimento', filtroColunaAlvo);
  const opEtiq     = semEtiqueta ? [] : coletarOpcoesDosCards('etiqueta', filtroColunaAlvo);

  chipCorretor       = chipifyById('filtro-corretor',       opCorretor, s.corretores || []);
  chipEmpreendimento = chipifyById('filtro-empreendimento', opEmp,      s.empreendimentos || []);
  chipEtiqueta        = semEtiqueta ? null : chipifyById('filtro-etiquetas', opEtiq, s.etiquetas || []);

  filtroModal.showModal();
}

async function aplicarFiltro() {
  if (!filtroColunaAlvo) return;

  const mostrarFinalizados = document.getElementById('mostrar-finalizados').checked;
  const dataInicio = document.getElementById('filtro-data-inicio').value;
  const dataFinal  = document.getElementById('filtro-data-final').value;

  const corretores      = (chipCorretor?.getValores() || []).map(v=>v.toLowerCase());
  const empreendimentos = (chipEmpreendimento?.getValores() || []).map(v=>v.toLowerCase());
  const etiquetasRaw    = chipEtiqueta ? (chipEtiqueta.getValores() || []) : [];
  const etiquetas       = (filtroColunaAlvo === 'lotes-bloqueados') ? [] : etiquetasRaw;

  estadoFiltros[filtroColunaAlvo] = { mostrarFinalizados, dataInicio, dataFinal, corretores, empreendimentos, etiquetas };

  const cards = Array.from(document.querySelectorAll(`#${filtroColunaAlvo} .kanban-card`));

  const toYMD = (iso) => {
    if (!iso) return '';
    const d = new Date(iso);
    if (isNaN(d)) return '';
    const y = d.getFullYear();
    const m = String(d.getMonth()+1).padStart(2,'0');
    const da= String(d.getDate()).padStart(2,'0');
    return `${y}-${m}-${da}`;
  };
  const normBadge = (v)=> v.normalize('NFD').replace(/[\u0300-\u036f]/g,'').replace(/\s+/g,'-');

  cards.forEach(card => {
    card.style.removeProperty('display'); 

    if (filtroColunaAlvo === 'entregue' && !mostrarFinalizados) {
      if (card.classList.contains('oculto-por-filtro')) { 
        const obs = (card.dataset.obs || '').trim();

        if (obs.length >= 10) {
        card.style.display = 'none'; return; }}
    }

    if (corretores.length) {
      let txt = (card.querySelector('.card-corretor')?.innerText || '').toLowerCase();
      if (!txt) {
        const ttl = (card.querySelector('.card-title')?.innerText || '').toLowerCase();
        txt = ttl.includes('(') ? ttl.split('(')[0].trim() : ttl;
      }
      if (!corretores.some(c => txt.includes(c))) { card.style.display='none'; return; }
    }
    if (empreendimentos.length) {
      const txt = (card.querySelector('.card-empreendimento')?.innerText || '').toLowerCase();
      if (!empreendimentos.some(e => txt.includes(e))) { card.style.display='none'; return; }
    }
    if (etiquetas.length && filtroColunaAlvo !== 'lotes-bloqueados') {
      const ok = etiquetas.some(et => card.querySelector(`.badge-cards .badge.${CSS.escape(normBadge(et))}`));
      if (!ok) { card.style.display='none'; return; }
    }
    if (dataInicio || dataFinal) {
      const raw = (filtroColunaAlvo === 'lotes-bloqueados') ? card.dataset.dataBloqueio : card.dataset.dataVenda;
      const ymd = toYMD(raw);
      if (!ymd) { card.style.display='none'; return; }
      if (dataInicio && ymd < dataInicio) { card.style.display='none'; return; }
      if (dataFinal  && ymd > dataFinal)  { card.style.display='none'; return; }
    }
  });

  atualizarContagem();
}

function determinarcoluna(venda) {
  if (venda.colunas?.entregue?.data) return 'entregue';
  if (venda.colunas?.['aguardando-retirada']?.data) return 'aguardando-retirada';
  if (venda.colunas?.['assinado-cliente']?.data) return 'assinado-cliente';
  return 'contrato-gerado';
}

function formatarData(dataIso) {
  const data = new Date(dataIso);
  const dia = String(data.getUTCDate()).padStart(2, '0');
  const mes = String(data.getUTCMonth() + 1).padStart(2, '0');
  const ano = data.getUTCFullYear();
  return `${dia}/${mes}/${ano}`;
}

function formatarhorario(dataIso) {
  const data = new Date(dataIso);
  const hora = String(data.getUTCHours()).padStart(2, '0');
  const minutos = String(data.getUTCMinutes()).padStart(2, '0');
  const segundos = String(data.getUTCSeconds()).padStart(2, '0');
  return `${hora}:${minutos}:${segundos}`;
}

function puxarvendas() {
  fetch(`${API_BASE}/vendas`,{
    headers: {
    'Authorization': 'Bearer ' + window.KANBAN_TOKEN
  }
  })
    .then(res => res.json())
    .then(vendas => {
      vendas.forEach(venda => {
        const colunaId = determinarcoluna(venda);
        const kanban = document.querySelector(`#${colunaId} .kanban-cards`);
        let descricao = ''

        if (!kanban) return;

        let empreendimento = venda.fantasia
        if (empreendimento.startsWith("LOTEAMENTO")){
          empreendimento = `LOT. ${empreendimento.split(" ").slice(1).join(" ")}`
        }

        if (venda.tipo_contrato === 'V') {
          descricao = `VENDA - ${empreendimento || ''}`;
        } else if (venda.tipo_contrato === 'T') {
          descricao = `TRANSFERENCIA - ${empreendimento || ''}`;
        } else if (venda.tipo_contrato === 'D') {
          descricao = `DISTRATO - ${empreendimento || ''}`;
        }

        const parte = venda.parte ? `/${venda.parte}` : "";
        
        
        let tipoVal = (venda.tipo_contrato || '').trim().toUpperCase();
        if (tipoVal === '') {
            tipoVal = 'V';
        }
        
        
        const tipoEspecial = `[${tipoVal}] `; 
        
        const nomeVendedor = venda.vendedor ? `(${venda.vendedor}) ` : '';
        const tituloCard = `${tipoEspecial}${nomeVendedor}${venda.cliente} (${venda.lote})`;

        const card = document.createElement('div');
        card.className = 'kanban-card';

        card.setAttribute('draggable', 'true');
        card.setAttribute('data-modal', `modal-${venda.id || 'novo'}`);
        card.setAttribute('id_lote', venda.id);
        card.dataset.obs = (venda.OBS || '').trim();
        if (venda.dt_compra) card.dataset.dataVenda = venda.dt_compra;
        
        card.innerHTML = window.templateCardVenda(venda, descricao);

        const badge_status = document.createElement('div');

        badge_status.innerHTML = `
          <div class="modal-status">
            <div class="badge Autenticado"><span>Autenticado</span></div>
            <div class="badge Pagamento-OK"><span>Pagamento OK</span></div>
            <div class="badge Carne-Gerado"><span>Carnê Gerado</span></div>
            <div class="badge Digitalizado"><span>Digitalizado</span></div>
            <div class="badge contrato-fisico"><span>Fisico</span></div>
            <div class="badge contrato-digital"><span>Digital</span></div>
            <div class="badge Impresso"><span>Impresso</span></div>
          </div>`;

        const modal = document.createElement('dialog');
        modal.id = `modal-${venda.id}`;
        modal.innerHTML = window.templateModalVenda(
          venda,
          formatarData,
          formatarhorario
        );
        
        modal.appendChild(badge_status);

        if (venda.tipo_contrato === 'D') {
          const carneBtn = modal.querySelector('.modal-status .badge.Carne-Gerado');
          if (carneBtn) carneBtn.remove();
        }

        adicionarListenerObservacao(modal);

        (function () {
          let entradaBruta = venda.entrada

          entradaBruta = String(entradaBruta).trim();

          if (!entradaBruta) return;

          const entradaNum = parseFloat(
            entradaBruta
              .replace(/\./g, '')
              .replace(',', '.')
          );

          if (!isNaN(entradaNum) && entradaNum > 0 && venda.tipo_contrato !== 'T' && venda.tipo_contrato !== 'D'){

            const badgeContainer = card.querySelector('.badge-cards');
            if (!badgeContainer) return;

            if (!badgeContainer.querySelector('.badge.Entrada-Confirmada')) {
              const badge = document.createElement('span');
              badge.className = 'badge Entrada-Confirmada';
              badge.textContent = 'Entrada Confirmada';
              badgeContainer.appendChild(badge);
            }
          }
        })();

        
        modal.addEventListener('click', e => { if (e.target.closest('.close-modal')) modal.close(); });

        kanban.appendChild(card);
        document.body.appendChild(modal);
        carregarbadges(venda)
      });

      
    

      puxarbloqueados();
      adicionarListenersCards();
      adicionarListenersColunas();
      modalstatus();
      adicionarListenersFecharModais();
      adicionarListenersFiltros();
      atualizarContagem();
    })
    .catch(err => console.error('Erro ao carregar vendas:', err));
}

function carregarbadges(venda){
  const dados = [{
    id_lote: venda.id,                 // 👈 NÃO muda
    badges: Object.keys(venda.badges || {}) // 👈 chave do objeto vira array
  }];
    const norm = s => (s || '').trim().replace(/\s+/g, '-'); // "Pagamento OK" -> "Pagamento-OK"
    const oppositeOf = s => s === 'contrato-fisico' ? 'contrato-digital' : (s === 'contrato-digital' ? 'contrato-fisico' : null);

    dados.forEach(item => {
      const card = document.querySelector(`.kanban-card[id_lote="${item.id_lote}"]`);
      if (!card) return;

      if (card.closest('#lotes-bloqueados')) return;

      const badgeContainer = card.querySelector('.badge-cards');
      const modalId = card.getAttribute('data-modal');
      const modal = document.getElementById(modalId);

      (item.badges || []).forEach(raw => {
        const etapa = norm(raw); // ex.: "Fisico", "Digital", "Pagamento-OK"

        // 1) Não criar duplicado no card
        if (!badgeContainer.querySelector(`.badge.${CSS.escape(etapa)}`)) {
          const badge = document.createElement('span');
          badge.className = `badge ${etapa}`;
          if (etapa === 'contrato-fisico') badge.textContent = 'Fisico';
          else if (etapa === 'contrato-digital') badge.textContent = 'Digital';
          else badge.textContent = etapa.replace(/-/g, ' ');
          badgeContainer.appendChild(badge);
        }

        if (etapa === 'Pagamento-OK') {
          const entradaBadge = badgeContainer.querySelector('.badge.Entrada-Confirmada');
          if (entradaBadge) entradaBadge.remove();
        }

        if (modal) {
          // 1) etapas normais: remove do modal
          if (!etapa.startsWith('contrato-')) {
            const thisBtn = modal.querySelector(`.modal-status .badge.${CSS.escape(etapa)}`);
            if (thisBtn) thisBtn.remove();
          }

          // 2) contrato: remove os dois do modal
          if (etapa.startsWith('contrato-')) {
            const btnFis = modal.querySelector('.modal-status .badge.contrato-fisico');
            if (btnFis) btnFis.remove();

            const btnDig = modal.querySelector('.modal-status .badge.contrato-digital');
            if (btnDig) btnDig.remove();
          }
        }

      });
    });
  }

function puxarbloqueados() {
  fetch(`${API_BASE}/bloqueado`, {
    headers: {
    'Authorization': 'Bearer ' + window.KANBAN_TOKEN
  }
  })
    .then(res => res.json())
    .then(vendas => {
      const coluna = document.querySelector('#lotes-bloqueados .kanban-cards');
      vendas.forEach(venda => {
        const card = document.createElement('div');
        card.className = 'kanban-card';
        card.setAttribute('draggable', 'true');
        card.setAttribute('id_lote', venda.id);
        if (venda.datasituacao) card.dataset.dataBloqueio = venda.datasituacao;

        card.innerHTML = `
          <div class="badge-cards"></div>
          <div class="dados-card">
            <p class="card-title">${venda.codvendedor} - ${venda.nome_vendedor} (${venda.quadra}-${venda.lote})</p>
            <div class="card-dados">
              <div class="card-empreendimento">${venda.fantasia || ''}</div>
              <div class="card-bloqueado">Data Bloqueio: ${formatarData(venda.datasituacao) + " " + formatarhorario(venda.datasituacao)}</div>
            </div>
          </div>`;
        coluna.appendChild(card);
      });
      atualizarContagem();
    });
}

async function atualizarEtapaNoServidor({ etapa, usuario, id_lote }) {
  const res = await fetch(`${API_BASE}/atualizar`, {
    method: 'POST',
    headers: { 'Content-Type':'application/json', 'Authorization': 'Bearer ' + window.KANBAN_TOKEN},
    body: JSON.stringify({ etapa, usuario, id_lote })
  });
  const data = await res.json().catch(()=> ({}));
  if (!res.ok) throw new Error(data?.error || `HTTP ${res.status}`);
  return data;
}

async function registrarEtiquetaNoServidor({ etiqueta, usuario, id_lote }) {
  // se seu backend aceita badges no /atualizar (mapeados), mantenha assim;
  // se tiver rota específica (/etiqueta), troque a URL aqui.
  const res = await fetch(`${API_BASE}/atualizar`, {
    method: 'POST',
    headers: { 'Content-Type':'application/json', 'Authorization': 'Bearer ' + window.KANBAN_TOKEN},
    body: JSON.stringify({ etapa: etiqueta, usuario, id_lote })
  });
  const data = await res.json().catch(()=> ({}));
  if (!res.ok) throw new Error(data?.error || `HTTP ${res.status}`);
  return data;
}

const ORDEM_ETAPAS = ['contrato-gerado','assinado-cliente','aguardando-retirada','entregue'];
function etapasAFrenteDo(destino) {
  const i = ORDEM_ETAPAS.indexOf(destino);
  return i < 0 ? [] : ORDEM_ETAPAS.slice(i+1);
}

function getEntregueContainer() {
  return document.querySelector('#entregue .kanban-cards');
}

function criarCardBasico(venda) {
        let empreendimento = venda.fantasia
        if (empreendimento.startsWith("LOTEAMENTO")){
          empreendimento = `LOT. ${empreendimento.split(" ").slice(1).join(" ")}`
        }

        if (venda.tipo_contrato === 'V') {
          descricao = `VENDA - ${empreendimento || ''}`;
        } else if (venda.tipo_contrato === 'T') {
          descricao = `TRANSFERENCIA - ${empreendimento || ''}`;
        } else if (venda.tipo_contrato === 'D') {
          descricao = `DISTRATO - ${empreendimento || ''}`;
        }
      
        
        let tipoVal = (venda.tipo_contrato || '').trim().toUpperCase();
        if (tipoVal === '') {
            tipoVal = 'V';
        }
        
        
        const tipoEspecial = `[${tipoVal}] `; 
        
        const nomeVendedor = venda.vendedor ? `(${venda.vendedor}) ` : '';
        const tituloCard = `${tipoEspecial}${nomeVendedor}${venda.cliente} (${venda.lote})`;

        const card = document.createElement('div');
        card.className = 'kanban-card';
        card.setAttribute('draggable', 'true');
        card.setAttribute('data-modal', `modal-${venda.id || 'novo'}`);
        card.setAttribute('id_lote', venda.id);
        if (venda.dt_compra) card.dataset.dataVenda = venda.dt_compra;

        card.innerHTML = window.templateCardVenda(venda, descricao);

        let modal = document.getElementById(`modal-${venda.id}`);
        if (!modal) {
          const modal = document.createElement('dialog');
          modal.id = `modal-${venda.id}`;
          modal.innerHTML = window.templateModalVenda(
            venda,
            formatarData,
            formatarhorario
          );

          modal.addEventListener('click', e => { if (e.target.closest('.close-modal')) modal.close(); });
          document.body.appendChild(modal);
        }

        return card;
      }
function renderizarEntreguesFinalizados(listaVendasFinalizadas) {
  const container = getEntregueContainer();
  if (!container) return;

  container.innerHTML = '';

  const existentes = {};
  document.querySelectorAll('.kanban-card[id_lote]').forEach(c => {
    existentes[c.getAttribute('id_lote')] = c;
  });

  listaVendasFinalizadas.forEach(venda => {
    let card = existentes[venda.id];
    if (!card) {

      card = criarCardBasico(venda);
    } else {
      card.setAttribute('data-modal', `modal-${venda.id}`);
      if (venda.data_compra) card.dataset.dataVenda = venda.data_compra;
    }

    container.appendChild(card);
    carregarbadges(venda)
  });

  adicionarListenersCards();
  adicionarListenersColunas();
  modalstatus();
  atualizarContagem();
}

function adicionarListenersModalEspecial() {
    const createBtn = document.querySelector('.create-card-btn');
    const modal = document.getElementById('create-special-modal');
    const form = document.getElementById('create-special-form');
    const submitBtn = document.getElementById('create-special-submit');
    const closeBtn = modal.querySelector('.close-modal');

    createBtn.onclick = () => {
        form.reset();
        modal.showModal();
    };

    closeBtn.onclick = () => modal.close();

    form.onsubmit = async (e) => {
        e.preventDefault();
        submitBtn.disabled = true;
        submitBtn.textContent = 'Consultando...';

        const id_lote = document.getElementById('create-codcli').value;
        const select = document.getElementById('create-tipo');
        const tipo = select.value;
        const tipoLabel = select.options[select.selectedIndex].text; 

        try {
            const consultaRes = await fetch(`${API_BASE}/consulta`, {
                method: 'POST',
                headers: { 'Content-Type': 'application/json', 'Authorization': 'Bearer ' + window.KANBAN_TOKEN},
                body: JSON.stringify({ id_lote })
            });

            if (!consultaRes.ok) throw new Error("Lote não encontrado");

            const arr = await consultaRes.json();
            const info = Array.isArray(arr) ? arr[0] : arr;

            const msg = 
`Confirma a criação do contrato de ${tipoLabel.toUpperCase()} para ${info.nome} do lote ${info.quadra}-\
${String(info.lote).padStart(2, '0')}${info.parte ? '/' + info.parte : ''} no ${info.empreendimento}?
`;

            if (!confirm(msg)) {
                submitBtn.disabled = false;
                submitBtn.textContent = 'Criar Contrato';
                return;
            }

            submitBtn.textContent = 'Criando...';

            const criarRes = await fetch(`${API_BASE}/criar-especial`, {
                method: 'POST',
                headers: { 'Content-Type': 'application/json', 'Authorization': 'Bearer ' + window.KANBAN_TOKEN},
                body: JSON.stringify({
                    tipo,
                    id_lote,
                    codcli: info.codcli,
                    usuario: USUARIO_ID
                })
            });

            if (!criarRes.ok) throw new Error("Erro ao criar");

            alert("Contrato especial criado com sucesso!");
            modal.close();
            location.reload();

        } catch (err) {
            alert("Erro: " + err.message);
        } finally {
            submitBtn.disabled = false;
            submitBtn.textContent = 'Criar Contrato';
        }
    };
}

adicionarListenersModalEspecial();


function adicionarListenerObservacao(modal) {
    const campo = modal.querySelector('.observacao-input');
    if (!campo) return;

    const id_lote = modal.id.replace('modal-', '');

    async function salvar() {
        const texto = campo.value.trim();

        try {
            await fetch(`${API_BASE}/observacao`, {
                method: "POST",
                headers: {
                    "Content-Type": "application/json",
                    "Authorization": "Bearer " + window.KANBAN_TOKEN
                },
                body: JSON.stringify({
                    id_lote,
                    usuario: USUARIO_ID,
                    observacao: texto
                })
            });

            // Atualiza o data-atribute do card pra usar depois no drop
            const card = document.querySelector(`.kanban-card[data-modal="${modal.id}"]`);
            if (card) {
                card.dataset.obs = texto;
                location.reload();
            }
        } catch (err) {
            console.error("Erro ao salvar observação:", err);
        }
    }

    
    // Saiu do campo → salva
    campo.addEventListener("blur", salvar);


    // ESC (evento cancel) → força fechar e salvar
    modal.addEventListener("cancel", (ev) => {
        ev.preventDefault(); // padrão do dialog é só fechar, vamos controlar
        modal.close();       // isso dispara o "close", que chama salvar()
    });

    // Clique fora do dialog → fecha e salva
    modal.addEventListener("click", (ev) => {
        if (ev.target === modal) {
            modal.close();   // idem, cai no "close"
        }
    });
}

