// Reportar un problema. La ruta se llama /tickets porque lo que se crea acá es
// un ticket; la TAB se llama «Reportar problema» porque eso es lo que el usuario
// viene a hacer — se nombra por la acción, no por el objeto del sistema.
//
// Todavía no hay backend: no hay tabla de tickets ni destino al que mandarlos.
// Sale con el chip «pronto» a propósito, para no prometer un canal que no existe.
import { ComingSoon } from '../_components/ComingSoon';
import { requireRolWs } from '@/lib/tab-access';

export default async function TicketsPage() {
  await requireRolWs([], { nav: 'tickets' });
  return <ComingSoon title="Reportar problema" icon="soporte" />;
}
