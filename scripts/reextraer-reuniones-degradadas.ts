// =============================================================================
// Volver a leer las reuniones que se leyeron con el modelo equivocado
// =============================================================================
// El 10, 11 y 12 de agosto la cascada barata degradó `plan-fathom` a `mistral-small` y a
// `gpt-4o-mini` sin que nada lo dijera (el porqué está en lib/model-catalogo.ts →
// `fallback`). Medido sobre la misma llamada leída por dos workspaces con 65 segundos de
// diferencia: gemini-flash 74% de precisión y 2 tareas inventadas, mistral-small 46% y 12.
//
// Esos borradores no se pueden reparar desde los datos: el contenido está mal leído. Hay
// que volver a leerlos, y ahora con el modelo correcto (`fallback: []` lo garantiza) y el
// prompt arreglado.
//
// A QUIÉN TOCA: se decide por el REGISTRO DE GASTO, no por una lista escrita a mano. Se
// mira qué modelos corrieron en los 6 minutos previos a crear cada borrador; si alguna
// llamada NO fue de Gemini, la lectura está contaminada. `claude-sonnet-5` NO cuenta como
// degradado: es mejor que Gemini, y esas corridas son de la época del fallback pago.
//
// ⚠️ ESTO PISA EL BORRADOR, y por eso no es lo mismo que las otras reparaciones de hoy.
// Las tareas nuevas son OTRAS: los títulos cambian, así que el cruce anti-duplicados y las
// preguntas del Perro apuntaban a cosas que ya no existen y se rehacen. Lo que el dueño
// haya destildado o corregido en ESE borrador se pierde — no hay forma de mapearlo. Por
// eso el script lo dice fuerte antes de escribir, y por eso corre de a una reunión.
//
// ⚠️ CUESTA PLATA: cada reunión son ~7 llamadas de 19k tokens. Si Gemini no contesta,
// ahora se paga Sonnet (eso es lo que se arregló). Contá ~US$0 con Gemini y ~US$2 si cae.
//
//   NODE_OPTIONS="--conditions=react-server" npx tsx scripts/reextraer-reuniones-degradadas.ts
//   NODE_OPTIONS="--conditions=react-server" npx tsx scripts/reextraer-reuniones-degradadas.ts --aplicar --ws 9
//   …y --id propmsq77kft5jk4t para una sola.
// =============================================================================

import { config } from 'dotenv';
import { resolve } from 'node:path';
config({ path: resolve(process.cwd(), '.env.local') });

const APLICAR = process.argv.includes('--aplicar');
const arg = (n: string): string => {
  const i = process.argv.indexOf(`--${n}`);
  return i >= 0 ? (process.argv[i + 1] ?? '') : '';
};
const SOLO_WS = arg('ws');
const SOLO_ID = arg('id');

type Fila = { id: string; workspace_id: string; ref: string | null; fuente_titulo: string | null; created_at: string; tareas: unknown[] };

