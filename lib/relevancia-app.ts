// =============================================================================
// relevancia-app — qué operaciones del registro entran al turno del chat de la APP cuando el pedido no las nombra
// =============================================================================
// «Ops Center = lo principal» (docs/ops-center-principal.md, pieza 1.2). En la app, si el texto no nombra el área de su operación
// («creá una etiqueta», «cortá el video»), la operación se busca en TODO el registro por relevancia (`buscaEnTodo`, lib/mako-intencion.ts).
// La revisión adversarial de la tanda 1 (20/10/2026, docs/hallazgos-ia.md) midió lo que eso trae si se hace sin cuidado:
//   · escrituras IRREVERSIBLES de otra cosa cuando la pedida no existe («borrá la nota» → `borrar_audio`, «pausá todo» → eliminar una
//     entidad pausada de Meta): una raíz de 5 letras matchea DENTRO de otra palabra («borra» en «borrador», «pausa» en «pausada»);
//   · lecturas que gastan IA de otra área en una pregunta común («buscame a Juan» → `buscar_duplicados_tarea`);
//   · el 60% del área nombrada que, junto a la pasada por todo, le saca a un pedido CON área la lectura que da el id;
//   · un mensaje de charla («mmm no sé») que viaja con 42 herramientas porque, sin raíces, el registro entra en el orden declarado.
// Acá vive lo que lo frena. Las pasadas, en orden:
//   1. las operaciones de las áreas que el texto SÍ nombra, hasta el 60% del presupuesto (un área ancha como el CRM no se lo come todo);
//   2. las de OTRAS áreas, sólo si puntúan por una raíz al PRINCIPIO de una palabra de su id o título, sin la orden ni las palabras
//      vacías, y sin dejar entrar una acción destructiva ni una lectura que gasta IA, plata o un servicio externo;
//   3. el resto de las áreas nombradas con lo que sobra;
//   4. las lecturas que dan el id de lo que entró («(de listar_landings_creadas)», «salen de ver_proyecto_video»), con un margen
//      aparte: una acción que llega sin ellas no «llega» (MaKo inventa el id o vuelve a preguntar).
// Sin raíces útiles (ni área, ni familia), no se busca en todo el registro: un mensaje de charla viaja con las de siempre.
//
// PURO y sin `server-only`: lo usa lib/doer-herramientas.ts y lo prueba tests/ops-center-clasificador-app.test.ts.
// =============================================================================

import { REGISTRO, porId, toolsDelRegistro, visible, aToolDef, type Vista } from './api-mako/registro';
import type { Area, OperacionDef } from './api-mako/tipos';
import type { ToolDef } from './anthropic';

const norm = (s: string): string => (s || '').normalize('NFD').replace(/[̀-ͯ]/g, '').toLowerCase();

/** Palabras con 4 letras o más que no dicen QUÉ operación se pide. Sobre texto sin tildes. */
const PALABRAS_VACIAS: ReadonlySet<string> = new Set([
  'para', 'esta', 'este', 'esto', 'estos', 'estas', 'esos', 'esas', 'todo', 'todos', 'toda', 'todas', 'como', 'deja', 'dejar', 'quiero', 'necesito',
  'favor', 'porfa', 'puedes', 'podes', 'hola', 'gracias', 'bueno', 'tengo', 'tienes', 'tenes', 'tiene', 'tienen', 'algo', 'cada', 'cuando', 'donde',
  'desde', 'hasta', 'sobre', 'entre', 'pero', 'porque', 'mismo', 'misma', 'otra', 'otro', 'otros', 'otras', 'ahora', 'luego', 'despues', 'antes',
  'tambien', 'solo', 'nada', 'alguna', 'algun', 'ninguna', 'ninguno', 'estoy', 'estan', 'hacer', 'hace', 'haga', 'quiere', 'aqui', 'alli', 'nuestro',
  'nuestra', 'nuestros', 'nuestras', 'mucho', 'mucha', 'muchos', 'muchas', 'poco', 'poca', 'cual', 'cuales', 'quien', 'quienes', 'con', 'una', 'unos',
  'unas', 'del', 'que', 'por', 'los', 'las', 'mas', 'muy', 'sin', 'les', 'nos',
]);

