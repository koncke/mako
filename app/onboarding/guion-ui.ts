// Re-export cliente del contrato del guion. La matriz y la vista global de
// guiones (app/ads-writer) importan de acá para no tocar lib/razones.ts, que es
// 'server-only' y reventaría el bundle del cliente.
export {
  ESTADOS_GUION, ESTADO_GUION_LABEL, COLOR_ESTADO_GUION, TONO_ESTADO_GUION,
  esEstadoGuion, fechaGuion, diaGuion, estadoMasAvanzado,
  type EstadoGuion, type GuionItem,
} from '@/lib/guion-estado';
