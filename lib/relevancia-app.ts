// =============================================================================
// relevancia-app — qué operaciones del registro entran al turno del chat de la APP cuando el pedido no las nombra
// =============================================================================
// «Ops Center = lo principal» (docs/ops-center-principal.md, pieza 1.2). En la app, si el texto no nombra el área de su operación
// («creá una etiqueta», «cortá el video»), la operación se busca en TODO el registro por relevancia (`buscaEnTodo`, lib/mako-intencion.ts).
//
// ⚠️ LA RED ES LA TARJETA, NO LA REGLA. En la app toda escritura deja una tarjeta que una persona toca (`alcance: 'proponer'`) y
// la única operación que cambiaba algo sin tarjeta (`cancelar_accion`) no viaja (lib/mako-turno-app-reglas.ts). Dos revisiones
// adversariales (20 y 21/10/2026, docs/hallazgos-ia.md) midieron lo que pasa cuando se intenta, en cambio, que el CLASIFICADOR
// no se equivoque con una tabla de palabras: cada ronda de reglas dejó afuera una frase legítima y metió otra irreversible
// («borrá la nota» → `borrar_audio`; «escribile a Juan» → `borrar_chat_whatsapp_empresa`, porque «borrador» contiene «borra»;
// «eliminá las muletillas» → `reiniciar_personalidad`, porque `area-negocio` abría todas las destructivas del área). Por eso acá
// no se decide POR ÁREA qué destructiva entra, sino por NOMBRE:
//   · una operación que quita, corta o cancela algo (`esDestructiva`: el verbo está en su id) entra SÓLO si el pedido pide
//     quitar (`pideQuitar`: la forma de la orden o el infinitivo, en cualquier parte del texto) Y nombra la COSA de esa operación
//     (`nombraLaCosa`: el sustantivo de su id o de su título, o un sinónimo). Si no la nombra, la operación no viaja y MaKo
//     pregunta cuál (`INSTRUCCION_QUITAR_SIN_OBJETO`);
//   · las demás operaciones entran por área y por relevancia como siempre; una creación o un envío irreversible NO es
//     «destructiva» (`reversible: false` marca envíos y altas: contarla frenaba «invitá a Ana»);
//   · el área nombrada no abre nada destructivo: «publicó», «muletillas», «reporte» o «guion» son palabras de área, no de la cosa.
//
// Las pasadas, en orden:
//   1. las operaciones de las áreas que el texto SÍ nombra, hasta el 75% del presupuesto (un área ancha como el CRM no se lo come todo);
//   2. las de OTRAS áreas, sólo si puntúan por una raíz al PRINCIPIO de una palabra de su id o título, sin la orden ni las palabras
//      vacías, y sin dejar entrar una lectura que gasta IA, plata o un servicio externo (hasta el 25%);
//   3. el resto de las áreas nombradas con lo que sobra.
// Y aparte, en TODO turno de la app (no sólo con `buscaEnTodo`): `lecturasDeLasAcciones`, las lecturas que dan el id de lo que
// entró («(de listar_landings_creadas)»), con su margen: una acción que llega sin ellas no «llega» (MaKo inventa el id o vuelve a preguntar).
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

/** Las palabras de una operación (su id y título; su descripción), una vez: el registro tiene más de mil y cada turno las recorre todas. */
const PALABRAS_DE = new WeakMap<OperacionDef, { fuerte: string[]; debil: string[] }>();
function palabrasDe(d: OperacionDef): { fuerte: string[]; debil: string[] } {
  let p = PALABRAS_DE.get(d);
  if (!p) { p = { fuerte: tokens(`${d.id} ${d.titulo}`), debil: tokens(d.descripcion) }; PALABRAS_DE.set(d, p); }
  return p;
}

