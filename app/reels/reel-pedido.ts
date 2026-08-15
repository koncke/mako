// =============================================================================
// reel-pedido — los catálogos del pedido y el guion como texto (módulo PURO)
// =============================================================================
// SIN 'server-only' a propósito: lo importan la UI (los Select y el botón
// «Copiar el guion») y las server actions (componer el pedido, armar las notas
// del borrador). Solo tipos y funciones puras — el tipo de la pieza entra con
// `import type`, que se borra en compilación y no arrastra el server-only de
// lib/ig-writer.ts al bundle del cliente.

import type { PiezaReel } from '@/lib/ig-writer';

// ── Catálogos del pedido (opciones cerradas, nunca un campo libre de más) ────

export const OBJETIVOS_REEL = [
  { value: 'comentarios', label: 'Comentarios con palabra clave', hint: 'Dispara el comment→DM a cambio de un regalo concreto' },
  { value: 'alcance', label: 'Alcance', hint: 'Que lo vea gente nueva; puede ir sin CTA' },
  { value: 'seguidores', label: 'Seguidores', hint: 'Que quien lo termina te siga' },
  { value: 'link', label: 'Visitas al link', hint: 'Empujar al link de la bio o al DM' },
] as const;

export const DURACIONES_REEL = [
  { value: 'optima', label: '50-60 segundos', hint: 'El total óptimo de la metodología' },
  { value: 'corta', label: '30-40 segundos', hint: 'Una idea rápida, sin desarrollo largo' },
  { value: 'larga', label: 'Hasta 90 segundos', hint: 'Solo si cada segundo aporta' },
] as const;

export type ObjetivoReel = (typeof OBJETIVOS_REEL)[number]['value'];
export type DuracionReel = (typeof DURACIONES_REEL)[number]['value'];

export type PedidoReel = {
  tema: string;
  objetivo: string;
  duracion: string;
  /** Feedback sobre la versión anterior (regenerar). */
  feedback?: string;
};

/**
 * Compone el texto del pedido que consume generarPieza(). Los topes por campo
 * existen porque generarPieza corta el total en 4000 caracteres EN SILENCIO:
 * mejor recortar acá cada parte que perder el final del feedback sin aviso.
 */
export function componerPedido(input: PedidoReel, anterior?: PiezaReel): string {
  const obj = OBJETIVOS_REEL.find((o) => o.value === input.objetivo) ?? OBJETIVOS_REEL[0];
  const dur = DURACIONES_REEL.find((d) => d.value === input.duracion) ?? DURACIONES_REEL[0];
  const partes = [
    `TEMA / IDEA DEL REEL: ${input.tema.trim().slice(0, 1800)}`,
    `OBJETIVO: ${obj.label} — ${obj.hint}.`,
    `DURACIÓN OBJETIVO: ${dur.label} (${dur.hint.toLowerCase()}).`,
  ];
  const feedback = input.feedback?.trim();
  if (anterior && feedback) {
    partes.push([
      'YA HAY UNA VERSIÓN ANTERIOR DE ESTE GUION:',
      `- Gancho hablado: «${anterior.hook.frase}» · título en pantalla: «${anterior.hook.tituloEnPantalla}»`,
      `- Moraleja: ${anterior.moraleja || '—'}`,
      anterior.cta ? `- CTA: ${anterior.cta}` : '- Sin CTA',
      `FEEDBACK DEL USUARIO sobre esa versión (aplícalo y escribe una versión NUEVA, no un parche): ${feedback.slice(0, 900)}`,
    ].join('\n'));
  }
  return partes.join('\n\n');
}

// ── El guion como texto plano ────────────────────────────────────────────────
// Lo usan «Copiar el guion» (client) y las NOTAS DE PRODUCCIÓN del borrador que
// viaja a /instagram (server). El formato es para LEER GRABANDO: bloques cortos,
// sin JSON.

export function guionATexto(p: PiezaReel): string {
  const lineas: string[] = [
    'GUION DE REEL',
    p.objetivo ? `Objetivo: ${p.objetivo}` : '',
    `Duración estimada: ${p.duracionEstimadaSeg} s`,
    '',
    'GANCHO (primeros 3 segundos)',
    `Frase hablada: «${p.hook.frase}»`,
    p.hook.tituloEnPantalla ? `Título en pantalla: «${p.hook.tituloEnPantalla}»` : '',
    p.hook.visual ? `Visual: ${p.hook.visual}` : '',
    '',
  ];
  p.escenas.forEach((e, i) => {
    lineas.push(`ESCENA ${i + 1}`, `Locución: ${e.texto}`);
    if (e.indicacionVisual) lineas.push(`Cámara: ${e.indicacionVisual}`);
    lineas.push('');
  });
  if (p.moraleja) lineas.push('MORALEJA', p.moraleja, '');
  if (p.cta) {
    lineas.push('CTA', p.cta);
    if (p.palabraClave) lineas.push(`Palabra clave: ${p.palabraClave} (el comment→DM se configura en la tab Instagram)`);
    lineas.push('');
  }
  if (p.caption) lineas.push('CAPTION', p.caption);
  return lineas.filter((l, i, arr) => l !== '' || arr[i - 1] !== '').join('\n').trim();
}
