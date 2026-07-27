'use client';

// Galería que ve quien recibió el link. Autocontenida a propósito: no usa el
// chrome de la app (sidebar, campanita, toasts) porque el visitante no tiene
// sesión y no debe ver ni los nombres de las tabs internas.

import { useMemo, useState } from 'react';

type Asset = {
  id: string; seccion: string; grupo: string; archivo: string;
  titulo: string; mime: string; bytes: number; embed: string | null;
};

const peso = (b: number) => (b > 1048576 ? `${(b / 1048576).toFixed(1)} MB` : `${Math.round(b / 1024)} KB`);
const LABEL: Record<string, string> = { graficos: 'Gráficos', animaciones: 'Animaciones', iconos: 'Íconos y logos', videos: 'Videos' };

export default function Galeria({ token, etiqueta, invitado, assets }: {
  token: string; etiqueta: string | null; invitado: string | null; assets: Asset[];
}) {
  const secciones = useMemo(() => [...new Set(assets.map((a) => a.seccion))], [assets]);
  const [sec, setSec] = useState(secciones[0] ?? 'graficos');
  const visibles = useMemo(() => assets.filter((a) => a.seccion === sec), [assets, sec]);
  const url = (a: Asset, v: 'thumb' | 'full') => `/api/compartido/archivo?t=${encodeURIComponent(token)}&id=${encodeURIComponent(a.id)}&v=${v}`;

  return (
    <main className="cs-root">
      <header className="cs-hd">
        <div className="cs-brand">
          <span className="cs-mark">
            <svg width="19" height="19" viewBox="-12 -12 24 24" aria-hidden="true">
              <path d="M0 -11 C1.5 -4.5 4.5 -1.5 11 0 C4.5 1.5 1.5 4.5 0 11 C-1.5 4.5 -4.5 1.5 -11 0 C-4.5 -1.5 -1.5 -4.5 0 -11 Z" fill="#F2B01E" />
            </svg>
          </span>
          <span className="cs-word">MaKo</span>
        </div>
        <h1 className="cs-h1">{etiqueta || 'Material de marca'}</h1>
        <p className="cs-sub">
          {assets.length} {assets.length === 1 ? 'pieza' : 'piezas'} · cada una se descarga
          {invitado && <> · compartido con <b>{invitado}</b></>}
        </p>
      </header>

      {secciones.length > 1 && (
        <nav className="cs-tabs">
          {secciones.map((s) => (
            <button key={s} type="button" className={`cs-tab${sec === s ? ' on' : ''}`} onClick={() => setSec(s)}>
              {LABEL[s] || s}
            </button>
          ))}
        </nav>
      )}

      <div className="cs-grid">
        {visibles.map((a) => (
          <figure key={a.id} className="cs-card">
            <div className="cs-media">
              {a.embed ? (
                <iframe src={a.embed} title={a.titulo} allow="autoplay; encrypted-media; picture-in-picture; fullscreen" allowFullScreen />
              ) : a.mime.startsWith('video') ? (
                <video src={url(a, 'full')} muted loop playsInline autoPlay />
              ) : (
                // eslint-disable-next-line @next/next/no-img-element
                <img src={url(a, 'thumb')} alt={a.titulo} loading="lazy" />
              )}
            </div>
            <figcaption className="cs-pie">
              <span className="cs-tit" title={a.titulo}>{a.titulo}</span>
              <span className="cs-meta">{a.archivo.split('.').pop()?.toUpperCase()} · {peso(a.bytes)}</span>
              <a className="cs-dl" href={url(a, 'full')} download>Descargar</a>
            </figcaption>
          </figure>
        ))}
      </div>

      <footer className="cs-ft">Material de marca de MaKo · enlace privado</footer>

      <style jsx>{`
        .cs-root { min-height: 100vh; background: #fafbfd; color: #171A21; padding: 40px 24px 60px;
          font-family: 'Geist', system-ui, -apple-system, sans-serif; }
        .cs-hd { max-width: 1100px; margin: 0 auto 26px; }
        .cs-brand { display: flex; align-items: center; gap: 8px; margin-bottom: 18px; }
        .cs-mark { width: 32px; height: 32px; border-radius: 9px; background: #1A1712; display: grid; place-items: center; }
        .cs-word { font-weight: 700; font-size: 21px; letter-spacing: -.02em; }
        .cs-h1 { font-size: 31px; font-weight: 700; letter-spacing: -.02em; margin: 0 0 6px; }
        .cs-sub { margin: 0; color: #6b7488; font-size: 14.5px; }
        .cs-tabs { max-width: 1100px; margin: 0 auto 20px; display: flex; flex-wrap: wrap; gap: 8px; }
        .cs-tab { padding: 8px 16px; border-radius: 9px; border: 1px solid #e4e9f2; background: #fff; cursor: pointer;
          font-size: 14px; font-weight: 600; font-family: inherit; color: #48505E; }
        .cs-tab.on { background: #2F6FED; border-color: #2F6FED; color: #fff; }
        .cs-grid { max-width: 1100px; margin: 0 auto; display: grid; grid-template-columns: repeat(auto-fill, minmax(238px, 1fr)); gap: 16px; }
        .cs-card { margin: 0; background: #fff; border: 1px solid #e9edf4; border-radius: 13px; overflow: hidden;
          box-shadow: 0 2px 12px -8px rgba(20,24,40,.28); }
        .cs-media { aspect-ratio: 16 / 10; background: #f2f5fa; display: grid; place-items: center; overflow: hidden; }
        .cs-media :global(img), .cs-media :global(video), .cs-media :global(iframe) { width: 100%; height: 100%; object-fit: contain; border: 0; display: block; }
        .cs-pie { display: flex; flex-direction: column; gap: 3px; padding: 11px 12px 12px; }
        .cs-tit { font-size: 13.5px; font-weight: 600; overflow: hidden; text-overflow: ellipsis; white-space: nowrap; }
        .cs-meta { font-size: 11.5px; color: #8a94a6; }
        .cs-dl { margin-top: 8px; text-align: center; padding: 8px 10px; border-radius: 8px; font-size: 12.5px;
          font-weight: 600; text-decoration: none; background: #2F6FED; color: #fff; }
        .cs-ft { max-width: 1100px; margin: 40px auto 0; color: #9aa3b4; font-size: 12.5px; text-align: center; }
      `}</style>
    </main>
  );
}
