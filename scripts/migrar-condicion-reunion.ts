// =============================================================================
// «Su reunión sigue en pie» VISIBLE delante de lo que la guarda escondida cuidaba (14/10/2026, §2.3)
// =============================================================================
// Hasta el 14/10, antes de mandar CUALQUIER mensaje o ⚡ Acción de un flujo que «prepara una reunión»
// (`preparaReunion`: CRON en una etapa de tipo reunión, la familia `agendado_*` o un DELAY «antes de la reunión»), el
// motor cerraba la inscripción si «la reunión ya pasó» (lib/nutricion.ts, `laReunionYaPaso`), sin que eso estuviera en
// el lienzo. Martín: «Debería justamente existir una CONDITION en el flujo... jamás que "mako" haga cosas que no están
// en el flujo». Este script le pone la condición VISIBLE a cada mensaje y acción de esos flujos que hoy sale sin mirar
// la reunión (`miraLaReunion`, lib/flujo-forma.ts):
//   · si arriba hay una CONDICIÓN, se suma «Su reunión sigue en pie» a la rama que lleva ahí (dos condiciones seguidas
//     no se pueden guardar); el «Si no» que llevaba ahí pasa a ser una rama más con esa fila;
//   · si no, se inserta una condición nueva en la flecha (`insertarNodo`), con «Si no» terminando.
// No toca el carril (lo que cuelga de un DELAY «antes de la reunión»: lo decide su DELAY) ni lo de «Si responde». Y
// sólo migra las PRENDIDAS (ver `main`).
//
// ⚠️ VA DESPUÉS del deploy del código que conoce la condición (`reunion_en_pie`, `5c…`) y ANTES del que borra la
// guarda: con el código de antes, una fila con esa condición no se cumple y el camino se cortaría.
//
//   ENV_FILE=/ruta/.env.local node --import tsx scripts/migrar-condicion-reunion.ts            (dry run)
//   ENV_FILE=/ruta/.env.local node --import tsx scripts/migrar-condicion-reunion.ts --apply
// =============================================================================
import { config } from 'dotenv';
import { resolve } from 'node:path';
config({ path: process.env.ENV_FILE ?? resolve(process.cwd(), '.env.local') });
import postgres from 'postgres';
import {
  normalizar, padresDe, claseDe, idDe, indicePorId, insertarNodo, nuevoId, gruposDeRama, validarGrafo, leerPuertoParalelo, raicesSalida,
  type PasoGrafo, type RamaCondicion, type FilaCondicion,
} from '../lib/flujo-grafo';
import { preparaReunion } from '../lib/nutricion-familias';
import { miraLaReunion, problemasDeForma } from '../lib/flujo-forma';
import { minutosAntesDeReunion, RELLENO_CONTROL } from '../lib/nutricion-grafo-motor';
import { subarbolRespuesta } from '../lib/flujo-conversacion';

const APLICAR = process.argv.includes('--apply');
const EN_PIE: FilaCondicion = { campo: 'reunion_en_pie' };

/** La rama con «Su reunión sigue en pie» en CADA grupo (un «o» separa grupos: la fila va en todos). */
function conEnPie(r: RamaCondicion): RamaCondicion {
  const grupos = gruposDeRama(r);
  const filas: FilaCondicion[] = [];
  grupos.forEach((g, k) => {
    g.forEach((f, j) => filas.push({ ...f, union: j === 0 ? (k === 0 ? f.union : 'o') : 'y' }));
    if (!g.some((f) => f.campo === 'reunion_en_pie' && !f.no)) filas.push({ ...EN_PIE, union: 'y' });
  });
  return { ...r, filas, modo: 'todas' };
}

/** El primer mensaje o acción de la salida que sale sin mirar la reunión (fuera del carril y de «Si responde»). */
function pendiente(pasos: readonly PasoGrafo[]): { id: string } | null {
  const resp = subarbolRespuesta(pasos);
  for (let i = 0; i < pasos.length; i++) {
    const p = pasos[i];
    const c = claseDe(p);
    if (c !== 'mensaje' && c !== 'accion') continue;
    const id = idDe(p, i);
    // Una suelta (sin padre y que no es una raíz del CRON) no sale nunca: no se toca.
    if (resp.has(id) || minutosAntesDeReunion(pasos, i) != null || (!padresDe(pasos, id).length && !raicesSalida(pasos).includes(id))) continue;
    if (!miraLaReunion(pasos, id)) return { id };
  }
  return null;
}

