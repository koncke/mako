'use client';

// =============================================================================
// ExperimentosApp — shell de tabs de /experimentos
// =============================================================================
// Retro · Experiments · Conclusions · Análisis. (El tablero To-do vive en su
// propia ruta /todo.) El shell tiene el estado de datos (se refresca tras cada
// mutación) y un toast simple. Cada tab es un componente propio; comparten los
// átomos de ./ui.
//
// ANÁLISIS ES DISTINTA DE LAS OTRAS TRES, y es la razón de la mitad de este
// archivo. Entró el 11/10/2026 (Martín: «Elimina la tab de "Análisis", llévala
// dentro de "Experiments"») y su informe lo calcula el SERVER con
// analisisNegocio, que es lenta: la page sólo la corre cuando la URL pide
// ?tab=analisis, y la manda acá ya dibujada como la prop `analisis` (un
// ReactNode de un server component — así el tipo del informe nunca viaja al
// navegador). Por eso, al tocar la tab Análisis sin el informe todavía en la
// mano, se pide la URL con router.replace (un viaje al server, con su giro
// mientras tanto); las otras tres sólo reescriben la URL con
// history.replaceState, sin viaje: sus datos ya están acá.
//
// Y ANÁLISIS NO NECESITA META: la cascada sale del CRM. Si el negocio no tiene
// Meta conectado, la page manda `panelSinMeta` y ese panel ocupa el lugar de
// Retro, Experiments y Conclusions —que sí lo necesitan—, pero Análisis sigue
// funcionando. Antes de la mudanza la page devolvía el panel en lugar de toda la
// pantalla; con Análisis adentro eso se la escondía a los negocios sin Meta.
// =============================================================================

import { useCallback, useState, useTransition, type ReactNode } from 'react';
import { useRouter } from '@/app/_ui/Link';
import { Spinner } from '@/app/_ui';
import type { ExperimentosView } from '@/lib/experimentos';
import type { Retro } from '@/lib/retro';
import type { TabExperimentos } from './tabs';
import { MONO, SANS } from './ui';
import { RetroTab } from './RetroTab';
import { ExperimentsTab } from './ExperimentsTab';
import { ConclusionsTab } from './ConclusionsTab';

type TabKey = TabExperimentos;

export type Toast = (msg: string, tone?: 'ok' | 'bad') => void;

type Props = {
  exp: ExperimentosView;
  retros: Retro[];
  errorMsg: string | null;
  demo: boolean;
  /** La tab que pide la URL (`?tab=`), resuelta en el server con `tabDeUrl` (./tabs). */
  tabInicial: TabKey;
  /** El informe de Análisis, ya dibujado en el server. null = esta request no lo pidió. */
  analisis: ReactNode | null;
  /** El panel que pide conectar Meta, o null si ya está. Reemplaza a Retro, Experiments y Conclusions. */
  panelSinMeta: ReactNode | null;
  /** Una hipótesis que trae el link (`?hipotesis=`): abre el alta de un experimento con ella escrita. */
  hipotesisInicial: string | null;
};

