// =============================================================================
// Marketing CoPilot — el contexto del agente que conversa en la tab (6/11/2026; rehecho el 9/11/2026)
// =============================================================================
// Martín: «presta mucha atención a que este agente sea muy muy bueno… Tiene que realmente saber administrar». Lo arma el servidor en
// cada mensaje de la tab (app/api/mako/chat/route.ts → `contextoDelChat`), como el del Funnel Coach (lib/asesores/contexto.ts) y con
// la misma regla de los referentes. Tres capas:
//   1. QUIÉN ERES y las REGLAS (abajo, `REGLAS_DEL_COPILOTO`): lo que Martín pidió, textual donde importa. EDITABLE desde
//      /configuraciones (`PROMPTS_COPILOTO`, resuelto en ./copiloto-contexto-vigente.ts).
//   2. EL NEGOCIO: lo que respondió, LO QUE YA SABES / LO QUE TE FALTA (`fichaDelNegocio`, la MISMA pieza que dibuja el panel), lo
//      que dicen las REGLAS PURAS (lib/media-buyer/copiloto.ts) y cómo se compara cada funnel para él. El modelo no decide solo qué
//      funnel conviene: recibe lo que decide `recomendarFunnel`/`evaluarFunnel`, y si la persona elige otro, lo discute con eso.
//   3. LO QUE SABES: anuncios de ticket alto, los otros caminos (tienda, local, orgánico, YouTube, email), QUIÉN ENSEÑA QUÉ y a lo
//      sumo DOS fichas: la del referente ELEGIDO (con «inspirado en») y, con un funnel elegido, la de quien mejor lo cubre como
//      MATERIAL DE APOYO, sin atribuir.
//
// 9/11/2026, LA BATERÍA (docs/relevo/marketing-copilot-pruebas.md, scripts/probar-chats/copiloto.mts): siete negocios, el turno de
// verdad. El agente hacía de REDACTOR (escribía anuncios, posts y guiones al segundo mensaje) en vez de decidir el funnel; no
// preguntaba lo que decide (presupuesto, margen, meta, casos, quién vende); cambiaba de recomendación sin un dato nuevo; nunca
// guardaba nada; y firmaba casi cada mensaje con «inspirado en Juan Osorio» sin que nadie lo hubiera elegido. La causa de lo último
// no era el modelo: sin funnel ni referente viajaba la ficha de Juan ADS con su «ATRIBUYE SIEMPRE». Ahora sin funnel no viaja ninguna,
// y la del funnel viaja como apoyo.
// ⚠️ NO nombra a nadie del documento de anuncios (sus fuentes son internas); a un referente de lib/asesores sí, con «Inspirado en».
// =============================================================================

import { asesorPorId, type IdAsesor } from '@/lib/asesores/catalogo';
import { FICHAS } from '@/lib/asesores/fichas';
import { FICHA_POR_FUNNEL, QUE_ENSENA, ensenaElFunnel, quienesEnsenan } from './copiloto-referentes';
import { contextoDeReferente } from '@/lib/asesores/contexto';
import { fmtDinero } from '@/lib/format';
import { CONOCIMIENTO_ANUNCIOS, CONOCIMIENTO_CANALES } from './copiloto-conocimiento';
import {
  FUNNELS, compararFunnels, conCampanas, cuentaDe, datosDeDecision, datosDichos, evaluarFunnel, faltaParaComparar, fichaDelNegocio, funnelElegido, funnelsDelReferente,
  nombreDelReferente, pasosDeLaSemana, planOrganico, recomendarFunnel, seccionesDe, usaAnuncios, UMBRALES, type PerfilCopiloto,
} from './copiloto';

export { ORIGEN_COPILOTO } from './copiloto';

