// =============================================================================
// contexto-ig — ¿el perfil del negocio alcanza para escribir una pieza de Instagram? (la API de MaKo)
// =============================================================================
// Vivía en app/reels/reels-datos.ts, el módulo de datos de la tab Reels. La tab se retiró el 29/10/2026 (su guion es una
// plantilla del Copywriter) y la API (lib/api-mako/areas/contenido.run.ts) lo seguía importando desde la carpeta de la
// RUTA: borrar la pantalla tiraba abajo la API. Lo que sobrevive a una pantalla no vive en su carpeta.
//
// El paso NO pide redactar nada: se DERIVA de lo que la app ya sabe. `listo` = hay al menos un grupo del perfil con datos;
// `faltan` lista los grupos vacíos para decir QUÉ falta y no un genérico «completa tu perfil».
// (El historial de guiones en app_settings, `reels.historial`, se fue con la pantalla: sólo lo leía ella.)
// =============================================================================

import 'server-only';
import { getSchema, getAnswers } from '@/lib/onboarding';

export type EstadoContextoReels = { listo: boolean; faltan: string[] };

export async function estadoContextoReels(): Promise<EstadoContextoReels> {
  try {
    const [schema, answers] = await Promise.all([getSchema(), getAnswers()]);
    const faltan = schema
      .filter((g) => !g.fields.some((f) => (answers[f.key] ?? '').trim()))
      .map((g) => g.label);
    return { listo: faltan.length < schema.length, faltan };
  } catch {
    // Consulta caída ≠ perfil vacío, pero acá el estado solo pinta un aviso
    // suave (nunca bloquea generar): degradar a "no listo" es lo conservador.
    return { listo: false, faltan: [] };
  }
}
