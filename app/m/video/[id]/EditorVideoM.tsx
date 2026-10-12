'use client';

// =============================================================================
// EditorVideoM — un anuncio en el teléfono: mirarlo, toma por toma o entero, y descargarlo
// =============================================================================
// Prototipo: docs/prototipos/mako-mobile-v2.html, data-ir="editor". Pantalla de TRABAJO (sin
// título grande ni barra de abajo: cabecera.ts → esTrabajo). De arriba abajo:
//   · el escenario oscuro con el video 9:16: el MONTAJE si existe (el anuncio entero), si no la
//     toma elegida; debajo, qué se está viendo y cuánto dura;
//   · la tira de tomas con su estado (Lista ✓, Filmando, No salió ✕), como la de escritorio
//     (PasoTomas.tsx) con el estado de `estadoDeToma`;
//   · la toma elegida: su estado, por qué (el texto de `textoFlow`, el mismo de escritorio) y lo
//     que dice;
//   · «Filmar de nuevo, ajustar cortes y crear anuncios · En la computadora»;
//   · el pie fijo con el ÚNICO primario (modelo.ts → pieDelEditor): ver el anuncio entero →
//     descargarlo. Sin montaje, apagado y diciendo qué falta.
//
// ⚠️ CERO ESCRITURAS. El teléfono no filma, no encola, no cambia el texto de una toma y no arranca
// el montaje (decisión del 11/10/2026; ver ../datos.ts). Lo que se mueve solo —una toma que la
// computadora está filmando, un montaje en el worker— se vuelve a leer cada 15 s mientras dura.
// =============================================================================

import { useEffect, useMemo, useState } from 'react';
import { useRouter } from '@/app/_ui/Link';
import { Button } from '@/app/_ui/Button';
import { Spinner } from '@/app/_ui/Feedback';
import { Icon } from '@/app/_components/icons';
import { estadoDeToma } from '@/app/video-generator/tomas-estado';
import { descargarComo } from '@/app/video-generator/descargar';
import { nombreDeAnuncio } from '@/app/video-generator/video-pedido';
import type { PlanGuardado } from '@/app/video-generator/video-datos';
import { textoFlow, type CausaFlow } from '@/lib/flow-fallo-texto';
import { CabeceraM, ComputadoraM, PieFijoM, PildoraM, useToastM } from '@/app/m/_ui';
import { ReproductorM } from '../ReproductorM';
import {
  ROTULO_TOMA, duracionDe, hayEnVuelo, pieDelEditor, reloj, tomaInicial, type MontajeM, type TomaM,
} from '../modelo';

/** Cada cuánto se vuelve a leer mientras algo se mueve solo. El montaje tarda de 2 a 5 minutos. */
const SONDEO_MS = 15_000;

