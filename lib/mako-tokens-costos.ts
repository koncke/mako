// =============================================================================
// mako-tokens-costos — qué cuesta, en MaKo Tokens, CADA acción de IA de MaKo (15/11/2026)
// =============================================================================
// Martín, 15/11/2026, textual: «por supuesto que tienes que implementar el tema de MaKo Tokens dentro de la aplicación del
// gasto con inteligencia artificial… vinculemos todas las cosas que utilicen inteligencia artificial y que todo utilice MaKo
// Tokens… Lo mismo con la generación de transcripciones, la generación de análisis de la competencia, que eso también gasta
// dinero. O sea, todo debería consumir MaKo Tokens».
//
// `mako-tokens-reglas.ts` tiene la ARITMÉTICA (1.000 MT = US$1 de costo real) y el cupo de cada plan.
// `mako-tokens-paquetes.ts` tiene el PRECIO de lo que se vende aparte.
// Esto tiene el COSTO de cada acción: el número que el medidor reserva antes de llamar a un modelo y el que se dibuja en la
// vitrina. Un archivo, porque un costo que vive en dos lugares se desincroniza (ya pasó acá: `CUPO_MT` contra
// `CUPO_MENSUAL`, y la nota de `mako-tokens-paquetes.ts` sobre los dos `cupoDeLaCapa`).
//
// ─────────────────────────────────────────────────────────────────────────────
// ⚠️ LA TRAMPA QUE MÁS CARO SALE, Y EL DIAGNÓSTICO OBVIO ERA EL EQUIVOCADO
// ─────────────────────────────────────────────────────────────────────────────
// Ya existe una tabla de MaKo Tokens por operación: `TARIFA`, en app/admin/dev/pricing/modelo.ts. Lo obvio es copiarle la
// columna `mt`. **Está en otra unidad y cobra 2,4× de más.**
//
//   · La `TARIFA` es del 09/08/2026 y su `mt` es PRECIO DE LISTA: costo real × `MARKUP_MT` (2,4). Ahí el markup estaba
//     adentro del token.
//   · La regla vigente es la del 07/11/2026 (`MT_POR_USD = 1000`): **1 MT = US$0,001 de COSTO REAL, sin markup**. El margen
//     pasó a vivir en otro lado — el cupo de cada plan es el 25 % de su precio (`CUPO_MENSUAL`, US$11,75 sobre US$47).
//
// Copiar la columna `mt` cobra el markup DOS VECES: una en el token y otra en el cupo. Un cupo de 11.750 MT dimensionado
// para US$11,75 de costo se agota con US$4,90 gastados, o sea al 40 % del mes, y el cliente ve «te quedaste sin saldo» con
// tres cuartos de su plan sin usar. Lo que se copia de la `TARIFA` es la columna **`costoUsd`**, que es la medición; los MT
// los deriva `mtDeUsd` y nunca se escriben a mano.
//
// ⚠️ Y LA SEGUNDA, del mismo tipo: los MEDIOS de la `TARIFA` están viejos. Dice US$0,05 por segundo de video («publicado»);
// la medición del 07/11 contra ApiMart, con cuatro generaciones pagadas, da **US$0,0384** (`USD_POR_SEGUNDO`). Los medios
// salen de `mako-tokens-reglas.ts`, que es donde se midieron, no de la tabla de agosto.
//
// ─────────────────────────────────────────────────────────────────────────────
// DE DÓNDE SALE CADA NÚMERO
// ─────────────────────────────────────────────────────────────────────────────
//   · `medido`    → media real sobre `n` llamadas de `anthropic_usage` en producción (29/06-08/08/2026, 2.249 llamadas,
//                   23,4M tokens). docs/costos-ia-y-planes.md.
//   · `publicado` → precio de lista del proveedor, o una medición nuestra contra el proveedor (los medios, 07/11/2026:
//                   docs/hallazgos-video-pipeline.md).
//   · `estimado`  → la acción todavía no corrió lo suficiente. **Es lo PRIMERO a recalibrar**, y el medidor igual cobra el
//                   costo REAL al terminar, así que un estimado flojo no se le cobra a nadie: sólo decide si la llamada
//                   arranca.
//
// ⚠️ EL ESTADÍSTICO ES LA MEDIA, NO LA MEDIANA (el hallazgo de método de agosto, y mueve los números más que cualquier otra
// decisión): la distribución de tokens de SALIDA es asimétrica a la derecha —la media es 1,9× a 3× la mediana en casi todas
// las features medidas—. Tarifar por mediana subcobra y la cola se come el margen; por p90 sobrecobra al 90 %. La media es,
// por definición, lo que se paga cuando se corren muchas.
//
// ⚠️ UN COSTO DE 0 NO ES «GRATIS PARA SIEMPRE»: es «hoy esta feature rutea a un free tier». Son límites por key y por día
// que no escalan con la cantidad de clientes (docs/costos-ia-y-planes.md: «el free tier tapa la mitad del costo»; si se
// agota, el mismo consumo pasa de US$67 a US$99/mes). El 0 es correcto HOY y se auto-corrige: el medidor cobra lo que
// `recordUsage` midió de verdad, así que el día que esa feature caiga a un modelo pago empieza a descontar sola.
//
// LA UNIDAD DE CADA NÚMERO ES **UNA LLAMADA A UN MODELO**, no una operación de producto. Importa y se leyó mal una vez: la
// `TARIFA` rotula `plan-fathom` como «extraer tareas de una reunión de 2 h», y su US$0,00504 es la media POR LLAMADA sobre
// n=437 — una reunión de 2 h son 4-5 llamadas (`CHUNK_CHARS = 25000`, lib/plan-fathom.ts). O sea que la reunión cuesta ~5×
// eso, y el rótulo invita a cobrar un quinto. Acá cada fila dice la llamada; lo que cuesta una operación entera lo suma el
// medidor llamada por llamada, con el costo real de cada una.
// =============================================================================

