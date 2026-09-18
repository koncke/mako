// =============================================================================
// cs-backfill-vistos — lo que los clientes vieron en Whop antes de que hubiera webhook
// =============================================================================
//   NODE_OPTIONS="--conditions=react-server" npx tsx scripts/cs-backfill-vistos.ts
//     (sin flags)   → SIMULA: lee Whop y la base, dice qué escribiría, no toca nada
//     --escribir    → escribe `visto_at` en cs_respuestas
//
// El webhook `course_lesson_interaction.completed` anota cada clase vista desde que
// existe (11/08). Todo lo que un cliente miró ANTES —o lo que se perdió porque el
// webhook falló, que hasta el 17/09 fallaba en silencio: ver `anotarVisto`— solo
// entra leyéndolo de Whop. Esto lo lee con `listarInteracciones` y lo escribe con el
// MISMO camino que el webhook (`leadDeAlumno` + `anotarVisto`), así que atribuye con
// las mismas reglas: si no se puede saber de qué cliente es, no se escribe.
//
// ⚠️ LA FECHA ES LA DE WHOP, NO LA DE HOY. Cada interacción trae su `completed_at`,
// y eso es lo que se escribe. Hecho con «ahora», como el webhook, estamparía todo lo
// anterior con la fecha del día del backfill: la ficha diría que un cliente vio diez
// clases el mismo martes.
//
// ⚠️ ES IDEMPOTENTE Y NO RETROCEDE FECHAS. `anotarVisto` solo escribe si no había
// fecha o si la de Whop es ANTERIOR. Correrlo dos veces no cambia nada, y correrlo
// después de un webhook no pisa una fecha más temprana con una más reciente.
//
// ⚠️ NO LE ESCRIBE A NINGÚN CLIENTE. Solo llena `visto_at`. El recordatorio de «la vio
// y no la contestó» es un BORRADOR (`borradorVioYNoContesto`) que Mauricio decide si
// manda; ningún cron lo dispara. Lo que sí cambia es la cartera: un cliente con clases
// vistas y tareas sin contestar pasa a «la pelota es suya».
// =============================================================================

import { config } from 'dotenv';
import { resolve } from 'node:path';
config({ path: resolve(process.cwd(), '.env.local') });

import { getTenantDb, runWithWorkspace } from '../lib/workspace';
import { getMapaLecciones, reconstruirMapa, leadDeAlumno, anotarVisto } from '../lib/cs-avance';
import { listarCursos, listarAlumnos, listarInteracciones } from '../lib/whop';
import { rotuloDe } from '../lib/programa-catalogo';

const WS = 1;
const ESCRIBIR = process.argv.includes('--escribir');

type Motivo = 'sin-fecha' | 'leccion-desconocida' | 'alumno-sin-email' | 'cliente-desconocido';

