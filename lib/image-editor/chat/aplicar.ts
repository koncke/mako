// =============================================================================
// image-editor/chat/aplicar — las operaciones del chat sobre el DOCUMENTO del diseño (puro)
// =============================================================================
// Recibe el documento de ese momento, la vista con la que se pidió (las refs) y las operaciones ya validadas
// (./catalogo.ts), y devuelve el documento NUEVO, las filas de «Original | Modificado» y lo que no se pudo, con su
// motivo. No toca el original: el panel lo aplica con `editor.applyDocument` (un paso de deshacer) y la API lo usa
// para revisar una propuesta contra el diseño guardado.
//
// Lo que gobierna, y no se ve en las firmas:
//   · LAS REFS SE RESUELVEN POR ID (`vista.elementos`): un elemento que se borró en el medio se descarta con su motivo;
//     uno que se movió sigue siendo el mismo.
//   · BLOQUEADO NO SE TOCA (salvo `bloquear`), como en el editor.
//   · UN GRUPO ES UN ELEMENTO: se mueve, se escala, se borra entero. Lo de adentro no tiene ref.
//   · LAS MEDIDAS SON LAS DE LA PERSONA (la esquina de arriba a la izquierda, con la escala): se traducen al origen que
//     Fabric guardó en cada objeto (`cajaDe`/`ponerCaja`). Girar es sobre el centro, como en Canva.
//   · «Nuevo» (agregar texto o forma) arma el objeto con los valores del motor (las fuentes y los colores de
//     `_doory/editor/engine/objects/factories.ts`); Fabric completa lo demás al cargarlo.
// =============================================================================

import type { AlinearA, EstiloTexto, OperacionImagen } from './catalogo';
import { cajaDe, factorOrigen, familiaDe, tipoDe } from './vista';

/** Lo de la vista que hace falta para aplicar: ref → id (y su título) de los elementos, y ref → id de las páginas. */
export type RefsDeVista = { elementos: ReadonlyMap<string, { id: string; titulo?: string }>; paginas: ReadonlyMap<string, string> };

type Obj = Record<string, unknown>;
type Pagina = Obj & { id: string; objects: Obj[] };
type Doc = Obj & { width: number; height: number; pages: Pagina[] };

/** Una fila de la revisión: lo de antes y lo de después. */
export type CambioImagen = { tipo: 'agrega' | 'cambia' | 'quita'; titulo: string; antes: string; despues: string };

export type ResultadoAplicar = {
  doc: Doc;
  cambios: CambioImagen[];
  descartes: string[];
  /** Las operaciones que cambiaron algo. 0 = no hay nada que aplicar. */
  aplicadas: number;
  /** Las familias que pide lo nuevo o lo restilizado: el editor las carga ANTES de aplicar (si no, mide con otra). */
  fuentes: string[];
  /** La página que conviene mostrar después (una nueva, o la de al lado de una borrada). */
  pagina: string | null;
};

/** Los de factories.ts del motor (no se puede importar: el server lee este módulo). */
export const POR_DEFECTO = { fuenteCuerpo: 'Inter', fuenteTitulo: 'Plus Jakarta Sans', colorTexto: '#1a1a2e', colorForma: '#7a64e0', maxPaginas: 100 } as const;

const num = (v: unknown, def = 0): number => (typeof v === 'number' && Number.isFinite(v) ? v : def);
const r1 = (n: number) => Math.round(n * 10) / 10;
const pila = (familia: string) => `"${familia.replace(/"/g, '')}", sans-serif`;
const clonar = <T>(x: T): T => JSON.parse(JSON.stringify(x)) as T;

/** Pone la esquina de arriba a la izquierda y/o el tamaño (con la escala) en el origen que el objeto tiene. */
export function ponerCaja(o: Obj, caja: { x?: number; y?: number }): void {
  const c = cajaDe(o);
  if (caja.x !== undefined) o.left = r1(caja.x + c.ancho * factorOrigen(o.originX));
  if (caja.y !== undefined) o.top = r1(caja.y + c.alto * factorOrigen(o.originY));
}