/** Puntaje de una operación para un texto: 2 por raíz al PRINCIPIO de una palabra de su id o título, 1 si es de su descripción. */
export function puntajePorInicio(d: OperacionDef, texto: string, raices: readonly string[] = raicesUtiles(texto)): number {
  if (!raices.length) return 0;
  const { fuerte, debil } = palabrasDe(d);
  return raices.reduce((n, r) => n + (fuerte.some((t) => t.startsWith(r)) ? 2 : debil.some((t) => t.startsWith(r)) ? 1 : 0), 0);
}

// ── Las operaciones que quitan, cortan o cancelan algo ───────────────────────────────────────────────────────────

const VERBOS_DESTRUCTIVOS: ReadonlySet<string> = new Set([
  'borrar', 'eliminar', 'cancelar', 'anular', 'descartar', 'quitar', 'sacar', 'archivar', 'pausar', 'desvincular', 'suspender', 'reembolsar',
  'baja', 'desactivar', 'apagar', 'retirar', 'olvidar', 'ocultar', 'restablecer', 'reiniciar', 'revertir', 'vaciar', 'despublicar', 'desconectar', 'rechazar',
]);
/**
 * ¿Una acción que borra, quita o corta algo? Lo dice el VERBO de su id. ⚠️ NO `reversible === false`: esa marca la llevan 127 de
 * las 353 acciones de la app (enviar un broadcast, invitar a un miembro, crear una secuencia, levantar un ticket) y contarla
 * frenaba «invitá a Ana» e «inscribí a Juan». Lo irreversible no se frena acá: lo frena la tarjeta, que lo dice antes del toque.
 */
export function esDestructiva(d: OperacionDef): boolean {
  if (d.tipo === 'lectura') return false;
  return d.id.split('_').some((t) => VERBOS_DESTRUCTIVOS.has(t));
}
/** ¿Una lectura que gasta IA, plata o un servicio externo? */
export const lecturaConCosto = (d: OperacionDef): boolean => d.tipo === 'lectura' && d.costo !== 'gratis';

/** Las palabras de enlace de un nombre o de un pedido: no dicen cuál es la cosa. */
const ENLACE: ReadonlySet<string> = new Set([
  'un', 'una', 'uno', 'unos', 'unas', 'el', 'la', 'los', 'las', 'de', 'del', 'al', 'en', 'con', 'para', 'por', 'que', 'se', 'su', 'sus', 'mi', 'mis',
  'tu', 'tus', 'lo', 'le', 'les', 'o', 'y', 'a', 'e', 'ya', 'mas', 'sin', 'como', 'todo', 'todos', 'todas', 'ese', 'esa', 'esos', 'esas', 'este',
  'esta', 'estos', 'estas', 'otro', 'otra', 'entre', 'hay', 'hoy', 'ver',
]);
/** Palabras del NOMBRE de una operación que son su verbo o su canal y no la cosa que toca. */
const SIN_COSA: ReadonlySet<string> = new Set([
  ...VERBOS_DESTRUCTIVOS, ...ENLACE, 'proponer', 'dar', 'reanudar', 'reactivar', 'whatsapp', 'empresa', 'negocio', 'mako', 'meta', 'oficial', 'propio',
  'propia', 'ajeno', 'ajena', 'nuevo', 'nueva', 'personal', 'siempre', 'internet',
]);
/**
 * Otras palabras con las que la gente nombra la misma cosa. Sólo de la CABEZA del nombre de una operación (su sustantivo):
 * «quitá el gráfico» es `quitar_componente_dashboard`, «pausá el sitio» es `pausar_landing`. Una palabra que no está acá y
 * tampoco en el id ni en el título no abre la operación: MaKo pregunta.
 */
