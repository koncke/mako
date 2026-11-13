// =============================================================================
// copywriter/ia — MaKo en el Copywriter: lo que habla con la IA (server-only)
// =============================================================================
// Diseño: docs/diseno-copywriter.md (D5). Lo puro (prompts, cómo se lee el guion, el catálogo de lo que puede hacer en
// el documento) vive en ./ia-reglas.ts.
//
// Cómo se llama a la IA (las reglas de la casa, con el molde del Web Generator, lib/editor-landing/ia.ts):
//   · `chatClaude(system, mensajes, { feature, motivo, maxTokens, hastaMs })` con la feature `copywriter-ia`: Gemini por
//     defecto (lib/model-catalogo.ts) y respeta /modelos-ia. Claude está vetado (sin fila en CLAUDE_PERMITIDO). Quien
//     paga es el negocio, con SU IA: la cascada usa las claves del workspace de la pestaña.
//   · cada pedido va acotado con `hastaMs`: si el plazo no alcanza, falla — nunca paga para ganar tiempo;
//   · los errores van por `errorDeCascada` (lib/ai-cheap.ts): «no hay IA» y «hay IA y falló» son dos frases;
//   · lo que no existe en MaKo se dice y sale a la Ticketera (REGLA_NO_EXISTE + `conPedidoDeNoExisteDeLaSesion`).
//   · el negocio entra por el Second Brain, sólo lo que hace falta (./contexto.ts, con su punto de enganche).
//   · EL MÉTODO DEL COPYWRITER (29/10/2026, ./experto.ts: `copywriter.experto`) va en los dos system, antes de
//     REGLA_NO_EXISTE, sin ser un slot de ellos (un override guardado no lo tendría); «Adaptar a mi negocio» es `editar`
//     con el user `copywriter.adaptar.user` (docs/plantillas-reales/copywriter.md, 3.3).
// =============================================================================

import 'server-only';
import { chatClaude } from '../anthropic';
import { chatCheapCascade, errorDeCascada } from '../ai-cheap';
import { renderPrompt, contenidoNoConfiable } from '../prompt-render';
import { brandSystem } from '../landing-writer';
import { REGLA_NO_EXISTE } from '../no-existe';
import { conPedidoDeNoExisteDeLaSesion } from '../no-existe-server';
import { resolverAcento } from '../acento-workspace';
import { tzDeWorkspace } from '../timezone';
import { getWorkspaceActual } from '../workspace';
import { getVozCliente, type VozCliente } from '@/app/video-generator/voz-cliente';
import { contextoDelNegocio } from './contexto';
import { PROMPTS_COPY, SALIDA_VACIA, TOPES_IA, avisoDeDuracion, avisosDeCifras, bloqueIdiomaCopy, charlaParaIA, cifrasSinFuente, cortaParaSuDuracion, dichoQueNoQuedo, objetivoDeDuracion, guionParaIA, marcasDeTuteo, operacionesAlTuteo, propsParaIA, salidaVacia, sinExtrasNoPedidos, tipoDelPedido, tituloDeRespaldo } from './ia-reglas';
import { alTuteo } from '../al-tuteo';
import type { ClaudeMsg } from '../anthropic';
import { sanearContenido } from './doc';
import { sanearProps, SIN_TITULO, type JsonNodo } from './tipos';
import { catalogosDelCopywriter } from './catalogos-server';
import { getAngulosGuion } from '../guion-angulos-store';
import { getEstructurasTodas } from '../guion-estructuras-store';
import { ANGULOS_GUION_DEFAULT, instruccionesTexto } from '../guion-angulos';
import { ESTRUCTURAS_GUION_DEFAULT } from '../guion-estructuras';
import { catalogosLite, conVsl, estructurasDelTipo } from './catalogos';
import { metodologiaDe } from '../ig-formatos';
import { metodologiaIgVigente } from '../ig-metodologia';
import { parseJsonObject } from '../json-del-modelo';
import { marcasDeVoseo } from '../puestas-data';
import { objetoConUnaReparacion, SalidaInvalida, SYSTEM_REPARAR_JSON } from '../editor-landing/ia-reglas';
import { FORMATO_EDITAR, PROMPTS_EDITAR, bibliotecaParaIA, estructuraParaIA } from './ia-editar';
import { sanearOperaciones, aplicarTodo, type Descartada, type OperacionIA } from './operaciones';
import { leerReferencias } from './referencias';
import { NOMBRE_DEL_ORIGINAL, avisoDeLargo, capitulosDe, conElLargoReal, frasesDelOriginal, largoFuera, largoPedido, palabrasDe, pedidoDeCorreccion, siguenLosCapitulos } from './outliers';
import type { Referencia } from './referencias-reglas';
import { textoDeNodo, textoDelDoc } from './doc';
import { PROMPTS_EXPERTO, pideParaIA } from './experto';
import { extractoDelDoc, plantillaPorId } from './plantillas';

