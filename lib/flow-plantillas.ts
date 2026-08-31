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
/**
 * El proyecto de Flow al que pertenece una plantilla. `''` = no se puede saber.
 *
 * Vive en dos lados según la clase: en el PATH de la url
 * (`/v1/projects/<uuid>/flowMedia:batchGenerateImages`) o en el
 * `clientContext.projectId` del cuerpo. Se miran los dos, y alcanza con uno.
 */
export function proyectoDePlantilla(p: PlantillaEspejo): string {
  const enUrl = /\/projects\/([0-9a-f-]{36})/i.exec(p.url || '');
  if (enUrl) return enUrl[1];
  try {
    const o = JSON.parse(p.cuerpo || '{}') as { clientContext?: { projectId?: unknown } };
    const id = String(o?.clientContext?.projectId ?? '');
    return /^[0-9a-f-]{36}$/i.test(id) ? id : '';
  } catch {
    return '';
  }
}

/**
 * Se queda con las plantillas que son de ESTE proyecto de Flow.
 *
 * ⚠️ POR QUÉ EXISTE: el respaldo de plantillas de la extensión vive en
 * `chrome.storage.local` bajo UNA clave global (`plantillas`), sin token ni
 * workspace adentro. Emparejar el mismo navegador con otro cliente pisa el
 * `token` y NO toca ese respaldo, así que el latido siguiente sube al workspace
 * nuevo las plantillas aprendidas en el anterior — con el projectId de Flow del
 * otro cliente, el cuerpo de su generación y el mediaId de su cara.
 *
 * Es el caso normal del super-admin, que abre un cliente por pestaña. Nadie gana
 * un permiso que no tenía —el que empareja está autorizado en los dos, y el
 * Google que paga es siempre el del navegador que apretó Conectar—, pero los
 * datos de un cliente terminan PERSISTIDOS en la fila de otro, y de ahí bajan al
 * navegador real de ese otro en el latido siguiente.
 *
 * El arreglo de raíz es de la extensión (que la clave lleve el token). Éste es el
 * lado que NO depende de que el cliente actualice: el server ya recibe, en el
 * mismo request, el projectId que el navegador está mirando.
 *
 * ⚠️ Sólo se descarta lo que se puede PROBAR ajeno. Una plantilla sin projectId
 * —`credits`, `uploadImage`, las dos de video— pasa: no tenemos con qué
 * contradecirla, y tirarla sería castigar la falta de evidencia. Y si el puente
 * no reporta proyecto, no se filtra nada: sin la mitad de la comparación no hay
 * comparación.
 */
export function soloDelProyecto(
  ps: PlantillaEspejo[],
  projectId: string,
): { quedan: PlantillaEspejo[]; ajenas: PlantillaEspejo[] } {
  const mio = String(projectId || '').trim();
  if (!/^[0-9a-f-]{36}$/i.test(mio)) return { quedan: ps, ajenas: [] };

  const quedan: PlantillaEspejo[] = [];
  const ajenas: PlantillaEspejo[] = [];
  for (const p of ps) {
    const suyo = proyectoDePlantilla(p);
    if (suyo && suyo.toLowerCase() !== mio.toLowerCase()) ajenas.push(p);
    else quedan.push(p);
  }
  return { quedan, ajenas };
}

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

/**
 * ¿La plantilla de imagen ya trae el array donde vive la cara?
 *
 * ⚠️ ES UNA GUARDA, NO UNA CURIOSIDAD, y sale de una trampa concreta: `parchar()`
 * INVENTA los tramos que faltan. Sobre una plantilla sin `imageInputs`, un parche
 * a `requests.0.imageInputs.0.name` crearía `[{ name }]` **sin su
 * `imageInputType`**, devolvería éxito, y saldría un cuerpo mal formado armado por
 * nosotros — sin `PARCHE_FALLO`, sin error, y con una imagen de resultado. El modo
 * de falla más caro: no se lee como un fallo, se lee como una imagen.
 *
 * Devuelve `null` cuando no se puede saber —cuerpo ausente, o truncado y por eso
 * ilegible—, que NO es lo mismo que «no lo tiene». Con `null` no se parchea: no
 * poder comprobar algo no autoriza a asumirlo.
 */
export function tieneCaraParcheable(cuerpo: string | null): boolean | null {
  if (!cuerpo) return null;
  let o: Record<string, unknown>;
  try { o = JSON.parse(cuerpo) as Record<string, unknown>; } catch { return null; }
  const req = Array.isArray(o.requests) ? o.requests[0] : null;
  if (!req || typeof req !== 'object') return false;
  const inputs = (req as Record<string, unknown>).imageInputs;
  if (!Array.isArray(inputs) || !inputs.length) return false;
  const primero = inputs[0] as Record<string, unknown> | undefined;
  // Tiene que traer las DOS: el nombre que vamos a pisar y el tipo que hay que
  // conservar. Con una sola, parchear deja el pedido a medias.
  return !!primero && typeof primero.name === 'string' && typeof primero.imageInputType === 'string';
}

/** Las que el navegador NO tiene y nosotros sí. Es lo único que hace falta devolver. */
export function faltantes(
  guardadas: PlantillaEspejo[],
  clasesQueTiene: readonly string[],
): PlantillaEspejo[] {
  const tiene = new Set(clasesQueTiene.map(String));
  return guardadas.filter((p) => !tiene.has(p.clase));
}