const SINONIMOS: Readonly<Record<string, readonly string[]>> = {
  landing: ['sitio', 'pagina', 'web'], componente: ['grafico', 'tabla', 'elemento', 'widget', 'torta', 'barras', 'indicador'], hoja: ['pestana'], miembro: ['persona', 'closer', 'setter', 'equipo'],
  entidad: ['campana', 'conjunto', 'anuncio'], borrador: ['mensaje'], chat: ['conversacion'], reunion: ['llamada', 'cita', 'visita'],
  etiqueta: ['tag'], destinatario: ['reporte', 'aviso'], cliente: ['alumno', 'baja'], secuencia: ['automatizacion', 'nutricion', 'flujo'], broadcast: ['difusion'],
  // Un elemento de un editor se nombra por lo que ES (27/10/2026: «borrá el logo del video», «ocultá el logo del diseño»).
  elementos: ['clip', 'capa', 'logo', 'sticker', 'forma', 'rectangulo', 'circulo'], elemento: ['clip', 'capa', 'logo', 'sticker', 'forma', 'rectangulo', 'circulo'],
  cobro: ['pago'],
};

/** Cuántas operaciones destructivas llevan cada palabra en su nombre: una palabra de 1 a 3 es DE una cosa; de más, es de un área («landing», «video»). */
let DF: Map<string, number> | null = null;
function esDistintiva(tok: string): boolean {
  if (!DF) {
    DF = new Map();
    for (const d of REGISTRO) if (esDestructiva(d)) for (const t of new Set(cosasDe(d).todas)) DF.set(t, (DF.get(t) ?? 0) + 1);
  }
  return (DF.get(tok) ?? 0) <= 3;
}

/** Las palabras que NOMBRAN la cosa de una operación: sin su verbo ni su canal, en el orden de su id y su título. */
function cosasDe(d: OperacionDef): { cabeza: string | undefined; cabezaDelTitulo: string | undefined; delId: string[]; todas: string[] } {
  const delId = tokens(d.id.replace(/_/g, ' ')).filter((t) => t.length >= 3 && !SIN_COSA.has(t));
  const tit = tokens(d.titulo);
  // El título arranca con el verbo en infinitivo («Quitar el dominio propio», «Eliminarle una etiqueta a un lead»).
  const delTitulo = (/(?:ar|er|ir|arle|erle|irle|arla|arlo)$/.test(tit[0] ?? '') ? tit.slice(1) : tit).filter((t) => t.length >= 3 && !SIN_COSA.has(t));
  return { cabeza: delId[0], cabezaDelTitulo: delTitulo.length === 1 ? delTitulo[0] : undefined, delId, todas: [...new Set([...delId, ...delTitulo])] };
}

/** ¿La palabra `w` del pedido es el sustantivo `tok`? Por el principio de la palabra («audios» ≈ «audio», «landings» ≈ «landing»). */
function esLaMisma(w: string, tok: string): boolean {
  if (tok.length <= 3) return w === tok || w === `${tok}s`;
  const k = Math.min(5, tok.length, w.length);
  return k >= 4 && w.slice(0, k) === tok.slice(0, k);
}

/**
 * ¿El pedido NOMBRA la cosa de esta operación? Alcanza una: el sustantivo de su id («borrá el audio 3» → `borrar_audio`), el único
 * sustantivo de su título («ocultá el chat» → `ocultar_contacto_whatsapp_empresa`, «Ocultar un chat personal»), una palabra con la que se
 * la nombra (`SINONIMOS`), una palabra de su ID que es sólo de ella (hasta 3 operaciones destructivas la llevan: «la secuencia» →
 * `sacar_lead_de_secuencia`; «landing» y «video» no, que son de diez), o DOS palabras distintas de su nombre («la nota de voz» →
 * «Borrar una nota de voz»; «la nota» sola no: es una nota de un lead).
 */