import { CATALOGO_MODELOS } from './model-catalogo';
import { USD_POR_CLIP } from './mako-tokens-paquetes';
import { type Calidad, USD_POR_IMAGEN, USD_POR_SEGUNDO, mtDeImagenes, mtDeUsd, mtDeVideo } from './mako-tokens-reglas';

/** De dónde salió el número. Mismo vocabulario que `Origen` de app/admin/dev/pricing/modelo.ts, con `estimado` por `supuesto`. */
export type OrigenDeCosto = 'medido' | 'publicado' | 'estimado';

/** La ventana de la medición de texto, para poder decir en pantalla de cuándo es el número. */
export const MEDICION_TEXTO = { desde: '2026-06-29', hasta: '2026-08-08', llamadas: 2249, tokens: 23_400_000 } as const;

/** La fecha en que se midieron los medios contra el proveedor (docs/hallazgos-video-pipeline.md). */
export const MEDICION_MEDIOS = '2026-11-07' as const;

export type CostoDeFeature = {
  /** El tag de gasto que viaja a `chatCheap` / `chatClaude` y que escribe `recordUsage`. */
  readonly feature: string;
  /** Costo real medio de UNA llamada, en USD. De acá sale el MT con `mtDeUsd`: nunca se escribe un MT a mano. */
  readonly costoUsd: number;
  readonly origen: OrigenDeCosto;
  /** Cuántas llamadas reales respaldan el número. 0 = sin medir. */
  readonly n: number;
  /** Por qué ese número, en una línea. Lo que se lee cuando alguien pregunta «¿de dónde salió?». */
  readonly porque: string;
  /**
   * La persona no la dispara ni la puede parar (un cron, un webhook). **No cambia lo que cuesta**: cambia lo que pasa
   * cuando no alcanza. Ver `fallaBlanda` acá abajo.
   */
  readonly automatica?: true;
};

/**
 * ⚠️ LO AUTOMÁTICO NO SE DEJA SIN MEDIR, SE DEJA SIN GRITAR — y es la única parte de la regla de agosto que se da vuelta.
 *
 * La `TARIFA` del 09/08 le puso 0 MT a todo lo automático, con un argumento que sigue siendo bueno: «el usuario no lo
 * dispara ni lo puede parar: cobrarle cuota por un cron es que abra la app y la encuentre vaciada por algo que no hizo».
 *
 * Pero cobrar 0 por lo automático deja SIN MEDIDOR justo al que más gasta: el mismo documento proyecta el webhook de Fathom
 * en US$52/mes para UN cliente —«más que el plan Pro entero»— y cinco de esos caminos iteran TODOS los workspaces activos.
 * Un medidor que no mira al mayor gastador no protege la caja, que es lo único que el medidor existe para hacer.
 *
 * Así que lo automático **descuenta igual** y las dos cosas se cumplen separando COBRAR de AVISAR:
 *   · descuenta y queda en el ledger (la caja está protegida y el gasto es explicable);
 *   · y si no alcanza, **no se le muestra un error a nadie**: el camino automático saltea a ese negocio esta vuelta y lo
 *     anota. La persona no ve «te quedaste sin saldo» por algo que no hizo, que es lo que la regla de agosto protegía.
 *
 * Decisión de plata: va al informe para Martín.
 */
export const fallaBlanda = (c: CostoDeFeature | null | undefined): boolean => c?.automatica === true;

/**
 * Lo medido, feature por feature. Las que no están acá caen a `COSTO_POR_DEFECTO`, nunca a cero: una feature nueva que no
 * esté en esta tabla tiene que COBRAR algo, porque lo que no cobra no se mide y lo que no se mide se paga igual.
 *
 * Los `feature` son los de `CATALOGO_MODELOS` (lib/model-catalogo.ts), que es el registro de las features de IA de MaKo.
 * `tests/mako-tokens-costos.test.ts` verifica que el catálogo y esta tabla no se separen.
 */
