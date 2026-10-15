// =============================================================================
// avisos-catalogo — la biblioteca de VOZ de MaKo para los avisos al dueño
// =============================================================================
// Catálogo exhaustivo de TODO lo que MaKo le puede decir al dueño por WhatsApp:
// reportes, avisos, acciones sugeridas y preguntas. Cada entrada trae un ejemplo
// con datos de muestra (sirve de plantilla + de demo). Es DATA PURA (sin
// server-only ni imports de server) para poder usarse desde la app y desde
// scripts de prueba. La detección real vive en el código (barata/determinística);
// la IA solo redacta la voz — este catálogo es el molde de esa voz.
//
// Derivado del mapa multiagente (workflow mako-avisos-discovery, 131 casos → ~48).

export type CategoriaAviso = 'reporte' | 'aviso' | 'accion' | 'pregunta';
/**
 * @deprecated Es el Semáforo escrito con OTRAS palabras: donde el canónico dice
 * `ambar` y `gris`, éste dice `amarillo` y `na`. El tipo bueno es `Semaforo` de
 * lib/mako-gramatica.ts.
 *
 * No se renombra todavía porque estos valores están ESCRITOS en las ~48 filas
 * de CATALOGO_AVISOS de abajo, y cambiarlos es una migración aparte. Para leer
 * uno y pintarlo, pasalo por `normalizarSemaforo()`: acepta las dos escrituras.
 */
export type SemaforoAviso = 'verde' | 'amarillo' | 'rojo' | 'na';
export type PrioridadAviso = 'alta' | 'media' | 'baja';
export type EstadoImplementacion = 'si' | 'parcial' | 'no';

import type { Flujo } from './flujos-tipos';

export type AvisoCatalogo = {
  /** slug estable; sirve de `tipo` en el feed y de key de dedup. */
  id: string;
  titulo: string;
  categoria: CategoriaAviso;
  prioridad: PrioridadAviso;
  semaforo: SemaforoAviso;
  /** true si MaKo espera un sí/no (acción) o una respuesta del dueño. */
  requiereRespuesta: boolean;
  /** estado de la LÓGICA que dispara este aviso (no del mensaje). */
  yaImplementado: EstadoImplementacion;
  /** disparador (evento/cron/umbral) que lo genera. */
  disparador: string;
  /**
   * Ejemplo con datos de muestra, en la voz de MaKo: español NEUTRO y con tú (decía «rioplatense»,
   * y ningún ejemplo vosea: el detector de voseo los barre). FICTICIO por regla: se dibuja en la
   * pantalla de todos (tests/variables-aviso.test.ts).
   */
  ejemplo: string;
  /**
   * EL TEXTO LO ARMA EL CÓDIGO (sexta tanda, General 15: «Hay plantillas que quedaron viejas…
   * que no tienen sentido»). `true` = TODO emisor de este aviso le pasa a `emitirDelCatalogo` un
   * `texto` armado con lo que midió (o lo manda `despacharReporte`, en los reportes), así que el
   * texto guardado de la plantilla NO SALE NUNCA: el `ejemplo` es una muestra de lo que llega.
   *
   * ⚠️ Medido el 09/10/2026: de los ocho avisos que edita un cliente («MaKo en WhatsApp» en
   * /automations), SIETE eran así, y la pantalla les ofrecía el editor de WhatsApp sobre un mensaje que
   * nunca se manda como está escrito. Sólo `cuota-vencida` usa la plantilla (`referenciaResuelta`).
   * Lo lee `seEditaElTexto` (la ruta del cliente y el editor), y lo fija
   * tests/plantillas-viejas.test.ts contra los emisores: un emisor que pase a usar la plantilla
   * tiene que sacar la marca, y uno que pase a mandar su texto tiene que ponerla.
   */
  textoDelCodigo?: true;
  /**
   * QUÉ ENTIDADES TRAE EL DISPARADOR DE ESTE AVISO. Ausente = ninguna.
   *
   * ⚠️ ES LO QUE DECIDE QUÉ DATOS OFRECE EL EDITOR, y no se puede deducir del
   * `disparador`, que es prosa. Hasta el 04/10/2026 el selector preguntaba
   * `disparador.tipo === 'evento'` del FLUJO, así que un aviso que lo dispara un cron
   * con el lead en la mano —la cobranza es el caso— mostraba los datos del CRM
   * apagados sobre un mensaje que sí podía resolverlos.
   *
   * Lo declara el catálogo y no la pantalla: el día que un cron nuevo aporte otra
   * entidad, el editor lo hereda sin tocarlo.
   */
  aporta?: ReadonlyArray<'lead' | 'cuota'>;
  /**
   * LA CADENCIA CON LA QUE NACE ESTE MENSAJE, si tiene una. Es un FLUJO como cualquier
   * otro —se dibuja en el lienzo y se edita ahí— y el día que alguien lo toque, lo que
   * guarda el store gana para siempre: esto es el default, no una plantilla que se
   * reaplique.
   *
   * ⚠️ VIVE EN EL CATÁLOGO Y NO EN UN SEED. Un seed corre una vez por workspace y deja
   * 10 copias que divergen; acá es el default de todos, así que mejorarlo mejora a todo
   * el que no lo editó — que es la misma razón por la que el TEXTO de un aviso se
   * hereda en vez de materializarse.
   */
  flujoPorDefecto?: Flujo;
  /**
   * EL CÓDIGO QUE EMITE ESTE AVISO CORRE TAMBIÉN SU FLUJO (`correrFlujoDe`, lib/flujos.ts), así que
   * sus pasos corren sin que nadie le elija un evento. Hoy, sólo `cuota-por-vencer` (app/api/cron/cobranza;
   * `cuota-vencida` lo tuvo hasta el 11/10/2026, cuando pasó a ser un evento de MaKo: lo que sale lo dice la
   * automatización del negocio, lib/aviso-evento.ts). Lo lee el lienzo (`grafoDeAviso`) para no dibujar como
   * rotos —«sólo corre con un evento»— los pasos que sí corren; lo fija tests/plantillas-viejas.test.ts
   * contra el único llamador.
   */
  correSuFlujo?: true;
  /**
   * CON QUÉ NACE UNA CUENTA NUEVA. Ausente = 'off'.
   *
   * ⚠️ El default era «todos prendidos», y por eso una cuenta nueva arrancaba
   * recibiendo quince mensajes distintos. El pedido del dueño, textual: «son
   * muchísimos, más de lo necesario… que por defecto cada cuenta traiga muy muy
   * poquitos y que los pueda configurar». Un aviso que llega sin que nadie lo
   * pidiera se apaga entero —el de Mauricio: «me llegan un chorro, ya desactivé
   * los otros»— y se lleva puesto al que sí importaba.
   *
   * · 'on'      → nace prendido. Sólo lo que EXIGE hacer algo hoy.
   * · 'off'     → nace apagado; está en la lista para prenderlo cuando se quiera.
   * · 'siempre' → no se puede apagar. Reservado para lo que avisa que MaKo se
   *   quedó CIEGO o MUDO: si eso se silencia, el resto de los números miente y
   *   el cliente no tiene cómo enterarse. Hoy es uno solo, y así debería seguir:
   *   cada 'siempre' nuevo es una decisión que le sacamos al dueño de su negocio.
   */
  porDefecto?: 'on' | 'off' | 'siempre';
};

// Emojis por categoría (para agrupar visualmente en la demo).
/**
 * LAS CUATRO CATEGORÍAS, en orden de lista.
 *
 * Existe porque la pantalla del detalle y las dos rutas necesitaban la MISMA lista
 * para ofrecerla y para validarla, y cada una la tenía escrita a mano: una quinta
 * categoría dejaría a la ruta rechazando lo que el desplegable ofrece, con la
 * pantalla contestando «categoría inválida» sobre una opción que ella misma pintó.
 */
export const CATEGORIAS_AVISO: readonly CategoriaAviso[] = ['reporte', 'aviso', 'accion', 'pregunta'] as const;

export const EMOJI_CATEGORIA: Record<CategoriaAviso, string> = {
  reporte: '📊', aviso: '🔔', accion: '⚡', pregunta: '❓',
};

// ─────────────────────────────────────────────────────────────────────────────
// El RÓTULO: de qué habla cada mensaje, en la primera línea
// ─────────────────────────────────────────────────────────────────────────────
// El dueño lo pidió con estas palabras: «muchas veces los mensajes se solapan
// porque son muchos, me gustaría implementar una metodología para que el cliente
// los diferencie fácilmente».
//
// El problema no es que sean largos: es que TODOS EMPIEZAN IGUAL. En la lista de
// WhatsApp se ve el arranque de cada uno, y si tres arrancan con un emoji suelto
// y una frase, hay que abrirlos para saber de qué son. La primera línea es lo
// ÚNICO que se lee sin abrir, así que ahí va de qué se trata.
//
// ⚠️ POR QUÉ EL ÁREA Y NO LA CATEGORÍA. `categoria` (reporte/aviso/acción/
// pregunta) describe la FORMA del mensaje, no su tema: al dueño le importa
// distinguir «esto es de una reunión» de «esto es de plata», no «esto es un
// aviso» de «esto es una pregunta». Con la categoría, catorce mensajes de temas
// distintos arrancarían con el mismo rótulo y no se habría arreglado nada.
//
// Se pinta en el choke point (`emitirAviso`), no en los call-sites: así lo toma
// TODO mensaje, incluidos los que nadie tocó y los que se creen mañana.

export type AreaAviso = 'reunion' | 'lead' | 'anuncios' | 'plata' | 'plan' | 'sistema' | 'reporte' | 'landing' | 'cliente';

/** Cómo se ve el rótulo de cada área. El emoji es el ancla visual; el texto, el desempate. */
export const ROTULO_AREA: Record<AreaAviso, { emoji: string; texto: string }> = {
  reunion:  { emoji: '🗓️', texto: 'REUNIÓN' },
  lead:     { emoji: '👤', texto: 'LEAD' },
  anuncios: { emoji: '📣', texto: 'ANUNCIOS' },
  plata:    { emoji: '💵', texto: 'PLATA' },
  plan:     { emoji: '📋', texto: 'PLAN' },
  sistema:  { emoji: '🔧', texto: 'SISTEMA' },
  reporte:  { emoji: '📊', texto: 'REPORTE' },
  // El código pegado en la página del cliente. Tiene área propia y no cae en
  // 'sistema' porque «🔧 SISTEMA» no le dice a nadie de qué le están hablando: la
  // acción es ir a la landing y volver a pegar algo, y el rótulo tiene que
  // anunciarlo desde la primera línea.
  landing:  { emoji: '🌐', texto: 'TU LANDING' },
  // Alguien que YA COMPRÓ (Customer Success). Área propia y no 'lead' a propósito: «👤 LEAD» le
  // dice al dueño que es alguien a quien venderle, y lo que hay que hacer con un cliente que se
  // enfría es otra cosa — atenderlo, no cerrarlo.
  cliente:  { emoji: '🤝', texto: 'CLIENTE' },
};

/**
 * Área de cada aviso del catálogo. Lo que NO está acá cae en 'sistema', que es
 * el default honesto: un mensaje sin área declarada es uno que nadie clasificó,
 * y es mejor que se vea como tal a que se disfrace de otra cosa.
 */
