// =============================================================================
// planes-comparacion — la tabla «Compara los planes» de /planes (24/10/2026)
// =============================================================================
// Puro: lo usan app/planes/page.tsx y tests/planes-tres-bloques.test.ts.
//
// Los números NO se escriben a mano: salen de los topes que el código hace cumplir (lib/topes-plan.ts, `TOPES`), así la
// vitrina no puede prometer 3 automatizaciones si el producto frena en 2. Lo que es sólo de Pro sale de `TABS_SOLO_PRO` y
// de `FUNCIONES_SOLO_PRO`. El Accelerator trae MaKo Pro (docs/ofertas-mako.md §3): sus topes son los de Pro, y suma lo del programa.
//
// SIN LENGUAJE INTERNO (24/10/2026, noche, Martín: «las personas no saben que es "Ops Center" y muchas otras cosas»): cada
// fila dice lo que la persona CONSIGUE, nunca el nombre de una tab, y van por grupos, como el «Compare features» de Kajabi
// (kajabi.com/pricing, mirado el 24/10). La guarda está en tests/planes-tres-bloques.test.ts.
//
// Y PARA ALGUIEN QUE NO SABE (27/10/2026, Leila en la llamada con Martín, Fathom 876470842-16: «Una persona que no sabe no
// entiende…», sobre «Piloto automático: tu media buyer aplica los cambios solo, dentro de tus topes»): sin «media buyer», ni
// «embudo», ni «topes», ni «piloto automático». Y con TODO lo que trae MaKo (faltaban el scraper de WhatsApp, los videos, el
// dominio, cobrar y MaKo Partners). Cada fila corta: una línea en el teléfono.
//
// EL RELEVAMIENTO DEL 12/11/2026 (Martín: «hagas nuevamente la parte de compara los planes… relevamiento de qué se incluye en
// cada cosa»). La tabla dice TODO lo que trae MaKo, función por función, de lib/funciones-mako.ts (sólo lo que anda) y de quién
// ve cada pantalla: las capas `completo` (Essential) y `agencia` (Pro) ven todas las pantallas (lib/capas.ts, `navKeys: null`)
// menos las de `TABS_SOLO_PRO`, que en Essential van con candado. Así que casi todo está en los tres planes, y lo que cambia son
// los topes y lo de Pro. Los grupos se abren y se cierran, como el «Compare features» de beehiiv (beehiiv.com/pricing): el
// primero, lo que entra en cada plan, abierto.
// =============================================================================

import { TOPES, TABS_SOLO_PRO, type FuncionSoloPro, type Tope } from './topes-plan';
// Los topes de GENERACION no viven en `TOPES`: viven con el precio del clip y de la imagen
// (./mako-tokens-paquetes.ts), porque lo que los fija es el margen, no un limite de la app.
import { CLIPS_POR_MES, IMAGENES_POR_MES } from './mako-tokens-paquetes';
import { PLAN_DE_CAPA, type Plan } from './mako-tokens-reglas';
import { ASESORES } from './asesores/catalogo';
import { LISTA_DEL_ACELERADOR } from './planes-mako';

/** true = incluido, false = no incluido, texto = el tope. */
export type Celda = boolean | string;
// `tope` (15/11/2026): QUÉ tope gobierna esta fila, cuando la gobierna uno. No se dibuja: lo que se dibuja son las celdas.
// Está para que otra página que promete lo mismo pueda cruzarse contra ESTA fila por el tope y no por el número: dos topes
// distintos pueden valer lo mismo (hoy SEIS valen 1), y entonces comparar los dígitos no distingue una fila cruzada con la
// equivocada. Lo usa tests/vsl-comparaciones-competencia.test.ts para cruzar la tabla «MaKo vs» de /vsl/comparaciones.
// `detalle` (15/11/2026): lo que dice la «i» cuando el nombre de la fila ya es el corto (las del Accelerator).
export type FilaComparacion = { grupo: string; que: string; esencial: Celda; pro: Celda; acelerador: Celda; tope?: Tope; detalle?: string };

