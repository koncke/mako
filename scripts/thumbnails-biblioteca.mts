// =============================================================================
// thumbnails-biblioteca — llenar la biblioteca de miniaturas de YouTube de Image, desde la PC (6/11/2026)
// =============================================================================
// Pedido de Martín (6/11/2026): «una tab que sea "Thumbnails", para traer de la misma manera miniaturas top en el mercado». La
// nube no tiene la clave de YouTube ni llega a la base: esto corre en la PC, con el .env.local del clon (PRODUCCIÓN).
//
// De dónde: la YouTube Data API OFICIAL con la clave de la plataforma (`YOUTUBE_API_KEY` del negocio de la plataforma, o la del
// entorno). Por qué ésa y no otra fuente: docs/carruseles/thumbnails.md. Lo puro: lib/thumbnails/carga.ts y explorar.ts.
//
// ⚠️ EN SECO POR DEFECTO: sin `--de-verdad` dice qué haría y cuánto cupo de YouTube usaría, y no pide ni escribe nada.
// ⚠️ EL CUPO: `search.list` tiene su balde de 100 LLAMADAS POR DÍA para toda la app (descubrir usa 1 por rubro e idioma, 12
//    como mucho); lo demás sale de las 10.000 unidades diarias (unas 3 por canal). El script cuenta y frena en los topes.
// ⚠️ NUNCA IMPRIME LA CLAVE.
// ⚠️ 30 DÍAS: lo leído de la API vence a los 30 días (sin la enmienda III.L). `podar` borra lo vencido; `leer` lo refresca.
//
// Uso (desde la raíz del clon):
//   node --env-file=.env.local --conditions=react-server --import tsx scripts/thumbnails-biblioteca.mts <comando> [opciones]
//
// Comandos:
//   estado                          Lo que hay (tablas, canales por rubro e idioma, videos vigentes). No pide ni escribe.
//   descubrir [--de-verdad]         Busca canales por rubro e idioma (1 búsqueda por par) y suma los que más aparecen.
//        --nicho ventas|marketing|emprendimiento|servicios   Sólo ese rubro (por defecto, los cuatro).
//        --idioma es|en|pt          Sólo ese idioma (por defecto, los tres).
//        --por-par 8                Cuántos canales sumar por rubro e idioma (por defecto 8).
//        --dias 180                 De los videos más vistos de los últimos N días (por defecto 180).
//        --max-busquedas 12         Tope de llamadas a search.list en la corrida (por defecto 12; el balde es de 100 por día).
//   leer [--de-verdad] [--max 120]  Lee los videos de los canales activos (los menos recientes primero) y los guarda.
//   sumar @handle|UC… --nicho X --idioma es [--de-verdad]   Suma un canal a mano (fuente «lista»).
//   excluir @handle|UC… --motivo "No sirve a dueños" [--de-verdad]   Saca un canal: sus videos dejan de verse.
//   ocultar <videoId> [--de-verdad]                          Esconde un video (no sirve a dueños de negocio).
//   podar [--de-verdad]             Borra los videos leídos hace más de 30 días (la regla de YouTube).
// =============================================================================
export {};   // un .mts sin import ni export es un script GLOBAL para tsc (guardas-push.sh)

const base = process.cwd().split(String.fromCharCode(92)).join('/');
const imp = (p: string) => import(`file:///${base}/${p}`);

const argv = process.argv.slice(2);
const comando = argv[0] && !argv[0].startsWith('--') ? argv[0] : 'estado';
const op = new Map<string, string | true>();
const posicionales: string[] = [];
for (let i = comando === argv[0] ? 1 : 0; i < argv.length; i += 1) {
  const a = argv[i];
  if (a.startsWith('--')) {
    const sig = argv[i + 1];
    if (sig != null && !sig.startsWith('--')) { op.set(a.slice(2), sig); i += 1; } else op.set(a.slice(2), true);
  } else posicionales.push(a);
}
const deVerdad = op.get('de-verdad') === true;
const num = (k: string, def: number): number => { const v = op.get(k); const n = typeof v === 'string' ? Number(v) : NaN; return Number.isFinite(n) && n > 0 ? Math.round(n) : def; };
const txt = (k: string): string | null => { const v = op.get(k); return typeof v === 'string' && v.trim() ? v.trim() : null; };