// ⚠️ `?tab=` NO ES UN LUJO ACÁ. La memoria del proyecto dice que los experimentos
// son la fuente de verdad y que MaKo, desde el resto de la app, SUGIERE
// experimentos — o sea que esta tab es destino de links de otras pantallas (la
// tab Offer enlaza `?tab=experiments&hipotesis=…` desde cada cambio que propone).
// Y hubo una época en que la tab activa era un `useState('retro')` fijo: todos
// esos links caían en Retro, apuntaran a donde apuntaran. Un link que siempre
// aterriza en el mismo lado no es un link, es un botón de «ir a la tab».
//
// La tab la lee el SERVER (la page necesita saberla para decidir si corre el
// análisis) y llega por prop: ya no hace falta `useSearchParams`, ni el
// Suspense que exigía.
export function ExperimentosApp({ exp, retros: retros0, errorMsg, demo, tabInicial, analisis, panelSinMeta, hipotesisInicial }: Props) {
  // El valor de la URL manda al montar, y desde ahí el estado es del usuario.
  const [tab, setTab] = useState<TabKey>(tabInicial);
  // …salvo que el SERVER mande otra tab: pasa si se navega a /experimentos con
  // otro ?tab= sin desmontar esta pantalla (el link de la barra estando en
  // Análisis, por ejemplo). Sin esto, la tab de la pantalla y la que pidió el
  // link quedarían distintas — y en Análisis, con un giro que no termina nunca,
  // porque el server no mandó el informe. Es el patrón de React para «ajustar el
  // estado cuando cambia una prop», durante el render y sin efecto.
  const [tabDelServer, setTabDelServer] = useState<TabKey>(tabInicial);
  if (tabInicial !== tabDelServer) {
    setTabDelServer(tabInicial);
    setTab(tabInicial);
  }

  const router = useRouter();
  const [trayendo, startTransition] = useTransition();
  const [expView, setExpView] = useState<ExperimentosView>(exp);
  const [retros, setRetros] = useState<Retro[]>(retros0);
  const [toast, setToast] = useState<{ msg: string; tone: 'ok' | 'bad' } | null>(null);
  // La hipótesis del link se usa UNA vez: después de abrir el alta se suelta acá,
  // así volver a la tab Experiments (que la desmonta y la vuelve a montar) no la
  // abre de nuevo.
  const [hipotesis, setHipotesis] = useState<string | null>(hipotesisInicial);
  const soltarHipotesis = useCallback(() => setHipotesis(null), []);

  const notify: Toast = useCallback((msg, tone = 'ok') => {
    setToast({ msg, tone });
    window.setTimeout(() => setToast(null), 3200);
  }, []);

  const refreshExp = useCallback(async () => {
    try { const j = await fetch('/api/experimentos').then((r) => r.json()); if (j.ok) setExpView(j.view); } catch { /* local sin DB */ }
  }, []);
  const refreshRetros = useCallback(async () => {
    try { const j = await fetch('/api/retro').then((r) => r.json()); if (j.ok) setRetros(j.retros); } catch { /* local sin DB */ }
  }, []);

  const elegir = (t: TabKey) => {
    setTab(t);
    // La tab viaja en ?tab= y se escribe con el ROUTER de la casa (AGENTS.md: «la tab viaja
    // en ?tab= leída en el server y escrita con router.replace»), que conserva el ?ws=. Con
    // history.replaceState el árbol del router quedaba con la tab vieja y atrás/adelante pintaba
    // otra (revisión del 11/10). Se arma desde la URL ACTUAL para no perder el rango del análisis
    // (desde/hasta/cierres/presupuesto): una URL fija los tiraba.
    let destino = '/experimentos?tab=' + t;
    try {
      const u = new URL(window.location.href);
      u.searchParams.set('tab', t);
      destino = u.pathname + u.search;
    } catch { /* sin URL: el destino mínimo */ }
    startTransition(() => router.replace(destino, { scroll: false }));
  };

  const tabs: Array<{ key: TabKey; label: string; count?: number }> = [
    { key: 'retro', label: 'Retro', count: retros.length || undefined },
    { key: 'experiments', label: 'Experiments', count: expView.counts.activos || undefined },
    { key: 'conclusions', label: 'Conclusions', count: expView.counts.cerrados || undefined },
    // «Análisis» se queda en español: es el nombre que ya tenía la tab (las demás
    // van en inglés por decisión de producto).
    { key: 'analisis', label: 'Análisis' },
  ];

  // Retro, Experiments y Conclusions miden contra Meta; sin Meta, su lugar lo
  // ocupa el panel que la pide. Análisis no pasa por acá.
  const sinMeta = panelSinMeta != null && tab !== 'analisis';

  return (
    <div style={{ fontFamily: SANS }}>
      {demo && (
        <div style={{ marginBottom: 14, padding: '8px 14px', borderRadius: 10, background: 'var(--warn-bg)', border: '1px solid var(--warn)', color: 'var(--warn)', fontSize: 12.5, fontFamily: MONO }}>
          modo demo (local sin Supabase) · en producción se ven tus datos reales
        </div>
      )}
      {errorMsg && !demo && tab !== 'analisis' && (
        <div style={{ marginBottom: 14, padding: '10px 14px', borderRadius: 10, background: 'var(--bad-bg)', border: '1px solid var(--bad)', color: 'var(--bad)', fontSize: 13 }}>{errorMsg}</div>
      )}

      {/* Tab bar */}
      <nav style={{ display: 'flex', gap: 4, marginBottom: 26, borderBottom: '1px solid var(--border)', flexWrap: 'wrap' }}>
        {tabs.map((t) => {
          const on = t.key === tab;
          return (
            <button key={t.key} type="button" onClick={() => elegir(t.key)} aria-pressed={on}
              style={{ display: 'inline-flex', alignItems: 'center', gap: 8, padding: '11px 16px', marginBottom: -1, background: 'transparent', border: 'none', borderBottom: `2px solid ${on ? 'var(--primary)' : 'transparent'}`, color: on ? 'var(--primary)' : 'var(--dim)', fontFamily: SANS, fontSize: 16.5, fontWeight: on ? 600 : 500, cursor: 'pointer', transition: 'color .15s' }}>
              {t.label}
              {t.count != null && (
                <span style={{ minWidth: 20, height: 20, padding: '0 6px', borderRadius: 999, display: 'inline-flex', alignItems: 'center', justifyContent: 'center', fontSize: 11.5, fontWeight: 600, fontFamily: MONO, background: on ? 'var(--primary-bg)' : 'var(--surface-2)', color: on ? 'var(--primary-strong)' : 'var(--faint)', border: `1px solid ${on ? 'var(--primary-weak)' : 'var(--border)'}` }}>{t.count}</span>
              )}
            </button>
          );
        })}
      </nav>

      {sinMeta && panelSinMeta}
      {!sinMeta && tab === 'retro' && (
        <RetroTab retros={retros} setRetros={setRetros} refreshRetros={refreshRetros}
          refreshExp={refreshExp} notify={notify} demo={demo} />
      )}
      {!sinMeta && tab === 'experiments' && (
        <ExperimentsTab view={expView} refreshExp={refreshExp} notify={notify} demo={demo}
          hipotesisInicial={hipotesis} onHipotesisAbierta={soltarHipotesis} />
      )}
      {!sinMeta && tab === 'conclusions' && (
        <ConclusionsTab aprendizajes={expView.aprendizajes} />
      )}
      {tab === 'analisis' && (
        // Mientras el server arma el informe (o si todavía no llegó), el giro.
        // Con un rango nuevo el informe viejo queda a la vista hasta que llega el
        // otro: lo maneja la navegación en suave de los links del propio informe.
        analisis != null && !trayendo ? analisis : (
          <div style={{ display: 'flex', justifyContent: 'center', padding: '60px 0', color: 'var(--faint)' }}>
            <Spinner size={22} />
          </div>
        )
      )}

      {toast && <ToastView msg={toast.msg} tone={toast.tone} />}
    </div>
  );
}

function ToastView({ msg, tone }: { msg: string; tone: 'ok' | 'bad' }): ReactNode {
  return (
    <div style={{ position: 'fixed', bottom: 26, left: '50%', transform: 'translateX(-50%)', zIndex: 90, padding: '12px 20px', borderRadius: 12, background: 'var(--ink)', color: 'var(--surface)', fontFamily: SANS, fontSize: 14, fontWeight: 500, boxShadow: '0 14px 40px rgba(18,21,27,.35)', display: 'flex', alignItems: 'center', gap: 10 }}>
      <span style={{ color: tone === 'bad' ? '#FF9B7A' : '#7BE0A8', fontWeight: 700 }}>{tone === 'bad' ? '✕' : '✓'}</span>
      {msg}
    </div>
  );
}
