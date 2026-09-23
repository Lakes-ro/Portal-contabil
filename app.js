'use strict';
// ADRA – app.js  |  v1.0.0
// Sistema de Gestão Financeira e Operacional

const ROLE_LABELS={admin:'Administrador',tesoureiro:'Tesoureiro',contador:'Contador',dp:'Depto. Pessoal',caixa:'Caixa',demo:'Modo Demo'};
const STATUS_LABELS={pendente:'Pendente',aprovada:'Aprovada',pix_gerado:'Pix Gerado',pago_conciliado:'Pago/Conciliado',divergencia:'Divergência',cancelada:'Cancelada',aberta:'Aberta',em_analise:'Em Análise',resolvida:'Resolvida'};
const EMITTER_LABELS={mei:'MEI',simples:'Simples Nacional',lucro_presumido:'Lucro Presumido',lucro_real:'Lucro Real',pessoa_fisica:'Pessoa Física'};
const PIX_KEY_LABELS={cpf:'CPF',cnpj:'CNPJ',email:'E-mail',telefone:'Telefone',aleatoria:'Chave Aleatória'};
const PRIORITY_LABELS={baixa:'🟢 Baixa',normal:'🔵 Normal',alta:'🟡 Alta',urgente:'🔴 Urgente'};

const TAX_RULES={
  mei:{label:'MEI',note:'MEI é isento de retenções na fonte. DAS recolhido pelo próprio emitente.',iss:0,irrf:0,pis:0,cofins:0,csll:0,inss:0,retain_iss:false,retain_irrf:false,retain_pcc:false,retain_inss:false},
  simples:{label:'Simples Nacional',note:'Apenas ISS pode ser retido na fonte (2%). IRRF, PIS, COFINS e CSLL recolhidos via DAS.',iss:2.00,irrf:0,pis:0,cofins:0,csll:0,inss:0,retain_iss:true,retain_irrf:false,retain_pcc:false,retain_inss:false},
  lucro_presumido:{label:'Lucro Presumido',note:'IRRF 1,5% + PCC (PIS 0,65% / COFINS 3% / CSLL 1%) + ISS 2%. Conforme IN RFB 1.234/2012.',iss:2.00,irrf:1.50,pis:0.65,cofins:3.00,csll:1.00,inss:0,retain_iss:true,retain_irrf:true,retain_pcc:true,retain_inss:false},
  lucro_real:{label:'Lucro Real',note:'IRRF 1,5% + PCC (PIS 0,65% / COFINS 3% / CSLL 1%) + ISS 5%.',iss:5.00,irrf:1.50,pis:0.65,cofins:3.00,csll:1.00,inss:0,retain_iss:true,retain_irrf:true,retain_pcc:true,retain_inss:false},
  pessoa_fisica:{label:'Pessoa Física',note:'IRRF conforme tabela progressiva mensal. INSS retido à alíquota de 11%.',iss:0,irrf:0,pis:0,cofins:0,csll:0,inss:11.00,retain_iss:false,retain_irrf:true,retain_pcc:false,retain_inss:true,irrf_progressive:true}
};
const IRRF_TABLE=[{max:2259.20,rate:0,deduction:0},{max:2826.65,rate:0.075,deduction:169.44},{max:3751.05,rate:0.15,deduction:381.44},{max:4664.68,rate:0.225,deduction:662.77},{max:Infinity,rate:0.275,deduction:896.00}];

const SEED_DATA={
  profiles:[
    {id:'usr-001',full_name:'Ana Paula Souza',role:'tesoureiro',department:'Tesouraria',is_active:true},
    {id:'usr-002',full_name:'Marcos Costa',role:'contador',department:'Contabilidade',is_active:true},
    {id:'usr-003',full_name:'Fernanda Lima',role:'dp',department:'Depto. Pessoal',is_active:true},
    {id:'usr-004',full_name:'Roberto Alves',role:'caixa',department:'Caixa',is_active:true},
    {id:'demo',full_name:'Usuário Demo',role:'admin',department:'Administração',is_active:true},
  ],
  projects:[
    {id:'prj-001',name:'ADRA Brasil – Fundo Operacional',code:'ADRA-OP-001',type:'Livre',budget:500000,spent:47350,status:'ativo',is_favorite:true,notes:'Fundo operacional geral',start_date:'2024-01-01',created_at:'2024-01-01T00:00:00Z'},
    {id:'prj-002',name:'Projeto Esperança – Região Norte',code:'ESPN-001',type:'Restrito',budget:150000,spent:28000,status:'ativo',is_favorite:true,notes:'Apoio assistencial ao Norte',start_date:'2024-03-01',created_at:'2024-03-01T00:00:00Z'},
    {id:'prj-003',name:'Campanha Nativos 2024',code:'NAT-2024',type:'Restrito',budget:75000,spent:12500,status:'ativo',is_favorite:false,notes:'Apoio a comunidades indígenas',start_date:'2024-04-01',created_at:'2024-04-01T00:00:00Z'},
    {id:'prj-004',name:'Fundo de Emergência',code:'EMERG-001',type:'Livre',budget:200000,spent:0,status:'ativo',is_favorite:false,notes:'Reserva estratégica',start_date:'2024-01-01',created_at:'2024-01-01T00:00:00Z'},
    {id:'prj-005',name:'Alimento Solidário',code:'ALIM-001',type:'Restrito',budget:120000,spent:60000,status:'suspenso',is_favorite:false,notes:'Distribuição de cestas básicas',created_at:'2023-06-01T00:00:00Z'},
  ],
  bank_accounts:[
    {id:'ba-001',project_id:'prj-001',bank_name:'Banco do Brasil',bank_code:'001',agency:'1234-5',account_number:'00012345',account_digit:'6',pix_key:'12.345.678/0001-90',pix_key_type:'cnpj',beneficiary_name:'ADRA Brasil Associação',is_active:true,created_at:'2024-01-01T00:00:00Z'},
    {id:'ba-002',project_id:'prj-002',bank_name:'Caixa Econômica Federal',bank_code:'104',agency:'0567',account_number:'00567890',account_digit:'1',pix_key:'adra.norte@adra.org.br',pix_key_type:'email',beneficiary_name:'ADRA Projeto Esperança',is_active:true,created_at:'2024-03-01T00:00:00Z'},
    {id:'ba-003',project_id:'prj-003',bank_name:'Bradesco',bank_code:'237',agency:'3456-7',account_number:'12345678',account_digit:'9',pix_key:'+5561999990001',pix_key_type:'telefone',beneficiary_name:'ADRA Nativos 2024',is_active:true,created_at:'2024-04-01T00:00:00Z'},
    {id:'ba-004',project_id:'prj-004',bank_name:'Itaú Unibanco',bank_code:'341',agency:'5678',account_number:'98765432',account_digit:'0',pix_key:'a1b2c3d4-e5f6-7890-abcd-ef1234567890',pix_key_type:'aleatoria',beneficiary_name:'ADRA Fundo Emergência',is_active:true,created_at:'2024-01-01T00:00:00Z'},
  ],
  notes_fiscal:[
    {id:'nf-001',project_id:'prj-001',bank_account_id:'ba-001',emitter_name:'Tech Solutions Ltda',emitter_cnpj:'11.222.333/0001-44',emitter_type:'lucro_presumido',service_description:'Consultoria em Tecnologia da Informação',fiscal_note_number:'NF-2025-001',issue_date:'2025-07-01',gross_amount:15000,iss_rate:2,iss_withheld:300,irrf_rate:1.5,irrf_withheld:225,pis_rate:0.65,pis_withheld:97.5,cofins_rate:3,cofins_withheld:450,csll_rate:1,csll_withheld:150,inss_rate:0,inss_withheld:0,competency_period:'2025-07-01',due_date:'2025-07-15',tx_id:'ADRA4F8E2A1B3C9D7E6F5A2B1C3D4E5F678',pix_payload:null,status:'pix_gerado',created_by:'usr-001',created_at:'2025-07-02T10:00:00Z'},
    {id:'nf-002',project_id:'prj-002',bank_account_id:'ba-002',emitter_name:'Carlos Souza ME',emitter_cnpj:'22.333.444/0001-55',emitter_type:'simples',service_description:'Serviços de Limpeza e Conservação',fiscal_note_number:'NF-0042',issue_date:'2025-07-03',gross_amount:3500,iss_rate:2,iss_withheld:70,irrf_rate:0,irrf_withheld:0,pis_rate:0,pis_withheld:0,cofins_rate:0,cofins_withheld:0,csll_rate:0,csll_withheld:0,inss_rate:0,inss_withheld:0,competency_period:'2025-07-01',due_date:'2025-07-20',tx_id:null,pix_payload:null,status:'aprovada',notes:'Serviço recorrente',created_by:'usr-001',created_at:'2025-07-03T14:00:00Z'},
    {id:'nf-003',project_id:'prj-001',bank_account_id:'ba-001',emitter_name:'Maria José dos Santos',emitter_cnpj:'987.654.321-00',emitter_type:'pessoa_fisica',service_description:'Serviços de Nutricionista – RPA',fiscal_note_number:'RPA-007',issue_date:'2025-07-05',gross_amount:4800,iss_rate:0,iss_withheld:0,irrf_rate:15,irrf_withheld:278.56,pis_rate:0,pis_withheld:0,cofins_rate:0,cofins_withheld:0,csll_rate:0,csll_withheld:0,inss_rate:11,inss_withheld:528,competency_period:'2025-07-01',due_date:'2025-07-28',tx_id:null,pix_payload:null,status:'pendente',created_by:'usr-004',created_at:'2025-07-05T09:00:00Z'},
    {id:'nf-004',project_id:'prj-003',bank_account_id:'ba-003',emitter_name:'Gráfica Impressão Rápida',emitter_cnpj:'33.444.555/0001-66',emitter_type:'simples',service_description:'Impressão de Material Educativo',fiscal_note_number:'NF-2025-198',issue_date:'2025-06-10',gross_amount:2200,iss_rate:2,iss_withheld:44,irrf_rate:0,irrf_withheld:0,pis_rate:0,pis_withheld:0,cofins_rate:0,cofins_withheld:0,csll_rate:0,csll_withheld:0,inss_rate:0,inss_withheld:0,competency_period:'2025-06-01',due_date:'2025-06-25',tx_id:'ADRA9A8B7C6D5E4F3A2B1C9D8E7F6A5B4C3D',pix_payload:null,status:'pago_conciliado',paid_amount:2156,paid_at:'2025-06-26T11:30:00Z',created_by:'usr-001',created_at:'2025-06-10T08:00:00Z'},
    {id:'nf-005',project_id:'prj-002',bank_account_id:'ba-002',emitter_name:'Construtora Alves Eireli',emitter_cnpj:'55.666.777/0001-88',emitter_type:'lucro_real',service_description:'Reforma de Sede – Obra Civil',fiscal_note_number:'NF-2025-087',issue_date:'2025-07-08',gross_amount:28000,iss_rate:5,iss_withheld:1400,irrf_rate:1.5,irrf_withheld:420,pis_rate:0.65,pis_withheld:182,cofins_rate:3,cofins_withheld:840,csll_rate:1,csll_withheld:280,inss_rate:0,inss_withheld:0,competency_period:'2025-07-01',due_date:'2025-08-05',tx_id:null,pix_payload:null,status:'pendente',created_by:'usr-001',created_at:'2025-07-08T15:00:00Z'},
  ],
  internal_pendencies:[
    {id:'pend-001',sender_id:'usr-002',recipient_id:'usr-001',project_id:'prj-001',note_fiscal_id:'nf-003',accounting_period:'2025-07-01',subject:'Falta comprovante de serviço – RPA Maria Santos',status:'aberta',priority:'alta',created_at:'2025-07-06T08:00:00Z',messages:[
      {id:'msg-001',sender_id:'usr-002',content_text:'Ana, preciso do contrato de prestação de serviço da Maria Santos para fechar o mês de julho. Por favor, envie até sexta-feira.',created_at:'2025-07-06T08:01:00Z'},
      {id:'msg-002',sender_id:'usr-001',content_text:'Marcos, estou solicitando à Maria. Ela deverá enviar hoje à tarde.',created_at:'2025-07-06T10:15:00Z'}
    ]},
    {id:'pend-002',sender_id:'usr-001',recipient_id:'usr-002',project_id:'prj-002',accounting_period:'2025-07-01',subject:'Aprovação do balancete parcial – Projeto Esperança Julho',status:'em_analise',priority:'normal',created_at:'2025-07-08T14:00:00Z',messages:[
      {id:'msg-003',sender_id:'usr-001',content_text:'Marcos, por favor verifique os lançamentos do Projeto Esperança e aprove o balancete parcial. Precisamos até dia 15.',created_at:'2025-07-08T14:01:00Z'}
    ]},
    {id:'pend-003',sender_id:'usr-003',recipient_id:'usr-002',project_id:'prj-001',note_fiscal_id:'nf-003',accounting_period:'2025-07-01',subject:'INSS retido – RPA nutricionista (urgente SEFIP)',status:'aberta',priority:'urgente',created_at:'2025-07-09T07:30:00Z',messages:[
      {id:'msg-004',sender_id:'usr-003',content_text:'Marcos, precisamos confirmar a retenção do INSS da Maria Santos para lançar na SEFIP de julho. O prazo é amanhã!',created_at:'2025-07-09T07:31:00Z'}
    ]},
  ]
};

const S={user:{id:'demo',full_name:'Usuário Demo',role:'admin'},demoMode:true,sbClient:null,module:'dashboard',period:'',installPrompt:null};

