// =============================================================================
// editor-landing/disenos-landing — el DISEÑO de una landing, separado del COPY
// =============================================================================
// Feedback de Martín (12/10/2026), textual: «veo que en las plantillas confundiste la plantilla de
// DISEÑO, con el COPY... En el panel principal, se tienen que ver plantillas del diseño, y al darle a
// una, puede salir un pop-up o algo así que te pregunte de que quieres crearla, y ahí las opciones de
// "Agendar llamada, webinar, lead magnet, y todas las opciones que pusiste"». Y: «aproveches las
// herramientas que tenemos dentro de MaKo, como por ejemplo, embed de calendly, de cal, de stripe, de
// mercado pago, del VSL ya sea en YouTube, Panda, Vimeo, etc... integres todo esto a las plantillas».
//
// Por eso son DOS ejes que se cruzan al crear:
//   · DISENOS_LANDING: cómo SE VE (tema + cómo se arma el hero + cómo alternan las imágenes).
//   · El OBJETIVO: qué DICE (el copy de cada plantilla de lib/editor-landing/plantillas.ts).
// `landingDesde(diseno, objetivo)` arma el contenido: el copy del objetivo, con los bloques de MaKo que
// ese objetivo usa (agenda de Calendly/Cal.com, VSL de YouTube/Panda/Vimeo/Wistia, botón de pago a un
// link de Stripe o Mercado Pago), vestido con el diseño. Los bloques entran VACÍOS a propósito: el
// insertado vacío es un marcador que el editor dibuja con «Pega el enlace» (lib/embeds.ts decide qué
// proveedores entran), y el botón de pago lleva a la sección del formulario hasta que se pegue el link.
//
// Pedido de Martín (14/10/2026), mirando la grilla «Diseños»: «Por favor, que la mayoría de las
// plantillas sean con un VIDEO, porque deberían ser tipo VSL Funnel... Puedes inspirarte en otras
// plantillas de VSL Funnel e incluso en la misma plantilla de MaKo.» Por eso el VSL es del DISEÑO
// (`video`), no sólo del objetivo: en un diseño con video el hero lleva el video para CUALQUIER
// objetivo, una sola vez (`conVideoDelDiseno`). Sin video queda sólo Minimal.
// Puro: lo usan la caja de crear (cliente) y los tests.
// =============================================================================

import { NODO, nuevoId, parrafo, type DisenoTarjeta, type JsonNodo, type LandingContenido } from './doc';
import { PLANTILLAS } from './plantillas';
import { claseDeProveedor } from '../embeds';

export type DisenoLanding = {
  id: string;
  nombre: string;
  descripcion: string;
  /** Id de TEMAS (lib/editor-landing/temas.ts). */
  tema: string;
  /** Imagen de acento del hero (la primera sección). */
  hero: DisenoTarjeta;
  /** Las secciones con imagen alternan izquierda/derecha (zigzag) o van todas igual. */
  zigzag: boolean;
  /**
   * El VSL del hero, como en los VSL funnels: 'centro' = pre-titular, titular y subtítulo arriba, el
   * video y el botón JUSTO debajo, todo centrado; 'costado' = el hero en dos columnas, el texto y el
   * botón a la izquierda y el video a la derecha (la landing de MaKo, app/vsl); null = sin video
   * (queda sólo el VSL que pone el objetivo, `conHerramientasMako`).
   */
  video: 'centro' | 'costado' | null;
};

// La descripción dice que lleva video (≤ 45 caracteres: es la línea de abajo de la miniatura).
export const DISENOS_LANDING: readonly DisenoLanding[] = [
  { id: 'mako', nombre: 'MaKo', descripcion: 'Como la de MaKo: texto y video.', tema: 'mako', hero: 'sin', zigzag: true, video: 'costado' },
  { id: 'claro-clasico', nombre: 'Clásico claro', descripcion: 'Video al centro y el botón debajo.', tema: 'pewter', hero: 'derecha', zigzag: true, video: 'centro' },
  { id: 'oscuro-moderno', nombre: 'Oscuro moderno', descripcion: 'Fondo profundo y video al centro.', tema: 'eclipse', hero: 'fondo', zigzag: false, video: 'centro' },
  { id: 'minimal', nombre: 'Minimal', descripcion: 'Sólo texto, mucho aire.', tema: 'commons', hero: 'sin', zigzag: false, video: null },
  { id: 'audaz', nombre: 'Audaz', descripcion: 'Contraste alto, video protagonista.', tema: 'torch', hero: 'izquierda', zigzag: true, video: 'centro' },
  { id: 'calido', nombre: 'Cálido', descripcion: 'Tonos tierra, serifa y video.', tema: 'espresso', hero: 'arriba', zigzag: true, video: 'centro' },
  { id: 'tecnologico', nombre: 'Tecnológico', descripcion: 'Monoespaciada, video al costado.', tema: 'syntax', hero: 'derecha', zigzag: false, video: 'costado' },
  { id: 'fresco', nombre: 'Fresco', descripcion: 'Verdes suaves y video al centro.', tema: 'mint', hero: 'izquierda', zigzag: true, video: 'centro' },
  { id: 'editorial', nombre: 'Editorial', descripcion: 'Serifa grande y video premium.', tema: 'botanical', hero: 'fondo', zigzag: false, video: 'centro' },
];

