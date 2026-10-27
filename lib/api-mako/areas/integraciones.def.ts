// =============================================================================
// api-mako/areas/integraciones.def — las operaciones del área `integraciones` (definiciones)
// =============================================================================
// Una entrada por operación: id, qué es, parámetros, por qué canales sale, cómo se
// confirma. SIN server-only y sin importar valores de módulos que lo tengan: esto
// lo importan los tests y el generador de la referencia. Los cuerpos van en
// integraciones.run.ts, cruzados por id. Español neutro (lo lee el cliente).
//
// El área es SOLO ESTADO: qué está conectado, si anda, cuánta cuota gratis de IA
// queda hoy. Nunca un valor: ni credenciales, ni máscaras, ni el token del agente,
// ni las integraciones de la plataforma para un workspace cliente. Guardar, borrar,
// desconectar o elegir cuenta NO están: la salida honesta es el link de
// link_configurar_integracion, donde una persona lo hace en /integraciones.
// La excepción es una COMPUTADORA con MaKo Desktop (desconectar_computadora, 25/10/2026): no
// es una credencial que se pega en un formulario, y desconectarla se confirma con un «sí».
//
// ⚠️ SALVO META POR ZERNIO (25/10/2026, Martín: «todo MaKo se debe poder utilizar por API»): lo de «Conectar con Facebook»
// se lee (ver_conexion_meta) y se elige (cuenta, píxel, página: tres acciones con su «sí») y CAPI se prueba
// (probar_capi_meta, con el código de «Probar eventos», que no cuenta en el píxel). Ninguna pega un secreto: son ids que la
// conexión YA ve. Conectar en sí es un clic de una persona en la ventana de Facebook: eso sigue siendo el link.
// Los ids no llevan «zernio» a propósito (tests/sin-instagram.test.ts).
//
// La salud en vivo de Meta y sus incidentes ya viven en el área `ads`
// (ver_salud_cuenta_meta, ver_estado_meta, listar_incidentes_meta): no se duplican.
//
// Los keys de servicio van como string libre validado en el runner: el catálogo
// (lib/metodo-catalogo.ts) es server-only y además depende del workspace (GitHub
// solo existe para la plataforma). Un enum aquí lo filtraría a todos.
// =============================================================================

import type { Gating, OperacionDef } from '../tipos';
import { TABS_ACTIVACION as TABS_CON_ACTIVACION } from '../../tab-activacion';

const TODOS = ['whatsapp', 'app', 'http'] as const;
/** Costos de IA: nunca por HTTP (decisión del diseño, §4 regla de canales). */
const SIN_HTTP = ['whatsapp', 'app'] as const;

const G_TAB: Gating = { tab: 'integraciones' };
const G_ADMIN: Gating = { tab: 'integraciones', rolMinimo: 'admin' };

/**
 * Las tabs con activación: las CLAVES de lib/tab-activacion.ts (datos puros, sin server-only,
 * así que esta def lo puede importar). Cerrado: el runner lo vuelve a validar.
 *
 * ⚠️ SE DERIVA, NO SE COPIA. Era una lista escrita a mano y el 09/10/2026 la entrada `whatsapp`
 * se fue de lib/tab-activacion.ts con el WhatsApp oficial (pedía sus credenciales): la copia la
 * siguió ofreciendo, y la API le decía a MaKo que `ver_activacion_tab` aceptaba una tab que el
 * runner contestaba «no tiene activación declarada». Lo fija el test «la API de MaKo ofrece la
 * activación sólo de las tabs que la tienen», en el guard del retiro del oficial.
 */
const TABS_ACTIVACION: readonly string[] = Object.keys(TABS_CON_ACTIVACION);