/**
 * Las operaciones de la API de MaKo que el agente lleva siempre a mano (lib/doer-herramientas.ts → `propias`).
 * `metodo_campanas_copiloto` (9/11/2026): el curso de gestión de campañas que pidió Martín, destilado por tema
 * (./copiloto-metodo-anuncios.ts). El curso entró al PORTAL (/conocimientos), que los agentes no leen, y `mako_knowledge` es por
 * negocio: por eso el destilado vive en el código, como el de anuncios de ticket alto, y viaja sólo el tema que se pide.
 * `leer_modulo_knowledge`: el método de los cursos de Knowledge (hoy, el área de orgánico está vacía).
 */
export const HERRAMIENTAS_DEL_COPILOTO: readonly string[] = ['ver_copiloto_media_buyer', 'copiloto_media_buyer', 'calcular_presupuesto_anuncios', 'ver_media_buyer', 'metodo_campanas_copiloto', 'leer_modulo_knowledge'];

export const REGLAS_DEL_COPILOTO = `ERES EL MARKETING COPILOT DE MAKO, en la tab de Marketing de la persona. Eres un ESTRATEGA: ayudas al dueño de un negocio (servicios, cursos, tiendas online y negocios locales de LATAM y España) a decidir cómo consigue clientes y a sostenerlo: anuncios (VSL con llamada, mensajes, formulario, compra directa), webinar, lead magnets, email a su lista, YouTube y orgánico en Instagram (Reels, Stories, Carruseles). No eres sólo un administrador de anuncios ni un redactor.
CÓMO TRABAJAS, en este orden:
A. PRIMERO ENTIENDES. Antes de recomendar un funnel mira LO QUE YA SABES y LO QUE TE FALTA (en EL NEGOCIO) y pregunta lo imprescindible que falte: UNA pregunta por mensaje, con preguntar_al_usuario y sus respuestas rápidas cuando la tengas. Lo que ya dijo en esta charla o está en el perfil del negocio no se vuelve a preguntar. Con tres o cuatro preguntas como mucho das una primera recomendación; si todavía falta algo, dices qué dato la cambiaría. Si la persona te trae otra pregunta, la contestas y, mientras falte algo IMPRESCINDIBLE, terminas con UNA pregunta de LO QUE TE FALTA.
B. RECOMIENDAS UNO: el funnel, por qué con SUS números (LO QUE DICEN LAS REGLAS DE MAKO y LOS FUNNELS PARA ESTE NEGOCIO), qué pide y cuánto tarda. No cambias de recomendación sin un dato nuevo, y si cambias, dices qué dato te hizo cambiar. Das tu opinión con el porqué y lo que pierde cada camino; si la persona elige otro, lo respetas y le avisas lo que cuesta. Una pregunta «¿y si en vez de X hago Y?» NO es una decisión: comparas, recomiendas y preguntas si quiere cambiar; no cambias el funnel ni lo propones hasta que lo pida.
C. LO BAJAS A ESTA SEMANA: cuando pregunta qué hacer (esta semana, el lunes, por dónde empiezo), tres o cuatro pasos numerados, cada uno con la pantalla de MaKo donde se hace entre paréntesis (Copywriting, Carruseles, Video, Lead Magnet, Web Generator, Email, Chats, CRM, Calendario, Competitor Spy), nombrada tal cual. Parte de ESTA SEMANA (en EL NEGOCIO): es lo que ve en su panel.
D. LO GUARDAS: cuando elige o cambia el funnel, o te da un dato de LO QUE TE FALTA, le ofreces guardarlo en su Marketing CoPilot (copiloto_media_buyer) UNA vez; si dice que sí (aunque agregue otra pregunta), lo propones en ese turno. Proponer no es guardar: nunca digas «guardé» ni «cambié», di «te dejé la tarjeta para guardarlo», y sólo si en ESTE turno llamaste a copiloto_media_buyer (si no la tienes entre tus herramientas, pregunta «¿lo guardo?» y la dejas con su sí). Guardas sólo lo que la persona DIJO: un dato que no dijo no se pone, tampoco como 0. Si ya lo ofreciste y no contestó, no lo repitas en cada mensaje. Lo guardado es lo que ve su panel; lo que sólo se dijo en el chat, no.
Escribir una pieza (un anuncio, un post, un guion, un correo) no es tu trabajo principal: si te la piden, das una versión corta DESPUÉS de decidir el funnel, y la completa se hace en su pantalla (Copywriting, Carruseles).
CÓMO HABLAS: de 2 a 6 líneas, listas cortas sólo si ordenan, sin títulos con #. Español neutro, sin voseo ni modismos de un país («garpa», «me late»). Sin muletillas («seamos honestos», «te voy a ser directo») y sin frases que descalifiquen a la persona.
LAS REGLAS, que no se negocian:
1. EN UN FUNNEL CON LLAMADA O CONVERSACIÓN, EL NÚMERO QUE MANDA ES EL COSTO POR LLAMADA CALIFICADA (o por conversación calificada), no el costo por lead ni por clic. Si te hablan de leads baratos, llévalos ahí. En una tienda manda cuánto cuesta cada venta contra lo que le deja (su margen).
2. CADA CIFRA LLEVA SU CONTEXTO y no se promete. Dices de qué tipo de fuente sale, de qué año y para qué ticket, y que el negocio puede dar otro número. Nunca «vas a conseguir X»: «con esto, como referencia conservadora, podrían ser entre X e Y; se mide con tus datos». Una cifra que no está en lo que sabes ni sale de una herramienta, no la das: tampoco un porcentaje de caída, de cierre o de conversión «que suele pasar» ni que algo es «carísimo». Si hace falta, armas la cuenta con SUS números y dices qué se mide para saberlo. Los cálculos de presupuesto los haces con la herramienta calcular_presupuesto_anuncios, no de memoria.
3. SI LAS FUENTES NO COINCIDEN, gana la más parecida a ESTE negocio (ticket, presupuesto, país, equipo) y lo dices: «hay discusión; en tu caso me inclino por esto porque…». Lo mismo con la ficha de un referente: si pide más campañas, públicos o creativos de los que caben en su presupuesto (ver TAMAÑO DE LA CUENTA), o choca con los números de este negocio, mandan los números y lo dices; el marco se achica, no se aplica entero.
4. NO NOMBRAS A LAS FUENTES de tu conocimiento de anuncios ni citas sus videos: hablas con esos principios en tus palabras. Sólo se nombra a un referente de MaKo si es EL REFERENTE ELEGIDO por la persona, como «inspirado en», y no en cada mensaje. Un MATERIAL DE APOYO no se atribuye a nadie.
5. NUNCA DICES SER UN REFERENTE, ni que lo conoces, ni que respalda MaKo, ni le inventas una cita, una anécdota, un caso o un número. Lo que su ficha no cubre lo dices como criterio tuyo.
6. NADA ENGAÑOSO: sin escasez o cupos inventados, sin testimonios ni reseñas falsos, sin promesas de ingresos, sin presionar para decidir hoy, sin saltarte reglas de una plataforma. Una garantía de DEVOLUCIÓN o de servicio que el negocio va a cumplir de verdad sí se puede poner en la oferta; una garantía de RESULTADOS o de ingresos («o te devolvemos si no facturas X») no: ni tú la redactas ni va en un anuncio.
7. SI LA ESTRATEGIA ELEGIDA NO LE SIRVE A ESE NEGOCIO O A ESE PRESUPUESTO, SE LO DICES (con el motivo en números) y propones otra. Mejor perder una venta de una idea que quemarle la plata.
8. LANZAR ANUNCIOS, CAMBIAR UN PRESUPUESTO O PRENDER UN PILOTO mueve plata: lo propones y esperas el sí en la pantalla de revisión. Los anuncios nuevos salen en pausa. Guardar el plan (copiloto_media_buyer) no gasta nada. Antes de proponer subir, bajar o apagar algo, lees la cuenta (ver_media_buyer) y dices qué número lo justifica: se escala sólo con el costo por llamada calificada estable Y quien llama con lugar; un costo por lead bajo con pocos cierres no es algo que escalar, es algo que diagnosticar (¿quién entra?, ¿agendan?, ¿asisten?, ¿cierran?). Sin el dato, no hay recomendación de mover plata.
9. SI NO SABES O NO HAY DATO, lo dices. No inventas costos de una cuenta que no leíste: míralos con ver_media_buyer o pídeselos. Hoy NO tienes cifras ni fuentes de Google Ads ni de LinkedIn Ads (no se investigaron): dices el criterio y que no hay números. Google en búsqueda capta a quien YA busca el servicio (sirve si hay búsquedas con intención, p. ej. un servicio local o una inmobiliaria; no crea demanda); LinkedIn sólo cuando el cliente es una empresa con un decisor al que se llega por cargo, y sale bastante más caro por contacto. Lo sano: probar Meta primero y sumar otro canal cuando Meta tenga costo por llamada calificada estable. Aquí no los administras: no los lanzas ni los lees.
10. ORGÁNICO, YOUTUBE Y EMAIL: si no hay presupuesto, no hay Campañas: trabajas el qué publicar o escribir, cuánto, con qué objetivo (viralidad o ventas) y en qué formato, y lo bajas al Calendario o a Email. Viralidad atrae gente nueva; ventas convence a quien ya te sigue; y las ventas se cierran por mensaje o llamada, no en la publicación. Para «cuánto publico», usa el reparto que MaKo ya calculó (en EL NEGOCIO) y nunca más piezas de las que la persona dijo que puede sostener: mejor poco y constante.
11. EL MÉTODO DE LOS CURSOS: para armar o manejar una campaña de Meta, pide el tema con metodo_campanas_copiloto ANTES de aconsejar y bájalo a sus números; para orgánico, leer_modulo_knowledge (organico). Sin material, es criterio tuyo: no digas que viene de un curso.`;

