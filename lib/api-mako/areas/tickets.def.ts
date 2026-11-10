// =============================================================================
// api-mako/areas/tickets.def — levantar un ticket al equipo de MaKo, y ver los propios
// =============================================================================
// Martín (17/10/2026): «Para el usuario debe ser fácil levantar un ticket... Tal vez en los mismos chats de MaKo... Y que
// MaKo le proponga levantarlo si detecta que intentó algo y falló, o si pidió algo que todavía no está en la app». El
// diseño: docs/diseno-ticketera-usuarios.md. Es del área `mako` (operaciones sobre MaKo mismo) y vive en su propio
// archivo, como el editor del Dashboard en `metricas`.
//
// ⚠️ LO QUE ESCRIBE EL MODELO ES EL TÍTULO Y EL RESUMEN. El CONTEXTO (el error que registró el código, la herramienta que
// falló, lo que pidió la persona, la pantalla, el navegador) lo junta el turno y NO es un parámetro: el modelo no puede
// inventar un error para que un pedido parezca un bug evidente (lib/tickets-reglas.ts, el triage).
// ⚠️ Una persona confirma: `confirmacion: 'chat'` deja una tarjeta con un botón (AGENTS.md, «Un canal PROPONE»).
// ⚠️ POR HTTP DESDE EL 10/11/2026 (Martín, 9/11: «hoy en día en la API ni siquiera se pueden levantar tickets, y sí se
// debería»): levantar, listar, ver uno y contestarlo. Con las MISMAS reglas que el chat: el contexto no lo escribe quien llama
// (por HTTP no hay turno: queda el canal `api`), el triage es el de siempre (la vía libre de Leandro incluida) y quién lo firma
// sale del token, nunca de un parámetro (lib/tickets-api.ts → `quienPideElTicket`). `ver_ticket`, `listar_tickets` y
// `responder_ticket` son SÓLO de HTTP: en el chat ya está `mis_tickets`, y sumarlas al turno le saca lugar a otras
// herramientas (el presupuesto de 12.000 caracteres).
//
// Español neutro en descripciones: las lee el cliente en la referencia.

import type { OperacionDef } from '../tipos';
import { TIPOS, TOPES } from '@/lib/tickets-reglas';
import { FILTROS_TICKETS } from '@/lib/tickets-api';

const CANALES = ['app', 'whatsapp', 'http'] as const;
/** Lo que sólo tiene sentido para un integrador: el chat ya tiene `mis_tickets`. */
const SOLO_HTTP = ['http'] as const;