/** El método del Copywriter (editable en /configuraciones): va en los dos system, antes de la regla de lo que no existe. */
const metodo = () => renderPrompt(PROMPTS_EXPERTO.experto.key, PROMPTS_EXPERTO.experto.tpl, {});

/** La feature de la IA del Copywriter (lib/model-catalogo.ts). */
export const FEATURE_COPY = 'copywriter-ia';

export type ResultadoIA<T> = ({ ok: true } & T) | { ok: false; error: string; status: 400 | 502 };
const invalido = (error: string) => ({ ok: false as const, error, status: 400 as const });
const sinResultado = (error: string) => ({ ok: false as const, error, status: 502 as const });

const PLAZOS = { discutir: 60_000, editar: 110_000 } as const;

/** El mensaje de una falla para la persona (lo técnico, al log). Ver `falloIA` en lib/editor-landing/ia.ts. */
async function falloIA(e: unknown, tema: string): Promise<string> {
  if (e instanceof SalidaInvalida) {
    console.error(`[copywriter] ${tema}: ${e.message}`, e.crudo.slice(0, 1_500));
    return 'MaKo respondió pero no se pudo leer. Vuelve a intentar.';
  }
  const msg = e instanceof Error ? e.message : String(e);
  console.error(`[copywriter] ${tema}: ${msg}`);
  return errorDeCascada(/Claude vetado/i.test(msg) ? [] : [msg], tema);
}

/** El acento del negocio (el del Video Generator: lo declarado, o la zona horaria, o el neutro). Nunca tira. */
async function acentoConId(): Promise<{ id: string; prompt: string; seguro: boolean } | null> {
  try {
    const ws = await getWorkspaceActual().catch(() => null);
    const voz = await getVozCliente().catch((): VozCliente => ({ acento: '', muletillas: [], muestras: [] }));
    const zona = ws != null ? await tzDeWorkspace(ws).catch(() => null) : null;
    const a = resolverAcento(voz.acento, zona, voz.muletillas, voz.acentoOrigen);
    // `seguro` = lo DECLARÓ el negocio (no salió de su zona horaria): es «la voz configurada» que le gana al «tú» del producto.
    return { id: a.id, prompt: a.prompt, seguro: a.seguro };
  } catch {
    return null;
  }
}

/** Los acentos que hablan de «vos»: en ellos, las formas voseantes del guion no son un error. */
const VOSEAN: ReadonlySet<string> = new Set(['ar', 'uy', 'py']);

/** Lo citado con «@», como datos. */
function bloqueReferencias(textos: readonly { nombre: string; texto: string }[]): string {
  if (!textos.length) return '';
  const cuerpo = textos.map((t) => `— ${t.nombre}:\n${t.texto}`).join('\n\n');
  return `LO QUE CITÓ LA PERSONA CON «@»:\n${contenidoNoConfiable(cuerpo, 'referencias')}\n\n`;
}

/** Lo que llega de la pantalla sobre el guion abierto (el documento vivo, sin guardar todavía). */
export type GuionDelPedido = { titulo?: unknown; props?: unknown; contenido?: unknown };

/** El guion del pedido, saneado como lo guardaría el server. */
function guionDe(g: GuionDelPedido) {
  const s = sanearContenido(g.contenido);
  const props = sanearProps(g.props);
  const titulo = typeof g.titulo === 'string' && g.titulo.trim() ? g.titulo.trim().slice(0, 200) : SIN_TITULO;
  return { doc: s.ok ? s.doc : ({ type: 'doc', content: [] } as JsonNodo), props, titulo };
}

