// =============================================================================
// api-mako/areas/leadmagnet.def — las operaciones del área `leadmagnet` (definiciones, 5/11/2026)
// =============================================================================
// El Lead Magnet Generator (app/lead-magnet-generator/, lib/lead-magnets/). Martín: «todo MaKo se debe poder utilizar por
// API»: lo que la tab deja hacer —ver las plantillas, armar la pieza, crear su página de captura, su link público y elegir
// qué link mandan las automatizaciones— está acá, por la MISMA puerta que la pantalla (lib/lead-magnets/server.ts).
// La lista de lead magnets y su edición ya existen en el área `negocio` (`listar_lead_magnets`, `editar_lead_magnet`): no se
// repiten. Los ids no llevan «lead» (RELEVANCIA_CRM, lib/mako-intencion.ts: le robaría el presupuesto a los pedidos del CRM).
//
// Gating: la pantalla es sólo de la plataforma por ahora (app/lead-magnet-generator/puerta.ts) → `soloPlataforma`. Para abrirla
// a los clientes se saca de los dos lados. Nada de esto entra a un flujo: un paso corre una vez por lead y armaría una pieza por
// cada uno (lib/api-mako/flujo.ts → NO_EN_FLUJOS).
// SIN server-only: lo importan los tests y el generador de la referencia. Español neutro.
// =============================================================================

import type { OperacionDef, Gating } from '../tipos';
import { PLANTILLAS_LEAD_MAGNET } from '@/lib/lead-magnets/plantillas';

const GATING: Gating = { tab: 'lead-magnet-generator', rolMinimo: 'admin', soloPlataforma: true };
const TODOS = ['whatsapp', 'app', 'http'] as const;
const IDS_PLANTILLAS = PLANTILLAS_LEAD_MAGNET.map((p) => p.id);

const ID_LM = { nombre: 'id', tipo: 'string', obligatorio: true, max: 80, descripcion: 'El id del lead magnet (de listar_lead_magnets).', ejemplo: '6f1c2a9e-…' } as const;

