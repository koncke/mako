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
// con Mercado Pago. ⚠️ 15/11/2026: la tarjeta YA NO MUESTRA el precio en pesos (Martín: «No pongas la conversión en pesos
// argentinos. Eso ya cada uno luego lo ve»). `precioEnPesos` sigue en lib/planes-mako.ts y lo usa el checkout, que es donde
// se cobra; lo que se fue de acá es el renglón «o $ 73.555 ARS por mes», que competía con el precio en dólares.
//
// EL REDISEÑO DEL 12/11/2026 (Martín: «rediseñes los tres bloques de los planes… tienen muchos ítems y puedes fijarte cómo lo
// hace el diseño de otras aplicaciones»). COPIADO DE beehiiv (beehiiv.com/pricing, mirada el 12/11/2026, la misma referencia
// del sitio): tarjetas blancas iguales, el nombre y su frase, el precio grande con su nota chica, UN botón a todo el ancho con
// una nota debajo (su «No credit card required»: aquí, cuándo se paga), una raya y la lista corta, con «Todo lo de Essential,
// más:» en la del medio. Lo que un plan NO trae ya no va en la tarjeta (eran 8 renglones con ✗): lo dice la comparación.
// La insignia («Recomendado», «Con acompañamiento») arriba a la derecha, negra, como su «Most Popular». El Accelerator deja de
// ser un bloque oscuro: el sol y la luna del sitio llevan la página entera a un solo modo (app/vsl/_competencia/TemaSitio.tsx),
// y un bloque negro en el modo claro es lo que Martín pidió sacar. Se distingue por su insignia y su botón negro.
// LA PRUEBA, SÓLO EN PRO (12/11/2026): `planConPrueba` (lib/planes-mako.ts). Essential dice que se paga hoy.
// LA TERCERA VUELTA (12/11/2026, noche, Martín: «no pongas tanto texto… los botones… todos tienen que estar alineados… me
// gustaban los colores de las tarjetas anteriores, el Accelerator estaba negro»): listas cortas (`listaCorta`), sin notas debajo
// de los botones ni la línea de pagos, filas comunes con subgrid y los colores de antes (el azul de Pro, el Accelerator grafito).
// =============================================================================

import type { ReactNode } from 'react';
import { ASESORIAS_DEL_PROGRAMA, LISTA_DEL_ACELERADOR, MESES_GRATIS_ANUAL, NOMBRE_PLAN_CON_PRUEBA, PROGRAMA_ACELERADOR, PRUEBA_DIAS, PRUEBA_GRATIS_PRENDIDA, planConPrueba, type PlanMako } from '@/lib/planes-mako';
import { TOPES } from '@/lib/topes-plan';
import { PLAN_DE_CAPA, cupoDeCapa } from '@/lib/mako-tokens-reglas';
import { ATRIBUTO_ALCANZA, ATRIBUTO_MT, generaVideoLaCapa, htmlAlcanza } from './CalculadoraTokens';
import { SIGNO_NO, SIGNO_SI, SIGNO_SI_DORADO } from './signos';
import { ASESORES } from '@/lib/asesores/catalogo';
// Los topes de generación (15/11/2026): cuánto video y cuántas imágenes trae el plan. Viven con el precio del clip
// porque lo que los fija es el margen, no un límite de la app (lib/mako-tokens-paquetes.ts).
import { botonAnualDelPlan, botonDelPlan } from '@/lib/compra-plan-reglas';
import { PROMO_ENTRADA, precioPrimerMes, textoUsd } from '@/lib/promo-entrada-reglas';

/** Un plan como lo dibujan las tarjetas, con si se cobra en línea. La capa dice lo que NO trae (la comparación). */
export type PlanEnTarjeta = Pick<PlanMako, 'id' | 'nombre' | 'capa' | 'precioUsd' | 'resumen' | 'incluye' | 'destacado' | 'precioAnualUsd' | 'preciosLocales'> & { cobrable: boolean };

export const TEXTO_PAGOS = 'Desde Argentina pagas en pesos, con Mercado Pago.';
/** La línea de la prueba, para quien la necesite fuera de las tarjetas (las tarjetas ya no la repiten abajo). */
export const TEXTO_PRUEBA = PRUEBA_GRATIS_PRENDIDA
  ? `${NOMBRE_PLAN_CON_PRUEBA} empieza con ${PRUEBA_DIAS} días gratis: si te das de baja antes del día ${PRUEBA_DIAS + 1}, no se te cobra nada.`
  : 'Pagas al empezar y te das de baja cuando quieras.';

/** `CEJA_SOFTWARE` ya no la dibuja la tarjeta: cada columna dice cómo se trabaja en su propia ceja (`listaCorta`). Queda para
 *  quien la cite fuera de acá. `CEJA_PROGRAMA` sí: es la ceja de la lista del Accelerator y el rótulo de su tarjeta. */
export const CEJA_SOFTWARE = 'Lo haces tú, con MaKo';
export const CEJA_PROGRAMA = 'Lo armamos contigo';

/**
 * EL TÍTULO DE LA LISTA DE CADA COLUMNA: «Incluye», en las tres (15/11/2026).
 *
 * Eran «Lo haces tú, con MaKo al lado» y «MaKo lo hace, tú apruebas» (y «Lo armamos contigo» en el Accelerator): decían
 * CÓMO se trabaja en cada plan. Martín, mirando /planes: «no veo que hayas cambiado los textos que están, lo haces tú, MaKo
 * al lado, MaKo lo hace tú apruebas. O sea, todo eso habíamos quedado que debería haber cambiado» — es el «lenguaje
 * nuestro» que pidió sacar de las columnas («eso debería entenderse muy fácilmente. No con lenguaje nuestro»).
 * ⚠️ NO ES «TODO LO DE ESENCIAL, MÁS»: eso lo rechazó el 14/11 («la idea es que cada uno se sienta único»). «Incluye» no
 * nombra a la otra columna, y el «para quién» ya lo dice la frase de arriba de cada una.
 */
