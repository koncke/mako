// =============================================================================
// scripts/decisiones.ts — publicar decisiones en el tablero de /admin/runway y leer las respuestas
// =============================================================================
// Lo usa el chat que junta las preguntas de todos los chats («Estrategia 3 cuentas»).
// Martín contesta en la Ticketera (/tickets/decisiones: el mazo; la lista en /tickets/decisiones/lista),
// en la compu o en el teléfono; este script es la otra punta. «Resuelta» llega como una respuesta más.
//
//   node --import tsx scripts/decisiones.ts publicar <archivo.json>   # una lista de decisiones
//   node --import tsx scripts/decisiones.ts contestadas [<ref>…]       # lo que contestó y el chat no levantó
//   node --import tsx scripts/decisiones.ts recoger <ref> [<ref>…]    # «ya la tengo»: deja de ser nueva
//   node --import tsx scripts/decisiones.ts retirar <ref> [<ref>…]    # ya no hace falta: sale del tablero
//   node --import tsx scripts/decisiones.ts listar                    # todo lo que hay, con su estado
//
// El formato de cada decisión (lo valida `sanearPublicada`, app/admin/runway/decisiones.ts):
//   { "ref": "image-ws-cliente", "chat": "Image Editor", "destino": "local_<uuid>", "pregunta": "¿…?",
//     "opciones": [{ "clave": "A", "texto": "Sí", "detalle": "lo que pasa si elige ésta, en una frase" }, { "clave": "B", "texto": "No" }],
//     "recomendada": "A", "destraba": "…", "contexto": "…",
//     "urgencia": "bloquea" | "cuesta" | "criterio" | "aviso", "href": "/plan/revisar/…", "orden": 10 }
//
// ⚠️ Si UNA decisión del archivo no valida, no se publica NINGUNA: el motivo de cada rechazo
// sale por pantalla. Publicar a medias deja un tablero que no es el que se armó.
// ⚠️ Republicar con el mismo `ref` actualiza la pregunta y la vuelve a mostrar, y NO toca la
// respuesta: si la pregunta cambió de sentido, se publica con otro ref.
// ⚠️ `destino` es el id de la SESIÓN que pregunta (el `from-session` de su mensaje): con él, el
// cartero del Centro le avisa sola la respuesta (lib/decisiones-aviso.ts). `chat` es sólo un
// nombre para la pantalla, y con el nombre no siempre se sabe a quién avisar. Republicar sin
// `destino` conserva el que ya tenía.
// ⚠️ Escribe en la base de PRODUCCIÓN (DATABASE_URL de .env.local), en una tabla sólo del super
// admin (mig 0277). `opciones` va como objeto (`sql.json`), nunca como texto: un JSON.stringify
// guarda un string adentro del jsonb (AGENTS.md, «el respaldo corrompió lo que venía a proteger»).

import postgres from 'postgres';
import { readFileSync } from 'node:fs';
import { resolve } from 'node:path';
import { config } from 'dotenv';
import { sanearPublicada, textoDeRespuesta, filaADecision, type Publicada } from '../app/admin/runway/decisiones';
import { explicarAviso, filaAviso } from '../lib/decisiones-aviso';
import { carteroVivo, sanearChats, todosLosChats, type VistaCartero } from '../lib/operaciones-reglas';

config({ path: resolve(process.cwd(), '.env.local') });
const conn = process.env.DATABASE_URL;
if (!conn) {
  console.error('Falta DATABASE_URL en .env.local');
  process.exit(1);
}

const [cmd, ...args] = process.argv.slice(2);
const sql = postgres(conn, { ssl: 'require', connect_timeout: 60, max: 1 });

async function publicar(archivo: string) {
  const crudo = JSON.parse(readFileSync(archivo, 'utf8').replace(/^﻿/, ''));
  const lista: unknown[] = Array.isArray(crudo) ? crudo : [crudo];
  const buenas: Publicada[] = [];
  const motivos: string[] = [];
  for (const x of lista) {
    const r = sanearPublicada(x);
    if (r.ok) buenas.push(r.d);
    else motivos.push(r.motivo);
  }
  const refs = buenas.map((b) => b.ref);
  const repetidas = refs.filter((r, i) => refs.indexOf(r) !== i);
  if (repetidas.length) motivos.push(`refs repetidas en el archivo: ${[...new Set(repetidas)].join(', ')}`);
  if (motivos.length) {
    console.error(`No se publicó nada. ${motivos.length} problema(s):`);
    for (const m of motivos) console.error(`  · ${m}`);
    process.exitCode = 1;
    return;
  }
  for (const d of buenas) {
    await sql`
      insert into admin_decisiones (ref, chat, destino, pregunta, opciones, destraba, contexto, recomendada, urgencia, href, orden)
      values (${d.ref}, ${d.chat}, ${d.destino}, ${d.pregunta}, ${sql.json(d.opciones)}, ${d.destraba}, ${d.contexto},
              ${d.recomendada}, ${d.urgencia}, ${d.href}, ${d.orden})
      on conflict (ref) do update set
        chat = excluded.chat, destino = coalesce(excluded.destino, admin_decisiones.destino),
        pregunta = excluded.pregunta, opciones = excluded.opciones,
        destraba = excluded.destraba, contexto = excluded.contexto, recomendada = excluded.recomendada,
        urgencia = excluded.urgencia, href = excluded.href, orden = excluded.orden, archivada_at = null`;
  }
  // Releída con el lector de la PANTALLA: una relectura con el mismo lector que escribió no ve
  // una capa de codificación de más.
  const filas = await sql`select * from admin_decisiones where ref = any(${refs})`;
  const malas = filas.map((f) => filaADecision(f)).filter((d) => !Array.isArray(d.opciones));
  console.log(`Publicadas ${filas.length} de ${buenas.length}.${malas.length ? ` ⚠ ${malas.length} con opciones ilegibles` : ''}`);
}