async function main(): Promise<void> {
  console.log(`\n  cs-backfill-vistos · ws ${WS} · ${ESCRIBIR ? 'ESCRIBIENDO' : 'SIMULACIÓN (no escribe nada)'}\n`);

  const cursos = await listarCursos(WS);
  if (!cursos.ok) throw new Error(`Whop: ${cursos.error}`);
  console.log(`  cursos en Whop: ${cursos.data.length}`);

  let mapa = await getMapaLecciones();
  let reconstruido = false;

  const salteadas = new Map<Motivo, number>();
  const sinCliente = new Map<string, number>(); // email → cuántas clases vio sin poder atribuirse
  const porLead = new Map<number, { nuevo: number; antes: number; igual: number; clases: string[] }>();
  let total = 0;

  for (const curso of cursos.data) {
    const [alumnos, inter] = await Promise.all([listarAlumnos(curso.id, WS), listarInteracciones(curso.id, WS)]);
    // Un listado cortado NO se procesa a medias: `todas()` ahora devuelve error si se
    // quedó sin páginas, y acá eso corta el backfill entero en vez de llenar la mitad.
    if (!alumnos.ok) throw new Error(`Whop (alumnos de ${curso.title}): ${alumnos.error}`);
    if (!inter.ok) throw new Error(`Whop (interacciones de ${curso.title}): ${inter.error}`);
    console.log(`  · ${curso.title}: ${alumnos.data.length} alumnos · ${inter.data.length} interacciones`);

    const emailDe = new Map(alumnos.data.map((a) => [a.user?.id ?? a.id, a.user?.email ?? null]));
    // El cruce lead-por-email se hace UNA vez por alumno, no por interacción: son
    // 44 clases por cliente, 44 consultas idénticas a la misma tabla.
    const leadDe = new Map<string, number | null>();

    for (const it of inter.data) {
      total++;
      if (!it.completed_at) { salteadas.set('sin-fecha', (salteadas.get('sin-fecha') ?? 0) + 1); continue; }

      let claseId = it.course_lesson_id ? mapa[it.course_lesson_id] : undefined;
      if (!claseId && it.course_lesson_id && !reconstruido) {
        // Una sola reconstrucción por corrida: son ~14 requests a Whop.
        mapa = await reconstruirMapa(WS);
        reconstruido = true;
        claseId = mapa[it.course_lesson_id];
      }
      if (!claseId) { salteadas.set('leccion-desconocida', (salteadas.get('leccion-desconocida') ?? 0) + 1); continue; }

      const email = it.user_id ? emailDe.get(it.user_id) ?? null : null;
      if (!email) { salteadas.set('alumno-sin-email', (salteadas.get('alumno-sin-email') ?? 0) + 1); continue; }

      if (!leadDe.has(email)) leadDe.set(email, await leadDeAlumno(email));
      const leadId = leadDe.get(email) ?? null;
      if (!leadId) {
        salteadas.set('cliente-desconocido', (salteadas.get('cliente-desconocido') ?? 0) + 1);
        sinCliente.set(email, (sinCliente.get(email) ?? 0) + 1);
        continue;
      }

      const fila = porLead.get(leadId) ?? { nuevo: 0, antes: 0, igual: 0, clases: [] };
      let r: 'nuevo' | 'antes' | 'igual';
      if (ESCRIBIR) {
        r = await anotarVisto(leadId, claseId, it.completed_at);
      } else {
        // En simulación se clasifica igual que `anotarVisto`, leyendo sin escribir.
        const db = await getTenantDb();
        const { data } = await db.from('cs_respuestas').select('visto_at')
          .eq('lead_id', leadId).eq('clase_id', claseId).eq('area', '').maybeSingle();
        const actual = (data as { visto_at?: string | null } | null)?.visto_at ?? null;
        r = !actual ? 'nuevo' : actual <= it.completed_at ? 'igual' : 'antes';
      }
      fila[r]++;
      if (r !== 'igual') fila.clases.push(`${rotuloDe(claseId)} (${it.completed_at.slice(0, 10)})`);
      porLead.set(leadId, fila);
    }
  }

  const accion = ESCRIBIR ? 'anotadas' : 'se anotarían';
  const nuevas = [...porLead.values()].reduce((s, x) => s + x.nuevo, 0);
  const adelantadas = [...porLead.values()].reduce((s, x) => s + x.antes, 0);
  const iguales = [...porLead.values()].reduce((s, x) => s + x.igual, 0);

  console.log(`\n  interacciones leídas: ${total}`);
  console.log(`  ${accion} por primera vez: ${nuevas}`);
  console.log(`  con fecha corregida hacia atrás: ${adelantadas}`);
  console.log(`  ya estaban con esa fecha o una anterior: ${iguales}`);

  if (porLead.size) {
    console.log(`\n  por cliente (${porLead.size}):`);
    for (const [lead, x] of porLead) {
      console.log(`    lead ${String(lead).padStart(5)}  +${x.nuevo} nuevas · ${x.antes} corregidas · ${x.igual} iguales`);
      for (const c of x.clases.slice(0, 6)) console.log(`        ${c}`);
      if (x.clases.length > 6) console.log(`        … y ${x.clases.length - 6} más`);
    }
  }

  if (salteadas.size) {
    console.log('\n  salteadas, y por qué:');
    for (const [m, n] of salteadas) console.log(`    ${m.padEnd(22)} ${n}`);
  }
  // Los emails que no matchean con ningún cliente son lo más útil de todo el
  // reporte: casi siempre es alguien que compró en Whop con otro mail que el del
  // CRM, y eso no se puede adivinar desde acá — lo tiene que corregir una persona.
  if (sinCliente.size) {
    console.log('\n  ⚠ alumnos de Whop que NO son ningún cliente del CRM (¿compraron con otro email?):');
    for (const [e, n] of sinCliente) console.log(`    ${e}  (${n} clases vistas)`);
  }
  if (!ESCRIBIR && (nuevas || adelantadas)) console.log('\n  Para escribirlo: volver a correr con --escribir\n');
}

runWithWorkspace(WS, main).catch((e) => { console.error(`\n  ✖ ${e instanceof Error ? e.message : e}\n`); process.exit(1); });
