// =============================================================================
// api-mako/areas/mako.def — operaciones sobre MaKo mismo
// =============================================================================
// Las pendientes (listar, confirmar, cancelar) viven acá y son las ÚNICAS de tipo
// `control` del registro: no proponen nada, cierran algo ya propuesto. El test lo
// fija. El resto del área (el estado de pendientes y propuestas, las bandejas y
// el catálogo de capacidades) se declara abajo con el mismo molde.
//
// Español neutro en descripciones y textos: los lee el cliente en la referencia.
// =============================================================================

import type { OperacionDef } from '../tipos';
import { CAPACIDADES } from '@/lib/mako-capacidades';

const TODOS = ['whatsapp', 'app', 'http'] as const;

export const DEFS: readonly OperacionDef[] = [
  {
    id: 'listar_pendientes', area: 'mako', tipo: 'lectura',
    titulo: 'Acciones pendientes de confirmar',
    descripcion: 'Lista las acciones que quedaron pendientes de confirmación y siguen vigentes (no vencidas): qué se propuso, de dónde vino y cuándo vence. En WhatsApp muestra las del grupo y las que llegaron por la API del mismo negocio. No requiere parámetros.',
    parametros: [],
    salida: 'json', canales: ['whatsapp', 'app', 'http'], costo: 'gratis',
  },
  {
    id: 'confirmar_accion', area: 'mako', tipo: 'control', alcanceMinimo: 'ejecutar',
    titulo: 'Confirmar una acción pendiente',
    descripcion: 'EJECUTA una acción que estaba pendiente de confirmación, cuando la persona dio el OK («sí», «dale», «confirmo»). En WhatsApp, si hay una sola pendiente vigente puedes omitir el id; en cualquier otro canal el id es obligatorio (de listar_pendientes). Por la API solo funciona con un token de alcance «ejecutar».',
    parametros: [{ nombre: 'id', tipo: 'number', descripcion: 'id de la acción pendiente a ejecutar (de listar_pendientes).' }],
    canales: ['whatsapp', 'app', 'http'], costo: 'gratis',
  },
  {
    id: 'cancelar_accion', area: 'mako', tipo: 'control', alcanceMinimo: 'proponer',
    titulo: 'Cancelar una acción pendiente',
    descripcion: 'Cancela una acción pendiente (la persona dijo que no, o cambió de idea). En WhatsApp, si hay una sola vigente puedes omitir el id; en cualquier otro canal el id es obligatorio.',
    parametros: [{ nombre: 'id', tipo: 'number', descripcion: 'id de la acción pendiente a cancelar (de listar_pendientes).' }],
    canales: ['whatsapp', 'app', 'http'], costo: 'gratis',
  },
  // ── Estado de lo que ya se propuso ──────────────────────────────────────────
  {
    id: 'ver_pendiente', area: 'mako', tipo: 'lectura',
    titulo: 'Estado de una acción pendiente',
    descripcion: 'Trae UNA acción pendiente por id en cualquier estado (pendiente, confirmada, ejecutada, cancelada, vencida, error), con el resultado de la ejecución y cuándo se resolvió. Si quedó confirmada y nunca dejó resultado, sale como sin_resultado: pudo haber escrito a medias, así que no la vuelvas a proponer sin revisar. Úsala para contestar «¿se ejecutó lo que confirmé?» o después de un timeout, ANTES de volver a confirmar o a proponer. Cada canal ve solo las pendientes que puede confirmar: por la API, solo las que se propusieron por la API.',
    parametros: [{ nombre: 'id', tipo: 'number', obligatorio: true, entero: true, minimo: 1, descripcion: 'id de la acción pendiente (de listar_pendientes o de la respuesta de la acción que la creó).' }],
    salida: 'json', canales: TODOS, costo: 'gratis',
  },
  {
    id: 'listar_propuestas_revisar', area: 'mako', tipo: 'lectura',
    titulo: 'Propuestas de acción por revisar',
    descripcion: 'La bandeja /mako/revisar: las acciones con formulario (montos, textos, creaciones con varios campos, borrados) que quedaron esperando que una persona las revise y confirme en MaKo, con su link absoluto y hace cuántas horas esperan. Trae además las que se confirmaron y NO quedaron hechas en los últimos 7 días (fallaron, o se cortaron sin dejar resultado), que ya no aparecen en la bandeja. Úsala para el link que nadie abrió. Por la API solo lista las que propuso la API y cuenta el resto. Tope de 100 pendientes y 20 fallidas.',
    parametros: [],
    salida: 'json', canales: TODOS, costo: 'gratis',
  },
  {
    id: 'ver_propuesta_accion', area: 'mako', tipo: 'lectura',
    titulo: 'Detalle de una propuesta',
    descripcion: 'Trae UNA propuesta por id (el que empieza con «prop»): qué operación va a correr, los datos guardados que la pantalla muestra como formulario, el estado (pendiente, aplicada, descartada), el estado real si se aplicó (hecha, fallida, aplicandose o sin_resultado, que pudo escribir a medias), el resultado y el link donde se revisa. Por la API solo trae las que propuso la API. Úsala para saber si una propuesta ya se confirmó o falló sin volver a proponerla. Si la propuesta es de un contacto (CRM), devuelve solo su estado y su link.',
    parametros: [{ nombre: 'id', tipo: 'string', obligatorio: true, max: 80, descripcion: 'id de la propuesta (empieza con «prop»), de listar_propuestas_revisar o de la respuesta de la acción que la creó.' }],
    salida: 'json', canales: TODOS, costo: 'gratis',
  },
  {
    id: 'resumen_bandejas_confirmacion', area: 'mako', tipo: 'lectura',
    titulo: 'Todo lo que espera confirmación',
    descripcion: 'Cuenta cuántas cosas esperan a una persona, por bandeja y con su link: acciones por chat (/mako/pendientes), acciones con formulario (/mako/revisar) y las que fallaron al aplicarse, contactos propuestos (/crm/revisar), borradores de tareas (/plan) y cambios del CRM automático. Úsala cuando pregunten «¿qué tengo pendiente de aprobar?»; para el detalle de cada bandeja usa su lectura propia. Solo cuenta las bandejas de las tabs que tiene este negocio.',
    parametros: [],
    salida: 'json', canales: TODOS, costo: 'gratis',
  },
  // ── Qué se hace adentro de MaKo ─────────────────────────────────────────────
  {
    id: 'listar_capacidades_mako', area: 'mako', tipo: 'lectura',
    titulo: 'Qué se hace dentro de MaKo',
    descripcion: 'El catálogo cerrado de lo que se resuelve ADENTRO de MaKo: por cada capacidad, la tab, el link absoluto, qué se hace ahí y los pasos. Úsala cuando pregunten «¿qué puedes hacer?», «¿dónde hago X?» o antes de mandar a alguien a resolver algo afuera: los links salen de aquí, nunca escritos a mano. Solo trae las tabs que tiene este negocio; para un miembro del equipo en la app el filtro por rol es aproximado (no distingue closer de setter).',
    parametros: [{ nombre: 'id', tipo: 'string', enum: CAPACIDADES.map((c) => c.id), descripcion: 'id de UNA capacidad para traer solo esa. Sin id, trae todas.' }],
    salida: 'json', canales: TODOS, costo: 'gratis',
  },
  // ── Los chats con MaKo del Second Brain (16/10/2026, etapa 2 de docs/diseno-mako-ai-native.md) ──────────────
  // Sólo desde el chat de la app: la persona sale de la conversación del turno (`app:<id>` → su chart_key), nunca de un
  // parámetro. Por WhatsApp no hay «chats» y por HTTP no hay persona.
  {
    id: 'listar_chats_mako', area: 'mako', tipo: 'lectura',
    titulo: 'Los chats de esta persona con MaKo',
    descripcion: 'Lista los chats que la persona tiene con MaKo en el Second Brain (el chat «Second Brain» y sus sub-chats): id, título y cuándo se movió por última vez. Úsala cuando pregunte por algo que habló en OTRO chat («¿qué te dije del precio?», «en el chat de la campaña…») y después lee ese chat con hilo_chat_mako. No requiere parámetros.',
    parametros: [],
    salida: 'json', canales: ['app'], costo: 'gratis',
  },
  {
    id: 'hilo_chat_mako', area: 'mako', tipo: 'lectura',
    titulo: 'Leer otro chat con MaKo',
    descripcion: 'Trae los últimos mensajes de UNO de los chats de la persona con MaKo (el id sale de listar_chats_mako), para retomar lo que se habló sin pedírselo de nuevo. Sólo los de esta misma persona: el de otra no existe.',
    parametros: [{ nombre: 'id', tipo: 'number', entero: true, obligatorio: true, descripcion: 'id del chat (de listar_chats_mako).' }],
    salida: 'json', canales: ['app'], costo: 'gratis',
  },
];
