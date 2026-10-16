// =============================================================================
// reescribir-filas-plataforma — una fila de SuperAdmin que citaba frases del código pasa a su texto literal (16/10/2026)
// =============================================================================
// Martín (16/10): «hay casos peores donde el mensaje NO es igual, como el de Leila y el WhatsApp caido... esa automatización
// esta al pedo». La #253 «Se Cayó el WhatsApp de un Negocio» decía «🔴 *{{linea_titulo}}*… {{linea_motivo}}», y esas dos
// variables eran frases enteras escritas en el código. Desde el commit de esta tanda cada caso es su evento con su texto
// literal (lib/plantillas-automatizaciones.ts; docs/inventario-nada-por-detras.md, lote 1).
//
// Qué hace, por cada fila VIVA de la plataforma con el evento de la lista:
//   1. si su tarjeta MaKo dice EXACTAMENTE el texto viejo de la plantilla, la reescribe con la plantilla de hoy y le pone
//      su nombre nuevo (por la MISMA puerta que Publicar: `setSecuenciaPasos`, que valida);
//   2. si dice otra cosa, NO la toca: alguien la editó a mano, y pisarla sería borrarle el trabajo. Lo dice.
// ⚠️ VA DESPUÉS DEL DEPLOY del commit que suma `linea_fecha` y los dos eventos: con el código de antes, la variable no existe.
// ⚠️ ANTES DE ESCRIBIR guarda los pasos de antes en `--respaldo=<archivo>` (obligatorio con --aplicar), y vuelve a leer la
// fila justo antes del cambio: si cambió en el medio, no la toca.
//
//   node --conditions react-server --import tsx scripts/reescribir-filas-plataforma.mts --env=… → SIMULACRO (default)
//   … --aplicar --respaldo=<ruta.json>                                                           → escribe
// =============================================================================

import { config } from 'dotenv';
import { writeFileSync } from 'node:fs';

const arg = (n: string): string | null => {
  const a = process.argv.find((x) => x.startsWith(`--${n}=`));
  return a ? a.slice(n.length + 3) : null;
};
const aplicar = process.argv.includes('--aplicar');
const respaldo = arg('respaldo');
if (aplicar && !respaldo) throw new Error('--aplicar necesita --respaldo=<archivo.json>');
config({ path: arg('env') ?? '.env.local' });

/** Las filas a reescribir: su evento, la plantilla de hoy y el texto EXACTO que tenía la tarjeta de la plantilla de antes. */
const REESCRIBIR: ReadonlyArray<{ evento: string; plantilla: string; viejo: string }> = [
  { evento: 'whatsapp_caido', plantilla: 'mako-whatsapp-caido', viejo: '🔴 *{{linea_titulo}}*\n📱 {{linea_numero}}\n{{linea_motivo}} {{linea_link}} — MaKo' },
];

const { runWithWorkspace, getTenantDb, wsSuperAdmin } = await import('../lib/workspace');
const { plantillaPorId, pasosDePlantilla } = await import('../lib/plantillas-automatizaciones');
const { setSecuenciaPasos } = await import('../lib/nutricion');
const { renombrarSecuencia } = await import('../lib/setting-secuencias');
const { TRIGGER_AVISO_MAKO } = await import('../lib/disparadores');
const { eventoDeFila, frenoDelEvento } = await import('../lib/aviso-evento');
const { partesDeMako, textoDePartes } = await import('../lib/mako-tarjeta');
const { normalizar } = await import('../lib/flujo-grafo');

/** El texto de la ÚNICA tarjeta MaKo de la fila, o null si tiene otra forma (más tarjetas, ninguna). */
function textoDeLaTarjeta(pasos: unknown): string | null {
  const lista = Array.isArray(pasos) ? pasos as Array<{ accion?: { operacion?: string; params?: Record<string, unknown> } }> : [];
  const makos = lista.filter((p) => p.accion?.operacion === 'avisar_al_equipo');
  if (makos.length !== 1) return null;
  return textoDePartes(partesDeMako(makos[0].accion?.params));
}

for (const r of REESCRIBIR) {
  const p = plantillaPorId(r.plantilla);
  if (!p) throw new Error(`no existe la plantilla «${r.plantilla}»`);
  const freno = frenoDelEvento(normalizar(pasosDePlantilla(p)), r.evento);
  if (freno) throw new Error(`la plantilla de hoy «${r.plantilla}» no corre: ${freno.error}`);
}

const ws = await wsSuperAdmin();
console.log(`\n══ FILAS DE SUPERADMIN → TEXTO LITERAL (ws${ws}) — ${aplicar ? 'APLICANDO' : 'SIMULACRO'} ══`);
const antes: Array<{ id: number; nombre: string | null; pasos: unknown }> = [];
await runWithWorkspace(ws, async () => {
  const db = await getTenantDb();
  const leer = async () => {
    const { data, error } = await db.from('nutricion_secuencias').select('id, nombre, activa, pasos, trigger_tipo, disparadores')
      .eq('trigger_tipo', TRIGGER_AVISO_MAKO).is('archivada_at', null);
    if (error) throw new Error(`ws${ws}: ${error.message}`);
    return (data ?? []) as Array<{ id: number; nombre: string | null; activa: boolean | null; pasos: unknown; trigger_tipo: string; disparadores?: unknown }>;
  };
  const filas = await leer();
  for (const r of REESCRIBIR) {
    const suyas = filas.filter((f) => eventoDeFila(f) === r.evento);
    if (!suyas.length) { console.log(`  · ${r.evento}: ninguna fila viva (la crea scripts/mudanza-avisos-plataforma.mts)`); continue; }
    for (const f of suyas) {
      const texto = textoDeLaTarjeta(f.pasos);
      if (texto !== r.viejo) {
        console.log(`  · #${f.id} «${f.nombre}»: ${texto == null ? 'no tiene una sola tarjeta MaKo' : 'su texto no es el de la plantilla vieja'} → NO la toco (editada a mano)`);
        continue;
      }
      const nuevo = plantillaPorId(r.plantilla)!;
      console.log(`  · #${f.id} «${f.nombre}» → «${nuevo.nombre}», con el texto literal de hoy ${aplicar ? '' : '(simulacro)'}`);
      if (!aplicar) continue;
      antes.push({ id: f.id, nombre: f.nombre, pasos: f.pasos });
      writeFileSync(respaldo!, JSON.stringify(antes, null, 2));
      // Compare-and-set a mano: se vuelve a leer y tiene que decir lo mismo que se leyó.
      const ahora = (await leer()).find((x) => x.id === f.id);
      if (!ahora || JSON.stringify(ahora.pasos) !== JSON.stringify(f.pasos)) { console.log(`    ⚠️ #${f.id} cambió en el medio: no la toco`); continue; }
      await setSecuenciaPasos(f.id, pasosDePlantilla(nuevo) as never);
      await renombrarSecuencia(f.id, nuevo.nombre);
      console.log(`    ✓ reescrita (respaldo en ${respaldo})`);
    }
  }
});
