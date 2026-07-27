'use client';

// =============================================================================
// "Branding MaKo" — todo el material de marca junto y descargable
// =============================================================================
// Gráficos de las landings, animaciones de los VSL, íconos, logos y los videos.
// Los bytes viven en Supabase Storage (bucket privado `branding`, mig 0098): en
// el repo no hay un solo archivo, porque 88 MB inflarían cada build de Vercel.
//
// La grilla carga MINIATURAS (2 MB en total, contra 39 MB de los originales) y
// el original se transfiere solo cuando alguien aprieta Descargar.

import { useEffect, useMemo, useState } from 'react';
import type { Curso } from './curso';

export const CURSO_BRANDING: Curso = {
  slug: 'branding-mako',
  categoria: 'Marca y material',
  titulo: 'Branding MaKo',
  cardDesc: 'Todo el material de marca en un solo lugar: los gráficos de las landings, las animaciones de los VSL, los íconos de las apps y los videos. Cada pieza se descarga.',
  eyebrow: 'Material de marca',
  subtitulo: 'Los gráficos, animaciones, íconos y videos que fuimos produciendo. Todo descargable, y con la opción de compartir por link.',
  volumen: '179 piezas',
  recursos: [],
  clases: [],
};

type Asset = {
  id: string; seccion: string; grupo: string; archivo: string; titulo: string;
  mime: string; bytes: number; embed: string | null; thumb: string | null;
};

const SECCIONES: { id: string; label: string; desc: string }[] = [
  { id: 'graficos', label: 'Gráficos', desc: 'Cada panel de las landings de funcionalidad, en PNG de alta resolución.' },
  { id: 'animaciones', label: 'Animaciones', desc: 'Las animaciones que hicimos para los VSL, en MP4.' },
  { id: 'iconos', label: 'Íconos y logos', desc: 'Los íconos de las apps en sus variantes, y los logos originales.' },
  { id: 'videos', label: 'Videos', desc: 'Los mini-VSL de cada funcionalidad. Se ven acá y se descargan.' },
];

const peso = (b: number) => (b > 1048576 ? `${(b / 1048576).toFixed(1)} MB` : `${Math.round(b / 1024)} KB`);

