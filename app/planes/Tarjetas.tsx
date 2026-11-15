// =============================================================================
// TarjetasPlanes — los tres bloques de precios, LOS MISMOS en /planes y en la landing de venta (24/10/2026, noche)
// =============================================================================
// Martín, 24/10: «La sección de planes no se entiende para nada... Lo hiciste con lenguaje interno... Tienes que VENDER,
// Revisa como lo hacen otras paginas... Y sobre todo el acompañamiento debe tener mas beneficios y verse diferencial, porque
// sino no tiene sentido. El personalizado tiene que tener un factor de PROMESA de resultados, ya no solo software».
//
// COPIADO DE (mirados el 24/10): ClickFunnels (clickfunnels.com/pricing) — el escalón de arriba en un bloque OSCURO, distinto
// de los de software, y el botón arriba de la lista, debajo del precio; Kajabi (kajabi.com/pricing) — una frase por plan que
// dice para qué ETAPA del negocio es, y lo que incluye dicho como lo que la persona consigue. Además, arriba de cada nombre,
// cómo se trabaja: «Lo haces tú, con MaKo» o «Lo armamos contigo»: lo que separa al software del acompañamiento.
//
// Los datos: los planes (lib/planes-mako.ts, con si se cobran en línea: `ofertasDeLosPlanes` / `planesParaLanding`) y el
// programa (`PROGRAMA_ACELERADOR`). El botón de cada plan, la regla de siempre (`botonDelPlan`: «Empezar» sólo con un cobro
// detrás). El programa SIEMPRE se pide (nunca pasa por la pasarela). Su promesa (un resultado con plazo) va arriba del
// botón, y su garantía (sobre los entregables) abajo, con el link a las condiciones: sin una, no se dibuja. Sin hooks ni datos: la usan una página del servidor (/planes) y un portal del cliente (la landing).
// Las clases llevan `mkpl-`: adentro de una landing del Web Generator conviven con el CSS de ese diseño, y un nombre
// genérico («card», «btn») se pisa con el suyo.
//
// MENSUAL O ANUAL (25/10/2026, el Cerebro: «el anual son 2 meses gratis»): el selector de arriba, como el de toda página de
// precios, hecho con dos radios y `:has()` (sin JavaScript: anda igual en /planes, que es del servidor, y en el portal de la
// landing). El anual SIEMPRE se pide (`botonAnualDelPlan`): el checkout cobra por mes. Junto al precio, «7 días gratis», y
// debajo de cada botón cuánto se cobra después y hasta cuándo se cancela sin pagar (`PRUEBA_DIAS`, lo mismo que /reembolsos
// §1: desde el 25/10 la prueba reemplaza a la garantía de 14/30 días). Abajo de todo, que desde Argentina se paga en pesos
// con Mercado Pago. Un precio en pesos sólo si el plan lo tiene (`precioEnPesos`): nunca con una tasa.
//
// EL REDISEÑO DEL 12/11/2026 (Martín: «rediseñes los tres bloques de los planes… tienen muchos ítems y puedes fijarte cómo lo
// hace el diseño de otras aplicaciones»). COPIADO DE beehiiv (beehiiv.com/pricing, mirada el 12/11/2026, la misma referencia
// del sitio): tarjetas blancas iguales, el nombre y su frase, el precio grande con su nota chica, UN botón a todo el ancho con
// una nota debajo (su «No credit card required»: aquí, cuándo se paga), una raya y la lista corta, con «Todo lo de Esencial,
// más:» en la del medio. Lo que un plan NO trae ya no va en la tarjeta (eran 8 renglones con ✗): lo dice la comparación.
// La insignia («Recomendado», «Con acompañamiento») arriba a la derecha, negra, como su «Most Popular». El Acelerador deja de
// ser un bloque oscuro: el sol y la luna del sitio llevan la página entera a un solo modo (app/vsl/_competencia/TemaSitio.tsx),
// y un bloque negro en el modo claro es lo que Martín pidió sacar. Se distingue por su insignia y su botón negro.
// LA PRUEBA, SÓLO EN PRO (12/11/2026): `planConPrueba` (lib/planes-mako.ts). Esencial dice que se paga hoy.
// LA TERCERA VUELTA (12/11/2026, noche, Martín: «no pongas tanto texto… los botones… todos tienen que estar alineados… me
// gustaban los colores de las tarjetas anteriores, el Acelerador estaba negro»): listas cortas (`listaCorta`), sin notas debajo
// de los botones ni la línea de pagos, filas comunes con subgrid y los colores de antes (el azul de Pro, el Acelerador grafito).
// =============================================================================

