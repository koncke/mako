// =============================================================================
// Copia fiel — un bloque de texto trae SU tipografía, no la hereda de un estilo (7/11/2026)
// =============================================================================
//
// ── Qué resuelve ────────────────────────────────────────────────────────────
//
// Martín, 7/11: «recalcar la misma tipografía, eso es súper importante. **Cada letra**, porque
// fíjate que en esa imagen hay muchas tipografías».
//
// Tenía razón y el problema era estructural, no de elección. `documentoDeCarrusel` arma cada página
// a partir de `EstiloCarrusel`, que tiene **dos** ranuras de fuente —`titular` y `texto`— y las
// aplica **por rol**: el titular va con una, todo lo demás con la otra. Un ejemplo real no se
// comporta así. En la portada que se replicó (@growithalex) hay:
//
//   · dos FAMILIAS: una grotesca (encabezado, «best», «Pa», «06», «irings») y una itálica serif de
//     alto contraste para una sola palabra («font»);
//   · ocho BLOQUES con seis tratamientos distintos de cuerpo, color, tracking y caja;
//   · texto blanco sobre una placa de color, que ninguna de las dos ranuras sabe expresar;
//   · dos titulares SUPERPUESTOS, que un layout por roles no puede producir.
//
// Por eso ninguna réplica iba a coincidir con la referencia: no es que eligiera mal la tipografía,
// es que **no tenía dónde guardarla**.
//
// ── La inversión ────────────────────────────────────────────────────────────
//
// Acá el bloque es la autoridad y el estilo no participa. `documentoDeCarrusel` sigue intacto para
// los carruseles generados —el que no declara, hereda, y nada de lo que ya existe cambia—; este
// camino es el de COPIAR una referencia, que es el otro producto (ver `docs/hallazgos-carruseles.md`).
//
// ⚠️ Y lo editable viene DESPUÉS de lo fiel, no al revés: primero la imagen de fondo sin letras
// («la plancha»), encima las capas de texto. Al revés —texto primero, imagen nunca— es exactamente
// lo que produjo la réplica que Martín rechazó.
//
// ⚠️ LA PLANCHA NO ES UN DETALLE. Si el fondo todavía tiene las letras quemadas en los píxeles, el
// texto editable se superpone al quemado y **se ve dos veces**. Un fondo sin limpiar hace que todo
// esto parezca roto aunque el modelo esté bien.
// =============================================================================

import { ALTO_CARRUSEL, ANCHO_CARRUSEL, texto, rect } from './documento';

/**
 * Un bloque COPIADO de una referencia, con su tipografía propia.
 *
 * Todo lo tipográfico es obligatorio a propósito: un campo opcional que cae a un default es
 * justamente la herencia que este archivo existe para romper.
 */
export type BloqueMedido = {
  /** Nombre corto y en español; es lo que ve la persona en la lista de capas del editor. */
  readonly nombre: string;
  readonly texto: string;
  readonly familia: string;
  readonly peso: number;
  readonly italica: boolean;
  /** Cuerpo en px, en el espacio de 1080×1350. */
  readonly tam: number;
  readonly left: number;
  readonly top: number;
  readonly ancho: number;
  readonly color: string;
  /** Tracking en milésimas de em, como lo guarda el motor (`charSpacing`). 0 = normal. */
  readonly espaciado?: number;
  readonly alin?: 'left' | 'center' | 'right';
  readonly interlineado?: number;
  /** Una placa de color DETRÁS del texto. La del «Pa» de Breaking Bad es esto. */
  readonly placa?: { readonly left: number; readonly top: number; readonly ancho: number; readonly alto: number; readonly color: string; readonly radio?: number };
};

/** La plancha: la imagen de la referencia YA SIN LETRAS, a sangre. */
export type Plancha = { readonly src: string; readonly ajuste?: 'cover' | 'contain' };

/**
 * Las familias distintas que pide un conjunto de bloques, en el orden en que aparecen.
 *
 * Es el número que contesta la pregunta de Martín («¿cuántas tipografías hay?») y el que prueba que
 * la herencia se rompió: si da 1 cuando los bloques declaran 2, algo volvió a aplastar la familia.
 */
export const familiasDe = (bloques: readonly BloqueMedido[]): string[] =>
  [...new Set(bloques.map((b) => b.familia))];

/** Cada combinación distinta de familia + peso + itálica. Es lo que hay que poder CARGAR. */
export const variantesDe = (bloques: readonly BloqueMedido[]): string[] =>
  [...new Set(bloques.map((b) => `${b.familia} ${b.peso}${b.italica ? 'i' : ''}`))];

/**
 * Las variantes que el catálogo del editor NO tiene.
 *
 * ⚠️ ESTO NO ES PROLIJIDAD, ES LA FALLA SILENCIOSA DEL EDITOR. Lo dice el encabezado del propio
 * `app/image-editor/mako/fuentes.ts`: «un peso que no existe da 404 y el texto cae a la fuente del
 * sistema EN SILENCIO». O sea: se declara Playfair 900 itálica, el navegador no la encuentra, pinta
 * una Arial redonda, y la copia sale mal sin un solo error en ningún lado. Por eso se chequea ANTES
 * de guardar y no se confía en que «la fuente está en Google Fonts».
 *
 * `catalogo` es la lista de variantes que el editor sí sirve, en el mismo formato que `variantesDe`.
 */
export const faltanEnElCatalogo = (
  bloques: readonly BloqueMedido[],
  catalogo: readonly string[],
): string[] => {
  const hay = new Set(catalogo.map((v) => v.toLowerCase()));
  return variantesDe(bloques).filter((v) => !hay.has(v.toLowerCase()));
};

/**
 * El documento del editor para una copia fiel: la plancha de fondo y los bloques encima, **en el
 * orden en que vienen** (el primero queda abajo).
 *
 * Una placa se dibuja antes que su texto, si no lo tapa.
 */
export function documentoDeClon(o: {
  readonly plancha: Plancha;
  readonly bloques: readonly BloqueMedido[];
  readonly nombre: string;
  readonly nuevoId: () => string;
  readonly notas?: string;
}): Record<string, unknown> {
  const objetos: Record<string, unknown>[] = [];
  for (const b of o.bloques) {
    if (b.placa) {
      objetos.push(rect(o.nuevoId(), `${b.nombre}: placa`, {
        left: b.placa.left, top: b.placa.top, width: b.placa.ancho, height: b.placa.alto,
        fill: b.placa.color, radio: b.placa.radio ?? 0,
      }));
    }
    objetos.push(texto(o.nuevoId(), b.nombre, b.texto, {
      left: b.left, top: b.top, width: b.ancho, tam: b.tam, peso: b.peso, fam: b.familia,
      color: b.color, espaciado: b.espaciado, alin: b.alin, interlineado: b.interlineado ?? 1,
      italica: b.italica,
    }));
  }
  return {
    schemaVersion: 1,
    width: ANCHO_CARRUSEL,
    height: ALTO_CARRUSEL,
    unit: 'px',
    pages: [{
      id: o.nuevoId(),
      name: o.nombre,
      background: { type: 'image', src: o.plancha.src, fit: o.plancha.ajuste ?? 'cover' },
      objects: objetos,
      ...(o.notas ? { notes: o.notas } : {}),
    }],
  };
}