export default function BrandingMaKo({ back }: { back: () => void }) {
  const [assets, setAssets] = useState<Asset[] | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [sec, setSec] = useState('graficos');
  const [grupo, setGrupo] = useState<string | null>(null);

  useEffect(() => {
    fetch('/api/branding')
      .then((r) => r.json())
      .then((j) => (j.ok ? setAssets(j.assets) : setError(j.error || 'no se pudo cargar')))
      .catch(() => setError('no se pudo cargar'));
  }, []);

  const deSeccion = useMemo(() => (assets ?? []).filter((a) => a.seccion === sec), [assets, sec]);
  const grupos = useMemo(() => [...new Set(deSeccion.map((a) => a.grupo))].sort(), [deSeccion]);
  const visibles = useMemo(() => (grupo ? deSeccion.filter((a) => a.grupo === grupo) : deSeccion), [deSeccion, grupo]);

  const cambiarSec = (s: string) => { setSec(s); setGrupo(null); };
  const info = SECCIONES.find((s) => s.id === sec);

  // ── Compartir: "cualquiera con el enlace" o invitar por email ──
  const [abierto, setAbierto] = useState(false);
  const [modo, setModo] = useState<'link' | 'invitados'>('link');
  const [emails, setEmails] = useState('');
  const [creando, setCreando] = useState(false);
  const [resultado, setResultado] = useState<{ enlace: string | null; invitados: { email: string; enviado: boolean; error?: string }[] } | null>(null);
  const [errCrear, setErrCrear] = useState<string | null>(null);

  // Qué se comparte: lo que está en pantalla ahora mismo.
  const alcance = grupo ? 'grupo' : 'seccion';
  const recursoId = grupo || sec;
  const queSeComparte = grupo ? `el grupo "${grupo}"` : `la sección "${info?.label ?? sec}"`;

  async function crearLink() {
    setCreando(true); setErrCrear(null); setResultado(null);
    try {
      const r = await fetch('/api/branding/compartir', {
        method: 'POST', headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          alcance, recursoId, modo,
          etiqueta: `Branding MaKo · ${grupo || info?.label || sec}`,
          emails: modo === 'invitados' ? emails.split(/[\s,;]+/).filter(Boolean) : [],
        }),
      });
      const j = await r.json();
      if (!j.ok) setErrCrear(j.error || 'no se pudo crear');
      else setResultado({ enlace: j.enlace, invitados: j.invitados || [] });
    } catch { setErrCrear('no se pudo crear'); }
    setCreando(false);
  }

  return (
    <div className="al-detail bm-root">
      <button type="button" className="al-back" onClick={back}>← Volver</button>

      <div className="al-detail-hd">
        <span className="al-rescard-badge">Material de marca</span>
        <h1 className="al-h1 al-h1-sm">Branding MaKo</h1>
      </div>
      <p className="al-sub al-sub-sm">
        Todo el material que fuimos produciendo, junto y descargable: los <b>gráficos</b> de las landings,
        las <b>animaciones</b> de los VSL, los <b>íconos</b> de las apps y los <b>videos</b>.
      </p>

      <div className="bm-tabs">
        {SECCIONES.map((s) => {
          const n = (assets ?? []).filter((a) => a.seccion === s.id).length;
          return (
            <button key={s.id} type="button" className={`bm-tab${sec === s.id ? ' on' : ''}`} onClick={() => cambiarSec(s.id)}>
              {s.label}{assets && <span className="bm-tab-n">{n}</span>}
            </button>
          );
        })}
      </div>
      {info && <p className="bm-desc">{info.desc}</p>}

      <div className="bm-acciones">
        <button type="button" className="bm-share" onClick={() => { setAbierto(true); setResultado(null); setErrCrear(null); }}>
          Compartir {queSeComparte}
        </button>
      </div>

      {abierto && (
        <div className="bm-modal" role="dialog" aria-modal="true">
          <div className="bm-modal-in">
            <h3 className="bm-modal-h">Compartir {queSeComparte}</h3>

            <div className="bm-modos">
              <label className={`bm-modo${modo === 'link' ? ' on' : ''}`}>
                <input type="radio" name="modo" checked={modo === 'link'} onChange={() => setModo('link')} />
                <span><b>Cualquiera con el enlace</b><br /><small>Quien tenga el link entra, sin login.</small></span>
              </label>
              <label className={`bm-modo${modo === 'invitados' ? ' on' : ''}`}>
                <input type="radio" name="modo" checked={modo === 'invitados'} onChange={() => setModo('invitados')} />
                <span><b>Solo las personas que invite</b><br /><small>Cada una recibe su propio enlace por mail.</small></span>
              </label>
            </div>

            {modo === 'invitados' && (
              <textarea className="bm-emails" rows={3} value={emails} onChange={(e) => setEmails(e.target.value)}
                placeholder="nombre@gmail.com, otro@empresa.com" />
            )}

            {errCrear && <p className="bm-err">{errCrear}</p>}

            {resultado && (
              <div className="bm-res">
                {resultado.enlace && (
                  <>
                    <p className="bm-res-t">Listo. Copiá el enlace — <b>se muestra una sola vez</b>:</p>
                    <input className="bm-link" readOnly value={resultado.enlace} onFocus={(e) => e.currentTarget.select()} />
                  </>
                )}
                {!!resultado.invitados.length && (
                  <ul className="bm-invs">
                    {resultado.invitados.map((i) => (
                      <li key={i.email}>{i.enviado ? '✓ enviado a ' : '✖ no se pudo enviar a '}<b>{i.email}</b>{i.error ? ` — ${i.error}` : ''}</li>
                    ))}
                  </ul>
                )}
                <p className="bm-nota">Los videos se ven por Panda, que es público por su cuenta: revocar este enlace no corta el acceso a esos videos.</p>
              </div>
            )}

            <div className="bm-modal-pie">
              <button type="button" className="bm-cancel" onClick={() => setAbierto(false)}>{resultado ? 'Cerrar' : 'Cancelar'}</button>
              {!resultado && (
                <button type="button" className="bm-ok" onClick={crearLink} disabled={creando || (modo === 'invitados' && !emails.trim())}>
                  {creando ? 'Creando…' : 'Crear enlace'}
                </button>
              )}
            </div>
          </div>
        </div>
      )}

      {grupos.length > 1 && (
        <div className="bm-chips">
          <button type="button" className={`bm-chip${!grupo ? ' on' : ''}`} onClick={() => setGrupo(null)}>Todo</button>
          {grupos.map((g) => (
            <button key={g} type="button" className={`bm-chip${grupo === g ? ' on' : ''}`} onClick={() => setGrupo(g)}>{g}</button>
          ))}
        </div>
      )}

      {error && <p className="bm-vacio">No se pudo cargar el material: {error}</p>}
      {!assets && !error && <p className="bm-vacio">Cargando el material…</p>}

      <div className="bm-grid">
        {visibles.map((a) => (
          <figure key={a.id} className="bm-card">
            <div className="bm-media">
              {a.embed ? (
                <iframe src={a.embed} title={a.titulo} allow="autoplay; encrypted-media; picture-in-picture; fullscreen" allowFullScreen />
              ) : a.mime.startsWith('video') ? (
                <video src={`/api/branding/descargar?id=${encodeURIComponent(a.id)}`} muted loop playsInline autoPlay />
              ) : a.thumb ? (
                // eslint-disable-next-line @next/next/no-img-element
                <img src={a.thumb} alt={a.titulo} loading="lazy" />
              ) : (
                <span className="bm-sinprev">{a.archivo.split('.').pop()?.toUpperCase()}</span>
              )}
            </div>
            <figcaption className="bm-pie">
              <span className="bm-tit" title={a.titulo}>{a.titulo}</span>
              <span className="bm-meta">{a.archivo.split('.').pop()?.toUpperCase()} · {peso(a.bytes)}</span>
              <a className="bm-dl" href={`/api/branding/descargar?id=${encodeURIComponent(a.id)}`} download>Descargar</a>
            </figcaption>
          </figure>
        ))}
      </div>
      {assets && !visibles.length && <p className="bm-vacio">Todavía no hay nada en esta sección.</p>}

      <style jsx>{`
        .bm-tabs { display: flex; flex-wrap: wrap; gap: 8px; margin: 22px 0 10px; }
        .bm-tab { display: inline-flex; align-items: center; gap: 7px; padding: 9px 16px; border-radius: 10px; cursor: pointer;
          border: 1px solid var(--al-line, #2a2a2a); background: transparent; color: inherit; font-size: 14px; font-weight: 600; font-family: inherit; }
        .bm-tab.on { background: var(--al-accent, #C8F169); color: #101010; border-color: transparent; }
        .bm-tab-n { font-size: 11.5px; opacity: .62; font-variant-numeric: tabular-nums; }
        .bm-desc { margin: 2px 0 16px; font-size: 14px; opacity: .68; }
        .bm-chips { display: flex; flex-wrap: wrap; gap: 6px; margin-bottom: 18px; }
        .bm-chip { padding: 5px 12px; border-radius: 999px; cursor: pointer; font-size: 12.5px; font-family: inherit;
          border: 1px solid var(--al-line, #2a2a2a); background: transparent; color: inherit; opacity: .78; }
        .bm-chip.on { background: rgba(200,241,105,.14); border-color: var(--al-accent, #C8F169); opacity: 1; }
        .bm-grid { display: grid; grid-template-columns: repeat(auto-fill, minmax(232px, 1fr)); gap: 16px; margin-top: 6px; }
        .bm-card { margin: 0; border: 1px solid var(--al-line, #2a2a2a); border-radius: 13px; overflow: hidden; background: rgba(255,255,255,.02); }
        .bm-media { aspect-ratio: 16 / 10; background: #f4f6fa; display: grid; place-items: center; overflow: hidden; }
        .bm-media :global(img), .bm-media :global(video), .bm-media :global(iframe) { width: 100%; height: 100%; object-fit: contain; border: 0; display: block; }
        .bm-sinprev { font-size: 13px; font-weight: 700; color: #8a94a6; letter-spacing: .06em; }
        .bm-pie { display: flex; flex-direction: column; gap: 3px; padding: 11px 12px 12px; }
        .bm-tit { font-size: 13.5px; font-weight: 600; line-height: 1.3; overflow: hidden; text-overflow: ellipsis; white-space: nowrap; }
        .bm-meta { font-size: 11.5px; opacity: .55; }
        .bm-dl { margin-top: 7px; text-align: center; padding: 7px 10px; border-radius: 8px; font-size: 12.5px; font-weight: 600;
          text-decoration: none; background: var(--al-accent, #C8F169); color: #101010; }
        .bm-vacio { font-size: 14px; opacity: .6; padding: 22px 0; }
        .bm-acciones { margin: 4px 0 14px; }
        .bm-share { padding: 8px 16px; border-radius: 9px; cursor: pointer; font-size: 13.5px; font-weight: 600; font-family: inherit;
          border: 1px solid var(--al-accent, #C8F169); background: transparent; color: inherit; }
        .bm-modal { position: fixed; inset: 0; z-index: 90; background: rgba(8,10,14,.66); display: grid; place-items: center; padding: 20px; }
        .bm-modal-in { width: min(520px, 100%); background: #14161a; border: 1px solid #2a2d33; border-radius: 15px; padding: 22px; }
        .bm-modal-h { margin: 0 0 16px; font-size: 18px; font-weight: 700; }
        .bm-modos { display: flex; flex-direction: column; gap: 9px; }
        .bm-modo { display: flex; gap: 10px; align-items: flex-start; padding: 12px; border-radius: 10px; cursor: pointer;
          border: 1px solid #2a2d33; font-size: 13.5px; line-height: 1.45; }
        .bm-modo.on { border-color: var(--al-accent, #C8F169); background: rgba(200,241,105,.07); }
        .bm-modo small { opacity: .6; }
        .bm-emails { width: 100%; margin-top: 11px; padding: 10px 12px; border-radius: 9px; font-family: inherit; font-size: 13.5px;
          background: #0e1013; border: 1px solid #2a2d33; color: inherit; resize: vertical; }
        .bm-err { color: #ff8b8b; font-size: 13px; margin: 11px 0 0; }
        .bm-res { margin-top: 14px; }
        .bm-res-t { font-size: 13.5px; margin: 0 0 7px; }
        .bm-link { width: 100%; padding: 9px 11px; border-radius: 8px; font-family: ui-monospace, monospace; font-size: 12px;
          background: #0e1013; border: 1px solid var(--al-accent, #C8F169); color: inherit; }
        .bm-invs { margin: 11px 0 0; padding-left: 17px; font-size: 13px; line-height: 1.7; }
        .bm-nota { margin: 12px 0 0; font-size: 12px; opacity: .6; line-height: 1.5; }
        .bm-modal-pie { display: flex; justify-content: flex-end; gap: 9px; margin-top: 18px; }
        .bm-cancel, .bm-ok { padding: 9px 17px; border-radius: 9px; cursor: pointer; font-size: 13.5px; font-weight: 600; font-family: inherit; }
        .bm-cancel { background: transparent; border: 1px solid #2a2d33; color: inherit; }
        .bm-ok { background: var(--al-accent, #C8F169); border: 0; color: #101010; }
        .bm-ok:disabled { opacity: .45; cursor: not-allowed; }
      `}</style>
    </div>
  );
}