import { ASESORIAS_DEL_PROGRAMA, MESES_GRATIS_ANUAL, NOMBRE_PLAN_CON_PRUEBA, PROGRAMA_ACELERADOR, PRUEBA_DIAS, PRUEBA_GRATIS_PRENDIDA, planConPrueba, precioEnPesos, type PlanMako } from '@/lib/planes-mako';
import { TOPES } from '@/lib/topes-plan';
import { cupoDeLaCapa } from '@/lib/mako-tokens-paquetes';
import { botonAnualDelPlan, botonDelPlan } from '@/lib/compra-plan-reglas';
import { formatoMonto } from '@/lib/pasarela-moneda';
import { PROMO_ENTRADA, precioPrimerMes, textoUsd } from '@/lib/promo-entrada-reglas';

/** Un plan como lo dibujan las tarjetas, con si se cobra en línea. La capa dice lo que NO trae (la comparación). */
export type PlanEnTarjeta = Pick<PlanMako, 'id' | 'nombre' | 'capa' | 'precioUsd' | 'resumen' | 'incluye' | 'destacado' | 'precioAnualUsd' | 'preciosLocales'> & { cobrable: boolean };

export const TEXTO_PAGOS = 'Desde Argentina pagas en pesos, con Mercado Pago.';
/** La línea de la prueba, para quien la necesite fuera de las tarjetas (las tarjetas ya no la repiten abajo). */
export const TEXTO_PRUEBA = PRUEBA_GRATIS_PRENDIDA
  ? `${NOMBRE_PLAN_CON_PRUEBA} empieza con ${PRUEBA_DIAS} días gratis: si te das de baja antes del día ${PRUEBA_DIAS + 1}, no se te cobra nada.`
  : 'Pagas al empezar y te das de baja cuando quieras.';

/** `CEJA_SOFTWARE` ya no la dibuja la tarjeta: cada columna dice cómo se trabaja en su propia ceja (`listaCorta`). Queda para
 *  quien la cite fuera de acá. `CEJA_PROGRAMA` sí: es la ceja de la lista del Acelerador y el rótulo de su tarjeta. */
export const CEJA_SOFTWARE = 'Lo haces tú, con MaKo';
export const CEJA_PROGRAMA = 'Lo armamos contigo';

const n = (v: number | null) => (v == null ? 'sin tope' : v.toLocaleString('es-AR'));
/** «1 landing» / «3 landings»: el número con su palabra (los topes cambian; el plural, solo). */
const nn = (v: number | null, uno: string, varios: string) => `${n(v)} ${v === 1 ? uno : varios}`;

/**
 * Un renglón de la lista. `fuerte` es el arranque en negrita y `texto` lo que le sigue: la NEGRITA SELECTIVA de ClickFunnels
 * (clickfunnels.com/pricing, mirada el 14/11/2026), el truco más copiable de las siete páginas que se relevaron. Sin `fuerte`,
 * el renglón va plano.
 */
export type ItemLista = { fuerte?: string; texto: string };

/** Lo que dibuja la lista de una columna: la ceja, los MaKo Tokens, los topes en una línea aparte y los checks. */
export type ListaDeColumna = {
  /** La ceja arriba de los checks: CÓMO se trabaja en ese plan. Reemplaza al «Todo lo de Esencial, más:» de antes. */
  titulo: string;
  /** Los MaKo Tokens que trae por mes, ya escrito. null = no hay dato decidido para esa capa y NO se inventa uno. */
  tokens: string | null;
  /** Los topes, en renglones aparte ARRIBA de los checks. */
  topes: string[];
  items: ItemLista[];
};