/**
 * Lo citado, más el original que replica la página (D18, `props.outlier`): va en CADA pedido de esa página, no sólo en el primero,
 * así «cambia el gancho» sigue sabiendo qué se está replicando. Lo lee el server en el negocio de la pestaña (una pieza de Spy de
 * otro negocio no se encuentra) y no entra al documento.
 */
function conElOriginal(citadas: readonly Referencia[] | undefined, props: ReturnType<typeof sanearProps>): Referencia[] {
  const refs = [...(citadas ?? [])];
  return props.outlier ? [{ tipo: 'outlier', id: props.outlier, nombre: NOMBRE_DEL_ORIGINAL }, ...refs] : refs;
}

/** Los nombres del ángulo y la estructura elegidos (para que el modelo lea «Dolor», no «dolor»). */
async function nombres(props: ReturnType<typeof sanearProps>) {
  const c = await catalogosDelCopywriter();
  return {
    angulo: props.angulo ? c.angulos.find((a) => a.id === props.angulo)?.nombre ?? null : null,
    estructura: props.estructura ? c.estructuras.find((e) => e.id === props.estructura)?.nombre ?? null : null,
  };
}

/** Lo leído de los archivos del mensaje, como datos. */
function bloqueAdjuntos(lecturas: readonly { nombre: string; texto: string }[]): string {
  if (!lecturas.length) return '';
  const cuerpo = lecturas.map((l) => `— ${l.nombre}:\n${l.texto.slice(0, 12_000)}`).join('\n\n');
  return `\n\nLOS ARCHIVOS QUE ADJUNTÓ LA PERSONA:\n${contenidoNoConfiable(cuerpo, 'archivos')}`;
}

/**
 * «Discutir»: MaKo contesta sobre el guion sin tocarlo. Devuelve el texto (sin la marca de «no existe», que sale a la
 * Ticketera sola, con su línea).
 */
export async function discutir(p: { pregunta: unknown; guion: GuionDelPedido; charla?: unknown; lecturas?: readonly { nombre: string; texto: string }[]; referencias?: readonly Referencia[] }): Promise<ResultadoIA<{ respuesta: string; noLeidas: string[] }>> {
  const t0 = Date.now();
  const pregunta = typeof p.pregunta === 'string' ? p.pregunta.trim().slice(0, TOPES_IA.pregunta) : '';
  if (!pregunta) return invalido('Escribe qué quieres pensar.');
  const g = guionDe(p.guion);
  try {
    const [acento, negocio, n, refs] = await Promise.all([acentoConId(), contextoDelNegocio(pregunta), nombres(g.props), leerReferencias(conElOriginal(p.referencias, g.props))]);
    // La voz como en `editar`: la variedad sólo si el negocio la DECLARÓ (la de su zona horaria no cuenta).
    const declarado = acento?.seguro ? acento : null;
    const vosea = !!declarado && VOSEAN.has(declarado.id);
    const sys = await brandSystem(`${await renderPrompt(PROMPTS_COPY.discutirSystem.key, PROMPTS_COPY.discutirSystem.tpl, { idioma: bloqueIdiomaCopy(declarado?.prompt ?? null, vosea) })}\n\n${await metodo()}\n\n${REGLA_NO_EXISTE}`);
    const charla = charlaParaIA(p.charla);
    const user = await renderPrompt(PROMPTS_COPY.discutirUser.key, PROMPTS_COPY.discutirUser.tpl, {
      pregunta: contenidoNoConfiable(pregunta, 'pregunta'),
      titulo: g.titulo.replace(/[«»]/g, ''),
      props: propsParaIA(g.props, n),
      guion: contenidoNoConfiable(guionParaIA(g.doc), 'guion'),
      charla: charla ? `LA CHARLA HASTA AHORA (lo último):\n${contenidoNoConfiable(charla, 'charla')}\n\n` : '',
      referencias: bloqueReferencias(refs.textos),
      negocio: bloqueNegocio(negocio),
      adjuntos: bloqueAdjuntos(p.lecturas ?? []),
    });
    const salida = await chatClaude(sys, [{ role: 'user', content: user }], {
      feature: FEATURE_COPY,
      motivo: 'Discutir un guion (Copywriter)',
      maxTokens: 1_200,
      thinking: false,
      hastaMs: t0 + PLAZOS.discutir,
    });
    const limpio = String(salida ?? '').replace(/^```[a-z]*\s*/i, '').replace(/```\s*$/i, '').trim();
    const ne = await conPedidoDeNoExisteDeLaSesion(limpio, { chat: 'copywriter (Discutir)', ruta: '/copywriter', pedido: pregunta });
    // A la persona, siempre en «tú» (13/11/2026: «llevas… tenés» en la misma respuesta); lo citado, salvo que el negocio vosee.
    const respuesta = alTuteo([ne.texto.slice(0, 2_000), ne.linea].filter(Boolean).join('\n\n'), { citas: !vosea });
    if (!respuesta) return sinResultado('MaKo no contestó. Vuelve a intentar.');
    return { ok: true, respuesta, noLeidas: refs.noLeidas };
  } catch (err) {
    return { ok: false, error: await falloIA(err, 'contestar'), status: 502 };
  }
}

