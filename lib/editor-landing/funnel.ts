// =============================================================================
// El funnel de una landing: sus páginas en el orden en que las recorre un lead (13/11/2026)
// =============================================================================
// Pedido de Martín (vía Cerebro): «la vista de funnel, como en GoHighLevel: las páginas del negocio encadenadas en el orden en
// que las recorre un lead (formulario → VSL → agenda → página de gracias), viendo de qué página va a cuál, con botones para
// crear la siguiente y conectarlas». Leila: «los embudos son páginas web que tienen diferentes objetivos».
//
// No hace falta modelo nuevo: una landing ya tiene hasta 12 páginas (doc.ts, `Pagina`), un botón lleva a otra con
// `href: 'pagina:<id>'` y el formulario tiene `redirigir`. Acá, PURO:
//   · `recorridoDe`: los pasos en el ORDEN del panel de páginas (que ya se reordena arrastrando, como los pasos de GHL), lo que
//     conecta cada uno con el siguiente (el formulario al enviarse, o un botón) o que no lo conecta nada, y a qué otras
//     páginas lleva además;
//   · `objetivoDe`: qué hace cada página, deducido de lo que tiene (un formulario, un video, un calendario, un botón de pago);
//   · `conectar`: que una página lleve a otra (el formulario si no manda a ninguna; si no, su botón principal; si no tiene,
//     uno nuevo al final);
//   · `paginaDePaso`: la página nueva de «+ Siguiente paso», con lo justo de su objetivo.
// La vista es app/web-generator/editor/DialogoFunnel.tsx.
// =============================================================================
import { NODO, docPagina, nuevoId, parrafo, tarjeta, titulo, type DocPagina, type JsonNodo, type Pagina } from './doc';
import { claseDeProveedor } from '../embeds';
import { rutaLibre } from './paginas-reglas';

export const OBJETIVOS_PASO = ['formulario', 'vsl', 'agenda', 'venta', 'gracias'] as const;
export type ObjetivoPaso = (typeof OBJETIVOS_PASO)[number];

/** Lo que dice cada objetivo, en la tarjeta del paso y en «+ Siguiente paso». */
export const OBJETIVO_PASO: Record<ObjetivoPaso, { nombre: string; accion: string; ruta: string }> = {
  formulario: { nombre: 'Formulario', accion: 'Dejar sus datos', ruta: 'registro' },
  vsl: { nombre: 'Video', accion: 'Ver el video', ruta: 'video' },
  agenda: { nombre: 'Agenda', accion: 'Agendar', ruta: 'agenda' },
  venta: { nombre: 'Página de venta', accion: 'Comprar', ruta: 'oferta' },
  gracias: { nombre: 'Gracias', accion: 'Confirmar', ruta: 'gracias' },
};

/** Lo que lleva de una página a otra. */
export type Conexion = { hacia: string; por: 'formulario' | 'boton' | 'enlace'; texto: string };

const idDeHref = (href: unknown): string | null => (typeof href === 'string' && href.startsWith('pagina:') ? href.slice(7) || null : null);

const recorrer = (n: JsonNodo | undefined, f: (n: JsonNodo) => void) => {
  if (!n) return;
  f(n);
  for (const c of n.content ?? []) recorrer(c, f);
};

/** A qué páginas lleva una (en el orden del documento: el formulario, los botones, los enlaces del texto). */
export function conexionesDe(doc: DocPagina | JsonNodo | null | undefined): Conexion[] {
  const out: Conexion[] = [];
  const sumar = (c: Conexion) => { if (!out.some((x) => x.hacia === c.hacia && x.por === c.por && x.texto === c.texto)) out.push(c); };
  recorrer(doc as JsonNodo, (n) => {
    if (n.type === NODO.formulario) {
      const hacia = idDeHref(n.attrs?.redirigir);
      if (hacia) sumar({ hacia, por: 'formulario', texto: String(n.attrs?.boton ?? '') || 'Enviar' });
    }
    if (n.type === NODO.boton) {
      const hacia = idDeHref(n.attrs?.href);
      if (hacia) sumar({ hacia, por: 'boton', texto: textoPlano(n) });
    }
    if (n.type === 'text') {
      for (const m of n.marks ?? []) {
        const hacia = m.type === 'link' ? idDeHref(m.attrs?.href) : null;
        if (hacia) sumar({ hacia, por: 'enlace', texto: String((n as { text?: string }).text ?? '').trim() });
      }
    }
  });
  return out;
}

