window.templateCardVenda = function (venda, descricao) {
  return  `
          <div class="badge-cards"></div>
          <div class="dados-card">
            <p class="card-title">${venda.cliente_abreviado} (${venda.lote})</p>
            <div class="card-dados">
              <div class="card-empreendimento">${descricao}</div>
              <div class="card-corretor">${venda.vendedor}</div>
            </div>
          </div>`;
}
