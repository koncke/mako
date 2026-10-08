// =============================================================================
// borrador-oficial — el camino de salida del borrador por el canal OFICIAL
// =============================================================================
// MEDIDO el 05/10/2026: el panel de borradores existía y funcionaba, pero su
// único envío era `enviarBorrador` (lib/evolution-envio.ts), que sale por
// Evolution. En un workspace que solo tiene el WhatsApp OFICIAL el borrador era
// INERTE: MaKo lo redactaba, la pantalla lo mostraba y no había por dónde
// mandarlo. Peor: el panel vive en EmpresaInbox, que no se renderiza sin
// Evolution conectado — el borrador ni se veía.
//
// Acá vive la decisión de POR DÓNDE sale cada borrador, y la decisión la toma
// el SERVIDOR: el cliente nunca elige canal ni calcula la ventana.
//
//   · El NO OFICIAL gana cuando está vivo. El borrador nació para ese número
//     (regla anti-ban del PDF: a leads calientes no se les manda automático por
//     el no oficial) y el hilo del lead está ahí. 'conectando' cuenta como vivo:
//     quitarle el botón a un número que está re-vinculando es sacarle una
//     función que en un minuto vuelve.
//   · Si no hay no oficial vivo, sale por el OFICIAL (Chatwoot/WABA) — pero
//     SOLO dentro de la ventana de 24 h de Meta. Fuera de la ventana no se
//     intenta: el gate lo decide lib/ventana-24h.ts y el botón no se dibuja.
//   · Si no hay ninguno, el camino es `null` con el motivo en una frase, que es
//     lo que la pantalla muestra en lugar del botón.
//
// ⚠️ EL CAMINO OFICIAL NO ESPEJA EN `wa_mensajes`. Esa tabla es el espejo del
// NO oficial y es lo que pinta EmpresaInbox: una fila ahí sería un mensaje
// fantasma en el inbox del número de empresa. Lo que sale por Chatwoot ya se
// lee del propio Chatwoot (/api/whatsapp/contacts/[id]/messages).
// =============================================================================

import 'server-only';
import { getTenantDb } from '@/lib/workspace';
import { listConversations, contactoIdPorTelefono, sendToContact } from '@/lib/chatwoot';
import { integracionConectada } from '@/lib/credenciales';
import { listarLineas } from '@/lib/evolution';
import { lineaPorDefault } from '@/lib/lineas-whatsapp';
import { enviarBorrador, anotarPasoEnviado } from '@/lib/evolution-envio';
import { MOTIVO_FUERA_DE_VENTANA, venceVentana24h, ventanaAbierta24h } from '@/lib/ventana-24h';

/** Últimos 10 dígitos: la MISMA clave con que agrupa por persona el inbox oficial. */
const ult10 = (tel: string | null | undefined): string => (tel || '').replace(/\D/g, '').slice(-10);

export type ViaBorrador = 'empresa' | 'oficial';

/**
 * Por dónde puede salir un borrador. `via: null` = no puede salir, y `motivo`
 * es la frase que la pantalla dibuja EN LUGAR del botón.
 */
export type CaminoBorrador = {
  via: ViaBorrador | null;
  motivo: string | null;
  /** Vencimiento de la ventana de 24 h, epoch en SEGUNDOS. Solo en el oficial. */
  venceAt: number | null;
};

/**
 * El camino de un borrador para el que `caminosDeEnvio` no devolvió entrada.
 * No puede pasar (devuelve una por id recibido) y existe igual: un hueco se
 * leería como «todavía no sé» y dejaría el botón en «Comprobando…» para
 * siempre, que es un control muerto.
 */
export const CAMINO_INDETERMINADO: CaminoBorrador = { via: null, motivo: 'No se pudo determinar por dónde mandarlo.', venceAt: null };

const POR_EMPRESA: CaminoBorrador = { via: 'empresa', motivo: null, venceAt: null };
const SIN_CANAL: CaminoBorrador = { via: null, motivo: 'No hay ningún WhatsApp conectado para mandarlo.', venceAt: null };
const SIN_LECTURA: CaminoBorrador = { via: null, motivo: 'No se pudo leer el estado del WhatsApp oficial.', venceAt: null };
const LINEA_CAIDA: CaminoBorrador = { via: null, motivo: 'El número de este borrador está desconectado.', venceAt: null };
const LINEA_IDA: CaminoBorrador = { via: null, motivo: 'El número de este borrador ya no está vinculado.', venceAt: null };
const FUERA_DE_VENTANA: CaminoBorrador = { via: null, motivo: MOTIVO_FUERA_DE_VENTANA, venceAt: null };
const AUDIO_SOLO_EMPRESA: CaminoBorrador = { via: null, motivo: 'La nota de voz sale sólo por tu número de empresa.', venceAt: null };
const ARCHIVO_SOLO_EMPRESA: CaminoBorrador = { via: null, motivo: 'El archivo sale sólo por tu número de empresa.', venceAt: null };

