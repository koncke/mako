// =============================================================================
// espaciado — «¿ya salió este mensaje hace poco?», reclamado de forma ATÓMICA
// =============================================================================
// Vive acá y no adentro de `lib/avisos.ts` porque lo necesitan DOS despachadores:
// el de avisos (`emitirAviso`) y el de reportes (`despacharReporte`). Con una copia
// en cada uno serían dos lugares con la misma regla, y la de reportes —que es la
// que se escribió después— nacería sin el compare-and-set, que es justamente la
// parte que hace que funcione.
//
// ⚠️ POR QUÉ NO ALCANZA CON LEER, MANDAR Y MARCAR. Eso sólo protege contra
// reintentos MÁS LENTOS que la operación del medio, y la operación del medio es un
// envío por WhatsApp: `lib/mako-grupo.ts` le manda a Evolution un delay de tipeo
// anti-ban de `min(1500 + largo*45, 9000)` con jitter, y Evolution retiene el HTTP
// abierto mientras lo simula. Para un aviso de 170 caracteres son 7,2 a 10,8
// segundos entre la lectura y la marca.
//
// Medido en producción el 27/09/2026 sobre `mako_doer_conv`: el cliente que reserva
// por Cal.com tuvo 51 avisos con 21 pares duplicados, con huecos de 0,4 a 12,4
// segundos — quince de los veintiuno justo encima del bloqueo del envío. El que
// reserva por Calendly tuvo 5 avisos y CERO duplicados, porque Calendly reentrega a
// los 22-41 s y eso cae después de la marca. El mismo código, dos resultados
// opuestos según la cadencia de reintento del proveedor.
//
// ⚠️ Y LA CADENCIA DE UN PROVEEDOR NO SE MIDE CON EL DEDUP PUESTO: sólo se ven los
// reintentos más rápidos que la ventana, porque los lentos ya no dejan fila. El
// techo de 12,4 s es el techo de LA VENTANA, no el de Cal.com. Por eso esto no se
// arregla ensanchando el TTL ni acortando el delay: se arregla reclamando.

import 'server-only';
import { createHash } from 'node:crypto';
import { getSetting, cambiarSettingSi } from './settings';
import { runWithWorkspace } from './workspace';

/**
 * La clave. Con `clave` se acota a ESA entidad; sin ella es por tipo de mensaje,
 * que es lo correcto para uno global como «tu cuenta de Meta está frenada».
 *
 * La entidad se HASHEA: un URI de Calendly son ~80 caracteres y la clave de
 * `app_settings` no es lugar para meter un identificador ajeno entero.
 */
export function keyEspaciado(tipo: string, clave?: string): string {
  if (!clave) return `mako.aviso.last.${tipo}`;
  const h = createHash('sha1').update(clave).digest('base64url').slice(0, 12);
  return `mako.aviso.last.${tipo}:${h}`;
}

/** ¿Ya salió dentro de la ventana? Lectura sola, sin reclamar (no reserva nada). */
export async function salioReciente(ws: number, tipo: string, minutos: number, clave?: string): Promise<boolean> {
  const raw = await runWithWorkspace(ws, () => getSetting(keyEspaciado(tipo, clave)));
  if (!raw) return false;
  const t = Date.parse(raw);
  if (Number.isNaN(t)) return false;
  return Date.now() - t < minutos * 60_000;
}

/**
 * RECLAMA la salida antes de mandarla. Devuelve false si otro ya se la llevó.
 *
 * `cambiarSettingSi` ya existía para exactamente esto (dos clics en «Conectar por
 * QR» abrían dos líneas de WhatsApp): de dos requests que compiten, gana UNA.
 */
export async function reclamarEspaciado(ws: number, tipo: string, minutos: number, clave?: string): Promise<boolean> {
  return runWithWorkspace(ws, async () => {
    const key = keyEspaciado(tipo, clave);
    const previo = await getSetting(key);
    if (previo) {
      const t = Date.parse(previo);
      // Vigente: alguien lo dijo hace poco y esta copia no tiene nada que agregar.
      if (!Number.isNaN(t) && Date.now() - t < minutos * 60_000) return false;
    }
    // El compare-and-set va contra el valor EXACTO que se acaba de leer: si entre la
    // lectura y acá otro lo cambió, pierde y no manda. `previo === null` usa la rama
    // de insertar-si-no-existe, que también es atómica.
    return cambiarSettingSi(key, previo, new Date().toISOString());
  });
}
