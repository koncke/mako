'use client';

// =============================================================================
// Verticales — las miniaturas 9:16 de Thumbnails: las portadas de los reels que mejor rinden (13/11/2026)
// =============================================================================
// Martín, 13/11/2026 (por el Cerebro): «miniaturas verticales en Image, para shorts y reels, además de las horizontales de
// YouTube. Con plantillas y réplica de outliers verticales». Es la MISMA pantalla de Thumbnails (./Thumbnails.tsx) con
// «Horizontales · Verticales» en la fila de filtros (`tformato=vertical` en la URL): la misma grilla, el mismo «Editar», con su
// tarjeta 9:16. Lo puro (de dónde salen, cómo se ordenan): lib/thumbnails/verticales.ts. Salen de los reels que Spy YA trajo de
// las cuentas que el negocio sigue (se piden al elegir «Verticales»: /api/image-editor/explorador?que=verticales).
//
// «Editar» replica la portada con la IA del negocio (lib/carruseles/replica-servidor.ts, `que: 'vertical'`): la plancha del
// original sin su texto, los textos nuevos encima y, donde hay una persona, su lugar marcado para generarla con IA en el mismo
// estilo. Nunca la foto del negocio pegada (Martín, 12 y 13/11/2026).
// =============================================================================

import { useEffect, useMemo, useState } from 'react';
import { Modal } from '@/app/_ui/Modal';
import { ReportarASoporte } from '@/app/_ui/ReportarASoporte';
import { explicarMultiplo } from '@/lib/multiplo-rendimiento';
import { contadorCorto, nivelDeMultiplo, rotuloOutlier } from '@/lib/carruseles/explorar';
import { coincideVertical, type FormatoThumbnail, type Vertical } from '@/lib/thumbnails/verticales';
import { EditarCarrusel } from './EditarCarrusel';
import s from './explorar.module.css';

const DE_A = 40;

/** Lo que trajo la ruta. Queda en memoria de la pestaña: ir y volver entre «Horizontales» y «Verticales» no la vuelve a pedir. */
type Estado = { ok: true; lista: Vertical[] } | { ok: false; error: string } | null;
let enMemoria: Vertical[] | null = null;

/** «Horizontales · Verticales»: el mismo selector que «Carruseles · Anuncios · Thumbnails», en la fila de filtros. */
export function ElegirFormato({ formato, cambiar }: { formato: FormatoThumbnail; cambiar: (f: FormatoThumbnail) => void }) {
  return (
    <div className={s.segmento} role="radiogroup" aria-label="Formato de la miniatura">
      <button type="button" role="radio" aria-checked={formato === 'horizontal'} onClick={() => cambiar('horizontal')}>Horizontales</button>
      <button type="button" role="radio" aria-checked={formato === 'vertical'} onClick={() => cambiar('vertical')}>Verticales</button>
    </div>
  );
}

const haceCuanto = (iso: string | null, ahora: number): string => {
  const t = Date.parse(iso ?? '');
  if (!Number.isFinite(t)) return '';
  const d = Math.max(0, Math.floor((ahora - t) / 86_400_000));
  if (d === 0) return 'hoy';
  if (d === 1) return 'ayer';
  if (d < 30) return `hace ${d} días`;
  const m = Math.floor(d / 30);
  return m < 12 ? `hace ${m} ${m === 1 ? 'mes' : 'meses'}` : `hace ${Math.floor(m / 12)} ${m < 24 ? 'año' : 'años'}`;
};
const inicial = (n: string) => Array.from(n.trim())[0]?.toUpperCase() ?? '·';
const quienEs = (v: Vertical) => (v.creador.usuario ? `@${v.creador.usuario}` : v.creador.nombre);
const red = (v: Vertical) => (v.red === 'youtube' ? 'YouTube' : v.red === 'tiktok' ? 'TikTok' : 'Instagram');