export function nombraLaCosa(d: OperacionDef, texto: string): boolean {
  const palabras = norm(texto).split(/[^a-z0-9]+/).filter((w) => w.length >= 3 && !ENLACE.has(w));
  if (!palabras.length) return false;
  const nombra = (tok: string) => palabras.some((w) => esLaMisma(w, tok));
  const { cabeza, cabezaDelTitulo, delId, todas } = cosasDe(d);
  // Una cabeza sola alcanza si la operación se llama con una o dos palabras: «borrá el audio» sí, «borrá la foto» (borrar_foto_cara_de_marca) no.
  const corto = delId.length <= 2;
  if (corto && cabeza && nombra(cabeza)) return true;
  if (cabezaDelTitulo && nombra(cabezaDelTitulo)) return true;
  for (const c of [cabeza, cabezaDelTitulo]) if (c && (SINONIMOS[c] ?? []).some(nombra)) return true;
  return (corto && delId.some((t) => nombra(t) && esDistintiva(t))) || todas.filter(nombra).length >= 2;
}

/**
 * La puerta de las operaciones destructivas de un turno de la app: dejan pasar a toda la que no lo es, y a la que lo es sólo si la
 * persona pidió QUITAR algo (`quita`: lib/mako-intencion-app.ts → `pideQuitar`) y nombró la cosa de esa operación.
 */
export function puertaDeDestructivas(texto: string, quita: boolean): (d: OperacionDef) => boolean {
  return (d) => !esDestructiva(d) || (quita && nombraLaCosa(d, texto));
}

/** Lo que MaKo hace cuando le piden quitar algo y no llegó ninguna operación que lo haga con lo que se nombró. */
export const INSTRUCCION_QUITAR_SIN_OBJETO =
  'SI TE PIDEN QUITAR, BORRAR, CANCELAR O CORTAR ALGO (no «sácame un reporte» ni «corta el video») y el pedido no nombra la cosa de ninguna herramienta que tengas, NO elijas una por parecida: pregunta en UNA línea qué quiere quitar (el tipo y el nombre). Si no tienes con qué hacerlo, dilo y di que se hace desde su pantalla.';

// ── Las lecturas que dan el id de lo que entró ───────────────────────────────────────────────────────────────────

/** Los ids de lecturas que la descripción de una operación (o la de sus parámetros) nombra como origen de lo que pide. */
export function lecturasQueNombra(d: OperacionDef): string[] {
  const texto = [d.descripcion, ...((d as unknown as { parametros?: Array<{ descripcion?: string }> }).parametros ?? []).map((p) => p.descripcion ?? '')].join(' ');
  const ids = texto.match(/[a-z]+(?:_[a-z0-9]+)+/g) ?? [];
  return [...new Set(ids)].filter((id) => id !== d.id && porId(id)?.tipo === 'lectura');
}

const tam = (t: ToolDef): number => JSON.stringify(t).length;

/** Margen aparte (en caracteres) para las lecturas que dan el id de lo que entró. */
export const MARGEN_DE_LECTURAS = 3500;

/**
 * Las lecturas que dan el id de las acciones que viajan («de listar_landings_creadas», «salen de ver_proyecto_video») y todavía no
 * están, dentro de `MARGEN_DE_LECTURAS`. En TODO turno de la app: el 21/10/2026 se midió que un pedido sobre una landing o un lead
 * (que no pasa por `buscaEnTodo`) llegaba con `poner_enlace_landing` y sin la lista de landings.
 */
export function lecturasDeLasAcciones(acciones: readonly string[], vista: Vista, deMas: (nombre: string) => boolean = () => true, yaViajan: ReadonlySet<string> = new Set()): ToolDef[] {
  const ya = new Set<string>([...acciones, ...yaViajan]);
  const extra: ToolDef[] = [];
  let margen = MARGEN_DE_LECTURAS;
  for (const nombre of acciones) {
    const d = porId(nombre);
    if (!d || d.tipo === 'lectura') continue;
    for (const id of lecturasQueNombra(d)) {
      const lec = porId(id);
      if (!lec || ya.has(lec.id) || !visible(lec, vista) || !deMas(lec.id)) continue;
      const tool = aToolDef(lec);
      if (tam(tool) > margen) continue;
      margen -= tam(tool); ya.add(lec.id); extra.push(tool);
    }
  }
  return extra;
}

