// =============================================================================
// /funnel — editor del funnel (etapas + transiciones) que alimenta el CRM
// =============================================================================

import { getFunnelDefault, getFunnelDe, listarFunnels } from '@/lib/funnels';
import { FunnelEditor } from './FunnelEditor';
import { EntradasCard } from './EntradasCard';
import { requireRolWs } from '@/lib/tab-access';
import { getDiagnosticoFase } from '@/lib/fase-store';
import { CANALES, type CanalId } from '@/lib/fase-diagnostico';

export const dynamic = 'force-dynamic';
export const revalidate = 0;

/** El canal guardado en `funnels.canal` es texto: se valida contra el catálogo
 *  antes de usarlo, porque decide qué pregunta y qué plantilla se muestran. */
const esCanal = (v: unknown): v is CanalId => CANALES.some((c) => c.id === v);

export default async function FunnelPage({ searchParams }: { searchParams: Promise<{ f?: string }> }) {
  await requireRolWs([], { nav: 'crm' });
  // La declaración de cómo ENTRA la gente va ARRIBA del editor, no abajo: es el
  // dato del que dependen los audios, el ensayo, las secuencias y el copy de las
  // landings, y es el que nadie sabía que faltaba. El recorrido (las etapas) se
  // edita después, y es lo que ya se sabía editar.
  //
  // ⚠️ `?f=` NO decide DE QUIÉN son los datos —eso lo sigue decidiendo el
  // workspace— sino CUÁL de los funnels de este workspace se edita, y sólo vale
  // si está en la lista que ya vino scopeada. Un id ajeno cae al default: nunca
  // abre el funnel de otro cliente.
  const [{ f }, funnels] = await Promise.all([searchParams, listarFunnels().catch(() => [])]);
  const pedido = Number(f);
  const elegido = funnels.find((x) => x.id === pedido) ?? null;
  const [cfg, diag] = await Promise.all([
    elegido ? getFunnelDe(elegido.id) : getFunnelDefault(),
    getDiagnosticoFase().catch(() => null),
  ]);
  const { pipeline, suppressed, entradas, evento, id } = cfg;
  // El BOFU del funnel manda sobre el del negocio; sin él, se hereda (que es lo
  // que significa `funnels.canal = null`).
  const canal = esCanal(cfg.canal) ? cfg.canal : (diag?.canal ?? null);
  return (
    <FunnelEditor
      key={id ?? 'default'}
      initialPipeline={pipeline}
      initialSuppressed={suppressed}
      funnelId={elegido?.id}
      funnels={funnels}
      encabezado={<EntradasCard initial={entradas} initialEvento={evento} canal={canal} funnelId={elegido?.id} />}
    />
  );
}