function migrar(crudos: unknown): { pasos: PasoGrafo[] | null; cambios: string[]; errores: string[] } {
  if (!Array.isArray(crudos) || !crudos.length) return { pasos: null, cambios: [], errores: [] };
  let pasos = normalizar(crudos as PasoGrafo[]);
  const cambios: string[] = [];
  for (let vuelta = 0; vuelta < 30; vuelta++) {
    const x = pendiente(pasos);
    if (!x) break;
    const padres = padresDe(pasos, x.id);
    if (!padres.length) {
      // La primera tarjeta, sin tarjeta CRON en el dato: la condición va al principio de la salida.
      const id = nuevoId(pasos);
      const cond = { ...RELLENO_CONTROL, id, nodo: 'condicion', ramas: [{ id: `${id}r0`, siguiente: null, filas: [EN_PIE], modo: 'todas' }], si_no: null } as unknown as PasoGrafo;
      pasos = insertarNodo(pasos, { inicio: true }, cond);
      cambios.push(`condición nueva ${id} «Su reunión sigue en pie» al principio, antes de ${x.id}`);
      continue;
    }
    const pa = padres.find((q) => !miraLaReunion(pasos, q.id) || claseDe(pasos[indicePorId(pasos, q.id)]) === 'condicion') ?? padres[0];
    const iP = indicePorId(pasos, pa.id);
    const P = pasos[iP];
    if (claseDe(P) === 'condicion') {
      const resultado = pa.puerto.startsWith('par') ? leerPuertoParalelo(pa.puerto)?.resultado ?? null : pa.puerto;
      if (resultado === 'si_no') {
        const rid = `${idDe(P, iP)}r${(P.ramas ?? []).length}`;
        const rama: RamaCondicion = { id: rid, siguiente: P.si_no ?? null, filas: [EN_PIE], modo: 'todas', ...(P.paralelos_si_no?.length ? { paralelos: [...P.paralelos_si_no] } : {}) };
        pasos = pasos.map((q, k) => (k === iP ? (({ paralelos_si_no: _p, ...resto }) => ({ ...resto, ramas: [...(q.ramas ?? []), rama], si_no: null }))(q) : q)) as PasoGrafo[];
        cambios.push(`«Si no» de ${idDe(P, iP)} → rama nueva «Su reunión sigue en pie» hacia ${x.id}`);
      } else {
        pasos = pasos.map((q, k) => (k === iP ? { ...q, ramas: (q.ramas ?? []).map((r) => (r.id === resultado ? conEnPie(r) : r)) } : q));
        cambios.push(`rama ${resultado} de ${idDe(P, iP)} + «Su reunión sigue en pie» (lleva a ${x.id})`);
      }
    } else {
      const id = nuevoId(pasos);
      const cond = { ...RELLENO_CONTROL, id, nodo: 'condicion', ramas: [{ id: `${id}r0`, siguiente: null, filas: [EN_PIE], modo: 'todas' }], si_no: null } as unknown as PasoGrafo;
      const antes = pasos.length;
      pasos = insertarNodo(pasos, { nodo: pa.id, puerto: pa.puerto }, cond);
      if (pasos.length === antes) return { pasos: null, cambios, errores: [`no pude insertar la condición entre ${pa.id} y ${x.id}`] };
      cambios.push(`condición nueva ${id} «Su reunión sigue en pie» entre ${pa.id} y ${x.id}`);
    }
  }
  const quedan = pendiente(pasos);
  const errores = [...validarGrafo(pasos), ...(quedan ? [`${quedan.id} sigue sin mirar la reunión`] : [])];
  return { pasos: cambios.length ? pasos : null, cambios, errores };
}

async function main(): Promise<void> {
  const sql = postgres(process.env.DATABASE_URL!, { ssl: 'require', max: 1 });
  const filas = await sql<Array<{ id: number; workspace_id: number; nombre: string; activa: boolean; trigger_tipo: string; etapa: string | null; etapas: unknown; disparadores: unknown; pasos: unknown; pasos_borrador: unknown }>>`
    select id, workspace_id, nombre, activa, trigger_tipo, etapa, etapas, disparadores, pasos, pasos_borrador
    from nutricion_secuencias where archivada_at is null order by workspace_id, id`;
  let cambian = 0;
  for (const f of filas) {
    const pasos = Array.isArray(f.pasos) ? (f.pasos as PasoGrafo[]) : [];
    const sec = { trigger_tipo: f.trigger_tipo, etapa: f.etapa, etapas: (f.etapas as unknown[] | null) ?? null, disparadores: (f.disparadores as never) ?? null, pasos };
    if (!preparaReunion(sec as never)) continue;
    // SÓLO LAS PRENDIDAS: una apagada no manda nada, y al prenderla hace lo que dice su lienzo. La #249 del ws11
    // («Seguimiento a leads que no cierran», CRON en «No compró», «Agenda» y «Facturando») muestra por qué: la guarda
    // escondida le cortaba el seguimiento de DESPUÉS de la reunión, que es para lo que existe. Se dice y se deja.
    if (!f.activa) { console.log(`ws${f.workspace_id} #${f.id} «${f.nombre}»: apagada, NO se migra (al prenderla, hace lo que dice su lienzo)`); continue; }
    const pub = migrar(f.pasos);
    const bor = migrar(f.pasos_borrador);
    const nombre = `ws${f.workspace_id} #${f.id} «${f.nombre}»${f.activa ? ' (PRENDIDA)' : ''}`;
    if (pub.errores.length || bor.errores.length) { console.log(`${nombre}: ✗ NO SE MIGRA: ${[...pub.errores, ...bor.errores].join(' · ')}`); continue; }
    if (!pub.pasos && !bor.pasos) { console.log(`${nombre}: ya mira la reunión en todo`); continue; }
    cambian += 1;
    console.log(`${nombre}:`);
    for (const c of pub.cambios) console.log(`    · ${c}`);
    const forma = pub.pasos ? problemasDeForma(pub.pasos, (f.disparadores as never) ?? []) : [];
    if (forma.length) console.log(`    ⚠ forma: ${forma.map((p) => `${p.regla}${p.tarjeta ? `@${p.tarjeta}` : ''}`).join(', ')}`);
    if (!APLICAR) continue;
    if (pub.pasos) await sql`update nutricion_secuencias set pasos = ${sql.json(pub.pasos as never)} where id = ${f.id}`;
    if (bor.pasos) await sql`update nutricion_secuencias set pasos_borrador = ${sql.json(bor.pasos as never)} where id = ${f.id}`;
  }
  console.log(APLICAR ? `\n✓ ${cambian} migrada(s)` : `\n(dry run: ${cambian} cambiarían. Repetí con --apply)`);
  await sql.end();
}

main().catch((e) => { console.error(e); process.exit(1); });
