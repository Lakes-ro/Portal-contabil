'use strict';
// =====================================================
// ARF – Módulo "Info" (tabelas de referência RPA)  |  info.js  |  v1.0.0
// Carregado DEPOIS de app.js (index.html). Registra a rota 'info' em App.MODULE_MAP.
// Dados estáticos (não usa banco) → funciona igual em modo demo e real, sem RLS.
// Para corrigir/adicionar linhas, edite apenas o objeto INFO_RPA abaixo.
// =====================================================

const INFO_RPA = {
  // Ajuste de Diferenças — colunas fixas da planilha: Depto = "Departamento", Valor = "Valor", Ind. = "N"
  ajuste: [
    { rpa: 'RPA 15',       nums: ['15'],       op: 'DOAÇÃO E BRINDE',                 conta: '4142022', compl: '',     seq: '10', cod: '0E' },
    { rpa: 'RPA 16',       nums: ['16'],       op: 'BAIXA ESTOQUE',                   conta: '3189016', compl: '',     seq: '10', cod: '2'  },
    { rpa: 'RPA 17',       nums: ['17'],       op: 'TRÂNSFERENCIA',                   conta: '3182090', compl: '5',    seq: '10', cod: '2'  },
    { rpa: 'RPA 20 ou 40', nums: ['20', '40'], op: 'OUTRAS ENTRADAS',                 conta: '1139090', compl: '9',    seq: '10', cod: '0A' },
    { rpa: 'RPA 20 ou 40', nums: ['20', '40'], op: 'OUTRAS ENTRADAS',                 conta: '3182090', compl: '5',    seq: '10', cod: '2'  },
    { rpa: 'RPA 29',       nums: ['29'],       op: 'OUTRAS SAÍDAS',                   conta: '1139090', compl: '9',    seq: '10', cod: '0A' },
    { rpa: 'RPA 29',       nums: ['29'],       op: 'OUTRAS SAÍDAS',                   conta: '3189016', compl: '',     seq: '10', cod: '2'  },
    { rpa: 'RPA 04',       nums: ['04'],       op: 'DEVOLUÇÃO DE COMPRA',             conta: '3182090', compl: '5',    seq: '10', cod: '2'  },
    { rpa: 'RPA 04',       nums: ['04'],       op: 'DEVOLUÇÃO DE COMPRA FAD',         conta: '3182090', compl: '2038', seq: '10', cod: '2'  },
    { rpa: 'RPA 09 E 32',  nums: ['09', '32'], op: 'DEVOLUÇÃO DE MERCADORIA',         conta: '3182090', compl: '5',    seq: '10', cod: '2'  },
    { rpa: 'RPA 03',       nums: ['03'],       op: 'COMPRAS',                         conta: '2130101', compl: '',     seq: '10', cod: '0A' },
    { rpa: 'RPA 45',       nums: ['45'],       op: 'OUTRAS SAÍDAS - USO OU CONSUMO',  conta: '4121585', compl: '50',   seq: '10', cod: '0E' },
  ],
  // Grupo de Operações: RPA → código da operação
  grupos: [
    { rpa: '01', cod: '201', desc: 'Venda de Mercadoria' },
    { rpa: '02', cod: '113', desc: 'Devolução de Vendas' },
    { rpa: '04', cod: '208', desc: 'Devolução de Compra' },
    { rpa: '09', cod: '223', desc: 'Devolução de Mercadoria' },
    { rpa: '13', cod: '214', desc: 'Transferência de Material de Uso ou Consumo' },
    { rpa: '15', cod: '217', desc: 'Remessa de Doação, Bonific. ou Brinde' },
    { rpa: '16', cod: '227', desc: 'Baixa Estoque por Perda' },
    { rpa: '17', cod: '207', desc: 'Transferência de Mercadoria' },
    { rpa: '20', cod: '126', desc: 'Outras Entradas - Atualiza Custo' },
    { rpa: '45', cod: '243', desc: 'Outras Saídas - Uso ou Consumo' },
    { rpa: '41', cod: '240', desc: 'Outras Saídas - Tabela de Preço' },
    { rpa: '29', cod: '231', desc: 'Outras Saídas' },
    { rpa: '32', cod: '116', desc: 'Devolução de Merc. Remetida' },
    { rpa: '37', cod: '234', desc: 'Venda de Mercadoria Final' },
    { rpa: '22', cod: '118', desc: 'Retorno de Remessa' },
    { rpa: '21', cod: '216', desc: 'Remessa de Mercadoria' },
  ],
  // Código do Movimento (descrições terminadas em "…" estavam cortadas na planilha de origem)
  movs: [
    { cod: 'V1',   desc: 'Vendas NFC-e' },
    { cod: 'V2',   desc: 'Vendas de Mercadoria' },
    { cod: 'OE',   desc: 'Outras Entradas - Atualiza Custo' },
    { cod: 'OS',   desc: 'Outras Saídas (Todas)' },
    { cod: 'DV',   desc: 'Devolução de Vendas' },
    { cod: 'DC',   desc: 'Devolução de Compras' },
    { cod: 'C',    desc: 'Compras' },
    { cod: 'BX',   desc: 'Baixa de Estoque' },
    { cod: 'CR',   desc: 'Compra de Merc. P/ Recebimento Futuro' },
    { cod: 'VMFE', desc: 'Venda de Merc. Fora do Estab.' },
    { cod: 'VMC',  desc: 'Venda de Merc. ao Consumidor Final p/ Fora…' },
    { cod: 'ET',   desc: 'Entrada Por Transferência de Mercadoria Pa…' },
    { cod: 'EST',  desc: 'Entrada de Simples Fat. Dec. de Compra Para…' },
    { cod: 'ST',   desc: 'Saída Por Transferência de Mercadoria Para…' },
    { cod: 'EDO',  desc: 'Entrada de Bonificação, Doação ou Brinde' },
    { cod: 'RDO',  desc: 'Remessa de Bonificação, Doação ou Brinde' },
  ],
};

