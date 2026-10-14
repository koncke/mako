// =============================================================================
// api-mako/areas/calendario.def — las operaciones del área `calendario` (definiciones)
// =============================================================================
// La tab Calendario (13/10/2026). Una capacidad nueva de MaKo se DECLARA acá (AGENTS.md): así la usan MaKo por
// WhatsApp, el chat de la app y quien tenga un token, por la misma puerta que la pantalla.
//
// ⚠️ SÓLO LO PROPIO. Lo que se lee y se escribe acá son los eventos que la persona agenda en el Calendario
//    (`calendario_eventos`). La agenda de Google NO: la agenda no pasa por ningún modelo (decisión de Martín del
//    07/10/2026) y tampoco sale por HTTP. Las reuniones del CRM y los deadlines del Plan ya tienen su área (crm, plan).
//
// Todas llevan `tab: 'calendario'` y `rolMinimo: 'admin'`: es el requireRolWs([], { nav: 'calendario' }) de la página.
// SIN server-only: lo importan los tests y el generador de la referencia. Español neutro (lo lee el cliente).
// =============================================================================

import type { OperacionDef, Gating } from '../tipos';
import { TIPOS_EVENTO, FORMATOS_PUBLICACION } from '@/lib/calendario-modelo';

const GATING: Gating = { tab: 'calendario', rolMinimo: 'admin' };
const TODOS = ['whatsapp', 'app', 'http'] as const;

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
];
