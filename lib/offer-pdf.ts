// =============================================================================
// offer-pdf — el PDF de la conclusión de la tab Offer
// =============================================================================
// PURO (sin `server-only`, sin base de datos): recibe la conclusión YA guardada y
// devuelve los bytes. La ruta app/api/offer/pdf/route.ts lee la sesión del
// workspace y llama acá; los tests lo llaman directo y leen el resultado de vuelta
// con unpdf para comprobar que el texto llega entero.
//
// El documento es para el DUEÑO del negocio (no para mandarle a un prospecto): por
// eso lleva el diagnóstico, los números y los datos «[completar]». Una versión
// externa, sin lo interno, quedó anotada como pendiente en docs/hallazgos-offer.md.
//
// Siempre sale CLARO aunque la persona use la app en oscuro: un PDF se imprime y se
// reenvía, y un `var(--token)` no existe adentro de un archivo. Los hex están
// copiados de app/globals.css con el token anotado al lado (molde: la `const C` de
// lib/email-html.ts): es lo único que permite darse cuenta cuando la app cambia de
// paleta y el PDF queda viejo.
// =============================================================================

import { DIMENSIONES, MARCA_COMPLETAR, dimensionLabel, type ConclusionOferta, type PropuestaOferta } from './offer-marco';
import { PdfDoc } from './pdf-escritor';

/** Copia LITERAL de app/globals.css (tema claro). */
const C = {
  tinta: '#12151B',     // --ink
  dim: '#454C57',       // --dim
  tenue: '#66707F',     // --faint
  linea: '#EAECF1',     // --border
  suave: '#F5F7FA',     // --surface-2
  azul: '#2F6FED',      // --primary
  mako: '#F2B01E',      // --mako
  makoFondo: '#FDF4DE', // --mako-bg
  makoTinta: '#8F6709', // --mako-ink
  bien: '#1E9E57',      // --good
  bienFondo: '#E7F5EC', // --good-bg
  ojo: '#B4530E',       // --warn
  ojoFondo: '#FDEEE1',  // --warn-bg
  mal: '#D0504A',       // --bad
};

/** El color de una nota 0-10, con los mismos cortes que la pantalla. */
const colorNota = (n: number): string => (n <= 3 ? C.mal : n <= 6 ? C.ojo : C.bien);

export type MetaPdfOferta = {
  negocio: string;
  titulo: string;
  fecha: Date;
  /** Zona horaria del negocio para escribir la fecha; default la de México. */
  zona?: string;
};

function fechaCorta(d: Date, zona?: string): string {
  try {
    return new Intl.DateTimeFormat('es-MX', { timeZone: zona || 'America/Mexico_City', day: '2-digit', month: '2-digit', year: 'numeric' }).format(d);
  } catch {
    return d.toISOString().slice(0, 10);
  }
}

/** Parte un texto en tramos para que «[completar]» salga en naranja y negrita. */
function tramosConCompletar(t: string, color = C.tinta) {
  const partes = (t || '').split(MARCA_COMPLETAR);
  const out: Array<{ t: string; color?: string; fuente?: 'Helvetica' | 'Helvetica-Bold' }> = [];
  partes.forEach((p, i) => {
    if (p) out.push({ t: p, color });
    if (i < partes.length - 1) out.push({ t: MARCA_COMPLETAR, color: C.ojo, fuente: 'Helvetica-Bold' });
  });
  return out.length ? out : [{ t: '—', color: C.tenue }];
}

const lleno = (s: string | undefined | null): boolean => !!(s && s.trim());

/**
 * Slug ASCII para el Content-Disposition. Un carácter por encima de 255 en el
 * header (el «—» que MaKo escribe siempre) hace TIRAR a Node con «Cannot convert
 * argument to a ByteString», o sea un 500 sobre un PDF perfectamente generado.
 * Molde del slug: app/api/second-brain/exportar/route.ts.
 */
export function nombreArchivoOferta(titulo: string, version: number): string {
  const slug = (titulo || 'oferta')
    .normalize('NFD').replace(/[̀-ͯ]/g, '')
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, '-')
    .replace(/^-+|-+$/g, '')
    .slice(0, 60) || 'oferta';
  const v = Number.isFinite(version) && version > 0 ? Math.floor(version) : 1;
  return `oferta-${slug}-v${v}.pdf`;
}

