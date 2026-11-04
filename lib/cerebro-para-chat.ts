// =============================================================================
// cerebro-para-chat — el ÚNICO grafo que lee un chat de MaKo (28/10/2026)
// =============================================================================
// Martín (28/10/2026): «Supongo que todos los chats ya extraen data del second brain, si no lo hacen está mal... y que sea
// eficiente justamente, por eso tenemos tipo grafo, sin gastar tantos tokens». El relevamiento (C:/dev/revisiones/
// 2810-second-brain-relevamiento.md) encontró que lo que los prompts llaman «Second Brain» era el RAG de `mako_knowledge`,
// que las herramientas del grafo rearmaban el mapa entero CON su física en cada pedido, y que la capa de las funciones de
// MaKo sólo se dibujaba.
//
// LA REGLA: un chat que necesita el Second Brain lo pide acá, y de lo que devuelve saca sólo lo que le sirve con
// lib/cerebro-recuperar.ts (el índice y la vista local). Nunca `construirCerebro()` a secas:
//   · el negocio SIN física (los chats no usan posiciones);
//   · en el workspace de la plataforma, más «Lo que hace MaKo» (lib/cerebro-funciones.ts), colgado de la raíz;
//   · la capa Construcción NO entra: es la obra, no lo que se vende;
//   · en caché por workspace unos minutos (lib/cerebro-cache-chat.ts): un turno lo pide varias veces y el grafo son 21
//     lecturas. Una acción ejecutada la borra, y un grafo con una lectura caída no se guarda.
// =============================================================================

import 'server-only';
import { construirCerebro } from './cerebro-grafo';
import {
  CAPA_FUNCIONES, catalogoCorto, esPreguntaDeProducto, funcionEntera, funcionesDeMako, funcionQueVende, ID_RAIZ_FUNCIONES, PUENTE_FUNCIONES,
  sinFunciones,
} from './cerebro-funciones';
import { CAPA_CONOCIMIENTO, esPreguntaDeConocimiento, ID_RAIZ_KNOWLEDGE, knowledgeDeMako, PUENTE_KNOWLEDGE, sinKnowledge } from './cerebro-knowledge';
import { bloqueDelSecondBrain, conCapa, preguntaDelTurno, PRESUPUESTO_TURNO, sinLaPlata } from './cerebro-union';
import { recuperar } from './cerebro-recuperar';
import { grafoGuardado, guardarGrafo } from './cerebro-cache-chat';
import type { Cerebro } from './cerebro-modelo';
import type { Asesor } from './asesores/catalogo';
import { getWorkspaceActual, wsSuperAdmin } from './workspace';

/** El grafo del negocio de este pedido para un chat; con las funciones de MaKo si es la plataforma. Tira si una lectura
 *  principal tira (quien llama lo envuelve: lib/api-mako/ejecutar.ts). */
export async function grafoParaChat(): Promise<Cerebro<string>> {
  const ws = await getWorkspaceActual().catch(() => null);
  if (ws == null) return (await armar(null)).grafo;
  return grafoGuardado<Cerebro<string>>(ws) ?? guardarGrafo(ws, armar(ws));
}

/**
 * Para el Web Generator (lib/landing-writer.ts → `buildLandingBrief`): en la plataforma, todas las funciones en una línea y
 * la que vende esta landing ENTERA (por id, con profundidad 0: «Hace» y «No hace» incluidos), sacadas de la capa sin armar el
 * negocio. En un cliente, null: sus landings venden SU negocio. Nunca tira.
 */
export async function funcionesParaLanding(p: { pedido: string; pagina?: string }): Promise<{ catalogo: string; funcion: string } | null> {
  try {
    const ws = await getWorkspaceActual();
    if (ws == null || ws !== (await wsSuperAdmin())) return null;
    const f = funcionQueVende(p);
    return { catalogo: catalogoCorto(), funcion: f ? funcionEntera(funcionesDeMako(), f) : '' };
  } catch {
    return null;
  }
}

/** Cuánto espera el turno al grafo la primera vez (después sale de la caché): si no llegó, el turno sigue sin el paquete. */
export const ESPERA_GRAFO_TURNO_MS = 2_500;

/**
 * Lo que el turno de MaKo trae del Second Brain ANTES del modelo (la tanda 3 del relevamiento, 28/10/2026): la vista local de
 * lo que nombra la pregunta, sin IA y con su presupuesto (`bloqueDelSecondBrain`). Si la pregunta no nombra nada del grafo,
 * nada (el índice no viaja en cada turno). Con `sinPlata` (un closer o un setter, como `sinNumerosDelNegocio` de
 * lib/mako-context.ts), sin los objetivos, los KPIs ni los clientes del negocio: el grafo en caché es del NEGOCIO, no de la
 * persona. Espera al grafo hasta `ESPERA_GRAFO_TURNO_MS` y nunca tira: sin grafo, el turno sigue como antes. Busca con las
 * primeras letras del mensaje (`preguntaDelTurno`): `recuperar` corre DESPUÉS de la espera, sincrónico y sin tope propio.
 */
