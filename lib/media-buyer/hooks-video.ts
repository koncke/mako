// =============================================================================
// Media Buyer — los hooks nuevos de un VIDEO ganador, como guiones listos para filmar en el Video Generator
// =============================================================================
// Martín, 25/10/2026: «tenemos el generador de video y editor, variaciones de hooks, de videos». Filmar NO se puede desde el
// servidor: lo hace el navegador del cliente con la extensión y una pestaña de Flow abierta (docs/diseno-ads-autopilot.md,
// «Material»; docs/hallazgos-ads.md, «El Autopilot»). Lo que sí: cada hook nuevo que escribió la IA del negocio, pegado al
// CUERPO del video que gana (lo que se dice después del gancho, de `ad_transcripts`), entra como guion en el Video Generator
// (la celda «Hooks del Media Buyer»), con los rótulos GANCHO / HISTORIA que el resto de la app lee para cortarlo en tomas.
// El gancho es lo único que se vuelve a filmar: el cuerpo ya está probado.
// =============================================================================

import 'server-only';
import { randomUUID } from 'node:crypto';
import { runWithWorkspace } from '@/lib/workspace';
import { getRazones, setRazones, type RazonCelda } from '@/lib/razones';
import { huellaGuion } from '@/lib/guiones-normalizar';
import { transcriptDeAnuncio } from '@/lib/api-mako/areas/ads.helpers';
import { guionDeHook, CELDA_HOOKS } from './hooks-guion';
import { esVariacionDeBoton } from './variacion-boton';
import type { Decision } from './tipos';

export { CELDA_HOOKS };

export async function llevarHooksAlVideo(ws: number, d: Decision): Promise<{ ok: true; cargados: number; salteados: number } | { ok: false; error: string }> {
  if (d.tipo !== 'variaciones_hook') return { ok: false, error: 'Sólo las variaciones de hook de un video van al Video Generator.' };
  // La variación de BOTÓN no se filma: no hay nada nuevo que decir a cámara (variacion-boton.ts).
  const hooks = (d.variaciones ?? []).filter((v) => v.elegida && !esVariacionDeBoton(v) && (v.gancho || v.textoPrincipal));
  if (!hooks.length) return { ok: false, error: 'Elige al menos un hook.' };
  return runWithWorkspace(ws, async () => {
    const t = await transcriptDeAnuncio(d.anuncioBase?.id ?? d.entidadId).catch(() => null);
    const celdas = await getRazones();
    const existentes = new Set(celdas.flatMap((c) => c.guiones ?? []).map((g) => huellaGuion(g.texto)));
    const ahora = Date.now();
    const items = hooks
      .map((v) => guionDeHook(v.gancho ?? v.textoPrincipal.split('\n')[0], t?.transcript ?? null))
      .filter((texto) => !existentes.has(huellaGuion(texto)))
      .map((texto) => ({
        id: randomUUID(), anguloId: '', anguloNombre: `Hook nuevo de «${d.entidadNombre}»`.slice(0, 120), texto,
        creadoEn: ahora, estado: 'borrador' as const, estructuraId: '', estructuraNombre: '',
      }));
    const i = celdas.findIndex((c) => c.id === CELDA_HOOKS);
    if (i >= 0) celdas[i] = { ...celdas[i], guiones: [...(celdas[i].guiones ?? []), ...items] };
    else {
      const celda: RazonCelda = {
        id: CELDA_HOOKS, avatarId: '', nombre: 'Hooks del Media Buyer',
        descripcion: 'Ganchos nuevos para los videos que mejor convierten: se filma sólo el gancho, el resto ya está probado.',
        copy: '', guiones: items, imagenUrl: '', anguloImagen: '', anguloVideo: '',
      };
      celdas.push(celda);
    }
    await setRazones(celdas);
    return { ok: true as const, cargados: items.length, salteados: hooks.length - items.length };
  });
}