export const CEJA_LISTA = 'Incluye';

const n = (v: number | null) => (v == null ? 'ilimitados' : v.toLocaleString('es-AR'));
/** «1 landing» / «3 landings»: el número con su palabra (los topes cambian; el plural, solo). */
const nn = (v: number | null, uno: string, varios: string) => `${n(v)} ${v === 1 ? uno : varios}`;

/**
 * Un renglón de la lista. `fuerte` es el arranque en negrita y `texto` lo que le sigue: la NEGRITA SELECTIVA de ClickFunnels
 * (clickfunnels.com/pricing, mirada el 14/11/2026), el truco más copiable de las siete páginas que se relevaron. Sin `fuerte`,
 * el renglón va plano.
 */
export type ItemLista = { fuerte?: string; texto: string };

/**
 * Lo que dibuja la lista de una columna: la ceja, los MaKo Tokens y los checks.
 *
 * ⚠️ LOS TOPES YA NO SON UNA FILA APARTE (15/11/2026). Martín, textual: «en la columna de los planes, sí está bien que
 * tenga la cantidad de MaKo Tokens al mes, pero todo lo que está abajo debería ir como checks. No debería ir ahí arriba.
 * Todo al lado de otro, 2000 leads, un pipeline, una página. O de última no debería ir directamente».
 *
 * Había un campo `topes: string[]` que se dibujaba en dos renglones grises, en chico, con los números separados por
 * puntos medios: «2.000 leads · 1 pipeline · 1 página · 1 WhatsApp · 2 automatizaciones». Ese formato vino del molde de
 * Kajabi el 14/11 y la razón era buena — sacar los números de adentro de los bullets — pero el resultado es una línea
 * que nadie lee: siete cifras pegadas, en el tamaño más chico de la tarjeta, arriba de la lista que sí se lee.
 * Ahora cada tope que vale la pena comparar es UN CHECK, en una frase entera; los demás se fueron a la comparación de
 * planes, que existe para eso. Y lo que queda arriba es sólo los MaKo Tokens, que es lo que Martín dijo que sí va.
 */
export type ListaDeColumna = {
  /** La ceja arriba de los checks: CÓMO se trabaja en ese plan. Reemplaza al «Todo lo de Essential, más:» de antes. */
  titulo: string;
  /** Los MaKo Tokens que trae por mes, ya escrito. null = no hay dato decidido para esa capa y NO se inventa uno. */
  tokens: string | null;
  items: ItemLista[];
  /**
   * LO QUE ESE PLAN NO HACE, con una ✗ roja (15/11/2026, a la noche). Sólo el de US$47 lo lleva. Martín: «para una persona que
   * lo mira no entiende mucho la diferencia entre el de 47 y el de 97… en el de 47 hay un montón de cosas que no se pueden
   * hacer directamente, que en el de 97 sí». Va en el MISMO orden que los primeros checks de Pro, así que leídas una al lado
   * de la otra, cada ✗ de la izquierda queda frente a su ✓ de la derecha.
   */
  noIncluye?: ItemLista[];
};

/** El título del bloque de lo que el plan no trae. */
export const CEJA_NO_INCLUYE = 'No incluye';

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
 *     renglones de Essential eran cifras: la columna barata se leía como una lista de lo que no te alcanza, que empuja a Pro
 *     pero no vende Essential — y Essential igual hay que venderlo.
 *   · **TODA LA NEGRITA EN PRO, NINGUNA EN ESENCIAL** (ClickFunnels). La columna barata queda visualmente plana sin que le
 *     falte un renglón: no se le puede acusar de esconder nada, y aun así no engancha el ojo.
 *   · **EL BULLET #1 DE PRO ES EL QUE MÁS DUELE, no el más grande** (beehiiv): copiar la landing del competidor, con el dominio
 *     propio pegado ahí. El dominio es la palanca de la marca ajena, la más barata del rubro, y estaba escondida en un renglón
 *     compartido («Comunidad y dominio propio»).
 *   · **PRO NO TIENE MENOS RENGLONES QUE ESENCIAL** (Kajabi 5/6/4, beehiiv 6/6/8/7: la recomendada tiene MÁS). Si hay que
 *     desempatar, el que suma uno es Pro, nunca Essential.
 *
 * ⚠️ ESTE ES EL ÚNICO LUGAR QUE SE VE. `PLANES_MAKO_DEFAULT[].incluye` (lib/planes-mako.ts) NO lo lee nadie desde el rediseño
 *    del 12/11 (la tarjeta dibuja esto, y el checkout tiene su propia entrada, `INCLUYE_EN_EL_CHECKOUT`): escribir el cambio
 *    allá es escribirlo donde no se muestra. Está en el §1.4 del relevo.
 * ⚠️ LOS NÚMEROS SALEN DEL CÓDIGO, nunca escritos a mano: los topes de lib/topes-plan.ts y el cupo de MaKo Tokens de
 *    lib/mako-tokens-reglas.ts (`cupoDeCapa`). Así la vitrina no puede prometer lo que el producto frena.
 * ⚠️ Y DEPENDE DE LA CAPA, NO DEL id: un plan nuevo del setting `planes.mako` con capa `agencia` dice lo de Pro sin tocar
 *    código. Lo que NO se puede es diferenciar dos planes de la misma capa (§1.5 del relevo).
 * ⚠️ EL AVATAR DE IA NO VA EN NINGUNA COLUMNA aunque ya sea de Pro (`FUNCIONES_SOLO_PRO`, 'ai-avatar'): no se vende hasta que
 *    ande de punta a punta (`AI_AVATAR_SE_VENDE`, lib/planes-comparacion.ts). Cerrarlo en Essential y venderlo son dos cosas.
 */