const COSTOS: readonly CostoDeFeature[] = [
  // ── Conversar ────────────────────────────────────────────────────────────
  { feature: 'mako-doer-in', costoUsd: 0.00038, origen: 'medido', n: 337, porque: 'Media por mensaje de MaKo en WhatsApp, medida en producción. Salida media 854 tokens contra 284 de mediana: ×3,0, la más asimétrica de todas.' },
  { feature: 'mako-doer', costoUsd: 0.00038, origen: 'medido', n: 337, porque: 'Las acciones en la web usan el mismo cerebro que WhatsApp (`mako-doer-in`): mismo prompt, mismas herramientas.' },
  { feature: 'mako-chat', costoUsd: 0.00009, origen: 'medido', n: 9, porque: 'Preguntarle a MaKo sobre un gráfico: el contexto es un gráfico, no el negocio entero.' },
  { feature: 'mako-pedidos', costoUsd: 0.00009, origen: 'estimado', n: 0, porque: 'Separar los pedidos de un mensaje es una pasada corta sobre el mensaje; se tarifa como `mako-chat`.' },
  { feature: 'Título de chat', costoUsd: 0.00009, origen: 'estimado', n: 0, porque: 'Una línea de salida sobre un mensaje: lo más barato que corre.' },
  { feature: 'centro-chat-nuevo', costoUsd: 0.00009, origen: 'estimado', n: 0, porque: 'Como `Título de chat`: una pasada corta para abrir la conversación.' },

  // ── El Plan (el Perro y las reuniones) ───────────────────────────────────
  { feature: 'mako-guardian', costoUsd: 0, origen: 'medido', n: 333, porque: 'Cero medido: hoy el Perro Guardián rutea a un free tier. Ver el aviso de la cabecera — un 0 es «hoy rutea gratis», no «gratis para siempre».', automatica: true },
  { feature: 'checklist-coach', costoUsd: 0, origen: 'medido', n: 132, porque: 'Cero medido, mismo free tier que el Perro.' },
  { feature: 'plan-fathom', costoUsd: 0.00504, origen: 'medido', n: 437, porque: 'Media POR LLAMADA. Una reunión de 2 h son 4-5 llamadas (`CHUNK_CHARS = 25000`) más la fusión de duplicadas: la reunión cuesta ~5× esto. Salida media 22.694 tokens.', automatica: true },
  { feature: 'plan-criterio', costoUsd: 0.00504, origen: 'estimado', n: 0, porque: 'Juzga las tareas de la misma reunión, con el mismo transcript troceado: se tarifa como `plan-fathom`.', automatica: true },
  { feature: 'plan-seed-ia', costoUsd: 0.0295, origen: 'estimado', n: 0, porque: 'El plan de arranque escribe un tablero entero de una vez; se tarifa como las piezas largas (una landing, un guion de YouTube).' },
  { feature: 'plan-importar', costoUsd: 0.00504, origen: 'estimado', n: 0, porque: 'Leer un archivo y sacar tareas: el mismo trabajo que una parte de reunión.' },
  { feature: 'plan-buscar', costoUsd: 0.00009, origen: 'estimado', n: 0, porque: 'Una búsqueda sobre el plan: pasada corta.' },
  { feature: 'cerrar-por-commits', costoUsd: 0.00038, origen: 'estimado', n: 0, porque: 'Mira commits y decide si una tarea está cerrada: una pasada corta por tanda.', automatica: true },

  // ── Análisis ─────────────────────────────────────────────────────────────
  { feature: 'closing', costoUsd: 0.00712, origen: 'medido', n: 132, porque: 'Media por análisis de llamada de venta. Salida media 1.033 tokens contra 492 de mediana.' },
  { feature: 'post-llamada', costoUsd: 0.00712, origen: 'estimado', n: 0, porque: 'El follow-up sale del mismo análisis de la llamada; se tarifa igual.', automatica: true },
  { feature: 'experimentos', costoUsd: 0.0989, origen: 'medido', n: 47, porque: 'La más cara medida, y la única que sigue en Opus. Salida media 3.484 tokens contra 1.487 de mediana (×2,3), y 11.288 en el p90: es la que empuja el mes malo del Growth a 28,5 % de margen.' },
  { feature: 'lead_insights', costoUsd: 0.00192, origen: 'medido', n: 3, porque: 'Insight 360 de un lead. n=3: poco respaldo, a recalibrar.' },
  { feature: 'ads-analyst', costoUsd: 0, origen: 'medido', n: 18, porque: 'Cero medido: analizar un anuncio rutea gratis hoy.' },
  { feature: 'script-valorador', costoUsd: 0.00135, origen: 'medido', n: 5, porque: 'Valorar un guion nuevo, medido sobre 5 llamadas.' },
  { feature: 'landing-analyst', costoUsd: 0.0092, origen: 'estimado', n: 0, porque: 'Diagnosticar una landing: lee la página entera y devuelve un informe. Entre `closing` y `experimentos`.' },
  { feature: 'dashboard-analista', costoUsd: 0.0092, origen: 'estimado', n: 0, porque: 'El AI Analyst del Dashboard lee series enteras y concluye; se tarifa como diagnosticar una landing.', automatica: true },
  { feature: 'dashboard-conclusiones', costoUsd: 0.00135, origen: 'estimado', n: 0, porque: 'Una caja del Dashboard es una conclusión corta sobre números ya calculados.', automatica: true },
  { feature: 'dashboard-hoja-ia', costoUsd: 0.0092, origen: 'estimado', n: 0, porque: 'Armar una hoja entera del Dashboard: una pieza larga.' },
  { feature: 'crm-ficha-tab-ia', costoUsd: 0.006, origen: 'estimado', n: 0, porque: 'Armar una tab de la ficha del lead con sus datos: como analizar una conversación.' },
  { feature: 'second-brain-recolector', costoUsd: 0.006, origen: 'estimado', n: 0, porque: 'Lee lo que pasó en el WhatsApp del negocio y destila; como analizar una conversación.', automatica: true },
  { feature: 'cs-sesion', costoUsd: 0.00712, origen: 'estimado', n: 0, porque: 'Analizar una sesión de entrega: el mismo trabajo que una llamada de venta.' },
  { feature: 'cs-propuesta-curso', costoUsd: 0.00135, origen: 'estimado', n: 0, porque: 'Reescribir una tarea con lo hablado: pasada corta.' },
  { feature: 'cs-autoasignar', costoUsd: 0.00038, origen: 'estimado', n: 0, porque: 'Decidir de quién es un trabajo: una pasada corta.', automatica: true },
  { feature: 'mako-recomienda', costoUsd: 0.00135, origen: 'estimado', n: 0, porque: 'Redactar lo que ya salió de los datos: el juicio lo hizo el cálculo, la IA sólo lo escribe.' },
  { feature: 'lead-magnet-propone', costoUsd: 0.0276, origen: 'estimado', n: 0, porque: 'Propone desde la oferta Y la competencia: dos contextos largos de entrada.' },
  { feature: 'offer', costoUsd: 0.00712, origen: 'estimado', n: 0, porque: 'Conversar, diagnosticar y armar la oferta: por turno, como un análisis de llamada.' },
  { feature: 'ofertas', costoUsd: 0.00712, origen: 'estimado', n: 0, porque: 'Armar la oferta del negocio de una vez.' },
  { feature: 'productos', costoUsd: 0.00135, origen: 'estimado', n: 0, porque: 'Armar el catálogo: una lista estructurada, no un juicio largo.' },

  // ── Espiar a la competencia (lo que Martín nombró el 15/11) ──────────────
  { feature: 'spy', costoUsd: 0.0086, origen: 'estimado', n: 0, porque: 'Espiar a un competidor: transcribir y leer su anuncio. Martín, 15/11: «la generación de análisis de la competencia, que eso también gasta dinero».' },
  { feature: 'video-desarmar', costoUsd: 0.0086, origen: 'estimado', n: 0, porque: 'Desarmar un video de la competencia: mira el video entero, que es la entrada más cara que hay después de un transcript.' },
  { feature: 'imagen-desarmar', costoUsd: 0.0086, origen: 'estimado', n: 0, porque: 'Desarmar un carrusel o una imagen de anuncio: una imagen por pasada, varias por pieza.' },
  { feature: 'anuncios-transcribir', costoUsd: 0.00067, origen: 'publicado', n: 0, porque: 'Transcribir el audio de un anuncio: precio de lista del STT por minuto.' },

  // ── Escribir ─────────────────────────────────────────────────────────────
  { feature: 'campaign-suggest', costoUsd: 0.01213, origen: 'medido', n: 14, porque: 'Estructurar una campaña de Meta, medido sobre 14 llamadas.' },
  { feature: 'copywriter-ia', costoUsd: 0.00504, origen: 'medido', n: 28, porque: 'Media por guion de anuncio, medida en producción (el Copywriter escribe ads, reels, stories y YouTube).' },
  { feature: 'reels-writer', costoUsd: 0.00504, origen: 'estimado', n: 0, porque: 'Un guion de Reel es el mismo trabajo que un guion de anuncio.' },
  { feature: 'stories-writer', costoUsd: 0.00504, origen: 'estimado', n: 0, porque: 'Un arco de Stories: como un guion de anuncio.' },
  { feature: 'carousels-writer', costoUsd: 0.00504, origen: 'estimado', n: 0, porque: 'Escribir el texto de un carrusel: como un guion de anuncio. ⚠️ No incluye las IMÁGENES, que son medios y se cobran aparte.' },
  { feature: 'carrusel-replica', costoUsd: 0.0092, origen: 'estimado', n: 0, porque: 'Replicar un carrusel de ejemplo son varias pasadas (leer la referencia, ver si hay una persona, completar lo que falta) sobre imágenes.' },
  { feature: 'guion-estructurar', costoUsd: 0.00356, origen: 'medido', n: 17, porque: 'Media por guion de VSL, medida en producción.' },
  { feature: 'landing-writer', costoUsd: 0.0434, origen: 'estimado', n: 0, porque: 'Escribir una landing entera: la pieza de texto más larga del producto.' },
  { feature: 'landing-editor', costoUsd: 0.0434, origen: 'estimado', n: 0, porque: 'Generar una landing en el editor: la misma pieza entera.' },
  { feature: 'landing-editor-ia', costoUsd: 0.00135, origen: 'estimado', n: 0, porque: 'Editar con IA en el editor toca un bloque, no la página: pasada corta.' },
  { feature: 'video-editor-ia', costoUsd: 0.00135, origen: 'estimado', n: 0, porque: 'Editar con IA en el Video Editor: una instrucción sobre el proyecto abierto.' },
  { feature: 'video-editor-broll', costoUsd: 0.00504, origen: 'estimado', n: 0, porque: 'Elegir el B-roll lee el guion entero y decide por tramo.' },
  { feature: 'video-editor-clips', costoUsd: 0.00504, origen: 'estimado', n: 0, porque: 'Los clips mágicos leen el video entero y eligen los cortes.' },
  { feature: 'image-editor-ia', costoUsd: 0.00135, origen: 'estimado', n: 0, porque: 'Editar con IA en el Image Editor: una instrucción sobre la pieza abierta. ⚠️ Sin la imagen generada, que es medios.' },
  { feature: 'video-planner', costoUsd: 0.00504, origen: 'estimado', n: 0, porque: 'Planificar un anuncio en video: como escribir su guion.' },
  { feature: 'video-escenas', costoUsd: 0.00504, origen: 'estimado', n: 0, porque: 'Escribir los escenarios del anuncio: como su guion.' },
  { feature: 'video-toma', costoUsd: 0.00135, origen: 'estimado', n: 0, porque: 'Una toma suelta: pasada corta sobre la escena ya escrita.' },
  { feature: 'media-buyer-variaciones', costoUsd: 0.00504, origen: 'estimado', n: 0, porque: 'Variar el anuncio ganador: como escribir un guion nuevo.' },
  { feature: 'media-buyer-agentes', costoUsd: 0.00712, origen: 'estimado', n: 0, porque: 'Un agente propio del Media Buyer corre un juicio sobre la cuenta.' },
  { feature: 'anuncios-estructura', costoUsd: 0.00504, origen: 'estimado', n: 0, porque: 'Estructurar un anuncio: como su guion.' },
  { feature: 'anuncios-imagen', costoUsd: 0.00135, origen: 'estimado', n: 0, porque: 'El PROMPT de la imagen (la imagen se cobra como medio).' },
  { feature: 'angulos-formatos', costoUsd: 0.00135, origen: 'estimado', n: 0, porque: 'Ángulos y formatos: una lista corta sobre la oferta.' },
  { feature: 'newsletter-ia', costoUsd: 0.00504, origen: 'estimado', n: 0, porque: 'La idea de la próxima edición: como un guion.' },
  { feature: 'nutri-generar', costoUsd: 0.0236, origen: 'estimado', n: 0, porque: 'Una secuencia de nutrición son varios mensajes de una vez.' },
  { feature: 'nutri-destilar-voz', costoUsd: 0.0092, origen: 'estimado', n: 0, porque: 'Aprender la voz del negocio lee muchos mensajes suyos.' },
  { feature: 'nutri-plantilla', costoUsd: 0.00135, origen: 'estimado', n: 0, porque: 'Copy a plantilla de WhatsApp: una reescritura corta.' },
  { feature: 'email-generar', costoUsd: 0.01075, origen: 'estimado', n: 0, porque: 'Un email de nutrición entero.' },
  { feature: 'wa-advisor', costoUsd: 0.007, origen: 'estimado', n: 0, porque: 'Sugerir la respuesta a un lead: lee la conversación y la ficha.' },
  { feature: 'wa-advisor-chat', costoUsd: 0.007, origen: 'estimado', n: 0, porque: 'Conversar con MaKo sobre el lead: por turno, con el mismo contexto.' },
  { feature: 'wa-template', costoUsd: 0.00135, origen: 'estimado', n: 0, porque: 'Generar una plantilla: una reescritura corta.' },
  { feature: 'marca-leer', costoUsd: 0.00762, origen: 'medido', n: 94, porque: 'Media del Archivero leyendo un documento, medida en producción: leer un manual de marca es ese mismo trabajo.' },
  { feature: 'chat-agent-variantes', costoUsd: 0.00135, origen: 'estimado', n: 0, porque: 'Variantes de un mensaje: reescrituras cortas.' },
  { feature: 'chat-agent-handoff', costoUsd: 0.00038, origen: 'estimado', n: 0, porque: 'Decidir si pasa a un humano: una pasada corta.', automatica: true },
  { feature: 'chat-agent-clasificar', costoUsd: 0.00038, origen: 'estimado', n: 0, porque: 'Clasificar un mensaje entrante: pasada corta.', automatica: true },
  { feature: 'chat-agent-voz-preguntas', costoUsd: 0.00135, origen: 'estimado', n: 0, porque: 'Las preguntas para sacar la voz del negocio.' },
  { feature: 'chat-agent-voz-segmentar', costoUsd: 0.00135, origen: 'estimado', n: 0, porque: 'Segmentar lo que dijo: pasada corta.' },
  { feature: 'setting-guion-audio', costoUsd: 0.00135, origen: 'estimado', n: 0, porque: 'El guion para leer al grabar: texto corto.' },
  { feature: 'setting-simulador', costoUsd: 0.00712, origen: 'estimado', n: 0, porque: 'El simulador conversa haciendo de lead: por turno, como un análisis.' },
  { feature: 'setting-ensayo', costoUsd: 0.00712, origen: 'estimado', n: 0, porque: 'Un ensayo es una conversación entera contra el setter.' },
  { feature: 'setting-criterio', costoUsd: 0.00135, origen: 'estimado', n: 0, porque: 'El criterio del setter: una pasada sobre lo que se le dijo.' },
  { feature: 'setting-calificar', costoUsd: 0.00135, origen: 'estimado', n: 0, porque: 'Calificar un lead: pasada corta.', automatica: true },
  { feature: 'setting-sugerencias', costoUsd: 0.00135, origen: 'estimado', n: 0, porque: 'Sugerencias sobre la jugada: pasada corta.' },
  { feature: 'setting-onboarding-contexto', costoUsd: 0.00135, origen: 'estimado', n: 0, porque: 'El contexto que el setter necesita: pasada corta.' },
  { feature: 'chatbot-crear-ia', costoUsd: 0.00504, origen: 'estimado', n: 0, porque: 'Crear una automatización entera con IA.' },
  { feature: 'chatbot-paso-ia', costoUsd: 0.00135, origen: 'estimado', n: 0, porque: 'Un paso suelto del lienzo.' },
  { feature: 'automations-ai-step-armar', costoUsd: 0.00504, origen: 'estimado', n: 0, porque: 'Armar el AI Step: lee el objetivo y escribe la instrucción.' },
  { feature: 'automations-ai-step-ensayo', costoUsd: 0.00712, origen: 'estimado', n: 0, porque: 'Ensayar el AI Step contra un caso.' },
  { feature: 'automations-ai-step-objeciones', costoUsd: 0.00135, origen: 'estimado', n: 0, porque: 'Las objeciones del paso: lista corta.' },
  { feature: 'retargeting-semanal', costoUsd: 0.00504, origen: 'estimado', n: 0, porque: 'La tanda semanal de retargeting.', automatica: true },

  // ── Simples ──────────────────────────────────────────────────────────────
  { feature: 'validador', costoUsd: 0, origen: 'medido', n: 21, porque: 'Cero medido: validar una plantilla contra las reglas de Meta rutea gratis.', automatica: true },
  { feature: 'avisos', costoUsd: 0, origen: 'estimado', n: 0, porque: 'Redactar un aviso del semáforo: una línea. Rutea gratis como el resto de las simples.', automatica: true },
  { feature: 'ads-rename', costoUsd: 0, origen: 'estimado', n: 0, porque: 'Ordenar nombres de campañas: una lista, sin juicio.' },
  { feature: 'onboarding-extract', costoUsd: 0.00038, origen: 'estimado', n: 0, porque: 'Extraer campos del onboarding de lo que la persona escribió.' },
  { feature: 'persona', costoUsd: 0.00135, origen: 'estimado', n: 0, porque: 'Armar la persona del negocio en el onboarding.' },
  { feature: 'personalidad', costoUsd: 0.00135, origen: 'estimado', n: 0, porque: 'La personalidad de la marca en el onboarding.' },
  { feature: 'avatares', costoUsd: 0.00135, origen: 'estimado', n: 0, porque: 'Proponer los avatares desde el brief.' },
  { feature: 'razones', costoUsd: 0.00135, origen: 'estimado', n: 0, porque: 'Las razones de compra de cada avatar.' },
  { feature: 'entregable', costoUsd: 0.00135, origen: 'estimado', n: 0, porque: 'El entregable del onboarding.' },
  { feature: 'ia-barata', costoUsd: 0.00038, origen: 'estimado', n: 0, porque: 'La IA barata genérica: lo que llama sin declarar feature propia.' },
  { feature: 'extract-contract', costoUsd: 0.00135, origen: 'estimado', n: 0, porque: 'Extraer los campos de un contrato.' },
  { feature: 'extract-deal-fiscal', costoUsd: 0.00135, origen: 'estimado', n: 0, porque: 'Extraer los datos fiscales de un trato.' },
  { feature: 'extract_fiscal', costoUsd: 0.00135, origen: 'estimado', n: 0, porque: 'La versión con guiones bajos del mismo trabajo fiscal (dos nombres para lo mismo: ver el aviso del vocabulario, abajo).' },
  { feature: 'extract_receipt', costoUsd: 0.00135, origen: 'estimado', n: 0, porque: 'Extraer los campos de un comprobante.' },
  { feature: 'leer_comprobante', costoUsd: 0.00135, origen: 'estimado', n: 0, porque: 'Leer la imagen de un comprobante de pago: una imagen por pasada.' },
  { feature: 'Importar leads', costoUsd: 0.00135, origen: 'estimado', n: 0, porque: 'Entender las columnas de un archivo de leads: una pasada sobre la cabecera y una muestra.' },
  { feature: 'probar-clave', costoUsd: 0.00009, origen: 'estimado', n: 0, porque: 'Probar que una clave contesta: el pedido más chico posible.' },

  // ── El Archivero y el Second Brain ───────────────────────────────────────
  { feature: 'El Archivero', costoUsd: 0.00762, origen: 'medido', n: 94, porque: 'Media del Archivero resumiendo un documento, medida en producción sobre 94 llamadas. Es la misma medición que `marca-leer`.' },
  { feature: 'second_brain_buscar', costoUsd: 0.00135, origen: 'estimado', n: 0, porque: '«Buscar con MaKo» en el Second Brain: una pasada sobre lo que trajo la búsqueda, no sobre el archivo entero.' },

  // ── Las ÁREAS de la API de MaKo ──────────────────────────────────────────
  // ⚠️ Estas cinco no son acciones: son los nombres de ÁREA con los que la API de MaKo etiqueta su gasto
  // (lib/api-mako/areas/*). Una llamada de un área hace el trabajo de la feature que tenga adentro, así que el número es
  // el de una pasada media; si alguna se vuelve caro, se parte en features propias.
  { feature: 'Automations', costoUsd: 0.00504, origen: 'estimado', n: 0, porque: 'Área de la API de MaKo: armar o tocar una automatización.' },
  { feature: 'Dashboard', costoUsd: 0.00504, origen: 'estimado', n: 0, porque: 'Área de la API de MaKo: lo que pide el Dashboard.' },
  { feature: 'Video Generator', costoUsd: 0.00504, origen: 'estimado', n: 0, porque: 'Área de la API de MaKo: el TEXTO del Video Generator. Los segundos de video se cobran aparte, como medios.' },
  { feature: 'Image', costoUsd: 0.00135, origen: 'estimado', n: 0, porque: 'Área de la API de MaKo: el TEXTO del editor de imágenes. Las imágenes se cobran aparte, como medios.' },
  { feature: 'Copywriting', costoUsd: 0.00504, origen: 'estimado', n: 0, porque: 'Área de la API de MaKo: escribir una pieza. Se tarifa como un guion de anuncio.' },
  { feature: 'AI Step · nota de voz', costoUsd: 0.00067, origen: 'publicado', n: 0, porque: 'La nota de voz que llega a un AI Step: precio de lista del STT.', automatica: true },

  // ── Transcribir (lo que Martín nombró el 15/11) ──────────────────────────
  // Martín, 15/11: «Lo mismo con la generación de transcripciones». El STT cobra por SEGUNDOS de audio, no por tokens:
  // `recordSttUsage` ya calcula el costo real, y el medidor lo liquida igual que el texto.
  { feature: 'MaKo · nota de voz', costoUsd: 0.00067, origen: 'publicado', n: 0, porque: 'Precio de lista del STT (whisper-1, US$0,006/min) por los ~7 s de una nota corta. El costo real lo mide `recordSttUsage` por segundo.' },
  { feature: 'stt-nota-voz', costoUsd: 0.00067, origen: 'publicado', n: 0, porque: 'Igual que la nota de voz de MaKo: precio de lista del STT.' },
  { feature: 'Llamada grabada · transcribir', costoUsd: 0.0108, origen: 'publicado', n: 0, porque: 'Una llamada de venta son ~30 min de audio al precio de lista del STT. Es la transcripción más cara que corre.' },
  { feature: 'MaKo en WhatsApp · adjunto', costoUsd: 0.00135, origen: 'estimado', n: 0, porque: 'Leer una foto o un PDF que llegó por WhatsApp: una imagen o unas páginas por pasada.' },
];