const textoPlano = (n: JsonNodo): string => {
  let t = '';
  recorrer(n, (x) => { if (x.type === 'text') t += String((x as { text?: string }).text ?? ''); });
  return t.replace(/\s+/g, ' ').trim();
};

/** Qué hace la página, por lo que tiene. null si nada lo dice (una página de contenido). */
export function objetivoDe(p: Pick<Pagina, 'titulo' | 'ruta' | 'doc'>): ObjetivoPaso | null {
  let formulario = false;
  let video = false;
  let agenda = false;
  let pago = false;
  recorrer(p.doc as JsonNodo, (n) => {
    if (n.type === NODO.formulario) formulario = true;
    if (n.type === NODO.video) video = true;
    if (n.type === NODO.insertado) {
      const clase = claseDeProveedor(n.attrs?.proveedor);
      if (clase === 'agenda') agenda = true;
      if (clase === 'video') video = true;
    }
    if (n.type === NODO.boton && typeof n.attrs?.href === 'string' && n.attrs.href.startsWith('pago:')) pago = true;
  });
  if (agenda) return 'agenda';
  if (formulario) return 'formulario';
  if (pago) return 'venta';
  if (video) return 'vsl';
  const nombre = `${p.titulo} ${p.ruta}`;
  if (/gracias|confirmad|listo|bienvenid/i.test(nombre)) return 'gracias';
  if (/oferta|venta|compra|checkout|precio/i.test(nombre)) return 'venta';
  return null;
}

export type PasoDelFunnel = {
  pagina: Pagina;
  objetivo: ObjetivoPaso | null;
  /** Lo que lleva al PASO SIGUIENTE (null en el último, o si nada lo conecta). */
  siguiente: Conexion | null;
  /** El último no necesita salida si confirma o vende; los demás, sí. */
  sinSalida: boolean;
  /** A qué otras páginas lleva (además del paso siguiente). */
  otras: Conexion[];
};

/**
 * Los pasos del funnel: las páginas en el orden del panel, con lo que conecta cada una con la siguiente. `docDe` da el documento
 * vivo de la página abierta (el del editor), si no, el guardado.
 */
export function recorridoDe(paginas: readonly Pagina[], docDe: (p: Pagina) => DocPagina = (p) => p.doc): PasoDelFunnel[] {
  return paginas.map((pagina, i) => {
    const doc = docDe(pagina);
    const conexiones = conexionesDe(doc);
    const prox = paginas[i + 1];
    const siguiente = prox ? conexiones.find((c) => c.hacia === prox.id) ?? null : null;
    const objetivo = objetivoDe({ ...pagina, doc });
    const ultimo = !prox;
    const sinSalida = ultimo ? !conexiones.length && objetivo !== 'gracias' && objetivo !== 'venta' && paginas.length > 1 : !siguiente;
    const otras = conexiones.filter((c) => c !== siguiente && c.hacia !== pagina.id && paginas.some((x) => x.id === c.hacia));
    return { pagina, objetivo, siguiente, sinSalida, otras };
  });
}

/**
 * Que la página lleve a `hacia`. Si ya lleva a `antes` (la flecha que se cambia), eso pasa a `hacia`; si no: el formulario que
 * no manda a ninguna página, o el primer botón que no lleva a otra página, o un botón nuevo al final. Devuelve el documento y
 * qué la conecta. Puro.
 */