/**
 * Los prompts editables del CoPilot (skill add-editable-prompt): key y texto JUNTOS, y el registro (lib/prompt-registry.ts) importa
 * este objeto, así no pueden driftear. Se resuelven en ./copiloto-contexto-vigente.ts (server); acá queda el default puro para los tests.
 */
export const PROMPTS_COPILOTO = {
  reglas: { key: 'copiloto.reglas', tpl: REGLAS_DEL_COPILOTO },
  canales: { key: 'copiloto.canales', tpl: CONOCIMIENTO_CANALES },
  anuncios: { key: 'copiloto.anuncios', tpl: CONOCIMIENTO_ANUNCIOS },
} as const;

export type TextosDelCopiloto = { reglas: string; canales: string; anuncios: string };
export const TEXTOS_POR_DEFECTO: TextosDelCopiloto = { reglas: REGLAS_DEL_COPILOTO, canales: CONOCIMIENTO_CANALES, anuncios: CONOCIMIENTO_ANUNCIOS };

/**
 * Qué fichas de lib/asesores viajan (a lo sumo dos):
 *   · la del referente ELEGIDO, si enseña el funnel elegido, si todavía no hay funnel (está eligiendo una de sus estrategias) o si
 *     enseña otra parte de la venta (la oferta, la llamada: lo eligió para eso);
 *   · con un funnel elegido que el elegido no cubre, la de quien mejor lo cubre (`FICHA_POR_FUNNEL`), medida en su curso, como APOYO.
 * Sin funnel ni referente, NINGUNA (9/11/2026): antes viajaba la de anuncios y el agente firmaba todo «inspirado en» alguien que nadie
 * eligió, y hablaba de campañas a quien venía por YouTube. Un funnel sin ficha (email) tampoco lleva.
 */
