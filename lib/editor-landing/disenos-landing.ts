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
// Puro: lo usan la caja de crear (cliente) y los tests.
// =============================================================================

import { NODO, nuevoId, parrafo, type DisenoTarjeta, type JsonNodo, type LandingContenido } from './doc';
import { PLANTILLAS } from './plantillas';

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
};

export const DISENOS_LANDING: readonly DisenoLanding[] = [
  { id: 'claro-clasico', nombre: 'Clásico claro', descripcion: 'Limpio, con la imagen a la derecha.', tema: 'pewter', hero: 'derecha', zigzag: true },
  { id: 'oscuro-moderno', nombre: 'Oscuro moderno', descripcion: 'Fondo profundo y títulos con brillo.', tema: 'eclipse', hero: 'fondo', zigzag: false },
  { id: 'minimal', nombre: 'Minimal', descripcion: 'Sólo texto, mucho aire.', tema: 'commons', hero: 'sin', zigzag: false },
  { id: 'audaz', nombre: 'Audaz', descripcion: 'Contraste alto y un acento fuerte.', tema: 'torch', hero: 'izquierda', zigzag: true },
  { id: 'calido', nombre: 'Cálido', descripcion: 'Tonos tierra y tipografía con serifa.', tema: 'espresso', hero: 'arriba', zigzag: true },
  { id: 'tecnologico', nombre: 'Tecnológico', descripcion: 'Monoespaciada y bordes finos.', tema: 'syntax', hero: 'derecha', zigzag: false },
  { id: 'fresco', nombre: 'Fresco', descripcion: 'Verdes suaves y bordes redondeados.', tema: 'mint', hero: 'izquierda', zigzag: true },
  { id: 'editorial', nombre: 'Editorial', descripcion: 'Serifa grande, como una revista.', tema: 'botanical', hero: 'fondo', zigzag: false },
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

/** El contenido de una landing nueva: el copy del objetivo, con lo de MaKo, vestido con el diseño. */
export function landingDesde(d: DisenoLanding, objetivo: string): LandingContenido | null {
  const p = PLANTILLAS.find((x) => x.id === objetivo);
  if (!p) return null;
  return aplicarDiseno(conHerramientasMako(p.contenido(), objetivo), d);
}