/** El centro de la caja girada, en la página. */
function centroDe(o: Obj): { cx: number; cy: number } {
  const c = cajaDe(o);
  const fx = factorOrigen(o.originX);
  const fy = factorOrigen(o.originY);
  const a = (num(o.angle) * Math.PI) / 180;
  // Del origen al centro: (0.5 - f) del tamaño, girado.
  const dx = (0.5 - fx) * c.ancho;
  const dy = (0.5 - fy) * c.alto;
  return { cx: num(o.left) + dx * Math.cos(a) - dy * Math.sin(a), cy: num(o.top) + dx * Math.sin(a) + dy * Math.cos(a) };
}

/** Gira sobre el centro: el origen se corre para que el centro quede donde estaba. */
function girar(o: Obj, grados: number): void {
  const { cx, cy } = centroDe(o);
  const c = cajaDe(o);
  const a = (grados * Math.PI) / 180;
  const dx = (0.5 - factorOrigen(o.originX)) * c.ancho;
  const dy = (0.5 - factorOrigen(o.originY)) * c.alto;
  o.angle = grados;
  o.left = r1(cx - (dx * Math.cos(a) - dy * Math.sin(a)));
  o.top = r1(cy - (dx * Math.sin(a) + dy * Math.cos(a)));
}

const ALINEACION_FABRIC: Record<string, string> = { izquierda: 'left', centro: 'center', derecha: 'right', justificado: 'justify' };
const PALABRA_TIPO: Record<string, string> = { texto: 'Texto', forma: 'Forma', imagen: 'Imagen', linea: 'Línea', grupo: 'Grupo', otro: 'Elemento' };
const CASO_PALABRA: Record<string, string> = { none: 'ninguno', upper: 'mayusculas', lower: 'minusculas', title: 'titulo', sentence: 'oracion' };
const CASO_FABRIC: Record<string, string> = { ninguno: 'none', mayusculas: 'upper', minusculas: 'lower', titulo: 'title', oracion: 'sentence' };

