// =============================================================================
// Pasar el barrido del 6/8 al tablero, por el canal `cerrar`
// =============================================================================
// El 6/8/2026, 20 agentes leyeron el repo para reescribir los detalles de las 426 tareas
// pendientes y, de paso, encontraron 62 que YA ESTABAN HECHAS, cada una con su evidencia
// `archivo:línea`. Eso quedó escrito en docs/tareas-ya-hechas.md y ahí se quedó: un mapa
// que nadie podía accionar sin ir tarea por tarea a mano.
//
// Esto lo convierte en borradores del canal `cerrar` (mig 0119), que es el mismo riel que
// usa el bot de commits: el dueño confirma de a una, con la evidencia delante y el botón
// «está a medias» para lo que avanzó pero no terminó.
//
// POR QUÉ NO PASA POR IA. La evidencia ya la escribió alguien que ABRIÓ el archivo y citó
// la línea. Volver a pasarla por un modelo solo agregaría una oportunidad de inventar. Acá
// no hay ni una llamada: se parsea el markdown y se copia el texto tal cual.
//
// LO QUE SÍ VERIFICA CONTRA LA BASE: que cada id exista y que la tarea siga ABIERTA. Entre
// el barrido y hoy pueden haberse cerrado a mano, y proponer cerrar algo ya cerrado es
// ruido que le hace perder confianza al canal entero.
//
// Es idempotente: `crearPropuesta` devuelve el borrador que ya existe si el `ref` coincide,
// así que correrlo dos veces no duplica nada.
//
//   npx tsx scripts/cerrar-barrido-6-8.ts               → dice qué haría
//   npx tsx scripts/cerrar-barrido-6-8.ts --aplicar     → solo el tablero del dueño
//   npx tsx scripts/cerrar-barrido-6-8.ts --aplicar --clientes  → también los de clientes
//
// LOS CLIENTES VAN APARTE, A PROPÓSITO. Un borrador en el tablero de un cliente le abre
// un modal apenas entra. Las 5 que salieron de sus tableros son todas de confianza MEDIA
// («está a medias»), así que el modal diría «¿esto ya está?» sobre cosas que no están del
// todo — el mejor modo de que deje de creerle al canal. Que las mande el dueño cuando
// quiera es una decisión suya, no un default del script.
// =============================================================================
import { config } from 'dotenv';
import { resolve } from 'node:path';
import { readFileSync } from 'node:fs';
config({ path: resolve(process.cwd(), '.env.local') });
import { runWithWorkspace, getTenantDb, wsSuperAdmin } from '../lib/workspace';
import { crearPropuesta, type PropuestaCerrar } from '../lib/plan-propuesta';

const APLICAR = process.argv.includes('--aplicar');
const CLIENTES = process.argv.includes('--clientes');
const DOC = resolve(process.cwd(), 'docs/tareas-ya-hechas.md');
/** El tope de `crearPropuesta`: más de 40 cierres en un borrador se recortan en silencio. */
const TOPE = 40;

type Grupo = { ws: number; quien: string; confianza: 'alta' | 'media'; filas: Array<{ id: string; titulo: string; evidencia: string }> };

/**
 * Lee el markdown. Los encabezados mandan: `## <Quien> (ws N)` abre un tablero y
 * `### Confianza alta|media` abre un grupo. Las filas son tablas de tres columnas.
 */
function parsear(): Grupo[] {
  const grupos: Grupo[] = [];
  let ws = 0; let quien = ''; let confianza: 'alta' | 'media' | null = null;

  for (const linea of readFileSync(DOC, 'utf8').split('\n')) {
    const cab = /^##\s+(.+?)\s*\(ws\s*(\d+)\)/.exec(linea);
    if (cab) { quien = cab[1].trim(); ws = Number(cab[2]); confianza = null; continue; }
    if (/^###\s/.test(linea)) {
      confianza = /confianza\s+alta/i.test(linea) ? 'alta' : /confianza\s+media/i.test(linea) ? 'media' : null;
      continue;
    }
    if (!ws || !confianza || !linea.startsWith('|')) continue;

    // La columna de evidencia puede traer `|` adentro, así que se junta todo lo que sobra
    // en vez de asumir exactamente tres celdas.
    const celdas = linea.split('|').slice(1, -1);
    if (celdas.length < 3) continue;
    const id = celdas[0].trim();
    if (!id || id === 'id' || /^-+$/.test(id)) continue;      // encabezado y separador
    const titulo = celdas[1].trim();
    const evidencia = celdas.slice(2).join('|').trim();
    if (evidencia.length < 10) continue;                       // limpiarCerrar lo tiraría igual

    let g = grupos.find((x) => x.ws === ws && x.confianza === confianza);
    if (!g) { g = { ws, quien, confianza, filas: [] }; grupos.push(g); }
    g.filas.push({ id, titulo, evidencia });
  }
  return grupos;
}

