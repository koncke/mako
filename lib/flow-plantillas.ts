// =============================================================================
// Las plantillas del espejo, guardadas del lado del servidor
// =============================================================================
// EL PROBLEMA QUE RESUELVE, en palabras del dueño: «¿por qué me pides
// constantemente generar imágenes o videos? ¿no te basta la data de todas las
// veces que lo hemos generado?».
//
// Tenía razón y era un defecto, no una limitación. El puente funciona COPIANDO el
// pedido que hace la propia página de Flow —esa es la decisión que lo hizo
// funcionar, porque reconstruirlo a mano falló cinco veces—, pero esa copia vivía
// en dos lugares y los dos son del navegador: la memoria de la pestaña, que se
// borra con cada F5, y `chrome.storage.local`, que se va con el perfil. Del lado
// nuestro no quedaba NADA.
//
// Consecuencia: cada vez que el navegador olvidaba, la app volvía a pedir «genera
// UNA imagen a mano», «genera UN video a mano», «anima UNA imagen a mano»,
// «espera a que Flow lea tu saldo» — cuatro pedidos distintos, todos por lo mismo,
// sobre cosas que el cliente ya había hecho decenas de veces.
//
// Es exactamente la lección que el repo ya había aplicado a UN dato: el `mediaId`
// de la cara se guarda desde que se aprende, «un dato que se descubre una vez y no
// cambia no puede depender de que una pestaña siga abierta». Faltaba aplicarla a
// lo que produce ese dato.
//
// SIN `server-only`: el saneo decide qué se persiste de un pedido autenticado, y
// una decisión así necesita test.

import { ENDPOINTS } from './flow-protocolo';

/** Dónde vive, por workspace. */
export const KEY_PLANTILLAS = 'flow.plantillas';

/**
 * La clase de un pedido: el último tramo del path.
 *
 * ⚠️ La misma fórmula que `claseDe()` en `extension/injected.js` y que el cálculo
 * de `background.js`. Es lo que hace que una plantilla guardada acá se encuentre
 * allá; si las tres se separan, el respaldo deja de matchear y no falla: pide
 * generar a mano, otra vez.
 */
export function claseDePath(path: string): string {
  return String(path || '').split('?')[0].split('/').filter(Boolean).pop() || '';
}

/**
 * Qué clases se guardan. DERIVADA de `ENDPOINTS`, no escrita a mano.
 *
 * Una lista a mano se queda vieja el día que se agrega un endpoint, y el síntoma
 * sería justamente el que esto viene a sacar: «genera uno a mano». El `'x'` del
 * projectId es de mentira y no importa — la clase es el último tramo, que en ese
 * endpoint es `flowMedia:batchGenerateImages` con cualquier proyecto.
 *
 * Es un allowlist POSITIVO a propósito: se guarda lo que sirve, no «todo menos».
 * Flow hace decenas de pedidos por sesión (telemetría, recomendaciones, applets) y
 * ninguno de ésos tiene por qué terminar en nuestra base.
 */
export const CLASES_UTILES: readonly string[] = Object.freeze(
  [...new Set(
    Object.values(ENDPOINTS)
      .map((v) => (typeof v === 'function' ? v('x') : v))
      .map(claseDePath)
      .filter(Boolean),
  )],
);

export type PlantillaEspejo = {
  clase: string;
  url: string;
  metodo: string;
  headers: Record<string, string>;
  cuerpo: string | null;
  credenciales?: string;
  cuando?: number;
};

/** Lo más grande que se guarda de UN cuerpo, y de todo junto. */
const TOPE_CUERPO = 20_000;
const TOPE_TOTAL = 150_000;

/**
 * Encabezados que NUNCA se persisten.
 *
 * ⚠️ `injected.js` ya saca el `authorization` antes de mandarlo, y aun así se
 * vuelve a sacar acá. No es desconfianza del código de al lado: es que el que
 * guarda es el único que puede garantizar qué quedó guardado, y una extensión vieja
 * —de las que hay, justamente— manda lo que mandaba su versión. El guard va donde
 * se escribe.
 *
 * La comparación es en minúsculas porque `delete o.authorization` NO borra
 * `Authorization`, que es como lo manda Flow. Ese error ya dejó un bearer guardado
 * en `chrome.storage.local` contra lo que prometía su propio comentario.
 */
const HEADERS_PROHIBIDOS = new Set(['authorization', 'cookie', 'set-cookie', 'x-goog-authuser']);

