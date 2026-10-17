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
// ⚠️ Sin HTTP por ahora: un integrador que levanta tickets es otra decisión (el snapshot de lo que sale por HTTP).
//
// Español neutro en descripciones: las lee el cliente en la referencia.

import type { OperacionDef } from '../tipos';
import { TIPOS, TOPES } from '@/lib/tickets-reglas';

const CANALES = ['app', 'whatsapp'] as const;

export const DEFS: readonly OperacionDef[] = [
  {
    id: 'levantar_ticket', area: 'mako', tipo: 'accion', confirmacion: 'chat', reversible: false,
    datosDeClientes: false,
    titulo: 'Mandarle un ticket al equipo de MaKo',
    descripcion: 'PROPONE mandarle un ticket al equipo que desarrolla MaKo; la persona lo confirma con un botón. Úsala en dos casos: (1) algo que MaKo debería hacer FALLÓ (una herramienta devolvió un error, o la persona dice que algo no anda); (2) la persona pidió algo que MaKo todavía NO tiene: dile en una línea que todavía no se puede y propón pedírselo al equipo, con noExiste en true. También si la persona lo pide («avísale a los desarrolladores», «reporta esto»). El título y el resumen los escribes tú, cortos y en palabras de la persona; el error y la pantalla los agrega el sistema solo: no los copies.',
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
];
