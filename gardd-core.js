/* Gardd: lógica de importação de vendas. Funções puras, sem servidor. */
(function (root) {
  function decode(buf) {
    var t = new TextDecoder('utf-8').decode(buf);
    return t.indexOf('\uFFFD') >= 0 ? new TextDecoder('windows-1252').decode(buf) : t;
  }

  function detectDelimiter(text) {
    var line = text.split(/\r?\n/)[0] || '', best = ';', max = -1;
    [';', ',', '\t'].forEach(function (d) {
      var n = line.split(d).length - 1;
      if (n > max) { max = n; best = d; }
    });
    return best;
  }

  function parseCSV(text, d) {
    var rows = [], row = [], f = '', q = false;
    text = text.replace(/^\uFEFF/, '');
    function end() { row.push(f); f = ''; if (row.length > 1 || row[0] !== '') rows.push(row); row = []; }
    for (var i = 0; i < text.length; i++) {
      var c = text[i];
      if (q) {
        if (c === '"') { if (text[i + 1] === '"') { f += '"'; i++; } else q = false; }
        else f += c;
      } else if (c === '"') q = true;
      else if (c === d) { row.push(f); f = ''; }
      else if (c === '\n' || c === '\r') { if (c === '\r' && text[i + 1] === '\n') i++; end(); }
      else f += c;
    }
    if (f !== '' || row.length) end();
    return rows;
  }

  // Aceita "1.234,56", "R$ 89,90" e "12.50".
  function parseNumber(s) {
    if (s == null) return NaN;
    s = String(s).replace(/[R$\s]/g, '');
    if (s === '') return NaN;
    if (s.indexOf(',') >= 0) s = s.replace(/\./g, '').replace(',', '.');
    return /^-?\d+(\.\d+)?$/.test(s) ? parseFloat(s) : NaN;
  }

  // Aceita dd/mm/aaaa (com ou sem hora) e aaaa-mm-dd.
  function parseDate(s) {
    s = String(s || '').trim();
    var m = s.match(/^(\d{1,2})[\/\-.](\d{1,2})[\/\-.](\d{4})/);
    if (m) return new Date(Date.UTC(+m[3], +m[2] - 1, +m[1]));
    m = s.match(/^(\d{4})-(\d{2})-(\d{2})/);
    return m ? new Date(Date.UTC(+m[1], +m[2] - 1, +m[3])) : null;
  }

  function weekStart(d) {
    var x = new Date(d.getTime());
    x.setUTCDate(x.getUTCDate() - ((x.getUTCDay() + 6) % 7));
    return x.toISOString().slice(0, 10);
  }

  function norm(h) { return String(h).toLowerCase().normalize('NFD').replace(/[\u0300-\u036f]/g, ''); }

  function guessColumns(headers) {
    var H = headers.map(norm);
    function find(keys) {
      for (var k = 0; k < keys.length; k++)
        for (var i = 0; i < H.length; i++) if (H[i].indexOf(keys[k]) >= 0) return i;
      return -1;
    }
    var value = find(['valor total', 'total', 'valor', 'preco', 'price']);
    return {
      date: find(['data', 'date', 'emissao']),
      product: find(['descricao', 'produto', 'item', 'nome', 'sku']),
      qty: find(['quant', 'qtd', 'qtde']),
      value: value,
      unitPrice: value >= 0 && /unit/.test(H[value])
    };
  }

  function aggregate(rows, m, unitPrice) {
    var byP = {}, byW = {}, used = 0, skipped = 0, from = null, to = null;
    rows.forEach(function (r) {
      var name = (r[m.product] || '').trim();
      var dt = parseDate(r[m.date]);
      var qty = m.qty >= 0 ? parseNumber(r[m.qty]) : 1;
      var val = parseNumber(r[m.value]);
      if (!name || !dt || isNaN(qty) || isNaN(val)) { skipped++; return; }
      var total = unitPrice ? val * qty : val;
      used++;
      var p = byP[name] || (byP[name] = { name: name, units: 0, revenue: 0 });
      p.units += qty; p.revenue += total;
      var w = weekStart(dt), k = byW[w] || (byW[w] = { week: w, units: 0, revenue: 0 });
      k.units += qty; k.revenue += total;
      if (!from || dt < from) from = dt;
      if (!to || dt > to) to = dt;
    });
    var products = Object.keys(byP).map(function (n) { return byP[n]; })
      .sort(function (a, b) { return b.revenue - a.revenue; });
    var weeks = Object.keys(byW).sort().map(function (n) { return byW[n]; });
    var total = products.reduce(function (s, p) { return s + p.revenue; }, 0);
    products.forEach(function (p) { p.share = total ? p.revenue / total : 0; });
    return {
      products: products, weeks: weeks, total: total, used: used, skipped: skipped,
      from: from && from.toISOString().slice(0, 10), to: to && to.toISOString().slice(0, 10)
    };
  }

  // Dados fictícios para demonstração.
  var SAMPLE = 'Data;Produto;Quantidade;Valor unitário\n' + [
    '02/11/2026;Produto A;1;89,90', '03/11/2026;Produto C;2;249,00', '04/11/2026;Produto B;1;129,90',
    '05/11/2026;Produto C;1;249,00', '06/11/2026;Produto E;1;39,90', '09/11/2026;Produto A;2;89,90',
    '10/11/2026;Produto C;3;249,00', '11/11/2026;Produto D;1;159,00', '12/11/2026;Produto C;2;249,00',
    '13/11/2026;Produto E;1;39,90', '16/11/2026;Produto B;2;129,90', '17/11/2026;Produto C;2;249,00',
    '18/11/2026;Produto A;1;89,90', '19/11/2026;Produto D;1;159,00'
  ].join('\n');

  var api = {
    decode: decode, detectDelimiter: detectDelimiter, parseCSV: parseCSV, parseNumber: parseNumber,
    parseDate: parseDate, weekStart: weekStart, guessColumns: guessColumns, aggregate: aggregate, SAMPLE: SAMPLE
  };
  if (typeof module !== 'undefined' && module.exports) module.exports = api;
  else root.GarddCore = api;
})(this);
