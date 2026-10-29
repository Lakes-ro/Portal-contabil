'use strict';
// ================================================================
// ARF - Gestão Contábil e Operacional  |  v1.1.0
// ================================================================

// ── ESCAPE GLOBAL (todo valor vindo do usuário/banco passa por aqui) ─
const esc = s => String(s ?? '').replace(/[&<>"']/g, c => ({'&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot;',"'":'&#039;'}[c]));

// ── MIGRAÇÃO DE CHAVES ANTIGAS DO localStorage ───────────────────
(function migrateLegacyKeys(){
  try{
    ['period','url','key'].forEach(k=>{
      const old=localStorage.getItem('arf_'+k);
      if(old!==null&&localStorage.getItem('arf_'+k)===null)localStorage.setItem('arf_'+k,old);
      localStorage.removeItem('arf_'+k);
    });
    localStorage.removeItem('arf_db_v1');      // dados demo antigos (nomes legados)
    localStorage.removeItem('arf_setup_done');
  }catch{}
})();

// ── CONFIGURAÇÃO SUPABASE ─────────────────────────────────────────
// Padrão abaixo; pode ser sobrescrito em Configurações (grava arf_url / arf_key).
// A chave anon pode ficar no cliente SOMENTE se o RLS estiver ativo (ver supabase/schema.sql).
const SUPABASE_URL_DEFAULT = 'https://wssgkqonuxgupxuyxtyv.supabase.co';
const SUPABASE_KEY_DEFAULT = 'eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6Indzc2drcW9udXhndXB4dXl4dHl2Iiwicm9sZSI6ImFub24iLCJpYXQiOjE3OTAxNjYwMjMsImV4cCI6MjEwNTc0MjAyM30.YmSa6i6c4Rs9-HWaSS2R9vrpn8hKfDc6igE8mbqek-0';
const _lsGet = k => { try{ return localStorage.getItem(k); }catch{ return null; } };
const SUPABASE_URL = _lsGet('arf_url') || SUPABASE_URL_DEFAULT;
const SUPABASE_KEY = _lsGet('arf_key') || SUPABASE_KEY_DEFAULT;

const _sbReady = /^https:\/\/[a-z0-9-]+\.supabase\.co\/?$/i.test(SUPABASE_URL) && SUPABASE_KEY.length > 40;
const sbClient = _sbReady && typeof supabase !== 'undefined'
  ? supabase.createClient(SUPABASE_URL, SUPABASE_KEY, { auth: { persistSession: true, autoRefreshToken: true } })
  : null;

// Erros não tratados viram toast (evita falha silenciosa em handlers async)
window.addEventListener('unhandledrejection', e => {
  console.error('[ARF]', e.reason);
  if (typeof UI !== 'undefined') UI.toast(e.reason?.message || 'Erro inesperado.', 'error', 6000);
});

// ── AUTH MODULE ───────────────────────────────────────────────────
const Auth = {
  async checkSession() {
    if (!sbClient) return null;
    try { const { data } = await sbClient.auth.getSession(); return data?.session || null; }
    catch { return null; }
  },

  _showError(msg) {
    const el = document.getElementById('login-error');
    if (el) { el.textContent = msg; el.style.display = 'block'; }
  },
  _resetBtn() {
    const btn = document.getElementById('login-btn'), t = document.getElementById('login-btn-text');
    if (btn) { btn.disabled = false; btn.style.background = '#0F2D4E'; }
    if (t) t.textContent = 'Entrar no Sistema';
  },

  async handleLogin(e) {
    e.preventDefault();
    const email    = document.getElementById('login-email')?.value.trim();
    const password = document.getElementById('login-password')?.value;
    const errEl    = document.getElementById('login-error');
    const btn      = document.getElementById('login-btn');
    const btnText  = document.getElementById('login-btn-text');
    if (errEl) errEl.style.display = 'none';
    if (btn) { btn.disabled = true; btn.style.background = '#94A3B8'; }
    if (btnText) btnText.textContent = 'Entrando...';
    try {
      if (!sbClient) throw new Error('Supabase não configurado. Verifique URL e chave em Configurações ou em app.js.');
      const { data, error } = await sbClient.auth.signInWithPassword({ email, password });
      if (error) throw error;
      await this._onLoginSuccess(data.user);
    } catch (err) {
      const msgs = {
        'Invalid login credentials': 'E-mail ou senha incorretos.',
        'Email not confirmed':       'Confirme seu e-mail antes de entrar.',
        'Too many requests':         'Muitas tentativas. Aguarde alguns minutos.',
      };
      this._showError(msgs[err.message] || err.message || 'Erro ao entrar. Tente novamente.');
      this._resetBtn();
    }
  },

  // O papel vem SEMPRE do banco (tabela profiles). O cliente nunca cria perfil nem promove ninguém.
  async _onLoginSuccess(authUser) {
    let profile = null;
    try {
      const { data, error } = await sbClient.from('profiles').select('*').eq('id', authUser.id).maybeSingle();
      if (error) throw error;
      profile = data;
    } catch (err) {
      console.error('[ARF] perfil:', err);
      return this._reject('Não foi possível carregar seu perfil: ' + (err.message || 'erro desconhecido'));
    }
    if (!profile) return this._reject('Seu usuário ainda não tem perfil liberado. Peça ao administrador.');
    if (profile.is_active === false) return this._reject('Usuário desativado. Procure o administrador.');

    const role = (profile.role && profile.role !== 'demo' && ROLE_LABELS[profile.role]) ? profile.role : 'caixa';
    S.user = { id: profile.id, full_name: profile.full_name || authUser.email, role, email: authUser.email || profile.email || '' };
    S.demoMode = false;
    S.sbClient = sbClient;
    this._showApp();
    await App.boot();
  },

  async _reject(msg) {
    S.demoMode = true;
    try { await sbClient?.auth.signOut(); } catch {}
    this._resetUI();
    this._showError(msg);
  },

  enterDemoMode() {
    S.user = { id: 'demo', full_name: 'Usuário Demo', role: 'admin', email: '' };
    S.demoMode = true;
    S.sbClient = null;
    DB.init();
    this._showApp();
    App.boot();
  },

  _showApp() {
    const lp = document.getElementById('login-page');
    if (lp) lp.style.display = 'none';
    document.getElementById('app-layout')?.classList.remove('hidden');
  },

  _resetUI() {
    UI.closeModal();
    document.getElementById('app-layout')?.classList.add('hidden');
    const mc = document.getElementById('main-content'); if (mc) mc.innerHTML = '';
    const lp = document.getElementById('login-page'); if (lp) lp.style.display = 'flex';
    document.getElementById('login-form')?.reset();
    const errEl = document.getElementById('login-error'); if (errEl) errEl.style.display = 'none';
    this._resetBtn();
  },

  async logout() {
    const wasReal = !S.demoMode;
    S.demoMode = true; S.user = null; S.sbClient = null;   // antes do signOut: evita o listener reagir
    if (sbClient && wasReal) { try { await sbClient.auth.signOut(); } catch {} }
    this._resetUI();
  },

  togglePasswordVisibility() {
    const inp = document.getElementById('login-password');
    if (inp) inp.type = inp.type === 'password' ? 'text' : 'password';
  },

  async showForgotPassword() {
    const email = document.getElementById('login-email')?.value.trim();
    if (!sbClient) { this._showError('Configure o Supabase para usar a recuperação de senha.'); return; }
    if (!email)    { this._showError('Digite seu e-mail no campo acima e clique novamente.'); return; }
    const { error } = await sbClient.auth.resetPasswordForEmail(email, { redirectTo: location.origin + location.pathname });
    if (error) this._showError('Erro: ' + error.message);
    else UI.toast('E-mail de recuperação enviado para ' + email, 'success', 6000);
  },
};

if (sbClient) {
  // Sessão expirada / logout em outra aba
  sbClient.auth.onAuthStateChange(event => {
    if (event === 'SIGNED_OUT' && !S.demoMode) {
      S.demoMode = true; S.user = null; S.sbClient = null;
      Auth._resetUI();
      UI.toast('Sessão encerrada. Entre novamente.', 'info');
    }
  });
}

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
    {id:'prj-001',name:'Fundo Operacional Geral',code:'OP-001',type:'Livre',budget:500000,spent:47350,status:'ativo',is_favorite:false,notes:'Fundo operacional geral',start_date:'2024-01-01',created_at:'2024-01-01T00:00:00Z'},
    {id:'prj-002',name:'Projeto Esperança – Região Norte',code:'ESPN-001',type:'Restrito',budget:150000,spent:28000,status:'ativo',is_favorite:false,notes:'Apoio assistencial ao Norte',start_date:'2024-03-01',created_at:'2024-03-01T00:00:00Z'},
    {id:'prj-003',name:'Campanha Nativos 2024',code:'NAT-2024',type:'Restrito',budget:75000,spent:12500,status:'ativo',is_favorite:false,notes:'Apoio a comunidades indígenas',start_date:'2024-04-01',created_at:'2024-04-01T00:00:00Z'},
    {id:'prj-004',name:'Fundo de Emergência',code:'EMERG-001',type:'Livre',budget:200000,spent:0,status:'ativo',is_favorite:false,notes:'Reserva estratégica',start_date:'2024-01-01',created_at:'2024-01-01T00:00:00Z'},
    {id:'prj-005',name:'Alimento Solidário',code:'ALIM-001',type:'Restrito',budget:120000,spent:60000,status:'suspenso',is_favorite:false,notes:'Distribuição de cestas básicas',created_at:'2023-06-01T00:00:00Z'},
  ],
  bank_accounts:[
    {id:'ba-001',project_id:'prj-001',bank_name:'Banco do Brasil',bank_code:'001',agency:'1234-5',account_number:'00012345',account_digit:'6',pix_key:'12.345.678/0001-90',pix_key_type:'cnpj',beneficiary_name:'Associação Exemplo',is_active:true,created_at:'2024-01-01T00:00:00Z'},
    {id:'ba-002',project_id:'prj-002',bank_name:'Caixa Econômica Federal',bank_code:'104',agency:'0567',account_number:'00567890',account_digit:'1',pix_key:'contato.norte@exemplo.com.br',pix_key_type:'email',beneficiary_name:'Projeto Esperança',is_active:true,created_at:'2024-03-01T00:00:00Z'},
    {id:'ba-003',project_id:'prj-003',bank_name:'Bradesco',bank_code:'237',agency:'3456-7',account_number:'12345678',account_digit:'9',pix_key:'+5561999990001',pix_key_type:'telefone',beneficiary_name:'Campanha Nativos 2024',is_active:true,created_at:'2024-04-01T00:00:00Z'},
    {id:'ba-004',project_id:'prj-004',bank_name:'Itaú Unibanco',bank_code:'341',agency:'5678',account_number:'98765432',account_digit:'0',pix_key:'a1b2c3d4-e5f6-7890-abcd-ef1234567890',pix_key_type:'aleatoria',beneficiary_name:'Fundo de Emergência',is_active:true,created_at:'2024-01-01T00:00:00Z'},
  ],
  notes_fiscal:[
    {id:'nf-001',project_id:'prj-001',bank_account_id:'ba-001',emitter_name:'Tech Solutions Ltda',emitter_cnpj:'11.222.333/0001-44',emitter_type:'lucro_presumido',service_description:'Consultoria em Tecnologia da Informação',fiscal_note_number:'NF-2025-001',issue_date:'2025-07-01',gross_amount:15000,iss_rate:2,iss_withheld:300,irrf_rate:1.5,irrf_withheld:225,pis_rate:0.65,pis_withheld:97.5,cofins_rate:3,cofins_withheld:450,csll_rate:1,csll_withheld:150,inss_rate:0,inss_withheld:0,competency_period:'2025-07-01',due_date:'2025-07-15',tx_id:'ARF4F8E2A1B3C9D7E6F5A2B1C3D4E5F678',pix_payload:null,status:'pix_gerado',created_by:'usr-001',created_at:'2025-07-02T10:00:00Z'},
    {id:'nf-002',project_id:'prj-002',bank_account_id:'ba-002',emitter_name:'Carlos Souza ME',emitter_cnpj:'22.333.444/0001-55',emitter_type:'simples',service_description:'Serviços de Limpeza e Conservação',fiscal_note_number:'NF-0042',issue_date:'2025-07-03',gross_amount:3500,iss_rate:2,iss_withheld:70,irrf_rate:0,irrf_withheld:0,pis_rate:0,pis_withheld:0,cofins_rate:0,cofins_withheld:0,csll_rate:0,csll_withheld:0,inss_rate:0,inss_withheld:0,competency_period:'2025-07-01',due_date:'2025-07-20',tx_id:null,pix_payload:null,status:'aprovada',notes:'Serviço recorrente',created_by:'usr-001',created_at:'2025-07-03T14:00:00Z'},
    {id:'nf-003',project_id:'prj-001',bank_account_id:'ba-001',emitter_name:'Maria José dos Santos',emitter_cnpj:'987.654.321-00',emitter_type:'pessoa_fisica',service_description:'Serviços de Nutricionista – RPA',fiscal_note_number:'RPA-007',issue_date:'2025-07-05',gross_amount:4800,iss_rate:0,iss_withheld:0,irrf_rate:15,irrf_withheld:278.56,pis_rate:0,pis_withheld:0,cofins_rate:0,cofins_withheld:0,csll_rate:0,csll_withheld:0,inss_rate:11,inss_withheld:528,competency_period:'2025-07-01',due_date:'2025-07-28',tx_id:null,pix_payload:null,status:'pendente',created_by:'usr-004',created_at:'2025-07-05T09:00:00Z'},
    {id:'nf-004',project_id:'prj-003',bank_account_id:'ba-003',emitter_name:'Gráfica Impressão Rápida',emitter_cnpj:'33.444.555/0001-66',emitter_type:'simples',service_description:'Impressão de Material Educativo',fiscal_note_number:'NF-2025-198',issue_date:'2025-06-10',gross_amount:2200,iss_rate:2,iss_withheld:44,irrf_rate:0,irrf_withheld:0,pis_rate:0,pis_withheld:0,cofins_rate:0,cofins_withheld:0,csll_rate:0,csll_withheld:0,inss_rate:0,inss_withheld:0,competency_period:'2025-06-01',due_date:'2025-06-25',tx_id:'ARF9A8B7C6D5E4F3A2B1C9D8E7F6A5B4C3D',pix_payload:null,status:'pago_conciliado',paid_amount:2156,paid_at:'2025-06-26T11:30:00Z',created_by:'usr-001',created_at:'2025-06-10T08:00:00Z'},
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
  KEY:'arf_db_v1',
  _data(){try{const r=localStorage.getItem(this.KEY);return r?JSON.parse(r):null;}catch{return null;}},
  _save(d){try{localStorage.setItem(this.KEY,JSON.stringify(d));}catch(e){console.error('[ARF] localStorage cheio?',e);UI.toast('Não foi possível salvar localmente.','error');}},
  init(){let d=this._data();if(!d){d=JSON.parse(JSON.stringify(SEED_DATA));this._save(d);}return d;},
  _err(error,ctx){
    const denied=error?.code==='42501'||/row-level security|permission denied/i.test(error?.message||'');
    const e=new Error(denied?'Permissão negada para esta operação.':`${ctx}: ${error?.message||error}`);
    e.cause=error;console.error('[ARF]',ctx,error);return e;
  },
  async get(t){
    if(S.demoMode){const d=this._data()||this.init();return{data:d[t]||[],error:null};}
    const{data,error}=await S.sbClient.from(t).select('*');
    if(error)throw this._err(error,`Carregar ${t}`);
    return{data:data||[],error:null};
  },
  async getById(t,id){
    if(S.demoMode){const d=this._data()||this.init();const r=(d[t]||[]).find(x=>x.id===id);return{data:r||null,error:r?null:'Not found'};}
    const{data,error}=await S.sbClient.from(t).select('*').eq('id',id).maybeSingle();
    if(error)throw this._err(error,`Carregar ${t}`);
    return{data:data||null,error:null};
  },
  async insert(t,row){
    if(S.demoMode){const d=this._data()||this.init();const n={...row,id:t.substring(0,2)+'-'+Date.now()+'-'+Math.random().toString(36).slice(2,6),created_at:new Date().toISOString(),updated_at:new Date().toISOString()};if(!d[t])d[t]=[];d[t].unshift(n);this._save(d);return{data:n,error:null};}
    const{data,error}=await S.sbClient.from(t).insert(row).select().single();
    if(error)throw this._err(error,`Salvar ${t}`);
    return{data,error:null};
  },
  async update(t,id,fields){
    if(S.demoMode){const d=this._data()||this.init();const i=(d[t]||[]).findIndex(x=>x.id===id);if(i!==-1){d[t][i]={...d[t][i],...fields,updated_at:new Date().toISOString()};this._save(d);return{data:d[t][i],error:null};}return{data:null,error:'Not found'};}
    const{data,error}=await S.sbClient.from(t).update(fields).eq('id',id).select().maybeSingle();
    if(error)throw this._err(error,`Atualizar ${t}`);
    if(!data)throw new Error('Registro não encontrado ou sem permissão para alterar.');
    return{data,error:null};
  },
  async delete(t,id){
    if(S.demoMode){const d=this._data()||this.init();if(d[t])d[t]=d[t].filter(x=>x.id!==id);this._save(d);return{error:null};}
    const{error}=await S.sbClient.from(t).delete().eq('id',id);
    if(error)throw this._err(error,`Excluir ${t}`);
    return{error:null};
  },
  computeNote(n){const tx=round2((n.iss_withheld||0)+(n.irrf_withheld||0)+(n.pis_withheld||0)+(n.cofins_withheld||0)+(n.csll_withheld||0)+(n.inss_withheld||0));return{...n,tax_withheld:tx,net_amount:round2((n.gross_amount||0)-tx)};}
};

const RBAC={
  rules:{
    admin:{canApprove:true,canCreateNote:true,canManageUsers:true,canViewReports:true,canManageBanks:true,canSendPend:true},
    tesoureiro:{canApprove:true,canCreateNote:true,canManageUsers:false,canViewReports:true,canManageBanks:true,canSendPend:true},
    contador:{canApprove:false,canCreateNote:true,canManageUsers:false,canViewReports:true,canManageBanks:false,canSendPend:true},
    dp:{canApprove:false,canCreateNote:false,canManageUsers:false,canViewReports:true,canManageBanks:false,canSendPend:true},
    caixa:{canApprove:false,canCreateNote:true,canManageUsers:false,canViewReports:false,canManageBanks:false,canSendPend:false},
    demo:{canApprove:true,canCreateNote:true,canManageUsers:true,canViewReports:true,canManageBanks:true,canSendPend:true},
  },
  can(p){return !!(this.rules[S.user?.role]?.[p]);}
};

const Fmt={
  money(v){return new Intl.NumberFormat('pt-BR',{style:'currency',currency:'BRL'}).format(Number(v)||0);},
  number(v,d=2){return new Intl.NumberFormat('pt-BR',{minimumFractionDigits:d,maximumFractionDigits:d}).format(Number(v)||0);},
  pct(v){return`${Fmt.number(v,2)}%`;},
  date(iso){if(!iso)return'–';const d=new Date(String(iso).length<=10?iso+'T12:00:00':iso);return isNaN(d)?iso:d.toLocaleDateString('pt-BR');},
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
  generateTxId(noteId=''){const h=(noteId||'').replace(/[^a-zA-Z0-9]/g,'').substring(0,14).toUpperCase();const ts=Date.now().toString(36).toUpperCase().padStart(8,'0');return`ARF${h}${ts}`.substring(0,25);},
  generate({pixKey,name,city='BRASILIA',amount,txId,description=''}){
    const clean=s=>s.normalize('NFD').replace(/[\u0300-\u036f]/g,'').replace(/[^a-zA-Z0-9 ]/g,'');
    const mN=clean(name).toUpperCase().substring(0,25)||'RECEBEDOR';
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
    const c={success:'bg-emerald-600',error:'bg-red-600',warning:'bg-amber-500',info:'bg-brand-700'};
    const ic={success:'✅',error:'❌',warning:'⚠️',info:'ℹ️'};
    const el=document.createElement('div');
    el.className=`toast pointer-events-auto flex items-center gap-3 ${c[type]||c.info} text-white text-sm px-4 py-3 rounded-xl shadow-xl min-w-[240px] max-w-sm`;
    el.innerHTML=`<span>${ic[type]}</span><span class="flex-1">${esc(msg)}</span><button class="opacity-60 hover:opacity-100 ml-2 text-lg" onclick="this.parentElement.remove()">✕</button>`;
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
    this.openModal({title:'Confirmar ação',size:'max-w-md',body:`<p class="text-slate-700">${esc(msg)}</p>`,
      footer:`<button onclick="UI.closeModal()" class="brand-btn border border-slate-300 text-slate-600 hover:bg-slate-50">Cancelar</button><button id="confirm-yes" class="brand-btn ${danger?'bg-red-600 hover:bg-red-700':'bg-brand-800 hover:bg-brand-700'} text-white">Confirmar</button>`});
    document.getElementById('confirm-yes')?.addEventListener('click',()=>{this.closeModal();onYes();});
  },
  loading(id='main-content'){const el=document.getElementById(id);if(el)el.innerHTML=`<div class="flex items-center justify-center h-64"><div class="text-center text-slate-400"><div class="w-10 h-10 border-4 border-brand-800 border-t-transparent rounded-full animate-spin mx-auto mb-3"></div><p class="text-sm">Carregando…</p></div></div>`;},
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
  <div><h1 class="text-xl font-bold text-slate-800">Dashboard</h1><p class="text-sm text-slate-500 mt-0.5">Período: ${Fmt.period(p)} · Bem-vindo, ${esc(S.user.full_name)}</p></div>
  ${RBAC.can('canCreateNote')?`<button onclick="ModNotasFiscais.openNew()" class="brand-btn bg-brand-800 text-white hover:bg-brand-700 shadow-sm">+ Nova Nota Fiscal</button>`:''}
</div>
<div class="grid grid-cols-2 lg:grid-cols-4 gap-4">
  <div class="kpi-card kpi-blue"><p class="text-xs text-slate-500 font-semibold uppercase tracking-wide">Projetos Ativos</p><p class="text-3xl font-black text-brand-800 mt-1">${actProj}</p><p class="text-xs text-slate-400 mt-1">de ${projects.length} total</p></div>
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
  ${recent.length===0?UI.empty('Nenhuma nota lançada','🧾'):`<div class="overflow-x-auto"><table class="brand-table"><thead><tr><th>Emitente</th><th>Projeto</th><th class="text-right">Bruto</th><th class="text-right">Líquido</th><th>Status</th></tr></thead><tbody>
  ${recent.map(n=>{const pr=projects.find(x=>x.id===n.project_id);return`<tr class="cursor-pointer" onclick="ModNotasFiscais.openDetail('${n.id}')"><td><p class="font-medium text-sm">${esc(n.emitter_name)}</p><p class="text-xs text-slate-400">${esc(n.fiscal_note_number||'–')}</p></td><td class="text-xs text-slate-500">${esc(pr?.name||'–')}</td><td class="text-right font-mono text-sm">${Fmt.money(n.gross_amount)}</td><td class="text-right font-mono text-sm font-bold text-emerald-700">${Fmt.money(n.net_amount)}</td><td>${UI.badge(n.status)}</td></tr>`;}).join('')}
  </tbody></table></div>`}
</div>
<div class="bg-white rounded-xl border border-slate-200 overflow-hidden">
  <div class="flex items-center justify-between px-5 py-4 border-b border-slate-100"><h2 class="font-bold text-slate-700 text-sm">Pendências Recentes</h2><a href="#" onclick="App.navigate('pendencias');return false;" class="text-xs text-blue-600 hover:underline">Ver todas →</a></div>
  ${recentP.length===0?UI.empty('Sem pendências abertas','💬'):`<div class="divide-y divide-slate-100">
  ${recentP.map(x=>{const pj=projects.find(q=>q.id===x.project_id);return`<div class="px-5 py-4 flex items-center gap-3 hover:bg-slate-50 cursor-pointer" onclick="ModPendencias.openThread('${x.id}')"><div class="w-2 h-2 rounded-full flex-shrink-0 ${x.priority==='urgente'?'bg-red-500 pulse-conciliado':x.priority==='alta'?'bg-amber-500':'bg-blue-400'}"></div><div class="flex-1 min-w-0"><p class="text-sm font-medium text-slate-700 truncate">${esc(x.subject)}</p><p class="text-xs text-slate-400">${esc(pj?.name||'–')} · ${Fmt.period(x.accounting_period?.substring(0,7))}</p></div>${UI.badge(x.status)}</div>`;}).join('')}</div>`}
</div></div>`);
  }
};

// ═══════════ MODULE: PROJETOS ═══════════
const ModProjetos={
  async render(){
    const{data:projects}=await DB.get('projects');const{data:notes}=await DB.get('notes_fiscal');const{data:banks}=await DB.get('bank_accounts');
    UI.render(`<div class="p-6 fade-in"><div class="flex items-center justify-between mb-5 flex-wrap gap-3"><div><h1 class="text-xl font-bold text-slate-800">Projetos</h1><p class="text-sm text-slate-500 mt-0.5">${projects.length} projeto(s)</p></div>${RBAC.can('canCreateNote')?`<button onclick="ModProjetos.openNew()" class="brand-btn bg-brand-800 text-white hover:bg-brand-700 shadow-sm">+ Novo Projeto</button>`:''}</div>
    <div class="grid grid-cols-1 md:grid-cols-2 xl:grid-cols-3 gap-4">${projects.map(p=>this.cardHtml(p,notes,banks)).join('')}</div></div>`);
  },
  cardHtml(p,allN,allB){
    const pct=p.budget>0?Math.min(100,round2((p.spent/p.budget)*100)):0;
    const bc=allB.filter(b=>b.project_id===p.id).length;const nc=allN.filter(n=>n.project_id===p.id).length;
    const sc={ativo:'bg-emerald-100 text-emerald-700',encerrado:'bg-slate-100 text-slate-500',suspenso:'bg-amber-100 text-amber-700'};
    return`<div class="bg-white rounded-xl border border-slate-200 p-5 hover:shadow-md transition-shadow cursor-pointer" onclick="ModProjetos.openDetail('${p.id}')">
      <div class="flex items-start justify-between mb-3"><div class="flex-1 min-w-0 pr-2"><div class="flex items-center gap-1.5 mb-1.5 flex-wrap"><span class="text-xs px-2 py-0.5 rounded-full font-semibold ${p.type==='Livre'?'bg-blue-100 text-blue-700':'bg-purple-100 text-purple-700'}">${esc(p.type)}</span><span class="text-xs px-2 py-0.5 rounded-full font-semibold ${sc[p.status]}">${p.status}</span></div><h3 class="font-bold text-slate-800 text-sm leading-snug">${esc(p.name)}</h3>${p.code?`<p class="text-xs text-slate-400 mt-0.5">${esc(p.code)}</p>`:''}</div>
      <button class="text-xl flex-shrink-0 ${p.is_favorite?'text-amber-400':'text-slate-200 hover:text-amber-400'} transition-colors" onclick="event.stopPropagation();ModProjetos.toggleFav('${p.id}',${!p.is_favorite})">★</button></div>
      <div class="space-y-1.5 mb-4"><div class="flex justify-between text-xs text-slate-500"><span>Orçamento</span><span class="font-semibold text-slate-700">${Fmt.money(p.budget)}</span></div><div class="h-1.5 bg-slate-100 rounded-full overflow-hidden"><div class="h-full rounded-full ${pct>90?'bg-red-500':pct>70?'bg-amber-500':'bg-emerald-500'}" style="width:${pct}%"></div></div><div class="flex justify-between text-xs"><span class="text-slate-500">Gasto: <b class="text-slate-700">${Fmt.money(p.spent)}</b></span><span class="${pct>90?'text-red-600':'text-slate-400'}">${Fmt.pct(pct)}</span></div></div>
      <div class="flex items-center justify-between pt-3 border-t border-slate-100 text-xs text-slate-500"><span>🏛️ ${bc}</span><span>🧾 ${nc}</span><span>${p.start_date?Fmt.date(p.start_date):'–'}</span></div></div>`;
  },
  async toggleFav(id,val){await DB.update('projects',id,{is_favorite:val});App.updateFavoritesList();await this.render();UI.toast(val?'⭐ Favorito adicionado':'Favorito removido',val?'success':'info');},
  async openNew(){
    UI.openModal({title:'+ Novo Projeto',size:'max-w-lg',body:`<div class="space-y-4">
      <div><label class="brand-label">Nome *</label><input id="prj-name" class="brand-input" placeholder="Ex: Projeto Esperança – Norte" /></div>
      <div class="grid grid-cols-2 gap-4">
        <div><label class="brand-label">Código</label><input id="prj-code" class="brand-input" placeholder="ESPN-001" /></div>
        <div><label class="brand-label">Tipo *</label><select id="prj-type" class="brand-input"><option value="Livre">Livre</option><option value="Restrito">Restrito</option></select></div>
        <div><label class="brand-label">Orçamento (R$) *</label><input id="prj-budget" type="number" class="brand-input" min="0" step="0.01" /></div>
        <div><label class="brand-label">Status</label><select id="prj-status" class="brand-input"><option value="ativo">Ativo</option><option value="suspenso">Suspenso</option><option value="encerrado">Encerrado</option></select></div>
        <div><label class="brand-label">Início</label><input id="prj-start" type="date" class="brand-input" /></div>
        <div><label class="brand-label">Término</label><input id="prj-end" type="date" class="brand-input" /></div>
      </div><div><label class="brand-label">Observações</label><textarea id="prj-notes" class="brand-input h-20 resize-none"></textarea></div>
    </div>`,footer:`<button onclick="UI.closeModal()" class="brand-btn border border-slate-300 text-slate-600 hover:bg-slate-50">Cancelar</button><button onclick="ModProjetos.saveNew()" class="brand-btn bg-brand-800 text-white hover:bg-brand-700">Salvar</button>`});
  },
  async saveNew(){
    const name=document.getElementById('prj-name')?.value.trim();const budget=parseFloat(document.getElementById('prj-budget')?.value||0);
    if(!name){UI.toast('Informe o nome','warning');return;}if(!budget||budget<=0){UI.toast('Informe um orçamento válido','warning');return;}
    await DB.insert('projects',{name,code:document.getElementById('prj-code')?.value.trim(),type:document.getElementById('prj-type')?.value,budget,spent:0,status:document.getElementById('prj-status')?.value,start_date:document.getElementById('prj-start')?.value||null,end_date:document.getElementById('prj-end')?.value||null,notes:document.getElementById('prj-notes')?.value.trim(),is_favorite:false});
    UI.closeModal();UI.toast('✅ Projeto criado!','success');await this.render();App.updateFavoritesList();
  },
  async openEdit(id){
    if(!RBAC.can('canApprove')){UI.toast('Sem permissão','error');return;}
    const{data:p}=await DB.getById('projects',id);if(!p)return;
    const opt=(v,l,cur)=>`<option value="${v}" ${v===cur?'selected':''}>${l}</option>`;
    UI.openModal({title:`Editar — ${p.name}`,size:'max-w-lg',body:`<div class="space-y-4">
      <div><label class="brand-label">Nome *</label><input id="pe-name" class="brand-input" value="${esc(p.name)}" /></div>
      <div class="grid grid-cols-2 gap-4">
        <div><label class="brand-label">Código</label><input id="pe-code" class="brand-input" value="${esc(p.code||'')}" /></div>
        <div><label class="brand-label">Tipo</label><select id="pe-type" class="brand-input">${opt('Livre','Livre',p.type)}${opt('Restrito','Restrito',p.type)}</select></div>
        <div><label class="brand-label">Orçamento (R$) *</label><input id="pe-budget" type="number" min="0" step="0.01" class="brand-input" value="${esc(p.budget)}" /></div>
        <div><label class="brand-label">Gasto (R$)</label><input id="pe-spent" type="number" min="0" step="0.01" class="brand-input" value="${esc(p.spent||0)}" /></div>
        <div><label class="brand-label">Status</label><select id="pe-status" class="brand-input">${opt('ativo','Ativo',p.status)}${opt('suspenso','Suspenso',p.status)}${opt('encerrado','Encerrado',p.status)}</select></div>
        <div><label class="brand-label">Início</label><input id="pe-start" type="date" class="brand-input" value="${esc(p.start_date||'')}" /></div>
        <div><label class="brand-label">Término</label><input id="pe-end" type="date" class="brand-input" value="${esc(p.end_date||'')}" /></div>
      </div><div><label class="brand-label">Observações</label><textarea id="pe-notes" class="brand-input h-20 resize-none">${esc(p.notes||'')}</textarea></div></div>`,
      footer:`<button onclick="UI.closeModal()" class="brand-btn border border-slate-300 text-slate-600 hover:bg-slate-50">Cancelar</button><button onclick="ModProjetos.saveEdit('${esc(id)}')" class="brand-btn bg-brand-800 text-white hover:bg-brand-700">Salvar</button>`});
  },
  async saveEdit(id){
    const g=x=>document.getElementById(x)?.value.trim();const budget=parseFloat(g('pe-budget'));
    if(!g('pe-name')){UI.toast('Informe o nome','warning');return;}
    if(isNaN(budget)||budget<=0){UI.toast('Orçamento inválido','warning');return;}
    await DB.update('projects',id,{name:g('pe-name'),code:g('pe-code')||null,type:g('pe-type'),budget,spent:parseFloat(g('pe-spent'))||0,status:g('pe-status'),start_date:g('pe-start')||null,end_date:g('pe-end')||null,notes:g('pe-notes')||null});
    UI.closeModal();UI.toast('✅ Projeto atualizado','success');App.updateFavoritesList();
    if(S.module==='projetos'||S.module==='relatorio-projetos')await this.render();
  },
  async openDetail(id){
    const{data:p}=await DB.getById('projects',id);if(!p)return;
    const{data:banks}=await DB.get('bank_accounts');const{data:notes}=await DB.get('notes_fiscal');
    const pb=banks.filter(b=>b.project_id===id);const pn=notes.filter(n=>n.project_id===id).map(n=>DB.computeNote(n));
    const pct=p.budget>0?Math.min(100,round2((p.spent/p.budget)*100)):0;
    UI.openModal({title:p.name,size:'max-w-2xl',body:`<div class="space-y-5">
      <div class="grid grid-cols-3 gap-3"><div class="bg-blue-50 rounded-xl p-4"><p class="text-xs text-slate-500 mb-1">Orçamento</p><p class="font-bold text-brand-800">${Fmt.money(p.budget)}</p></div><div class="bg-amber-50 rounded-xl p-4"><p class="text-xs text-slate-500 mb-1">Gasto</p><p class="font-bold text-amber-700">${Fmt.money(p.spent)}</p></div><div class="bg-emerald-50 rounded-xl p-4"><p class="text-xs text-slate-500 mb-1">Saldo</p><p class="font-bold text-emerald-700">${Fmt.money(p.budget-p.spent)}</p></div></div>
      <div class="h-2 bg-slate-100 rounded-full overflow-hidden"><div class="h-full rounded-full ${pct>90?'bg-red-500':pct>70?'bg-amber-500':'bg-emerald-500'}" style="width:${pct}%"></div></div>
      <div><p class="text-xs font-semibold text-slate-500 uppercase tracking-wide mb-2">Contas Bancárias (${pb.length})</p>${pb.length===0?`<p class="text-sm text-slate-400 italic">Sem contas.</p>`:pb.map(b=>`<div class="flex items-center gap-3 px-3 py-2.5 bg-slate-50 rounded-lg mb-2 border border-slate-200"><span class="text-lg">🏛️</span><div class="flex-1 min-w-0"><p class="text-sm font-semibold">${esc(b.bank_name)} — Ag. ${esc(b.agency)} · C/C ${esc(b.account_number)}</p><p class="text-xs text-slate-400 font-mono">Pix: ${esc(b.pix_key)}</p></div></div>`).join('')}</div>
      <div><p class="text-xs font-semibold text-slate-500 uppercase tracking-wide mb-2">Notas Fiscais (${pn.length})</p>${pn.length===0?`<p class="text-sm text-slate-400 italic">Nenhuma.</p>`:`<table class="brand-table"><thead><tr><th>Emitente</th><th class="text-right">Líquido</th><th>Status</th></tr></thead><tbody>${pn.slice(0,6).map(n=>`<tr><td class="text-sm">${esc(n.emitter_name)}</td><td class="text-right font-mono text-emerald-700">${Fmt.money(n.net_amount)}</td><td>${UI.badge(n.status)}</td></tr>`).join('')}</tbody></table>`}</div>
      ${p.notes?`<div class="bg-slate-50 rounded-lg p-3 border"><p class="text-xs font-semibold text-slate-500 mb-1">Obs.</p><p class="text-sm text-slate-600">${esc(p.notes)}</p></div>`:''}
    </div>`,footer:`${RBAC.can('canApprove')?`<button onclick="ModProjetos.openEdit('${id}')" class="brand-btn border border-slate-300 text-slate-600 hover:bg-slate-50">✏️ Editar</button>`:''}${RBAC.can('canManageBanks')?`<button onclick="ModContasBancarias.openNew('${id}');UI.closeModal()" class="brand-btn border border-slate-300 text-slate-600 hover:bg-slate-50 mr-auto">+ Conta Bancária</button>`:''}<button onclick="UI.closeModal()" class="brand-btn border border-slate-300 text-slate-600 hover:bg-slate-50">Fechar</button>${RBAC.can('canCreateNote')?`<button onclick="ModNotasFiscais.openNew('${id}');UI.closeModal()" class="brand-btn bg-brand-800 text-white hover:bg-brand-700">+ Nova NF</button>`:''}`});
  }
};

// ═══════════ MODULE: CONTAS BANCÁRIAS ═══════════
const ModContasBancarias={
  async render(){
    const{data:banks}=await DB.get('bank_accounts');const{data:projects}=await DB.get('projects');
    const grouped=projects.map(p=>({project:p,banks:banks.filter(b=>b.project_id===p.id)})).filter(g=>g.banks.length>0);
    UI.render(`<div class="p-6 fade-in"><div class="flex items-center justify-between mb-5 flex-wrap gap-3"><div><h1 class="text-xl font-bold text-slate-800">Contas Bancárias</h1><p class="text-sm text-slate-500">${banks.length} conta(s)</p></div>${RBAC.can('canManageBanks')?`<button onclick="ModContasBancarias.openNew()" class="brand-btn bg-brand-800 text-white hover:bg-brand-700 shadow-sm">+ Nova Conta</button>`:''}</div>
    <div class="space-y-4">${grouped.length===0?UI.empty('Nenhuma conta cadastrada'):grouped.map(g=>`<div class="bg-white rounded-xl border border-slate-200 overflow-hidden"><div class="px-5 py-3 bg-slate-50 border-b border-slate-200 flex items-center gap-2"><span class="text-xs px-2 py-0.5 rounded-full font-semibold ${g.project.type==='Livre'?'bg-blue-100 text-blue-700':'bg-purple-100 text-purple-700'}">${esc(g.project.type)}</span><span class="font-bold text-slate-700 text-sm">${esc(g.project.name)}</span></div>${g.banks.map(b=>`<div class="px-5 py-4 flex items-center gap-4 border-b border-slate-100 last:border-0"><div class="w-10 h-10 bg-brand-100 rounded-lg flex items-center justify-center text-lg flex-shrink-0">🏛️</div><div class="flex-1 min-w-0"><p class="font-semibold text-slate-800 text-sm">${esc(b.bank_name)}${b.bank_code?' ('+b.bank_code+')':''}</p><p class="text-xs text-slate-500">Ag. ${esc(b.agency)} · C/C ${esc(b.account_number)}${b.account_digit?'-'+b.account_digit:''}</p><p class="text-xs text-slate-400">Benef.: ${esc(b.beneficiary_name)}</p></div><div class="text-right"><p class="text-xs font-semibold text-slate-500 mb-1">Pix (${PIX_KEY_LABELS[b.pix_key_type]})</p><p class="text-xs font-mono bg-brand-50 text-brand-700 px-2 py-1 rounded border border-brand-200">${esc(b.pix_key)}</p></div>${RBAC.can('canManageBanks')?`<button onclick="ModContasBancarias.openEdit('${b.id}')" class="text-slate-400 hover:text-slate-600 p-1.5 rounded hover:bg-slate-100">✏️</button>`:''}</div>`).join('')}</div>`).join('')}</div></div>`);
  },
  async openNew(preProj=''){
    const{data:projects}=await DB.get('projects');
    UI.openModal({title:'+ Nova Conta Bancária',size:'max-w-lg',body:`<div class="space-y-4">
      <div><label class="brand-label">Projeto *</label><select id="ba-proj" class="brand-input"><option value="">Selecione…</option>${projects.filter(p=>p.status==='ativo').map(p=>`<option value="${p.id}" ${p.id===preProj?'selected':''}>${esc(p.name)}</option>`).join('')}</select></div>
      <div class="grid grid-cols-2 gap-4"><div><label class="brand-label">Banco *</label><input id="ba-bank" class="brand-input" /></div><div><label class="brand-label">Cód. BACEN</label><input id="ba-code" class="brand-input" placeholder="001" /></div><div><label class="brand-label">Agência *</label><input id="ba-agency" class="brand-input" /></div><div><label class="brand-label">Conta *</label><input id="ba-account" class="brand-input" placeholder="00012345-6" /></div>
      <div class="col-span-2"><label class="brand-label">Beneficiário *</label><input id="ba-benef" class="brand-input" /></div>
      <div><label class="brand-label">Tipo Pix *</label><select id="ba-pixtype" class="brand-input">${Object.entries(PIX_KEY_LABELS).map(([k,v])=>`<option value="${k}">${v}</option>`).join('')}</select></div>
      <div><label class="brand-label">Chave Pix *</label><input id="ba-pixkey" class="brand-input" /></div></div></div>`,
      footer:`<button onclick="UI.closeModal()" class="brand-btn border border-slate-300 text-slate-600 hover:bg-slate-50">Cancelar</button><button onclick="ModContasBancarias.saveNew()" class="brand-btn bg-brand-800 text-white hover:bg-brand-700">Salvar</button>`});
  },
  async saveNew(){
    const g=id=>document.getElementById(id)?.value.trim();
    if(!g('ba-proj')||!g('ba-bank')||!g('ba-agency')||!g('ba-account')||!g('ba-benef')||!g('ba-pixkey')){UI.toast('Preencha todos os campos','warning');return;}
    const acc=g('ba-account');await DB.insert('bank_accounts',{project_id:g('ba-proj'),bank_name:g('ba-bank'),bank_code:g('ba-code'),agency:g('ba-agency'),account_number:acc.split('-')[0].trim(),account_digit:acc.includes('-')?acc.split('-')[1].trim():null,beneficiary_name:g('ba-benef'),pix_key:g('ba-pixkey'),pix_key_type:document.getElementById('ba-pixtype')?.value,is_active:true});
    UI.closeModal();UI.toast('✅ Conta cadastrada!','success');if(S.module==='contas-bancarias')await this.render();
  },
  async openEdit(id){
    if(!RBAC.can('canManageBanks')){UI.toast('Sem permissão','error');return;}
    const{data:b}=await DB.getById('bank_accounts',id);if(!b)return;
    UI.openModal({title:`Editar — ${b.bank_name}`,size:'max-w-lg',body:`<div class="space-y-4"><div class="grid grid-cols-2 gap-4">
      <div><label class="brand-label">Banco *</label><input id="edit-bank" class="brand-input" value="${esc(b.bank_name)}" /></div>
      <div><label class="brand-label">Cód. BACEN</label><input id="edit-code" class="brand-input" value="${esc(b.bank_code||'')}" /></div>
      <div><label class="brand-label">Agência *</label><input id="edit-agency" class="brand-input" value="${esc(b.agency)}" /></div>
      <div><label class="brand-label">Conta (com dígito) *</label><input id="edit-account" class="brand-input" value="${esc(b.account_number)}${b.account_digit?'-'+esc(b.account_digit):''}" /></div>
      <div class="col-span-2"><label class="brand-label">Beneficiário *</label><input id="edit-benef" class="brand-input" value="${esc(b.beneficiary_name)}" /></div>
      <div><label class="brand-label">Tipo Chave Pix</label><select id="edit-pixtype" class="brand-input">${Object.entries(PIX_KEY_LABELS).map(([k,v])=>`<option value="${k}" ${k===b.pix_key_type?'selected':''}>${v}</option>`).join('')}</select></div>
      <div><label class="brand-label">Chave Pix *</label><input id="edit-pixkey" class="brand-input" value="${esc(b.pix_key)}" /></div></div></div>`,
      footer:`<button onclick="UI.confirm('Desativar esta conta?',()=>ModContasBancarias.deactivate('${esc(id)}'),{danger:true})" class="brand-btn border border-red-300 text-red-600 hover:bg-red-50 mr-auto">Desativar</button><button onclick="UI.closeModal()" class="brand-btn border border-slate-300 text-slate-600 hover:bg-slate-50">Cancelar</button><button onclick="ModContasBancarias.saveEdit('${esc(id)}')" class="brand-btn bg-brand-800 text-white hover:bg-brand-700">Salvar</button>`});
  },
  async saveEdit(id){
    const g=x=>document.getElementById(x)?.value.trim();const acc=g('edit-account')||'';
    if(!g('edit-bank')||!g('edit-agency')||!acc||!g('edit-benef')||!g('edit-pixkey')){UI.toast('Preencha os campos obrigatórios','warning');return;}
    await DB.update('bank_accounts',id,{bank_name:g('edit-bank'),bank_code:g('edit-code')||null,agency:g('edit-agency'),account_number:acc.split('-')[0].trim(),account_digit:acc.includes('-')?acc.split('-')[1].trim():null,pix_key:g('edit-pixkey'),pix_key_type:document.getElementById('edit-pixtype')?.value,beneficiary_name:g('edit-benef')});
    UI.closeModal();UI.toast('✅ Conta atualizada','success');if(S.module==='contas-bancarias')await this.render();
  },
  async deactivate(id){await DB.update('bank_accounts',id,{is_active:false});UI.closeModal();UI.toast('Conta desativada','info');if(S.module==='contas-bancarias')await this.render();}
};

// ═══════════ MODULE: NOTAS FISCAIS ═══════════
const ModNotasFiscais={
  async render(){
    const{data:notes}=await DB.get('notes_fiscal');const{data:projects}=await DB.get('projects');
    const fil=notes.filter(n=>!S.period||n.competency_period?.startsWith(S.period)).map(n=>DB.computeNote(n)).sort((a,b)=>new Date(b.created_at)-new Date(a.created_at));
    UI.render(`<div class="p-6 fade-in"><div class="flex items-center justify-between mb-5 flex-wrap gap-3"><div><h1 class="text-xl font-bold text-slate-800">Notas Fiscais</h1><p class="text-sm text-slate-500">${fil.length} nota(s) — ${Fmt.period(S.period)}</p></div>${RBAC.can('canCreateNote')?`<button onclick="ModNotasFiscais.openNew()" class="brand-btn bg-brand-800 text-white hover:bg-brand-700 shadow-sm">+ Nova Nota Fiscal</button>`:''}</div>
    <div class="grid grid-cols-2 lg:grid-cols-4 gap-3 mb-5">${[['Bruto',fil.reduce((a,n)=>a+n.gross_amount,0),'text-slate-700'],['Retido',fil.reduce((a,n)=>a+n.tax_withheld,0),'text-red-600'],['Líquido',fil.reduce((a,n)=>a+n.net_amount,0),'text-emerald-700'],['Pend. Pag.',fil.filter(n=>n.status==='pix_gerado'||n.status==='aprovada').reduce((a,n)=>a+n.net_amount,0),'text-amber-600']].map(([l,v,c])=>`<div class="bg-white rounded-lg border border-slate-200 px-4 py-3"><p class="text-xs text-slate-500 uppercase tracking-wide font-semibold">${l}</p><p class="font-bold ${c} mt-1 text-lg">${Fmt.money(v)}</p></div>`).join('')}</div>
    <div class="bg-white rounded-xl border border-slate-200 overflow-hidden">${fil.length===0?UI.empty('Nenhuma nota no período','🧾'):`<div class="overflow-x-auto"><table class="brand-table"><thead><tr><th>NF / Emitente</th><th>Regime</th><th>Projeto</th><th class="text-right">Bruto</th><th class="text-right">Retido</th><th class="text-right">Líquido</th><th>Status</th><th class="text-center">Ações</th></tr></thead><tbody>
    ${fil.map(n=>{const pr=projects.find(x=>x.id===n.project_id);return`<tr><td><p class="font-semibold text-slate-800 text-sm">${esc(n.emitter_name)}</p><p class="text-xs text-slate-400">${esc(n.fiscal_note_number||'–')} · ${Fmt.date(n.issue_date)}</p></td><td><span class="text-xs bg-slate-100 px-2 py-0.5 rounded font-medium text-slate-600">${EMITTER_LABELS[n.emitter_type]||n.emitter_type}</span></td><td class="text-xs text-slate-500 max-w-[120px] truncate">${esc(pr?.name||'–')}</td><td class="text-right font-mono text-sm">${Fmt.money(n.gross_amount)}</td><td class="text-right font-mono text-sm text-red-600">–${Fmt.money(n.tax_withheld)}</td><td class="text-right font-mono text-sm font-bold text-emerald-700">${Fmt.money(n.net_amount)}</td><td>${UI.badge(n.status)}</td><td class="text-center"><div class="flex items-center justify-center gap-1"><button onclick="ModNotasFiscais.openDetail('${n.id}')" class="text-xs px-2 py-1 rounded text-slate-600 hover:bg-slate-100" title="Detalhes">👁️</button>${n.status==='pendente'&&RBAC.can('canApprove')?`<button onclick="ModNotasFiscais.approve('${n.id}')" class="text-xs px-2 py-1 rounded text-emerald-700 hover:bg-emerald-50" title="Aprovar">✅</button>`:''}${n.status==='aprovada'&&RBAC.can('canApprove')?`<button onclick="ModNotasFiscais.generatePix('${n.id}')" class="text-xs px-2 py-1 rounded text-blue-700 hover:bg-blue-50" title="Gerar Pix">🏦</button>`:''}${n.status==='pix_gerado'?`<button onclick="ModNotasFiscais.openPixModal('${n.id}')" class="text-xs px-2 py-1 rounded text-indigo-700 hover:bg-indigo-50" title="Ver Pix">📱</button>`:''}</div></td></tr>`;}).join('')}
    </tbody></table></div>`}</div></div>`);
  },
  async openNew(preProj=''){
    const{data:projects}=await DB.get('projects');const now=new Date().toISOString().split('T')[0];
    UI.openModal({title:'+ Nova Nota Fiscal',size:'max-w-2xl',body:`<div class="space-y-5">
      <div><p class="text-xs font-bold text-slate-500 uppercase tracking-wide mb-3 pb-2 border-b">Emitente</p>
      <div class="grid grid-cols-2 gap-4"><div class="col-span-2"><label class="brand-label">Emitente *</label><input id="nf-emitter" class="brand-input" /></div>
      <div><label class="brand-label">CPF / CNPJ *</label><input id="nf-cnpj" class="brand-input" /></div>
      <div><label class="brand-label">Regime Tributário *</label><select id="nf-type" class="brand-input" onchange="ModNotasFiscais.previewTax()">${Object.entries(EMITTER_LABELS).map(([k,v])=>`<option value="${k}">${v}</option>`).join('')}</select></div>
      <div class="col-span-2"><label class="brand-label">Descrição do Serviço</label><input id="nf-desc" class="brand-input" /></div>
      <div><label class="brand-label">Número NF</label><input id="nf-num" class="brand-input" /></div>
      <div><label class="brand-label">Data Emissão</label><input id="nf-issue" type="date" class="brand-input" value="${now}" /></div></div></div>
      <div><p class="text-xs font-bold text-slate-500 uppercase tracking-wide mb-3 pb-2 border-b">Valores</p>
      <div class="grid grid-cols-2 gap-4"><div><label class="brand-label">Valor Bruto (R$) *</label><input id="nf-gross" type="number" class="brand-input" min="0.01" step="0.01" oninput="ModNotasFiscais.previewTax()" /></div><div><label class="brand-label">Vencimento</label><input id="nf-due" type="date" class="brand-input" /></div></div>
      <div id="tax-preview" class="mt-2"></div></div>
      <div><p class="text-xs font-bold text-slate-500 uppercase tracking-wide mb-3 pb-2 border-b">Vinculação</p>
      <div class="grid grid-cols-2 gap-4"><div><label class="brand-label">Projeto *</label><select id="nf-project" class="brand-input" onchange="ModNotasFiscais.loadBanks()"><option value="">Selecione…</option>${projects.filter(p=>p.status==='ativo').map(p=>`<option value="${p.id}" ${p.id===preProj?'selected':''}>${esc(p.name)}</option>`).join('')}</select></div>
      <div><label class="brand-label">Conta / Pix</label><select id="nf-bank" class="brand-input"><option>Selecione o projeto…</option></select></div>
      <div class="col-span-2"><label class="brand-label">Período de Competência *</label><input id="nf-period" type="month" class="brand-input" value="${S.period}" /></div></div></div></div>`,
      footer:`<button onclick="UI.closeModal()" class="brand-btn border border-slate-300 text-slate-600 hover:bg-slate-50">Cancelar</button><button onclick="ModNotasFiscais.saveNew()" class="brand-btn bg-brand-800 text-white hover:bg-brand-700">Lançar Nota</button>`});
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
    sel.innerHTML=pb.length===0?'<option value="">Sem contas</option>':pb.map(b=>`<option value="${b.id}">${esc(b.bank_name)} — ${esc(b.pix_key)}</option>`).join('');
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
  async _refresh(){if(S.module==='notas-fiscais')await this.render();else if(S.module==='pix')await ModPix.render();else await ModDashboard.render();},
  cancel(id){
    if(!RBAC.can('canApprove')){UI.toast('Sem permissão','error');return;}
    UI.confirm('Cancelar esta nota fiscal? A ação não pode ser desfeita.',async()=>{
      await DB.update('notes_fiscal',id,{status:'cancelada'});
      UI.toast('Nota cancelada','info');App.updateBadges();await this._refresh();
    },{danger:true});
  },
  divergence(id){
    if(!RBAC.can('canApprove')){UI.toast('Sem permissão','error');return;}
    UI.openModal({title:'⚠️ Registrar divergência',size:'max-w-md',body:`<div><label class="brand-label">Motivo *</label><textarea id="div-reason" class="brand-input h-24 resize-none" placeholder="Ex: valor recebido difere do esperado"></textarea></div>`,
      footer:`<button onclick="UI.closeModal()" class="brand-btn border border-slate-300 text-slate-600 hover:bg-slate-50">Cancelar</button><button onclick="ModNotasFiscais.saveDivergence('${esc(id)}')" class="brand-btn bg-red-600 text-white hover:bg-red-700">Registrar</button>`});
  },
  async saveDivergence(id){
    const r=document.getElementById('div-reason')?.value.trim();
    if(!r){UI.toast('Informe o motivo','warning');return;}
    await DB.update('notes_fiscal',id,{status:'divergencia',divergence_reason:r});
    UI.closeModal();UI.toast('Divergência registrada','info');App.updateBadges();await this._refresh();
  },
  async openDetail(id){
    const{data:note}=await DB.getById('notes_fiscal',id);if(!note)return;const n=DB.computeNote(note);
    const{data:projects}=await DB.get('projects');const pr=projects.find(x=>x.id===n.project_id);
    UI.openModal({title:`🧾 ${n.emitter_name}`,size:'max-w-2xl',body:`<div class="space-y-4">
      <div class="flex items-center gap-3 flex-wrap">${UI.badge(n.status)}<span class="text-xs bg-slate-100 text-slate-600 px-2 py-0.5 rounded">${EMITTER_LABELS[n.emitter_type]||n.emitter_type}</span><span class="text-xs text-slate-400">${Fmt.period(n.competency_period?.substring(0,7))}</span></div>
      <div class="grid grid-cols-2 gap-4"><div><p class="brand-label">Emitente</p><p class="text-sm font-semibold">${esc(n.emitter_name)}</p></div><div><p class="brand-label">CPF/CNPJ</p><p class="text-sm">${Fmt.cnpj(n.emitter_cnpj)}</p></div><div><p class="brand-label">Serviço</p><p class="text-sm">${esc(n.service_description||'–')}</p></div><div><p class="brand-label">Projeto</p><p class="text-sm">${esc(pr?.name||'–')}</p></div><div><p class="brand-label">Emissão</p><p class="text-sm">${Fmt.date(n.issue_date)}</p></div><div><p class="brand-label">Vencimento</p><p class="text-sm">${Fmt.date(n.due_date)}</p></div></div>
      ${FiscalEngine.renderBreakdown(n)}
      ${n.tx_id?`<div class="bg-indigo-50 border border-indigo-200 rounded-xl p-4"><p class="text-xs font-bold text-indigo-600 uppercase tracking-wide mb-1">TxId Pix</p><p class="font-mono text-xs text-indigo-800 break-all">${esc(n.tx_id)}</p></div>`:''}
      ${n.status==='pago_conciliado'?`<div class="bg-emerald-50 border border-emerald-200 rounded-xl p-4 flex items-center gap-3"><div class="w-3 h-3 bg-emerald-500 rounded-full pulse-conciliado flex-shrink-0"></div><div><p class="text-sm font-bold text-emerald-700">Pagamento Conciliado ✔</p><p class="text-xs text-emerald-600">Pago em ${Fmt.datetime(n.paid_at)} · ${Fmt.money(n.paid_amount)}</p></div></div>`:''}
      ${n.status==='divergencia'?`<div class="bg-red-50 border border-red-200 rounded-xl p-4"><p class="text-sm font-bold text-red-700">⚠️ Divergência</p><p class="text-xs text-red-600">${esc(n.divergence_reason||'Valor recebido difere do esperado')}</p></div>`:''}
    </div>`,footer:`${['pendente','aprovada','pix_gerado','divergencia'].includes(n.status)&&RBAC.can('canApprove')?`<button onclick="ModNotasFiscais.cancel('${id}')" class="brand-btn border border-red-300 text-red-600 hover:bg-red-50 mr-auto">🚫 Cancelar NF</button>`:''}${n.status==='pix_gerado'&&RBAC.can('canApprove')?`<button onclick="ModNotasFiscais.divergence('${id}')" class="brand-btn border border-amber-300 text-amber-700 hover:bg-amber-50">⚠️ Divergência</button>`:''}${n.status==='pendente'&&RBAC.can('canApprove')?`<button onclick="ModNotasFiscais.approve('${id}');UI.closeModal()" class="brand-btn bg-emerald-600 text-white hover:bg-emerald-700">✅ Aprovar</button>`:''}${n.status==='aprovada'&&RBAC.can('canApprove')?`<button onclick="ModNotasFiscais.generatePix('${id}');UI.closeModal()" class="brand-btn bg-blue-600 text-white hover:bg-blue-700">🏦 Gerar Pix</button>`:''}${n.status==='pix_gerado'?`<button onclick="ModNotasFiscais.openPixModal('${id}');UI.closeModal()" class="brand-btn bg-indigo-600 text-white hover:bg-indigo-700">📱 Ver Pix</button>`:''}<button onclick="UI.closeModal()" class="brand-btn border border-slate-300 text-slate-600 hover:bg-slate-50">Fechar</button>`});
  },
  async openPixModal(id){
    const{data:note}=await DB.getById('notes_fiscal',id);if(!note)return;const n=DB.computeNote(note);
    UI.openModal({title:'🏦 Pix — QR Code e Copia e Cola',size:'max-w-lg',body:`<div class="space-y-4 text-center">
      <div class="bg-emerald-50 rounded-xl p-4 border border-emerald-200"><p class="text-xs text-emerald-600 font-semibold mb-1">Valor Líquido a Pagar</p><p class="text-3xl font-black text-emerald-700">${Fmt.money(n.net_amount)}</p><p class="text-xs text-emerald-500 mt-1">${esc(n.emitter_name)}</p></div>
      <div id="pix-qr-code" class="flex justify-center py-2"></div>
      <div class="text-left"><p class="text-xs text-slate-500 font-semibold mb-2">Pix Copia e Cola (EMV)</p><div class="bg-slate-50 border border-slate-200 rounded-lg p-3"><p id="pix-payload-text" class="font-mono text-xs text-slate-700 break-all leading-relaxed">${esc(n.pix_payload||'Payload indisponível')}</p><button onclick="navigator.clipboard.writeText(document.getElementById('pix-payload-text').textContent).then(()=>UI.toast('📋 Copiado!','success'))" class="mt-2 text-xs text-blue-600 hover:underline">📋 Copiar código</button></div></div>
      <div class="bg-indigo-50 rounded-lg p-3 border border-indigo-200 text-left"><p class="text-xs font-bold text-indigo-700 mb-1">TxId</p><p class="font-mono text-xs text-indigo-600 break-all">${esc(n.tx_id||'–')}</p></div>
      ${ModPix.settleBox(id,n)}
    </div>`,footer:`<button onclick="UI.closeModal()" class="brand-btn border border-slate-300 text-slate-600 hover:bg-slate-50">Fechar</button>`});
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
      ${payable.length===0?UI.empty('Nenhuma nota aguardando','✅'):`<div class="divide-y divide-slate-100">${payable.map(n=>{const pr=projects.find(x=>x.id===n.project_id);const ov=n.due_date&&new Date(n.due_date)<new Date();return`<div class="px-5 py-4 flex items-center gap-4 hover:bg-slate-50"><div class="flex-1 min-w-0"><div class="flex items-center gap-2 mb-1 flex-wrap">${UI.badge(n.status)}${ov?'<span class="badge bg-red-100 text-red-700">⚠️ Vencida</span>':''}</div><p class="font-semibold text-slate-800 text-sm">${esc(n.emitter_name)}</p><p class="text-xs text-slate-400">${esc(pr?.name||'–')} · NF ${esc(n.fiscal_note_number||'–')} · Vence ${Fmt.date(n.due_date)}</p></div><div class="text-right mr-3"><p class="font-bold text-emerald-700 font-mono text-lg">${Fmt.money(n.net_amount)}</p></div><div class="flex flex-col gap-1.5">${n.status==='aprovada'&&RBAC.can('canApprove')?`<button onclick="ModNotasFiscais.generatePix('${n.id}')" class="brand-btn bg-blue-600 text-white hover:bg-blue-700 text-xs">🏦 Gerar Pix</button>`:''} ${n.status==='pix_gerado'?`<button onclick="ModNotasFiscais.openPixModal('${n.id}')" class="brand-btn bg-indigo-600 text-white hover:bg-indigo-700 text-xs">📱 QR Code</button><button onclick="ModPix.settle('${n.id}')" class="brand-btn border border-slate-300 text-slate-600 hover:bg-slate-50 text-xs">🔄 Conciliar</button>`:''}</div></div>`;}).join('')}</div>`}
    </div>
    <div class="bg-white rounded-xl border border-slate-200 overflow-hidden">
      <div class="px-5 py-4 border-b border-slate-100 bg-emerald-50 flex items-center gap-2"><span class="w-2 h-2 bg-emerald-500 rounded-full pulse-conciliado"></span><h2 class="font-bold text-slate-700 text-sm">Recentemente Conciliadas</h2></div>
      ${conciliated.length===0?UI.empty('Nenhuma conciliação ainda','🔄'):`<div class="divide-y divide-slate-100">${conciliated.map(n=>{const pr=projects.find(x=>x.id===n.project_id);return`<div class="px-5 py-3 flex items-center gap-3 hover:bg-slate-50"><span class="text-emerald-500 text-xl">✅</span><div class="flex-1 min-w-0"><p class="text-sm font-semibold">${esc(n.emitter_name)}</p><p class="text-xs text-slate-400">${esc(pr?.name||'–')} · TxId: ${esc((n.tx_id||'–').substring(0,22))}…</p></div><div class="text-right"><p class="font-mono font-bold text-emerald-700">${Fmt.money(n.paid_amount||n.net_amount)}</p><p class="text-xs text-slate-400">${Fmt.datetime(n.paid_at)}</p></div></div>`;}).join('')}</div>`}
    </div></div>`);
  },
  settle(id){return S.demoMode?this.simulateConciliation(id):this.markPaid(id);},
  settleBox(id,n){
    if(n.status!=='pix_gerado'||!RBAC.can('canApprove'))return'';
    return S.demoMode
      ?`<div class="bg-amber-50 border border-amber-200 rounded-lg p-3 text-left"><p class="text-xs text-amber-700 mb-2">⚙️ Simular webhook de conciliação bancária (demo)</p><button onclick="ModPix.settle('${esc(id)}')" class="brand-btn bg-amber-500 text-white hover:bg-amber-600 text-xs w-full justify-center">🔄 Simular Pagamento Recebido</button></div>`
      :`<div class="bg-emerald-50 border border-emerald-200 rounded-lg p-3 text-left"><p class="text-xs text-emerald-700 mb-2">Após confirmar o pagamento no extrato bancário, registre a baixa:</p><button onclick="ModPix.settle('${esc(id)}')" class="brand-btn bg-emerald-600 text-white hover:bg-emerald-700 text-xs w-full justify-center">✅ Registrar pagamento conciliado</button></div>`;
  },
  async markPaid(id){
    if(!RBAC.can('canApprove')){UI.toast('Sem permissão','error');return;}
    const{data:note}=await DB.getById('notes_fiscal',id);if(!note)return;const n=DB.computeNote(note);
    UI.confirm(`Confirmar que ${Fmt.money(n.net_amount)} foi pago a ${n.emitter_name}?`,async()=>{
      await DB.update('notes_fiscal',id,{status:'pago_conciliado',paid_amount:n.net_amount,paid_at:new Date().toISOString()});
      App.updateBadges();UI.toast('💚 Pagamento registrado','success');
      if(S.module==='pix')await this.render();if(S.module==='notas-fiscais')await ModNotasFiscais.render();
    });
  },
  simulateConciliation(noteId){
    UI.openModal({title:'🔄 Motor de Conciliação Bancária',size:'max-w-lg',body:`<div id="concil-log" class="font-mono text-xs bg-slate-900 text-green-400 p-4 rounded-xl h-52 overflow-y-auto leading-loose"><p>$ ARF Conciliation Engine (demo) v1.1.0</p><p>Iniciando…</p></div><div id="concil-result" class="mt-4"></div>`,footer:`<button onclick="UI.closeModal()" class="brand-btn border border-slate-300 text-slate-600 hover:bg-slate-50">Fechar</button>`});
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
  // Carrega pendências com mensagens (demo: embutidas; real: tabela pendency_messages)
  async _withMessages(list){
    if(S.demoMode)return list;
    const{data:msgs}=await DB.get('pendency_messages');
    const by={};msgs.forEach(m=>{(by[m.pendency_id]=by[m.pendency_id]||[]).push(m);});
    return list.map(p=>({...p,messages:(by[p.id]||[]).sort((a,b)=>new Date(a.created_at)-new Date(b.created_at))}));
  },
  async _load(id){
    const{data:p}=await DB.getById('internal_pendencies',id);if(!p)return null;
    if(S.demoMode)return p;
    const{data:msgs}=await DB.get('pendency_messages');
    return{...p,messages:msgs.filter(m=>m.pendency_id===id).sort((a,b)=>new Date(a.created_at)-new Date(b.created_at))};
  },
  async render(){
    const{data:raw}=await DB.get('internal_pendencies');const pendencies=await this._withMessages(raw);
    const{data:projects}=await DB.get('projects');const{data:profiles}=await DB.get('profiles');
    const fil=[...pendencies].filter(p=>!S.period||p.accounting_period?.startsWith(S.period)).sort((a,b)=>{const o={urgente:0,alta:1,normal:2,baixa:3};return(o[a.priority]-o[b.priority])||new Date(b.created_at)-new Date(a.created_at);});
    UI.render(`<div class="p-6 fade-in"><div class="flex items-center justify-between mb-5 flex-wrap gap-3"><div><h1 class="text-xl font-bold text-slate-800">Pendências Internas</h1><p class="text-sm text-slate-500">${fil.length} pendência(s) — ${Fmt.period(S.period)}</p></div>${RBAC.can('canSendPend')?`<button onclick="ModPendencias.openNew()" class="brand-btn bg-brand-800 text-white hover:bg-brand-700 shadow-sm">+ Nova Pendência</button>`:''}</div>
    ${fil.length===0?UI.empty('Nenhuma pendência no período','💬'):`<div class="space-y-3">${fil.map(p=>{
      const prj=projects.find(x=>x.id===p.project_id);const sn=profiles.find(x=>x.id===p.sender_id);const rp=profiles.find(x=>x.id===p.recipient_id);const msgs=(p.messages||[]).length;
      const bc={urgente:'border-l-red-500',alta:'border-l-amber-500',normal:'border-l-blue-500',baixa:'border-l-slate-300'};
      return`<div class="bg-white rounded-xl border border-slate-200 border-l-4 ${bc[p.priority]||'border-l-slate-300'} p-5 hover:shadow-sm cursor-pointer" onclick="ModPendencias.openThread('${esc(p.id)}')"><div class="flex items-start gap-3"><div class="flex-1 min-w-0"><div class="flex items-center gap-2 mb-1.5 flex-wrap">${UI.badge(p.status)}<span class="text-xs text-slate-500">${PRIORITY_LABELS[p.priority]||''}</span></div><p class="font-semibold text-slate-800 text-sm">${esc(p.subject)}</p><p class="text-xs text-slate-400 mt-1">${esc(sn?.full_name||'?')} → ${esc(rp?.full_name||'?')}${prj?' · '+esc(prj.name):''} · ${Fmt.period(p.accounting_period?.substring(0,7))}</p></div><div class="text-right flex-shrink-0"><p class="text-xs text-slate-400">${Fmt.date(p.created_at)}</p>${msgs>0?`<p class="text-xs text-slate-500 mt-1">💬 ${msgs}</p>`:''}</div></div></div>`;
    }).join('')}</div>`}</div>`);
  },
  async openNew(){
    const{data:profiles}=await DB.get('profiles');const{data:projects}=await DB.get('projects');
    const others=profiles.filter(u=>u.id!==S.user.id&&u.is_active);const now=new Date().toISOString().substring(0,7);
    UI.openModal({title:'+ Nova Pendência',size:'max-w-lg',body:`<div class="space-y-4">
      <div><label class="brand-label">Destinatário *</label><select id="pend-recip" class="brand-input"><option value="">Selecione…</option>${others.map(u=>`<option value="${esc(u.id)}">${esc(u.full_name)} (${esc(ROLE_LABELS[u.role]||u.role)})</option>`).join('')}</select></div>
      <div><label class="brand-label">Projeto</label><select id="pend-proj" class="brand-input"><option value="">Nenhum</option>${projects.map(p=>`<option value="${esc(p.id)}">${esc(p.name)}</option>`).join('')}</select></div>
      <div><label class="brand-label">Assunto *</label><input id="pend-subject" class="brand-input" maxlength="200" /></div>
      <div class="grid grid-cols-2 gap-4"><div><label class="brand-label">Prioridade</label><select id="pend-prio" class="brand-input">${Object.entries(PRIORITY_LABELS).map(([k,v])=>`<option value="${k}" ${k==='normal'?'selected':''}>${v}</option>`).join('')}</select></div><div><label class="brand-label">Período Contábil *</label><input id="pend-period" type="month" class="brand-input" value="${esc(S.period||now)}" /></div></div>
      <div><label class="brand-label">Primeira Mensagem *</label><textarea id="pend-msg" class="brand-input h-24 resize-none"></textarea></div>
    </div>`,footer:`<button onclick="UI.closeModal()" class="brand-btn border border-slate-300 text-slate-600 hover:bg-slate-50">Cancelar</button><button onclick="ModPendencias.saveNew()" class="brand-btn bg-brand-800 text-white hover:bg-brand-700">Enviar</button>`});
  },
  async saveNew(){
    const g=id=>document.getElementById(id)?.value.trim();
    if(!RBAC.can('canSendPend')){UI.toast('Sem permissão','error');return;}
    if(!g('pend-recip')||!g('pend-subject')||!g('pend-msg')||!g('pend-period')){UI.toast('Preencha todos os campos','warning');return;}
    const base={sender_id:S.user.id,recipient_id:g('pend-recip'),project_id:g('pend-proj')||null,accounting_period:g('pend-period')+'-01',subject:g('pend-subject'),status:'aberta',priority:document.getElementById('pend-prio')?.value||'normal'};
    const msg={sender_id:S.user.id,content_text:g('pend-msg')};
    if(S.demoMode){await DB.insert('internal_pendencies',{...base,messages:[{id:'msg-'+Date.now(),...msg,created_at:new Date().toISOString()}]});}
    else{const{data:p}=await DB.insert('internal_pendencies',base);await DB.insert('pendency_messages',{pendency_id:p.id,...msg});}
    UI.closeModal();UI.toast('✅ Pendência enviada!','success');App.updateBadges();if(S.module==='pendencias')await this.render();
  },
  async openThread(pendId){
    const pend=await this._load(pendId);if(!pend)return;
    const{data:profiles}=await DB.get('profiles');const{data:projects}=await DB.get('projects');
    const prj=projects.find(p=>p.id===pend.project_id);const msgs=pend.messages||[];const sn=profiles.find(p=>p.id===pend.sender_id);const rp=profiles.find(p=>p.id===pend.recipient_id);
    const so=['aberta','em_analise','resolvida','cancelada'].map(s=>`<option value="${s}" ${s===pend.status?'selected':''}>${STATUS_LABELS[s]||s}</option>`).join('');
    UI.openModal({title:`💬 ${pend.subject}`,size:'max-w-2xl',body:`<div class="space-y-4">
      <div class="flex items-center gap-2 flex-wrap">${UI.badge(pend.status)}<span class="text-xs text-slate-500">${PRIORITY_LABELS[pend.priority]||''}</span>${prj?`<span class="text-xs bg-blue-100 text-blue-700 px-2 py-0.5 rounded-full">${esc(prj.name)}</span>`:''}</div>
      <p class="text-xs text-slate-500">De: <b>${esc(sn?.full_name||'?')}</b> → Para: <b>${esc(rp?.full_name||'?')}</b> · ${Fmt.period(pend.accounting_period?.substring(0,7))}</p>
      <div class="bg-slate-50 border border-slate-200 rounded-xl p-4 space-y-4 max-h-60 overflow-y-auto" id="msg-thread">${msgs.map(m=>{const u=profiles.find(p=>p.id===m.sender_id);const isMe=m.sender_id===S.user.id;return`<div class="flex ${isMe?'justify-end':'justify-start'}"><div class="max-w-[82%]"><p class="text-[10px] text-slate-400 mb-1 ${isMe?'text-right':''}">${esc(u?.full_name||'?')} · ${Fmt.datetime(m.created_at)}</p><div class="${isMe?'bg-brand-800 text-white':'bg-white border border-slate-200'} rounded-xl px-4 py-3 text-sm whitespace-pre-wrap">${esc(m.content_text||'')}</div></div></div>`;}).join('')}</div>
      <div class="space-y-3"><textarea id="reply-msg" class="brand-input h-20 resize-none" placeholder="Escreva sua resposta…"></textarea><div class="flex items-center justify-between flex-wrap gap-2"><div class="flex items-center gap-2"><label class="text-xs text-slate-500 font-semibold">Status:</label><select id="pend-new-status" class="brand-input py-1 text-xs" style="width:auto">${so}</select></div><button onclick="ModPendencias.sendReply('${esc(pendId)}')" class="brand-btn bg-brand-800 text-white hover:bg-brand-700 text-sm">Enviar Resposta</button></div></div>
    </div>`,footer:`<button onclick="UI.closeModal()" class="brand-btn border border-slate-300 text-slate-600 hover:bg-slate-50">Fechar</button>`});
    setTimeout(()=>{const t=document.getElementById('msg-thread');if(t)t.scrollTop=t.scrollHeight;},100);
  },
  async sendReply(pendId){
    const txt=document.getElementById('reply-msg')?.value.trim();const sts=document.getElementById('pend-new-status')?.value;
    if(!txt){UI.toast('Escreva uma mensagem','warning');return;}
    if(S.demoMode){
      const{data:p}=await DB.getById('internal_pendencies',pendId);if(!p)return;
      const messages=[...(p.messages||[]),{id:'msg-'+Date.now(),sender_id:S.user.id,content_text:txt,created_at:new Date().toISOString()}];
      await DB.update('internal_pendencies',pendId,{messages,status:sts});
    }else{
      await DB.insert('pendency_messages',{pendency_id:pendId,sender_id:S.user.id,content_text:txt});
      await DB.update('internal_pendencies',pendId,{status:sts,updated_at:new Date().toISOString()});
    }
    UI.closeModal();UI.toast('✅ Resposta enviada!','success');App.updateBadges();if(S.module==='pendencias')await this.render();
  }
};