// «ILIMITADO», NUNCA «SIN TOPE» (15/11/2026, Martín: «en las columnas yo no pondría nunca sin tope… lo eliminaría de todos lados.
// Pondría ilimitado, que es mejor la palabra… tanto en las columnas como en la comparación de planes»). Concuerda con lo que cuenta
// la fila: «Landings: Ilimitadas», «Cursos: Ilimitados». `genero` es el de esa palabra; «tope» queda sólo para el código.
type Genero = 'm' | 'f';
export const ilimitado = (genero: Genero = 'm'): string => (genero === 'f' ? 'Ilimitadas' : 'Ilimitados');
const cantidad = (n: number | null, prefijo = '', genero: Genero = 'm'): string => (n == null ? ilimitado(genero) : `${prefijo}${n.toLocaleString('es-AR')}`);

/** Una fila de tope: Essential es la capa `completo`; Pro y el Accelerator, `agencia`. */
// Un tope en 0 es «no lo trae» (14/11/2026: Essential sin dominio propio): la celda va vacía, no «0».
const celdaDeTope = (n: number | null, prefijo: string, genero: Genero): Celda => (n === 0 ? false : cantidad(n, prefijo, genero));
const filaDeTope = (grupo: string, que: string, t: Tope, prefijo = '', genero: Genero = 'm'): FilaComparacion => ({
  grupo,
  que,
  tope: t,
  esencial: celdaDeTope(TOPES.completo[t], prefijo, genero),
  pro: celdaDeTope(TOPES.agencia[t], prefijo, genero),
  acelerador: celdaDeTope(TOPES.agencia[t], prefijo, genero),
});
const enTodos = (grupo: string, que: string): FilaComparacion => ({ grupo, que, esencial: true, pro: true, acelerador: true });
const soloPro = (grupo: string, que: string): FilaComparacion => ({ grupo, que, esencial: false, pro: true, acelerador: true });
const soloPrograma = (grupo: string, que: string, detalle?: string): FilaComparacion => ({ grupo, que, esencial: false, pro: false, acelerador: true, ...(detalle ? { detalle } : {}) });

/**
 * UNA FILA DE TOPE DE GENERACIÓN (15/11/2026). Igual que `filaDeTope`, pero el número sale de los topes de video e imagen
 * (`CLIPS_POR_MES`, `IMAGENES_POR_MES`) en vez de `TOPES`: son los dos únicos límites que los fija el MARGEN y no el
 * producto, y por eso viven con el precio del clip. El Accelerator trae MaKo Pro, así que lleva lo de Pro.
 */
const filaDeGeneracion = (grupo: string, que: string, celda: (p: Plan) => Celda): FilaComparacion => ({
  grupo,
  que,
  esencial: celda(PLAN_DE_CAPA.completo),
  pro: celda(PLAN_DE_CAPA.agencia),
  acelerador: celda(PLAN_DE_CAPA.agencia),
});

/**
 * GENERAR Y EDITAR NO SON LO MISMO, y la tabla no lo decía (15/11/2026). Martín, textual: «en la comparación de planes no
 * pusiste cosas súper importantes como la generación de imagen y la generación de video. Eso no está por ninguna parte.
 * Está el editor de imagen, el editor de video, pero no es lo mismo de generación. Y justamente eso es lo que no tiene el
 * plan de 47, de la generación de video».
 *
 * Es la diferencia que más pesa entre los dos planes y era la única que no tenía fila: la tabla mostraba «Editor de video,
 * como CapCut» con un tilde en las dos columnas, que es verdad — el editor está en los dos — y dejaba leer que el de US$47
 * también genera video. No genera: `CLIPS_POR_MES.pro` es 0.
 * Van JUNTO a las filas de los editores, en ese orden, para que la distinción se lea sola.
 */
export const NOMBRE_GENERACION_VIDEO = 'Generar videos con IA desde un texto o una foto';
export const NOMBRE_GENERACION_IMAGEN = 'Generar imágenes con IA para tus anuncios y tus posts';

/** Las tabs que son sólo de Pro, dichas como las nombra el marketing (nunca el nombre interno de la tab). */
export const NOMBRE_TAB_PRO: Readonly<Record<(typeof TABS_SOLO_PRO)[number], string>> = {
  'closing-analyst': 'Análisis de tus llamadas de venta con IA',
};

/**
 * Las tabs de Pro que TODAVÍA no se abrieron: no se venden (28/10/2026, lo que Martín le prometió a Teo). Hoy ninguna: AI Avatar
 * (la única que estuvo acá) se abrió el 29/10/2026 a los TRES planes y ya no es de Pro; su fila espera `AI_AVATAR_SE_VENDE`.
 */
