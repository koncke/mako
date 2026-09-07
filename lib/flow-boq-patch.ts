// =============================================================================
// Escribir el prompt adentro del cuerpo de un pedido de BOQ
// =============================================================================
// El puente funciona COPIANDO el pedido que hace la propia página de Flow, porque
// reconstruirlo a mano falló cinco veces. Para repetirlo con OTRO prompt hay que
// meter el texto nuevo donde estaba el viejo.
//
// ⚠️ NO SE PARSEA EL ÁRBOL, Y ES UNA DECISIÓN. El cuerpo de BOQ es
// `f.req=<array JSON anidado y POSICIONAL>&at=<token>`: sin nombres de campo, con
// varios niveles de escapado, y con una forma que Google cambia cuando quiere. Un
// parcheador que camina ese árbol adivina la posición del prompt — y este repo ya
// tiene escrito que si hay que desempatar, todavía estás adivinando.
//
// Lo que NO es una adivinanza: la frase de aprendizaje. La persona la escribió
// exacta, así que sabemos el texto literal que Flow puso en ese cuerpo. Se busca
// ESE string, con la codificación con la que viajó, y se reemplaza. No hace falta
// saber en qué posición del array vive ni cómo se llama.
//
// ⚠️ SIN `server-only`: esto arma el cuerpo de un pedido que gasta créditos del
// cliente. Es exactamente la clase de código que necesita test.

/**
 * Las formas en que un texto puede viajar dentro de un cuerpo.
 *
 * ⚠️ CADA UNA ES SU PROPIO INVERSO PORQUE SE APLICA, NO SE DESHACE. Para reemplazar
 * no hace falta decodificar el cuerpo: alcanza con codificar el texto viejo (para
 * encontrarlo) y el nuevo (para ponerlo). Decodificar el cuerpo entero sería
 * reescribir partes que no son nuestras.
 */
const CODS: readonly [string, (t: string) => string][] = Object.freeze([
  ['crudo', (t: string) => t],
  ['json', (t: string) => JSON.stringify(t).slice(1, -1)],
  ['uri', (t: string) => encodeURIComponent(t)],
  ['json+uri', (t: string) => encodeURIComponent(JSON.stringify(t).slice(1, -1))],
  ['form', (t: string) => new URLSearchParams({ x: t }).toString().slice(2)],
  ['json2', (t: string) => JSON.stringify(JSON.stringify(t).slice(1, -1)).slice(1, -1)],
  ['json2+uri', (t: string) => encodeURIComponent(JSON.stringify(JSON.stringify(t).slice(1, -1)).slice(1, -1))],
  ['json2+form', (t: string) => new URLSearchParams({ x: JSON.stringify(JSON.stringify(t).slice(1, -1)).slice(1, -1) }).toString().slice(2)],
]);

/** Aplica una codificación por su nombre, o `null` si no existe. */
export function codificar(texto: string, nombre: string): string | null {
  const c = CODS.find(([n]) => n === nombre);
  return c ? c[1](texto) : null;
}

/** Los nombres de codificación conocidos, para que un test los pueda recorrer. */
export const CODIFICACIONES: readonly string[] = Object.freeze(CODS.map(([n]) => n));

/**
 * Con qué codificación aparece `texto` en `cuerpo`, o `null`.
 *
 * Se prueban de la más simple a la más anidada: la primera que matchea gana. Con un
 * texto que tenga espacios eso es determinista, porque cada codificación produce un
 * string distinto.
 */
export function comoViajo(cuerpo: string, texto: string): string | null {
  if (!cuerpo || !texto) return null;
  for (const [nombre, cod] of CODS) {
    try { if (cuerpo.includes(cod(texto))) return nombre; } catch { /* sigue */ }
  }
  return null;
}

/**
 * Deja un prompt en condiciones de entrar en un cuerpo ya codificado.
 *
 * ⚠️ SE SACAN LAS COMILLAS, LAS BARRAS Y LOS SALTOS, y no es paranoia de más: el
 * prompt entra a un string JSON que a su vez vive adentro de otro string JSON. Una
 * comilla doble sin escapar cierra el string un nivel antes y el `f.req` deja de
 * ser un array válido — Google contesta 400 y el error apunta a nuestro cuerpo, no
 * al carácter.
 *
 * No se ESCAPAN, se SACAN: escaparlos bien exige saber cuántos niveles de anidado
 * hay, que es justo lo que este módulo evita averiguar. Un prompt sin comillas dice
 * lo mismo; un prompt mal escapado no dice nada.
 */