const DB={
  KEY:'adra_db_v1',
  _data(){try{const r=localStorage.getItem(this.KEY);return r?JSON.parse(r):null;}catch{return null;}},
  _save(d){localStorage.setItem(this.KEY,JSON.stringify(d));},
  init(){let d=this._data();if(!d){d=JSON.parse(JSON.stringify(SEED_DATA));this._save(d);}return d;},
  async get(t){if(S.demoMode){const d=this._data()||this.init();return{data:d[t]||[],error:null};}return S.sbClient.from(t).select('*');},
  async getById(t,id){if(S.demoMode){const d=this._data()||this.init();const r=(d[t]||[]).find(x=>x.id===id);return{data:r||null,error:r?null:'Not found'};}return S.sbClient.from(t).select('*').eq('id',id).single();},
  async insert(t,row){if(S.demoMode){const d=this._data()||this.init();const n={...row,id:t.substring(0,2)+'-'+Date.now(),created_at:new Date().toISOString(),updated_at:new Date().toISOString()};if(!d[t])d[t]=[];d[t].unshift(n);this._save(d);return{data:n,error:null};}return S.sbClient.from(t).insert(row).select().single();},
  async update(t,id,fields){if(S.demoMode){const d=this._data()||this.init();const i=(d[t]||[]).findIndex(x=>x.id===id);if(i!==-1){d[t][i]={...d[t][i],...fields,updated_at:new Date().toISOString()};this._save(d);return{data:d[t][i],error:null};}return{data:null,error:'Not found'};}return S.sbClient.from(t).update(fields).eq('id',id).select().single();},
  async delete(t,id){if(S.demoMode){const d=this._data()||this.init();if(d[t])d[t]=d[t].filter(x=>x.id!==id);this._save(d);return{error:null};}return S.sbClient.from(t).delete().eq('id',id);},
  computeNote(n){const tx=round2((n.iss_withheld||0)+(n.irrf_withheld||0)+(n.pis_withheld||0)+(n.cofins_withheld||0)+(n.csll_withheld||0)+(n.inss_withheld||0));return{...n,tax_withheld:tx,net_amount:round2((n.gross_amount||0)-tx)};}
};

const RBAC={
  rules:{
    admin:{canApprove:true,canCreateNote:true,canManageUsers:true,canViewReports:true,canManageBanks:true,canSendPend:true},
    tesoureiro:{canApprove:true,canCreateNote:true,canManageUsers:false,canViewReports:true,canManageBanks:true,canSendPend:true},
    contador:{canApprove:false,canCreateNote:true,canManageUsers:false,canViewReports:true,canManageBanks:false,canSendPend:true},
    dp:{canApprove:false,canCreateNote:false,canManageUsers:true,canViewReports:true,canManageBanks:false,canSendPend:true},
    caixa:{canApprove:false,canCreateNote:true,canManageUsers:false,canViewReports:false,canManageBanks:false,canSendPend:false},
    demo:{canApprove:true,canCreateNote:true,canManageUsers:true,canViewReports:true,canManageBanks:true,canSendPend:true},
  },
  can(p){return !!(this.rules[S.user?.role]?.[p]);}
};

const Fmt={
  money(v){return new Intl.NumberFormat('pt-BR',{style:'currency',currency:'BRL'}).format(Number(v)||0);},
  number(v,d=2){return new Intl.NumberFormat('pt-BR',{minimumFractionDigits:d,maximumFractionDigits:d}).format(Number(v)||0);},
  pct(v){return`${Fmt.number(v,2)}%`;},
  date(iso){if(!iso)return'–';const d=new Date(iso+'T12:00:00');return isNaN(d)?iso:d.toLocaleDateString('pt-BR');},
  datetime(iso){if(!iso)return'–';const d=new Date(iso);return isNaN(d)?iso:d.toLocaleString('pt-BR');},
  period(ym){if(!ym)return'–';const[y,m]=(ym||'').split('-');const ms=['jan','fev','mar','abr','mai','jun','jul','ago','set','out','nov','dez'];return`${ms[parseInt(m)-1]||'?'}/${y}`;},
  cnpj(v){if(!v)return'–';const d=v.replace(/\D/g,'');if(d.length===11)return d.replace(/(\d{3})(\d{3})(\d{3})(\d{2})/,'$1.$2.$3-$4');if(d.length===14)return d.replace(/(\d{2})(\d{3})(\d{3})(\d{4})(\d{2})/,'$1.$2.$3/$4-$5');return v;},
  initials(n){return(n||'').split(' ').filter(Boolean).slice(0,2).map(p=>p[0]).join('').toUpperCase();}
};

function round2(v){return Math.round((v+Number.EPSILON)*100)/100;}

const FiscalEngine={
  calcIRRFProgressive(g){for(const b of IRRF_TABLE){if(g<=b.max)return Math.max(0,g*b.rate-b.deduction);}return 0;},
  calculate(emitterType,grossAmount){
    const r=TAX_RULES[emitterType];if(!r)return null;
    const g=Number(grossAmount)||0;
    const res={emitter_type:emitterType,gross_amount:g,iss_rate:r.iss,iss_withheld:0,irrf_rate:r.irrf,irrf_withheld:0,pis_rate:r.pis,pis_withheld:0,cofins_rate:r.cofins,cofins_withheld:0,csll_rate:r.csll,csll_withheld:0,inss_rate:r.inss,inss_withheld:0,note:r.note};
    if(r.retain_iss)res.iss_withheld=round2(g*r.iss/100);
    if(r.retain_pcc){res.pis_withheld=round2(g*r.pis/100);res.cofins_withheld=round2(g*r.cofins/100);res.csll_withheld=round2(g*r.csll/100);}
    if(r.retain_irrf){res.irrf_withheld=r.irrf_progressive?round2(this.calcIRRFProgressive(g)):round2(g*r.irrf/100);if(r.irrf_progressive&&g>0)res.irrf_rate=round2((res.irrf_withheld/g)*100);}
    if(r.retain_inss)res.inss_withheld=round2(g*r.inss/100);
    res.tax_withheld=round2(res.iss_withheld+res.irrf_withheld+res.pis_withheld+res.cofins_withheld+res.csll_withheld+res.inss_withheld);
    res.net_amount=round2(g-res.tax_withheld);
    return res;
  },
  renderBreakdown(c){
    if(!c)return'';
    const rows=[['ISS',c.iss_rate,c.iss_withheld],['IRRF',c.irrf_rate,c.irrf_withheld],['PIS',c.pis_rate,c.pis_withheld],['COFINS',c.cofins_rate,c.cofins_withheld],['CSLL',c.csll_rate,c.csll_withheld],['INSS',c.inss_rate,c.inss_withheld]].filter(r=>r[2]>0);
    return`<div class="bg-slate-50 rounded-xl p-4 border border-slate-200 mt-3"><p class="text-xs font-bold text-slate-500 uppercase tracking-wide mb-3">⚖️ Motor Fiscal — Retenções Calculadas</p>
    <table class="w-full text-sm"><tr><td class="py-1 font-semibold text-slate-700">Valor Bruto</td><td></td><td class="py-1 text-right font-bold text-slate-800">${Fmt.money(c.gross_amount)}</td></tr>
    ${rows.map(([n,rate,v])=>`<tr><td class="py-0.5 text-slate-600">${n}</td><td class="py-0.5 text-right text-slate-400 pr-4">${Fmt.pct(rate)}</td><td class="py-0.5 text-right text-red-600 font-medium">– ${Fmt.money(v)}</td></tr>`).join('')}
    <tr class="border-t border-slate-300"><td class="pt-2 font-bold text-red-700">Total Retido</td><td></td><td class="pt-2 text-right font-bold text-red-700">– ${Fmt.money(c.tax_withheld)}</td></tr>
    <tr><td class="py-1 font-bold text-emerald-700 text-base">Valor Líquido a Pagar</td><td></td><td class="py-1 text-right font-black text-emerald-700 text-lg">${Fmt.money(c.net_amount)}</td></tr>
    </table><p class="text-xs text-slate-400 mt-2">${c.note}</p></div>`;
  }
};

const PixEngine={
  calcCRC16(str){const bytes=new TextEncoder().encode(str);let crc=0xFFFF;for(const b of bytes){crc^=b<<8;for(let i=0;i<8;i++){crc=(crc&0x8000)?((crc<<1)^0x1021):(crc<<1);crc&=0xFFFF;}}return crc.toString(16).toUpperCase().padStart(4,'0');},
  f(id,val){const v=String(val);return`${id}${String(v.length).padStart(2,'0')}${v}`;},
  generateTxId(noteId=''){const h=(noteId||'').replace(/-/g,'').substring(0,20).toUpperCase();const ts=Date.now().toString(36).toUpperCase().padStart(8,'0');return`ADRA${h}${ts}`.substring(0,35);},
  generate({pixKey,name,city='BRASILIA',amount,txId,description=''}){
    const clean=s=>s.normalize('NFD').replace(/[\u0300-\u036f]/g,'').replace(/[^a-zA-Z0-9 ]/g,'');
    const mN=clean(name).toUpperCase().substring(0,25)||'ADRA';
    const mC=clean(city).toUpperCase().substring(0,15)||'BRASILIA';
    const amt=Number(amount).toFixed(2);
    const tx=(txId||'***').replace(/[^a-zA-Z0-9]/g,'').substring(0,25);
    const maiC=this.f('00','BR.GOV.BCB.PIX')+this.f('01',pixKey)+(description?this.f('02',description.substring(0,40)):'');
    const mai=this.f('26',maiC);const add=this.f('62',this.f('05',tx));
    const body='000201'+mai+'52040000'+'5303986'+this.f('54',amt)+'5802BR'+this.f('59',mN)+this.f('60',mC)+add+'6304';
    return body+this.calcCRC16(body);
  },
  renderQR(containerId,payload){
    const el=document.getElementById(containerId);if(!el)return;el.innerHTML='';
    if(typeof QRCode!=='undefined'){new QRCode(el,{text:payload,width:180,height:180,colorDark:'#0F2D4E',colorLight:'#FFFFFF',correctLevel:QRCode.CorrectLevel.M});}
    else{el.innerHTML='<p class="text-xs text-slate-400 text-center">QR Code indisponível</p>';}
  }
};

const UI={
  toast(msg,type='info',ms=4000){
    const c={success:'bg-emerald-600',error:'bg-red-600',warning:'bg-amber-500',info:'bg-adra-700'};
    const ic={success:'✅',error:'❌',warning:'⚠️',info:'ℹ️'};
    const el=document.createElement('div');
    el.className=`toast pointer-events-auto flex items-center gap-3 ${c[type]||c.info} text-white text-sm px-4 py-3 rounded-xl shadow-xl min-w-[240px] max-w-sm`;
    el.innerHTML=`<span>${ic[type]}</span><span class="flex-1">${msg}</span><button class="opacity-60 hover:opacity-100 ml-2 text-lg" onclick="this.parentElement.remove()">✕</button>`;
    document.getElementById('toast-container')?.prepend(el);setTimeout(()=>el.remove(),ms);
  },
  openModal({title='',body='',footer='',size='max-w-2xl'}={}){
    const ov=document.getElementById('modal-overlay');const bx=document.getElementById('modal-box');
    document.getElementById('modal-title').textContent=title;document.getElementById('modal-body').innerHTML=body;document.getElementById('modal-footer').innerHTML=footer;
    bx.className=bx.className.replace(/max-w-\S+/g,'')+' '+size;
    ov.classList.remove('hidden');ov.classList.add('flex');
    setTimeout(()=>bx.querySelector('input,select,textarea')?.focus(),80);
  },
  closeModal(){const ov=document.getElementById('modal-overlay');ov.classList.add('hidden');ov.classList.remove('flex');},
  closeModalOnBackdrop(e){if(e.target===document.getElementById('modal-overlay'))this.closeModal();},
  confirm(msg,onYes,{danger=false}={}){
    this.openModal({title:'Confirmar ação',size:'max-w-md',body:`<p class="text-slate-700">${msg}</p>`,
      footer:`<button onclick="UI.closeModal()" class="adra-btn border border-slate-300 text-slate-600 hover:bg-slate-50">Cancelar</button><button id="confirm-yes" class="adra-btn ${danger?'bg-red-600 hover:bg-red-700':'bg-adra-800 hover:bg-adra-700'} text-white">Confirmar</button>`});
    document.getElementById('confirm-yes')?.addEventListener('click',()=>{this.closeModal();onYes();});
  },
  loading(id='main-content'){const el=document.getElementById(id);if(el)el.innerHTML=`<div class="flex items-center justify-center h-64"><div class="text-center text-slate-400"><div class="w-10 h-10 border-4 border-adra-800 border-t-transparent rounded-full animate-spin mx-auto mb-3"></div><p class="text-sm">Carregando…</p></div></div>`;},
  render(html){const el=document.getElementById('main-content');if(el){el.innerHTML=html;el.scrollTop=0;}},
  badge(s){const l=STATUS_LABELS[s]||s;const ic={pendente:'⏳',aprovada:'✅',pix_gerado:'🔷',pago_conciliado:'💚',divergencia:'⚠️',cancelada:'🚫',aberta:'📂',em_analise:'🔍',resolvida:'✔️'};return`<span class="badge badge-${s}">${ic[s]||''} ${l}</span>`;},
  empty(msg='Sem registros',icon='📭'){return`<div class="text-center py-16 text-slate-400"><div class="text-5xl mb-3">${icon}</div><p class="text-sm font-medium">${msg}</p></div>`;}
};

