'use client';

// =============================================================================
// El detalle de una pieza del competidor, con «Copiar estructura» (puntos 7 y 9 del 4/11/2026)
// =============================================================================
// Lo abre tocar una miniatura del gráfico (GraficoSpy.tsx). Copiado del video que mandó Martín (docs/diseno-competitors-spy.md
// §15): el video a la izquierda, a la derecha su puesto («#51 de 420»), sus números, su estructura y su texto; abajo, «Copiar
// estructura».
//
// Martín, 4/11: «si se selecciona un reel, un YT, un carrusel, o una web, debería fácilmente estar el botón de "Copiar
// estructura", y que lo procese en todas las herramientas que ya tenemos en MaKo». Va a /api/competitor-spy/copiar, que
// arma una página del Copywriter con su estructura y su texto citado; quien no tiene el Copywriter se lleva el texto copiado.
//
// ⚠️ SIN INVENTAR: «Anatomía del guion» y la curva de «siguen mirando» del video NO van. El guion de un video ajeno no se lee
// (no hay forma legal de transcribirlo) y la retención no la publica nadie: un bloque sin datos no se dibuja ni dice «falta».
// Lo que sí hay: su gancho, su ángulo y su formato, que lee la IA del negocio sola; mientras no los leyó, «Analizando…».

import { useState } from 'react';
import { Icon } from '../_components/icons';
import { BrandDefs } from '../_components/ServicioVisual';
import { LogoRed, redDePieza } from './LogoRed';
import { Modal } from '@/app/_ui/Modal';
import { useRouter } from '@/app/_ui/Link';
import { ReportarASoporte } from '@/app/_ui/ReportarASoporte';
import { FORMATOS, puestoDe } from '@/lib/spy-detalle';
import { dibujarContador } from '@/lib/spy-reglas';
import { fechaCorta, miniaturaDePieza } from '@/lib/spy-vista';
import type { PiezaVista } from './actions';

const CSS = `
.spyd{display:grid;grid-template-columns:minmax(0,1fr) minmax(0,1.1fr);gap:20px}
.spyd-media{position:relative;border-radius:14px;overflow:hidden;background:#23252B;aspect-ratio:9/16;max-height:62vh}
.spyd-media[data-ancho=true]{aspect-ratio:16/9}
.spyd-media iframe,.spyd-media img{position:absolute;inset:0;width:100%;height:100%;border:0;object-fit:cover}
.spyd-media p{position:absolute;inset:0;margin:0;padding:18px;color:#fff;font-size:14px;line-height:1.4;overflow:auto}
.spyd-info{display:flex;flex-direction:column;gap:14px;min-width:0}
.spyd-nums{display:flex;gap:8px;flex-wrap:wrap}
.spyd-num{padding:8px 12px;border:1px solid var(--border);border-radius:12px;background:var(--surface)}
.spyd-num span{display:block;font-size:11px;color:var(--dim)}
.spyd-num b{font-size:17px;font-variant-numeric:tabular-nums;color:var(--ink)}
.spyd-bloque h4{margin:0 0 6px;font-size:12px;font-weight:600;letter-spacing:.05em;text-transform:uppercase;color:var(--dim)}
.spyd-dato{margin:0 0 4px;font-size:14px;color:var(--ink);line-height:1.4}
.spyd-dato b{font-weight:600}
.spyd-tags{display:flex;gap:6px;flex-wrap:wrap}
.spyd-tags span{padding:3px 9px;border-radius:99px;background:var(--surface-2,var(--surface));border:1px solid var(--border);font-size:12px;color:var(--dim)}
.spyd-texto{max-height:180px;overflow:auto;margin:0;font-size:13.5px;line-height:1.5;color:var(--ink);white-space:pre-wrap}
.spyd-vivo{display:inline-flex;align-items:center;gap:6px;font-size:13px;color:var(--dim)}
.spyd-vivo i{width:7px;height:7px;border-radius:50%;background:var(--primary);animation:spydLatido 1.1s ease-in-out infinite}
@keyframes spydLatido{50%{opacity:.25}}
@media (prefers-reduced-motion:reduce){.spyd-vivo i{animation:none}}
.spyd-red{display:inline-flex;align-items:center;gap:8px}
@media (max-width:720px){.spyd{grid-template-columns:1fr}.spyd-media{max-height:48vh}}
`;

const RED: Record<string, string> = { instagram: 'Instagram', youtube: 'YouTube', anuncios: 'la Biblioteca de Anuncios' };

