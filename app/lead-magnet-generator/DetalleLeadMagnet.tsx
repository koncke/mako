'use client';

// =============================================================================
// Un lead magnet abierto: dónde está su pieza, el link que recibe el lead y la página donde lo piden (5/11/2026)
// =============================================================================
// Tres renglones, en el orden en que se hacen (el molde de la página de un formulario de Typeform/SurveyJS publicado: la pieza,
// el link para compartir, dónde se recibe). Cada acción pasa por /api/lead-magnet-generator y la pantalla se vuelve a leer del
// server (`router.refresh`): lo que se ve es lo guardado. Lo que falta se dice en una frase (reglas.ts → `estadoDe`).
// =============================================================================

import { useState, useTransition } from 'react';
import { useRouter } from '@/app/_ui/Link';
import Link from '@/app/_ui/Link';
import { Button } from '@/app/_ui/Button';
import { ReportarASoporte } from '@/app/_ui/ReportarASoporte';
import { rutaDePagina, rutaDePieza } from '@/lib/lead-magnets/pieza';
import { estadoDe, nombreDePlantilla, type LeadMagnetVista } from './reglas';
import { pedirLeadMagnet } from './cliente';

/** Una landing del Web Generator, como la ve el detalle: su título y su link público si está publicada. */
export type LandingVista = { titulo: string; url: string | null };

export function DetalleLeadMagnet({ lm, landingPieza, landingCaptura, esPrimero }: {
  lm: LeadMagnetVista;
  landingPieza: LandingVista | null;
  landingCaptura: LandingVista | null;
  /** ¿Es el primero de la lista? Las automatizaciones mandan el link del primero (`{{negocio_lead_magnet_link}}`). */
  esPrimero: boolean;
}) {
  const router = useRouter();
  const [error, setError] = useState<string | null>(null);
  const [haciendo, setHaciendo] = useState<string | null>(null);
  const [enlace, setEnlace] = useState(lm.enlace ?? '');
  const [copiado, setCopiado] = useState(false);
  const [, empezar] = useTransition();
  const estado = estadoDe(lm);
  const plantilla = nombreDePlantilla(lm);

  const hacer = async (accion: string, extra: Record<string, unknown> = {}) => {
    setHaciendo(accion);
    setError(null);
    const r = await pedirLeadMagnet({ accion, id: lm.id, ...extra });
    setHaciendo(null);
    if (!r.ok) { setError(r.error); return; }
    empezar(() => router.refresh());
  };

  const copiar = async () => {
    if (!lm.enlace) return;
    try { await navigator.clipboard.writeText(lm.enlace); setCopiado(true); setTimeout(() => setCopiado(false), 1600); } catch { /* sin portapapeles: el link está a la vista */ }
  };

  return (
    <div className="lmg-detalle">
      <header className="lmg-cab">
        <h1 className="lmg-nombre">{lm.nombre}</h1>
        <p className="lmg-sub">{[lm.tipo, plantilla ? `Plantilla: ${plantilla}` : null].filter(Boolean).join(' · ')}</p>
        {estado.falta ? <p className="lmg-falta">{estado.falta}</p> : <p className="lmg-listo">Listo para captar.</p>}
      </header>

      {error && <p className="lmg-error" role="alert">{error}<ReportarASoporte /></p>}

      <section className="lmg-fila" aria-labelledby="lmg-pieza">
        <h2 id="lmg-pieza" className="lmg-fila__titulo">La pieza</h2>
        {lm.pieza ? (
          <div className="lmg-fila__cuerpo">
            <span className="lmg-dato">
              {lm.pieza.herramienta === 'web'
                ? (landingPieza?.url ? <a href={landingPieza.url} target="_blank" rel="noopener noreferrer">{landingPieza.url}</a> : 'Sin publicar todavía.')
                : `En ${estado.herramienta}.`}
            </span>
            <Link href={rutaDePieza(lm.pieza)} className="mk-btn mk-btn--secondary mk-btn--sm">Abrir en {estado.herramienta}</Link>
          </div>
        ) : (
          <div className="lmg-fila__cuerpo"><span className="lmg-dato">Sólo su descripción: no se armó en MaKo.</span></div>
        )}
      </section>

      {lm.pieza?.herramienta !== 'web' && (
        <section className="lmg-fila" aria-labelledby="lmg-link">
          <h2 id="lmg-link" className="lmg-fila__titulo">El link que recibe</h2>
          <div className="lmg-fila__cuerpo">
            {lm.enlace ? (
              <>
                <a className="lmg-dato lmg-dato--link" href={lm.enlace} target="_blank" rel="noopener noreferrer">{lm.enlace}</a>
                <Button variant="secondary" size="sm" onClick={copiar}>{copiado ? 'Copiado' : 'Copiar'}</Button>
              </>
            ) : estado.puedeCompartir ? (
              <>
                <span className="lmg-dato">Un link de solo lectura, para cualquiera.</span>
                <Button variant="primary" size="sm" loading={haciendo === 'compartir'} onClick={() => void hacer('compartir')}>Crear link</Button>
              </>
            ) : null}
          </div>
          {!estado.puedeCompartir && (
            <form className="lmg-pegar" onSubmit={(e) => { e.preventDefault(); void hacer('enlace', { enlace }); }}>
              <input className="lmg-input" type="url" inputMode="url" value={enlace} onChange={(e) => setEnlace(e.target.value)}
                placeholder="https://" aria-label="El link del lead magnet" />
              <Button type="submit" variant="secondary" size="sm" loading={haciendo === 'enlace'} disabled={(lm.enlace ?? '') === enlace.trim()}>Guardar</Button>
            </form>
          )}
        </section>
      )}

      {estado.puedeCaptar && (
        <section className="lmg-fila" aria-labelledby="lmg-pagina">
          <h2 id="lmg-pagina" className="lmg-fila__titulo">La página que lo pide</h2>
          <div className="lmg-fila__cuerpo">
            {lm.pagina ? (
              <>
                <span className="lmg-dato">
                  {landingCaptura?.url
                    ? <a href={landingCaptura.url} target="_blank" rel="noopener noreferrer">{landingCaptura.url}</a>
                    : 'Sin publicar todavía.'}
                </span>
                <Link href={rutaDePagina(lm.pagina)} className="mk-btn mk-btn--secondary mk-btn--sm">Abrir en Web Generator</Link>
              </>
            ) : (
              <>
                <span className="lmg-dato">Una landing con formulario: lo que dejan entra a tu CRM.</span>
                <Button variant="primary" size="sm" loading={haciendo === 'captar'} onClick={() => void hacer('captar')}>Crear su página</Button>
              </>
            )}
          </div>
        </section>
      )}

      <section className="lmg-fila" aria-labelledby="lmg-llega">
        <h2 id="lmg-llega" className="lmg-fila__titulo">Cómo le llega</h2>
        <div className="lmg-fila__cuerpo">
          <span className="lmg-dato">
            {esPrimero
              ? 'En Automations, el dato «Link del lead magnet» manda este link.'
              : 'Las automatizaciones mandan el link del primero de tu lista.'}
          </span>
          {!esPrimero && (
            <Button variant="secondary" size="sm" loading={haciendo === 'primero'} onClick={() => void hacer('primero')}>Ponerlo primero</Button>
          )}
        </div>
      </section>
    </div>
  );
}