export const DEFS: readonly OperacionDef[] = [
  {
    id: 'ver_integraciones', area: 'integraciones', tipo: 'lectura',
    titulo: 'Estado de las integraciones',
    descripcion: 'Lista las integraciones que ve este negocio (Meta, email, IA, Fathom, Calendly, Google Calendar, Pixel de MaKo, Claude…) con su estado «conectada» o «falta» y qué campos le faltan. Es presencia de credenciales, NO una prueba: «conectada» no garantiza que ande. Para probarla usa probar_conexion_integracion; para Google usa ver_estado_google_calendar; para la salud de Meta, ver_salud_cuenta_meta. No requiere parámetros.',
    parametros: [],
    salida: 'json', canales: TODOS, costo: 'gratis', gating: G_ADMIN,
  },
  {
    id: 'ver_integracion', area: 'integraciones', tipo: 'lectura',
    titulo: 'Detalle de una integración',
    descripcion: 'Para UNA integración: para qué sirve, si está conectada, qué campos pide (cuáles son obligatorios, cuáles ya están cargados, cuáles quedaron ilegibles y hay que volver a pegar, cuáles completa MaKo sola), los pasos del tutorial oficial para sacar la credencial y el paso que hay que hacer del otro lado (por ejemplo, la URL de webhook que se pega en Fathom). Nunca devuelve los valores. Úsala ante «¿qué me falta para conectar X?».',
    parametros: [
      { nombre: 'servicio', tipo: 'string', obligatorio: true, max: 40, descripcion: 'key de la integración (meta, email, gemini, groq, fathom, tldv, fireflies, zoom, otter, calendly, calcom, panda, youtube, elevenlabs…), tal como sale en ver_integraciones.', ejemplo: 'fathom' },
    ],
    salida: 'json', canales: TODOS, costo: 'gratis', gating: G_ADMIN,
  },
  {
    id: 'probar_conexion_integracion', area: 'integraciones', tipo: 'lectura',
    titulo: 'Probar la conexión de integración',
    descripcion: 'Prueba una integración con las credenciales YA guardadas: hace el pedido más barato al proveedor y dice si anda y, si no, el motivo (key inválida, falta un campo, el servicio no respondió en 8 s). No acepta credenciales nuevas: para cargarlas, pasa el link de link_configurar_integracion. Google Calendar y el Pixel de MaKo no se prueban aquí (usa ver_estado_google_calendar).',
    parametros: [
      { nombre: 'servicioKey', tipo: 'string', obligatorio: true, max: 40, descripcion: 'key de la integración a probar, tal como sale en ver_integraciones (meta, fathom, tldv, fireflies, zoom, gemini…).', ejemplo: 'gemini' },
    ],
    salida: 'json', canales: TODOS, costo: 'externo', gating: G_ADMIN,
  },
  {
    id: 'ver_estado_google_calendar', area: 'integraciones', tipo: 'lectura',
    titulo: 'Estado real de Google Calendar',
    descripcion: 'Si la agenda de Google del negocio está conectada DE VERDAD: pregunta a Google, así que distingue «nunca se conectó» de «Google rechazó el permiso y hay que reconectar» (los permisos caducan), y dice si el permiso alcanza para MOVER reuniones o es de solo lectura. Úsala cuando reagendar falla o antes de prometer que MaKo mueve un evento. No requiere parámetros.',
    parametros: [],
    salida: 'json', canales: TODOS, costo: 'externo', gating: G_ADMIN,
  },
  {
    id: 'ver_cuotas_ia', area: 'integraciones', tipo: 'lectura',
    titulo: 'Cuota gratis de IA hoy',
    descripcion: 'Para cada IA gratis (Gemini, Groq, Mistral, OpenRouter): cuántas cuentas tiene cargadas el negocio y el máximo, cuántos pedidos y tokens se usaron HOY contra su tope diario, el porcentaje consumido y si está agotada, con el detalle POR CUENTA (una IA está agotada solo si todas sus cuentas lo están; las cuotas no se suman entre cuentas). Úsala cuando una generación falla por cuota o para sugerir sumar otra cuenta. Sin montos de dinero.',
    parametros: [],
    salida: 'json', canales: TODOS, costo: 'externo', gating: G_TAB,
  },
  {
    id: 'ver_gasto_ia', area: 'integraciones', tipo: 'lectura',
    titulo: 'Gasto de IA del mes',
    descripcion: 'Lo que el negocio gastó en IA en el mes en curso (USD), por proveedor y por proceso, los tokens de hoy, la última operación y, en los proveedores pagos con saldo cargado a mano, cuánto queda. El gasto es un PISO: hay procesos que no se registran. Úsala ante «¿cuánto llevo gastado en IA?» o «¿me queda saldo?». No requiere parámetros.',
    parametros: [],
    salida: 'json', canales: SIN_HTTP, costo: 'externo', gating: G_ADMIN,
  },
  {
    id: 'ver_activacion_tab', area: 'integraciones', tipo: 'lectura',
    titulo: 'Qué le falta a una tab',
    descripcion: 'Para una tab de MaKo (closing, email, script, crm, marketing, experimentos, comercial): qué integración necesita, si ya está conectada, qué le falta en palabras simples y el aviso de cuando conectar no alcanza (por ejemplo, Calendly necesita además sus tipos de evento). Es la respuesta a «¿por qué mi CRM está vacío?»: distingue configuración faltante de dato vacío. WhatsApp no está: su número se vincula por QR desde la misma tab, sin credenciales.',
    parametros: [
      { nombre: 'key', tipo: 'string', obligatorio: true, enum: TABS_ACTIVACION, descripcion: 'la tab: closing (la hoja Closing del Dashboard), email, script (los guiones de los anuncios: Ads Writer y la hoja Ads Analyst del Dashboard), crm, marketing (Dashboard), experimentos o comercial.' },
    ],
    salida: 'json', canales: TODOS, costo: 'gratis', gating: G_TAB,
  },
  {
    id: 'ver_estado_agente_claude', area: 'integraciones', tipo: 'lectura',
    titulo: 'Estado de Claude conectado',
    descripcion: 'Si el negocio ya generó el token para conectar Claude (la skill de MaKo) y con qué alcance: solo leer, leer y proponer, o además ejecutar. Nunca devuelve el token: sólo su pista (el prefijo y los últimos 4 caracteres) para reconocerlo. Úsala ante «¿tengo Claude conectado?» o para explicar por qué Claude no puede confirmar una acción. No requiere parámetros.',
    parametros: [],
    salida: 'json', canales: TODOS, costo: 'gratis', gating: G_ADMIN,
  },
  // ── Conectar: qué IA tiene el negocio y cómo se conecta cada cosa (25/10/2026, docs/conexiones-y-ayuda.md) ──
  {
    id: 'ver_ia_del_negocio', area: 'integraciones', tipo: 'lectura',
    titulo: 'Con qué IA trabaja el negocio',
    descripcion: 'Con qué IA trabaja este negocio y qué contesta cada cosa: si tiene su Claude, su GPT o su Gemini por clave (propia, copia de la de MaKo o guardada e ilegible), cuántas computadoras con MaKo Desktop tiene conectadas y cuántas en línea, y con eso qué contesta el chat de la app, el grupo de WhatsApp, las notas de voz y el análisis de llamadas. Trae el link de cada conexión. Nunca devuelve una clave. Úsala ante «¿por qué no me contestas?», «¿tengo mi IA conectada?» o «¿con qué IA trabajas?».',
    parametros: [],
    salida: 'json', canales: TODOS, costo: 'gratis', gating: G_TAB,
  },
  // LAS COMPUTADORAS CON MAKO DESKTOP (25/10/2026, Martín: «todo MaKo se debe poder utilizar por API», leer Y cambiar). Leer
  // cuáles hay y desconectar una; CONECTAR no está, a propósito: pide a la persona frente a su computadora, que acepte el texto
  // de su IA y diga «sí» en la ventana del programa (lib/ia-pc-reglas.ts → CONSENTIMIENTO_DE). Sin HTTP: son las máquinas y
  // los correos del equipo, no del que escribe. Un miembro (closer, setter) ve y desconecta sólo las suyas, como en /perfil/ia.
  {
    id: 'ver_computadoras', area: 'integraciones', tipo: 'lectura',
    titulo: 'Computadoras con MaKo Desktop',
    descripcion: 'Las computadoras conectadas a este negocio con MaKo Desktop (la app de escritorio que contesta el chat con el Claude o el ChatGPT de la persona): su número (id), su nombre, de quién es, si está en línea ahora, cuándo se la vio por última vez, el sistema, la versión del programa y si su IA tiene la sesión iniciada. A quien no es admin, sólo las suyas. Úsala antes de desconectar_computadora, o ante «¿está prendida mi computadora?» o «¿qué computadoras tengo conectadas?». Para el resumen (cuántas y qué contesta cada cosa), ver_ia_del_negocio.',
    parametros: [],
    salida: 'json', canales: SIN_HTTP, costo: 'gratis', gating: G_TAB,
  },
  {
    id: 'desconectar_computadora', area: 'integraciones', tipo: 'accion', confirmacion: 'chat', reversible: false,
    titulo: 'Desconectar una computadora',
    descripcion: 'PROPONE desconectar UNA computadora con MaKo Desktop de este negocio (queda pendiente hasta el «sí»): deja de contestar con la IA de esa persona, se le cortan los turnos en curso y el programa de esa computadora se apaga solo. Para volver a usarla hay que conectarla de nuevo DESDE esa computadora (no se deshace por aquí). La suya, siempre; la de otro, sólo el admin. El número sale de ver_computadoras.',
    escribe: 'revoca la computadora en ia_pc_dispositivos, borra su ubicación y sus cuentas, y vence sus turnos en curso',
    parametros: [
      { nombre: 'id', tipo: 'number', obligatorio: true, entero: true, minimo: 1, descripcion: 'el número de la computadora, tal como sale en ver_computadoras.', ejemplo: 12 },
    ],
    canales: SIN_HTTP, costo: 'gratis', gating: G_TAB,
  },
  {
    id: 'como_conectar', area: 'integraciones', tipo: 'lectura',
    titulo: 'Cómo se conecta algo',
    descripcion: 'Cómo se conecta UNA cosa, para guiar a la persona: qué destraba, si ya está conectada, quién la conecta, que se hace desde la computadora, los pasos oficiales y el link que abre justo esa conexión. Sirve para las tarjetas de Integraciones (Fathom, Zernio, Calendly, su GPT…) y para lo que no es una tarjeta: MaKo en su computadora (MaKo Desktop), «Tus cuentas de IA» y su número de WhatsApp. Úsala ante «¿cómo conecto X?», «ayúdame a conectar…» o cuando una herramienta devolvió `falta`. Pasa los pasos de a uno y nunca pidas una clave por el chat.',
    parametros: [
      { nombre: 'que', tipo: 'string', obligatorio: true, max: 80, descripcion: 'lo que quiere conectar, con la key de ver_integraciones o con sus palabras: «fathom», «mi claude», «instagram», «la app de escritorio», «whatsapp».', ejemplo: 'fathom' },
    ],
    salida: 'json', canales: TODOS, costo: 'gratis', gating: G_TAB,
  },
  // ── Meta por Zernio («Conectar con Facebook», 25/10/2026): leer, elegir y probar ─────────
  {
    id: 'ver_conexion_meta', area: 'integraciones', tipo: 'lectura',
    titulo: 'Conexión de Meta del negocio',
    descripcion: 'Cómo habla MaKo con Meta para este negocio: por su conexión de «Conectar con Facebook» (Zernio) o por el token de antes, y lo que esa conexión ve: las cuentas publicitarias (y cuál está elegida), los píxeles (y cuál), la página de los anuncios (y si hay que elegirla), y por dónde salen las conversiones al píxel (CAPI). Nunca devuelve tokens. Úsala antes de elegir_cuenta_meta, elegir_pixel_meta o elegir_pagina_meta, y ante «¿por qué no conecta Meta?». No requiere parámetros.',
    parametros: [],
    salida: 'json', canales: TODOS, costo: 'externo', gating: G_ADMIN,
  },
  {
    id: 'elegir_cuenta_meta', area: 'integraciones', tipo: 'accion', confirmacion: 'chat', reversible: true,
    titulo: 'Elegir la cuenta publicitaria de Meta',
    descripcion: 'PROPONE elegir con qué cuenta publicitaria trabaja MaKo (métricas, Media Buyer, publicar), entre las que ve la conexión de «Conectar con Facebook» (queda pendiente hasta el «sí»). Sólo para un negocio conectado así: mira antes ver_conexion_meta. Con el token de antes, la cuenta se elige en Integraciones (link_configurar_integracion).',
    escribe: 'la credencial META_AD_ACCOUNT_ID del negocio, y arranca el histórico de métricas',
    parametros: [
      { nombre: 'cuenta', tipo: 'string', obligatorio: true, max: 30, descripcion: 'id de la cuenta publicitaria con act_ adelante, tal como sale en ver_conexion_meta.', ejemplo: 'act_1426493815659364' },
    ],
    canales: TODOS, costo: 'gratis', gating: G_ADMIN,
  },
  {
    id: 'elegir_pixel_meta', area: 'integraciones', tipo: 'accion', confirmacion: 'chat', reversible: true,
    titulo: 'Elegir el píxel de Meta',
    descripcion: 'PROPONE elegir el píxel donde quedan registradas las conversiones del negocio (el contacto de un formulario, el calificado del CRM, la reunión agendada), entre los que ve la conexión de «Conectar con Facebook» (queda pendiente hasta el «sí»). Mira antes ver_conexion_meta. Para probar que llegan: probar_capi_meta.',
    escribe: 'la credencial META_PIXEL_ID del negocio',
    parametros: [
      { nombre: 'pixel', tipo: 'string', obligatorio: true, max: 20, descripcion: 'id del píxel (sólo números), tal como sale en ver_conexion_meta.', ejemplo: '1869323014511830' },
    ],
    canales: TODOS, costo: 'gratis', gating: G_ADMIN,
  },
  {
    id: 'elegir_pagina_meta', area: 'integraciones', tipo: 'accion', confirmacion: 'chat', reversible: true,
    titulo: 'Elegir la página de Facebook de los anuncios',
    descripcion: 'PROPONE elegir la página de Facebook con la que corren los anuncios y los formularios (queda pendiente hasta el «sí»). Con varias páginas y sin elegir una, Facebook no deja conectar: con la página elegida, la próxima «Conectar con Facebook» abre con ella; con la conexión ya hecha, se cambia ahí mismo. Mira antes ver_conexion_meta (las páginas que MaKo conoce).',
    escribe: 'la credencial META_PAGE_ID del negocio y, con la conexión hecha, la página de la conexión en Zernio',
    parametros: [
      { nombre: 'pagina', tipo: 'string', obligatorio: true, max: 20, descripcion: 'id de la página de Facebook (sólo números), tal como sale en ver_conexion_meta o en «Información» → «Transparencia de la página».', ejemplo: '1315098941694049' },
    ],
    canales: TODOS, costo: 'gratis', gating: G_ADMIN,
  },
  {
    id: 'probar_capi_meta', area: 'integraciones', tipo: 'lectura',
    titulo: 'Probar las conversiones al píxel',
    descripcion: 'Manda UN evento de prueba («PruebaMaKo», no un contacto) al píxel del negocio por el mismo camino que usa MaKo de verdad (la conexión de Facebook, o el token del píxel), con el código de «Probar eventos» del Administrador de eventos. Dice si Meta lo recibió y, si no, el motivo; por la conexión de Facebook el código no llega a Meta y el evento se ve en la vista general del píxel. Úsala ante «¿le llegan a Meta mis contactos?».',
    parametros: [
      { nombre: 'codigo', tipo: 'string', obligatorio: true, max: 30, descripcion: 'el código de prueba que da el Administrador de eventos → tu píxel → «Probar eventos» (empieza con TEST).', ejemplo: 'TEST12345' },
    ],
    salida: 'json', canales: TODOS, costo: 'externo', gating: G_ADMIN,
  },
  {
    id: 'link_configurar_integracion', area: 'integraciones', tipo: 'lectura',
    titulo: 'Link para conectar integración',
    descripcion: 'Devuelve el link que abre /integraciones con el formulario de esa integración ya abierto, para que la persona pegue su credencial o autorice con Google. Úsala SIEMPRE que haya que cargar, cambiar o borrar una credencial: nunca pidas una key por el chat. Necesita la key de la integración (de ver_integraciones).',
    parametros: [
      { nombre: 'servicio', tipo: 'string', obligatorio: true, max: 40, descripcion: 'key de la integración, tal como sale en ver_integraciones (meta, google, agente, landing…).', ejemplo: 'calendly' },
    ],
    salida: 'json', canales: TODOS, costo: 'gratis', gating: G_TAB,
  },
];
