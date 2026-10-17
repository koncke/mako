// Lo que muestra el lead de EJEMPLO de «A revisar» (./FichaDeEjemplo.tsx), puro para que el test lo ejecute.
import type { EstadoDatos } from '@/lib/datos-aviso';

/** Lo que avisa hoy el funnel, como los «datos sin marcar» de un lead al que le falta todo. Las asistencias no se ignoran. */
export function datosDeEjemplo(avisos: ReadonlyArray<{ id: EstadoDatos['avisar'][number]['id']; label: string; avisa: boolean; por: string }>): EstadoDatos {
  return {
    avisar: avisos.filter((a) => a.avisa && a.por !== 'siempre').map((a) => ({ id: a.id, label: a.label, estado: 'falta' as const, ignorable: true })),
    ocultos: [],
  };
}