/**
 * LAS LISTAS DE CADA COLUMNA (14/11/2026; el relevo que aprobó Martín: docs/relevo/planes-que-incluye-cada-columna.md §4).
 *
 * Martín, textual: «no es la idea de que diga todo lo de Essential más tal, todo lo de MaKo Pro más… la idea es que cada uno se
 * sienta único y tiene que pensarse como usuario… para el de 47 si estás solo o si sos una empresa chiquitita, para el de 97 si
 * ya tenés equipo… el de 47 debería estar bien limitado y restrictivo; el de 97 ya podés generar avatares de IA, editar videos,
 * replicar landing… **La idea es que compren el de 97, no el de 47.**»
 *
 * El molde es ClickFunnels con la prosa de Kajabi (las siete páginas de precios del rubro, relevadas el 14/11; el detalle y el
 * porqué de cada decisión, en el §3 del relevo):
 *   · **CADA COLUMNA COMPLETA Y AUTOSUFICIENTE.** Ninguna dice «todo lo de X». Cinco de las siete páginas del rubro lo hacen y
 *     Martín lo rechaza a propósito; el único que lista cada columna entera es ClickFunnels, que es el que más se parece a
 *     nuestro cliente. Leídas en paralelo, Pro gana renglón por renglón; leída sola, cada una se entiende.
 *   · **NINGÚN NÚMERO ADENTRO DE UN BULLET** (Kajabi y beehiiv). Los topes van arriba, en su propia línea. Antes, 5 de los 7
 *     renglones de Esencial eran cifras: la columna barata se leía como una lista de lo que no te alcanza, que empuja a Pro
 *     pero no vende Esencial — y Esencial igual hay que venderlo.
 *   · **TODA LA NEGRITA EN PRO, NINGUNA EN ESENCIAL** (ClickFunnels). La columna barata queda visualmente plana sin que le
 *     falte un renglón: no se le puede acusar de esconder nada, y aun así no engancha el ojo.
 *   · **EL BULLET #1 DE PRO ES EL QUE MÁS DUELE, no el más grande** (beehiiv): copiar la landing del competidor, con el dominio
 *     propio pegado ahí. El dominio es la palanca de la marca ajena, la más barata del rubro, y estaba escondida en un renglón
 *     compartido («Comunidad y dominio propio»).
 *   · **PRO NO TIENE MENOS RENGLONES QUE ESENCIAL** (Kajabi 5/6/4, beehiiv 6/6/8/7: la recomendada tiene MÁS). Si hay que
 *     desempatar, el que suma uno es Pro, nunca Esencial.
 *
 * ⚠️ ESTE ES EL ÚNICO LUGAR QUE SE VE. `PLANES_MAKO_DEFAULT[].incluye` (lib/planes-mako.ts) NO lo lee nadie desde el rediseño
 *    del 12/11 (la tarjeta dibuja esto, y el checkout tiene su propia entrada, `INCLUYE_EN_EL_CHECKOUT`): escribir el cambio
 *    allá es escribirlo donde no se muestra. Está en el §1.4 del relevo.
 * ⚠️ LOS NÚMEROS SALEN DEL CÓDIGO, nunca escritos a mano: los topes de lib/topes-plan.ts y el cupo de MaKo Tokens de
 *    lib/mako-tokens-paquetes.ts (`cupoDeLaCapa`). Así la vitrina no puede prometer lo que el producto frena.
 * ⚠️ Y DEPENDE DE LA CAPA, NO DEL id: un plan nuevo del setting `planes.mako` con capa `agencia` dice lo de Pro sin tocar
 *    código. Lo que NO se puede es diferenciar dos planes de la misma capa (§1.5 del relevo).
 * ⚠️ EL AVATAR DE IA NO VA EN NINGUNA COLUMNA aunque ya sea de Pro (`FUNCIONES_SOLO_PRO`, 'ai-avatar'): no se vende hasta que
 *    ande de punta a punta (`AI_AVATAR_SE_VENDE`, lib/planes-comparacion.ts). Cerrarlo en Esencial y venderlo son dos cosas.
 */
