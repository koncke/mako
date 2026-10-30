// =============================================================================
// La guía del Ops Center (el del cliente): qué se puede señalar y qué se enseña (PURO; 29/10/2026)
// =============================================================================
// El catálogo de la tab (docs/mako-iniciativa/guia.md §5.1), al lado de su pantalla: lo junta lib/guia/catalogo.ts y lo usa
// ChatSecondBrain.tsx. Reemplaza al recorrido `sb-inicio` (los tres pasos con «Siguiente» que abría el final del onboarding).
// Las anclas son los `data-recorrido` de siempre (los ids NO se renombran: son la clave de lo visto y lo que nombra el modelo):
//   · `sb-*`: las del Ops Center, y `sb-hilo` / `sb-escribir`, que viven en el panel de TODO chat (PanelChat.tsx): por eso
//     van `enElChat` (se busca la del chat dueño, la primera visible);
//   · `mk-*`: las de todo chat de MaKo, «Instalar MaKo» y «Conectar» (la caja común y las cajas con motor propio).
// Sin `'use client'`, sin React: lo importan la pantalla, el server y los tests.

import type { GuiaDeTab } from '@/lib/guia/tipos';

export const GUIA_OPS_CENTER = {
  key: 'mako',
  nombre: 'Ops Center',
  href: '/second-brain',
  anclas: [
    { id: 'sb-chats', nombre: 'Tus chats', para: 'Cada conversación con MaKo queda en esta lista.', pregunta: '¿Dónde están mis chats?' },
    { id: 'sb-nuevo', nombre: 'Nuevo chat', para: 'Toca aquí para empezar otro tema.', pregunta: '¿Cómo empiezo otro tema?' },
    { id: 'sb-buscar', nombre: 'Buscar', para: 'Escribe aquí el nombre del chat que buscas.', pregunta: '¿Cómo busco un chat?' },
    { id: 'sb-ticketera', nombre: 'Ticketera', para: 'Aquí están tus reportes y lo que te contestamos.', pregunta: '¿Dónde están mis reportes?' },
    { id: 'sb-uso', nombre: 'Uso', para: 'Tus cuentas de IA y lo que gastó cada una.', pregunta: '¿Dónde veo mi IA?' },
    { id: 'sb-hilo', nombre: 'La conversación', para: 'Aquí queda todo lo que hablamos.', enElChat: true },
    { id: 'sb-escribir', nombre: 'La caja', para: 'Escríbeme lo que necesitas.', enElChat: true },
    { id: 'mk-instalar', nombre: 'Instalar MaKo', para: 'Toca aquí y se descarga MaKo.', enElChat: true },
    // Aparece al tocar «Instalar MaKo» («Ya lo instalé: conectar»); con la app y sin su IA, es el «Conectar tu IA» de la caja.
    { id: 'mk-conectar', nombre: 'Conectar', para: 'Ábrela y toca aquí para conectar tu IA.', antes: 'mk-instalar', enElChat: true },
  ],
  objetivos: [
    { id: 'conectar', titulo: 'Conectar tu IA', si: (h) => !!h.sinApp || !!h.sinIA, pasos: [{ ancla: 'mk-conectar' }] },
    { id: 'pedir', titulo: 'Pedirle algo a MaKo', si: (h) => !h.sinApp, pasos: [{ ancla: 'sb-escribir' }] },
    { id: 'otro-tema', titulo: 'Empezar otro tema', pasos: [{ ancla: 'sb-nuevo' }, { ancla: 'sb-escribir', frase: 'Escríbeme el tema nuevo aquí.' }] },
    { id: 'reportes', titulo: 'Ver tus reportes', pasos: [{ ancla: 'sb-ticketera' }] },
  ],
} as const satisfies GuiaDeTab;
