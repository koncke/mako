// =============================================================================
// GENERADO por scripts/sync-operaciones.mjs — NO EDITAR A MANO
// =============================================================================
// La fuente es lib/flow-operaciones.ts. Si tocás esto directamente, el pre-push
// frena el push — y con razón: un token distinto entre los dos archivos significa
// que alguien genera un clip, se le cobra, y el puente dice que no aprendió.
//
// La extensión no puede importar de lib/ (es un paquete aparte, sin bundler), así
// que el catálogo se copia. Es la misma solución que el repo ya usa para las skills
// y para plugin/, por la misma razón y con la misma guarda.
// =============================================================================

export const OPERACIONES = Object.freeze([
  {
    "op": "creditos",
    "tipo": "creditos",
    "pathClase": "credits",
    "como": "trafico",
    "token": null,
    "frase": null,
    "rpcids": [
      "nzlxg"
    ],
    "detectable": true,
    "pide": false,
    "cuesta": false,
    "captcha": false,
    "boton": "Entendido",
    "que": "Se aprende sola: Flow lee tu saldo cada vez que abres el proyecto."
  },
  {
    "op": "estado_clips",
    "tipo": "estado_clips",
    "pathClase": "video:batchCheckAsyncVideoGenerationStatus",
    "como": "trafico",
    "token": null,
    "frase": null,
    "rpcids": [
      "jwpduf",
      "ngNC2"
    ],
    "detectable": true,
    "pide": false,
    "cuesta": false,
    "captcha": false,
    "boton": "Entendido",
    "que": "Se aprende sola mientras un video tuyo se está generando."
  },
  {
    "op": "subir_imagen",
    "tipo": "subir_imagen",
    "pathClase": "uploadImage",
    "como": "trafico",
    "token": null,
    "frase": null,
    "rpcids": [],
    "detectable": false,
    "pide": true,
    "cuesta": false,
    "captcha": false,
    "boton": "Subir la foto",
    "que": "Sube una foto tuya a Flow una vez. Con eso queda aprendida."
  },
  {
    "op": "generar_clip",
    "tipo": "generar_clip",
    "pathClase": "video:batchAsyncGenerateVideoStartImage",
    "como": "ancla",
    "token": "mako7f3a9c",
    "frase": "un cubo violeta girando sobre arena mako7f3a9c",
    "rpcids": [],
    "detectable": true,
    "pide": true,
    "cuesta": true,
    "captcha": true,
    "boton": "Copiar la frase",
    "que": "Genera UN video de 4 segundos con la frase exacta que MaKo te da."
  },
  {
    "op": "generar_imagen",
    "tipo": "generar_imagen",
    "pathClase": "flowMedia:batchGenerateImages",
    "como": "ancla",
    "token": "mako4d1c8b",
    "frase": "una esfera naranja flotando sobre nieve mako4d1c8b",
    "rpcids": [],
    "detectable": true,
    "pide": true,
    "cuesta": true,
    "captcha": true,
    "boton": "Copiar la frase",
    "que": "Genera UNA imagen con la frase exacta que MaKo te da."
  },
  {
    "op": "enlace_clip",
    "tipo": "enlace_clip",
    "pathClase": "",
    "como": "ninguna",
    "token": null,
    "frase": null,
    "rpcids": [],
    "detectable": false,
    "pide": false,
    "cuesta": false,
    "captcha": false,
    "boton": "Entendido",
    "que": "No hace falta enseñarla: MaKo la resuelve mirando el tráfico."
  }
]);

/** La operación de un id, o null. */
export function operacionDe(op) {
  return OPERACIONES.find((o) => o.op === op) || null;
}

/** Las que hay que enseñar, en orden. */
export const A_ENSENAR = Object.freeze(OPERACIONES.filter((o) => o.como !== 'ninguna'));

/**
 * Las que se le PIDEN a la persona. Subconjunto de A_ENSENAR.
 *
 * Las otras se aprenden solas: mostrarlas como un paso deja a alguien mirando una
 * pantalla que le pide algo que no puede hacer, con un boton que solo cierra.
 */