export const TABS_TODAVIA_CERRADAS: readonly (typeof TABS_SOLO_PRO)[number][] = [];

/**
 * ¿La tabla VENDE AI Avatar? NO, aunque la tab esté abierta en los tres planes (29/10/2026, el Cerebro: «no se vende lo que no
 * anduvo de punta a punta», el mismo criterio que sacó los videos del Video Generator). Vuelve a `true` cuando Martín genere un
 * look real en el ws3 Y la tienda de Chrome publique la extensión 0.69 o más (`lib/extension-tienda.ts`). Ese día la fila dice
 * que se paga con los créditos de Google Flow de la persona (lo pide el test).
 */
export const AI_AVATAR_SE_VENDE = false;

/**
 * ¿LA TABLA VENDE **GENERAR** VIDEO E IMÁGENES CON IA? NO (15/11/2026), y no es una omisión: es el mismo criterio que la
 * línea de arriba — «no se vende lo que no anduvo de punta a punta» (el Cerebro, 29/10/2026).
 *
 * MARTÍN PIDIÓ ESTAS DOS FILAS, textual (15/11/2026): «en la comparación de planes no pusiste cosas súper importantes como
 * la generación de imagen y la generación de video. Eso no está por ninguna parte. Está el editor de imagen, el editor de
 * video, pero no es lo mismo de generación. Y justamente eso es lo que no tiene el plan de 47, de la generación de video».
 * Tiene razón en que la distinción falta y en que es la que más pesa. Las filas están escritas y listas (abajo). Lo que
 * falta es el producto, y esto es lo que se midió el 15/11 antes de publicarlas:
 *
 *   · **GENERAR IMÁGENES CON IA NO EXISTE EN MaKo.** `USD_POR_IMAGEN` y `mtDeImagenes` (lib/mako-tokens-reglas.ts) los
 *     usan DOS archivos y nada más: su propia definición y app/planes/CalculadoraTokens.tsx, o sea la vitrina de precios.
 *     Ningún generador los llama. Lo que existe es el EDITOR (tipo Canva) y su chat con IA
 *     (app/api/image-editor/ia/route.ts), que devuelve OPERACIONES de edición sobre un diseño que ya existe — su propia
 *     cabecera lo dice: «vuelve una PROPUESTA (operaciones…) que la persona revisa y acepta en el editor».
 *   · **GENERAR VIDEO SÍ EXISTE, pero no lo paga MaKo.** El Video Generator filma por Google Flow con la extensión de
 *     Chrome y **los créditos de Flow de la persona** (app/video-generator/estudio/filmar.ts, `PUENTE_VIEJO`/`SIN_PUENTE`).
 *     Y el camino que SÍ nos costaría, ApiMart, **no lo llama ninguna ruta de app/api/**: los únicos que nombran
 *     `apimart` son archivos de reglas, claves y catálogos. Es la regla de Martín del 13/11: «video por Flow, no ApiMart,
 *     porque ApiMart cobra». El 29/10 el Cerebro ya lo había anotado así: el motor nunca se midió en vivo.
 *   · Y `AI_AVATAR_SE_VENDE` sigue en false, que es el único video con IA que la tabla iba a nombrar.
 *
 * **Lo que hay que pasar para que esto sea true**, y es una decisión de Martín, no un arreglo de código:
 *   1. que generar imágenes con IA exista como producto (hoy no hay ni un endpoint), y
 *   2. que se decida quién paga el video: si sigue pagando el cliente con sus créditos de Flow, la fila tiene que decirlo
 *      con esas palabras (como la de AI Avatar), porque un tope nuestro de minutos sobre los créditos de ÉL no se cumple.
 * El día que pase, esto va a true y las dos filas aparecen con los topes del código, sin tocar nada más.
 */
export const GENERACION_SE_VENDE = true;
// ⚠️ PRENDIDO EL 15/11/2026 A LA NOCHE, POR PEDIDO EXPRESO DE MARTÍN, y con el costo a la vista. Se le dijo esa misma tarde
// que la generación de imagen y de video todavía no estaba construida en la app («hoy la app no genera imágenes ni clips
// con IA… prometerlo sería vender algo que no existe»), y su respuesta fue pedir que /planes muestre cuántos clips y cuántas
// imágenes alcanzan en cada columna y que se muevan con la barra: «cuando voy desplazando a más MaKo Tokens, debería ahí
// justamente cambiar la cantidad de clips o de imágenes que me alcanzan». Es su decisión de producto.
// LO QUE QUEDA ABIERTO, para que nadie lo dé por hecho: que generar un clip y una imagen ande de punta a punta dentro de
// MaKo (el medidor que descuenta ya está en main: lib/mako-tokens-medidor.ts). Hasta entonces, la vitrina promete algo que
// el producto todavía no entrega.

