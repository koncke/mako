// =============================================================================
// aviso-vivo-ws13 — ¿el ws13 ya le avisó BIEN al grupo de MaKo de un lead nuevo? (SÓLO LECTURA)
// =============================================================================
// Uso (desde un worktree con node_modules; el .env.local del clon es PRODUCCIÓN, sólo se lee):
//   node --env-file=C:/Users/marti/OneDrive/Escritorio/dashboard-marketing-main/dashboard-marketing/.env.local \
//     --conditions=react-server --import tsx scripts/_sab24/aviso-vivo-ws13.mts --desde=2026-10-23T15:20:34Z [--gracia-min=15] [--hasta=<ISO>]
//   (`--hasta` sólo para re-mirar una ventana pasada: `--desde=2026-10-12T13:00:00Z --hasta=2026-10-12T14:00:00Z` da el
//    VERDE de Luciano Petruccelli, el último aviso bueno antes del corte, y prueba que la cadena se lee bien.)
//
// Para qué: el aviso de arreglo al ws13 (Código Inmobiliario) sale recién cuando entra un lead NUEVO y su aviso llega
// bien al grupo. El arreglo (0a5f6c9b6: el resumen de la pendiente partía un emoji y Postgres rechazaba el insert) quedó
// en producción con el deploy mako-a6z2g0nz6, creado 23/10 12:18:07 y Ready ~12:20:34 (hora AR) = 2026-10-23T15:20:34Z.
//
// LA CADENA QUE PRUEBA «AVISÓ BIEN» (validada contra el último aviso bueno, Luciano Petruccelli, 12/10 10:19 AR):
//   1. el lead: `leads` del ws, `created_at >= desde` (o una inscripción en una automatización que avisa desde ahí:
//      un lead fusionado con uno viejo conserva el `created_at` del viejo);
//   2. la inscripción: `nutricion_inscripciones` en una secuencia con un paso `avisar_al_equipo` (hoy #264);
//   3. el envío del paso: `nutricion_envios` con `asunto = 'avisar_al_equipo'` y `estado = 'accion'` (ok) — 'fallo'
//      trae el motivo en `error`;
//   4. la pendiente: `mako_acciones_pendientes` `tipo = 'avisar_al_equipo'`, `origen = 'flujo:secuencia:<s>:paso:<n>'`,
//      `payload.leadId = <lead>`, en `estado = 'ejecutada'` con `resultado` «Le avisé al equipo.» (cualquier otro
//      resultado —«quedó sólo en la app», «hace poco», «resumen de la mañana»— no llegó al grupo);
//   5. el mensaje en el grupo: `mako_doer_conv` del grupo del ws (`app_settings` `mako.grupo_jid`), `role = 'assistant'`,
//      con `wa_message_id` (el id que devolvió WhatsApp al aceptar el envío; `guardarTurno` sólo lo escribe con
//      `env.ok`), entre la pendiente y su cierre, con el nombre del lead en el texto.
//   (Testigo, no eslabón: la fila de la campanita `notificaciones` `tipo = 'chatbot-aviso-equipo'`; sin `payload.salida`
//    = llegó, `no_llego`/`sin_grupo` = no.)
//   Lo que NO mira: el doble tilde de WhatsApp (eso vive en Evolution, no en la base).
//
// Termina con UNA línea: «VERDE: …», «TODAVÍA NO: …» o «ROJO: el lead X falló: <motivo>».
// Código de salida: 0 VERDE · 1 TODAVÍA NO · 3 ROJO · 2 no pude leer (la línea dice TODAVÍA NO: «no pude verificar» no
// es «avisó bien»).
//
// ⛔ NUNCA ESCRIBE NI MANDA NADA: sólo `select` con supabase-js; no importa nada de lib/.
// =============================================================================
import { createClient } from '@supabase/supabase-js';

const argv = process.argv.slice(2);
const arg = (n: string): string | null => {
  const eq = argv.find((a) => a.startsWith(`--${n}=`));
  if (eq) return eq.slice(n.length + 3);
  const i = argv.indexOf(`--${n}`);
  return i >= 0 ? argv[i + 1] ?? null : null;
};

