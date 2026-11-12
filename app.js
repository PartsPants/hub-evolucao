/* =====================================================================
   Hub de Evolução · app (mesma lógica do artefato original)
   O banco, o login e as conexões vêm do nucleo.js (window.Hub).
   ===================================================================== */
function slugify(s) { return String(s).normalize('NFD').replace(/[̀-ͯ]/g, '').toLowerCase().replace(/[^a-z0-9]+/g, '-').replace(/^-+|-+$/g, '').slice(0, 48) || 'item'; }
(() => {
  'use strict';
  /* ---------- utilidades ---------- */
  const $ = id => document.getElementById(id);
  const esc = s => String(s ?? '').replace(/[&<>"']/g, c => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' })[c]);
  const pad = n => String(n).padStart(2, '0');
  const isoOf = d => `${d.getFullYear()}-${pad(d.getMonth() + 1)}-${pad(d.getDate())}`;
  const todayIso = () => isoOf(new Date());
  const dateOf = iso => { const [y, m, d] = String(iso).split('-').map(Number); return new Date(y, (m || 1) - 1, d || 1); };
  const addDays = (iso, n) => { const d = dateOf(iso); d.setDate(d.getDate() + n); return isoOf(d); };
  const daysBetween = (a, b) => Math.round((dateOf(b) - dateOf(a)) / 864e5);
  const toBR = iso => { const m = String(iso || '').match(/^(\d{4})-(\d{2})-(\d{2})$/); return m ? `${m[3]}/${m[2]}/${m[1]}` : ''; };
  const toBRs = iso => { const m = String(iso || '').match(/^(\d{4})-(\d{2})-(\d{2})$/); return m ? `${m[3]}/${m[2]}` : ''; };
  const MESES = ['janeiro', 'fevereiro', 'março', 'abril', 'maio', 'junho', 'julho', 'agosto', 'setembro', 'outubro', 'novembro', 'dezembro'];
  const DOW = ['seg', 'ter', 'qua', 'qui', 'sex', 'sáb', 'dom'];
  const DOW_LONG = ['domingo', 'segunda-feira', 'terça-feira', 'quarta-feira', 'quinta-feira', 'sexta-feira', 'sábado'];
  const cap = s => s ? s[0].toUpperCase() + s.slice(1) : s;
  const mesNome = ym => { const [y, m] = ym.split('-').map(Number); return `${MESES[m - 1]} de ${y}`; };
  const diaLongo = iso => { const d = dateOf(iso); return `${DOW_LONG[d.getDay()]}, ${d.getDate()} de ${MESES[d.getMonth()]}`; };
  function weekStartIso(iso) { const d = dateOf(iso); d.setDate(d.getDate() - (d.getDay() + 6) % 7); return isoOf(d); }
  function parseNum(t) {
    if (typeof t === 'number') return Number.isFinite(t) ? t : NaN;
    let s = String(t ?? '').replace(/[\s ]/g, '').replace(/(kg|km|cm|kcal|g|ml)$/i, '');
    if (!s) return null;
    if (s.includes(',')) s = s.replace(/\./g, '').replace(',', '.');
    const v = Number(s);
    return Number.isFinite(v) ? v : NaN;
  }
  const numOr = (v, d = null) => { const p = parseNum(v); return (p == null || Number.isNaN(p)) ? d : p; };
  const nn = v => { const x = parseNum(v); return (x == null || Number.isNaN(x)) ? null : x; };
  const f1 = v => Number(v || 0).toLocaleString('pt-BR', { maximumFractionDigits: 1 });
  const f0 = v => Math.round(Number(v) || 0).toLocaleString('pt-BR');
  const fIn = v => (v == null || v === '') ? '' : String(v).replace('.', ',');
  const r1 = v => Math.round((Number(v) || 0) * 10) / 10;
  function parseTempo(t) {
    const s = String(t ?? '').trim().replace(/[hm]/gi, ':').replace(/s$/i, '').replace(/::+/g, ':').replace(/:$/, '');
    if (!s) return null;
    if (!s.includes(':')) { const m = parseNum(s); return m == null || Number.isNaN(m) ? NaN : Math.round(m * 60); }
    const p = s.split(':').map(Number);
    if (p.some(x => !Number.isFinite(x))) return NaN;
    return p.length === 3 ? p[0] * 3600 + p[1] * 60 + p[2] : p[0] * 60 + p[1];
  }
  function fmtTempo(sec) { sec = Math.round(sec || 0); const h = Math.floor(sec / 3600), m = Math.floor(sec % 3600 / 60), s = sec % 60; return h ? `${h}:${pad(m)}:${pad(s)}` : `${m}:${pad(s)}`; }
  const fmtPace = spk => { if (!spk) return '—'; const t = Math.round(spk); return `${Math.floor(t / 60)}:${pad(t % 60)}`; };
  const uid = p => p + '-' + Date.now().toString(36) + Math.random().toString(36).slice(2, 6);
  const isoOk = v => /^\d{4}-\d{2}-\d{2}$/.test(String(v || '')) ? String(v) : '';
  const str = v => v == null ? '' : String(v);
  const normNome = s => slugify(s);
  /* séries com cargas diferentes: "40 kg × 10, 45 kg × 8" */
  const fmtSets = ss => ss.map(x => `${x.carga != null && x.carga !== '' ? fIn(x.carga) + ' kg' : '—'}${x.reps != null && x.reps !== '' ? ' × ' + x.reps : ''}`).join(', ');
  const setsForm = ss => Array.isArray(ss) && ss.length ? ss.map(x => ({ carga: x.carga == null ? '' : str(x.carga), reps: x.reps == null ? '' : str(x.reps) })) : null;
  const hexDe = u => (String(u || '').replace(/-/g, '').match(/[0-9a-f]{32}/i) || [''])[0].toLowerCase();
  function quando(ms) {
    if (!ms) return '';
    const d = new Date(ms), diff = Date.now() - ms;
    if (diff < 120e3) return 'agora há pouco';
    if (diff < 3600e3) return `há ${Math.round(diff / 60e3)} min`;
    const iso = isoOf(d);
    if (iso === todayIso()) return `hoje às ${pad(d.getHours())}:${pad(d.getMinutes())}`;
    if (iso === addDays(todayIso(), -1)) return 'ontem';
    return `em ${toBRs(iso)}`;
  }

  /* ---------- constantes ---------- */
  const H = window.Hub;
  const notionLink = () => (S.integ && S.integ.notion && S.integ.notion.pagina_url) || 'https://www.notion.so';
  const GRUPOS_BASE = ['Braço', 'Peito', 'Perna', 'Costas', 'Ombro'];
  const GCOR = { 'Braço': '--g-braco', 'Peito': '--g-peito', 'Perna': '--g-perna', 'Costas': '--g-costas', 'Ombro': '--g-ombro', 'Extensores torácicos': '--g-ext' };
  const gcor = g => `var(${GCOR[g] || '--g-outro'})`;
  const REFS = [['cafe', 'Café da manhã'], ['almoco', 'Almoço'], ['lanche', 'Lanche'], ['jantar', 'Jantar'], ['ceia', 'Ceia'], ['outro', 'Outros']];
  const REF_TXT = Object.fromEntries(REFS);
  const MEDIDAS = [['peito', 'Peito'], ['ombros', 'Ombros'], ['cintura', 'Cintura'], ['abdomen', 'Abdômen'], ['quadril', 'Quadril'], ['braco_d', 'Braço dir.'], ['braco_e', 'Braço esq.'], ['antebraco', 'Antebraço'], ['coxa_d', 'Coxa dir.'], ['coxa_e', 'Coxa esq.'], ['panturrilha', 'Panturrilha'], ['pescoco', 'Pescoço']];
  const DEF_METAS = { kcal: 2500, prot: 140, carb: 300, gord: 70, agua_ml: 3000, treinos_semana: 4, km_semana: 15 };
  const UNIDS = ['kg', 'reps', 's', 'tempo', 'km', 'cm'];
  const TESTES_PADRAO = ['Flexões (máximo)', 'Barra fixa (máximo)', 'Prancha', 'Corrida 5 km', 'Corrida 10 km', 'Salto vertical'];

  const S = {
    db: null, canWrite: true, loaded: {}, any: false,
    treinos: new Map(), fichas: new Map(), corridas: new Map(), refeicoes: new Map(), agua: new Map(), pesos: new Map(), medidas: new Map(), testes: new Map(), alimentos: new Map(),
    perfil: {}, metas: { ...DEF_METAS }, metasSalvas: false, sync: {}, syncExists: false,
    tab: 'painel', calMes: todayIso().slice(0, 7), diaSel: todayIso(), fichaGrupo: null, histGrupo: 'todos', histAll: false, runMes: 'todos', foodDate: todayIso(),
    tForm: null, growth: null, busy: {}, cx: {}, dirty: {}, _sess: null,
    mcp: undefined, sample: undefined, sampleLimits: null, autoDone: false,
    edit: {}, tPend: new Set(), rtRemoto: false, lsOk: null, navegou: false, hojeIni: todayIso(),
    integ: null, amigo: null, meu: null, rank: { p: 'semana', dados: null, carregando: false, erro: '' }, membros: null,
  };

  /* ---------- salvar ---------- */
  function setSave(s, t) { const el = $('save-status'); el.dataset.s = s; el.textContent = t; }
  function toast(t) { const el = $('toast'); el.textContent = t; el.hidden = false; clearTimeout(toast.t); toast.t = setTimeout(() => el.hidden = true, 2800); }
  let pending = 0;
  const chains = {};
  /* quiet: gravações de fundo (rascunho) não mexem no indicador nem no modo só leitura */
  function write(col, id, data, op = 'set', quiet = false) {
    if (!S.db) { if (!quiet) toast('Entre na sua conta para salvar.'); return Promise.reject({ code: 'not_granted' }); }
    if (!S.canWrite) { if (!quiet) toast(S.amigo ? `Este é o hub de ${S.amigo.nome}: só leitura.` : 'Só leitura: você não pode mudar estes dados.'); return Promise.reject({ code: 'not_granted' }); }
    let ref;
    try { ref = S.db.collection(col).doc(id); } catch (err) { console.error(err); return Promise.reject({ code: 'invalid_argument' }); }
    const key = col + '/' + id;
    if (!quiet) { pending++; setSave('pending', 'Salvando…'); }
    const run = () => op === 'delete' ? ref.delete() : op === 'update' ? ref.update(data) : ref.set(data);
    /* a fila do núcleo já tenta de novo sozinha quando a internet volta: a promessa só termina quando o servidor confirma */
    const p = (chains[key] || Promise.resolve()).catch(() => { }).then(run);
    chains[key] = p;
    if (quiet) return p;
    return p.then(() => { pending--; if (!pending) setSave('saved', 'Salvo'); }, e => {
      pending--;
      const c = e && e.code;
      if (c === 'not_granted') { S.canWrite = false; setSave('readonly', 'Sem permissão: entre de novo'); }
      else if (c === 'invalid_argument') setSave('error', 'Um registro foi recusado (grande demais?)');
      else if (c === 'quota_exceeded') setSave('error', 'Espaço cheio: apague registros antigos');
      else setSave('error', 'Não salvou. Confira a conexão');
      throw e;
    });
  }
  const syncMeta = fields => write('config', 'sync', S.syncExists ? fields : { ...S.sync, ...fields }, S.syncExists ? 'update' : 'set');
  /* trava o botão de enviar enquanto salva: dois toques não criam dois registros */
  const ocupado = form => form.dataset.busy === '1';
  function travar(form, p) {
    const b = form.querySelector('button[type="submit"]');
    form.dataset.busy = '1'; if (b) b.disabled = true;
    const solta = () => { clearTimeout(t); delete form.dataset.busy; if (b) b.disabled = false; };
    const t = setTimeout(solta, 20000);
    Promise.resolve(p).then(solta, solta);
    return p;
  }

  /* ---------- guardado no aparelho (pode faltar em alguns navegadores) ---------- */
  const LS_RT = 'hub-evolucao:rascunho-treino:v1', LS_G = 'hub-evolucao:leitura-growth:v1';
  const lsGet = k => { try { const v = localStorage.getItem(k); return v ? JSON.parse(v) : null; } catch (_) { return null; } };
  const lsSet = (k, v) => { try { localStorage.setItem(k, JSON.stringify(v)); return true; } catch (_) { return false; } };
  const lsDel = k => { try { localStorage.removeItem(k); } catch (_) { } };
  const idOk = v => typeof v === 'string' && /^[A-Za-z0-9_~:@+-][A-Za-z0-9_.~:@+-]{0,80}$/.test(v);

  /* ---------- rascunho do treino ----------
     Cada mudança vai na hora para o aparelho e, 1,5 s depois de parar de digitar, para a sua conta
     (config/rascunho_treino). Se a aba fechar, o treino volta como estava. Só some ao salvar ou limpar. */
  function temConteudo(F) {
    return !!F && (F.exs.some(e => (e.feito && (!e.extra || String(e.nome).trim())) || (e.extra && String(e.nome).trim())) || !!String(F.dur ?? '').trim() || !!String(F.obs ?? '').trim());
  }
  function rascunhoDoc(F) {
    return {
      v: 1, id: F.id, data: str(F.data), grupo: F.grupo, dur: str(F.dur), obs: str(F.obs), dataManual: !!F.dataManual, atualizado: F.atualizado || Date.now(),
      editando: !!F.editando, criadoOrig: F.criadoOrig || 0, apagar: F.apagar || [],
      exs: F.exs.map(e => ({ key: str(e.key), nome: str(e.nome), det: str(e.det), feito: !!e.feito, carga: str(e.carga), series: str(e.series), reps: str(e.reps), sets: setsForm(e.sets), extra: !!e.extra, app: !!e.app, solto: !!e.solto, ultima: e.ultima ? { carga: nn(e.ultima.carga), reps: nn(e.ultima.reps), data: isoOk(e.ultima.data) } : null })),
    };
  }
  const rascunhoValido = d => !!d && typeof d === 'object' && d.v === 1 && Array.isArray(d.exs) && typeof d.grupo === 'string';
  function restaurarRascunho(d) {
    S.tForm = {
      id: idOk(d.id) ? d.id : uid('t'), data: isoOk(d.data) || todayIso(), grupo: str(d.grupo) || 'Outro', dur: str(d.dur), obs: str(d.obs), dataManual: !!d.dataManual, grupoAuto: false,
      editando: !!d.editando, criadoOrig: nn(d.criadoOrig) || 0, apagar: Array.isArray(d.apagar) ? d.apagar.filter(idOk) : [],
      exs: d.exs.filter(e => e && typeof e === 'object').map(e => ({ key: str(e.key) || uid('x'), nome: str(e.nome), det: str(e.det), feito: !!e.feito, carga: str(e.carga), series: str(e.series), reps: str(e.reps), sets: setsForm(e.sets), extra: !!e.extra, app: !!e.app, solto: !!e.solto, ultima: e.ultima && isoOk(e.ultima.data) ? { carga: nn(e.ultima.carga), reps: nn(e.ultima.reps), data: e.ultima.data } : null })),
      touched: true, vivo: false, salvando: false, atualizado: nn(d.atualizado) || 0, recuperado: true, sig: formSig(),
    };
  }
  let rtTimer = null, rtPend;            // rtPend: undefined = nada a enviar, null = apagar, objeto = gravar
  function marcarTreino() {
    const F = S.tForm; if (!F) return;
    F.touched = true; F.vivo = true; F.recuperado = false; F.atualizado = Date.now();
    guardarRascunho();
  }
  function guardarRascunho() {
    const F = S.tForm;
    if (!temConteudo(F)) { apagarRascunho(false); mostrarRascunho(); return; }
    const d = rascunhoDoc(F);
    S.lsOk = lsSet(LS_RT, d);
    rtPend = d; clearTimeout(rtTimer); rtTimer = setTimeout(enviarRascunho, 1500);
    mostrarRascunho();
  }
  function apagarRascunho(agora) {
    lsDel(LS_RT);
    if (!S.rtRemoto && rtPend === undefined && !rtTimer) return;
    rtPend = null; clearTimeout(rtTimer);
    if (agora) enviarRascunho(); else rtTimer = setTimeout(enviarRascunho, 1500);
  }
  function enviarRascunho() {
    clearTimeout(rtTimer); rtTimer = null;
    if (rtPend === undefined) return;
    const d = rtPend; rtPend = undefined;
    if (!S.db || !S.canWrite) return;
    if (!d && !S.rtRemoto) return;
    if (d) S.rtRemoto = true;
    write('config', 'rascunho_treino', d, d ? 'set' : 'delete', true).then(() => { if (!d) S.rtRemoto = false; }, () => { });
  }
  function mostrarRascunho() {
    const el = $('t-draft'), F = S.tForm;
    if (!F || !temConteudo(F)) { el.hidden = true; el.classList.remove('warn'); return; }
    const hoje = todayIso(), outraData = isoOk(F.data) && F.data !== hoje;
    const nuvem = !!(S.db && S.canWrite);
    const partes = [];
    if (F.editando && !F.vivo && !F.recuperado) { el.hidden = true; return; }
    if (F.recuperado) partes.push(F.editando ? `Edição recuperada (alterada ${quando(F.atualizado) || 'antes'}).` : `Treino em andamento recuperado (anotado ${quando(F.atualizado) || 'antes'}).`);
    partes.push(S.lsOk === false && !nuvem ? 'Não deu para guardar as anotações neste aparelho: salve o treino antes de sair do app.' : F.editando ? 'Alterações guardadas automaticamente até você salvar ou cancelar.' : 'Anotações guardadas automaticamente. Se o app fechar, elas voltam até você salvar o treino.');
    if (outraData) partes.push(`Data deste treino: ${toBR(F.data)}.`);
    el.textContent = partes.join(' ');
    el.classList.toggle('warn', (F.recuperado && outraData) || (S.lsOk === false && !nuvem));
    el.hidden = false;
  }
  /* o treino deste rascunho já foi salvo (por exemplo, a aba fechou logo depois de salvar)? */
  function conferirRascunho() {
    const F = S.tForm; if (!F || F.salvando || !F.atualizado) return;
    const t = S.treinos.get(F.id);
    if (!t || S.tPend.has(F.id) || salvoEm(t) < F.atualizado) return;
    F.confirmado = true;
    apagarRascunho(true);
    const g = F.grupo;
    newTForm(null); renderTForm();
    $('t-status').textContent = `Treino de ${g} salvo.`;
  }
  const salvoEm = t => Math.max(t.criado || 0, t.editado || 0);
  function virouDia() {
    const h = todayIso(), old = S.hojeIni; if (h === old) return false;
    S.hojeIni = h;
    ['r-data', 'p-data', 'md-data', 'x-data'].forEach(id => { if ($(id).value === old) $(id).value = h; });
    if (S.foodDate === old) S.foodDate = h;
    if (S.diaSel === old) S.diaSel = h;
    if (S.calMes === old.slice(0, 7)) S.calMes = h.slice(0, 7);
    const F = S.tForm; if (F && !temConteudo(F) && !F.dataManual) { newTForm(F.grupoAuto ? null : F.grupo); renderTForm(); }
    return true;
  }
  document.addEventListener('visibilitychange', () => {
    if (document.visibilityState === 'hidden') { if (rtTimer) enviarRascunho(); }
    else if (virouDia()) rerender();
  });
  window.addEventListener('pagehide', () => { if (rtTimer) enviarRascunho(); });
  window.addEventListener('pageshow', e => { if (e.persisted && virouDia()) rerender(); });

  /* ---------- documentos ---------- */
  const MAPS = {
    treinos: (id, d) => ({
      id, data: isoOk(d.data), grupo: str(d.grupo) || 'Outro', titulo: str(d.titulo), obs: str(d.obs), duracao: nn(d.duracao), fonte: str(d.fonte) || 'app', notion_url: str(d.notion_url), criado: nn(d.criado) || 0, editado: nn(d.editado) || 0, notion_enviado: nn(d.notion_enviado) || 0,
      exercicios: Array.isArray(d.exercicios) ? d.exercicios.filter(e => e && e.nome).map(e => ({ nome: str(e.nome), carga: nn(e.carga), series: nn(e.series), reps: nn(e.reps), sets: Array.isArray(e.sets) && e.sets.length ? e.sets.filter(x => x && typeof x === 'object').slice(0, 20).map(x => ({ carga: nn(x.carga), reps: nn(x.reps) })) : null })) : [],
    }),
    fichas: (id, d) => ({ id, grupo: str(d.grupo) || 'Outro', nome: str(d.nome), detalhe: str(d.detalhe), carga: nn(d.carga), series: nn(d.series), reps: nn(d.reps), fav: !!d.fav, ordem: nn(d.ordem) ?? 9999, fonte: str(d.fonte) }),
    corridas: (id, d) => ({ id, data: isoOk(d.data), km: nn(d.km) || 0, seg: nn(d.seg) || 0, tipo: str(d.tipo) || 'Corrida', fc: nn(d.fc), elev: nn(d.elev), nome: str(d.nome), obs: str(d.obs), fonte: str(d.fonte) || 'manual', tipo_manual: !!d.tipo_manual, strava_id: str(d.strava_id) }),
    refeicoes: (id, d) => ({ id, data: isoOk(d.data), ref: REF_TXT[d.ref] ? d.ref : 'outro', alimento: str(d.alimento), qtd: str(d.qtd), kcal: nn(d.kcal) || 0, prot: nn(d.prot) || 0, carb: nn(d.carb) || 0, gord: nn(d.gord) || 0, fonte: str(d.fonte) || 'manual', estimado: !!d.estimado, criado: nn(d.criado) || 0 }),
    agua: (id, d) => ({ id, ml: nn(d.ml) || 0 }),
    pesos: (id, d) => ({ id, data: isoOk(d.data), peso: nn(d.peso), gordura: nn(d.gordura) }),
    medidas: (id, d) => { const o = { id, data: isoOk(d.data) }; for (const [k] of MEDIDAS) o[k] = nn(d[k]); return o; },
    testes: (id, d) => ({ id, data: isoOk(d.data), teste: str(d.teste), valor: nn(d.valor), unidade: UNIDS.includes(d.unidade) ? d.unidade : 'kg', reps: nn(d.reps), obs: str(d.obs) }),
    alimentos: (id, d) => ({ id, nome: str(d.nome), qtd: str(d.qtd), kcal: nn(d.kcal) || 0, prot: nn(d.prot) || 0, carb: nn(d.carb) || 0, gord: nn(d.gord) || 0, usos: nn(d.usos) || 0, ultimo: nn(d.ultimo) || 0 }),
  };

  /* ---------- dados derivados ---------- */
  function computeSessoes() {
    const m = new Map(), env = new Map();
    /* treino enviado daqui para o Notion volta na sincronização: fica junto do original, sem repetir */
    for (const t of S.treinos.values()) if (t.fonte !== 'notion' && t.notion_url && t.data) { const h = hexDe(t.notion_url); if (h) env.set(h, t); }
    for (const t of S.treinos.values()) {
      if (!t.data) continue;
      const dono = t.fonte === 'notion' ? env.get(hexDe(t.notion_url) || hexDe(t.id)) : null;
      const data = dono ? dono.data : t.data, grupo = dono ? dono.grupo : t.grupo, k = data + '|' + grupo;
      let s = m.get(k);
      if (!s) { s = { key: k, data, grupo, appIds: [], notion: null, exercicios: [], obs: [], duracao: null, enviado: false }; m.set(k, s); }
      if (t.fonte === 'notion') s.notion = t; else { s.appIds.push(t.id); if (t.notion_enviado) s.enviado = true; }
      if (t.exercicios.length) s.exercicios.push(...t.exercicios);
      if (t.obs && !s.obs.includes(t.obs)) s.obs.push(t.obs);
      if (t.duracao) s.duracao = (s.duracao || 0) + t.duracao;
    }
    return [...m.values()].sort((a, b) => b.data.localeCompare(a.data));
  }
  const sess = () => S._sess || (S._sess = computeSessoes());
  const corridasArr = () => [...S.corridas.values()].filter(r => r.data && r.km > 0).sort((a, b) => b.data.localeCompare(a.data));
  const pesosArr = () => [...S.pesos.values()].filter(p => p.data && p.peso).sort((a, b) => a.data.localeCompare(b.data));
  const fichasArr = () => [...S.fichas.values()].sort((a, b) => a.ordem - b.ordem);
  function gruposFicha() { const out = []; for (const f of fichasArr()) if (!out.includes(f.grupo)) out.push(f.grupo); return out; }
  /* ficha de um grupo: as do Notion + as adicionadas no app (sem repetir nome que já está no Notion) */
  function fichasDoGrupo(g) {
    const fs = fichasArr().filter(f => f.grupo === g);
    const vistos = new Set(fs.filter(f => f.fonte !== 'app').map(f => normNome(f.nome)));
    return fs.filter(f => { if (f.fonte !== 'app') return true; const k = normNome(f.nome); if (vistos.has(k)) return false; vistos.add(k); return true; });
  }
  const refeicoesDia = iso => [...S.refeicoes.values()].filter(r => r.data === iso).sort((a, b) => a.criado - b.criado);
  const totaisDia = iso => refeicoesDia(iso).reduce((a, r) => ({ kcal: a.kcal + r.kcal, prot: a.prot + r.prot, carb: a.carb + r.carb, gord: a.gord + r.gord, n: a.n + 1 }), { kcal: 0, prot: 0, carb: 0, gord: 0, n: 0 });
  const aguaDia = iso => (S.agua.get(iso) || {}).ml || 0;
  function ultimoPorGrupo() { const m = {}; for (const s of sess()) if (!m[s.grupo]) m[s.grupo] = s.data; return m; }
  function ultimaVez(nome) {
    const k = normNome(nome);
    for (const s of sess()) for (const e of s.exercicios) if (normNome(e.nome) === k) return { ...e, data: s.data };
    return null;
  }
  function sugestaoGrupo() {
    const hoje = todayIso(), ult = ultimoPorGrupo();
    const fg = gruposFicha();
    const cands = GRUPOS_BASE.filter(g => !fg.length || fg.includes(g));
    let best = null;
    for (const g of cands) {
      if (ult[g] === hoje) continue;
      const dias = ult[g] ? daysBetween(ult[g], hoje) : Infinity;
      if (!best || dias > best.dias) best = { grupo: g, dias };
    }
    return best || { grupo: cands[0] || 'Outro', dias: null };
  }
  const idade = nasc => { if (!isoOk(nasc)) return null; const b = dateOf(nasc), n = new Date(); let a = n.getFullYear() - b.getFullYear(); if (n.getMonth() < b.getMonth() || (n.getMonth() === b.getMonth() && n.getDate() < b.getDate())) a--; return a; };

  /* ---------- abas ---------- */
  const TABS = ['painel', 'ranking', 'treinos', 'corrida', 'alimentacao', 'corpo', 'conexoes'];
  function showTab(t) {
    if (!TABS.includes(t)) t = 'painel';
    if (S.amigo && (t === 'conexoes' || t === 'ranking')) t = 'painel';
    S.tab = t;
    for (const x of TABS) $('tab-' + x).hidden = x !== t;
    for (const a of document.querySelectorAll('#tabs a')) a.setAttribute('aria-current', a.dataset.tab === t ? 'page' : 'false');
    renderTab();
  }
  function goTab(t) { try { history.replaceState(null, '', '#' + t); } catch (_) { } showTab(t); window.scrollTo({ top: 0 }); }
  window.addEventListener('hashchange', () => { S.navegou = true; showTab(location.hash.slice(1)); });
  $('tabs').addEventListener('click', e => { const a = e.target.closest('a[data-tab]'); if (a) { e.preventDefault(); S.navegou = true; goTab(a.dataset.tab); } });
  function renderTab() {
    S._sess = null;
    try { conferirRascunho(); } catch (err) { console.error(err); }
    try { ({ painel: renderPainel, ranking: renderRanking, treinos: renderTreinos, corrida: renderCorrida, alimentacao: renderAlimentacao, corpo: renderCorpo, conexoes: renderConexoes })[S.tab](); }
    catch (err) { console.error(err); }
  }
  let rerenderT = null;
  const rerender = () => { clearTimeout(rerenderT); rerenderT = setTimeout(renderTab, 40); };
  let resizeW = window.innerWidth;
  window.addEventListener('resize', () => { if (Math.abs(window.innerWidth - resizeW) > 40) { resizeW = window.innerWidth; rerender(); } });

  /* ---------- peças de interface ---------- */
  const kpi = (lbl, v, d, cls = '') => `<div class="kpi"><span class="label">${lbl}</span><span class="v ${cls}">${v}</span><span class="d">${d}</span></div>`;
  const emptyBox = (t, d) => `<div class="empty"><strong>${t}</strong><span>${d}</span></div>`;
  const loadingKpis = () => kpi('Carregando', '…', 'Buscando seus dados') + kpi('', '', '') + kpi('', '', '') + kpi('', '', '');
  function meter(label, val, meta, unit, color, foot, fmt = f0) {
    const pct = meta > 0 ? Math.max(0, Math.min(1, val / meta)) : 0;
    return `<div class="meter"><div class="meter-top"><b>${label}</b><span>${fmt(val)} / ${fmt(meta)}${unit ? ' ' + unit : ''}</span></div><div class="progress" role="progressbar" aria-valuemin="0" aria-valuemax="100" aria-valuenow="${Math.round(pct * 100)}" aria-label="${esc(label)}"><i style="width:${(pct * 100).toFixed(1)}%;background:${color}"></i></div>${foot ? `<div class="foot">${foot}</div>` : ''}</div>`;
  }
  const chipG = g => `<span class="chip"><span class="gdot" style="background:${gcor(g)}"></span>${esc(g)}</span>`;
  const fonteChip = f => f === 'notion' ? '<span class="chip">Notion</span>' : f === 'strava' ? '<span class="chip warn">Strava</span>' : f === 'growth' ? '<span class="chip good">Growth</span>' : f === 'claude' ? '<span class="chip info">Claude</span>' : f === 'ia' ? '<span class="chip info">IA</span>' : '<span class="chip info">App</span>';
  const editBtn = ids => `<button class="btn small" type="button" data-act="edit-treino" data-ids="${esc([].concat(ids).join(','))}">Editar</button>`;
  const edBtn = (col, id, label = 'Editar') => `<button class="btn small${label === 'Editar' ? '' : ' ghost'}" type="button" data-act="ed" data-col="${col}" data-id="${esc(id)}" aria-label="Editar">${label}</button>`;
  const delBtn = (col, ids, label = 'Apagar') => `<button class="btn small ghost" type="button" data-act="del" data-col="${col}" data-ids="${esc([].concat(ids).join(','))}">${label}</button>`;
  function armar(btn, fn) {
    if (btn.dataset.armed) { delete btn.dataset.armed; btn.textContent = btn.dataset.old; btn.classList.remove('danger'); fn(); return; }
    btn.dataset.armed = '1'; btn.dataset.old = btn.textContent; btn.textContent = 'Confirmar?'; btn.classList.add('danger');
    setTimeout(() => { if (btn.isConnected && btn.dataset.armed) { delete btn.dataset.armed; btn.textContent = btn.dataset.old; btn.classList.remove('danger'); } }, 3500);
  }

  /* ---------- gráficos (SVG desenhado na largura real do painel) ---------- */
  function niceStep(range, n) { const raw = range / Math.max(1, n); const p = Math.pow(10, Math.floor(Math.log10(raw || 1))); const f = raw / p; return (f <= 1 ? 1 : f <= 2 ? 2 : f <= 2.5 ? 2.5 : f <= 5 ? 5 : 10) * p; }
  const ticks = (a, b, n) => { const s = niceStep(b - a, n); const out = []; for (let v = Math.ceil(a / s) * s; v <= b + 1e-9; v += s) out.push(+v.toFixed(6)); return out; };
  const chartW = el => Math.max(300, Math.min(760, Math.round(el.clientWidth || 640)));
  function barChart(el, cols, o = {}) {
    const W = chartW(el), H = o.H || 210, m = { l: o.ml || 40, r: 10, t: 18, b: 28 };
    const tot = c => c.segs.reduce((a, s) => a + (s.v || 0), 0);
    let ymax = Math.max(o.minMax || 1, ...cols.map(tot), (o.meta || 0) * 1.12);
    let tk = ticks(0, ymax, 4); if (o.int) tk = tk.filter(Number.isInteger);
    ymax = Math.max(ymax, tk[tk.length - 1] || 1);
    const bw = (W - m.l - m.r) / cols.length;
    const sy = v => m.t + (ymax - v) / ymax * (H - m.t - m.b);
    const fmt = o.fmt || f0;
    const g = [];
    for (const v of tk) g.push(`<line class="grid" x1="${m.l}" x2="${W - m.r}" y1="${sy(v)}" y2="${sy(v)}"/><text class="ax" x="${m.l - 7}" y="${sy(v) + 4}" text-anchor="end">${fmt(v)}</text>`);
    const every = Math.max(1, Math.ceil(cols.length / Math.max(2, Math.floor((W - m.l) / 46))));
    cols.forEach((c, i) => {
      const x = m.l + i * bw + bw * 0.16, wd = bw * 0.68;
      let acc = 0;
      for (const s of c.segs) {
        if (!s.v) continue;
        const y0 = sy(acc), y1 = sy(acc + s.v);
        g.push(`<rect class="bar ${s.cls || ''}" x="${x.toFixed(1)}" y="${y1.toFixed(1)}" width="${wd.toFixed(1)}" height="${Math.max(1, y0 - y1).toFixed(1)}" rx="3"><title>${esc(s.title || '')}</title></rect>`);
        acc += s.v;
      }
      const t = tot(c);
      if (t && o.vals !== false && bw > 20) g.push(`<text class="val" x="${x + wd / 2}" y="${sy(t) - 5}" text-anchor="middle">${fmt(t)}</text>`);
      if ((cols.length - 1 - i) % every === 0) g.push(`<text class="ax" x="${x + wd / 2}" y="${H - 8}" text-anchor="middle">${esc(c.label)}</text>`);
    });
    if (o.meta) g.push(`<line class="ref" x1="${m.l}" x2="${W - m.r}" y1="${sy(o.meta)}" y2="${sy(o.meta)}"/>` + (o.metaLabel === '' ? '' : `<text class="axl" x="${m.l + 4}" y="${sy(o.meta) - 5}" text-anchor="start">${esc(o.metaLabel || 'meta')}</text>`));
    el.innerHTML = `<svg viewBox="0 0 ${W} ${H}" role="img" aria-label="${esc(o.aria || '')}">${g.join('')}</svg>`;
  }
  function lineChart(el, pts, o = {}) {
    const W = chartW(el), H = o.H || 230, m = { l: o.ml || 50, r: 18, t: 18, b: 28 };
    const fmt = o.fmt || f1;
    let vmin = Math.min(...pts.map(p => p.v)), vmax = Math.max(...pts.map(p => p.v));
    if (o.meta != null) { vmin = Math.min(vmin, o.meta); vmax = Math.max(vmax, o.meta); }
    const pv = Math.max((vmax - vmin) * 0.18, o.minPad || 1);
    let lo = vmin - pv, hi = vmax + pv;
    const tk = ticks(lo, hi, 4); lo = Math.min(lo, tk[0]); hi = Math.max(hi, tk[tk.length - 1]);
    const t0 = pts[0].t, t1 = pts[pts.length - 1].t;
    const span = Math.max(t1 - t0, 1), tp = span * 0.04;
    const sx = t => pts.length === 1 ? (m.l + W - m.r) / 2 : m.l + (t - t0 + tp) / (span + 2 * tp) * (W - m.l - m.r);
    const sy = v => m.t + (hi - v) / (hi - lo) * (H - m.t - m.b);
    const g = [];
    for (const v of tk) g.push(`<line class="grid" x1="${m.l}" x2="${W - m.r}" y1="${sy(v)}" y2="${sy(v)}"/><text class="ax" x="${m.l - 7}" y="${sy(v) + 4}" text-anchor="end">${fmt(v)}</text>`);
    const nL = Math.min(pts.length, Math.max(2, Math.floor((W - m.l) / 70)));
    const idxs = [];
    for (let i = 0; i < nL; i++) idxs.push(nL === 1 ? 0 : Math.round(i * (pts.length - 1) / (nL - 1)));
    const xs = [];
    for (const idx of [...new Set(idxs)].reverse()) {
      const p = pts[idx], x = sx(p.t);
      if (xs.some(v => Math.abs(v - x) < 50)) continue; xs.push(x);
      g.push(`<text class="ax" x="${x}" y="${H - 8}" text-anchor="${idx === 0 && pts.length > 1 ? 'start' : idx === pts.length - 1 && pts.length > 1 ? 'end' : 'middle'}">${esc(p.x)}</text>`);
    }
    if (o.meta != null) g.push(`<line class="ref" x1="${m.l}" x2="${W - m.r}" y1="${sy(o.meta)}" y2="${sy(o.meta)}"/><text class="axl" x="${m.l + 4}" y="${sy(o.meta) - 5}" text-anchor="start">${esc(o.metaLabel || 'meta')}</text>`);
    const d = pts.map((p, i) => `${i ? 'L' : 'M'}${sx(p.t).toFixed(1)},${sy(p.v).toFixed(1)}`).join(' ');
    if (pts.length > 1) g.push(`<path class="ar ${o.cls}" d="${d} L${sx(t1).toFixed(1)},${sy(lo)} L${sx(t0).toFixed(1)},${sy(lo)} Z"/><path class="ln ${o.cls}" d="${d}"/>`);
    pts.forEach((p, i) => {
      const last = i === pts.length - 1;
      if (pts.length <= 40 || last) g.push(`<circle class="pt ${o.cls}" cx="${sx(p.t).toFixed(1)}" cy="${sy(p.v).toFixed(1)}" r="${last ? 5 : 3.5}"><title>${esc(p.title || '')}</title></circle>`);
    });
    const lp = pts[pts.length - 1];
    g.push(`<text class="val" x="${sx(lp.t) - 8}" y="${sy(lp.v) - 10}" text-anchor="end">${fmt(lp.v)}${o.unit ? ' ' + o.unit : ''}</text>`);
    el.innerHTML = `<svg viewBox="0 0 ${W} ${H}" role="img" aria-label="${esc(o.aria || '')}">${g.join('')}</svg>`;
  }
  function semanas(n) { const ws0 = weekStartIso(todayIso()); const out = []; for (let i = n - 1; i >= 0; i--) out.push(addDays(ws0, -7 * i)); return out; }

  /* ================= PAINEL ================= */
  function renderPainel() {
    const hoje = todayIso(), ws = weekStartIso(hoje), mes = hoje.slice(0, 7), M = S.metas;
    const ss = sess(), rs = corridasArr();
    const trSem = ss.filter(s => s.data >= ws && s.data <= hoje), trMes = ss.filter(s => s.data.startsWith(mes));
    const rsSem = rs.filter(r => r.data >= ws && r.data <= hoje);
    const kmSem = rsSem.reduce((a, r) => a + r.km, 0);
    const ps = pesosArr(), pAt = ps[ps.length - 1];
    const tot = totaisDia(hoje);
    let pesoD = 'Registre na aba Corpo';
    if (pAt) {
      const lim = addDays(pAt.data, -28);
      const ref = [...ps].reverse().find(p => p.data <= lim) || ps[0];
      if (ref && ref !== pAt) { const d = pAt.peso - ref.peso; pesoD = `${d > 0 ? '+' : d < 0 ? '−' : ''}${f1(Math.abs(d))} kg desde ${toBRs(ref.data)}`; }
      else pesoD = `pesado em ${toBRs(pAt.data)}`;
    }
    const ocAl = S.amigo && !S.amigo.compartilha.alimentacao, ocCo = S.amigo && !S.amigo.compartilha.corpo;
    $('kpis').innerHTML = !S.any ? loadingKpis() :
      kpi('Treinos na semana', `${trSem.length}<small> de ${M.treinos_semana}</small>`, `${trMes.length} em ${MESES[+mes.slice(5) - 1]}`, trSem.length >= M.treinos_semana ? 'good' : '') +
      kpi('Corrida na semana', `${f1(kmSem)} km`, `meta ${f1(M.km_semana)} km · ${rsSem.length} corrida${rsSem.length === 1 ? '' : 's'}`, kmSem > 0 && kmSem >= M.km_semana ? 'good' : '') +
      (ocCo ? kpi('Peso', '—', 'não compartilhado') : kpi('Peso', pAt ? `${f1(pAt.peso)} kg` : '—', pesoD)) +
      (ocAl ? kpi('Calorias hoje', '—', 'não compartilhado') : kpi('Calorias hoje', `${f0(tot.kcal)}<small> de ${f0(M.kcal)}</small>`, `proteína ${f0(tot.prot)} de ${f0(M.prot)} g`));

    // constância
    const ws12 = semanas(12);
    const cols = ws12.map(w => {
      const fim = addDays(w, 6);
      const ng = ss.filter(s => s.data >= w && s.data <= fim).length;
      const nr = rs.filter(r => r.data >= w && r.data <= fim).length;
      return { label: toBRs(w), segs: [{ v: ng, cls: 'gym', title: `Semana de ${toBRs(w)}: ${ng} treino(s) de musculação` }, { v: nr, cls: 'run', title: `Semana de ${toBRs(w)}: ${nr} corrida(s)` }] };
    });
    if (!ss.length && !rs.length) $('chart-const').innerHTML = emptyBox('Nada registrado ainda', 'Sincronize o Notion na aba Conexões ou registre um treino.');
    else barChart($('chart-const'), cols, { int: true, minMax: 2, meta: M.treinos_semana, metaLabel: '', aria: 'Treinos e corridas por semana nas últimas 12 semanas.' });

    renderHoje();
    // peso
    const pp = $('chart-peso-p');
    if (!ps.length) pp.innerHTML = emptyBox('Sem pesagens ainda', 'Registre seu peso na aba Corpo para ver a curva aqui.');
    else lineChart(pp, ps.map(p => ({ t: dateOf(p.data).getTime(), v: p.peso, x: toBRs(p.data), title: `${toBR(p.data)}: ${f1(p.peso)} kg` })), { cls: 'body', unit: 'kg', meta: nn(S.perfil.peso_meta), metaLabel: 'meta', aria: `Peso ao longo do tempo, último ${pAt ? f1(pAt.peso) : ''} kg.` });
    $('pesop-sub').textContent = ps.length ? `${ps.length} pesagem${ps.length === 1 ? '' : 's'}${nn(S.perfil.peso_meta) ? ` · meta ${f1(S.perfil.peso_meta)} kg` : ''}.` : 'Cada pesagem registrada na aba Corpo.';
    renderGrupos();
    // calorias semana
    const dias7 = []; for (let i = 6; i >= 0; i--) dias7.push(addDays(hoje, -i));
    const temComida = dias7.some(d => totaisDia(d).n);
    if (!temComida) $('chart-kcal-p').innerHTML = emptyBox('Sem refeições nesta semana', 'Registre o que comeu na aba Alimentação.');
    else barChart($('chart-kcal-p'), dias7.map(d => { const t = totaisDia(d); return { label: DOW[(dateOf(d).getDay() + 6) % 7], segs: [{ v: Math.round(t.kcal), cls: 'food', title: `${toBR(d)}: ${f0(t.kcal)} kcal, ${f0(t.prot)} g de proteína` }] }; }), { meta: M.kcal, metaLabel: `meta ${f0(M.kcal)}`, ml: 46, aria: 'Calorias por dia nos últimos 7 dias.' });
    renderMetasBox(trSem.length, kmSem);
  }

  function renderHoje() {
    const hoje = todayIso(), M = S.metas;
    const ss = sess().filter(s => s.data === hoje), rs = corridasArr().filter(r => r.data === hoje);
    const tot = totaisDia(hoje), agua = aguaDia(hoje), sug = sugestaoGrupo();
    $('hoje-sub').textContent = cap(diaLongo(hoje));
    const km = rs.reduce((a, r) => a + r.km, 0), seg = rs.reduce((a, r) => a + r.seg, 0);
    const it = (ok, t, s, r) => `<div class="ti"><span class="ic ${ok ? 'ok' : ''}" aria-hidden="true">${ok ? '✓' : ''}</span><div class="t"><b>${t}</b><span>${s}</span></div><div class="r">${r}</div></div>`;
    const F = S.tForm, andamento = temConteudo(F), nMarc = andamento ? F.exs.filter(e => e.feito).length : 0;
    const subMusc = [ss.length ? 'Feito: ' + ss.map(s => esc(s.grupo)).join(' + ') : '', andamento ? (F.editando ? `Editando o treino de ${esc(F.grupo)} de ${toBRs(F.data)}` : `Em andamento: ${esc(F.grupo)}${nMarc ? `, ${nMarc} marcado${nMarc === 1 ? '' : 's'}` : ''} (ainda não salvo)`) : ''].filter(Boolean).join(' · ')
      || `Sugestão: ${esc(sug.grupo)} (${sug.dias == null ? 'sem registro' : sug.dias === Infinity ? 'ainda não treinado' : `parado há ${sug.dias} dias`})`;
    const btnMusc = andamento ? '<button class="btn small primary" type="button" data-act="go" data-tab="treinos" data-focus="f-treino">Continuar</button>'
      : `<button class="btn small" type="button" data-act="go" data-tab="treinos" data-g="${esc(ss.length ? '' : sug.grupo)}">${ss.length ? 'Ver' : 'Registrar'}</button>`;
    $('hoje-box').innerHTML = `<div class="today-list">
      ${it(ss.length, 'Musculação', subMusc, btnMusc)}
      ${it(rs.length, 'Corrida', rs.length ? `${f1(km)} km${seg ? ` · pace ${fmtPace(seg / km)}` : ''}` : 'Nenhuma corrida hoje', rs.length ? `${f1(km)} km` : '')}
      ${S.amigo && !S.amigo.compartilha.alimentacao ? it(false, 'Alimentação', 'Não compartilhada com o grupo', '') : `
      ${it(M.kcal && tot.kcal >= M.kcal * 0.9, 'Calorias', `${f0(tot.kcal)} de ${f0(M.kcal)} kcal`, `${M.kcal ? Math.round(tot.kcal / M.kcal * 100) : 0}%`)}
      ${it(M.prot && tot.prot >= M.prot * 0.95, 'Proteína', `${f0(tot.prot)} de ${f0(M.prot)} g`, `${M.prot ? Math.round(tot.prot / M.prot * 100) : 0}%`)}
      ${it(M.agua_ml && agua >= M.agua_ml, 'Água', `${f1(agua / 1000)} de ${f1(M.agua_ml / 1000)} L`, S.amigo ? '' : `<button class="btn small" type="button" data-act="agua" data-ml="250" data-dia="${hoje}">+250 ml</button>`)}`}
    </div>
    <div class="btn-row" style="margin-top:12px"><button class="btn" type="button" data-act="go" data-tab="alimentacao">Adicionar refeição</button><button class="btn ghost" type="button" data-act="go" data-tab="corpo">Registrar peso</button></div>`;
  }

  function renderGrupos() {
    const box = $('grupos-box'), hoje = todayIso(), ini = addDays(hoje, -90);
    const ss = sess();
    if (!ss.length) { box.innerHTML = emptyBox('Sem treinos registrados', 'Os grupos aparecem quando o Diário do Notion for importado ou você registrar um treino.'); return; }
    const gs = [...new Set([...GRUPOS_BASE, ...gruposFicha(), ...ss.map(s => s.grupo)])];
    const ult = ultimoPorGrupo();
    const rows = gs.map(g => ({ g, n: ss.filter(s => s.grupo === g && s.data >= ini).length, dias: ult[g] ? daysBetween(ult[g], hoje) : null }))
      .filter(r => r.n || GRUPOS_BASE.includes(r.g) || r.dias != null && r.dias < 365);
    rows.sort((a, b) => b.n - a.n);
    const max = Math.max(1, ...rows.map(r => r.n));
    box.innerHTML = `<div class="hbars">${rows.map(r => {
      const cls = r.dias == null || r.dias > 30 ? 'bad' : r.dias > 14 ? 'warn' : 'good';
      const txt = r.dias == null ? 'nunca registrado' : r.dias === 0 ? 'hoje' : r.dias === 1 ? 'ontem' : `há ${r.dias} dias`;
      return `<div class="hb"><div class="hb-top"><b><span class="gdot" style="background:${gcor(r.g)};margin-right:6px"></span>${esc(r.g)}</b><span>${r.n} treino${r.n === 1 ? '' : 's'} <span class="chip ${cls}" style="margin-left:6px">${txt}</span></span></div><div class="hb-track"><i style="width:${Math.max(r.n ? 3 : 0, r.n / max * 100)}%;background:${gcor(r.g)}"></i></div></div>`;
    }).join('')}</div>`;
  }

  function renderMetasBox(nSem, kmSem) {
    const M = S.metas, hoje = todayIso();
    const dias = []; for (let i = 0; i < 7; i++) dias.push(addDays(hoje, -i));
    const comLog = dias.map(totaisDia).filter(t => t.n);
    const protMed = comLog.length ? comLog.reduce((a, t) => a + t.prot, 0) / comLog.length : null;
    const ps = pesosArr(), meta = nn(S.perfil.peso_meta);
    let pesoHtml;
    if (!meta || !ps.length) pesoHtml = `<div class="meter"><div class="meter-top"><b>Peso meta</b><span>—</span></div><div class="foot">${!meta ? 'Defina o peso meta no Perfil (aba Corpo).' : 'Registre seu peso na aba Corpo.'}</div></div>`;
    else {
      const ini = ps[0].peso, at = ps[ps.length - 1].peso;
      const total = Math.abs(meta - ini), feito = Math.sign(meta - ini) === Math.sign(at - ini) ? Math.abs(at - ini) : 0;
      const pct = total > 0 ? Math.min(1, feito / total) : (Math.abs(at - meta) < 0.3 ? 1 : 0);
      const falta = meta - at;
      pesoHtml = `<div class="meter"><div class="meter-top"><b>Peso meta</b><span>${f1(at)} → ${f1(meta)} kg</span></div><div class="progress"><i style="width:${(pct * 100).toFixed(1)}%;background:var(--c-body)"></i></div><div class="foot">${Math.abs(falta) < 0.3 ? 'Meta atingida.' : `Faltam ${f1(Math.abs(falta))} kg para ${falta > 0 ? 'ganhar' : 'perder'}.`}</div></div>`;
    }
    $('metas-box').innerHTML = `<div class="meters">
      ${meter('Treinos nesta semana', nSem, M.treinos_semana, '', 'var(--c-gym)', nSem >= M.treinos_semana ? 'Meta da semana batida.' : `Faltam ${M.treinos_semana - nSem}.`)}
      ${meter('Km nesta semana', kmSem, M.km_semana, 'km', 'var(--c-run)', kmSem >= M.km_semana ? 'Meta da semana batida.' : `Faltam ${f1(M.km_semana - kmSem)} km.`, f1)}
      ${protMed == null ? `<div class="meter"><div class="meter-top"><b>Proteína (média 7 dias)</b><span>—</span></div><div class="foot">Aparece quando houver refeições registradas.</div></div>` : meter('Proteína (média 7 dias)', protMed, M.prot, 'g', 'var(--c-prot)', `Média dos ${comLog.length} dia(s) com registro.`)}
      ${pesoHtml}
    </div>
    <div class="btn-row" style="margin-top:14px"><button class="btn small" type="button" data-act="go" data-tab="alimentacao" data-focus="f-metas">Editar metas</button>${S.metasSalvas ? '' : '<span class="muted">Metas padrão: ajuste para você.</span>'}</div>`;
  }

  /* ================= TREINOS ================= */
  /* muda quando chegam fichas ou treinos: um formulário ainda intocado é refeito com a última carga certa */
  function formSig() { return `${S.fichas.size}|${S.treinos.size}|${S.loaded.treinos ? 1 : 0}|${S.loaded.fichas ? 1 : 0}`; }
  function newTForm(grupo, data) {
    const g = grupo || sugestaoGrupo().grupo || gruposFicha()[0] || 'Outro';
    const exs = fichasDoGrupo(g).map(f => {
      const u = ultimaVez(f.nome);
      return { key: f.id, nome: f.nome, det: f.detalhe, ultima: u, feito: false, carga: u && u.carga != null ? u.carga : f.carga ?? '', series: f.series ?? '', reps: u && u.reps != null ? u.reps : f.reps ?? '', sets: setsForm(u && u.sets), extra: false, app: f.fonte === 'app' };
    });
    const dia = isoOk(data) || todayIso();
    S.tForm = { id: uid('t'), data: dia, grupo: g, grupoAuto: !grupo, dataManual: dia !== todayIso(), dur: '', obs: '', exs, touched: false, vivo: false, salvando: false, atualizado: 0, recuperado: false, sig: formSig() };
  }
  function grupoOptions(sel) {
    const gs = [...new Set([...gruposFicha(), ...GRUPOS_BASE, 'Outro'])];
    if (sel && !gs.includes(sel)) gs.push(sel);
    return gs.map(g => `<option ${g === sel ? 'selected' : ''}>${esc(g)}</option>`).join('');
  }
  function renderTForm() {
    const F = S.tForm, ed = !!F.editando;
    $('t-data').value = F.data; $('t-data').classList.remove('invalid'); $('t-grupo').innerHTML = grupoOptions(F.grupo);
    $('t-dur').value = F.dur; $('t-obs').value = F.obs;
    $('t-save').disabled = !!F.salvando;
    $('h-tform').textContent = ed ? 'Editando treino' : 'O que você fez hoje';
    $('t-save').textContent = ed ? 'Salvar alterações' : 'Salvar treino';
    const rb = $('t-reset'); if (!rb.dataset.armed) rb.textContent = ed ? 'Cancelar edição' : 'Limpar';
    const el = $('t-edit');
    if (ed) { el.textContent = `Você está editando o treino de ${F.grupo} de ${toBR(F.data)}. “Salvar alterações” troca o que estava salvo; “Cancelar edição” deixa como estava.${F.apagar && F.apagar.length ? ` Este dia tinha ${F.apagar.length + 1} registros de ${F.grupo}: ao salvar, viram um só.` : ''}`; el.hidden = false; }
    else el.hidden = true;
    renderTExs(); mostrarRascunho();
  }
  function renderTExs() {
    const F = S.tForm;
    $('t-exs').innerHTML = F.exs.length ? F.exs.map((e, i) => {
      const sub = e.extra ? `Novo: fica na ficha de ${F.grupo} ao salvar` : [e.solto ? `Fora da ficha de ${F.grupo}` : '', e.app ? 'Adicionado por você' : '', e.det ? 'Ficha: ' + e.det : '', e.ultima ? `Última: ${e.ultima.sets ? fmtSets(e.ultima.sets) : (e.ultima.carga != null ? f1(e.ultima.carga) + ' kg' : 'feito') + (e.ultima.reps ? ' × ' + e.ultima.reps : '')} em ${toBRs(e.ultima.data)}` : ''].filter(Boolean).join(' · ');
      return `<div class="ex ${e.feito ? 'on' : ''}" data-i="${i}">
        <label class="ex-check"><input type="checkbox" data-k="feito" ${e.feito ? 'checked' : ''} aria-label="Fiz ${esc(e.nome || 'exercício')}">
          ${e.extra ? `<input class="ex-nome" data-k="nome" value="${esc(e.nome)}" placeholder="Nome do exercício" aria-label="Nome do exercício">` : `<b>${esc(e.nome)}</b>`}
          <small>${esc(sub)}</small></label>
        ${e.sets ? `<div class="ex-sets">${e.sets.map((st, j) => `<div class="set ex-nums" data-s="${j}"><span class="sn">${j + 1}ª</span>
            <label><span>kg</span><input data-sk="carga" inputmode="decimal" value="${esc(fIn(st.carga))}" aria-label="Carga da série ${j + 1}"></label>
            <label><span>Reps</span><input class="w2" data-sk="reps" inputmode="numeric" value="${esc(fIn(st.reps))}" aria-label="Repetições da série ${j + 1}"></label>
            <button type="button" class="btn small ghost" data-set="rm" aria-label="Tirar a série ${j + 1}">×</button></div>`).join('')}
          <div class="btn-row"><button type="button" class="btn small" data-set="add">+ série</button><button type="button" class="btn small ghost" data-set="off">Carga única</button></div></div>`
        : `<div class="ex-nums-wrap"><div class="ex-nums">
          <label><span>kg</span><input data-k="carga" inputmode="decimal" value="${esc(fIn(e.carga))}" aria-label="Carga em kg"></label>
          <label><span>Séries</span><input class="w2" data-k="series" inputmode="numeric" value="${esc(fIn(e.series))}" aria-label="Séries"></label>
          <label><span>Reps</span><input class="w2" data-k="reps" inputmode="numeric" value="${esc(fIn(e.reps))}" aria-label="Repetições"></label>
        </div><button type="button" class="btn small ghost ex-more" data-set="on">Carga por série</button></div>`}</div>`;
    }).join('') : emptyBox('Sem ficha para este grupo', 'Use “+ Adicionar exercício” para anotar o que fez: ele passa a aparecer nos próximos treinos deste grupo. Ou só salve o treino com o grupo.');
    updTCount();
  }
  function updTCount() { const n = S.tForm.exs.filter(e => e.feito).length; $('t-count').textContent = n ? `${n} marcado${n === 1 ? '' : 's'}` : ''; }
  function onTExs(e) {
    const row = e.target.closest('.ex'); if (!row) return;
    const ex = S.tForm.exs[+row.dataset.i]; const k = e.target.dataset.k, sk = e.target.dataset.sk;
    if (ex && sk && ex.sets) {
      const st = ex.sets[+e.target.closest('.set').dataset.s]; if (!st) return;
      st[sk] = e.target.value; e.target.classList.remove('invalid');
      if (e.target.value !== '' && !ex.feito) { ex.feito = true; row.querySelector('[data-k="feito"]').checked = true; }
      row.classList.toggle('on', ex.feito); updTCount(); marcarTreino(); return;
    }
    if (!ex || !k) return;
    if (k === 'feito') ex.feito = e.target.checked;
    else { e.target.classList.remove('invalid'); ex[k] = e.target.value; if (k !== 'nome' && e.target.value !== '' && !ex.feito) { ex.feito = true; row.querySelector('[data-k="feito"]').checked = true; } }
    row.classList.toggle('on', ex.feito);
    updTCount(); marcarTreino();
  }
  $('t-exs').addEventListener('input', onTExs);
  $('t-exs').addEventListener('change', onTExs);
  $('t-exs').addEventListener('click', e => {
    const b = e.target.closest('[data-set]'); if (!b) return;
    const ex = S.tForm.exs[+b.closest('.ex').dataset.i]; if (!ex) return;
    const a = b.dataset.set;
    if (a === 'on') { const n = Math.min(10, Math.max(1, Math.round(numOr(ex.series, 3)) || 3)); ex.sets = Array.from({ length: n }, () => ({ carga: fIn(ex.carga), reps: fIn(ex.reps) })); }
    else if (!ex.sets) return;
    else if (a === 'off') {
      const top = ex.sets.reduce((m, x) => (numOr(x.carga, -1) > numOr(m.carga, -1) ? x : m), ex.sets[0]);
      ex.carga = top.carga; ex.reps = top.reps; ex.series = String(ex.sets.length); ex.sets = null;
    }
    else if (a === 'add') { if (ex.sets.length < 12) ex.sets.push({ ...(ex.sets[ex.sets.length - 1] || { carga: '', reps: '' }) }); ex.feito = true; }
    else if (a === 'rm') { ex.sets.splice(+b.closest('.set').dataset.s, 1); if (!ex.sets.length) ex.sets = null; }
    marcarTreino(); renderTExs();
  });
  /* trocar de grupo apagava o que já estava marcado: agora só troca se o treino estiver vazio */
  $('t-grupo').addEventListener('change', e => {
    const F = S.tForm;
    if (F.editando) {
      e.target.value = F.grupo;
      $('t-status').textContent = 'Não dá para mudar o grupo de um treino salvo. Para isso, apague o treino e registre de novo.';
      return;
    }
    if (temConteudo(F)) {
      e.target.value = F.grupo;
      $('t-status').textContent = `Você já anotou exercícios de ${F.grupo}. Para trocar de grupo, salve este treino ou toque em Limpar.`;
      return;
    }
    newTForm(e.target.value, F.dataManual ? F.data : null);
    renderTForm(); $('t-status').textContent = '';
  });
  $('t-data').addEventListener('change', e => { S.tForm.data = e.target.value; S.tForm.dataManual = true; e.target.classList.remove('invalid'); marcarTreino(); });
  $('t-dur').addEventListener('input', e => { S.tForm.dur = e.target.value; e.target.classList.remove('invalid'); marcarTreino(); });
  $('t-obs').addEventListener('input', e => { S.tForm.obs = e.target.value; marcarTreino(); });
  $('t-add').addEventListener('click', () => {
    S.tForm.exs.push({ key: uid('x'), nome: '', det: '', feito: true, carga: '', series: '', reps: '', extra: true }); marcarTreino();
    renderTExs(); const ins = $('t-exs').querySelectorAll('.ex-nome'); if (ins.length) ins[ins.length - 1].focus();
  });
  /* Limpar fica ao lado de Salvar: com algo anotado, pede um segundo toque. Na edição vira "Cancelar edição". */
  $('t-reset').addEventListener('click', e => {
    const F = S.tForm;
    if (F.salvando) return;
    if (F.editando) {
      const cancelar = () => { apagarRascunho(true); newTForm(null); renderTForm(); $('t-status').textContent = 'Edição cancelada: o treino salvo continua como estava.'; };
      if (!F.vivo) return cancelar();
      return armar(e.currentTarget, cancelar);
    }
    const limpar = () => { apagarRascunho(true); newTForm(F.grupoAuto ? null : F.grupo, F.dataManual ? F.data : null); renderTForm(); $('t-status').textContent = ''; };
    if (!temConteudo(F)) return limpar();
    armar(e.currentTarget, limpar);
  });
  function falhaTreino(err) {
    const c = err && err.code;
    if (c === 'quota_exceeded') return 'Não salvou: o espaço do banco está cheio. O treino continua guardado aqui.';
    if (c === 'not_granted' || c === 'invalid_argument') return 'Não salvou: sem permissão. Saia e entre de novo na sua conta. O treino continua guardado.';
    return 'Sem internet agora. O treino ficou guardado no aparelho e sobe sozinho quando a conexão voltar.';
  }
  /* confere o formulário e monta o que vai ser salvo; devolve null (com o aviso na tela) se algo estiver errado */
  function prepararTreino(F, t0) {
    if (!isoOk(F.data)) { $('t-data').classList.add('invalid'); $('t-status').textContent = 'Escolha a data do treino.'; return null; }
    $('t-data').classList.remove('invalid');
    /* número que não dá para ler (ex.: "12-10-8") era descartado em silêncio: agora avisa */
    let ruim = 0;
    F.exs.forEach((x, i) => {
      if (!x.feito) return;
      if (x.sets) { x.sets.forEach((st, j) => { for (const k of ['carga', 'reps']) {
        if (String(st[k] ?? '').trim() === '' || !Number.isNaN(parseNum(st[k]))) continue;
        ruim++; const inp = $('t-exs').querySelector(`.ex[data-i="${i}"] .set[data-s="${j}"] [data-sk="${k}"]`); if (inp) inp.classList.add('invalid');
      } }); return; }
      for (const k of ['carga', 'series', 'reps']) {
        if (String(x[k] ?? '').trim() === '' || !Number.isNaN(parseNum(x[k]))) continue;
        ruim++; const inp = $('t-exs').querySelector(`.ex[data-i="${i}"] [data-k="${k}"]`); if (inp) inp.classList.add('invalid');
      }
    });
    const durRuim = String(F.dur ?? '').trim() !== '' && Number.isNaN(parseNum(F.dur));
    $('t-dur').classList.toggle('invalid', durRuim);
    if (ruim || durRuim) { $('t-status').textContent = 'Use só números em kg, séries, reps e duração (ex.: 12 ou 22,5). Confira os campos em vermelho.'; return null; }
    /* com cargas por série: guarda cada série; carga/reps ficam as da série mais pesada (para "última carga" e gráficos) */
    const exDoc = x => {
      const o = { nome: String(x.nome).trim(), carga: numOr(x.carga), series: numOr(x.series), reps: numOr(x.reps) };
      const ss = x.sets ? x.sets.map(st => ({ carga: numOr(st.carga), reps: numOr(st.reps) })).filter(st => st.carga != null || st.reps != null) : [];
      if (ss.length) { const top = ss.reduce((m, st) => ((st.carga ?? -1) > (m.carga ?? -1) ? st : m), ss[0]); o.sets = ss; o.carga = top.carga; o.series = ss.length; o.reps = top.reps; }
      return o;
    };
    const exs = F.exs.filter(x => x.feito && String(x.nome).trim()).map(exDoc);
    /* exercícios adicionados entram na ficha do grupo e aparecem nos próximos treinos */
    const doGrupo = fichasArr().filter(f => f.grupo === F.grupo);
    const ja = new Set(fichasDoGrupo(F.grupo).map(f => normNome(f.nome)));
    let ord = doGrupo.length ? Math.max(...doGrupo.map(f => f.ordem)) : 90000 + gruposFicha().length * 100;
    const novos = [];
    for (const x of F.exs) {
      const nome = x.extra ? String(x.nome).trim() : ''; if (!nome) continue;
      const k = normNome(nome); if (ja.has(k)) continue; ja.add(k);
      const xd = exDoc(x);
      novos.push(['a-' + slugify(F.grupo) + '-' + k, { grupo: F.grupo, nome, detalhe: '', carga: xd.carga, series: xd.series, reps: xd.reps, fav: false, ordem: ++ord, fonte: 'app', criado: t0 }]);
    }
    return { exs, novos };
  }

  /* "Tem certeza?": mostra o resumo antes de gravar */
  let tcAberto = 0, tcForm = null;
  const fmtSR = x => x.series && x.reps ? `${x.series}×${x.reps}` : x.series ? `${x.series} séries` : x.reps ? `${x.reps} reps` : '';
  function abrirConfirmacao(F, prep) {
    const hoje = todayIso(), marc = prep.exs, ed = !!F.editando;
    const semMarcar = F.exs.filter(x => !x.feito && !x.extra && !x.solto).length;
    const dur = numOr(F.dur), obs = String(F.obs ?? '').trim();
    $('tc-sub').textContent = ed ? `Salvar as alterações no treino de ${F.grupo}?` : `Salvar o treino de ${F.grupo}?`;
    $('tc-body').innerHTML = `<div style="display:grid;gap:10px">
      <div class="calc-preview"><span>${esc(F.grupo)}</span><span>${toBR(F.data)}${F.data !== hoje ? ' (não é hoje)' : ''}</span>${dur ? `<span>${f0(dur)} min</span>` : ''}<span>${marc.length} exercício${marc.length === 1 ? '' : 's'}</span></div>
      ${marc.length ? `<ul>${marc.map(x => `<li><b>${esc(x.nome)}</b>${x.sets ? ` · ${fmtSets(x.sets)}` : (x.carga != null ? ` · ${f1(x.carga)} kg` : '') + (fmtSR(x) ? ` · ${fmtSR(x)}` : '')}</li>`).join('')}</ul>` : '<p class="note warn">Nenhum exercício marcado: o treino vai ser salvo só com o grupo.</p>'}
      ${semMarcar ? `<p class="muted" style="margin:0">${semMarcar} exercício${semMarcar === 1 ? '' : 's'} da ficha ${semMarcar === 1 ? 'ficou' : 'ficaram'} sem marcar.</p>` : ''}
      ${prep.novos.length ? `<p class="muted" style="margin:0">Entra${prep.novos.length === 1 ? '' : 'm'} na ficha de ${esc(F.grupo)}: ${esc(prep.novos.map(n => n[1].nome).join(', '))}.</p>` : ''}
      ${obs ? `<p class="muted" style="margin:0">Como foi: ${esc(obs)}</p>` : ''}
      ${ed && F.apagar && F.apagar.length ? `<p class="muted" style="margin:0">Os ${F.apagar.length + 1} registros de ${esc(F.grupo)} deste dia viram um só.</p>` : ''}
    </div>`;
    $('tc-ok').textContent = ed ? 'Sim, salvar alterações' : 'Sim, salvar treino';
    tcForm = F; tcAberto = Date.now();
    $('t-confirm').hidden = false; document.body.style.overflow = 'hidden';
    $('t-confirm').querySelector('.modal-card').focus();
  }
  function fecharConfirmacao() { $('t-confirm').hidden = true; document.body.style.overflow = ''; tcForm = null; }
  $('tc-back').addEventListener('click', () => { fecharConfirmacao(); $('t-save').focus(); });
  /* um toque duplo em Salvar não confirma sozinho: o "Sim" só vale meio segundo depois de a tela abrir */
  $('tc-ok').addEventListener('click', () => {
    if (Date.now() - tcAberto < 500) return;
    const F = tcForm; fecharConfirmacao();
    if (F && F === S.tForm) salvarTreino(F);
  });
  $('t-confirm').addEventListener('click', e => { if (e.target === e.currentTarget && Date.now() - tcAberto > 500) fecharConfirmacao(); });
  document.addEventListener('keydown', e => { if (e.key !== 'Escape') return; if (!$('t-confirm').hidden) fecharConfirmacao(); else if (!$('g-modal').hidden) fecharModal(); });

  $('f-treino').addEventListener('submit', e => {
    e.preventDefault();
    const F = S.tForm;
    if (F.salvando || !$('t-confirm').hidden) return;
    const prep = prepararTreino(F, Date.now()); if (!prep) return;
    abrirConfirmacao(F, prep);
  });

  function salvarTreino(F) {
    if (!F || F.salvando) return;
    const t0 = Date.now();
    const prep = prepararTreino(F, t0); if (!prep) return;
    const { exs, novos } = prep, ed = !!F.editando, apagar = ed ? (F.apagar || []).filter(id => id !== F.id) : [];
    if (!F.atualizado) F.atualizado = t0;
    const doc = { data: F.data, grupo: F.grupo, titulo: F.grupo, exercicios: exs, obs: String(F.obs ?? '').trim(), duracao: numOr(F.dur), fonte: 'app', criado: ed && F.criadoOrig ? F.criadoOrig : t0 };
    if (ed) doc.editado = t0;
    const ant = ed && S.treinos.get(F.id);
    if (ant && ant.notion_enviado) { doc.notion_enviado = ant.notion_enviado; doc.notion_url = ant.notion_url; }
    /* o id do treino nasce com o formulário (ou é o do treino editado): salvar de novo regrava o mesmo treino em vez de duplicar */
    F.salvando = true; $('t-save').disabled = true;
    $('t-status').textContent = 'Salvando…';
    if (rtTimer) enviarRascunho();
    let acabou = false;
    const lento = setTimeout(() => {
      if (acabou) return;
      F.salvando = false; if (S.tForm === F) $('t-save').disabled = false;
      $('t-status').textContent = navigator.onLine ? 'A conexão está lenta. O treino ficou guardado no aparelho e sobe sozinho; se quiser, toque em Salvar de novo (não duplica).' : 'Sem internet: o treino ficou guardado no aparelho e sobe sozinho quando a conexão voltar.';
    }, 20000);
    const pFichas = Promise.allSettled(novos.map(([id, f]) => write('fichas', id, f)));
    write('treinos', F.id, doc).then(() => pFichas).then(rs => {
      acabou = true; clearTimeout(lento); F.salvando = false;
      if (apagar.length) Promise.allSettled(apagar.map(id => write('treinos', id, null, 'delete')));
      if (F.confirmado) return;
      F.confirmado = true;
      const ok = rs.filter(r => r.status === 'fulfilled').length, falhou = rs.length - ok;
      const nv = (ok ? ` ${ok === 1 ? '1 exercício novo entrou' : ok + ' exercícios novos entraram'} na ficha de ${F.grupo}.` : '') + (falhou ? ` ${falhou} não ${falhou === 1 ? 'entrou' : 'entraram'} na ficha: confira a conexão.` : '');
      toast(`Treino de ${F.grupo} ${ed ? 'atualizado' : 'salvo'}.${nv}`);
      S.diaSel = F.data; S.calMes = F.data.slice(0, 7);
      if (S.tForm !== F) return;
      if (F.atualizado > t0) {
        F.confirmado = false; $('t-save').disabled = false;
        if (ed) F.apagar = [];
        $('t-status').textContent = 'Salvo. Você mudou algo depois de tocar em Salvar: toque de novo para atualizar este treino.';
        return;
      }
      apagarRascunho(true);
      newTForm(null); renderTForm();
      $('t-status').innerHTML = `${ed ? 'Atualizado' : 'Salvo'}: ${esc(F.grupo)}, ${exs.length} exercício${exs.length === 1 ? '' : 's'}.${esc(nv)} <button class="btn small" type="button" data-act="edit-treino" data-ids="${esc(F.id)}">Editar este treino</button>${ant && ant.notion_enviado ? '' : ` <button class="btn small" type="button" data-act="notion-send" data-ids="${esc(F.id)}">Enviar ao Notion</button>`}`;
      rerender();
    }).catch(err => {
      acabou = true; clearTimeout(lento); F.salvando = false;
      if (S.tForm === F) { $('t-save').disabled = false; $('t-status').textContent = falhaTreino(err); }
    });
  }

  /* editar um treino já salvo: abre no formulário com o que foi feito marcado; salvar regrava o mesmo treino */
  function ultimaFora(nome, ids) {
    const k = normNome(nome); let best = null;
    for (const t of S.treinos.values()) { if (ids.includes(t.id) || !t.data) continue; for (const e of t.exercicios) if (normNome(e.nome) === k && (!best || t.data > best.data)) best = { ...e, data: t.data }; }
    return best;
  }
  function abrirEdicao(ids) {
    const ts = ids.map(id => S.treinos.get(id)).filter(t => t && t.fonte !== 'notion').sort((a, b) => (a.criado || 0) - (b.criado || 0));
    S.navegou = true; goTab('treinos');
    const irForm = () => setTimeout(() => $('f-treino').scrollIntoView({ behavior: 'smooth', block: 'start' }), 60);
    if (!ts.length) { $('t-status').textContent = 'Esse treino não está mais salvo.'; irForm(); return; }
    const F0 = S.tForm, alvo = ts[0].id, idsT = ts.map(t => t.id);
    if (F0 && F0.editando && F0.id === alvo) { irForm(); return; }
    if (temConteudo(F0)) { $('t-status').textContent = F0.editando ? 'Você já está editando outro treino: salve ou cancele antes de editar este.' : `Treino de ${F0.grupo} em andamento: salve ou limpe antes de editar outro.`; irForm(); return; }
    const grupo = ts[0].grupo, data = ts[0].data;
    const salvos = new Map();                       // o registro mais recente vence
    for (const t of ts) for (const e of t.exercicios) salvos.set(normNome(e.nome), e);
    const usados = new Set();
    const exs = fichasDoGrupo(grupo).map(f => {
      const k = normNome(f.nome), sv = salvos.get(k), u = ultimaFora(f.nome, idsT);
      if (sv) usados.add(k);
      return { key: f.id, nome: f.nome, det: f.detalhe, ultima: u, feito: !!sv,
        carga: sv ? sv.carga ?? '' : (u && u.carga != null ? u.carga : f.carga ?? ''), series: sv ? sv.series ?? '' : f.series ?? '', reps: sv ? sv.reps ?? '' : (u && u.reps != null ? u.reps : f.reps ?? ''), sets: setsForm(sv ? sv.sets : null),
        extra: false, app: f.fonte === 'app' };
    });
    for (const [k, e] of salvos) if (!usados.has(k)) exs.push({ key: uid('x'), nome: e.nome, det: '', ultima: ultimaFora(e.nome, idsT), feito: true, carga: e.carga ?? '', series: e.series ?? '', reps: e.reps ?? '', sets: setsForm(e.sets), extra: false, solto: true });
    const durs = ts.map(t => t.duracao).filter(v => v != null);
    S.tForm = {
      id: alvo, data, grupo, grupoAuto: false, dataManual: true, dur: durs.length ? String(Math.max(...durs)) : '', obs: [...new Set(ts.map(t => t.obs).filter(Boolean))].join(' · '),
      exs, touched: true, vivo: false, salvando: false, atualizado: 0, recuperado: false, sig: formSig(), editando: true, criadoOrig: ts[0].criado || 0, apagar: idsT.slice(1),
    };
    renderTForm(); $('t-status').textContent = ''; irForm();
  }

  function renderTreinos() {
    const F = S.tForm;
    if (!F || (!F.touched && F.sig !== formSig())) { newTForm(F && !F.grupoAuto ? F.grupo : null, F && F.dataManual ? F.data : null); renderTForm(); }
    else { const sel = $('t-grupo'); if (document.activeElement !== sel) sel.innerHTML = grupoOptions(F.grupo); }
    renderCal(); renderFichas(); renderHist();
  }
  function renderCal() {
    const [y, mo] = S.calMes.split('-').map(Number);
    $('h-cal').textContent = `${cap(MESES[mo - 1])} ${y}`;
    const off = (new Date(y, mo - 1, 1).getDay() + 6) % 7, nd = new Date(y, mo, 0).getDate(), hoje = todayIso();
    const byDay = {}; for (const s of sess()) if (s.data.startsWith(S.calMes)) (byDay[s.data] = byDay[s.data] || []).push(s);
    const runs = {}; for (const r of corridasArr()) if (r.data.startsWith(S.calMes)) runs[r.data] = (runs[r.data] || 0) + r.km;
    let h = DOW.map(d => `<div class="dow">${d}</div>`).join('');
    for (let i = 0; i < off; i++) h += '<div class="day out" aria-hidden="true"></div>';
    const usados = new Set();
    for (let d = 1; d <= nd; d++) {
      const iso = `${S.calMes}-${pad(d)}`, ss = byDay[iso] || [], km = runs[iso];
      ss.forEach(s => usados.add(s.grupo));
      const lbl = `${d} de ${MESES[mo - 1]}${ss.length ? ': ' + ss.map(s => s.grupo).join(', ') : ''}${km ? `, corrida ${f1(km)} km` : ''}`;
      h += `<button type="button" class="day ${iso === hoje ? 'today' : ''}" data-d="${iso}" aria-pressed="${iso === S.diaSel}" aria-label="${esc(lbl)}"><span class="n">${d}</span><span class="marks">${ss.map(s => `<i class="m" style="background:${gcor(s.grupo)}" title="${esc(s.grupo)}"></i>`).join('')}${km ? `<span class="km">${f1(km)}</span>` : ''}</span></button>`;
    }
    $('cal').innerHTML = h;
    $('cal-legend').innerHTML = [...usados].map(g => `<span><i class="gdot" style="background:${gcor(g)}"></i>${esc(g)}</span>`).join('') + (Object.keys(runs).length ? '<span><i class="gdot" style="background:var(--c-run);border-radius:3px"></i>Corrida (km)</span>' : '');
    renderDia();
  }
  function renderDia() {
    const iso = S.diaSel, ss = sess().filter(s => s.data === iso), rs = corridasArr().filter(r => r.data === iso);
    const parts = ss.map(s => `<div class="sess"><div class="sess-top"><div class="btn-row">${chipG(s.grupo)}${s.notion ? fonteChip('notion') : ''}${s.appIds.length ? fonteChip('app') : ''}${s.duracao ? `<span class="muted">${f0(s.duracao)} min</span>` : ''}</div>${s.appIds.length ? `<div class="btn-row">${s.enviado && !s.notion ? '<span class="chip">Enviado ao Notion</span>' : ''}${!s.notion && !s.enviado ? `<button class="btn small" type="button" data-act="notion-send" data-ids="${esc(s.appIds.join(','))}">Enviar ao Notion</button>` : ''}${editBtn(s.appIds)}${delBtn('treinos', s.appIds)}</div>` : ''}</div>
        ${s.exercicios.length ? `<ul>${s.exercicios.map(x => `<li>${esc(x.nome)}${x.sets ? ` · <span class="mono">${fmtSets(x.sets)}</span>` : `${x.carga != null ? ` · <span class="mono">${f1(x.carga)} kg</span>` : ''}${x.series ? ` · ${x.series}×` : ''}${x.reps ? `${x.series ? '' : ' · '}${x.reps}` : ''}`}</li>`).join('')}</ul>` : `<span class="muted">${s.notion ? 'Registrado no Diário do Notion, sem exercícios anotados.' : 'Sem exercícios anotados.'}</span>`}
        ${s.obs.length ? `<span class="muted">${esc(s.obs.join(' · '))}</span>` : ''}</div>`)
      .concat(rs.map(r => `<div class="sess"><div class="sess-top"><div class="btn-row"><span class="chip"><span class="gdot" style="background:var(--c-run)"></span>Corrida</span>${fonteChip(r.fonte)}</div><span class="mono">${f1(r.km)} km${r.seg ? ` · ${fmtTempo(r.seg)} · ${fmtPace(r.seg / r.km)}/km` : ''}</span></div>${r.nome || r.obs ? `<span class="muted">${esc([r.nome, r.obs].filter(Boolean).join(' · '))}</span>` : ''}</div>`));
    $('dia-box').innerHTML = `<p class="label" style="margin:0 0 8px">${esc(cap(diaLongo(iso)))}</p>` + (parts.length ? `<div style="display:grid;gap:8px">${parts.join('')}</div>` : `<div class="empty"><strong>Nada neste dia</strong><span><button class="btn small" type="button" data-act="reg-dia" data-dia="${iso}">Registrar treino neste dia</button></span></div>`);
  }
  $('cal').addEventListener('click', e => { const b = e.target.closest('.day[data-d]'); if (!b) return; S.diaSel = b.dataset.d; for (const x of $('cal').querySelectorAll('.day[data-d]')) x.setAttribute('aria-pressed', x === b ? 'true' : 'false'); renderDia(); });
  $('cal-prev').addEventListener('click', () => { const [y, m] = S.calMes.split('-').map(Number); S.calMes = isoOf(new Date(y, m - 2, 1)).slice(0, 7); renderCal(); });
  $('cal-next').addEventListener('click', () => { const [y, m] = S.calMes.split('-').map(Number); S.calMes = isoOf(new Date(y, m, 1)).slice(0, 7); renderCal(); });

  function renderFichas() {
    const gs = gruposFicha();
    if (!gs.length) { $('ficha-seg').innerHTML = ''; $('ficha-box').innerHTML = S.amigo ? emptyBox('Sem fichas', `${esc(S.amigo.nome)} ainda não tem fichas de treino.`) : emptyBox('Nenhuma ficha ainda', 'Conecte o Notion na aba Conexões para trazer as suas fichas, ou registre um treino e use “+ Adicionar exercício”: o exercício entra na ficha do grupo.'); return; }
    if (!gs.includes(S.fichaGrupo)) S.fichaGrupo = gs[0];
    $('ficha-seg').innerHTML = gs.map(g => `<button type="button" data-g="${esc(g)}" aria-pressed="${g === S.fichaGrupo}">${esc(g)}</button>`).join('');
    const fs = fichasDoGrupo(S.fichaGrupo);
    const dicas = (S.sync.dicas && S.sync.dicas[S.fichaGrupo]) || [];
    $('ficha-box').innerHTML = fs.map(f => {
      const u = ultimaVez(f.nome), app = f.fonte === 'app';
      return `<div class="ficha"><div class="t"><b>${f.fav ? '⭐ ' : ''}${esc(f.nome)}</b><span>${app ? 'Adicionado por você no app (não está no Notion)' : esc(f.detalhe || '—')}</span></div><div class="side">${u ? `${u.carga != null ? f1(u.carga) + ' kg' : 'feito'}${u.reps ? ' × ' + u.reps : ''}<small>última vez, ${toBRs(u.data)}</small>` : '<small>ainda sem registro aqui</small>'}<button class="btn small ghost" type="button" data-act="evo" data-nome="${esc(f.nome)}">Evolução</button>${app ? delBtn('fichas', f.id, 'Tirar da ficha') : ''}</div></div>`;
    }).join('') + dicas.map(t => `<p class="tip">💡 ${esc(t)}</p>`).join('') + (!S.amigo && S.integ && S.integ.notion && S.integ.notion.pagina_url ? `<p class="sub" style="margin-top:12px"><a class="link" href="${esc(notionLink())}" target="_blank" rel="noopener">Editar fichas no Notion ↗</a></p>` : '');
  }
  $('ficha-seg').addEventListener('click', e => { const b = e.target.closest('button[data-g]'); if (!b) return; S.fichaGrupo = b.dataset.g; renderFichas(); });

  function renderHist() {
    const ss = sess(), gs = [...new Set(ss.map(s => s.grupo))];
    const sel = $('hist-grupo');
    if (!['todos', ...gs].includes(S.histGrupo)) S.histGrupo = 'todos';
    sel.innerHTML = `<option value="todos">Todos</option>` + gs.map(g => `<option ${g === S.histGrupo ? 'selected' : ''}>${esc(g)}</option>`).join('');
    sel.value = S.histGrupo;
    const list = S.histGrupo === 'todos' ? ss : ss.filter(s => s.grupo === S.histGrupo);
    const ano = todayIso().slice(0, 4);
    $('hist-sub').textContent = list.length ? `${list.length} treino${list.length === 1 ? '' : 's'} · ${list.filter(s => s.data.startsWith(ano)).length} em ${ano}.` : '';
    if (!list.length) { $('hist-box').innerHTML = emptyBox('Nenhum treino ainda', 'Os treinos do Diário do Notion e os que você registra aqui aparecem nesta lista.'); return; }
    const show = S.histAll ? list : list.slice(0, 25);
    $('hist-box').innerHTML = `<div class="table-wrap"><table class="min-wide"><thead><tr><th>Data</th><th>Grupo</th><th>O que fez</th><th>Origem</th><th></th></tr></thead><tbody>${show.map(s => `<tr>
      <td class="mono">${toBR(s.data)}</td><td>${chipG(s.grupo)}</td>
      <td>${s.exercicios.length ? esc(s.exercicios.map(x => x.nome + (x.carga != null ? ` ${f1(x.carga)}kg` : '')).join(', ')) : '<span class="muted">—</span>'}${s.obs.length ? `<div class="muted">${esc(s.obs.join(' · '))}</div>` : ''}</td>
      <td><div class="btn-row">${s.notion ? (s.notion.notion_url ? `<a class="chip" href="${esc(s.notion.notion_url)}" target="_blank" rel="noopener" style="text-decoration:none">Notion ↗</a>` : fonteChip('notion')) : ''}${s.appIds.length ? fonteChip('app') : ''}</div></td>
      <td class="acts">${s.appIds.length ? editBtn(s.appIds) + ' ' + delBtn('treinos', s.appIds) : ''}</td></tr>`).join('')}</tbody></table></div>
      ${list.length > 25 ? `<div class="btn-row" style="margin-top:10px"><button class="btn small" type="button" data-act="hist-all">${S.histAll ? 'Mostrar só os 25 mais recentes' : `Mostrar todos (${list.length})`}</button></div>` : ''}`;
  }
  $('hist-grupo').addEventListener('change', e => { S.histGrupo = e.target.value; renderHist(); });

  /* ================= CORRIDA ================= */
  function tipoCorrida(nome, wt) {
    const n = String(nome || '').toLowerCase();
    if (/interval|tiro|repeti|fartlek|track/.test(n)) return 'Intervalado';
    if (/tempo|limiar|threshold|progress/.test(n)) return 'Tempo';
    if (/long/.test(n)) return 'Longão';
    if (/race|prova|corrida de rua|\b5k\b|\b10k\b|maratona|marathon/.test(n)) return 'Prova';
    if (/easy|leve|recovery|regenera|base|conversational/.test(n)) return 'Leve';
    return ({ 1: 'Prova', 2: 'Longão', 3: 'Intervalado' })[wt] || 'Corrida';
  }
  function renderCorrida() {
    const rs = corridasArr(), hoje = todayIso(), ws = weekStartIso(hoje), mes = hoje.slice(0, 7), M = S.metas;
    const kmSem = rs.filter(r => r.data >= ws).reduce((a, r) => a + r.km, 0);
    const doMes = rs.filter(r => r.data.startsWith(mes)), kmMes = doMes.reduce((a, r) => a + r.km, 0);
    const r30 = rs.filter(r => r.data >= addDays(hoje, -30) && r.seg > 0);
    const km30 = r30.reduce((a, r) => a + r.km, 0), pace30 = km30 ? r30.reduce((a, r) => a + r.seg, 0) / km30 : null;
    const maior = rs.reduce((b, r) => !b || r.km > b.km ? r : b, null);
    $('run-kpis').innerHTML = !S.any ? loadingKpis() :
      kpi('Km na semana', `${f1(kmSem)} km`, `meta ${f1(M.km_semana)} km`, kmSem > 0 && kmSem >= M.km_semana ? 'good' : '') +
      kpi(`Km em ${MESES[+mes.slice(5) - 1]}`, `${f1(kmMes)} km`, `${doMes.length} corrida${doMes.length === 1 ? '' : 's'}`) +
      kpi('Pace médio (30 dias)', pace30 ? `${fmtPace(pace30)}<small> /km</small>` : '—', r30.length ? `${r30.length} corrida(s) com tempo` : 'sem corridas no período') +
      kpi('Maior corrida', maior ? `${f1(maior.km)} km` : '—', maior ? `em ${toBR(maior.data)}` : 'nenhuma ainda');
    const ws12 = semanas(12);
    if (!rs.length) $('chart-km').innerHTML = emptyBox('Nenhuma corrida ainda', 'Conecte o Strava (o Runna envia para lá) ou registre uma corrida à mão.');
    else barChart($('chart-km'), ws12.map(w => { const fim = addDays(w, 6); const km = rs.filter(r => r.data >= w && r.data <= fim).reduce((a, r) => a + r.km, 0); return { label: toBRs(w), segs: [{ v: r1(km), cls: 'run', title: `Semana de ${toBRs(w)}: ${f1(km)} km` }] }; }), { fmt: f1, meta: M.km_semana, metaLabel: `meta ${f1(M.km_semana)} km`, aria: 'Quilômetros por semana nas últimas 12 semanas.' });
    $('strava-box').innerHTML = stravaCard(true);
    // lista
    const meses = [...new Set(rs.map(r => r.data.slice(0, 7)))];
    if (S.runMes !== 'todos' && !meses.includes(S.runMes)) S.runMes = 'todos';
    $('run-mes').innerHTML = `<option value="todos">Todos</option>` + meses.map(m => `<option value="${m}" ${m === S.runMes ? 'selected' : ''}>${cap(mesNome(m))}</option>`).join('');
    const list = S.runMes === 'todos' ? rs : rs.filter(r => r.data.startsWith(S.runMes));
    $('runs-sub').textContent = list.length ? `${list.length} corrida${list.length === 1 ? '' : 's'} · ${f1(list.reduce((a, r) => a + r.km, 0))} km.` : '';
    $('run-list').innerHTML = !list.length ? emptyBox('Sem corridas', 'Elas aparecem aqui quando vierem do Strava ou forem registradas ao lado.') :
      `<div class="table-wrap"><table class="min-wide"><thead><tr><th>Data</th><th>Corrida</th><th class="n">Km</th><th class="n">Tempo</th><th class="n">Pace</th><th class="n">FC</th><th>Origem</th><th></th></tr></thead><tbody>${list.slice(0, 60).map(r => `<tr>
        <td class="mono">${toBRs(r.data)}</td><td><b>${esc(r.tipo)}</b>${r.nome || r.obs ? `<div class="muted">${esc([r.nome, r.obs].filter(Boolean).join(' · '))}</div>` : ''}</td>
        <td class="n">${f1(r.km)}</td><td class="n">${r.seg ? fmtTempo(r.seg) : '—'}</td><td class="n">${r.seg ? fmtPace(r.seg / r.km) : '—'}</td><td class="n">${r.fc ? f0(r.fc) : '—'}</td>
        <td>${fonteChip(r.fonte)}</td><td class="acts">${r.fonte === 'strava' ? '' : edBtn('corridas', r.id) + ' ' + delBtn('corridas', r.id)}</td></tr>`).join('')}</tbody></table></div>`;
    // pace
    const pr = rs.filter(r => r.seg > 0 && r.km >= 1).slice(0, 20).reverse();
    if (pr.length < 2) $('chart-pace').innerHTML = emptyBox('Poucos dados', 'O gráfico aparece com pelo menos duas corridas com tempo.');
    else lineChart($('chart-pace'), pr.map(r => ({ t: dateOf(r.data).getTime() + (r.id.length % 7) * 1e5, v: r.seg / r.km, x: toBRs(r.data), title: `${toBR(r.data)}: ${f1(r.km)} km a ${fmtPace(r.seg / r.km)}/km` })), { cls: 'run', fmt: fmtPace, minPad: 15, aria: 'Pace das últimas corridas.' });
    // recordes
    const ano = hoje.slice(0, 4);
    const bestPace = (minKm) => rs.filter(r => r.seg > 0 && r.km >= minKm).reduce((b, r) => !b || r.seg / r.km < b.seg / b.km ? r : b, null);
    const p3 = bestPace(3), p5 = bestPace(5), p10 = bestPace(10);
    const wk = {}; for (const r of rs) { const w = weekStartIso(r.data); wk[w] = (wk[w] || 0) + r.km; }
    const bw = Object.entries(wk).sort((a, b) => b[1] - a[1])[0];
    const doAno = rs.filter(r => r.data.startsWith(ano));
    const row = (t, s, v, sm) => `<div class="best"><div class="t"><b>${t}</b><span>${s}</span></div><div class="v">${v}${sm ? `<small>${sm}</small>` : ''}</div></div>`;
    $('run-recs').innerHTML = !rs.length ? emptyBox('Sem recordes ainda', 'Assim que houver corridas, os melhores números aparecem aqui.') :
      row('Maior distância', maior ? `em ${toBR(maior.data)}` : '', `${f1(maior.km)} km`) +
      (p3 ? row('Melhor pace (3 km ou mais)', `${f1(p3.km)} km em ${toBR(p3.data)}`, fmtPace(p3.seg / p3.km), 'min/km') : '') +
      (p5 ? row('5 km mais rápido', `estimado do melhor pace em corrida de 5 km ou mais (${toBRs(p5.data)})`, fmtTempo(p5.seg / p5.km * 5)) : '') +
      (p10 ? row('10 km mais rápido', `estimado de corrida de 10 km ou mais (${toBRs(p10.data)})`, fmtTempo(p10.seg / p10.km * 10)) : '') +
      (bw ? row('Semana com mais km', `semana de ${toBR(bw[0])}`, `${f1(bw[1])} km`) : '') +
      row(`Total em ${ano}`, `${doAno.length} corrida${doAno.length === 1 ? '' : 's'}`, `${f1(doAno.reduce((a, r) => a + r.km, 0))} km`);
  }
  $('run-mes').addEventListener('change', e => { S.runMes = e.target.value; renderCorrida(); });
  function runPreview() {
    const km = numOr($('r-km').value), seg = parseTempo($('r-tempo').value);
    $('r-preview').innerHTML = km > 0 && seg > 0 ? `<span>Pace: <b>${fmtPace(seg / km)} /km</b></span><span>Velocidade: <b>${f1(km / (seg / 3600))} km/h</b></span>` : '<span>Pace e velocidade aparecem aqui.</span>';
  }
  ['r-km', 'r-tempo'].forEach(id => $(id).addEventListener('input', runPreview));
  $('f-run').addEventListener('submit', e => {
    e.preventDefault(); if (ocupado(e.currentTarget)) return;
    const km = numOr($('r-km').value), seg = parseTempo($('r-tempo').value), data = $('r-data').value;
    $('r-km').classList.toggle('invalid', !(km > 0)); $('r-tempo').classList.toggle('invalid', !(seg > 0));
    if (!(km > 0) || !(seg > 0) || !isoOk(data)) return;
    const oldR = S.edit.corridas && S.corridas.get(S.edit.corridas);
    const doc = { data, km: Math.round(km * 100) / 100, seg, tipo: $('r-tipo').value, tipo_manual: true, fc: numOr($('r-fc').value), obs: $('r-obs').value.trim(), nome: oldR ? oldR.nome : '', fonte: oldR ? oldR.fonte : 'manual' };
    travar($('f-run'), write('corridas', oldR ? oldR.id : uid('r'), doc).then(() => { modoEdicao('corridas', null); toast('Corrida salva.'); $('r-status').textContent = `Salva: ${f1(km)} km.`; ['r-km', 'r-tempo', 'r-fc', 'r-obs'].forEach(id => $(id).value = ''); runPreview(); }).catch(() => { $('r-status').textContent = 'Não salvou.'; }));
  });

  /* ================= ALIMENTAÇÃO ================= */
  function refPadrao() { const h = new Date().getHours(); return h < 10 ? 'cafe' : h < 15 ? 'almoco' : h < 18 ? 'lanche' : h < 22 ? 'jantar' : 'ceia'; }
  function renderAlimentacao() {
    const iso = S.foodDate, hoje = todayIso(), M = S.metas;
    const nomeDia = iso === hoje ? 'Hoje' : iso === addDays(hoje, -1) ? 'Ontem' : cap(DOW_LONG[dateOf(iso).getDay()]);
    const d = dateOf(iso);
    $('fd-label').textContent = `${nomeDia}, ${d.getDate()} de ${MESES[d.getMonth()]}`;
    $('fd-date').value = iso; $('fd-next').disabled = iso >= hoje;
    const rs = refeicoesDia(iso), tot = totaisDia(iso);
    $('meals-sub').textContent = rs.length ? `${rs.length} ite${rs.length === 1 ? 'm' : 'ns'} · ${f0(tot.kcal)} kcal` : '';
    $('meals-box').innerHTML = !rs.length ? emptyBox('Nada registrado neste dia', 'Adicione abaixo ou toque num alimento frequente.') :
      REFS.map(([k, nome]) => {
        const it = rs.filter(r => r.ref === k); if (!it.length) return '';
        const kc = it.reduce((a, r) => a + r.kcal, 0);
        return `<div class="meal"><div class="meal-h"><b>${nome}</b><span>${f0(kc)} kcal</span></div>${it.map(r => `<div class="food"><div class="t"><b>${esc(r.alimento)}${r.estimado ? ' <span class="chip warn" style="font-size:11px">estimado</span>' : ''}</b><small>${r.qtd ? esc(r.qtd) + ' · ' : ''}P ${f1(r.prot)} · C ${f1(r.carb)} · G ${f1(r.gord)}</small></div><span class="k">${f0(r.kcal)}</span>${edBtn('refeicoes', r.id, '✎')}${delBtn('refeicoes', r.id, '×')}</div>`).join('')}</div>`;
      }).join('');
    // macros
    const agua = aguaDia(iso);
    const kcalM = tot.prot * 4 + tot.carb * 4 + tot.gord * 9;
    const pc = v => kcalM ? Math.round(v / kcalM * 100) : 0;
    const resto = M.kcal - tot.kcal;
    $('macros-box').innerHTML = `<div class="meters">
      ${meter('Calorias', tot.kcal, M.kcal, 'kcal', 'var(--c-food)', !tot.n ? 'Nada registrado.' : resto >= 0 ? `Faltam ${f0(resto)} kcal.` : `${f0(-resto)} kcal acima da meta.`)}
      ${meter('Proteína', tot.prot, M.prot, 'g', 'var(--c-prot)', tot.prot >= M.prot ? 'Meta batida.' : `Faltam ${f0(M.prot - tot.prot)} g.`)}
      ${meter('Carboidrato', tot.carb, M.carb, 'g', 'var(--c-carb)')}
      ${meter('Gordura', tot.gord, M.gord, 'g', 'var(--c-gord)')}
      ${kcalM ? `<div class="meter"><div class="meter-top"><b>De onde vêm as calorias</b><span>P ${pc(tot.prot * 4)}% · C ${pc(tot.carb * 4)}% · G ${pc(tot.gord * 9)}%</span></div><div class="split" aria-hidden="true"><i style="width:${pc(tot.prot * 4)}%;background:var(--c-prot)"></i><i style="width:${pc(tot.carb * 4)}%;background:var(--c-carb)"></i><i style="width:${pc(tot.gord * 9)}%;background:var(--c-gord)"></i></div></div>` : ''}
      <div>${meter('Água', agua / 1000, M.agua_ml / 1000, 'L', 'var(--c-agua)', '', f1)}
        <div class="agua-row"><button class="btn small" type="button" data-act="agua" data-ml="250" data-dia="${iso}">+250 ml</button><button class="btn small" type="button" data-act="agua" data-ml="500" data-dia="${iso}">+500 ml</button><button class="btn small ghost" type="button" data-act="agua" data-ml="-250" data-dia="${iso}" ${agua ? '' : 'disabled'}>−250 ml</button></div></div>
    </div>`;
    // frequentes
    const al = [...S.alimentos.values()].sort((a, b) => b.usos - a.usos || b.ultimo - a.ultimo);
    $('dl-alimentos').innerHTML = al.map(a => `<option value="${esc(a.nome)}">`).join('');
    $('freq-box').innerHTML = al.length ? al.slice(0, 14).map(a => `<button type="button" class="chip" data-act="freq" data-id="${esc(a.id)}">${esc(a.nome)} <span class="muted">${f0(a.kcal)}</span></button>`).join('') : '<span class="muted">Os alimentos que você guardar aparecem aqui para lançar com um toque.</span>';
    if (!$('a-ref').value) { $('a-ref').innerHTML = REFS.map(([k, n]) => `<option value="${k}">${n}</option>`).join(''); $('a-ref').value = refPadrao(); }
    // 14 dias
    const dias = []; for (let i = 13; i >= 0; i--) dias.push(addDays(iso > hoje ? hoje : iso, -i));
    const tt = dias.map(d2 => ({ d: d2, t: totaisDia(d2) }));
    if (!tt.some(x => x.t.n)) { $('chart-kcal').innerHTML = emptyBox('Sem registros nos últimos 14 dias', 'Os gráficos aparecem com as primeiras refeições.'); $('chart-prot').innerHTML = ''; }
    else {
      barChart($('chart-kcal'), tt.map(x => ({ label: toBRs(x.d), segs: [{ v: Math.round(x.t.kcal), cls: 'food', title: `${toBR(x.d)}: ${f0(x.t.kcal)} kcal` }] })), { meta: M.kcal, metaLabel: `meta ${f0(M.kcal)}`, ml: 46, H: 180, vals: false, aria: 'Calorias por dia nos últimos 14 dias.' });
      barChart($('chart-prot'), tt.map(x => ({ label: toBRs(x.d), segs: [{ v: Math.round(x.t.prot), cls: 'prot', title: `${toBR(x.d)}: ${f0(x.t.prot)} g de proteína` }] })), { meta: M.prot, metaLabel: `meta ${f0(M.prot)} g`, ml: 46, H: 160, vals: false, aria: 'Proteína por dia nos últimos 14 dias.' });
    }
    fillMetas();
    renderGrowth();
  }
  $('fd-prev').addEventListener('click', () => { S.foodDate = addDays(S.foodDate, -1); renderAlimentacao(); });
  $('fd-next').addEventListener('click', () => { if (S.foodDate < todayIso()) { S.foodDate = addDays(S.foodDate, 1); renderAlimentacao(); } });
  $('fd-today').addEventListener('click', () => { S.foodDate = todayIso(); renderAlimentacao(); });
  $('fd-date').addEventListener('change', e => { if (isoOk(e.target.value)) { S.foodDate = e.target.value > todayIso() ? todayIso() : e.target.value; renderAlimentacao(); } });
  function fillAlimento(a) { $('a-nome').value = a.nome; $('a-qtd').value = a.qtd; $('a-kcal').value = fIn(a.kcal); $('a-prot').value = fIn(a.prot); $('a-carb').value = fIn(a.carb); $('a-gord').value = fIn(a.gord); $('a-mult').value = '1'; foodPreview(); }
  $('a-nome').addEventListener('change', e => { const k = normNome(e.target.value); const a = [...S.alimentos.values()].find(x => normNome(x.nome) === k); if (a) fillAlimento(a); });
  function foodPreview() {
    const m = numOr($('a-mult').value, 1) || 1, k = numOr($('a-kcal').value, 0);
    $('a-preview').innerHTML = k ? `<span>Total: <b>${f0(k * m)} kcal</b></span><span>P <b>${f1(numOr($('a-prot').value, 0) * m)}</b></span><span>C <b>${f1(numOr($('a-carb').value, 0) * m)}</b></span><span>G <b>${f1(numOr($('a-gord').value, 0) * m)}</b></span>` : '<span>O total aparece aqui.</span>';
  }
  ['a-mult', 'a-kcal', 'a-prot', 'a-carb', 'a-gord'].forEach(id => $(id).addEventListener('input', foodPreview));
  $('f-food').addEventListener('submit', e => {
    e.preventDefault();
    const nome = $('a-nome').value.trim(), m = numOr($('a-mult').value, 1) || 1, kcal = numOr($('a-kcal').value);
    $('a-kcal').classList.toggle('invalid', kcal == null || kcal < 0);
    if (!nome || kcal == null || kcal < 0) return;
    const per = { kcal, prot: numOr($('a-prot').value, 0), carb: numOr($('a-carb').value, 0), gord: numOr($('a-gord').value, 0) };
    const qtd = $('a-qtd').value.trim();
    const oldF = S.edit.refeicoes && S.refeicoes.get(S.edit.refeicoes);
    const doc = { data: oldF ? oldF.data : S.foodDate, ref: $('a-ref').value, alimento: nome, qtd: m !== 1 ? `${f1(m)} × ${qtd || 'porção'}` : qtd, kcal: r1(per.kcal * m), prot: r1(per.prot * m), carb: r1(per.carb * m), gord: r1(per.gord * m), fonte: oldF ? oldF.fonte : 'manual', criado: oldF ? oldF.criado : Date.now() };
    write('refeicoes', oldF ? oldF.id : uid('f'), doc).then(() => { toast(oldF ? `${nome} atualizado.` : `${nome} adicionado.`); $('a-status').textContent = ''; }).catch(() => { $('a-status').textContent = 'Não salvou.'; });
    if (oldF) modoEdicao('refeicoes', null);
    if (!oldF && $('a-salvar').checked) {
      const id = 'a-' + slugify(nome), old = S.alimentos.get(id);
      write('alimentos', id, { nome, qtd, ...per, usos: (old ? old.usos : 0) + 1, ultimo: Date.now() }).catch(() => { });
    }
    ['a-nome', 'a-qtd', 'a-kcal', 'a-prot', 'a-carb', 'a-gord'].forEach(id => $(id).value = ''); $('a-mult').value = '1'; foodPreview(); $('a-nome').focus();
  });

  /* Growth: a IA lê o print (ou o texto) e devolve os itens para conferir */
  let gCtl = null;
  /* leitura por IA: feita pela função "integracoes" no servidor (Gemini grátis ou Claude) */
  async function getSample() {
    if (S.sample !== undefined && S.sample !== null) return S.sample;
    const st = await H.statusInteg();
    S.sample = st && st.ia && st.ia.disponivel ? { json: (prompt, o = {}) => H.lerIA(prompt, (o.images || [])[0] || null, o.signal) } : null;
    S.sampleLimits = S.sample ? { images: true } : null;
    return S.sample;
  }
  function sampleMsg(e) {
    return ({
      not_granted: 'Entre no grupo para usar a leitura automática.',
      sampling_disabled: (e && e.message) || 'A leitura automática não foi configurada neste site.',
      rate_limited: (e && e.message) || 'Muitos pedidos agora. Tente de novo daqui a pouco.',
      session_expired: 'Sua sessão expirou. Saia e entre de novo.',
      image_rejected: 'Não consegui abrir essa imagem. Tente outro print em JPG ou PNG.',
      refused: 'A IA não conseguiu ler isso. Tente outro print.',
      invalid_json: 'A resposta veio incompleta. Tente de novo.',
      empty_completion: 'A resposta veio vazia. Tente de novo com um print mais nítido.',
      cancelled: 'Leitura cancelada.',
      server_unavailable: 'Sem conexão com o servidor. Confira a internet.',
      sem_funcao: (e && e.message) || 'A função de integrações ainda não foi publicada.',
      demo: (e && e.message) || 'Desligado no modo demonstração.',
    })[e && e.code] || ((e && e.message) || 'Não deu certo agora. Tente de novo.');
  }
  async function growthGo() {
    const sample = await getSample();
    const st = $('g-status');
    if (!sample) { st.textContent = H.demo ? 'No modo demonstração a leitura automática fica desligada. Lance os alimentos à mão ao lado.' : 'A leitura automática ainda não foi configurada neste site (o guia explica como ligar de graça). Lance à mão ao lado.'; return; }
    const file = ($('g-file').files || [])[0] || null, txt = $('g-text').value.trim();
    if (!file && !txt) { st.textContent = 'Escolha um print ou descreva a refeição.'; return; }
    gCtl = new AbortController();
    $('g-go').disabled = true; $('g-stop').classList.remove('hidden');
    st.innerHTML = '<span class="spin"></span> A IA está lendo… pode levar até um minuto.';
    const prompt = [
      'Você extrai dados de alimentação para um app pessoal de nutrição, em português do Brasil.',
      file ? 'A imagem anexada é um print do app "Growth - Dieta e Treino" (ou de outro app de dieta) com refeições, alimentos, quantidades, calorias e macronutrientes.' : '',
      txt ? 'Texto do usuário descrevendo o que comeu:\n"""\n' + txt.slice(0, 4000) + '\n"""' : '',
      'Regras:',
      '- Liste cada alimento separadamente. Se o print mostra os números, copie exatamente e use "estimado": false.',
      '- Se não houver números (texto livre ou print sem macros), estime valores típicos de tabelas brasileiras (TACO) para a porção citada e use "estimado": true.',
      '- "refeicao" deve ser um destes: "cafe", "almoco", "lanche", "jantar", "ceia", "outro". Use o nome da refeição do print quando houver.',
      '- kcal em quilocalorias; prot, carb e gord em gramas. Só números, sem unidade.',
      '- Se o print mostrar só o total do dia, devolva um item "Total do dia (Growth)" com refeicao "outro".',
      '- "data": a data mostrada no print no formato AAAA-MM-DD, ou null se não aparecer.',
      'Responda só com JSON neste formato:',
      '{"data": null, "itens": [{"refeicao": "almoco", "alimento": "Arroz branco cozido", "quantidade": "150 g", "kcal": 192, "prot": 3.8, "carb": 42.1, "gord": 0.3, "estimado": false}]}',
    ].filter(Boolean).join('\n');
    try {
      const opts = { signal: gCtl.signal }; if (file) opts.images = [file];
      const r = await sample.json(prompt, opts);
      const arr = Array.isArray(r) ? r : (r && Array.isArray(r.itens)) ? r.itens : [];
      const itens = arr.map(x => ({
        id: uid('f'), sel: true, ref: REF_TXT[x && x.refeicao] ? x.refeicao : refPadrao(),
        alimento: str(x && (x.alimento || x.nome)).slice(0, 120), qtd: str(x && (x.quantidade || x.qtd)).slice(0, 60),
        kcal: r1(nn(x && x.kcal) || 0), prot: r1(nn(x && x.prot) || 0), carb: r1(nn(x && x.carb) || 0), gord: r1(nn(x && x.gord) || 0), estimado: !!(x && x.estimado),
      })).filter(x => x.alimento);
      const dataPrint = r && isoOk(r.data) && r.data <= todayIso() ? r.data : null;
      S.growth = { itens, data: dataPrint || S.foodDate, origem: file ? 'growth' : 'ia' };
      guardarGrowth();
      st.textContent = itens.length ? `${itens.length} ite${itens.length === 1 ? 'm encontrado' : 'ns encontrados'}. Confira e adicione.` : 'Não encontrei alimentos. Tente um print mais nítido ou descreva em texto.';
    } catch (e) { st.textContent = sampleMsg(e); }
    finally { $('g-go').disabled = false; $('g-stop').classList.add('hidden'); gCtl = null; renderGrowth(); }
  }
  /* a leitura da IA (até um minuto) fica guardada até você adicionar ou descartar */
  function guardarGrowth() { if (S.growth && S.growth.itens.length) { const { salvando, ...g } = S.growth; lsSet(LS_G, g); } else lsDel(LS_G); }
  function renderGrowth() {
    if (S.sample === null && !$('g-status').textContent) $('g-status').textContent = H.demo ? 'Leitura automática desligada no modo demonstração.' : 'Leitura automática ainda não configurada neste site.';
    const G = S.growth, box = $('g-result');
    if (!G || !G.itens.length) { box.innerHTML = ''; return; }
    const sel = G.itens.filter(i => i.sel);
    const kc = sel.reduce((a, i) => a + i.kcal, 0);
    box.innerHTML = `<div class="gitems">${G.itens.map((i, n) => `<div class="gitem" data-n="${n}"><input type="checkbox" data-k="sel" ${i.sel ? 'checked' : ''} aria-label="Incluir ${esc(i.alimento)}"><div class="t"><b>${esc(i.alimento)}${i.estimado ? ' <span class="chip warn" style="font-size:11px">estimado</span>' : ''}</b><small>${i.qtd ? esc(i.qtd) + ' · ' : ''}${f0(i.kcal)} kcal · P ${f1(i.prot)} · C ${f1(i.carb)} · G ${f1(i.gord)}</small></div><select data-k="ref" aria-label="Refeição">${REFS.map(([k, nm]) => `<option value="${k}" ${k === i.ref ? 'selected' : ''}>${nm}</option>`).join('')}</select></div>`).join('')}</div>
      <div class="calc-preview" style="margin-top:10px"><span>Selecionados: <b>${sel.length}</b></span><span>Total: <b>${f0(kc)} kcal</b></span></div>
      <div class="row" style="margin-top:10px"><label class="field"><span>Lançar no dia</span><input type="date" id="g-data" value="${G.data}" max="${todayIso()}"></label></div>
      <div class="btn-row" style="margin-top:10px"><button class="btn primary" type="button" id="g-add" ${sel.length && !G.salvando ? '' : 'disabled'}>${G.salvando ? 'Adicionando…' : `Adicionar ${sel.length} ao diário`}</button><button class="btn ghost" type="button" id="g-clear">Descartar</button></div>`;
  }
  $('g-go').addEventListener('click', growthGo);
  $('g-stop').addEventListener('click', () => { if (gCtl) gCtl.abort(); });
  $('g-result').addEventListener('change', e => {
    if (!S.growth || S.growth.salvando) return;
    if (e.target.id === 'g-data') { if (isoOk(e.target.value)) { S.growth.data = e.target.value > todayIso() ? todayIso() : e.target.value; guardarGrowth(); } return; }
    const row = e.target.closest('.gitem'); if (!row) return;
    const it = S.growth.itens[+row.dataset.n]; if (!it) return;
    if (e.target.dataset.k === 'sel') it.sel = e.target.checked; else if (e.target.dataset.k === 'ref') it.ref = e.target.value;
    guardarGrowth(); renderGrowth();
  });
  $('g-result').addEventListener('click', e => {
    if (e.target.id === 'g-clear') { if (S.growth && S.growth.salvando) return; S.growth = null; guardarGrowth(); $('g-status').textContent = ''; renderGrowth(); return; }
    if (e.target.id !== 'g-add' || !S.growth || S.growth.salvando) return;
    /* cada item já tem id: dois toques, ou tentar de novo depois de uma falha, não duplicam alimentos */
    const G = S.growth, sel = G.itens.filter(i => i.sel); let t0 = Date.now();
    if (!sel.length) return;
    G.salvando = true; renderGrowth();
    Promise.all(sel.map(i => write('refeicoes', idOk(i.id) ? i.id : uid('f'), { data: G.data, ref: i.ref, alimento: i.alimento, qtd: i.qtd, kcal: i.kcal, prot: i.prot, carb: i.carb, gord: i.gord, estimado: i.estimado, fonte: G.origem, criado: t0++ })))
      .then(() => { toast(`${sel.length} ite${sel.length === 1 ? 'm adicionado' : 'ns adicionados'}.`); S.foodDate = G.data; if (S.growth === G) { S.growth = null; guardarGrowth(); } $('g-file').value = ''; $('g-text').value = ''; $('g-status').textContent = 'Adicionado ao diário.'; renderAlimentacao(); })
      .catch(() => { G.salvando = false; $('g-status').textContent = 'Parte dos itens não salvou. Toque em Adicionar de novo: os que já entraram não se repetem.'; renderGrowth(); });
  });

  /* metas */
  const metaIds = { kcal: 'm-kcal', prot: 'm-prot', carb: 'm-carb', gord: 'm-gord', agua_ml: 'm-agua', treinos_semana: 'm-treinos', km_semana: 'm-km' };
  function fillMetas(force) {
    if (S.dirty.metas && !force) return;
    for (const [k, id] of Object.entries(metaIds)) $(id).value = fIn(S.metas[k]);
    const note = $('m-note');
    if (!S.metasSalvas) { note.hidden = false; note.textContent = 'Estas são metas padrão. Ajuste ou toque em “Calcular pelo perfil”.'; } else if (!S.dirty.metas) note.hidden = true;
  }
  $('f-metas').addEventListener('input', () => { S.dirty.metas = true; });
  $('m-calc').addEventListener('click', () => {
    const P = S.perfil, ps = pesosArr(), peso = ps.length ? ps[ps.length - 1].peso : null, alt = nn(P.altura), id = idade(P.nasc);
    const note = $('m-note'); note.hidden = false;
    if (!peso || !alt || id == null || !P.sexo) { note.textContent = 'Para calcular: preencha altura, nascimento e sexo no Perfil (aba Corpo) e registre um peso.'; return; }
    const tmb = 10 * peso + 6.25 * alt - 5 * id + (P.sexo === 'm' ? 5 : -161);
    const tdee = tmb * (Number(P.ativ) || 1.55);
    const obj = P.obj || 'massa';
    const aj = { massa: 300, gordura: -450, manter: 0, desempenho: 150 }[obj] ?? 0;
    const kcal = Math.round((tdee + aj) / 50) * 50;
    const prot = Math.round(peso * (obj === 'gordura' ? 2.2 : obj === 'massa' ? 2.0 : 1.6));
    const gord = Math.round(peso * 0.9);
    const carb = Math.max(0, Math.round((kcal - prot * 4 - gord * 9) / 4));
    const agua = Math.round(peso * 35 / 100) * 100;
    Object.entries({ kcal, prot, carb, gord, agua_ml: agua }).forEach(([k, v]) => $(metaIds[k]).value = fIn(v));
    S.dirty.metas = true;
    note.textContent = `Estimativa pela fórmula de Mifflin-St Jeor: você gasta perto de ${f0(tdee)} kcal por dia; ${aj > 0 ? `somei ${aj} kcal para ${obj === 'massa' ? 'ganhar massa' : 'render na corrida'}` : aj < 0 ? `tirei ${-aj} kcal para perder gordura` : 'sem ajuste para manter'}. Proteína de ${f1(prot / peso)} g por kg. Confira e toque em Salvar metas. Um nutricionista ajusta melhor.`;
  });
  $('f-metas').addEventListener('submit', e => {
    e.preventDefault(); if (ocupado(e.currentTarget)) return;
    const out = {}; let ok = true;
    for (const [k, id] of Object.entries(metaIds)) { const v = numOr($(id).value); const bad = !(v > 0); $(id).classList.toggle('invalid', bad); if (bad) ok = false; else out[k] = v; }
    if (!ok) { $('m-status').textContent = 'Preencha todos os campos com números.'; return; }
    travar($('f-metas'), write('config', 'metas', out).then(() => { S.dirty.metas = false; $('m-status').textContent = 'Metas salvas.'; $('m-note').hidden = true; toast('Metas salvas.'); }).catch(() => { $('m-status').textContent = 'Não salvou.'; }));
  });

  /* ================= CORPO ================= */
  $('md-fields').innerHTML = MEDIDAS.map(([k, n]) => `<label class="field"><span>${n}</span><input class="mono" data-m="${k}" inputmode="decimal" placeholder="cm"></label>`).join('');
  const fmtVal = (v, u) => v == null ? '—' : u === 'tempo' ? fmtTempo(v) : u === 's' ? `${f0(v)} s` : u === 'reps' ? `${f0(v)} rep` : `${f1(v)} ${u}`;
  function renderCorpo() {
    const ps = pesosArr(), pAt = ps[ps.length - 1], P = S.perfil, alt = nn(P.altura);
    const ms = [...S.medidas.values()].filter(m => m.data).sort((a, b) => a.data.localeCompare(b.data));
    const lastWith = k => [...ms].reverse().find(m => m[k] != null), firstWith = k => ms.find(m => m[k] != null);
    const imc = pAt && alt ? pAt.peso / Math.pow(alt / 100, 2) : null;
    const faixa = imc == null ? '' : imc < 18.5 ? 'abaixo da faixa' : imc < 25 ? 'faixa saudável' : imc < 30 ? 'sobrepeso' : 'obesidade';
    const gAt = [...ps].reverse().find(p => p.gordura != null);
    const cAt = lastWith('cintura'), cIni = firstWith('cintura');
    const dPeso = pAt && ps.length > 1 ? pAt.peso - ps[0].peso : null;
    const sgn = d => d > 0 ? '+' : d < 0 ? '−' : '';
    $('body-kpis').innerHTML = !S.any ? loadingKpis() :
      kpi('Peso atual', pAt ? `${f1(pAt.peso)} kg` : '—', pAt ? (dPeso != null ? `${sgn(dPeso)}${f1(Math.abs(dPeso))} kg desde ${toBRs(ps[0].data)}` : `em ${toBR(pAt.data)}`) : 'nenhuma pesagem') +
      kpi('IMC', imc ? f1(imc) : '—', imc ? `${faixa} · não separa músculo de gordura` : (alt ? 'registre um peso' : 'informe a altura no Perfil')) +
      kpi('Gordura corporal', gAt ? `${f1(gAt.gordura)}%` : '—', gAt ? `em ${toBR(gAt.data)}` : 'opcional, junto com o peso') +
      kpi('Cintura', cAt ? `${f1(cAt.cintura)} cm` : '—', cAt && cIni && cIni !== cAt ? `${sgn(cAt.cintura - cIni.cintura)}${f1(Math.abs(cAt.cintura - cIni.cintura))} cm desde ${toBRs(cIni.data)}` : cAt ? `em ${toBR(cAt.data)}` : 'registre suas medidas');
    // peso
    const meta = nn(P.peso_meta);
    $('peso-sub').textContent = ps.length ? `${ps.length} pesagem${ps.length === 1 ? '' : 's'}${meta ? ` · meta ${f1(meta)} kg` : ''}.` : 'Registre ao lado para começar a curva.';
    if (!ps.length) $('chart-peso').innerHTML = emptyBox('Sem pesagens ainda', 'A primeira pesagem já cria o ponto de partida.');
    else lineChart($('chart-peso'), ps.map(p => ({ t: dateOf(p.data).getTime(), v: p.peso, x: toBRs(p.data), title: `${toBR(p.data)}: ${f1(p.peso)} kg` })), { cls: 'body', unit: 'kg', meta, metaLabel: 'meta', aria: 'Evolução do peso.' });
    const pr = [...ps].reverse().slice(0, 10);
    $('peso-list').innerHTML = pr.length ? `<div class="table-wrap"><table><thead><tr><th>Data</th><th class="n">Peso</th><th class="n">Variação</th><th class="n">% gord.</th><th></th></tr></thead><tbody>${pr.map((p, i) => { const prev = pr[i + 1]; const d = prev ? p.peso - prev.peso : null; return `<tr><td class="mono">${toBR(p.data)}</td><td class="n">${f1(p.peso)} kg</td><td class="n">${d == null ? '—' : `${sgn(d)}${f1(Math.abs(d))}`}</td><td class="n">${p.gordura != null ? f1(p.gordura) + '%' : '—'}</td><td class="acts">${edBtn('pesos', p.id)} ${delBtn('pesos', p.id)}</td></tr>`; }).join('')}</tbody></table></div>` : '';
    // medidas
    const rows = MEDIDAS.filter(([k]) => lastWith(k));
    $('medidas-box').innerHTML = !ms.length ? emptyBox('Nenhuma medida ainda', 'Registre ao lado. Medir a cada 2 a 4 semanas já mostra a evolução.') :
      `<div class="table-wrap"><table><thead><tr><th>Medida</th><th class="n">Primeira</th><th class="n">Última</th><th class="n">Diferença</th></tr></thead><tbody>${rows.map(([k, n]) => { const a = firstWith(k), b = lastWith(k); const d = b[k] - a[k]; return `<tr><td>${n}</td><td class="n">${f1(a[k])}<div class="muted">${toBRs(a.data)}</div></td><td class="n">${f1(b[k])}<div class="muted">${toBRs(b.data)}</div></td><td class="n"><b>${a === b ? '—' : `${sgn(d)}${f1(Math.abs(d))}`}</b></td></tr>`; }).join('')}</tbody></table></div>
      <p class="label" style="margin:16px 0 6px">Medições</p><div class="btn-row">${[...ms].reverse().map(m => `<span class="chip">${toBR(m.data)} ${delBtn('medidas', m.id, '×')}</span>`).join('')}</div>`;
    renderDesempenho();
    // datalist de testes
    $('dl-testes').innerHTML = [...new Set([...fichasArr().map(f => f.nome), ...TESTES_PADRAO, ...[...S.testes.values()].map(t => t.teste)])].map(n => `<option value="${esc(n)}">`).join('');
    fillPerfil();
  }
  function renderDesempenho() {
    const by = new Map();
    for (const t of S.testes.values()) { if (!t.teste || t.valor == null) continue; const k = normNome(t.teste) + '|' + t.unidade; if (!by.has(k)) by.set(k, []); by.get(k).push(t); }
    const grupos = [...by.values()].map(arr => {
      arr.sort((a, b) => a.data.localeCompare(b.data));
      const u = arr[0].unidade;
      const score = t => u === 'kg' && t.reps ? t.valor * (1 + t.reps / 30) : t.valor;
      const best = arr.reduce((b, t) => !b ? t : (u === 'tempo' ? score(t) < score(b) : score(t) > score(b)) ? t : b, null);
      return { nome: arr[arr.length - 1].teste, u, arr, best, last: arr[arr.length - 1] };
    }).sort((a, b) => b.last.data.localeCompare(a.last.data));
    const cargas = new Map();
    for (const s of sess()) for (const e of s.exercicios) if (e.carga != null) { const k = normNome(e.nome); const c = cargas.get(k); if (!c || e.carga > c.carga) cargas.set(k, { ...e, data: s.data }); }
    const top = [...cargas.values()].sort((a, b) => b.carga - a.carga).slice(0, 8);
    $('desemp-box').innerHTML = (grupos.length ? grupos.map(g => {
      const b = g.best, sub = `${g.arr.length} registro${g.arr.length === 1 ? '' : 's'} · último em ${toBRs(g.last.data)}`;
      const sm = g.u === 'kg' && b.reps ? `${b.reps} rep · 1RM ≈ ${f1(b.valor * (1 + b.reps / 30))} kg` : `melhor marca, ${toBRs(b.data)}`;
      return `<div class="best"><div class="t"><b>${esc(g.nome)}</b><span>${sub}</span><details><summary class="muted" style="cursor:pointer">histórico</summary><div style="display:grid;gap:4px;margin-top:6px">${[...g.arr].reverse().map(t => `<div style="display:flex;justify-content:space-between;align-items:center;gap:8px;font-size:13px"><span class="mono">${toBRs(t.data)} · ${fmtVal(t.valor, t.unidade)}${t.reps ? ' × ' + t.reps : ''}${t.obs ? ` <span class="muted">${esc(t.obs)}</span>` : ''}</span>${delBtn('testes', t.id, '×')}</div>`).join('')}</div></details></div><div class="v">${fmtVal(b.valor, g.u)}<small>${sm}</small></div></div>`;
    }).join('') : emptyBox('Nenhum recorde ainda', 'Registre ao lado sua carga máxima, flexões, prancha ou tempo nos 5 km.')) +
      `<p class="label" style="margin:18px 0 6px">Maiores cargas nos treinos</p>` +
      (top.length ? `<div class="hbars">${top.map(c => `<div class="hb" data-act="evo" data-nome="${esc(c.nome)}" role="button" tabindex="0" style="cursor:pointer" title="Ver evolução"><div class="hb-top"><b>${esc(c.nome)}</b><span>${f1(c.carga)} kg${c.reps ? ' × ' + c.reps : ''} · ${toBRs(c.data)}</span></div><div class="hb-track"><i style="width:${Math.max(3, c.carga / top[0].carga * 100)}%;background:var(--c-gym)"></i></div></div>`).join('')}</div>` : '<p class="muted" style="margin:0">Aparece quando você registrar treinos com carga na aba Treinos.</p>');
  }
  $('x-unid').addEventListener('change', e => { $('x-reps-wrap').classList.toggle('hidden', e.target.value !== 'kg'); });
  $('f-peso').addEventListener('submit', e => {
    e.preventDefault(); if (ocupado(e.currentTarget)) return;
    const peso = numOr($('p-peso').value), g = numOr($('p-gord').value), data = $('p-data').value;
    $('p-peso').classList.toggle('invalid', !(peso > 20 && peso < 400));
    if (!(peso > 20 && peso < 400) || !isoOk(data)) return;
    const same = [...S.pesos.values()].find(p => p.data === data);
    const oldP = S.edit.pesos && S.pesos.get(S.edit.pesos);
    if (oldP && same && same.id !== oldP.id) write('pesos', same.id, null, 'delete').catch(() => { });
    travar($('f-peso'), write('pesos', oldP ? oldP.id : same ? same.id : uid('p'), { data, peso, gordura: g > 0 && g < 70 ? g : null }).then(() => { modoEdicao('pesos', null); toast(`${f1(peso)} kg registrado.`); $('p-status').textContent = oldP || same ? 'Pesagem atualizada.' : 'Salvo.'; $('p-peso').value = ''; $('p-gord').value = ''; }).catch(() => { $('p-status').textContent = 'Não salvou.'; }));
  });
  $('f-med').addEventListener('submit', e => {
    e.preventDefault(); if (ocupado(e.currentTarget)) return;
    const data = $('md-data').value; if (!isoOk(data)) return;
    const doc = { data }; let n = 0;
    for (const inp of $('md-fields').querySelectorAll('input[data-m]')) { const v = numOr(inp.value); const bad = inp.value.trim() !== '' && !(v > 0 && v < 300); inp.classList.toggle('invalid', bad); if (bad) return; if (v) { doc[inp.dataset.m] = v; n++; } }
    if (!n) { $('md-status').textContent = 'Preencha pelo menos uma medida.'; return; }
    travar($('f-med'), write('medidas', uid('m'), doc).then(() => { toast('Medidas salvas.'); $('md-status').textContent = `${n} medida${n === 1 ? '' : 's'} salva${n === 1 ? '' : 's'}.`; for (const inp of $('md-fields').querySelectorAll('input')) inp.value = ''; }).catch(() => { $('md-status').textContent = 'Não salvou.'; }));
  });
  $('f-teste').addEventListener('submit', e => {
    e.preventDefault(); if (ocupado(e.currentTarget)) return;
    const u = $('x-unid').value, raw = $('x-valor').value, teste = $('x-teste').value.trim(), data = $('x-data').value;
    const valor = u === 'tempo' ? parseTempo(raw) : numOr(raw);
    $('x-valor').classList.toggle('invalid', !(valor > 0));
    if (!(valor > 0) || !teste || !isoOk(data)) return;
    travar($('f-teste'), write('testes', uid('x'), { data, teste, valor, unidade: u, reps: u === 'kg' ? numOr($('x-reps').value) : null, obs: $('x-obs').value.trim() }).then(() => { toast('Registro salvo.'); $('x-status').textContent = `${teste}: ${fmtVal(valor, u)}.`; ['x-valor', 'x-reps', 'x-obs'].forEach(id => $(id).value = ''); }).catch(() => { $('x-status').textContent = 'Não salvou.'; }));
  });
  const perfilIds = { nome: 'pf-nome', altura: 'pf-alt', nasc: 'pf-nasc', sexo: 'pf-sexo', obj: 'pf-obj', ativ: 'pf-ativ', peso_meta: 'pf-meta' };
  function fillPerfil() {
    if (S.dirty.perfil) return;
    const P = S.perfil;
    for (const [k, id] of Object.entries(perfilIds)) { const v = P[k]; if (v == null || v === '') { if ($(id).tagName !== 'SELECT') $(id).value = ''; continue; } $(id).value = typeof v === 'number' ? fIn(v) : v; }
  }
  $('f-perfil').addEventListener('input', () => { S.dirty.perfil = true; });
  $('f-perfil').addEventListener('submit', e => {
    e.preventDefault(); if (ocupado(e.currentTarget)) return;
    const alt = numOr($('pf-alt').value), meta = numOr($('pf-meta').value);
    const doc = { nome: $('pf-nome').value.trim(), altura: alt > 80 && alt < 250 ? alt : null, nasc: isoOk($('pf-nasc').value) || null, sexo: $('pf-sexo').value || null, obj: $('pf-obj').value, ativ: $('pf-ativ').value, peso_meta: meta > 20 && meta < 400 ? meta : null };
    travar($('f-perfil'), write('config', 'perfil', doc).then(() => { S.dirty.perfil = false; $('pf-status').textContent = 'Perfil salvo.'; toast('Perfil salvo.'); }).catch(() => { $('pf-status').textContent = 'Não salvou.'; }));
  });

  /* ================= CONEXÕES (pela função "integracoes" no servidor) ================= */
  const setCx = (k, t, cls = '') => { S.cx[k] = { t, cls }; };
  function cxMsg(srv, e) {
    const c = e && e.code, m = e && e.message;
    if (c === 'session_expired') return 'Sua sessão expirou. Saia e entre de novo.';
    if (c === 'demo' || c === 'sem_funcao' || c === 'server_unavailable') return m;
    return m || `Não deu para falar com o ${srv} agora.`;
  }
  async function carregarInteg(forcar) { S.integ = await H.statusInteg(forcar); return S.integ; }

  async function notionSync(auto = false) {
    if (S.busy.notion || S.amigo) return;
    if (!S.db || !S.canWrite) { if (!auto) { setCx('notion', 'Sem permissão para salvar dados aqui.', 'bad'); renderTab(); } return; }
    S.busy.notion = true; if (!auto) renderTab();
    try {
      const r = await H.func('notion-sync');
      const fichas = r.fichas || [], dicas = r.dicas || {}, rows = r.rows || [];
      if (!fichas.length && !rows.length) throw { code: 'parse', message: 'Não encontrei fichas nem treinos no Notion. Confira os links e se a página e o Diário estão compartilhados com a sua integração (menu … → Conexões).' };
      const ops = []; let mud = 0;
      if (fichas.length) {
        const seen = new Set();
        for (const f of fichas) {
          const { id, ...doc } = f; seen.add(id);
          const cur = S.fichas.get(id);
          if (!cur || ['grupo', 'nome', 'detalhe', 'carga', 'series', 'reps', 'fav', 'ordem'].some(k => (cur[k] ?? null) !== (doc[k] ?? null))) { ops.push(write('fichas', id, doc)); mud++; }
        }
        for (const [id, f] of S.fichas) if (f.fonte === 'notion' && !seen.has(id)) { ops.push(write('fichas', id, null, 'delete')); mud++; }
      }
      const seenT = new Set();
      for (const row of rows) {
        const data = isoOk(String(row['date:Data:start'] || '').slice(0, 10)); if (!data) continue;
        const hex = (String(row.url || '').replace(/-/g, '').match(/[0-9a-f]{32}/i) || [])[0];
        const id = 'n-' + (hex ? hex.toLowerCase() : (data + '-' + slugify(row.Grupo || row.Treino || 'treino')));
        seenT.add(id);
        const doc = { data, grupo: str(row.Grupo) || 'Outro', titulo: str(row.Treino) || str(row.Grupo) || 'Treino', obs: str(row.Obs), fonte: 'notion', notion_url: str(row.url), exercicios: [] };
        const cur = S.treinos.get(id);
        if (!cur || cur.data !== doc.data || cur.grupo !== doc.grupo || cur.obs !== doc.obs || cur.titulo !== doc.titulo) { ops.push(write('treinos', id, doc)); mud++; }
      }
      if (rows.length) for (const [id, t] of S.treinos) if (t.fonte === 'notion' && !seenT.has(id)) { ops.push(write('treinos', id, null, 'delete')); mud++; }
      const res = await Promise.allSettled(ops);
      const falhas = res.filter(x => x.status === 'rejected').length;
      await syncMeta({ notion_at: Date.now(), dicas, notion_fichas: fichas.length, notion_treinos: rows.length });
      setCx('notion', falhas ? `${falhas} item(ns) não salvaram. Tente de novo.` : mud ? `Pronto: ${mud} atualização${mud === 1 ? '' : 'ões'} trazida${mud === 1 ? '' : 's'} do Notion.` : 'Tudo igual ao Notion.', falhas ? 'bad' : 'good');
      if (auto && mud) toast('Treinos atualizados do Notion.');
    } catch (e) { if (!auto) setCx('notion', cxMsg('Notion', e), 'bad'); }
    finally { S.busy.notion = false; renderTab(); }
  }

  function findActivities(p) {
    if (typeof p === 'string') { try { p = JSON.parse(p); } catch (_) { return null; } }
    if (Array.isArray(p)) return p;
    if (p && typeof p === 'object') {
      for (const k of ['activities', 'data', 'items', 'results']) if (Array.isArray(p[k])) return p[k];
      for (const v of Object.values(p)) if (Array.isArray(v) && v.length && typeof v[0] === 'object') return v;
    }
    return null;
  }
  function mapStrava(a) {
    if (!a || typeof a !== 'object') return null;
    const type = String(a.sport_type || a.type || a.activity_type || a.sportType || '');
    const nome = String(a.name || a.title || '');
    if (type ? !/run/i.test(type) : !/run|corrida/i.test(nome)) return null;
    const id = a.id ?? a.activity_id ?? a.activityId; if (id == null) return null;
    let km = null;
    if (a.distance_km != null) km = nn(a.distance_km);
    else { const d = nn(a.distance ?? a.distance_m ?? a.distance_meters); if (d != null) km = d > 250 ? d / 1000 : d; }
    if (!km || km <= 0) return null;
    let seg = a.moving_time ?? a.elapsed_time ?? a.duration ?? a.moving_time_s;
    seg = typeof seg === 'string' && seg.includes(':') ? parseTempo(seg) : nn(seg);
    const data = isoOk(String(a.start_date_local || a.start_date || a.date || a.startDate || '').slice(0, 10));
    if (!data) return null;
    return { strava_id: String(id), data, km: Math.round(km * 100) / 100, seg: seg > 0 ? Math.round(seg) : 0, nome: nome.slice(0, 120), fc: nn(a.average_heartrate ?? a.avg_heartrate), elev: nn(a.total_elevation_gain ?? a.elevation_gain), tipo: tipoCorrida(nome, a.workout_type) };
  }
  async function stravaSync(auto = false) {
    if (S.busy.strava || S.amigo) return;
    if (!S.db || !S.canWrite) { if (!auto) { setCx('strava', 'Sem permissão para salvar dados aqui.', 'bad'); renderTab(); } return; }
    S.busy.strava = true; if (!auto) renderTab();
    try {
      const r = await H.func('strava-atividades');
      const acts = findActivities(r.atividades);
      if (!acts) throw { code: 'parse', message: 'O Strava respondeu num formato que o site não reconheceu.' };
      const ops = []; let novas = 0, atual = 0, corridas = 0;
      for (const a of acts) {
        const m = mapStrava(a); if (!m) continue; corridas++;
        const id = 'strava-' + m.strava_id, cur = S.corridas.get(id);
        const doc = { ...m, fonte: 'strava', tipo: cur && cur.tipo_manual ? cur.tipo : m.tipo, tipo_manual: !!(cur && cur.tipo_manual), obs: cur ? cur.obs : '' };
        if (!cur) { novas++; ops.push(write('corridas', id, doc)); }
        else if (cur.km !== doc.km || cur.seg !== doc.seg || cur.data !== doc.data || cur.nome !== doc.nome) { atual++; ops.push(write('corridas', id, doc)); }
      }
      const falhasS = (await Promise.allSettled(ops)).filter(x => x.status === 'rejected').length;
      if (falhasS) throw { code: 'parse', message: `${falhasS} corrida(s) não salvaram. Tente sincronizar de novo.` };
      await syncMeta({ strava_at: Date.now() });
      setCx('strava', novas ? `${novas} corrida${novas === 1 ? ' nova' : 's novas'} do Strava${atual ? `, ${atual} atualizada(s)` : ''}.` : corridas ? 'Nenhuma corrida nova.' : 'O Strava não devolveu corridas dos últimos 4 meses.', 'good');
      if (auto && novas) toast(`${novas} corrida(s) nova(s) do Strava.`);
    } catch (e) { if (!auto) setCx('strava', cxMsg('Strava', e), 'bad'); }
    finally { S.busy.strava = false; renderTab(); }
  }
  function stravaConectar() {
    const st = S.integ && S.integ.strava;
    if (!st || !st.client_id) { setCx('strava', 'Primeiro cole o Client ID e o Client Secret do seu app do Strava (passo 2).', 'bad'); renderConexoes(); return; }
    const volta = location.origin + location.pathname;
    location.href = 'https://www.strava.com/oauth/authorize?' + new URLSearchParams({ client_id: st.client_id, redirect_uri: volta, response_type: 'code', approval_prompt: 'auto', scope: 'read,activity:read_all', state: 'strava' });
  }
  async function stravaRetorno() {
    const q = new URLSearchParams(location.search);
    if (q.get('state') !== 'strava') return;
    const code = q.get('code'), erro = q.get('error');
    try { history.replaceState(null, '', location.pathname + '#conexoes'); } catch (_) { }
    goTab('conexoes');
    if (erro || !code) { setCx('strava', erro === 'access_denied' ? 'Você não autorizou o Strava.' : 'O Strava não devolveu a autorização.', 'bad'); renderTab(); return; }
    if (!/activity:read/.test(q.get('scope') || '')) { setCx('strava', 'Na tela do Strava, deixe marcada a opção de ver suas atividades e conecte de novo.', 'bad'); renderTab(); return; }
    setCx('strava', 'Conectando ao Strava…'); renderTab();
    try {
      const r = await H.func('strava-trocar', { code });
      await carregarInteg(true);
      setCx('strava', `Conectado como ${r.atleta || 'você'}. Buscando corridas…`, 'good'); renderTab();
      stravaSync(false);
    } catch (e) { setCx('strava', cxMsg('Strava', e), 'bad'); renderTab(); }
  }
  function stravaCard() {
    const s = S.sync, n = [...S.corridas.values()].filter(r => r.fonte === 'strava').length, busy = S.busy.strava, msg = S.cx.strava;
    const st = (S.integ && S.integ.strava) || {};
    const m = msg ? `<p class="msg ${msg.cls}">${esc(msg.t)}</p>` : '';
    if (H.demo) return `<div class="cx"><div class="cx-status"><span class="chip">Desligado na demonstração</span></div><p class="note">Com o site publicado, cada amigo conecta o próprio Strava aqui.</p></div>`;
    if (!S.integ) return `<div class="cx"><p class="muted"><span class="spin"></span> Conferindo a conexão…</p></div>`;
    if (!st.conectado) {
      const dom = esc(location.hostname || 'seu-site');
      return `<div class="cx">
        <div class="cx-status"><span class="chip">Não conectado</span>${st.app_proprio ? '<span class="chip good">App do Strava salvo</span>' : ''}</div>${m}
        <ol>
          <li>No Runna, em Perfil → Conexões, ligue o <b>Strava</b>: as corridas passam a ir para lá sozinhas.</li>
          <li>${st.app_proprio ? 'Seu app do Strava já está salvo.' : `Crie o seu app (grátis) em <a class="link" href="https://www.strava.com/settings/api" target="_blank" rel="noopener">strava.com/settings/api</a>. Em <b>Authorization Callback Domain</b> escreva <code>${dom}</code>. Depois copie o <b>Client ID</b> e o <b>Client Secret</b> e cole abaixo.${st.app_grupo ? ' (O site já tem um app do grupo, mas o Strava só libera um atleta por app até ele ser aprovado, então o seu próprio app é o caminho garantido.)' : ''}`}</li>
          <li>Toque em <b>Conectar com o Strava</b> e autorize.</li>
        </ol>
        ${st.app_proprio ? '' : `<form class="form" id="f-strava-app" autocomplete="off"><div class="row">
          <label class="field"><span>Client ID</span><input class="mono" id="sa-id" inputmode="numeric" placeholder="ex.: 123456"></label>
          <label class="field"><span>Client Secret</span><input class="mono" id="sa-sec" type="password" autocomplete="off"></label></div>
          <div class="btn-row"><button class="btn" type="submit">Salvar app do Strava</button></div></form>`}
        <div class="btn-row"><button class="btn primary" type="button" data-act="strava-conectar" ${st.client_id ? '' : 'disabled'}>Conectar com o Strava</button>${st.app_proprio ? '<button class="btn ghost small" type="button" data-act="strava-trocar-app">Trocar app</button>' : ''}</div>
        <p class="note">Corridas do Strava aparecem só para você: pela regra do Strava, elas não entram no ranking nem no hub que os amigos veem. Para competir, lance a corrida em Corrida → Registrar corrida.</p>
      </div>`;
    }
    return `<div class="cx">
      <div class="cx-status">${s.strava_at ? `<span class="chip good">Sincronizado ${quando(s.strava_at)}</span>` : '<span class="chip">Conectado</span>'}<span class="chip">${esc(st.atleta || 'Strava')}</span><span class="chip">${n} corrida${n === 1 ? '' : 's'} do Strava</span></div>${m}
      <p class="note">As corridas do Strava ficam só com você (regra do Strava): não contam no ranking do grupo. O site confere o Strava sozinho a cada 3 horas quando você abre.</p>
      <div class="btn-row"><button class="btn primary" type="button" data-act="strava-sync" ${busy ? 'disabled' : ''}>${busy ? '<span class="spin"></span>Sincronizando…' : 'Sincronizar corridas'}</button><button class="btn ghost" type="button" data-act="strava-desconectar">Desconectar</button></div>
    </div>`;
  }
  function notionCard() {
    const s = S.sync, nF = S.fichas.size, nT = [...S.treinos.values()].filter(t => t.fonte === 'notion').length, busy = S.busy.notion, msg = S.cx.notion;
    const st = (S.integ && S.integ.notion) || {};
    const m = msg ? `<p class="msg ${msg.cls}">${esc(msg.t)}</p>` : '';
    if (H.demo) return `<div class="cx"><div class="cx-status"><span class="chip">Desligado na demonstração</span></div><p class="note">Com o site publicado, cada amigo liga a própria página de fichas e o Diário do Notion aqui.</p></div>`;
    if (!S.integ) return `<div class="cx"><p class="muted"><span class="spin"></span> Conferindo a conexão…</p></div>`;
    const form = `<form class="form" id="f-notion" autocomplete="off">
        <label class="field"><span>Token da integração</span><input id="nt-token" type="password" autocomplete="off" placeholder="ntn_…"></label>
        <label class="field"><span>Link da página das fichas</span><input id="nt-pag" placeholder="https://www.notion.so/…"><small>A página com as abas (Braço, Peito…). Opcional.</small></label>
        <label class="field"><span>Link do banco Diário de treinos</span><input id="nt-diario" placeholder="https://www.notion.so/…?v=…"><small>Colunas esperadas: título, Data, Grupo (seleção) e Obs. Opcional.</small></label>
        <div class="btn-row"><button class="btn primary" type="submit">Salvar e testar</button>${st.configurado ? '<button class="btn ghost" type="button" data-act="notion-cancelar">Cancelar</button>' : ''}</div>
      </form>`;
    if (!st.configurado || S.cx.notionEditar) return `<div class="cx">
        <div class="cx-status"><span class="chip">${st.configurado ? 'Trocando a conexão' : 'Não conectado'}</span></div>${m}
        <ol>
          <li>Abra <a class="link" href="https://www.notion.so/profile/integrations" target="_blank" rel="noopener">notion.so/profile/integrations</a> → <b>Nova integração</b> (tipo Interna, no seu espaço). Copie o <b>token</b>.</li>
          <li>No Notion, abra a página das fichas → menu <b>…</b> → <b>Conexões</b> → escolha a sua integração. Se o Diário estiver em outra página, faça o mesmo nele.</li>
          <li>Copie os links (menu … → Copiar link) e cole aqui.</li>
        </ol>${form}</div>`;
    return `<div class="cx">
      <div class="cx-status">${s.notion_at ? `<span class="chip good">Sincronizado ${quando(s.notion_at)}</span>` : '<span class="chip">Conectado, ainda não sincronizado</span>'}</div>
      <div class="counts"><div><b>${nF}</b><span>exercícios nas fichas</span></div><div><b>${nT}</b><span>treinos do Diário</span></div></div>${m}
      <p class="note">Página: <b>${esc(st.pagina_titulo || '—')}</b> · Diário: <b>${esc(st.diario_titulo || '—')}</b>. As fichas são só leitura. Um treino registrado aqui só vai para o Diário quando você toca em “Enviar ao Notion”. O site confere o Notion sozinho a cada 12 horas quando você abre.</p>
      <div class="btn-row"><button class="btn primary" type="button" data-act="notion-sync" ${busy ? 'disabled' : ''}>${busy ? '<span class="spin"></span>Sincronizando…' : 'Sincronizar com o Notion'}</button>${st.pagina_url ? `<a class="link" href="${esc(st.pagina_url)}" target="_blank" rel="noopener">Abrir página ↗</a>` : ''}<button class="btn ghost small" type="button" data-act="notion-editar">Trocar links</button><button class="btn ghost small" type="button" data-act="notion-desconectar">Desconectar</button></div>
    </div>`;
  }
  function contaCard() {
    const e = H.eu || {}, c = e.compartilha || {};
    const ms = S.membros || [];
    return `<div class="cx">
      <form class="form" id="f-conta" autocomplete="off">
        <div class="row"><label class="field"><span>Nome no ranking</span><input id="ct-nome" maxlength="40" value="${esc(e.nome || '')}"></label></div>
        <div class="field"><span>Sua cor</span><div class="cores" id="ct-cores">${H.CORES.map(cor => `<button type="button" data-act="cor" data-cor="${cor}" style="background:${cor}" aria-pressed="${cor === e.cor}" aria-label="Cor ${cor}"></button>`).join('')}</div></div>
        <p class="label" style="margin:2px 0 0">Os amigos podem ver</p>
        <label class="check"><input type="checkbox" checked disabled><span>Treinos, fichas, recordes, metas e corridas lançadas à mão<small>Sempre: é a base da competição.</small></span></label>
        <label class="check"><input type="checkbox" id="ct-sa" ${c.alimentacao ? 'checked' : ''}><span>Alimentação<small>Desligado, eles só veem se você bateu a meta do dia.</small></span></label>
        <label class="check"><input type="checkbox" id="ct-sc" ${c.corpo ? 'checked' : ''}><span>Corpo e perfil<small>Peso, medidas, % de gordura, altura, nascimento e peso meta.</small></span></label>
        <div class="btn-row"><button class="btn primary" type="submit">Salvar</button><span class="muted" id="ct-status" role="status"></span></div>
      </form>
      ${ms.length ? `<p class="label" style="margin:6px 0 0">No grupo (${ms.length})</p><div class="btn-row">${ms.map(m => `<span class="chip"><span class="gdot" style="background:${esc(corSerie(m.cor))}"></span>${esc(m.nome)}</span>`).join('')}</div>` : ''}
      <div class="btn-row" style="justify-content:space-between"><span class="muted">${esc(H.demo ? 'Modo demonstração' : (e.email || ''))}</span>${H.demo ? '<button class="btn ghost small" type="button" data-act="demo-apagar">Apagar a demonstração</button>' : '<button class="btn small" type="button" data-act="sair">Sair da conta</button>'}</div>
    </div>`;
  }
  function instalarCard() {
    const est = H.estadoInstalacao();
    const https = location.protocol === 'https:' || /^(localhost|127\.0\.0\.1)$/.test(location.hostname);
    if (est === 'instalado') return '<div class="cx"><p class="msg good">Você já está usando o app instalado.</p></div>';
    if (est === 'disponivel') return '<div class="cx"><p class="note">Toque abaixo: o ícone do Hub vai para a tela inicial e abre como aplicativo.</p><div class="btn-row"><button class="btn primary" type="button" data-act="instalar">Instalar app</button></div></div>';
    return `<div class="cx">
      ${https ? '' : '<p class="msg bad">A instalação só aparece com o site publicado (endereço https).</p>'}
      <ol>
        <li><b>iPhone / iPad:</b> abra o site no <b>Safari</b> → botão <b>Compartilhar</b> (quadrado com seta) → <b>Adicionar à Tela de Início</b>.</li>
        <li><b>Android:</b> no Chrome, menu <b>⋮</b> → <b>Instalar app</b> (ou Adicionar à tela inicial).</li>
        <li><b>Computador:</b> no Chrome ou Edge, ícone de instalar na barra de endereço.</li>
      </ol>
      <p class="note">Depois de instalado, entre uma vez com o seu e-mail e senha: o app lembra.</p>
    </div>`;
  }
  function renderConexoes() {
    if (!S.integ && !S.busy.integ) { S.busy.integ = true; carregarInteg().finally(() => { S.busy.integ = false; if (S.tab === 'conexoes') renderConexoes(); }); }
    if (!S.membros && !S.busy.membros) { S.busy.membros = true; H.membros().then(ms => { S.membros = ms; }).catch(() => { }).finally(() => { S.busy.membros = false; if (S.tab === 'conexoes') renderConexoes(); }); }
    const ativo = document.activeElement && document.activeElement.closest && document.activeElement.closest('#tab-conexoes form');
    if (!ativo || !ativo.closest('#cx-conta')) $('cx-conta').innerHTML = contaCard();
    $('cx-instalar').innerHTML = instalarCard();
    if (!ativo || !ativo.closest('#cx-notion')) $('cx-notion').innerHTML = notionCard();
    if (!ativo || !ativo.closest('#cx-strava')) $('cx-strava').innerHTML = stravaCard();
    const nG = [...S.refeicoes.values()].filter(r => r.fonte === 'growth').length, ia = S.integ && S.integ.ia;
    $('cx-growth').innerHTML = `<div class="cx">
      <div class="cx-status"><span class="chip warn">Sem integração direta</span><span class="chip ${ia && ia.disponivel ? 'good' : ''}">${ia && ia.disponivel ? `Leitura por IA ligada (${ia.provedor === 'claude' ? 'Claude' : 'Gemini'})` : 'Leitura por IA desligada'}</span><span class="chip">${nG} ite${nG === 1 ? 'm importado' : 'ns importados'}</span></div>
      <p class="note">O Growth não tem conector nem exportação de dados. O caminho mais rápido: tire um print do diário do dia no Growth e importe na aba Alimentação. A IA lê alimentos, calorias e macros, e você confere antes de salvar.${ia && !ia.disponivel && !H.demo ? ' Para ligar a leitura, quem administra o site coloca uma chave grátis do Gemini no Supabase (está no guia).' : ''}</p>
      <div class="btn-row"><button class="btn primary" type="button" data-act="go" data-tab="alimentacao" data-focus="g-form">Importar um print</button></div>
    </div>`;
    const cnt = [['treinos', 'treinos'], ['corridas', 'corridas'], ['refeicoes', 'alimentos lançados'], ['pesos', 'pesagens'], ['medidas', 'medições'], ['testes', 'recordes']];
    const pend = H.store ? H.store.pendentes() : 0;
    $('cx-dados').innerHTML = `<div class="cx"><div class="counts">${cnt.map(([k, n]) => `<div><b>${S[k].size}</b><span>${n}</span></div>`).join('')}</div>
      ${pend ? `<p class="msg">${pend} registro${pend === 1 ? '' : 's'} esperando a internet para subir.</p>` : ''}
      ${S.cx.dados ? `<p class="msg ${S.cx.dados.cls}">${esc(S.cx.dados.t)}</p>` : ''}
      <div class="btn-row"><button class="btn" type="button" data-act="backup-baixar">Baixar backup</button><button class="btn" type="button" data-act="backup">Copiar backup</button><button class="btn" type="button" data-act="restore-open">Restaurar backup</button></div></div>`;
  }

  /* ================= RANKING ================= */
  const PONTOS = { treino: 10, treinoMaxDia: 2, km: 3, kmMaxDia: 21, prot: 4, kcal: 3, agua: 2, bonusTreinos: 15, bonusKm: 15 };
  const CORES_ESCURO = { '#2a78d6': '#3987e5', '#eb6834': '#d95926', '#1baf7a': '#199e70', '#eda100': '#c98500', '#e87ba4': '#d55181', '#008300': '#008300', '#6250d6': '#9085e9', '#e34948': '#e66767' };
  const escuro = () => getComputedStyle(document.documentElement).colorScheme === 'dark';
  const corSerie = c => { const k = String(c || '#2a78d6').toLowerCase(); return escuro() ? (CORES_ESCURO[k] || k) : k; };
  function periodoRank(p) {
    const hoje = todayIso();
    if (p === 'mes') return { ini: hoje.slice(0, 8) + '01', fim: hoje, nome: `em ${MESES[+hoje.slice(5, 7) - 1]}` };
    if (p === '30d') return { ini: addDays(hoje, -29), fim: hoje, nome: 'nos últimos 30 dias' };
    if (p === 'ano') return { ini: hoje.slice(0, 4) + '-01-01', fim: hoje, nome: `em ${hoje.slice(0, 4)}` };
    return { ini: weekStartIso(hoje), fim: hoje, nome: 'nesta semana' };
  }
  async function carregarRanking(forcar) {
    const R = S.rank;
    if (R.carregando) return;
    const per = periodoRank(R.p), ini8 = addDays(weekStartIso(todayIso()), -7 * 7);
    const ini = per.ini < ini8 ? per.ini : ini8, chave = ini + '|' + per.fim;
    if (!forcar && R.dados && R.chave === chave && Date.now() - R.t < 60000) return;
    R.carregando = true; R.erro = '';
    try {
      const [membros, metas, dias] = await Promise.all([H.membros(), H.metasMembros(), H.ranking(ini, per.fim)]);
      R.dados = { ini, membros, metas: Object.fromEntries((metas || []).map(m => [m.user_id, m.data || {}])), dias: (dias || []).map(d => ({ ...d, dia: String(d.dia).slice(0, 10), km: Number(d.km) || 0, n_treinos: Number(d.n_treinos) || 0, n_corridas: Number(d.n_corridas) || 0 })) };
      R.chave = chave; R.t = Date.now(); S.membros = membros;
    } catch (e) { R.erro = navigator.onLine ? 'Não consegui atualizar o ranking agora.' : 'Sem internet: o ranking precisa de conexão.'; }
    finally { R.carregando = false; if (S.tab === 'ranking') renderRanking(); }
  }
  const metasDe = uid => { const m = { ...DEF_METAS }, d = (S.rank.dados && S.rank.dados.metas[uid]) || {}; for (const k of Object.keys(DEF_METAS)) if (typeof d[k] === 'number' && d[k] > 0) m[k] = d[k]; return m; };
  function pontuar(uid, a, b) {
    const M = metasDe(uid), r = { treinos: 0, km: 0, corridas: 0, prot: 0, kcal: 0, agua: 0, bonus: 0, pts: 0 };
    const sem = new Map();
    for (const d of S.rank.dados.dias) {
      if (d.uid !== uid || d.dia < a || d.dia > b) continue;
      const t = Math.min(d.n_treinos, PONTOS.treinoMaxDia), km = Math.min(d.km, PONTOS.kmMaxDia);
      r.treinos += d.n_treinos; r.km += d.km; r.corridas += d.n_corridas;
      if (d.prot_ok) r.prot++; if (d.kcal_ok) r.kcal++; if (d.agua_ok) r.agua++;
      r.pts += t * PONTOS.treino + km * PONTOS.km + (d.prot_ok ? PONTOS.prot : 0) + (d.kcal_ok ? PONTOS.kcal : 0) + (d.agua_ok ? PONTOS.agua : 0);
      const w = weekStartIso(d.dia), s = sem.get(w) || { t: 0, km: 0 }; s.t += t; s.km += d.km; sem.set(w, s);
    }
    for (const s of sem.values()) { if (s.t >= M.treinos_semana) r.bonus += PONTOS.bonusTreinos; if (s.km >= M.km_semana) r.bonus += PONTOS.bonusKm; }
    r.pts = Math.round(r.pts + r.bonus);
    return r;
  }
  function sequencia(uid) {
    const D = S.rank.dados, M = metasDe(uid), porSem = new Map();
    for (const d of D.dias) if (d.uid === uid) { const w = weekStartIso(d.dia); porSem.set(w, (porSem.get(w) || 0) + Math.min(d.n_treinos, PONTOS.treinoMaxDia)); }
    let w = weekStartIso(todayIso()), n = 0;
    if ((porSem.get(w) || 0) < M.treinos_semana) w = addDays(w, -7);
    const limite = weekStartIso(D.ini);
    while (w >= limite && (porSem.get(w) || 0) >= M.treinos_semana) { n++; w = addDays(w, -7); }
    return { n, mais: w < limite };
  }
  function renderRanking() {
    for (const b of $('rank-seg').querySelectorAll('button')) b.setAttribute('aria-pressed', b.dataset.p === S.rank.p ? 'true' : 'false');
    $('rank-regras').innerHTML = [
      `Cada treino de musculação: <b>${PONTOS.treino} pontos</b> (até ${PONTOS.treinoMaxDia} por dia).`,
      `Cada km de corrida lançada à mão: <b>${PONTOS.km} pontos</b> (até ${PONTOS.kmMaxDia} km por dia). Corridas do Strava não entram (regra do Strava).`,
      `Dia com a proteína batida: <b>${PONTOS.prot}</b> · calorias a até 10% da meta: <b>${PONTOS.kcal}</b> · água batida: <b>${PONTOS.agua}</b>.`,
      `Semana com a meta de treinos batida: <b>+${PONTOS.bonusTreinos}</b> · com a meta de km batida: <b>+${PONTOS.bonusKm}</b>. Cada um compete com as próprias metas.`,
      'Quem não compartilha a alimentação também pontua: o grupo só vê se a meta do dia foi batida, sem os números.',
    ].map(t => `<li>${t}</li>`).join('');
    const R = S.rank;
    if (!R.dados) {
      $('rank-box').innerHTML = R.erro ? emptyBox('Ranking indisponível', esc(R.erro)) : '<p class="muted"><span class="spin"></span> Carregando o ranking…</p>';
      $('rank-cats').innerHTML = ''; $('chart-rank').innerHTML = ''; $('rank-legend').innerHTML = '';
      if (!R.erro) carregarRanking();
      return;
    }
    carregarRanking();
    const per = periodoRank(R.p), eu = H.eu.uid, ms = R.dados.membros;
    const lista = ms.map(m => ({ m, r: pontuar(m.user_id, per.ini, per.fim) })).sort((a, b) => b.r.pts - a.r.pts || b.r.treinos - a.r.treinos || a.m.nome.localeCompare(b.m.nome));
    const max = Math.max(1, ...lista.map(x => x.r.pts));
    $('rank-sub').textContent = `Pontos ${per.nome} (${toBRs(per.ini)} a ${toBRs(per.fim)}).${R.erro ? ' ' + R.erro : ''}`;
    let pos = 0, ant = null;
    const pl = (n, s, p) => `${n} ${n === 1 ? s : p}`;
    $('rank-box').innerHTML = `<div class="rank-list">${lista.map((x, i) => {
      if (x.r.pts !== ant) { pos = i + 1; ant = x.r.pts; }
      const m = x.m, r = x.r, me = m.user_id === eu, cor = corSerie(m.cor);
      return `<div class="rk p${pos}${me ? ' eu' : ''}">
        <span class="pos">${pos}º</span>
        <div class="who"><span class="av lg" style="background:${esc(cor)}" aria-hidden="true">${esc((m.nome || '?').charAt(0))}</span><b>${esc(m.nome)}</b>${me ? '<span class="chip info">você</span>' : ''}</div>
        <div class="pts">${f0(r.pts)}<small>pontos</small></div>
        <div class="bar" aria-hidden="true"><i style="width:${Math.max(r.pts ? 2 : 0, r.pts / max * 100).toFixed(1)}%;background:${esc(cor)}"></i></div>
        <div class="det"><span class="chip">${pl(r.treinos, 'treino', 'treinos')}</span><span class="chip">${f1(r.km)} km</span><span class="chip">proteína: ${pl(r.prot, 'dia', 'dias')}</span><span class="chip">calorias: ${pl(r.kcal, 'dia', 'dias')}</span><span class="chip">água: ${pl(r.agua, 'dia', 'dias')}</span>${r.bonus ? `<span class="chip good">+${r.bonus} de bônus</span>` : ''}${me ? '' : `<button class="btn small" type="button" data-act="amigo-ver" data-uid="${esc(m.user_id)}">Ver hub</button>`}</div>
      </div>`;
    }).join('')}</div>${ms.length < 2 ? `<p class="note" style="margin-top:12px">Por enquanto só você está no grupo. Mande para os amigos o endereço do site e o código de convite: eles criam a conta e aparecem aqui.</p>` : ''}`;
    // categorias
    const seqs = Object.fromEntries(ms.map(m => [m.user_id, sequencia(m.user_id)]));
    const cat = (titulo, sub, val, fmt) => {
      const arr = lista.map(x => ({ m: x.m, v: val(x) })).sort((a, b) => b.v - a.v);
      return `<div class="cat"><span class="label">${titulo}</span><span class="muted" style="margin-top:-4px">${sub}</span><ol>${arr.map((x, i) => `<li><span><span class="gdot" style="background:${esc(corSerie(x.m.cor))}"></span>${i === 0 && x.v > 0 ? '🏆 ' : ''}${esc(x.m.nome)}</span><span class="mono">${fmt(x)}</span></li>`).join('')}</ol></div>`;
    };
    $('rank-cats').innerHTML =
      cat('Mais treinos', per.nome, x => x.r.treinos, x => String(x.v)) +
      cat('Mais quilômetros', `${per.nome}, corridas lançadas à mão`, x => x.r.km, x => f1(x.v) + ' km') +
      cat('Proteína em dia', `dias com a meta batida, ${per.nome}`, x => x.r.prot, x => String(x.v)) +
      cat('Sequência', 'semanas seguidas batendo a meta de treinos', x => seqs[x.m.user_id].n, x => `${x.v}${seqs[x.m.user_id].mais ? '+' : ''} sem.`);
    renderChartRank(ms, eu);
  }
  function renderChartRank(ms, eu) {
    const el = $('chart-rank'), ws = semanas(8), hoje = todayIso();
    const series = ms.map(m => ({ m, cor: corSerie(m.cor), eu: m.user_id === eu, vals: ws.map(w => pontuar(m.user_id, w, addDays(w, 6) > hoje ? hoje : addDays(w, 6)).pts) }));
    $('rank-legend').innerHTML = series.map(s => `<span><i class="sw" style="background:${esc(s.cor)}"></i>${esc(s.m.nome)}${s.eu && !/^voc[eê]$/i.test(s.m.nome) ? ' (você)' : ''}</span>`).join('');
    if (!series.some(s => s.vals.some(Boolean))) { el.innerHTML = emptyBox('Sem pontos nas últimas 8 semanas', 'Registre treinos, corridas e refeições: a disputa aparece aqui.'); return; }
    const W = chartW(el), H2 = 240, mg = { l: 40, r: series.length <= 4 ? 78 : 14, t: 16, b: 28 };
    const ymax0 = Math.max(10, ...series.flatMap(s => s.vals)); const tk = ticks(0, ymax0 * 1.08, 4); const ymax = Math.max(ymax0, tk[tk.length - 1]);
    const sx = i => mg.l + (ws.length === 1 ? 0.5 : i / (ws.length - 1)) * (W - mg.l - mg.r);
    const sy = v => mg.t + (ymax - v) / ymax * (H2 - mg.t - mg.b);
    const g = [];
    for (const v of tk) g.push(`<line class="grid" x1="${mg.l}" x2="${W - mg.r}" y1="${sy(v)}" y2="${sy(v)}"/><text class="ax" x="${mg.l - 7}" y="${sy(v) + 4}" text-anchor="end">${f0(v)}</text>`);
    const every = Math.max(1, Math.ceil(ws.length / Math.max(2, Math.floor((W - mg.l - mg.r) / 52))));
    ws.forEach((w, i) => { if ((ws.length - 1 - i) % every === 0) g.push(`<text class="ax" x="${sx(i)}" y="${H2 - 8}" text-anchor="middle">${toBRs(w)}</text>`); });
    const ordem = [...series].sort((a, b) => (a.eu ? 1 : 0) - (b.eu ? 1 : 0));          // a sua linha por cima
    for (const s of ordem) {
      g.push(`<path class="ln-m${s.eu ? ' eu' : ''}" style="stroke:${esc(s.cor)}" d="${s.vals.map((v, i) => `${i ? 'L' : 'M'}${sx(i).toFixed(1)},${sy(v).toFixed(1)}`).join(' ')}"/>`);
      s.vals.forEach((v, i) => g.push(`<circle class="pt-m" style="fill:${esc(s.cor)}" cx="${sx(i).toFixed(1)}" cy="${sy(v).toFixed(1)}" r="${i === s.vals.length - 1 ? 5 : 4}"/>`));
    }
    if (series.length <= 4) {                                                                // rótulos diretos no fim da linha, sem encavalar
      const fins = series.map(s => ({ s, y: sy(s.vals[s.vals.length - 1]) })).sort((a, b) => a.y - b.y);
      for (let i = 1; i < fins.length; i++) if (fins[i].y - fins[i - 1].y < 14) fins[i].y = fins[i - 1].y + 14;
      for (const f of fins) g.push(`<text class="axl" x="${sx(ws.length - 1) + 9}" y="${(f.y + 4).toFixed(1)}" text-anchor="start">${esc(f.s.m.nome.slice(0, 10))}</text>`);
    }
    g.push(`<line id="rk-cross" class="ref" x1="0" x2="0" y1="${mg.t}" y2="${H2 - mg.b}" style="display:none"/>`);
    const passo = ws.length > 1 ? (W - mg.l - mg.r) / (ws.length - 1) : W;
    ws.forEach((w, i) => g.push(`<rect class="hit" data-i="${i}" x="${(sx(i) - passo / 2).toFixed(1)}" y="${mg.t}" width="${passo.toFixed(1)}" height="${H2 - mg.t - mg.b}"/>`));
    el.style.position = 'relative';
    el.innerHTML = `<svg viewBox="0 0 ${W} ${H2}" role="img" aria-label="Pontos por semana de cada membro nas últimas 8 semanas.">${g.join('')}</svg><div class="toast" id="rk-tip" role="status" style="position:absolute;bottom:auto;transform:none;pointer-events:none;font-size:13px;line-height:1.5;max-width:220px" hidden></div>
      <details style="margin-top:8px"><summary class="muted" style="cursor:pointer">Ver em tabela</summary><div class="table-wrap"><table><thead><tr><th>Semana</th>${series.map(s => `<th class="n">${esc(s.m.nome)}</th>`).join('')}</tr></thead><tbody>${ws.map((w, i) => `<tr><td class="mono">${toBR(w)}</td>${series.map(s => `<td class="n">${f0(s.vals[i])}</td>`).join('')}</tr>`).join('')}</tbody></table></div></details>`;
    const svg = el.querySelector('svg'), tip = $('rk-tip'), cross = $('rk-cross');
    const mostrar = i => {
      const x = sx(i);
      cross.setAttribute('x1', x); cross.setAttribute('x2', x); cross.style.display = '';
      const linhas = [...series].sort((a, b) => b.vals[i] - a.vals[i]).map(s => `<div style="display:flex;justify-content:space-between;gap:12px"><span><i style="display:inline-block;width:8px;height:8px;border-radius:50%;background:${esc(s.cor)};margin-right:6px"></i>${esc(s.m.nome)}</span><b>${f0(s.vals[i])}</b></div>`).join('');
      tip.innerHTML = `<div style="opacity:.75">Semana de ${toBRs(ws[i])}</div>${linhas}`; tip.hidden = false;
      const esc2 = svg.getBoundingClientRect().width / W, px = x * esc2;
      tip.style.left = Math.max(0, Math.min(px + 12, el.clientWidth - tip.offsetWidth)) + 'px'; tip.style.top = '8px';
    };
    svg.addEventListener('pointermove', e => { const r = e.target.closest('.hit'); if (r) mostrar(+r.dataset.i); });
    svg.addEventListener('pointerleave', () => { tip.hidden = true; cross.style.display = 'none'; });
  }
  $('rank-seg').addEventListener('click', e => { const b = e.target.closest('button[data-p]'); if (!b) return; S.rank.p = b.dataset.p; renderRanking(); carregarRanking(); });

  /* ================= HUB DE UM AMIGO (só leitura) ================= */
  async function abrirAmigo(uid) {
    const m = ((S.rank.dados && S.rank.dados.membros) || S.membros || []).find(x => x.user_id === uid);
    if (!m || uid === H.eu.uid) return;
    toast(`Abrindo o hub de ${m.nome}…`);
    let rows;
    try { rows = await H.carregarAmigo(uid); } catch (e) { toast('Não consegui abrir o hub agora. Confira a internet.'); return; }
    if (!S.amigo) S.meu = { tForm: S.tForm, foodDate: S.foodDate, diaSel: S.diaSel, calMes: S.calMes, growth: S.growth, metasSalvas: S.metasSalvas, tab: S.tab };
    S.amigo = { uid, nome: m.nome, cor: m.cor, compartilha: m.compartilha || {} };
    S.canWrite = false;
    for (const c of Object.keys(MAPS)) S[c] = new Map();
    S.perfil = {}; S.metas = { ...DEF_METAS }; S.metasSalvas = true; S.sync = {};
    for (const r of rows) {
      if (r.deleted) continue;
      if (MAPS[r.col]) { try { S[r.col].set(r.id, MAPS[r.col](r.id, r.data || {})); } catch (_) { } }
      else if (r.col === 'config' && r.data) {
        if (r.id === 'perfil') S.perfil = r.data;
        else if (r.id === 'sync') S.sync = r.data;
        else if (r.id === 'metas') for (const k of Object.keys(DEF_METAS)) if (typeof r.data[k] === 'number' && r.data[k] > 0) S.metas[k] = r.data[k];
      }
    }
    S._sess = null; S.tForm = null; S.growth = null; S.fichaGrupo = null; S.histGrupo = 'todos'; S.histAll = false; S.runMes = 'todos';
    S.foodDate = todayIso(); S.diaSel = todayIso(); S.calMes = todayIso().slice(0, 7);
    document.body.classList.add('modo-amigo');
    $('amigo-bar').hidden = false; $('amigo-nome').textContent = m.nome;
    const oc = []; if (!S.amigo.compartilha.alimentacao) oc.push('a alimentação'); if (!S.amigo.compartilha.corpo) oc.push('o corpo');
    $('amigo-oculto-txt').textContent = oc.length ? ` ${m.nome} não compartilha ${oc.join(' nem ')}.` : '';
    setSave('readonly', 'Só leitura');
    S.navegou = true; goTab('painel');
  }
  function sairAmigo() {
    if (!S.amigo) return;
    const M = S.meu || {};
    S.amigo = null; S.canWrite = true;
    document.body.classList.remove('modo-amigo'); $('amigo-bar').hidden = true;
    S.tForm = M.tForm || null; S.growth = M.growth || null;
    if (M.foodDate) S.foodDate = M.foodDate; if (M.diaSel) S.diaSel = M.diaSel; if (M.calMes) S.calMes = M.calMes;
    S.metasSalvas = !!M.metasSalvas; S.meu = null; S.fichaGrupo = null;
    setSave('saved', 'Dados em dia');
    if (H.store) H.store.emitirTodos();
    goTab('ranking');
  }
  function abrirConta() {
    if (S.amigo) sairAmigo();
    S.navegou = true; goTab('conexoes');
    setTimeout(() => $('cx-conta').scrollIntoView({ behavior: 'smooth', block: 'start' }), 80);
  }

  /* formulários das conexões e da conta */
  document.addEventListener('submit', async e => {
    const f = e.target, id = f && f.id;
    if (!['f-notion', 'f-strava-app', 'f-conta'].includes(id)) return;
    e.preventDefault();
    const b = f.querySelector('button[type="submit"]'); if (b) b.disabled = true;
    try {
      if (id === 'f-conta') {
        const cor = (f.querySelector('[data-cor][aria-pressed="true"]') || {}).dataset;
        await H.salvarConta({ nome: $('ct-nome').value, cor: cor && cor.cor, compartilha: { alimentacao: $('ct-sa').checked, corpo: $('ct-sc').checked } });
        S.membros = null; S.rank.t = 0;
        toast('Conta atualizada.');
      } else if (id === 'f-notion') {
        const body = { token: $('nt-token').value.trim(), pagina: $('nt-pag').value.trim(), diario: $('nt-diario').value.trim() };
        setCx('notion', 'Testando o acesso ao Notion…'); $('cx-notion').querySelector('.cx').insertAdjacentHTML('afterbegin', '<p class="msg"><span class="spin"></span> Testando…</p>');
        const r = await H.func('notion-salvar', body);
        S.cx.notionEditar = false;
        await carregarInteg(true);
        setCx('notion', `Conectado: ${[r.pagina_titulo, r.diario_titulo].filter(Boolean).join(' e ')}. Buscando as fichas…`, 'good');
        document.activeElement && document.activeElement.blur && document.activeElement.blur();
        renderConexoes(); notionSync(false);
      } else if (id === 'f-strava-app') {
        await H.func('strava-app', { client_id: $('sa-id').value.trim(), client_secret: $('sa-sec').value.trim() });
        await carregarInteg(true);
        setCx('strava', 'App do Strava salvo. Agora toque em Conectar com o Strava.', 'good');
        document.activeElement && document.activeElement.blur && document.activeElement.blur();
      }
    } catch (err) {
      const k = id === 'f-notion' ? 'notion' : id === 'f-strava-app' ? 'strava' : null;
      if (k) setCx(k, cxMsg(k === 'notion' ? 'Notion' : 'Strava', err), 'bad'); else { const st = $('ct-status'); if (st) st.textContent = (err && err.message) || 'Não salvou.'; }
      document.activeElement && document.activeElement.blur && document.activeElement.blur();
    } finally { if (b && b.isConnected) b.disabled = false; renderConexoes(); }
  });

  /* ---------- cronômetro de descanso ---------- */
  const LS_REST = 'hub-evolucao:descanso:v1';
  let restEnd = 0, restInt = null, actx = null;
  function primeAudio() { try { actx = actx || new (window.AudioContext || window.webkitAudioContext)(); if (actx.state === 'suspended') actx.resume(); } catch (_) { } }
  function beep() {
    try { if (!actx) return; [0, .25, .5].forEach(d => { const o = actx.createOscillator(), g = actx.createGain(); o.frequency.value = 880; g.gain.value = .15; o.connect(g); g.connect(actx.destination); o.start(actx.currentTime + d); o.stop(actx.currentTime + d + .15); }); } catch (_) { }
  }
  function restStart(fim) { restEnd = fim; lsSet(LS_REST, { fim }); if (!restInt) restInt = setInterval(restTick, 250); restTick(); }
  function restStop(acabou) {
    clearInterval(restInt); restInt = null; restEnd = 0; lsDel(LS_REST); $('rest-pill').hidden = true;
    if (!acabou) return;
    try { if (navigator.vibrate) navigator.vibrate([200, 100, 200]); } catch (_) { }
    beep(); toast('Descanso acabou. Próxima série!');
  }
  function restTick() {
    const left = restEnd - Date.now();
    if (left <= 0) { restStop(left > -60000); return; }
    $('rest-time').textContent = fmtTempo(Math.ceil(left / 1000)); $('rest-pill').hidden = false;
  }
  document.addEventListener('click', e => {
    const b = e.target.closest('[data-rest]'); if (!b) return;
    const v = b.dataset.rest;
    if (v === 'stop') restStop(false);
    else if (v === '+15') { if (restEnd) restStart(restEnd + 15000); }
    else { primeAudio(); restStart(Date.now() + Number(v) * 1000); }
  });

  /* ---------- janela genérica ---------- */
  function abrirModal(titulo, html) { $('gm-title').textContent = titulo; $('gm-body').innerHTML = html; $('g-modal').hidden = false; document.body.style.overflow = 'hidden'; $('g-modal').querySelector('.modal-card').focus(); }
  function fecharModal() { $('g-modal').hidden = true; $('gm-body').innerHTML = ''; document.body.style.overflow = ''; S.restore = null; }
  $('gm-close').addEventListener('click', fecharModal);
  $('g-modal').addEventListener('click', e => { if (e.target === e.currentTarget) fecharModal(); });

  /* ---------- evolução de um exercício ---------- */
  function abrirEvolucao(nome) {
    const k = normNome(nome), by = new Map();
    for (const t of S.treinos.values()) { if (!t.data) continue; for (const e of t.exercicios) if (normNome(e.nome) === k) { const c = by.get(t.data); if (!c || (e.carga ?? -1) > (c.carga ?? -1)) by.set(t.data, e); } }
    const regs = [...by].sort((a, b) => a[0].localeCompare(b[0]));
    const pts = regs.filter(([, e]) => e.carga != null).map(([d, e]) => ({ t: dateOf(d).getTime(), v: e.carga, x: toBRs(d), title: `${toBR(d)}: ${f1(e.carga)} kg${e.reps ? ' × ' + e.reps : ''}` }));
    if (!regs.length) { abrirModal(nome, emptyBox('Ainda sem registros', 'Marque este exercício num treino e salve: a evolução da carga aparece aqui.')); return; }
    let resumo = `${regs.length} treino${regs.length === 1 ? '' : 's'} com este exercício.`;
    if (pts.length) {
      const pri = pts[0], ult = pts[pts.length - 1], mel = pts.reduce((m, q) => q.v > m.v ? q : m, pts[0]), d = ult.v - pri.v;
      resumo = `<span>Primeira: <b>${f1(pri.v)} kg</b> (${pri.x})</span><span>Última: <b>${f1(ult.v)} kg</b> (${ult.x})</span><span>Maior: <b>${f1(mel.v)} kg</b> (${mel.x})</span>${pts.length > 1 ? `<span>Variação: <b>${d > 0 ? '+' : d < 0 ? '−' : ''}${f1(Math.abs(d))} kg</b></span>` : ''}`;
    }
    abrirModal(nome, `<div class="calc-preview">${resumo}</div>
      <div class="chart" id="evo-chart"></div>
      <div class="table-wrap"><table><thead><tr><th>Data</th><th class="n">Carga</th><th>Séries</th></tr></thead><tbody>${[...regs].reverse().slice(0, 12).map(([d, e]) => `<tr><td class="mono">${toBR(d)}</td><td class="n">${e.carga != null ? f1(e.carga) + ' kg' : '—'}</td><td>${e.sets ? esc(fmtSets(e.sets)) : esc(fmtSR(e) || '—')}</td></tr>`).join('')}</tbody></table></div>`);
    const el = $('evo-chart');
    if (pts.length >= 2) lineChart(el, pts, { cls: 'body', unit: 'kg', H: 200, aria: `Evolução da carga em ${nome}.` });
    else el.innerHTML = `<p class="note">${pts.length ? 'O gráfico aparece a partir do segundo treino com carga.' : 'Nenhum registro com carga ainda.'}</p>`;
  }

  /* ---------- restaurar backup ---------- */
  function lerBackup(txt) {
    let d; try { d = JSON.parse(txt); } catch (_) { return { erro: 'Esse texto não é um backup válido: está incompleto ou foi alterado.' }; }
    if (!d || typeof d !== 'object' || !Object.keys(MAPS).some(k => Array.isArray(d[k]))) return { erro: 'Não reconheci este backup. Use o texto copiado em “Copiar backup (JSON)”.' };
    const ops = [], res = [];
    for (const col of Object.keys(MAPS)) {
      const arr = Array.isArray(d[col]) ? d[col].slice(0, 5000) : []; let novos = 0, dif = 0, iguais = 0;
      for (const it of arr) {
        if (!it || typeof it !== 'object' || !idOk(it.id)) continue;
        const { id, ...raw } = it; let m; try { m = MAPS[col](id, raw); } catch (_) { continue; }
        const cur = S[col].get(id);
        if (cur && JSON.stringify(cur) === JSON.stringify(m)) { iguais++; continue; }
        if (cur) dif++; else novos++;
        const { id: _id, ...doc } = m; ops.push([col, id, doc]);
      }
      if (arr.length) res.push([col, novos, dif, iguais]);
    }
    for (const k of ['perfil', 'metas']) {
      const v = d[k]; if (!v || typeof v !== 'object' || Array.isArray(v) || !Object.keys(v).length) continue;
      if (JSON.stringify(v) !== JSON.stringify(S[k])) { ops.push(['config', k, v]); res.push([k, 0, 1, 0]); } else res.push([k, 0, 0, 1]);
    }
    return { ops, res };
  }
  const NOME_COL = { treinos: 'Treinos', fichas: 'Fichas', corridas: 'Corridas', refeicoes: 'Alimentos lançados', agua: 'Água (dias)', pesos: 'Pesagens', medidas: 'Medições', testes: 'Recordes', alimentos: 'Alimentos frequentes', perfil: 'Perfil', metas: 'Metas' };
  function abrirRestaurar() {
    abrirModal('Restaurar backup', `<p class="sub" style="margin:0">Cole o texto do backup ou escolha o arquivo. O que estiver no backup volta; se um registro existir nos dois, vale o do backup. Nada do que não está no backup é apagado.</p>
      <textarea id="rb-text" placeholder="Cole aqui o backup (JSON)" aria-label="Texto do backup"></textarea>
      <input type="file" id="rb-file" accept=".json,.txt,application/json,text/plain" aria-label="Arquivo do backup">
      <div class="btn-row"><button class="btn primary" type="button" id="rb-check">Conferir backup</button></div>
      <div id="rb-out" role="status"></div>`);
  }
  $('gm-body').addEventListener('change', e => {
    if (e.target.id !== 'rb-file') return;
    const f = e.target.files && e.target.files[0]; if (!f) return;
    if (f.size > 20e6) { $('rb-out').innerHTML = '<p class="note warn">Arquivo grande demais para ser um backup deste app.</p>'; return; }
    const rd = new FileReader(); rd.onload = () => { const t = $('rb-text'); if (t) t.value = String(rd.result || ''); }; rd.readAsText(f);
  });
  $('gm-body').addEventListener('click', e => {
    const out = $('rb-out');
    if (e.target.id === 'rb-check') {
      const r = lerBackup($('rb-text').value.trim() || '');
      if (r.erro) { S.restore = null; out.innerHTML = `<p class="note warn">${esc(r.erro)}</p>`; return; }
      S.restore = r;
      out.innerHTML = `<div class="table-wrap"><table><thead><tr><th>No backup</th><th class="n">Novos</th><th class="n">Diferentes</th><th class="n">Iguais</th></tr></thead><tbody>${r.res.map(([c, a, b2, c2]) => `<tr><td>${NOME_COL[c] || c}</td><td class="n">${a}</td><td class="n">${b2}</td><td class="n">${c2}</td></tr>`).join('')}</tbody></table></div>
        ${r.ops.length ? `<div class="btn-row" style="margin-top:10px"><button class="btn primary" type="button" id="rb-go">Restaurar ${r.ops.length} registro${r.ops.length === 1 ? '' : 's'}</button></div>` : '<p class="note" style="margin-top:10px">Tudo o que está no backup já está no app. Não há nada para restaurar.</p>'}`;
    } else if (e.target.id === 'rb-go' && S.restore && !S.restore.rodando) {
      if (!S.db || !S.canWrite) { out.innerHTML = '<p class="note warn">Sem permissão para salvar aqui. Saia e entre de novo na sua conta.</p>'; return; }
      armar(e.target, () => restaurar(S.restore, out));
    }
  });
  async function restaurar(R, out) {
    R.rodando = true;
    const ops = R.ops, total = ops.length; let i = 0, ok = 0, falha = 0;
    out.innerHTML = '<p class="note" id="rb-prog">Restaurando…</p>';
    /* tudo entra na fila de uma vez: o núcleo envia em lotes de 200 */
    const prog = () => { const pr = $('rb-prog'); if (pr) pr.textContent = `Restaurando… ${ok + falha} de ${total}${navigator.onLine ? '' : ' (sem internet: termina quando a conexão voltar)'}`; };
    i = total;
    await Promise.all(ops.map(([c, id, doc]) => write(c, id, doc).then(() => { ok++; prog(); }, () => { falha++; prog(); })));
    const pr = $('rb-prog');
    if (pr) { pr.classList.toggle('warn', !!falha); pr.textContent = falha ? `${ok} restaurado${ok === 1 ? '' : 's'}; ${total - ok} não ${total - ok === 1 ? 'entrou' : 'entraram'}. Confira a conexão e restaure de novo: o que já entrou não se repete.` : `Pronto: ${ok} registro${ok === 1 ? '' : 's'} restaurado${ok === 1 ? '' : 's'}.`; }
    toast(falha ? 'Backup restaurado em parte.' : 'Backup restaurado.');
    S.restore = null;
  }

  /* ---------- editar corrida, alimento e pesagem (no mesmo formulário de cadastro) ---------- */
  const EDF = {
    corridas: { form: 'f-run', status: 'r-status', salvar: 'Salvar corrida', limpar: ['r-km', 'r-tempo', 'r-fc', 'r-obs'] },
    refeicoes: { form: 'f-food', status: 'a-status', salvar: 'Adicionar', limpar: ['a-nome', 'a-qtd', 'a-kcal', 'a-prot', 'a-carb', 'a-gord'] },
    pesos: { form: 'f-peso', status: 'p-status', salvar: 'Salvar peso', limpar: ['p-peso', 'p-gord'] },
  };
  function modoEdicao(col, id) {
    const c = EDF[col], f = $(c.form), sb = f.querySelector('button[type="submit"]');
    S.edit[col] = id || null;
    sb.textContent = id ? 'Salvar alterações' : c.salvar;
    let b = f.querySelector('.ed-cancel');
    if (id && !b) { b = document.createElement('button'); b.type = 'button'; b.className = 'btn ghost ed-cancel'; b.textContent = 'Cancelar edição'; b.dataset.act = 'ed-cancel'; b.dataset.col = col; sb.after(b); }
    else if (!id && b) b.remove();
  }
  function cancelarEdicao(col, msg) {
    const c = EDF[col]; for (const id of c.limpar) $(id).value = '';
    if (col === 'refeicoes') { $('a-mult').value = '1'; foodPreview(); } else if (col === 'corridas') runPreview();
    modoEdicao(col, null); $(c.status).textContent = msg || '';
  }
  function abrirEdicaoReg(col, id) {
    const r = S[col].get(id), c = EDF[col]; if (!r || !c) return;
    if (col === 'corridas') {
      $('r-data').value = r.data; const sel = $('r-tipo'); sel.value = [...sel.options].some(o => o.value === r.tipo) ? r.tipo : 'Outro';
      $('r-km').value = fIn(r.km); $('r-tempo').value = r.seg ? fmtTempo(r.seg) : ''; $('r-fc').value = fIn(r.fc); $('r-obs').value = r.obs; runPreview();
    } else if (col === 'refeicoes') {
      $('a-ref').value = r.ref; $('a-nome').value = r.alimento; $('a-qtd').value = r.qtd; $('a-mult').value = '1';
      $('a-kcal').value = fIn(r.kcal); $('a-prot').value = fIn(r.prot); $('a-carb').value = fIn(r.carb); $('a-gord').value = fIn(r.gord); foodPreview();
    } else { $('p-data').value = r.data; $('p-peso').value = fIn(r.peso); $('p-gord').value = fIn(r.gordura); }
    modoEdicao(col, id);
    $(c.status).textContent = col === 'corridas' ? `Editando a corrida de ${toBR(r.data)}.` : col === 'refeicoes' ? `Editando “${r.alimento}” (valores totais do item).` : `Editando a pesagem de ${toBR(r.data)}.`;
    setTimeout(() => $(c.form).scrollIntoView({ behavior: 'smooth', block: 'center' }), 60);
  }

  /* ---------- enviar treino ao Diário do Notion ---------- */
  const GRUPOS_NOTION = ['Braço', 'Peito', 'Perna', 'Costas', 'Ombro', 'Outro'];
  async function enviarNotion(ids) {
    if (S.busy.envio || S.amigo) return;
    const ts = ids.map(id => S.treinos.get(id)).filter(t => t && t.fonte !== 'notion').sort((a, b) => (a.criado || 0) - (b.criado || 0));
    if (!ts.length) return;
    if (ts.some(t => t.notion_enviado)) { toast('Este treino já foi enviado ao Notion.'); return; }
    if (!S.db || !S.canWrite) { toast('Sem permissão para salvar aqui.'); return; }
    const st = await carregarInteg();
    if (!st.notion || !st.notion.configurado || !st.notion.tem_diario) { toast(H.demo ? 'Desligado no modo demonstração.' : 'Conecte o Diário do Notion na aba Conexões para enviar treinos.'); return; }
    S.busy.envio = true; toast('Enviando ao Notion…');
    try {
      const t0 = ts[0], exs = new Map(); for (const t of ts) for (const e of t.exercicios) exs.set(normNome(e.nome), e);
      const linhas = [...exs.values()].map(e => { const det = e.sets ? fmtSets(e.sets) : [e.carga != null ? f1(e.carga) + ' kg' : '', fmtSR(e)].filter(Boolean).join(', '); return `- ${e.nome}${det ? ': ' + det : ''}`; });
      const durs = ts.map(t => t.duracao).filter(v => v != null), obs = [...new Set(ts.map(t => t.obs).filter(Boolean))].join(' · ');
      const res = await H.func('notion-enviar', { treino: {
        titulo: t0.grupo, data: t0.data, grupo: GRUPOS_NOTION.includes(t0.grupo) ? t0.grupo : 'Outro', obs,
        conteudo: [...linhas, durs.length ? `Duração: ${f0(Math.max(...durs))} min` : '', 'Registrado no Hub de Evolução.'].filter(Boolean).join('\n'),
      } });
      const hex = hexDe(res.id) || hexDe(res.url);
      const marca = { notion_enviado: Date.now(), notion_url: hex ? 'https://www.notion.so/' + hex : (res.url || '') };
      const rs = await Promise.allSettled(ts.map(t => write('treinos', t.id, marca, 'update')));
      toast(rs.some(r => r.status === 'rejected') ? 'Foi para o Notion, mas não consegui marcar aqui como enviado.' : `Treino de ${t0.grupo} enviado ao Diário do Notion.`);
      const stt = $('t-status'); if (stt.querySelector('[data-act="notion-send"]')) stt.textContent = 'Treino enviado ao Diário do Notion.';
    } catch (e) { const m = cxMsg('Notion', e); toast(m); $('t-status').textContent = 'Não foi para o Notion: ' + m; }
    finally { S.busy.envio = false; rerender(); }
  }

  /* ---------- cliques gerais ---------- */
  document.addEventListener('click', e => {
    const b = e.target.closest('[data-act]'); if (!b) return;
    const act = b.dataset.act;
    if (act === 'del') {
      armar(b, () => {
        const ids = b.dataset.ids.split(',').filter(Boolean), F = S.tForm;
        if (EDF[b.dataset.col] && ids.includes(S.edit[b.dataset.col])) cancelarEdicao(b.dataset.col, '');
        if (b.dataset.col === 'treinos' && F && F.editando && ids.includes(F.id)) { apagarRascunho(true); newTForm(null); renderTForm(); $('t-status').textContent = 'O treino que você editava foi apagado.'; }
        Promise.all(ids.map(id => write(b.dataset.col, id, null, 'delete'))).then(() => toast('Apagado.')).catch(() => { });
      });
    } else if (act === 'go') {
      const g = b.dataset.g, f = b.dataset.focus;
      S.navegou = true;
      goTab(b.dataset.tab);
      /* não troca um treino em andamento por um novo */
      if (b.dataset.tab === 'treinos' && g) {
        if (temConteudo(S.tForm)) $('t-status').textContent = `Treino de ${S.tForm.grupo} em andamento. Salve ou limpe antes de começar outro.`;
        else { newTForm(g, S.tForm && S.tForm.dataManual ? S.tForm.data : null); renderTForm(); }
      }
      if (f && $(f)) setTimeout(() => $(f).scrollIntoView({ behavior: 'smooth', block: 'start' }), 60);
    } else if (act === 'agua') {
      /* soma na hora: dois toques rápidos não se perdem esperando a resposta do anterior */
      const dia = b.dataset.dia || todayIso(), delta = Number(b.dataset.ml), ml = Math.max(0, aguaDia(dia) + delta);
      S.agua.set(dia, { id: dia, ml }); rerender();
      write('agua', dia, { ml }).catch(() => { S.agua.set(dia, { id: dia, ml: Math.max(0, aguaDia(dia) - delta) }); rerender(); });
    } else if (act === 'reg-dia') {
      S.navegou = true;
      goTab('treinos');
      if (temConteudo(S.tForm)) $('t-status').textContent = `Treino de ${S.tForm.grupo} em andamento. Salve ou limpe antes de registrar outro dia.`;
      else { newTForm(null, b.dataset.dia); renderTForm(); }
      setTimeout(() => $('f-treino').scrollIntoView({ behavior: 'smooth', block: 'start' }), 60);
    } else if (act === 'edit-treino') abrirEdicao(b.dataset.ids.split(',').filter(Boolean));
    else if (act === 'hist-all') { S.histAll = !S.histAll; renderHist(); }
    else if (act === 'evo') abrirEvolucao(b.dataset.nome);
    else if (act === 'restore-open') abrirRestaurar();
    else if (act === 'ed') abrirEdicaoReg(b.dataset.col, b.dataset.id);
    else if (act === 'ed-cancel') cancelarEdicao(b.dataset.col, 'Edição cancelada.');
    else if (act === 'notion-send') enviarNotion(b.dataset.ids.split(',').filter(Boolean));
    else if (act === 'notion-sync') notionSync(false);
    else if (act === 'strava-sync') stravaSync(false);
    else if (act === 'strava-conectar') stravaConectar();
    else if (act === 'strava-trocar-app') { if (S.integ && S.integ.strava) S.integ.strava.app_proprio = false; renderConexoes(); }
    else if (act === 'strava-desconectar') armar(b, () => H.func('strava-desconectar').then(() => carregarInteg(true)).then(() => { setCx('strava', 'Strava desconectado. As corridas já trazidas continuam aqui.'); renderConexoes(); }, e => { setCx('strava', cxMsg('Strava', e), 'bad'); renderConexoes(); }));
    else if (act === 'notion-editar') { S.cx.notionEditar = true; renderConexoes(); }
    else if (act === 'notion-cancelar') { S.cx.notionEditar = false; renderConexoes(); }
    else if (act === 'notion-desconectar') armar(b, () => H.func('notion-desconectar').then(() => carregarInteg(true)).then(() => { setCx('notion', 'Notion desconectado. Fichas e treinos já trazidos continuam aqui.'); renderConexoes(); }, e => { setCx('notion', cxMsg('Notion', e), 'bad'); renderConexoes(); }));
    else if (act === 'amigo-ver') abrirAmigo(b.dataset.uid);
    else if (act === 'amigo-sair') sairAmigo();
    else if (act === 'instalar') H.instalar().then(() => renderConexoes());
    else if (act === 'sair') armar(b, () => H.sair());
    else if (act === 'demo-apagar') armar(b, () => H.apagarDemo());
    else if (act === 'cor') { for (const x of b.parentElement.querySelectorAll('[data-cor]')) x.setAttribute('aria-pressed', x === b ? 'true' : 'false'); }
    else if (act === 'backup-baixar') {
      const dump = {}; for (const k of Object.keys(MAPS)) dump[k] = [...S[k].values()];
      dump.perfil = S.perfil; dump.metas = S.metas;
      try {
        const url = URL.createObjectURL(new Blob([JSON.stringify(dump)], { type: 'application/json' }));
        const a = document.createElement('a'); a.href = url; a.download = `hub-evolucao-backup-${todayIso()}.json`; document.body.appendChild(a); a.click(); a.remove();
        setTimeout(() => URL.revokeObjectURL(url), 4000);
        setCx('dados', 'Backup baixado. Guarde o arquivo num lugar seguro.', 'good');
      } catch (_) { setCx('dados', 'O navegador não deixou baixar. Use “Copiar backup”.', 'bad'); }
      renderConexoes();
    }
    else if (act === 'freq') { const a = S.alimentos.get(b.dataset.id); if (a) { fillAlimento(a); $('a-mult').focus(); $('a-mult').select(); } }
    else if (act === 'backup') {
      const dump = {}; for (const k of Object.keys(MAPS)) dump[k] = [...S[k].values()];
      dump.perfil = S.perfil; dump.metas = S.metas;
      const txt = JSON.stringify(dump);
      Promise.resolve().then(() => navigator.clipboard.writeText(txt)).then(() => { setCx('dados', `Backup copiado (${f0(txt.length / 1024)} KB). Cole num arquivo ou nota para guardar.`, 'good'); renderConexoes(); }, () => { setCx('dados', 'O navegador não deixou copiar. Use “Baixar backup”.', 'bad'); renderConexoes(); });
    }
  });

  /* ---------- início (chamado pelo nucleo.js depois do login) ---------- */
  function start(ctx) {
    const hoje = todayIso();
    ['r-data', 'p-data', 'md-data', 'x-data'].forEach(id => $(id).value = hoje);
    $('a-ref').innerHTML = REFS.map(([k, n]) => `<option value="${k}">${n}</option>`).join(''); $('a-ref').value = refPadrao();
    $('x-reps-wrap').classList.toggle('hidden', $('x-unid').value !== 'kg');
    runPreview(); foodPreview();
    /* volta o que estava em andamento antes de a aba fechar */
    const rl = lsGet(LS_RT);
    if (rascunhoValido(rl)) { restaurarRascunho(rl); if (!temConteudo(S.tForm)) { S.tForm = null; lsDel(LS_RT); } }
    const rs0 = lsGet(LS_REST); if (rs0 && nn(rs0.fim) > Date.now()) restStart(rs0.fim);
    const gl = lsGet(LS_G);
    if (gl && Array.isArray(gl.itens) && gl.itens.length) {
      S.growth = { data: isoOk(gl.data) && gl.data <= hoje ? gl.data : hoje, origem: gl.origem === 'growth' ? 'growth' : 'ia', itens: gl.itens.filter(i => i && i.alimento).map(i => ({ id: idOk(i.id) ? i.id : uid('f'), sel: !!i.sel, ref: REF_TXT[i.ref] ? i.ref : 'outro', alimento: str(i.alimento).slice(0, 120), qtd: str(i.qtd).slice(0, 60), kcal: nn(i.kcal) || 0, prot: nn(i.prot) || 0, carb: nn(i.carb) || 0, gord: nn(i.gord) || 0, estimado: !!i.estimado })) };
      if (S.growth.itens.length) $('g-status').textContent = 'Leitura anterior recuperada. Confira e adicione.'; else S.growth = null;
    }
    const db = ctx.store;
    S.db = db; S.canWrite = true;
    const h0 = location.hash.slice(1);
    showTab(h0 || (temConteudo(S.tForm) ? 'treinos' : 'painel'));
    if (S.tForm) { renderTForm(); if (temConteudo(S.tForm)) toast('Treino em andamento recuperado.'); }
    const timer = setTimeout(() => { if (!S.any) setSave('error', navigator.onLine ? 'Demorando para carregar…' : 'Sem internet'); }, 10000);
    const cols = Object.keys(MAPS);
    for (const col of cols) {
      db.collection(col).onSnapshot(snap => {
        if (S.amigo) return;                                  // vendo o hub de um amigo: os meus dados voltam ao sair
        const m = new Map(), pend = new Set();
        for (const d of snap.docs) if (d.exists) { try { m.set(d.id, MAPS[col](d.id, d.data() || {})); } catch (_) { } if (d.metadata && d.metadata.hasPendingWrites) pend.add(d.id); }
        S[col] = m; S.loaded[col] = true; S.any = true; S._sess = null; clearTimeout(timer);
        if (col === 'treinos') S.tPend = pend;
        if (S.canWrite && !pending && cols.every(k => S.loaded[k])) setSave('saved', 'Dados em dia');
        rerender(); maybeAuto();
      });
    }
    db.doc('config/perfil').onSnapshot(s => { if (S.amigo) return; S.perfil = s.exists ? (s.data() || {}) : {}; rerender(); });
    db.doc('config/metas').onSnapshot(s => {
      if (S.amigo) return;
      const d = s.exists ? (s.data() || {}) : {}; S.metasSalvas = s.exists; S.metas = { ...DEF_METAS };
      for (const k of Object.keys(DEF_METAS)) if (typeof d[k] === 'number' && d[k] > 0) S.metas[k] = d[k];
      rerender();
    });
    db.doc('config/sync').onSnapshot(s => { if (S.amigo) return; S.sync = s.exists ? (s.data() || {}) : {}; S.syncExists = s.exists; S.loaded.sync = true; rerender(); maybeAuto(); });
    /* cópia do treino em andamento na sua conta: volta mesmo se o navegador apagou o que guardou no aparelho, ou em outro aparelho */
    db.doc('config/rascunho_treino').onSnapshot(s => {
      if (S.amigo) return;
      S.rtRemoto = s.exists;
      if (!s.exists) return;
      const d = s.data() || {}, F = S.tForm;
      if (!rascunhoValido(d) || (F && (F.vivo || F.salvando || (nn(d.atualizado) || 0) <= (F.atualizado || 0)))) return;
      if (!temConteudo({ exs: d.exs, dur: d.dur, obs: d.obs })) return;
      const ja = S.treinos.get(d.id); if (ja && salvoEm(ja) >= (nn(d.atualizado) || 0)) return;
      restaurarRascunho(d);
      lsSet(LS_RT, d);
      renderTForm();
      if (!S.navegou && S.tab === 'painel') goTab('treinos'); else rerender();
      toast('Treino em andamento recuperado.');
    });
    carregarInteg().then(() => { if (S.tab === 'conexoes' || S.tab === 'alimentacao') rerender(); maybeAuto(); });
    stravaRetorno();
  }
  function maybeAuto() {
    if (S.autoDone || S.amigo || H.demo || !S.integ || !S.loaded.sync || !S.loaded.treinos || !S.loaded.corridas || !S.canWrite) return;
    S.autoDone = true;
    setTimeout(() => {
      const now = Date.now(), st = S.integ || {};
      if (st.notion && st.notion.configurado && (!S.sync.notion_at || now - S.sync.notion_at > 12 * 36e5)) notionSync(true);
      if (st.strava && st.strava.conectado && (!S.sync.strava_at || now - S.sync.strava_at > 3 * 36e5)) stravaSync(true);
    }, 1500);
  }
  window.HubApp = { start, rerender, abrirConta };
  H.pronto();
})();