/**
 * Lo que cuesta una feature que NO está en la tabla.
 *
 * ⚠️ FALLA CERRADA Y ÉSE ES EL PUNTO: lo que no está mapeado **cobra**, no corre gratis. Una feature nueva se escribe y se
 * despliega sin que nadie se acuerde de esta tabla; si el default fuera 0, cada feature nueva sería un agujero en la caja
 * abierto el día del deploy y cerrado el día que alguien mire la factura. Con un default que cobra, lo peor que pasa es que
 * se reserve de más por un rato — y la liquidación con el costo REAL lo corrige en la misma llamada.
 *
 * El número es del orden de la media de las features MEDIDAS que no son `experimentos` (la outlier de Opus), redondeado
 * hacia arriba para quedar del lado de reservar de más.
 */
export const COSTO_POR_DEFECTO: CostoDeFeature = {
  feature: '(sin mapear)', costoUsd: 0.005, origen: 'estimado', n: 0,
  porque: 'Una feature que no está en la tabla: del orden de lo medido, redondeado hacia arriba. Cobra a propósito — lo que no cobra no se mide, y lo que no se mide se paga igual.',
};

const PORFEATURE: ReadonlyMap<string, CostoDeFeature> = new Map(COSTOS.map((c) => [c.feature, c]));