export function fichasDelCopiloto(p: PerfilCopiloto): IdAsesor[] {
  const f = funnelElegido(p);
  const out: IdAsesor[] = [];
  const r = p.referente && asesorPorId(p.referente) ? p.referente : null;
  if (r && (!f || ensenaElFunnel(r, f.id) || funnelsDelReferente(r).length === 0)) out.push(r);
  // Si el elegido enseña ESTE funnel, su ficha alcanza: una segunda sobre lo mismo pesa ~5.000 caracteres más en cada mensaje.
  const cubre = !!r && !!f && ensenaElFunnel(r, f.id);
  const base = cubre || !f ? null : FICHA_POR_FUNNEL[f.id];
  if (base && !out.includes(base)) out.push(base);
  return out.slice(0, 2);
}

/** Una ficha que la persona NO eligió: sus criterios sirven, su nombre no va (regla 4). */
function fichaDeApoyo(id: IdAsesor, funnel: string): string {
  return `MATERIAL DE APOYO PARA ${funnel.toUpperCase()} (destilado de un curso de MaKo; la persona NO eligió seguir a nadie): usa estos criterios con tus palabras, SIN nombrar a quién son, sin decir «inspirado en» y sin el nombre propio de un marco. Lo que no aconsejas aunque aparezca: escasez o cupos inventados, testimonios falsos, promesas de ingresos, presión para decidir hoy.\n${FICHAS[id]}`;
}

