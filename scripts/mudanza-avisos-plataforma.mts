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
// correría. ⚠️ Desde el 16/10/2026 (7b2bc409a) no hay camino viejo: sin la fila, el aviso NO sale. Para un evento cuyo aviso
// el código de producción todavía manda por su lado (la alerta de anuncios antes de B3), crear la fila ANTES del deploy no
// cambia nada (ese código no la lee) y deja el evento cubierto apenas se despliega.
//
//   node --conditions react-server --import tsx scripts/mudanza-avisos-plataforma.mts             → SIMULACRO (default)
//   node --conditions react-server --import tsx scripts/mudanza-avisos-plataforma.mts --aplicar   → escribe
//   opciones: --env=<ruta del .env.local> (default ./.env.local; un worktree no tiene: --env=C:/dev/mako-api/.env.local)
//             --eventos=<a,b,c> → sólo esos eventos (los de lo que YA está desplegado; sin esto, todos los de MUDADOS).
//             Un evento que no está en MUDADOS frena el script antes de tocar nada.
//             --pausar → además PAUSA la fila ya creada de esos eventos si su aviso nacía apagado (ver abajo).
// ⚠️ LO QUE NACÍA APAGADO SE CREA PAUSADO (17/10/2026, lote 3). Un aviso del catálogo sin `porDefecto` nacía APAGADO en
// /mensajes (`estaPrendida`, lib/plantillas.ts), y medido el 17/10 ningún negocio había prendido `landing-cambio`,
// `lead-de-landing` ni los dos de la prueba del Pixel: no le llegaban a nadie. Un evento de la plataforma NO lee ese
// interruptor (lo decide su fila), así que crear su fila PRENDIDA era empezar a mandárselo a TODOS los negocios al desplegar.
// Por eso la fila de un aviso así nace pausada: el texto ya es editable en SuperAdmin y prenderla es decisión de quien la ve.
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
  { plantilla: 'mako-whatsapp-desvinculado', evento: 'whatsapp_desvinculado' },
  { plantilla: 'mako-whatsapp-volvio', evento: 'whatsapp_volvio' },
  { plantilla: 'mako-reunion-grabada', evento: 'reunion_grabada' },
  { plantilla: 'mako-reporte-semanal', evento: 'reporte_semanal' },
  { plantilla: 'mako-oferta-lista', evento: 'oferta_lista' },
  // 16/10/2026, lote 1 de docs/inventario-nada-por-detras.md: la alerta de la cuenta publicitaria, con su techo.
  { plantilla: 'mako-meta-cuenta-frenada', evento: 'meta_cuenta_frenada' },
  { plantilla: 'mako-meta-cuenta-recuperada', evento: 'meta_cuenta_recuperada' },
  // 17/10/2026, lote 2: la reunión que el lead canceló en Calendly. La fila va ANTES del deploy (el código de antes no la lee).
  { plantilla: 'mako-reunion-cancelada', evento: 'reunion_cancelada' },
  { plantilla: 'mako-lead-fusionado', evento: 'lead_fusionado' },
  { plantilla: 'mako-curso-recordatorio', evento: 'curso_recordatorio' },
  { plantilla: 'mako-flow-puente-ausente', evento: 'flow_puente_ausente' },
  // 17/10/2026, lote 3: los tres avisos del cron tracking-vigilante.
  { plantilla: 'mako-tracking-apagado', evento: 'tracking_apagado' },
  { plantilla: 'mako-pixel-viejo', evento: 'pixel_viejo' },
  { plantilla: 'mako-landing-cambio', evento: 'landing_cambio' },
  { plantilla: 'mako-lead-de-landing', evento: 'lead_de_landing' },
  { plantilla: 'mako-prueba-recibida', evento: 'prueba_recibida' },
  { plantilla: 'mako-prueba-grabada', evento: 'prueba_grabada' },
  { plantilla: 'mako-lead-formulario-meta', evento: 'lead_formulario_meta' },
  // 17/10/2026, «nada por detrás» (lo toma el Plan): las tareas de las reuniones que MaKo dejó en el Plan. Nacía apagado.
  { plantilla: 'mako-reunion-tareas-al-plan', evento: 'reunion_tareas_al_plan' },
  // 26/10/2026: el Claude del negocio que no puede analizar sus llamadas (docs/hallazgos-closing.md). Nace PRENDIDA.
  { plantilla: 'mako-closing-ia-caida', evento: 'closing_ia_caida' },
  // 28/10/2026: Instagram o Zernio frenan los mensajes de un negocio (el tope, docs/hallazgos-chatbot.md). Nace PRENDIDA.
  // Faltaba: el paso documentado (`--eventos=social_tope`) tiraba «no está en la mudanza» (verificación de 69b49a31c).
  { plantilla: 'mako-social-tope', evento: 'social_tope' },
  // 31/10/2026, ticket #37: la cuenta publicitaria del cliente de una agencia le llega a la agencia. La fila va ANTES del deploy: el
  // código de antes no la lee, y con el nuevo sin la fila esa alerta no le sale a nadie.
  { plantilla: 'mako-meta-cuenta-frenada-agencia', evento: 'meta_cuenta_frenada_agencia' },
  { plantilla: 'mako-meta-cuenta-recuperada-agencia', evento: 'meta_cuenta_recuperada_agencia' },
];
// POR TANDAS DE DEPLOY (16/10/2026): la fila de un evento cuyo código todavía no está en producción no correría, así
// que se mudan sólo los desplegados. Sin `--eventos`, todos.
const pedidos = arg('eventos')?.split(',').map((e) => e.trim()).filter(Boolean) ?? null;
const ajenos = (pedidos ?? []).filter((e) => !TODOS.some((m) => m.evento === e));
if (ajenos.length) throw new Error(`--eventos: ${ajenos.join(', ')} no está en la mudanza`);
const MUDADOS = pedidos ? TODOS.filter((m) => pedidos.includes(m.evento)) : TODOS;
// `--pausar` SÓLO con la lista explícita: sin `--eventos=`, MUDADOS es TODOS y pausaría también las filas prendidas a
// propósito que nacían apagadas (#260 `oferta_lista`, la de `meta_cuenta_recuperada`). Y `--eventos a,b` sin el «=» no
// lo lee `arg()` y caería en TODOS sin avisar. Revisión del Cerebro, 17/10/2026.
if (process.argv.includes('--eventos') || process.argv.some((a) => a.startsWith('--eventos') && !a.startsWith('--eventos='))) {
  throw new Error('--eventos va con «=»: --eventos=a,b');
}
if (process.argv.includes('--pausar') && !pedidos) throw new Error('--pausar exige --eventos=<a,b>: sin la lista pausaría filas prendidas a propósito');

