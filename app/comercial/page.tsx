// =============================================================================
// /comercial — ahora es la hoja «comercial» del Dashboard
// =============================================================================
// Pedido de Martín (11/10/2026): «Elimina las tab de Marketing y Comercial que hay por
// defecto... Todo la tab de Dashboard debe ser el editable». Lo que mostraba esta pantalla es
// ahora una hoja del informe inicial (lib/graficos-catalogo.ts, `tableroInicial`).
//
// SE REDIRIGE, NO SE BORRA (AGENTS.md, «Retirar una RUTA…»): la siguen links viejos de avisos,
// marcadores y otras pantallas. Va con `rutaConWs`, o el super admin mirando a un cliente
// terminaría en su propio Dashboard.

import { redirect } from 'next/navigation';
import { rutaConWs } from '@/lib/workspace';

export default async function Page() {
  redirect(await rutaConWs('/dashboard?hoja=comercial'));
}