/**
 * Deja una lista de plantillas lista para guardar, o la descarta.
 *
 * Devuelve solo lo de las clases útiles, sin credenciales, sin el token del
 * captcha —que se acuña en el momento y vencido no sirve para nada— y acotada.
 */
export function sanearPlantillas(crudo: unknown): PlantillaEspejo[] {
  if (!Array.isArray(crudo)) return [];
  const out: PlantillaEspejo[] = [];
  let total = 0;

  for (const it of crudo) {
    if (!it || typeof it !== 'object') continue;
    const p = it as Record<string, unknown>;
    const clase = String(p.clase || '');
    if (!CLASES_UTILES.includes(clase)) continue;
    const url = String(p.url || '');
    // Sin url no hay nada que copiar, y el origen tiene que ser el de Flow: una
    // plantilla apuntando a otro lado sería un pedido nuestro a un tercero.
    if (!url.startsWith('https://aisandbox-pa.googleapis.com/')) continue;

    const headers: Record<string, string> = {};
    const hs = (p.headers && typeof p.headers === 'object') ? p.headers as Record<string, unknown> : {};
    for (const [k, v] of Object.entries(hs)) {
      if (HEADERS_PROHIBIDOS.has(k.toLowerCase())) continue;
      if (typeof v === 'string') headers[k] = v.slice(0, 400);
    }

    let cuerpo: string | null = typeof p.cuerpo === 'string' ? p.cuerpo.slice(0, TOPE_CUERPO) : null;
    if (cuerpo) {
      // El TOKEN del captcha se borra; el `recaptchaContext` NO. Su
      // `applicationType` no es una credencial, es una constante del contrato, y
      // tirarlo entero ya produjo un «reCAPTCHA evaluation failed».
      try {
        const o = JSON.parse(cuerpo) as Record<string, unknown>;
        const ctx = o.clientContext as Record<string, unknown> | undefined;
        const rc = ctx?.recaptchaContext as Record<string, unknown> | undefined;
        if (rc && 'token' in rc) delete rc.token;
        cuerpo = JSON.stringify(o);
      } catch { /* si no era JSON, va como vino: el espejo tampoco lo interpreta */ }
    }

    const tam = url.length + (cuerpo?.length ?? 0) + JSON.stringify(headers).length;
    if (total + tam > TOPE_TOTAL) break;
    total += tam;

    out.push({
      clase,
      url,
      metodo: String(p.metodo || 'POST').toUpperCase(),
      headers,
      cuerpo,
      ...(typeof p.credenciales === 'string' ? { credenciales: p.credenciales } : {}),
      cuando: Number(p.cuando) || 0,
    });
  }
  return out;
}

/**
 * Funde lo que llega con lo que ya había: gana la que tenga CUERPO, y a igualdad
 * la más nueva.
 *
 * ⚠️ El criterio no es «la más nueva gana» a secas, y la diferencia es la que
 * costó el HTTP 400: una plantilla puede llegar SIN CUERPO —Flow llamó con un
 * `Request` y una extensión vieja no sabía leerlo— y esa cáscara no se distingue
 * de una sana en ningún punto del camino. Dejar que pise a una completa es
 * cambiar algo que funciona por algo que falla sin decirlo.
 */
export function fundirPlantillas(
  previas: PlantillaEspejo[],
  nuevas: PlantillaEspejo[],
): PlantillaEspejo[] {
  const mapa = new Map<string, PlantillaEspejo>();
  for (const p of previas) mapa.set(p.clase, p);
  for (const n of nuevas) {
    const vieja = mapa.get(n.clase);
    if (!vieja) { mapa.set(n.clase, n); continue; }
    const nSirve = n.cuerpo != null || n.metodo === 'GET' || n.metodo === 'HEAD';
    const vSirve = vieja.cuerpo != null || vieja.metodo === 'GET' || vieja.metodo === 'HEAD';
    if (nSirve && !vSirve) { mapa.set(n.clase, n); continue; }
    if (!nSirve && vSirve) continue;
    if ((n.cuando ?? 0) >= (vieja.cuando ?? 0)) mapa.set(n.clase, n);
  }
  return [...mapa.values()];
}

/** Las que el navegador NO tiene y nosotros sí. Es lo único que hace falta devolver. */
export function faltantes(
  guardadas: PlantillaEspejo[],
  clasesQueTiene: readonly string[],
): PlantillaEspejo[] {
  const tiene = new Set(clasesQueTiene.map(String));
  return guardadas.filter((p) => !tiene.has(p.clase));
}