const WS = Number(arg('ws') ?? 13);
const GRACIA_MIN = Number(arg('gracia-min') ?? 15);
const desdeTxt = arg('desde');
const desdeMs = desdeTxt ? Date.parse(desdeTxt) : NaN;
if (!desdeTxt || !Number.isFinite(desdeMs)) {
  console.error('Uso: … aviso-vivo-ws13.mts --desde=<ISO> [--gracia-min=15]   (p. ej. --desde=2026-10-23T15:20:34Z)');
  process.exit(2);
}
const DESDE = new Date(desdeMs).toISOString();
// `--hasta` (opcional): para re-mirar una ventana pasada (p. ej. el último aviso bueno, 12/10). Sin él, hasta ahora.
const hastaTxt = arg('hasta');
const HASTA = hastaTxt && Number.isFinite(Date.parse(hastaTxt)) ? new Date(Date.parse(hastaTxt)).toISOString() : '9999-12-31T00:00:00.000Z';
const OP = 'avisar_al_equipo';
const TIPO_FEED = 'chatbot-aviso-equipo';
const OK_RESULTADO = /^Le avisé al equipo\./;

const db = createClient(process.env.NEXT_PUBLIC_SUPABASE_URL!, process.env.SUPABASE_SERVICE_ROLE_KEY!, { auth: { persistSession: false } });

// ── utilidades ───────────────────────────────────────────────────────────────
const TZ = 'America/Argentina/Buenos_Aires';
const partes = (iso: string) => Object.fromEntries(new Intl.DateTimeFormat('es-AR', {
  timeZone: TZ, day: '2-digit', month: '2-digit', hour: '2-digit', minute: '2-digit', second: '2-digit', hour12: false,
}).formatToParts(new Date(iso)).map((p) => [p.type, p.value]));
const hoyAR = (() => { const p = partes(new Date().toISOString()); return `${p.day}/${p.month}`; })();
/** «HH:MM» si es de hoy (hora AR), «dd/mm HH:MM» si no. */
const hhmm = (iso: string) => { const p = partes(iso); const d = `${p.day}/${p.month}`; return `${d === hoyAR ? '' : `${d} `}${p.hour}:${p.minute}`; };
const hms = (iso: string | null | undefined) => { if (!iso) return '—'; const p = partes(iso); return `${p.day}/${p.month} ${p.hour}:${p.minute}:${p.second}`; };
const ms = (iso: string) => Date.parse(iso);
const isoMas = (iso: string, deltaMs: number) => new Date(ms(iso) + deltaMs).toISOString();
const norm = (s: string) => s.normalize('NFD').replace(/[\u0300-\u036f]/g, '').toLowerCase().replace(/\s+/g, ' ').trim();
const corto = (s: unknown, n = 160) => String(s ?? '').replace(/\s+/g, ' ').trim().slice(0, n);
const primeraLinea = (s: unknown) => corto(String(s ?? '').split('\n')[0], 90);

class NoPudeLeer extends Error {}
async function leer<T>(que: string, q: PromiseLike<{ data: unknown; error: { message: string } | null }>): Promise<T[]> {
  const { data, error } = await q;
  if (error) throw new NoPudeLeer(`${que}: ${error.message}`);
  return (data ?? []) as T[];
}

type Lead = { id: number; nombre: string | null; created_at: string; origen_lead: string | null };
type Insc = { id: number; lead_id: number; secuencia_id: number; paso_actual: number | null; estado: string; proximo_envio_at: string | null; inscripto_at: string };
type Envio = { id: number; inscripcion_id: number | null; lead_id: number; secuencia_id: number; paso: number; estado: string; error: string | null; created_at: string };
type Pend = { id: number; grupo_jid: string; estado: string; origen: string | null; payload: Record<string, unknown> | null; created_at: string; resuelto_at: string | null; resultado: string | null };
type Conv = { id: number; content: string | null; wa_message_id: string | null; created_at: string };
type Feed = { id: number; payload: Record<string, unknown> | null; created_at: string };