const E = await imp('lib/thumbnails/explorar.ts');
const K = await imp('lib/thumbnails/carga.ts');
const S = await imp('lib/thumbnails/servidor.ts');
const Y = await imp('lib/spy-youtube.ts');
const { getSupabaseServer } = await imp('lib/supabase.ts');
const { wsSuperAdmin, runWithWorkspace } = await imp('lib/workspace.ts');
const { credWs } = await imp('lib/credenciales.ts');

const db = getSupabaseServer();
const ahora = () => new Date().toISOString();

/** La clave de YouTube de la plataforma (nunca se imprime). */
async function clave(): Promise<string | null> {
  const ws = await wsSuperAdmin().catch(() => null);
  const deLaPlataforma = ws != null ? await runWithWorkspace(ws, () => credWs('YOUTUBE_API_KEY', ws)).catch(() => null) : null;
  const k = (deLaPlataforma && !String(deLaPlataforma).startsWith('PENDING') ? deLaPlataforma : null) ?? process.env.YOUTUBE_API_KEY ?? null;
  return k ? String(k) : null;
}

async function hayTablas(): Promise<boolean> {
  const r = await db.from(S.T_CANALES).select('id').limit(1);
  if (r.error) { console.log(`✖ Falta la migración 0409 (${r.error.message}). Aplícala con: node scripts/apply-migration.mjs supabase/migrations/0409_thumbnails_biblioteca.sql`); return false; }
  return true;
}

const nichos = (): string[] => { const n = txt('nicho'); return n ? [n] : E.NICHOS_THUMBNAIL.map((x: { value: string }) => x.value); };
const idiomas = (): string[] => { const n = txt('idioma'); return n ? [n] : E.IDIOMAS_THUMBNAIL.map((x: { value: string }) => x.value); };

async function estado() {
  if (!(await hayTablas())) return;
  const cs = await db.from(S.T_CANALES).select('id, nicho, idioma, estado, leido_en');
  if (cs.error) { console.log('✖', cs.error.message); return; }
  const por = new Map<string, number>();
  for (const c of cs.data ?? []) if (c.estado === 'activo') por.set(`${c.nicho} · ${c.idioma}`, (por.get(`${c.nicho} · ${c.idioma}`) ?? 0) + 1);
  console.log(`Canales activos: ${[...por.values()].reduce((a, b) => a + b, 0)} (excluidos: ${(cs.data ?? []).filter((c: { estado: string }) => c.estado !== 'activo').length})`);
  for (const [k, n] of [...por.entries()].sort()) console.log(`  · ${k}: ${n}`);
  const xs = await S.thumbnailsDeLaBiblioteca();
  console.log(`Miniaturas que se ven hoy (largos, vigentes, no escondidos): ${xs?.length ?? 0}`);
  const viejos = await db.from(S.T_VIDEOS).select('id', { count: 'exact', head: true }).lt('leido_en', new Date(Date.now() - E.DIAS_VIGENTE * 86_400_000).toISOString());
  console.log(`Videos vencidos (más de ${E.DIAS_VIGENTE} días, para \`podar\`): ${viejos.count ?? '?'}`);
  console.log(`La clave de YouTube de la plataforma: ${(await clave()) ? 'está' : 'NO está'}`);
}

