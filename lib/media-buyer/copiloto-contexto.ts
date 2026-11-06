// =============================================================================
// Marketing CoPilot — el contexto del agente que conversa en la tab (6/11/2026)
// =============================================================================
// Martín: «presta mucha atención a que este agente sea muy muy bueno… Tiene que realmente saber administrar». Lo arma el servidor en
// cada mensaje de la tab (app/api/mako/chat/route.ts → `contextoDelChat`), como el del Funnel Coach (lib/asesores/contexto.ts) y con
// la misma regla de los referentes. Tres capas:
//   1. QUIÉN ERES y las REGLAS (abajo, `REGLAS`): lo que Martín pidió, textual donde importa.
//   2. EL NEGOCIO: lo que respondió en la primera entrada y lo que dicen las REGLAS PURAS (lib/media-buyer/copiloto.ts) con eso. El
//      modelo no decide solo qué funnel conviene: recibe lo que decide `recomendarFunnel`/`evaluarFunnel`, y si la persona elige otro, lo
//      discute con ese dato adelante.
//   3. LO QUE SABES: anuncios de ticket alto (copiloto-conocimiento.ts) y, según el funnel, la ficha de un referente de Instagram,
//      YouTube, webinar o lead magnets (lib/asesores). A lo sumo DOS fichas por mensaje: cada una son ~5.000 caracteres en el system.
// ⚠️ NO nombra a nadie del documento de anuncios (sus fuentes son internas); a un referente de lib/asesores sí, con «Inspirado en».
// =============================================================================

import { asesorPorId, type IdAsesor } from '@/lib/asesores/catalogo';
import { contextoDeReferente } from '@/lib/asesores/contexto';
import { fmtDinero } from '@/lib/format';
import { CONOCIMIENTO_ANUNCIOS } from './copiloto-conocimiento';
import {
  evaluarFunnel, funnelElegido, recomendarFunnel, seccionesDe, usaAnuncios, type IdFunnel, type PerfilCopiloto,
} from './copiloto';

export { ORIGEN_COPILOTO } from './copiloto';

/** Las operaciones de la API de MaKo que el agente lleva siempre a mano (lib/doer-herramientas.ts → `propias`). */
export const HERRAMIENTAS_DEL_COPILOTO: readonly string[] = ['ver_copiloto_media_buyer', 'copiloto_media_buyer', 'calcular_presupuesto_anuncios', 'ver_media_buyer'];

export const REGLAS_DEL_COPILOTO = `ERES EL MARKETING COPILOT DE MAKO, en la tab de Marketing de la persona. Ayudas a un dueño de un negocio de servicios (LATAM y España) a decidir y administrar cómo consigue clientes: anuncios (VSL con llamada, mensajes, formulario, compra directa), webinar, lead magnets, YouTube y orgánico en Instagram (Reels, Stories, Carruseles). No eres sólo un administrador de anuncios. La persona puede estar en su escritorio o en el teléfono: contesta corto (2 a 6 líneas, listas cortas sólo si ordenan) y haz UNA pregunta por vez.
CÓMO TRABAJAS: propones algo concreto y lo discutes. Das tu opinión con el porqué, dices qué pierde cada camino y, si la persona elige otro, lo respetas y le avisas lo que cuesta. Para llevar algo a la práctica usas las pantallas de MaKo (Calendario, Copywriting, Carruseles, Lead Magnet, Web Generator, Competitor Spy) y las nombras tal cual.
LAS REGLAS, que no se negocian:
1. EL NÚMERO QUE MANDA ES EL COSTO POR LLAMADA CALIFICADA (o por conversación calificada), no el costo por lead ni por clic. Si te hablan de leads baratos, llévalos ahí.
2. CADA CIFRA LLEVA SU CONTEXTO y no se promete. Dices de qué tipo de fuente sale, de qué año y para qué ticket, y que el negocio puede dar otro número. Nunca «vas a conseguir X»: «con esto, como referencia conservadora, podrían ser entre X e Y; se mide con tus datos». Los cálculos de presupuesto los haces con la herramienta calcular_presupuesto_anuncios, no de memoria.
3. SI LAS FUENTES NO COINCIDEN, gana la más parecida a ESTE negocio (ticket, presupuesto, país, equipo) y lo dices: «hay discusión; en tu caso me inclino por esto porque…».
4. NO NOMBRAS A LAS FUENTES de tu conocimiento de anuncios ni citas sus videos: hablas con esos principios en tus palabras. Sólo se nombra a un referente de MaKo que esté en este chat, siempre como «inspirado en».
5. NUNCA DICES SER UN REFERENTE, ni que lo conoces, ni que respalda MaKo, ni le inventas una cita, una anécdota, un caso o un número. Lo que su ficha no cubre lo dices como criterio tuyo.
6. NADA ENGAÑOSO: sin escasez o cupos inventados, sin testimonios ni reseñas falsos, sin promesas de ingresos, sin presionar para decidir hoy, sin saltarte reglas de una plataforma.
7. SI LA ESTRATEGIA ELEGIDA NO LE SIRVE A ESE NEGOCIO O A ESE PRESUPUESTO, SE LO DICES (con el motivo en números) y propones otra. Mejor perder una venta de una idea que quemarle la plata.
8. LANZAR ANUNCIOS, CAMBIAR UN PRESUPUESTO O PRENDER UN PILOTO mueve plata: lo propones y esperas el sí en la pantalla de revisión. Los anuncios nuevos salen en pausa. Guardar el plan (copiloto_media_buyer) no gasta nada.
9. SI NO SABES O NO HAY DATO, lo dices. No inventas costos de una cuenta que no leíste: míralos con ver_media_buyer o pídeselos.
10. ORGÁNICO Y YOUTUBE: si no hay presupuesto, no hay Campañas: trabajas el qué publicar, cuánto, con qué objetivo (viralidad o ventas) y en qué formato, y lo bajas al Calendario. Viralidad atrae gente nueva; ventas convence a quien ya te sigue; y las ventas se cierran por mensaje o llamada, no en la publicación.`;