export const A_PEDIR = Object.freeze(
  OPERACIONES.filter((o) => o.como !== 'ninguna' && o.pide && o.detectable),
);

/**
 * Las que el puente necesita y todavia NO puede reconocer.
 *
 * No son un paso, y tampoco se callan: se muestran como un limite NUESTRO. Callarlas
 * hace que alguien cuente las operaciones y concluya que falta algo que hacer — y eso
 * ya dejo a alguien subiendo una foto una y otra vez sin que pasara nada.
 */
export const SIN_DETECTAR = Object.freeze(
  OPERACIONES.filter((o) => o.como !== 'ninguna' && !o.detectable),
);

/**
 * Las formas en que un texto puede aparecer dentro del cuerpo de un pedido.
 *
 * ⚠️ `form` es la que importa: BOQ manda `f.req` como form-urlencoded, donde el
 * espacio es `+` y no `%20`. Sin esa fila, una generación capturada perfecta daba
 * «no aprendí» — medido, cero de seis.
 */
const CODIFICACIONES = [
  ['crudo', (t) => t],
  ['json', (t) => JSON.stringify(t).slice(1, -1)],
  ['uri', (t) => encodeURIComponent(t)],
  ['json+uri', (t) => encodeURIComponent(JSON.stringify(t).slice(1, -1))],
  ['form', (t) => new URLSearchParams({ x: t }).toString().slice(2)],
  ['json2', (t) => JSON.stringify(JSON.stringify(t).slice(1, -1)).slice(1, -1)],
];

/** Con qué codificación aparece `ancla` en `cuerpo`, o null. */
export function dondeAparece(cuerpo, ancla) {
  if (typeof cuerpo !== 'string' || !cuerpo || !ancla) return null;
  for (const [nombre, codificar] of CODIFICACIONES) {
    try { if (cuerpo.includes(codificar(ancla))) return nombre; } catch { /* sigue */ }
  }
  return null;
}

/**
 * Qué operación es este cuerpo, mirando los tokens del catálogo.
 *
 * ⚠️ SE DETECTA CON EL TOKEN Y SE ETIQUETA CON LA FRASE, y son dos cosas.
 * El token es alfanumérico para que ninguna codificación lo cambie — por eso
 * encuentra la generación pase lo que pase. Y eso mismo lo vuelve inútil como
 * etiqueta: al ser idéntico bajo todas, contesta siempre 'crudo'.
 * Lo que hace falta para REPETIR el pedido es cómo viajó la FRASE, que sí tiene
 * espacios y sí cambia. Medido: token → crudo, frase → form, mismo cuerpo.
 */
/**
 * Que operacion es esta CLASE, por su rpcid.
 *
 * ⚠️ SOLO PARA LAS QUE NO ESCRIBEN NADA: un rpcid rota, y reconocer por id una
 * operacion que GENERA podria hacer que MaKo repita el pedido equivocado contra la
 * cuenta del cliente. Las que generan van por su ancla, que no se puede confundir
 * porque el texto lo escribimos nosotros.
 *
 * Un lote (boq:a,b) tiene que tener TODOS sus ids en la misma operacion: un lote
 * mezclado no es esa operacion, es otra cosa que la contiene.
 */
export function operacionDeLaClase(clase) {
  const m = /^boq:(.+)$/.exec(String(clase || ''));
  if (!m) return null;
  const ids = m[1].split(',').filter(Boolean);
  if (!ids.length) return null;
  for (const o of OPERACIONES) {
    if (!o.rpcids || !o.rpcids.length) continue;
    if (ids.every((id) => o.rpcids.includes(id))) return o.op;
  }
  return null;
}

export function operacionDelCuerpo(cuerpo) {
  for (const o of OPERACIONES) {
    if (!o.token) continue;
    if (!dondeAparece(cuerpo, o.token)) continue;
    const donde = (o.frase && dondeAparece(cuerpo, o.frase)) || 'token';
    return { op: o.op, donde };
  }
  return null;
}
