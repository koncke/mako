// =============================================================================
// vigia-mako-grupos — lee TODOS los grupos de MaKo en WhatsApp y devuelve los incidentes nuevos (SÓLO LECTURA)
// =============================================================================
// Uso (desde un worktree, con el .env.local del clon, que es PRODUCCIÓN — sólo lee):
//   NODE_OPTIONS=--conditions=react-server npx tsx scripts/vigia-mako-grupos.mts [--desde <ISO>] [--estado <archivo>] [--env <.env.local>]
//
// Para qué: el pedido de Martín del 17/10/2026 («que se esté vigilando y que se debugeen los errores en automático»).
// Lo corre cada 15 minutos la sesión de Claude que es dueña del doer (docs/relevo/mako-en-whatsapp.md); con incidentes
// nuevos, esa sesión busca la causa, arregla con su test y le pasa la punta al Cerebro.
//
// Qué lee, desde la última vuelta (la marca vive en `--estado`, por default ~/.claude/vigia-mako-grupos.json):
//   · `mako_doer_conv` de todos los workspaces (cada turno de cada grupo, mig 0086);
//   · `anthropic_usage`: los turnos del doer (`mako-doer-in`, para el modelo y la intención de cada incidente) y las
//     dos marcas de que algo salió mal, `cartel-ia` y `saneo-doer` (lib/mako-doer-in.ts);
//   · `workspaces`, para el nombre.
// Qué cuenta como incidente: lib/vigia-mako-grupos.ts (probado en tests/vigia-mako-grupos.test.ts).
//
// ⛔ NUNCA ESCRIBE en la base ni manda nada a nadie: no importa nada que envíe (ni lib/mako-grupo.ts ni lib/evolution.ts).
//    Lo único que escribe es el archivo de estado, local. Los `console.error` del doer viven en los logs de Vercel y no
//    se leen desde acá: lo que el doer deja en la base (`cartel-ia`, `saneo-doer`) es su versión leíble.
//
// Salida: sin incidentes nuevos, NADA (ni una línea) y código 0. Con incidentes, el informe en la salida y código 0;
// si no pudo leer, el error y código 2 (y la marca NO avanza: «no pude leer» no es «no hubo nada»).
// =============================================================================
import path from 'node:path';
import os from 'node:os';
import fs from 'node:fs';
import { pathToFileURL } from 'node:url';

const arg = (n: string): string | null => { const i = process.argv.indexOf(n); return i > 0 ? process.argv[i + 1] ?? null : null; };
const REPO = process.cwd();
const CLON_DEFAULT = 'C:/Users/marti/OneDrive/Escritorio/dashboard-marketing-main/dashboard-marketing/.env.local';
const ENV = arg('--env') ?? (fs.existsSync(path.join(REPO, '.env.local')) ? path.join(REPO, '.env.local') : CLON_DEFAULT);
const ESTADO = arg('--estado') ?? path.join(os.homedir(), '.claude', 'vigia-mako-grupos.json');
const imp = (rel: string) => import(pathToFileURL(path.join(REPO, rel)).href);
const dotenv = await import(pathToFileURL(path.join(REPO, 'node_modules', 'dotenv', 'lib', 'main.js')).href);
(dotenv.default ?? dotenv).config({ path: ENV, quiet: true });

const { getSupabaseServer } = await imp('lib/supabase.ts');
const { incidentesDe, lineaDe, ESPERA_RESPUESTA_MS } = await imp('lib/vigia-mako-grupos.ts');
type Incidente = import('../lib/vigia-mako-grupos').Incidente;

type Estado = { marca: string; vistos: string[] };
const leerEstado = (): Estado | null => { try { return JSON.parse(fs.readFileSync(ESTADO, 'utf8')) as Estado; } catch { return null; } };
const estado: Estado = leerEstado() ?? { marca: new Date(Date.now() - 60 * 60_000).toISOString(), vistos: [] };
const desde = arg('--desde') ?? estado.marca;
// Se relee un tramo ANTES de la marca: el mensaje que contestaba MaKo y el silencio que se cumple recién ahora. Lo ya
// contado lo descarta `vistos`.
const leerDesde = new Date(Date.parse(desde) - ESPERA_RESPUESTA_MS - 5 * 60_000).toISOString();
const ahora = Date.now();
const db = getSupabaseServer();

