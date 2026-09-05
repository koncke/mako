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
    "cuesta": false,
    "captcha": false,
    "que": "Se aprende sola: Flow lee tu saldo cada vez que abres el proyecto."
  },
  {
    "op": "estado_clips",
    "tipo": "estado_clips",
    "pathClase": "video:batchCheckAsyncVideoGenerationStatus",
    "como": "trafico",
    "token": null,
    "frase": null,
    "cuesta": false,
    "captcha": false,
    "que": "Se aprende sola mientras un video tuyo se está generando."
  },
  {
    "op": "subir_imagen",
    "tipo": "subir_imagen",
    "pathClase": "uploadImage",
    "como": "trafico",
    "token": null,
    "frase": null,
    "cuesta": false,
    "captcha": false,
    "que": "Sube una foto tuya a Flow una vez. Con eso queda aprendida."
  },
  {
    "op": "generar_clip",
    "tipo": "generar_clip",
    "pathClase": "video:batchAsyncGenerateVideoStartImage",
    "como": "ancla",
    "token": "mako7f3a9c",
    "frase": "un cubo violeta girando sobre arena mako7f3a9c",
    "cuesta": true,
    "captcha": true,
    "que": "Genera UN video de 4 segundos con la frase exacta que MaKo te da."
  },
  {
    "op": "generar_imagen",
    "tipo": "generar_imagen",
    "pathClase": "flowMedia:batchGenerateImages",
    "como": "ancla",
    "token": "mako4d1c8b",
    "frase": "una esfera naranja flotando sobre nieve mako4d1c8b",
    "cuesta": true,
    "captcha": true,
    "que": "Genera UNA imagen con la frase exacta que MaKo te da."
  },
  {
    "op": "enlace_clip",
    "tipo": "enlace_clip",
    "pathClase": "",
    "como": "ninguna",
    "token": null,
    "frase": null,
    "cuesta": false,
    "captcha": false,
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

/** Qué operación es este cuerpo, mirando los tokens del catálogo. */
export function operacionDelCuerpo(cuerpo) {
  for (const o of OPERACIONES) {
    if (!o.token) continue;
    const donde = dondeAparece(cuerpo, o.token);
    if (donde) return { op: o.op, donde };
  }
  return null;
}