// ═══════════ MODULE: DASHBOARD ═══════════
const ModDashboard={
  async render(){
    const{data:notes}=await DB.get('notes_fiscal');const{data:projects}=await DB.get('projects');const{data:pendencies}=await DB.get('internal_pendencies');
    const p=S.period;const pd=p?p+'-01':null;
    const actProj=projects.filter(x=>x.status==='ativo').length;
    const nfPend=notes.filter(n=>n.status==='pendente').length;const nfAprov=notes.filter(n=>n.status==='aprovada').length;
    const pendAb=pendencies.filter(x=>x.status==='aberta'||x.status==='em_analise').length;
    const totLiq=notes.filter(n=>pd&&n.competency_period===pd&&n.status!=='cancelada').reduce((a,n)=>a+DB.computeNote(n).net_amount,0);
    const totPago=notes.filter(n=>n.status==='pago_conciliado').reduce((a,n)=>a+(n.paid_amount||0),0);
    const totRet=notes.reduce((a,n)=>a+DB.computeNote(n).tax_withheld,0);
    const recent=[...notes].sort((a,b)=>new Date(b.created_at)-new Date(a.created_at)).slice(0,5).map(n=>DB.computeNote(n));
    const recentP=[...pendencies].sort((a,b)=>new Date(b.created_at)-new Date(a.created_at)).slice(0,4);
    UI.render(`<div class="p-6 space-y-6 fade-in">
<div class="flex items-center justify-between flex-wrap gap-3">
  <div><h1 class="text-xl font-bold text-slate-800">Dashboard</h1><p class="text-sm text-slate-500 mt-0.5">Período: ${Fmt.period(p)} · Bem-vindo, ${S.user.full_name}</p></div>
  ${RBAC.can('canCreateNote')?`<button onclick="ModNotasFiscais.openNew()" class="adra-btn bg-adra-800 text-white hover:bg-adra-700 shadow-sm">+ Nova Nota Fiscal</button>`:''}
</div>
<div class="grid grid-cols-2 lg:grid-cols-4 gap-4">
  <div class="kpi-card kpi-blue"><p class="text-xs text-slate-500 font-semibold uppercase tracking-wide">Projetos Ativos</p><p class="text-3xl font-black text-adra-800 mt-1">${actProj}</p><p class="text-xs text-slate-400 mt-1">de ${projects.length} total</p></div>
  <div class="kpi-card kpi-amber"><p class="text-xs text-slate-500 font-semibold uppercase tracking-wide">NF Pendentes</p><p class="text-3xl font-black text-amber-600 mt-1">${nfPend}</p><p class="text-xs text-slate-400 mt-1">${nfAprov} aguard. Pix</p></div>
  <div class="kpi-card kpi-red"><p class="text-xs text-slate-500 font-semibold uppercase tracking-wide">Pendências Abertas</p><p class="text-3xl font-black text-red-600 mt-1">${pendAb}</p><p class="text-xs text-slate-400 mt-1">do período</p></div>
  <div class="kpi-card kpi-green"><p class="text-xs text-slate-500 font-semibold uppercase tracking-wide">A Pagar – ${Fmt.period(p)}</p><p class="text-2xl font-black text-emerald-700 mt-1">${Fmt.money(totLiq)}</p><p class="text-xs text-slate-400 mt-1">líquido após retenções</p></div>
</div>
<div class="grid grid-cols-2 gap-4">
  <div class="kpi-card kpi-purple"><p class="text-xs text-slate-500 font-semibold uppercase tracking-wide">Total Retenções (histórico)</p><p class="text-2xl font-black text-purple-700 mt-1">${Fmt.money(totRet)}</p><p class="text-xs text-slate-400 mt-1">ISS · IRRF · PIS · COFINS · CSLL · INSS</p></div>
  <div class="kpi-card kpi-green"><p class="text-xs text-slate-500 font-semibold uppercase tracking-wide">Total Pago Conciliado</p><p class="text-2xl font-black text-emerald-700 mt-1">${Fmt.money(totPago)}</p><p class="text-xs text-slate-400 mt-1">${notes.filter(n=>n.status==='pago_conciliado').length} notas conciliadas</p></div>
</div>
<div class="bg-white rounded-xl border border-slate-200 overflow-hidden">
  <div class="flex items-center justify-between px-5 py-4 border-b border-slate-100"><h2 class="font-bold text-slate-700 text-sm">Últimas Notas Fiscais</h2><a href="#" onclick="App.navigate('notas-fiscais');return false;" class="text-xs text-blue-600 hover:underline">Ver todas →</a></div>
  ${recent.length===0?UI.empty('Nenhuma nota lançada','🧾'):`<div class="overflow-x-auto"><table class="adra-table"><thead><tr><th>Emitente</th><th>Projeto</th><th class="text-right">Bruto</th><th class="text-right">Líquido</th><th>Status</th></tr></thead><tbody>
  ${recent.map(n=>{const pr=projects.find(x=>x.id===n.project_id);return`<tr class="cursor-pointer" onclick="ModNotasFiscais.openDetail('${n.id}')"><td><p class="font-medium text-sm">${n.emitter_name}</p><p class="text-xs text-slate-400">${n.fiscal_note_number||'–'}</p></td><td class="text-xs text-slate-500">${pr?.name||'–'}</td><td class="text-right font-mono text-sm">${Fmt.money(n.gross_amount)}</td><td class="text-right font-mono text-sm font-bold text-emerald-700">${Fmt.money(n.net_amount)}</td><td>${UI.badge(n.status)}</td></tr>`;}).join('')}
  </tbody></table></div>`}
</div>
<div class="bg-white rounded-xl border border-slate-200 overflow-hidden">
  <div class="flex items-center justify-between px-5 py-4 border-b border-slate-100"><h2 class="font-bold text-slate-700 text-sm">Pendências Recentes</h2><a href="#" onclick="App.navigate('pendencias');return false;" class="text-xs text-blue-600 hover:underline">Ver todas →</a></div>
  ${recentP.length===0?UI.empty('Sem pendências abertas','💬'):`<div class="divide-y divide-slate-100">
  ${recentP.map(x=>{const pj=projects.find(q=>q.id===x.project_id);return`<div class="px-5 py-4 flex items-center gap-3 hover:bg-slate-50 cursor-pointer" onclick="ModPendencias.openThread('${x.id}')"><div class="w-2 h-2 rounded-full flex-shrink-0 ${x.priority==='urgente'?'bg-red-500 pulse-conciliado':x.priority==='alta'?'bg-amber-500':'bg-blue-400'}"></div><div class="flex-1 min-w-0"><p class="text-sm font-medium text-slate-700 truncate">${x.subject}</p><p class="text-xs text-slate-400">${pj?.name||'–'} · ${Fmt.period(x.accounting_period?.substring(0,7))}</p></div>${UI.badge(x.status)}</div>`;}).join('')}</div>`}
</div></div>`);
  }
};

// ═══════════ MODULE: PROJETOS ═══════════
const ModProjetos={
  async render(){
    const{data:projects}=await DB.get('projects');const{data:notes}=await DB.get('notes_fiscal');const{data:banks}=await DB.get('bank_accounts');
    UI.render(`<div class="p-6 fade-in"><div class="flex items-center justify-between mb-5 flex-wrap gap-3"><div><h1 class="text-xl font-bold text-slate-800">Projetos</h1><p class="text-sm text-slate-500 mt-0.5">${projects.length} projeto(s)</p></div>${RBAC.can('canCreateNote')?`<button onclick="ModProjetos.openNew()" class="adra-btn bg-adra-800 text-white hover:bg-adra-700 shadow-sm">+ Novo Projeto</button>`:''}</div>
    <div class="grid grid-cols-1 md:grid-cols-2 xl:grid-cols-3 gap-4">${projects.map(p=>this.cardHtml(p,notes,banks)).join('')}</div></div>`);
  },
  cardHtml(p,allN,allB){
    const pct=p.budget>0?Math.min(100,round2((p.spent/p.budget)*100)):0;
    const bc=allB.filter(b=>b.project_id===p.id).length;const nc=allN.filter(n=>n.project_id===p.id).length;
    const sc={ativo:'bg-emerald-100 text-emerald-700',encerrado:'bg-slate-100 text-slate-500',suspenso:'bg-amber-100 text-amber-700'};
    return`<div class="bg-white rounded-xl border border-slate-200 p-5 hover:shadow-md transition-shadow cursor-pointer" onclick="ModProjetos.openDetail('${p.id}')">
      <div class="flex items-start justify-between mb-3"><div class="flex-1 min-w-0 pr-2"><div class="flex items-center gap-1.5 mb-1.5 flex-wrap"><span class="text-xs px-2 py-0.5 rounded-full font-semibold ${p.type==='Livre'?'bg-blue-100 text-blue-700':'bg-purple-100 text-purple-700'}">${p.type}</span><span class="text-xs px-2 py-0.5 rounded-full font-semibold ${sc[p.status]}">${p.status}</span></div><h3 class="font-bold text-slate-800 text-sm leading-snug">${p.name}</h3>${p.code?`<p class="text-xs text-slate-400 mt-0.5">${p.code}</p>`:''}</div>
      <button class="text-xl flex-shrink-0 ${p.is_favorite?'text-amber-400':'text-slate-200 hover:text-amber-400'} transition-colors" onclick="event.stopPropagation();ModProjetos.toggleFav('${p.id}',${!p.is_favorite})">★</button></div>
      <div class="space-y-1.5 mb-4"><div class="flex justify-between text-xs text-slate-500"><span>Orçamento</span><span class="font-semibold text-slate-700">${Fmt.money(p.budget)}</span></div><div class="h-1.5 bg-slate-100 rounded-full overflow-hidden"><div class="h-full rounded-full ${pct>90?'bg-red-500':pct>70?'bg-amber-500':'bg-emerald-500'}" style="width:${pct}%"></div></div><div class="flex justify-between text-xs"><span class="text-slate-500">Gasto: <b class="text-slate-700">${Fmt.money(p.spent)}</b></span><span class="${pct>90?'text-red-600':'text-slate-400'}">${Fmt.pct(pct)}</span></div></div>
      <div class="flex items-center justify-between pt-3 border-t border-slate-100 text-xs text-slate-500"><span>🏛️ ${bc}</span><span>🧾 ${nc}</span><span>${p.start_date?Fmt.date(p.start_date):'–'}</span></div></div>`;
  },
  async toggleFav(id,val){await DB.update('projects',id,{is_favorite:val});App.updateFavoritesList();await this.render();UI.toast(val?'⭐ Favorito adicionado':'Favorito removido',val?'success':'info');},
  async openNew(){
    UI.openModal({title:'+ Novo Projeto',size:'max-w-lg',body:`<div class="space-y-4">
      <div><label class="adra-label">Nome *</label><input id="prj-name" class="adra-input" placeholder="Ex: Projeto Esperança – Norte" /></div>
      <div class="grid grid-cols-2 gap-4">
        <div><label class="adra-label">Código</label><input id="prj-code" class="adra-input" placeholder="ESPN-001" /></div>
        <div><label class="adra-label">Tipo *</label><select id="prj-type" class="adra-input"><option value="Livre">Livre</option><option value="Restrito">Restrito</option></select></div>
        <div><label class="adra-label">Orçamento (R$) *</label><input id="prj-budget" type="number" class="adra-input" min="0" step="0.01" /></div>
        <div><label class="adra-label">Status</label><select id="prj-status" class="adra-input"><option value="ativo">Ativo</option><option value="suspenso">Suspenso</option><option value="encerrado">Encerrado</option></select></div>
        <div><label class="adra-label">Início</label><input id="prj-start" type="date" class="adra-input" /></div>
        <div><label class="adra-label">Término</label><input id="prj-end" type="date" class="adra-input" /></div>
      </div><div><label class="adra-label">Observações</label><textarea id="prj-notes" class="adra-input h-20 resize-none"></textarea></div>
    </div>`,footer:`<button onclick="UI.closeModal()" class="adra-btn border border-slate-300 text-slate-600 hover:bg-slate-50">Cancelar</button><button onclick="ModProjetos.saveNew()" class="adra-btn bg-adra-800 text-white hover:bg-adra-700">Salvar</button>`});
  },
  async saveNew(){
    const name=document.getElementById('prj-name')?.value.trim();const budget=parseFloat(document.getElementById('prj-budget')?.value||0);
    if(!name){UI.toast('Informe o nome','warning');return;}if(!budget||budget<=0){UI.toast('Informe um orçamento válido','warning');return;}
    await DB.insert('projects',{name,code:document.getElementById('prj-code')?.value.trim(),type:document.getElementById('prj-type')?.value,budget,spent:0,status:document.getElementById('prj-status')?.value,start_date:document.getElementById('prj-start')?.value||null,end_date:document.getElementById('prj-end')?.value||null,notes:document.getElementById('prj-notes')?.value.trim(),is_favorite:false});
    UI.closeModal();UI.toast('✅ Projeto criado!','success');await this.render();App.updateFavoritesList();
  },
  async openDetail(id){
    const{data:p}=await DB.getById('projects',id);if(!p)return;
    const{data:banks}=await DB.get('bank_accounts');const{data:notes}=await DB.get('notes_fiscal');
    const pb=banks.filter(b=>b.project_id===id);const pn=notes.filter(n=>n.project_id===id).map(n=>DB.computeNote(n));
    const pct=p.budget>0?Math.min(100,round2((p.spent/p.budget)*100)):0;
    UI.openModal({title:p.name,size:'max-w-2xl',body:`<div class="space-y-5">
      <div class="grid grid-cols-3 gap-3"><div class="bg-blue-50 rounded-xl p-4"><p class="text-xs text-slate-500 mb-1">Orçamento</p><p class="font-bold text-adra-800">${Fmt.money(p.budget)}</p></div><div class="bg-amber-50 rounded-xl p-4"><p class="text-xs text-slate-500 mb-1">Gasto</p><p class="font-bold text-amber-700">${Fmt.money(p.spent)}</p></div><div class="bg-emerald-50 rounded-xl p-4"><p class="text-xs text-slate-500 mb-1">Saldo</p><p class="font-bold text-emerald-700">${Fmt.money(p.budget-p.spent)}</p></div></div>
      <div class="h-2 bg-slate-100 rounded-full overflow-hidden"><div class="h-full rounded-full ${pct>90?'bg-red-500':pct>70?'bg-amber-500':'bg-emerald-500'}" style="width:${pct}%"></div></div>
      <div><p class="text-xs font-semibold text-slate-500 uppercase tracking-wide mb-2">Contas Bancárias (${pb.length})</p>${pb.length===0?`<p class="text-sm text-slate-400 italic">Sem contas.</p>`:pb.map(b=>`<div class="flex items-center gap-3 px-3 py-2.5 bg-slate-50 rounded-lg mb-2 border border-slate-200"><span class="text-lg">🏛️</span><div class="flex-1 min-w-0"><p class="text-sm font-semibold">${b.bank_name} — Ag. ${b.agency} · C/C ${b.account_number}</p><p class="text-xs text-slate-400 font-mono">Pix: ${b.pix_key}</p></div></div>`).join('')}</div>
      <div><p class="text-xs font-semibold text-slate-500 uppercase tracking-wide mb-2">Notas Fiscais (${pn.length})</p>${pn.length===0?`<p class="text-sm text-slate-400 italic">Nenhuma.</p>`:`<table class="adra-table"><thead><tr><th>Emitente</th><th class="text-right">Líquido</th><th>Status</th></tr></thead><tbody>${pn.slice(0,6).map(n=>`<tr><td class="text-sm">${n.emitter_name}</td><td class="text-right font-mono text-emerald-700">${Fmt.money(n.net_amount)}</td><td>${UI.badge(n.status)}</td></tr>`).join('')}</tbody></table>`}</div>
      ${p.notes?`<div class="bg-slate-50 rounded-lg p-3 border"><p class="text-xs font-semibold text-slate-500 mb-1">Obs.</p><p class="text-sm text-slate-600">${p.notes}</p></div>`:''}
    </div>`,footer:`${RBAC.can('canManageBanks')?`<button onclick="ModContasBancarias.openNew('${id}');UI.closeModal()" class="adra-btn border border-slate-300 text-slate-600 hover:bg-slate-50 mr-auto">+ Conta Bancária</button>`:''}<button onclick="UI.closeModal()" class="adra-btn border border-slate-300 text-slate-600 hover:bg-slate-50">Fechar</button>${RBAC.can('canCreateNote')?`<button onclick="ModNotasFiscais.openNew('${id}');UI.closeModal()" class="adra-btn bg-adra-800 text-white hover:bg-adra-700">+ Nova NF</button>`:''}`});
  }
};