export async function paqueteParaElTurno(
  pregunta: string,
  o: { sinPlata: boolean; presupuesto?: number; referente?: string | null },
): Promise<string> {
  const q = preguntaDelTurno(pregunta);
  if (!q) return '';
  // ── El CURSO del referente que tiene este chat al frente (3/11/2026): un bloque APARTE, en paralelo ──
  // ⚠️ Antes se colgaba como capa del grafo del negocio y viajaba por `recuperar`, que NUNCA pone el
  // cuerpo de un nodo sin pedirlo por id: el chat veía los títulos de las clases y ni una palabra del
  // curso (lib/cerebro-referente.ts, `cursoParaElTurno`, lo cuenta). Aparte, además, no le come los
  // 1.200 tokens al negocio ni espera al grafo, y no pasa por `sinLaPlata`: un curso no tiene un número
  // del negocio adentro, y un closer con Augusto Bianchi al frente es justo quien más lo necesita.
  const [negocio, curso] = await Promise.all([
    paqueteDelNegocio(q, o),
    o.referente ? cursoParaElTurnoDe(o.referente, q) : Promise.resolve(''),
  ]);
  return [negocio, curso].filter(Boolean).join('\n\n');
}

/**
 * Lo que el turno espera a que se lea un curso la primera vez. Son hasta 10 MB en 452 pedidos: una persona no se queda mirando
 * eso. Pasado el plazo el turno sigue con la ficha, la lectura termina por detrás y el mensaje que sigue ya lo tiene.
 */
export const ESPERA_CURSO_TURNO_MS = 12_000;

/** El bloque del curso del referente para la pregunta del turno. Nunca tira: sin curso, el chat sigue con su ficha. */
export async function cursoParaElTurnoDe(id: string, q: string, esperaMs = ESPERA_CURSO_TURNO_MS, presupuesto?: number): Promise<string> {
  const c = await Promise.race([cursoDe(id), new Promise<null>((r) => setTimeout(() => r(null), esperaMs))]);
  if (!c) return '';
  const { cursoParaElTurno } = await import('./cerebro-referente');
  return cursoParaElTurno(c.capa, c.a, q, presupuesto);
}

/** El turno de Offer pide menos que un chat con el gurú: lo que tiene que hacer es armar la oferta, y ya trae su marco y el negocio. */
export const PRESUPUESTO_CURSO_OFFER = 12_000;

/** El curso de un referente para quien no pasa por `paqueteParaElTurno`: una conversación de Offer. */
export async function cursoDelReferente(id: string, pregunta: string, presupuesto?: number): Promise<string> {
  const q = preguntaDelTurno(pregunta);
  return q ? cursoParaElTurnoDe(id, q, ESPERA_CURSO_TURNO_MS, presupuesto) : '';
}

/** Lo del negocio que nombra la pregunta (lo de siempre). */
async function paqueteDelNegocio(q: string, o: { sinPlata: boolean; presupuesto?: number }): Promise<string> {
  try {
    const grafo = await Promise.race([
      grafoParaChat(),
      new Promise<null>((r) => setTimeout(() => r(null), ESPERA_GRAFO_TURNO_MS)),
    ]);
    if (!grafo) return '';
    // La capa de las funciones (sólo existe en la plataforma) entra sólo si la pregunta es de producto: «¿cuál es mi meta?» no
    // habla del Ads Manager de Meta.
    const delRol = o.sinPlata ? sinLaPlata(grafo) : grafo;
    const conProducto = esPreguntaDeProducto(q) ? delRol : sinFunciones(delRol);
    // Y la capa de Knowledge (el método de los cursos, en TODO negocio) sólo si la pregunta pide el MÉTODO: los nombres
    // de los módulos son palabras del negocio y «¿cuál es mi oferta?» no pregunta por el método de armar una.
    const g = esPreguntaDeConocimiento(q) ? conProducto : sinKnowledge(conProducto);
    return bloqueDelSecondBrain(recuperar(g, { pregunta: q, presupuesto: o.presupuesto ?? PRESUPUESTO_TURNO }));
  } catch {
    return '';
  }
}