export function conectar(doc: DocPagina, hacia: string, antes: string | null = null, textoBoton = 'Seguir'): { doc: DocPagina; conexion: Conexion } {
  const destino = `pagina:${hacia}`;
  let hecho: Conexion | null = null;
  const cambiar = (n: JsonNodo, f: (n: JsonNodo) => JsonNodo | null): JsonNodo => {
    if (hecho) return n;
    const r = f(n);
    if (r) return r;
    return n.content ? { ...n, content: n.content.map((c) => cambiar(c, f)) } : n;
  };
  let nuevo = doc as JsonNodo;
  if (antes) {
    // La flecha que ya estaba: lo que llevaba a `antes` lleva a `hacia`.
    nuevo = cambiar(nuevo, (n) => {
      if (n.type === NODO.formulario && idDeHref(n.attrs?.redirigir) === antes) {
        hecho = { hacia, por: 'formulario', texto: String(n.attrs?.boton ?? '') || 'Enviar' };
        return { ...n, attrs: { ...n.attrs, redirigir: destino } };
      }
      if (n.type === NODO.boton && idDeHref(n.attrs?.href) === antes) {
        hecho = { hacia, por: 'boton', texto: textoPlano(n) };
        return { ...n, attrs: { ...n.attrs, href: destino, nuevaPestana: false } };
      }
      return null;
    });
  }
  if (!hecho) {
    nuevo = cambiar(nuevo, (n) => {
      if (n.type === NODO.formulario && !idDeHref(n.attrs?.redirigir)) {
        hecho = { hacia, por: 'formulario', texto: String(n.attrs?.boton ?? '') || 'Enviar' };
        return { ...n, attrs: { ...n.attrs, redirigir: destino } };
      }
      return null;
    });
  }
  if (!hecho) {
    nuevo = cambiar(nuevo, (n) => {
      const href = n.type === NODO.boton ? String(n.attrs?.href ?? '') : '';
      if (n.type === NODO.boton && !idDeHref(href) && !href.startsWith('pago:')) {
        hecho = { hacia, por: 'boton', texto: textoPlano(n) };
        return { ...n, attrs: { ...n.attrs, href: destino, nuevaPestana: false } };
      }
      return null;
    });
  }
  if (!hecho) {
    // Sin formulario ni botón libre: uno nuevo al final de la última sección.
    const secciones = nuevo.content ?? [];
    const ultima = secciones[secciones.length - 1];
    const boton: JsonNodo = { type: NODO.botones, attrs: { alinea: 'centro' }, content: [{ type: NODO.boton, attrs: { href: destino, variante: 'primario', nuevaPestana: false }, content: [{ type: 'text', text: textoBoton }] }] };
    nuevo = ultima
      ? { ...nuevo, content: [...secciones.slice(0, -1), { ...ultima, content: [...(ultima.content ?? []), boton] }] }
      : { ...nuevo, content: [tarjeta([boton])] };
    hecho = { hacia, por: 'boton', texto: textoBoton };
  }
  return { doc: nuevo as DocPagina, conexion: hecho as Conexion };
}

const boton = (texto: string, href = '#'): JsonNodo => ({
  type: NODO.botones, attrs: { alinea: 'izquierda' },
  content: [{ type: NODO.boton, attrs: { href, variante: 'primario', nuevaPestana: false }, content: [{ type: 'text', text: texto }] }],
});

/** Lo justo de cada objetivo: un título y un texto a completar, y lo que lo hace (el formulario, el video, el calendario…). */
function contenidoDePaso(objetivo: ObjetivoPaso): JsonNodo[] {
  switch (objetivo) {
    case 'formulario':
      return [titulo('[Lo que se lleva quien deja sus datos]', 1, 'titulo'), parrafo('[Una frase de por qué vale la pena]'),
        { type: NODO.formulario, attrs: { campos: [
          { id: nuevoId('c'), tipo: 'nombre', etiqueta: 'Nombre', requerido: true, opciones: [] },
          { id: nuevoId('c'), tipo: 'email', etiqueta: 'Correo electrónico', requerido: true, opciones: [] },
          { id: nuevoId('c'), tipo: 'telefono', etiqueta: 'WhatsApp', requerido: false, opciones: [] },
        ], boton: 'Quiero mi lugar', exito: '¡Listo! Te escribimos en un momento.', redirigir: null } }];
    case 'vsl':
      return [titulo('[El titular del video]', 1, 'titulo'), { type: NODO.video, attrs: { src: '', ancho: 100, autoplay: false, bucle: false, poster: null } },
        parrafo('[Lo que va a ver en el video]'), boton('Quiero agendar')];
    case 'agenda':
      return [titulo('Elige el día y la hora de tu llamada', 1, 'titulo'), parrafo('[Qué va a pasar en la llamada]'),
        { type: NODO.insertado, attrs: { src: '', proveedor: 'calendly', alto: null } }];
    case 'venta':
      return [titulo('[La oferta]', 1, 'titulo'), parrafo('[Qué incluye, para quién es y la garantía]'), boton('Comprar ahora')];
    case 'gracias':
      return [titulo('¡Listo! [Lo que pasa ahora]', 1, 'titulo'), parrafo('[El próximo paso: revisar el correo, unirse al grupo, prepararse para la llamada]')];
  }
}

/** La página nueva de «+ Siguiente paso»: su título, una ruta libre y lo justo de su objetivo. */
export function paginaDePaso(objetivo: ObjetivoPaso, paginas: readonly Pagina[]): Pagina {
  const o = OBJETIVO_PASO[objetivo];
  return {
    id: nuevoId('p'),
    titulo: o.nombre,
    ruta: rutaLibre(o.ruta, paginas.map((p) => p.ruta).filter(Boolean)),
    doc: docPagina([tarjeta(contenidoDePaso(objetivo))]),
  };
}
