// =============================================================================
// Reconstruir el historial del onboarding de quien lo pasó ANTES de que se guardara (21/10/2026)
// =============================================================================
// Florencia (ws21) y todo negocio con 'onboarding.arranque' y SIN 'onboarding.historial': sus preguntas y respuestas del
// arranque se arman desde el estado, con `mensajesDeArranque` (los textos de HOY), y se guardan marcadas `reconstruido`
// (lib/onboarding-historial.ts). Es una VISTA: no toca el negocio (ni el nombre, ni el CRM, ni el producto).
//
// ⚠️ Correrlo ANTES del script que arregla el nombre del negocio del ws21: armado después, diría que contestó el nombre nuevo.
// ⚠️ Un negocio que ya tiene historial NO se toca (es el guardado de verdad, o una reconstrucción anterior): se puede volver
//    a correr después del deploy para cubrir a quien terminó en el medio.
//
//   node --conditions react-server --import tsx scripts/reconstruir-historial-onboarding.mts            (sólo lee)
//   node --conditions react-server --import tsx scripts/reconstruir-historial-onboarding.mts --aplicar  (escribe)
//   … --ws=21                                                                                        (uno solo)
// =============================================================================
import { config } from 'dotenv';
config({ path: '.env.local' });

const APLICAR = process.argv.includes('--aplicar');
const SOLO = Number(process.argv.find((a) => a.startsWith('--ws='))?.slice(5)) || null;

const { getSupabaseServer } = await import('../lib/supabase');
const { runWithWorkspace } = await import('../lib/workspace');
const { getSettingEstricto, cambiarSettingSi } = await import('../lib/settings');
const { hechosDelArranque } = await import('../lib/onboarding-arranque-server');
const { mensajesDeArranque } = await import('../lib/onboarding-arranque');
const { CLAVE_HISTORIAL, conLoNuevo, leerHistorial } = await import('../lib/onboarding-historial');

console.log(APLICAR ? '⚠️  APLICANDO' : 'Sólo lectura (sin --aplicar)');
const { data, error } = await getSupabaseServer().from('app_settings').select('workspace_id').eq('key', 'onboarding.arranque');
if (error) throw new Error(`No pude listar los onboardings: ${error.message}`);
const wss = [...new Set((data ?? []).map((r: { workspace_id: number }) => r.workspace_id))].filter((w) => !SOLO || w === SOLO).sort((a, b) => a - b);

const resumen: Array<Record<string, unknown>> = [];
for (const ws of wss) {
  await runWithWorkspace(ws, async () => {
    const fila = (que: string, extra: Record<string, unknown> = {}) => resumen.push({ ws, que, ...extra });
    const rawE = await getSettingEstricto('onboarding.arranque');
    const e = rawE ? JSON.parse(rawE) : {};
    if (!e.nombre && !e.sesionId) return fila('sin respuestas: nada que reconstruir');
    const raw = await getSettingEstricto(CLAVE_HISTORIAL);
    const previo = leerHistorial(raw);
    if (!previo) return fila(`⚠️ ${CLAVE_HISTORIAL} ilegible: no lo toco`);
    if (previo.length) return fila(`ya tiene historial (${previo.length}): no lo toco`);
    const h = await hechosDelArranque(e);
    if (h.sesionCaida || h.faseCaida) return fila('⚠️ no pude leer su conversación o su diagnóstico: no reconstruyo');
    const vista = mensajesDeArranque(e, h);
    const primero = Date.parse(h.sesion?.mensajes[0]?.at ?? '');
    // Lo de después de la conversación de Offer, justo antes de que se cerrara el onboarding (si terminó); si no, ahora.
    const cerrado = Date.parse(h.estadoOnboarding.completedAt ?? '');
    const ahora = h.terminado && Number.isFinite(cerrado) ? cerrado - 1_000 : Date.now();
    const nuevo = conLoNuevo([], vista, { ahora, primeroDeOffer: Number.isFinite(primero) ? primero : null, reconstruido: true });
    if (!nuevo) return fila('el arranque no dibuja nada');
    console.log(`\n── ws ${ws} · modo ${h.modo} · ${h.terminado ? 'terminado' : 'a mitad'} · ${nuevo.length} mensajes ──`);
    for (const m of nuevo) console.log(`  ${m.at}  ${m.de === 'mako' ? 'MaKo' : 'yo  '}  ${m.texto.replace(/\s+/g, ' ').slice(0, 110)}`);
    if (!APLICAR) return fila('se reconstruiría', { mensajes: nuevo.length, modo: h.modo, terminado: h.terminado });
    const gano = await cambiarSettingSi(CLAVE_HISTORIAL, raw, JSON.stringify({ mensajes: nuevo }));
    fila(gano ? '✅ reconstruido' : '⚠️ cambió mientras lo armaba: no lo toqué', { mensajes: nuevo.length, modo: h.modo, terminado: h.terminado });
  });
}
console.log('');
console.table(resumen);
if (!APLICAR) console.log('Nada escrito. Para guardarlo: --aplicar.');