/** El negocio del Second Brain, como datos (o que no hay). */
const bloqueNegocio = (negocio: string) => `EL NEGOCIO (del Second Brain, sólo lo que hace falta):\n${negocio ? contenidoNoConfiable(negocio, 'negocio') : '(no hay datos del negocio cargados)'}`;

/** El paso de reparación: UN pedido a la cascada barata que copia la salida como JSON válido (el de lib/editor-landing/ia.ts). */
function reparador(hastaMs: number) {
  return async (crudo: string): Promise<string> => chatCheapCascade({
    system: SYSTEM_REPARAR_JSON,
    user: crudo,
    json: true,
    maxTokens: 8_000,
    temperature: 0,
    feature: FEATURE_COPY,
    motivo: 'reparar el JSON (Copywriter, Editar)',
    erroresOut: [],
    hastaMs: Math.max(hastaMs, Date.now() + 10_000),
    validar: (t: string) => { try { parseJsonObject(t); return true; } catch { return false; } },
  }).catch(() => '');
}

/** Lo que vuelve de «Editar»: el renglón para la persona, las herramientas validadas contra el guion y lo descartado. */
export type ResultadoEditar = {
  respuesta: string;
  operaciones: OperacionIA[];
  descartadas: Descartada[];
  /** Lo que la tarjeta avisa sobre lo escrito (la voz: voseo en un negocio que no habla así). */
  avisos: string[];
  /** Lo citado con «@» que no se pudo leer. */
  noLeidas: string[];
};

/**
 * «Editar»: MaKo escribe EN el guion con sus herramientas (lib/copywriter/operaciones.ts). Devuelve las operaciones ya
 * validadas contra el guion que mandó la pantalla; la pantalla las vuelve a validar contra lo de AHORA, las construye a
 * la vista y la persona acepta, descarta o reintenta (docs/diseno-copywriter.md, D5). Nada se guarda acá.
 *
 * `adaptar` (29/10/2026, «Adaptar a mi negocio»): la página nació de una plantilla con un ejemplo ficticio
 * (`props.plantilla`) y el pedido va con `copywriter.adaptar.user`: MaKo pregunta lo que falta (operaciones vacías) o
 * reescribe la pieza entera, con [DATO: …] donde el negocio no tiene el dato. La instrucción (el botón o la respuesta de
 * la persona a su pregunta) viaja en la charla: el prompt de adaptar no tiene un slot para ella.
 */