/** El costo de esa feature, o el default. Nunca null: toda llamada a un modelo tiene un costo. */
export function costoDeFeature(feature: string | null | undefined): CostoDeFeature {
  const f = (feature ?? '').trim();
  return (f ? PORFEATURE.get(f) : undefined) ?? COSTO_POR_DEFECTO;
}

/**
 * Lo que el medidor RESERVA antes de llamar a un modelo con esa feature, en MaKo Tokens.
 *
 * ⚠️ ES UNA ESTIMACIÓN Y NO PRETENDE SER EXACTA: el costo de una llamada de texto se sabe DESPUÉS, cuando el modelo
 * contesta y se cuentan sus tokens. Esto decide si la llamada ARRANCA; lo que se cobra al final es el costo real
 * (`liquidar`, lib/mako-tokens-medidor.ts). Por eso un estimado flojo no le cuesta plata a nadie.
 */
export const mtReservaDeFeature = (feature: string | null | undefined): number => mtDeUsd(costoDeFeature(feature).costoUsd);

/** Las features que la persona no dispara: si no alcanza, se saltea en silencio en vez de mostrarle un error. */
export const esAutomatica = (feature: string | null | undefined): boolean => costoDeFeature(feature).automatica === true;

// ─────────────────────────────────────────────────────────────────────────────
// LOS MEDIOS: acá el costo SÍ se sabe antes
// ─────────────────────────────────────────────────────────────────────────────
// Un segundo de video y una imagen tienen precio fijo por unidad, medido el 07/11/2026 contra el proveedor. O sea que el
// medidor **cobra exacto antes de generar** y no hay nada que liquidar después. Es la diferencia de fondo con el texto, y
// por eso los medios se reservan y el texto se liquida.
//
// ⚠️ Y SE COBRAN POR INTENTO, NO POR PIEZA TERMINADA (regla de la tarifa, 09/08): se descuenta por segundo GENERADO. Si los
// fallidos no descontaran, cada pieza terminada costaría ~3× y la diferencia la pone la agencia.