export function EditorVideoM({ titulo, plan, montaje }: {
  titulo: string;
  plan: PlanGuardado;
  montaje: MontajeM | null;
}) {
  const router = useRouter();
  const toast = useToastM();

  const tomas = useMemo<(TomaM & { voz: string })[]>(
    () => plan.plan.clips.map((c) => ({ n: c.n, estado: estadoDeToma(plan, c.n), segundos: c.segundos, voz: c.voz ?? '' })),
    [plan],
  );
  const listo = montaje?.fase === 'listo' ? montaje : null;

  // `null` = se está mirando el anuncio ENTERO (sólo existe con el montaje listo).
  const [sel, setSel] = useState<number | null>(() => (listo ? null : tomaInicial(tomas)));
  const [bajando, setBajando] = useState(false);

  // Sin montaje no hay «entero»: si la lectura nueva lo perdió (se refilmó una toma), vuelve a una toma.
  const entero = sel === null && !!listo;
  const toma = entero ? null : tomas.find((t) => t.n === sel) ?? tomas.find((t) => t.n === tomaInicial(tomas)) ?? null;

  // ── Lo que se mueve solo se vuelve a leer (sólo con la pantalla a la vista y con red) ──
  const enVuelo = hayEnVuelo(tomas, montaje);
  useEffect(() => {
    if (!enVuelo) return;
    const t = window.setInterval(() => {
      if (document.visibilityState === 'visible' && navigator.onLine) router.refresh();
    }, SONDEO_MS);
    return () => window.clearInterval(t);
  }, [enVuelo, router]);

  const pie = pieDelEditor(tomas, montaje, entero);
  const total = tomas.length;

  const verEntero = () => {
    setSel(null);
    window.scrollTo({ top: 0, behavior: window.matchMedia?.('(prefers-reduced-motion: reduce)').matches ? 'auto' : 'smooth' });
  };

  const bajar = async () => {
    if (!listo) return;
    setBajando(true);
    try {
      await descargarComo(listo.url, nombreDeAnuncio(titulo));
      toast('Anuncio descargado');
    } catch {
      toast('No se pudo descargar');
    } finally {
      setBajando(false);
    }
  };

  // Lo que se ve en el cuadro grande.
  const marcaToma = toma ? plan.video?.[String(toma.n)] : undefined;
  const urlToma = toma?.estado === 'filmada' ? marcaToma?.url ?? null : null;

  // Por qué: el título de `textoFlow` (el mismo de escritorio) o la espera de una filmación.
  // ⚠️ La causa por defecto NO acusa a nadie (PasoTomas: `desconocida`, nunca `contenido`).
  const motivo = toma?.estado === 'fallada'
    ? textoFlow((marcaToma?.errorCausa as CausaFlow | undefined) ?? 'desconocida', `la toma ${toma.n}`, marcaToma?.errorAt).titulo
    : toma?.estado === 'generando' ? 'Suele tardar entre 1 y 3 minutos.' : '';

  return (
    <div className="m-video-editor">
      <CabeceraM titulo={titulo} />

      <div className="m-video-escenario">
        {entero && listo ? (
          <ReproductorM src={listo.url} marca="Anuncio entero" />
        ) : urlToma && toma ? (
          <ReproductorM src={urlToma} marca={`Toma ${toma.n}`} />
        ) : toma ? (
          <div className="m-video-player m-video-player--vacio" data-estado={toma.estado}>
            <span className="m-video-player__marca">{`Toma ${toma.n}`}</span>
            {toma.estado === 'generando'
              ? <Spinner size={26} color="var(--on-sidebar)" />
              : toma.estado === 'fallada'
                ? <span className="m-video-player__x"><Icon name="x" size={18} /></span>
                : <Icon name="video" size={30} />}
            {toma.voz.trim() && <span className="m-video-player__linea">{toma.voz}</span>}
          </div>
        ) : (
          <div className="m-video-player m-video-player--vacio"><Icon name="video" size={30} /></div>
        )}
        <span className="m-video-dur">
          {entero
            ? `${reloj(duracionDe(tomas, montaje))} · ${total} ${total === 1 ? 'toma' : 'tomas'}`
            : toma ? `Toma ${toma.n} de ${total} · ${toma.segundos} s` : ''}
        </span>
      </div>

      {total > 0 && (
        <div className="m-video-tira" role="group" aria-label="Tomas">
          {tomas.map((t) => {
            const url = t.estado === 'filmada' ? plan.video?.[String(t.n)]?.url : undefined;
            return (
              <button
                key={t.n}
                type="button"
                className="m-video-toma"
                data-estado={t.estado}
                aria-pressed={!entero && toma?.n === t.n}
                aria-label={`Toma ${t.n}: ${ROTULO_TOMA[t.estado].rotulo}`}
                onClick={() => setSel(t.n)}
              >
                <span className="m-video-toma__cuadro">
                  {url && <video src={`${url}#t=0.1`} muted playsInline preload="metadata" tabIndex={-1} aria-hidden />}
                  {t.estado === 'filmada' && <span className="m-video-toma__est"><Icon name="check" size={12} /></span>}
                  {t.estado === 'fallada' && <span className="m-video-toma__est"><Icon name="x" size={12} /></span>}
                  {t.estado === 'generando' && <span className="m-video-toma__est"><Spinner size={16} color="#fff" /></span>}
                </span>
                {t.n}
              </button>
            );
          })}
        </div>
      )}

      {toma && (
        <div className="m-video-panel">
          <div className="m-video-panel__cab">
            <h2>{`Toma ${toma.n}`}</h2>
            <PildoraM tono={ROTULO_TOMA[toma.estado].tono}>{ROTULO_TOMA[toma.estado].rotulo}</PildoraM>
          </div>
          {motivo && <p className="m-video-motivo">{motivo}</p>}
          {toma.voz.trim()
            ? <p className="m-video-linea">{toma.voz}</p>
            : <p className="m-video-linea m-video-linea--vacia">Todavía no dice nada.</p>}
        </div>
      )}

      <ComputadoraM que="Filmar de nuevo, ajustar cortes y crear anuncios" />

      <PieFijoM consecuencia={pie.consecuencia}>
        {pie.accion === 'descargar' ? (
          <Button variant="primary" size="lg" full loading={bajando} icon={<Icon name="descargar" size={20} />} onClick={() => void bajar()}>
            Descargar el anuncio
          </Button>
        ) : (
          <Button variant="primary" size="lg" full disabled={!pie.habilitado} onClick={verEntero}>
            Ver el anuncio entero
          </Button>
        )}
      </PieFijoM>
    </div>
  );
}