/** Lee todo, de a 1000 (PostgREST corta ahí sin avisar). */
async function todo<T>(tabla: string, sel: string, aplicar: (q: any) => any): Promise<T[]> {
  const out: T[] = [];
  for (let desdeFila = 0; ; desdeFila += 1000) {
    const { data, error } = await aplicar(db.from(tabla).select(sel)).order('created_at', { ascending: true }).order('id', { ascending: true }).range(desdeFila, desdeFila + 999);
    if (error) throw new Error(`${tabla}: ${error.message}`);
    out.push(...((data ?? []) as T[]));
    if (!data || data.length < 1000) return out;
  }
}

try {
  const conv = await todo<any>('mako_doer_conv', 'id, workspace_id, grupo_jid, role, content, created_at', (q) => q.gte('created_at', leerDesde));
  const usos = await todo<any>('anthropic_usage', 'id, workspace_id, created_at, feature, model, provider, motivo', (q) => q.gte('created_at', leerDesde).in('feature', ['mako-doer-in', 'cartel-ia', 'saneo-doer']));
  const nuevos: Incidente[] = (incidentesDe(conv, usos, ahora) as Incidente[]).filter((i) => !estado.vistos.includes(i.clave));

  // La marca avanza hasta lo último leído (o se queda), y lo contado se recuerda.
  const ultimo = [...conv, ...usos].map((f) => f.created_at as string).sort().pop();
  const marca = ultimo && ultimo > estado.marca ? ultimo : estado.marca;
  const vistos = [...estado.vistos, ...nuevos.map((i) => i.clave)].slice(-2000);
  fs.mkdirSync(path.dirname(ESTADO), { recursive: true });
  fs.writeFileSync(ESTADO, JSON.stringify({ marca, vistos }, null, 1));

  if (!nuevos.length) process.exit(0);

  const { data: wss } = await db.from('workspaces').select('id, nombre');
  const nombre = new Map<number, string>(((wss ?? []) as Array<{ id: number; nombre: string }>).map((w) => [w.id, w.nombre]));
  const nombreWs = (ws: number) => nombre.get(ws) ?? '?';
  // Para cada respuesta de MaKo, el modelo y la intención con que corrió: las filas del doer de ese ws entre el mensaje
  // de la persona y la respuesta. `recordUsage` corre sólo tras un 200: un proveedor que falló no deja fila, así que un
  // turno con sólo `flash-lite` es uno en que `flash` no contestó (lib/ai-cheap.ts, MODELOS_RESPALDO).
  const turnoDe = (i: Incidente): string => {
    if (i.grupo == null || i.tipos.includes('queja') || i.tipos.includes('sin-respuesta') || !i.antesAt) return '';
    const t = Date.parse(i.at);
    const t0 = Date.parse(i.antesAt) - 5000;
    const filas = usos.filter((u: any) => u.feature === 'mako-doer-in' && u.workspace_id === i.ws && Date.parse(u.created_at) <= t + 2000 && Date.parse(u.created_at) >= t0);
    return filas.length ? `\n    ⚙ ${filas.map((u: any) => `${u.model} · ${(u.motivo ?? '').slice(0, 110)}`).join('\n    ⚙ ')}` : '';
  };
  console.log(`VIGÍA de MaKo en WhatsApp — ${nuevos.length} incidente(s) nuevo(s) desde ${desde.slice(0, 16)} UTC`);
  for (const i of nuevos) console.log(`\n${lineaDe(i, nombreWs)}${turnoDe(i)}`);
} catch (e) {
  console.error(`VIGÍA: no pude leer (${e instanceof Error ? e.message : String(e)}). La marca no avanzó.`);
  process.exit(2);
}
