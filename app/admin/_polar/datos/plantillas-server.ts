// =============================================================================
// Admin › Products › Templates: la lectura (18/11/2026). Lo puro y el porqué, en ./plantillas.ts.
// =============================================================================
// ⚠️ Cruza negocios (trae el negocio que publicó cada plantilla): la llama SÓLO una página que ya pasó `exigirSuperAdmin`.
// «No pude leer» no es «no hay ninguna»: devuelve null y la pantalla lo dice.

import 'server-only';
import { creacionesParaModerar } from '@/lib/creaciones';
import type { PlantillaModerada } from './plantillas';

export async function leerPlantillasParaModerar(): Promise<{ plantillas: PlantillaModerada[]; recortado: boolean } | null> {
  try {
    const r = await creacionesParaModerar();
    return {
      recortado: r.recortado,
      plantillas: r.creaciones.map((c) => ({
        id: c.id, tipo: c.tipo, tipoTexto: c.tipoTitulo, titulo: c.titulo, descripcion: c.descripcion, autor: c.autor,
        deMako: c.deMako, estado: c.estado === 'retirada' ? 'retirada' : 'publicada', estrellas: c.estrellas, usos: c.usos,
        publicada: c.publicada, negocio: c.negocio,
      })),
    };
  } catch (e) {
    console.error('[admin/templates] no pude leer las plantillas:', e instanceof Error ? e.message : e);
    return null;
  }
}
