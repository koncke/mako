// PRUEBA EN SECO del juez del criterio de compromisos: no escribe NADA.
//
//   node --conditions react-server --import tsx scripts/probar-criterio.mts <criterio.md> [recordingId…] [--ws=1] [--dueno=Mauricio] [--salida=archivo.json]
//
// Es el paso 3 del plan del 9/9 («probar su criterio en seco, sin tocar una tarjeta»).
// Toma los borradores que MaKo YA sacó de esas reuniones, baja la transcripción de
// Fathom y le pide al juez el veredicto de cada tarea. Imprime cuántas caen en cada
// cubeta y la lista entera, y opcionalmente la guarda en JSON.
//
// ⚠️ La transcripción se lee con las credenciales del workspace del borrador, pero el
// JUEZ corre en el ws 9: una prueba nuestra no se le cobra al cliente.
//
// Del .md se toma SOLO la sección «1. Criterio final» hasta «Esquema de salida» (la
// definición y las 5 reglas). Las cubetas y el formato de salida los pone el juez.
import { config } from 'dotenv';
config({ path: '.env.local' });
import { readFileSync, writeFileSync } from 'node:fs';

const args = process.argv.slice(2);
const flag = (k: string, def: string) => args.find((a) => a.startsWith(`--${k}=`))?.split('=').slice(1).join('=') ?? def;
const archivo = args.find((a) => !a.startsWith('--') && !/^\d+$/.test(a));
const ids = args.filter((a) => /^\d+$/.test(a)).map(Number);
const WS = Number(flag('ws', '1'));
const DUENO = flag('dueno', 'Mauricio');
const SALIDA = flag('salida', '');
if (!archivo || !ids.length) {
  console.error('Uso: probar-criterio.mts <criterio.md> <recordingId> [recordingId…] [--ws=1] [--dueno=Mauricio] [--salida=x.json]');
  process.exit(1);
}

const md = readFileSync(archivo, 'utf8');
const desde = md.indexOf('## 1. Criterio final');
const hasta = md.indexOf('### Esquema de salida');
if (desde < 0 || hasta < 0) { console.error('No encontré «## 1. Criterio final» … «### Esquema de salida» en el .md'); process.exit(1); }
const criterio = md.slice(desde, hasta).replace('## 1. Criterio final', '').trim();

const { runWithWorkspace } = await import('../lib/workspace');
const { getPropuestaPorRef } = await import('../lib/plan-propuesta');
const { fetchRecordingTranscript, transcriptToText } = await import('../lib/fathom-api');
const { juzgarConCriterio } = await import('../lib/plan-criterio-juez');
const { resumenVeredictos } = await import('../lib/plan-criterio-reglas');

const todo: unknown[] = [];
const total = { compromiso: 0, acuerdo_interno: 0, descartado: 0, fuera: 0, sin_juzgar: 0, degradadas: 0, sin_regla: 0, tareas: 0, faltantes: 0 };
for (const rid of ids) {
  const leido = await runWithWorkspace(WS, async () => {
    const prop = await getPropuestaPorRef(`fathom:${rid}`);
    const items = await fetchRecordingTranscript(rid).catch(() => []);
    return { prop, texto: transcriptToText(items, 400000), ultimo: items.at(-1)?.timestamp ?? '?' };
  });
  if (!leido.prop) { console.log(`\n■ ${rid}: no hay borrador en ws ${WS}`); continue; }
  if (!leido.texto) { console.log(`\n■ ${rid}: Fathom no devolvió transcripción`); continue; }
  const cands = leido.prop.tareas.map((t) => ({ titulo: t.titulo, detalle: t.detalle, dueño: t.dueno, esDeOtro: t.esDeOtro }));
  const out = await runWithWorkspace(9, () => juzgarConCriterio({ criterio, candidatas: cands, transcript: leido.texto, dueno: DUENO, usoMotivo: `Prueba en seco del criterio (${rid})` }));
  const r = resumenVeredictos(out.veredictos);
  console.log(`\n■ ${leido.prop.fuenteTitulo} · ${String(leido.prop.fuenteFecha ?? '').slice(0, 10)} · dura ${leido.ultimo} · ${cands.length} tareas de MaKo${out.fallo ? ' · ⛔ EL JUEZ FALLÓ' : ''}`);
  console.log(`  → ${r.compromiso} compromisos · ${r.acuerdo_interno} acuerdos internos · ${r.descartado} descartadas (${r.degradadas} por cita) · ${r.fuera} fuera · ${r.sin_juzgar} sin juzgar${out.usage ? ` · US$${(out.usage as { costUsd?: number }).costUsd?.toFixed(4) ?? '?'}` : ''}`);
  cands.forEach((c, i) => {
    const v = out.veredictos[i];
    const et = !v ? 'SIN JUZGAR' : v.cubeta === 'descartado' ? `descartado (regla ${v.regla}${v.parteDe != null ? ` → parte de ${v.parteDe}` : ''})` : v.cubeta;
    console.log(`  ${String(i).padStart(2)} ${et.padEnd(28)} ${(c.esDeOtro ? c.dueño || 'otro' : DUENO).slice(0, 16).padEnd(16)} ${c.titulo.slice(0, 70)}`);
    if (v?.razon) console.log(`     ${v.razon.slice(0, 160)}`);
    if (v?.cita) console.log(`     «${v.cita.slice(0, 140)}»`);
  });
  if (out.faltantes.length) console.log(`  + ${out.faltantes.length} QUE FALTABAN en la lista de MaKo:`);
  for (const f of out.faltantes) {
    console.log(`   + ${f.cubeta.padEnd(26)} ${f.quien.slice(0, 16).padEnd(16)} ${f.titulo.slice(0, 70)}`);
    console.log(`     «${f.cita.slice(0, 140)}»`);
  }
  total.faltantes += out.faltantes.length;
  for (const k of Object.keys(r) as Array<keyof typeof r>) total[k] += r[k];
  total.tareas += cands.length;
  todo.push({ recordingId: rid, titulo: leido.prop.fuenteTitulo, fecha: leido.prop.fuenteFecha, dura: leido.ultimo, fallo: out.fallo, tareas: cands.map((c, i) => ({ ...c, veredicto: out.veredictos[i] })), faltantes: out.faltantes });
}
console.log(`\nTOTAL ${ids.length} reuniones · ${total.tareas} tareas de MaKo → ${total.compromiso} compromisos · ${total.acuerdo_interno} acuerdos internos · ${total.descartado} descartadas (${total.degradadas} por cita, ${total.sin_regla} sin la regla que las saca) · ${total.fuera} fuera · ${total.sin_juzgar} sin juzgar · +${total.faltantes} que faltaban`);
if (SALIDA) { writeFileSync(SALIDA, JSON.stringify(todo, null, 2)); console.log(`guardado en ${SALIDA}`); }