/** Los hashtags de su texto, sin repetir, hasta 12. */
const hashtagsDe = (t: string | null): string[] => [...new Set((t ?? '').match(/#[\p{L}\p{N}_]+/gu) ?? [])].slice(0, 12);

export function DetallePieza({ p, nombre, todas, analizando, onCerrar }: {
  p: PiezaVista;
  /** El nombre del competidor. */
  nombre: string;
  /** Las piezas del gráfico, para su puesto («#51 de 420»). */
  todas: readonly PiezaVista[];
  analizando: boolean;
  onCerrar: () => void;
}) {
  const router = useRouter();
  const [copiando, setCopiando] = useState(false);
  const [copiada, setCopiada] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const puesto = puestoDe(p.id, todas);
  const mini = miniaturaDePieza(p);
  const esVideoYt = p.canal === 'youtube' && /^[\w-]{11}$/.test(p.ref);
  const a = p.analisis;
  const leida = !!(a && (a.gancho || a.angulo));
  const formato = a?.formato ? FORMATOS.find((f) => f.value === a.formato && f.value !== 'otro')?.label ?? null : null;
  const tags = hashtagsDe(p.texto);
  const numeros = [
    p.vistas != null ? { k: 'Vistas', v: dibujarContador(p.vistas) } : null,
    p.megusta != null ? { k: 'Me gusta', v: dibujarContador(p.megusta) } : null,
    p.comentarios != null ? { k: 'Comentarios', v: dibujarContador(p.comentarios) } : null,
    p.publicada_en ? { k: 'Publicado', v: fechaCorta(p.publicada_en) } : null,
  ].filter((x): x is { k: string; v: string } => !!x);

  const copiar = async () => {
    setCopiando(true); setError(null); setCopiada(false);
    try {
      const r = await fetch('/api/competitor-spy/copiar', {
        method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify({ piezaId: p.id }),
      });
      const j = (await r.json().catch(() => null)) as { ok?: boolean; href?: string; texto?: string; error?: string } | null;
      if (j?.href) { router.push(j.href); return; }
      if (j?.texto) {
        // Sin el Copywriter (o si no se pudo crear la página), el texto se lleva copiado: el botón sirve igual.
        await navigator.clipboard.writeText(j.texto);
        setCopiada(true);
        return;
      }
      setError(j?.error ?? 'No pude copiar su estructura.');
    } catch {
      setError('No pude copiar su estructura. Revisa tu conexión y vuelve a intentar.');
    } finally {
      setCopiando(false);
    }
  };

  return (
    <Modal
      titulo={p.titulo || a?.gancho || `Una pieza de ${nombre}`}
      encabezado={(
        <span className="spyd-red">
          {redDePieza(p.canal) && <LogoRed red={redDePieza(p.canal)!} box={16} />}
          {[RED[p.canal], puesto].filter(Boolean).join(' · ')}
        </span>
      )}
      ancho={900}
      alto="min(88vh, 760px)"
      onCerrar={onCerrar}
      pie={(
        <>
          {copiada && <span className="spyd-vivo" aria-live="polite">Copiada</span>}
          {p.url && <a className="mk-btn" href={p.url} target="_blank" rel="noreferrer noopener">{redDePieza(p.canal) && <LogoRed red={redDePieza(p.canal)!} box={16} />}Ver en {RED[p.canal] ?? 'su red'}</a>}
          <button type="button" className="mk-btn mk-btn--primary" disabled={copiando} onClick={() => void copiar()}>
            <Icon name="copy" size={14} /> {copiando ? 'Copiando…' : 'Copiar estructura'}
          </button>
        </>
      )}
    >
      <style>{CSS}</style>
      <BrandDefs />
      <div className="spyd">
        <div className="spyd-media" data-ancho={esVideoYt}>
          {esVideoYt
            ? <iframe src={`https://www.youtube-nocookie.com/embed/${encodeURIComponent(p.ref)}?rel=0&playsinline=1`} title={p.titulo ?? 'Video'} allow="fullscreen; picture-in-picture; encrypted-media" allowFullScreen loading="lazy" />
            : (
              <>
                {p.texto && <p>{p.texto}</p>}
                {/* eslint-disable-next-line @next/next/no-img-element -- la sirve el CDN del canal; sin referrer, Meta contesta 403 */}
                {mini && <img src={mini} alt="" referrerPolicy="no-referrer" onError={(e) => { e.currentTarget.remove(); }} />}
              </>
            )}
        </div>
        <div className="spyd-info">
          {numeros.length > 0 && (
            <div className="spyd-nums">
              {numeros.map((n) => <div key={n.k} className="spyd-num"><span>{n.k}</span><b>{n.v}</b></div>)}
            </div>
          )}
          {/* Sin leer y sin la IA leyendo, el bloque no va: un bloque vacío no dice «falta». */}
          {(leida || analizando) && (
            <section className="spyd-bloque">
              <h4>Su estructura</h4>
              {leida ? (
                <>
                  {a?.gancho && <p className="spyd-dato"><b>Gancho:</b> {a.gancho}</p>}
                  {a?.angulo && <p className="spyd-dato"><b>Ángulo:</b> {a.angulo}</p>}
                  {formato && <p className="spyd-dato"><b>Formato:</b> {formato}</p>}
                </>
              ) : <span className="spyd-vivo" aria-live="polite"><i />Analizando…</span>}
            </section>
          )}
          {tags.length > 0 && <div className="spyd-tags">{tags.map((t) => <span key={t}>{t}</span>)}</div>}
          {p.texto && esVideoYt && (
            <section className="spyd-bloque">
              <h4>Su descripción</h4>
              <p className="spyd-texto">{p.texto}</p>
            </section>
          )}
          {error && <p className="spy-aviso spy-error" role="alert">{error}<ReportarASoporte error={error} accion="Copiar estructura en Competitors Spy" /></p>}
        </div>
      </div>
    </Modal>
  );
}
