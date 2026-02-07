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
                        venda.badges?.Autenticado
                          ? `${venda.badges.Autenticado.user || ''} Data: ${
                              venda.badges.Autenticado.data
                                ? formatarData(venda.badges.Autenticado.data) + ' ' +
                                  formatarhorario(venda.badges.Autenticado.data)
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
                          venda.badges?.['Pagamento-OK']
                            ? `${venda.badges?.['Pagamento-OK'].user || ''} Data: ${
                                venda.badges?.['Pagamento-OK'].data
                                  ? formatarData(venda.badges?.['Pagamento-OK'].data) + ' ' +
                                    formatarhorario(venda.badges?.['Pagamento-OK'].data)
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
                          venda.badges?.['Carne-Gerado']
                            ? `${venda.badges?.['Carne-Gerado'].user || ''} Data: ${
                                venda.badges?.['Carne-Gerado'].data
                                  ? formatarData(venda.badges?.['Carne-Gerado'].data) + ' ' +
                                    formatarhorario(venda.badges?.['Carne-Gerado'].data)
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
                          venda.badges?.Digitalizado
                            ? `${venda.badges.Digitalizado.user || ''} Data: ${
                                venda.badges.Digitalizado.data
                                  ? formatarData(venda.badges.Digitalizado.data) + ' ' +
                                    formatarhorario(venda.badges.Digitalizado.data)
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
                          venda.badges?.Impresso
                            ? `${venda.badges.Impresso.user || ''} Data: ${
                                venda.badges.Impresso.data
                                  ? formatarData(venda.badges.Impresso.data) + ' ' +
                                    formatarhorario(venda.badges.Impresso.data)
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
          </form>`;
}
