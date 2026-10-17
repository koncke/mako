// =============================================================================
// /m/configuraciones/integraciones — «Configuración del negocio» › Integraciones en el teléfono (17/10/2026)
// =============================================================================
// En la URL, /integraciones. Referencia: Ajustes › «Cuentas» de iOS y «Apps» de Slack en el celular. Es la lista
// agrupada por categoría, con el estado de cada una en su fila. Arriba, en rojo, lo que está roto ahora (un incidente
// abierto). Cada fila abre una hoja con qué hace, para qué sirve y cómo está. Es la grilla de la computadora
// (app/integraciones/IntegracionesBoard.tsx) destilada: los mismos nombres, categorías y estados, de `getIntegraciones`.
//
// ⚠️ CONECTAR SE HACE EN LA COMPUTADORA, por ahora. El modal de conectar de /integraciones (`ServicioSuelto` y su
// `ServicioModal`) es un Modal de escritorio. Pegar una clave o seguir el OAuth de Meta en un sheet del teléfono es una
// pantalla que todavía no existe (docs/relevo/mako-mobile.md). La hoja lo dice y abre ESA integración en la versión de
// computadora (`?abrir=<key>`, el link que el modal ya entiende: lib/integracion-en-tab.ts).
// ⚠️ SÓLO LEE: la computadora además reconcilia los incidentes de Meta al abrirse (`reconciliarIncidentes`, que escribe)
// y le pregunta a Meta la salud de la cuenta. El teléfono lee los incidentes como quedaron (el cron horario los
// reconcilia igual) y no le pega a Meta al abrir una lista.
// =============================================================================

import '../configuraciones.css';
import { requireMovil } from '@/lib/movil-guard';
import { getIntegraciones } from '@/lib/integraciones';
import { getIncidentes } from '@/lib/meta-health-history';
import { SIN_MODAL_SUELTO } from '@/lib/integracion-en-tab';
import { CabeceraM, PantallaM } from '@/app/m/_ui';
import { IntegracionesM, type IntegracionM, type ProblemaM } from './IntegracionesM';

export const dynamic = 'force-dynamic';

export default async function IntegracionesMovil({ searchParams }: { searchParams: Promise<{ abrir?: string; servicio?: string }> }) {
  await requireMovil({ navKey: 'integraciones' });
  const [lista, incidentes, sp] = await Promise.all([getIntegraciones(), getIncidentes(30).catch(() => []), searchParams]);
  // Al navegador va sólo lo que la pantalla dibuja.
  const integraciones: IntegracionM[] = lista.map((i) => ({
    key: i.key, nombre: i.nombre, categoria: i.categoria, descripcion: i.descripcion, estado: i.estado, detalle: i.detalle,
    paraQue: i.paraQue ?? null, soloServidor: i.soloServidor === true,
    // El link de escritorio que abre SU modal (o la grilla, para las que no se abren sueltas).
    enComputadora: SIN_MODAL_SUELTO.includes(i.key) ? '/integraciones' : `/integraciones?abrir=${encodeURIComponent(i.key)}`,
  }));
  const problemas: ProblemaM[] = incidentes
    .filter((x) => x.resolvedAt == null)
    .map((x) => ({ id: x.id, servicio: lista.find((i) => i.key === x.service)?.nombre ?? x.service, estado: x.statusLabel, detalle: x.detalle, rojo: x.severidad === 'rojo', confirmado: x.confirmado }));
  const abrir = (sp.abrir ?? sp.servicio ?? '').trim().toLowerCase() || null;
  return (
    <PantallaM>
      <CabeceraM titulo="Integraciones" />
      <IntegracionesM integraciones={integraciones} problemas={problemas} abrir={abrir} />
    </PantallaM>
  );
}
