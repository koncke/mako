// =============================================================================
// Qué sabe el puente de un cliente, sin pedirle una captura de pantalla
// =============================================================================
// EXISTE PORQUE ESTO FALTÓ Y COSTÓ CARO. El 05/09/2026, diagnosticar por qué el
// puente de un cliente no aprendía costó TRES rondas con el dueño y una auditoría
// de 191 agentes — sobre algo que este comando contesta en un segundo.
//
// La causa de fondo era que el dato no existía: todo lo que el navegador contaba de
// sí mismo viajaba adentro de un `if (estado === 'listo')` que en el Flow nuevo es
// falso siempre. Ahora el diagnóstico viaja fuera de todo gate y queda en
// `app_settings`. Esto lo lee.
//
//   npx tsx scripts/flow-diagnostico.ts            → todos los workspaces
//   npx tsx scripts/flow-diagnostico.ts --ws 1     → uno
//
// ⚠️ SOLO LEE. No escribe nada, no encola nada, y no toca la cuenta de Google de
// nadie.
import { config } from 'dotenv';
import { resolve } from 'node:path';

// El molde del repo: las credenciales viven en .env.local, no en .env.
config({ path: resolve(process.cwd(), '.env.local') });
import { runWithWorkspace } from '../lib/workspace';
import { getSetting } from '../lib/settings';
import { getSupabaseServer } from '../lib/supabase';
import {
  KEY_DIAGNOSTICO, sanearDiagnostico, resumenDiagnostico, type Diagnostico,
} from '../lib/flow-diagnostico';
import { OPERACIONES } from '../lib/flow-operaciones';

const arg = process.argv.indexOf('--ws');
const soloWs = arg >= 0 ? Number(process.argv[arg + 1]) : null;

function hace(ms: number): string {
  if (!ms) return 'nunca';
  const s = Math.round((Date.now() - ms) / 1000);
  if (s < 60) return `hace ${s} s`;
  if (s < 3600) return `hace ${Math.round(s / 60)} min`;
  if (s < 86400) return `hace ${Math.round(s / 3600)} h`;
  return `hace ${Math.round(s / 86400)} d`;
}

function pintar(ws: number, nombre: string, d: Diagnostico | null) {
  console.log('');
  console.log(`── ws ${ws} · ${nombre} ${'─'.repeat(Math.max(0, 50 - nombre.length))}`);
  if (!d) {
    // ⚠️ «No reportó» y «reportó que no sabe nada» son respuestas DISTINTAS, y la
    // diferencia es la mitad del diagnóstico. Un guion en vez de un cero.
    console.log('   sin diagnóstico — este navegador todavía no reportó, o corre una extensión anterior a la 0.53.0');
    return;
  }
  console.log(`   ${resumenDiagnostico(d)}`);
  console.log(`   último latido: ${hace(d.cuando)} · estado: ${d.estado || '—'}`);
  console.log(`   extensión ${d.manifest} · espejo de la pestaña ${d.espejo || '(anterior al versionado)'}`);
  if (d.espejo && d.espejo !== d.manifest) {
    console.log('   ⚠️  LA PESTAÑA CORRE UN ESPEJO VIEJO. Todo campo nuevo que el espejo');
    console.log('       aprenda a mandar NO llega hasta que la persona haga F5. Es la causa');
    console.log('       más cara que tuvo este puente y es invisible de cualquier otra forma.');
  }
  if (!d.espejo) {
    console.log('   ⚠️  El espejo no contesta su versión: es anterior al versionado (< 0.53.0),');
    console.log('       o sea que la pestaña quedó con una copia vieja. Hace falta F5.');
  }
  console.log(`   dominio: ${d.dominio || '—'} · en un proyecto: ${d.enProyecto ? 'sí' : 'no'}`);
  console.log(`   sabe (${d.ops.length}): ${d.ops.join(', ') || '—'}`);
  if (d.faltan.length) {
    const cuestan = d.faltan.filter((op) => OPERACIONES.find((o) => o.op === op)?.cuesta);
    console.log(`   falta (${d.faltan.length}): ${d.faltan.join(', ')}`);
    console.log(`      de esas, ${cuestan.length} necesitan una generación PAGADA: ${cuestan.join(', ') || '—'}`);
  }
  console.log(`   clases guardadas: ${d.clases.join(', ') || '—'}`);
}

async function main() {
  const db = getSupabaseServer();
  const { data, error } = await db.from('workspaces').select('id, nombre').order('id');
  if (error) {
    console.error('No pude listar los workspaces:', error.message);
    process.exit(1);
  }
  const wss = (data || []).filter((w) => soloWs == null || Number(w.id) === soloWs);
  if (!wss.length) {
    // Un cero sobre el universo equivocado se lee como un resultado. Se dice cuál fue.
    console.error(soloWs == null ? 'No hay workspaces.' : `No existe el workspace ${soloWs}.`);
    process.exit(1);
  }

  let conDato = 0;
  for (const w of wss) {
    const ws = Number(w.id);
    const crudo = await runWithWorkspace(ws, () => getSetting(KEY_DIAGNOSTICO));
    let d: Diagnostico | null = null;
    try { d = crudo ? sanearDiagnostico(JSON.parse(crudo)) : null; } catch { d = null; }
    if (d) conDato++;
    if (soloWs != null || d) pintar(ws, String(w.nombre || '—'), d);
  }
  console.log('');
  console.log(`${conDato} de ${wss.length} workspaces reportaron diagnóstico.`);
  if (!conDato) {
    console.log('Ninguno todavía: el diagnóstico lo manda la extensión desde la 0.53.0,');
    console.log('en cada latido (cada 15 s con la pestaña de Flow abierta).');
  }
}

void main();
