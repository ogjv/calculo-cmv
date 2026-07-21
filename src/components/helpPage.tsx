export function HelpPage() {
  return (
    <section className="card help-page">
      <div className="help-page-content">
        <h2>Ajuda — Importação de planilhas</h2>

        <p>
          Orientações para preparar os arquivos que o sistema espera. Leia com atenção e use os templates
          disponibilizados abaixo antes de tentar o upload.
        </p>

        <h3>Fichas Técnicas</h3>
        <p>
          Relatório de fichas técnicas (sintéticas), sempre em Excel. Inclui produtos inativos. Exporte do seu sistema
          no formato Excel (.xlsx) e utilize o template para garantir colunas e nomes corretos.
        </p>

        <h3>Entrada de Mercadorias</h3>
        <p>
          Relatório de entrada de mercadorias, sempre em Excel. Certifique-se de que as colunas de quantidade,
          preço e datas estejam presentes e bem formatadas.
        </p>

        <h3>Vendas</h3>
        <p>
          Relatório de vendas contendo somente o resumo de produtos vendidos, sempre em Excel. Atenção: alguns sistemas
          exportam uma aba inicial de instruções — remova essa aba antes de subir o arquivo quando necessário.
        </p>

        <h3>DRE</h3>
        <p>
          Estrutura do DRE: confirmar no sistema de origem. Use o template de DRE quando disponível; caso ainda não tenha
          o template, envie um exemplo para que possamos padronizar a leitura.
        </p>

        <h3>Solução de problemas comuns</h3>
        <ol>
          <li>Use os templates abaixo para garantir que as colunas estejam na ordem e com nomes esperados.</li>
          <li>Remova cabeçalhos informativos ou folhas extras antes de salvar o arquivo final.</li>
          <li>Verifique formatos numéricos e datas — prefira formatos neutros (ex.: 2023-07-01) quando possível.</li>
          <li>Se a mensagem indicar que o arquivo não está no padrão, salve uma cópia e anexe ao ticket de suporte.</li>
        </ol>

        <h3>Templates</h3>
        <ul>
          <li>
            <a href="/help/templates/recipes-template.xlsx" download>
              Baixar template — Fichas Técnicas (XLSX)
            </a>
          </li>
          <li>
            <a href="/help/templates/goods-entry-template.xlsx" download>
              Baixar template — Entrada de Mercadorias (XLSX)
            </a>
          </li>
          <li>
            <a href="/help/templates/sales-template.xlsx" download>
              Baixar template — Vendas (XLSX)
            </a>
          </li>
        </ul>

        <h3>Precisa de ajuda?</h3>
        <p>
          Se persistir o erro, copie a mensagem exibida pelo sistema e abra um chamado com: nome do arquivo, tipo de
          arquivo e as primeiras 5 linhas do arquivo (ou anexe uma amostra). Isso acelera a investigação.
        </p>
      </div>
    </section>
  );
}
