// =============================================================================
// mudanza-nuevo-agendado — el aviso de nuevo agendado de ws1 y ws13, a una automatización «Evento de MaKo»
// =============================================================================
// GENERAL 7 de la décima tanda (11/10/2026), textual: «Vuelve a poner la automatización que avisa que se agendó un
// nuevo lead en Mauricio y Código... Y esa por ejemplo falta en las plantillas de nueva automatización». El diseño, en
// docs/diseno-automations-galeria-v2.md §5.
//
// Desde el deploy de la décima tanda, «🎯 Nuevo agendado» deja de salir por el catálogo: `reunion-nuevo-agendado` es un
// EVENTO de MaKo (`lead_agendo`, lib/disparadores.ts) y `emitirDelCatalogo` lo desvía a las automatizaciones del negocio
// (`emitirPorEvento`). Sin fila, NO sale («Todos arrancan vacíos»). Medido el 11/10/2026: sólo lo reciben ws1 (Calendly)
// y ws13 (Cal.com), los dos con el webhook de agenda en `webhook_routing`. Esto les crea su fila ANTES del deploy:
//   1. si ya tienen una automatización viva con el evento `lead_agendo`, nada (correrlo dos veces no duplica);
//   2. la crea desde la plantilla de la galería (`crearDesdePlantilla('mako-agendado')`, lib/plantilla-crear.ts): la
//      MISMA puerta que «Nueva automatización» (los pasos entran por `setSecuenciaPasos`, que valida el evento);
//   3. la prende por la MISMA puerta que «Activar» (`setSecuenciaActiva`, que valida lo mismo que Publicar). Si el
//      negocio tenía el aviso APAGADO en su store, nace pausada: esa decisión ya la había tomado él.
// Con el código viejo esas filas no corren (su emisor conoce tres eventos) y el aviso sigue por el catálogo; con el
// deploy pasa a la fila. Ni hueco ni doble.
//
//   node --conditions react-server --import tsx scripts/mudanza-nuevo-agendado.mts             → SIMULACRO (default)
//   node --conditions react-server --import tsx scripts/mudanza-nuevo-agendado.mts --aplicar   → escribe
//   opciones: --env=<ruta del .env.local> (default ./.env.local) · --ws=<id> (default: 1 y 13)
//
// ⚠️ CORRE ADENTRO DE `runWithWorkspace(ws)`: `getTenantDb` scopea solo, como en un cron. El simulacro sólo LEE (la fila
// del negocio, su store) y comprueba la plantilla con las funciones puras que usa Publicar.
// =============================================================================

import { config } from 'dotenv';

const arg = (n: string): string | null => {
  const a = process.argv.find((x) => x.startsWith(`--${n}=`));
  return a ? a.slice(n.length + 3) : null;
};
const aplicar = process.argv.includes('--aplicar');
config({ path: arg('env') ?? '.env.local' });
const WS = arg('ws') != null ? [Number(arg('ws'))] : [1, 13];

const PLANTILLA = 'mako-agendado';
const EVENTO = 'lead_agendo';
const AVISO = 'reunion-nuevo-agendado';

const { runWithWorkspace, getTenantDb } = await import('../lib/workspace');
const { getSettingEstricto } = await import('../lib/settings');
const { plantillaPorId, pasosDePlantilla } = await import('../lib/plantillas-automatizaciones');
const { crearDesdePlantilla } = await import('../lib/plantilla-crear');
const { setSecuenciaPasos, setSecuenciaActiva } = await import('../lib/nutricion');
const { guardarDisparadores } = await import('../lib/disparadores-guardar');
const { TRIGGER_AVISO_MAKO } = await import('../lib/disparadores');
const { eventoDeFila, frenoDelEvento, avisoDeEvento } = await import('../lib/aviso-evento');
const { validarGrafo, normalizar } = await import('../lib/flujo-grafo');

// ── Lo puro, una vez: la plantilla existe, es de este evento y Publicar la deja pasar ──────────────────
const p = plantillaPorId(PLANTILLA);
if (!p) throw new Error(`no existe la plantilla «${PLANTILLA}»`);
if (p.cron.fijo !== TRIGGER_AVISO_MAKO || p.cron.evento !== EVENTO) throw new Error(`«${PLANTILLA}» no arranca por el evento ${EVENTO}`);
if (avisoDeEvento(EVENTO) !== AVISO) throw new Error(`el evento ${EVENTO} no es el aviso ${AVISO} (EVENTOS_MAKO)`);
const pasos = normalizar(pasosDePlantilla(p));
const errGrafo = validarGrafo(pasos);
if (errGrafo.length) throw new Error(`la plantilla no se publica: ${errGrafo.join(' · ')}`);
const freno = frenoDelEvento(pasos, EVENTO);
if (freno) throw new Error(`el emisor no sabe mandar la plantilla: ${freno.error}`);

console.log(`\n══ NUEVO AGENDADO → AUTOMATIZACIÓN — ${aplicar ? 'APLICANDO' : 'SIMULACRO'} ══`);
let creadas = 0, prendidas = 0, salteadas = 0;
for (const ws of WS) {
  if (!Number.isInteger(ws) || ws <= 0) throw new Error(`--ws inválido: ${ws}`);
  await runWithWorkspace(ws, async () => {
    const db = await getTenantDb();
    const { data: vivas, error: ev } = await db.from('nutricion_secuencias')
      .select('id, nombre, activa, trigger_tipo, disparadores').eq('trigger_tipo', TRIGGER_AVISO_MAKO).is('archivada_at', null);
    if (ev) throw new Error(`ws${ws}: ${ev.message}`);
    const ya = ((vivas ?? []) as Array<{ id: number; nombre: string | null; activa: boolean | null; trigger_tipo: string; disparadores?: unknown }>)
      .filter((f) => eventoDeFila(f) === EVENTO);
    if (ya.length) {
      console.log(`ws${ws}: ya tiene la automatización (${ya.map((f) => `#${f.id} «${f.nombre ?? ''}» ${f.activa ? 'prendida' : 'pausada'}`).join(', ')}): nada`);
      salteadas++;
      return;
    }
    // ¿El negocio lo había APAGADO en su store? (medido el 11/10/2026: ni ws1 ni ws13). El store PROPIO, sin herencia:
    // es la decisión de ESTE negocio. Sin poder leerlo no se adivina: se corta.
    let apagado = false;
    const raw = await getSettingEstricto('mako.plantillas.store');
    if (raw) {
      try {
        const st = JSON.parse(raw) as Record<string, { enabled?: unknown } | undefined>;
        apagado = st?.[AVISO]?.enabled === false;
      } catch { throw new Error(`ws${ws}: el store de mensajes no se lee (JSON roto): no se adivina si estaba apagado`); }
    }
    console.log(`ws${ws}: crea «${p.nombre}» desde la plantilla (CRON «Evento de MaKo» → ${EVENTO}) y la deja ${apagado ? 'PAUSADA (el aviso estaba apagado en su store)' : 'PRENDIDA'}`);
    if (!aplicar) return;

    const r = await crearDesdePlantilla(PLANTILLA, {
      db: db as never, setPasos: setSecuenciaPasos as never, setDisparadores: guardarDisparadores as never,
    });
    creadas++;
    console.log(`  ✓ creada #${r.id} «${r.nombre}»`);
    if (apagado) return;
    await setSecuenciaActiva(r.id, true);
    prendidas++;
    console.log('  ✓ prendida (validada como «Activar»)');
  });
}
console.log(`\n${aplicar ? '' : '(simulacro) '}creadas: ${creadas} · prendidas: ${prendidas} · ya estaban: ${salteadas}`);