export type AccionDeMedios = {
  readonly id: string;
  readonly label: string;
  /** Lo que cuesta UNA unidad, en USD. */
  readonly costoUsd: number;
  /** La unidad, para que la vitrina no mienta: «un segundo», «una imagen». */
  readonly unidad: string;
  readonly origen: OrigenDeCosto;
  readonly porque: string;
};

export const MEDIOS = (calidad: Calidad = 'normal'): readonly AccionDeMedios[] => [
  {
    id: 'video-segundo', label: 'Un segundo de video generado', costoUsd: USD_POR_SEGUNDO[calidad], unidad: 'un segundo', origen: 'publicado',
    porque: 'Medido el 07/11/2026 contra ApiMart con cuatro generaciones pagadas (seedance-2.0-mini, 720×1280). ⚠️ La versión anterior decía US$0,030 y estaba 28 % por debajo del costo real.',
  },
  {
    id: 'clip', label: 'Un clip de 10 segundos', costoUsd: USD_POR_CLIP, unidad: 'un clip', origen: 'publicado',
    porque: 'Medido el 07/11/2026. 10 s es el tope de Omni Flash y el más barato POR SEGUNDO: el modelo cobra US$0,15 fijos + US$0,025 por segundo, así que partir una pieza en clips cortos la encarece sin que nadie lo note.',
  },
  {
    id: 'imagen', label: 'Generar una imagen', costoUsd: USD_POR_IMAGEN[calidad], unidad: 'una imagen', origen: 'publicado',
    porque: 'FLUX.2 dev en calidad normal, GPT Image 2 medium en premium (lib/mako-tokens-reglas.ts).',
  },
  {
    id: 'carrusel', label: 'Un carrusel de 7 imágenes', costoUsd: USD_POR_IMAGEN[calidad] * 7, unidad: 'un carrusel', origen: 'publicado',
    porque: 'Siete veces una imagen, al precio medido del 07/11. ⚠️ La tabla de agosto decía US$0,238 (≈US$0,034 por imagen) con otro modelo de imagen: ése es el número viejo.',
  },
];

