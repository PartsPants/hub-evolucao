/* =====================================================================
   Hub de Evolução · núcleo do site
   Login, banco de dados (Supabase ou demonstração), sincronização entre
   aparelhos com fila offline, chamadas às conexões e instalação (PWA).
   ===================================================================== */
(() => {
  'use strict';
  const CFG = window.HUB_CONFIG || {};
  const DEMO = !CFG.supabaseUrl || !CFG.supabaseKey;
  const $ = id => document.getElementById(id);
  const esc = s => String(s ?? '').replace(/[&<>"']/g, c => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' })[c]);
  const lsGet = k => { try { const v = localStorage.getItem(k); return v ? JSON.parse(v) : null; } catch (_) { return null; } };
  const lsSet = (k, v) => { try { localStorage.setItem(k, JSON.stringify(v)); return true; } catch (_) { return false; } };
  const lsDel = k => { try { localStorage.removeItem(k); } catch (_) { } };
  /* 8 cores testadas para daltonismo e para o tema claro/escuro (a versão escura fica no app.js) */
  const CORES = ['#2a78d6', '#eb6834', '#1baf7a', '#eda100', '#e87ba4', '#008300', '#6250d6', '#e34948'];

  /* ---------- guardado no aparelho (IndexedDB, com localStorage de reserva) ---------- */
  const kv = (() => {
    let dbp = null;
    const abrir = () => dbp || (dbp = new Promise((ok, no) => {
      try {
        const r = indexedDB.open('hub-evolucao', 1);
        r.onupgradeneeded = () => r.result.createObjectStore('kv');
        r.onsuccess = () => ok(r.result); r.onerror = () => no(r.error);
      } catch (e) { no(e); }
    }));
    const tx = async (modo, fn) => {
      const db = await abrir();
      return new Promise((ok, no) => {
        const t = db.transaction('kv', modo), req = fn(t.objectStore('kv'));
        t.oncomplete = () => ok(req ? req.result : undefined); t.onerror = () => no(t.error); t.onabort = () => no(t.error);
      });
    };
    return {
      get: k => tx('readonly', st => st.get(k)).catch(() => lsGet('kv:' + k)),
      set: (k, v) => tx('readwrite', st => st.put(v, k)).catch(() => lsSet('kv:' + k, v)),
      del: k => tx('readwrite', st => st.delete(k)).catch(() => lsDel('kv:' + k)),
    };
  })();

  function setOffline(v) { document.body.classList.toggle('offline', !!v); }

  /* =====================================================================
     STORE: mesma interface que o Hub original usava (coleção/doc/onSnapshot),
     com cópia no aparelho e fila de gravações que espera a internet voltar.
     ===================================================================== */
  function criarStore(backend, uid) {
    const chave = 'cache:' + uid;
    const docs = new Map(), colL = new Map(), docL = new Map(), pend = new Map(), espera = new Map();
    let fila = [], seq = 1, lastSeen = null, pronto = false, flushing = false, timerFlush = null, timerCache = null, tent = 0, ativo = true;
    const kk = (c, i) => c + '\u0001' + i;
    const colMap = c => { let m = docs.get(c); if (!m) docs.set(c, m = new Map()); return m; };
    const aplicar = (col, id, data) => { const m = colMap(col); if (data == null) m.delete(id); else m.set(id, data); };
    const snapCol = col => ({ docs: [...colMap(col)].map(([id, data]) => ({ id, exists: true, data: () => data, metadata: { hasPendingWrites: pend.has(kk(col, id)) } })) });
    const snapDoc = (col, id) => { const d = colMap(col).get(id); return { id, exists: d !== undefined, data: () => d }; };
    const sujos = new Set(); let emitP = null;
    function emitir(col) {
      if (!pronto) return;
      sujos.add(col);
      if (emitP) return;
      emitP = Promise.resolve().then(() => {
        emitP = null;
        const cs = [...sujos]; sujos.clear();
        for (const c of cs) {
          for (const cb of colL.get(c) || []) { try { cb(snapCol(c)); } catch (e) { console.error(e); } }
          for (const [k, set] of docL) if (k.startsWith(c + '/')) for (const cb of set) { try { cb(snapDoc(c, k.slice(c.length + 1))); } catch (e) { console.error(e); } }
        }
      });
    }
    function emitirTodos() { const cs = new Set([...colL.keys(), ...[...docL.keys()].map(k => k.split('/')[0])]); cs.forEach(emitir); }

    async function salvarCache() {
      const o = {};
      for (const [c, m] of docs) { o[c] = {}; for (const [id, d] of m) o[c][id] = d; }
      await kv.set(chave, { docs: o, lastSeen, t: Date.now() });
    }
    const salvarCacheLogo = () => { clearTimeout(timerCache); timerCache = setTimeout(salvarCache, 700); };
    let timerFila = null;
    const gravarFila = () => { clearTimeout(timerFila); timerFila = null; return kv.set(chave + ':fila', fila.map(({ col, id, data }) => ({ col, id, data }))); };
    const salvarFila = () => { if (!timerFila) timerFila = setTimeout(gravarFila, 150); };

    function write(col, id, data, op) {
      if (!ativo) return Promise.reject({ code: 'not_granted' });
      let final;
      if (op === 'delete') final = null;
      else if (op === 'update') { final = { ...(colMap(col).get(id) || {}), ...data }; }
      else final = data;
      try { final = final == null ? null : JSON.parse(JSON.stringify(final)); } catch (_) { return Promise.reject({ code: 'invalid_argument' }); }
      aplicar(col, id, final);
      const k = kk(col, id); pend.set(k, (pend.get(k) || 0) + 1);
      const s = seq++;
      fila.push({ s, col, id, data: final });
      salvarFila(); salvarCacheLogo(); emitir(col);
      const p = new Promise((ok, no) => espera.set(s, { ok, no }));
      agendar(0);
      return p;
    }
    function agendar(ms) { clearTimeout(timerFlush); timerFlush = setTimeout(flush, ms); }
    function resolver(lote, erro) {
      const cols = new Set();
      for (const o of lote) {
        const k = kk(o.col, o.id), n = (pend.get(k) || 1) - 1;
        if (n <= 0) pend.delete(k); else pend.set(k, n);
        cols.add(o.col);
        const w = espera.get(o.s); if (w) { espera.delete(o.s); erro ? w.no({ code: erro.code }) : w.ok(); }
      }
      cols.forEach(emitir); salvarCacheLogo();
    }
    async function flush() {
      if (flushing || !fila.length || !ativo) return;
      flushing = true;
      try {
        while (fila.length && ativo) {
          const lote = fila.slice(0, 200);
          const ult = new Map(); for (const o of lote) ult.set(kk(o.col, o.id), o);
          const rows = [...ult.values()].map(o => ({ col: o.col, id: o.id, data: o.data || {}, deleted: o.data == null }));
          let r;
          try { r = await backend.gravar(uid, rows); } catch (e) { r = { erro: { code: 'unavailable', permanente: false } }; }
          if (r && r.erro) {
            if (!r.erro.permanente) {
              setOffline(r.erro.code === 'unavailable');
              tent++; agendar(Math.min(60000, 1500 * Math.pow(2, Math.min(tent, 6))));
              break;
            }
            fila.splice(0, lote.length); resolver(lote, r.erro); salvarFila();
            sincronizar(true);
            continue;
          }
          fila.splice(0, lote.length); tent = 0; setOffline(false); resolver(lote, null); salvarFila();
        }
      } finally { flushing = false; }
    }
    function aplicarRemoto(rows, completo) {
      const cols = new Set();
      if (completo) {
        const vistos = new Set(rows.filter(r => !r.deleted).map(r => kk(r.col, r.id)));
        for (const [c, m] of docs) for (const id of [...m.keys()]) {
          const k = kk(c, id);
          if (!vistos.has(k) && !pend.has(k)) { m.delete(id); cols.add(c); }
        }
      }
      for (const r of rows) {
        if (r.updated_at && (!lastSeen || r.updated_at > lastSeen)) lastSeen = r.updated_at;
        if (pend.has(kk(r.col, r.id))) continue;
        const atual = colMap(r.col).get(r.id), novo = r.deleted ? null : r.data;
        if (!completo || JSON.stringify(atual ?? null) !== JSON.stringify(novo)) { aplicar(r.col, r.id, novo); cols.add(r.col); }
      }
      cols.forEach(emitir); salvarCacheLogo();
    }
    const menos = (iso, min) => { const t = Date.parse(iso); return Number.isFinite(t) ? new Date(t - min * 60000).toISOString() : null; };
    let sincP = null;
    function sincronizar(completo) {
      if (sincP) return sincP;
      sincP = (async () => {
        const desde = !completo && lastSeen ? menos(lastSeen, 3) : null;
        let r;
        try { r = desde ? await backend.carregarDesde(uid, desde) : await backend.carregar(uid); } catch (_) { r = { erro: { code: 'unavailable' } }; }
        if (r.erro) { setOffline(r.erro.code === 'unavailable'); if (!pronto) { pronto = true; emitirTodos(); } return false; }
        setOffline(false);
        aplicarRemoto(r.rows, !desde);
        if (!pronto) { pronto = true; emitirTodos(); }
        agendar(0);
        return true;
      })().finally(() => { sincP = null; });
      return sincP;
    }
    async function iniciar() {
      const c = await kv.get(chave);
      if (c && c.docs) {
        for (const [col, obj] of Object.entries(c.docs)) for (const [id, d] of Object.entries(obj)) aplicar(col, id, d);
        lastSeen = c.lastSeen || null;
        pronto = true;
      }
      const f = await kv.get(chave + ':fila');
      if (Array.isArray(f)) for (const o of f) {
        if (!o || typeof o.col !== 'string' || typeof o.id !== 'string') continue;
        aplicar(o.col, o.id, o.data ?? null);
        const k = kk(o.col, o.id); pend.set(k, (pend.get(k) || 0) + 1);
        fila.push({ s: seq++, col: o.col, id: o.id, data: o.data ?? null });
      }
      return pronto;
    }
    const api = {
      collection: col => ({
        doc: id => ({ set: d => write(col, id, d, 'set'), update: d => write(col, id, d, 'update'), delete: () => write(col, id, null, 'delete') }),
        onSnapshot: cb => { if (!colL.has(col)) colL.set(col, new Set()); colL.get(col).add(cb); emitir(col); return () => colL.get(col).delete(cb); },
      }),
      doc: path => {
        const i = path.indexOf('/'), col = path.slice(0, i), id = path.slice(i + 1);
        return { onSnapshot: cb => { const k = col + '/' + id; if (!docL.has(k)) docL.set(k, new Set()); docL.get(k).add(cb); emitir(col); return () => docL.get(k).delete(cb); } };
      },
      iniciar, sincronizar, flush: () => agendar(0), emitirTodos,
      aplicarRemotoUm: row => aplicarRemoto([row], false),
      persistir: () => { gravarFila(); clearTimeout(timerCache); salvarCache(); },
      pendentes: () => fila.length,
      parar: () => { ativo = false; clearTimeout(timerFlush); },
    };
    return api;
  }

  /* =====================================================================
     BACKEND SUPABASE
     ===================================================================== */
  function criarSupabase() {
    if (!window.supabase || !window.supabase.createClient) return null;
    const url = String(CFG.supabaseUrl).replace(/\/+$/, '');
    const sb = window.supabase.createClient(url, CFG.supabaseKey, {
      auth: { persistSession: true, autoRefreshToken: true, detectSessionInUrl: false, storageKey: 'hub-evolucao-auth' },
    });
    const classificar = (error, status) => {
      const c = String((error && error.code) || ''), msg = String((error && error.message) || '');
      if (c === '42501' || status === 403) return { code: 'not_granted', permanente: true };
      if (['23514', '22P02', '23502', '22023'].includes(c)) return { code: 'invalid_argument', permanente: true };
      if (c === '53100' || c === '54000') return { code: 'quota_exceeded', permanente: true };
      if (status === 401 || c === 'PGRST301' || c === 'PGRST303' || /jwt/i.test(msg)) { sb.auth.refreshSession().catch(() => { }); return { code: 'session_expired', permanente: false }; }
      return { code: 'unavailable', permanente: false };
    };
    async function todas(q) {
      const out = [];
      for (let de = 0; de < 200000; de += 1000) {
        let res;
        try { res = await q().range(de, de + 999); } catch (_) { return { erro: { code: 'unavailable' } }; }
        if (res.error) return { erro: classificar(res.error, res.status) };
        out.push(...res.data);
        if (res.data.length < 1000) break;
      }
      return { rows: out };
    }
    const traduz = e => {
      const m = String((e && e.message) || e || '');
      if (/invalid login/i.test(m)) return { message: 'E-mail ou senha errados.' };
      if (/already registered|already exists/i.test(m)) return { message: 'Já existe uma conta com esse e-mail. Use “Entrar”.' };
      if (/at least \d+ char|password should/i.test(m)) return { message: 'A senha precisa ter pelo menos 6 caracteres.' };
      if (/not confirmed/i.test(m)) return { message: 'Este e-mail ainda não foi confirmado. Peça ao dono do site para desligar “Confirm email” no Supabase (está no guia).' };
      if (/signups? (not allowed|disabled)/i.test(m)) return { message: 'Os cadastros estão fechados neste site. Fale com quem criou o grupo.' };
      if (/rate limit|too many/i.test(m)) return { message: 'Muitas tentativas seguidas. Espere um minuto e tente de novo.' };
      if (/failed to fetch|network/i.test(m)) return { message: 'Sem conexão com o servidor. Confira a internet.' };
      if (/valid email|invalid.*email/i.test(m)) return { message: 'Esse e-mail não parece válido.' };
      return { message: m || 'Não deu certo. Tente de novo.' };
    };
    const COLS = 'col,id,data,deleted,updated_at';
    return {
      tipo: 'supabase', sb,
      async gravar(uid, rows) {
        let res;
        try { res = await sb.from('docs').upsert(rows.map(r => ({ user_id: uid, col: r.col, id: r.id, data: r.data, deleted: r.deleted })), { onConflict: 'user_id,col,id' }); }
        catch (_) { return { erro: { code: 'unavailable', permanente: false } }; }
        return res.error ? { erro: classificar(res.error, res.status) } : { ok: true };
      },
      carregar: uid => todas(() => sb.from('docs').select(COLS).eq('user_id', uid).order('col').order('id')),
      carregarDesde: (uid, iso) => todas(() => sb.from('docs').select(COLS).eq('user_id', uid).gt('updated_at', iso).order('updated_at').order('col').order('id')),
      assinar(uid, onRow) {
        const ch = sb.channel('docs-' + uid)
          .on('postgres_changes', { event: '*', schema: 'public', table: 'docs', filter: 'user_id=eq.' + uid }, p => { if (p.new && p.new.col) onRow(p.new); })
          .subscribe();
        return () => { try { sb.removeChannel(ch); } catch (_) { } };
      },
      async carregarAmigo(uid) { const r = await todas(() => sb.from('docs').select(COLS).eq('user_id', uid).eq('deleted', false).order('col').order('id')); if (r.erro) throw r.erro; return r.rows; },
      async membros() { const { data, error } = await sb.from('membros').select('user_id,nome,cor,compartilha,criado_em').order('criado_em'); if (error) throw error; return data; },
      async metasMembros() { const { data, error } = await sb.from('docs').select('user_id,data').eq('col', 'config').eq('id', 'metas').eq('deleted', false); if (error) throw error; return data; },
      async ranking(inicio, fim) { const { data, error } = await sb.rpc('ranking_diario', { p_inicio: inicio, p_fim: fim }); if (error) throw error; return data || []; },
      async func(acao, body = {}, signal) {
        const { data } = await sb.auth.getSession();
        const s = data && data.session;
        if (!s) throw { code: 'session_expired', message: 'Sua sessão expirou. Entre de novo.' };
        let r;
        try {
          r = await fetch(url + '/functions/v1/integracoes', {
            method: 'POST', signal,
            headers: { 'Content-Type': 'application/json', apikey: CFG.supabaseKey, Authorization: 'Bearer ' + s.access_token },
            body: JSON.stringify({ ...body, acao }),
          });
        } catch (e) {
          if (e && e.name === 'AbortError') throw { code: 'cancelled' };
          throw { code: 'server_unavailable', message: 'Não consegui falar com o servidor. Confira a internet (ou se a função “integracoes” foi publicada).' };
        }
        const d = await r.json().catch(() => ({}));
        if (r.status === 404 && !d.code) throw { code: 'sem_funcao', message: 'A função “integracoes” ainda não foi publicada no Supabase. O guia explica como.' };
        if (!r.ok) throw { code: d.code || 'upstream_error', message: d.message || ('Erro ' + r.status) };
        return d;
      },
      async sessao() {
        try { const { data } = await sb.auth.getSession(); const s = data && data.session; return s ? { uid: s.user.id, email: s.user.email } : null; }
        catch (_) { return null; }
      },
      async entrar(email, senha) { const { data, error } = await sb.auth.signInWithPassword({ email, password: senha }); if (error) throw traduz(error); return { uid: data.user.id, email: data.user.email }; },
      async cadastrar(email, senha) {
        const { data, error } = await sb.auth.signUp({ email, password: senha });
        if (error) throw traduz(error);
        if (!data.session) throw { message: 'Conta criada, mas o Supabase pediu confirmação por e-mail. Peça ao dono do site para desligar “Confirm email” (Authentication → Sign In / Providers → Email) e tente entrar.' };
        return { uid: data.user.id, email: data.user.email };
      },
      async sair() { try { await sb.auth.signOut(); } catch (_) { } },
      async meuMembro(uid) {
        const { data, error, status } = await sb.from('membros').select('user_id,nome,cor,compartilha').eq('user_id', uid).maybeSingle();
        if (error) throw { code: classificar(error, status).code, message: error.message };
        return data;
      },
      async entrarNoGrupo(p) {
        const { error } = await sb.rpc('entrar_no_grupo', { p_codigo: p.codigo, p_nome: p.nome, p_cor: p.cor, p_compartilha: p.compartilha });
        if (error) throw { message: /convite/i.test(error.message) ? 'Código de convite errado.' : error.message };
      },
      async atualizarMembro(uid, patch) { const { error } = await sb.from('membros').update(patch).eq('user_id', uid); if (error) throw traduz(error); },
    };
  }

  /* =====================================================================
     BACKEND DE DEMONSTRAÇÃO: tudo neste navegador, com três amigos de exemplo
     ===================================================================== */
  function criarDemo() {
    let banco = null, timer = null;
    const salvar = () => { clearTimeout(timer); timer = setTimeout(() => kv.set('demo:banco', banco), 300); };
    const atraso = (v, ms = 60) => new Promise(ok => setTimeout(() => ok(v), ms));
    async function abrir() { if (!banco) banco = (await kv.get('demo:banco')) || { membros: {}, dados: {}, t: Date.now() }; return banco; }
    const linhas = uid => {
      const out = [], cols = (banco.dados[uid] || {});
      for (const [col, m] of Object.entries(cols)) for (const [id, data] of Object.entries(m)) out.push({ col, id, data, deleted: false, updated_at: new Date(banco.t).toISOString() });
      return out;
    };
    function podeVer(eu, dono, col, id, data) {
      if (dono === eu) return true;
      const m = banco.membros[dono] || {}, c = m.compartilha || {};
      if (['treinos', 'fichas', 'testes'].includes(col)) return true;
      if (col === 'corridas') return (data && data.fonte) !== 'strava';
      if (['refeicoes', 'agua', 'alimentos'].includes(col)) return !!c.alimentacao;
      if (['pesos', 'medidas'].includes(col)) return !!c.corpo;
      if (col === 'config') return id === 'metas' || id === 'sync' || (id === 'perfil' && !!c.corpo);
      return false;
    }
    let eu = null;
    return {
      tipo: 'demo',
      async gravar(uid, rows) {
        await abrir();
        const d = banco.dados[uid] = banco.dados[uid] || {};
        for (const r of rows) { const m = d[r.col] = d[r.col] || {}; if (r.deleted) delete m[r.id]; else m[r.id] = r.data; }
        banco.t = Date.now(); salvar();
        return atraso({ ok: true }, 30);
      },
      async carregar(uid) { await abrir(); return atraso({ rows: linhas(uid) }); },
      async carregarDesde(uid) { await abrir(); return atraso({ rows: linhas(uid) }); },
      assinar() { return () => { }; },
      async carregarAmigo(uid) { await abrir(); return atraso(linhas(uid).filter(r => podeVer(eu, uid, r.col, r.id, r.data)), 150); },
      async membros() { await abrir(); return atraso(Object.entries(banco.membros).map(([user_id, m]) => ({ user_id, ...m }))); },
      async metasMembros() { await abrir(); return atraso(Object.keys(banco.membros).map(u => ({ user_id: u, data: ((banco.dados[u] || {}).config || {}).metas || null })).filter(x => x.data)); },
      async ranking(inicio, fim) { await abrir(); return atraso(agregarDiario(banco, inicio, fim, eu), 120); },
      async func(acao) {
        if (acao === 'status') return { demo: true, notion: { configurado: false }, strava: { conectado: false, client_id: '', app_proprio: false, app_grupo: false }, ia: { disponivel: false, provedor: null } };
        throw { code: 'demo', message: 'No modo demonstração as conexões ficam desligadas. Depois de ligar o Supabase (veja o guia), elas funcionam.' };
      },
      async sessao() { await abrir(); const s = lsGet('hub-demo-sessao'); if (s) eu = s.uid; return s; },
      async entrarDemo(nome, cor) {
        await abrir();
        const uid = 'demo-voce';
        banco.membros[uid] = { nome, cor, compartilha: { alimentacao: true, corpo: false }, criado_em: new Date().toISOString() };
        semear(banco);
        salvar(); lsSet('hub-demo-sessao', { uid, email: 'demonstracao@local' }); eu = uid;
        return { uid, email: 'demonstracao@local' };
      },
      async sair() { lsDel('hub-demo-sessao'); eu = null; },
      async meuMembro(uid) { await abrir(); const m = banco.membros[uid]; return m ? { user_id: uid, ...m } : null; },
      async atualizarMembro(uid, patch) { await abrir(); Object.assign(banco.membros[uid], patch); salvar(); },
      async apagarTudo() { banco = { membros: {}, dados: {}, t: Date.now() }; await kv.set('demo:banco', banco); },
    };
  }

  /* resumo diário igual ao ranking_diario do banco (usado na demonstração) */
  function agregarDiario(banco, inicio, fim, eu) {
    const out = [], num = v => typeof v === 'number' && Number.isFinite(v) ? v : null;
    for (const [uid, m] of Object.entries(banco.membros)) {
      const cols = banco.dados[uid] || {}, metas = ((cols.config || {}).metas) || {};
      const mk = num(metas.kcal) ?? 2500, mp = num(metas.prot) ?? 140, ma = num(metas.agua_ml) ?? 3000;
      const sa = !!(m.compartilha || {}).alimentacao || uid === eu, sc = !!(m.compartilha || {}).corpo || uid === eu;
      const dias = new Map(), noP = d => d && d >= inicio && d <= fim;
      const g = d => { let x = dias.get(d); if (!x) dias.set(d, x = { gr: new Set(), nc: 0, km: 0, nr: 0, kcal: 0, prot: 0, ml: null, peso: null }); return x; };
      const tr = cols.treinos || {};
      const enviados = Object.values(tr).filter(t => t.fonte !== 'notion' && t.notion_url).map(t => String(t.notion_url).replace(/-/g, ''));
      for (const [id, t] of Object.entries(tr)) {
        const d = String(t.data || '').slice(0, 10); if (!noP(d)) continue;
        if (t.fonte === 'notion' && id.length > 2 && enviados.some(u => u.endsWith(id.slice(2)))) continue;
        g(d).gr.add(t.grupo || 'Outro');
      }
      for (const r of Object.values(cols.corridas || {})) { const d = String(r.data || '').slice(0, 10); if (!noP(d) || r.fonte === 'strava' || !(r.km > 0)) continue; const x = g(d); x.nc++; x.km += r.km; }
      for (const r of Object.values(cols.refeicoes || {})) { const d = String(r.data || '').slice(0, 10); if (!noP(d)) continue; const x = g(d); x.nr++; x.kcal += num(r.kcal) || 0; x.prot += num(r.prot) || 0; }
      for (const [id, a] of Object.entries(cols.agua || {})) { if (!noP(id) || !(a.ml > 0)) continue; g(id).ml = a.ml; }
      for (const p of Object.values(cols.pesos || {})) { const d = String(p.data || '').slice(0, 10); if (!noP(d) || !(p.peso > 0)) continue; const x = g(d); x.peso = Math.max(x.peso ?? 0, p.peso); }
      for (const [d, x] of dias) out.push({
        uid, dia: d, n_treinos: x.gr.size, n_corridas: x.nc, km: x.km,
        kcal: sa && x.nr ? x.kcal : null, prot: sa && x.nr ? x.prot : null, agua_ml: sa ? x.ml : null, n_refeicoes: sa ? x.nr : null, peso: sc ? x.peso : null,
        kcal_ok: x.nr > 0 && Math.abs(x.kcal - mk) <= mk * 0.1, prot_ok: x.nr > 0 && x.prot >= mp * 0.95, agua_ok: (x.ml || 0) >= ma,
      });
    }
    return out.sort((a, b) => a.uid.localeCompare(b.uid) || a.dia.localeCompare(b.dia));
  }

  /* amigos de exemplo com ~4 meses de histórico */
  function semear(banco) {
    if (banco.semeado) return;
    let s = 20261112;
    const rnd = () => { s |= 0; s = s + 0x6D2B79F5 | 0; let t = Math.imul(s ^ s >>> 15, 1 | s); t = t + Math.imul(t ^ t >>> 7, 61 | t) ^ t; return ((t ^ t >>> 14) >>> 0) / 4294967296; };
    const pad = n => String(n).padStart(2, '0');
    const iso = d => `${d.getFullYear()}-${pad(d.getMonth() + 1)}-${pad(d.getDate())}`;
    const EX = {
      'Peito': [['Supino reto', 40], ['Supino inclinado com halteres', 18], ['Crucifixo', 14], ['Paralelas', 0]],
      'Costas': [['Puxada frente', 50], ['Remada curvada', 40], ['Remada baixa', 45], ['Pulldown', 30]],
      'Perna': [['Agachamento livre', 60], ['Leg press', 160], ['Cadeira extensora', 45], ['Stiff', 40]],
      'Ombro': [['Desenvolvimento', 16], ['Elevação lateral', 8], ['Face pull', 20]],
      'Braço': [['Rosca direta', 14], ['Tríceps corda', 25], ['Rosca martelo', 12], ['Tríceps francês', 12]],
    };
    const GR = Object.keys(EX);
    const amigos = [
      ['demo-ana', 'Ana', '#e34948', { alimentacao: true, corpo: true }, { pTreino: .62, pCorrida: .22, pDieta: .9, kcal: 2100, prot: 120, peso: 63, dPeso: -0.025, treinos: 5, km: 12 }],
      ['demo-bruno', 'Bruno', '#1baf7a', { alimentacao: false, corpo: false }, { pTreino: .48, pCorrida: .38, pDieta: .6, kcal: 2800, prot: 160, peso: 82, dPeso: 0.01, treinos: 4, km: 20 }],
      ['demo-carla', 'Carla', '#6250d6', { alimentacao: true, corpo: false }, { pTreino: .34, pCorrida: .5, pDieta: .75, kcal: 1900, prot: 110, peso: 58, dPeso: -0.01, treinos: 3, km: 25 }],
    ];
    const hoje = new Date(); hoje.setHours(12, 0, 0, 0);
    for (const [uid, nome, cor, compartilha, p] of amigos) {
      banco.membros[uid] = { nome, cor, compartilha, criado_em: new Date(Date.now() - 120 * 864e5).toISOString() };
      const d = banco.dados[uid] = { treinos: {}, fichas: {}, corridas: {}, refeicoes: {}, agua: {}, pesos: {}, testes: {}, config: {} };
      d.config.metas = { kcal: p.kcal, prot: p.prot, carb: Math.round(p.kcal * .5 / 4), gord: Math.round(p.kcal * .25 / 9), agua_ml: 3000, treinos_semana: p.treinos, km_semana: p.km };
      let o = 0;
      for (const g of GR) EX[g].forEach(([n, c], i) => { d.fichas[`n-${g.toLowerCase().normalize('NFD').replace(/[̀-ͯ]/g, '')}-0${i + 1}`] = { grupo: g, nome: n, detalhe: `${c ? c + ' kg · ' : ''}3 séries de 10`, carga: c || null, series: 3, reps: 10, fav: i === 0, ordem: (GR.indexOf(g) + 1) * 100 + i + 1, fonte: 'notion' }; o++; });
      let gi = Math.floor(rnd() * GR.length), peso = p.peso;
      for (let k = 120; k >= 0; k--) {
        const dt = new Date(hoje); dt.setDate(dt.getDate() - k);
        const dia = iso(dt), prog = (120 - k) / 120;
        if (rnd() < p.pTreino) {
          const g = GR[gi++ % GR.length];
          d.treinos['t-' + uid + '-' + dia] = { data: dia, grupo: g, titulo: g, obs: '', duracao: 50 + Math.round(rnd() * 30), fonte: 'app', criado: dt.getTime(),
            exercicios: EX[g].map(([n, c]) => ({ nome: n, carga: c ? Math.round(c * (0.9 + prog * 0.25) * 2) / 2 : null, series: 3, reps: 8 + Math.floor(rnd() * 5) })) };
        }
        if (rnd() < p.pCorrida) {
          const km = Math.round((3 + rnd() * 8) * 100) / 100, pace = 300 + rnd() * 90 - prog * 20;
          d.corridas['r-' + uid + '-' + dia] = { data: dia, km, seg: Math.round(km * pace), tipo: km > 9 ? 'Longão' : 'Leve', fc: 140 + Math.round(rnd() * 25), fonte: 'manual', nome: '', obs: '' };
        }
        if (rnd() < p.pDieta) {
          const kc = p.kcal * (0.82 + rnd() * 0.3), pr = p.prot * (0.75 + rnd() * 0.35);
          [['cafe', .25], ['almoco', .35], ['lanche', .15], ['jantar', .25]].forEach(([ref, f], i) => {
            d.refeicoes[`f-${uid}-${dia}-${i}`] = { data: dia, ref, alimento: ({ cafe: 'Café da manhã', almoco: 'Almoço', lanche: 'Lanche', jantar: 'Jantar' })[ref], qtd: '', kcal: Math.round(kc * f), prot: Math.round(pr * f * 10) / 10, carb: Math.round(kc * f * .5 / 4), gord: Math.round(kc * f * .25 / 9), fonte: 'manual', criado: dt.getTime() + i };
          });
          d.agua[dia] = { ml: 1500 + Math.round(rnd() * 8) * 250 };
        }
        peso += p.dPeso + (rnd() - .5) * 0.25;
        if (dt.getDay() === 1) d.pesos['p-' + uid + '-' + dia] = { data: dia, peso: Math.round(peso * 10) / 10, gordura: null };
      }
      d.testes['x-' + uid] = { data: iso(hoje), teste: 'Flexões (máximo)', valor: 20 + Math.round(rnd() * 25), unidade: 'reps', reps: null, obs: '' };
    }
    banco.semeado = true;
  }

  /* =====================================================================
     TELA DE LOGIN / CADASTRO / GRUPO
     ===================================================================== */
  let backend = null;
  const Hub = window.Hub = { demo: DEMO, CORES, eu: null, store: null, backend: null, status: null, esc };
  const box = () => $('auth-body');
  const msg = (t, ok) => t ? `<p class="auth-msg ${ok ? 'ok' : ''}" role="alert">${esc(t)}</p>` : '';
  const coresHtml = sel => `<div class="cores" role="radiogroup" aria-label="Cor no ranking">${CORES.map(c => `<button type="button" data-cor="${c}" style="background:${c}" aria-pressed="${c === sel}" aria-label="Cor ${c}"></button>`).join('')}</div>`;
  function ligarCores(root, onSel) { root.querySelectorAll('[data-cor]').forEach(b => b.addEventListener('click', () => { root.querySelectorAll('[data-cor]').forEach(x => x.setAttribute('aria-pressed', x === b ? 'true' : 'false')); onSel(b.dataset.cor); })); }
  function ocupar(form, sim) { form.querySelectorAll('button, input').forEach(x => x.disabled = sim); }

  function telaLogin(aviso) {
    document.body.classList.add('sem-login');
    box().innerHTML = `<form class="form" id="fa-login" autocomplete="on">
      <p class="sub">Entre com a sua conta. Seus treinos ficam salvos e aparecem em qualquer aparelho.</p>
      ${msg(aviso)}
      <label class="field"><span>E-mail</span><input type="email" id="fa-email" autocomplete="username" required></label>
      <label class="field"><span>Senha</span><input type="password" id="fa-senha" autocomplete="current-password" required minlength="6"></label>
      <button class="btn primary" type="submit">Entrar</button>
      <div class="auth-alt"><button type="button" id="fa-novo">Criar conta</button><button type="button" id="fa-esqueci">Esqueci a senha</button></div>
      <div id="fa-out"></div>
    </form>`;
    $('fa-novo').onclick = () => telaCadastro();
    $('fa-esqueci').onclick = () => { $('fa-out').innerHTML = msg('Peça para quem criou o grupo trocar sua senha no Supabase (o guia mostra como, leva 1 minuto). Depois entre com a senha nova.', true); };
    $('fa-login').onsubmit = async e => {
      e.preventDefault(); const f = e.currentTarget; ocupar(f, true);
      try { const s = await backend.entrar($('fa-email').value.trim(), $('fa-senha').value); await depoisDoLogin(s); }
      catch (err) { ocupar(f, false); $('fa-out').innerHTML = msg(err.message || 'Não deu certo.'); }
    };
    setTimeout(() => $('fa-email') && $('fa-email').focus(), 50);
  }
  function telaCadastro() {
    box().innerHTML = `<form class="form" id="fa-cad" autocomplete="on">
      <p class="sub">Crie sua conta com e-mail e senha. Depois você entra no grupo com o código de convite.</p>
      <label class="field"><span>E-mail</span><input type="email" id="fa-email" autocomplete="username" required></label>
      <label class="field"><span>Senha (mínimo 6 caracteres)</span><input type="password" id="fa-senha" autocomplete="new-password" required minlength="6"></label>
      <label class="field"><span>Repita a senha</span><input type="password" id="fa-senha2" autocomplete="new-password" required minlength="6"></label>
      <button class="btn primary" type="submit">Criar conta</button>
      <div class="auth-alt"><button type="button" id="fa-volta">Já tenho conta</button></div>
      <div id="fa-out"></div>
    </form>`;
    $('fa-volta').onclick = () => telaLogin();
    $('fa-cad').onsubmit = async e => {
      e.preventDefault(); const f = e.currentTarget;
      if ($('fa-senha').value !== $('fa-senha2').value) { $('fa-out').innerHTML = msg('As senhas não são iguais.'); return; }
      ocupar(f, true);
      try { const s = await backend.cadastrar($('fa-email').value.trim(), $('fa-senha').value); await depoisDoLogin(s); }
      catch (err) { ocupar(f, false); $('fa-out').innerHTML = msg(err.message || 'Não deu certo.'); }
    };
    setTimeout(() => $('fa-email').focus(), 50);
  }
  function telaGrupo(ses, aviso) {
    document.body.classList.add('sem-login');
    let cor = CORES[Math.floor(Math.random() * 6)];
    box().innerHTML = `<form class="form" id="fa-grupo" autocomplete="off">
      <p class="sub">Falta entrar no grupo. Peça o código de convite para quem criou o site.</p>
      ${msg(aviso)}
      <label class="field"><span>Seu nome no ranking</span><input id="fa-nome" maxlength="40" required placeholder="ex.: Arthur"></label>
      <label class="field"><span>Código de convite</span><input id="fa-codigo" required autocapitalize="characters" spellcheck="false"></label>
      <div class="field"><span>Sua cor</span>${coresHtml(cor)}</div>
      <p class="label" style="margin:4px 0 0">O que os amigos podem ver</p>
      <p class="note" style="margin:0">Treinos, fichas, recordes, metas e corridas lançadas à mão aparecem para o grupo: é a competição. Corridas do Strava ficam só com você.</p>
      <label class="check"><input type="checkbox" id="fa-sa"><span>Alimentação<small>Refeições, calorias, proteína e água. Desligado, eles só veem se você bateu a meta do dia.</small></span></label>
      <label class="check"><input type="checkbox" id="fa-sc"><span>Corpo e perfil<small>Peso, medidas, % de gordura, altura, nascimento e peso meta.</small></span></label>
      <button class="btn primary" type="submit">Entrar no grupo</button>
      <div class="auth-alt"><span class="muted">${esc(ses.email || '')}</span><button type="button" id="fa-sair">Sair</button></div>
      <div id="fa-out"></div>
    </form>`;
    ligarCores($('fa-grupo'), c => cor = c);
    $('fa-sair').onclick = async () => { await backend.sair(); telaLogin(); };
    $('fa-grupo').onsubmit = async e => {
      e.preventDefault(); const f = e.currentTarget; ocupar(f, true);
      try {
        await backend.entrarNoGrupo({ codigo: $('fa-codigo').value.trim(), nome: $('fa-nome').value.trim(), cor, compartilha: { alimentacao: $('fa-sa').checked, corpo: $('fa-sc').checked } });
        await depoisDoLogin(ses);
      } catch (err) { ocupar(f, false); $('fa-out').innerHTML = msg(err.message || 'Não deu certo.'); }
    };
    setTimeout(() => $('fa-nome').focus(), 50);
  }
  function telaDemo() {
    document.body.classList.add('sem-login');
    let cor = CORES[0];
    box().innerHTML = `<form class="form" id="fa-demo" autocomplete="off">
      <p class="demo-note"><b>Modo demonstração.</b> O site ainda não foi ligado a um banco de dados (arquivo config.js vazio). Tudo fica só neste navegador, com três amigos de exemplo no ranking. O guia mostra como publicar de verdade.</p>
      <label class="field"><span>Seu nome</span><input id="fa-nome" maxlength="40" required value="Você"></label>
      <div class="field"><span>Sua cor</span>${coresHtml(cor)}</div>
      <button class="btn primary" type="submit">Entrar na demonstração</button>
    </form>`;
    ligarCores($('fa-demo'), c => cor = c);
    $('fa-demo').onsubmit = async e => { e.preventDefault(); const s = await backend.entrarDemo($('fa-nome').value.trim() || 'Você', cor); await depoisDoLogin(s); };
  }
  function telaErro(t) { document.body.classList.add('sem-login'); box().innerHTML = msg(t) + '<button class="btn" type="button" onclick="location.reload()">Tentar de novo</button>'; }

  async function depoisDoLogin(ses) {
    let membro = null;
    try { membro = await backend.meuMembro(ses.uid); }
    catch (e) {
      const ult = lsGet('hub:ultimo');
      if (ult && ult.uid === ses.uid && ult.membro) membro = ult.membro;          // sem internet: usa o que já sabia
      else return telaErro('Não consegui falar com o servidor. Confira a internet e tente de novo.');
    }
    if (!membro) return DEMO ? telaDemo() : telaGrupo(ses);
    await iniciarApp(ses, membro);
  }

  /* =====================================================================
     INÍCIO DO APP
     ===================================================================== */
  let desassinar = null, escondidoEm = 0;
  async function iniciarApp(ses, membro) {
    Hub.eu = { uid: ses.uid, email: ses.email, nome: membro.nome, cor: membro.cor, compartilha: membro.compartilha || {} };
    lsSet('hub:ultimo', { uid: ses.uid, email: ses.email, membro: { user_id: ses.uid, nome: membro.nome, cor: membro.cor, compartilha: membro.compartilha } });
    const store = Hub.store = criarStore(backend, ses.uid);
    await store.iniciar();
    document.body.classList.remove('sem-login');
    atualizarConta();
    window.HubApp.start({ store, backend, eu: Hub.eu, demo: DEMO });
    store.sincronizar(true).then(() => { if (!desassinar) desassinar = backend.assinar(ses.uid, row => store.aplicarRemotoUm(row)); });
  }
  function atualizarConta() {
    const e = Hub.eu; if (!e) return;
    $('conta-av').textContent = (e.nome || '?').trim().charAt(0) || '?';
    $('conta-av').style.background = e.cor || CORES[0];
    $('conta-nome').textContent = e.nome || 'Conta';
    $('eyebrow').textContent = (CFG.nomeGrupo && CFG.nomeGrupo !== 'Hub de Evolução' ? CFG.nomeGrupo + ' · ' : '') + (DEMO ? 'Modo demonstração' : 'Treino, corrida e dieta');
  }
  Hub.atualizarConta = atualizarConta;
  Hub.salvarConta = async patch => {
    const p = {};
    if (patch.nome != null) p.nome = String(patch.nome).trim().slice(0, 40);
    if (patch.cor && /^#[0-9a-f]{6}$/i.test(patch.cor)) p.cor = patch.cor;
    if (patch.compartilha) p.compartilha = { alimentacao: !!patch.compartilha.alimentacao, corpo: !!patch.compartilha.corpo };
    if (p.nome === '') throw { message: 'Escolha um nome.' };
    await backend.atualizarMembro(Hub.eu.uid, p);
    Object.assign(Hub.eu, p);
    lsSet('hub:ultimo', { uid: Hub.eu.uid, email: Hub.eu.email, membro: { user_id: Hub.eu.uid, nome: Hub.eu.nome, cor: Hub.eu.cor, compartilha: Hub.eu.compartilha } });
    atualizarConta();
  };
  Hub.sair = async () => {
    if (Hub.store && Hub.store.pendentes() > 0 && !confirm('Ainda há registros esperando a internet para subir. Se sair agora, eles se perdem. Sair mesmo assim?')) return;
    if (Hub.store) Hub.store.parar();
    if (desassinar) desassinar();
    await kv.del('cache:' + Hub.eu.uid); await kv.del('cache:' + Hub.eu.uid + ':fila');
    lsDel('hub:ultimo');
    try { localStorage.removeItem('hub-evolucao:rascunho-treino:v1'); localStorage.removeItem('hub-evolucao:leitura-growth:v1'); } catch (_) { }
    await backend.sair();
    location.hash = ''; location.reload();
  };
  Hub.apagarDemo = async () => { await backend.apagarTudo(); await backend.sair(); await kv.del('cache:demo-voce'); await kv.del('cache:demo-voce:fila'); location.reload(); };

  /* chamadas às conexões e ao grupo */
  Hub.func = (acao, body, signal) => backend.func(acao, body, signal);
  Hub.statusInteg = async (forcar) => {
    if (Hub.status && !forcar) return Hub.status;
    try { Hub.status = await backend.func('status'); } catch (e) { Hub.status = { erro: e, notion: { configurado: false }, strava: { conectado: false }, ia: { disponivel: false } }; }
    return Hub.status;
  };
  Hub.membros = () => backend.membros();
  Hub.metasMembros = () => backend.metasMembros();
  Hub.ranking = (i, f) => backend.ranking(i, f);
  Hub.carregarAmigo = uid => backend.carregarAmigo(uid);

  /* leitura de prints pela IA: reduz a imagem antes de enviar */
  async function imagemBase64(file) {
    const url = URL.createObjectURL(file);
    try {
      const img = await new Promise((ok, no) => { const i = new Image(); i.onload = () => ok(i); i.onerror = () => no({ code: 'image_rejected' }); i.src = url; });
      const max = 2048, k = Math.min(1, max / Math.max(img.naturalWidth, img.naturalHeight));
      const c = document.createElement('canvas'); c.width = Math.max(1, Math.round(img.naturalWidth * k)); c.height = Math.max(1, Math.round(img.naturalHeight * k));
      const g = c.getContext('2d'); g.fillStyle = '#fff'; g.fillRect(0, 0, c.width, c.height); g.drawImage(img, 0, 0, c.width, c.height);
      return { base64: c.toDataURL('image/jpeg', 0.86).split(',')[1], tipo: 'image/jpeg' };
    } finally { URL.revokeObjectURL(url); }
  }
  Hub.lerIA = async (prompt, file, signal) => {
    const imagem = file ? await imagemBase64(file) : null;
    const r = await backend.func('ia-ler', { prompt, imagem }, signal);
    return r.resultado;
  };

  /* ---------- tempo real e retomada ---------- */
  function ligarEventos() {
    window.addEventListener('online', () => { setOffline(false); if (Hub.store) { Hub.store.flush(); Hub.store.sincronizar(false); } });
    window.addEventListener('offline', () => setOffline(true));
    window.addEventListener('pagehide', () => { if (Hub.store) Hub.store.persistir(); });
    document.addEventListener('visibilitychange', () => {
      if (document.visibilityState === 'hidden') { escondidoEm = Date.now(); if (Hub.store) { Hub.store.persistir(); Hub.store.flush(); } }
      else if (Hub.store && Date.now() - escondidoEm > 15000) { Hub.store.sincronizar(false); Hub.store.flush(); }
    });
    setInterval(() => { if (Hub.store && document.visibilityState === 'visible') Hub.store.flush(); }, 30000);
  }

  /* =====================================================================
     INSTALAR COMO APLICATIVO (PWA)
     ===================================================================== */
  let promptInstalar = null;
  const instalado = () => window.matchMedia('(display-mode: standalone)').matches || window.navigator.standalone === true;
  const ios = () => /iphone|ipad|ipod/i.test(navigator.userAgent) || (navigator.platform === 'MacIntel' && navigator.maxTouchPoints > 1);
  Hub.estadoInstalacao = () => instalado() ? 'instalado' : promptInstalar ? 'disponivel' : ios() ? 'ios' : 'manual';
  Hub.instalar = async () => {
    if (!promptInstalar) return false;
    promptInstalar.prompt();
    const r = await promptInstalar.userChoice.catch(() => null);
    promptInstalar = null; $('btn-instalar').hidden = true;
    if (window.HubApp && window.HubApp.rerender) window.HubApp.rerender();
    return r && r.outcome === 'accepted';
  };
  window.addEventListener('beforeinstallprompt', e => { e.preventDefault(); promptInstalar = e; $('btn-instalar').hidden = false; if (window.HubApp && window.HubApp.rerender) window.HubApp.rerender(); });
  window.addEventListener('appinstalled', () => { promptInstalar = null; $('btn-instalar').hidden = true; });
  document.addEventListener('DOMContentLoaded', () => { });
  if ('serviceWorker' in navigator && /^https?:$/.test(location.protocol)) {
    window.addEventListener('load', () => navigator.serviceWorker.register('sw.js').catch(err => console.warn('Service worker:', err)));
  }

  /* =====================================================================
     PARTIDA
     ===================================================================== */
  Hub.pronto = async () => {
    $('btn-instalar').addEventListener('click', () => Hub.instalar());
    $('btn-conta').addEventListener('click', () => { if (window.HubApp) window.HubApp.abrirConta(); });
    ligarEventos();
    backend = Hub.backend = DEMO ? criarDemo() : criarSupabase();
    if (!backend) return telaErro('Não consegui carregar a biblioteca do Supabase. Confira a internet e recarregue a página.');
    let ses = await backend.sessao();
    if (!ses && !DEMO) {
      const ult = lsGet('hub:ultimo');                       // sem internet e com sessão salva: abre do aparelho
      if (ult && !navigator.onLine) ses = { uid: ult.uid, email: ult.email };
    }
    if (!ses) return DEMO ? telaDemo() : telaLogin();
    await depoisDoLogin(ses);
  };
})();