export function listaCorta(capa: string): ListaDeColumna {
  const c = TOPES.completo, a = TOPES.agencia;
  if (capa === 'agencia') {
    return {
      // Lo que hace únicas a las dos columnas sin decir «todo lo de X»: Esencial = lo haces tú, con MaKo al lado.
      // Pro = MaKo lo hace, tú apruebas. No es una metáfora: es exactamente lo que el código cierra (`FUNCIONES_SOLO_PRO`
      // son todas «MaKo lo hace solo»: la edición con IA, el setter, los pilotos, copiar la landing, el análisis de llamadas).
      titulo: 'MaKo lo hace, tú apruebas',
      tokens: tokensDeLaCapa(capa),
      topes: [
        'Leads, pipelines, páginas, automatizaciones, competidores y cursos sin tope',
        `${n(a['chats.lineas_whatsapp'])} WhatsApp · ${n(a['equipo.usuarios'])} personas de tu equipo`,
      ],
      items: [
        { fuerte: 'Copia la landing de cualquier competidor con tu oferta', texto: ', con tu dominio propio' },
        { fuerte: 'Edición con IA de tus videos:', texto: ' corta las pausas, subtitula y propone B-roll solo' },
        { fuerte: 'Un setter con IA', texto: ' que responde y agenda por WhatsApp e Instagram' },
        { fuerte: 'Piloto automático', texto: ' de tus anuncios, tu Instagram y tu YouTube' },
        { fuerte: 'Toda tu competencia en el radar', texto: ', con sus guiones y sus carruseles replicados' },
        { fuerte: 'Tus llamadas de venta analizadas con IA', texto: ', llamada por llamada' },
        // 14/11/2026: el chat con los referentes pasó a ser de Pro (`FUNCIONES_SOLO_PRO`, 'chat-referentes'), así que acá SÍ
        // va. Es el renglón que suma Pro: la recomendada no puede tener menos que Esencial.
        { fuerte: 'Chatea con los referentes del marketing', texto: ', cada uno con su método' },
        { fuerte: 'Cursos sin tope y la comunidad de tus alumnos', texto: ', como en Skool' },
        { fuerte: 'Tu equipo adentro:', texto: ' cada persona con su acceso y sus permisos' },
      ],
    };
  }
  return {
    titulo: 'Lo haces tú, con MaKo al lado',
    tokens: tokensDeLaCapa(capa),
    topes: [
      `${n(c['crm.leads'])} leads · ${nn(c['crm.funnels'], 'pipeline', 'pipelines')} · ${nn(c['web.landings_publicadas'], 'página', 'páginas')} · ${n(c['chats.lineas_whatsapp'])} WhatsApp · ${nn(c['automations.activas'], 'automatización', 'automatizaciones')}`,
      `${nn(c['spy.competidores'], 'competidor', 'competidores')} · ${nn(c['classroom.cursos'], 'curso', 'cursos')} · ${nn(c['cobros.cuentas'], 'cuenta de cobro', 'cuentas de cobro')} · ${nn(c['equipo.usuarios'], 'usuario', 'usuarios')}`,
    ],
    // Ni un renglón en negrita, y ninguno con un número: funciones puras, en las mismas áreas que la columna de Pro.
    items: [
      { texto: 'Tu página de venta, escrita por IA y publicada en un clic' },
      { texto: 'Tu CRM: cada lead con su etapa, su historia y de qué anuncio vino' },
      { texto: 'WhatsApp, Instagram, Messenger y email en una sola bandeja' },
      { texto: 'Guiones de reels, anuncios, VSL y emails, escritos por IA' },
      { texto: 'Editor de imágenes y editor de video, con tu marca y tus colores' },
      { texto: 'El radar de tu competencia: su web, sus redes y sus anuncios' },
      { texto: 'Mejoras para tus anuncios cada día, y tú decides si las aplicas' },
      { texto: 'Tu curso para tus alumnos, dentro de MaKo' },
    ],
  };
}

/**
 * LOS MaKo TOKENS DE CADA COLUMNA (14/11/2026; Martín: «yo le di feedback a la tab de precios sobre MaKo Tokens, que debería
 * estar arriba de las columnas, etc.», y lo anotado: «con los tokens de cada plan y el costo real por acción»,
 * docs/relevo/landings-vsl.md:425-426). Hasta hoy NINGUNA columna decía cuántos trae.
 *
 * ⚠️ El cupo sale de `cupoDeLaCapa` (lib/mako-tokens-paquetes.ts), que es donde vive el mapeo de la capa al nivel de tokens y
 *    por qué: los niveles se llaman 'free' | 'pro' | 'growth' y **no son los planes** — el llamado `pro` es el de US$47
 *    (Esencial) y `growth` el de US$97 (MaKo Pro). Leerlos por el nombre pone el cupo cruzado.
 * ⚠️ SIN DATO, NO DICE NADA: el Acelerador no tiene cupo decidido, así que su columna no habla de tokens (null). Nunca un
 *    número inventado en la vitrina.
 */
export function tokensDeLaCapa(capa: string): string | null {
  const mt = cupoDeLaCapa(capa);
  return mt == null ? null : `${mt.toLocaleString('es-AR')} MaKo Tokens por mes`;
}

