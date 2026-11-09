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
console.log(ok + ' ok, ' + bad + ' falhas');
process.exit(bad ? 1 : 0);
