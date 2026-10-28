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
// =============================================================================

import 'server-only';
import { chatClaude } from '../anthropic';
import { errorDeCascada } from '../ai-cheap';
import { renderPrompt, contenidoNoConfiable } from '../prompt-render';
import { brandSystem } from '../landing-writer';
import { REGLA_NO_EXISTE } from '../no-existe';
import { conPedidoDeNoExisteDeLaSesion } from '../no-existe-server';
import { resolverAcento } from '../acento-workspace';
import { tzDeWorkspace } from '../timezone';
import { getWorkspaceActual } from '../workspace';
import { getVozCliente, type VozCliente } from '@/app/video-generator/voz-cliente';
import { contextoDelNegocio } from './contexto';
import { PROMPTS_COPY, TOPES_IA, bloqueIdiomaCopy, charlaParaIA, guionParaIA, propsParaIA } from './ia-reglas';
import { sanearContenido } from './doc';
import { sanearProps, SIN_TITULO, type JsonNodo } from './tipos';
import { catalogosDelCopywriter } from './catalogos-server';

/** La feature de la IA del Copywriter (lib/model-catalogo.ts). */
export const FEATURE_COPY = 'copywriter-ia';

export type ResultadoIA<T> = ({ ok: true } & T) | { ok: false; error: string; status: 400 | 502 };
const invalido = (error: string) => ({ ok: false as const, error, status: 400 as const });
const sinResultado = (error: string) => ({ ok: false as const, error, status: 502 as const });

const PLAZOS = { discutir: 60_000 } as const;

/** El mensaje de una falla para la persona (lo técnico, al log). Ver `falloIA` en lib/editor-landing/ia.ts. */
async function falloIA(e: unknown, tema: string): Promise<string> {
  const msg = e instanceof Error ? e.message : String(e);
  console.error(`[copywriter] ${tema}: ${msg}`);
  return errorDeCascada(/Claude vetado/i.test(msg) ? [] : [msg], tema);
}

/** El acento del negocio (el del Video Generator: lo declarado, o la zona horaria, o el neutro). Nunca tira. */
async function acentoDelNegocio(): Promise<string | null> {
  try {
    const ws = await getWorkspaceActual().catch(() => null);
    const voz = await getVozCliente().catch((): VozCliente => ({ acento: '', muletillas: [], muestras: [] }));
    const zona = ws != null ? await tzDeWorkspace(ws).catch(() => null) : null;
    return resolverAcento(voz.acento, zona, voz.muletillas, voz.acentoOrigen).prompt;
  } catch {
    return null;
  }
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
export async function discutir(p: { pregunta: unknown; guion: GuionDelPedido; charla?: unknown; lecturas?: readonly { nombre: string; texto: string }[] }): Promise<ResultadoIA<{ respuesta: string }>> {
  const t0 = Date.now();
  const pregunta = typeof p.pregunta === 'string' ? p.pregunta.trim().slice(0, TOPES_IA.pregunta) : '';
  if (!pregunta) return invalido('Escribe qué quieres pensar.');
  const g = guionDe(p.guion);
  try {
    const [acento, negocio, n] = await Promise.all([acentoDelNegocio(), contextoDelNegocio(pregunta), nombres(g.props)]);
    const sys = await brandSystem(`${await renderPrompt(PROMPTS_COPY.discutirSystem.key, PROMPTS_COPY.discutirSystem.tpl, { idioma: bloqueIdiomaCopy(acento) })}\n\n${REGLA_NO_EXISTE}`);
    const charla = charlaParaIA(p.charla);
    const user = await renderPrompt(PROMPTS_COPY.discutirUser.key, PROMPTS_COPY.discutirUser.tpl, {
      pregunta: contenidoNoConfiable(pregunta, 'pregunta'),
      titulo: g.titulo.replace(/[«»]/g, ''),
      props: propsParaIA(g.props, n),
      guion: contenidoNoConfiable(guionParaIA(g.doc), 'guion'),
      charla: charla ? `LA CHARLA HASTA AHORA (lo último):\n${contenidoNoConfiable(charla, 'charla')}\n\n` : '',
      negocio: `EL NEGOCIO (del Second Brain, sólo lo que hace falta):\n${negocio ? contenidoNoConfiable(negocio, 'negocio') : '(no hay datos del negocio cargados)'}`,
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
    return { ok: true, respuesta };
  } catch (err) {
    return { ok: false, error: await falloIA(err, 'contestar'), status: 502 };
  }
}
