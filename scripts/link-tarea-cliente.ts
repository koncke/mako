// =============================================================================
// link-tarea-cliente — el link personal con el que un cliente contesta su tarea
// =============================================================================
//   NODE_OPTIONS="--conditions=react-server" npx tsx scripts/link-tarea-cliente.ts
//     (sin flags)        → lista la cartera y en qué va cada uno
//     --lead 28          → crea el link de ese cliente y lo muestra
//     --lead 28 --rotar  → revoca el anterior y emite uno nuevo
//     --todos            → un link para cada cliente ganado que no tenga
//
// ⚠️ EL LINK SE MUESTRA UNA SOLA VEZ. De la base solo se guarda su sha256, así
// que no hay forma de volver a leerlo: si se pierde, se rota. Es a propósito
// (`lib/shares.ts`, regla 1) — un dump de la base no entrega los links vivos.
//
// El share va con `permiso: 'editar'` y `alcance: 'item'` apuntando al lead. Eso
// es lo único que autoriza a escribir, y `puedeEditar()` lo revalida en CADA
// request contra la fila viva: revocar corta al instante.
// =============================================================================

import { config } from 'dotenv';
import { resolve } from 'node:path';
config({ path: resolve(process.cwd(), '.env.local') });

import { crearShare, listarShares, revocarShare } from '../lib/shares';
import { getTenantDb, runWithWorkspace } from '../lib/workspace';
import { bloquesDeCliente } from '../lib/cs-respuestas';
import { TOTAL_CLASES, rotuloDe } from '../lib/programa-catalogo';
import { APP_BASE_URL } from '../lib/app-url';

const WS = 1;
const RECURSO = 'tarea-cs';

const arg = (n: string): string | null => {
  const i = process.argv.indexOf(n);
  return i >= 0 ? (process.argv[i + 1] ?? '') : null;
};
const LEAD = arg('--lead');
const TODOS = process.argv.includes('--todos');
const ROTAR = process.argv.includes('--rotar');

type Cliente = { id: number; nombre: string; email: string | null };

async function cartera(): Promise<Cliente[]> {
  const db = await getTenantDb();
  const { data } = await db.from('leads')
    .select('id, nombre, email').eq('estado_lead', 'ganado').order('id');
  return (data as Cliente[] | null) ?? [];
}

/** Los shares VIVOS de tarea de este lead. Se mira para no emitir dos links por
 *  cliente sin querer: dos links vivos son dos formas de entrar y una sola que
 *  alguien se acuerde de revocar. */
async function sharesDe(leadId: number) {
  const todos = await listarShares(WS, RECURSO);
  return todos.filter(s =>
    String((s as { recurso_id?: unknown }).recurso_id) === String(leadId) &&
    !(s as { revocado_at?: string | null }).revocado_at);
}

async function estado(leadId: number): Promise<string> {
  const filas = await bloquesDeCliente(leadId).catch(() => []);
  if (!filas.length) return `sin empezar (0 de ${TOTAL_CLASES})`;
  const vistos = filas.filter(f => f.visto_at).length;
  const contestados = filas.filter(f => f.estado !== 'pendiente').length;
  const esperando = filas.filter(f => f.estado === 'revisada_ia').length;
  const aprobados = filas.filter(f => f.estado === 'aprobada').length;
  const partes = [`${contestados} contestados`, `${aprobados} aprobados`];
  if (vistos) partes.push(`${vistos} vistos en Whop`);
  if (esperando) partes.push(`⚠️ ${esperando} esperando SU ok`);
  return partes.join(' · ');
}

async function emitir(c: Cliente): Promise<void> {
  const vivos = await sharesDe(c.id);
  if (vivos.length && !ROTAR) {
    console.log(`  ${c.nombre} (#${c.id}) → ya tiene ${vivos.length} link(s) vivo(s). El token no se puede volver a leer.`);
    console.log('     Para emitir uno nuevo y revocar el anterior: --rotar');
    return;
  }
  for (const s of vivos) {
    await revocarShare(WS, (s as { id: number }).id);
    console.log(`  ↺ revocado el link anterior (#${(s as { id: number }).id})`);
  }
  const { token } = await crearShare({
    ws: WS, recurso: RECURSO, alcance: 'item', recursoId: String(c.id),
    modo: 'link', permiso: 'editar',
    etiqueta: `Tarea del programa — ${c.nombre}`,
    creadoPor: 'scripts/link-tarea-cliente',
  });
  console.log(`\n  ${c.nombre} (#${c.id})${c.email ? ` · ${c.email}` : ''}`);
  console.log(`  ${APP_BASE_URL}/compartido/${token}`);
  console.log('  ⚠️ copialo ahora: no se puede volver a ver.\n');
}

async function main() {
  const clientes = await cartera();

  if (LEAD) {
    const c = clientes.find(x => String(x.id) === LEAD);
    if (!c) { console.error(`\n  ✖ el lead ${LEAD} no está entre los ganados de ws1.\n`); process.exit(1); }
    await emitir(c);
    return;
  }

  if (TODOS) {
    console.log(`\nEmitiendo links para ${clientes.length} cliente(s)…\n`);
    for (const c of clientes) await emitir(c);
    return;
  }

  console.log(`\nLa cartera de Mauricio: ${clientes.length} cliente(s) ganado(s).`);
  console.log(`El programa tiene ${TOTAL_CLASES} bloques. El primero es «${rotuloDe('m0c1')}».\n`);
  for (const c of clientes) {
    const vivos = await sharesDe(c.id);
    console.log(`  #${String(c.id).padStart(3)}  ${c.nombre.padEnd(38).slice(0, 38)}  ${vivos.length ? '🔗' : '  '}  ${await estado(c.id)}`);
  }
  console.log('\n  🔗 = ya tiene link emitido');
  console.log('\n  Para emitir uno:  --lead <id>     ·  para todos: --todos\n');
}

runWithWorkspace(WS, main).catch((e) => { console.error(e); process.exit(1); });