/**
 * La lista del Acelerador. 14/11/2026: MaKo Pro deja de estar en el título («Todo lo de MaKo Pro, más:») y pasa a ser el PRIMER
 * check, para que esta columna también se lea sola — Martín pidió sacar la fórmula «todo lo de X» de las columnas, y el
 * Acelerador es una columna más. El detalle de cada entregable sigue en /reembolsos §2.
 */
export const LISTA_PROGRAMA: readonly string[] = [
  'MaKo Pro completo, los 3 meses',
  'Todo armado la primera semana',
  `${ASESORIAS_DEL_PROGRAMA} asesorías en vivo con Martín`,
  'Plantillas probadas',
  'Un grupo de WhatsApp con Martín',
];

/**
 * AGENDAR LA LLAMADA DEL ACELERADOR (14/11/2026). Martín, textual: «lo de agendar llamadas sí debería estar todavía para el
 * tema de Accelerator. Ahí debería haber la agenda de llamada. **Pero en ningún otro lado debería estar.**»
 *
 * ⚠️ ES LA ÚNICA EXCEPCIÓN A LA REGLA DEL 12/11/2026 («ningún lado debería estar agendar llamadas, solamente iniciar la prueba
 *    gratuita»), que sigue valiendo para todo lo demás: las landings y el sitio llevan a /planes con `TEXTO_CTA`
 *    (app/vsl/_competencia/cta.ts), y Esencial y Pro se compran sin hablar con nadie. El Acelerador no: se vende por llamada,
 *    como el «hablar con ventas» del tercer bloque de cualquier SaaS, y en esa llamada se ofrece el programa
 *    (docs/vsl/README.md). Si aparece un «Agenda tu llamada» en otra pantalla, es un error: se saca.
 * Es la agenda de MARTÍN, no la de un cliente (en el repo hay otros Calendly que son de Mauricio: no son éste).
 */
export const AGENDA_ACELERADOR = 'https://calendly.com/koncke/asesoria';
export const TEXTO_AGENDA_ACELERADOR = 'Agenda tu llamada';

/** Debajo del precio, una sola cosa: los días gratis, que se paga hoy, o las cuotas. */
export function bajoElPrecio(p: { id: string }): string {
  return planConPrueba(p.id) ? `${PRUEBA_DIAS} días gratis` : 'Se paga al empezar';
}