// ═══════════ MODULE: RELATÓRIO ═══════════
const ModRelatorio={
  async render(){
    const{data:notes}=await DB.get('notes_fiscal');const{data:projects}=await DB.get('projects');
    const fil=notes.filter(n=>!S.period||n.competency_period?.startsWith(S.period)).map(n=>DB.computeNote(n));
    const byProj=projects.map(p=>{const pn=fil.filter(n=>n.project_id===p.id);return{...p,notes:pn,bruto:pn.reduce((a,n)=>a+n.gross_amount,0),retido:pn.reduce((a,n)=>a+n.tax_withheld,0),liq:pn.reduce((a,n)=>a+n.net_amount,0),pago:pn.filter(n=>n.status==='pago_conciliado').reduce((a,n)=>a+(n.paid_amount||0),0)};}).filter(p=>p.notes.length>0);
    UI.render(`<div class="p-6 fade-in"><div class="flex items-center justify-between mb-5 flex-wrap gap-3"><div><h1 class="text-xl font-bold text-slate-800">Balancete Mensal</h1><p class="text-sm text-slate-500">Período: ${Fmt.period(S.period)}</p></div><button onclick="window.print()" class="brand-btn border border-slate-300 text-slate-600 hover:bg-slate-50">🖨️ Imprimir</button></div>
    <div class="grid grid-cols-2 lg:grid-cols-4 gap-4 mb-5">${[['Total Bruto',fil.reduce((a,n)=>a+n.gross_amount,0),'text-slate-700'],['Total Retido',fil.reduce((a,n)=>a+n.tax_withheld,0),'text-red-600'],['Total Líquido',fil.reduce((a,n)=>a+n.net_amount,0),'text-emerald-700'],['Total Pago',fil.filter(n=>n.status==='pago_conciliado').reduce((a,n)=>a+(n.paid_amount||0),0),'text-blue-700']].map(([l,v,c])=>`<div class="bg-white rounded-xl border border-slate-200 p-4"><p class="text-xs text-slate-500 uppercase tracking-wide font-semibold">${l}</p><p class="text-xl font-black ${c} mt-1">${Fmt.money(v)}</p></div>`).join('')}</div>
    <div class="bg-white rounded-xl border border-slate-200 overflow-hidden"><div class="px-5 py-3 bg-slate-50 border-b border-slate-200"><h2 class="font-bold text-slate-700 text-sm">Detalhamento por Projeto</h2></div>
    ${byProj.length===0?UI.empty('Nenhum lançamento no período','📋'):`<div class="overflow-x-auto"><table class="brand-table"><thead><tr><th>Projeto</th><th>Tipo</th><th class="text-center">NFs</th><th class="text-right">Bruto</th><th class="text-right">Retido</th><th class="text-right">Líquido</th><th class="text-right">Pago</th></tr></thead><tbody>
    ${byProj.map(p=>`<tr><td><p class="font-semibold text-slate-800 text-sm">${esc(p.name)}</p><p class="text-xs text-slate-400">${esc(p.code||'–')}</p></td><td><span class="text-xs px-2 py-0.5 rounded-full font-semibold ${p.type==='Livre'?'bg-blue-100 text-blue-700':'bg-purple-100 text-purple-700'}">${esc(p.type)}</span></td><td class="text-center">${p.notes.length}</td><td class="text-right font-mono text-sm">${Fmt.money(p.bruto)}</td><td class="text-right font-mono text-sm text-red-600">–${Fmt.money(p.retido)}</td><td class="text-right font-mono text-sm font-bold text-emerald-700">${Fmt.money(p.liq)}</td><td class="text-right font-mono text-sm text-blue-700">${Fmt.money(p.pago)}</td></tr>`).join('')}
    <tr class="bg-slate-50 font-bold border-t-2 border-slate-300"><td colspan="3" class="font-bold text-slate-700 py-3">TOTAL GERAL</td><td class="text-right font-mono text-sm">${Fmt.money(byProj.reduce((a,p)=>a+p.bruto,0))}</td><td class="text-right font-mono text-sm text-red-600">–${Fmt.money(byProj.reduce((a,p)=>a+p.retido,0))}</td><td class="text-right font-mono text-sm text-emerald-700">${Fmt.money(byProj.reduce((a,p)=>a+p.liq,0))}</td><td class="text-right font-mono text-sm text-blue-700">${Fmt.money(byProj.reduce((a,p)=>a+p.pago,0))}</td></tr>
    </tbody></table></div>`}</div></div>`);
  }
};

