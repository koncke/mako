// =============================================================================
// medir-hilo-whatsapp — ¿cuántos mensajes de los grupos de MaKo seguían el hilo y el turno los leía solos? (SÓLO LECTURA)
// =============================================================================
// Uso, desde la raíz del repo:
//   node --env-file=<.env.local> --import tsx scripts/medir-hilo-whatsapp.mts [--dias 14] [--muestras 5]
//
// Lee `mako_doer_conv` (GET a PostgREST, nada más) de los últimos N días y, por cada mensaje de una persona, compara cómo
// lo lee el turno SOLO (lo de antes del 26/10/2026) y CON EL HILO (lib/doer-hilo.ts, `conElHilo`): cuántos caían en
// «capturar (dudosa)» siguiendo un pedido que MaKo ya había contestado, por negocio, y cuántos piden algo de más atrás de
// la ventana de 14 h («de vuelta», «lo de ayer», «lo que te pidió»). Las muestras salen cortadas a 60 caracteres y con
// los números tapados: no imprime conversaciones enteras ni teléfonos.
//
// ⚠️ ES LA MEDICIÓN QUE EL 26/10/2026 NO SE PUDO CORRER: el permiso «Production Reads» frenó la lectura desde el chat
// «MaKo en WhatsApp: conexiones». Lo corre quien tenga ese permiso (Martín, o un chat con la regla).
// =============================================================================

import { clasificarIntencion } from '../lib/mako-intencion';
import { conElHilo, partirMemoria, pedidoDelHilo, type FilaDelHilo } from '../lib/doer-hilo';

const arg = (n: string, def: string) => { const i = process.argv.indexOf(n); return i > 0 ? process.argv[i + 1] : def; };
const DIAS = Number(arg('--dias', '14'));
const MUESTRAS = Number(arg('--muestras', '5'));
const URL_ = process.env.NEXT_PUBLIC_SUPABASE_URL;
const KEY = process.env.SUPABASE_SERVICE_ROLE_KEY;
if (!URL_ || !KEY) { console.error('⛔ faltan NEXT_PUBLIC_SUPABASE_URL y SUPABASE_SERVICE_ROLE_KEY (--env-file)'); process.exit(1); }

type Fila = { workspace_id: number; grupo_jid: string; role: string; content: string; created_at: string };
async function leer(): Promise<Fila[]> {
  const desde = new Date(Date.now() - DIAS * 86_400_000).toISOString();
  const out: Fila[] = [];
  for (let de = 0; ; de += 1000) {
    const r = await fetch(`${URL_}/rest/v1/mako_doer_conv?select=workspace_id,grupo_jid,role,content,created_at&created_at=gte.${desde}&order=created_at.asc`, {
      method: 'GET', headers: { apikey: KEY!, Authorization: `Bearer ${KEY}`, Range: `${de}-${de + 999}` },
    });
    if (!r.ok) throw new Error(`mako_doer_conv: ${r.status} ${(await r.text()).slice(0, 200)}`);
    const filas = (await r.json()) as Fila[];
    out.push(...filas);
    if (filas.length < 1000) break;
  }
  return out;
}

const tapar = (s: string) => s.replace(/\+?\d[\d\s-]{6,}\d/g, '[número]').replace(/\s+/g, ' ').slice(0, 60);
const DE_MAS_ATRAS = /\b(de vuelta|otra vez|lo de ayer|lo que te ped[ií]|lo que te dije|como te dije|ya te dije|te acord[aá]s|lo del otro d[ií]a)\b/i;

const filas = await leer();
const grupos = new Map<string, Fila[]>();
for (const f of filas) { const k = `${f.workspace_id}|${f.grupo_jid}`; (grupos.get(k) ?? grupos.set(k, []).get(k)!).push(f); }
type Cuenta = { mensajes: number; seguimientos: number; caianSolos: number; masAtras: number; muestras: string[] };
const porWs = new Map<number, Cuenta>();
for (const [k, fs] of grupos) {
  const ws = Number(k.split('|')[0]);
  const c = porWs.get(ws) ?? { mensajes: 0, seguimientos: 0, caianSolos: 0, masAtras: 0, muestras: [] };
  porWs.set(ws, c);
  fs.forEach((f, i) => {
    if (f.role !== 'user') return;
    c.mensajes++;
    const previas: FilaDelHilo[] = fs.slice(0, i).reverse().map((x) => ({ role: x.role === 'assistant' ? 'assistant' : 'user', content: x.content, created_at: x.created_at }));
    const { reciente } = partirMemoria(previas, Date.parse(f.created_at));
    const ultimoDeMako = reciente.length && reciente[reciente.length - 1].role === 'assistant' ? reciente[reciente.length - 1].content : null;
    const solo = clasificarIntencion(f.content, {});
    const h = conElHilo(solo, f.content, pedidoDelHilo(reciente), ultimoDeMako);
    if (h.veredicto.sigueElHilo) {
      c.seguimientos++;
      if (solo.intencion === 'capturar' && solo.dudosa) c.caianSolos++;
      if (c.muestras.length < MUESTRAS) c.muestras.push(`«${tapar(f.content)}» → solo: ${solo.intencion}${solo.dudosa ? ' (dudosa)' : ''} · con el hilo: ${h.veredicto.intencion}`);
    }
    if (DE_MAS_ATRAS.test(f.content) && !reciente.length) c.masAtras++;
  });
}
console.log(`[medir-hilo-whatsapp] ${filas.length} filas de ${grupos.size} grupos, últimos ${DIAS} días`);
for (const [ws, c] of [...porWs].sort((a, b) => a[0] - b[0])) {
  console.log(`  ws${ws}: ${c.mensajes} mensajes · ${c.seguimientos} siguen el hilo (${c.caianSolos} caían en «sin señal clara») · ${c.masAtras} piden algo de más de 14 h`);
  for (const m of c.muestras) console.log(`      ${m}`);
}
