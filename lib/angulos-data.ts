// =============================================================================
// angulos-data — la BIBLIOTECA de formatos (data pura, sin server-only)
// =============================================================================
// Los datos de los ÁNGULOS/FORMATOS viven acá, SIN `import 'server-only'`, para que
// también los pueda usar la UI (MatrizView es un client component: necesita el
// nombre/descripcion de cada formato para pintar el ángulo elegido de cada celda).
// La lógica de IA que ELIGE de esta biblioteca sigue en lib/angulos-formatos.ts
// (server-only), que re-exporta todo esto.

export type Medio = 'imagen' | 'video';
export type FormatoAngulo = { id: string; nombre: string; medio: Medio; descripcion: string; ejemplo: string };

// ── LA BIBLIOTECA (fija; la IA elige de acá) ─────────────────────────────────
export const BIBLIOTECA_ANGULOS: FormatoAngulo[] = [
  // ── Imagen ──
  { id: 'comparacion', medio: 'imagen', nombre: 'Comparación', descripcion: 'Dos columnas: esto vs aquello (contigo vs sin ti, tu método vs el común).', ejemplo: 'Izq: "Equipo sin tablero" caótico · Der: "Equipo con el Dashboard" ordenado.' },
  { id: 'testimonio-capturas', medio: 'imagen', nombre: 'Testimonio con capturas', descripcion: 'Capturas reales de mensajes (WhatsApp/DM) de un cliente contento.', ejemplo: 'Screenshot de un cliente: "esto me cambió el negocio", con contexto arriba.' },
  { id: 'antes-despues', medio: 'imagen', nombre: 'Antes y después', descripcion: 'El estado inicial vs el resultado, lado a lado o en una tira.', ejemplo: 'Antes: números en rojo · Después: mismos números en verde.' },
  { id: 'screenshot-resultado', medio: 'imagen', nombre: 'Captura de un resultado', descripcion: 'La foto de un resultado real y concreto (un dashboard, un número, un reporte).', ejemplo: 'Screenshot del dashboard mostrando el objetivo cumplido.' },
  { id: 'checklist', medio: 'imagen', nombre: 'Lista / checklist', descripcion: 'Una lista corta de puntos que el espectador quiere cumplir (o teme no cumplir).', ejemplo: '"5 señales de que tu equipo no está alineado" con checks.' },
  { id: 'stat-impactante', medio: 'imagen', nombre: 'Dato que frena el scroll', descripcion: 'Un número o estadística fuerte y visual que interrumpe.', ejemplo: '"El 70% de los equipos no sabe su objetivo de la semana."' },
  { id: 'carrusel-pasos', medio: 'imagen', nombre: 'Carrusel de pasos', descripcion: 'Varias placas mostrando el cómo funciona / el paso a paso del mecanismo.', ejemplo: 'Placa 1: el problema → 2: el gancho → 3: el resultado.' },
  // ── Video ──
  { id: 'hook-problema', medio: 'video', nombre: 'Hook de problema', descripcion: 'Arranca hablando directo al dolor, a cámara, sin intro.', ejemplo: '"Si tu equipo no cumple sus metas, no es falta de ganas…"' },
  { id: 'testimonio-hablado', medio: 'video', nombre: 'Testimonio hablado', descripcion: 'El cliente cuenta su antes/después a cámara, natural.', ejemplo: 'Cliente: "en 60 días pasamos de X a Y".' },
  { id: 'demo-walkthrough', medio: 'video', nombre: 'Demo / recorrido', descripcion: 'Se muestra el producto o el entregable funcionando (screen o en vivo).', ejemplo: 'Recorrido del dashboard: aquí ves quién cumple y quién no.' },
  { id: 'explicacion-mecanismo', medio: 'video', nombre: 'Explicación del mecanismo', descripcion: 'Explica POR QUÉ funciona tu método (el "no es tu culpa, es que…").', ejemplo: 'Pizarra/talking-head explicando el porqué del sistema.' },
  { id: 'dia-en-la-vida', medio: 'video', nombre: 'Un día en la vida', descripcion: 'Muestra el día del cliente con vs sin la solución.', ejemplo: 'Lunes sin el sistema (caos) vs con el sistema (control).' },
  { id: 'reaccion-caso', medio: 'video', nombre: 'Reacción a un caso', descripcion: 'Reaccionas/comentas sobre una captura o un caso real de un cliente.', ejemplo: 'Muestras el chat de un cliente y explicas qué pasó.' },
  { id: 'mini-vsl', medio: 'video', nombre: 'Mini-VSL', descripcion: 'Carta de venta corta en video: problema → mecanismo → oferta → CTA.', ejemplo: '60-90s que cierran con una invitación clara.' },
];

export function formatoPorId(id: string): FormatoAngulo | undefined {
  return BIBLIOTECA_ANGULOS.find((f) => f.id === id);
}