/** Lo que cuesta, en MT, generar `segundos` de video. Pasa derecho a `mtDeVideo`: la aritmética vive en las reglas. */
export const mtDeSegundosDeVideo = mtDeVideo;
/** Lo que cuesta, en MT, generar `cuantas` imágenes. */
export const mtDeCuantasImagenes = mtDeImagenes;

// ─────────────────────────────────────────────────────────────────────────────
// LA VITRINA: lo que se puede dibujar en /planes
// ─────────────────────────────────────────────────────────────────────────────

export type FilaDeVitrina = {
  /** Qué acción, en palabras de la persona. */
  readonly label: string;
  /** Cuántos MaKo Tokens. */
  readonly mt: number;
  /** La unidad de ese número: «una llamada», «un segundo», «una imagen». */
  readonly unidad: string;
  /** El costo real detrás, para poder mostrarlo en dólares. */
  readonly costoUsd: number;
  readonly origen: OrigenDeCosto;
  /** De dónde salió el número, en una línea. */
  readonly porque: string;
  /** El grupo de `CATALOGO_MODELOS` («MaKo», «Análisis», «Copywriting», «Simples», «STT») o «Medios». */
  readonly grupo: string;
  /** La persona no la dispara: un cron o un webhook. */
  readonly automatica: boolean;
};