// ═══════════ MODULE: CONTAS BANCÁRIAS ═══════════
const ModContasBancarias={
  async render(){
    const{data:banks}=await DB.get('bank_accounts');const{data:projects}=await DB.get('projects');
    const grouped=projects.map(p=>({project:p,banks:banks.filter(b=>b.project_id===p.id)})).filter(g=>g.banks.length>0);
    UI.render(`<div class="p-6 fade-in"><div class="flex items-center justify-between mb-5 flex-wrap gap-3"><div><h1 class="text-xl font-bold text-slate-800">Contas Bancárias</h1><p class="text-sm text-slate-500">${banks.length} conta(s)</p></div>${RBAC.can('canManageBanks')?`<button onclick="ModContasBancarias.openNew()" class="adra-btn bg-adra-800 text-white hover:bg-adra-700 shadow-sm">+ Nova Conta</button>`:''}</div>
    <div class="space-y-4">${grouped.length===0?UI.empty('Nenhuma conta cadastrada'):grouped.map(g=>`<div class="bg-white rounded-xl border border-slate-200 overflow-hidden"><div class="px-5 py-3 bg-slate-50 border-b border-slate-200 flex items-center gap-2"><span class="text-xs px-2 py-0.5 rounded-full font-semibold ${g.project.type==='Livre'?'bg-blue-100 text-blue-700':'bg-purple-100 text-purple-700'}">${g.project.type}</span><span class="font-bold text-slate-700 text-sm">${g.project.name}</span></div>${g.banks.map(b=>`<div class="px-5 py-4 flex items-center gap-4 border-b border-slate-100 last:border-0"><div class="w-10 h-10 bg-adra-100 rounded-lg flex items-center justify-center text-lg flex-shrink-0">🏛️</div><div class="flex-1 min-w-0"><p class="font-semibold text-slate-800 text-sm">${b.bank_name}${b.bank_code?' ('+b.bank_code+')':''}</p><p class="text-xs text-slate-500">Ag. ${b.agency} · C/C ${b.account_number}${b.account_digit?'-'+b.account_digit:''}</p><p class="text-xs text-slate-400">Benef.: ${b.beneficiary_name}</p></div><div class="text-right"><p class="text-xs font-semibold text-slate-500 mb-1">Pix (${PIX_KEY_LABELS[b.pix_key_type]})</p><p class="text-xs font-mono bg-adra-50 text-adra-700 px-2 py-1 rounded border border-adra-200">${b.pix_key}</p></div>${RBAC.can('canManageBanks')?`<button onclick="ModContasBancarias.openEdit('${b.id}')" class="text-slate-400 hover:text-slate-600 p-1.5 rounded hover:bg-slate-100">✏️</button>`:''}</div>`).join('')}</div>`).join('')}</div></div>`);
  },
  async openNew(preProj=''){
    const{data:projects}=await DB.get('projects');
    UI.openModal({title:'+ Nova Conta Bancária',size:'max-w-lg',body:`<div class="space-y-4">
      <div><label class="adra-label">Projeto *</label><select id="ba-proj" class="adra-input"><option value="">Selecione…</option>${projects.filter(p=>p.status==='ativo').map(p=>`<option value="${p.id}" ${p.id===preProj?'selected':''}>${p.name}</option>`).join('')}</select></div>
      <div class="grid grid-cols-2 gap-4"><div><label class="adra-label">Banco *</label><input id="ba-bank" class="adra-input" /></div><div><label class="adra-label">Cód. BACEN</label><input id="ba-code" class="adra-input" placeholder="001" /></div><div><label class="adra-label">Agência *</label><input id="ba-agency" class="adra-input" /></div><div><label class="adra-label">Conta *</label><input id="ba-account" class="adra-input" placeholder="00012345-6" /></div>
      <div class="col-span-2"><label class="adra-label">Beneficiário *</label><input id="ba-benef" class="adra-input" /></div>
      <div><label class="adra-label">Tipo Pix *</label><select id="ba-pixtype" class="adra-input">${Object.entries(PIX_KEY_LABELS).map(([k,v])=>`<option value="${k}">${v}</option>`).join('')}</select></div>
      <div><label class="adra-label">Chave Pix *</label><input id="ba-pixkey" class="adra-input" /></div></div></div>`,
      footer:`<button onclick="UI.closeModal()" class="adra-btn border border-slate-300 text-slate-600 hover:bg-slate-50">Cancelar</button><button onclick="ModContasBancarias.saveNew()" class="adra-btn bg-adra-800 text-white hover:bg-adra-700">Salvar</button>`});
  },
  async saveNew(){
    const g=id=>document.getElementById(id)?.value.trim();
    if(!g('ba-proj')||!g('ba-bank')||!g('ba-agency')||!g('ba-account')||!g('ba-benef')||!g('ba-pixkey')){UI.toast('Preencha todos os campos','warning');return;}
    const acc=g('ba-account');await DB.insert('bank_accounts',{project_id:g('ba-proj'),bank_name:g('ba-bank'),bank_code:g('ba-code'),agency:g('ba-agency'),account_number:acc.split('-')[0].trim(),account_digit:acc.includes('-')?acc.split('-')[1].trim():null,beneficiary_name:g('ba-benef'),pix_key:g('ba-pixkey'),pix_key_type:document.getElementById('ba-pixtype')?.value,is_active:true});
    UI.closeModal();UI.toast('✅ Conta cadastrada!','success');if(S.module==='contas-bancarias')await this.render();
  },
  async openEdit(id){
    const{data:b}=await DB.getById('bank_accounts',id);if(!b)return;
    UI.openModal({title:`Editar — ${b.bank_name}`,size:'max-w-md',body:`<div class="space-y-4"><div><label class="adra-label">Chave Pix</label><input id="edit-pixkey" class="adra-input" value="${b.pix_key}" /></div><div><label class="adra-label">Tipo Chave Pix</label><select id="edit-pixtype" class="adra-input">${Object.entries(PIX_KEY_LABELS).map(([k,v])=>`<option value="${k}" ${k===b.pix_key_type?'selected':''}>${v}</option>`).join('')}</select></div><div><label class="adra-label">Beneficiário</label><input id="edit-benef" class="adra-input" value="${b.beneficiary_name}" /></div></div>`,
      footer:`<button onclick="UI.confirm('Desativar esta conta?',()=>ModContasBancarias.deactivate('${id}'),{danger:true})" class="adra-btn border border-red-300 text-red-600 hover:bg-red-50 mr-auto">Desativar</button><button onclick="UI.closeModal()" class="adra-btn border border-slate-300 text-slate-600 hover:bg-slate-50">Cancelar</button><button onclick="ModContasBancarias.saveEdit('${id}')" class="adra-btn bg-adra-800 text-white hover:bg-adra-700">Salvar</button>`});
  },
  async saveEdit(id){await DB.update('bank_accounts',id,{pix_key:document.getElementById('edit-pixkey')?.value.trim(),pix_key_type:document.getElementById('edit-pixtype')?.value,beneficiary_name:document.getElementById('edit-benef')?.value.trim()});UI.closeModal();UI.toast('✅ Conta atualizada','success');if(S.module==='contas-bancarias')await this.render();},
  async deactivate(id){await DB.update('bank_accounts',id,{is_active:false});UI.closeModal();UI.toast('Conta desativada','info');if(S.module==='contas-bancarias')await this.render();}
};

