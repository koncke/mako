// =============================================================================
// /m/automations — la lectura del server: las automatizaciones ya listas para dibujar
// =============================================================================
// TODO sale de las MISMAS lecturas que escritorio, ninguna consulta propia:
//   · las automatizaciones, sus métricas de 30 días, el borrador y su base → `getSettingData`
//     (lib/setting-secuencias.ts), lo que lee GET /api/chat-agent/secuencias para /automations y
//     /chat-analyst para sus números;
//   · las etapas de cada producto → `productosConEtapas` (el mismo GET);
//   · las etiquetas → `listarEtiquetas({ incluirArchivadas })`, lo que pide el lienzo
//     (app/_components/etiquetas-cliente.ts, `?archivadas=1`);
//   · la zona → `tzActual` (el texto del horario la nombra).
// El workspace es el del request (`getTenantDb` por dentro de cada lectura), NUNCA `?ws=`.
//
// Al teléfono viaja lo ya leído (títulos, líneas, números): ni el grafo de lo publicado ni la
// estrategia. Sólo el flujo de un BORRADOR, porque Publicar lo manda tal cual al PATCH de escritorio.
// =============================================================================

import 'server-only';
import { getSettingData, productosConEtapas } from '@/lib/setting-secuencias';
import { listarEtiquetas } from '@/lib/etiquetas';
import { getFunnelDefault } from '@/lib/funnels';
import { tzActual } from '@/lib/timezone';
import { TRIGGERS, ETAPAS } from '@/lib/email-marketing';
import { TRIGGER_AVISO_MAKO } from '@/lib/disparadores';
import { ROTULO_CHATBOT, ROTULO_MENSAJES_MAKO } from '@/lib/plantillas-automatizaciones';
import type { EstrategiaLegada } from '@/lib/flujo-legado';
import type { PasoGrafo } from '@/lib/flujo-grafo';
import {
  borradorAlAbrir, cronEnLectura, frenoDePublicar, lineaDelDisparador, nombresParaTarjetas, pasosEnLectura, publicadoAlAbrir,
  type NombresDisparo,
} from './modelo';
import type { AutomatizacionM, SeccionAutoM } from './reglas';

export type LecturaAutomations =
  | { estado: 'ok'; secciones: SeccionAutoM[]; total: number }
  | { estado: 'error' };

const msg = (e: unknown) => (e instanceof Error ? e.message : String(e));

export async function leerAutomations(o: { conNumeros: boolean }): Promise<LecturaAutomations> {
  let data: Awaited<ReturnType<typeof getSettingData>>;
  try {
    data = await getSettingData();
  } catch (e) {
    console.error(`[m/automations] getSettingData: ${msg(e)}`);
    return { estado: 'error' };
  }
  // Lo que sólo NOMBRA: si falla, la etapa se dice por su clave (como el GET de escritorio, que también
  // las ataja: `productosConEtapas().catch(() => [])`).
  const [productos, etiquetas, funnel, tz] = await Promise.all([
    productosConEtapas().catch(() => []),
    listarEtiquetas({ incluirArchivadas: true }).catch(() => []),
    getFunnelDefault().catch(() => null),
    tzActual().catch(() => null),
  ]);
  // El nombre de una etapa fuera de todo kanban: la del embudo del negocio (sin las salidas, como el GET
  // de escritorio) y, si es una de antes, el catálogo de lib/email-marketing.ts.
  const etapasNegocio = (funnel?.stages ?? [])
    .filter((s) => (s.band ?? 'pipeline') !== 'salidas')
    .map((s) => ({ value: s.key, label: s.label }));
  const nombres: NombresDisparo = {
    productos,
    etiquetas,
    triggers: TRIGGERS,
    etiquetaEtapa: (key) => etapasNegocio.find((e) => e.value === key)?.label ?? ETAPAS.find((e) => e.value === key)?.label ?? key,
    tz,
  };
  const nombresTarjetas = nombresParaTarjetas(nombres);
  const { secuencias } = data;
  const abrirOp = {
    idDeClave: (clave: string) => secuencias.find((s) => s.clave === clave)?.id ?? null,
    nombreDeSecuencia: (id: number) => secuencias.find((s) => s.id === id)?.nombre ?? null,
  };

  const chatbot: AutomatizacionM[] = [];
  const mako: AutomatizacionM[] = [];
  for (const s of secuencias) {
    // Lo que no se puede leer de UNA no tumba la lista: se dibuja sin sus tarjetas.
    let fila: AutomatizacionM;
    const esMako = s.trigger_tipo === TRIGGER_AVISO_MAKO;
    try {
      const publicado = publicadoAlAbrir(s.pasos as Array<PasoGrafo & { orden?: number | null }>, s.estrategia as EstrategiaLegada, abrirOp);
      // El CRON va arriba en las dos lecturas: los disparadores no viajan en el borrador (tienen su guardado).
      const cron = cronEnLectura(s, nombres);
      const publicados = [...cron, ...pasosEnLectura(publicado.pasos, nombresTarjetas)];
      // `borrador` AUSENTE = no se pudo leer; null = no hay. En los dos casos no se afirma «Sin publicar»
      // (`sinPublicarDe`, app/automations/SimuladorWhatsApp.tsx: `borrador != null`). Viaja con la `base` y su
      // `guardado_at` (lo que se VIO): sin ellas el server no dejaría publicarlo ni descartarlo (`comprobarVisto`).
      const visto = s.borrador?.pasos?.length && typeof s.base === 'string' ? { base: s.base, guardado_at: s.borrador.guardado_at } : null;
      const enBorrador = visto && s.borrador ? borradorAlAbrir(s.borrador.pasos) : null;
      fila = {
        id: s.id,
        nombre: s.nombre,
        activa: s.activa,
        disparador: lineaDelDisparador(s, nombres),
        pasos: enBorrador ? [...cron, ...pasosEnLectura(enBorrador, nombresTarjetas)] : publicados,
        borrador: enBorrador && visto ? {
          pasos: enBorrador,
          freno: frenoDePublicar(enBorrador),
          enComputadora: publicado.limpiarEstrategia,
          publicados,
          base: visto.base,
          guardado_at: visto.guardado_at,
        } : null,
        numeros: o.conNumeros && !esMako ? {
          enviados: s.metricas.enviadosWa + s.metricas.enviadosEmail,
          respuestas: s.metricas.respuestas,
          enCurso: s.metricas.inscriptosActivos,
        } : null,
      };
    } catch (e) {
      console.error(`[m/automations] automatización ${s.id}: ${msg(e)}`);
      fila = {
        id: s.id, nombre: s.nombre, activa: s.activa, disparador: '', pasos: [], borrador: null, numeros: null,
      };
    }
    (esMako ? mako : chatbot).push(fila);
  }

  // Las dos divisiones de escritorio (`partirLista`). Con sólo las del Chatbot, la lista va sin título.
  const secciones: SeccionAutoM[] = [];
  if (chatbot.length) secciones.push({ id: 'chatbot', titulo: mako.length ? ROTULO_CHATBOT : null, filas: chatbot });
  if (mako.length) secciones.push({ id: 'mako', titulo: ROTULO_MENSAJES_MAKO, filas: mako });
  return { estado: 'ok', secciones, total: secuencias.length };
}
