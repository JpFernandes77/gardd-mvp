/* Gardd: lógica de importação de vendas e posts. Funções puras, sem servidor. */
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

  // ---- Posts ----

  function guessPostColumns(headers) {
    var H = headers.map(norm);
    function find(keys) {
      for (var k = 0; k < keys.length; k++)
        for (var i = 0; i < H.length; i++) if (H[i].indexOf(keys[k]) >= 0) return i;
      return -1;
    }
    return {
      date: find(['data', 'date', 'dia', 'publica']),
      platform: find(['plataforma', 'rede', 'platform', 'canal']),
      link: find(['link', 'url']),
      caption: find(['legenda', 'caption', 'texto', 'descricao', 'titulo'])
    };
  }

  // CSV Data;Plataforma;Link;Legenda. Sem cabeçalho, assume essa ordem.
  function parsePosts(text) {
    text = String(text || '');
    var d = detectDelimiter(text), rows = parseCSV(text, d), m = guessPostColumns(rows[0] || []);
    if (m.date >= 0 && m.caption >= 0) rows.shift();
    else m = { date: 0, platform: 1, link: 2, caption: 3 };
    var last = Math.max(m.date, m.platform, m.link, m.caption) === m.caption;
    var posts = [], skipped = 0;
    rows.forEach(function (r) {
      var dt = parseDate(r[m.date]);
      var cap = last ? r.slice(m.caption).join(d) : (r[m.caption] || '');
      var post = {
        date: dt && dt.toISOString().slice(0, 10),
        platform: (r[m.platform] || '').trim(),
        link: (r[m.link] || '').trim(),
        caption: cap.trim()
      };
      if (!dt || (!post.caption && !post.link)) { skipped++; return; }
      posts.push(post);
    });
    return { posts: posts, skipped: skipped };
  }

  function productNames(rows, col) {
    var seen = {}, out = [];
    rows.forEach(function (r) {
      var n = (r[col] || '').trim();
      if (n && !seen[n]) { seen[n] = 1; out.push(n); }
    });
    return out.sort(function (a, b) { return a.localeCompare(b, 'pt-BR'); });
  }

  var STOP = {};
  ('a o as os e de da do das dos em no na nos nas um uma uns umas para pra pro por com sem que ' +
   'se ao aos ou the and of').split(' ').forEach(function (w) { STOP[w] = 1; });

  function words(s) {
    return norm(s || '').replace(/[^a-z0-9]+/g, ' ').trim().split(' ').filter(Boolean)
      .map(function (w) { return w.length > 3 && w.slice(-1) === 's' ? w.slice(0, -1) : w; });
  }

  function seqIndex(hay, needle) {
    if (!needle.length) return -1;
    for (var i = 0; i + needle.length <= hay.length; i++) {
      for (var j = 0; j < needle.length && hay[i + j] === needle[j]; j++);
      if (j === needle.length) return i;
    }
    return -1;
  }

  // Compara a legenda com o nome de cada produto, sem acentos nem maiúsculas.
  // alta: nome completo na legenda (em sequência, como hashtag ou todas as palavras).
  // media: só parte do nome bate, ou mais de um produto aparece por completo.
  // nenhuma: nada bate ou o empate não permite escolher.
  function suggestProduct(caption, products) {
    var cap = words(caption), none = { product: null, confidence: 'nenhuma' };
    if (!cap.length || !products || !products.length) return none;
    var info = products.map(function (name) {
      var toks = words(name), content = toks.filter(function (w) { return !STOP[w]; });
      return { name: name, toks: toks, content: content };
    });

    var full = [];
    info.forEach(function (p) {
      var pos = seqIndex(cap, p.toks);
      if (pos < 0 && p.toks.length > 1) {
        var compact = p.toks.join('');
        if (compact.length >= 5) pos = cap.indexOf(compact);
      }
      if (pos < 0 && p.content.length > 1 && p.content.every(function (w) { return cap.indexOf(w) >= 0; }))
        pos = Math.min.apply(null, p.content.map(function (w) { return cap.indexOf(w); }));
      if (pos >= 0) full.push({ name: p.name, pos: pos, size: p.toks.length });
    });
    if (full.length) {
      var max = Math.max.apply(null, full.map(function (f) { return f.size; }));
      full = full.filter(function (f) { return f.size === max; }).sort(function (a, b) { return a.pos - b.pos; });
      return { product: full[0].name, confidence: full.length === 1 ? 'alta' : 'media' };
    }

    var df = {};
    info.forEach(function (p) {
      p.sig = p.content.filter(function (w, i, a) { return a.indexOf(w) === i && (w.length > 1 || /\d/.test(w)); });
      p.sig.forEach(function (w) { df[w] = (df[w] || 0) + 1; });
    });
    var best = null, tie = false;
    info.forEach(function (p) {
      var score = 0;
      p.sig.forEach(function (w) {
        if (cap.indexOf(w) >= 0 && (info.length === 1 || df[w] < info.length)) score += 1 / df[w];
      });
      if (!score) return;
      if (!best || score > best.score + 1e-9) { best = { name: p.name, score: score }; tie = false; }
      else if (Math.abs(score - best.score) < 1e-9) tie = true;
    });
    return best && !tie ? { product: best.name, confidence: 'media' } : none;
  }

  function suggestPosts(posts, products) {
    return posts.map(function (p) {
      var s = suggestProduct(p.caption, products);
      return Object.assign({}, p, { product: s.product, confidence: s.confidence });
    });
  }

  // Posts fictícios coerentes com os Produtos A a E.
  var SAMPLE_POSTS = 'Data;Plataforma;Link;Legenda\n' + [
    '02/11/2026;Instagram;https://example.com/instagram/01;Chegou o Produto E! Corre pra ver as cores.',
    '03/11/2026;TikTok;https://example.com/tiktok/02;Unboxing do Produto E em 30 segundos',
    '03/11/2026;Instagram;https://example.com/instagram/03;Produto A: o queridinho da semana',
    '04/11/2026;TikTok;https://example.com/tiktok/04;3 jeitos de usar o produto b',
    '05/11/2026;Instagram;https://example.com/instagram/05;Bastidores da loja: como embalamos cada pedido',
    '06/11/2026;Instagram;https://example.com/instagram/06;#ProdutoE em promoção até domingo',
    '08/11/2026;TikTok;https://example.com/tiktok/07;Produto D testado na prática',
    '09/11/2026;Instagram;https://example.com/instagram/08;PRODUTO B com frete grátis hoje',
    '09/11/2026;TikTok;https://example.com/tiktok/09;"Produto E combina com tudo, até com o Produto A"',
    '10/11/2026;Instagram;https://example.com/instagram/10;Review sincera do Produto C',
    '11/11/2026;TikTok;https://example.com/tiktok/11;Antes e depois com o Produto A',
    '12/11/2026;Instagram;https://example.com/instagram/12;Produto E: perguntas e respostas',
    '13/11/2026;Instagram;https://example.com/instagram/13;Produto D em 3 cores novas',
    '14/11/2026;TikTok;https://example.com/tiktok/14;Por que o Produto B esgotou?',
    '16/11/2026;Instagram;https://example.com/instagram/15;Promoção relâmpago do Produto E',
    '17/11/2026;TikTok;https://example.com/tiktok/16;Montamos um look com o Produto D',
    '18/11/2026;Instagram;https://example.com/instagram/17;Produto B: vale a pena?',
    '19/11/2026;TikTok;https://example.com/tiktok/18;Último dia do cupom do Produto A'
  ].join('\n');

  // ---- Recomendações ----

  var ACOES = {
    regar: ['Regar', 'Grave mais sobre ele.'],
    manter: ['Manter', 'Conteúdo e venda equilibrados.'],
    podar: ['Podar', 'Troque por outro produto.'],
    insuficiente: ['Dados insuficientes', '']
  };
  var MIN_POSTS = 5, LIMIAR = 0.10;

  function pct(x) { return Math.round(x * 100) + '%'; }

  // produtos: [{ name, revenue }] (como em aggregate().products).
  // posts: [{ product }]; product nulo ou generic: true é ignorado.
  function recomendar(produtos, posts) {
    var by = {}, order = [];
    function get(name) {
      if (!by[name]) { by[name] = { name: name, posts: 0, revenue: 0 }; order.push(name); }
      return by[name];
    }
    (produtos || []).forEach(function (p) { get(p.name).revenue += p.revenue || 0; });
    var totalPosts = 0;
    (posts || []).forEach(function (p) {
      if (!p || !p.product || p.generic) return;
      get(p.product).posts++; totalPosts++;
    });
    var totalRev = order.reduce(function (s, n) { return s + by[n].revenue; }, 0);
    return order.map(function (n) {
      var r = by[n];
      r.postShare = totalPosts ? r.posts / totalPosts : 0;
      r.salesShare = totalRev ? r.revenue / totalRev : 0;
      r.diff = r.salesShare - r.postShare;
      var eps = 1e-9, base = pct(r.postShare) + ' dos posts, ' + pct(r.salesShare) + ' das vendas.';
      if (totalPosts < MIN_POSTS) { r.action = 'insuficiente'; r.detail = 'menos de ' + MIN_POSTS + ' posts com produto.'; }
      else if (!(r.revenue > 0)) { r.action = 'insuficiente'; r.detail = 'produto sem vendas no período.'; }
      else {
        r.action = r.diff >= LIMIAR - eps ? 'regar' : r.diff <= -LIMIAR + eps ? 'podar' : 'manter';
        r.detail = base + ' ' + ACOES[r.action][1];
      }
      r.label = ACOES[r.action][0];
      r.text = r.label + ': ' + r.detail;
      return r;
    }).sort(function (a, b) { return Math.abs(b.diff) - Math.abs(a.diff); });
  }

  // vendas: resultado de aggregate() ou null. posts: [{ product, generic }].
  function relatorio(vendas, posts) {
    posts = posts || [];
    var faltando = [];
    if (!vendas || !vendas.used) faltando.push('vendas');
    if (!posts.length) faltando.push('posts');
    var comProduto = posts.filter(function (p) { return p && p.product && !p.generic; }).length;
    var r = {
      faltando: faltando, posts: posts.length, postsComProduto: comProduto,
      postsGenericos: posts.filter(function (p) { return p && p.generic; }).length,
      from: null, to: null, total: 0, recomendacoes: []
    };
    if (vendas && vendas.used) { r.from = vendas.from; r.to = vendas.to; r.total = vendas.total; }
    if (!faltando.length) r.recomendacoes = recomendar(vendas.products, posts);
    return r;
  }

  var api = {
    decode: decode, detectDelimiter: detectDelimiter, parseCSV: parseCSV, parseNumber: parseNumber,
    parseDate: parseDate, weekStart: weekStart, guessColumns: guessColumns, aggregate: aggregate, SAMPLE: SAMPLE,
    guessPostColumns: guessPostColumns, parsePosts: parsePosts, productNames: productNames,
    suggestProduct: suggestProduct, suggestPosts: suggestPosts, SAMPLE_POSTS: SAMPLE_POSTS,
    recomendar: recomendar, relatorio: relatorio
  };
  if (typeof module !== 'undefined' && module.exports) module.exports = api;
  else root.GarddCore = api;
})(this);