// ── Las pasadas ──────────────────────────────────────────────────────────────────────────────────────────────────

export type PedidoDeRegistro = {
  vista: Vista;
  /** las áreas que el texto, la familia o el detector nombran */
  areas: readonly Area[];
  /** lo que escribió la persona SIN la orden del arranque ni el saludo (lo que puntúa la pasada 2 y nombra la cosa) */
  texto: string;
  /** el texto + las palabras de la familia (lo que ordena las pasadas 1 y 3, como siempre) */
  relevanteA: string;
  /** las palabras de la familia: son el NOMBRE de la operación, y entran a la pasada 2 tal cual */
  relevancia: string;
  /** el pedido pide quitar, cortar o cancelar algo (abre la puerta de las destructivas que nombra) */
  quita: boolean;
  /** la orden que se le sacó al texto («invitá», «quiero crear»): puntúa sólo si es de pocas operaciones */
  orden?: string;
  conAcciones: boolean;
  excluir: ReadonlySet<string>;
  presupuesto: number;
};

/** Un verbo que está en el id de pocas operaciones (invitar, inscribir, destilar) dice cuál se pide; «crear» o «poner» están en cientos y no. */
let VERBOS_RAROS: Map<string, number> | null = null;
function esVerboRaro(raiz: string): boolean {
  if (!VERBOS_RAROS) VERBOS_RAROS = new Map();
  const c = VERBOS_RAROS.get(raiz) ?? REGISTRO.filter((d) => tokens(d.id.replace(/_/g, ' ')).some((t) => t.startsWith(raiz))).length;
  VERBOS_RAROS.set(raiz, c);
  return c > 0 && c <= 4;
}

/**
 * Las operaciones del registro para un turno de la app que busca en todo el registro. Ver la cabecera para las pasadas.
 * Sin área ni raíces útiles no entra nada: la pasada 2 exige una raíz al principio de una palabra, así que un mensaje de charla no llena el presupuesto.
 */
