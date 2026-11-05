// =============================================================================
// La guía del CRM: qué se puede señalar en el tablero y qué se enseña (PURO; 5/11/2026)
// =============================================================================
// El catálogo de la tab (docs/mako-iniciativa/guia.md §6, G6 «CRM: tablero y ficha»), al lado de su pantalla: lo junta
// lib/guia/catalogo.ts y lo usa la estrella del CRM (app/crm/mako-crm/PanelMakoCrm.tsx → useGuiaDeLaTab('crm')). Las anclas son
// `data-recorrido` puestos con `ancla()` en la barra del tablero (app/crm/CrmToolbar.tsx). Los ids NO se renombran: son la clave de
// lo visto y lo que nombraría el modelo.
// ⚠️ LA FICHA DEL LEAD queda para su tanda: su recorrido viejo (`crm-ficha-edicion`, app/crm/lead-view/ficha/recorrido-ficha.ts) y
// «Solucionar» (`Senalar`) siguen como estaban (guia.md §4).
// Sin `'use client'`, sin React: lo importan la pantalla, el server y los tests.

import type { GuiaDeTab } from '@/lib/guia/tipos';

export const GUIA_CRM = {
  key: 'crm',
  nombre: 'CRM',
  href: '/crm',
  anclas: [
    { id: 'crm-nuevo', nombre: 'Nuevo lead', para: 'Toca aquí para cargar un lead a mano.', pregunta: '¿Cómo agrego un lead?' },
    { id: 'crm-mas', nombre: 'Más acciones', para: 'Aquí importas tus leads y editas las etapas.', pregunta: '¿Cómo importo mis leads?' },
    { id: 'crm-buscar', nombre: 'Buscar', para: 'Escribe un nombre o el #número del lead.', pregunta: '¿Cómo busco un lead?' },
    { id: 'crm-funnels', nombre: 'Tus funnels', para: 'Aquí cambias de funnel o creas otro.', pregunta: '¿Cómo cambio de funnel?' },
  ],
  objetivos: [
    { id: 'importar', titulo: 'Cargar tus clientes', si: (h) => !!h.sinLeads, roles: ['admin'], pasos: [{ ancla: 'crm-mas', frase: 'Toca aquí y elige «Importar leads».' }] },
    { id: 'nuevo', titulo: 'Agregar un lead', pasos: [{ ancla: 'crm-nuevo' }] },
    { id: 'buscar', titulo: 'Buscar un lead', si: (h) => !h.sinLeads, pasos: [{ ancla: 'crm-buscar' }] },
    { id: 'funnel', titulo: 'Cambiar de funnel', pasos: [{ ancla: 'crm-funnels' }] },
  ],
} as const satisfies GuiaDeTab;
