// =============================================================================
// api-mako/areas/mako.def — operaciones sobre MaKo mismo
// =============================================================================
// Las pendientes (listar, confirmar, cancelar) viven acá y son las ÚNICAS de tipo
// `control` del registro: no proponen nada, cierran algo ya propuesto. El test lo
// fija. El resto del área (propuestas, chats, capacidades, costos de IA del
// workspace) se declara abajo con el mismo molde.
//
// Español neutro en descripciones y textos: los lee el cliente en la referencia.
// =============================================================================

import type { OperacionDef } from '../tipos';

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
];