/** Los chats que ven los carteros, para decir en qué anda el aviso de cada respuesta. Si la tabla
 *  no se puede leer, se dice «sin cartero» (no se adivina que hay uno). */
async function vistaCarteros(): Promise<{ chats: ReturnType<typeof todosLosChats>; hayCartero: boolean }> {
  try {
    const k = await sql`select cuenta, visto_at, chats from operaciones_carteros`;
    const vistas: VistaCartero[] = k.map((x) => ({
      cuenta: String(x.cuenta), vistoAt: x.visto_at ? new Date(x.visto_at as string).toISOString() : null, chats: sanearChats(x.chats),
    }));
    return { chats: todosLosChats(vistas), hayCartero: vistas.some((v) => carteroVivo(v, Date.now())) };
  } catch {
    return { chats: [], hayCartero: false };
  }
}

async function contestadas(refs: string[]) {
  const filas = refs.length
    ? await sql`
        select * from admin_decisiones
        where ref = any(${refs}) and respuesta is not null and archivada_at is null
        order by respondida_at`
    : await sql`
        select * from admin_decisiones
        where respuesta is not null and recogida_at is null and archivada_at is null
        order by respondida_at`;
  if (!filas.length) { console.log(refs.length ? 'Ninguna de esas tiene respuesta.' : 'No hay respuestas nuevas.'); return; }
  const { chats, hayCartero } = await vistaCarteros();
  for (const f of filas) {
    const d = filaADecision(f);
    console.log(`[${d.ref}] ${d.chat} — ${d.pregunta}`);
    console.log(`  → ${textoDeRespuesta(d)}${d.respuesta !== 'otra' && d.respuestaTexto ? `  (nota: ${d.respuestaTexto})` : ''}`);
    console.log(`  contestada: ${d.respondidaAt}`);
    const fa = { ...filaAviso(f), avisoMotivo: d.avisoMotivo ?? null };
    console.log(`  aviso: ${explicarAviso(fa, chats, hayCartero, Date.now())}`);
  }
}

async function marcar(campo: 'recogida_at' | 'archivada_at', refs: string[]) {
  if (!refs.length) { console.error('Faltan los ref.'); process.exitCode = 1; return; }
  const r = campo === 'recogida_at'
    ? await sql`update admin_decisiones set recogida_at = now() where ref = any(${refs}) returning ref`
    : await sql`update admin_decisiones set archivada_at = now() where ref = any(${refs}) returning ref`;
  const hechas = new Set(r.map((x) => x.ref as string));
  const faltan = refs.filter((x) => !hechas.has(x));
  console.log(`${campo === 'recogida_at' ? 'Recogidas' : 'Retiradas'}: ${hechas.size}.${faltan.length ? ` No existen: ${faltan.join(', ')}` : ''}`);
}

async function listar() {
  const filas = await sql`select * from admin_decisiones where archivada_at is null order by urgencia, orden, id`;
  for (const f of filas) {
    const d = filaADecision(f);
    const estado = !d.respuesta ? 'pendiente' : d.recogidaAt ? 'recogida' : 'NUEVA';
    console.log(`${estado.padEnd(9)} ${d.urgencia.padEnd(8)} [${d.ref}] ${d.pregunta}${d.respuesta ? ` → ${textoDeRespuesta(d)}` : ''}`);
  }
  console.log(`${filas.length} en el tablero.`);
}

// Sin await de primer nivel: tsx corre los scripts como CommonJS y lo rechaza al transformar.
async function main() {
  try {
    if (cmd === 'publicar' && args[0]) await publicar(args[0]);
    else if (cmd === 'contestadas') await contestadas(args);
    else if (cmd === 'recoger') await marcar('recogida_at', args);
    else if (cmd === 'retirar') await marcar('archivada_at', args);
    else if (cmd === 'listar') await listar();
    else {
      console.error('Uso: publicar <archivo.json> | contestadas | recoger <ref>… | retirar <ref>… | listar');
      process.exitCode = 1;
    }
  } finally {
    await sql.end();
  }
}
void main();