/** El texto que se VE según el caso: copia de `applyCase` del motor (`_doory/editor/engine/text/case.ts`). */
export function conCaso(texto: string, caso: unknown): string {
  if (caso === 'upper') return texto.toLocaleUpperCase();
  if (caso === 'lower') return texto.toLocaleLowerCase();
  if (caso === 'title') {
    return texto.toLowerCase().replace(/(^|[\s\-/(["'])([\p{L}\p{N}][\p{L}\p{N}'’]*)/gu, (_m, a: string, w: string) => a + w.charAt(0).toUpperCase() + w.slice(1));
  }
  if (caso === 'sentence') return texto.toLowerCase().replace(/(^|[.!?]\s+)(\p{L})/gu, (_m, a: string, l: string) => a + l.toUpperCase());
  return texto;
}

const conCasoActivo = (o: Obj) => typeof o.textCase === 'string' && o.textCase !== 'none';

/** Lo que la persona escribió: `caseSource` si el caso sigue puesto (como `toggleCase` del motor), si no lo que se ve. */
function originalDe(o: Obj): string {
  const text = String(o.text ?? '');
  return conCasoActivo(o) && typeof o.caseSource === 'string' && conCaso(o.caseSource, o.textCase) === text ? o.caseSource : text;
}

/** Cambia lo que dice un texto respetando su caso (como `reapplyCase` del motor después de tipear). */
function ponerTexto(o: Obj, texto: string): void {
  if (conCasoActivo(o)) {
    o.caseSource = texto;
    o.text = conCaso(texto, o.textCase);
  } else {
    o.text = texto;
    delete o.caseSource;
  }
}

/** Aplica un estilo a un texto y devuelve lo de antes y lo de después, en palabras. */
function ponerEstilo(o: Obj, e: EstiloTexto): { antes: string[]; despues: string[]; fuente: string | null } {
  const antes: string[] = [];
  const despues: string[] = [];
  const escalaY = Math.abs(num(o.scaleY, 1)) || 1;
  if (e.fuente !== undefined) { antes.push(familiaDe(o.fontFamily)); despues.push(e.fuente); o.fontFamily = pila(e.fuente); }
  if (e.tamano !== undefined) { antes.push(`${Math.round(num(o.fontSize) * escalaY)} px`); despues.push(`${e.tamano} px`); o.fontSize = r1(e.tamano / escalaY); }
  if (e.color !== undefined) { antes.push(String(o.fill ?? '')); despues.push(e.color); o.fill = e.color; }
  if (e.negrita !== undefined) { antes.push(num(o.fontWeight as number, 400) >= 600 ? 'negrita' : 'normal'); despues.push(e.negrita ? 'negrita' : 'normal'); o.fontWeight = e.negrita ? 700 : 400; }
  if (e.cursiva !== undefined) { antes.push(o.fontStyle === 'italic' ? 'cursiva' : 'recta'); despues.push(e.cursiva ? 'cursiva' : 'recta'); o.fontStyle = e.cursiva ? 'italic' : 'normal'; }
  if (e.subrayado !== undefined) { antes.push(o.underline ? 'subrayado' : 'sin subrayar'); despues.push(e.subrayado ? 'subrayado' : 'sin subrayar'); o.underline = e.subrayado; }
  if (e.alineacion !== undefined) { antes.push(String(o.textAlign ?? 'left')); despues.push(e.alineacion); o.textAlign = ALINEACION_FABRIC[e.alineacion]; }
  if (e.interlineado !== undefined) { antes.push(`interlineado ${num(o.lineHeight, 1.16)}`); despues.push(`interlineado ${e.interlineado}`); o.lineHeight = e.interlineado; }
  if (e.espaciado !== undefined) { antes.push(`espaciado ${num(o.charSpacing)}`); despues.push(`espaciado ${e.espaciado}`); o.charSpacing = e.espaciado; }
  if (e.mayusculas !== undefined) {
    const original = originalDe(o);
    antes.push(CASO_PALABRA[String(o.textCase ?? 'none')] ?? 'ninguno');
    despues.push(e.mayusculas);
    const caso = CASO_FABRIC[e.mayusculas];
    // Como el motor: «ninguno» devuelve lo escrito y saca el caso (no queda `textCase: 'none'`).
    if (caso === 'none') { o.text = original; delete o.caseSource; delete o.textCase; }
    else { o.caseSource = original; o.textCase = caso; o.text = conCaso(original, caso); }
  }
  return { antes, despues, fuente: e.fuente ?? null };
}

/** Un id nuevo para un objeto copiado (y lo de adentro si es un grupo). */
function conIdsNuevos(o: Obj, nuevoId: () => string): Obj {
  const c = clonar(o);
  const renombrar = (x: Obj) => {
    x.id = nuevoId();
    if (Array.isArray(x.objects)) for (const h of x.objects as Obj[]) renombrar(h);
  };
  renombrar(c);
  return c;
}

/**
 * APLICAR. Las operaciones en orden, sobre una copia. `nuevoId` arma los ids de lo nuevo (el navegador usa el del
 * motor; los tests, uno fijo). `activePageId`: la página abierta (la de un texto o una forma sin "pagina").
 * `soloRefs`: el alcance «lo elegido» (las refs elegidas; lo nuevo de este pedido vale). `fuente`: la familia tal como
 * la tiene el editor, o null si no la tiene (el server no tiene el catálogo: sin ella, pasa la que vino).
 */
export function aplicarOperaciones(p: {
  doc: unknown; operaciones: readonly OperacionImagen[]; vista: RefsDeVista; nuevoId: () => string; activePageId?: string | null;
  soloRefs?: ReadonlySet<string> | null; fuente?: (nombre: string) => string | null;
}): ResultadoAplicar {
  const doc = clonar(p.doc) as Doc;
  const cambios: CambioImagen[] = [];
  const descartes: string[] = [];
  const fuentes = new Set<string>();
  const nuevas = new Map<string, string>();
  let aplicadas = 0;
  let pagina: string | null = null;
  const anchoDe = (pg: Pagina) => num(pg.width, num(doc.width));
  const altoDe = (pg: Pagina) => num(pg.height, num(doc.height));

  const buscar = (id: string): { pg: Pagina; i: number; o: Obj } | null => {
    for (const pg of doc.pages) {
      const i = pg.objects.findIndex((o) => o.id === id);
      if (i >= 0) return { pg, i, o: pg.objects[i] };
    }
    return null;
  };
  const tituloDe = (ref: string, o: Obj) => p.vista.elementos.get(ref)?.titulo ?? (tipoDe(o) === 'texto' ? `«${String(o.text ?? '').replace(/\s+/g, ' ').slice(0, 40)}»` : String(o.name ?? PALABRA_TIPO[tipoDe(o)]));
  /** El elemento de una ref, listo para cambiar; o el motivo por el que no. */
  const elemento = (ref: string, op: { bloqueadoVale?: boolean } = {}): { pg: Pagina; i: number; o: Obj; titulo: string } | string => {
    const id = p.vista.elementos.get(ref)?.id ?? nuevas.get(ref);
    if (!id) return `«${ref}» no está en el diseño`;
    const b = buscar(id);
    if (!b) return `${p.vista.elementos.get(ref)?.titulo ?? ref} ya no está`;
    const titulo = tituloDe(ref, b.o);
    if (p.soloRefs && !nuevas.has(ref) && !p.soloRefs.has(ref)) return `${titulo} no está en lo elegido`;
    if (b.o.locked === true && !op.bloqueadoVale) return `${titulo} está bloqueado`;
    return { ...b, titulo };
  };
  const paginaDe = (ref?: string): Pagina | null => {
    const id = ref ? p.vista.paginas.get(ref) : (p.activePageId ?? doc.pages[0]?.id);
    return doc.pages.find((pg) => pg.id === id) ?? (ref ? null : doc.pages[0] ?? null);
  };
  const hecho = (c: CambioImagen) => { cambios.push(c); aplicadas++; };
  /** El estilo con la fuente como la tiene el editor; o el motivo, si no la tiene (cae a la del sistema EN SILENCIO). */
  const conFuente = (e: EstiloTexto): EstiloTexto | string => {
    if (e.fuente === undefined || !p.fuente) return e;
    const f = p.fuente(e.fuente);
    return f ? { ...e, fuente: f } : `la fuente «${e.fuente}» no está en el editor`;
  };
  const deLaPagina = (que: string) => `${que} es de la página, no de lo elegido`;

  for (const op of p.operaciones) {
    switch (op.op) {
      case 'cambiar_texto': {
        const e = elemento(op.ref);
        if (typeof e === 'string') { descartes.push(e); break; }
        if (tipoDe(e.o) !== 'texto') { descartes.push(`${e.titulo} no es un texto`); break; }
        const antes = originalDe(e.o);
        if (antes === op.texto) { descartes.push(`${e.titulo} ya dice eso`); break; }
        ponerTexto(e.o, op.texto);
        hecho({ tipo: 'cambia', titulo: 'Texto', antes, despues: op.texto });
        break;
      }
      case 'estilo_texto': {
        const e = elemento(op.ref);
        if (typeof e === 'string') { descartes.push(e); break; }
        if (tipoDe(e.o) !== 'texto') { descartes.push(`${e.titulo} no es un texto`); break; }
        const estilo = conFuente(op.estilo);
        if (typeof estilo === 'string') { descartes.push(estilo); break; }
        const r = ponerEstilo(e.o, estilo);
        if (r.fuente) fuentes.add(r.fuente);
        hecho({ tipo: 'cambia', titulo: `Estilo de ${e.titulo}`, antes: r.antes.join(' · '), despues: r.despues.join(' · ') });
        break;
      }
      case 'agregar_texto': {
        const estilo = conFuente(op.estilo);
        if (typeof estilo === 'string') { descartes.push(estilo); break; }
        const pg = paginaDe(op.pagina);
        if (!pg) { descartes.push(`la página «${op.pagina}» no está`); break; }
        if (op.ref && nuevas.has(op.ref)) { descartes.push(`«${op.ref}» ya se usó en este pedido`); break; }
        const w = anchoDe(pg);
        const h = altoDe(pg);
        const tamano = estilo.tamano ?? Math.max(12, Math.round(Math.min(w, h) * 0.05));
        const ancho = op.ancho ?? Math.round(w * 0.7);
        const familia = estilo.fuente ?? POR_DEFECTO.fuenteCuerpo;
        fuentes.add(familia);
        const o: Obj = {
          type: 'textbox', id: p.nuevoId(), name: 'Texto', text: op.texto, fontFamily: pila(familia), fontSize: tamano,
          fontWeight: estilo.negrita ? 700 : 400, fontStyle: estilo.cursiva ? 'italic' : 'normal', underline: estilo.subrayado === true,
          fill: estilo.color ?? POR_DEFECTO.colorTexto, textAlign: ALINEACION_FABRIC[estilo.alineacion ?? 'izquierda'],
          lineHeight: estilo.interlineado ?? 1.2, charSpacing: estilo.espaciado ?? 0, styles: [], splitByGrapheme: false, minWidth: 20,
          originX: 'left', originY: 'top', left: r1(op.x ?? (w - ancho) / 2), top: r1(op.y ?? (h - tamano * 1.2) / 2),
          width: ancho, height: r1(tamano * 1.2), scaleX: 1, scaleY: 1, angle: 0, opacity: 1, visible: true,
        };
        if (estilo.mayusculas && estilo.mayusculas !== 'ninguno') { o.textCase = CASO_FABRIC[estilo.mayusculas]; o.caseSource = op.texto; o.text = conCaso(op.texto, o.textCase); }
        pg.objects.push(o);
        if (op.ref) nuevas.set(op.ref, String(o.id));
        hecho({ tipo: 'agrega', titulo: 'Texto nuevo', antes: '', despues: op.texto });
        break;
      }
      case 'mover': {
        const e = elemento(op.ref);
        if (typeof e === 'string') { descartes.push(e); break; }
        const c = cajaDe(e.o);
        ponerCaja(e.o, { x: op.x, y: op.y });
        hecho({ tipo: 'cambia', titulo: `Posición de ${e.titulo}`, antes: `${Math.round(c.x)}, ${Math.round(c.y)}`, despues: `${Math.round(op.x ?? c.x)}, ${Math.round(op.y ?? c.y)}` });
        break;
      }
      case 'tamano': {
        const e = elemento(op.ref);
        if (typeof e === 'string') { descartes.push(e); break; }
        const c = cajaDe(e.o);
        const texto = tipoDe(e.o) === 'texto';
        if (op.escala !== undefined) {
          const f = op.escala / 100;
          if (texto) { e.o.fontSize = r1(num(e.o.fontSize) * f); e.o.width = r1(num(e.o.width) * f); }
          else { e.o.scaleX = num(e.o.scaleX, 1) * f; e.o.scaleY = num(e.o.scaleY, 1) * f; }
        } else if (texto) {
          if (op.ancho !== undefined) e.o.width = r1(op.ancho / (Math.abs(num(e.o.scaleX, 1)) || 1));
        } else {
          const w = num(e.o.width) || 1;
          const h = num(e.o.height) || 1;
          // Una foto con UNA sola medida mantiene su proporción, como al tirar de una esquina en Canva.
          const proporcional = tipoDe(e.o) === 'imagen' && (op.ancho === undefined) !== (op.alto === undefined);
          const fx = op.ancho !== undefined ? op.ancho / w : proporcional && op.alto !== undefined ? (op.alto / h) : num(e.o.scaleX, 1);
          const fy = op.alto !== undefined ? op.alto / h : proporcional && op.ancho !== undefined ? (op.ancho / w) : num(e.o.scaleY, 1);
          e.o.scaleX = fx;
          e.o.scaleY = fy;
        }
        ponerCaja(e.o, { x: c.x, y: c.y });
        const d = cajaDe(e.o);
        hecho({ tipo: 'cambia', titulo: `Tamaño de ${e.titulo}`, antes: `${Math.round(c.ancho)} × ${Math.round(c.alto)}`, despues: `${Math.round(d.ancho)} × ${Math.round(d.alto)}` });
        break;
      }
      case 'rotar': {
        const e = elemento(op.ref);
        if (typeof e === 'string') { descartes.push(e); break; }
        const antes = num(e.o.angle);
        girar(e.o, op.grados);
        hecho({ tipo: 'cambia', titulo: `Giro de ${e.titulo}`, antes: `${r1(antes)}°`, despues: `${op.grados}°` });
        break;
      }
      case 'opacidad': {
        const e = elemento(op.ref);
        if (typeof e === 'string') { descartes.push(e); break; }
        const antes = Math.round(num(e.o.opacity, 1) * 100);
        e.o.opacity = op.opacidad / 100;
        hecho({ tipo: 'cambia', titulo: `Transparencia de ${e.titulo}`, antes: `${antes} %`, despues: `${op.opacidad} %` });
        break;
      }
      case 'color': {
        const e = elemento(op.ref);
        if (typeof e === 'string') { descartes.push(e); break; }
        const tipo = tipoDe(e.o);
        if (tipo === 'imagen' || tipo === 'grupo') { descartes.push(`${e.titulo} no tiene un color que cambiar`); break; }
        const clave = tipo === 'linea' ? 'stroke' : 'fill';
        const antes = String(e.o[clave] ?? '');
        e.o[clave] = op.color;
        hecho({ tipo: 'cambia', titulo: `Color de ${e.titulo}`, antes, despues: op.color });
        break;
      }
      case 'borde': {
        const e = elemento(op.ref);
        if (typeof e === 'string') { descartes.push(e); break; }
        if (tipoDe(e.o) !== 'forma') { descartes.push(`${e.titulo} no es una forma`); break; }
        const antes = num(e.o.strokeWidth) > 0 && e.o.stroke ? `${e.o.stroke} · ${num(e.o.strokeWidth)} px` : 'sin borde';
        if (op.grosor === 0) { e.o.stroke = null; e.o.strokeWidth = 0; }
        else {
          e.o.stroke = op.color ?? (typeof e.o.stroke === 'string' && e.o.stroke ? e.o.stroke : '#000000');
          e.o.strokeWidth = op.grosor ?? (num(e.o.strokeWidth) > 0 ? num(e.o.strokeWidth) : 2);
          e.o.strokeUniform = true;
        }
        const despues = op.grosor === 0 ? 'sin borde' : `${e.o.stroke} · ${e.o.strokeWidth} px`;
        hecho({ tipo: 'cambia', titulo: `Borde de ${e.titulo}`, antes, despues });
        break;
      }
      case 'borrar': {
        for (const ref of op.refs) {
          const e = elemento(ref);
          if (typeof e === 'string') { descartes.push(e); continue; }
          e.pg.objects.splice(e.i, 1);
          hecho({ tipo: 'quita', titulo: e.titulo, antes: e.titulo, despues: '' });
        }
        break;
      }
      case 'duplicar': {
        const e = elemento(op.ref, { bloqueadoVale: true });
        if (typeof e === 'string') { descartes.push(e); break; }
        if (op.nueva && nuevas.has(op.nueva)) { descartes.push(`«${op.nueva}» ya se usó en este pedido`); break; }
        const copia = conIdsNuevos(e.o, p.nuevoId);
        copia.locked = false;
        if (typeof copia.name === 'string') copia.name = `${copia.name} (copia)`.slice(0, 100);
        copia.left = r1(num(copia.left) + (op.dx ?? 20));
        copia.top = r1(num(copia.top) + (op.dy ?? 20));
        e.pg.objects.splice(e.i + 1, 0, copia);
        if (op.nueva) nuevas.set(op.nueva, String(copia.id));
        hecho({ tipo: 'agrega', titulo: `Copia de ${e.titulo}`, antes: '', despues: e.titulo });
        break;
      }
      case 'capa': {
        const e = elemento(op.ref);
        if (typeof e === 'string') { descartes.push(e); break; }
        const lista = e.pg.objects;
        const destino = op.a === 'frente' ? lista.length - 1 : op.a === 'atras' ? 0 : op.a === 'subir' ? Math.min(lista.length - 1, e.i + 1) : Math.max(0, e.i - 1);
        if (destino === e.i) { descartes.push(`${e.titulo} ya está ${op.a === 'frente' || op.a === 'subir' ? 'arriba de todo' : 'abajo de todo'}`); break; }
        lista.splice(e.i, 1);
        lista.splice(destino, 0, e.o);
        hecho({ tipo: 'cambia', titulo: `Orden de ${e.titulo}`, antes: `capa ${e.i + 1}`, despues: `capa ${destino + 1}` });
        break;
      }
      case 'alinear': {
        for (const ref of op.refs) {
          const e = elemento(ref);
          if (typeof e === 'string') { descartes.push(e); continue; }
          const c = cajaDe(e.o);
          const w = anchoDe(e.pg);
          const h = altoDe(e.pg);
          const destino: Record<AlinearA, { x?: number; y?: number }> = {
            izquierda: { x: 0 }, centro: { x: (w - c.ancho) / 2 }, derecha: { x: w - c.ancho },
            arriba: { y: 0 }, medio: { y: (h - c.alto) / 2 }, abajo: { y: h - c.alto },
          };
          ponerCaja(e.o, destino[op.a]);
          hecho({ tipo: 'cambia', titulo: `Posición de ${e.titulo}`, antes: `${Math.round(c.x)}, ${Math.round(c.y)}`, despues: op.a });
        }
        break;
      }
      case 'bloquear': {
        const e = elemento(op.ref, { bloqueadoVale: true });
        if (typeof e === 'string') { descartes.push(e); break; }
        if ((e.o.locked === true) === op.bloqueado) { descartes.push(`${e.titulo} ya está ${op.bloqueado ? 'bloqueado' : 'desbloqueado'}`); break; }
        e.o.locked = op.bloqueado;
        hecho({ tipo: 'cambia', titulo: e.titulo, antes: op.bloqueado ? 'desbloqueado' : 'bloqueado', despues: op.bloqueado ? 'bloqueado' : 'desbloqueado' });
        break;
      }
      case 'fondo': {
        if (p.soloRefs) { descartes.push(deLaPagina('El fondo')); break; }
        const pg = paginaDe(op.pagina);
        if (!pg) { descartes.push(`la página «${op.pagina}» no está`); break; }
        const bg = (pg.background ?? {}) as { type?: string; color?: string };
        const antes = bg.type === 'solid' ? String(bg.color) : bg.type === 'image' ? 'imagen' : 'degradado';
        pg.background = { type: 'solid', color: op.color };
        hecho({ tipo: 'cambia', titulo: `Fondo de la página ${doc.pages.indexOf(pg) + 1}`, antes, despues: op.color });
        break;
      }
      case 'agregar_pagina': {
        if (p.soloRefs) { descartes.push(deLaPagina('Una página nueva')); break; }
        if (doc.pages.length >= POR_DEFECTO.maxPaginas) { descartes.push(`el diseño ya tiene ${POR_DEFECTO.maxPaginas} páginas`); break; }
        const base = op.despues_de ? paginaDe(op.despues_de) : null;
        if (op.despues_de && !base) { descartes.push(`la página «${op.despues_de}» no está`); break; }
        const i = base ? doc.pages.indexOf(base) + 1 : doc.pages.length;
        // Como el motor: la copia lleva «(copia)» en el nombre; la en blanco, el tamaño de la de antes (`newPageSize`).
        const antes = base ?? doc.pages[doc.pages.length - 1];
        const nueva: Pagina = op.duplicar && base
          ? { ...clonar(base), id: p.nuevoId(), objects: base.objects.map((o) => conIdsNuevos(o, p.nuevoId)), ...(typeof base.name === 'string' && base.name ? { name: `${base.name} (copia)` } : {}) }
          : {
            id: p.nuevoId(), background: { type: 'solid', color: '#ffffff' }, objects: [],
            ...(antes && typeof antes.width === 'number' && typeof antes.height === 'number' ? { width: antes.width, height: antes.height } : {}),
          };
        doc.pages.splice(i, 0, nueva);
        pagina = nueva.id;
        hecho({ tipo: 'agrega', titulo: `Página ${i + 1}`, antes: '', despues: op.duplicar && base ? `copia de la página ${doc.pages.indexOf(base) + 1}` : 'en blanco' });
        break;
      }
      case 'borrar_pagina': {
        if (p.soloRefs) { descartes.push(deLaPagina('Borrar una página')); break; }
        const pg = paginaDe(op.pagina);
        if (!pg) { descartes.push(`la página «${op.pagina}» no está`); break; }
        if (doc.pages.length <= 1) { descartes.push('un diseño se queda con al menos una página'); break; }
        const i = doc.pages.indexOf(pg);
        doc.pages.splice(i, 1);
        pagina = doc.pages[Math.min(i, doc.pages.length - 1)].id;
        hecho({ tipo: 'quita', titulo: `Página ${i + 1}`, antes: `${pg.objects.length} elementos`, despues: '' });
        break;
      }
      case 'agregar_forma': {
        const pg = paginaDe(op.pagina);
        if (!pg) { descartes.push(`la página «${op.pagina}» no está`); break; }
        if (op.ref && nuevas.has(op.ref)) { descartes.push(`«${op.ref}» ya se usó en este pedido`); break; }
        const circulo = op.forma === 'circulo';
        const o: Obj = {
          type: circulo ? 'ellipse' : 'rect', shapeKind: circulo ? 'ellipse' : 'rect', id: p.nuevoId(), name: circulo ? 'Círculo' : 'Rectángulo',
          originX: 'left', originY: 'top', left: op.x, top: op.y, width: op.ancho, height: op.alto,
          ...(circulo ? { rx: op.ancho / 2, ry: op.alto / 2 } : { rx: 0, ry: 0 }),
          fill: op.color ?? POR_DEFECTO.colorForma, stroke: null, strokeWidth: 0, strokeUniform: true,
          scaleX: 1, scaleY: 1, angle: 0, opacity: 1, visible: true,
        };
        pg.objects.push(o);
        if (op.ref) nuevas.set(op.ref, String(o.id));
        hecho({ tipo: 'agrega', titulo: circulo ? 'Círculo nuevo' : 'Rectángulo nuevo', antes: '', despues: `${Math.round(op.ancho)} × ${Math.round(op.alto)}` });
        break;
      }
    }
  }
  return { doc, cambios, descartes, aplicadas, fuentes: [...fuentes], pagina };
}

/** «3 nuevos · 2 cambian · 1 se quita». */
export function resumenDeCambios(cambios: readonly CambioImagen[]): string {
  const n = { agrega: 0, cambia: 0, quita: 0 };
  for (const c of cambios) n[c.tipo]++;
  return [
    n.agrega ? `${n.agrega} ${n.agrega === 1 ? 'nuevo' : 'nuevos'}` : '',
    n.cambia ? `${n.cambia} ${n.cambia === 1 ? 'cambia' : 'cambian'}` : '',
    n.quita ? `${n.quita} ${n.quita === 1 ? 'se quita' : 'se quitan'}` : '',
  ].filter(Boolean).join(' · ');
}
