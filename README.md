# Gardd

**Plante conteúdo. Colha vendas.**

Link do projeto: https://jpfernandes77.github.io/gardd-mvp/

O Gardd mostra quais conteúdos vendem quais produtos e o que gravar na próxima semana.

## O problema

Lojistas que produzem conteúdo para Instagram e TikTok não sabem quais posts realmente geram venda. Hoje o cruzamento entre o que foi postado e o que foi vendido é feito na mão, em planilhas, quando é feito.

## A solução

O Gardd cruza os posts do lojista com as vendas de cada produto e entrega recomendações simples:

- **Regar:** produto que vende bem e tem pouco conteúdo. Grave mais sobre ele.
- **Manter:** conteúdo e venda equilibrados.
- **Podar:** muito conteúdo e pouca venda. Troque por outro produto.

As sugestões mostram associação entre conteúdo e venda, não prova de causa.

## Trilha

**Logística & automação.** O Gardd conecta sistemas que hoje ficam separados e automatiza a análise que o lojista faz manualmente. Na prática, ele lê as vendas que já estão no ERP do lojista (arquivo exportado do Bling ou de outro sistema, com datas e valores em formato brasileiro) e as cruza com o conteúdo publicado nas redes, transformando dois sistemas isolados em uma decisão: o que gravar a seguir. Estoque entra na sequência, usando a mesma base de produtos.

## Como funciona (MVP)

1. Importa vendas por produto (CSV exportado do Bling ou de outro ERP). Reconhece as colunas automaticamente, aceita separador `;` ou `,`, vírgula decimal, datas `dd/mm/aaaa` e acentuação do Windows. Tudo roda no navegador, sem enviar o arquivo a um servidor. Sem dados de clientes.
2. Importa a lista de posts (data, plataforma, link e legenda).
3. Uma IA sugere de qual produto cada post fala, e o lojista confirma.
4. O painel cruza posts e vendas por produto e por semana.
5. O Gardd gera as recomendações (regar, manter, podar).

## Status

Em construção para o Hack Brasil 2026 (4 a 30 de novembro).

- [x] Identidade visual e página do projeto
- [x] Importação de vendas por CSV (protótipo em [`gardd-core.js`](gardd-core.js), com testes em `gardd-core.test.js`)
- [ ] Importação de posts
- [ ] Marcação de posts por IA
- [ ] Painel de cruzamento
- [ ] Recomendações

## Como testar o importador

Abra `index.html` no navegador, vá até **Teste o importador de vendas** e clique em **Usar dados de exemplo**. Para usar um arquivo seu, exporte os pedidos do ERP em CSV, escolha o arquivo e confira as colunas sugeridas. A lógica fica em `gardd-core.js`, sem dependências, e os testes rodam com `node gardd-core.test.js`.

## Estrutura do repositório

- `index.html`: página do projeto com o importador (precisa de `gardd-core.js` na mesma pasta)
- `gardd-core.js`: lógica de importação e agregação
- `gardd-core.test.js`: testes da lógica
- `gardd-icon.svg` e `gardd-icon-512.png`: ícone da marca

## Roadmap

Conexão automática com o Bling, integração com Instagram e TikTok, alertas de estoque e relatório de WhatsApp.

## Sobre os dados

Este repositório e a demonstração usam apenas **dados fictícios**. Nenhum dado real de lojas ou de clientes é publicado.

## Autor

João, criador do Gardd.
