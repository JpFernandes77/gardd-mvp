// Rodar com: node gardd-core.test.js
const C = require('./gardd-core.js');
let ok = 0, bad = 0;
function t(nome, obtido, esperado) {
  const r = JSON.stringify(obtido) === JSON.stringify(esperado);
  r ? ok++ : bad++;
  if (!r) console.log('FALHOU', nome, JSON.stringify(obtido), 'esperado', JSON.stringify(esperado));
}
t('número com milhar e vírgula', C.parseNumber('R$ 1.234,56'), 1234.56);
t('número com vírgula', C.parseNumber('89,90'), 89.9);
t('número com ponto', C.parseNumber('12.50'), 12.5);
t('número inválido', Number.isNaN(C.parseNumber('abc')), true);
t('data com hora', C.parseDate('05/11/2026 14:30').toISOString().slice(0, 10), '2026-11-05');
t('data ISO', C.parseDate('2026-11-05').toISOString().slice(0, 10), '2026-11-05');
t('data inválida', C.parseDate('xx'), null);
t('semana começa na segunda (domingo)', C.weekStart(C.parseDate('08/11/2026')), '2026-11-02');
t('semana começa na segunda (segunda)', C.weekStart(C.parseDate('09/11/2026')), '2026-11-09');
t('separador ;', C.detectDelimiter('a;b;c'), ';');
t('separador ,', C.detectDelimiter('a,b,c'), ',');
t('aspas e quebra de linha', C.parseCSV('a;b\n"x;y";"z ""q"""\r\n1;2', ';'), [['a', 'b'], ['x;y', 'z "q"'], ['1', '2']]);
t('Windows-1252', C.decode(Buffer.from('Descrição;Qtd\nCamiseta Pé;1\n', 'latin1')).split('\n')[1], 'Camiseta Pé;1');
const rows = C.parseCSV(C.SAMPLE, C.detectDelimiter(C.SAMPLE)), m = C.guessColumns(rows.shift());
t('colunas sugeridas', [m.date, m.product, m.qty, m.value, m.unitPrice], [0, 1, 2, 3, true]);
const a = C.aggregate(rows, m, m.unitPrice);
t('linhas usadas', [a.used, a.skipped], [14, 0]);
t('produto campeão', a.products[0].name, 'Produto C');
t('receita do campeão', a.products[0].revenue, 249 * 10);
t('semanas', a.weeks.map(w => w.week), ['2026-11-02', '2026-11-09', '2026-11-16']);
t('participações somam 1', Math.round(a.products.reduce((s, p) => s + p.share, 0) * 1000) / 1000, 1);
t('período', [a.from, a.to], ['2026-11-02', '2026-11-19']);
const b = C.aggregate([['', 'x', '1', '10'], ['01/11/2026', 'P', '1', '1,5']], { date: 0, product: 1, qty: 2, value: 3 }, false);
t('ignora linhas incompletas', [b.used, b.skipped], [1, 1]);
// Posts
const pp = C.parsePosts(C.SAMPLE_POSTS);
t('posts de exemplo lidos', [pp.posts.length, pp.skipped], [18, 0]);
t('campos do post', pp.posts[0], { date: '2026-11-02', platform: 'Instagram', link: 'https://example.com/instagram/01', caption: 'Chegou o Produto E! Corre pra ver as cores.' });
t('legenda entre aspas com vírgula', pp.posts[8].caption, 'Produto E combina com tudo, até com o Produto A');
t('posts sem cabeçalho', C.parsePosts('05/11/2026;TikTok;https://example.com/x;Oi').posts[0].caption, 'Oi');
t('legenda com ; sem aspas', C.parsePosts('Data;Plataforma;Link;Legenda\n05/11/2026;TikTok;;a; b').posts[0].caption, 'a; b');
t('cabeçalho em outra ordem', C.parsePosts('Legenda,Data,Rede\nOlá,2026-11-05,Instagram').posts[0], { date: '2026-11-05', platform: 'Instagram', link: '', caption: 'Olá' });
t('ignora post sem data', C.parsePosts('Data;Plataforma;Link;Legenda\nontem;TikTok;;Oi\n01/11/2026;TikTok;;Oi').skipped, 1);
const prods = C.productNames(rows, m.product);
t('produtos da planilha', prods, ['Produto A', 'Produto B', 'Produto C', 'Produto D', 'Produto E']);
const S = (cap, list) => C.suggestProduct(cap, list || prods);
t('nome completo: alta', S('Review do Produto C'), { product: 'Produto C', confidence: 'alta' });
t('ignora maiúsculas', S('PRODUTO B com frete grátis'), { product: 'Produto B', confidence: 'alta' });
t('hashtag', S('#ProdutoE em promoção'), { product: 'Produto E', confidence: 'alta' });
t('letra solta não conta como produto', S('o produto ama sol'), { product: null, confidence: 'nenhuma' });
t('dois produtos: média no primeiro', S('Produto E combina com o Produto A'), { product: 'Produto E', confidence: 'media' });
t('sem menção: nenhuma', S('Bastidores da loja'), { product: null, confidence: 'nenhuma' });
t('sem produtos: nenhuma', S('Produto A', []), { product: null, confidence: 'nenhuma' });
const cat = ['Camiseta Básica Preta', 'Camiseta Básica', 'Calça de Linho', 'Boné Aba Reta', 'Tênis Runner'];
t('ignora acentos', S('Nova calca de linho', cat), { product: 'Calça de Linho', confidence: 'alta' });
t('palavras fora de ordem', S('linho na calça, perfeito', cat), { product: 'Calça de Linho', confidence: 'alta' });
t('plural', S('CAMISETAS BASICAS PRETAS chegaram', cat), { product: 'Camiseta Básica Preta', confidence: 'alta' });
t('prefere o nome mais longo', S('camiseta basica preta', cat), { product: 'Camiseta Básica Preta', confidence: 'alta' });
t('nome curto', S('Look com camiseta básica branca', cat), { product: 'Camiseta Básica', confidence: 'alta' });
t('parte do nome: média', S('tenis pra correr', cat), { product: 'Tênis Runner', confidence: 'media' });
t('parte do nome empatada: nenhuma', S('camiseta nova', cat), { product: null, confidence: 'nenhuma' });
const count = {};
C.suggestPosts(pp.posts, prods).forEach(p => { const k = p.product || '(nenhum)'; count[k] = (count[k] || 0) + 1; });
t('exemplo: posts por produto', count, { 'Produto E': 6, 'Produto A': 3, 'Produto B': 4, '(nenhum)': 1, 'Produto D': 3, 'Produto C': 1 });