// ═══════════ MODULE: NOTAS FISCAIS ═══════════
const ModNotasFiscais={
  async render(){
    const{data:notes}=await DB.get('notes_fiscal');const{data:projects}=await DB.get('projects');
    const fil=notes.filter(n=>!S.period||n.competency_period?.startsWith(S.period)).map(n=>DB.computeNote(n)).sort((a,b)=>new Date(b.created_at)-new Date(a.created_at));
    UI.render(`<div class="p-6 fade-in"><div class="flex items-center justify-between mb-5 flex-wrap gap-3"><div><h1 class="text-xl font-bold text-slate-800">Notas Fiscais</h1><p class="text-sm text-slate-500">${fil.length} nota(s) — ${Fmt.period(S.period)}</p></div>${RBAC.can('canCreateNote')?`<button onclick="ModNotasFiscais.openNew()" class="adra-btn bg-adra-800 text-white hover:bg-adra-700 shadow-sm">+ Nova Nota Fiscal</button>`:''}</div>
    <div class="grid grid-cols-2 lg:grid-cols-4 gap-3 mb-5">${[['Bruto',fil.reduce((a,n)=>a+n.gross_amount,0),'text-slate-700'],['Retido',fil.reduce((a,n)=>a+n.tax_withheld,0),'text-red-600'],['Líquido',fil.reduce((a,n)=>a+n.net_amount,0),'text-emerald-700'],['Pend. Pag.',fil.filter(n=>n.status==='pix_gerado'||n.status==='aprovada').reduce((a,n)=>a+n.net_amount,0),'text-amber-600']].map(([l,v,c])=>`<div class="bg-white rounded-lg border border-slate-200 px-4 py-3"><p class="text-xs text-slate-500 uppercase tracking-wide font-semibold">${l}</p><p class="font-bold ${c} mt-1 text-lg">${Fmt.money(v)}</p></div>`).join('')}</div>
    <div class="bg-white rounded-xl border border-slate-200 overflow-hidden">${fil.length===0?UI.empty('Nenhuma nota no período','🧾'):`<div class="overflow-x-auto"><table class="adra-table"><thead><tr><th>NF / Emitente</th><th>Regime</th><th>Projeto</th><th class="text-right">Bruto</th><th class="text-right">Retido</th><th class="text-right">Líquido</th><th>Status</th><th class="text-center">Ações</th></tr></thead><tbody>
    ${fil.map(n=>{const pr=projects.find(x=>x.id===n.project_id);return`<tr><td><p class="font-semibold text-slate-800 text-sm">${n.emitter_name}</p><p class="text-xs text-slate-400">${n.fiscal_note_number||'–'} · ${Fmt.date(n.issue_date)}</p></td><td><span class="text-xs bg-slate-100 px-2 py-0.5 rounded font-medium text-slate-600">${EMITTER_LABELS[n.emitter_type]||n.emitter_type}</span></td><td class="text-xs text-slate-500 max-w-[120px] truncate">${pr?.name||'–'}</td><td class="text-right font-mono text-sm">${Fmt.money(n.gross_amount)}</td><td class="text-right font-mono text-sm text-red-600">–${Fmt.money(n.tax_withheld)}</td><td class="text-right font-mono text-sm font-bold text-emerald-700">${Fmt.money(n.net_amount)}</td><td>${UI.badge(n.status)}</td><td class="text-center"><div class="flex items-center justify-center gap-1"><button onclick="ModNotasFiscais.openDetail('${n.id}')" class="text-xs px-2 py-1 rounded text-slate-600 hover:bg-slate-100" title="Detalhes">👁️</button>${n.status==='pendente'&&RBAC.can('canApprove')?`<button onclick="ModNotasFiscais.approve('${n.id}')" class="text-xs px-2 py-1 rounded text-emerald-700 hover:bg-emerald-50" title="Aprovar">✅</button>`:''}${n.status==='aprovada'&&RBAC.can('canApprove')?`<button onclick="ModNotasFiscais.generatePix('${n.id}')" class="text-xs px-2 py-1 rounded text-blue-700 hover:bg-blue-50" title="Gerar Pix">🏦</button>`:''}${n.status==='pix_gerado'?`<button onclick="ModNotasFiscais.openPixModal('${n.id}')" class="text-xs px-2 py-1 rounded text-indigo-700 hover:bg-indigo-50" title="Ver Pix">📱</button>`:''}</div></td></tr>`;}).join('')}
    </tbody></table></div>`}</div></div>`);
  },
  async openNew(preProj=''){
    const{data:projects}=await DB.get('projects');const now=new Date().toISOString().split('T')[0];
    UI.openModal({title:'+ Nova Nota Fiscal',size:'max-w-2xl',body:`<div class="space-y-5">
      <div><p class="text-xs font-bold text-slate-500 uppercase tracking-wide mb-3 pb-2 border-b">Emitente</p>
      <div class="grid grid-cols-2 gap-4"><div class="col-span-2"><label class="adra-label">Emitente *</label><input id="nf-emitter" class="adra-input" /></div>
      <div><label class="adra-label">CPF / CNPJ *</label><input id="nf-cnpj" class="adra-input" /></div>
      <div><label class="adra-label">Regime Tributário *</label><select id="nf-type" class="adra-input" onchange="ModNotasFiscais.previewTax()">${Object.entries(EMITTER_LABELS).map(([k,v])=>`<option value="${k}">${v}</option>`).join('')}</select></div>
      <div class="col-span-2"><label class="adra-label">Descrição do Serviço</label><input id="nf-desc" class="adra-input" /></div>
      <div><label class="adra-label">Número NF</label><input id="nf-num" class="adra-input" /></div>
      <div><label class="adra-label">Data Emissão</label><input id="nf-issue" type="date" class="adra-input" value="${now}" /></div></div></div>
      <div><p class="text-xs font-bold text-slate-500 uppercase tracking-wide mb-3 pb-2 border-b">Valores</p>
      <div class="grid grid-cols-2 gap-4"><div><label class="adra-label">Valor Bruto (R$) *</label><input id="nf-gross" type="number" class="adra-input" min="0.01" step="0.01" oninput="ModNotasFiscais.previewTax()" /></div><div><label class="adra-label">Vencimento</label><input id="nf-due" type="date" class="adra-input" /></div></div>
      <div id="tax-preview" class="mt-2"></div></div>
      <div><p class="text-xs font-bold text-slate-500 uppercase tracking-wide mb-3 pb-2 border-b">Vinculação</p>
      <div class="grid grid-cols-2 gap-4"><div><label class="adra-label">Projeto *</label><select id="nf-project" class="adra-input" onchange="ModNotasFiscais.loadBanks()"><option value="">Selecione…</option>${projects.filter(p=>p.status==='ativo').map(p=>`<option value="${p.id}" ${p.id===preProj?'selected':''}>${p.name}</option>`).join('')}</select></div>
      <div><label class="adra-label">Conta / Pix</label><select id="nf-bank" class="adra-input"><option>Selecione o projeto…</option></select></div>
      <div class="col-span-2"><label class="adra-label">Período de Competência *</label><input id="nf-period" type="month" class="adra-input" value="${S.period}" /></div></div></div></div>`,
      footer:`<button onclick="UI.closeModal()" class="adra-btn border border-slate-300 text-slate-600 hover:bg-slate-50">Cancelar</button><button onclick="ModNotasFiscais.saveNew()" class="adra-btn bg-adra-800 text-white hover:bg-adra-700">Lançar Nota</button>`});
    if(preProj)setTimeout(()=>{ModNotasFiscais.loadBanks();ModNotasFiscais.previewTax();},120);
  },
  previewTax(){
    const g=parseFloat(document.getElementById('nf-gross')?.value||0);const t=document.getElementById('nf-type')?.value;
    const el=document.getElementById('tax-preview');if(!el)return;
    if(!g||!t){el.innerHTML='';return;}el.innerHTML=FiscalEngine.renderBreakdown(FiscalEngine.calculate(t,g));
  },
  async loadBanks(){
    const pid=document.getElementById('nf-project')?.value;const sel=document.getElementById('nf-bank');if(!sel)return;
    if(!pid){sel.innerHTML='<option>Selecione o projeto…</option>';return;}
    const{data:banks}=await DB.get('bank_accounts');const pb=banks.filter(b=>b.project_id===pid&&b.is_active);
    sel.innerHTML=pb.length===0?'<option value="">Sem contas</option>':pb.map(b=>`<option value="${b.id}">${b.bank_name} — ${b.pix_key}</option>`).join('');
  },
  async saveNew(){
    const g=id=>document.getElementById(id)?.value.trim();const gross=parseFloat(document.getElementById('nf-gross')?.value||0);
    if(!g('nf-emitter')||!g('nf-cnpj')||!gross||!g('nf-project')||!g('nf-period')){UI.toast('Preencha todos os campos obrigatórios','warning');return;}
    const calc=FiscalEngine.calculate(document.getElementById('nf-type')?.value,gross);
    await DB.insert('notes_fiscal',{project_id:g('nf-project'),bank_account_id:g('nf-bank')||null,emitter_name:g('nf-emitter'),emitter_cnpj:g('nf-cnpj'),emitter_type:document.getElementById('nf-type')?.value,service_description:g('nf-desc'),fiscal_note_number:g('nf-num'),issue_date:g('nf-issue')||null,due_date:g('nf-due')||null,gross_amount:calc.gross_amount,iss_rate:calc.iss_rate,iss_withheld:calc.iss_withheld,irrf_rate:calc.irrf_rate,irrf_withheld:calc.irrf_withheld,pis_rate:calc.pis_rate,pis_withheld:calc.pis_withheld,cofins_rate:calc.cofins_rate,cofins_withheld:calc.cofins_withheld,csll_rate:calc.csll_rate,csll_withheld:calc.csll_withheld,inss_rate:calc.inss_rate,inss_withheld:calc.inss_withheld,competency_period:g('nf-period')+'-01',status:'pendente',created_by:S.user.id});
    UI.closeModal();UI.toast('✅ Nota lançada! Aguarda aprovação.','success');App.updateBadges();
    if(S.module==='notas-fiscais')await this.render();else await ModDashboard.render();
  },
  async approve(id){
    if(!RBAC.can('canApprove')){UI.toast('Sem permissão','error');return;}
    UI.confirm('Aprovar esta nota fiscal?',async()=>{
      await DB.update('notes_fiscal',id,{status:'aprovada',approved_by:S.user.id,approved_at:new Date().toISOString()});
      UI.toast('✅ Nota aprovada!','success');App.updateBadges();
      if(S.module==='notas-fiscais')await this.render();else await ModDashboard.render();
    });
  },
  async generatePix(id){
    const{data:note}=await DB.getById('notes_fiscal',id);if(!note)return;const n=DB.computeNote(note);
    let bank=null;if(n.bank_account_id){const{data:b}=await DB.getById('bank_accounts',n.bank_account_id);bank=b;}
    if(!bank){const{data:banks}=await DB.get('bank_accounts');bank=banks.find(b=>b.project_id===n.project_id&&b.is_active);}
    if(!bank){UI.toast('Nenhuma conta bancária vinculada','error');return;}
    const txId=PixEngine.generateTxId(id);
    const payload=PixEngine.generate({pixKey:bank.pix_key,name:bank.beneficiary_name,city:'BRASILIA',amount:n.net_amount,txId,description:`NF ${n.fiscal_note_number||id.substring(0,8)}`});
    await DB.update('notes_fiscal',id,{tx_id:txId,pix_payload:payload,status:'pix_gerado'});
    UI.toast('🔷 Pix gerado!','success');
    if(S.module==='notas-fiscais')await this.render();if(S.module==='pix')await ModPix.render();
    setTimeout(()=>this.openPixModal(id),300);
  },
  async openDetail(id){
    const{data:note}=await DB.getById('notes_fiscal',id);if(!note)return;const n=DB.computeNote(note);
    const{data:projects}=await DB.get('projects');const pr=projects.find(x=>x.id===n.project_id);
    UI.openModal({title:`🧾 ${n.emitter_name}`,size:'max-w-2xl',body:`<div class="space-y-4">
      <div class="flex items-center gap-3 flex-wrap">${UI.badge(n.status)}<span class="text-xs bg-slate-100 text-slate-600 px-2 py-0.5 rounded">${EMITTER_LABELS[n.emitter_type]||n.emitter_type}</span><span class="text-xs text-slate-400">${Fmt.period(n.competency_period?.substring(0,7))}</span></div>
      <div class="grid grid-cols-2 gap-4"><div><p class="adra-label">Emitente</p><p class="text-sm font-semibold">${n.emitter_name}</p></div><div><p class="adra-label">CPF/CNPJ</p><p class="text-sm">${Fmt.cnpj(n.emitter_cnpj)}</p></div><div><p class="adra-label">Serviço</p><p class="text-sm">${n.service_description||'–'}</p></div><div><p class="adra-label">Projeto</p><p class="text-sm">${pr?.name||'–'}</p></div><div><p class="adra-label">Emissão</p><p class="text-sm">${Fmt.date(n.issue_date)}</p></div><div><p class="adra-label">Vencimento</p><p class="text-sm">${Fmt.date(n.due_date)}</p></div></div>
      ${FiscalEngine.renderBreakdown(n)}
      ${n.tx_id?`<div class="bg-indigo-50 border border-indigo-200 rounded-xl p-4"><p class="text-xs font-bold text-indigo-600 uppercase tracking-wide mb-1">TxId Pix</p><p class="font-mono text-xs text-indigo-800 break-all">${n.tx_id}</p></div>`:''}
      ${n.status==='pago_conciliado'?`<div class="bg-emerald-50 border border-emerald-200 rounded-xl p-4 flex items-center gap-3"><div class="w-3 h-3 bg-emerald-500 rounded-full pulse-conciliado flex-shrink-0"></div><div><p class="text-sm font-bold text-emerald-700">Pagamento Conciliado ✔</p><p class="text-xs text-emerald-600">Pago em ${Fmt.datetime(n.paid_at)} · ${Fmt.money(n.paid_amount)}</p></div></div>`:''}
      ${n.status==='divergencia'?`<div class="bg-red-50 border border-red-200 rounded-xl p-4"><p class="text-sm font-bold text-red-700">⚠️ Divergência</p><p class="text-xs text-red-600">${n.divergence_reason||'Valor recebido difere do esperado'}</p></div>`:''}
    </div>`,footer:`${n.status==='pendente'&&RBAC.can('canApprove')?`<button onclick="ModNotasFiscais.approve('${id}');UI.closeModal()" class="adra-btn bg-emerald-600 text-white hover:bg-emerald-700">✅ Aprovar</button>`:''}${n.status==='aprovada'&&RBAC.can('canApprove')?`<button onclick="ModNotasFiscais.generatePix('${id}');UI.closeModal()" class="adra-btn bg-blue-600 text-white hover:bg-blue-700">🏦 Gerar Pix</button>`:''}${n.status==='pix_gerado'?`<button onclick="ModNotasFiscais.openPixModal('${id}');UI.closeModal()" class="adra-btn bg-indigo-600 text-white hover:bg-indigo-700">📱 Ver Pix</button>`:''}<button onclick="UI.closeModal()" class="adra-btn border border-slate-300 text-slate-600 hover:bg-slate-50">Fechar</button>`});
  },
  async openPixModal(id){
    const{data:note}=await DB.getById('notes_fiscal',id);if(!note)return;const n=DB.computeNote(note);
    UI.openModal({title:'🏦 Pix — QR Code e Copia e Cola',size:'max-w-lg',body:`<div class="space-y-4 text-center">
      <div class="bg-emerald-50 rounded-xl p-4 border border-emerald-200"><p class="text-xs text-emerald-600 font-semibold mb-1">Valor Líquido a Pagar</p><p class="text-3xl font-black text-emerald-700">${Fmt.money(n.net_amount)}</p><p class="text-xs text-emerald-500 mt-1">${n.emitter_name}</p></div>
      <div id="pix-qr-code" class="flex justify-center py-2"></div>
      <div class="text-left"><p class="text-xs text-slate-500 font-semibold mb-2">Pix Copia e Cola (EMV)</p><div class="bg-slate-50 border border-slate-200 rounded-lg p-3"><p id="pix-payload-text" class="font-mono text-xs text-slate-700 break-all leading-relaxed">${n.pix_payload||'Payload indisponível'}</p><button onclick="navigator.clipboard.writeText(document.getElementById('pix-payload-text').textContent).then(()=>UI.toast('📋 Copiado!','success'))" class="mt-2 text-xs text-blue-600 hover:underline">📋 Copiar código</button></div></div>
      <div class="bg-indigo-50 rounded-lg p-3 border border-indigo-200 text-left"><p class="text-xs font-bold text-indigo-700 mb-1">TxId</p><p class="font-mono text-xs text-indigo-600 break-all">${n.tx_id||'–'}</p></div>
      ${n.status==='pix_gerado'&&RBAC.can('canApprove')?`<div class="bg-amber-50 border border-amber-200 rounded-lg p-3 text-left"><p class="text-xs text-amber-700 mb-2">⚙️ Simular webhook de conciliação bancária</p><button onclick="ModPix.simulateConciliation('${id}')" class="adra-btn bg-amber-500 text-white hover:bg-amber-600 text-xs w-full justify-center">🔄 Simular Pagamento Recebido</button></div>`:''}
    </div>`,footer:`<button onclick="UI.closeModal()" class="adra-btn border border-slate-300 text-slate-600 hover:bg-slate-50">Fechar</button>`});
    setTimeout(()=>{if(n.pix_payload)PixEngine.renderQR('pix-qr-code',n.pix_payload);},120);
  }
};