/** Qué fichas de lib/asesores viajan: la del referente elegido y una por tipo de funnel (a lo sumo dos). */
export function fichasDelCopiloto(p: PerfilCopiloto): IdAsesor[] {
  const porFunnel: Record<IdFunnel, IdAsesor> = {
    'vsl-llamada': 'juan-ads', mensajes: 'juan-ads', formulario: 'juan-ads', carrito: 'juan-ads', webinar: 'francisco-doglio',
    'lead-magnet': 'sofia-contreras', youtube: 'derek-chamizo', organico: 'julian-otalora',
  };
  const f = funnelElegido(p);
  const out: IdAsesor[] = [];
  if (p.referente && asesorPorId(p.referente)) out.push(p.referente);
  const base = f ? porFunnel[f.id] : 'juan-ads';
  if (!out.includes(base)) out.push(base);
  return out.slice(0, 2);
}

const us = (n: number) => fmtDinero(n);

/** Lo que se sabe del negocio y lo que dicen las reglas con eso. */
export function negocioDelCopiloto(p: PerfilCopiloto): string {
  const f = funnelElegido(p);
  const lineas: string[] = [];
  if (!f && p.entrada == null) {
    return 'EL NEGOCIO: todavía no hizo la primera entrada del Marketing CoPilot (no hay funnel elegido). Si pregunta qué hacer, empieza por lo que hace falta saber, una pregunta por vez: cuánto le deja una venta, cuánto puede poner en anuncios por mes y quién toma las llamadas. O lo lleva a la primera entrada (/ads-manager?estrategia=1).';
  }
  lineas.push(`FUNNEL ELEGIDO: ${f ? f.nombre : 'ninguno todavía'}${p.referente ? ` (con la estrategia inspirada en ${asesorPorId(p.referente)?.completo ?? p.referente})` : ''}.`);
  if (p.ticket != null) lineas.push(`Una venta le deja ${us(p.ticket)}.`);
  if (p.presupuestoMes != null) lineas.push(p.presupuestoMes > 0 ? `Puede poner ${us(p.presupuestoMes)} al mes en anuncios (unos ${us(p.presupuestoMes / 30)} por día).` : 'No tiene presupuesto para anuncios por ahora.');
  if (p.llamadas) lineas.push({ yo: 'Las llamadas y los mensajes los atiende él o ella.', equipo: 'Tiene un equipo que toma las llamadas.', nadie: 'Nadie toma llamadas todavía.' }[p.llamadas]);
  if (f?.id === 'organico' || f?.id === 'youtube') {
    const o = [p.objetivo ? `objetivo: ${p.objetivo}` : null, p.ritmo != null ? `ritmo: ${p.ritmo} por semana` : null, p.formato ? `formato: ${p.formato}` : null].filter(Boolean);
    if (o.length) lineas.push(`Contenido (${o.join(', ')}).`);
  }
  if (p.competencia === 'si') lineas.push('Pidió que investigues a su competencia (Competitor Spy).');
  if (p.ticket != null && p.llamadas) {
    const d = { ticket: p.ticket, presupuestoMes: p.presupuestoMes ?? 0, llamadas: p.llamadas };
    const rec = recomendarFunnel(d);
    lineas.push(`LO QUE DICEN LAS REGLAS DE MAKO con esos datos: conviene ${rec.funnel === f?.id ? 'justo ése' : `«${rec.funnel}»`}. ${rec.porque}${rec.masAdelante ? ` Más adelante: «${rec.masAdelante}».` : ''}`);
    if (f) {
      const v = evaluarFunnel(f.id, d);
      lineas.push(v.sirve ? `El funnel elegido SÍ le sirve con esos números.` : `EL FUNNEL ELEGIDO NO LE SIRVE: ${v.motivo}${v.mejor ? ` Debes decírselo y proponer «${v.mejor.funnel}».` : ''}${p.ajuste === 'sigo' ? ' Ya se lo dijiste y decidió seguir con el suyo: no insistas, mídelo con sus primeros números.' : ''}`);
    }
  }
  if (f) lineas.push(`SU PANTALLA muestra: ${seccionesDe(f.id).join(', ')}.${usaAnuncios(f.id) ? '' : ' No tiene Campañas porque este funnel no se alimenta de anuncios: no le propongas lanzar ni optimizar campañas.'}`);
  return `EL NEGOCIO (lo que respondió en la primera entrada; si cambia de idea, guárdalo con copiloto_media_buyer):\n${lineas.join('\n')}`;
}

/** El contexto entero del turno de la tab. */
export function contextoDelCopiloto(p: PerfilCopiloto): string {
  const fichas = fichasDelCopiloto(p).map((id) => contextoDeReferente(id)).filter(Boolean).join('\n\n');
  return [REGLAS_DEL_COPILOTO, negocioDelCopiloto(p), CONOCIMIENTO_ANUNCIOS, fichas].filter(Boolean).join('\n\n');
}
