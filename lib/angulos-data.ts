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

/**
 * Cuántos anuncios de la matriz usan cada formato: el formato lo elige `elegirAngulo` POR CELDA (`anguloImagen` /
 * `anguloVideo`), y esto lo cuenta, sin IA. Lo leen la vista Ángulos (GET /api/onboarding/formatos), el grafo de
 * Second Brain (lib/cerebro-grafo.ts) y `listar_formatos_creativo` de la API de MaKo: UNA cuenta, o MaKo dice «3
 * anuncios usan Comparación» y la pantalla 2.
 *
 * ⚠️ `avatares`: con ellos, sólo cuenta las celdas de un avatar que EXISTE, que son las que la Matriz y el teléfono
 * dibujan (MatrizView recorre `avatares.map`; app/m/copywriting/modelo.ts, `gruposDeAnuncios`). Las celdas huérfanas
 * existen de verdad: borrar un avatar no borra sus razones (`borrarAvatar`, la acción «guardar» de
 * /api/onboarding/avatares) y regenerar con menos avatares deja ids sueltos (`preservarIds` asigna por posición). La
 * vista y la API los pasan; el grafo NO, porque dibuja también las razones huérfanas (colgadas de la raíz) y su
 * cuenta tiene que ser la de sus aristas.
 *
 * Una celda suma como mucho 1 a cada formato (los ids de imagen y de video no se repiten). La celda virtual de los
 * guiones propios no es un anuncio planteado y no cuenta (`CELDA_GUIONES_PROPIOS`: lib/api-mako/areas/contenido.run.ts
 * la importa de acá; app/video-generator/cargar-guiones-action.ts tiene su propia copia, `CELDA_PROPIOS`). Un id que la
 * biblioteca no tiene no se cuenta.
 *
 * Reemplaza a la «recomendación de formatos» a nivel negocio, que se sacó el 23/10/2026: 0 negocios la tenían
 * guardada, 0 llamadas en la historia, y ningún generador la leía (docs/hallazgos-onboarding.md).
 */
export const CELDA_GUIONES_PROPIOS = 'guiones-propios';
export function usosPorFormato(
  celdas: ReadonlyArray<{ id: string; avatarId?: string; anguloImagen?: string; anguloVideo?: string }>,
  avatares?: ReadonlyArray<{ id: string }>,
): Record<string, number> {
  const ids = new Set(BIBLIOTECA_ANGULOS.map((f) => f.id));
  const vivos = avatares ? new Set(avatares.map((a) => a.id)) : null;
  const usos: Record<string, number> = {};
  for (const c of celdas) {
    if (c.id === CELDA_GUIONES_PROPIOS) continue;
    if (vivos && !vivos.has(c.avatarId ?? '')) continue;
    for (const id of new Set([c.anguloImagen, c.anguloVideo])) {
      if (id && ids.has(id)) usos[id] = (usos[id] ?? 0) + 1;
    }
  }
  return usos;
}

