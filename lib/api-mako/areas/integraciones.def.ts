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

const TODOS = ['whatsapp', 'app', 'http'] as const;
/** Costos de IA: nunca por HTTP (decisión del diseño, §4 regla de canales). */
const SIN_HTTP = ['whatsapp', 'app'] as const;

const G_TAB: Gating = { tab: 'integraciones' };
const G_ADMIN: Gating = { tab: 'integraciones', rolMinimo: 'admin' };

/** Las tabs de lib/tab-activacion.ts (TABS_ACTIVACION). Cerrado: el runner lo vuelve a validar. */
const TABS_ACTIVACION = ['closing', 'whatsapp', 'email', 'script', 'crm', 'marketing', 'experimentos', 'comercial'] as const;

export const DEFS: readonly OperacionDef[] = [
  {
    id: 'ver_integraciones', area: 'integraciones', tipo: 'lectura',
    titulo: 'Estado de las integraciones',
    descripcion: 'Lista las integraciones que ve este negocio (Meta, WhatsApp, email, IA, Fathom, Calendly, Google Calendar, Pixel de MaKo, Claude…) con su estado «conectada» o «falta» y qué campos le faltan. Es presencia de credenciales, NO una prueba: «conectada» no garantiza que ande. Para probarla usa probar_conexion_integracion; para Google usa ver_estado_google_calendar; para la salud de Meta, ver_salud_cuenta_meta. No requiere parámetros.',
    parametros: [],
    salida: 'json', canales: TODOS, costo: 'gratis', gating: G_ADMIN,
  },
  {
    id: 'ver_integracion', area: 'integraciones', tipo: 'lectura',
    titulo: 'Detalle de una integración',
    descripcion: 'Para UNA integración: para qué sirve, si está conectada, qué campos pide (cuáles son obligatorios, cuáles ya están cargados, cuáles quedaron ilegibles y hay que volver a pegar, cuáles completa MaKo sola) y el paso que hay que hacer del otro lado (por ejemplo, la URL de webhook que se pega en Fathom). Nunca devuelve los valores. Úsala ante «¿qué me falta para conectar X?».',
    parametros: [
      { nombre: 'servicio', tipo: 'string', obligatorio: true, max: 40, descripcion: 'key de la integración (meta, whatsapp, email, gemini, groq, fathom, calendly, calcom, panda, youtube, elevenlabs…), tal como sale en ver_integraciones.', ejemplo: 'fathom' },
    ],
    salida: 'json', canales: TODOS, costo: 'gratis', gating: G_ADMIN,
  },
  {
    id: 'probar_conexion_integracion', area: 'integraciones', tipo: 'lectura',
    titulo: 'Probar la conexión de integración',
    descripcion: 'Prueba una integración con las credenciales YA guardadas: hace el pedido más barato al proveedor y dice si anda y, si no, el motivo (key inválida, falta un campo, el servicio no respondió en 8 s). No acepta credenciales nuevas: para cargarlas, pasa el link de link_configurar_integracion. Google Calendar y el Pixel de MaKo no se prueban aquí (usa ver_estado_google_calendar).',
    parametros: [
      { nombre: 'servicioKey', tipo: 'string', obligatorio: true, max: 40, descripcion: 'key de la integración a probar, tal como sale en ver_integraciones (meta, whatsapp, fathom, gemini…).', ejemplo: 'gemini' },
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
    descripcion: 'Para una tab de MaKo (closing, whatsapp, email, script, crm, marketing, experimentos, comercial): qué integración necesita, si ya está conectada, qué le falta en palabras simples y el aviso de cuando conectar no alcanza (por ejemplo, Calendly necesita además sus tipos de evento). Es la respuesta a «¿por qué mi CRM o mi WhatsApp está vacío?»: distingue configuración faltante de dato vacío.',
    parametros: [
      { nombre: 'key', tipo: 'string', obligatorio: true, enum: TABS_ACTIVACION, descripcion: 'la tab: closing (Closing Analyst), whatsapp, email, script (Ads Analyst), crm, marketing (Dashboard), experimentos o comercial.' },
    ],
    salida: 'json', canales: TODOS, costo: 'gratis', gating: G_TAB,
  },
  {
    id: 'ver_estado_agente_claude', area: 'integraciones', tipo: 'lectura',
    titulo: 'Estado de Claude conectado',
    descripcion: 'Si el negocio ya generó el token para conectar Claude (la skill de MaKo) y con qué alcance: solo leer, leer y proponer, o además ejecutar. Nunca devuelve el token. Úsala ante «¿tengo Claude conectado?» o para explicar por qué Claude no puede confirmar una acción. No requiere parámetros.',
    parametros: [],
    salida: 'json', canales: TODOS, costo: 'gratis', gating: G_ADMIN,
  },
  {
    id: 'link_configurar_integracion', area: 'integraciones', tipo: 'lectura',
    titulo: 'Link para conectar integración',
    descripcion: 'Devuelve el link que abre /integraciones con el formulario de esa integración ya abierto, para que la persona pegue su credencial o autorice con Google. Úsala SIEMPRE que haya que cargar, cambiar o borrar una credencial: nunca pidas una key por el chat. Necesita la key de la integración (de ver_integraciones).',
    parametros: [
      { nombre: 'servicio', tipo: 'string', obligatorio: true, max: 40, descripcion: 'key de la integración, tal como sale en ver_integraciones (meta, whatsapp, google, agente, landing…).', ejemplo: 'calendly' },
    ],
    salida: 'json', canales: TODOS, costo: 'gratis', gating: G_TAB,
  },
];