export function listaCorta(capa: string): ListaDeColumna {
  // ⚠️ EL COPY DE ESTAS DOS LISTAS ES EL DE «COMPARA LOS PLANES» (15/11/2026, más tarde). Martín: «me gustaría reducir bastante
  //    el texto… hay muchas cosas redundantes. Me gustaría que sea un poco como lo que está en Compara los planes, que es simple.
  //    Una sola palabra o muy poquitas palabras que se entienda… como por ejemplo como Canva y CapCut. No, eso no es necesario
  //    aclararlo». Antes cada renglón era una frase con su explicación («Copia la página de venta de cualquier competidor, con
  //    tu oferta y en tu dominio»); ahora es el NOMBRE de la cosa, el mismo de la fila de la tabla de abajo, y el detalle queda
  //    en la tabla, que existe para eso.
  // Las reglas que lo arman, para el que lo toque:
  //   · LAS PALABRAS DE LA TABLA (lib/planes-comparacion.ts): «Copiar landings de la competencia», «Setter con IA», «Análisis de
  //     llamadas», «Copywriting con IA». Así un renglón de la columna se encuentra abajo con el mismo nombre. La jerga de
  //     marketing está permitida desde el 14/11 (Martín); la de nuestra cocina, no (tests/planes-tres-bloques.test.ts).
  //   · NADA QUE YA DIGA EL BLOQUE DE LOS MaKo TOKENS: el video con IA se fue de los checks (y de la ✗ de Essential) porque
  //     arriba ya dice «26 clips de video con IA» en Pro y «0 clips», tachado, en Essential. Repetirlo era la redundancia.
  //   · EL DE US$47 DICE LO QUE NO HACE, con una ✗ (`noIncluye`), con las MISMAS palabras y en el MISMO ORDEN que los primeros
  //     checks de Pro: leídas en paralelo, cada ✗ queda frente a su ✓.
  //   · Ni Essential dice «todo lo de X» ni Pro «todo lo de Essential, más» (Martín, 14/11: «la idea es que cada uno se sienta
  //     único»). La negrita es de Pro y de nadie más (ClickFunnels): en Pro va en negrita el nombre de la cosa.
  //   · LOS NÚMEROS SALEN DEL CÓDIGO (`TOPES`, `ASESORES`), nunca a mano, y lo «ilimitado» de Pro también: sólo se dice de lo que
  //     el código no topa. «Ilimitado» y nunca «sin tope» (Martín, 15/11: «lo eliminaría de todos lados»). Los MaKo Tokens no están acá: son el primer ítem de la lista y los dibuja la columna.
  //   · Lo que NO se dice: el avatar, que no se vende todavía; y «subtítulos» como cosa de Pro (corren en el navegador y están en
  //     los dos planes, lib/planes-comparacion.ts, 'ia-editores'). Lo de Pro es la edición de videos CON IA.
  const c = TOPES.completo, a = TOPES.agencia;
  if (capa === 'agencia') {
    const sinTopeEnPro = ([['crm.leads', 'Contactos'], ['web.landings_publicadas', 'landings']] as const)
      .filter(([k]) => a[k] == null).map(([, nombre]) => nombre);
    return {
      titulo: CEJA_LISTA,
      tokens: tokensDeLaCapa(capa),
      items: [
        { fuerte: 'Copiar landings', texto: ' de la competencia' },
        { fuerte: 'Edición de videos', texto: ' con IA' },
        { fuerte: 'Setter con IA', texto: '' },
        { fuerte: 'Piloto automático', texto: ' de ads y redes' },
        { fuerte: 'Análisis de llamadas', texto: '' },
        // 15/11/2026, ~23:20 (Martín aprobó la propuesta para achicar): el chat con los referentes y la comunidad para alumnos
        // siguen en la tabla de abajo; acá, lo que más pesa.
        ...(sinTopeEnPro.length ? [{ fuerte: sinTopeEnPro.join(' y '), texto: ' ilimitados' }] : []),
        { fuerte: `${nn(a['chats.lineas_whatsapp'], 'WhatsApp', 'WhatsApp')} y ${nn(a['equipo.usuarios'], 'usuario', 'usuarios')}`, texto: '' },
      ],
    };
  }
  return {
    titulo: CEJA_LISTA,
    tokens: tokensDeLaCapa(capa),
    items: [
      { texto: `CRM con ${n(c['crm.leads'])} contactos` },
      { texto: nn(c['web.landings_publicadas'], 'landing', 'landings') },
      { texto: nn(c['chats.lineas_whatsapp'], 'WhatsApp', 'WhatsApp') },
      { texto: 'Copywriting con IA' },
      { texto: 'Editor de imágenes y video' },
      // 15/11/2026, ~23:20: las automatizaciones y los usuarios siguen en la tabla de abajo (la propuesta para achicar, aprobada).
    ],
    // CON LAS MISMAS PALABRAS Y EN EL MISMO ORDEN QUE LOS PRIMEROS CHECKS DE PRO (ver arriba): cada ✗ de acá tiene su ✓ enfrente.
    noIncluye: [
      { texto: 'Copiar landings de la competencia' },
      { texto: 'Edición de videos con IA' },
      { texto: 'Setter con IA' },
      { texto: 'Piloto automático de ads y redes' },
    ],
  };
}