/** La fila de AI Avatar en la tabla, para cuando se venda (`AI_AVATAR_SE_VENDE`). */
export const NOMBRE_AI_AVATAR = 'Videos con una persona hecha con IA que habla por ti';

/** Lo demás que es sólo de Pro (lib/topes-plan.ts, `FUNCIONES_SOLO_PRO`), dicho igual. */
export const NOMBRE_FUNCION_PRO: Readonly<Record<FuncionSoloPro, string>> = {
  'scraper-whatsapp': 'Scrapear los contactos de tus grupos de WhatsApp',
  'replicar-landing': 'Copiar la landing de un competidor, con tu oferta',
  // Lo que el candado cierra de verdad (lib/editores-ia-pro.ts): el chat con IA de cada editor, la edición automática, el B-roll y los
  // clips. Los subtítulos y quitar el fondo corren en el navegador y siguen en los dos planes: no se dicen acá.
  // Y la RÉPLICA de un carrusel o de una miniatura, que pasa por la IA del editor de imagen: por eso no tiene fila aparte.
  'ia-editores': 'Editar con IA: edición automática, B-roll y clips mágicos',
  'comunidad': 'Comunidad para tus alumnos, como en Skool',
  'setter-ia': 'Setter con IA que responde y agenda por WhatsApp e IG',
  'piloto-redes': 'Piloto automático de Instagram: publica y prueba hooks',
  // 14/11/2026: las tres últimas que se cerraron en Essential (lib/topes-plan.ts, `FUNCIONES_SOLO_PRO`).
  // ⚠️ El avatar NO se vende todavía (`AI_AVATAR_SE_VENDE`): su nombre es el de abajo y su fila sólo aparece el día que se venda.
  'ai-avatar': NOMBRE_AI_AVATAR,
  'replicar-guion': 'Replicar el guion de un video de la competencia',
  'chat-referentes': `Chat con ${ASESORES.length} referentes del marketing, con su método`,
};

/**
 * Lo que es SÓLO de Pro pero TODAVÍA no se vende: está cerrado en Essential y aun así no tiene fila en la tabla. Es el mismo
 * criterio que `TABS_TODAVIA_CERRADAS` al revés — ahí la tab no estaba abierta; acá la función anda, se cerró en Essential y
 * lo que falta es que ande de punta a punta para prometerla (el Cerebro, 29/10/2026: «no se vende lo que no anduvo de punta a
 * punta»). Hoy: el avatar, hasta que `AI_AVATAR_SE_VENDE` sea true.
 */
export const FUNCIONES_TODAVIA_NO_VENDIDAS: readonly FuncionSoloPro[] = AI_AVATAR_SE_VENDE ? [] : ['ai-avatar'];

/** El piloto de YouTube: la misma función de Pro que el de Instagram ('piloto-redes'), en su propia fila. */
export const NOMBRE_PILOTO_YOUTUBE = 'Piloto automático de YouTube: Shorts y miniaturas';

/**
 * LOS GRUPOS (14/11/2026, el relevo de todo lo que hace MaKo; Martín: «hagas un relevo bien profundo de todo lo que hace MaKo…
 * lo agrupes mejor y seas más limitado en el de 47»). Por ÁREA, como se piensa un negocio: conseguir leads, el contenido y los
 * anuncios (juntos: «No entiendo la diferenciación con anuncios. Porque eso podrías agruparlo en contenido»), el CRM, los chats,
 * el área de miembros, la IA, el equipo y el acompañamiento. Cada tope va en su área (ya no hay un grupo «lo que entra»).
 */
// 14/11/2026, noche (Martín): sin «Equipo y agencia» (las cuentas de clientes y MaKo Partners no van; las personas del equipo, al
// CRM, para que no quede un grupo con una sola fila) y «Acompañamiento personalizado», con lo que promete.
export const GRUPOS_COMPARACION = [
  'Captación de leads', 'Contenido y anuncios', 'CRM y ventas', 'Chats y automatizaciones', 'Área de miembros', 'IA y reportes',
  'Acompañamiento personalizado',
] as const;

