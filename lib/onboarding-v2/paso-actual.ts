// =============================================================================
// «IR A UN PASO» SIGUE SOLO: el paso en el que está la persona (21/11/2026; puro)
// =============================================================================
// Martín: «debería ir avanzando automáticamente, tipo seleccionándose en el paso que estoy. Si no, me pierdo». Del estado guardado: la
// etapa del arranque (con la máquina de verdad, `etapaDeArranqueV2`), y terminado, la llegada, «¿Qué hacemos ahora?» o el día abierto
// (`diaAbierto`, la de verdad). El paso del recorrido lo pone el navegador (el motor sabe en qué marca va: app/_components/SaltarAPaso.tsx).
// Lo usa /api/admin/saltar-onboarding (GET). Lo prueba tests/revision-sigue-el-paso.test.ts.
// =============================================================================
import { etapaDeArranqueV2, type EstadoArranque, type HechosArranque } from '@/lib/onboarding-arranque';
import { diaAbierto, type EstadoReto } from '@/lib/reto/dias';

/** Los hechos del V2 con el WhatsApp (el que tiene el negocio de prueba). */
const HECHOS_V2 = { modo: 'oferta', v2: true, conTelefono: true, terminado: false } as unknown as HechosArranque;
const DEL_ARRANQUE = new Set(['nombre', 'telefono', 'codigo', 'agendado', 'negocio', 'origen', 'interes', 'cierre']);

export function pasoActualDe(o: { arranque: EstadoArranque | null; terminado: boolean; reto: EstadoReto | null; ahora: number }): string | null {
  if (!o.terminado) {
    const e = o.arranque ?? {};
    const etapa = etapaDeArranqueV2(e, HECHOS_V2);
    if (etapa === 'nombre' && !e.introVista) return 'bienvenida';
    if (etapa === 'agendado' && e.agendado === 'no') return 'agendado-no';
    if (etapa === 'listo') return 'cierre';
    return DEL_ARRANQUE.has(etapa) ? etapa : null;
  }
  if (!o.reto) return 'llegada';
  if (!o.reto.dia1Desde) return 'reto';
  return `dia-${diaAbierto(o.reto, o.ahora)}`;
}