/** Lo que el borrador lleva además del texto (mig 0223). Con algo de esto, el oficial no tiene camino. */
type MediaDelBorrador = { audioId?: number | null; adjuntoId?: number | null };

/**
 * ⚠️ UN BORRADOR CON NOTA DE VOZ O CON ARCHIVO NO TIENE CAMINO OFICIAL (revisión del 08/10/2026).
 * El oficial manda TEXTO (`sendToContact`), y el borrador de un paso de audio o de archivo guarda
 * el PIE en `texto` y el audio o el archivo aparte: aprobado por el oficial, al lead le llegaba
 * sólo el pie («te dejo el link abajo 👇»), el borrador quedaba 'enviado', el paso se anotaba
 * como salido y el audio no salía nunca. Es lo que lib/evolution-envio.ts dice evitar («NO sale
 * el pie solo como si fuera el mensaje»). `null` = no lleva nada aparte.
 */
function sinCaminoOficial(b: MediaDelBorrador): CaminoBorrador | null {
  if (Number(b.audioId) > 0) return AUDIO_SOLO_EMPRESA;
  if (Number(b.adjuntoId) > 0) return ARCHIVO_SOLO_EMPRESA;
  return null;
}

type VentanaPersona = { abierta: boolean; venceAt: number | null };

/**
 * La ventana de 24 h por PERSONA (últimos 10 dígitos), leída de la bandeja
 * oficial en UNA sola llamada para todos los borradores juntos.
 *
 * Chatwoot abre una conversación por interacción, así que una persona puede
 * tener varias: basta UNA abierta para poder escribirle (mismo criterio que el
 * `prev.ventanaAbierta || c.puedeResponder` de /api/whatsapp/conversations).
 */
async function ventanasOficiales(paginas = 12): Promise<Map<string, VentanaPersona>> {
  const convs = await listConversations(paginas);
  const porPersona = new Map<string, VentanaPersona>();
  for (const c of convs) {
    const d = ult10(c.telefono);
    if (d.length < 10) continue; // sin teléfono completo no hay a quién mandarle
    const abierta = ventanaAbierta24h({ puedeResponder: c.puedeResponder, ultimaActividadSeg: c.ultimaActividad });
    const venceAt = abierta ? venceVentana24h(c.ultimaActividad) : null;
    const prev = porPersona.get(d);
    if (!prev) { porPersona.set(d, { abierta, venceAt }); continue; }
    prev.abierta = prev.abierta || abierta;
    if (venceAt != null && (prev.venceAt == null || venceAt > prev.venceAt)) prev.venceAt = venceAt;
  }
  return porPersona;
}

/**
 * El camino de CADA borrador, en un solo viaje. Devuelve una entrada por id
 * recibido (nunca un hueco: un borrador sin entrada dibujaría un botón sin
 * gate). Pasar la lista completa es lo que evita una llamada a Chatwoot por
 * borrador.
 */
export async function caminosDeEnvio(
  borradores: Array<{ id: number; telefono: string | null; linea?: string | null } & MediaDelBorrador>,
): Promise<Map<number, CaminoBorrador>> {
  const out = new Map<number, CaminoBorrador>();
  if (!borradores.length) return out;

  // ⚠️ CADA BORRADOR CON SU LÍNEA (06/10/2026, varios números por negocio). Se decidía con la
  // línea por default para todos: un borrador de la línea 2 conectada se mandaba por el OFICIAL
  // porque la 1 estaba caída. Un borrador que NOMBRA su línea sale por ella o no sale — nunca
  // por el oficial ni por otra: el lead venía hablando con ESE número.
  const lineas = await listarLineas().catch(() => null);
  const viva = (estado: string | null | undefined) => estado === 'conectado' || estado === 'conectando';
  const def = lineas ? lineaPorDefault(lineas) : null;
  const sinLinea: typeof borradores = [];
  for (const b of borradores) {
    if (b.linea) {
      const fila = lineas?.find((l) => l.instance_name === b.linea);
      out.set(b.id, fila ? (viva(fila.estado) ? POR_EMPRESA : LINEA_CAIDA) : (lineas ? LINEA_IDA : CAMINO_INDETERMINADO));
    } else if (def && viva(def.estado)) {
      out.set(b.id, POR_EMPRESA);
    } else {
      // Sin el número de empresa vivo, lo que queda es el OFICIAL: un audio o un archivo ahí no.
      const sinOficial = sinCaminoOficial(b);
      if (sinOficial) out.set(b.id, sinOficial);
      else sinLinea.push(b);
    }
  }
  if (!sinLinea.length) return out;
  borradores = sinLinea;

  if (!(await integracionConectada('whatsapp').catch(() => false))) {
    for (const b of borradores) out.set(b.id, SIN_CANAL);
    return out;
  }

  let ventanas: Map<string, VentanaPersona>;
  try {
    ventanas = await ventanasOficiales();
  } catch (e) {
    // Chatwoot caído no es «ventana cerrada»: es «no sé». Fail-closed igual —
    // pero con su propio motivo, para que nadie lea «vencida» sobre una ventana
    // que puede estar abierta.
    console.warn(`[borrador-oficial] no pude leer la bandeja oficial: ${e instanceof Error ? e.message : String(e)}`);
    for (const b of borradores) out.set(b.id, SIN_LECTURA);
    return out;
  }

  for (const b of borradores) {
    const v = ventanas.get(ult10(b.telefono));
    out.set(b.id, v?.abierta ? { via: 'oficial', motivo: null, venceAt: v.venceAt } : FUERA_DE_VENTANA);
  }
  return out;
}

