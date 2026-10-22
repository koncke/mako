// =============================================================================
// STUB: el contrato de Cobros para «Vincular cobro» en Ganado (22/10/2026)
// =============================================================================
// Las de verdad son de Cobros, con ESTAS firmas (contrato-cobro-en-ganado.md, en las notas compartidas de los chats):
// los tipos en lib/cobro-etapa.ts y las acciones en app/crm/cobro-etapa-actions.ts ('use server'). La pantalla del CRM se
// dibuja contra éstas hasta que lleguen a main.
// ⚠️ AL INTEGRAR: los imports de app/crm/cobro-ganado.ts y CobroDeEtapaModal.tsx pasan a esos dos archivos, y éste se
//    borra. Con el stub no hay cuentas ni productos y nada se guarda: así NO sube a producción.
// =============================================================================

export type ProveedorPago = 'stripe' | 'mercadopago';
export type CuentaPago = { id: string; proveedor: ProveedorPago; nombre: string; principal: boolean };
export type ProductoCobro = {
  id: number; nombre: string; tipo: 'unico' | 'suscripcion';
  montoUsd: number | null; suscripcionMeses: number | null; cuotas: number | null; activo: boolean;
};
export type ProductoCobroInput = {
  nombre: string; tipo: 'unico' | 'suscripcion'; montoUsd: number;
  suscripcionMeses?: number | null; cuotas?: number | null;
};
export type VinculoCobro = { id: number; funnelId: number; etapa: string; productoId: number; cuentas: string[] };
export type FotoCobroEtapa = { cuentas: CuentaPago[]; productos: ProductoCobro[]; vinculos: VinculoCobro[]; puedeEditar: boolean };
export type ResCobro<T> = ({ ok: true } & T) | { ok: false; error: string };

/** La línea del modal, la de Cobros tal cual (lib/cobro-etapa.ts). */
export const TEXTO_AL_PAGAR = 'Cuando alguien paga este producto, pasa a Ganado aquí, con su plan de pagos.';
/** Lo más que se parte un pago único (lib/cobro-etapa.ts: el primero lo cobra el link y quedan hasta 6 cuotas, el CHECK de la 0014). */
export const MAX_CUOTAS_PRODUCTO = 7;

const NO_ESTA = { ok: false as const, error: 'Vincular cobro todavía no está listo.' };

export async function leerCobroDeEtapaAction(funnelId: number, etapa: string): Promise<ResCobro<{ foto: FotoCobroEtapa }>> {
  void funnelId; void etapa;
  return { ok: true, foto: { cuentas: [], productos: [], vinculos: [], puedeEditar: false } };
}
export async function vincularProductoAEtapaAction(p: { funnelId: number; etapa: string; productoId: number; cuentas: string[] }): Promise<ResCobro<{ vinculo: VinculoCobro }>> {
  void p; return NO_ESTA;
}
export async function cambiarCuentasDelVinculoAction(vinculoId: number, cuentas: string[]): Promise<ResCobro<{ vinculo: VinculoCobro }>> {
  void vinculoId; void cuentas; return NO_ESTA;
}
export async function desvincularProductoAction(vinculoId: number): Promise<ResCobro<{ deshacer: { funnelId: number; etapa: string; productoId: number; cuentas: string[] } }>> {
  void vinculoId; return NO_ESTA;
}
export async function guardarProductoCobroAction(input: ProductoCobroInput, id?: number): Promise<ResCobro<{ producto: ProductoCobro }>> {
  void input; void id; return NO_ESTA;
}
export async function linkDelVinculoAction(vinculoId: number, cuentaId: string): Promise<ResCobro<{ url: string }>> {
  void vinculoId; void cuentaId; return NO_ESTA;
}