export type ObjetivoLanding = { id: string; nombre: string; descripcion: string; icono: string };

/** El ícono de cada objetivo en el pop-up (nombres de lib/editor-landing/iconos.ts). */
const ICONO_OBJETIVO: Readonly<Record<string, string>> = {
  'agenda-llamada': 'calendario-check', webinar: 'videollamada', 'lead-magnet': 'regalo', 'venta-directa': 'carrito',
  'servicio-local': 'ubicacion', 'lista-espera': 'reloj-arena', 'curso-programa': 'graduacion', gracias: 'corazon',
  consultoria: 'llamada', 'app-software': 'laptop',
};

/** Los objetivos (el COPY) son las plantillas de landing que ya existen, por su id. */
export const OBJETIVOS_LANDING: readonly ObjetivoLanding[] = PLANTILLAS.map((p) => ({
  id: p.id, nombre: p.nombre, descripcion: p.descripcion, icono: ICONO_OBJETIVO[p.id] ?? 'objetivo',
}));

/** Qué herramienta de MaKo usa cada objetivo. */
const AGENDA = new Set(['agenda-llamada', 'consultoria']);
const VSL = new Set(['webinar', 'venta-directa', 'curso-programa', 'lista-espera']);
const PAGO = new Set(['venta-directa', 'curso-programa', 'app-software']);

function insertadoVacio(proveedor: 'calendly' | 'youtube'): JsonNodo {
  return { type: NODO.insertado, attrs: { src: '', proveedor, alto: null } };
}

function idFormulario(tarjetas: JsonNodo[]): string | null {
  const t = tarjetas.find((x) => JSON.stringify(x).includes(`"type":"${NODO.formulario}"`));
  return (t?.attrs?.id as string | undefined) ?? null;
}

function botonPago(destino: string): JsonNodo {
  return {
    type: NODO.botones, attrs: { alinea: 'izquierda' },
    content: [{ type: NODO.boton, attrs: { href: destino, variante: 'primario', nuevaPestana: false }, content: [{ type: 'text', text: 'Pagar ahora' }] }],
  };
}

/** Los bloques de MaKo que usa el objetivo, metidos donde corresponde. Exportada para el test. */
export function conHerramientasMako(c: LandingContenido, objetivo: string): LandingContenido {
  const copia: LandingContenido = JSON.parse(JSON.stringify(c));
  const pagina = copia.paginas[0];
  if (!pagina) return copia;
  const tarjetas = pagina.doc.content;
  const hero = tarjetas[0];
  if (hero && VSL.has(objetivo)) {
    // El VSL va en el hero, después del subtítulo: es lo primero que se mira.
    hero.content = [...(hero.content ?? []).slice(0, 3), insertadoVacio('youtube'), ...(hero.content ?? []).slice(3)];
  }
  if (AGENDA.has(objetivo)) {
    // La agenda va en una sección propia antes del cierre: Calendly o Cal.com (lo decide el enlace que se pegue).
    const agenda: JsonNodo = {
      type: NODO.tarjeta,
      attrs: { ...(tarjetas[0]?.attrs ?? {}), id: nuevoId('t'), diseno: 'sin', imagenSrc: null, notas: 'Pega el enlace de tu agenda (Calendly o Cal.com) en el bloque.' },
      content: [{ type: 'heading', attrs: { level: 2, variante: null }, content: [{ type: 'text', text: 'Elige el horario que te quede mejor' }] }, parrafo('La llamada dura 30 minutos y es por videollamada.'), insertadoVacio('calendly')],
    };
    tarjetas.splice(Math.max(1, tarjetas.length - 1), 0, agenda);
  }
  if (PAGO.has(objetivo)) {
    // El botón de pago (link de Stripe o Mercado Pago) va en la sección del formulario o, si no hay, en el cierre.
    const destino = idFormulario(tarjetas) ? `#t-${idFormulario(tarjetas)}` : '#';
    const cierre = tarjetas[tarjetas.length - 1];
    // La instrucción va en las NOTAS de la sección, no en un párrafo: un párrafo se publica y lo lee el visitante.
    if (cierre) {
      cierre.content = [...(cierre.content ?? []), botonPago(destino)];
      cierre.attrs = { ...(cierre.attrs ?? {}), notas: 'Pega en «Pagar ahora» el link de pago de Stripe o Mercado Pago.' };
    }
  }
  return copia;
}

