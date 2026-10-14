// =============================================================================
// api-mako/areas/calendario.def — las operaciones del área `calendario` (definiciones)
// =============================================================================
// La tab Calendario (13/10/2026). Una capacidad nueva de MaKo se DECLARA acá (AGENTS.md): así la usan MaKo por
// WhatsApp, el chat de la app y quien tenga un token, por la misma puerta que la pantalla.
//
// ⚠️ LO QUE SE LEE ES LO PROPIO (`calendario_eventos`) y, desde el 14/10/2026, el link de agenda del negocio
//    (`link_agenda_llamada`) y las próximas veces de lo que se repite (`ver_proximas_recurrentes`). La agenda de Google
//    NO se lee: no pasa por ningún modelo (decisión de Martín del 07/10/2026) y tampoco sale por HTTP. Desde el
//    14/10/2026 sí se ESCRIBE en ella (`crear_evento_google`, con `datosDeGoogle` y sin HTTP). Las reuniones del CRM y
//    los deadlines del Plan ya tienen su área (crm, plan).
//
// Todas llevan `tab: 'calendario'` y `rolMinimo: 'admin'`: es el requireRolWs([], { nav: 'calendario' }) de la página.
// SIN server-only: lo importan los tests y el generador de la referencia. Español neutro (lo lee el cliente).
// =============================================================================

import type { OperacionDef, Gating } from '../tipos';
import { TIPOS_EVENTO, FORMATOS_PUBLICACION } from '@/lib/calendario-modelo';

const GATING: Gating = { tab: 'calendario', rolMinimo: 'admin' };
const TODOS = ['whatsapp', 'app', 'http'] as const;
/** La agenda de Google no sale por HTTP: ahí no hay persona, sólo otro modelo (tests/agenda-sin-ia.test.ts). */
const SIN_HTTP = ['whatsapp', 'app'] as const;