/** Genera el PDF de una conclusión. Nunca tira por el contenido: lo que no entra se corta en líneas y páginas. */
export function pdfDeOferta(c: ConclusionOferta, meta: MetaPdfOferta): Uint8Array {
  const fecha = fechaCorta(meta.fecha, meta.zona);
  const doc = new PdfDoc({ pie: `Generado por MaKo · ${fecha}` });
  const W = doc.anchoUtil;
  const X = doc.margen;
  const p = c.propuesta;
  const d = c.diagnostico;

  // ── Portada ────────────────────────────────────────────────────────────────
  doc.rect(0, 0, doc.ancho, 6, { relleno: C.mako });
  doc.y = 40;
  doc.texto('MAKO · OFFER', { tam: 8, fuente: 'Helvetica-Bold', color: C.makoTinta, despues: 8 });
  doc.texto(p.nombre || meta.titulo || 'Tu oferta', { tam: 24, fuente: 'Helvetica-Bold', interlinea: 1.2, despues: 6 });
  if (lleno(p.frase)) doc.textoRico(tramosConCompletar(p.frase, C.dim), { tam: 13, interlinea: 1.4, despues: 8 });
  const metaLinea = [meta.negocio, fecha, `Versión ${c.version}`].filter(Boolean).join('  ·  ');
  doc.texto(metaLinea, { tam: 9, color: C.tenue, despues: 16 });

  // ── Puntaje ────────────────────────────────────────────────────────────────
  const altoPanel = 74;
  doc.asegurar(altoPanel + 10);
  const yp = doc.y;
  doc.rect(X, yp, W, altoPanel, { relleno: C.suave, borde: C.linea, radio: 10 });
  doc.textoEn(X + 18, yp + 22, 'PUNTAJE', { tam: 8, fuente: 'Helvetica-Bold', color: C.tenue });
  const total = String(c.calculo.total);
  doc.textoEn(X + 18, yp + 56, total, { tam: 32, fuente: 'Helvetica-Bold' });
  doc.textoEn(X + 20 + doc.anchoDe(total, 'Helvetica-Bold', 32), yp + 56, '/100', { tam: 12, color: C.tenue });
  const xEstado = X + 150;
  const lista = c.calculo.lista;
  const estado = lista ? 'Lista para vender' : `Lo que más frena: ${dimensionLabel(c.calculo.cuello)}`;
  doc.textoEn(xEstado, yp + 28, estado, { tam: 12, fuente: 'Helvetica-Bold', color: lista ? C.bien : C.ojo });
  doc.barra(xEstado, yp + 40, W - (xEstado - X) - 18, 8, c.calculo.total / 100, lista ? C.bien : colorNota(Math.round(c.calculo.total / 10)));
  doc.y = yp + altoPanel + 22;

  // ── Diagnóstico ────────────────────────────────────────────────────────────
  seccion(doc, 'Diagnóstico');
  if (lleno(d.tesis)) doc.textoRico(tramosConCompletar(d.tesis), { tam: 12, interlinea: 1.45, despues: 12 });

  const notas = new Map(d.dimensiones.map((n) => [n.id, n]));
  const xBarra = X + 160;
  const anchoBarra = W - 160 - 44;
  for (const dim of DIMENSIONES) {
    const n = notas.get(dim.id);
    if (!n) continue;
    const altoPorque = lleno(n.porque) ? doc.medir(n.porque, { tam: 8.5, sangria: 0 }) : 0;
    doc.asegurar(18 + altoPorque + 8);
    const y0 = doc.y;
    doc.textoEn(X, y0 + 10, dim.label, { tam: 10, fuente: 'Helvetica-Bold' });
    doc.barra(xBarra, y0 + 3, anchoBarra, 7, n.nota / 10, colorNota(n.nota));
    doc.textoEn(X + W, y0 + 10, `${n.nota}/10`, { tam: 10, fuente: 'Helvetica-Bold', color: colorNota(n.nota), alinear: 'der' });
    doc.y = y0 + 16;
    if (lleno(n.porque)) doc.texto(n.porque, { tam: 8.5, color: C.dim, interlinea: 1.35 });
    doc.y += 7;
  }
  doc.y += 4;
  if (lleno(d.fuerte)) {
    doc.texto('Lo más fuerte', { tam: 10, fuente: 'Helvetica-Bold', color: C.bien, conSiguiente: 14 });
    doc.textoRico(tramosConCompletar(d.fuerte), { tam: 10, despues: 10 });
  }
  if (c.calculo.alertas.length) caja(doc, 'Para tener en cuenta', c.calculo.alertas, C.ojoFondo, C.ojo);

  if (d.cambios.length) {
    doc.texto('Lo primero que cambiaría', { tam: 12, fuente: 'Helvetica-Bold', conSiguiente: 30, despues: 4 });
    d.cambios.forEach((cb, i) => {
      doc.texto(`${i + 1}. ${cb.titulo}`, { tam: 10.5, fuente: 'Helvetica-Bold', conSiguiente: 12 });
      if (lleno(cb.porque)) doc.textoRico(tramosConCompletar(cb.porque, C.dim), { tam: 9.5, sangria: 14 });
      if (lleno(cb.hipotesis)) doc.textoRico([{ t: 'Para probar: ', fuente: 'Helvetica-Bold', color: C.azul }, ...tramosConCompletar(cb.hipotesis, C.dim)], { tam: 9.5, sangria: 14 });
      doc.y += 6;
    });
  }

  // ── La oferta nueva ────────────────────────────────────────────────────────
  doc.y += 8;
  seccion(doc, 'Tu oferta nueva');
  if (p.completar.length) caja(doc, `${p.completar.length} ${p.completar.length === 1 ? 'dato para completar' : 'datos para completar'}`, p.completar, C.ojoFondo, C.ojo);

  for (const [titulo, cuerpo] of seccionesPropuesta(p)) {
    if (!cuerpo.length) continue;
    doc.texto(titulo, { tam: 11.5, fuente: 'Helvetica-Bold', conSiguiente: 16, despues: 2 });
    for (const b of cuerpo) {
      if (b.vineta) {
        // La viñeta se dibuja a mano en la línea donde va a arrancar el texto: por
        // eso primero se asegura el lugar (si el texto saltara de página, la viñeta
        // quedaría huérfana al pie de la anterior).
        doc.asegurar(14);
        doc.textoEn(X + 4, doc.y + 10 * 0.95, '•', { tam: 10, color: C.mako });
        doc.textoRico(tramosConCompletar(b.t), { tam: 10, sangria: 14 });
      } else if (b.rotulo) {
        doc.textoRico([{ t: `${b.rotulo}: `, fuente: 'Helvetica-Bold', color: C.dim }, ...tramosConCompletar(b.t)], { tam: 10 });
      } else {
        doc.textoRico(tramosConCompletar(b.t), { tam: 10 });
      }
    }
    doc.y += 10;
  }

  return doc.bytes();
}

