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
import { PROMPTS_COPY, TOPES_IA, avisosDeCifras, bloqueIdiomaCopy, charlaParaIA, cifrasSinFuente, guionParaIA, propsParaIA, tituloDeRespaldo } from './ia-reglas';
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
import { NOMBRE_DEL_ORIGINAL, frasesDelOriginal } from './outliers';
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
async function acentoDelNegocio(): Promise<string | null> {
  return (await acentoConId())?.prompt ?? null;
}
async function acentoConId(): Promise<{ id: string; prompt: string } | null> {
  try {
    const ws = await getWorkspaceActual().catch(() => null);
    const voz = await getVozCliente().catch((): VozCliente => ({ acento: '', muletillas: [], muestras: [] }));
    const zona = ws != null ? await tzDeWorkspace(ws).catch(() => null) : null;
    const a = resolverAcento(voz.acento, zona, voz.muletillas, voz.acentoOrigen);
    return { id: a.id, prompt: a.prompt };
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
    const [acento, negocio, n, refs] = await Promise.all([acentoDelNegocio(), contextoDelNegocio(pregunta), nombres(g.props), leerReferencias(conElOriginal(p.referencias, g.props))]);
    const sys = await brandSystem(`${await renderPrompt(PROMPTS_COPY.discutirSystem.key, PROMPTS_COPY.discutirSystem.tpl, { idioma: bloqueIdiomaCopy(acento) })}\n\n${await metodo()}\n\n${REGLA_NO_EXISTE}`);
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
    const respuesta = [ne.texto.slice(0, 2_000), ne.linea].filter(Boolean).join('\n\n');
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
    const sys = await brandSystem(`${await renderPrompt(PROMPTS_EDITAR.editarSystem.key, PROMPTS_EDITAR.editarSystem.tpl, { idioma: bloqueIdiomaCopy(acento?.prompt ?? null, !!acento && VOSEAN.has(acento.id)), formato: FORMATO_EDITAR })}\n\n${await metodo()}\n\n${REGLA_NO_EXISTE}`);
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
    const salida = await chatClaude(sys, [{ role: 'user', content: user }], {
      feature: FEATURE_COPY,
      motivo: pl?.ejemplo ? 'Adaptar una plantilla al negocio (Copywriter)' : 'Escribir en un guion (Copywriter)',
      maxTokens: 6_000,
      thinking: false,
      hastaMs: t0 + PLAZOS.editar,
    });
    const raw = await objetoConUnaReparacion(String(salida ?? ''), reparador(t0 + PLAZOS.editar));
    const ne = await conPedidoDeNoExisteDeLaSesion(typeof raw.respuesta === 'string' ? raw.respuesta.trim() : '', { chat: 'copywriter (Editar)', ruta: '/copywriter', pedido: instruccion });
    const catalogo = { angulos: new Set(lite.angulos.map((a) => a.id)), estructuras: new Set(lite.estructuras.map((e) => e.id)) };
    const s = sanearOperaciones(raw.operaciones, g.doc, catalogo);
    // La voz (capa 2 de la regla del idioma): lo escrito por MaKo con formas de «vos» en un negocio que no habla así.
    const r = aplicarTodo(g.doc, s.ops);
    // El título (capa 2 de «ponle un título propio», 12/11/2026, en producción: la plantilla quedaba «Sin título» y la réplica con el
    // gancho del competidor): una pieza escrita entera sobre una página sin título propio sale con lo primero que se dice.
    const entera = s.ops.filter((op) => op.op === 'escribir_seccion').length >= 2;
    const sinTituloPropio = !g.titulo.trim() || g.titulo === SIN_TITULO || /^Como @/.test(g.titulo);
    if (entera && sinTituloPropio && !s.ops.some((op) => op.op === 'titulo')) {
      const t = tituloDeRespaldo(extractoDelDoc(r.doc));
      if (t) s.ops.push({ op: 'titulo', texto: t });
    }
    const nuevos = new Set(r.nuevos);
    const escrito = (r.doc.content ?? []).filter((b) => nuevos.has(b.attrs?.bid as string)).map(textoDeNodo).join('\n');
    const voseo = acento && VOSEAN.has(acento.id) ? [] : marcasDeVoseo(escrito);
    const avisos = voseo.length ? [`Tiene voseo (${voseo.slice(0, 4).join(', ')}): si tu audiencia no habla así, pídele a MaKo que lo cambie.`] : [];
    // La réplica de un outlier (capa 2 de «nunca copies sus frases», lib/copywriter/outliers.ts → frasesDelOriginal).
    const original = g.props.outlier ? refs.textos.find((x) => x.nombre === NOMBRE_DEL_ORIGINAL)?.texto ?? '' : '';
    // También el TÍTULO que propone (11/11/2026, en producción: el cuerpo ya era propio y el título seguía siendo «Cobrar más no es
    // suerte, es sistema»). Por separado, para que una frase no se arme con el final del título y el principio del cuerpo.
    const copiadas = original ? [...new Set([...frasesDelOriginal(original, r.titulo ?? ''), ...frasesDelOriginal(original, escrito)])] : [];
    if (copiadas.length) avisos.push(`Repite frases del original («${copiadas.slice(0, 2).join('», «')}»): pídele a MaKo que lo diga con tus palabras.`);
    // Las cifras y la garantía sin fuente (12/11/2026, en producción: la réplica de YouTube inventó porcentajes y una devolución).
    const fuentes = [negocio, refs.textos.map((x) => x.texto).join('\n'), instruccion, charla, guionParaIA(g.doc), ...(p.lecturas ?? []).map((l) => l.texto)].join('\n');
    avisos.push(...avisosDeCifras(cifrasSinFuente(`${r.titulo ?? ''}\n${escrito}`, fuentes)));
    const respuesta = [ne.texto.slice(0, 1_200), ne.linea].filter(Boolean).join('\n\n') || (s.ops.length ? 'Listo: revisa lo que escribí.' : 'No cambié nada.');
    return { ok: true, respuesta, operaciones: s.ops, descartadas: [...s.descartadas, ...r.descartadas], avisos, noLeidas: refs.noLeidas };
  } catch (err) {
    return { ok: false, error: await falloIA(err, 'escribir'), status: 502 };
  }
}