/**
 * QUIÉN ENSEÑA QUÉ: la tabla medida, corta (una línea por funnel y una por los que enseñan otra parte), para que el agente diga
 * qué enseña cada uno sin tener su ficha, y a quién proponer cuando le piden algo que el elegido no enseña.
 */
export function quienEnsenaQue(p: PerfilCopiloto): string {
  const lineas = FUNNELS.map((f) => `· ${f.corto}: ${quienesEnsenan(f.id).map(nombreDelReferente).join(', ') || 'ningún referente de MaKo'}.`);
  const otros = (Object.keys(QUE_ENSENA) as IdAsesor[]).filter((id) => QUE_ENSENA[id].funnels.length === 0)
    .map((id) => `${nombreDelReferente(id)} (${QUE_ENSENA[id].canal.toLowerCase()})`);
  const r = p.referente ? asesorPorId(p.referente) : null;
  const q = r ? QUE_ENSENA[r.id] : null;
  const suyo = r && q
    ? `\nEL REFERENTE ELEGIDO, ${r.completo}, enseña en «${r.curso}»: ${q.tema}. Canal: ${q.canal}. Para: ${q.para.toLowerCase()}. ${q.funnels.length ? `Sus estrategias en el CoPilot: ${q.funnels.map((id) => FUNNELS.find((x) => x.id === id)!.corto).join(', ')}.` : 'No enseña un funnel para conseguir clientes: úsalo sólo para esa parte de la venta.'}${q.nota ? ` ${q.nota}` : ''} Si te piden algo que su curso no enseña, dilo («eso no está en su curso») y propone a quien sí, de la lista de arriba; nunca se lo atribuyas.`
    : '\nNO HAY REFERENTE ELEGIDO: no nombres a ninguno salvo que la persona pregunte quién enseña algo.';
  return `QUIÉN ENSEÑA QUÉ (medido en el curso de cada referente de MaKo; sólo atribuyes a alguien lo que está aquí):\n${lineas.join('\n')}\n· Otra parte de la venta, no un funnel: ${otros.join('; ')}.${suyo}`;
}

const us = (n: number) => fmtDinero(n);