// Recomendações
const sug = C.suggestPosts(pp.posts, prods);
const rec = C.recomendar(a.products, sug);
const acao = {}; rec.slice().sort((x, y) => x.name < y.name ? -1 : 1).forEach(r => { acao[r.name] = r.action; });
t('exemplo: recomendações', acao, { 'Produto A': 'manter', 'Produto B': 'podar', 'Produto C': 'regar', 'Produto D': 'manter', 'Produto E': 'podar' });
t('ordenado por |diferença|', rec.map(r => r.name), ['Produto C', 'Produto E', 'Produto B', 'Produto D', 'Produto A']);
t('ignora posts sem produto', rec.reduce((s, r) => s + r.posts, 0), 17);
t('texto do Regar', rec[0].text, 'Regar: 6% dos posts, 68% das vendas. Grave mais sobre ele.');
t('texto do Podar', rec[1].text, 'Podar: 35% dos posts, 2% das vendas. Troque por outro produto.');
t('texto do Manter', rec[4].text, 'Manter: 18% dos posts, 10% das vendas. Conteúdo e venda equilibrados.');
const P = (n, r) => ({ name: n, revenue: r });
const posts = (spec) => Object.entries(spec).flatMap(([n, k]) => Array(k).fill({ product: n }));
const r2 = C.recomendar([P('X', 60), P('Y', 40)], posts({ X: 5, Y: 5 }).concat([{ product: 'X', generic: true }, { product: null }]));
t('limiar +0,10 é Regar e -0,10 é Podar', r2.map(r => [r.name, r.action]), [['X', 'regar'], ['Y', 'podar']]);
t('partes', [r2[0].postShare, r2[0].salesShare], [0.5, 0.6]);
t('perto do limiar é Manter', C.recomendar([P('X', 59), P('Y', 41)], posts({ X: 5, Y: 5 })).map(r => r.action), ['manter', 'manter']);
t('menos de 5 posts: dados insuficientes', C.recomendar([P('X', 90), P('Y', 10)], posts({ X: 1, Y: 3 })).map(r => r.action), ['insuficiente', 'insuficiente']);
const r3 = C.recomendar([P('X', 100)], posts({ X: 3, Z: 3 }));
t('produto sem vendas: dados insuficientes', r3.map(r => [r.name, r.action]), [['X', 'regar'], ['Z', 'insuficiente']]);
t('texto de dados insuficientes', r3[1].text, 'Dados insuficientes: produto sem vendas no período.');
t('sem dados', C.recomendar([], []), []);

// Relatório
const rel = C.relatorio(a, sug.map(p => ({ product: p.product })));
t('relatório completo', [rel.faltando, rel.from, rel.to, rel.total, rel.posts, rel.postsComProduto, rel.recomendacoes.length],
  [[], '2026-11-02', '2026-11-19', a.total, 18, 17, 5]);
t('relatório: genéricos não contam', C.relatorio(a, [{ product: 'Produto A', generic: true }, { product: 'Produto B' }]).postsComProduto, 1);
t('relatório sem vendas', C.relatorio(null, sug).faltando, ['vendas']);
t('relatório sem posts', C.relatorio(a, []).faltando, ['posts']);
t('relatório vazio', [C.relatorio(null, null).faltando, C.relatorio(null, null).recomendacoes], [['vendas', 'posts'], []]);
t('relatório com vendas inválidas', C.relatorio(C.aggregate([], m, false), sug).faltando, ['vendas']);

console.log(ok + ' ok, ' + bad + ' falhas');
process.exit(bad ? 1 : 0);