/** Viste el contenido con el diseño: el hero y el zigzag de las imágenes. */
export function aplicarDiseno(c: LandingContenido, d: DisenoLanding): LandingContenido {
  const copia: LandingContenido = JSON.parse(JSON.stringify(c));
  for (const pagina of copia.paginas) {
    let lado: 'izquierda' | 'derecha' = d.hero === 'izquierda' ? 'derecha' : 'izquierda';
    pagina.doc.content.forEach((t, i) => {
      if (t.type !== NODO.tarjeta || !t.attrs) return;
      if (i === 0 && pagina === copia.paginas[0]) { t.attrs.diseno = d.hero; return; }
      const actual = t.attrs.diseno as DisenoTarjeta;
      if (actual === 'izquierda' || actual === 'derecha') {
        t.attrs.diseno = d.zigzag ? lado : (d.hero === 'izquierda' || d.hero === 'derecha' ? d.hero : actual);
        lado = lado === 'izquierda' ? 'derecha' : 'izquierda';
      }
    });
  }
  return copia;
}

// ─────────────────────────────────────────────────────────────────────────────
// El VSL del diseño (pedido de Martín, 14/10/2026: «que la mayoría de las plantillas sean con un
// VIDEO, porque deberían ser tipo VSL Funnel»)
// ─────────────────────────────────────────────────────────────────────────────

/** ¿Es el video de un VSL? Un insertado de un proveedor de VIDEO de lib/embeds.ts (vacío con su pista, o con enlace). */
const esVideo = (n: JsonNodo): boolean => n.type === NODO.insertado && claseDeProveedor(n.attrs?.proveedor) === 'video';
/** Lo que pide la acción (el botón o el formulario): el video va JUSTO antes. */
const esAccion = (n: JsonNodo): boolean => n.type === NODO.botones || n.type === NODO.formulario;
const esTexto = (n: JsonNodo): boolean => n.type === 'paragraph' || n.type === 'heading';

/**
 * El «Título» display (5em) pasa a un h1 (2.5em) en un hero con video. Medido en la miniatura 16/10 de la
 * grilla (14/10/2026, Chrome sin cabeza, copy de la agenda): con el display el titular va en 3 renglones
 * al centro (el video, cortado 94 a 220px de 281) y en 8 o 9 al costado (ahí se corta el propio titular);
 * con el h1, en 2 y en 4 o 5. Con el h1 y el video angosto de la miniatura (css.ts) entran el titular, el
 * video entero y el botón en los 8 diseños con video. Es además el tamaño del titular de la landing de
 * MaKo: 44px allá, 45px el h1 de la publicada en escritorio (2.5em de 18px, css.ts).
 */
function sinTituloDisplay(n: JsonNodo): JsonNodo {
  if (n.type === NODO.columnas || n.type === NODO.columna) return { ...n, content: (n.content ?? []).map(sinTituloDisplay) };
  if (n.type !== 'heading' || n.attrs?.variante !== 'titulo') return n;
  return { ...n, attrs: { ...n.attrs, level: 1, variante: null } };
}

/** La lista con el video justo antes del primer botón o formulario, o al final si no hay (la página de gracias). */
function antesDeLaAccion(lista: JsonNodo[], video: JsonNodo): JsonNodo[] {
  const i = lista.findIndex(esAccion);
  return i < 0 ? [...lista, video] : [...lista.slice(0, i), video, ...lista.slice(i)];
}

