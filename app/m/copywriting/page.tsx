// =============================================================================
// /m/copywriting — «Ads Writer» (Content Machine › Copywriting) en el teléfono
// =============================================================================
// La tab de escritorio (app/ads-writer) destilada: las MISMAS tres vistas, en su orden y con su nombre
// (Anuncios · Guiones · Analizar guion, `?tab=` como allá), la MISMA acción primaria («Escribir el
// próximo guion», a la misma celda: app/ads-writer/reglas.ts) y las MISMAS rutas para escribir y
// valorar (./api.ts). Lo que se hace acá:
//   · Anuncios: la matriz como lista, un grupo por avatar; tocar un anuncio sin guion hace que MaKo lo
//     escriba ahí mismo (como la tarjeta punteada de escritorio), y uno con guiones abre su hoja;
//   · Guiones: el historial de lo escrito, el más nuevo primero, con «Copiar» en cada tarjeta;
//   · Analizar guion: escribir o DICTAR un guion y valorarlo, y el historial de valorados.
// En la computadora: «Elegir con MaKo», editar, borrar, el estado, rehacer la matriz, sincronizar,
// ángulos y avatares (cada vista lo dice en su fila «… · En la computadora»).
//
// Referencias de apps reales: la tarjeta de un guion copia la de una cita de Readwise (la cita con su
// barra, la fuente abajo y «Copiar»); los anuncios, una lista agrupada de Linear (grupo por avatar con
// su «3 de 5», la píldora de estado en la fila); el lector, un teleprompter (bloques grandes en una
// columna); Analizar guion, la app de Grammarly (escribes o dictas y la nota llega en una tarjeta).
//
// ⚠️ El pedido de copy NO lleva un campo libre: escritorio lo prohíbe a propósito («Crear un guion
//    NUNCA pide redactar nada», app/onboarding/MatrizView.tsx). Lo que se escribe o se dicta es el
//    guion a VALORAR, que es el único campo de texto de la tab de escritorio.
// Quién: la regla del Sidebar para `ads-writer` (sólo el admin del negocio), la misma key que escritorio
// (`requireRolWs([], { nav: 'ads-writer' })`); `copywriting` no sirve de navKey (lib/movil-rutas.ts).
// ⚠️ El workspace es el del request (getSetting / getTenantDb por dentro), nunca `?ws=`: la query sólo
//    trae `tab` (QUERY_DE_SECCION).
// ⚠️ Como escritorio: el puente de los pasos viejos corre ANTES de preguntar por el onboarding, y
//    «Analizar guion» no pasa por esa puerta. La matriz se lee en ESTRICTO (una lectura caída no se
//    dibuja como «no hay anuncios»), y el historial de valorados sólo con `?tab=analizar`.
// =============================================================================

import './copywriting.css';
import { requireMovil } from '@/lib/movil-guard';
import { onboardingTabPendiente } from '@/lib/tab-onboarding-state';
import { puentearPasosCopyGen } from '@/lib/copygen-puente';
import { integracionConectada } from '@/lib/credenciales';
import { tabActivacion } from '@/lib/tab-activacion';
import { getDrafts } from '@/lib/ads-analyst';
import { getAvatares } from '@/lib/avatares';
import { getRazonesEstricto } from '@/lib/api-mako/areas/contenido.helpers';
import { tabDeUrl } from '@/app/ads-writer/tabs';
import { PantallaM } from '@/app/m/_ui';
import { CopywritingM } from './CopywritingM';
import { avatarLite, celdaM, draftM, type AvatarLite, type CeldaM, type DatosAnalizarM } from './modelo';

export const dynamic = 'force-dynamic';

type Sp = Record<string, string | string[] | undefined>;

/** «Analizar guion»: sin Meta no hay contra qué valorar (escritorio pone su panel de activación). */
async function datosAnalizar(): Promise<DatosAnalizarM> {
  let sinMeta = false;
  if (tabActivacion('script')) {
    try { sinMeta = !(await integracionConectada('meta')); } catch (e) {
      console.error('[m/copywriting] integración de Meta:', e instanceof Error ? e.message : e);
    }
  }
  if (sinMeta) return { sinMeta, drafts: [], error: false };
  try {
    return { sinMeta, drafts: (await getDrafts()).map(draftM), error: false };
  } catch (e) {
    console.error('[m/copywriting] getDrafts:', e instanceof Error ? e.message : e);
    return { sinMeta, drafts: [], error: true };
  }
}

export default async function CopywritingPagina({ searchParams }: { searchParams: Promise<Sp> }) {
  await requireMovil({ navKey: 'ads-writer' });
  const tab = tabDeUrl((await searchParams).tab);
  // Arranca ya: no depende de nada de abajo.
  const analizarP = tab === 'analizar' ? datosAnalizar() : null;

  // ⚠️ PRIMERO EL PUENTE (app/ads-writer/page.tsx): sin él, la tab figura pendiente hasta para quien la
  // completó hace meses. Es idempotente y corre una vez por workspace.
  await puentearPasosCopyGen();
  const pendiente = await onboardingTabPendiente('ads-writer').catch(() => false);

  let celdas: CeldaM[] = [];
  let avatares: AvatarLite[] = [];
  let errorMatriz = false;
  const [r, a] = await Promise.allSettled([getRazonesEstricto(), getAvatares()]);
  if (r.status === 'fulfilled') celdas = r.value.map(celdaM);
  else {
    errorMatriz = true;
    console.error('[m/copywriting] la matriz:', r.reason instanceof Error ? r.reason.message : r.reason);
  }
  if (a.status === 'fulfilled') avatares = a.value.map(avatarLite);
  else console.error('[m/copywriting] los avatares:', a.reason instanceof Error ? a.reason.message : a.reason);

  const analizar = analizarP ? await analizarP : null;

  return (
    <PantallaM>
      <CopywritingM celdas={celdas} avatares={avatares} pendiente={pendiente} errorMatriz={errorMatriz} analizar={analizar} />
    </PantallaM>
  );
}