export const CSS_TARJETAS = `
/* LOS BOTONES ALINEADOS (12/11/2026, Martín: «todos tienen que estar alineados… no puede estar uno más arriba, otro más abajo»):
   cada tarjeta tiene las MISMAS filas (nombre, frase, precio, botón, lista) y con subgrid el alto de cada fila lo pone la más
   alta de las tres. Los colores, los de antes (Martín: «me gustaban los colores… el Acelerador estaba negro»). */
.mkpl-grilla { display: grid; gap: 18px; grid-template-columns: repeat(3, minmax(0, 1fr)); grid-template-rows: repeat(5, auto); padding-top: 14px; align-items: stretch; text-align: left; }
.mkpl-card { position: relative; display: grid; grid-row: span 5; grid-template-rows: subgrid; row-gap: 0; background: #FFFFFF; color: #12151B;
  border: 1px solid #E6EAF2; border-radius: 20px; padding: 26px 24px 24px; box-shadow: 0 1px 2px rgba(18,21,27,.04), 0 10px 28px rgba(18,21,27,.06); }
.mkpl-card.destacado { border-color: #2F6FED; box-shadow: 0 0 0 1px #2F6FED, 0 16px 40px rgba(47,111,237,.18); }
.mkpl-insignia { position: absolute; top: -13px; left: 24px; background: #2F6FED; color: #fff; font-size: 12px; font-weight: 700;
  letter-spacing: .03em; padding: 5px 12px; border-radius: 999px; }
.mkpl-card h3 { margin: 0 0 6px; font-size: 22px; line-height: 1.2; font-weight: 800; letter-spacing: -.01em; color: inherit; }
.mkpl-resumen { margin: 0 0 18px; color: #4A5260; font-size: 15px; line-height: 1.5; }
.mkpl-r-precio { display: flex; flex-direction: column; justify-content: flex-end; gap: 6px; }
.mkpl-precio { font-size: 40px; line-height: 1; font-weight: 800; letter-spacing: -.03em; }
.mkpl-precio small { font-size: 15px; font-weight: 500; letter-spacing: 0; color: #5B6472; }
.mkpl-bajo { font-size: 13px; font-weight: 600; color: #5B6472; }
.mkpl-bajo.gratis { align-self: flex-start; padding: 2px 10px; border-radius: 999px; background: #E3F5EB; color: #1F7A4D; font-weight: 800; }
.mkpl-r-boton { padding: 20px 0 22px; }
.mkpl-btn { display: block; text-align: center; background: #2F6FED; color: #fff !important; text-decoration: none;
  font-weight: 700; font-size: 15px; padding: 14px 20px; border-radius: 12px; box-shadow: 0 6px 18px rgba(47,111,237,.24); transition: filter .15s ease; }
.mkpl-btn:hover { filter: brightness(1.06); }
.mkpl-btn.prueba { font-size: 17px; padding: 18px 20px; border-radius: 14px; box-shadow: 0 10px 26px rgba(47,111,237,.34); }
.mkpl-btn.borde { background: #fff; color: #2F6FED !important; box-shadow: inset 0 0 0 1.5px #2F6FED; }
.mkpl-garantia { display: block; margin-top: 8px; text-align: center; font-size: 12.5px; color: #C4C8D0; text-decoration: underline; text-underline-offset: 2px; }
.mkpl-lista-t { margin: 0 0 10px; font-size: 14px; font-weight: 700; }
/* LOS NÚMEROS, FUERA DE LOS CHECKS (14/11/2026, el molde de Kajabi: «2.500 contacts included» en una línea sola, arriba del
   encabezado de la lista). Los MaKo Tokens del plan primero, con su número en negrita, y debajo los topes, en gris y chico: lo
   que el ojo compara antes de leer funciones. Los bullets quedan funciones puras. */
.mkpl-tokens { margin: 0 0 6px; font-size: 14px; line-height: 1.4; color: #4A5260; }
.mkpl-tokens b { color: #12151B; font-weight: 800; }
.mkpl-topes { margin: 0 0 12px; padding: 0 0 12px; border-bottom: 1px solid #EEF1F5; display: grid; gap: 3px;
  font-size: 13px; line-height: 1.45; color: #5B6472; }
.mkpl-lista { list-style: none; margin: 0; padding: 0; display: grid; gap: 10px; font-size: 14.5px; line-height: 1.4; }
.mkpl-lista li { display: flex; gap: 10px; align-items: flex-start; }
/* La negrita SELECTIVA (ClickFunnels): el arranque del renglón en negrita, lo que le sigue en peso normal. Sólo la lleva Pro. */
.mkpl-lista li b { font-weight: 700; color: #12151B; }
.mkpl-lista li::before { content: "✓"; flex: none; width: 20px; height: 20px; border-radius: 50%; display: inline-flex; align-items: center;
  justify-content: center; font-size: 12px; font-weight: 800; color: #1F7A4D; background: #E3F5EB; margin-top: 0; }
/* El Acelerador, OSCURO para que se destaque (grafito #101319, el de la app, con el brillo dorado de su botón). No lo toca el sol
   y la luna (data-tema-fijo): es negro en los dos modos. */
.mkpl-programa { background: radial-gradient(700px 320px at 100% 0%, rgba(245,196,81,.14), transparent 60%), linear-gradient(160deg, #1C1F27 0%, #101319 100%);
  color: #F4F5F7; border-color: #2A2F3A; box-shadow: 0 22px 54px rgba(16,19,25,.34); }
.mkpl-programa .mkpl-insignia { background: #F5C451; color: #2A1E00; }
.mkpl-programa .mkpl-resumen, .mkpl-programa .mkpl-bajo, .mkpl-programa .mkpl-precio small { color: #C4C8D0; }
.mkpl-programa .mkpl-resumen b { color: #F5C451; }
.mkpl-programa .mkpl-btn { background: #F5C451; color: #2A1E00 !important; box-shadow: 0 8px 22px rgba(245,196,81,.28); }
.mkpl-programa .mkpl-lista li::before { color: #2A1E00; background: #F5C451; }
.mkpl-programa .mkpl-topes { color: #C4C8D0; border-bottom-color: #2A2F3A; }
/* Mensual o anual: dos radios (escondidos) y sus etiquetas como un selector; :has() muestra los precios del que está
   elegido. Sin :has(), se ven los dos: nunca queda una tarjeta sin precio. */
.mkpl-periodo { display: flex; justify-content: center; margin: 0 0 22px; }
.mkpl-periodo-caja { display: inline-flex; gap: 4px; padding: 4px; border-radius: 999px; background: #E9EDF5; }
.mkpl-periodo input { position: absolute; opacity: 0; width: 1px; height: 1px; pointer-events: none; }
.mkpl-periodo label { cursor: pointer; padding: 9px 18px; border-radius: 999px; font-size: 14.5px; font-weight: 700; color: #4A5260; }
.mkpl-periodo label b { margin-left: 6px; padding: 2px 8px; border-radius: 999px; background: #E3F5EB; color: #1F7A4D; font-size: 12px; }
.mkpl-periodo input:checked + label { background: #FFFFFF; color: #12151B; box-shadow: 0 1px 3px rgba(18,21,27,.14); }
.mkpl-periodo input:focus-visible + label { outline: 2px solid #2F6FED; outline-offset: 2px; }
.mkpl-bloques:has(#mkpl-p-anual:checked) .mkpl-mes { display: none; }
.mkpl-bloques:has(#mkpl-p-mes:checked) .mkpl-anual { display: none; }
.mkpl-primer-mes { margin: 8px 0 0; padding: 8px 10px; border-radius: 10px; background: #FFF8DB; color: #4A5260; font-size: 13.5px; line-height: 1.4; }
.mkpl-primer-mes b { display: block; color: #12151B; font-size: 15px; }
@media (max-width: 900px) {
  .mkpl-grilla { grid-template-columns: 1fr; grid-template-rows: none; gap: 26px; }
  .mkpl-card { display: flex; flex-direction: column; grid-row: auto; }
}
`;