async function descubrir() {
  if (!(await hayTablas())) return;
  const k = await clave();
  if (!k) { console.log('✖ No hay clave de YouTube de la plataforma (YOUTUBE_API_KEY). No se pidió nada.'); return; }
  const porPar = num('por-par', 8);
  const maxBusquedas = Math.min(num('max-busquedas', 12), 30);
  const pares = nichos().flatMap((n) => idiomas().map((i) => ({ nicho: n, idioma: i })));
  console.log(`${pares.length} búsquedas (de ${maxBusquedas} permitidas; el balde de YouTube es de 100 por día para toda la app).`);
  if (!deVerdad) { for (const p of pares.slice(0, maxBusquedas)) console.log(`  · ${p.nicho} · ${p.idioma}: «${K.CONSULTAS[p.nicho][p.idioma]}»`); console.log('En seco: no se pidió nada. Agrega --de-verdad.'); return; }
  let hechas = 0; let sumados = 0; let unidades = 0;
  for (const p of pares) {
    if (hechas >= maxBusquedas) { console.log('  Llegué al tope de búsquedas: el resto, otra corrida.'); break; }
    hechas += 1;
    const r = await K.buscarCanales(K.CONSULTAS[p.nicho][p.idioma], p.idioma, k, fetch, { dias: num('dias', 180) });
    if (!r.ok) { console.log(`  ✖ ${p.nicho} · ${p.idioma}: ${r.error}`); if (/cuota/.test(r.error)) break; continue; }
    const ya = await db.from(S.T_CANALES).select('canal_id').in('canal_id', r.canales.map((c: { id: string }) => c.id));
    const conocidos = new Set((ya.data ?? []).map((x: { canal_id: string }) => x.canal_id));
    const nuevos = r.canales.filter((c: { id: string }) => !conocidos.has(c.id)).slice(0, porPar);
    for (const c of nuevos) {
      const l = await Y.leerCanalCorto({ id: c.id }, k, fetch);
      unidades += 1;
      if (!l.ok) { console.log(`    ✖ ${c.nombre ?? c.id}: ${l.detalle}`); continue; }
      const ins = await db.from(S.T_CANALES).upsert(K.filaDeCanal(l.canal, p.nicho, p.idioma, 'busqueda', ahora()), { onConflict: 'canal_id', ignoreDuplicates: true });
      if (ins.error) console.log(`    ✖ ${l.canal.nombre}: ${ins.error.message}`); else { sumados += 1; console.log(`    + ${l.canal.nombre} (${l.canal.handle ?? c.id})`); }
    }
    console.log(`  ✓ ${p.nicho} · ${p.idioma}: ${r.canales.length} canales en la búsqueda, ${nuevos.length} nuevos.`);
  }
  console.log(`Listo: ${hechas} búsquedas, ${sumados} canales sumados, ~${unidades} unidades. Ahora: leer --de-verdad`);
}

async function leer() {
  if (!(await hayTablas())) return;
  const k = await clave();
  if (!k) { console.log('✖ No hay clave de YouTube de la plataforma (YOUTUBE_API_KEY). No se pidió nada.'); return; }
  const max = num('max', 120);
  const cs = await db.from(S.T_CANALES).select('id, canal_id, nombre, nicho, idioma, leido_en').eq('estado', 'activo').order('leido_en', { ascending: true, nullsFirst: true }).limit(max);
  if (cs.error) { console.log('✖', cs.error.message); return; }
  const lista = cs.data ?? [];
  console.log(`${lista.length} canales para leer (~${lista.length * 3} unidades de las 10.000 diarias).`);
  if (!deVerdad) { for (const c of lista.slice(0, 20)) console.log(`  · ${c.nombre} (${c.nicho} · ${c.idioma})`); console.log('En seco: no se pidió nada. Agrega --de-verdad.'); return; }
  const ocultos = await db.from(S.T_VIDEOS).select('video_id').eq('oculto', true);
  const escondidos = new Set((ocultos.data ?? []).map((x: { video_id: string }) => x.video_id));
  let videos = 0;
  for (const c of lista) {
    const l = await Y.traerVideosDelCanal({ id: c.canal_id }, k, fetch, 50);
    if (!l.ok) { console.log(`  ✖ ${c.nombre}: ${l.detalle}`); if (l.motivo === 'cuota') break; continue; }
    const cuando = ahora();
    // Su nombre, @ y foto al día; `fuente` y `estado` no se pisan (un canal sumado a mano sigue siendo de la lista).
    const { fuente: _f, estado: _e, ...alDia } = K.filaDeCanal(l.canal, c.nicho, c.idioma, 'busqueda', cuando);
    await db.from(S.T_CANALES).update(alDia).eq('id', c.id).then(() => undefined, () => undefined);
    const filas = K.filasDeVideos(l.videos, c.id, cuando).filter((f: { video_id: string }) => !escondidos.has(f.video_id));
    if (filas.length) {
      const up = await db.from(S.T_VIDEOS).upsert(filas, { onConflict: 'video_id' });
      if (up.error) { console.log(`  ✖ ${c.nombre}: ${up.error.message}`); continue; }
    }
    videos += filas.length;
    console.log(`  ✓ ${c.nombre}: ${filas.length} videos largos`);
  }
  console.log(`Listo: ${videos} videos guardados.`);
}

