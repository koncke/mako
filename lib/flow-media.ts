// =============================================================================
// flow-media — leer el estado de UN medio dentro de una respuesta de Flow
// =============================================================================
//
// SIN `server-only`, y por la razón de siempre en este repo: acá está lo único
// que puede fallar en silencio —decir que un clip falló cuando el que falló es
// otro, o darle a un clip la url de otro medio— y eso hay que poder probarlo con
// una respuesta real y sin levantar nada.
//
// ── El problema que resuelve, medido el 02/09/2026 ─────────────────────────
//
// `batchCheckAsyncVideoGenerationStatus` contesta por VARIOS medios a la vez. La
// respuesta real de una clienta, con la forma exacta:
//
//   $.media[0].name                                    = 108dc579…  ← su clip
//   $.media[0].mediaMetadata.mediaStatus.failureReasons = ["IDENTIFIABLE_PERSON_SAFETY"]
//   $.media[0].mediaMetadata.mediaStatus.mediaGenerationStatus = …_FAILED
//   $.media[1].name                                    = 68a5ae6c…  ← la IMAGEN del escenario
//   $.media[1].mediaMetadata.mediaStatus.mediaGenerationStatus = …_SUCCESSFUL
//   $.media[1].mediaMetadata.mediaBlobSize             = 4030059
//
// Son HERMANOS, y el segundo aparece en TODAS las consultas: es la imagen desde
// la que se anima. El lector viejo hacía dos cosas sobre el JSON entero:
//
//   if (/MEDIA_GENERATION_STATUS_FAILED/.test(texto)) …          ← el blob completo
//   buscarCampo(c.resultado, ['fifeUrl', 'outputUri', …])        ← a cualquier profundidad
//
// ⚠️ Las dos leen del medio equivocado, y las dos fallan CALLADAS:
//
//   · Con el clip BIEN y la imagen mal, el clip se marca rechazado. Nadie lo
//     puede desmentir: la pantalla afirma que Google lo rechazó y Google no dijo
//     eso de él.
//   · Con el clip BIEN, `buscarCampo` puede devolver la url de la IMAGEN. Eso no
//     da error: da una toma que reproduce una foto fija. Es el modo de falla más
//     caro de los dos, porque se ve como un clip.
//
// La regla de la casa que aplica es la del cruce: si una rama puede escribir
// «esto es ambiguo», esa rama no puede terminar en el primero que encuentre.
// Acá el desambiguador existe y es exacto —el `name`—, así que se usa.

/** En qué quedó UN medio, según lo que contestó Google de ÉL. */
export type EstadoMedia = 'ok' | 'fallo' | 'en_curso';

export type MediaFlow = {
  /** El id del medio. Es el mismo que la operación por la que se preguntó. */
  name: string;
  estado: EstadoMedia;
  /**
   * El motivo que dio Google, TAL CUAL (`IDENTIFIABLE_PERSON_SAFETY`,
   * `PROMINENT_PERSON`, `PUBLIC_ERROR_UNSAFE_GENERATION`…). `''` si no lo dijo.
   *
   * Se conserva crudo a propósito: clasificarlo es de quien muestra el mensaje,
   * y guardar ya traducido pierde el único dato con el que se puede auditar una
   * clasificación equivocada después.
   */
  razon: string;
  /** La url del medio terminado, si esta respuesta la trae. `''` si no. */
  url: string;
};

/** Los nombres de campo donde Flow ha puesto la url. Salen del bundle, no de suponer. */
const CAMPOS_URL = ['fifeUrl', 'outputUri', 'videoUri', 'servingUrl', 'encodedVideo', 'url'];

/**
 * El nodo del medio que se llama `operacion`, o `null` si esta respuesta no
 * habla de él.
 *
 * ⚠️ Recorre en ANCHURA y devuelve el más SUPERFICIAL. El id aparece dos veces
 * en cada medio —`media[i].name` y `media[i].video.operation.name`— y el que
 * sirve es el de arriba: el de adentro cuelga de `video`, que no tiene al lado
 * ni el estado ni la url. Con una búsqueda en profundidad se entraba por el
 * segundo y se salía con las manos vacías, que es indistinguible de «esta
 * respuesta no lo menciona».
 */
function nodoDelMedio(raiz: unknown, operacion: string): Record<string, unknown> | null {
  const id = (operacion || '').trim();
  if (!id) return null;
  const cola: unknown[] = [raiz];
  const visto = new Set<unknown>();
  while (cola.length) {
    const v = cola.shift();
    if (!v || typeof v !== 'object' || visto.has(v)) continue;
    visto.add(v);
    if (Array.isArray(v)) { cola.push(...v); continue; }
    const o = v as Record<string, unknown>;
    if (typeof o.name === 'string' && o.name.trim() === id) return o;
    cola.push(...Object.values(o));
  }
  return null;
}

/** El primer valor de estos campos DENTRO de este subárbol. */
function campoEn(v: unknown, campos: string[], visto = new Set<unknown>()): string {
  if (!v || typeof v !== 'object' || visto.has(v)) return '';
  visto.add(v);
  if (Array.isArray(v)) {
    for (const x of v) { const r = campoEn(x, campos, visto); if (r) return r; }
    return '';
  }
  const o = v as Record<string, unknown>;
  for (const c of campos) {
    const val = o[c];
    if (typeof val === 'string' && val.trim()) return val.trim();
  }
  for (const x of Object.values(o)) { const r = campoEn(x, campos, visto); if (r) return r; }
  return '';
}