function seccion(doc: PdfDoc, titulo: string): void {
  doc.asegurar(48);
  doc.rect(doc.margen, doc.y + 4, 4, 14, { relleno: C.mako, radio: 1 });
  doc.texto(titulo, { tam: 15, fuente: 'Helvetica-Bold', sangria: 12, despues: 4 });
  doc.linea(doc.margen, doc.y, doc.margen + doc.anchoUtil, doc.y, C.linea, 0.75);
  doc.y += 12;
}

/** Una caja de color con un título y una lista. Mide antes de dibujar el fondo. */
function caja(doc: PdfDoc, titulo: string, items: string[], fondo: string, color: string): void {
  const pad = 12;
  const ancho = doc.anchoUtil - 2 * pad - 12;
  const alto = pad * 2 + 14 + items.reduce((a, it) => a + doc.medir(it, { tam: 9.5, ancho }) + 2, 0);
  // Si la caja entera no entra en una página, se dibuja sin fondo (mejor que un
  // fondo cortado a la mitad que no envuelve su texto).
  const entra = alto < doc.piso - doc.margen;
  if (entra) doc.asegurar(alto + 6);
  const y0 = doc.y;
  if (entra) doc.rect(doc.margen, y0, doc.anchoUtil, alto, { relleno: fondo, radio: 8 });
  doc.y = y0 + pad;
  doc.texto(titulo, { tam: 10, fuente: 'Helvetica-Bold', color, sangria: pad, despues: 2 });
  for (const it of items) {
    doc.asegurar(14);
    doc.textoEn(doc.margen + pad, doc.y + 9.5 * 0.95, '•', { tam: 9.5, color });
    doc.textoRico(tramosConCompletar(it), { tam: 9.5, sangria: pad + 12, ancho, despues: 2 });
  }
  doc.y = (entra ? y0 + alto : doc.y) + 12;
}