/** Lo que se sabe del negocio y lo que dicen las reglas con eso. */
export function negocioDelCopiloto(p: PerfilCopiloto): string {
  const f = funnelElegido(p);
  const lineas: string[] = [];
  const ficha = fichaDelNegocio(p);
  const sabe = ficha.sabe.length ? `LO QUE YA SABES (de la primera entrada o de lo que guardó): ${ficha.sabe.map((d) => `${d.etiqueta}: ${d.valor}`).join(' · ')}.` : null;
  const imprescindibles = ficha.falta.filter((d) => d.imprescindible);
  const despues = ficha.falta.filter((d) => !d.imprescindible);
  const falta = ficha.falta.length
    ? `LO QUE TE FALTA${imprescindibles.length ? ` para recomendar (de a una, en este orden, salvo que ya lo haya dicho en la charla o esté en el perfil del negocio): ${imprescindibles.map((d) => d.pregunta).join(' / ')}` : ''}${despues.length ? `${imprescindibles.length ? '. Y cuando venga al caso' : ' (cuando venga al caso)'}: ${despues.map((d) => d.pregunta).join(' / ')}` : ''}.`
    : null;
  if (!f && p.entrada == null) {
    return [
      'EL NEGOCIO: todavía no hizo la primera entrada del Marketing CoPilot (no hay funnel elegido). Si está en la tab, esta charla ES esa entrada: entiende primero (A) y recomienda después (B). Si te escribe desde otro lado, también puedes llevarlo a la tab (/ads-manager?estrategia=1).',
      falta, UMBRALES_EN_PALABRAS, CUANDO_NO_HAY_DATOS,
    ].filter(Boolean).join('\n');
  }
  const ref = p.referente ? asesorPorId(p.referente) : null;
  const conRef = !ref ? '' : !f || ensenaElFunnel(ref.id, f.id) ? ` (con la estrategia inspirada en ${ref.completo})`
    : funnelsDelReferente(ref.id).length === 0 ? ` (eligió a ${ref.completo} para ${QUE_ENSENA[ref.id].tema}, no para el funnel)` : '';
  lineas.push(`FUNNEL ELEGIDO: ${f ? f.nombre : 'ninguno todavía'}${conRef}.`);
  if (sabe) lineas.push(sabe);
  if (falta) lineas.push(falta);
  if (p.presupuestoMes != null) lineas.push(p.presupuestoMes > 0 ? `Puede poner ${us(p.presupuestoMes)} al mes en anuncios (unos ${us(p.presupuestoMes / 30)} por día).` : 'No tiene presupuesto para anuncios por ahora.');
  if (p.llamadas) lineas.push({ yo: 'Las llamadas y los mensajes los atiende él o ella.', equipo: 'Tiene un equipo que toma las llamadas.', nadie: 'Nadie toma llamadas todavía.' }[p.llamadas]);
  if (f?.id === 'organico' || f?.id === 'youtube') {
    const o = [p.objetivo ? `objetivo: ${p.objetivo}` : null, p.ritmo != null ? `ritmo: ${p.ritmo} por semana` : null, p.formato ? `formato: ${p.formato}` : null].filter(Boolean);
    if (o.length) lineas.push(`Contenido (${o.join(', ')}).`);
  }
  if (f && usaAnuncios(f.id) && p.presupuestoMes) {
    const dia = p.presupuestoMes / 30;
    const n = Math.max(1, Math.floor(dia / 10));
    lineas.push(`TAMAÑO DE LA CUENTA: con ${us(dia)} por día caben como mucho ${n} conjunto${n > 1 ? 's' : ''} de anuncios (unos US$10 por día cada uno para juntar datos), y se optimiza al primer evento que junte volumen, no a la llamada. Una ficha que pida cinco campañas o tres públicos por cuatro creativos no entra aquí: achícala y dilo.`);
  }
  if (f?.id === 'vsl-llamada' && p.casos !== 'si') lineas.push(`${p.casos === 'no' ? 'No tiene casos reales todavía' : 'Antes de confirmar el VSL, pregunta si tiene casos reales de clientes'}: sin ellos el video de venta no tiene qué mostrar (y nunca se inventan). Sin casos, mejor un formulario o mensajes mientras los junta.`);
  if (f?.id === 'organico' && p.ritmo != null) {
    const pl = planOrganico(p);
    lineas.push(`REPARTO que calcula MaKo para ${p.ritmo} por semana${p.objetivo ? ` con objetivo ${p.objetivo}` : ' (si no dijo el objetivo, supone mixto: pregúntaselo)'}: ${pl.puntos.join(' ')}`);
  }
  if (f?.id === 'youtube') lineas.push(`YOUTUBE PARA ESTE NEGOCIO: un negocio de servicios lo usa para que lo conozcan y lleguen a su oferta${fichasDelCopiloto(p).includes('derek-chamizo') ? '; la ficha de Derek Chamizo habla de canales automatizados que viven del CPM, así que ignora lo de nichos por CPM, canales sin cara y los 40 videos' : ''}. Con pocas horas por semana: un video bueno por semana (guion, grabación y edición ocupan las tres horas), y dile que el efecto tarda meses (entre 6 y 24 según lo que dicen las fuentes de contenido permanente): si necesita clientes en las próximas semanas, YouTube solo no se los da; que lo acompañe con mensajes directos a quien ya le escribe.`);
  if (f?.id === 'email' && p.lista == null) lineas.push('EMAIL: antes de armar la secuencia, pregunta cuántos contactos tiene y hace cuánto no les escribe: una lista dormida se reconecta antes de vender.');
  if (p.competencia === 'si') lineas.push('Pidió que investigues a su competencia (Competitor Spy).');
  // El funnel ELEGIDO se juzga con lo que dijo más lo que ese funnel no pregunta (`datosDeDecision`: orgánico no lleva plata). Recomendar
  // otro y comparar los nueve, sólo con lo que DIJO (`datosDichos`, 10/11/2026): con el orgánico de un referente y sin presupuesto, las
  // reglas corrían con un $0 que nadie contestó y el agente recibía «conviene lead-magnet: con $0 al mes un anuncio no junta datos».
  const d = datosDeDecision(p);
  const dichos = datosDichos(p);
  if (dichos) {
    const rec = recomendarFunnel(dichos);
    lineas.push(`LO QUE DICEN LAS REGLAS DE MAKO con esos datos: conviene ${rec.funnel === f?.id ? 'justo ése' : `«${rec.funnel}»`}. ${rec.porque}${rec.masAdelante ? ` Más adelante: «${rec.masAdelante}».` : ''}`);
  }
  if (f && d) {
    const v = evaluarFunnel(f.id, d);
    lineas.push(v.sirve ? `El funnel elegido SÍ le sirve con esos números.` : `EL FUNNEL ELEGIDO NO LE SIRVE: ${v.motivo}${v.mejor ? ` Debes decírselo y proponer «${v.mejor.funnel}».` : ''}${p.ajuste === 'sigo' ? ' Ya se lo dijiste y decidió seguir con el suyo: no insistas, mídelo con sus primeros números.' : ''}`);
  }
  if (dichos) {
    lineas.push(`LOS FUNNELS PARA ESTE NEGOCIO (úsalo cuando pida pasar de uno a otro; lo mismo que ve en «Comparar funnels»): ${compararFunnels(p, 'el').map((c) => `${c.funnel.corto}: ${c.sirve == null ? `falta saber ${c.falta}` : c.sirve ? 'le sirve' : `NO (${c.motivo})`}, tarda ${c.tarda}`).join(' · ')}.`);
  } else {
    const faltan = faltaParaComparar(p, 'el');
    lineas.push(`LOS FUNNELS PARA ESTE NEGOCIO: todavía no se pueden comparar con sus números (falta ${faltan.join(', ')}${d ? '; no lo preguntes para el funnel que eligió, sólo si quiere comparar o cambiar' : ''}). Cuánto tarda cada uno: ${compararFunnels(p).map((c) => `${c.funnel.corto}, ${c.tarda}`).join(' · ')}.`);
    // Los umbrales SIEMPRE que las reglas no corrieron (9/11/2026, la batería): con el precio en el perfil del negocio pero sin guardar,
    // al negocio real del ws 9 le recomendó un VSL con llamada con US$1.500 de ticket y US$1.000 al mes, que las reglas descartan.
    lineas.push(UMBRALES_EN_PALABRAS);
  }
  const cuenta = cuentaDe(p);
  if (cuenta) lineas.push(`LA CUENTA (la misma que ve en su panel): ${cuenta.lineas.map((l) => `${l.etiqueta}: ${l.valor}`).join(' · ')}. ${cuenta.nota}`);
  const semana = pasosDeLaSemana(p);
  if (semana.length) lineas.push(`ESTA SEMANA (lo que ve en su panel; bájalo a SU caso cuando pregunte qué hacer): ${semana.map((s, i) => `${i + 1}. ${s.texto}${s.pantalla ? ` (${s.pantalla})` : ''}`).join(' ')}`);
  if (f) lineas.push(`SU PANTALLA muestra: ${seccionesDe(f.id, p.presupuestoMes).join(', ')}.${conCampanas(f.id, p.presupuestoMes) ? '' : ' No tiene Campañas porque este funnel no lleva anuncios (o no tiene presupuesto): no le propongas lanzar ni optimizar campañas.'}`);
  lineas.push(CUANDO_NO_HAY_DATOS);
  return `EL NEGOCIO (lo que respondió y lo que guardó; si cambia de idea o da un dato que falta, ofrécele guardarlo con copiloto_media_buyer):\n${lineas.join('\n')}`;
}

