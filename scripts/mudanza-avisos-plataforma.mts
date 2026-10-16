// =============================================================================
// mudanza-avisos-plataforma — los Mensajes de MaKo a sus clientes, a automatizaciones de SuperAdmin (de a uno)
// =============================================================================
// El 2 de las doce de Martín (15/10/2026): «en Automations de SuperAdmin no veo las automatizaciones que armamos para
// los clientes de MaKo y en general allí deberían haber varias automatizaciones más». Diseño:
// docs/diseno-avisos-plataforma.md. Crea en el ws de la PLATAFORMA la fila de cada evento mudado, desde su plantilla de
// SuperAdmin, y la prende:
//   1. si la plataforma ya tiene una automatización viva con ese evento, nada (correrlo dos veces no duplica);
//   2. la crea por la MISMA puerta que «Nueva automatización» (`crearDesdePlantilla`, con `plataforma: true`);
//   3. la prende por la MISMA puerta que «Activar» (`setSecuenciaActiva`, que valida lo mismo que Publicar).
// ⚠️ VA DESPUÉS DEL DEPLOY del código de cada evento (la línea: 729789dfa; Fathom: 16fa52568 y la firma efcc58d46; el
// reporte semanal y «MaKo por email»: el commit que los suma). Con el código de antes, el evento no existe y la fila no
// correría. Antes de la fila, el aviso sale como siempre (`sinFila`); desde la fila, sólo por ella. Ni hueco ni doble.
//
//   node --conditions react-server --import tsx scripts/mudanza-avisos-plataforma.mts             → SIMULACRO (default)
//   node --conditions react-server --import tsx scripts/mudanza-avisos-plataforma.mts --aplicar   → escribe
//   opciones: --env=<ruta del .env.local> (default ./.env.local; un worktree no tiene: --env=C:/dev/mako-api/.env.local)
//             --eventos=<a,b,c> → sólo esos eventos (los de lo que YA está desplegado; sin esto, todos los de MUDADOS).
//             Un evento que no está en MUDADOS frena el script antes de tocar nada.
// =============================================================================

import { config } from 'dotenv';

const arg = (n: string): string | null => {
  const a = process.argv.find((x) => x.startsWith(`--${n}=`));
  return a ? a.slice(n.length + 3) : null;
};
const aplicar = process.argv.includes('--aplicar');
config({ path: arg('env') ?? '.env.local' });

/** Los mudados, en orden. Uno nuevo se suma acá, con su plantilla y su evento. */
const TODOS: ReadonlyArray<{ plantilla: string; evento: string }> = [
  { plantilla: 'mako-whatsapp-caido', evento: 'whatsapp_caido' },
  { plantilla: 'mako-whatsapp-volvio', evento: 'whatsapp_volvio' },
  { plantilla: 'mako-reunion-grabada', evento: 'reunion_grabada' },
  { plantilla: 'mako-reporte-semanal', evento: 'reporte_semanal' },
  { plantilla: 'mako-oferta-lista', evento: 'oferta_lista' },
];
// POR TANDAS DE DEPLOY (16/10/2026): la fila de un evento cuyo código todavía no está en producción no correría, así
// que se mudan sólo los desplegados. Sin `--eventos`, todos.
const pedidos = arg('eventos')?.split(',').map((e) => e.trim()).filter(Boolean) ?? null;
const ajenos = (pedidos ?? []).filter((e) => !TODOS.some((m) => m.evento === e));
if (ajenos.length) throw new Error(`--eventos: ${ajenos.join(', ')} no está en la mudanza`);
const MUDADOS = pedidos ? TODOS.filter((m) => pedidos.includes(m.evento)) : TODOS;

const { runWithWorkspace, getTenantDb, wsSuperAdmin } = await import('../lib/workspace');
const { plantillaPorId, pasosDePlantilla } = await import('../lib/plantillas-automatizaciones');
const { crearDesdePlantilla } = await import('../lib/plantilla-crear');
const { setSecuenciaPasos, setSecuenciaActiva } = await import('../lib/nutricion');
const { guardarDisparadores } = await import('../lib/disparadores-guardar');
const { TRIGGER_AVISO_MAKO, EVENTOS_MAKO } = await import('../lib/disparadores');
const { eventoDeFila, frenoDelEvento } = await import('../lib/aviso-evento');
const { validarGrafo, normalizar } = await import('../lib/flujo-grafo');

// ── Lo puro, antes de tocar nada: cada plantilla existe, es de su evento, el evento es de la plataforma y se publica ──
for (const m of MUDADOS) {
  const p = plantillaPorId(m.plantilla);
  if (!p) throw new Error(`no existe la plantilla «${m.plantilla}»`);
  if (!p.soloPlataforma) throw new Error(`«${m.plantilla}» no es de SuperAdmin`);
  if (p.cron.fijo !== TRIGGER_AVISO_MAKO || p.cron.evento !== m.evento) throw new Error(`«${m.plantilla}» no arranca por el evento ${m.evento}`);
  if (EVENTOS_MAKO.find((e) => e.subtipo === m.evento)?.plataforma !== true) throw new Error(`${m.evento} no es un evento de la plataforma`);
  const pasos = normalizar(pasosDePlantilla(p));
  const errGrafo = validarGrafo(pasos);
  if (errGrafo.length) throw new Error(`«${m.plantilla}» no se publica: ${errGrafo.join(' · ')}`);
  const freno = frenoDelEvento(pasos, m.evento);
  if (freno) throw new Error(`el emisor no sabe mandar «${m.plantilla}»: ${freno.error}`);
}

const ws = await wsSuperAdmin();
console.log(`\n══ MENSAJES DE MaKo → AUTOMATIZACIONES DE LA PLATAFORMA (ws${ws}) — ${aplicar ? 'APLICANDO' : 'SIMULACRO'} ══`);
let creadas = 0, prendidas = 0, salteadas = 0;
await runWithWorkspace(ws, async () => {
  const db = await getTenantDb();
  const { data: vivas, error } = await db.from('nutricion_secuencias')
    .select('id, nombre, activa, trigger_tipo, disparadores').eq('trigger_tipo', TRIGGER_AVISO_MAKO).is('archivada_at', null);
  if (error) throw new Error(`ws${ws}: ${error.message}`);
  const filas = (vivas ?? []) as Array<{ id: number; nombre: string | null; activa: boolean | null; trigger_tipo: string; disparadores?: unknown }>;
  for (const m of MUDADOS) {
    const ya = filas.filter((f) => eventoDeFila(f) === m.evento);
    if (ya.length) {
      console.log(`${m.evento}: ya está (${ya.map((f) => `#${f.id} «${f.nombre ?? ''}» ${f.activa ? 'prendida' : 'pausada'}`).join(', ')}): nada`);
      salteadas++;
      continue;
    }
    console.log(`${m.evento}: crea «${plantillaPorId(m.plantilla)!.nombre}» y la deja PRENDIDA`);
    if (!aplicar) continue;
    const r = await crearDesdePlantilla(m.plantilla, {
      db: db as never, setPasos: setSecuenciaPasos as never, setDisparadores: guardarDisparadores as never, plataforma: true,
    });
    creadas++;
    console.log(`  ✓ creada #${r.id} «${r.nombre}»`);
    await setSecuenciaActiva(r.id, true);
    prendidas++;
    console.log('  ✓ prendida (validada como «Activar»)');
  }
});
console.log(`\n${aplicar ? '' : '(simulacro) '}creadas: ${creadas} · prendidas: ${prendidas} · ya estaban: ${salteadas}`);
