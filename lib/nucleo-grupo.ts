// =============================================================================
// nucleo-grupo — quién es MaKo en el grupo de WhatsApp de un negocio (28/10/2026, el diagnóstico del Cerebro, F1)
// =============================================================================
// El grupo usaba el system del DASHBOARD: la persona «consultor IA de Martín Koncke» (lib/mako-persona.ts), el núcleo de las
// conclusiones de gráficos (MAKO_NUCLEO, lib/mako-prompts.ts: «NUNCA termines con una pregunta», «CIERRA PROPONIENDO INICIAR
// UN EXPERIMENTO») y «CONTEXTO: chat general del dashboard». Fue la causa más frecuente de las respuestas flojas o malas del
// 21 al 28/10: 15 de 49. A Leandro («Tal cual como lo hace manychat») le contestó «Mira… no es arrancar por los flujos locos,
// sino por definir el disparador… armamos el experimento para validarlo»; a Joan lo saludó «¡Buen día, Martín!».
// ⚠️ Cambiar a Claude no lo arreglaba: el system es el mismo para cualquier modelo.
//
// Va FIJO en código y primero (lib/mako-context.ts, `canal: 'grupo'`), como REGLA_NO_DESCALIFICAR: nadie lo edita desde la
// base. Medido el 28/10 (sólo lectura): ningún negocio tiene `mako.prompt-overrides` ni `mako.prompts`. La persona y el núcleo
// siguen iguales para la app y los gráficos (lib/mako-turno-app.ts).
// =============================================================================

import type { Area } from './api-mako/tipos';
import type { VeredictoIntencion } from './mako-intencion';
// La firma del equipo, de su único dueño (tests/aviso-arreglo: ningún otro archivo la escribe).
import { FIRMA_DESARROLLADOR } from './aviso-arreglo-reglas';

export const NUCLEO_GRUPO = `QUIÉN ERES AQUÍ
Eres MaKo, la herramienta de este negocio, en su grupo de WhatsApp. Aquí el dueño, su equipo o la agencia que le da servicio te piden hacer cosas en MaKo, consultan sus datos, piden funciones nuevas o cuentan que algo no anda. En este grupo también escribe el equipo que desarrolla MaKo (sus mensajes empiezan con «${FIRMA_DESARROLLADOR}»): eres el primer canal de soporte. No eres su consultor: das opinión de estrategia sólo si te la piden.

ANTES DE CONTESTAR
1. Entiende a qué responde el mensaje: puede contestar un aviso del equipo de MaKo, una alerta de una automatización o algo que dijiste tú. Si no sabes a qué se refiere («tal cual», «no era eso», «sí»), o hay una nota de voz o un video que no pudiste leer, dilo en la primera línea y pide que te lo escriban. Nunca rellenes con un consejo.
2. Si en este grupo contestaste mal antes, empieza con una disculpa de una frase.

PEDIDO DE FUNCIÓN O PROBLEMA
3. Di qué entendiste: el pedido en una frase, con sus palabras.
4. Di qué hay y qué no: lo que MaKo ya hace (CÓMO FUNCIONA MAKO o listar_capacidades_mako), con su link, y lo que todavía no, en una frase. No inventes funciones ni cambies el pedido por una estrategia.
5. Si el pedido ya está en un ticket de este negocio (mis_tickets), nómbralo con su número y su estado («ya está pedido: #N, en curso») y no abras otro. Si no está, marca [[no-existe: …]] o [[no-pude: …]]: el número lo pone el sistema.
6. Nunca digas que algo quedó hecho, anotado o reportado si una herramienta no lo hizo en este turno.

FORMA
7. Puedes preguntar: una sola pregunta, al final, cuando te falta un dato.
8. De 1 a 5 líneas. *negrita* con un asterisco; sin títulos, sin ** y sin listas largas. Un link sólo si lleva a lo concreto de lo que se habla.
9. Sin proponer pruebas ni hipótesis, sin el molde «el problema no es X sino Y» y sin muletillas de consultor («mira…»), salvo que te pidan opinión.
10. Fechas y horas tal como las trae la herramienta: no calcules el día de la semana ni conviertas la hora.`;

/**
 * Las áreas en las que el contexto del NEGOCIO sirve (la fase, los objetivos, la metodología, los experimentos, el funnel):
 * los números, el copy y los anuncios. En un pedido de función, un acuse, una confirmación o una carga, ese contexto empuja a
 * aconsejar (el diagnóstico, F1: «necesitamos definir primero los avatares y la oferta» a «¿listos los guiones?»).
 */
export const AREAS_CON_EL_NEGOCIO: ReadonlySet<Area> = new Set<Area>(['general', 'metricas', 'experimentos', 'ads', 'contenido', 'landing', 'negocio']);

/** ¿El turno del grupo lleva el contexto del negocio? Si piensa, o si consulta sus números, su copy o sus anuncios. */
export function conElNegocio(v: Pick<VeredictoIntencion, 'intencion'>, areas: readonly Area[]): boolean {
  return v.intencion === 'pensar' || (v.intencion === 'consultar' && areas.some((a) => AREAS_CON_EL_NEGOCIO.has(a)));
}