export function filasDeComparacion(): FilaComparacion[] {
  const [captacion, contenido, crm, chats, miembros, ia, acompanamiento] = GRUPOS_COMPARACION;
  return [
    // LENGUAJE DE MARKETING (14/11/2026, Martín: «no tengas problema en utilizar el lenguaje técnico de marketing… solo de
    // marketing»): landing, leads, CRM, pipelines, setter, scrapear. Lo que sigue prohibido es lo INTERNO de MaKo (el nombre de
    // una tab, «capa», «topes»): tests/planes-tres-bloques.test.ts.
    filaDeTope(captacion, 'Landings y presentaciones armadas con IA, publicadas', 'web.landings_publicadas', '', 'f'),
    filaDeTope(captacion, 'Dominio propio para tus landings (tunegocio.com)', 'web.dominios'),
    soloPro(captacion, NOMBRE_FUNCION_PRO['replicar-landing']),
    filaDeTope(captacion, 'Competidores que MaKo scrapea: web, redes y anuncios', 'spy.competidores'),
    soloPro(captacion, NOMBRE_FUNCION_PRO['scraper-whatsapp']),
    // AI Avatar se cerró en Essential el 14/11/2026 (Martín: «el de 97 ya podés generar avatares de IA»; estaba abierta en los tres
    // desde el 29/10). La tabla sigue sin venderla hasta que ande de punta a punta (`AI_AVATAR_SE_VENDE`), y el día que se venda
    // nace EN PRO, no en los tres: por eso `soloPro` y no `enTodos`. El Video Generator, igual (29/10/2026).
    ...(AI_AVATAR_SE_VENDE ? [soloPro(contenido, NOMBRE_AI_AVATAR)] : []),
    // Los guiones de anuncios y las stories son plantillas de Copywriting (la tab Stories se deprecó el 29/10/2026).
    enTodos(contenido, 'Copywriting con IA: guiones de reels, anuncios, VSL y emails'),
    // 14/11/2026: escribir tu guion desde cero es de los dos planes; REPLICAR el de un competidor, de Pro. La misma palanca que
    // copiar su landing, y el criterio tiene que ser uno (lib/topes-plan.ts, 'replicar-guion').
    soloPro(contenido, NOMBRE_FUNCION_PRO['replicar-guion']),
    // Generar primero, editar después: así se lee que son dos cosas (lo que pidió Martín el 15/11). El de US$47 genera
    // imágenes (limitadas) y NO genera video. ⚠️ Detrás de `GENERACION_SE_VENDE`, que hoy es false y explica por qué:
    // generar imágenes con IA no existe todavía y el video lo paga el cliente con sus créditos de Google Flow.
    ...(GENERACION_SE_VENDE ? [
      // «HASTA», porque es una sola bolsa (Martín, 15/11: «te alcanza para todo esto, punto. Después que él decida cómo lo
      // reparte»): las dos filas son los extremos de los MISMOS MaKo Tokens, no dos cupos que se suman. Y el video en
      // CLIPS, no en minutos («queda mejor 18 clips que 3 minutos»).
      filaDeGeneracion(contenido, NOMBRE_GENERACION_IMAGEN, (p) => `Hasta ${IMAGENES_POR_MES[p].toLocaleString('es-AR')} al mes`),
      filaDeGeneracion(contenido, NOMBRE_GENERACION_VIDEO, (p) => {
        const clips = CLIPS_POR_MES[p];
        // Cero no se dice «0 clips»: se dice que no lo trae, y la celda dibuja el guión (`CeldaPlan`).
        return clips === 0 ? false : `Hasta ${clips} ${clips === 1 ? 'clip' : 'clips'} al mes`;
      }),
    ] : []),
    enTodos(contenido, 'Editor de imágenes y carruseles, como Canva'),
    enTodos(contenido, 'Editor de video, como CapCut'),
    soloPro(contenido, NOMBRE_FUNCION_PRO['ia-editores']),
    enTodos(contenido, 'Calendario de contenido y publicación en tus redes'),
    // Lo que en Essential propone y no aplica solo (25/10/2026); cuántas, del tope del plan. Los tres pilotos automáticos, cada uno
    // en su fila y los tres de Pro (14/11/2026, noche, Martín). «ROAS real por campaña» se fue: no se entendía.
    filaDeTope(contenido, 'Recomendaciones por día para tus campañas de Meta', 'ads.recomendaciones_dia', '', 'f'),
    soloPro(contenido, 'Piloto automático de tus anuncios de Meta'),
    soloPro(contenido, NOMBRE_FUNCION_PRO['piloto-redes']),
    soloPro(contenido, NOMBRE_PILOTO_YOUTUBE),
    filaDeTope(crm, 'Leads y clientes guardados en tu CRM', 'crm.leads', 'Hasta '),
    filaDeTope(crm, 'Pipelines de venta en tu CRM, con sus etapas', 'crm.funnels'),
    enTodos(crm, 'Tracking de cada lead: de qué anuncio vino y qué hizo'),
    enTodos(crm, 'Agenda de llamadas sincronizada con Google, Calendly o Cal'),
    filaDeTope(crm, 'Cuentas de cobro conectadas: Mercado Pago o Stripe', 'cobros.cuentas', '', 'f'),
    enTodos(crm, 'Planes de pago en cuotas, con contrato y comprobantes'),
    soloPro(crm, NOMBRE_TAB_PRO['closing-analyst']),
    filaDeTope(crm, 'Personas de tu equipo, cada una con su acceso', 'equipo.usuarios'),
    enTodos(chats, 'Bandeja única: WhatsApp, Instagram, Messenger y email'),
    filaDeTope(chats, 'Números de WhatsApp conectados', 'chats.lineas_whatsapp'),
    filaDeTope(chats, 'Automatizaciones activas a la vez', 'automations.activas', '', 'f'),
    soloPro(chats, NOMBRE_FUNCION_PRO['setter-ia']),
    enTodos(chats, 'Email marketing: secuencias y envíos con tu dominio'),
    filaDeTope(miembros, 'Cursos con módulos y clases para tus alumnos', 'classroom.cursos'),
    soloPro(miembros, NOMBRE_FUNCION_PRO['comunidad']),
    enTodos(ia, 'MaKo, un asistente con IA que conoce tu negocio'),
    // Los referentes del chat de MaKo (lib/asesores/catalogo.ts), contados. SÓLO PRO desde el 14/11/2026 (hasta entonces estaban
    // en los tres planes sin ningún tope): es la fila 2 de la portada y una de las que Martín nombró para el de 97.
    soloPro(ia, NOMBRE_FUNCION_PRO['chat-referentes']),
    enTodos(ia, 'Tu oferta y tu funnel, revisados con IA'),
    enTodos(ia, 'Reportes de tus ventas, tus anuncios y tu contenido'),
    enTodos(ia, 'Tus tareas, puntuadas y ordenadas por prioridad'),
    // EL ACOMPAÑAMIENTO ES LO DE LA TARJETA, con sus nombres y en su orden (15/11/2026, ~21:30, Martín: «no está bien los ítems
    // que están ahí… renombraría… y también el orden. No me hace sentido que en tercer lugar esté garantía por contrato… la
    // quitaría de todos lados»). Sale de `LISTA_DEL_ACELERADOR` (lib/planes-mako.ts); «MaKo Pro completo» no es una fila: la
    // columna del Accelerator ya tiene ✓ en todo lo de Pro.
    ...LISTA_DEL_ACELERADOR.filter((x) => !/^MaKo Pro/.test(x.corto)).map((x) => soloPrograma(acompanamiento, x.corto, x.detalle)),
  ];
}