export const DEFS: readonly OperacionDef[] = [
  {
    id: 'listar_eventos_calendario', area: 'calendario', tipo: 'lectura',
    titulo: 'Ver los eventos del Calendario',
    descripcion: 'Lista lo que el negocio agendó en el Calendario (publicaciones, bloques de trabajo, llamadas sueltas) entre dos fechas, con la hora en la zona del negocio. NO trae la agenda de Google ni las reuniones del CRM ni los deadlines del Plan: para eso están las operaciones de crm y plan. Úsala cuando pregunten «qué tengo agendado para publicar esta semana».',
    parametros: [
      { nombre: 'desde', tipo: 'string', max: 10, descripcion: 'Inicio, inclusive, YYYY-MM-DD. Si se omite, hoy.', ejemplo: '2026-10-12' },
      { nombre: 'hasta', tipo: 'string', max: 10, descripcion: 'Fin, inclusive, YYYY-MM-DD. Si se omite, 7 días después de «desde». Máximo 62 días.', ejemplo: '2026-10-18' },
    ],
    salida: 'json', canales: TODOS, costo: 'gratis', gating: GATING,
  },
  {
    id: 'crear_evento_calendario', area: 'calendario', tipo: 'accion', confirmacion: 'chat',
    titulo: 'Agendar un evento en el Calendario',
    descripcion: 'Propone agendar UN evento en el Calendario: una publicación (Story, Reel, Post, Anuncio, Email, Video), un bloque de trabajo o una llamada. La fecha y la hora van como las dijo la persona, en la zona del negocio; sin hora, es de todo el día. No mira la agenda: no digas que un horario está libre.',
    parametros: [
      { nombre: 'titulo', tipo: 'string', obligatorio: true, max: 160, descripcion: 'Qué es, corto («Reel del caso de éxito», «Escribir guiones»).' },
      { nombre: 'tipo', tipo: 'string', obligatorio: true, enum: [...TIPOS_EVENTO], descripcion: 'publicacion, bloque (de trabajo), llamada u otro.' },
      { nombre: 'formato', tipo: 'string', enum: [...FORMATOS_PUBLICACION], descripcion: 'Sólo si es una publicación: story, reel, post, ad, email, video u otro.' },
      { nombre: 'fecha', tipo: 'string', obligatorio: true, max: 10, descripcion: 'YYYY-MM-DD, en la zona del negocio.', ejemplo: '2026-10-15' },
      { nombre: 'hora', tipo: 'string', max: 5, descripcion: 'HH:MM en 24 horas, en la zona del negocio. Si se omite, es de todo el día.', ejemplo: '10:00' },
      { nombre: 'duracionMin', tipo: 'number', entero: true, minimo: 5, maximo: 1440, descripcion: 'Cuánto dura, en minutos (para bloques y llamadas).' },
      { nombre: 'notas', tipo: 'string', max: 4000, descripcion: 'Notas opcionales.' },
    ],
    canales: TODOS, costo: 'gratis', gating: GATING,
    reversible: true,
    escribe: 'insert en calendario_eventos (origen api)',
  },
  {
    // 14/10/2026 (Martín: lo que se crea desde MaKo se escribe en Google, como en Google). ESCRIBE en la agenda y no la
    // lee: el modelo pasa lo que dijo la persona y el código crea el evento en el calendario principal de Google.
    id: 'crear_evento_google', area: 'calendario', tipo: 'accion', confirmacion: 'chat',
    titulo: 'Crear un evento en Google Calendar',
    descripcion: 'Propone crear UN evento en el calendario principal de la cuenta de Google conectada (no en el Calendario de MaKo). La fecha y la hora van como las dijo la persona, en la zona del negocio; sin hora, es de todo el día. No mira la agenda: no digas que un horario está libre.',
    parametros: [
      { nombre: 'titulo', tipo: 'string', obligatorio: true, max: 300, descripcion: 'El título del evento.' },
      { nombre: 'fecha', tipo: 'string', obligatorio: true, max: 10, descripcion: 'YYYY-MM-DD, en la zona del negocio.', ejemplo: '2026-10-15' },
      { nombre: 'hora', tipo: 'string', max: 5, descripcion: 'HH:MM en 24 horas. Si se omite, es de todo el día.', ejemplo: '10:00' },
      { nombre: 'duracionMin', tipo: 'number', entero: true, minimo: 5, maximo: 1440, descripcion: 'Cuánto dura, en minutos. Si se omite, una hora.' },
      { nombre: 'ubicacion', tipo: 'string', max: 300, descripcion: 'Dónde, si lo dijo.' },
      { nombre: 'descripcion', tipo: 'string', max: 4000, descripcion: 'Notas del evento, si las dijo.' },
    ],
    canales: SIN_HTTP, costo: 'externo', gating: GATING, datosDeGoogle: true,
    reversible: true,
    escribe: 'crea un evento en el calendario principal de Google Calendar',
  },
  {
    // 14/10/2026 (Martín: «agregar el calendly o cal, para agendar llamadas»). El MISMO link que «Crear › Agendar
    // llamada» de la pantalla (lib/agenda-link.ts): Calendly o, si no hay, Cal.com. No lee ninguna agenda.
    id: 'link_agenda_llamada', area: 'calendario', tipo: 'lectura',
    titulo: 'Link para agendar una llamada',
    descripcion: 'La página pública de reserva del negocio para la primera reunión (R1) o la segunda (R2): la de Calendly o, si no tiene Calendly, la de Cal.com. Es lo que se manda para que alguien agende una llamada; la reserva entra sola al CRM y al Calendario. Si no hay ninguna conectada, devuelve `url: null` con el motivo. Para el link de Calendly con el nombre y el email de un lead ya puestos, usa link_agenda_calendly.',
    parametros: [
      { nombre: 'cual', tipo: 'string', enum: ['R1', 'R2'], descripcion: 'Qué reunión: R1 (primera) o R2 (segunda). Si se omite, R1.' },
    ],
    salida: 'json', canales: TODOS, costo: 'externo', gating: GATING,
  },
  {
    // 14/10/2026 (Martín: «ver las tareas recurrentes allí»): la capa «Se repite» de la pantalla, por la API.
    id: 'ver_proximas_recurrentes', area: 'calendario', tipo: 'lectura',
    titulo: 'Próximas veces de las tareas que se repiten',
    descripcion: 'Las próximas fechas de cada tarea del Plan que se repite (según su ritmo), entre dos fechas: lo que el Calendario dibuja en «Se repite». Son PROYECCIONES: la tarea de ese día la crea MaKo sola cuando toca (y entonces aparece como deadline en el Plan). Sólo de hoy en adelante. Úsala para «¿qué se repite esta semana?».',
    parametros: [
      { nombre: 'desde', tipo: 'string', max: 10, descripcion: 'Inicio, inclusive, YYYY-MM-DD. Si se omite, hoy.', ejemplo: '2026-10-12' },
      { nombre: 'hasta', tipo: 'string', max: 10, descripcion: 'Fin, inclusive, YYYY-MM-DD. Si se omite, 7 días después de «desde». Máximo 62 días.', ejemplo: '2026-10-18' },
    ],
    salida: 'json', canales: TODOS, costo: 'gratis', gating: GATING,
  },
];