const { runWithWorkspace, getTenantDb, wsSuperAdmin } = await import('../lib/workspace');
const { plantillaPorId, pasosDePlantilla } = await import('../lib/plantillas-automatizaciones');
const { crearDesdePlantilla } = await import('../lib/plantilla-crear');
const { setSecuenciaPasos, setSecuenciaActiva } = await import('../lib/nutricion');
const { guardarDisparadores } = await import('../lib/disparadores-guardar');
const { TRIGGER_AVISO_MAKO, EVENTOS_MAKO } = await import('../lib/disparadores');
const { eventoDeFila, frenoDelEvento } = await import('../lib/aviso-evento');
const { validarGrafo, normalizar } = await import('../lib/flujo-grafo');
const { CATALOGO_AVISOS } = await import('../lib/avisos-catalogo');
const pausar = process.argv.includes('--pausar');

/** ¿El aviso de ese evento nacía APAGADO en /mensajes? Sin `porDefecto` en el catálogo, sí (ver la cabecera). */
const naciaApagado = (evento: string): boolean => {
  const aviso = EVENTOS_MAKO.find((e) => e.subtipo === evento)?.aviso;
  return !CATALOGO_AVISOS.find((a) => a.id === aviso)?.porDefecto;
};

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
let creadas = 0, prendidas = 0, salteadas = 0, pausadas = 0;
await runWithWorkspace(ws, async () => {
  const db = await getTenantDb();
  const { data: vivas, error } = await db.from('nutricion_secuencias')
    .select('id, nombre, activa, trigger_tipo, disparadores').eq('trigger_tipo', TRIGGER_AVISO_MAKO).is('archivada_at', null);
  if (error) throw new Error(`ws${ws}: ${error.message}`);
  const filas = (vivas ?? []) as Array<{ id: number; nombre: string | null; activa: boolean | null; trigger_tipo: string; disparadores?: unknown }>;
  for (const m of MUDADOS) {
    const ya = filas.filter((f) => eventoDeFila(f) === m.evento);
    if (ya.length) {
      const aPausar = pausar && naciaApagado(m.evento) ? ya.filter((f) => f.activa === true) : [];
      console.log(`${m.evento}: ya está (${ya.map((f) => `#${f.id} «${f.nombre ?? ''}» ${f.activa ? 'prendida' : 'pausada'}`).join(', ')}): ${aPausar.length ? 'la PAUSA (nacía apagada en /mensajes)' : 'nada'}`);
      salteadas++;
      for (const f of aPausar) {
        if (!aplicar) continue;
        await setSecuenciaActiva(f.id, false);
        pausadas++;
        console.log(`  ✓ pausada #${f.id}`);
      }
      continue;
    }
    const apagada = naciaApagado(m.evento);
    console.log(`${m.evento}: crea «${plantillaPorId(m.plantilla)!.nombre}» y la deja ${apagada ? 'PAUSADA (nacía apagada en /mensajes)' : 'PRENDIDA'}`);
    if (!aplicar) continue;
    const r = await crearDesdePlantilla(m.plantilla, {
      db: db as never, setPasos: setSecuenciaPasos as never, setDisparadores: guardarDisparadores as never, plataforma: true,
    });
    creadas++;
    console.log(`  ✓ creada #${r.id} «${r.nombre}»`);
    if (apagada) continue;
    await setSecuenciaActiva(r.id, true);
    prendidas++;
    console.log('  ✓ prendida (validada como «Activar»)');
  }
});
console.log(`\n${aplicar ? '' : '(simulacro) '}creadas: ${creadas} · prendidas: ${prendidas} · pausadas: ${pausadas} · ya estaban: ${salteadas}`);