type Veredicto =
  | { tipo: 'ok'; detalle: string }
  | { tipo: 'rojo'; motivo: string }
  | { tipo: 'espera'; motivo: string }
  | { tipo: 'no_toca'; motivo: string };

// Los orígenes por los que un lead del ws13 entra a la automatización que avisa (medido: landing y calcom se inscriben;
// carga_manual nunca se inscribió). Un lead de otro origen sin inscripción no es un fallo del aviso.
const ORIGENES_QUE_AVISAN = new Set(['landing', 'calcom']);

async function main(): Promise<number> {
  const ahora = new Date().toISOString();
  console.log(`aviso-vivo · ws${WS} · desde ${hms(DESDE)} AR (${DESDE}) · ahora ${hms(ahora)} AR · gracia ${GRACIA_MIN} min`);

  // El grupo de MaKo del negocio (sólo el final del JID en pantalla).
  const g = await leer<{ value: unknown }>('app_settings', db.from('app_settings').select('value').eq('workspace_id', WS).eq('key', 'mako.grupo_jid').limit(1));
  const grupoJid = typeof g[0]?.value === 'string' ? (g[0].value as string) : null;
  console.log(`grupo de MaKo: ${grupoJid ? `…${grupoJid.slice(-12)}` : 'NO TIENE (ningún aviso puede llegar al grupo)'}`);

  // Las automatizaciones que avisan: un paso con la acción `avisar_al_equipo`.
  const secs = await leer<{ id: number; nombre: string; activa: boolean; archivada_at: string | null; pasos: unknown }>('nutricion_secuencias',
    db.from('nutricion_secuencias').select('id, nombre, activa, archivada_at, pasos').eq('workspace_id', WS));
  const avisadoras = new Map<number, { nombre: string; viva: boolean; pasos: number[] }>();
  for (const s of secs) {
    const pasos = Array.isArray(s.pasos) ? s.pasos as Array<{ accion?: { operacion?: string } }> : [];
    const nums = pasos.flatMap((p, i) => (p?.accion?.operacion === OP ? [i + 1] : []));
    if (nums.length) avisadoras.set(s.id, { nombre: s.nombre, viva: s.activa && !s.archivada_at, pasos: nums });
  }
  const vivas = [...avisadoras.entries()].filter(([, a]) => a.viva);
  console.log(`automatizaciones que avisan: ${[...avisadoras.entries()].map(([id, a]) => `#${id} «${a.nombre}» paso ${a.pasos.join(',')} ${a.viva ? 'ACTIVA' : 'apagada/archivada'}`).join(' · ') || 'ninguna'}`);
  if (!vivas.length) console.log('  ⚠ ninguna activa: ningún lead nuevo va a disparar el aviso.');
  const idsAvisadoras = [...avisadoras.keys()];

  // 1. Los leads nuevos, y los que se inscribieron en una que avisa desde `desde` aunque su fila sea vieja (fusionados).
  const nuevos = await leer<Lead>('leads', db.from('leads').select('id, nombre, created_at, origen_lead').eq('workspace_id', WS).gte('created_at', DESDE).lt('created_at', HASTA).order('created_at'));
  const inscDesde = idsAvisadoras.length
    ? await leer<Insc>('nutricion_inscripciones', db.from('nutricion_inscripciones')
      .select('id, lead_id, secuencia_id, paso_actual, estado, proximo_envio_at, inscripto_at')
      .eq('workspace_id', WS).in('secuencia_id', idsAvisadoras).gte('inscripto_at', DESDE).lt('inscripto_at', HASTA).order('id'))
    : [];
  const viejos = [...new Set(inscDesde.map((i) => i.lead_id))].filter((id) => !nuevos.some((l) => l.id === id));
  const reingresos = viejos.length
    ? await leer<Lead>('leads', db.from('leads').select('id, nombre, created_at, origen_lead').eq('workspace_id', WS).in('id', viejos))
    : [];
  const leads = [...nuevos, ...reingresos].sort((a, b) => {
    const ta = Math.max(ms(a.created_at), ms(inscDesde.find((i) => i.lead_id === a.id)?.inscripto_at ?? a.created_at));
    const tb = Math.max(ms(b.created_at), ms(inscDesde.find((i) => i.lead_id === b.id)?.inscripto_at ?? b.created_at));
    return ta - tb;
  });
  console.log(`\nleads nuevos desde ${hms(DESDE)}: ${nuevos.length}${reingresos.length ? ` (+${reingresos.length} con fila vieja inscriptos desde ahí)` : ''}`);

  const resultados: Array<{ lead: Lead; llego: string; v: Veredicto; reingreso: boolean }> = [];
  for (const lead of leads) {
    const nombre = (lead.nombre ?? '').trim() || `#${lead.id}`;
    const esReingreso = reingresos.some((r) => r.id === lead.id);
    const inscs = inscDesde.filter((i) => i.lead_id === lead.id);
    const llego = esReingreso ? (inscs[0]?.inscripto_at ?? lead.created_at) : lead.created_at;
    console.log(`\n● lead #${lead.id} ${nombre} · llegó ${hms(llego)} AR · origen ${lead.origen_lead ?? '—'}${esReingreso ? ` · fila creada ${hms(lead.created_at)} (fusionado/reingreso)` : ''}`);
    // Para un lead nuevo, sus inscripciones desde que llegó (la de arriba sólo trae las que son desde `desde`).
    for (const i of inscs) {
      console.log(`  2. inscripción #${i.id} en #${i.secuencia_id} · ${i.estado} · paso ${i.paso_actual ?? '—'} · inscripta ${hms(i.inscripto_at)}${i.proximo_envio_at ? ` · próximo ${hms(i.proximo_envio_at)}` : ''}`);
    }
    const envios = await leer<Envio>('nutricion_envios', db.from('nutricion_envios')
      .select('id, inscripcion_id, lead_id, secuencia_id, paso, estado, error, created_at')
      .eq('workspace_id', WS).eq('lead_id', lead.id).eq('asunto', OP).gte('created_at', DESDE).order('id'));

    let v: Veredicto | null = null;
    if (!envios.length) {
      console.log(`  3. envío del paso ${OP}: NINGUNO todavía`);
      const edadMin = (Date.now() - ms(llego)) / 60_000;
      const activa = inscs.find((i) => i.estado === 'activa');
      if (activa) v = { tipo: 'espera', motivo: `está inscripto en #${activa.secuencia_id} y su paso todavía no corrió${activa.proximo_envio_at ? ` (próximo ${hhmm(activa.proximo_envio_at)})` : ''}` };
      else if (inscs.length) v = { tipo: 'rojo', motivo: `su inscripción en #${inscs[0].secuencia_id} quedó «${inscs[0].estado}» sin ningún envío del paso ${OP} (sin fila en nutricion_envios)` };
      else if (edadMin < GRACIA_MIN) v = { tipo: 'espera', motivo: `entró hace ${Math.round(edadMin)} min y todavía no se inscribió en la automatización que avisa` };
      else if (ORIGENES_QUE_AVISAN.has(String(lead.origen_lead ?? ''))) v = { tipo: 'rojo', motivo: `no se inscribió en ninguna automatización que avisa (${vivas.map(([id]) => `#${id}`).join(', ') || 'no hay ninguna activa'}) a ${Math.round(edadMin)} min de entrar: sin fila en nutricion_envios` };
      else v = { tipo: 'no_toca', motivo: `origen «${lead.origen_lead ?? '—'}»: ese origen no entra a la automatización que avisa (no se inscribió)` };
    }

    let primerFallo: Envio | null = null;
    for (const e of envios) {
      console.log(`  3. envío #${e.id} · #${e.secuencia_id} paso ${e.paso} · ${e.estado} · ${hms(e.created_at)}${e.error ? ` · error: ${corto(e.error, 300)}` : ''}`);
      if (e.estado === 'fallo' && !primerFallo) primerFallo = e;
      // 4. La pendiente: se crea ANTES de la fila del envío (registrar va después de ejecutar).
      const origen = `flujo:secuencia:${e.secuencia_id}:paso:${e.paso}`;
      const pends = (await leer<Pend>('mako_acciones_pendientes', db.from('mako_acciones_pendientes')
        .select('id, grupo_jid, estado, origen, payload, created_at, resuelto_at, resultado')
        .eq('workspace_id', WS).eq('tipo', OP).eq('origen', origen)
        .gte('created_at', isoMas(e.created_at, -15 * 60_000)).lte('created_at', isoMas(e.created_at, 60_000)).order('id')))
        .filter((p) => String(p.payload?.leadId ?? '') === String(lead.id));
      const p = pends[pends.length - 1] ?? null;
      if (!p) {
        console.log(`  4. pendiente: NINGUNA (origen ${origen}, lead ${lead.id})${e.estado === 'fallo' ? ' — la base no la aceptó o no se intentó' : ''}`);
        if (e.estado !== 'fallo' && !v) v = { tipo: 'rojo', motivo: `el envío #${e.id} quedó en '${e.estado}' pero no hay pendiente de ${OP} para el lead (sin rastro de qué corrió)` };
        continue;
      }
      console.log(`  4. pendiente #${p.id} · ${p.estado} · creada ${hms(p.created_at)} · cerrada ${hms(p.resuelto_at)} · «${corto(p.resultado, 200)}»`);
      // 5. El mensaje en el grupo, y el testigo de la campanita.
      const hasta = isoMas(p.resuelto_at ?? e.created_at, 60_000);
      const conv = grupoJid
        ? await leer<Conv>('mako_doer_conv', db.from('mako_doer_conv').select('id, content, wa_message_id, created_at')
          .eq('workspace_id', WS).eq('grupo_jid', grupoJid).eq('role', 'assistant')
          .gte('created_at', isoMas(p.created_at, -2_000)).lte('created_at', hasta).order('id'))
        : [];
      const conWa = conv.filter((c) => !!c.wa_message_id);
      const n = norm(nombre);
      const nom1 = n.split(' ')[0] ?? '';
      const conNombre = conWa.filter((c) => { const t = norm(String(c.content ?? '')); return t.includes(n) || (nom1.length >= 3 && t.includes(nom1)); });
      const msg = conNombre[0] ?? (conWa.length === 1 ? conWa[0] : null);
      if (msg) console.log(`  5. en el grupo: turno #${msg.id} · ${hms(msg.created_at)} · con id de WhatsApp${conNombre.length ? ' · con el nombre' : ' · SIN el nombre en el texto (único turno en la ventana)'} · «${primeraLinea(msg.content)}»`);
      else console.log(`  5. en el grupo: NINGÚN turno con id de WhatsApp entre ${hms(p.created_at)} y ${hms(hasta)}${conv.length ? ` (${conv.length} turno(s) sin id)` : ''}`);
      const feed = await leer<Feed>('notificaciones', db.from('notificaciones').select('id, payload, created_at')
        .eq('workspace_id', WS).eq('tipo', TIPO_FEED).gte('created_at', isoMas(p.created_at, -2_000)).lte('created_at', hasta).order('id'));
      const salida = feed.length ? (feed[0].payload?.salida as string | undefined) : undefined;
      console.log(`  ·  campanita: ${feed.length ? `notificación #${feed[0].id} · ${salida ? `salida «${salida}»` : 'sin «salida» (llegó)'}` : 'ninguna en la ventana'}`);

      if (e.estado === 'fallo') continue;
      if (v) continue;
      if (p.estado !== 'ejecutada' || !OK_RESULTADO.test(String(p.resultado ?? ''))) {
        v = { tipo: 'rojo', motivo: `el paso quedó en '${e.estado}' pero la pendiente #${p.id} dice «${p.estado}: ${corto(p.resultado, 160)}» (no llegó al grupo)` };
      } else if (salida === 'no_llego' || salida === 'sin_grupo') {
        v = { tipo: 'rojo', motivo: `la campanita #${feed[0].id} dice «${salida}»` };
      } else if (!msg) {
        v = { tipo: 'espera', motivo: `el paso y la pendiente #${p.id} dieron ok, pero no encuentro el mensaje en el grupo (mako_doer_conv con id de WhatsApp): mirar el grupo a mano` };
      } else {
        v = { tipo: 'ok', detalle: `envío #${e.id} accion → pendiente #${p.id} ejecutada → turno #${msg.id} en el grupo ${hms(msg.created_at)}` };
      }
    }
    // Un 'fallo' en cualquier intento es ROJO aunque un reintento haya salido después: el arreglo es que no falle.
    if (primerFallo) {
      const despues = v?.tipo === 'ok' ? ` (después salió en un reintento: ${v.detalle})` : '';
      v = { tipo: 'rojo', motivo: `${corto(primerFallo.error ?? '(sin texto en nutricion_envios.error)', 300)}${despues}` };
    }
    v ??= { tipo: 'espera', motivo: 'sin veredicto (revisar la salida de arriba)' };
    console.log(`  ⇒ ${v.tipo === 'ok' ? 'AVISÓ BIEN' : v.tipo === 'rojo' ? 'FALLÓ' : v.tipo === 'no_toca' ? 'NO LE TOCA AVISO' : 'TODAVÍA NO'}: ${'detalle' in v ? v.detalle : v.motivo}`);
    resultados.push({ lead, llego, v, reingreso: esReingreso });
  }

  const nom = (l: Lead) => (l.nombre ?? '').trim() || `#${l.id}`;
  const rojos = resultados.filter((r) => r.v.tipo === 'rojo');
  const oks = resultados.filter((r) => r.v.tipo === 'ok');
  const esperas = resultados.filter((r) => r.v.tipo === 'espera');
  console.log('');
  if (rojos.length) {
    const r = rojos[0];
    console.log(`ROJO: el lead ${nom(r.lead)} (#${r.lead.id}, llegó ${hhmm(r.llego)}) falló: ${(r.v as { motivo: string }).motivo}${rojos.length > 1 ? ` (+${rojos.length - 1} lead(s) más en rojo)` : ''}`);
    return 3;
  }
  if (oks.length) {
    // Un lead NUEVO primero; uno viejo que volvió a entrar a la automatización también prueba el aviso, y se dice.
    const r = oks.find((x) => !x.reingreso) ?? oks[0];
    console.log(`VERDE: el lead ${nom(r.lead)} (llegó ${hhmm(r.llego)}${r.reingreso ? ', fila vieja que volvió a entrar' : ''}) avisó bien`);
    return 0;
  }
  if (esperas.length) {
    const r = esperas[0];
    console.log(`TODAVÍA NO: el lead ${nom(r.lead)} (llegó ${hhmm(r.llego)}) ${(r.v as { motivo: string }).motivo}`);
    return 1;
  }
  const noToca = resultados.length ? ` (entraron ${resultados.length} lead(s) que no pasan por el aviso: ${resultados.map((r) => `${nom(r.lead)} ${r.lead.origen_lead ?? ''}`.trim()).join(', ')})` : '';
  console.log(`TODAVÍA NO: no entró ningún lead nuevo al ws${WS} que tenga que avisarse desde ${hhmm(DESDE)}${noToca}`);
  return 1;
}

main().then((code) => process.exit(code)).catch((e) => {
  const msg = e instanceof Error ? e.message : String(e);
  console.error(e instanceof NoPudeLeer ? `no pude leer ${msg}` : e);
  console.log(`TODAVÍA NO: no pude verificar (${corto(msg, 200)}) — «no pude leer» no es «avisó bien»`);
  process.exit(2);
});