type BorradorFila = {
  id: number; telefono: string | null; texto: string | null; estado: string; instance_name: string | null;
  audio_id: number | null; adjunto_id: number | null;
};

async function leerBorrador(id: number): Promise<BorradorFila | null> {
  const db = await getTenantDb();
  const { data } = await db.from('wa_borradores').select('id, telefono, texto, estado, instance_name, audio_id, adjunto_id').eq('id', id).maybeSingle();
  return (data as BorradorFila | null) ?? null;
}

/**
 * Manda el borrador por Chatwoot. PRIVADA a propósito: entra solo con el camino
 * ya verificado por `enviarBorradorPorSuCanal`, así la ventana se calcula UNA
 * vez por clic (cada cálculo es una lectura paginada de la bandeja).
 */
async function mandarPorOficial(b: BorradorFila, porEmail: string): Promise<{ ok: boolean; error?: string }> {
  // La segunda red (la primera es el camino): el oficial manda texto, y el pie solo NO es el mensaje.
  const sinOficial = sinCaminoOficial({ audioId: b.audio_id, adjuntoId: b.adjunto_id });
  if (sinOficial) return { ok: false, error: sinOficial.motivo ?? 'sale sólo por tu número de empresa' };
  const texto = (b.texto ?? '').trim();
  if (!texto) return { ok: false, error: 'el borrador no tiene texto' };

  const contactId = await contactoIdPorTelefono(b.telefono ?? '');
  if (!contactId) return { ok: false, error: 'ese teléfono no tiene contacto en el WhatsApp oficial' };

  // CLAIM atómico, el mismo patrón que `enviarBorrador` de lib/evolution-envio:
  // el UPDATE ... WHERE estado='pendiente' hace la exclusión mutua en la DB, así
  // dos setters (o un doble clic) no le mandan el mismo mensaje dos veces al lead.
  const db = await getTenantDb();
  const { data: claimed } = await db.from('wa_borradores')
    .update({ estado: 'enviando' })
    .eq('id', b.id).eq('estado', 'pendiente')
    .select('id');
  if (!((claimed ?? []) as unknown[]).length) return { ok: false, error: 'el borrador ya no está pendiente' };

  const r = await sendToContact(contactId, texto);
  if (!r.ok) {
    // Falló Chatwoot → vuelve a 'pendiente' para reintentar (igual que el no oficial).
    await db.from('wa_borradores').update({ estado: 'pendiente' }).eq('id', b.id);
    return { ok: false, error: r.error };
  }
  await db.from('wa_borradores')
    .update({ estado: 'enviado', enviado_at: new Date().toISOString(), enviado_por: porEmail })
    .eq('id', b.id);
  // El paso de la secuencia que este borrador llevaba cuenta como enviado (lib/evolution-envio.ts).
  await anotarPasoEnviado(b.id);
  return { ok: true };
}

/**
 * ÚNICA puerta de envío de un borrador: el servidor decide el canal y re-verifica
 * la ventana acá, no en el cliente. El gate del botón se calculó al cargar la
 * lista y la ventana se cierra sola con el reloj, así que entre el dibujo y el
 * clic puede haber vencido.
 */
export async function enviarBorradorPorSuCanal(id: number, porEmail: string): Promise<{ ok: boolean; error?: string }> {
  const b = await leerBorrador(id);
  if (!b || b.estado !== 'pendiente') return { ok: false, error: 'el borrador ya no está pendiente' };

  const camino = (await caminosDeEnvio([{ id: b.id, telefono: b.telefono, linea: b.instance_name, audioId: b.audio_id, adjuntoId: b.adjunto_id }])).get(b.id);
  if (camino?.via === 'empresa') return enviarBorrador(id, porEmail);
  if (camino?.via === 'oficial') return mandarPorOficial(b, porEmail);
  return { ok: false, error: camino?.motivo ?? SIN_CANAL.motivo ?? 'No hay por dónde mandarlo.' };
}