export const DEFS: readonly OperacionDef[] = [
  {
    id: 'ver_plantillas_magnet', area: 'leadmagnet', tipo: 'lectura',
    titulo: 'Ver las plantillas de lead magnet',
    descripcion: 'Las plantillas del Lead Magnet Generator: guía, checklist, prompts para copiar, planilla, clase grabada y quiz con diagnóstico. Cada una dice en qué herramienta nace la pieza (Copywriting o el Web Generator), sus secciones con la guía de cada una, y un ejemplo de un negocio FICTICIO que sirve de muestra y nunca entra en la pieza.',
    parametros: [],
    salida: 'json', canales: TODOS, costo: 'gratis', gating: GATING, datosDeClientes: false,
  },
  {
    id: 'armar_magnet', area: 'leadmagnet', tipo: 'accion', confirmacion: 'chat',
    titulo: 'Armar un lead magnet con una plantilla',
    descripcion: 'Crea la pieza de un lead magnet con una plantilla, en su herramienta: una página de Copywriting con su estructura (guía, checklist, prompts, planilla) o una landing del Web Generator (clase grabada, quiz con diagnóstico). Nace con las secciones y su guía, nunca con el ejemplo, y queda en la lista de lead magnets del negocio. Devuelve el id y el link para editarla.',
    parametros: [
      { nombre: 'plantilla', tipo: 'string', obligatorio: true, enum: IDS_PLANTILLAS, descripcion: 'El id de la plantilla (de ver_plantillas_magnet).', ejemplo: 'guia' },
      { nombre: 'nombre', tipo: 'string', max: 120, descripcion: 'Cómo se llama el lead magnet. Si se omite, el nombre de la plantilla.', ejemplo: 'Guía: tu agenda llena en 30 días' },
    ],
    canales: TODOS, costo: 'gratis', gating: GATING, datosDeClientes: false,
    reversible: false, escribe: 'una página de Copywriting o una landing del Web Generator, y su fila en la lista de lead magnets (mako.entregable)',
  },
  {
    id: 'pagina_captura_magnet', area: 'leadmagnet', tipo: 'accion', confirmacion: 'chat',
    titulo: 'Crear la página que pide el lead magnet',
    descripcion: 'Crea la landing que capta un lead magnet: el formulario pide nombre y correo, lo que dejan entra al CRM y la página de gracias lleva a su link. Exige que tenga su link (link_publico_magnet). Nace como borrador sin publicar. Si ya tiene su página, devuelve ésa. Una clase grabada ya es una página con su formulario.',
    parametros: [ID_LM],
    canales: TODOS, costo: 'gratis', gating: GATING, datosDeClientes: false,
    reversible: false, escribe: 'una landing del Web Generator (borrador) y su id en el lead magnet',
  },
  {
    id: 'link_publico_magnet', area: 'leadmagnet', tipo: 'accion', confirmacion: 'chat',
    titulo: 'Crear el link público de un lead magnet',
    descripcion: 'Le da a un lead magnet el link que reciben los leads. Para una página de Copywriting, un link público de SOLO LECTURA que abre cualquiera sin cuenta (no sale si está vacía o todavía tiene la guía de alguna sección: dice cuáles cambiar; si ya tenía uno vigente, ése). Para la clase grabada, el de su landing publicada. Si ya tiene su página de captura, su botón de gracias pasa al link nuevo.',
    parametros: [ID_LM],
    canales: TODOS, costo: 'gratis', gating: GATING, datosDeClientes: false,
    reversible: false, escribe: 'un link de solo lectura (shares, recurso lead-magnet) y el enlace del lead magnet',
  },
  {
    id: 'primero_magnet', area: 'leadmagnet', tipo: 'accion', confirmacion: 'chat',
    titulo: 'Poner primero un lead magnet',
    descripcion: 'Lo pone primero de la lista del negocio. Las automatizaciones mandan el link del primero (el dato «Link del lead magnet»), así que esto decide cuál reciben los leads. Exige que tenga su link.',
    parametros: [ID_LM],
    canales: TODOS, costo: 'gratis', gating: GATING, datosDeClientes: false,
    reversible: true, escribe: 'el orden de la lista de lead magnets (mako.entregable)',
  },
  {
    id: 'dejar_compartir_magnet', area: 'leadmagnet', tipo: 'accion', confirmacion: 'chat',
    titulo: 'Dejar de compartir un lead magnet',
    descripcion: 'Apaga el link público de solo lectura de la página de Copywriting de un lead magnet: deja de abrirse, también para quien ya lo recibió, y se le saca como su link. La página sigue en Copywriting.',
    parametros: [ID_LM],
    canales: TODOS, costo: 'gratis', gating: GATING, datosDeClientes: false,
    reversible: false, escribe: 'revoca el link (shares, recurso lead-magnet) y saca el enlace del lead magnet',
  },
  {
    // Al FINAL del área (AGENTS.md: una operación nueva no le saca el lugar a las de antes). Cuesta la IA DEL NEGOCIO: sin la
    // suya no corre. No escribe nada (la pantalla guarda su última propuesta; por la API, no).
    id: 'proponer_magnet', area: 'leadmagnet', tipo: 'lectura',
    titulo: 'Proponer lead magnets desde la oferta',
    descripcion: 'MaKo propone hasta 3 lead magnets para el negocio, con la IA del negocio: desde su oferta (lo que promete, a quién, lo que frena a su cliente) y lo que hace su competencia en Competitors Spy. Cada propuesta trae su plantilla, su nombre, por qué y de dónde sale; se arma con armar_magnet (plantilla y nombre). Nunca nombra a un competidor. Sin la IA del negocio, o sin oferta ni competidores leídos, dice qué falta.',
    parametros: [],
    salida: 'json', canales: TODOS, costo: 'ia', gating: GATING, datosDeClientes: false, lenta: true,
  },
];
