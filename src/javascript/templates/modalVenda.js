window.templateModalVenda = function (venda, formatarData, formatarhorario) {
  return  `
          <form>
            <button class="close-modal" data-modal="modal-${venda.id}" type="button">
              <i class="fa-solid fa-circle-xmark"></i>
            </button>
            <div class="modal-header">
              <h1 class="modal-title">
                ${venda.cliente} (${venda.lote})
              </h1>
            </div>
            <div class="modal-body">
              <div class="input-group">
                <div class="input-venda">
                  <label>Corretor:</label>
                  <input id="corretor" placeholder="${venda.vendedor}" disabled>
                  <label id="label-data">Data Venda:</label>
                  <input id="input-data" placeholder="${formatarData(venda.dt_compra)}" disabled>
                </div>
              </div>

              <div class="input-group">
                <label for="email">
                    Cadastro:
                </label>
                <input
                      id="email", 
                      name="email" 
                      placeholder="${venda.cadastro.user || ''} ${'Data: ' + formatarData(venda.cadastro.data) || ''} ${formatarhorario(venda.cadastro.data) || ''}"
                      disabled>
              </div>


              <div class="input-group">
                <label for="email">
                    Autenticação:
                </label>
                <input
                      id="email", 
                      name="email" 
                      placeholder="${
                        venda.badges?.autenticado
                          ? `${venda.badges.autenticado.user || ''} Data: ${
                              venda.badges.autenticado.data
                                ? formatarData(venda.badges.autenticado.data) + ' ' +
                                  formatarhorario(venda.badges.autenticado.data)
                                : ''
                            }`
                          : ''
                      }"
                      disabled>
              </div>

              <div class="input-group">
                  <label for="email">
                      Confirmação de Pagamento:
                  </label>
                  <input
                        id="email", 
                        name="email" 
                        placeholder="${
                          venda.badges?.['pagamento-OK']
                            ? `${venda.badges?.['pagamento-OK'].user || ''} Data: ${
                                venda.badges?.['pagamento-OK'].data
                                  ? formatarData(venda.badges?.['pagamento-OK'].data) + ' ' +
                                    formatarhorario(venda.badges?.['pagamento-OK'].data)
                                  : ''
                              }`
                            : ''
                        }"
                        disabled>
              </div>

              <div class="input-group">
                  <label for="email">
                      Carnê Gerado:
                  </label>
                  <input
                        id="email", 
                        name="email" 
                        placeholder="${
                          venda.badges?.['carne-gerado']
                            ? `${venda.badges?.['carne-gerado'].user || ''} Data: ${
                                venda.badges?.['carne-gerado'].data
                                  ? formatarData(venda.badges?.['carne-gerado'].data) + ' ' +
                                    formatarhorario(venda.badges?.['carne-gerado'].data)
                                  : ''
                              }`
                            : ''
                        }"
                        disabled>
              </div>

              <div class="input-group">
                  <label for="email">
                      Digitalização:
                  </label>
                  <input
                        id="email", 
                        name="email" 
                        placeholder="${
                          venda.badges?.digitalizado
                            ? `${venda.badges.digitalizado.user || ''} Data: ${
                                venda.badges.digitalizado.data
                                  ? formatarData(venda.badges.digitalizado.data) + ' ' +
                                    formatarhorario(venda.badges.digitalizado.data)
                                  : ''
                              }`
                            : ''
                        }"
                        disabled>
              </div>
              
              <div class="input-group">
                  <label for="email">
                      Impressão:
                  </label>
                  <input
                        id="email", 
                        name="email" 
                        placeholder="${
                          venda.badges?.impresso
                            ? `${venda.badges.impresso.user || ''} Data: ${
                                venda.badges.impresso.data
                                  ? formatarData(venda.badges.impresso.data) + ' ' +
                                    formatarhorario(venda.badges.impresso.data)
                                  : ''
                              }`
                            : ''
                        }"
                        disabled>
              </div>


              <div class="input-group">
                  <label for="email">
                      Entregue:
                  </label>
                  <input
                        id="email", 
                        name="email" 
                        placeholder="${
                          venda.colunas?.entregue
                            ? `${venda.colunas?.entregue.user || ''} Data: ${
                                venda.colunas?.entregue.data
                                  ? formatarData(venda.colunas?.entregue.data) + ' ' +
                                    formatarhorario(venda.colunas?.entregue.data)
                                  : ''
                              }`
                            : ''
                        }"
                        disabled>
              </div>

              <div class="input-group">
                  <label for="email">
                      Observação:
                  </label>
                  <input
                        id="email", 
                        name="email"
                        class="observacao-input"
                        value="${venda.obs || ''}"
                        placeholder="Digite aqui uma observação"
                        >
              </div>

            </div>
          </form>
          <div class="modal-status">
            <div class="badge Autenticado"><span>Autenticado</span></div>
            <div class="badge Pagamento-OK"><span>Pagamento OK</span></div>
            <div class="badge Carne-Gerado"><span>Carnê Gerado</span></div>
            <div class="badge Digitalizado"><span>Digitalizado</span></div>
            <div class="badge Fisico"><span>Fisico</span></div>
            <div class="badge Digital"><span>Digital</span></div>
            <div class="badge Impresso"><span>Impresso</span></div>
          </div>`;
}