/**
 * EL NOMBRE CORTO DE CADA FILA, para la tabla de /planes (14/11/2026, Martín: «se tiene que entender muy simple a qué hace
 * referencia»). El molde es Attio (notas: referencias-comparar/tablas-de-planes.md): el nombre de la cosa, de una a tres palabras,
 * en lenguaje de marketing; la frase entera (`que`) queda en el (i) de la fila. `que` no cambia: lo leen las tarjetas
 * («no incluye»), MaKo Partners y los tests.
 */
export function nombreCorto(que: string): string {
  const k: Record<string, string> = {
    'Landings y presentaciones armadas con IA, publicadas': 'Landings',
    'Dominio propio para tus landings (tunegocio.com)': 'Dominios propios',
    [NOMBRE_FUNCION_PRO['replicar-landing']]: 'Copiar landings de la competencia',
    'Competidores que MaKo scrapea: web, redes y anuncios': 'Competidores',
    [NOMBRE_FUNCION_PRO['scraper-whatsapp']]: 'Scrapear grupos de WhatsApp',
    [NOMBRE_AI_AVATAR]: 'Videos con tu avatar',
    'Copywriting con IA: guiones de reels, anuncios, VSL y emails': 'Copywriting con IA',
    [NOMBRE_FUNCION_PRO['replicar-guion']]: 'Replicar guiones de la competencia',
    [NOMBRE_GENERACION_IMAGEN]: 'Generar imágenes con IA',
    [NOMBRE_GENERACION_VIDEO]: 'Generar video con IA',
    'Editor de imágenes y carruseles, como Canva': 'Editor de imágenes',
    'Editor de video, como CapCut': 'Editor de video',
    [NOMBRE_FUNCION_PRO['ia-editores']]: 'Edición con IA',
    'Calendario de contenido y publicación en tus redes': 'Calendario de contenido',
    'Recomendaciones por día para tus campañas de Meta': 'Recomendaciones de ads',
    'Piloto automático de tus anuncios de Meta': 'Piloto automático de ads',
    [NOMBRE_FUNCION_PRO['piloto-redes']]: 'Piloto automático de Instagram',
    [NOMBRE_PILOTO_YOUTUBE]: 'Piloto automático de YouTube',
    'Leads y clientes guardados en tu CRM': 'Leads en el CRM',
    'Pipelines de venta en tu CRM, con sus etapas': 'Pipelines',
    'Tracking de cada lead: de qué anuncio vino y qué hizo': 'Tracking de leads',
    'Agenda de llamadas sincronizada con Google, Calendly o Cal': 'Agenda',
    'Cuentas de cobro conectadas: Mercado Pago o Stripe': 'Cuentas de cobro',
    'Planes de pago en cuotas, con contrato y comprobantes': 'Planes de pago',
    [NOMBRE_TAB_PRO['closing-analyst']]: 'Análisis de llamadas',
    'Bandeja única: WhatsApp, Instagram, Messenger y email': 'Bandeja de chats',
    'Números de WhatsApp conectados': 'Números de WhatsApp',
    'Automatizaciones activas a la vez': 'Automatizaciones activas',
    [NOMBRE_FUNCION_PRO['setter-ia']]: 'Setter con IA',
    'Email marketing: secuencias y envíos con tu dominio': 'Email marketing',
    'Cursos con módulos y clases para tus alumnos': 'Cursos',
    [NOMBRE_FUNCION_PRO['comunidad']]: 'Comunidad',
    'MaKo, un asistente con IA que conoce tu negocio': 'Asistente con IA',
    [NOMBRE_FUNCION_PRO['chat-referentes']]: `Chat con ${ASESORES.length} referentes`,
    'Tu oferta y tu funnel, revisados con IA': 'Oferta y funnel con IA',
    'Reportes de tus ventas, tus anuncios y tu contenido': 'Reportes',
    'Tus tareas, puntuadas y ordenadas por prioridad': 'Tareas por prioridad',
    'Personas de tu equipo, cada una con su acceso': 'Usuarios',
  };
  return k[que] ?? que;
}

/** Los grupos en la tabla, en el orden de los datos (14/11/2026: uno por área; el título es el del grupo). */
export const GRUPOS_DE_LA_TABLA: ReadonlyArray<{ titulo: string; de: readonly string[] }> = GRUPOS_COMPARACION.map((g) => ({ titulo: g, de: [g] }));

/**
 * La celda de un plan por su CAPA y no por su id: los números salen de los topes de la capa, así que un plan del setting
 * `planes.mako` con otro id dice lo que su capa le da. Una capa sin columna (pm), null: no se inventa.
 */
export function celdaDeCapa(f: FilaComparacion, capa: string): Celda | null {
  return capa === 'completo' ? f.esencial : capa === 'agencia' ? f.pro : null;
}

/**
 * Lo que un plan NO trae, de la misma tabla (29/10/2026, Martín: el pricing «no aclara todo lo que incluye o lo que no»):
 * cada tarjeta lo dice con ✗, y no puede contradecir a la comparación porque sale de ella.
 */
export function noIncluyeDe(capa: string): string[] {
  return filasDeComparacion().filter((f) => celdaDeCapa(f, capa) === false).map((f) => f.que);
}