// ═══════════ MODULE: PIX & PAGAMENTOS ═══════════
const ModPix={
  async render(){
    const{data:notes}=await DB.get('notes_fiscal');const{data:projects}=await DB.get('projects');
    const payable=notes.filter(n=>n.status==='pix_gerado'||n.status==='aprovada').map(n=>DB.computeNote(n)).sort((a,b)=>(a.due_date||'')>(b.due_date||'')?1:-1);
    const conciliated=notes.filter(n=>n.status==='pago_conciliado').map(n=>DB.computeNote(n)).sort((a,b)=>new Date(b.paid_at)-new Date(a.paid_at)).slice(0,6);
    UI.render(`<div class="p-6 fade-in"><div class="mb-5"><h1 class="text-xl font-bold text-slate-800">Pix & Pagamentos</h1><p class="text-sm text-slate-500">${payable.length} nota(s) aguardando · ${Fmt.money(payable.reduce((a,n)=>a+n.net_amount,0))} a pagar</p></div>
    <div class="bg-white rounded-xl border border-slate-200 mb-5 overflow-hidden">
      <div class="px-5 py-4 border-b border-slate-100 bg-amber-50 flex items-center gap-2"><span>⏳</span><h2 class="font-bold text-slate-700 text-sm">Aguardando Pagamento</h2><span class="text-xs text-amber-700 bg-amber-200 rounded-full px-2 py-0.5 font-semibold">${payable.length}</span></div>
      ${payable.length===0?UI.empty('Nenhuma nota aguardando','✅'):`<div class="divide-y divide-slate-100">${payable.map(n=>{const pr=projects.find(x=>x.id===n.project_id);const ov=n.due_date&&new Date(n.due_date)<new Date();return`<div class="px-5 py-4 flex items-center gap-4 hover:bg-slate-50"><div class="flex-1 min-w-0"><div class="flex items-center gap-2 mb-1 flex-wrap">${UI.badge(n.status)}${ov?'<span class="badge bg-red-100 text-red-700">⚠️ Vencida</span>':''}</div><p class="font-semibold text-slate-800 text-sm">${n.emitter_name}</p><p class="text-xs text-slate-400">${pr?.name||'–'} · NF ${n.fiscal_note_number||'–'} · Vence ${Fmt.date(n.due_date)}</p></div><div class="text-right mr-3"><p class="font-bold text-emerald-700 font-mono text-lg">${Fmt.money(n.net_amount)}</p></div><div class="flex flex-col gap-1.5">${n.status==='aprovada'&&RBAC.can('canApprove')?`<button onclick="ModNotasFiscais.generatePix('${n.id}')" class="adra-btn bg-blue-600 text-white hover:bg-blue-700 text-xs">🏦 Gerar Pix</button>`:''} ${n.status==='pix_gerado'?`<button onclick="ModNotasFiscais.openPixModal('${n.id}')" class="adra-btn bg-indigo-600 text-white hover:bg-indigo-700 text-xs">📱 QR Code</button><button onclick="ModPix.simulateConciliation('${n.id}')" class="adra-btn border border-slate-300 text-slate-600 hover:bg-slate-50 text-xs">🔄 Simular</button>`:''}</div></div>`;}).join('')}</div>`}
    </div>
    <div class="bg-white rounded-xl border border-slate-200 overflow-hidden">
      <div class="px-5 py-4 border-b border-slate-100 bg-emerald-50 flex items-center gap-2"><span class="w-2 h-2 bg-emerald-500 rounded-full pulse-conciliado"></span><h2 class="font-bold text-slate-700 text-sm">Recentemente Conciliadas</h2></div>
      ${conciliated.length===0?UI.empty('Nenhuma conciliação ainda','🔄'):`<div class="divide-y divide-slate-100">${conciliated.map(n=>{const pr=projects.find(x=>x.id===n.project_id);return`<div class="px-5 py-3 flex items-center gap-3 hover:bg-slate-50"><span class="text-emerald-500 text-xl">✅</span><div class="flex-1 min-w-0"><p class="text-sm font-semibold">${n.emitter_name}</p><p class="text-xs text-slate-400">${pr?.name||'–'} · TxId: ${(n.tx_id||'–').substring(0,22)}…</p></div><div class="text-right"><p class="font-mono font-bold text-emerald-700">${Fmt.money(n.paid_amount||n.net_amount)}</p><p class="text-xs text-slate-400">${Fmt.datetime(n.paid_at)}</p></div></div>`;}).join('')}</div>`}
    </div></div>`);
  },
  simulateConciliation(noteId){
    UI.openModal({title:'🔄 Motor de Conciliação Bancária',size:'max-w-lg',body:`<div id="concil-log" class="font-mono text-xs bg-slate-900 text-green-400 p-4 rounded-xl h-52 overflow-y-auto leading-loose"><p>$ ADRA Conciliation Engine v1.0.0</p><p>Iniciando…</p></div><div id="concil-result" class="mt-4"></div>`,footer:`<button onclick="UI.closeModal()" class="adra-btn border border-slate-300 text-slate-600 hover:bg-slate-50">Fechar</button>`});
    const log=document.getElementById('concil-log');
    const addLog=(msg,d)=>setTimeout(()=>{if(!log)return;const p=document.createElement('p');p.textContent=msg;log.appendChild(p);log.scrollTop=log.scrollHeight;},d);
    addLog('> Conectando ao servidor bancário (TLS 1.3)…',500);addLog('> Autenticando via certificado ICP-Brasil…',1000);addLog('> Consultando extrato PIX D0 do dia…',1600);addLog('> Varrendo lote de 127 transações recebidas…',2200);addLog('> TxId localizado no registro #84…',2800);addLog('> Validando: valor esperado vs. valor recebido…',3400);addLog('> ✔ Valores conferem — Divergência: R$ 0,00',4000);addLog('> Atualizando status: pendente → pago_conciliado…',4600);addLog('> Criando aviso na caixa de pendências…',5100);addLog('> ✔ CONCILIAÇÃO AUTOMÁTICA CONCLUÍDA COM SUCESSO',5600);
    setTimeout(async()=>{
      const{data:note}=await DB.getById('notes_fiscal',noteId);if(!note)return;const n=DB.computeNote(note);
      await DB.update('notes_fiscal',noteId,{status:'pago_conciliado',paid_amount:n.net_amount,paid_at:new Date().toISOString()});
      const res=document.getElementById('concil-result');
      if(res)res.innerHTML=`<div class="bg-emerald-50 border border-emerald-300 rounded-xl p-4 text-center fade-in"><div class="text-4xl mb-2">✅</div><p class="font-bold text-emerald-800 text-lg">Pago e Conciliado!</p><p class="text-sm text-emerald-600">${Fmt.money(n.net_amount)} · ${new Date().toLocaleString('pt-BR')}</p></div>`;
      App.updateBadges();UI.toast('💚 Pagamento conciliado!','success');
      if(S.module==='pix')await this.render();if(S.module==='notas-fiscais')await ModNotasFiscais.render();
    },6200);
  }
};

// ═══════════ MODULE: PENDÊNCIAS ═══════════
const ModPendencias={
  async render(){
    const{data:pendencies}=await DB.get('internal_pendencies');const{data:projects}=await DB.get('projects');const{data:profiles}=await DB.get('profiles');
    const fil=[...pendencies].filter(p=>!S.period||p.accounting_period?.startsWith(S.period)).sort((a,b)=>{const o={urgente:0,alta:1,normal:2,baixa:3};return(o[a.priority]-o[b.priority])||new Date(b.created_at)-new Date(a.created_at);});
    UI.render(`<div class="p-6 fade-in"><div class="flex items-center justify-between mb-5 flex-wrap gap-3"><div><h1 class="text-xl font-bold text-slate-800">Pendências Internas</h1><p class="text-sm text-slate-500">${fil.length} pendência(s) — ${Fmt.period(S.period)}</p></div>${RBAC.can('canSendPend')?`<button onclick="ModPendencias.openNew()" class="adra-btn bg-adra-800 text-white hover:bg-adra-700 shadow-sm">+ Nova Pendência</button>`:''}</div>
    ${fil.length===0?UI.empty('Nenhuma pendência no período','💬'):`<div class="space-y-3">${fil.map(p=>{
      const prj=projects.find(x=>x.id===p.project_id);const sn=profiles.find(x=>x.id===p.sender_id);const rp=profiles.find(x=>x.id===p.recipient_id);const msgs=(p.messages||[]).length;
      const bc={urgente:'border-l-red-500',alta:'border-l-amber-500',normal:'border-l-blue-500',baixa:'border-l-slate-300'};
      return`<div class="bg-white rounded-xl border border-slate-200 border-l-4 ${bc[p.priority]||'border-l-slate-300'} p-5 hover:shadow-sm cursor-pointer" onclick="ModPendencias.openThread('${p.id}')"><div class="flex items-start gap-3"><div class="flex-1 min-w-0"><div class="flex items-center gap-2 mb-1.5 flex-wrap">${UI.badge(p.status)}<span class="text-xs text-slate-500">${PRIORITY_LABELS[p.priority]}</span></div><p class="font-semibold text-slate-800 text-sm">${p.subject}</p><p class="text-xs text-slate-400 mt-1">${sn?.full_name||'?'} → ${rp?.full_name||'?'}${prj?' · '+prj.name:''} · ${Fmt.period(p.accounting_period?.substring(0,7))}</p></div><div class="text-right flex-shrink-0"><p class="text-xs text-slate-400">${Fmt.date(p.created_at)}</p>${msgs>0?`<p class="text-xs text-slate-500 mt-1">💬 ${msgs}</p>`:''}</div></div></div>`;
    }).join('')}</div>`}</div>`);
  },
  async openNew(){
    const{data:profiles}=await DB.get('profiles');const{data:projects}=await DB.get('projects');
    const others=profiles.filter(u=>u.id!==S.user.id&&u.is_active);const now=new Date().toISOString().substring(0,7);
    UI.openModal({title:'+ Nova Pendência',size:'max-w-lg',body:`<div class="space-y-4">
      <div><label class="adra-label">Destinatário *</label><select id="pend-recip" class="adra-input"><option value="">Selecione…</option>${others.map(u=>`<option value="${u.id}">${u.full_name} (${ROLE_LABELS[u.role]})</option>`).join('')}</select></div>
      <div><label class="adra-label">Projeto</label><select id="pend-proj" class="adra-input"><option value="">Nenhum</option>${projects.map(p=>`<option value="${p.id}">${p.name}</option>`).join('')}</select></div>
      <div><label class="adra-label">Assunto *</label><input id="pend-subject" class="adra-input" /></div>
      <div class="grid grid-cols-2 gap-4"><div><label class="adra-label">Prioridade</label><select id="pend-prio" class="adra-input">${Object.entries(PRIORITY_LABELS).map(([k,v])=>`<option value="${k}">${v}</option>`).join('')}</select></div><div><label class="adra-label">Período Contábil *</label><input id="pend-period" type="month" class="adra-input" value="${S.period||now}" /></div></div>
      <div><label class="adra-label">Primeira Mensagem *</label><textarea id="pend-msg" class="adra-input h-24 resize-none"></textarea></div>
    </div>`,footer:`<button onclick="UI.closeModal()" class="adra-btn border border-slate-300 text-slate-600 hover:bg-slate-50">Cancelar</button><button onclick="ModPendencias.saveNew()" class="adra-btn bg-adra-800 text-white hover:bg-adra-700">Enviar</button>`});
  },
  async saveNew(){
    const g=id=>document.getElementById(id)?.value.trim();
    if(!g('pend-recip')||!g('pend-subject')||!g('pend-msg')||!g('pend-period')){UI.toast('Preencha todos os campos','warning');return;}
    const d=DB._data()||DB.init();const pend={id:'pend-'+Date.now(),sender_id:S.user.id,recipient_id:g('pend-recip'),project_id:g('pend-proj')||null,accounting_period:g('pend-period')+'-01',subject:g('pend-subject'),status:'aberta',priority:document.getElementById('pend-prio')?.value||'normal',messages:[{id:'msg-'+Date.now(),sender_id:S.user.id,content_text:g('pend-msg'),created_at:new Date().toISOString()}],created_at:new Date().toISOString(),updated_at:new Date().toISOString()};
    d.internal_pendencies.unshift(pend);DB._save(d);UI.closeModal();UI.toast('✅ Pendência enviada!','success');App.updateBadges();if(S.module==='pendencias')await this.render();
  },
  async openThread(pendId){
    const d=DB._data()||DB.init();const pend=d.internal_pendencies?.find(p=>p.id===pendId);if(!pend)return;
    const{data:profiles}=await DB.get('profiles');const{data:projects}=await DB.get('projects');
    const prj=projects.find(p=>p.id===pend.project_id);const msgs=pend.messages||[];const sn=profiles.find(p=>p.id===pend.sender_id);const rp=profiles.find(p=>p.id===pend.recipient_id);
    const so=['aberta','em_analise','resolvida','cancelada'].map(s=>`<option value="${s}" ${s===pend.status?'selected':''}>${STATUS_LABELS[s]}</option>`).join('');
    UI.openModal({title:`💬 ${pend.subject}`,size:'max-w-2xl',body:`<div class="space-y-4">
      <div class="flex items-center gap-2 flex-wrap">${UI.badge(pend.status)}<span class="text-xs text-slate-500">${PRIORITY_LABELS[pend.priority]}</span>${prj?`<span class="text-xs bg-blue-100 text-blue-700 px-2 py-0.5 rounded-full">${prj.name}</span>`:''}</div>
      <p class="text-xs text-slate-500">De: <b>${sn?.full_name||'?'}</b> → Para: <b>${rp?.full_name||'?'}</b> · ${Fmt.period(pend.accounting_period?.substring(0,7))}</p>
      <div class="bg-slate-50 border border-slate-200 rounded-xl p-4 space-y-4 max-h-60 overflow-y-auto" id="msg-thread">${msgs.map(m=>{const u=profiles.find(p=>p.id===m.sender_id);const isMe=m.sender_id===S.user.id;return`<div class="flex ${isMe?'justify-end':'justify-start'}"><div class="max-w-[82%]"><p class="text-[10px] text-slate-400 mb-1 ${isMe?'text-right':''}">${u?.full_name||'?'} · ${Fmt.datetime(m.created_at)}</p><div class="${isMe?'bg-adra-800 text-white':'bg-white border border-slate-200'} rounded-xl px-4 py-3 text-sm">${m.content_text||''}</div></div></div>`;}).join('')}</div>
      <div class="space-y-3"><textarea id="reply-msg" class="adra-input h-20 resize-none" placeholder="Escreva sua resposta…"></textarea><div class="flex items-center justify-between flex-wrap gap-2"><div class="flex items-center gap-2"><label class="text-xs text-slate-500 font-semibold">Status:</label><select id="pend-new-status" class="adra-input py-1 text-xs" style="width:auto">${so}</select></div><button onclick="ModPendencias.sendReply('${pendId}')" class="adra-btn bg-adra-800 text-white hover:bg-adra-700 text-sm">Enviar Resposta</button></div></div>
    </div>`,footer:`<button onclick="UI.closeModal()" class="adra-btn border border-slate-300 text-slate-600 hover:bg-slate-50">Fechar</button>`});
    setTimeout(()=>{const t=document.getElementById('msg-thread');if(t)t.scrollTop=t.scrollHeight;},100);
  },
  async sendReply(pendId){
    const txt=document.getElementById('reply-msg')?.value.trim();const sts=document.getElementById('pend-new-status')?.value;
    if(!txt){UI.toast('Escreva uma mensagem','warning');return;}
    const d=DB._data()||DB.init();const idx=d.internal_pendencies.findIndex(p=>p.id===pendId);if(idx===-1)return;
    if(!d.internal_pendencies[idx].messages)d.internal_pendencies[idx].messages=[];
    d.internal_pendencies[idx].messages.push({id:'msg-'+Date.now(),sender_id:S.user.id,content_text:txt,created_at:new Date().toISOString()});
    d.internal_pendencies[idx].status=sts;d.internal_pendencies[idx].updated_at=new Date().toISOString();
    DB._save(d);UI.closeModal();UI.toast('✅ Resposta enviada!','success');App.updateBadges();if(S.module==='pendencias')await this.render();
  }
};