export async function editar(p: { instruccion: unknown; guion: GuionDelPedido; charla?: unknown; lecturas?: readonly { nombre: string; texto: string }[]; referencias?: readonly Referencia[]; adaptar?: boolean }): Promise<ResultadoIA<ResultadoEditar>> {
  const t0 = Date.now();
  const instruccion = typeof p.instruccion === 'string' ? p.instruccion.trim().slice(0, TOPES_IA.pregunta) : '';
  if (!instruccion) return invalido('Escribe qué quieres que escriba o cambie.');
  const g = guionDe(p.guion);
  try {
    const [acento, negocio, angulos, estructuras, refs] = await Promise.all([
      acentoConId(), contextoDelNegocio(instruccion),
      getAngulosGuion().catch(() => ANGULOS_GUION_DEFAULT), getEstructurasTodas().catch(() => ESTRUCTURAS_GUION_DEFAULT).then(conVsl),
      leerReferencias(conElOriginal(p.referencias, g.props)),
    ]);
    const lite = catalogosLite(angulos, estructuras);
    const angulo = g.props.angulo ? angulos.find((a) => a.id === g.props.angulo && a.activo) ?? null : null;
    const estructura = g.props.estructura ? estructuras.find((e) => e.id === g.props.estructura && e.activo) ?? null : null;
    // Sin estructura elegida, la primera de su tipo (si la biblioteca tiene alguna de ese tipo).
    const idSugerida = estructura ? null : estructurasDelTipo(lite, g.props.tipo).propias ? estructurasDelTipo(lite, g.props.tipo).estructuras[0]?.id ?? null : null;
    const sugerida = idSugerida ? estructuras.find((e) => e.id === idSugerida) ?? null : null;
    // La metodología de Instagram es EDITABLE desde /configuraciones (6/11/2026,
    // lib/ig-metodologia.ts): se lee la vigente, no la constante. Con la base caída cae al
    // default — acá la metodología ACOMPAÑA al guion, y una lectura que no salió no tiene
    // por qué voltear la escritura entera (mismo criterio que los catálogos de arriba).
    const metodologia = g.props.tipo === 'reel' || g.props.tipo === 'story'
      ? await metodologiaIgVigente(g.props.tipo).catch(() => metodologiaDe(g.props.tipo as 'reel' | 'story'))
      : '';
    const n = { angulo: angulo?.nombre ?? null, estructura: estructura?.nombre ?? null };
    // UNA SOLA VOZ (13/11/2026, el Cerebro: «"tú", en español neutro —es la regla del producto, que se usa en México—, salvo que el
    // negocio tenga otra voz configurada»). La configurada es la DECLARADA; la que sale de la zona horaria no cuenta (así el negocio
    // de MaKo, en Argentina por su zona, escribía con voseo y mezclado). Sin declarar: español neutro y «tú».
    const declarado = acento?.seguro ? acento : null;
    const vosea = !!declarado && VOSEAN.has(declarado.id);
    const sys = await brandSystem(`${await renderPrompt(PROMPTS_EDITAR.editarSystem.key, PROMPTS_EDITAR.editarSystem.tpl, { idioma: bloqueIdiomaCopy(declarado?.prompt ?? null, vosea), formato: FORMATO_EDITAR })}\n\n${await metodo()}\n\n${REGLA_NO_EXISTE}`);
    const charla = charlaParaIA(p.charla);
    const pl = p.adaptar ? plantillaPorId(lite, g.props.plantilla) : null;
    const user = pl?.ejemplo ? await renderPrompt(PROMPTS_EXPERTO.adaptarUser.key, PROMPTS_EXPERTO.adaptarUser.tpl, {
      plantilla: pl.nombre,
      ejemplo: `${pl.ejemplo.negocio}, ${pl.ejemplo.rubro}`,
      pide: pideParaIA(pl.pide ?? []),
      guion: contenidoNoConfiable(guionParaIA(g.doc), 'guion'),
      // Desde el 29/10/2026 la página nace con la estructura, no con el ejemplo: el ejemplo viaja acá, marcado ficticio,
      // para que MaKo vea la forma (sin un slot nuevo: el override guardado no lo tendría).
      // Y la biblioteca, para que ponga el ÁNGULO (12/11/2026, en producción la plantilla quedaba «Ángulo: Vacío»: sin ids no podía).
      estructura: `${estructuraParaIA(estructura ?? sugerida, !estructura)}${bibliotecaParaIA(lite)}EL EJEMPLO COMPLETO (de ${pl.ejemplo.negocio}, un negocio FICTICIO: sólo la forma, ningún dato):\n${textoDelDoc(pl.contenido())}\n\n`,
      negocio: bloqueNegocio(negocio),
      charla: `\n\nLA CHARLA HASTA AHORA (lo último):\n${contenidoNoConfiable([charla, `LA PERSONA, AHORA: ${instruccion}`].filter(Boolean).join('\n'), 'charla')}`,
    }) : await renderPrompt(PROMPTS_EDITAR.editarUser.key, PROMPTS_EDITAR.editarUser.tpl, {
      instruccion: contenidoNoConfiable(instruccion, 'instruccion'),
      titulo: g.titulo.replace(/[«»]/g, ''),
      props: propsParaIA(g.props, n),
      guion: contenidoNoConfiable(guionParaIA(g.doc), 'guion'),
      estructura: estructuraParaIA(estructura ?? sugerida, !estructura),
      angulo: angulo ? `EL ÁNGULO: ${angulo.nombre}\n${instruccionesTexto(angulo)}\n\n` : '',
      metodologia: metodologia ? `LA METODOLOGÍA (${g.props.tipo === 'reel' ? 'reels' : 'stories'}):\n${metodologia}\n\n` : '',
      biblioteca: bibliotecaParaIA(lite),
      charla: charla ? `LA CHARLA HASTA AHORA (lo último):\n${contenidoNoConfiable(charla, 'charla')}\n\n` : '',
      referencias: bloqueReferencias(refs.textos),
      negocio: bloqueNegocio(negocio),
      adjuntos: bloqueAdjuntos(p.lecturas ?? []),
    });
    const motivo = pl?.ejemplo ? 'Adaptar una plantilla al negocio (Copywriter)' : 'Escribir en un guion (Copywriter)';
    const pedir = async (mensajes: ClaudeMsg[], hastaMs: number) => objetoConUnaReparacion(String(await chatClaude(sys, mensajes, {
      feature: FEATURE_COPY, motivo, maxTokens: 6_000, thinking: false, hastaMs,
    }) ?? ''), reparador(hastaMs));
    const primero: ClaudeMsg[] = [{ role: 'user', content: user }];
    let raw = await pedir(primero, t0 + PLAZOS.editar);
    // Una salida VACÍA se pide una vez más si queda tiempo (ia-reglas → salidaVacia); las claves van al log para saber qué fue.
    if (salidaVacia(raw)) {
      console.warn('[copywriter] la IA devolvió un objeto vacío', JSON.stringify(raw).slice(0, 300));
      if (Date.now() < t0 + PLAZOS.editar - 45_000) raw = await pedir(primero, t0 + PLAZOS.editar);
    }
    const catalogo = { angulos: new Set(lite.angulos.map((a) => a.id)), estructuras: new Set(lite.estructuras.map((e) => e.id)) };
    const seccionesDeLaPagina: string[] = (g.doc.content ?? []).flatMap((b): string[] => { const sec = b.attrs?.seccion; return b.type === 'heading' && typeof sec === 'string' ? [sec] : []; });
    // Lo que escribió, ya saneado, en la voz del negocio y sin lo que nadie pidió, aplicado y medido.
    const medir = (x: Record<string, unknown>) => {
      const s = sanearOperaciones(x.operaciones, g.doc, catalogo);
      // La voz (13/11/2026): «tú» salvo un acento DECLARADO que vosea; lo que el modelo voseó igual se pasa solo (ia-reglas).
      if (!vosea) s.ops = operacionesAlTuteo(s.ops);
      s.ops = sinExtrasNoPedidos(s.ops, seccionesDeLaPagina, instruccion);
      const r = aplicarTodo(g.doc, s.ops);
      const nuevos = new Set(r.nuevos);
      const dicho = (r.doc.content ?? []).filter((b) => nuevos.has(b.attrs?.bid as string) && b.type !== 'heading').map(textoDeNodo).join('\n');
      const secciones = s.ops.flatMap((op) => (op.op === 'escribir_seccion' ? [op.seccion] : []));
      return { s, r, nuevos, entera: secciones.length >= 2, escritas: palabrasDe(dicho), secciones };
    };
    let m = medir(raw);
    // LA RÉPLICA SE CORRIGE SOLA (13/11/2026, el Cerebro: «Martín quiere que la réplica SALGA bien, no que le avisen que salió mal»;
    // en producción el anuncio de 35 palabras salió de 83 y el YouTube no siguió sus 8 capítulos). Fuera del ±25 % del largo, o sin
    // seguir los capítulos, una SEGUNDA PASADA con los números (outliers → pedidoDeCorreccion), y queda la que mejor cumple. El
    // aviso (más abajo) es el último recurso: lo que ni así entró.
    const original = g.props.outlier ? refs.textos.find((x) => x.nombre === NOMBRE_DEL_ORIGINAL)?.texto ?? '' : '';
    const largo = original ? largoPedido(original) : null;
    const capitulos = original ? capitulosDe(original) : [];
    // Y UNA PLANTILLA (o cualquier pieza escrita entera que no replica nada) corta para su DURACIÓN se completa sola (13/11/2026, el
    // Cerebro; en producción la VSL de 10 minutos salió de 587 palabras y la Clase de 42 de 617): debajo del 75 % de lo que pide.
    const segundosDe = (x: typeof m) => x.r.props.duracion ?? g.props.duracion;
    const fallas = (x: typeof m) => ({
      largo: largo != null && x.entera && largoFuera(largo, x.escritas),
      capitulos: x.entera && !siguenLosCapitulos(x.secciones, capitulos),
      corta: !original && x.entera && cortaParaSuDuracion(x.escritas, segundosDe(x)),
    });
    const puntos = (x: typeof m) => {
      const f = fallas(x);
      const objetivo = original ? null : objetivoDeDuracion(segundosDe(x));
      return Number(f.largo) + Number(f.capitulos) + Number(f.corta) + (largo ? Math.abs(x.escritas - largo) / largo / 10 : 0) + (objetivo ? Math.abs(x.escritas - objetivo) / objetivo / 10 : 0);
    };
    const f1 = fallas(m);
    if (m.entera && (f1.largo || f1.capitulos || f1.corta) && Date.now() < t0 + 170_000) {
      const segundos = segundosDe(m) ?? 0;
      const correccion = pedidoDeCorreccion({
        largo: f1.largo && largo ? { n: largo, escritas: m.escritas } : null,
        capitulos: f1.capitulos ? capitulos : [],
        duracion: f1.corta ? { segundos, objetivo: objetivoDeDuracion(segundos) ?? 0, escritas: m.escritas } : null,
      });
      const raw2 = await pedir([...primero, { role: 'assistant', content: JSON.stringify(raw) }, { role: 'user', content: correccion }], Math.min(Date.now() + 90_000, t0 + 270_000))
        .catch((e) => { console.warn('[copywriter] la segunda pasada no salió', e instanceof Error ? e.message : e); return null; });
      if (raw2 && !salidaVacia(raw2)) {
        const m2 = medir(raw2);
        if (m2.entera && puntos(m2) < puntos(m)) { raw = raw2; m = m2; }
      }
    }
    const { s, r, nuevos, entera } = m;
    const ne = await conPedidoDeNoExisteDeLaSesion(typeof raw.respuesta === 'string' ? raw.respuesta.trim() : '', { chat: 'copywriter (Editar)', ruta: '/copywriter', pedido: instruccion });
    // El título (capa 2 de «ponle un título propio», 12/11/2026, en producción: la plantilla quedaba «Sin título» y la réplica con el
    // gancho del competidor): una pieza escrita entera sobre una página sin título propio sale con lo primero que se dice.
    const sinTituloPropio = !g.titulo.trim() || g.titulo === SIN_TITULO || /^Como @/.test(g.titulo);
    if (entera && sinTituloPropio && !s.ops.some((op) => op.op === 'titulo')) {
      const t = tituloDeRespaldo(extractoDelDoc(r.doc));
      if (t) s.ops.push({ op: 'titulo', texto: t });
    }
    // Y el tipo: una pieza escrita sobre una «Página» vacía toma el que nombra el pedido, si la IA no lo puso (ia-reglas → tipoDelPedido).
    if (g.props.tipo === 'pagina' && r.nuevos.length && !textoDelDoc(g.doc).trim() && !s.ops.some((op) => op.op === 'propiedades' && op.tipo)) {
      const tipo = tipoDelPedido(instruccion);
      if (tipo) s.ops.push({ op: 'propiedades', tipo });
    }
    const escrito = (r.doc.content ?? []).filter((b) => nuevos.has(b.attrs?.bid as string)).map(textoDeNodo).join('\n');
    // La voz, ÚLTIMO RECURSO: lo que `alTuteo` no pudo pasar solo (un imperativo en -í, que también es pretérito) en un negocio de «tú».
    const voseo = vosea ? [] : marcasDeVoseo(escrito);
    const avisos = voseo.length ? [`Tiene voseo (${voseo.slice(0, 4).join(', ')}): si tu audiencia no habla así, pídele a MaKo que lo cambie.`] : [];
    // Y en un negocio que DECLARÓ un acento que vosea, la MEZCLA (13/11/2026, en producción: «pedís… vos» con «tiras… negocias»).
    if (vosea) {
      const conVoseo = marcasDeVoseo(escrito);
      const conTuteo = marcasDeTuteo(escrito);
      if (conVoseo.length && conTuteo.length) avisos.push(`Mezcla voseo y tuteo (${conVoseo.slice(0, 2).join(', ')} y ${conTuteo.slice(0, 2).join(', ')}): pídele a MaKo una sola forma.`);
    }
    // La réplica de un outlier (capa 2 de «nunca copies sus frases», lib/copywriter/outliers.ts → frasesDelOriginal).
    // También el TÍTULO que propone (11/11/2026, en producción: el cuerpo ya era propio y el título seguía siendo «Cobrar más no es
    // suerte, es sistema»). Por separado, para que una frase no se arme con el final del título y el principio del cuerpo.
    const copiadas = original ? [...new Set([...frasesDelOriginal(original, r.titulo ?? ''), ...frasesDelOriginal(original, escrito)])] : [];
    if (copiadas.length) avisos.push(`Repite frases del original («${copiadas.slice(0, 2).join('», «')}»): pídele a MaKo que lo diga con tus palabras.`);
    // Las cifras y la garantía sin fuente (12/11/2026, en producción: la réplica de YouTube inventó porcentajes y una devolución).
    const fuentes = [negocio, refs.textos.map((x) => x.texto).join('\n'), instruccion, charla, guionParaIA(g.doc), ...(p.lecturas ?? []).map((l) => l.texto)].join('\n');
    avisos.push(...avisosDeCifras(cifrasSinFuente(`${r.titulo ?? ''}\n${escrito}`, fuentes)));
    // Y lo que la respuesta dice que puso y no quedó (ia-reglas → dichoQueNoQuedo).
    const noQuedo = dichoQueNoQuedo(typeof raw.respuesta === 'string' ? raw.respuesta : '', `${r.titulo ?? g.titulo}\n${textoDelDoc(r.doc)}`);
    if (noQuedo) avisos.push(noQuedo);
    // El largo y los capítulos de la réplica, ÚLTIMO RECURSO: lo que ni con la segunda pasada entró (13/11/2026: 35 palabras pedidas
    // y 83 escritas; 8 capítulos en el original y las 9 secciones de la biblioteca en la réplica).
    if (original && entera) {
      const largoMal = avisoDeLargo(original, m.escritas);
      if (largoMal) avisos.push(largoMal);
      if (!siguenLosCapitulos(m.secciones, capitulos)) avisos.push(`El original tiene ${capitulos.length} capítulos y el guion no los sigue: pídele a MaKo una sección por capítulo.`);
    }
    // La duración de una pieza escrita entera que no replica nada (las plantillas largas: VSL, YouTube, la clase).
    if (!original && entera) {
      const duracion = avisoDeDuracion(m.escritas, r.props.duracion ?? g.props.duracion);
      if (duracion) avisos.push(duracion);
    }
    // La respuesta a la persona va SIEMPRE en «tú» (la regla del chat, ia-reglas → bloqueIdiomaCopy); lo citado en ella es del guion,
    // así que se pasa también, salvo en un negocio que vosea (ahí lo citado es su voz). Y con el largo REAL de la réplica.
    let respuesta = alTuteo([ne.texto.slice(0, 1_200), ne.linea].filter(Boolean).join('\n\n'), { citas: !vosea }) || (s.ops.length ? 'Listo: revisa lo que escribí.' : salidaVacia(raw) ? SALIDA_VACIA : 'No cambié nada.');
    if (largo != null && entera) respuesta = conElLargoReal(respuesta, m.escritas, largo);
    return { ok: true, respuesta, operaciones: s.ops, descartadas: [...s.descartadas, ...r.descartadas], avisos, noLeidas: refs.noLeidas };
  } catch (err) {
    return { ok: false, error: await falloIA(err, 'escribir'), status: 502 };
  }
}