/**
 * Le cuelga al grafo la capa de un referente: su curso entero, un nodo por clase
 * (lib/cerebro-referente.ts). La usa la herramienta que pide una clase por id (`conLosCursosDe`).
 *
 * ⚠️ TODO ACÁ ES CON IMPORT DINÁMICO y envuelto en try: el catálogo de cursos son miles de líneas
 * que no tienen por qué entrar en el camino de un chat sin referente, y un curso que no se puede
 * leer NO puede tirar el turno — sin la capa el chat sigue como antes, que es la misma regla que el
 * grafo (`nunca tira`).
 */
async function capaDelReferente(grafo: Cerebro<string>, id: string): Promise<Cerebro<string>> {
  const c = await cursoDe(id);
  if (!c) return grafo;
  const { idRaizDeReferente } = await import('./cerebro-referente');
  return conCapa(grafo, c.capa, {
    id: CAPA_CONOCIMIENTO, nombre: c.a.completo, raiz: idRaizDeReferente(id),
    motivo: `Lo que ${c.a.nombre} enseña en «${c.a.curso}», clase por clase`,
  });
}

/** El referente y su capa, leída una vez por proceso. null si no tiene curso o no se pudo leer: nunca tira. */
export async function cursoDe(id: string): Promise<{ a: Asesor; capa: Cerebro<string> } | null> {
  try {
    const [{ ASESORES }, { cursoDeReferente }, srv] = await Promise.all([
      import('./asesores/catalogo'), import('./asesores/cursos'), import('./cerebro-referente-server'),
    ]);
    const a = ASESORES.find((x) => x.id === id);
    const slug = cursoDeReferente(id);
    if (!a || !slug) return null;
    // ⚠️ ACÁ ESTABA EL DEPLOY ROTO. Antes esto importaba `@/app/conocimientos/catalogo` para
    // encontrar el curso, y ese catálogo arrastra los 100+ archivos de cursos: Vercel rechazó la
    // función por tamaño (281 MB contra un tope de 250) **con Actions en verde**, porque CI corre
    // tipos y tests pero no el empaquetado. Ahora sale de un índice de 99 KB
    // (`lib/asesores/clases-de-referentes.json`).
    const curso = srv.clasesDelIndice(slug);
    if (!curso.clases.length) return null;
    const capa = await srv.cerebroDeReferenteMemo(a, curso);
    // Sólo la raíz: ninguna clase llegó. Sin curso, que es distinto de un curso vacío.
    return capa.nodos.length > 1 ? { a, capa } : null;
  } catch (e) {
    console.error(`[cerebro-para-chat] el curso de ${id}: ${e instanceof Error ? e.message : String(e)}`);
    return null;
  }
}

/**
 * El grafo con los cursos que nombran unos ids (`ref:<gurú>:<video>`): para la herramienta que pide una
 * clase por id (`recuperar_del_segundo_cerebro`). Sin esto, el id que el turno le muestra al chat no
 * existía en `grafoParaChat()` y pedirlo devolvía el índice del negocio.
 */
export async function conLosCursosDe(grafo: Cerebro<string>, ids: readonly string[]): Promise<Cerebro<string>> {
  const { referentesDeIds } = await import('./cerebro-referente');
  let g = grafo;
  for (const id of referentesDeIds(ids)) g = await capaDelReferente(g, id);
  return g;
}

async function armar(ws: number | null): Promise<{ grafo: Cerebro<string>; completo: boolean }> {
  // Las lecturas que se caen se degradan a vacío (el grafo no se cae), pero AVISAN: un grafo así no se guarda.
  const cayeron: string[] = [];
  const [negocio, plataforma] = await Promise.all([
    construirCerebro({ sinLayout: true, alFallar: (fuente) => cayeron.push(fuente) }) as Promise<Cerebro<string>>,
    ws == null ? false : wsSuperAdmin().then((s) => s === ws, () => false),
  ]);
  const conFunciones = plataforma ? conCapa(negocio, funcionesDeMako(), { id: CAPA_FUNCIONES, nombre: 'Lo que hace MaKo', raiz: ID_RAIZ_FUNCIONES, motivo: PUENTE_FUNCIONES }) : negocio;
  // Knowledge va en TODOS los negocios, no sólo en la plataforma: el método de los cursos es justamente lo que MaKo le
  // presta a cada negocio (lib/cerebro-knowledge.ts). Es código memoizado, así que no suma una lectura al grafo.
  const grafo = conCapa(conFunciones, knowledgeDeMako(), { id: CAPA_CONOCIMIENTO, nombre: 'Knowledge', raiz: ID_RAIZ_KNOWLEDGE, motivo: PUENTE_KNOWLEDGE });
  return { grafo, completo: cayeron.length === 0 };
}