const AREA_POR_AVISO: Record<string, AreaAviso> = {
  'reporte-diario': 'reporte', 'reporte-horario': 'reporte', 'reporte-semanal': 'reporte',
  'cierre-mes': 'reporte', 'retro-lista': 'reporte',
  // El análisis del AI Analyst del Dashboard (lib/graficos-analisis-server.ts `avisarAnalisisListo`).
  'dashboard-analisis-listo': 'reporte',
  // El pedido de restablecer la contraseña (Seguridad, 15/10/2026): un mail a la persona, de la plataforma.
  'seguridad-contrasena-restablecer': 'sistema',

  'reunion-recordatorio': 'reunion', 'reunion-agenda-dia': 'reunion',
  'reunion-nuevo-agendado': 'reunion', 'reunion-cancelada': 'reunion',
  'reunion-ocurrio-fathom': 'reunion', 'reunion-no-show': 'reunion',
  // Las llamadas de la ENTREGA del curso (lib/curso-mensajes.ts, cron curso-sesiones).
  'curso-sesion-previa': 'reunion', 'curso-sesion-posterior': 'reunion',
  // La alerta de baja de Customer Success (#109, cron cs-sin-contacto).
  'cs-cliente-sin-contacto': 'cliente',
  // El recordatorio de clases (#780) habla de CLIENTES que no entran al portal, no de una
  // reunión: «👤 LEAD» le dice a Mauricio de qué le están hablando desde la primera línea.
  'curso-recordatorio-clases': 'lead',
  'reunion-compromisos-tareas': 'plan', 'reunion-tareas-al-plan': 'plan',
  'tareas-autocompletadas': 'plan', 'ads-grabaste': 'plan',
  'plan-proyecto-vence': 'plan',
  'avisos-resumen': 'reporte',

  'lead-formulario-meta': 'lead', 'wa-mensaje-entrante': 'lead',
  'wa-sin-responder': 'lead', 'nutricion-agotada': 'lead',
  'closing-objecion': 'lead',
  // Habla de un CONTACTO, no del sistema: el rótulo tiene que decirle al dueño
  // de qué le están hablando desde la primera línea, y esto es «👤 LEAD».
  'lead-fusionado': 'lead',

  // ⚠️ `sistema` Y NO `anuncios`, aunque hable de videos. El rótulo dice DE QUÉ le
  // están hablando, y lo que hay que tocar acá no es una campaña: es la extensión
  // del navegador. «📣 ANUNCIOS» lo mandaría a mirar métricas; «🔧 SISTEMA» lo
  // manda a la herramienta, que es donde está el problema y la solución.
  'flow-puente-ausente': 'sistema',

  'meta-cuenta-frenada': 'anuncios', 'meta-cuenta-riesgo': 'anuncios',
  'meta-cuenta-recuperada': 'anuncios', 'meta-saldo-agotarse': 'anuncios',
  'meta-token-vencido': 'anuncios', 'meta-anuncio-rechazado': 'anuncios',
  'meta-anuncio-espera-aprobacion': 'anuncios', 'ad-fatiga': 'anuncios',
  'ad-cpl-disparado': 'anuncios', 'ad-ganador-escalar': 'anuncios',
  'ad-gastan-sin-leads': 'anuncios', 'ad-gasto-anomalo': 'anuncios',
  'ad-aprendizaje-limitado': 'anuncios', 'ad-cuenta-verde-sin-ads': 'anuncios',
  'leads-caida': 'anuncios', 'capi-cierres-no-reportados': 'anuncios',
  'script-ganador': 'anuncios', 'sugerir-experimento': 'anuncios',
  'drive-campana-armada': 'anuncios',

  'cuota-vencida': 'plata', 'cuota-por-vencer': 'plata',
  'pago-recibido': 'plata', 'cierre-venta': 'plata',
  'objetivo-en-riesgo': 'plata', 'meta-alcanzada': 'plata',
  // El recordatorio del Q va con el rótulo de PLATA y no de sistema: lo que se
  // planifica en un Quarter son los objetivos del negocio, no una tarea de la app.
  'quarter-planificar': 'plata',

  'tracking-apagado': 'landing', 'tracking-desactualizado': 'landing', 'lead-de-landing': 'landing',
  'prueba-grabada': 'landing',
  'landing-cambio': 'landing',
  'prueba-recibida': 'landing',
  'wa-desconectado': 'sistema', 'wa-reconectado': 'sistema',
  'nutricion-frenada': 'sistema',
  'datos-sin-marcar': 'sistema', 'cron-ingesta-fallo': 'sistema',
  'saldo-ia-bajo': 'sistema', 'accion-confirmada': 'sistema',
  'lead-no-confirmo': 'lead',
  // El «Avisarme» de una automatización (la acción `avisar_al_equipo`, y la rama «Otra cosa» de
  // «Si responde», que reemplazó al hand-off): siempre habla de un lead.
  'chatbot-aviso-equipo': 'lead',
  // Habla de los leads que se quedaron quietos, no del motor que los movió: el rótulo
  // tiene que decirle al dueño de qué le están hablando desde la primera línea.
  'crm-lead-estancado': 'lead',
  'crm-lead-quieto': 'lead',
};

export function areaDeAviso(id: string): AreaAviso {
  return AREA_POR_AVISO[id] ?? 'sistema';
}

/**
 * La primera línea del mensaje. Las barras no son decoración: en WhatsApp son lo
 * que corta visualmente un mensaje del anterior cuando llegan cuatro seguidos.
 */
export function encabezadoAviso(id: string): string {
  const { emoji, texto } = ROTULO_AREA[areaDeAviso(id)];
  return `━━ ${emoji} ${texto} ━━`;
}

/**
 * LOS ÚNICOS AVISOS QUE VE UN CLIENTE. Lista blanca, elegida a mano por el dueño
 * el 28/09/2026, y el criterio fue suyo: «mejor si los usuarios tienen pocas
 * opciones, así no confunde».
 *
 * ⚠️ ES UNA LISTA BLANCA Y NO UNA MARCA POR ENTRADA, a propósito. Marcar las
 * ~29 que NO van obliga a acordarse de marcar cada aviso nuevo, y el que se
 * olvide aparece en la pantalla de todos los clientes sin que nadie lo haya
 * decidido. Al revés falla del lado seguro: un aviso nuevo no se ve hasta que
 * alguien lo agregue acá a propósito.
 *
 * Lo que NO está en esta lista se sigue emitiendo igual — lo gobierna la agencia
 * desde /mensajes, que ve el catálogo completo. Lo que desaparece es la fila que
 * el cliente tendría que configurar, no el aviso.
 *
 * ⛔ DESDE EL 11/10/2026 ESTÁ VACÍA, y es la decisión, no un olvido. Martín: «Te pedí que la parte de
 * WhatsApp de MaKo sea exactamente igual y siguen muchas cosas diferentes… quedaron cosas muy viejas
 * que quiero que las depreques. Todo ahora es lo mismo». Los tres mensajes que un cliente veía acá
 * («media hora antes de la reunión», «un lead te escribió» y «cuota vencida») son AUTOMATIZACIONES de
 * la tab Automations: una fila de `nutricion_secuencias` con el CRON «Evento de MaKo» (`aviso_mako`),
 * que el negocio agrega desde la GALERÍA (lib/plantillas-automatizaciones.ts, `esPlantillaMako`) y que
 * nace vacía para todos («Todos arrancan vacíos»). Los emite `emitirPorEvento` (lib/aviso-evento.ts):
 * su store ya no se lee. El diseño entero, en docs/diseno-mako-en-whatsapp-unificado.md.
 *   · `reporte-semanal` NO se mudó: sale sólo por email (`notification_prefs`, decisión del 10/10:
 *     «Apagar WhatsApp en los reportes») y pasó a `AVISOS_SOLO_SUPERADMIN`, abajo.
 *   · `lead-no-confirmo` había salido el 09/10/2026 (lo emite el desenlace de una automatización de
 *     ANTES, que ya no corre ninguna); la grabación de Fathom y los dos de la línea de WhatsApp, el
 *     10/10/2026, a `AVISOS_SOLO_SUPERADMIN`.
 * Si algún día vuelve un mensaje del cliente que NO sea un evento, se agrega acá: es una línea.
 */
export const AVISOS_DEL_CLIENTE: readonly string[] = [];

export const esAvisoDelCliente = (id: string): boolean => AVISOS_DEL_CLIENTE.includes(id);

/**
 * LOS AVISOS QUE CONFIGURA SÓLO EL SUPER ADMIN (desde /mensajes): el cliente no los ve en su lista, no los toca
 * por la API de su tab (`/api/perfil/plantillas` contesta 404) ni se los pide a MaKo (`configurar_aviso_whatsapp`).
 * Se siguen emitiendo igual. Martín, 10/10/2026: «hay ciertos mensajes que no deberían configurarse del lado del
 * cliente, solo de SuperAdmin, como el de "Tu WhatsApp se desconectó"», y de la grabación: «El de Fathom también
 * debería ser algo que se configura en SuperAdmin».
 *
 * ⚠️ Esto REVIERTE lo del 09/10/2026 («las dos cosas»: que el cliente pudiera apagar el aviso de la caída). Lo que
 * un cliente ya hubiera apagado antes queda guardado en su store: el super admin lo ve y lo cambia desde /mensajes,
 * mirando ese negocio.
 *
 * Lista EXPLÍCITA y no «todo lo que no es del cliente»: el resto del catálogo lo puede silenciar el dueño
 * por MaKo a propósito (lib/api-mako/areas/equipo.run.ts, punto 5). Y no puede cruzarse con `AVISOS_DEL_CLIENTE`
 * (tests/avisos-solo-superadmin.test.ts).
 */
export const AVISOS_SOLO_SUPERADMIN: readonly string[] = [
  'wa-desconectado',        // se cayó su WhatsApp
  'wa-reconectado',         // y volvió
  'reunion-ocurrio-fathom', // terminó la reunión y quedó la grabación
  // El reporte de los lunes (11/10/2026): NO se mudó a «MaKo en WhatsApp» porque no sale por WhatsApp
  // (`REPORTE_POR_WHATSAPP = false`, decisión del 10/10) y sale como siempre, por email, según
  // `notification_prefs`. Sale de la lista del cliente y lo configura la agencia (docs/diseno-mako-en-whatsapp-unificado.md).
  'reporte-semanal',
];

export const esAvisoSoloSuperAdmin = (id: string): boolean => AVISOS_SOLO_SUPERADMIN.includes(id);

/** ¿El texto de este aviso lo arma el código? (`textoDelCodigo`). Un aviso propio del negocio, nunca. */
export const textoLoArmaElCodigo = (id: string): boolean =>
  CATALOGO_AVISOS.find((c) => c.id === id)?.textoDelCodigo === true;

/**
 * ¿Un CLIENTE puede editar el texto de este aviso? Sólo si es suyo (`AVISOS_DEL_CLIENTE`) y su texto
 * sale de la plantilla. UNA respuesta para las dos puntas: la ruta (`/api/perfil/plantillas`, que
 * contesta 403) y el editor (`TemplateDetalleModal`, que no ofrece el campo). Con dos copias, la
 * pantalla ofrecería un editor que la ruta rechaza — o al revés, que es lo que pasaba: un editor que
 * la ruta ACEPTABA sobre un texto que nadie manda.
 * Desde el 11/10/2026 `AVISOS_DEL_CLIENTE` está vacía, así que contesta `false` para todo aviso del
 * catálogo: lo que el negocio escribe de «MaKo en WhatsApp» vive en las tarjetas de sus automatizaciones.
 */
export const seEditaElTexto = (id: string): boolean => esAvisoDelCliente(id) && !textoLoArmaElCodigo(id);

/** ¿El código que emite este aviso corre también su flujo? (`correSuFlujo`). */
export const correSuFlujo = (id: string): boolean =>
  CATALOGO_AVISOS.find((c) => c.id === id)?.correSuFlujo === true;

