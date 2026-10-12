// =============================================================================
// /m/automations — «Automations» en el teléfono: la lista, el interruptor y el sheet de lectura
// =============================================================================
// Prototipo: docs/prototipos/mako-mobile-v2.html, data-ir="auto". Diseño: docs/diseno-mako-mobile-v2.md,
// «Automations». Muestra las automatizaciones (`nutricion_secuencias`, las de /automations, en sus dos
// divisiones) con qué las dispara en una línea y su interruptor; «Sin publicar» si el lienzo dejó un
// borrador. Tocar una abre un sheet con sus números (los de /chat-analyst) y sus tarjetas en LECTURA,
// y —si hay borrador y quien mira es admin— «Publicar los cambios» / «Descartar los cambios».
// Editar el lienzo y crear, en la computadora.
//
// Quién VE: la regla del Sidebar para `setting` (admin y setter, y la capa). Quién ESCRIBE: el admin,
// lo mismo que exigen las rutas de escritorio que se reusan (PATCH /api/whatsapp/secuencias y POST
// /api/chat-agent/secuencias contestan 403 a cualquier otro rol). Los números, quien ve /chat-analyst.
//
// ⚠️ maxDuration 60: `getSettingData` lee paginados los envíos de 30 días y TODAS las inscripciones.
// =============================================================================

import './automations.css';
import { requireMovil } from '@/lib/movil-guard';
import { puedeVerKey } from '@/lib/movil-rutas';
import { ComputadoraM, ErrorM, PantallaM, VacioM } from '@/app/m/_ui';
import { AutomationsM } from './AutomationsM';
import { leerAutomations } from './datos';

export const dynamic = 'force-dynamic';
export const maxDuration = 60;

const COMPU = 'Editar el lienzo y crear automatizaciones';

export default async function AutomationsPagina() {
  const ctx = await requireMovil({ navKey: 'setting' });
  const lectura = await leerAutomations({ conNumeros: puedeVerKey('chat-analyst', ctx.rol, ctx.capa) });

  if (lectura.estado === 'error') {
    return (
      <>
        <ErrorM frase="No se pudieron leer las automatizaciones." />
        <ComputadoraM que={COMPU} />
      </>
    );
  }
  if (!lectura.total) {
    return (
      <>
        <VacioM frase="Todavía no hay automatizaciones." />
        <ComputadoraM que={COMPU} />
      </>
    );
  }
  return (
    <PantallaM refrescable>
      <AutomationsM secciones={lectura.secciones} puedeEditar={ctx.rol === 'admin'} />
      <ComputadoraM que={COMPU} />
    </PantallaM>
  );
}