export function registroParaLaApp(p: PedidoDeRegistro): ToolDef[] {
  const relevante = `${p.texto}\n${p.relevancia}\n${raicesUtiles(p.orden ?? '').filter(esVerboRaro).join(' ')}`;
  const raices = raicesUtiles(relevante);
  const hayRaices = raices.length > 0;
  const puerta = puertaDeDestructivas(p.texto, p.quita);
  const comun = { vista: p.vista, incluirAcciones: p.conAcciones, sinAviso: true, donde: puerta } as const;
  const nombran = new Set<string>(p.areas);

  // 0. Lo que la persona NOMBRA por una palabra que dicen pocas operaciones («Calendly»), primero (ver `porSuNombre`).
  const cero = p.areas.length ? porSuNombre(p, puerta) : [];
  const usados0 = cero.reduce((n, t) => n + tam(t), 0);

  // 1. Las áreas que el texto nombra, hasta el 75%.
  const uno = p.areas.length
    ? toolsDelRegistro({ ...comun, areas: p.areas, excluir: new Set([...p.excluir, ...cero.map((t) => t.name)]), maxChars: Math.floor(p.presupuesto * 0.75) - usados0, relevanteA: p.relevanteA })
    : [];
  const usados1 = usados0 + uno.reduce((n, t) => n + tam(t), 0);
  const ya = new Set<string>([...p.excluir, ...cero.map((t) => t.name), ...uno.map((t) => t.name)]);

  // 2. Las otras áreas, sólo lo que puntúa por una raíz al principio de una palabra y no cuesta. Se ordena por ESE puntaje (y, a
  //    igual puntaje, la más corta) y se arma a mano: el orden del registro es por substring y por orden de declaración.
  const tope2 = Math.min(Math.floor(p.presupuesto * 0.25), p.presupuesto - usados1);
  const dos: ToolDef[] = [];
  if (hayRaices) {
    const candidatas = REGISTRO
      .filter((d) => !nombran.has(d.area) && !ya.has(d.id) && !(d.alias ?? []).some((a) => ya.has(a)) && visible(d, p.vista)
        && (p.conAcciones || d.tipo === 'lectura') && puerta(d) && !lecturaConCosto(d))
      // Una destructiva que llegó hasta acá NOMBRÓ su cosa (la puerta): entra aunque su nombre no comparta raíz con el texto («pausá el
      // sitio» → `pausar_landing`) y va primero, antes de las que sólo puntúan por parecerse.
      .map((d) => ({ d, nombrada: esDestructiva(d), pts: esDestructiva(d) ? Math.max(2, puntajePorInicio(d, relevante, raices)) : puntajePorInicio(d, relevante, raices) }))
      .filter((x) => x.pts >= 2)
      .map((x) => ({ ...x, tool: aToolDef(x.d) }))
      .sort((a, b) => Number(b.nombrada) - Number(a.nombrada) || b.pts - a.pts || tam(a.tool) - tam(b.tool));
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
  return [...cero, ...uno, ...tres, ...dos];
}

/** El texto en minúsculas y sin tildes, como lo compara el registro. */
const normalizarTexto = (s: string): string => s.toLowerCase().normalize('NFD').replace(/[\u0300-\u036f]/g, '');
/** Cuántas operaciones del registro pueden llevar una palabra en su id para que nombrarla las señale (≤ 3: «calendly», no «lead»). */
const RARA = 3;
/** Margen para lo nombrado por su palabra: una o dos lecturas, nunca el presupuesto de las áreas. */
export const MARGEN_DE_NOMBRADAS = 1500;
let palabrasDeIds: Map<string, number> | null = null;
/** En cuántos ids del registro aparece cada palabra (las partes de `link_agenda_calendly`). Se cuenta una vez. */
function vecesEnIds(): Map<string, number> {
  if (palabrasDeIds) return palabrasDeIds;
  const m = new Map<string, number>();
  for (const d of REGISTRO) for (const w of new Set(d.id.split('_'))) m.set(w, (m.get(w) ?? 0) + 1);
  return (palabrasDeIds = m);
}

/**
 * Las operaciones de las áreas nombradas cuyo id lleva, ENTERA, una palabra que escribió la persona y que casi ninguna otra lleva.
 * 22/10/2026 (OC1, al traer main a Ops Center 1.2): en «mandale a Juan el link de Calendly» la pista del clasificador («crear borrador
 * whatsapp empresa mensaje…») ordena primero las de WhatsApp y Chats, y con las de Chats 2.1 llenaban el 75% antes de llegar a
 * `link_agenda_calendly`. Darle más peso a lo que escribió la persona reordenaba seis grupos de frases medidas; esto sólo suma lo
 * que se nombró por su palabra propia, dentro de `MARGEN_DE_NOMBRADAS`, y deja el orden de lo demás como estaba.
 */
function porSuNombre(p: PedidoDeRegistro, puerta: (d: OperacionDef) => boolean): ToolDef[] {
  const veces = vecesEnIds();
  const dichas = new Set(normalizarTexto(p.texto).split(/[^a-z0-9]+/).filter((w) => w.length >= 5 && (veces.get(w) ?? 0) > 0 && (veces.get(w) ?? 0) <= RARA));
  if (!dichas.size) return [];
  const out: ToolDef[] = [];
  let margen = MARGEN_DE_NOMBRADAS;
  for (const d of REGISTRO) {
    if (!p.areas.includes(d.area) || p.excluir.has(d.id) || !visible(d, p.vista) || !puerta(d)) continue;
    if (!p.conAcciones && d.tipo !== 'lectura') continue;
    if (!d.id.split('_').some((w) => dichas.has(w))) continue;
    const t = aToolDef(d);
    if (tam(t) > margen) continue;
    margen -= tam(t); out.push(t);
  }
  return out;
}