async function main() {
  const { runWithWorkspace, getTenantDb } = await import('../lib/workspace');
  const { getSupabaseServer } = await import('../lib/supabase');
  const { setSetting } = await import('../lib/settings');
  const {
    extraerTareasDeReunion, preguntasDeContexto, cacheKeyReunion,
    ROL_CONSULTOR, ROL_DESCONOCIDO,
  } = await import('../lib/plan-fathom');
  const { emailsConCuenta, repartoDeTarea, resumenDelReparto } = await import('../lib/reunion-reparto');
  const { listarUsuarios } = await import('../lib/usuarios');
  const { resolverClienteDeReunion, nombreDeProyectoPara } = await import('../lib/reunion-cliente');
  const { listPlanBoard } = await import('../lib/plan-board');
  const { glosarioTexto } = await import('../lib/glosario');

  const admin = getSupabaseServer();
  const { data } = await admin.from('plan_propuestas')
    .select('id, workspace_id, ref, fuente_titulo, created_at, tareas')
    .eq('origen', 'fathom').eq('estado', 'pendiente').order('created_at', { ascending: false });

  const conCuenta = emailsConCuenta(await listarUsuarios().catch(() => []));
  const candidatas: Array<{ f: Fila; rid: number; modelos: string[] }> = [];

  for (const f of ((data ?? []) as Fila[])) {
    if (SOLO_WS && f.workspace_id !== SOLO_WS) continue;
    if (SOLO_ID && f.id !== SOLO_ID) continue;
    const rid = Number(String(f.ref ?? '').replace(/^fathom:/, ''));
    if (!Number.isFinite(rid) || !rid) continue;
    // La ventana: los 6 minutos anteriores a crear el borrador. Una extracción son N
    // llamadas seguidas y el borrador se escribe al final.
    const hasta = new Date(f.created_at).toISOString();
    const desde = new Date(new Date(f.created_at).getTime() - 6 * 60_000).toISOString();
    const { data: u } = await admin.from('anthropic_usage').select('model')
      .eq('feature', 'plan-fathom').eq('workspace_id', f.workspace_id)
      .gte('created_at', desde).lte('created_at', hasta);
    const modelos = [...new Set(((u ?? []) as Array<{ model: string }>).map((x) => x.model))];
    if (!modelos.length) continue;                                   // sin registro: no se asume nada
    // Degradado = alguna llamada corrió en un modelo peor que Gemini. Sonnet no lo es.
    const degradado = modelos.some((m) => !m.startsWith('gemini') && !m.startsWith('claude'));
    if (!degradado) continue;
    candidatas.push({ f, rid, modelos });
  }

  console.log(`\n═══ BORRADORES LEÍDOS CON EL MODELO EQUIVOCADO: ${candidatas.length} ═══`);
  for (const c of candidatas) {
    console.log(`  ws${String(c.f.workspace_id).padEnd(2)} ${c.f.id} · ${String((c.f.tareas ?? []).length).padStart(3)} tareas · ${String(c.f.fuente_titulo ?? '').slice(0, 42).padEnd(44)} → ${c.modelos.join(', ')}`);
  }
  if (!candidatas.length) { console.log('  (ninguno)'); return; }
  if (!APLICAR) {
    console.log('\n⚠️ Re-extraer PISA el borrador: los títulos cambian, así que el cruce y las preguntas se rehacen');
    console.log('   y lo que hayas destildado o corregido en ESE borrador se pierde.');
    console.log('\n(dry run — con --aplicar se ejecuta. Acotá con --ws 9 o --id <propXXX>)\n');
    return;
  }

  for (const { f, rid } of candidatas) {
    console.log(`\n─── ${f.id} (ws ${f.workspace_id}) «${f.fuente_titulo}»`);
    await runWithWorkspace(Number(f.workspace_id), async () => {
      const db = await getTenantDb();
      const board = await listPlanBoard().catch(() => ({ proyectos: [] as Array<{ id: string; emoji: string; name: string }> }));
      const proyectos = board.proyectos.map((p) => ({ id: p.id, emoji: p.emoji, nombre: p.name }));

      // El cache trae los participantes de la corrida vieja: sirven igual (son de la
      // reunión, no del modelo) y ahorran una llamada a Fathom.
      const crudo = await (await import('../lib/settings')).getSetting(cacheKeyReunion(rid)).catch(() => null);
      let participantes: Array<{ nombre: string; email: string }> = [];
      try { participantes = (JSON.parse(crudo ?? '{}').participantes ?? []) as typeof participantes; } catch { /* sin cache */ }

      const cliente = await resolverClienteDeReunion({ titulo: f.fuente_titulo, participantes }).catch(() => null);
      const yoFila = (await listarUsuarios().catch(() => []))
        .find((u) => String(u.workspace_id) === String(f.workspace_id) || u.rol === 'admin');
      const yo = { nombre: yoFila?.nombre ?? '', email: yoFila?.email ?? '' };
      console.log(`    yo=${yo.nombre} <${yo.email}> · participantes=${participantes.length} · cliente=${cliente?.nombre ?? '(ninguno)'}`);

      const out = await extraerTareasDeReunion(rid, proyectos, yo, {
        glosario: await glosarioTexto().catch(() => ''),
        participantes,
        rolDelDueno: cliente ? ROL_CONSULTOR : ROL_DESCONOCIDO,
        usoMotivo: 'Re-lectura: la corrida original usó un modelo degradado',
      });
      if (out.partesFallidas) {
        console.log(`    ⛔ ${out.partesFallidas} tramo(s) NO se pudieron leer: NO se pisa el borrador (peor el remedio). Reintentá.`);
        return;
      }
      if (!out.tareas.length) { console.log('    ⛔ la re-lectura no devolvió tareas: no se pisa nada'); return; }

      const proyCliente = cliente ? await nombreDeProyectoPara(cliente).catch(() => '') : '';
      const nombreProy = new Map(proyectos.map((p) => [p.id, p.nombre]));
      const nuevas = out.tareas.map((t) => ({
        titulo: t.titulo,
        detalle: t.detalle || undefined,
        prioridad: t.prioridad,
        proyecto: proyCliente || (t.proyectoId ? nombreProy.get(t.proyectoId) : (t.proyectoNombre?.trim() || undefined)),
        ...repartoDeTarea(t, conCuenta),
        minuto: t.minuto,
        minutos: t.minutos,
      }));
      const resumen = `MaKo releyó tu reunión${f.fuente_titulo ? ` «${f.fuente_titulo}»` : ''} y sacó ${resumenDelReparto(nuevas)}.`;
      const antes = (f.tareas ?? []).length;
      console.log(`    ${antes} → ${nuevas.length} tareas · ${resumen}`);

      // Las preguntas apuntan a títulos que ya no existen: se rehacen sobre las nuevas.
      // Se le pasan las candidatas PROPIAS tal cual salieron de la extracción: preguntarle
      // al dueño por el trabajo de otro es justo lo que el `sobre` de cada pregunta vino a
      // evitar.
      const { preguntas } = await preguntasDeContexto(
        out.tareas, f.fuente_titulo ?? '', 'Preguntas de contexto (re-lectura)',
      ).catch(() => ({ preguntas: [] as unknown[] }));

      // `cruzado_at: null` ACÁ SÍ corresponde y es la excepción a la regla del día: no se
      // está invalidando trabajo humano, se están reemplazando tareas que ya no existen.
      // Un `enriquece` guardado apunta a un título que se fue con la lectura vieja.
      const { error } = await db.from('plan_propuestas')
        .update({ tareas: nuevas, resumen, notas: preguntas, cruzado_at: null })
        .eq('id', f.id).eq('estado', 'pendiente');
      if (error) { console.log(`    ✗ ${error.message}`); return; }
      // El cache se refresca con la lectura buena: es la lista blanca de a quién se le
      // puede repartir y lo que sirve el botón manual.
      await setSetting(cacheKeyReunion(rid), JSON.stringify({ tareas: out.tareas, participantes, ts: Date.now() })).catch(() => {});
      console.log('    ✓ re-extraída');
    });
  }
}

main().then(() => process.exit(0)).catch((e) => { console.error(e); process.exit(1); });
