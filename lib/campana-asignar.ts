// =============================================================================
// campana-asignar — cuándo asignar una campaña PREGUNTA, y qué dice la pregunta
// =============================================================================
// Pedido de Martín (05/10/2026): poder elegir el producto al crear la campaña y
// asignarla desde la tabla de Ads Manager, «que no haya tanta fricción al asignar una
// nueva campaña, porque podrían haber nuevas campañas todo el tiempo».
//
// La fricción, acá, es preguntar de más. Lo que se escribe es CUÁNDO hay algo que
// decidir, y son dos casos:
//  - La asignación MUEVE leads que ya están en el CRM (una sola campaña del cliente más
//    grande tiene 896). Mover 896 leads de tablero no se hace sin avisar, y el número va
//    en la pregunta: «¿Traer 896 leads?» es una decisión, «¿Confirmás?» no.
//  - La campaña ya estaba en OTRO producto: asignarla se la saca a alguien.
// Fuera de esos dos no hay nada que decidir y se asigna directo, con su «Deshacer».
//
// ⚠️ Vive acá, y no adentro del componente, porque la MISMA pregunta la hace el CRM
// (`alternar()` en app/crm/CampanasModal.tsx, que es el molde) y ahora la tabla de Ads
// Manager. Dos copias de una regla de producto divergen; además así se puede testear sin
// pantalla. Quitar no pregunta nunca: no mueve a nadie.
// =============================================================================

export type PorProducto = { nombre: string; n: number };

/**
 * El valor del desplegable. NO es el id pelado: el producto principal viaja con
 * `id: null` (así lo entrega `productosConNull()` y así se asigna), y `''` es «sin
 * asignar», que no es lo mismo que el principal — sin asignación el lead ruta por las
 * reglas de siempre, con el principal alguien lo decidió.
 */
export const VAL_PPAL = 'ppal';
export const valorDeProducto = (funnelId: number | null): string => (funnelId === null ? VAL_PPAL : String(funnelId));
export const funnelDeValor = (valor: string): number | null => (valor === VAL_PPAL ? null : Number(valor));

/**
 * `desde` es el producto donde la campaña ya estaba (null si no estaba en ninguno).
 */
export function hayQuePreguntar(aTraer: number, desde: string | null): boolean {
  return aTraer > 0 || !!desde;
}

/** El texto de la pregunta. El título ES la pregunta (app/_ui/Confirm.tsx). */
export function preguntaAsignar({ producto, aTraer, desde, porProducto }: {
  producto: string;
  aTraer: number;
  desde: string | null;
  porProducto: PorProducto[];
}): { titulo: string; mensaje: string; confirmar: string; cancelar: string } {
  const leads = `${aTraer} ${aTraer === 1 ? 'lead' : 'leads'}`;
  const detalle = porProducto.filter((p) => p.n > 0).map((p) => `${p.n} de ${p.nombre}`).join(', ');
  return {
    titulo: aTraer > 0 ? `¿Traer ${leads} a «${producto}»?` : `¿Mover a «${producto}»?`,
    mensaje: [
      desde ? `Hoy sus leads entran en «${desde}».` : '',
      aTraer > 0
        ? `Se mueven ${detalle}. Los nuevos entran en «${producto}» desde ahora.`
        : 'Los leads que ya entraron se quedan donde están; sólo cambia a dónde van los nuevos.',
    ].filter(Boolean).join(' '),
    confirmar: aTraer > 0 ? `Traer ${aTraer}` : 'Mover',
    cancelar: 'No asignar',
  };
}