/**
 * LOS MaKo TOKENS DE CADA COLUMNA (14/11/2026; Martín: «yo le di feedback a la tab de precios sobre MaKo Tokens, que debería
 * estar arriba de las columnas, etc.», y lo anotado: «con los tokens de cada plan y el costo real por acción»,
 * docs/relevo/landings-vsl.md:425-426). Hasta hoy NINGUNA columna decía cuántos trae.
 *
 * ⚠️ El cupo sale de `cupoDeCapa` (lib/mako-tokens-reglas.ts), que es donde vive CUPO_MENSUAL y el mapeo de la capa al nivel y
 *    por qué: los niveles se llaman 'free' | 'pro' | 'growth' y **no son los planes** — el llamado `pro` es el de US$47
 *    (Essential) y `growth` el de US$97 (MaKo Pro). Leerlos por el nombre pone el cupo cruzado.
 * ⚠️ SIN DATO, NO DICE NADA: el Accelerator no tiene cupo decidido, así que su columna no habla de tokens (null). Nunca un
 *    número inventado en la vitrina.
 */
export function tokensDeLaCapa(capa: string): string | null {
  const mt = cupoDeCapa(capa);
  return mt == null ? null : `${mt.toLocaleString('es-AR')} MaKo Tokens al mes`;
}

/**
 * LA LISTA DEL ACELERADOR, con el copy de Martín (15/11/2026, a la noche): «el primer ítem debería ser justamente 3 meses de
 * acompañamiento personalizado»; «tu sistema de adquisición de clientes armado por nuestro equipo: tu funnel, tu landing, tu
 * CRM, tus automatizaciones y tu sistema de contenido. Y no hace falta que aclares lo de las 10 horas»; «una asesoría en vivo
 * por semana»; «en lugar de un grupo de WhatsApp… una comunidad de empresarios»; «el WhatsApp personal de Martín Koncke para
 * responder dudas»; y las 3 sesiones 1 a 1 de 2 horas («no tengo problema en brindarlo»). El encuentro presencial en Buenos
 * Aires cada 3 meses entró y salió la misma noche: «quita lo del encuentro presencial… Por ahora no lo vamos a incluir».
 *
 * Es lo que hace que la columna se lea como ACOMPAÑAMIENTO y no como un plan más: antes empezaba por el software («MaKo Pro
 * completo») y eso decía «esto es MaKo, más algo». El software va al final.
 * ⚠️ El detalle que es CONTRATO (las horas de la primera semana, que la asesoría semanal es grupal) vive en
 * `PROGRAMA_ACELERADOR.incluye` (lib/planes-mako.ts), que es lo que leen el checkout y /reembolsos. Las dos listas dicen las
 * mismas cosas; la de acá, corta.
 */
// 15/11/2026, ~21:00, lo que decidió Martín: «o quitamos todo o dejamos como está» (la lista ENTERA, nada de un resumen); el
// sistema lo arma ÉL («todavía no tengo equipo… se nota más personalizado todavía»), y de lo que traen los programas high ticket
// (docs/acelerador-que-incluyen-los-high-ticket.md) sumó todo menos lo que necesita un equipo: el tablero de resultados, la
// asesoría abierta a SU equipo, la hoja de ruta que arma MaKo y aprueba él, las presentaciones en la comunidad y los expertos
// invitados («no lo aclararía que sea por mes»).
// 15/11/2026, ~21:30: la lista sale de lib/planes-mako.ts (`LISTA_DEL_ACELERADOR`), CORTA, y la tabla de abajo usa la misma.
export const LISTA_PROGRAMA: readonly ItemLista[] = LISTA_DEL_ACELERADOR.filter((x) => x.enTarjeta).map(({ fuerte, texto }) => ({ fuerte, texto }));

/**
 * AGENDAR LA LLAMADA DEL ACELERADOR (14/11/2026). Martín, textual: «lo de agendar llamadas sí debería estar todavía para el
 * tema de Accelerator. Ahí debería haber la agenda de llamada. **Pero en ningún otro lado debería estar.**»
 *
 * ⚠️ ES LA ÚNICA EXCEPCIÓN A LA REGLA DEL 12/11/2026 («ningún lado debería estar agendar llamadas, solamente iniciar la prueba
 *    gratuita»), que sigue valiendo para todo lo demás: las landings y el sitio llevan a /planes con `TEXTO_CTA`
 *    (app/vsl/_competencia/cta.ts), y Essential y Pro se compran sin hablar con nadie. El Accelerator no: se vende por llamada,
 *    como el «hablar con ventas» del tercer bloque de cualquier SaaS, y en esa llamada se ofrece el programa
 *    (docs/vsl/README.md). Si aparece un «Agenda tu llamada» en otra pantalla, es un error: se saca.
 * Es la agenda de MARTÍN, no la de un cliente (en el repo hay otros Calendly que son de Mauricio: no son éste).
 */
export const AGENDA_ACELERADOR = 'https://calendly.com/koncke/asesoria';
export const TEXTO_AGENDA_ACELERADOR = 'Agenda tu llamada';
/**
 * EL BOTÓN DE LA COLUMNA DEL ACCELERATOR (15/11/2026, ~21:00). Martín: «en lugar de que diga agenda tu llamada, el botón de MaKo
 * Accelerator… que diga… más información, justamente para que ellos puedan irse para allá», a la landing del programa
 * (/accelerator, con su VSL). La llamada se pide DESDE la landing, por el pedido de /planes/accelerator (el diagnóstico de 2
 * minutos y el pedido en el CRM con su origen), así que /planes ya no ofrece agendar en ningún lado.
 */