export const DEFS: readonly OperacionDef[] = [
  {
    id: 'levantar_ticket', area: 'mako', tipo: 'accion', confirmacion: 'chat', reversible: false,
    datosDeClientes: false,
    titulo: 'Mandarle un ticket al equipo de MaKo',
    descripcion: 'PROPONE mandarle un ticket al equipo que desarrolla MaKo; la persona lo confirma con un botón. Úsala SÓLO cuando la persona lo pide («avísale a los desarrolladores», «reporta esto», «levanta un ticket»). Lo que FALLÓ y lo que MaKo todavía NO tiene no van por aquí: el sistema levanta ese ticket solo, con la marca [[no-pude: …]] o [[no-existe: …]] de tus reglas, y escribe la línea con su número. El título y el resumen los escribes tú, cortos y en palabras de la persona; el error y la pantalla los agrega el sistema solo: no los copies.',
    parametros: [
      { nombre: 'tipo', tipo: 'string', obligatorio: true, enum: TIPOS.map((t) => t.clave), rotulo: 'Tipo', descripcion: 'bug = algo que debería andar y no anda; pedido = algo nuevo que la app no tiene; pregunta = una duda sobre cómo se usa.' },
      { nombre: 'titulo', tipo: 'string', obligatorio: true, max: TOPES.titulo, rotulo: 'Título', descripcion: 'Qué pasó o qué pide, en una frase corta («No se guarda la etapa del lead», «Exportar los leads a Excel»).' },
      { nombre: 'descripcion', tipo: 'string', max: 1500, rotulo: 'Detalle', descripcion: 'Lo que intentó y lo que esperaba, en dos o tres frases, con las palabras de la persona.' },
      { nombre: 'noExiste', tipo: 'boolean', rotulo: 'No existe', descripcion: 'true si lo que pidió la persona todavía no existe en MaKo (no hay herramienta ni pantalla para eso).' },
    ],
    escribe: 'crea un ticket para el equipo de MaKo (tabla tickets) con el contexto que juntó el sistema',
    canales: CANALES, costo: 'gratis',
  },
  {
    id: 'mis_tickets', area: 'mako', tipo: 'lectura',
    datosDeClientes: false,
    titulo: 'Tus tickets al equipo de MaKo',
    descripcion: 'Los tickets que levantó esta persona al equipo de MaKo: número, título, en qué anda cada uno (Recibido, En curso, Espera tu respuesta, Resuelto, Cerrado) y lo último que le contestó el equipo. Úsala para «¿en qué quedó lo que reporté?». Sin parámetros.',
    parametros: [],
    salida: 'json', canales: CANALES, costo: 'gratis',
  },
  {
    id: 'listar_tickets', area: 'mako', tipo: 'lectura',
    datosDeClientes: false,
    titulo: 'Los tickets del negocio al equipo de MaKo',
    descripcion: 'Los tickets que el negocio le levantó al equipo de MaKo, de cualquier persona del negocio: número, título, en qué anda (recibido, en_curso, tu_respuesta = el equipo preguntó algo, resuelto, cerrado), quién lo levantó, si entró por la vía libre del negocio (no espera la decisión del equipo) y la última respuesta del equipo. Los más recientes primero.',
    parametros: [
      { nombre: 'estado', tipo: 'string', enum: FILTROS_TICKETS, rotulo: 'Cuáles', descripcion: 'abiertos (los que siguen en curso o esperan algo), cerrados, o todos. Sin esto, todos.' },
    ],
    salida: 'json', canales: SOLO_HTTP, costo: 'gratis',
  },
  {
    id: 'ver_ticket', area: 'mako', tipo: 'lectura',
    datosDeClientes: false,
    titulo: 'Un ticket del negocio, con su conversación',
    descripcion: 'Un ticket del negocio por su número: en qué anda, si entró por la vía libre, la conversación con el equipo (lo que se escribió de cada lado) y cada cambio de estado con su fecha. Úsala después de levantarlo, o cuando el estado sea tu_respuesta para leer qué preguntó el equipo.',
    parametros: [
      { nombre: 'numero', tipo: 'number', obligatorio: true, entero: true, minimo: 1, rotulo: 'Número', descripcion: 'El número del ticket (el 12 de «#12»), de listar_tickets o de la respuesta de levantar_ticket.' },
    ],
    salida: 'json', canales: SOLO_HTTP, costo: 'gratis',
  },
  {
    id: 'responder_ticket', area: 'mako', tipo: 'accion', confirmacion: 'chat', reversible: false,
    datosDeClientes: false,
    titulo: 'Contestarle al equipo de MaKo en un ticket',
    descripcion: 'Le suma un mensaje a un ticket abierto del negocio: la respuesta a lo que preguntó el equipo (estado tu_respuesta) o un dato más. Si el equipo esperaba la respuesta, el ticket vuelve a su bandeja. Un ticket cerrado no se contesta: se levanta otro.',
    parametros: [
      { nombre: 'numero', tipo: 'number', obligatorio: true, entero: true, minimo: 1, rotulo: 'Número', descripcion: 'El número del ticket (el 12 de «#12»).' },
      { nombre: 'texto', tipo: 'string', obligatorio: true, max: TOPES.nota, rotulo: 'Mensaje', descripcion: 'Lo que le dices al equipo, en palabras de la persona.' },
    ],
    escribe: 'suma un mensaje al ticket (ticket_eventos) y, si el equipo esperaba la respuesta, lo devuelve a su bandeja',
    canales: SOLO_HTTP, costo: 'gratis',
  },
];