const precio = (v: number) => v.toLocaleString('es-AR');

export function TarjetasPlanes({ planes, sufijo, promoVigente = false }: {
  planes: readonly PlanEnTarjeta[]; sufijo: string;
  /** El reloj del 50% sigue vivo en este navegador: cada plan del cartel dice lo que sale su primer mes. Después, el precio de siempre. */
  promoVigente?: boolean;
}) {
  const pr = PROGRAMA_ACELERADOR;
  // El selector, sólo si TODOS los planes tienen anual: uno sin anual quedaría sin precio al elegirlo.
  const conAnual = planes.length > 0 && planes.every((p) => !!p.precioAnualUsd);
  return (
    <div className="mkpl-bloques">
      {conAnual && (
        <div className="mkpl-periodo">
          <div className="mkpl-periodo-caja" role="radiogroup" aria-label="Cómo pagas">
            <input type="radio" name="mkpl-periodo" id="mkpl-p-mes" defaultChecked />
            <label htmlFor="mkpl-p-mes">Mensual</label>
            <input type="radio" name="mkpl-periodo" id="mkpl-p-anual" />
            <label htmlFor="mkpl-p-anual">Anual<b>{MESES_GRATIS_ANUAL} meses gratis</b></label>
          </div>
        </div>
      )}
      <div className="mkpl-grilla">
      {planes.map((p) => {
        // El mismo botón en /planes y en la landing: «Empezar» sólo con un cobro detrás; sin pasarela, «Quiero …» y se pide.
        const boton = botonDelPlan({ id: p.id, nombre: p.nombre, cobrable: p.cobrable, sufijo });
        const borde = `mkpl-btn${p.destacado ? '' : ' borde'}`;
        const pesos = precioEnPesos(p);
        const lista = listaCorta(p.capa);
        // El rótulo de la tarjeta es el NOMBRE del plan y no `CEJA_SOFTWARE` (14/11/2026): desde que cada columna dice cómo se
        // trabaja en su propia ceja («Lo haces tú, con MaKo al lado» / «MaKo lo hace, tú apruebas»), una etiqueta común para
        // las dos le decía a quien usa un lector de pantalla lo contrario de lo que la columna de Pro dice.
        return (
          <section key={p.id} className={`mkpl-card${p.destacado ? ' destacado' : ''}`} aria-label={p.nombre}>
            {p.destacado && <span className="mkpl-insignia">Recomendado</span>}
            <h3>{p.nombre}</h3>
            <p className="mkpl-resumen">{p.resumen}</p>
            <div className="mkpl-r-precio">
              <div className="mkpl-mes">
                <div className="mkpl-precio">US$ {precio(p.precioUsd)} <small>/ mes</small></div>
                {pesos && <div className="mkpl-bajo">o {formatoMonto(pesos, 'ARS')} por mes</div>}
                {promoVigente && PROMO_ENTRADA.planes.includes(p.id) && (
                  <div className="mkpl-primer-mes"><b>Tu primer mes: US$ {textoUsd(precioPrimerMes(p.precioUsd))}</b> Después, el precio de siempre.</div>
                )}
              </div>
              {conAnual && p.precioAnualUsd && <div className="mkpl-anual"><div className="mkpl-precio">US$ {precio(p.precioAnualUsd)} <small>/ año</small></div></div>}
              <span className={`mkpl-bajo${planConPrueba(p.id) ? ' gratis' : ''}`}>{bajoElPrecio(p)}</span>
            </div>
            <div className="mkpl-r-boton">
              <a className={`${borde} mkpl-mes${p.cobrable && planConPrueba(p.id) ? ' prueba' : ''}`} href={boton.href}>{boton.texto}</a>
              {conAnual && p.precioAnualUsd && <a className={`${borde} mkpl-anual`} href={botonAnualDelPlan({ id: p.id, sufijo }).href}>{botonAnualDelPlan({ id: p.id, sufijo }).texto}</a>}
            </div>
            <div>
              {/* Los MaKo Tokens del plan y los topes, ARRIBA de los checks y fuera de ellos (ver `listaCorta`). Sin cupo
                  decidido para esa capa, no se dice nada: nunca un número inventado. */}
              {lista.tokens && <p className="mkpl-tokens"><b>{lista.tokens.split(' ')[0]}</b> {lista.tokens.split(' ').slice(1).join(' ')}</p>}
              {lista.topes.length > 0 && <div className="mkpl-topes">{lista.topes.map((t) => <span key={t}>{t}</span>)}</div>}
              <p className="mkpl-lista-t">{lista.titulo}</p>
              <ul className="mkpl-lista">
                {lista.items.map((x) => (
                  <li key={x.fuerte ?? x.texto}><span>{x.fuerte ? <b>{x.fuerte}</b> : null}{x.texto}</span></li>
                ))}
              </ul>
            </div>
          </section>
        );
      })}
      <section className="mkpl-card mkpl-programa" data-tema-fijo="" aria-label={CEJA_PROGRAMA}>
        <span className="mkpl-insignia">Con acompañamiento</span>
        <h3>{pr.nombre}</h3>
        {pr.promesa ? <p className="mkpl-resumen"><b>Nuestra promesa:</b> {pr.promesa}</p> : <p className="mkpl-resumen">{pr.resumen}</p>}
        <div className="mkpl-r-precio">
          <div className="mkpl-precio">US$ {precio(pr.precioUsd)}</div>
          <span className="mkpl-bajo">en {pr.cuotas} cuotas de US$ {precio(Math.round(pr.precioUsd / pr.cuotas))}</span>
        </div>
        <div className="mkpl-r-boton">
          {/* AGENDAR LA LLAMADA, SÓLO ACÁ (14/11/2026, Martín: «lo de agendar llamadas sí debería estar todavía para el tema de
              Accelerator… Pero en ningún otro lado debería estar»). Es la agenda de Martín, fuera del sitio: se abre en otra
              pestaña (`AGENDA_ACELERADOR`). Esencial y Pro siguen con su botón de siempre, que compra sin hablar con nadie. */}
          <a className="mkpl-btn" href={AGENDA_ACELERADOR} target="_blank" rel="noopener noreferrer">{TEXTO_AGENDA_ACELERADOR}</a>
          {pr.garantia && <a className="mkpl-garantia" href="/reembolsos#grupal">Con garantía de entrega</a>}
        </div>
        <div>
          {/* Sin «Todo lo de MaKo Pro, más:» (14/11/2026): MaKo Pro es el primer check (`LISTA_PROGRAMA`) y esta columna
              también se lee sola. La ceja dice cómo se trabaja, como en las otras dos. */}
          <p className="mkpl-lista-t">{CEJA_PROGRAMA}</p>
          <ul className="mkpl-lista">{LISTA_PROGRAMA.map((x) => <li key={x}><span>{x}</span></li>)}</ul>
        </div>
      </section>
      </div>
    </div>
  );
}