// ═══════════ MODULE: RELATÓRIO ═══════════
const ModRelatorio={
  async render(){
    const{data:notes}=await DB.get('notes_fiscal');const{data:projects}=await DB.get('projects');
    const fil=notes.filter(n=>!S.period||n.competency_period?.startsWith(S.period)).map(n=>DB.computeNote(n));
    const byProj=projects.map(p=>{const pn=fil.filter(n=>n.project_id===p.id);return{...p,notes:pn,bruto:pn.reduce((a,n)=>a+n.gross_amount,0),retido:pn.reduce((a,n)=>a+n.tax_withheld,0),liq:pn.reduce((a,n)=>a+n.net_amount,0),pago:pn.filter(n=>n.status==='pago_conciliado').reduce((a,n)=>a+(n.paid_amount||0),0)};}).filter(p=>p.notes.length>0);
    UI.render(`<div class="p-6 fade-in"><div class="flex items-center justify-between mb-5 flex-wrap gap-3"><div><h1 class="text-xl font-bold text-slate-800">Balancete Mensal</h1><p class="text-sm text-slate-500">Período: ${Fmt.period(S.period)}</p></div><button onclick="window.print()" class="adra-btn border border-slate-300 text-slate-600 hover:bg-slate-50">🖨️ Imprimir</button></div>
    <div class="grid grid-cols-2 lg:grid-cols-4 gap-4 mb-5">${[['Total Bruto',fil.reduce((a,n)=>a+n.gross_amount,0),'text-slate-700'],['Total Retido',fil.reduce((a,n)=>a+n.tax_withheld,0),'text-red-600'],['Total Líquido',fil.reduce((a,n)=>a+n.net_amount,0),'text-emerald-700'],['Total Pago',fil.filter(n=>n.status==='pago_conciliado').reduce((a,n)=>a+(n.paid_amount||0),0),'text-blue-700']].map(([l,v,c])=>`<div class="bg-white rounded-xl border border-slate-200 p-4"><p class="text-xs text-slate-500 uppercase tracking-wide font-semibold">${l}</p><p class="text-xl font-black ${c} mt-1">${Fmt.money(v)}</p></div>`).join('')}</div>
    <div class="bg-white rounded-xl border border-slate-200 overflow-hidden"><div class="px-5 py-3 bg-slate-50 border-b border-slate-200"><h2 class="font-bold text-slate-700 text-sm">Detalhamento por Projeto</h2></div>
    ${byProj.length===0?UI.empty('Nenhum lançamento no período','📋'):`<div class="overflow-x-auto"><table class="adra-table"><thead><tr><th>Projeto</th><th>Tipo</th><th class="text-center">NFs</th><th class="text-right">Bruto</th><th class="text-right">Retido</th><th class="text-right">Líquido</th><th class="text-right">Pago</th></tr></thead><tbody>
    ${byProj.map(p=>`<tr><td><p class="font-semibold text-slate-800 text-sm">${p.name}</p><p class="text-xs text-slate-400">${p.code||'–'}</p></td><td><span class="text-xs px-2 py-0.5 rounded-full font-semibold ${p.type==='Livre'?'bg-blue-100 text-blue-700':'bg-purple-100 text-purple-700'}">${p.type}</span></td><td class="text-center">${p.notes.length}</td><td class="text-right font-mono text-sm">${Fmt.money(p.bruto)}</td><td class="text-right font-mono text-sm text-red-600">–${Fmt.money(p.retido)}</td><td class="text-right font-mono text-sm font-bold text-emerald-700">${Fmt.money(p.liq)}</td><td class="text-right font-mono text-sm text-blue-700">${Fmt.money(p.pago)}</td></tr>`).join('')}
    <tr class="bg-slate-50 font-bold border-t-2 border-slate-300"><td colspan="3" class="font-bold text-slate-700 py-3">TOTAL GERAL</td><td class="text-right font-mono text-sm">${Fmt.money(byProj.reduce((a,p)=>a+p.bruto,0))}</td><td class="text-right font-mono text-sm text-red-600">–${Fmt.money(byProj.reduce((a,p)=>a+p.retido,0))}</td><td class="text-right font-mono text-sm text-emerald-700">${Fmt.money(byProj.reduce((a,p)=>a+p.liq,0))}</td><td class="text-right font-mono text-sm text-blue-700">${Fmt.money(byProj.reduce((a,p)=>a+p.pago,0))}</td></tr>
    </tbody></table></div>`}</div></div>`);
  }
};

// ═══════════ MODULE: USUÁRIOS ═══════════
const ModUsuarios={
  async render(){
    const{data:profiles}=await DB.get('profiles');
    UI.render(`<div class="p-6 fade-in"><div class="flex items-center justify-between mb-5 flex-wrap gap-3"><div><h1 class="text-xl font-bold text-slate-800">Usuários e Papéis</h1><p class="text-sm text-slate-500">${profiles.length} usuário(s)</p></div>${RBAC.can('canManageUsers')?`<button onclick="ModUsuarios.openNew()" class="adra-btn bg-adra-800 text-white hover:bg-adra-700 shadow-sm">+ Novo Usuário</button>`:''}</div>
    <div class="bg-white rounded-xl border border-slate-200 overflow-hidden mb-5"><table class="adra-table"><thead><tr><th>Usuário</th><th>Papel</th><th>Departamento</th><th>Status</th>${RBAC.can('canManageUsers')?'<th>Ações</th>':''}</tr></thead><tbody>
    ${profiles.map(u=>`<tr><td><div class="flex items-center gap-3"><div class="w-9 h-9 bg-adra-600 rounded-full flex items-center justify-center text-white text-xs font-bold">${Fmt.initials(u.full_name)}</div><div><p class="font-semibold text-slate-800 text-sm">${u.full_name}</p></div></div></td><td><span class="badge bg-adra-100 text-adra-800">${ROLE_LABELS[u.role]||u.role}</span></td><td class="text-slate-500 text-sm">${u.department||'–'}</td><td>${u.is_active?'<span class="badge bg-emerald-100 text-emerald-700">Ativo</span>':'<span class="badge bg-red-100 text-red-700">Inativo</span>'}</td>${RBAC.can('canManageUsers')?`<td><button onclick="ModUsuarios.editRole('${u.id}')" class="text-xs px-2 py-1 rounded text-slate-600 hover:bg-slate-100">✏️ Papel</button></td>`:''}</tr>`).join('')}</tbody></table></div>
    <div class="bg-white rounded-xl border border-slate-200 p-5"><h3 class="font-bold text-slate-700 text-sm mb-4">Matriz de Permissões (RBAC)</h3><div class="overflow-x-auto"><table class="w-full text-xs"><thead><tr><th class="text-left py-2 pr-4 text-slate-500 font-semibold">Permissão</th>${Object.keys(RBAC.rules).map(r=>`<th class="py-2 px-2 text-center text-slate-500 font-semibold">${ROLE_LABELS[r]}</th>`).join('')}</tr></thead><tbody>
    ${[['canCreateNote','Criar Nota Fiscal'],['canApprove','Aprovar / Gerar Pix'],['canManageBanks','Contas Bancárias'],['canViewReports','Relatórios'],['canManageUsers','Usuários'],['canSendPend','Enviar Pendências']].map(([perm,label])=>`<tr class="border-t border-slate-100"><td class="py-2 pr-4 text-slate-600">${label}</td>${Object.keys(RBAC.rules).map(r=>`<td class="py-2 px-2 text-center">${RBAC.rules[r][perm]?'✅':'–'}</td>`).join('')}</tr>`).join('')}</tbody></table></div></div></div>`);
  },
  async openNew(){
    UI.openModal({title:'+ Novo Usuário',size:'max-w-md',body:`<div class="space-y-4"><div><label class="adra-label">Nome Completo *</label><input id="usr-name" class="adra-input" /></div><div><label class="adra-label">Departamento</label><input id="usr-dept" class="adra-input" /></div><div><label class="adra-label">Papel *</label><select id="usr-role" class="adra-input">${Object.entries(ROLE_LABELS).filter(([k])=>k!=='demo').map(([k,v])=>`<option value="${k}">${v}</option>`).join('')}</select></div></div>`,
      footer:`<button onclick="UI.closeModal()" class="adra-btn border border-slate-300 text-slate-600 hover:bg-slate-50">Cancelar</button><button onclick="ModUsuarios.saveNew()" class="adra-btn bg-adra-800 text-white hover:bg-adra-700">Criar</button>`});
  },
  async saveNew(){
    const name=document.getElementById('usr-name')?.value.trim();const role=document.getElementById('usr-role')?.value;
    if(!name||!role){UI.toast('Preencha nome e papel','warning');return;}
    await DB.insert('profiles',{id:'usr-'+Date.now(),full_name:name,role,department:document.getElementById('usr-dept')?.value.trim(),is_active:true});
    UI.closeModal();UI.toast('✅ Usuário criado','success');await this.render();
  },
  async editRole(id){
    UI.openModal({title:'Alterar Papel',size:'max-w-xs',body:`<div><label class="adra-label">Novo Papel</label><select id="edit-role" class="adra-input">${Object.entries(ROLE_LABELS).filter(([k])=>k!=='demo').map(([k,v])=>`<option value="${k}">${v}</option>`).join('')}</select></div>`,
      footer:`<button onclick="UI.closeModal()" class="adra-btn border border-slate-300 text-slate-600 hover:bg-slate-50">Cancelar</button><button onclick="ModUsuarios.saveRole('${id}')" class="adra-btn bg-adra-800 text-white hover:bg-adra-700">Salvar</button>`});
  },
  async saveRole(id){await DB.update('profiles',id,{role:document.getElementById('edit-role')?.value});UI.closeModal();UI.toast('✅ Papel atualizado','success');await this.render();}
};