const DEL_CATALOGO: ReadonlyMap<string, { grupo: string; label: string }> = new Map(
  CATALOGO_MODELOS.map((f) => [f.feature, { grupo: f.grupo, label: f.label }]),
);

/**
 * Todas las acciones de IA con su costo en MT, listas para dibujar. **Ordenadas de más caro a más barato**: lo que importa
 * mirar primero es dónde se va el cupo.
 *
 * ⚠️ Un MT de esta lista NO es un precio: es un costo. Lo que se COBRA aparte vive en `mako-tokens-paquetes.ts`.
 */
export function vitrinaDeCostos(calidad: Calidad = 'normal'): readonly FilaDeVitrina[] {
  const texto: FilaDeVitrina[] = COSTOS.map((c) => {
    const d = DEL_CATALOGO.get(c.feature);
    return {
      label: d?.label ?? c.feature,
      mt: mtDeUsd(c.costoUsd),
      unidad: 'una llamada',
      costoUsd: c.costoUsd,
      origen: c.origen,
      porque: c.porque,
      grupo: d?.grupo ?? 'Otras',
      automatica: c.automatica === true,
    };
  });
  const medios: FilaDeVitrina[] = MEDIOS(calidad).map((m) => ({
    label: m.label, mt: mtDeUsd(m.costoUsd), unidad: m.unidad, costoUsd: m.costoUsd,
    origen: m.origen, porque: m.porque, grupo: 'Medios', automatica: false,
  }));
  return [...medios, ...texto].sort((a, b) => b.mt - a.mt || a.label.localeCompare(b.label, 'es'));
}

/** Las features declaradas en el catálogo que todavía no tienen costo propio. El test las exige en cero. */
export const featuresSinCosto = (): readonly string[] =>
  CATALOGO_MODELOS.map((f) => f.feature).filter((f) => !PORFEATURE.has(f));

/**
 * Las filas de esta tabla que el catálogo NO declara.
 *
 * ⚠️ NO ES UN ERROR DE ESTA TABLA, es el catálogo que quedó corto: medido el 15/11/2026, el código usa **117** `feature`
 * distintas y `CATALOGO_MODELOS` declara **68**. Las otras 49 llaman a un modelo sin declarar qué modelo usan, así que el
 * override por feature de /admin no las alcanza. Queda anotado en docs/hallazgos-mako-tokens.md; acá se exporta para que
 * el número se pueda mirar sin volver a medirlo a mano.
 */
export const costosFueraDelCatalogo = (): readonly string[] =>
  COSTOS.map((c) => c.feature).filter((f) => !DEL_CATALOGO.has(f));

/**
 * ⚠️ EL VOCABULARIO DE `feature` NO ESTÁ NORMALIZADO, y es una trampa para quien agregue una fila acá. Conviven cuatro
 * formas: kebab (`mako-doer-in`), snake (`second_brain_buscar`), rótulos con mayúscula y espacios (`El Archivero`,
 * `Importar leads`) y rótulos con separador (`MaKo · nota de voz`). Y hay pares que son lo mismo con dos nombres
 * (`extract-deal-fiscal` / `extract_fiscal`). El costo se busca por igualdad EXACTA de string, así que una fila escrita
 * «como debería llamarse» no matchea nada y esa feature cae al default sin que nada avise. Antes de agregar una fila:
 * `grep -rn "feature: '<lo que sea>'" app/ lib/`.
 */
export const FORMAS_DE_FEATURE = ['kebab-case', 'snake_case', 'Rótulo con espacios', 'Rótulo · con separador'] as const;
