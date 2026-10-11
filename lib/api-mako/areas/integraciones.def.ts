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
    descripcion: 'Para UNA integración: para qué sirve, si está conectada, qué campos pide (cuáles son obligatorios, cuáles ya están cargados, cuáles quedaron ilegibles y hay que volver a pegar, cuáles completa MaKo sola) y el paso que hay que hacer del otro lado (por ejemplo, la URL de webhook que se pega en Fathom). Nunca devuelve los valores. Úsala ante «¿qué me falta para conectar X?».',
    parametros: [
      { nombre: 'servicio', tipo: 'string', obligatorio: true, max: 40, descripcion: 'key de la integración (meta, email, gemini, groq, fathom, calendly, calcom, panda, youtube, elevenlabs…), tal como sale en ver_integraciones.', ejemplo: 'fathom' },
    ],
    salida: 'json', canales: TODOS, costo: 'gratis', gating: G_ADMIN,
  },
  {
    id: 'probar_conexion_integracion', area: 'integraciones', tipo: 'lectura',
    titulo: 'Probar la conexión de integración',
    descripcion: 'Prueba una integración con las credenciales YA guardadas: hace el pedido más barato al proveedor y dice si anda y, si no, el motivo (key inválida, falta un campo, el servicio no respondió en 8 s). No acepta credenciales nuevas: para cargarlas, pasa el link de link_configurar_integracion. Google Calendar y el Pixel de MaKo no se prueban aquí (usa ver_estado_google_calendar).',
    parametros: [
      { nombre: 'servicioKey', tipo: 'string', obligatorio: true, max: 40, descripcion: 'key de la integración a probar, tal como sale en ver_integraciones (meta, fathom, gemini…).', ejemplo: 'gemini' },
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
