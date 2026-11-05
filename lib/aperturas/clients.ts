// =============================================================================
// La apertura de Clients: el primer cliente de la cartera (PURO; 5/11/2026)
// =============================================================================
// docs/mako-iniciativa/plan.md §4 («Clients»), T14. Con el servicio ya armado (`cs_servicio`) y la cartera vacía (`cs_clientes`
// pendiente), la estrella pregunta un HECHO, «¿Ya tienes clientes en tu programa?»: «Sí, los cargo» abre el alta de un cliente
// (la misma del checklist); «Todavía no», «Cuando cierres el primero, aparece aquí solo.» (un lead que pasa a Ganado entra solo).
//
// Sólo con la estrella abierta: el checklist arriba de la cartera YA es el onboarding de la tab (ChecklistClientes.tsx), así que
// ni el `corto` ni otra cosa a la vista. Con el estado de la tab sin leer, calla.
// =============================================================================

import type { Apertura, Respuestas, Superficie } from './reglas';

/** Lo que dice el onboarding de la tab (`OnboardingClientes`, como lo dibuja el checklist). Sin leer, el montaje pasa null: calla. */
export type HechosClients = { servicio: boolean; clientes: boolean };

export const ACCIONES_CLIENTS = ['cargar'] as const;
export type AccionClients = (typeof ACCIONES_CLIENTS)[number];

export const ID_CLIENTES = 'clients:clientes';
export const ID_PRIMERO = 'clients:primero';
export const TODAVIA_NO = 'no';

export function aperturaClients(h: HechosClients, r: Respuestas): Apertura<AccionClients> | null {
  if (!h.servicio || h.clientes) return null;
  if (r[ID_CLIENTES] === TODAVIA_NO) {
    return {
      id: ID_PRIMERO, alcance: 'negocio',
      texto: 'Cuando cierres el primero, aparece aquí solo.',
      botones: [
        { tipo: 'ir', rotulo: 'Ver mi CRM', href: '/crm' },
        { tipo: 'callar', rotulo: 'Ahora no' },
      ],
    };
  }
  return {
    id: ID_CLIENTES, alcance: 'negocio',
    texto: '¿Ya tienes clientes en tu programa?',
    botones: [
      { tipo: 'hacer', rotulo: 'Sí, los cargo', accion: 'cargar' },
      { tipo: 'respuesta', rotulo: 'Todavía no', valor: TODAVIA_NO },
      { tipo: 'callar', rotulo: 'Ahora no' },
    ],
  };
}

export const SUPERFICIE_CLIENTS: Superficie<HechosClients, AccionClients> = { id: 'clients', acciones: ACCIONES_CLIENTS, apertura: aperturaClients };

export const CATALOGO: readonly { id: string; cuando: string }[] = [
  { id: ID_CLIENTES, cuando: 'Con el servicio armado y la cartera vacía.' },
  { id: ID_PRIMERO, cuando: 'Contestó «Todavía no».' },
];

export const EJEMPLOS: readonly { nombre: string; h: HechosClients; r: Respuestas; espera: string | null; primerPaso?: true }[] = [
  { nombre: 'con servicio y sin clientes', h: { servicio: true, clientes: false }, r: {}, espera: ID_CLIENTES, primerPaso: true },
  { nombre: 'contestó «Todavía no»', h: { servicio: true, clientes: false }, r: { [ID_CLIENTES]: TODAVIA_NO }, espera: ID_PRIMERO },
  { nombre: 'sin servicio todavía: lo pide el checklist', h: { servicio: false, clientes: false }, r: {}, espera: null },
  { nombre: 'ya tiene clientes', h: { servicio: true, clientes: true }, r: {}, espera: null },
];