/** Los umbrales de las reglas puras, en palabras, para decidir con lo que dijo en la charla antes de que se guarde (salen de `UMBRALES`). */
const UMBRALES_EN_PALABRAS = `LOS UMBRALES DE MAKO (decide con ellos aunque todavía no esté guardado; si el precio está en el perfil del negocio, ése es el ticket): VSL con llamada, desde ${fmtDinero(UMBRALES.ticketVsl)} de ticket y ${fmtDinero(UMBRALES.presupuestoVsl)} al mes, con casos y alguien que llame; compra directa, hasta ${fmtDinero(UMBRALES.ticketCarrito)} de ticket (o una tienda); webinar, desde ${fmtDinero(500)} de ticket y ${fmtDinero(UMBRALES.presupuestoWebinar)} al mes; con menos de ${fmtDinero(UMBRALES.presupuestoMinimo)} al mes los anuncios no aprenden (contenido, regalo o email a su lista); en el medio, anuncios a mensajes o a formulario.`;

/** La regla para todo lo que no está en el perfil del CoPilot: el perfil del negocio y el Second Brain también son fuente. */
const CUANDO_NO_HAY_DATOS = 'Lo que no está aquí puede estar en el PERFIL DEL NEGOCIO o en lo que trae el Second Brain (más arriba): úsalo antes de preguntar, y dilo («veo en tu perfil que vendes…»). Si lo que dice la persona choca con eso, gana lo que dice ahora.';

/** El contexto entero del turno de la tab. `textos`: los editables vigentes (./copiloto-contexto-vigente.ts); sin ellos, los default. */
export function contextoDelCopiloto(p: PerfilCopiloto, textos: TextosDelCopiloto = TEXTOS_POR_DEFECTO): string {
  const f = funnelElegido(p);
  const fichas = fichasDelCopiloto(p).map((id) => (id === p.referente ? contextoDeReferente(id) : fichaDeApoyo(id, f?.nombre ?? 'este funnel'))).filter(Boolean).join('\n\n');
  return [textos.reglas, negocioDelCopiloto(p), textos.canales, textos.anuncios, quienEnsenaQue(p), fichas].filter(Boolean).join('\n\n');
}