export const RUTA_ACCELERATOR = '/accelerator';
// En MAYÚSCULA como los otros dos botones («PRUÉBALO GRATIS AHORA»): Martín, 15/11, «tienes que poner más información todo en mayúscula».
export const TEXTO_BOTON_ACCELERATOR = 'MÁS INFORMACIÓN';

/** Debajo del precio, una sola cosa: los días gratis, que se paga hoy, o las cuotas. */
export function bajoElPrecio(p: { id: string }): string {
  return planConPrueba(p.id) ? `${PRUEBA_DIAS} días gratis` : 'Se paga al empezar';
}

export const CSS_TARJETAS = `
/* LOS BOTONES ALINEADOS (12/11/2026, Martín: «todos tienen que estar alineados… no puede estar uno más arriba, otro más abajo»):
   cada tarjeta tiene las MISMAS filas (nombre, frase, precio, botón, lista) y con subgrid el alto de cada fila lo pone la más
   alta de las tres. Los colores, los de antes (Martín: «me gustaban los colores… el Accelerator estaba negro»). */
.mkpl-grilla { display: grid; gap: 18px; grid-template-columns: repeat(3, minmax(0, 1fr)); grid-template-rows: repeat(4, auto); padding-top: 14px; align-items: stretch; text-align: left; }
.mkpl-card { position: relative; display: grid; grid-row: span 4; grid-template-rows: subgrid; row-gap: 0; background: #FFFFFF; color: #12151B;
  border: 1px solid #E6EAF2; border-radius: 20px; padding: 26px 24px 24px; box-shadow: 0 1px 2px rgba(18,21,27,.04), 0 10px 28px rgba(18,21,27,.06); }
/* LA LUZ DE LA ESQUINA, EN AZUL (15/11/2026, Martín: «en MaKo Accelerator hay como una lucecita amarilla arriba a la derecha. Me
   gustaría que la misma lucecita azul esté en el MaKo Pro de 97»). La MISMA que la del Accelerator (.mkpl-programa): el mismo
   óvalo en la misma esquina, con el azul de la casa en lugar del dorado. El sol y la luna la dejan como está: es un tono medio
   (TemaSitio sólo da vuelta los muy claros y los muy oscuros), así que en el modo oscuro queda la luz azul sobre la tarjeta negra. */
.mkpl-card.destacado { border-color: #2F6FED; box-shadow: 0 0 0 1px #2F6FED, 0 16px 40px rgba(47,111,237,.18);
  background: radial-gradient(700px 320px at 100% 0%, rgba(47,111,237,.14), transparent 60%), #FFFFFF; }
.mkpl-insignia { position: absolute; top: -13px; left: 24px; background: #2F6FED; color: #fff; font-size: 12px; font-weight: 700;
  letter-spacing: .03em; padding: 5px 12px; border-radius: 999px; }
.mkpl-card h3 { margin: 0 0 10px; font-size: 22px; line-height: 1.2; font-weight: 800; letter-spacing: -.01em; color: inherit; }
/* «flex-start» y no «flex-end» (15/11/2026): con el precio pegado al nombre, el sobrante del subgrid cae abajo. */
.mkpl-r-precio { display: flex; flex-direction: column; justify-content: flex-start; gap: 6px; }
.mkpl-precio { font-size: 40px; line-height: 1; font-weight: 800; letter-spacing: -.03em; }
.mkpl-precio small { font-size: 15px; font-weight: 500; letter-spacing: 0; color: #5B6472; }
.mkpl-bajo { font-size: 13px; font-weight: 600; color: #5B6472; }
/* La aclaración del total cuando la barra de MaKo Tokens pide más de lo que trae el plan. Nace oculta (hidden) y la
   muestra el script: sin él no hay nada que aclarar. */
/* ⚠️ LA PASTILLA VERDE LLEVA «data-tema-fijo» EN EL JSX, Y ÉSTA ES LA RAZÓN (15/11/2026). Martín: «7 días gratis en el de
   47, lo pusiste en negro cuando estoy en white mode». Su texto y su fondo son un PAR — verde oscuro sobre verde pálido —
   y el sol y la luna del sitio (app/vsl/_competencia/TemaSitio.tsx) decide color por color, recorriendo el DOM y mirando la
   luz de lo que cada elemento tiene detrás. Las dos tarjetas no tienen el mismo fondo (la de Pro es la destacada), así que
   para el MISMO CSS tomó decisiones distintas. Medido en producción el 15/11 en modo claro:
     · MaKo Essential → texto rgb(31,122,77) sobre fondo rgb(26,23,18): verde sobre NEGRO.
     · MaKo Pro      → texto rgb(18,21,27) sobre fondo rgb(227,245,235): negro sobre verde.
   O sea: en una invirtió el fondo y en la otra el texto. Un par de colores apareados no se puede decidir por separado, y la
   cura no es elegir otro verde: es sacarlo del recorrido. Lo mismo vale para cualquier pastilla que se agregue acá. */
.mkpl-bajo.gratis { align-self: flex-start; padding: 2px 10px; border-radius: 999px; background: #E3F5EB; color: #1F7A4D; font-weight: 800; }
.mkpl-r-boton { padding: 20px 0 22px; }
/* UN SOLO TAMAÑO DE BOTÓN para las tres columnas (15/11/2026): el grande, que era el de «.mkpl-btn.prueba». Esa clase ya
   no existe — agrandaba sólo los dos planes con prueba y dejaba el del Accelerator 11 px más bajo (medido en producción:
   62 px contra 51). El texto puede cortar a propósito: el CTA en mayúsculas es largo y en una columna angosta tiene que
   envolver, no desbordar. */
.mkpl-btn { display: block; text-align: center; background: #2F6FED; color: #fff !important; text-decoration: none;
  font-weight: 700; font-size: 17px; padding: 18px 20px; border-radius: 14px; box-shadow: 0 10px 26px rgba(47,111,237,.34);
  letter-spacing: .01em; line-height: 1.25; transition: filter .15s ease; }
.mkpl-btn:hover { filter: brightness(1.06); }
.mkpl-btn.borde { background: #fff; color: #2F6FED !important; box-shadow: inset 0 0 0 1.5px #2F6FED; }
.mkpl-lista-t { margin: 0 0 10px; font-size: 14px; font-weight: 700; }
/* LOS NÚMEROS, FUERA DE LOS CHECKS (14/11/2026, el molde de Kajabi: «2.500 contacts included» en una línea sola, arriba del
   encabezado de la lista). Los MaKo Tokens del plan primero, con su número en negrita, y debajo los topes, en gris y chico: lo
   que el ojo compara antes de leer funciones. Los bullets quedan funciones puras. */
.mkpl-alcanza { list-style: none; margin: 6px 0 0; padding: 0; display: grid; gap: 2px; font-size: 13.5px; line-height: 1.45; color: #5B6472; }
/* «.mkpl-lista .mkpl-alcanza li» y no «.mkpl-alcanza li»: la regla de los checks (.mkpl-lista li, flex con 10 px de hueco y un
   tilde en ::before) viene DESPUÉS en esta hoja y con la misma especificidad, así que ganaba — el número y la palabra quedaban
   separados por 10 px y la «o» se leía como una viñeta. */
.mkpl-lista .mkpl-alcanza li { display: block; position: relative; padding-left: 14px; }
/* Una viñeta chica por renglón (no un tilde: el tilde es del ítem de arriba, «24.000 MaKo Tokens al mes:»). */
.mkpl-lista .mkpl-alcanza li::before { content: ""; position: absolute; left: 3px; top: .62em; width: 5px; height: 5px; border-radius: 50%; background: #9AA1AD; }
.mkpl-alcanza b { color: #12151B; font-weight: 700; }
/* El «0 clips de video con IA» del plan que no genera video: tachado y en rojo, en la misma línea que los clips del otro plan
   (Martín, 15/11: «0 clips de videos con IA o algo en rojo tipo tachado… para que sigan como el mismo alineamiento»). */
.mkpl-lista .mkpl-alcanza .mkpl-alcanza-sin { color: #D92D20; text-decoration: line-through; }
.mkpl-lista .mkpl-alcanza .mkpl-alcanza-sin b { color: #D92D20; }
.mkpl-lista .mkpl-alcanza .mkpl-alcanza-sin::before { background: #D92D20; }
/* «No incluye»: el mismo renglón que los checks, con una ✗ ROJA (Martín: «evidentemente las X las pondría en rojo»). */
.mkpl-lista-t-no { margin-top: 18px; }
.mkpl-lista-no li { color: #5B6472; }
/* La ✓ y la ✗ son las de app/planes/signos.ts: las MISMAS que las de la tabla de abajo, y dibujadas (no letras) para que queden en
   el medio del círculo en cualquier sistema. */
.mkpl-lista.mkpl-lista-no li::before { ${SIGNO_NO} }
/* «.mkpl-topes» se fue el 15/11/2026 con la fila de cifras que dibujaba (ver «ListaDeColumna»). La raya que separaba
   la cabeza de la lista la lleva ahora la línea de los MaKo Tokens, que es lo único que quedó arriba. */
.mkpl-lista { list-style: none; margin: 0; padding: 0; display: grid; gap: 10px; font-size: 14.5px; line-height: 1.4; }
.mkpl-lista li { display: flex; gap: 10px; align-items: flex-start; }
/* La negrita SELECTIVA (ClickFunnels): el arranque del renglón en negrita, lo que le sigue en peso normal. Sólo la lleva Pro. */
.mkpl-lista li b { font-weight: 700; color: #12151B; }
.mkpl-lista li::before { ${SIGNO_SI} }
/* El Accelerator, OSCURO para que se destaque (grafito #101319, el de la app, con el brillo dorado de su botón). No lo toca el sol
   y la luna (data-tema-fijo): es negro en los dos modos. */
.mkpl-programa { background: radial-gradient(700px 320px at 100% 0%, rgba(245,196,81,.14), transparent 60%), linear-gradient(160deg, #1C1F27 0%, #101319 100%);
  color: #F4F5F7; border-color: #2A2F3A; box-shadow: 0 22px 54px rgba(16,19,25,.34); }
.mkpl-programa .mkpl-insignia { background: #F5C451; color: #2A1E00; }
.mkpl-promesa { margin: 0 0 18px; font-size: 15px; line-height: 1.5; }
.mkpl-programa .mkpl-promesa, .mkpl-programa .mkpl-bajo, .mkpl-programa .mkpl-precio small { color: #C4C8D0; }
.mkpl-programa .mkpl-promesa b { color: #F5C451; }
.mkpl-programa .mkpl-btn { background: #F5C451; color: #2A1E00 !important; box-shadow: 0 8px 22px rgba(245,196,81,.28); }
.mkpl-programa .mkpl-lista li::before { ${SIGNO_SI_DORADO} }
/* La negrita de la lista va en BLANCO en el bloque oscuro (15/11/2026): la regla general (.mkpl-lista li b) la pinta #12151B para
   las columnas blancas, y desde que el Accelerator lleva cabezas en negrita («3 meses de acompañamiento personalizado»…) quedaban
   negras sobre negro — invisibles. Lo cazó la captura, no un test. */
.mkpl-programa .mkpl-lista li b { color: #FFFFFF; }
/* Mensual o anual: dos radios (escondidos) y sus etiquetas como un selector; :has() muestra los precios del que está
   elegido. Sin :has(), se ven los dos: nunca queda una tarjeta sin precio. */
/* Sin margen abajo: la barra de MaKo Tokens va pegada debajo (Martín, 15/11: «tampoco separaría tanto el mensual y anual de la
   barra»); lo que queda entre los dos es el lugar de la burbuja del precio. */
.mkpl-periodo { display: flex; justify-content: center; margin: 0; }
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

export function TarjetasPlanes({ planes, sufijo, promoVigente = false, barra }: {
  planes: readonly PlanEnTarjeta[]; sufijo: string;
  /**
   * La barra de MaKo Tokens (./CalculadoraTokens.tsx), que va DEBAJO del selector mensual / anual y arriba de las columnas.
   * Martín, 15/11/2026: «eliminaría el texto de calcula cuántos MaKo Tokens necesitas, pondría la barra directamente abajo de
   * mensual o anual». Entra por acá para que la portada, que dibuja las mismas columnas, no la arrastre.
   */
  barra?: ReactNode;
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
      {barra}
      <div className="mkpl-grilla">
      {planes.map((p) => {
        // El mismo botón en /planes y en la landing: «Empezar» sólo con un cobro detrás; sin pasarela, «Quiero …» y se pide.
        const boton = botonDelPlan({ id: p.id, nombre: p.nombre, cobrable: p.cobrable, sufijo });
        const borde = `mkpl-btn${p.destacado ? '' : ' borde'}`;
        const lista = listaCorta(p.capa);
        const cupo = cupoDeCapa(p.capa);
        // El rótulo de la tarjeta es el NOMBRE del plan y no `CEJA_SOFTWARE` (14/11/2026): desde que cada columna dice cómo se
        // trabaja en su propia ceja («Lo haces tú, con MaKo al lado» / «MaKo lo hace, tú apruebas»), una etiqueta común para
        // las dos le decía a quien usa un lector de pantalla lo contrario de lo que la columna de Pro dice.
        return (
          <section key={p.id} className={`mkpl-card${p.destacado ? ' destacado' : ''}`} aria-label={p.nombre}>
            {p.destacado && <span className="mkpl-insignia">Recomendado</span>}
            <h3>{p.nombre}</h3>
            {/* EL PRECIO ARRIBA Y LA FRASE ABAJO (15/11/2026). Martín: «no me gusta que haya un espacio muy blanco entre el
                precio y la frase anterior. De última deberías poner primero el precio y abajo todas las frases. O sea,
                primero el precio y el botón, por supuesto».
                EL HUECO NO ERA UN MARGEN: era el subgrid. Las tres tarjetas comparten las filas, así que la fila de la
                frase medía lo que la frase MÁS LARGA de las tres, y la del precio tenía `justify-content: flex-end` para
                pegarse abajo — o sea que en la tarjeta de frase corta quedaba el sobrante de la frase ajena, en blanco,
                justo arriba del precio. Poner el precio pegado al nombre lo borra sin tocar el subgrid: el sobrante cae
                ahora debajo del botón, donde está el texto que varía. */}
            <div className="mkpl-r-precio">
              <div className="mkpl-mes">
                {/* EL PRECIO QUE MUEVE LA BARRA DE ARRIBA (15/11/2026, Martín: «cuando yo haga el desplazable, se me
                    modifica el precio de las columnas. Es decir, por ejemplo, el de 97 o el de 47»). El servidor dibuja el
                    precio del plan; el script de la calculadora (app/planes/CalculadoraTokens.tsx) lo reescribe cuando la
                    barra pide más MaKo Tokens que los que trae ese plan, y pone debajo de qué está hecho el total.
                    Sin la barra en la página (la portada dibuja estas columnas sin ella) nadie lo toca y queda el del plan. */}
                {/* El precio NO lo mueve la barra (Martín, 15/11/2026, a la noche: «la idea no es que el precio de abajo se
                    modifique, sino que la barra deslizable diga el precio en dólares»). */}
                <div className="mkpl-precio">US$ {precio(p.precioUsd)} <small>/ mes</small></div>
                {/* SIN LA CONVERSIÓN A PESOS (15/11/2026, Martín: «No pongas la conversión en pesos argentinos. Eso ya cada
                    uno luego lo ve»). El precio en pesos sigue existiendo donde se COBRA — el checkout lo muestra con la
                    pasarela elegida — y acá competía con el precio en dólares, que es el que ancla. */}
                {promoVigente && PROMO_ENTRADA.planes.includes(p.id) && (
                  <div className="mkpl-primer-mes" data-tema-fijo=""><b>Tu primer mes: US$ {textoUsd(precioPrimerMes(p.precioUsd))}</b> Después, el precio de siempre.</div>
                )}
              </div>
              {conAnual && p.precioAnualUsd && <div className="mkpl-anual"><div className="mkpl-precio">US$ {precio(p.precioAnualUsd)} <small>/ año</small></div></div>}
              {/* data-tema-fijo: ver el porqué en `CSS_TARJETAS`, donde vive su color. Es una pastilla de dos colores
                  apareados y el sol y la luna los decide por separado: medido en producción el 15/11, quedó verde sobre
                  negro en el de US$47 y negro sobre verde en el de US$97. */}
              <span className={`mkpl-bajo${planConPrueba(p.id) ? ' gratis' : ''}`} data-tema-fijo={planConPrueba(p.id) ? '' : undefined}>{bajoElPrecio(p)}</span>
            </div>
            <div className="mkpl-r-boton">
              {/* TODOS LOS BOTONES DEL MISMO TAMAÑO (15/11/2026, Martín: «agendar tu llamada, el botón no es del mismo
                  tamaño que comienza tu prueba gratuita. Eso está mal»). La clase `prueba` agrandaba sólo los de los dos
                  planes con prueba (17 px y 18 de padding contra 15 y 14): medido en producción, 62 px de alto contra 51 del
                  Accelerator. Ya no existe: el tamaño grande es el de `.mkpl-btn`, para los tres. */}
              <a className={`${borde} mkpl-mes`} href={boton.href}>{boton.texto}</a>
              {conAnual && p.precioAnualUsd && <a className={`${borde} mkpl-anual`} href={botonAnualDelPlan({ id: p.id, sufijo }).href}>{botonAnualDelPlan({ id: p.id, sufijo }).texto}</a>}
            </div>
            <div>
              <p className="mkpl-lista-t">{lista.titulo}</p>
              <ul className="mkpl-lista">
                {/* LOS MaKo TOKENS SON EL PRIMER ÍTEM DE «INCLUYE», con lo que alcanzan en renglones debajo (15/11/2026). Martín:
                    «debería ser un diseño similar a lo de incluye, e incluso debería estar ahí en unos ítems de incluye»; y
                    después, «cuando voy ajustando la barra, cambie también la cantidad de cosas que me alcanzan y tokens abajo en
                    los planes». Por eso las dos cosas llevan su marca: la barra de arriba las mueve (los del plan MÁS los extra).
                    Los renglones los arma `htmlAlcanza`, la misma función que usa la barra. Sin cupo (el Accelerator), nada. */}
                {cupo != null && (
                  <li className="mkpl-li-tokens">
                    <span>
                      <b><span {...{ [ATRIBUTO_MT]: p.id }}>{cupo.toLocaleString('es-AR')}</span> MaKo Tokens al mes:</b>
                      <ul className="mkpl-alcanza" {...{ [ATRIBUTO_ALCANZA]: p.id }}
                        dangerouslySetInnerHTML={{ __html: htmlAlcanza(cupo, generaVideoLaCapa(p.capa)) }} />
                    </span>
                  </li>
                )}
                {lista.items.map((x) => (
                  <li key={x.fuerte ?? x.texto}><span>{x.fuerte ? <b>{x.fuerte}</b> : null}{x.texto}</span></li>
                ))}
              </ul>
              {lista.noIncluye && lista.noIncluye.length > 0 && (
                <>
                  <p className="mkpl-lista-t mkpl-lista-t-no">{CEJA_NO_INCLUYE}</p>
                  <ul className="mkpl-lista mkpl-lista-no">
                    {lista.noIncluye.map((x) => <li key={x.texto}><span>{x.texto}</span></li>)}
                  </ul>
                </>
              )}
            </div>
          </section>
        );
      })}
      <section className="mkpl-card mkpl-programa" data-tema-fijo="" aria-label={CEJA_PROGRAMA}>
        <span className="mkpl-insignia">Con acompañamiento</span>
        <h3>{pr.nombre}</h3>
        {/* El mismo orden que las otras dos columnas (15/11/2026): precio, botón, y la promesa debajo. */}
        <div className="mkpl-r-precio">
          <div className="mkpl-precio">US$ {precio(pr.precioUsd)}</div>
          <span className="mkpl-bajo">en {pr.cuotas} cuotas de US$ {precio(Math.round(pr.precioUsd / pr.cuotas))}</span>
        </div>
        <div className="mkpl-r-boton">
          {/* AGENDAR LA LLAMADA, SÓLO ACÁ (14/11/2026, Martín: «lo de agendar llamadas sí debería estar todavía para el tema de
              Accelerator… Pero en ningún otro lado debería estar»). Es la agenda de Martín, fuera del sitio: se abre en otra
              pestaña (`AGENDA_ACELERADOR`). Essential y Pro siguen con su botón de siempre, que compra sin hablar con nadie. */}
          <a className="mkpl-btn" href={RUTA_ACCELERATOR}>{TEXTO_BOTON_ACCELERATOR}</a>
        </div>
        {/* SIN EL «PARA QUIÉN» (15/11/2026, a la noche). Martín: «tampoco me gusta el texto de para quién vende solo o para quién
            ya vende y tiene equipo. Ese texto elimínalo». Se fue de las tres columnas, y con él la fila del subgrid: ahora son
            cuatro (nombre, precio, botón, lista). La promesa del Accelerator abre su lista: ahí no comparte alto con nadie. */}
        <div>
          {pr.promesa && <p className="mkpl-promesa"><b>Nuestra promesa:</b> {pr.promesa}</p>}
          {/* Sin «Todo lo de MaKo Pro, más:» (14/11/2026): MaKo Pro es el primer check (`LISTA_PROGRAMA`) y esta columna
              también se lee sola. La ceja dice cómo se trabaja, como en las otras dos. */}
          <p className="mkpl-lista-t">{CEJA_LISTA}</p>
          <ul className="mkpl-lista">{LISTA_PROGRAMA.map((x) => <li key={x.fuerte ?? x.texto}><span>{x.fuerte ? <b>{x.fuerte}</b> : null}{x.texto}</span></li>)}</ul>
        </div>
      </section>
      </div>
    </div>
  );
}
