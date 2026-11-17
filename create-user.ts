// Deploy: supabase functions deploy create-user --project-ref wssgkqonuxgupxuyxtyv --no-verify-jwt
// Cria usuário no servidor (service_role). Só administradores ativos podem chamar.
// A autenticação é feita AQUI (getUser + checagem de papel), por isso o gateway roda sem verify_jwt:
// assim o preflight OPTIONS do navegador (que não envia Authorization) sempre recebe 2xx.
// v2 (auditoria 2026-11): registra em audit_log quem criou o usuário; CORS restrito às origens do app.
import { createClient } from 'jsr:@supabase/supabase-js@2';

const ROLES = ['admin', 'tesoureiro', 'contador', 'dp', 'caixa'];
// Origens autorizadas (a função exige Bearer token, então o risco de '*' é baixo, mas restringir é grátis)
const ALLOWED = ['https://lojacont.vercel.app', 'http://localhost:3000', 'http://localhost:5173', 'http://127.0.0.1:5500'];
const corsFor = (req: Request) => {
  const o = req.headers.get('origin') ?? '';
  return {
    'Access-Control-Allow-Origin': ALLOWED.includes(o) ? o : ALLOWED[0],
    'Vary': 'Origin',
    'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type',
    'Access-Control-Allow-Methods': 'POST, OPTIONS',
    'Access-Control-Max-Age': '86400',
  };
};

Deno.serve(async (req) => {
  const cors = corsFor(req);
  const json = (body: unknown, status = 200) =>
    new Response(JSON.stringify(body), { status, headers: { ...cors, 'content-type': 'application/json' } });

  if (req.method === 'OPTIONS') return new Response(null, { status: 204, headers: cors });
  if (req.method !== 'POST') return json({ error: 'Método não permitido' }, 405);

  try {
    const url = Deno.env.get('SUPABASE_URL')!;
    const auth = req.headers.get('Authorization');
    if (!auth) return json({ error: 'Não autenticado' }, 401);

    const caller = createClient(url, Deno.env.get('SUPABASE_ANON_KEY')!, { global: { headers: { Authorization: auth } } });
    const { data: u, error: ue } = await caller.auth.getUser();
    if (ue || !u?.user) return json({ error: 'Sessão inválida' }, 401);

    const { data: me } = await caller.from('profiles').select('role,is_active').eq('id', u.user.id).maybeSingle();
    if (me?.role !== 'admin' || me?.is_active === false) return json({ error: 'Apenas administradores podem criar usuários.' }, 403);

    let b: any;
    try { b = await req.json(); } catch { return json({ error: 'JSON inválido' }, 400); }
    const email = String(b.email ?? '').trim().toLowerCase();
    const password = String(b.password ?? '');
    const full_name = String(b.full_name ?? '').trim();
    const role = String(b.role ?? 'caixa');
    const department = b.department ? String(b.department).trim() : null;

    if (!/^[^@\s]+@[^@\s]+\.[^@\s]+$/.test(email)) return json({ error: 'E-mail inválido.' }, 400);
    if (password.length < 8) return json({ error: 'A senha deve ter ao menos 8 caracteres.' }, 400);
    if (!full_name) return json({ error: 'Nome obrigatório.' }, 400);
    if (!ROLES.includes(role)) return json({ error: 'Papel inválido.' }, 400);

    const admin = createClient(url, Deno.env.get('SUPABASE_SERVICE_ROLE_KEY')!);
    const { data, error } = await admin.auth.admin.createUser({ email, password, email_confirm: true, user_metadata: { full_name } });
    if (error) return json({ error: error.message }, 400);

    // o trigger handle_new_user cria o perfil INATIVO ('caixa'); aqui definimos papel/depto e ativamos
    const { error: pe } = await admin.from('profiles').upsert({ id: data.user.id, full_name, email, role, department, is_active: true });
    if (pe) { await admin.auth.admin.deleteUser(data.user.id); return json({ error: pe.message }, 400); }

    // trilha de auditoria: quem criou, quem foi criado e com qual papel (sem senha)
    const { error: ae } = await admin.from('audit_log').insert({
      actor: u.user.id, table_name: 'auth.users', row_id: data.user.id, action: 'CREATE_USER',
      new_data: { email, role, department },
    });
    if (ae) console.error('[create-user] audit_log:', ae.message);   // não derruba a criação

    return json({ id: data.user.id });
  } catch (e) {
    console.error('[create-user]', e);
    return json({ error: 'Erro interno: ' + (e as Error).message }, 500);
  }
});
