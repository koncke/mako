// =============================================================================
// linea-freno — si WhatsApp avisa que una línea está en riesgo, la línea FRENA SOLA y se avisa (4/11/2026)
// =============================================================================
// Martín, después del desbaneo: «si una línea recibe errores 403, o rate-overlimit, frená solo y avisá, en vez de seguir
// insistiendo». Antes, un «rate-overlimit» se leía como un error más y el siguiente envío salía igual (el 3/11, minutos antes del
// ban). Qué cuenta como señal y cuánto frena es puro: `senalDeRiesgo` en lib/mako-salida-reglas.ts.
//
// Vale para TODAS las líneas, las de MaKo y las de los clientes: lo llaman los dos fetch de Evolution (`evFetch` en
// lib/evolution.ts y `ev` en lib/mako-grupo.ts) y la salida del bot (lib/mako-salida.ts). Una escritura sobre una línea frenada no
// sale y devuelve el motivo; una lectura sigue andando. ⚠️ Salvo la respuesta al grupo donde una persona acaba de escribir (11/11/2026,
// Martín: «SIEMPRE debe responder»): ésa sale igual (`esRespuestaEnCurso`, lib/mako-salida-reglas.ts).
//
// El aviso va por la vía que ya existe y NUNCA por WhatsApp: el mail de las caídas (`avisarPorEmail`, lib/canal-vigilante.ts), al
// equipo de MaKo y a los destinatarios del negocio de esa línea. Una vez por freno: lo asegura el compare-and-set.
//
// ⚠️ Leer el freno no puede tumbar WhatsApp: si la base no contesta, NO frena (es una red, no la puerta). Escribirlo sí se intenta
// siempre que hubo señal.
// =============================================================================

import 'server-only';
import { cambiarSettingSi, getSetting } from './settings';
import { getSupabaseServer } from './supabase';
import { linkApp } from './app-url';
import { runWithWorkspace, wsSuperAdmin } from './workspace';
import { esEscritura, esRespuestaEnCurso, frenoSiguiente, frenoVigente, instanciaDeRuta, nuevoFreno, senalDeRiesgo, textoDelFreno, type Freno } from './mako-salida-reglas';
import { respondiendoA } from './respuesta-en-curso';
import { MOTIVO_ENVIO_EN_REVISION } from './cuenta-revision-reglas';
import { enRevision } from './revision-guarda';

export const keyFreno = (instancia: string): string => `linea.freno.${instancia}`;

/** Lo leído, por instancia, unos segundos: una tanda de envíos no le pregunta a la base por cada mensaje. */
const MEMO_MS = 20_000;
const memo = new Map<string, { at: number; raw: string | null }>();

async function leerCrudo(instancia: string): Promise<string | null> {
  const m = memo.get(instancia);
  if (m && Date.now() - m.at < MEMO_MS) return m.raw;
  const ws = await wsSuperAdmin();
  const raw = await runWithWorkspace(ws, () => getSetting(keyFreno(instancia)));
  memo.set(instancia, { at: Date.now(), raw });
  return raw;
}

/** El freno vigente de una línea, o null. Sin poder leerlo, null. */
export async function frenoDeLinea(instancia: string): Promise<Freno | null> {
  try { return frenoVigente(await leerCrudo(instancia)); } catch { return null; }
}

/**
 * Antes de una escritura: el motivo si la línea está frenada, o null para seguir. `destino` es a quién va (`destinoDeEscritura`):
 * la respuesta al grupo donde una persona acaba de escribir pasa aunque la línea esté frenada (`esRespuestaEnCurso`, 11/11/2026:
 * «SIEMPRE debe responder»). La cuenta de revisión de las tiendas, no: ésa no escribe nunca.
 */