// ═══════════ MODULE: CONFIGURAÇÕES ═══════════
const ModConfiguracoes={
  render(){
    UI.render(`<div class="p-6 fade-in max-w-2xl"><h1 class="text-xl font-bold text-slate-800 mb-5">Configurações</h1><div class="space-y-5">
      <div class="bg-white rounded-xl border border-slate-200 p-5"><h3 class="font-bold text-slate-700 text-sm mb-4">🔗 Conexão Supabase</h3><div class="space-y-3"><div><label class="adra-label">URL do Projeto</label><input id="cfg-url" class="adra-input font-mono text-xs" value="${localStorage.getItem('adra_url')||''}" placeholder="https://xxx.supabase.co" /></div><div><label class="adra-label">Chave Anon</label><input id="cfg-key" class="adra-input font-mono text-xs" type="password" value="${localStorage.getItem('adra_key')||''}" placeholder="eyJ…" /></div><div class="flex gap-3 pt-1"><button onclick="ModConfiguracoes.saveConn()" class="adra-btn bg-adra-800 text-white hover:bg-adra-700">Conectar</button><button onclick="ModConfiguracoes.clearConn()" class="adra-btn border border-red-300 text-red-600 hover:bg-red-50">Limpar / Demo</button></div><div class="text-xs ${S.demoMode?'text-amber-700 bg-amber-50 border border-amber-200':'text-emerald-700 bg-emerald-50 border border-emerald-200'} rounded-lg p-3">${S.demoMode?'🧪 Modo Demo — dados no localStorage':'✅ Conectado ao Supabase'}</div></div></div>
      <div class="bg-white rounded-xl border border-slate-200 p-5"><h3 class="font-bold text-slate-700 text-sm mb-2">🗑️ Resetar Dados de Demo</h3><p class="text-xs text-slate-500 mb-3">Reinicia todos os dados para o estado inicial.</p><button onclick="ModConfiguracoes.resetDemo()" class="adra-btn border border-red-300 text-red-600 hover:bg-red-50">Resetar Dados Demo</button></div>
      <div class="bg-white rounded-xl border border-slate-200 p-5"><h3 class="font-bold text-slate-700 text-sm mb-2">📱 Instalação PWA</h3><p class="text-xs text-slate-500 mb-3">Instale o ADRA Finanças no dispositivo para acesso offline.</p><button onclick="App.triggerInstall()" class="adra-btn bg-adra-800 text-white hover:bg-adra-700 mb-2">📥 Instalar App</button><p class="text-xs text-slate-400 mt-2">iOS: Compartilhar → "Adicionar à Tela de Início"</p></div>
    </div></div>`);
  },
  saveConn(){const url=document.getElementById('cfg-url')?.value.trim();const key=document.getElementById('cfg-key')?.value.trim();if(!url||!key){UI.toast('Informe URL e chave','warning');return;}localStorage.setItem('adra_url',url);localStorage.setItem('adra_key',key);S.demoMode=false;try{S.sbClient=supabase.createClient(url,key);UI.toast('✅ Conectado!','success');}catch{S.demoMode=true;UI.toast('Erro ao conectar. Modo demo.','error');}this.render();},
  clearConn(){localStorage.removeItem('adra_url');localStorage.removeItem('adra_key');S.demoMode=true;S.sbClient=null;UI.toast('Modo Demo ativo','info');this.render();},
  resetDemo(){UI.confirm('Resetar todos os dados de demonstração?',()=>{localStorage.removeItem(DB.KEY);DB.init();UI.toast('✅ Dados resetados','success');App.navigate('dashboard');},{danger:true});}
};

// ═══════════ APP — Router, Sidebar, PWA ═══════════
const App={
  MODULE_MAP:{
    'dashboard':{label:'Dashboard',mod:()=>ModDashboard.render()},
    'projetos':{label:'Projetos',mod:()=>ModProjetos.render()},
    'contas-bancarias':{label:'Contas Bancárias',mod:()=>ModContasBancarias.render()},
    'notas-fiscais':{label:'Notas Fiscais',mod:()=>ModNotasFiscais.render()},
    'pix':{label:'Pix & Pagamentos',mod:()=>ModPix.render()},
    'pendencias':{label:'Pendências',mod:()=>ModPendencias.render()},
    'relatorio-mensal':{label:'Balancete Mensal',mod:()=>ModRelatorio.render()},
    'relatorio-projetos':{label:'Rel. de Projetos',mod:()=>ModRelatorio.render()},
    'usuarios':{label:'Usuários e Papéis',mod:()=>ModUsuarios.render()},
    'configuracoes':{label:'Configurações',mod:()=>ModConfiguracoes.render()},
  },

  async navigate(module){
    const m=this.MODULE_MAP[module];if(!m)return;
    S.module=module;UI.loading();
    document.getElementById('breadcrumb-current').textContent=m.label;
    document.querySelectorAll('.nav-item').forEach(el=>el.classList.remove('active'));
    document.querySelectorAll(`[data-module="${module}"]`).forEach(el=>el.classList.add('active'));
    try{await m.mod();}
    catch(e){console.error('[ADRA]',e);UI.render(`<div class="p-6"><div class="bg-red-50 border border-red-200 rounded-xl p-5"><p class="font-bold text-red-700">Erro ao carregar módulo</p><pre class="text-xs text-red-500 mt-2 whitespace-pre-wrap">${e.message}</pre></div></div>`);}
    if(window.innerWidth<768)this.closeSidebar();
    history.replaceState({},'',`?m=${module}`);
  },

  toggleNavSection(key){
    const sec=document.getElementById(`sec-${key}`);const chv=document.getElementById(`chv-${key}`);
    if(!sec)return;const hidden=sec.style.display==='none';
    sec.style.display=hidden?'':'none';if(chv)chv.style.transform=hidden?'':'rotate(-90deg)';
  },
  openSidebar(){document.getElementById('sidebar')?.classList.add('open');document.getElementById('sidebar-overlay')?.classList.add('open');},
  closeSidebar(){document.getElementById('sidebar')?.classList.remove('open');document.getElementById('sidebar-overlay')?.classList.remove('open');},

  async updateFavoritesList(){
    const{data:projects}=await DB.get('projects');
    const favs=projects.filter(p=>p.is_favorite&&p.status==='ativo');
    const el=document.getElementById('favorites-list');if(!el)return;
    el.innerHTML=favs.length===0
      ?'<p class="text-xs text-adra-200/50 px-3 py-1.5 italic">Nenhum favorito</p>'
      :favs.map(p=>`<a href="#" onclick="ModProjetos.openDetail('${p.id}');return false;" class="nav-item flex items-center gap-2 px-3 py-1.5 text-xs text-adra-100 rounded-lg truncate"><span class="text-amber-400">★</span><span class="truncate">${p.name}</span></a>`).join('');
  },

  async updateBadges(){
    const{data:notes}=await DB.get('notes_fiscal');
    const{data:pend}=await DB.get('internal_pendencies');
    const nfCt=notes.filter(n=>n.status==='pendente'||n.status==='aprovada').length;
    const pCt=pend.filter(p=>p.status==='aberta'||p.status==='em_analise').length;
    const set=(id,ct)=>{const el=document.getElementById(id);if(!el)return;el.textContent=ct;el.classList.toggle('hidden',ct===0);};
    set('badge-nf',nfCt);set('badge-pend',pCt);
    const nb=document.getElementById('notif-badge');if(nb)nb.classList.toggle('hidden',nfCt+pCt===0);
  },

  showNotifications(){UI.toast('Acesse Notas Fiscais ou Pendências para ver os itens em aberto.','info');},
  handleSearch(val){if(val.length>=2)UI.toast(`Buscando: "${val}"…`,'info',1200);},

  showAbout(){
    UI.openModal({title:'Sobre o ADRA Finanças',size:'max-w-sm',
      body:`<div class="text-center space-y-3">
        <div class="w-14 h-14 bg-adra-800 rounded-xl flex items-center justify-center text-white text-3xl font-black mx-auto">A</div>
        <p class="font-bold text-slate-800">ADRA – Gestão Financeira e Operacional</p>
        <p class="text-sm text-slate-500">v1.0.0 · ITG 2002 Compatível</p>
        <div class="bg-slate-50 rounded-xl p-4 text-left text-xs text-slate-600 space-y-1.5">
          <p>⚖️ Motor Fiscal (MEI, Simples, LP, LR, PF)</p>
          <p>🏦 Pix EMV com TxId e QR Code</p>
          <p>🔄 Conciliação Bancária Automática</p>
          <p>💬 Comunicação Interna Estruturada</p>
          <p>🔐 RBAC Dinâmico — 5 papéis</p>
          <p>📱 PWA Instalável — offline-capable</p>
          <p>🗄️ Supabase / PostgreSQL pronto</p>
        </div>
        <p class="text-xs text-slate-400">Modo Demo · dados em localStorage</p>
      </div>`,
      footer:`<button onclick="UI.closeModal()" class="adra-btn bg-adra-800 text-white hover:bg-adra-700 w-full justify-center">Fechar</button>`});
  },

  triggerInstall(){
    if(S.installPrompt){
      S.installPrompt.prompt();
      S.installPrompt.userChoice.then(r=>{
        if(r.outcome==='accepted')UI.toast('✅ ADRA Finanças instalado!','success');
        S.installPrompt=null;document.getElementById('install-banner')?.classList.add('hidden');
      });
    }else{UI.toast('Use o banner inferior ou o menu do navegador para instalar.','info');}
  },

  initPWA(){
    // Service Worker
    if('serviceWorker' in navigator){
      navigator.serviceWorker.register('./sw.js')
        .then(r=>console.log('[SW] Registrado:',r.scope))
        .catch(e=>console.warn('[SW] Falha:',e));
    }
    // Install prompt (Chrome/Edge/Android)
    window.addEventListener('beforeinstallprompt',e=>{
      e.preventDefault();S.installPrompt=e;
      document.getElementById('install-banner')?.classList.remove('hidden');
    });
    window.addEventListener('appinstalled',()=>{
      document.getElementById('install-banner')?.classList.add('hidden');S.installPrompt=null;
    });
    // iOS fallback banner
    const isIOS=/iphone|ipad|ipod/i.test(navigator.userAgent);
    const isStandalone=window.matchMedia('(display-mode: standalone)').matches;
    if(isIOS&&!isStandalone&&!sessionStorage.getItem('ios_dismissed')){
      document.getElementById('ios-install-banner')?.classList.remove('hidden');
      document.getElementById('ios-banner-close')?.addEventListener('click',()=>{
        document.getElementById('ios-install-banner')?.classList.add('hidden');
        sessionStorage.setItem('ios_dismissed','1');
      });
    }
    // Button events
    document.getElementById('install-btn')?.addEventListener('click',()=>this.triggerInstall());
    document.getElementById('install-dismiss')?.addEventListener('click',()=>{
      document.getElementById('install-banner')?.classList.add('hidden');S.installPrompt=null;
    });
    // SW update message
    navigator.serviceWorker?.addEventListener('message',e=>{
      if(e.data?.type==='SYNC_COMPLETE')UI.toast('🔄 Dados sincronizados','success');
    });
  },

  initPeriod(){
    const now=new Date();
    const def=`${now.getFullYear()}-${String(now.getMonth()+1).padStart(2,'0')}`;
    S.period=localStorage.getItem('adra_period')||def;
    const sel=document.getElementById('period-selector');
    if(sel){
      sel.value=S.period;
      sel.addEventListener('change',()=>{
        S.period=sel.value;localStorage.setItem('adra_period',S.period);
        document.getElementById('topbar-period').textContent=Fmt.period(S.period);
        this.navigate(S.module);
      });
    }
    document.getElementById('topbar-period').textContent=Fmt.period(S.period);
  },

  initSetup(){
    const url=localStorage.getItem('adra_url');const key=localStorage.getItem('adra_key');
    if(url&&key){S.demoMode=false;try{if(typeof supabase!=='undefined')S.sbClient=supabase.createClient(url,key);}catch{S.demoMode=true;}}
    const done=localStorage.getItem('adra_setup_done');
    if(!done){
      document.getElementById('setup-modal')?.classList.remove('hidden');
      document.getElementById('setup-demo-btn')?.addEventListener('click',()=>{
        localStorage.setItem('adra_setup_done','1');
        document.getElementById('setup-modal')?.classList.add('hidden');
        S.demoMode=true;DB.init();this.navigate('dashboard');
      });
      document.getElementById('setup-connect-btn')?.addEventListener('click',()=>{
        const u=document.getElementById('setup-url')?.value.trim();
        const k=document.getElementById('setup-key')?.value.trim();
        if(!u||!k){UI.toast('Informe URL e chave Supabase','warning');return;}
        localStorage.setItem('adra_url',u);localStorage.setItem('adra_key',k);
        localStorage.setItem('adra_setup_done','1');
        document.getElementById('setup-modal')?.classList.add('hidden');
        S.demoMode=false;
        try{if(typeof supabase!=='undefined')S.sbClient=supabase.createClient(u,k);}
        catch{S.demoMode=true;UI.toast('Erro de conexão. Modo demo ativo.','warning');}
        this.navigate('dashboard');
      });
    }
  },

  async init(){
    console.log('[ADRA] Inicializando v1.0.0…');
    DB.init();
    // Sidebar user info
    document.getElementById('user-name').textContent=S.user.full_name;
    document.getElementById('user-role').textContent=ROLE_LABELS[S.user.role]||S.user.role;
    document.getElementById('user-avatar').textContent=Fmt.initials(S.user.full_name);
    this.initPWA();
    this.initPeriod();
    this.initSetup();
    await this.updateFavoritesList();
    await this.updateBadges();
    // Route from URL param
    const urlMod=new URLSearchParams(location.search).get('m');
    if(localStorage.getItem('adra_setup_done')){
      await this.navigate(urlMod||'dashboard');
    }
  }
};

// ═══════════ BOOTSTRAP ═══════════
document.addEventListener('DOMContentLoaded',()=>App.init());