const ModInfo = {
  tab: 'ajuste',
  q: '',
  TABS: [
    ['ajuste', 'Ajuste de Diferenças', '🧮'],
    ['grupos', 'Grupo de Operações', '🗂️'],
    ['movs',   'Código do Movimento', '🔖'],
  ],

  _norm(s) { return String(s ?? '').normalize('NFD').replace(/[\u0300-\u036f]/g, '').toLowerCase(); },

  // Códigos de operação (Grupo de Operações) correspondentes aos RPAs de uma linha do Ajuste
  _ops(nums) {
    return nums.map(n => INFO_RPA.grupos.find(g => g.rpa === n)?.cod).filter(Boolean);
  },

  render() {
    UI.render(`<div class="p-6 fade-in">
      <div class="flex items-center justify-between mb-5 flex-wrap gap-3">
        <div><h1 class="text-xl font-bold text-slate-800">Info · Tabelas RPA</h1>
        <p class="text-sm text-slate-500 mt-0.5">Referência rápida de contas, grupos de operações e códigos de movimento. Clique num código para copiar.</p></div>
        <button onclick="window.print()" class="brand-btn border border-slate-300 text-slate-600 hover:bg-slate-50">🖨️ Imprimir</button>
      </div>
      <div class="flex gap-2 flex-wrap mb-4">
        ${this.TABS.map(([k, l, ic]) => `<button onclick="ModInfo.setTab('${k}')" class="brand-btn text-sm ${k === this.tab ? 'bg-brand-800 text-white' : 'border border-slate-300 text-slate-600 hover:bg-slate-50 bg-white'}">${ic} ${l}</button>`).join('')}
        <input id="info-q" class="brand-input" style="width:16rem;margin-left:auto" placeholder="🔎 Buscar RPA, conta, código, descrição…" value="${esc(this.q)}" oninput="ModInfo.setQ(this.value)" />
      </div>
      <div id="info-body"></div>
    </div>`);
    this.draw();
  },

  setTab(t) { this.tab = t; this.render(); },
  setQ(v) { this.q = v; clearTimeout(this._t); this._t = setTimeout(() => this.draw(), 150); },

  async copy(text) {
    text = String(text ?? '');
    if (!text) return;
    let ok = false;
    try { await navigator.clipboard.writeText(text); ok = true; }
    catch {
      try { const t = document.createElement('textarea'); t.value = text; t.style.cssText = 'position:fixed;opacity:0'; document.body.appendChild(t); t.select(); ok = document.execCommand('copy'); t.remove(); } catch {}
    }
    if (ok) UI.toast('📋 Copiado: ' + text, 'success', 1800);
    else UI.toast('Não foi possível copiar. Selecione e use Ctrl+C.', 'error');
  },

  // célula copiável
  _cp(v, mono = true) {
    if (v === '' || v == null) return '<span class="text-slate-300">—</span>';
    return `<button type="button" data-v="${esc(v)}" onclick="ModInfo.copy(this.dataset.v)" title="Copiar" class="${mono ? 'font-mono ' : ''}text-sm text-brand-700 hover:bg-brand-50 hover:underline rounded px-1 -mx-1">${esc(v)}</button>`;
  },

  draw() {
    const el = document.getElementById('info-body'); if (!el) return;
    const q = this._norm(this.q.trim());
    const hit = (...vals) => !q || this._norm(vals.join(' ')).includes(q);
    let head = '', rows = '', total = 0, shown = 0, note = '';

    if (this.tab === 'ajuste') {
      const all = INFO_RPA.ajuste; total = all.length;
      const list = all.filter(r => hit(r.rpa, r.op, r.conta, r.compl, r.seq, r.cod, this._ops(r.nums).join(' '), 'Departamento Valor'));
      shown = list.length;
      head = '<tr><th>RPA</th><th>Operação</th><th>Cód. operação</th><th>Conta contábil</th><th class="text-center">Compl.</th><th class="text-center">Nº</th><th>Depto</th><th class="text-center">Cód.</th><th>Valor</th><th class="text-center">Ind.</th></tr>';
      rows = list.map(r => {
        const ops = this._ops(r.nums);
        return `<tr>
          <td><span class="badge bg-brand-100 text-brand-800">${esc(r.rpa)}</span></td>
          <td class="text-sm font-medium text-slate-700">${esc(r.op)}</td>
          <td>${ops.length ? ops.map(o => this._cp(o)).join(' <span class="text-slate-300">/</span> ') : '<span class="text-slate-300">—</span>'}</td>
          <td>${this._cp(r.conta)}</td>
          <td class="text-center">${this._cp(r.compl)}</td>
          <td class="text-center font-mono text-sm">${esc(r.seq)}</td>
          <td class="text-sm text-slate-500">Departamento</td>
          <td class="text-center"><span class="badge bg-amber-100 text-amber-800">${esc(r.cod)}</span></td>
          <td class="text-sm text-slate-500">Valor</td>
          <td class="text-center font-mono text-sm">N</td></tr>`;
      }).join('');
      note = 'As colunas “Cód. operação” são cruzadas automaticamente com a tabela Grupo de Operações (RPA 40 não consta nela). Os cabeçalhos “Compl.”, “Nº”, “Cód.” e “Ind.” são nomes provisórios — a planilha de origem não trazia cabeçalho.';
    } else if (this.tab === 'grupos') {
      const all = INFO_RPA.grupos; total = all.length;
      const list = all.filter(r => hit('RPA ' + r.rpa, r.cod, r.desc));
      shown = list.length;
      head = '<tr><th>RPA</th><th>Código da operação</th><th>Descrição</th></tr>';
      rows = list.map(r => `<tr>
        <td><span class="badge bg-brand-100 text-brand-800">RPA ${esc(r.rpa)}</span></td>
        <td>${this._cp(r.cod)}</td>
        <td class="text-sm text-slate-700">${esc(r.desc)}</td></tr>`).join('');
    } else {
      const all = INFO_RPA.movs; total = all.length;
      const list = all.filter(r => hit(r.cod, r.desc));
      shown = list.length;
      head = '<tr><th>Código</th><th>Movimento</th></tr>';
      rows = list.map(r => `<tr>
        <td><span class="badge bg-amber-100 text-amber-800 font-mono">${esc(r.cod)}</span></td>
        <td class="text-sm text-slate-700">${esc(r.desc)}</td></tr>`).join('');
      note = 'Descrições terminadas em “…” estavam cortadas na planilha de origem; complete-as em INFO_RPA.movs (info.js) quando tiver o texto integral.';
    }

    el.innerHTML = `<div class="bg-white rounded-xl border border-slate-200 overflow-hidden">
      <div class="px-5 py-3 bg-slate-50 border-b border-slate-200 flex items-center justify-between">
        <h2 class="font-bold text-slate-700 text-sm">${esc(this.TABS.find(t => t[0] === this.tab)[1])}</h2>
        <span class="text-xs text-slate-500">${shown} de ${total}</span>
      </div>
      ${shown === 0 ? UI.empty('Nada encontrado para a busca', '🔎') : `<div class="overflow-x-auto"><table class="brand-table"><thead>${head}</thead><tbody>${rows}</tbody></table></div>`}
    </div>${note ? `<p class="text-xs text-slate-400 mt-3">${esc(note)}</p>` : ''}`;
  },
};

// Registro da rota (app.js já foi carregado)
if (typeof App !== 'undefined' && App.MODULE_MAP) {
  App.MODULE_MAP['info'] = { label: 'Info · Tabelas RPA', mod: () => ModInfo.render() };
}