/** Las palabras del texto que sí dicen algo: 4 letras o más y fuera de `PALABRAS_VACIAS`. */
export function palabrasUtiles(texto: string): string[] {
  return norm(texto).split(/[^a-z0-9]+/).filter((w) => w.length >= 4 && !PALABRAS_VACIAS.has(w));
}
/** Las raíces (5 letras) de las palabras útiles. */
export function raicesUtiles(texto: string): string[] {
  return [...new Set(palabrasUtiles(texto).map((w) => w.slice(0, 5)))];
}

const tokens = (s: string): string[] => norm(s).split(/[^a-z0-9]+/).filter(Boolean);

/** Puntaje de una operación para un texto: 2 por raíz al PRINCIPIO de una palabra de su id o título, 1 si es de su descripción. */
export function puntajePorInicio(d: OperacionDef, texto: string): number {
  const rs = raicesUtiles(texto);
  if (!rs.length) return 0;
  const fuerte = tokens(`${d.id} ${d.titulo}`);
  const debil = tokens(d.descripcion);
  return rs.reduce((n, r) => n + (fuerte.some((t) => t.startsWith(r)) ? 2 : debil.some((t) => t.startsWith(r)) ? 1 : 0), 0);
}

const VERBOS_DESTRUCTIVOS: ReadonlySet<string> = new Set([
  'borrar', 'eliminar', 'cancelar', 'anular', 'descartar', 'quitar', 'sacar', 'archivar', 'pausar', 'desvincular', 'suspender', 'reembolsar',
  'baja', 'desactivar', 'apagar', 'retirar', 'olvidar', 'ocultar', 'restablecer', 'reiniciar', 'revertir', 'vaciar', 'despublicar', 'desconectar', 'rechazar',
]);
/** ¿Una acción que borra, quita o corta algo (o que el registro marca como NO reversible)? */
export function esDestructiva(d: OperacionDef): boolean {
  if (d.tipo === 'lectura') return false;
  if ((d as { reversible?: boolean }).reversible === false) return true;
  return d.id.split('_').some((t) => VERBOS_DESTRUCTIVOS.has(t));
}
/** ¿Una lectura que gasta IA, plata o un servicio externo? */
export const lecturaConCosto = (d: OperacionDef): boolean => d.tipo === 'lectura' && d.costo !== 'gratis';

/** Los ids de lecturas que la descripción de una operación (o la de sus parámetros) nombra como origen de lo que pide. */
export function lecturasQueNombra(d: OperacionDef): string[] {
  const texto = [d.descripcion, ...((d as unknown as { parametros?: Array<{ descripcion?: string }> }).parametros ?? []).map((p) => p.descripcion ?? '')].join(' ');
  const ids = texto.match(/[a-z]+(?:_[a-z0-9]+)+/g) ?? [];
  return [...new Set(ids)].filter((id) => id !== d.id && porId(id)?.tipo === 'lectura');
}

const tam = (t: ToolDef): number => JSON.stringify(t).length;

export type PedidoDeRegistro = {
  vista: Vista;
  /** las áreas que el texto, la familia o el detector nombran */
  areas: readonly Area[];
  /** lo que escribió la persona SIN la orden del arranque ni el saludo (lo que puntúa la pasada 2) */
  texto: string;
  /** el texto + las palabras de la familia (lo que ordena las pasadas 1 y 3, como siempre) */
  relevanteA: string;
  /** las palabras de la familia: son el NOMBRE de la operación, y entran a la pasada 2 tal cual */
  relevancia: string;
  conAcciones: boolean;
  excluir: ReadonlySet<string>;
  presupuesto: number;
};