export const CATALOGO_AVISOS: AvisoCatalogo[] = [
  // ⚠️ DOS QUE SE DISPARAN DE VERDAD Y NO ESTABAN ACÁ. Los avisos en vivo
  // (AVISOS_WA_EN_VIVO en lib/notif-catalogo.ts) tienen que existir en este
  // catálogo: es de acá que salen la lista de «Los mensajes, como llegan», su
  // texto editable y su interruptor. Al quedar UNA sola pantalla, un aviso que
  // sale pero no figura acá es un aviso que nadie puede leer, editar ni apagar.
  {
    id: 'plan-proyecto-vence', titulo: 'Proyectos atrasados o por vencer', categoria: 'aviso',
    prioridad: 'media', semaforo: 'amarillo', requiereRespuesta: false, yaImplementado: 'si',
    disparador: 'Un mensaje por día con todos los proyectos vencidos o por vencer, y solo si cambió algo desde el anterior.',
    ejemplo: `📁 *Proyectos que piden atención*

🔴 *Landing nueva* — venció hace 3 días
🟡 *Campaña de agosto* — vence mañana

Si alguno ya no va, quítale la fecha y dejo de insistir. — MaKo`,
  },
  {
    id: 'avisos-resumen', titulo: 'El resumen de la mañana', categoria: 'reporte',
    prioridad: 'media', semaforo: 'na', requiereRespuesta: false, yaImplementado: 'si',
    disparador: 'A la mañana, junta en UN mensaje los avisos que no eran urgentes y esperaron en la cola. Apagarlo NO los devuelve al momento: los deja sin salir.',
    ejemplo: `🌅 *Mientras no mirabas* — 3 cosas

• Se cerraron 2 tareas que ya estaban hechas.
• La retro de la semana quedó lista.
• Un proyecto vence mañana.

Nada urgente, por eso esperaron. — MaKo`,
  },

  // ── REPORTES (digest por cron) ─────────────────────────────────────────────
  {
    id: 'reporte-diario', titulo: 'Reporte diario matutino', categoria: 'reporte',
    prioridad: 'media', semaforo: 'na', requiereRespuesta: false, yaImplementado: 'si',
    disparador: 'Cron diario a la mañana temprano (hora local del workspace): semáforo + ads de ayer + wins + pendientes.',
    ejemplo: `📊 *Reporte del día* — 14/07\n\n🟢 *Cuenta Meta:* activa · saldo $120 · gastado $8.300 MXN\n*Ads (ayer):* $95 · 14 leads · CPL $6,8 · CTR 1,9%\n*Wins:* 3/10 cierres · cash $4.200 del mes\n*Pendientes:* 2 datos sin marcar · 0 cuotas vencidas\n\nArranca el día con esto. — MaKo`,
  },
  {
    id: 'reporte-horario', titulo: 'Reporte horario "lo urgente" (8–21h)', categoria: 'reporte',
    prioridad: 'alta', semaforo: 'na', requiereRespuesta: false, yaImplementado: 'si',
    disparador: 'Cron cada hora; solo despacha si hay algo urgente.',
    ejemplo: `⏰ *Lo urgente* — 14/07\n\n🔴 Cuenta Meta: saldo impago, entrega frenada.\n💸 2 cuotas vencidas — $3.400 por cobrar.\n📉 3 conjuntos con fatiga.\n\nOjo con esto apenas puedas. — MaKo`,
  },
  {
    id: 'reporte-semanal', titulo: 'Reporte semanal (lunes)', categoria: 'reporte', porDefecto: 'on',
    prioridad: 'media', semaforo: 'na', requiereRespuesta: false, yaImplementado: 'si',
    // El cuerpo lo arma `buildReporteSemanal` (lib/reportes.ts) con los números de la semana y lo
    // manda `despacharReporte`: no lee esta plantilla (era la «cola» «El texto de un REPORTE no
    // llega al mail» de /admin/dev/configuraciones).
    textoDelCodigo: true,
    // La primera oración es lo que dibuja la tarjeta CRON («Hoy sale solo: …», `disparadorCorto`):
    // decía «Cron los lunes…», o sea el nombre de la pieza y no el momento.
    // ⚠️ NO «EN LA HORA DEL NEGOCIO» (revisión del ws9, 10/10/2026): el cron corre a las 14:20 UTC para todos
    // (vercel.json, `20 14 * * 1`) y `buildReporteSemanal` corta la semana con la hora de Tijuana. En Buenos
    // Aires llega 11:20. Si el reporte pasa a la zona de cada negocio (`tzDeWorkspace`), esto se cambia.
    disparador: 'Los lunes a la mañana, hora de Tijuana: ads, cierres, CAC, cash y ritmo a la meta.',
    ejemplo: `🗓️ *Reporte semanal* — 07/07 al 13/07\n\n*Ads:* $640 · 92 leads · CPL $6,9 · 4 cierres · CAC $160\n*Cash de la semana:* $12.800\n*Objetivo:* 8/12 cierres · ~6 semanas para la meta\n\nVienes bien. — MaKo`,
  },
  {
    id: 'cierre-mes', titulo: 'Cierre de mes', categoria: 'reporte',
    prioridad: 'media', semaforo: 'na', requiereRespuesta: true, yaImplementado: 'no',
    disparador: 'Cron mensual (falta crear) el día 1.',
    ejemplo: `📅 *Cierre de junio*\n\nCash: $48.200 (+18% vs mayo)\nCierres: 11/10 ✅ · CAC $175\nMejor anuncio: "Carrusel resultados" (CPL $4,1)\nPeor: "Reel precio" (CPL $19, para apagar)\n\n¿Te armo el plan de julio? — MaKo`,
  },

  // ── EL PUENTE DE FLOW ──────────────────────────────────────────────────────
  {
    id: 'flow-puente-ausente', titulo: 'El navegador dejó de tomar los videos', categoria: 'aviso',
    prioridad: 'alta', semaforo: 'rojo', requiereRespuesta: false, yaImplementado: 'si',
    // ⚠️ ES EL PRIMER AVISO DE FLOW QUE EXISTE. Hasta hoy no había NINGUNO: un
    // puente que se moría no le avisaba a nadie, ni al cliente ni a nosotros, y
    // la única señal era un clip que se generaba para siempre en una pantalla que
    // alguien tenía que estar mirando.
    disparador: 'Cron cada 10 min: hay trabajos `pendiente` que nadie tomó en 12 minutos (`flow_cerrar_abandonados`).',
    ejemplo: `🔴 Tus videos no se están generando: tu navegador dejó de responder y quedaron *3 tomas* sin tomar.

Abre la extensión de MaKo y toca *Conectar*. Las tomas no se cobraron: cuando vuelvas, las vuelves a mandar. — MaKo`,
  },

  // ── CUENTA / SALUD DE META (semáforo) ──────────────────────────────────────
  {
    id: 'meta-cuenta-frenada', titulo: 'Cuenta Meta deshabilitada / entrega frenada', categoria: 'aviso', porDefecto: 'on',
    prioridad: 'alta', semaforo: 'rojo', requiereRespuesta: false, yaImplementado: 'si',
    // ⚠️ ESTE AVISO INSISTE. No lo manda `emitirDelCatalogo` una vez: lo repite
    // `lib/alerta-critica.ts` cada 10-20 minutos MIENTRAS la entrega siga
    // frenada, con el texto subiendo de tono y el contador de tiempo perdido.
    // El `ejemplo` de acá es la PRIMERA vez; las siguientes son más cortas.
    // Editar este texto no cambia el de la insistencia (un mensaje de emergencia
    // no se reescribe cada quince minutos) — se toca en alerta-critica.ts.
    disparador: 'Cron alerta-critica: revisa cada 10 min y AVISA cada 1 hora mientras haya un incidente ABIERTO en service_incidents con entrega frenada o severidad roja (detectar rápido e insistir seguido son dos cosas distintas). Se repite hasta que se resuelva; al resolverse sale meta-cuenta-recuperada. Si dos workspaces comparten la misma cuenta publicitaria, avisa UNA vez.',
    ejemplo: `━━ 📣 ANUNCIOS ━━
🚨🚨🚨 *DETÉN TODO* 🚨🚨🚨

⛔ Tu cuenta publicitaria está *SUSPENDIDA POR FALTA DE PAGO*.
🛑 Hace *35 min* que no corre un solo anuncio.

💸 *Cada minuto que pasa es plata tirada:*
❌ No entra *ningún* lead nuevo.
❌ El día perdido no se recupera.

✅ *QUÉ HACER:* Paga el saldo que debes en el Business Manager de Meta.

👉 *RESUÉLVELO YA:*
https://hola-mako.com/integraciones

🔁 Te voy a seguir avisando hasta que esté arreglado. — MaKo`,
  },
  {
    id: 'meta-cuenta-riesgo', titulo: 'Cuenta Meta en revisión de riesgo (ámbar)', categoria: 'aviso',
    prioridad: 'media', semaforo: 'amarillo', requiereRespuesta: false, yaImplementado: 'parcial',
    disparador: 'account_status ∈ {7,8,9}.',
    ejemplo: `🟡 Ojo: tu cuenta de Meta entró en *revisión de riesgo*. Todavía entrega, pero no toques nada raro estos días (no subas presupuestos de golpe ni cambies muchos anuncios). Te aviso si escala a rojo. — MaKo`,
  },
  {
    id: 'meta-cuenta-recuperada', titulo: 'Cuenta Meta recuperada (volvió a verde)', categoria: 'aviso',
    prioridad: 'baja', semaforo: 'verde', requiereRespuesta: false, yaImplementado: 'si',
    // Es la contracara de la insistencia y por eso NO es opcional: si MaKo
    // persiguió veinte veces y después se calla, el dueño no sabe si dejó de
    // avisar porque se resolvió o porque el aviso se rompió.
    disparador: 'Cron alerta-critica: el incidente que se venía persiguiendo pasó a resuelto.',
    ejemplo: `━━ 📣 ANUNCIOS ━━
✅✅ *LISTO, YA ESTÁ ENTREGANDO* ✅✅

🟢 Tu cuenta publicitaria volvió a la normalidad.
🔕 Dejo de insistir.

— MaKo`,
  },
  {
    id: 'meta-saldo-agotarse', titulo: 'Saldo por agotarse / problema de pago', categoria: 'aviso',
    prioridad: 'media', semaforo: 'amarillo', requiereRespuesta: false, yaImplementado: 'no',
    disparador: 'Proyección balance ÷ gasto-por-hora < horas restantes del día.',
    ejemplo: `🟡 Tu saldo en Meta está en *$3 USD*. Al ritmo de hoy se agota antes de la noche y se corta la entrega a mitad de campaña.\n\nCarga saldo o revisa el método de pago para no perder el envión. — MaKo`,
  },
  {
    id: 'meta-token-vencido', titulo: 'Token de Meta vencido (integración caída)', categoria: 'aviso',
    prioridad: 'alta', semaforo: 'rojo', requiereRespuesta: false, yaImplementado: 'no',
    disparador: 'graphGet() code 190 → MetaHealthTokenError.',
    // Mandaba a /configuraciones: las integraciones viven en /integraciones («Conectar con Meta»).
    ejemplo: `🔴 *Se venció tu conexión con Meta*. Dejé de poder leer tus campañas y el semáforo quedó ciego. Vuelve a conectarla en /integraciones para que todo vuelva a funcionar. — MaKo`,
  },
  {
    id: 'meta-anuncio-rechazado', titulo: 'Anuncio rechazado por políticas de Meta', categoria: 'aviso',
    prioridad: 'alta', semaforo: 'rojo', requiereRespuesta: false, yaImplementado: 'no',
    disparador: 'effective_status = DISAPPROVED / WITH_ISSUES.',
    ejemplo: `🔴 Meta *rechazó* el anuncio "Testimonio Ana - v3" por política de contenido. No está entregando.\n\nEdita el creativo o el copy y envíalo de nuevo a revisión. ¿Quieres que te diga qué suele disparar este rechazo? — MaKo`,
  },
  {
    id: 'meta-anuncio-espera-aprobacion', titulo: 'Meta retuvo el anuncio esperando tu aprobación', categoria: 'aviso', porDefecto: 'on',
    prioridad: 'alta', semaforo: 'amarillo', requiereRespuesta: false, yaImplementado: 'si',
    disparador: 'issues_info con error_code 2446984 ("peer approval") tras publicar desde MaKo. OJO: NO es rechazo de políticas — es un control de identidad y Meta NO lo deja aprobar por API.',
    ejemplo: `🟡 Publiqué *2 anuncios* en "029. Capta Dueños B2B" pero *Meta los retuvo*: por seguridad pide que un admin de la cuenta los apruebe a mano antes de que empiecen a correr.\n\nNo lo puedo hacer yo — Meta no lo permite por API. Son 30 segundos:\n\n👉 https://adsmanager.facebook.com/adsmanager/manage/ads?act=123&selected_ad_ids=456\n\nEntras, tocas *Revisar y publicar* y confirmas. Si no, quedan sin entregar. — MaKo`,
  },

  // ── ACCIONES SOBRE ADS (sugerencia + "¿lo hago?") ──────────────────────────
  {
    id: 'ad-fatiga', titulo: 'Conjunto con fatiga → pausar y rotar creativo', categoria: 'accion',
    prioridad: 'media', semaforo: 'amarillo', requiereRespuesta: true, yaImplementado: 'parcial',
    disparador: 'getFatigaAdsets (spend7d>$50, freq7d>3.5, CPL7d>1.5×CPL28d).',
    ejemplo: `📉 El conjunto "Retargeting 30d" está *fatigado*: frecuencia 4,8 y el CPL subió 40% en 5 días. La gente ya lo vio de más.\n\nTe recomiendo *pausarlo y rotar creativo*. ¿Lo pauso yo? — MaKo`,
  },
  {
    id: 'ad-cpl-disparado', titulo: 'CPL disparado en un anuncio → apagar', categoria: 'accion',
    prioridad: 'alta', semaforo: 'rojo', requiereRespuesta: true, yaImplementado: 'no',
    disparador: 'CPL de un ad > 3× promedio 7d del workspace, ≥2 días.',
    ejemplo: `🔴 El anuncio "Reel gancho precio" viene con un *CPL de $22* — el triple de tu promedio ($7). Está quemando plata sin traer leads buenos.\n\nTe sugiero *apagarlo*. ¿Lo hago? — MaKo`,
  },
  {
    id: 'ad-ganador-escalar', titulo: 'Anuncio ganador → escalar presupuesto', categoria: 'accion',
    prioridad: 'media', semaforo: 'verde', requiereRespuesta: true, yaImplementado: 'no',
    disparador: 'Ad/adset con CPL muy por debajo del promedio y volumen sostenido.',
    ejemplo: `🟢 Tu caballo ganador: "Carrusel resultados" trae leads a *$4,2* (muy por debajo del promedio) y con volumen.\n\nTe propongo *subirle el presupuesto 20%* para exprimirlo mientras rinde. ¿Le doy? — MaKo`,
  },
  {
    id: 'ad-gastan-sin-leads', titulo: 'Anuncios que gastan sin traer leads → apagar en lote', categoria: 'accion',
    prioridad: 'media', semaforo: 'rojo', requiereRespuesta: true, yaImplementado: 'no',
    disparador: 'Varios ads con spend > $80 USD y 0 leads en 7d.',
    ejemplo: `🧹 Encontré *4 anuncios* que gastan sin traer un solo lead en 7 días ($85 tirados). Te los puedo *pausar todos de una*. ¿Le doy? Te paso la lista antes si quieres revisar. — MaKo`,
  },
  {
    id: 'ad-gasto-anomalo', titulo: 'Gasto diario anómalo', categoria: 'aviso',
    prioridad: 'media', semaforo: 'amarillo', requiereRespuesta: false, yaImplementado: 'no',
    disparador: 'Gasto del día > 1.5× promedio diario 14d.',
    ejemplo: `🟡 Ojo con el gasto: llevas *$180 hoy* y tu promedio diario es $95. Algo se disparó (¿subiste un presupuesto sin querer?). Revísalo antes de que siga corriendo así toda la noche. — MaKo`,
  },
  {
    id: 'ad-aprendizaje-limitado', titulo: 'Conjunto en aprendizaje limitado', categoria: 'pregunta',
    prioridad: 'media', semaforo: 'amarillo', requiereRespuesta: true, yaImplementado: 'no',
    disparador: 'learning_stage_info.status = LEARNING_LIMITED.',
    ejemplo: `🟡 El conjunto "Frío intereses" quedó en *aprendizaje limitado*: no junta suficientes conversiones para que Meta optimice bien.\n\nOpciones: subir presupuesto, juntar conjuntos o ampliar público. ¿Te armo las 3 con números? — MaKo`,
  },
  {
    id: 'ad-cuenta-verde-sin-ads', titulo: 'Cuenta verde pero sin anuncios entregando', categoria: 'accion',
    prioridad: 'alta', semaforo: 'rojo', requiereRespuesta: true, yaImplementado: 'no',
    disparador: 'Cuenta activa pero 0 ads con effective_status=ACTIVE.',
    ejemplo: `🔴 Oye, tu cuenta está verde pero *no tienes ningún anuncio entregando* — todo está en pausa. Si no fue a propósito, estás perdiendo el día entero de leads. ¿Reactivo algo? — MaKo`,
  },
  {
    id: 'tracking-apagado', titulo: 'El Pixel de MaKo dejó de mandar datos', categoria: 'aviso', porDefecto: 'siempre',
    prioridad: 'alta', semaforo: 'rojo', requiereRespuesta: false, yaImplementado: 'si',
    // Nace de un caso real: el tracking del VSL estuvo MUERTO 18 días
    // (2026-07-15 → 08-03) con anuncios corriendo y 235 leads entrando a ritmo
    // normal. Ninguna señal de negocio lo detectó, porque los leads seguían
    // llegando por otras vías — lo que se perdió fue la atribución.
    // Falla en silencio por diseño ajeno: el beacon hace fetch().catch(){} y el
    // receptor responde 200 aunque descarte. Este cron es la ÚNICA señal.
    disparador: 'Cron diario: un workspace con landing_token acuñado no registra visitas hace más de 48h.',
    ejemplo: `🔴 Tu landing *dejó de mandarme datos* hace 3 días. Los anuncios siguen corriendo, así que no lo vas a notar en los leads: lo que se pierde es saber de dónde vienen. Suele ser que el Pixel quedó apuntando a una dirección vieja. — MaKo`,
  },
  {
    id: 'landing-cambio', titulo: 'Tu landing cambió y ajusté lo que mido', categoria: 'aviso',
    prioridad: 'media', semaforo: 'amarillo', requiereRespuesta: false, yaImplementado: 'si',
    // El pedido del dueño, textual: «una landing puede NO tener VSL en un
    // principio y luego que los dueños le agreguen un VSL, MaKo o el Pixel
    // debería en todo momento saber eso, y actualizar por lo tanto los datos que
    // mide».
    //
    // Antes de esto, MaKo se enteraba SOLO si alguien abría la pantalla de la
    // prueba: el análisis corría en un efecto de React y el resultado se tiraba.
    // Una landing a la que le suben el VSL un martes podía pasar meses sin que
    // nadie supiera que ahora hay retención para mirar.
    //
    // ⚠️ EL AVISO SOLO HABLA DE VIDEO, FORMULARIO Y AGENDA. Botones y links de
    // WhatsApp cambian por cualquier cosa (un `wa.me` nuevo en un pie de página
    // ya cuenta) y no cambian NADA de lo que se mide: avisarlos sería el ruido
    // que enseña a ignorar los avisos. Se ven igual en el panel de la prueba,
    // que es pull — ahí la persona vino a mirar; acá MaKo interrumpe.
    disparador: 'Cron diario: el análisis de una landing declarada trae una pieza que antes no estaba, o deja de traer una que estaba en DOS lecturas buenas seguidas.',
    ejemplo: `🟡 Le agregaste *un video* a tu landing — lo vi hoy y ya lo estoy midiendo. A partir de ahora vas a tener la curva de retención: en qué minuto se te cae la gente. Mírala aquí 👉 https://hola-mako.com/integraciones?abrir=landing — MaKo`,
  },
  {
    id: 'lead-fusionado', titulo: 'Junté un contacto con uno que ya tenías', categoria: 'aviso',
    prioridad: 'media', semaforo: 'amarillo', requiereRespuesta: false, yaImplementado: 'si',
    // ⚠️ Meta y Calendly matchean por teléfono o email y hacen update sobre el
    // lead que ya estaba. Eso está bien —es la misma persona volviendo— pero
    // pasaba en absoluto SILENCIO: no había forma de enterarse de que dos
    // entradas se juntaron, ni de revisar si el match fue correcto. Y un match
    // por teléfono puede equivocarse: dos personas de la misma empresa cargadas
    // con el número de la recepción, o un número que la operadora recicló. Ahí
    // el segundo se escribe ENCIMA del primero y no queda rastro.
    disparador: 'Al instante: un webhook de Meta o Calendly encuentra un lead existente y lo actualiza en vez de crear uno nuevo.',
    ejemplo: `🟡 Entró un contacto por *Calendly* y lo sumé a *Marina Olvera*, que ya tenías (mismo teléfono). Si no era la misma persona, avísame y lo separo 👉 https://hola-mako.com/crm/1842 — MaKo`,
  },
  // ⚠️ ACÁ ESTABA `clarity-grabacion-por-vencer` («Una grabación está por
  // borrarse»), y se fue el 06/10/2026 con Clarity entero. Existía porque Clarity
  // tiraba las grabaciones a los 30 días y marcarlas como favoritas era manual en
  // su panel. La grabación propia no lo necesita: la retención es nuestra y la
  // aplica sola el cron `replay-purga`, sin pedirle nada a nadie.
  {
    id: 'prueba-recibida', titulo: 'Recibimos tu prueba del Pixel', categoria: 'aviso',
    prioridad: 'baja', semaforo: 'verde', requiereRespuesta: false, yaImplementado: 'si',
    // ⚠️ VA AL TERMINAR, no cuando la grabación está lista — para eso está
    // `prueba-grabada`, que llega con el link cuando la grabación se terminó de
    // guardar. Este cierra el bucle EN EL MOMENTO: quien termina de probar cierra
    // la ventana y se queda sin ninguna señal de que lo que hizo quedó registrado.
    //
    // ⚠️ Y NO PROMETE UN LINK DE CLARITY, que es lo que decía hasta el 06/10/2026
    // —y le prometía a TODO negocio, tuviera Clarity conectado o no: a los que no,
    // el link no les llegaba nunca—. Ahora promete el aviso sólo si la grabación
    // está prendida en ese negocio (ver `finPruebaAction`).
    //
    // Es la diferencia entre esperar y dudar, y cuesta un mensaje.
    disparador: 'Al terminar una prueba del Pixel: se cierra la ventana de la prueba o se aprieta «Terminar».',
    ejemplo: `🟢 Listo, recibí tu prueba del Pixel en *tupagina.com*: 23 eventos. Te aviso cuando la grabación esté lista — MaKo`,
  },
  {
    id: 'prueba-grabada', titulo: 'La grabación de tu prueba ya está lista', categoria: 'aviso',
    prioridad: 'baja', semaforo: 'verde', requiereRespuesta: false, yaImplementado: 'si',
    // ⚠️ EL AVISO EXISTE PORQUE QUIEN PRUEBA YA CERRÓ LA PANTALLA. La grabación de
    // la prueba se termina de guardar unos minutos después (el sellado corre cada
    // 10), y para entonces nadie está mirando. El link lleva DIRECTO a mirarla: la
    // ficha del lead PRUEBA de esa página, que es donde vive el reproductor.
    //
    // Hasta el 06/10/2026 era de Clarity, esperaba 45 minutos a que Microsoft
    // procesara la sesión y mandaba a su panel, con login aparte.
    disparador: 'Cron cada 15 minutos: la grabación de una prueba del Pixel se terminó de guardar. Sólo si la grabación está prendida en el negocio.',
    ejemplo: `🟢 Ya puedes ver la grabación de tu prueba en *tupagina.com* 👉 https://hola-mako.com/crm/1842 — MaKo`,
  },
  {
    id: 'lead-no-confirmo', titulo: 'Agendó, no confirmó y hay que llamarlo', categoria: 'accion', porDefecto: 'on',
    // ⚠️ 'parcial' desde el 09/10/2026: sólo lo emite una automatización de ANTES (una lista, con el
    // objetivo «que llegue preparado» y un fallo por silencio), y no queda ninguna viva. Las de
    // tarjetas avisan lo mismo con su tarjeta MaKo en WhatsApp (`avisar_al_equipo`, «no confirmó la
    // reunión»): es lo que hace la post-agenda de hoy. Por eso salió de `AVISOS_DEL_CLIENTE`.
    prioridad: 'alta', semaforo: 'amarillo', requiereRespuesta: false, yaImplementado: 'parcial',
    // El texto lo arma lib/nutricion-desenlace.ts con lo que SALIÓ de verdad.
    textoDelCodigo: true,
    disparador: 'Una automatización de antes (una lista) le escribió para confirmar la reunión y el lead no contestó a tiempo. Las de tarjetas lo avisan con su propia tarjeta MaKo en WhatsApp. Uno por lead cada 24 h.',
    ejemplo: `🟡 *Oswaldo Iturbide* agendó para el martes 12 de agosto, 20:00 y no confirmó.

Le mandé el audio y le insistí al día siguiente: no contestó ninguna de las dos veces.
Conviene que le marques tú: +52 55 4874 2149

— MaKo`,
  },
  {
    id: 'lead-de-landing', titulo: 'Alguien dejó sus datos en tu landing', categoria: 'aviso',
    prioridad: 'alta', semaforo: 'verde', requiereRespuesta: true, yaImplementado: 'si',
    // ⚠️ EL AVISO QUE FALTABA, y su ausencia costó ocho leads reales.
    //
    // El opt-in de la landing crea una PROPUESTA —un canal propone, una persona
    // confirma— y la pantalla para revisarla es /crm/revisar/<id>: por ID, sin
    // lista. Para los otros canales el link vuelve en la misma conversación
    // (WhatsApp, Claude), así que nadie lo pensó dos veces. Pero un formulario de
    // una landing NO TIENE CANAL DE VUELTA: quien lo completa ve la página de
    // gracias del cliente, y el dueño no recibe nada.
    //
    // Resultado medido el 14/08/2026 en el workspace 11: ocho propuestas de lead
    // en `pendiente`, con nombre y teléfono, ninguna vista por nadie. El sistema
    // funcionaba exactamente como estaba escrito. El dueño lo reportó como «envié
    // el formulario y no se registró» — y sí se había registrado.
    //
    // La regla que queda: si un canal deja una propuesta y NO puede devolver el
    // link por donde entró, el link sale por un aviso. Una propuesta que nadie
    // sabe que existe es peor que no haberla creado: ocupa el lugar del lead.
    disparador: 'Al instante: entra un opt-in desde la landing y se crea la propuesta de lead.',
    ejemplo: `🟢 *Marina Olvera* dejó sus datos en tu landing hace un rato — tel 998 136 1529, de Atomy. Todavía NO está en el CRM: la tienes que confirmar tú, así revisas el teléfono antes de que valga. Ábrela aquí 👉 https://hola-mako.com/crm/revisar/propxnjgz6dj5mhk — MaKo`,
  },
  {
    id: 'tracking-desactualizado', titulo: 'El Pixel de MaKo quedó viejo', categoria: 'aviso', porDefecto: 'on',
    prioridad: 'media', semaforo: 'amarillo', requiereRespuesta: false, yaImplementado: 'si',
    // ⚠️ PRENDIDO POR DEFAULT desde el 06/10/2026. El 28/09 (e22a633e) todo aviso sin
    // `porDefecto` pasó a nacer apagado, y éste quedó afuera de los que se rescataron:
    // medido, la última vez que salió fue el 28/09, a nadie, mientras tres clientes
    // tenían un código anterior a la grabación de visitas. Martín pidió usarlo para
    // eso: «sería bueno que utilices el mensaje de WhatsApp de notificación que la
    // landing quedó vieja». Es 'on' y no 'siempre': se puede apagar.
    // El hermano silencioso de 'tracking-apagado', y MÁS difícil de ver: acá el
    // tracking NO está muerto. Los eventos llegan, la integración está en verde y
    // todo parece bien — pero el snippet quedó CONGELADO en el HTML del cliente el
    // día que lo copió, así que cada mejora que sale (medición nueva, la captura
    // del formulario de opt-in) no le llega nunca y nadie tiene forma de notarlo.
    // Por eso el aviso dice QUÉ se está perdiendo y no solo «actualizá»: sin eso
    // es una tarea sin motivo, y una tarea sin motivo no la hace nadie.
    // ⚠️ El corte es PIXEL_MINIMO_AVISO y no SNIPPET_VERSION desde el 09/10/2026: subir la
    // versión del código ya no le manda este mensaje a todos; sólo subir el mínimo, a mano.
    // Y el arreglo que propone es la línea del cargador, que no se vuelve a pegar nunca.
    disparador: 'Cron diario: el beacon reporta una versión del Pixel anterior al mínimo que pide repegar (PIXEL_MINIMO_AVISO).',
    ejemplo: `🟡 Tu página tiene un código viejo del Pixel y por eso no graba las visitas. *Qué te estás perdiendo:* el mapa de calor de tu página y la grabación de cada visita. *Cómo se arregla* (2 minutos): entra aquí, copia la línea del Pixel y ponla en esa página en lugar del código viejo. Con esa línea no vuelves a actualizar nada. — MaKo`,
  },
  {
    id: 'leads-caida', titulo: 'Caída de leads vs promedio del día', categoria: 'aviso',
    prioridad: 'media', semaforo: 'amarillo', requiereRespuesta: false, yaImplementado: 'no',
    disparador: 'Leads acumulados a esta hora muy por debajo del baseline horario.',
    ejemplo: `🟡 Van *3 leads hoy* y a esta hora sueles tener 9. La entrada de leads bajó fuerte. Puede ser saldo, un anuncio caído o el día. Lo estoy mirando y te confirmo la causa. — MaKo`,
  },
  {
    id: 'capi-cierres-no-reportados', titulo: 'Cierres no reportados a Meta (CAPI)', categoria: 'accion',
    prioridad: 'media', semaforo: 'amarillo', requiereRespuesta: true, yaImplementado: 'no',
    disparador: 'Ventas cerradas en el CRM sin evento Purchase enviado a Meta.',
    ejemplo: `🟡 Cerraste 2 ventas esta semana pero Meta *no recibió el evento de compra* (CAPI). Sin eso el algoritmo optimiza a ciegas y te consigue peores leads. ¿Activo el envío de conversiones para que aprenda de tus cierres? — MaKo`,
  },

  // ── REUNIONES / CRM ────────────────────────────────────────────────────────
  {
    id: 'reunion-recordatorio', titulo: 'Recordatorio de reunión próxima', categoria: 'aviso', porDefecto: 'on',
    prioridad: 'alta', semaforo: 'na', requiereRespuesta: false, yaImplementado: 'si',
    // El texto lo arma `textoAvisoPreLlamada` (lib/lead-resumen.ts) con la reunión y el link.
    textoDelCodigo: true,
    // ⚠️ La primera oración la dibuja la tarjeta CRON: decía «Cron reunion-recordatorio», el nombre
    // interno de la pieza (AGENTS.md: el nombre interno de una cosa no es el nombre de la cosa).
    disparador: 'Media hora antes de una reunión con un lead, si el lead sigue abierto y la asistencia no está marcada. Se revisa cada 10 minutos y sale una vez por reunión.',
    // ⚠️ FICTICIO POR REGLA. Nombraba a un lead real de un cliente, y un agendado por
    // tiempo se lo mandó al grupo de OTRO cuatro días seguidos (06/10/2026). Hoy un
    // ejemplo no puede salir por tiempo (`motivoNoAgendable`), pero se sigue dibujando
    // en la pantalla que abren todos.
    ejemplo: `━━ 🗓️ REUNIÓN ━━
⏰ En 30 min tienes la *R2* con *Laura Gil* (Clínica Gil).

👉 Mira el resumen del lead:
https://hola-mako.com/crm/482/resumen

— MaKo`,
  },
  // Las dos de las llamadas de la ENTREGA de un servicio (el curso, 06/10/2026): lo que Mauricio
  // pidió el 8/9 — «un día antes de la siguiente, lo que no está concluido», también a él y sin
  // aprobación. Las emite el cron curso-sesiones con `emitirAviso` (lib/curso-mensajes.ts); sin
  // estas filas salían igual, con el rótulo «SISTEMA» y sin poder apagarse desde /mensajes.
  // Ejemplos FICTICIOS por regla.
  {
    id: 'curso-sesion-previa', titulo: 'Sesión con un cliente', categoria: 'aviso', porDefecto: 'on',
    prioridad: 'media', semaforo: 'amarillo', requiereRespuesta: false, yaImplementado: 'si',
    disparador: 'Cron curso-sesiones (cada hora): una llamada de la entrega (curso_sesiones) a menos de 24 h. Una marca por sesión: no se repite.',
    ejemplo: `Mañana a las 10:00 a. m. tienes sesión con *Ana Ruiz*: 2 tareas pendientes de *Norte*:
· Tu visión a 3 años
· Tu meta del año
Ya le mandé el recordatorio.`,
  },
  {
    id: 'curso-sesion-posterior', titulo: 'Pendientes de un cliente', categoria: 'aviso', porDefecto: 'on',
    prioridad: 'media', semaforo: 'amarillo', requiereRespuesta: false, yaImplementado: 'si',
    disparador: 'Cron curso-sesiones (cada hora): de 2 a 48 h después de una llamada de la entrega, si al cliente le quedan tareas de su etapa.',
    ejemplo: `Después de la sesión con *Ana Ruiz*: 1 tarea pendiente de *Norte*:
· Tu meta del año
Ya le mandé sus pendientes.`,
  },
  // La alerta de BAJA de Customer Success (#109). Decisión de Martín, 06/10/2026: «Columnas +
  // alerta» — sin IA, al DUEÑO y nunca al cliente. La regla (pura y con test) vive en
  // lib/cs-contacto.ts y el envío en lib/cs-sin-contacto.ts.
  //
  // ⚠️ PRENDIDO POR DEFECTO: sin `porDefecto` nace APAGADO, y una alerta que nadie prendió es una
  // decisión del dueño que no se cumple. Es de las que EXIGEN hacer algo (escribirle a un cliente
  // que se está yendo), que es el criterio de 'on'. Y no inunda: uno por cliente y por racha, tres
  // por mañana como máximo (`TOPE_AVISOS_POR_CORRIDA`), y puede esperar al resumen de la mañana
  // (lib/avisos-agrupables.ts). Ejemplo FICTICIO por regla.
  {
    id: 'cs-cliente-sin-contacto', titulo: 'Cliente sin contacto', categoria: 'aviso', porDefecto: 'on',
    prioridad: 'alta', semaforo: 'amarillo', requiereRespuesta: false, yaImplementado: 'si',
    disparador: 'Cron diario cs-sin-contacto: un cliente ganado que no está dado de baja ni graduado lleva 21 días sin llamada, sin escribir por WhatsApp y sin cambio de etapa. Lo que le manda el negocio (también lo automático) no cuenta. Uno por cliente y por racha: un contacto nuevo empieza otra.',
    ejemplo: `*Ana Ruiz* lleva 23 días sin mensajes suyos ni sesión registrada, ni cambio de etapa.
Escríbele hoy o agenda una sesión.`,
  },
  // La COPIA a Mauricio del recordatorio de clases (#780, decisión de Martín del 06/10/2026: por
  // WhatsApp, a los 3 días sin entrar, sólo los videos sin ver de su etapa). La emite el mismo cron
  // (`correrRecordatoriosDeClases`, lib/curso-mensajes.ts), UNA por corrida con todos los clientes.
  // Nace PRENDIDO: es lo que le dice a Mauricio qué se le escribió a sus clientes, que él pidió ver
  // («yo voy a ver qué le envió», 8/9). Ejemplo FICTICIO por regla.
  {
    id: 'curso-recordatorio-clases', titulo: 'Recordatorio de clases', categoria: 'aviso', porDefecto: 'on',
    prioridad: 'baja', semaforo: 'na', requiereRespuesta: false, yaImplementado: 'si',
    disparador: 'Cron curso-sesiones (cada hora, de 9 a 21): a un cliente invitado al curso que lleva 3 días sin entrar al portal se le recuerdan los videos sin ver de su etapa, uno cada 3 días como mucho. Esta es la copia: a quién y qué.',
    ejemplo: `Les recordé sus videos pendientes a 2 clientes con 3 días sin entrar:
· *Ana Ruiz* (*Norte*): Cómo leer tu tablero, Tu primera meta
· *Luis Paz* (*Contexto*): Bienvenida al programa`,
  },
  {
    id: 'reunion-agenda-dia', titulo: 'Agenda del día (juntas de hoy)', categoria: 'aviso',
    prioridad: 'media', semaforo: 'na', requiereRespuesta: false, yaImplementado: 'no',
    disparador: 'Cron matutino: reuniones del día desde junta_at.',
    ejemplo: `🗓️ *Tu día*: 3 reuniones.\n10:00 R1 Ana López\n12:30 R2 Grupo Delta\n16:00 R1 Laura Gil\nTodas con link cargado. — MaKo`,
  },
  {
    id: 'reunion-nuevo-agendado', titulo: 'Nuevo lead que agendó reunión', categoria: 'aviso', porDefecto: 'on',
    prioridad: 'alta', semaforo: 'na', requiereRespuesta: false, yaImplementado: 'si',
    // Los cuatro emisores (Calendly y Cal.com, R1 y R2) arman su texto: el de Cal.com con el teléfono y lo
    // completado («un único WhatsApp», Código Inmobiliario). Desde el 11/10/2026 es un EVENTO de MaKo
    // (`lead_agendo`, lib/disparadores.ts), RETIRADO desde la undécima tanda: el aviso de nuevo agendado es una
    // tarjeta «MaKo en WhatsApp» de «Un Lead Agendó Llamada», con datos citables (`{{reunion_cuando}}`,
    // `{{lead_respuestas_agenda}}`…). La marca queda SÓLO para las filas vivas con `{{mensaje_mako}}` (#239, #240)
    // hasta la limpieza (docs/diseno-undecima-tanda.md §8.7).
    textoDelCodigo: true,
    disparador: 'Webhook de Calendly (invitee.created) o de Cal.com (BOOKING_CREATED): un lead reserva una reunión.',
    // Decía «la ficha ya quedó armada en el CRM» y no daba el link: mandaba a
    // buscarla a mano justo cuando el dato recién llegó y es más fácil de mirar.
    ejemplo: `🎯 *Nuevo agendado*: Juan Pérez reservó una *R1 para el jueves 16 a las 11:00*. Vino del anuncio "VSL testimonios".

👉 Mira el resumen del lead:
https://hola-mako.com/crm/482/resumen

— MaKo`,
  },
  {
    id: 'reunion-cancelada', titulo: 'Reunión cancelada/reagendada → reacomodar', categoria: 'accion', porDefecto: 'on',
    prioridad: 'media', semaforo: 'na', requiereRespuesta: true, yaImplementado: 'si',
    disparador: 'Webhook Calendly invitee.canceled.',
    ejemplo: `🔄 *Se canceló* la R1 con Mariela Gómez que era para el jueves 16 a las 11:00 y todavía no reagendó.

Si consigues otro horario, dime *«reagéndale la R1 a Mariela Gómez»* y te busco los huecos libres.

👉 Mira el resumen del lead:
https://hola-mako.com/crm/482/resumen

— MaKo`,
  },
  {
    id: 'reunion-ocurrio-fathom', titulo: 'Reunión ocurrió / grabación lista (Fathom)', categoria: 'aviso', porDefecto: 'on',
    prioridad: 'media', semaforo: 'na', requiereRespuesta: false, yaImplementado: 'si',
    // ⚠️ Sale DESPUÉS del Closing Analyst, no cuando cae el webhook. Antes era una
    // 'pregunta' («¿te paso el resumen y las objeciones acá?») disparada en el
    // instante del webhook: en ese momento el análisis todavía no había corrido,
    // así que no había resumen que pasar, y la respuesta del dueño no la escuchaba
    // nadie. El link reemplaza la pregunta — ver app/api/webhooks/fathom/route.ts.
    // El texto lo arma `textoAvisoPostLlamada` (lib/lead-resumen.ts) con la llamada.
    textoDelCodigo: true,
    // ⚠️ Decía «Webhook Fathom, dentro del after()»: la tarjeta CRON dibujaba «after()».
    disparador: 'Cuando Fathom entrega la grabación de una llamada con un lead y MaKo terminó de analizarla (el seguimiento queda como borrador).',
    ejemplo: `━━ 🗓️ REUNIÓN ━━
✅ Terminó la *R1 con Laura Gil* (42 min).

👉 Mira el resumen de la llamada:
https://hola-mako.com/crm/482/resumen

— MaKo`,
  },
  {
    id: 'reunion-compromisos-tareas', titulo: 'Compromisos de la reunión → cargar tareas', categoria: 'accion',
    prioridad: 'media', semaforo: 'na', requiereRespuesta: true, yaImplementado: 'parcial',
    disparador: 'plan-fathom extrae action items del transcript (G3).',
    ejemplo: `📝 De la reunión con Grupo Delta saqué *3 compromisos tuyos*:\n1. Enviar propuesta antes del viernes\n2. Mandar caso de éxito de logística\n3. Agendar R2\n\n¿Los cargo como tareas en tu tablero? — MaKo`,
  },
  {
    id: 'reunion-tareas-al-plan', titulo: 'Reunión de equipo nueva → tareas esperando confirmación', categoria: 'accion',
    prioridad: 'media', semaforo: 'na', requiereRespuesta: false, yaImplementado: 'si',
    disparador: 'Cron fathom-plan: caen grabaciones nuevas de reuniones de EQUIPO, MaKo las lee y deja los borradores pendientes en el plan. UN aviso por corrida, no uno por reunión.',
    ejemplo: `📝 Leí tus *3 reuniones* nuevas:\n\n• *Sync semanal* — mié 28 jul · 15:30\n   4 tareas tuyas · 3 de otros\n• *Ana <> Pablo* — mié 28 jul · 18:00\n   3 tareas tuyas · 4 de otros\n• *Revisión de ads* — jue 29 jul · 10:15\n   4 tareas tuyas · 3 de otros\n\nEn total *11 tareas tuyas* (y 10 de los demás, para repartir), todas esperándote en la misma pantalla:\nhttps://hola-mako.com/plan\n\nEntras una vez, revisas todo junto y con un toque quedan cargadas. — MaKo`,
  },
  {
    id: 'tareas-autocompletadas', titulo: 'MaKo cerró tareas que ya estaban hechas', categoria: 'aviso',
    prioridad: 'baja', semaforo: 'verde', requiereRespuesta: false, yaImplementado: 'si',
    disparador: 'Corrida diaria de señales (cron tareas-verificar) + al abrir /plan. UN aviso por día por workspace, agrupando todas las que cerró — nunca uno por tarea.',
    ejemplo: `✅ Cerré *3 tareas* de tu plan que ya estaban hechas:

• *Conectar WhatsApp* — tu número ya está vinculado
• *Conectar Fathom* — ya está conectado
• *Cargar el funnel* — ya está cargado en MaKo

Si alguna no está lista, ábrela y reábrela: no la vuelvo a tocar.
https://hola-mako.com/plan — MaKo`,
  },
  {
    id: 'reunion-no-show', titulo: 'No-show → sugerir seguimiento', categoria: 'accion',
    prioridad: 'alta', semaforo: 'rojo', requiereRespuesta: true, yaImplementado: 'no',
    disparador: 'junta_at pasada sin grabación Fathom ni asistencia marcada.',
    ejemplo: `🔴 *No-show*: Ana López no se presentó a la R1 de las 10:00. Le puedo mandar un WhatsApp para reagendar antes de que se enfríe.\n\n¿Te escribo el borrador? — MaKo`,
  },

  // ── LEADS / WHATSAPP / NUTRICIÓN ───────────────────────────────────────────
  {
    // ⚠️ NACE APAGADO, Y ES UNA DECISIÓN: sin `porDefecto` no sale para nadie hasta que el
    // negocio lo prenda en /automations. Martín, 07/10/2026: «el whatsapp dejalo como
    // borrador, no activado en chatbot». Es el equivalente del aviso de la landing
    // (`lead-de-landing`) para quien no tiene landing y corre anuncios a formulario —los
    // clientes de Código Inmobiliario—, y prenderlo para todos le mandaría un WhatsApp por
    // cada uno de los ~1.000 leads de Meta que entran al ws1.
    //
    // ⚠️ Y EL TEXTO SALE DE ACÁ, NO DEL WEBHOOK. Hasta el 07/10 el webhook le pasaba el
    // texto armado en código, así que lo que el negocio escribiera en /automations no se mandaba
    // nunca, y decía «¿Le disparo la nutrición de bienvenida?» sobre un lead al que la línea
    // siguiente ya inscribía en la nutrición. Ahora manda los DATOS (`aporta: ['lead']` y
    // los `datos` del webhook) y el texto es éste o el que el negocio escriba.
    id: 'lead-formulario-meta', titulo: 'Lead entrante por formulario de Meta', categoria: 'aviso',
    prioridad: 'media', semaforo: 'na', requiereRespuesta: false, yaImplementado: 'si',
    aporta: ['lead'],
    disparador: 'Webhook meta-leads: alguien completa un formulario de Meta y entra al CRM.',
    ejemplo: `📥 *{{lead_nombre}}* completó tu formulario de Meta\n📱 {{lead_telefono}}\n\n{{lead_formulario}}\n\nSu ficha 👉 {{link_lead}}`,
  },
  {
    id: 'wa-mensaje-entrante', titulo: 'Mensaje de WhatsApp entrante (al dueño)', categoria: 'aviso', porDefecto: 'on',
    prioridad: 'media', semaforo: 'na', requiereRespuesta: false, yaImplementado: 'parcial',
    // Lo emiten las automatizaciones cuando un lead les contesta (lib/nutricion.ts, tres lugares) y
    // el hand-off (lib/chat-agent-handoff.ts), cada uno con su texto: el ejemplo es la muestra de uno.
    textoDelCodigo: true,
    // Revisión del ws9 (10/10/2026): decía «Un lead contesta por el WhatsApp del negocio», y sólo lo emiten las
    // respuestas a una AUTOMATIZACIÓN (los tres de lib/nutricion.ts y el hand-off), no cualquier mensaje.
    disparador: 'Cuando un lead contesta una automatización y MaKo no le contestó solo.',
    // ⚠️ El ejemplo de antes («Lleva 12 min sin respuesta») no se parecía a NINGUNO de los cuatro que
    // salen. Con el texto armado por código el ejemplo es lo único que se ve del mensaje: tiene que
    // ser uno de verdad (el de la charla que se cerró sin respuesta preparada, lib/nutricion.ts).
    ejemplo: `💬 *Carla te escribió.*\n\n_"Hola, ¿sigue disponible la promo?"_\n\nNo le preparé respuesta: la charla ya se había cerrado. Contéstale tú.\n\n— MaKo`,
  },
  {
    /**
     * ⚠️ PRENDIDO POR DEFECTO, Y NO ES OPCIONAL. Sin `porDefecto` un mensaje nace APAGADO
     * (`estaPrendida`, lib/plantillas.ts) y `emitirDelCatalogo` no lo manda en ningún
     * workspace: el vigilante de líneas correría, mediría la caída y se callaría.
     *
     * Lo dispara lib/lineas-vigilante.ts desde el 06/10/2026 (decisión de Martín: «c: solo
     * al cliente»), con el texto armado por código (lib/linea-vigilancia.ts) porque sale de
     * lo que se midió: qué línea, si WhatsApp cerró la sesión o fue un corte, y desde cuándo.
     * El ejemplo es ficticio, a propósito.
     */
    id: 'wa-desconectado', titulo: 'WhatsApp de empresa desconectado', categoria: 'aviso', porDefecto: 'on',
    prioridad: 'alta', semaforo: 'rojo', requiereRespuesta: false, yaImplementado: 'si',
    textoDelCodigo: true,   // `textoCaida` (lib/linea-vigilancia.ts): sale de lo que se midió
    disparador: 'Cuando una línea de WhatsApp del negocio queda caída dos pruebas seguidas (se prueba cada 10 minutos). Avisa al negocio y repite cada 24 h mientras siga así. Una línea que nunca se vinculó, o que el negocio desvinculó, no avisa.',
    ejemplo: `🔴 *Se desconectó tu WhatsApp* (+52 55 1234 5678). WhatsApp cerró la sesión del dispositivo vinculado el 3 de octubre: tu teléfono está bien, pero por ese número no entran ni salen mensajes. Vuelve a escanear el QR: https://hola-mako.com/whatsapp — MaKo`,
  },
  {
    /**
     * La contracara del de arriba (09/10/2026, decisión de Martín al cerrar el Chatbot). Sale
     * sólo si la caída SE AVISÓ: un corte que volvió entre dos corridas del cron no tiene nada
     * que desmentir. Lo dispara lib/lineas-vigilante.ts con el texto de `textoVolvio`
     * (lib/linea-vigilancia.ts). Ejemplo ficticio.
     */
    id: 'wa-reconectado', titulo: 'WhatsApp de empresa reconectado', categoria: 'aviso', porDefecto: 'on',
    prioridad: 'baja', semaforo: 'verde', requiereRespuesta: false, yaImplementado: 'si',
    textoDelCodigo: true,   // `textoVolvio` (lib/linea-vigilancia.ts)
    disparador: 'Cuando vuelve una línea cuya caída ya se había avisado (se prueba cada 10 minutos). Sale una vez y deja de insistir.',
    ejemplo: `🟢 *Volvió tu WhatsApp* (+52 55 1234 5678). Por ese número ya entran y salen mensajes otra vez. — MaKo`,
  },
  {
    id: 'wa-sin-responder', titulo: 'Conversaciones sin responder hace X horas', categoria: 'accion',
    prioridad: 'media', semaforo: 'amarillo', requiereRespuesta: true, yaImplementado: 'no',
    disparador: 'Conversaciones con último entrante sin respuesta > umbral.',
    ejemplo: `🟡 *3 conversaciones sin responder* hace más de 2 horas. La más caliente: Juan, que preguntó precio. Cada hora que pasa baja la chance de cierre.\n\n¿Te dejo borradores de respuesta para que apruebes? — MaKo`,
  },
  // ⚠️ ACÁ ESTABA `plantilla-estado` («Plantilla aprobada/rechazada por Meta»), y se fue el 09/10/2026
  // (sexta tanda, General 15: plantillas «con configuraciones viejas obsoletas»). Avisaba el veredicto de
  // Meta sobre una plantilla de la línea OFICIAL, que salió del producto ese mismo día, y su ejemplo
  // prometía «abrir conversación fuera de la ventana de 24h», que en el WhatsApp de empresa no existe.
  // Medido antes de sacarlo: ningún emisor, ningún store que lo nombre, ningún link.
  //
  // Los dos de abajo conservan el id (`nutricion-*` es una clave estable, la del feed y el dedup) y
  // cambian lo que se lee: la «nutrición» y la «secuencia» son las AUTOMATIZACIONES desde el 05/10, y
  // un WhatsApp de empresa no tiene token ni ventana que se venzan.
  {
    id: 'nutricion-agotada', titulo: 'Automatización terminada sin respuesta → lead frío', categoria: 'pregunta',
    prioridad: 'baja', semaforo: 'amarillo', requiereRespuesta: true, yaImplementado: 'no',
    disparador: 'Un lead recorrió una automatización entera sin responder ni agendar.',
    ejemplo: `🟡 Carla recorrió la automatización «Bienvenida» entera (5 mensajes) sin responder ni agendar. La marco como *fría*, salvo que quieras un último intento manual con un mensaje distinto. ¿La dejo o le doy una más? — MaKo`,
  },
  {
    id: 'nutricion-frenada', titulo: 'Automatizaciones frenadas por un error', categoria: 'aviso',
    prioridad: 'alta', semaforo: 'rojo', requiereRespuesta: false, yaImplementado: 'no',
    disparador: 'Mensajes de las automatizaciones que no salen: la línea de WhatsApp caída o el email sin configurar.',
    ejemplo: `🔴 Tus automatizaciones se *frenaron*: 8 mensajes no salieron porque tu WhatsApp está desconectado. Nadie está recibiendo seguimiento ahora. Vuelve a vincularlo en /whatsapp. — MaKo`,
  },

  {
    id: 'crm-lead-estancado', titulo: 'Leads quietos más de lo que marca tu funnel', categoria: 'aviso',
    prioridad: 'media', semaforo: 'amarillo', requiereRespuesta: false, yaImplementado: 'si',
    disparador: 'El CRM automático movió leads que pasaron el plazo de su etapa. UN mensaje por corrida con todos juntos, y como máximo uno por día.',
    ejemplo: `⏳ Moví *6 leads* que quedaron más tiempo del que marca tu funnel: 4 de *Lead entrante* (plazo 2 días) y 2 de *No responde* (plazo 30 días). El motivo quedó en el historial de cada uno. — MaKo`,
  },
  {
    // ⚠️ NO ES EL DE ARRIBA. Aquél cuenta lo que el CRM automático MOVIÓ (tres columnas, y sólo
    // donde el motor está prendido); éste avisa de los que siguen QUIETOS en cualquier etapa
    // con plazo, y no toca a nadie (lib/lead-quieto.ts, #800). Sin plazos declarados no sale.
    id: 'crm-lead-quieto', titulo: 'Leads que pasaron el plazo de su etapa', categoria: 'aviso',
    prioridad: 'media', semaforo: 'amarillo', requiereRespuesta: false, yaImplementado: 'si',
    disparador: 'Un lead lleva en su etapa más días que el plazo que le pusiste en el editor de etapas. UN mensaje por día con todos juntos.',
    ejemplo: `⏳ *5 leads* llevan en su etapa más de lo que marca tu funnel: 3 en *Agenda R2* (más de 5 días) y 2 en *Facturando* (más de 3 días). Los que más esperan: Ana, Pedro y Lucía. — MaKo`,
  },

  // ── COBRANZA / CASH ────────────────────────────────────────────────────────
  {
    id: 'cuota-vencida', titulo: 'Cuota vencida → cobrar', categoria: 'accion', porDefecto: 'on',
    // ⚠️ `requiereRespuesta: false` desde el 06/10/2026: con `true` la vista previa del
    // mensaje dibujaba al dueño contestando «Sí, adelante 👍» y a MaKo «Listo, lo hago
    // ahora», o sea la misma promesa muerta del «¿Le escribo el recordatorio?» (abajo).
    prioridad: 'alta', semaforo: 'rojo', requiereRespuesta: false, yaImplementado: 'si',
    aporta: ['lead', 'cuota'],
    // ⛔ ACÁ IBAN `correSuFlujo` Y `flujoPorDefecto` (la cadencia de fábrica: esperar 48 h, el
    // «💸 Sigue sin cobrarse…», esperar 72 h, el «💸 Último recordatorio…»). Salieron el 11/10/2026: desde
    // ese día este aviso es un EVENTO de MaKo (`cuota_vencida`, lib/disparadores.ts) y lo que sale lo dice la
    // automatización «Cobranza de cuotas vencidas» que el negocio agrega desde la galería
    // (lib/plantillas-automatizaciones.ts, `mako-cobranza`), con la MISMA entrada y los MISMOS dos
    // recordatorios, copiados literales. Sin fila, no sale nada («Todos arrancan vacíos», decisión de
    // Martín). Las decisiones que la cadencia traía viajaron con ella: los recordatorios van al GRUPO de MaKo
    // y nunca al cliente («C: nada al cliente», 06/10/2026), y no usan `{{cuota_dias}}`, que es la foto del
    // día de la entrada. Con la cadencia acá, el cron la habría corrido además de la fila del negocio.
    // El diseño, en docs/diseno-mako-en-whatsapp-unificado.md.
    disparador: 'Cuando una cuota pasa su fecha sin cobrarse, una vez por cuota (se revisa cada día). Sale por la automatización de cobranza del negocio; al marcar el pago en la ficha, se corta.',
    // ⚠️ EL EJEMPLO ES FICTICIO, A PROPÓSITO. Acá decía «la cuota 2 de Vértice», que es
    // una cuenta REAL del tablero: quien abre esta pantalla ve la cobranza de otro, y
    // quien lo cuenta en una reunión lo cuenta como propio — pasó, y está medido en
    // docs/hallazgos-comunicacion.md (lo que alguien LEE de la pantalla compartida).
    //
    // ⛔ Y YA NO PREGUNTA «¿Le escribo el recordatorio?». Este ejemplo ES el texto que sale
    // al grupo cuando el negocio no escribió el suyo (`referenciaResuelta`), y detrás de la
    // pregunta no había nada que escuchara la respuesta: el dueño contestaba «sí» y no
    // pasaba nada. Con la decisión del 06/10/2026 —nada al cliente— la pregunta no tiene
    // ninguna respuesta posible, así que se fue. Lo mismo en `cuota-por-vencer`.
    // ⚠️ Desde el 11/10/2026 este texto es la ENTRADA de la plantilla «Cobranza de cuotas vencidas»
    // (`mk_entrada`, lib/plantillas-automatizaciones.ts), copiado literal: es lo que salía hasta ese día.
    ejemplo: `💸 *Cobranza*: la cuota {{cuota_numero}} de {{lead_nombre}} venció hace {{cuota_dias}} — *{{cuota_monto}} sin cobrar*. Si ya se cobró, márcalo en su ficha. — MaKo`,
  },
  {
    id: 'cuota-por-vencer', titulo: 'Cuota por vencer (recordatorio proactivo)', categoria: 'aviso',
    prioridad: 'media', semaforo: 'amarillo', requiereRespuesta: false, yaImplementado: 'si',
    aporta: ['lead', 'cuota'],
    correSuFlujo: true,   // el mismo cron de cobranza corre su flujo, si se le arma uno
    disparador: 'El día antes de que venza una cuota, una vez por cuota.',
    ejemplo: `🟡 Mañana vence la cuota {{cuota_numero}} de {{lead_nombre}} ({{cuota_monto}}). Avisarle hoy sale más barato que perseguirlo después. — MaKo`,
  },
  {
    id: 'pago-recibido', titulo: 'Pago recibido', categoria: 'aviso',
    prioridad: 'baja', semaforo: 'na', requiereRespuesta: false, yaImplementado: 'si',
    // Desde el 11/10/2026 lo emite la pasarela (lib/cobros.ts, aplicarPagoAprobado) cuando Stripe o Mercado Pago
    // confirman un cobro creado en MaKo, y es un EVENTO de MaKo (`pago_recibido`, lib/disparadores.ts): sale por la
    // automatización «Entró un Pago» que el negocio agrega de la galería (`mako-pago`). Undécima tanda: la tarjeta cita
    // los DATOS del pago que pasa `avisarPagoRecibido` (`{{pago_monto}}`, `{{pago_pasarela}}`, `{{pago_concepto}}`…).
    // El texto armado por el código (`textoDelCodigo`) queda sólo para una fila con `{{mensaje_mako}}` hasta la limpieza.
    textoDelCodigo: true,
    disparador: 'Stripe o Mercado Pago confirman un pago de un link de cobro creado en MaKo.',
    ejemplo: `💰 *Entró un pago*: Grupo Delta pagó *US$ 2.300* por Stripe (Mentoría).

👉 Mira su ficha:
https://hola-mako.com/crm/123/resumen

— MaKo`,
  },
  {
    id: 'dashboard-analisis-listo', titulo: 'Análisis del Dashboard listo', categoria: 'aviso',
    prioridad: 'baja', semaforo: 'na', requiereRespuesta: false, yaImplementado: 'si',
    // 13/10/2026: un EVENTO de MaKo (`analisis_listo`, lib/disparadores.ts). Sale SÓLO por la automatización «El AI
    // Analyst Terminó» que el negocio agrega de la galería (`mako-analisis`), con los datos citables del análisis
    // (`{{analisis_hoja}}`, `{{analisis_resumen}}`, `{{analisis_hallazgos}}`, `{{analisis_link}}`). Lo emite el Dashboard
    // (`avisarAnalisisListo`, lib/graficos-analisis-server.ts).
    disparador: 'El AI Analyst del Dashboard termina de analizar una hoja.',
    ejemplo: `📊 *Análisis listo*: Marketing

Las agendas subieron 18% y el costo por lead bajó a US$ 4,10.

👉 https://hola-mako.com/dashboard?hoja=marketing

— MaKo`,
  },
  {
    id: 'seguridad-contrasena-restablecer', titulo: 'Restablecer la contraseña', categoria: 'aviso',
    prioridad: 'alta', semaforo: 'na', requiereRespuesta: false, yaImplementado: 'si',
    // 15/10/2026: un EVENTO de una PERSONA (`contrasena_restablecer`, lib/disparadores.ts). Lo emite la ruta de
    // recuperación de Seguridad, en el ws de la PLATAFORMA, con `usuario_id` y el link (secreto: `{{link_restablecer}}`).
    // Sale SÓLO por la automatización de SuperAdmin «Restablecer Contraseña», con su «Email a la persona». Este texto
    // nunca va al grupo: sin una automatización prendida, al feed va sólo el título.
    disparador: 'Alguien pide restablecer su contraseña de MaKo («Olvidé mi contraseña»).',
    ejemplo: `Para crear tu contraseña nueva, entra a este link (vence en 30 minutos y sirve una sola vez):
https://hola-mako.com/restablecer?t=…

Si no lo pediste tú, ignora este correo: tu contraseña no cambia.

— MaKo`,
  },
  {
    id: 'cierre-venta', titulo: 'Cierre de venta nuevo', categoria: 'aviso',
    prioridad: 'media', semaforo: 'na', requiereRespuesta: false, yaImplementado: 'no',
    disparador: 'Motor CRM marca un lead como ganado.',
    ejemplo: `🎉 *Cierre nuevo*: Grupo Delta firmó por *$4.500*. Van 4 cierres este mes, te falta 1 para la meta. Fenómeno. — MaKo`,
  },

  // ── METAS / RETRO / INSIGHTS ───────────────────────────────────────────────
  {
    id: 'retro-lista', titulo: 'Retro semanal lista (con PDF)', categoria: 'pregunta',
    prioridad: 'media', semaforo: 'na', requiereRespuesta: true, yaImplementado: 'si',
    disparador: 'retro-pipeline genera la retro de la semana.',
    ejemplo: `🪞 Tu *Retro de la semana* está lista: qué funcionó, qué no y 3 focos para la que viene. Te la mando en PDF aquí mismo 👇\n\n¿O prefieres que te la resuma en un mensaje? — MaKo`,
  },
  {
    id: 'objetivo-en-riesgo', titulo: 'Objetivo/meta en riesgo por ritmo', categoria: 'accion',
    prioridad: 'media', semaforo: 'amarillo', requiereRespuesta: true, yaImplementado: 'si',
    // ⚠️ EL UMBRAL SE MIDE CONTRA EL PERÍODO, no contra un número de semanas suelto.
    // «Voy en 9 semanas y quería 6» no se puede calcular sin saber cuánto dura el
    // objetivo, y por eso el disparador viejo nunca se implementó. Ahora salta
    // cuando lo acumulado está 20% por debajo de lo que corresponde a esta altura
    // del Q, prorrateado lineal. El 20% deja pasar el ruido de un fin de semana y
    // caza un mes flojo; los 14 días de gracia evitan avisar el 3 de enero.
    disparador: 'Cron diario: lo acumulado del objetivo del Q está 20% debajo de lo prorrateado a hoy, con al menos 14 días de período corridos.',
    ejemplo: `🟡 Vas *20% abajo* de tu objetivo del trimestre: llevas US$8.400 de US$20.000 y a esta altura deberías ir por US$11.000. Quedan 38 días. ¿Armamos un plan para acelerar? — MaKo`,
  },
  {
    id: 'quarter-planificar', titulo: 'Planificar el Quarter que viene', categoria: 'pregunta',
    prioridad: 'media', semaforo: 'na', requiereRespuesta: true, yaImplementado: 'si',
    // Los 21 días los eligió el dueño. Es tiempo suficiente para pensar el Q
    // siguiente sin que el aviso llegue tan temprano que se archive y se olvide.
    disparador: 'Cron diario: faltan 21 días o menos para que termine el Quarter y el siguiente no tiene ningún objetivo cargado.',
    ejemplo: `🗓️ Se está terminando el *Q3* — quedan 19 días. Todavía no hay nada cargado para el Q4. ¿Lo planificamos juntos? — MaKo`,
  },
  {
    id: 'meta-alcanzada', titulo: 'Meta alcanzada (celebración)', categoria: 'aviso',
    prioridad: 'baja', semaforo: 'verde', requiereRespuesta: false, yaImplementado: 'si',
    disparador: 'Cron diario: lo acumulado del objetivo del Q cruzó su meta.',
    ejemplo: `🏆 *¡Meta cumplida!* Llegaste a los 10 cierres del mes con $23.000 de cash, y 4 días antes de tiempo. Tremendo. ¿Subimos la vara para el mes que viene? — MaKo`,
  },
  {
    id: 'sugerir-experimento', titulo: 'Sugerir nuevo experimento', categoria: 'accion',
    prioridad: 'baja', semaforo: 'na', requiereRespuesta: true, yaImplementado: 'no',
    disparador: 'MaKo detecta un patrón (ángulo/creativo/público) que amerita un test.',
    ejemplo: `🧪 Mirando tus datos, tus mejores leads vienen del ángulo "tiempo", no "precio". Te propongo un *A/B de creativos* con ese gancho la semana que viene. ¿Lo arranco? — MaKo`,
  },
  {
    id: 'closing-objecion', titulo: 'Closing Analyst: objeción recurrente', categoria: 'pregunta',
    prioridad: 'baja', semaforo: 'na', requiereRespuesta: true, yaImplementado: 'no',
    disparador: 'lib/closing detecta patrón de objeciones en las llamadas.',
    ejemplo: `🎧 Analicé tus últimas 6 llamadas de venta. La objeción que más te frena es *"lo tengo que consultar con mi socio"* (4 de 6). Te preparé una forma de adelantarte a eso en la R1. ¿Te la paso? — MaKo`,
  },
  {
    id: 'script-ganador', titulo: 'Ads Analyst: guion ganador por retención', categoria: 'accion',
    prioridad: 'baja', semaforo: 'na', requiereRespuesta: true, yaImplementado: 'no',
    disparador: 'lib/ads-analyst cruza retención por cuartiles con guiones.',
    ejemplo: `📽️ De tus video ads, el que mejor retiene es "Historia cliente": 62% llega al segundo 30. El gancho de precio pierde al 40% en los primeros 5 seg. Conviene *clonar la estructura del ganador*. ¿Armamos un guion nuevo con ese molde? — MaKo`,
  },

  // ── OPERACIÓN / SALUD DEL SISTEMA ──────────────────────────────────────────
  {
    id: 'datos-sin-marcar', titulo: 'Datos sin marcar en el CRM', categoria: 'aviso',
    prioridad: 'media', semaforo: 'amarillo', requiereRespuesta: false, yaImplementado: 'parcial',
    disparador: 'getPendientesDeMarcar ≥ umbral (configurable).',
    ejemplo: `📝 Tienes *7 datos sin marcar* en el CRM (reuniones sin resultado, leads sin calificar). Cinco minutos ahora te ordenan las métricas de la semana. ¿Te paso la lista para resolverlos rápido? — MaKo`,
  },
  {
    id: 'cron-ingesta-fallo', titulo: 'Cron de ingesta falló', categoria: 'aviso',
    prioridad: 'media', semaforo: 'na', requiereRespuesta: false, yaImplementado: 'no',
    disparador: 'Un cron de ingesta (meta/panda/youtube-daily) falla tras reintentos.',
    ejemplo: `🔴 La *ingesta de Meta de anoche falló* (2 intentos). Tus números de hoy pueden estar desactualizados. Ya reintenté; si vuelve a fallar te aviso de nuevo. — MaKo`,
  },
  {
    id: 'saldo-ia-bajo', titulo: 'Saldo de IA de MaKo bajo', categoria: 'aviso',
    prioridad: 'media', semaforo: 'amarillo', requiereRespuesta: false, yaImplementado: 'no',
    disparador: 'Saldo prepago de IA bajo (se lleva manual).',
    ejemplo: `🟡 Tu *saldo de IA* de MaKo está en $4. Cuando se agote dejo de poder generar reportes, mensajes de tus automatizaciones y análisis. Recarga cuando puedas para no cortar el servicio. — MaKo`,
  },
  {
    id: 'accion-confirmada', titulo: 'Confirmación tras ejecutar una acción aprobada', categoria: 'aviso',
    prioridad: 'media', semaforo: 'na', requiereRespuesta: false, yaImplementado: 'no',
    disparador: 'El dueño respondió "sí" a una acción y MaKo la ejecutó.',
    ejemplo: `✅ Hecho. Pausé el conjunto "Retargeting 30d" y quedó registrado. Si el CPL no mejora en 48h te aviso para rotar creativo. — MaKo`,
  },

  // ── DRIVE (el caso que pediste arrancar) ───────────────────────────────────
  {
    id: 'ads-grabaste', titulo: 'Recordatorio: ¿grabaste los anuncios pedidos?', categoria: 'pregunta',
    prioridad: 'media', semaforo: 'na', requiereRespuesta: true, yaImplementado: 'no',
    disparador: 'Tarea "grabar anuncios" creada y vencida sin material subido.',
    ejemplo: `🎬 ¿Ya grabaste los *3 anuncios nuevos* que quedamos la semana pasada? Cuando los tengas, pásame el *link de la carpeta de Drive* y los tomo de ahí directo: te armo la campaña *en pausa* para que solo revises y publiques. — MaKo`,
  },
  {
    id: 'drive-campana-armada', titulo: 'Campaña armada desde Drive (en pausa)', categoria: 'accion',
    prioridad: 'media', semaforo: 'na', requiereRespuesta: true, yaImplementado: 'no',
    disparador: 'MaKo tomó los creativos de la carpeta de Drive y armó la estructura.',
    ejemplo: `📦 Tomé los *4 creativos* de tu carpeta de Drive y te armé una campaña *"Julio - Testimonios"* con 2 conjuntos, toda *en PAUSA*. Revísala en /ads-manager: si te gusta, la publicas tú. ¿Quieres que te resuma cómo quedó? — MaKo`,
  },
];

/** Agrupa el catálogo por categoría, respetando el orden de aparición. */
export function catalogoPorCategoria(): Record<CategoriaAviso, AvisoCatalogo[]> {
  const out: Record<CategoriaAviso, AvisoCatalogo[]> = { reporte: [], aviso: [], accion: [], pregunta: [] };
  for (const a of CATALOGO_AVISOS) out[a.categoria].push(a);
  return out;
}