/** ids que siguen ABIERTOS en el tablero de ese workspace, con su título real. */
async function abiertas(ws: number, ids: string[], esDueno: boolean): Promise<Map<string, string>> {
  return runWithWorkspace(ws, async () => {
    const db = await getTenantDb();
    const tabla = esDueno ? 'plan_tareas' : 'experimento_tareas';
    const campos = esDueno ? 'id, title, progress' : 'id, titulo, progreso';
    const vivas = new Map<string, string>();
    // De a 100: un `.in()` con 60 ids anda, pero con el tablero entero no.
    for (let i = 0; i < ids.length; i += 100) {
      const { data, error } = await db.from(tabla).select(campos).in('id', ids.slice(i, i + 100));
      if (error) throw new Error(`leer ${tabla}: ${error.message}`);
      for (const r of (data ?? []) as Array<Record<string, unknown>>) {
        const prog = Number((esDueno ? r.progress : r.progreso) ?? 0);
        if (prog < 100) vivas.set(String(r.id), String((esDueno ? r.title : r.titulo) ?? ''));
      }
    }
    return vivas;
  });
}

(async () => {
  const wsDueno = await wsSuperAdmin();
  const grupos = parsear();
  if (!grupos.length) throw new Error('no pude parsear ninguna fila del doc');

  for (const g of grupos) {
    const esDueno = g.ws === wsDueno;
    const vivas = await abiertas(g.ws, g.filas.map((f) => f.id), esDueno);
    const yaCerradas = g.filas.filter((f) => !vivas.has(f.id));

    const cerrar: PropuestaCerrar[] = g.filas
      .filter((f) => vivas.has(f.id))
      .map((f) => ({
        id: f.id,
        // El título REAL de la base, no el de la tabla del doc: ahí venía recortado a 70
        // caracteres y el dueño tiene que reconocer la tarea de un vistazo.
        titulo: vivas.get(f.id) || f.titulo,
        evidencia: f.evidencia,
        confianza: g.confianza,
      }));

    const etiqueta = `${g.quien} (ws ${g.ws}) · confianza ${g.confianza}`;
    if (!esDueno && !CLIENTES) {
      console.log(`\n── ${etiqueta}`);
      console.log(`   ${g.filas.length} en el doc · SALTEADO (tablero de cliente). Sumá --clientes para incluirlo.`);
      continue;
    }
    console.log(`\n── ${etiqueta}`);
    console.log(`   ${g.filas.length} en el doc · ${cerrar.length} siguen abiertas · ${yaCerradas.length} ya estaban cerradas`);
    if (yaCerradas.length) console.log(`   ya cerradas (se saltean): ${yaCerradas.map((f) => f.id).join(', ')}`);
    if (cerrar.length > TOPE) console.log(`   ⚠ ${cerrar.length} > ${TOPE}: crearPropuesta recortaría ${cerrar.length - TOPE}`);
    if (!cerrar.length) { console.log('   nada para proponer'); continue; }

    if (!APLICAR) { console.log(`   [seco] crearía el borrador con ${Math.min(cerrar.length, TOPE)} cierres`); continue; }

    const id = await crearPropuesta({
      tareas: [], cerrar, ws: g.ws, origen: 'claude-code',
      // El ref hace el candado de idempotencia y separa alta de media, que es como el
      // dueño las quiere mirar: las medias no se cierran de una, son las que hay que ver.
      ref: `barrido:2026-08-06:${g.confianza}`,
      resumen: `Barrido del 6/8/2026: 20 agentes leyeron el repo y encontraron ${cerrar.length} tarea${cerrar.length === 1 ? '' : 's'} de este tablero que ya está${cerrar.length === 1 ? '' : 'n'} hecha${cerrar.length === 1 ? '' : 's'}, cada una con la línea de código que lo prueba.${g.confianza === 'media' ? ' Confianza MEDIA: varias están a medias o falta verlas corriendo — son justamente las que hay que mirar.' : ''}`,
      fuenteTitulo: `Barrido de 20 agentes · 6/8/2026 · confianza ${g.confianza}`,
    });
    console.log(`   ✓ /plan/revisar/${id}`);
  }

  if (!APLICAR) console.log('\nCorrida SECA. Volvé a correrlo con --aplicar para crear los borradores.');
  process.exit(0);
})().catch((e) => { console.error(e); process.exit(1); });