/** Margen aparte (en caracteres) para las lecturas que dan el id de lo que entró. */
export const MARGEN_DE_LECTURAS = 3500;

/**
 * Las operaciones del registro para un turno de la app que busca en todo el registro. Ver la cabecera para las pasadas.
 * Sin área ni raíces útiles no entra nada: la pasada 2 exige una raíz al principio de una palabra, así que un mensaje de charla no llena el presupuesto.
 */
export function registroParaLaApp(p: PedidoDeRegistro): ToolDef[] {
  const relevante = `${p.texto}\n${p.relevancia}`;
  const hayRaices = raicesUtiles(relevante).length > 0;
  const comun = { vista: p.vista, incluirAcciones: p.conAcciones, silencioso: true } as const;
  const nombran = new Set<string>(p.areas);

  // 1. Las áreas que el texto nombra, hasta el 60%.
  const uno = p.areas.length
    ? toolsDelRegistro({ ...comun, areas: p.areas, excluir: p.excluir, maxChars: Math.floor(p.presupuesto * 0.6), relevanteA: p.relevanteA })
    : [];
  const usados1 = uno.reduce((n, t) => n + tam(t), 0);
  const ya = new Set<string>([...p.excluir, ...uno.map((t) => t.name)]);

  // 2. Las otras áreas, sólo lo que puntúa por una raíz al principio de una palabra y no es destructivo ni cuesta. Se ordena por ESE
  //    puntaje (y, a igual puntaje, la más corta) y se arma a mano: el orden del registro es por substring y por orden de declaración.
  const tope2 = Math.min(Math.floor(p.presupuesto * 0.25), p.presupuesto - usados1);
  const dos: ToolDef[] = [];
  if (hayRaices) {
    const candidatas = REGISTRO
      .filter((d) => !nombran.has(d.area) && !ya.has(d.id) && !(d.alias ?? []).some((a) => ya.has(a)) && visible(d, p.vista)
        && (p.conAcciones || d.tipo === 'lectura') && !esDestructiva(d) && !lecturaConCosto(d))
      .map((d) => ({ d, pts: puntajePorInicio(d, relevante), tool: aToolDef(d) }))
      .filter((x) => x.pts >= 2)
      .sort((a, b) => b.pts - a.pts || tam(a.tool) - tam(b.tool));
    let gastado = 0;
    for (const x of candidatas) {
      if (gastado + tam(x.tool) > tope2) continue;
      gastado += tam(x.tool); dos.push(x.tool);
    }
  }
  const usados2 = dos.reduce((n, t) => n + tam(t), 0);
  for (const t of dos) ya.add(t.name);

  // 3. El resto de las áreas nombradas con lo que sobra: la pasada 2 no puede dejarlas sin lo suyo.
  const tres = p.areas.length
    ? toolsDelRegistro({ ...comun, areas: p.areas, excluir: ya, maxChars: p.presupuesto - usados1 - usados2, relevanteA: p.relevanteA })
    : [];
  for (const t of tres) ya.add(t.name);

  // 4. Las lecturas que dan el id de lo que entró, con su margen.
  const entraron = [...uno, ...tres, ...dos];
  const extra: ToolDef[] = [];
  let margen = MARGEN_DE_LECTURAS;
  for (const t of entraron) {
    const d = porId(t.name);
    if (!d || d.tipo === 'lectura') continue;
    for (const id of lecturasQueNombra(d)) {
      const lec = REGISTRO.find((x) => x.id === id);
      if (!lec || ya.has(lec.id) || !visible(lec, p.vista)) continue;
      const tool = aToolDef(lec);
      if (tam(tool) > margen) continue;
      margen -= tam(tool); ya.add(lec.id); extra.push(tool);
    }
  }
  return [...uno, ...tres, ...dos, ...extra];
}