/** La fila de filtros y la grilla de las verticales. `formato` es el selector; `segmento` y `botones`, los del explorador. */
export function PanelVerticales({ q, formato, ahora, telefono, segmento, botones }: {
  q: string;
  formato: React.ReactNode;
  ahora: number | null;
  telefono: boolean;
  segmento: React.ReactNode;
  botones: React.ReactNode;
}) {
  const [estado, setEstado] = useState<Estado>(enMemoria ? { ok: true, lista: enMemoria } : null);
  const [vuelta, setVuelta] = useState(0);
  const [cuantas, setCuantas] = useState(DE_A);
  const [editando, setEditando] = useState<Vertical | null>(null);
  const [abierta, setAbierta] = useState<Vertical | null>(null);

  useEffect(() => {
    if (enMemoria && vuelta === 0) return;
    let vivo = true;
    void (async () => {
      try {
        const res = await fetch('/api/image-editor/explorador?que=verticales', { cache: 'no-store' });
        const r = (await res.json().catch(() => null)) as { ok?: boolean; verticales?: Vertical[]; error?: string } | null;
        if (!vivo) return;
        if (r?.ok && Array.isArray(r.verticales)) { enMemoria = r.verticales; setEstado({ ok: true, lista: r.verticales }); }
        else setEstado({ ok: false, error: r?.error || 'No pude leer las miniaturas verticales.' });
      } catch {
        if (vivo) setEstado({ ok: false, error: 'No pude leer las miniaturas verticales. Revisa la conexión.' });
      }
    })();
    return () => { vivo = false; };
  }, [vuelta]);

  const vistos = useMemo(() => (estado && estado.ok ? estado.lista.filter((v) => coincideVertical(v, q)) : []), [estado, q]);
  const listos = vistos.slice(0, cuantas);

  return (
    <>
      <div className={s.filtros}>
        {segmento}
        {telefono ? botones : null}
        {formato}
        <span className={s.espacio} />
        {telefono || !estado || !estado.ok ? null : <span className={s.total}>{contadorCorto(vistos.length)} {vistos.length === 1 ? 'miniatura' : 'miniaturas'}</span>}
      </div>

      {!estado ? (
        <div className={s.vacio}><p>Trayendo las portadas de los reels…</p></div>
      ) : !estado.ok ? (
        <div className={s.vacio} role="alert">
          <p>{estado.error}</p>
          <button type="button" className={s.boton} onClick={() => { setEstado(null); setVuelta((n) => n + 1); }}>Volver a intentar</button>
          <ReportarASoporte />
        </div>
      ) : !estado.lista.length ? (
        <div className={s.vacio}>
          <p>Las portadas de los reels que mejor les funcionan a las cuentas que sigues aparecen aquí. Sigue a tus competidores en Competitors Spy y trae sus reels.</p>
          <a className={s.boton} href="/competitor-spy?ver=seguidos">Ir a Competitors Spy</a>
        </div>
      ) : !vistos.length ? (
        <div className={s.vacio}><p>Ninguna portada tiene esas palabras.</p></div>
      ) : (
        <>
          <ul className={`${s.grilla} ${s.grillaVertical}`} aria-label="Miniaturas verticales">
            {listos.map((v) => (
              <TarjetaVertical key={v.id} v={v} ahora={ahora} telefono={telefono} onEditar={() => setEditando(v)} onAbrir={() => setAbierta(v)} />
            ))}
          </ul>
          {vistos.length > cuantas && <button type="button" className={s.mas} onClick={() => setCuantas((n) => n + DE_A)}>Ver más</button>}
        </>
      )}

      {abierta ? (
        <VerticalAbierta v={abierta} ahora={ahora} telefono={telefono} onCerrar={() => setAbierta(null)}
          onEditar={() => { const v = abierta; setAbierta(null); setEditando(v); }} />
      ) : null}
      {editando ? <EditarCarrusel key={`v${editando.id}`} vertical={editando} onCerrar={() => setEditando(null)} /> : null}
    </>
  );
}

