# Dashboard de CMV

Projeto React + Vite para cruzar:

- relatorio de vendas
- fichas tecnicas dos itens

O app calcula automaticamente:

- faturamento total
- custo teorico total
- lucro bruto
- CMV medio
- cobertura da base de fichas tecnicas
- ranking por grupo e subgrupo

## Como rodar

```bash
npm install
npm run dev
```

## Supabase

Para habilitar login online e persistencia remota por restaurante:

1. copie `.env.example` para `.env`
2. preencha `VITE_SUPABASE_URL` e `VITE_SUPABASE_ANON_KEY`
3. execute o SQL de [supabase/schema.sql](/c:/Users/João%20Victor%20Magalhãe/CMV%20com%20BI/supabase/schema.sql) no editor SQL do Supabase

Enquanto essas variaveis nao estiverem configuradas, o app continua funcionando no modo local.

Quando o arquivo `schema.sql` for atualizado no projeto, rode o script novamente no Supabase para aplicar novas colunas, policies e funcoes.

O schema atual ja prepara a aplicacao para:

- multiplos restaurantes por conta
- papeis `owner`, `admin` e `viewer`
- restricao de escrita por permissao
- workspace por restaurante
- trilha de auditoria

## Netlify

Para publicar na Netlify:

1. conecte o repositório do GitHub
2. confirme o comando de build `npm run build`
3. confirme o diretório publicado `dist`
4. adicione as variaveis `VITE_SUPABASE_URL` e `VITE_SUPABASE_ANON_KEY` nas variaveis de ambiente do site

O projeto ja possui `netlify.toml` e `.nvmrc` para facilitar esse deploy.

## Formatos aceitos

Arquivos `.csv`, `.xlsx` e `.xls`.

O app usa a primeira aba do arquivo e tenta reconhecer colunas com nomes equivalentes.

### Vendas

Estrutura padrao esperada:

- `CODIGO`
- `PRODUTO`
- `QTE`
- `TOTAL`

### Fichas tecnicas

Estrutura padrao esperada:

- `CODIGO`
- `PRODUTO DO CARDAPIO`
- `PRACA`
- `PRECO`
- `CUSTO`
- `CMV`

## Observacoes

- O arquivo `cmvponderado.tsx` foi mantido como referencia do codigo original copiado do Lovable.
- Quando ha linhas repetidas de vendas para o mesmo item, o app consolida antes de calcular o dashboard.
- O cruzamento principal entre venda e ficha tecnica e feito pelo `CODIGO`.
- O campo `PRACA` e lido, mas ainda nao participa dos calculos.
- No arquivo de vendas, linhas especiais de grupo e subgrupo sao usadas como contexto para os itens abaixo.
- Linhas `TOTAL SUBGRUPO`, `TOTAL GRUPO` e `TOTAL GERAL` nao entram no cruzamento de produtos, mas sao preservadas para exibicao e conferencia no dashboard.
