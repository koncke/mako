'use client';
// =============================================================================
// El mapa de calor sobre la FOTO de una grabación — el respaldo del mapa en vivo
// =============================================================================
// Donde la página no se deja meter en un marco (la de MaKo manda X-Frame-Options DENY) o no hay puente (un Pixel
// anterior a la v21, o el puente no contestó), el fondo es la foto completa que guardó una grabación
// (lib/landing-mapa-foto.ts): el DOM que vio la gente, sin un script, con la hoja del cliente arreglada para que no
// la bloquee CORS y un cartel en cada marco o video. Es NUESTRO documento (`srcdoc`, mismo origen), así que cada
// posición se lee del DOM de la foto, como siempre.
//
// La pantalla del aparato mide la ventana de quien grabó (`fondo.ancho` × `fondo.alto`) y adentro se scrollea la
// página entera. La foto se elige del ancho más común entre los toques (`anchoMasComun`).
// =============================================================================

import { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import { Spinner } from '@/app/_ui';
import { ubicarPorAncla, ubicarPorPunto, type Dispositivo, type ToqueMapa } from '@/lib/landing-mapa';
import { anchoMasComun } from '@/lib/landing-mapa-foto';
import type { FondoDelMapa } from '@/lib/landing-mapa-server';
import { MarcoDispositivo, type Tamano } from './MapaCalorMarco';
import { pintarCalor } from './MapaCalorPiezas';

/** Lo que la tarjeta dice del fondo (el rótulo del modo y, sin foto, por qué). */
export type InfoFoto = { estado: 'cargando' } | { estado: 'ok'; grabada: string } | { estado: 'sin' };

export function MapaCalorFoto({ url, disp, toques, resaltado, caja, onInfo }: {
  url: string;
  disp: Dispositivo;
  toques: readonly ToqueMapa[];
  resaltado: string | null;
  caja: Tamano;
  onInfo?: (i: InfoFoto) => void;
}) {
  const ancho = useMemo(() => anchoMasComun(toques.map((t) => t.vw)), [toques]);
  const clave = `url=${encodeURIComponent(url)}&disp=${disp}${ancho ? `&ancho=${ancho}` : ''}`;
  const [fondo, setFondo] = useState<{ clave: string; f: FondoDelMapa } | null>(null);
  const info = useRef(onInfo);
  useEffect(() => { info.current = onInfo; }, [onInfo]);

  useEffect(() => {
    let vivo = true;
    fetch(`/api/landing-analyst/mapa/fondo?${clave}`)
      .then((r) => r.json())
      .then((j) => { if (vivo) setFondo({ clave, f: j?.ok ? (j.fondo as FondoDelMapa) : { ok: false, motivo: 'sin_foto' } }); })
      .catch(() => { if (vivo) setFondo({ clave, f: { ok: false, motivo: 'sin_foto' } }); });
    return () => { vivo = false; };
  }, [clave]);
  const f = fondo?.clave === clave ? fondo.f : null;
  useEffect(() => { info.current?.(!f ? { estado: 'cargando' } : f.ok ? { estado: 'ok', grabada: f.grabada } : { estado: 'sin' }); }, [f]);

  // ── La foto, medida ───────────────────────────────────────────────────────────────────
  const iframeRef = useRef<HTMLIFrameElement>(null);
  const canvasRef = useRef<HTMLCanvasElement>(null);
  const [altoDoc, setAltoDoc] = useState(0);
  // Cada carga cuenta: antes de cargar, el iframe es un documento vacío y ningún selector encuentra nada.
  const [cargas, setCargas] = useState(0);
  const W = f?.ok ? f.ancho : 0;
  const H = altoDoc || (f?.ok ? f.alto : 0);
  const medir = useCallback(() => {
    const doc = iframeRef.current?.contentDocument;
    if (!doc?.documentElement) return;
    const h = Math.max(doc.documentElement.scrollHeight, doc.body?.scrollHeight ?? 0);
    if (h > 0) setAltoDoc(h);
  }, []);
  const elementoDe = useCallback((sel: string): Element | null => {
    const doc = iframeRef.current?.contentDocument;
    if (!doc) return null;
    try { return doc.querySelector(sel); } catch { return null; }
  }, []);

  useEffect(() => {
    const canvas = canvasRef.current;
    if (!canvas || !f?.ok || !W || !H) return;
    canvas.width = W; canvas.height = H;
    const puntos: Array<{ x: number; y: number }> = [];
    for (const t of toques) {
      let p: { x: number; y: number } | null = null;
      if (t.sel && t.rx != null && t.ry != null) {
        const el = elementoDe(t.sel);
        if (el) p = ubicarPorAncla(t, el.getBoundingClientRect());
      }
      if (!p) p = ubicarPorPunto(t, W, H, disp);
      if (p) puntos.push(p);
    }
    pintarCalor(canvas, puntos, disp === 'movil' ? 22 : 30);
  }, [toques, f, W, H, disp, elementoDe, cargas]);

  const cajaResaltada = useMemo(() => {
    if (!resaltado || !cargas) return null;
    const r = elementoDe(resaltado)?.getBoundingClientRect();
    return r && r.width > 0 ? { left: r.left, top: r.top, width: r.width, height: r.height } : null;
  }, [resaltado, elementoDe, cargas, altoDoc]); // eslint-disable-line react-hooks/exhaustive-deps

  if (!f) return <div style={{ display: 'grid', placeItems: 'center', width: caja.w, height: caja.h }}><Spinner size={22} /></div>;
  if (!f.ok) {
    return (
      <div style={{ display: 'grid', placeItems: 'center', width: caja.w, height: caja.h, color: 'var(--faint)', fontSize: 15, textAlign: 'center', padding: 12 }}>
        Sin una foto de esta página
      </div>
    );
  }
  return (
    <MarcoDispositivo disp={disp} pantalla={{ ancho: f.ancho, alto: f.alto }} url={url} caja={caja}>
      {/* La pantalla scrollea la página entera; el iframe y el calor van en la MISMA capa, sin escala propia. */}
      <div className="lk-no-arrastrar" style={{ position: 'absolute', inset: 0, overflowY: 'auto', overflowX: 'hidden', overscrollBehavior: 'contain' }}>
        <div style={{ position: 'relative', width: W, height: H }}>
          <iframe ref={iframeRef} title="Foto de la página" srcDoc={f.html} sandbox="allow-same-origin" tabIndex={-1}
            onLoad={() => { medir(); setCargas((n) => n + 1); iframeRef.current?.contentDocument?.fonts?.ready.then(medir).catch(() => {}); }}
            style={{ position: 'absolute', left: 0, top: 0, width: W, height: H, border: 'none', pointerEvents: 'none', background: '#ffffff' }} />
          <canvas ref={canvasRef} aria-hidden style={{ position: 'absolute', left: 0, top: 0, width: W, height: H, pointerEvents: 'none' }} />
          {cajaResaltada && <div aria-hidden style={{ position: 'absolute', left: cajaResaltada.left - 4, top: cajaResaltada.top - 4, width: cajaResaltada.width + 8, height: cajaResaltada.height + 8, border: '3px solid var(--primary)', borderRadius: 8, pointerEvents: 'none' }} />}
        </div>
      </div>
    </MarcoDispositivo>
  );
}