/** El primer elemento de string del primer array con este nombre, dentro del subárbol. */
function listaEn(v: unknown, campo: string, visto = new Set<unknown>()): string {
  if (!v || typeof v !== 'object' || visto.has(v)) return '';
  visto.add(v);
  if (Array.isArray(v)) {
    for (const x of v) { const r = listaEn(x, campo, visto); if (r) return r; }
    return '';
  }
  const o = v as Record<string, unknown>;
  const val = o[campo];
  if (Array.isArray(val)) {
    const s = val.find((x): x is string => typeof x === 'string' && !!x.trim());
    if (s) return s.trim();
  }
  for (const x of Object.values(o)) { const r = listaEn(x, campo, visto); if (r) return r; }
  return '';
}

/**
 * Qué contestó Google sobre ESTE medio, y sólo sobre éste.
 *
 * `null` = esta respuesta no lo menciona, que NO es lo mismo que «todavía no
 * está»: son dos situaciones y quien llama las distingue.
 */
export function mediaDeFlow(resultado: unknown, operacion: string): MediaFlow | null {
  const nodo = nodoDelMedio(resultado, operacion);
  if (!nodo) return null;

  const bruto = campoEn(nodo, ['mediaGenerationStatus']);
  const estado: EstadoMedia = /FAILED/.test(bruto) ? 'fallo'
    : /SUCCESSFUL/.test(bruto) ? 'ok'
      : 'en_curso';

  // El motivo puede venir en la lista o en el mensaje del error. La lista es más
  // específica (`IDENTIFIABLE_PERSON_SAFETY` contra `PUBLIC_ERROR_UNSAFE_GENERATION`),
  // así que gana — y es la que dice si el problema es la cara o el texto.
  const razon = listaEn(nodo, 'failureReasons') || campoEn(nodo, ['message']);

  return {
    name: String(nodo.name ?? ''),
    estado,
    razon: estado === 'fallo' ? razon : '',
    // La url sólo del propio medio. Con la búsqueda global, la de la imagen del
    // escenario —que viaja en la misma respuesta y siempre está SUCCESSFUL— podía
    // terminar como si fuera el video.
    url: campoEn(nodo, CAMPOS_URL),
  };
}

/**
 * ¿Google se negó por la CARA, y no por el texto?
 *
 * ⚠️ ESTA FAMILIA TIENE DOS MIEMBROS Y EL CÓDIGO CONOCÍA UNO.
 *
 * `PROMINENT_PERSON` es «se parece a alguien famoso». `IDENTIFIABLE_PERSON_SAFETY`
 * es «hay una persona real reconocible» — otro filtro, mismo remedio: lo que hay
 * que cambiar es la IMAGEN desde la que se anima, no el guion.
 *
 * Medido el 02/09/2026: dos tomas de una clienta llegaron con
 * `IDENTIFIABLE_PERSON_SAFETY`, el detector sólo miraba `PROMINENT_PERSON`, y la
 * pantalla le dijo «el filtro de contenido rechazó cómo está escrito el escenario
 * … hay que reescribirlo». Su guion estaba perfecto: la mandamos a reescribir
 * durante horas algo que no era el problema, y el camino que sí destraba
 * —regenerar la imagen, que es gratis— no se le nombró nunca.
 *
 * Es la regla de la casa sobre los detectores de familia: cuando uno deja pasar
 * algo, fijate si lo que falta es una FAMILIA y no un caso.
 */
export function esFiltroDeCara(razon: string): boolean {
  return /PROMINENT_PERSON|PROMINENT_PEOPLE|IDENTIFIABLE_PERSON/i.test(razon || '');
}

/**
 * ¿Se puede mostrar esto como una frase escrita para una persona?
 *
 * ⚠️ EXISTE PORQUE UNA PANTALLA LE DIBUJÓ EL JSON DE GOOGLE A UNA CLIENTA.
 *
 * `textoFlow` acepta una frase «del servidor» que GANA sobre la constante, y dos
 * pantallas le pasaban `errorCrudo` —que es la respuesta cruda de Flow—. El
 * resultado fue 1.600 caracteres de JSON centrados adentro del recuadro donde va
 * el video, con el prompt del anuncio y los ids adentro.
 *
 * El parámetro ya se usó mal tres veces, así que la guarda va del lado del que
 * MUESTRA y no del que llama: lo que parece un payload no se pinta nunca, venga
 * de donde venga.
 */
export function pareceFraseParaPersona(txt: string): boolean {
  const t = (txt || '').trim();
  if (!t) return false;
  // Un JSON, aunque venga recortado por el medio.
  if (/^[[{]/.test(t)) return false;
  if (/"[A-Za-z_]+"\s*:/.test(t)) return false;
  // Nadie escribe una instrucción de 400 caracteres sin un punto: eso es un volcado.
  if (t.length > 400 && !/[.!?]\s/.test(t.slice(0, 400))) return false;
  return true;
}