// ═══════════ MODULE: USUÁRIOS ═══════════
const ModUsuarios={
  async render(){
    const{data:profiles}=await DB.get('profiles');
    UI.render(`<div class="p-6 fade-in">
    <div class="flex items-center justify-between mb-5 flex-wrap gap-3">
      <div><h1 class="text-xl font-bold text-slate-800">Usuários e Papéis</h1><p class="text-sm text-slate-500">${profiles.length} usuário(s) cadastrado(s)</p></div>
      ${RBAC.can('canManageUsers')?`<button onclick="ModUsuarios.openNew()" class="brand-btn bg-brand-800 text-white hover:bg-brand-700 shadow-sm">+ Criar Usuário</button>`:''}
    </div>
    ${!S.demoMode?`<div class="bg-blue-50 border border-blue-200 rounded-xl p-4 mb-5 text-sm text-blue-800 flex gap-3"><span class="text-lg">ℹ️</span><div>A conta é criada no servidor (Edge Function <code>create-user</code>) já confirmada. O usuário entra com o e-mail e a senha definidos aqui e deve trocá-la em “Esqueci a senha”.</div></div>`:''}
    <div class="bg-white rounded-xl border border-slate-200 overflow-hidden mb-5">
      <div class="overflow-x-auto"><table class="brand-table"><thead><tr><th>Usuário</th><th>E-mail</th><th>Papel</th><th>Departamento</th><th>Status</th>${RBAC.can('canManageUsers')?'<th>Ações</th>':''}</tr></thead><tbody>
      ${profiles.map(u=>`<tr>
        <td><div class="flex items-center gap-3"><div class="w-9 h-9 rounded-full flex items-center justify-center text-white text-xs font-bold flex-shrink-0 bg-brand-600">${esc(Fmt.initials(u.full_name))}</div><p class="font-semibold text-slate-800 text-sm">${esc(u.full_name)}</p></div></td>
        <td class="text-slate-500 text-xs font-mono">${esc(u.email||'–')}</td>
        <td><span class="badge bg-brand-100 text-brand-800">${esc(ROLE_LABELS[u.role]||u.role)}</span></td>
        <td class="text-slate-500 text-sm">${esc(u.department||'–')}</td>
        <td>${u.is_active?'<span class="badge bg-emerald-100 text-emerald-700">Ativo</span>':'<span class="badge bg-red-100 text-red-700">Inativo</span>'}</td>
        ${RBAC.can('canManageUsers')?`<td><div class="flex gap-1"><button onclick="ModUsuarios.editRole('${esc(u.id)}')" class="text-xs px-2 py-1 rounded text-slate-600 hover:bg-slate-100" title="Editar">✏️</button>${u.id!==S.user.id?`<button onclick="ModUsuarios.toggleActive('${esc(u.id)}',${!u.is_active})" class="text-xs px-2 py-1 rounded ${u.is_active?'text-red-600 hover:bg-red-50':'text-emerald-600 hover:bg-emerald-50'}" title="${u.is_active?'Desativar':'Reativar'}">${u.is_active?'🚫':'✅'}</button>`:''}</div></td>`:''}
      </tr>`).join('')}</tbody></table></div>
    </div>
    <div class="bg-white rounded-xl border border-slate-200 p-5"><h3 class="font-bold text-slate-700 text-sm mb-4">Matriz de Permissões (RBAC)</h3><div class="overflow-x-auto"><table class="w-full text-xs"><thead><tr><th class="text-left py-2 pr-4 text-slate-500 font-semibold">Permissão</th>${Object.keys(RBAC.rules).map(r=>`<th class="py-2 px-2 text-center text-slate-500 font-semibold">${ROLE_LABELS[r]}</th>`).join('')}</tr></thead><tbody>
    ${[['canCreateNote','Criar Nota Fiscal'],['canApprove','Aprovar / Gerar Pix'],['canManageBanks','Contas Bancárias'],['canViewReports','Relatórios'],['canManageUsers','Usuários'],['canSendPend','Enviar Pendências']].map(([perm,label])=>`<tr class="border-t border-slate-100"><td class="py-2 pr-4 text-slate-600">${label}</td>${Object.keys(RBAC.rules).map(r=>`<td class="py-2 px-2 text-center">${RBAC.rules[r][perm]?'✅':'–'}</td>`).join('')}</tr>`).join('')}</tbody></table></div></div></div>`);
  },
  async openNew(){
    if(!RBAC.can('canManageUsers')){UI.toast('Sem permissão','error');return;}
    const modeNote=S.demoMode
      ?'<div class="bg-amber-50 border border-amber-200 rounded-lg p-3 text-xs text-amber-700">🧪 Modo demo: usuário salvo localmente apenas.</div>'
      :'<div class="bg-blue-50 border border-blue-200 rounded-lg p-3 text-xs text-blue-700">🔐 A conta é criada no servidor; sua sessão de administrador não é afetada.</div>';
    UI.openModal({title:'+ Criar Novo Usuário',size:'max-w-md',body:`<div class="space-y-4">${modeNote}
      <div><label class="brand-label">Nome Completo *</label><input id="usr-name" class="brand-input" placeholder="Ex: Ana Paula Souza" /></div>
      <div><label class="brand-label">E-mail *</label><input id="usr-email" type="email" class="brand-input" placeholder="usuario@exemplo.com.br" /></div>
      <div><label class="brand-label">Senha inicial *</label><input id="usr-pass" type="password" autocomplete="new-password" class="brand-input" placeholder="Mínimo 8 caracteres" /></div>
      <div class="grid grid-cols-2 gap-4">
        <div><label class="brand-label">Papel *</label><select id="usr-role" class="brand-input">${Object.entries(ROLE_LABELS).filter(([k])=>k!=='demo').map(([k,v])=>`<option value="${k}" ${k==='caixa'?'selected':''}>${v}</option>`).join('')}</select></div>
        <div><label class="brand-label">Departamento</label><input id="usr-dept" class="brand-input" placeholder="Ex: Contabilidade" /></div>
      </div>
      <div id="usr-error" class="hidden bg-red-50 border border-red-200 rounded-lg p-3 text-xs text-red-700"></div></div>`,
      footer:`<button onclick="UI.closeModal()" class="brand-btn border border-slate-300 text-slate-600 hover:bg-slate-50">Cancelar</button><button onclick="ModUsuarios.saveNew()" id="usr-save-btn" class="brand-btn bg-brand-800 text-white hover:bg-brand-700">Criar Usuário</button>`});
  },
  async saveNew(){
    const g=id=>document.getElementById(id)?.value.trim();
    const name=g('usr-name'),email=g('usr-email'),pass=document.getElementById('usr-pass')?.value||'',role=g('usr-role')||'caixa',dept=g('usr-dept');
    const errEl=document.getElementById('usr-error'),btn=document.getElementById('usr-save-btn');
    if(!RBAC.can('canManageUsers')){UI.toast('Sem permissão','error');return;}
    if(!name||!email){UI.toast('Preencha nome e e-mail','warning');return;}
    if(!S.demoMode&&pass.length<8){UI.toast('A senha deve ter ao menos 8 caracteres','warning');return;}
    if(errEl)errEl.classList.add('hidden');
    if(btn){btn.disabled=true;btn.textContent='Criando...';}
    try{
      if(S.demoMode){
        await DB.insert('profiles',{full_name:name,email,role,department:dept||null,is_active:true});
        UI.closeModal();UI.toast('✅ Usuário criado (demo)','success');await this.render();return;
      }
      // Criação no servidor (service_role) — não troca a sessão do administrador
      const{data,error}=await sbClient.functions.invoke('create-user',{body:{email,password:pass,full_name:name,role,department:dept||null}});
      if(error){let m=error.message;try{const j=await error.context.json();m=j.error||m;}catch{}throw new Error(m);}
      if(data?.error)throw new Error(data.error);
      UI.closeModal();UI.toast('✅ Usuário criado! Já pode fazer login.','success',6000);await this.render();
    }catch(e){
      const msgs={'User already registered':'Este e-mail já está cadastrado.','A user with this email address has already been registered':'Este e-mail já está cadastrado.'};
      if(errEl){errEl.textContent=msgs[e.message]||e.message||'Erro ao criar usuário.';errEl.classList.remove('hidden');}
      if(btn){btn.disabled=false;btn.textContent='Criar Usuário';}
    }
  },
  async editRole(id){
    if(!RBAC.can('canManageUsers')){UI.toast('Sem permissão','error');return;}
    const{data:u}=await DB.getById('profiles',id);if(!u)return;
    UI.openModal({title:`Editar — ${u.full_name}`,size:'max-w-sm',body:`<div class="space-y-4">
      <div><label class="brand-label">Nome</label><input id="edit-name" class="brand-input" value="${esc(u.full_name)}" /></div>
      <div><label class="brand-label">Departamento</label><input id="edit-dept" class="brand-input" value="${esc(u.department||'')}" /></div>
      <div><label class="brand-label">Papel</label><select id="edit-role" class="brand-input">${Object.entries(ROLE_LABELS).filter(([k])=>k!=='demo').map(([k,v])=>`<option value="${k}" ${k===u.role?'selected':''}>${v}</option>`).join('')}</select></div></div>`,
      footer:`<button onclick="UI.closeModal()" class="brand-btn border border-slate-300 text-slate-600 hover:bg-slate-50">Cancelar</button><button onclick="ModUsuarios.saveRole('${esc(id)}')" class="brand-btn bg-brand-800 text-white hover:bg-brand-700">Salvar</button>`});
  },
  async saveRole(id){
    const name=document.getElementById('edit-name')?.value.trim();
    if(!name){UI.toast('Informe o nome','warning');return;}
    await DB.update('profiles',id,{full_name:name,department:document.getElementById('edit-dept')?.value.trim()||null,role:document.getElementById('edit-role')?.value});
    UI.closeModal();UI.toast('✅ Usuário atualizado','success');await this.render();
  },
  async toggleActive(id,val){
    if(!RBAC.can('canManageUsers')){UI.toast('Sem permissão','error');return;}
    if(id===S.user.id){UI.toast('Você não pode desativar a si mesmo','warning');return;}
    await DB.update('profiles',id,{is_active:val});
    UI.toast(val?'Usuário reativado':'Usuário desativado',val?'success':'info');
    await this.render();
  },
};