/**
 * El video del diseño en el hero (la primera sección de la primera página), UNA vez: si el objetivo ya
 * puso su VSL (`conHerramientasMako`), se MUEVE ese mismo nodo; si no, entra uno vacío con la pista de
 * YouTube (el editor pide «el enlace de tu video»; el proveedor real lo decide lo que se pegue). El
 * objetivo sigue mandando en el copy: acá sólo se reordena, se alinea y se achica el titular.
 *   · 'centro': pre-titular → titular → subtítulo → VIDEO → botones (o formulario) → lo demás, con los
 *     textos centrados y los botones al centro. Sin botón ni formulario (la página de gracias), el video
 *     va al final del hero: es el «qué sigue».
 *   · 'costado': dos columnas, 5 de 12 para el texto y el botón y 7 para el video. Un hero que ya era
 *     columnas (el lead magnet: texto | formulario) se aplana a la izquierda, y el video va a la derecha.
 *   · Un hero en columnas con el video al 'centro' (el lead magnet) conserva sus columnas: el video va en
 *     la primera, debajo del texto, y el formulario sigue al lado (centrar el texto junto a un formulario
 *     no se lee).
 * No toca los atributos de la sección: la agenda de `conHerramientasMako` copia los del hero.
 */
export function conVideoDelDiseno(c: LandingContenido, d: DisenoLanding): LandingContenido {
  const copia: LandingContenido = JSON.parse(JSON.stringify(c));
  const hero = copia.paginas[0]?.doc.content[0];
  if (!hero || hero.type !== NODO.tarjeta) return copia;
  if (!d.video) {
    // Sin video del diseño (Minimal) queda el VSL del objetivo donde el objetivo lo puso, y el titular
    // se achica igual: es un hero con video y el display lo dejaba cortado en la miniatura.
    if ((hero.content ?? []).some(esVideo)) hero.content = (hero.content ?? []).map(sinTituloDisplay);
    return copia;
  }

  // El VSL que haya puesto el objetivo (suelto o adentro de una columna) sale de donde está.
  const hallados: JsonNodo[] = [];
  const sacarVideo = (lista: JsonNodo[]): JsonNodo[] => lista.flatMap((n): JsonNodo[] => {
    if (!hallados.length && esVideo(n)) { hallados.push(n); return []; }
    if (n.type !== NODO.columnas) return [n];
    // Una columna que queda vacía lleva un párrafo: el esquema no admite una columna sin bloques.
    return [{ ...n, content: (n.content ?? []).map((col) => { const resto = sacarVideo(col.content ?? []); return { ...col, content: resto.length ? resto : [parrafo()] }; }) }];
  });
  const bloques = sacarVideo(hero.content ?? []).map(sinTituloDisplay);
  const video = hallados[0] ?? insertadoVacio('youtube');

  if (d.video === 'costado') {
    const planos = bloques.flatMap((n) => (n.type === NODO.columnas ? (n.content ?? []).flatMap((col) => col.content ?? []) : [n]));
    hero.content = [{
      type: NODO.columnas,
      attrs: { anchos: [5, 7], divisores: false },
      content: [{ type: NODO.columna, content: planos.length ? planos : [parrafo()] }, { type: NODO.columna, content: [video] }],
    }];
    return copia;
  }

  const columnas = bloques.find((n) => n.type === NODO.columnas);
  const primera = columnas?.content?.[0];
  if (primera) {
    primera.content = antesDeLaAccion(primera.content ?? [], video);
    hero.content = bloques;
    return copia;
  }
  hero.content = antesDeLaAccion(bloques, video).map((n): JsonNodo => {
    if (esTexto(n)) return { ...n, attrs: { ...(n.attrs ?? {}), textAlign: 'center' } };
    if (n.type === NODO.botones) return { ...n, attrs: { ...(n.attrs ?? {}), alinea: 'centro' } };
    return n;
  });
  return copia;
}

/** El contenido de una landing nueva: el copy del objetivo, con lo de MaKo, vestido con el diseño. */
export function landingDesde(d: DisenoLanding, objetivo: string): LandingContenido | null {
  const p = PLANTILLAS.find((x) => x.id === objetivo);
  if (!p) return null;
  // El video del diseño va DESPUÉS de las herramientas del objetivo: así reusa el VSL que el objetivo ya
  // puso (entra una vez) y la agenda copia los atributos del hero tal como vinieron.
  return aplicarDiseno(conVideoDelDiseno(conHerramientasMako(p.contenido(), objetivo), d), d);
}