async function sumar() {
  if (!(await hayTablas())) return;
  const quien = posicionales[0];
  const nicho = txt('nicho'); const idioma = txt('idioma');
  if (!quien || !nicho || !idioma) { console.log('Uso: sumar @handle|UC… --nicho ventas --idioma es [--de-verdad]'); return; }
  const nichos = E.NICHOS_THUMBNAIL.map((x: { value: string }) => x.value); const idiomas = E.IDIOMAS_THUMBNAIL.map((x: { value: string }) => x.value);
  if (!nichos.includes(nicho) || !idiomas.includes(idioma)) { console.log(`✖ El rubro es ${nichos.join(', ')} y el idioma ${idiomas.join(', ')}.`); return; }
  const k = await clave();
  if (!k) { console.log('✖ No hay clave de YouTube de la plataforma.'); return; }
  const apunta = /^UC[A-Za-z0-9_-]{20,}$/.test(quien) ? { id: quien } : { handle: quien.replace(/^@/, '') };
  const l = await Y.leerCanalCorto(apunta, k, fetch);
  if (!l.ok) { console.log('✖', l.detalle); return; }
  console.log(`${l.canal.nombre} (${l.canal.handle ?? l.canal.id}) · ${l.canal.suscriptores ?? '?'} suscriptores`);
  if (!deVerdad) { console.log('En seco: no se sumó. Agrega --de-verdad.'); return; }
  const r = await db.from(S.T_CANALES).upsert({ ...K.filaDeCanal(l.canal, nicho, idioma, 'lista', ahora()), estado: 'activo', motivo: null }, { onConflict: 'canal_id' });
  console.log(r.error ? `✖ ${r.error.message}` : '✓ Sumado. Ahora: leer --de-verdad');
}

async function excluir() {
  if (!(await hayTablas())) return;
  const quien = posicionales[0]; const motivo = txt('motivo');
  if (!quien || !motivo) { console.log('Uso: excluir @handle|UC… --motivo "No sirve a dueños de negocio" [--de-verdad]'); return; }
  const campo = /^UC/.test(quien) ? 'canal_id' : 'handle';
  const valor = campo === 'handle' ? `@${quien.replace(/^@/, '')}` : quien;
  if (!deVerdad) { console.log(`En seco: excluiría ${valor} («${motivo}»). Agrega --de-verdad.`); return; }
  const r = await db.from(S.T_CANALES).update({ estado: 'excluido', motivo: motivo.slice(0, 300), updated_at: ahora() }).eq(campo, valor).select('nombre');
  console.log(r.error ? `✖ ${r.error.message}` : r.data?.length ? `✓ Excluido: ${r.data.map((x: { nombre: string }) => x.nombre).join(', ')}` : '✖ No encontré ese canal.');
}

async function ocultar() {
  if (!(await hayTablas())) return;
  const id = posicionales[0];
  if (!E.esIdDeVideo(id)) { console.log('Uso: ocultar <videoId de 11 caracteres> [--de-verdad]'); return; }
  if (!deVerdad) { console.log(`En seco: escondería ${id}. Agrega --de-verdad.`); return; }
  const r = await db.from(S.T_VIDEOS).update({ oculto: true }).eq('video_id', id).select('titulo');
  console.log(r.error ? `✖ ${r.error.message}` : r.data?.length ? `✓ Escondido: ${r.data[0].titulo ?? id}` : '✖ No encontré ese video.');
}

async function podar() {
  if (!(await hayTablas())) return;
  const limite = new Date(Date.now() - E.DIAS_VIGENTE * 86_400_000).toISOString();
  // Los escondidos se quedan (sin título): así una lectura nueva no los vuelve a mostrar.
  const n = await db.from(S.T_VIDEOS).select('id', { count: 'exact', head: true }).lt('leido_en', limite).eq('oculto', false);
  console.log(`Vencidos (leídos antes del ${limite.slice(0, 10)}): ${n.count ?? '?'}`);
  if (!deVerdad) { console.log('En seco: no se borró nada. Agrega --de-verdad.'); return; }
  const r = await db.from(S.T_VIDEOS).delete().lt('leido_en', limite).eq('oculto', false);
  const t = await db.from(S.T_VIDEOS).update({ titulo: null, vistas: null, megusta: null, comentarios: null }).lt('leido_en', limite).eq('oculto', true);
  console.log(r.error || t.error ? `✖ ${(r.error ?? t.error).message}` : '✓ Podado.');
}

const comandos: Record<string, () => Promise<void>> = { estado, descubrir, leer, sumar, excluir, ocultar, podar };
const correr = comandos[comando];
if (!correr) { console.log(`No conozco «${comando}». Comandos: ${Object.keys(comandos).join(', ')}`); process.exit(1); }
const ws = await wsSuperAdmin().catch(() => null);
await (ws != null ? runWithWorkspace(ws, correr) : correr());