export async function antesDeEscribir(ruta: string, destino?: string | null | (() => string | null)): Promise<string | null> {
  if (!esEscritura(ruta)) return null;
  // La cuenta de revisión de las tiendas no escribe por NINGUNA línea, la de MaKo incluida (4/11/2026). `enviarTexto` y compañía ya
  // lo preguntaban; esto cubre lo que sale por el `ev` de lib/mako-grupo.ts (la voz de MaKo, sumar a un grupo, una invitación).
  if (await enRevision()) return MOTIVO_ENVIO_EN_REVISION;
  const instancia = instanciaDeRuta(ruta);
  if (!instancia) return null;
  const f = await frenoDeLinea(instancia);
  if (!f) return null;
  // El destino se lee recién acá (puede ser una función): con la línea sin freno no se parsea el cuerpo, que en un archivo son MB.
  const a = typeof destino === 'function' ? destino() : destino;
  if (esRespuestaEnCurso(ruta, a, respondiendoA())) {
    console.warn(`[linea-freno] ${instancia} está frenada (${f.tipo}), pero esto es la respuesta a quien escribió en ${a}: sale`);
    return null;
  }
  return textoDelFreno(f);
}

/** De qué negocio es la línea: su fila; si no tiene (las de MaKo), la plataforma. */
async function wsDeLinea(instancia: string): Promise<number> {
  const { data } = await getSupabaseServer().from('evolution_instancias').select('workspace_id').eq('instance_name', instancia).maybeSingle();
  const ws = (data as { workspace_id?: number } | null)?.workspace_id;
  return typeof ws === 'number' ? ws : wsSuperAdmin();
}

/**
 * Después de una respuesta de Evolution: si fue una señal de riesgo, frena la línea y avisa UNA vez. Nunca tira: el envío ya
 * terminó, y esto no puede cambiar su resultado. Devuelve el freno nuevo, si lo puso.
 */
export async function trasEscribir(ruta: string, status: number, cuerpo: unknown): Promise<Freno | null> {
  const senal = senalDeRiesgo({ ruta, status, cuerpo });
  if (!senal) return null;
  const instancia = instanciaDeRuta(ruta);
  if (!instancia) return null;
  try {
    const plataforma = await wsSuperAdmin();
    const previo = await runWithWorkspace(plataforma, () => getSetting(keyFreno(instancia)));
    const f = nuevoFreno(senal, ruta);
    // Ya frenada: desde el 11/11 la respuesta sigue escribiendo con la línea frenada, así que puede llegar una señal MÁS grave (un 463
    // durante un freno de 30 min por «rate») o la misma otra vez. La que dura más reemplaza al freno; el mail sale sólo si cambió el
    // tipo (`frenoSiguiente`). Una que dura menos no toca nada.
    const paso = frenoSiguiente(frenoVigente(previo), f);
    if (!paso.guardar) return null;
    const gane = await runWithWorkspace(plataforma, () => cambiarSettingSi(keyFreno(instancia), previo, JSON.stringify(f)));
    memo.delete(instancia);
    if (!gane) return null;
    if (!paso.avisar) { console.warn(`[linea-freno] ${instancia} sigue frenada (${f.tipo}), ahora hasta ${f.hasta}`); return f; }
    console.error(`[linea-freno] ⛔ ${instancia} frenada (${f.tipo}) hasta ${f.hasta}: ${ruta.split('?')[0]} contestó ${status}`);
    const ws = await wsDeLinea(instancia).catch(() => plataforma);
    const { avisarPorEmail } = await import('./canal-vigilante');
    const link = linkApp(`/whatsapp?canal=no-oficial&linea=${encodeURIComponent(instancia)}`, ws);
    await avisarPorEmail(ws, `WhatsApp frenó la línea ${instancia}`, [
      textoDelFreno(f),
      '',
      'Qué hacer: no mandes nada desde esa línea hasta esa hora. Si vuelve a pasar, mira el teléfono: WhatsApp dice ahí si la cuenta quedó restringida.',
      '',
      `Línea: ${link}`,
    ].join('\n')).catch((e: unknown) => console.error(`[linea-freno] el aviso de ${instancia} no salió: ${e instanceof Error ? e.message : String(e)}`));
    return f;
  } catch (e) {
    console.error(`[linea-freno] no pude frenar ${instancia}: ${e instanceof Error ? e.message : String(e)}`);
    return null;
  }
}