type Bloque = { t: string; vineta?: boolean; rotulo?: string };

/** Las secciones de la oferta nueva, en el orden de la plantilla (§5 de docs/offer-marco.md). */
function seccionesPropuesta(p: PropuestaOferta): Array<[string, Bloque[]]> {
  const v = (t: string): Bloque => ({ t, vineta: true });
  const r = (rotulo: string, t: string): Bloque | null => (lleno(t) ? { rotulo, t } : null);
  const f = (t: string): Bloque | null => (lleno(t) ? { t } : null);
  const sinNulos = (xs: Array<Bloque | null>): Bloque[] => xs.filter((x): x is Bloque => !!x);
  return [
    ['Mensajes', sinNulos([r('Corto', p.mensajes.corto), r('Largo', p.mensajes.largo), r('Para el anuncio', p.mensajes.entrada)])],
    ['Para quién es', sinNulos([r('Perfil', p.paraQuien.perfil), r('Mínimo para entrar', p.paraQuien.minimo), r('No es para', p.paraQuien.noEs)])],
    ['Problema y destino', sinNulos([r('Hoy', p.problema.hoy), r('Después', p.problema.despues), ...p.problema.obstaculos.filter(lleno).map(v), r('Lo que ya probó', p.problema.yaProbo)])],
    ['Método', sinNulos([p.mecanismo.nombres.filter(lleno).length ? { rotulo: 'Nombres propuestos', t: p.mecanismo.nombres.filter(lleno).join(' · ') } : null, ...p.mecanismo.pasos.filter(lleno).map((x, i) => ({ t: `${i + 1}. ${x}` })), r('Por qué es distinto', p.mecanismo.distinto)])],
    ['Ruta', p.ruta.filter((x) => lleno(x.fase)).map((x) => ({ t: [x.fase, x.objetivo, x.hito ? `Hito: ${x.hito}` : ''].filter(lleno).join(' — '), vineta: true }))],
    ['Qué incluye', p.incluye.filter((x) => lleno(x.nombre)).map((x) => ({ t: x.beneficio ? `${x.nombre}: ${x.beneficio}` : x.nombre, vineta: true }))],
    ['Formato', sinNulos([f(p.formato)])],
    ['Prueba', sinNulos([f(p.prueba)])],
    ['Garantía', sinNulos([r('Nombre', p.garantia.nombre), r('Condiciones', p.garantia.condiciones), r('Plazo', p.garantia.plazo), r('Si no se cumple', p.garantia.siNoCumple)])],
    ['Bonos', p.bonos.filter((x) => lleno(x.nombre)).map((x) => ({ t: [x.nombre, x.objecion ? `ataca: ${x.objecion}` : '', x.valor ? `valor: ${x.valor}` : ''].filter(lleno).join(' — '), vineta: true }))],
    ['Inversión', sinNulos([r('Valor total', p.inversion.valorTotal), r('Precio', p.inversion.precio), r('De contado', p.inversion.contado), r('Plan de pagos', p.inversion.plan), r('Cómo decirlo en la llamada', p.inversion.comoDecirlo)])],
    ['Urgencia', sinNulos([f(p.urgencia)])],
    ['Mejor y peor escenario', sinNulos([r('Mejor', p.escenarios.mejor), r('Peor', p.escenarios.peor)])],
    ['Ecuación de valor', p.ecuacion.filter((x) => lleno(x.antes) || lleno(x.despues)).map((x) => ({ rotulo: ETIQUETA_VARIABLE[x.variable] ?? x.variable, t: `${x.antes || '—'}  ›  ${x.despues || '—'}` }))],
    ['Números', p.numeros.filter(lleno).map(v)],
    ['Cómo validarla', p.validar.filter(lleno).map(v)],
    ['Siguiente escalón', sinNulos([f(p.siguiente)])],
  ];
}

const ETIQUETA_VARIABLE: Record<string, string> = {
  resultado: 'Resultado soñado',
  probabilidad: 'Probabilidad de lograrlo',
  tiempo: 'Tiempo hasta el resultado',
  esfuerzo: 'Esfuerzo y sacrificio',
};