/** La tarjeta 9:16: la portada, el múltiplo, el gancho, la cuenta, las vistas y «Editar». */
export function TarjetaVertical({ v, ahora, telefono, onEditar, onAbrir }: {
  v: Vertical; ahora: number | null; telefono: boolean; onEditar: () => void; onAbrir: () => void;
}) {
  const nivel = nivelDeMultiplo(v.veces);
  return (
    <li className={s.tarjeta}>
      {/* Tocar la portada la abre grande; «Editar» es el botón: abrirla no gasta la IA de nadie. */}
      <div className={`${s.mini} ${s.mini916}`} onClick={(e) => { if (!(e.target as HTMLElement).closest('button, a')) onAbrir(); }}>
        {/* eslint-disable-next-line @next/next/no-img-element */}
        <img className={s.miniImagen} src={v.miniatura} alt={v.titulo ? `Portada: ${v.titulo.slice(0, 80)}` : 'Portada del reel'} loading="lazy" referrerPolicy="no-referrer" draggable={false} />
        <span className={s.sobreImagen}>
          <button type="button" className={s.editar} onClick={onEditar}>Editar</button>
        </span>
      </div>
      <div className={s.pie}>
        <div className={s.fila1}>
          {v.veces != null && nivel ? <span className={s.mult} data-nivel={nivel} title={v.multiplo ? explicarMultiplo(v.multiplo) : undefined}>{rotuloOutlier(v.veces)}</span> : null}
          {v.titulo ? <a className={s.gancho} href={v.url} target={telefono ? undefined : '_blank'} rel="noopener noreferrer" title={`Ver en ${red(v)}`}>{v.titulo}</a> : null}
        </div>
        <div className={s.creador}>
          {v.creador.foto
            // eslint-disable-next-line @next/next/no-img-element
            ? <img src={v.creador.foto} alt="" className={s.cara} referrerPolicy="no-referrer" />
            : <span className={s.cara} aria-hidden>{inicial(v.creador.nombre)}</span>}
          <span className={s.quien}>{quienEs(v)}</span>
          {ahora != null && v.publicada ? <span className={s.cuando}>{haceCuanto(v.publicada, ahora)}</span> : null}
        </div>
        <div className={s.datos}>
          {v.vistas != null ? <span title={`Vistas en ${red(v)}`}>{contadorCorto(v.vistas)} vistas</span> : null}
          <a className={s.yt} href={v.url} target={telefono ? undefined : '_blank'} rel="noopener noreferrer">Ver en {red(v)}</a>
        </div>
        <button type="button" className={s.editarLiviano} onClick={onEditar}>Editar</button>
      </div>
    </li>
  );
}

/** La portada grande: para mirarla antes de «Editar», con su cuenta, sus vistas y el link al reel. */
function VerticalAbierta({ v, ahora, telefono, onCerrar, onEditar }: {
  v: Vertical; ahora: number | null; telefono: boolean; onCerrar: () => void; onEditar: () => void;
}) {
  const nivel = nivelDeMultiplo(v.veces);
  return (
    <Modal titulo={v.titulo || 'Miniatura vertical'} encabezado={quienEs(v)} onCerrar={onCerrar} ancho={560} completaEnCelular
      pie={(
        <>
          <a className={s.secundario} href={v.url} target={telefono ? undefined : '_blank'} rel="noopener noreferrer">Ver en {red(v)}</a>
          <button type="button" className={s.primario} onClick={onEditar}><strong>Editar</strong></button>
        </>
      )}>
      <div className={s.abiertaVertical}>
        {/* eslint-disable-next-line @next/next/no-img-element */}
        <img src={v.miniatura} alt={v.titulo ? `Portada: ${v.titulo.slice(0, 80)}` : 'Portada del reel'} referrerPolicy="no-referrer" />
        <div className={s.datos}>
          {v.veces != null && nivel ? <span className={s.mult} data-nivel={nivel} title={v.multiplo ? explicarMultiplo(v.multiplo) : undefined}>{rotuloOutlier(v.veces)}</span> : null}
          {v.vistas != null ? <span>{contadorCorto(v.vistas)} vistas</span> : null}
          {ahora != null && v.publicada ? <span>{haceCuanto(v.publicada, ahora)}</span> : null}
        </div>
      </div>
    </Modal>
  );
}
