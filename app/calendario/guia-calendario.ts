// =============================================================================
// La guía del Calendario: qué se puede señalar y qué se enseña (PURO; 5/11/2026)
// =============================================================================
// El catálogo de la tab (docs/mako-iniciativa/guia.md §6, G6 «Calendario»), al lado de su pantalla: lo junta lib/guia/catalogo.ts
// y lo usa app/calendario/CalendarioApp.tsx (useGuiaDeLaTab('calendario')). Las anclas son `data-recorrido` puestos con `ancla()`
// en la barra y en la leyenda de los usos. Los ids NO se renombran. Con su onboarding pendiente (el modal de Google) la guía espera.
// Sin `'use client'`, sin React: lo importan la pantalla, el server y los tests.

import type { GuiaDeTab } from '@/lib/guia/tipos';

export const GUIA_CALENDARIO = {
  key: 'calendario',
  nombre: 'Calendario',
  href: '/calendario',
  anclas: [
    { id: 'calendario-llamada', nombre: 'Nueva llamada', para: 'Toca aquí para anotar una llamada de venta.', pregunta: '¿Cómo anoto una llamada?' },
    { id: 'calendario-usos', nombre: 'Qué ver', para: 'Toca un nombre para mostrarlo o esconderlo.', pregunta: '¿Cómo veo sólo mis llamadas?' },
    { id: 'calendario-hoy', nombre: 'Hoy', para: 'Toca aquí para volver a hoy.', pregunta: '¿Cómo vuelvo a hoy?' },
    { id: 'calendario-vistas', nombre: 'Vistas', para: 'Elige día, semana, mes o tus llamadas.', pregunta: '¿Cómo veo el mes?' },
  ],
  objetivos: [
    { id: 'llamada', titulo: 'Anotar una llamada', pasos: [{ ancla: 'calendario-llamada' }] },
    { id: 'filtrar', titulo: 'Ver sólo lo tuyo', pasos: [{ ancla: 'calendario-usos' }] },
    { id: 'moverse', titulo: 'Moverte por las fechas', pasos: [{ ancla: 'calendario-vistas' }, { ancla: 'calendario-hoy' }] },
  ],
} as const satisfies GuiaDeTab;
