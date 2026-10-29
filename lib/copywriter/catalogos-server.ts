// =============================================================================
// copywriter/catalogos-server — leer la biblioteca de Ángulos y Estructuras (la del super admin) para el Copywriter
// =============================================================================

import 'server-only';
import { getAngulosGuion } from '../guion-angulos-store';
import { getEstructurasTodas } from '../guion-estructuras-store';
import { ANGULOS_GUION_DEFAULT } from '../guion-angulos';
import { ESTRUCTURAS_GUION_DEFAULT } from '../guion-estructuras';
import { catalogosLite, conVsl, type CatalogosCopy } from './catalogos';

/** Los catálogos para la pantalla. Una lectura que falla cae a los de fábrica (se dibuja igual) y lo dice en el log. */
export async function catalogosDelCopywriter(): Promise<CatalogosCopy> {
  const [a, e] = await Promise.allSettled([getAngulosGuion(), getEstructurasTodas()]);
  if (a.status === 'rejected') console.warn('[copywriter] no pude leer los ángulos', a.reason instanceof Error ? a.reason.message : a.reason);
  if (e.status === 'rejected') console.warn('[copywriter] no pude leer las estructuras', e.reason instanceof Error ? e.reason.message : e.reason);
  return catalogosLite(a.status === 'fulfilled' ? a.value : ANGULOS_GUION_DEFAULT, conVsl(e.status === 'fulfilled' ? e.value : ESTRUCTURAS_GUION_DEFAULT));
}