// ═══════════ MODULE: CONFIGURAÇÕES ═══════════
const ModConfiguracoes={
  render(){
    UI.render(`<div class="p-6 fade-in max-w-2xl"><h1 class="text-xl font-bold text-slate-800 mb-5">Configurações</h1><div class="space-y-5">
      <div class="bg-white rounded-xl border border-slate-200 p-5"><h3 class="font-bold text-slate-700 text-sm mb-4">🔗 Conexão Supabase</h3><div class="space-y-3"><div><label class="brand-label">URL do Projeto</label><input id="cfg-url" class="brand-input font-mono text-xs" value="${esc(_lsGet('arf_url')||'')}" placeholder="${esc(SUPABASE_URL)}" /></div><div><label class="brand-label">Chave Anon (pública)</label><input id="cfg-key" class="brand-input font-mono text-xs" type="password" value="${esc(_lsGet('arf_key')||'')}" placeholder="eyJ… (vazio = padrão do app)" /></div><div class="flex gap-3 pt-1"><button onclick="ModConfiguracoes.saveConn()" class="brand-btn bg-brand-800 text-white hover:bg-brand-700">Salvar e recarregar</button><button onclick="ModConfiguracoes.clearConn()" class="brand-btn border border-red-300 text-red-600 hover:bg-red-50">Restaurar padrão</button></div><div class="text-xs ${S.demoMode?'text-amber-700 bg-amber-50 border border-amber-200':'text-emerald-700 bg-emerald-50 border border-emerald-200'} rounded-lg p-3">${S.demoMode?'🧪 Modo Demo — dados no localStorage':'✅ Conectado ao Supabase como '+esc(S.user.email)}</div><p class="text-xs text-slate-400">Use apenas a chave <b>anon</b>. Nunca cole a chave <b>service_role</b> aqui.</p></div></div>
      ${S.demoMode?`<div class="bg-white rounded-xl border border-slate-200 p-5"><h3 class="font-bold text-slate-700 text-sm mb-2">🗑️ Resetar Dados de Demo</h3><p class="text-xs text-slate-500 mb-3">Reinicia os dados de demonstração para o estado inicial.</p><button onclick="ModConfiguracoes.resetDemo()" class="brand-btn border border-red-300 text-red-600 hover:bg-red-50">Resetar Dados Demo</button></div>`:''}
      <div class="bg-white rounded-xl border border-slate-200 p-5"><h3 class="font-bold text-slate-700 text-sm mb-2">📱 Instalação PWA</h3><p class="text-xs text-slate-500 mb-3">Instale o ARF no dispositivo para acesso offline.</p><div class="flex gap-3 flex-wrap"><button onclick="App.triggerInstall()" class="brand-btn bg-brand-800 text-white hover:bg-brand-700">📥 Instalar App</button><button onclick="App.showAbout()" class="brand-btn border border-slate-300 text-slate-600 hover:bg-slate-50">ℹ️ Sobre</button></div><p class="text-xs text-slate-400 mt-2">iOS: Compartilhar → "Adicionar à Tela de Início"</p></div>
    </div></div>`);
  },
  saveConn(){
    const url=document.getElementById('cfg-url')?.value.trim();const key=document.getElementById('cfg-key')?.value.trim();
    if(!url&&!key){this.clearConn();return;}
    if(!/^https:\/\/[a-z0-9-]+\.supabase\.co\/?$/i.test(url||'')){UI.toast('URL inválida (https://xxxx.supabase.co)','warning');return;}
    if(!key||key.length<40){UI.toast('Informe a chave anon','warning');return;}
    if(/service_role/.test(atob((key.split('.')[1]||'').replace(/-/g,'+').replace(/_/g,'/')||'e30=')||'')){UI.toast('Essa é a chave service_role. Use a anon.','error');return;}
    try{localStorage.setItem('arf_url',url.replace(/\/$/,''));localStorage.setItem('arf_key',key);}catch{}
    UI.toast('Salvo. Recarregando…','success');setTimeout(()=>location.reload(),600);
  },
  clearConn(){try{localStorage.removeItem('arf_url');localStorage.removeItem('arf_key');}catch{}UI.toast('Padrão restaurado. Recarregando…','info');setTimeout(()=>location.reload(),600);},
  resetDemo(){UI.confirm('Resetar todos os dados de demonstração?',()=>{try{localStorage.removeItem(DB.KEY);}catch{}DB.init();UI.toast('✅ Dados resetados','success');App.navigate('dashboard');App.updateFavoritesList();App.updateBadges();},{danger:true});}
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
    'relatorio-mensal':{label:'Balancete Mensal',perm:'canViewReports',mod:()=>ModRelatorio.render()},
    'relatorio-projetos':{label:'Rel. de Projetos',perm:'canViewReports',mod:()=>ModProjetos.render()},
    'usuarios':{label:'Usuários e Papéis',perm:'canManageUsers',mod:()=>ModUsuarios.render()},
    'configuracoes':{label:'Configurações',mod:()=>ModConfiguracoes.render()},
  },

  async navigate(module){
    const m=this.MODULE_MAP[module];if(!m||!S.user)return;
    if(m.perm&&!RBAC.can(m.perm)){UI.toast('Seu papel não tem acesso a este módulo.','warning');return;}
    S.module=module;UI.loading();
    document.getElementById('breadcrumb-current').textContent=m.label;
    document.querySelectorAll('.nav-item').forEach(el=>el.classList.remove('active'));
    document.querySelectorAll(`[data-module="${module}"]`).forEach(el=>el.classList.add('active'));
    try{await m.mod();}
    catch(e){console.error('[ARF]',e);UI.render(`<div class="p-6"><div class="bg-red-50 border border-red-200 rounded-xl p-5"><p class="font-bold text-red-700">Erro ao carregar módulo</p><pre class="text-xs text-red-500 mt-2 whitespace-pre-wrap">${esc(e.message)}</pre></div></div>`);}
    if(window.innerWidth<768)this.closeSidebar();
    try{history.replaceState({},'',`?m=${module}`);}catch{}
  },

  toggleNavSection(key){
    const sec=document.getElementById(`sec-${key}`);const chv=document.getElementById(`chv-${key}`);
    if(!sec)return;const hidden=sec.style.display==='none';
    sec.style.display=hidden?'':'none';if(chv)chv.style.transform=hidden?'':'rotate(-90deg)';
  },
  openSidebar(){document.getElementById('sidebar')?.classList.add('open');document.getElementById('sidebar-overlay')?.classList.add('open');},
  closeSidebar(){document.getElementById('sidebar')?.classList.remove('open');document.getElementById('sidebar-overlay')?.classList.remove('open');},

  async updateFavoritesList(){
    const el=document.getElementById('favorites-list');if(!el)return;
    try{
      const{data:projects}=await DB.get('projects');
      const favs=projects.filter(p=>p.is_favorite&&p.status==='ativo');
      el.innerHTML=favs.length===0
        ?'<p class="text-xs text-brand-200/50 px-3 py-1.5 italic">Nenhum favorito</p>'
        :favs.map(p=>`<a href="#" onclick="ModProjetos.openDetail('${esc(p.id)}');return false;" class="nav-item flex items-center gap-2 px-3 py-1.5 text-xs text-brand-100 rounded-lg truncate"><span class="text-amber-400">★</span><span class="truncate">${esc(p.name)}</span></a>`).join('');
    }catch(e){console.warn('[ARF] favoritos',e);}
  },

  async updateBadges(){
    try{
      const{data:notes}=await DB.get('notes_fiscal');const{data:pend}=await DB.get('internal_pendencies');
      const nfCt=notes.filter(n=>n.status==='pendente'||n.status==='aprovada').length;
      const pCt=pend.filter(p=>p.status==='aberta'||p.status==='em_analise').length;
      const set=(id,ct)=>{const el=document.getElementById(id);if(!el)return;el.textContent=ct;el.classList.toggle('hidden',ct===0);};
      set('badge-nf',nfCt);set('badge-pend',pCt);
      const nb=document.getElementById('notif-badge');if(nb)nb.classList.toggle('hidden',nfCt+pCt===0);
      this._counts={nfCt,pCt};
    }catch(e){console.warn('[ARF] badges',e);}
  },

  showNotifications(){
    const c=this._counts||{nfCt:0,pCt:0};
    const row=(ico,txt,n,mod)=>`<button onclick="UI.closeModal();App.navigate('${mod}')" class="flex items-center gap-3 w-full text-left px-4 py-3 rounded-lg hover:bg-slate-50 border border-slate-200"><span class="text-xl">${ico}</span><span class="flex-1 text-sm text-slate-700">${txt}</span><span class="text-xs font-bold px-2 py-0.5 rounded-full ${n?'bg-amber-100 text-amber-800':'bg-slate-100 text-slate-400'}">${n}</span></button>`;
    UI.openModal({title:'🔔 Notificações',size:'max-w-sm',body:`<div class="space-y-2">${row('🧾','Notas fiscais aguardando ação',c.nfCt,'notas-fiscais')}${row('💬','Pendências abertas / em análise',c.pCt,'pendencias')}</div>`,footer:`<button onclick="UI.closeModal()" class="brand-btn border border-slate-300 text-slate-600 hover:bg-slate-50">Fechar</button>`});
  },

  // Busca global com debounce (notas, projetos, pendências)
  _searchTimer:null,
  handleSearch(val){
    clearTimeout(this._searchTimer);
    const box=document.getElementById('search-results');if(!box)return;
    const q=(val||'').trim().toLowerCase();
    if(q.length<2){box.classList.add('hidden');box.innerHTML='';return;}
    this._searchTimer=setTimeout(async()=>{
      try{
        const[{data:nf},{data:pj},{data:pd}]=await Promise.all([DB.get('notes_fiscal'),DB.get('projects'),DB.get('internal_pendencies')]);
        const btn=(ico,label,sub,js)=>`<button onclick="${js};App.clearSearch()" class="block w-full text-left px-3 py-2 hover:bg-slate-50 rounded"><span class="text-sm text-slate-700">${ico} ${esc(label)}</span>${sub?`<span class="block text-xs text-slate-400">${esc(sub)}</span>`:''}</button>`;
        const rows=[
          ...nf.filter(n=>`${n.emitter_name||''} ${n.fiscal_note_number||''} ${n.service_description||''} ${n.emitter_cnpj||''}`.toLowerCase().includes(q)).slice(0,5).map(n=>btn('🧾',n.emitter_name,n.fiscal_note_number||'',`ModNotasFiscais.openDetail('${esc(n.id)}')`)),
          ...pj.filter(p=>`${p.name||''} ${p.code||''}`.toLowerCase().includes(q)).slice(0,5).map(p=>btn('📁',p.name,p.code||'',`ModProjetos.openDetail('${esc(p.id)}')`)),
          ...pd.filter(p=>(p.subject||'').toLowerCase().includes(q)).slice(0,5).map(p=>btn('💬',p.subject,'Pendência',`ModPendencias.openThread('${esc(p.id)}')`)),
        ];
        box.innerHTML=rows.join('')||'<p class="text-xs text-slate-400 px-3 py-3">Nada encontrado</p>';
        box.classList.remove('hidden');
      }catch(e){console.warn('[ARF] busca',e);}
    },300);
  },
  clearSearch(){const i=document.getElementById('global-search');if(i)i.value='';const b=document.getElementById('search-results');if(b){b.classList.add('hidden');b.innerHTML='';}},

  showAbout(){
    UI.openModal({title:'Sobre o ARF',size:'max-w-sm',
      body:`<div class="text-center space-y-3">
        <div class="w-14 h-14 bg-brand-800 rounded-xl flex items-center justify-center text-white text-xl font-black mx-auto">ARF</div>
        <p class="font-bold text-slate-800">ARF – Gestão Contábil e Operacional</p>
        <p class="text-sm text-slate-500">v1.1.0 · ITG 2002 Compatível</p>
        <div class="bg-slate-50 rounded-xl p-4 text-left text-xs text-slate-600 space-y-1.5">
          <p>⚖️ Motor Fiscal (MEI, Simples, LP, LR, PF)</p><p>🏦 Pix EMV com TxId e QR Code</p><p>💬 Comunicação Interna Estruturada</p><p>🔐 RBAC — 5 papéis + RLS no Supabase</p><p>📱 PWA Instalável — offline-capable</p>
        </div>
        <p class="text-xs text-slate-400">${S.demoMode?'Modo Demo · dados em localStorage':'Conectado ao Supabase'}</p></div>`,
      footer:`<button onclick="UI.closeModal()" class="brand-btn bg-brand-800 text-white hover:bg-brand-700 w-full justify-center">Fechar</button>`});
  },

  triggerInstall(){
    if(S.installPrompt){
      S.installPrompt.prompt();
      S.installPrompt.userChoice.then(r=>{
        if(r.outcome==='accepted')UI.toast('✅ ARF instalado!','success');
        S.installPrompt=null;document.getElementById('install-banner')?.classList.add('hidden');
      });
    }else{UI.toast('Use o menu do navegador para instalar (ou já está instalado).','info');}
  },

  initPWA(){
    if('serviceWorker' in navigator){
      navigator.serviceWorker.register('./sw.js').then(r=>console.log('[SW] Registrado:',r.scope)).catch(e=>console.warn('[SW] Falha:',e));
    }
    window.addEventListener('beforeinstallprompt',e=>{e.preventDefault();S.installPrompt=e;document.getElementById('install-banner')?.classList.remove('hidden');});
    window.addEventListener('appinstalled',()=>{document.getElementById('install-banner')?.classList.add('hidden');S.installPrompt=null;});
    const isIOS=/iphone|ipad|ipod/i.test(navigator.userAgent);
    const isStandalone=window.matchMedia('(display-mode: standalone)').matches;
    let dismissed=false;try{dismissed=!!sessionStorage.getItem('ios_dismissed');}catch{}
    if(isIOS&&!isStandalone&&!dismissed){
      document.getElementById('ios-install-banner')?.classList.remove('hidden');
      document.getElementById('ios-banner-close')?.addEventListener('click',()=>{
        document.getElementById('ios-install-banner')?.classList.add('hidden');
        try{sessionStorage.setItem('ios_dismissed','1');}catch{}
      });
    }
    document.getElementById('install-btn')?.addEventListener('click',()=>this.triggerInstall());
    document.getElementById('install-dismiss')?.addEventListener('click',()=>{document.getElementById('install-banner')?.classList.add('hidden');S.installPrompt=null;});
    navigator.serviceWorker?.addEventListener('message',e=>{if(e.data?.type==='SYNC_COMPLETE')UI.toast('🔄 Dados sincronizados','success');});
    // Fechar busca ao clicar fora / Esc fecha modal
    document.addEventListener('click',e=>{if(!e.target.closest('#global-search')&&!e.target.closest('#search-results'))document.getElementById('search-results')?.classList.add('hidden');});
    document.addEventListener('keydown',e=>{if(e.key==='Escape'){UI.closeModal();this.clearSearch();}});
  },

  initPeriod(){
    const now=new Date();
    const def=`${now.getFullYear()}-${String(now.getMonth()+1).padStart(2,'0')}`;
    S.period=_lsGet('arf_period')||def;
    const sel=document.getElementById('period-selector');
    if(sel){
      sel.value=S.period;
      sel.addEventListener('change',()=>{
        if(!sel.value)return;
        S.period=sel.value;try{localStorage.setItem('arf_period',S.period);}catch{}
        document.getElementById('topbar-period').textContent=Fmt.period(S.period);
        if(S.user)this.navigate(S.module);
      });
    }
    document.getElementById('topbar-period').textContent=Fmt.period(S.period);
  },

  async init(){
    console.log('[ARF] Inicializando v1.1.0…');
    this.initPWA();
    this.initPeriod();
    const session=await Auth.checkSession();
    if(session?.user)await Auth._onLoginSuccess(session.user);   // restaura sessão após F5
  },

  async boot(){
    document.getElementById('user-name').textContent=S.user.full_name;
    document.getElementById('user-role').textContent=ROLE_LABELS[S.user.role]||S.user.role;
    document.getElementById('user-avatar').textContent=Fmt.initials(S.user.full_name);
    document.querySelectorAll('[data-perm]').forEach(el=>el.classList.toggle('hidden',!RBAC.can(el.dataset.perm)));
    const params=new URLSearchParams(location.search);
    const m=params.get('m');const wantsNew=params.get('action')==='new';
    await this.updateFavoritesList();
    await this.updateBadges();
    const target=this.MODULE_MAP[m]&&(!this.MODULE_MAP[m].perm||RBAC.can(this.MODULE_MAP[m].perm))?m:'dashboard';
    await this.navigate(target);
    if(wantsNew&&RBAC.can('canCreateNote'))ModNotasFiscais.openNew();
  }
};

// ═══════════ BOOTSTRAP ═══════════
document.addEventListener('DOMContentLoaded',()=>App.init());