export function sanearPrompt(texto: string, tope = 2000): string {
  return String(texto || '')
    // ⚠️ LOS CONTROLES VAN COMO ESCAPES, NUNCA COMO BYTES. Un caracter de control
    // crudo en el fuente hace que la busqueda del repo declare el archivo BINARIO y
    // no devuelva ni una linea — y ahi el archivo se lee igual que si no tuviera lo
    // que buscas. Cubre \n, \r, \t y el DEL.
    .replace(/[\u0000-\u001f\u007f]+/g, ' ')
    // Comillas —rectas y tipograficas— y barras invertidas: es lo que rompe el
    // anidado de strings JSON. Se SACAN en vez de reemplazarse por espacio, para no
    // partir una palabra al medio.
    .replace(/["'\u2018\u2019\u201c\u201d\\]+/g, '')
    .replace(/\s+/g, ' ')
    .trim()
    .slice(0, tope);
}

export type Reemplazo =
  | { ok: true; cuerpo: string; donde: string; cuantas: number }
  | { ok: false; error: 'SIN_ANCLA' | 'PROMPT_VACIO' | 'CUERPO_VACIO'; donde: string | null };

/**
 * Reemplaza `viejo` por `nuevo` dentro de `cuerpo`, respetando cómo viajó.
 *
 * ⚠️ FALLA EN VEZ DE ADIVINAR. Si la frase no aparece con ninguna codificación
 * conocida, devuelve `SIN_ANCLA` y NO toca el cuerpo. Mandar el pedido con el
 * prompt de la frase de aprendizaje sería generar —y cobrarle al cliente— un cubo
 * violeta girando sobre arena en vez de su anuncio.
 */
export function reemplazarEnCuerpo(cuerpo: string, viejo: string, nuevo: string): Reemplazo {
  if (!cuerpo) return { ok: false, error: 'CUERPO_VACIO', donde: null };
  const limpio = sanearPrompt(nuevo);
  if (!limpio) return { ok: false, error: 'PROMPT_VACIO', donde: null };

  const donde = comoViajo(cuerpo, viejo);
  if (!donde) return { ok: false, error: 'SIN_ANCLA', donde: null };

  const buscar = codificar(viejo, donde);
  const poner = codificar(limpio, donde);
  if (buscar == null || poner == null) return { ok: false, error: 'SIN_ANCLA', donde };

  // ⚠️ SE REEMPLAZAN TODAS LAS APARICIONES, y se cuentan.
  //
  // Flow manda el prompt más de una vez en el mismo cuerpo (el pedido y su eco de
  // telemetría), y dejar una sin cambiar es la peor mezcla: el pedido sale, cuesta
  // un crédito, y trae un video del prompt equivocado. El conteo se devuelve para
  // que quien llama pueda decidir si le cierra.
  let cuantas = 0;
  let i = cuerpo.indexOf(buscar);
  let out = '';
  let desde = 0;
  while (i !== -1) {
    out += cuerpo.slice(desde, i) + poner;
    desde = i + buscar.length;
    cuantas++;
    i = cuerpo.indexOf(buscar, desde);
  }
  out += cuerpo.slice(desde);

  return { ok: true, cuerpo: out, donde, cuantas };
}

/**
 * Repone el `at` redactado con uno vivo.
 *
 * ⚠️ EL `at` NUNCA SE GUARDA, Y ÉSTA ES LA CONTRAPARTE. `sinCredenciales` lo
 * reemplaza por `__MAKO_AT__` antes de persistir, a propósito: es el token
 * anti-CSRF de la sesión de Google del cliente. Al repetir el pedido hay que poner
 * uno FRESCO, del tráfico vivo de la pestaña.
 *
 * Devuelve `null` si el cuerpo no tiene la marca — eso significa que la plantilla
 * se guardó con otra versión del espejo, y mandarla con un `at` que no es de esta
 * sesión da un rechazo que se lee como un problema de la cuenta del cliente.
 */
export function reponerAt(cuerpo: string, atVivo: string): string | null {
  if (!cuerpo || !atVivo) return null;
  if (!cuerpo.includes('__MAKO_AT__')) return null;
  // El `at` va tal cual en un form-urlencoded, pero puede traer `:` y `_`, que son
  // seguros. Se codifica igual por si trae algo más.
  return cuerpo.replace(/__MAKO_AT__/g, encodeURIComponent(atVivo));
}

/**
 * La forma de un token de reCAPTCHA Enterprise adentro de un cuerpo de BOQ.
 *
 * ⚠️ MEDIDO el 06/09/2026 en las dos plantillas reales (video `YhhmEf`, imagen
 * `ogiZ0b`): empieza en `0cAFcWe`, mide ~2.500 caracteres, y es sólo `[A-Za-z0-9_-]`
 * — o sea que viaja IDÉNTICO bajo form-urlencoded, JSON y JSON anidado, igual que
 * el token de la sentinela. Por eso se puede reemplazar con un `replace` plano sin
 * saber con qué codificación viajó. En el cuerpo de imagen aparece DOS veces (dos
 * pedidos en el mismo batch): se reemplazan todas.
 */
export const FORMA_TOKEN_CAPTCHA = /0c[A-Za-z0-9_-]{200,}/g;

/**
 * Repone un token de reCAPTCHA fresco donde el cuerpo traía el viejo.
 *
 * ⚠️ EXISTE PORQUE EL PRIMER PEDIDO REAL POR BOQ VOLVIÓ CON
 * `PUBLIC_ERROR_UNUSUAL_ACTIVITY` (código 7). El replay mandaba el token de cuando
 * la persona enseñó la frase: un token de reCAPTCHA es de UN solo uso y ata la
 * acción, así que la protección anti-abuso de Google lo rechaza — y el error se lee
 * como «tu cuenta está marcada» cuando el problema es un token viejo NUESTRO.
 *
 * Devuelve cuántos reemplazó: cero significa que la plantilla no traía token, y
 * quien llama decide si eso es normal para esa operación.
 */
export function reponerCaptcha(cuerpo: string, tokenVivo: string): { cuerpo: string; cuantos: number } {
  if (!cuerpo || !tokenVivo) return { cuerpo: cuerpo || '', cuantos: 0 };
  let cuantos = 0;
  const nuevo = cuerpo.replace(FORMA_TOKEN_CAPTCHA, () => { cuantos++; return tokenVivo; });
  return { cuerpo: nuevo, cuantos };
}

/**
 * Los ids que el CLIENTE genera por pedido, tal como viajan en un cuerpo de BOQ.
 *
 * ⚠️ MEDIDO el 07/09/2026 en las dos plantillas reales. En el video (`YhhmEf`): dos
 * UUID por pedido más uno de lote; en la imagen (`ogiZ0b`): lo mismo. TODOS en
 * MAYÚSCULAS. El único UUID en minúsculas de los dos cuerpos es el `projectId`,
 * que sí tiene que repetirse. Es la misma separación que hacía el camino REST,
 * donde `batchId` y los ids de request salían de `randomUUID()` en CADA pedido.
 *
 * Un UUID es `[0-9A-F-]`: viaja idéntico bajo form-urlencoded y JSON anidado, así
 * que —como el token y la sentinela— se reemplaza con un `replace` plano.
 */
export const FORMA_ID_CLIENTE = /[0-9A-F]{8}-[0-9A-F]{4}-[0-9A-F]{4}-[0-9A-F]{4}-[0-9A-F]{12}/g;

/**
 * Reemplaza cada id de cliente por uno nuevo, con mapeo consistente: el mismo id
 * viejo recibe el mismo nuevo en todo el cuerpo (un lote referido dos veces sigue
 * siendo un solo lote).
 *
 * ⚠️ EXISTE PORQUE EL SEGUNDO PEDIDO REAL POR BOQ VOLVIÓ CON CÓDIGO 13 (INTERNAL)
 * DESPUÉS DE 21 SEGUNDOS. El captcha fresco ya había pasado la puerta (el primero
 * fue código 7, instantáneo); éste se procesó y murió adentro. Un cuerpo que repite
 * los ids de lote y de request de la generación con la que se enseñó es la causa
 * más consistente con «trabajó y falló»: el backend los usa para deduplicar.
 *
 * `nuevoId` se inyecta para que el test sea determinista y para que la lib siga
 * siendo pura; en producción es `crypto.randomUUID().toUpperCase()`.
 */
export function renovarIdsDeCliente(
  cuerpo: string,
  nuevoId: () => string = () => crypto.randomUUID().toUpperCase(),
): { cuerpo: string; cuantos: number; mapa: Record<string, string> } {
  if (!cuerpo) return { cuerpo: cuerpo || '', cuantos: 0, mapa: {} };
  const mapa: Record<string, string> = {};
  let cuantos = 0;
  const nuevo = cuerpo.replace(FORMA_ID_CLIENTE, (viejo) => {
    if (!mapa[viejo]) mapa[viejo] = nuevoId();
    cuantos++;
    return mapa[viejo];
  });
  return { cuerpo: nuevo, cuantos, mapa };
}
