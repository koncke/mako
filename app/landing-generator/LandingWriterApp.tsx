'use client';

// =============================================================================
// LandingWriterApp — MaKo escribe la landing
// =============================================================================
// Izquierda: el pedido (qué página, para qué objetivo, sobre cuál landing ya
// diagnosticada). Derecha: la propuesta, bloque por bloque, con copy terminado
// que se copia y se pega.
//
// El enganche que importa: si venís desde el Landing Analyst con ?url=…, el
// diagnóstico de ESA página entra al prompt y la propuesta nace resolviendo sus
// hallazgos. Por eso el selector "Sobre cuál" no es un adorno.
// =============================================================================

import { useCallback, useEffect, useRef, useState, type CSSProperties } from 'react';
import { useSearchParams } from 'next/navigation';
import { useRouter } from '@/app/_ui/Link';
import Link from '@/app/_ui/Link';
import { Icon } from '../_components/icons';
import { MakoLogo } from '../_components/MakoBrand';
import { Dropdown } from '../components/Dropdown';
import {
  OBJETIVOS_LANDING, TIPO_LABEL, objetivoLabel, specAMarkdown,
  type LandingSpec, type ObjetivoLanding,
} from '@/lib/landing-spec';

const MONO = "'Geist Mono', monospace";
const SANS = "'Geist', sans-serif";

const card: CSSProperties = { background: 'var(--surface)', border: '1px solid var(--border)', borderRadius: 14, padding: 20 };
const eyebrow: CSSProperties = { fontFamily: MONO, fontSize: 10.5, letterSpacing: '.14em', textTransform: 'uppercase', color: 'var(--faint)' };
const btnPrimario: CSSProperties = { padding: '11px 20px', fontSize: 14, fontWeight: 600, fontFamily: SANS, border: 'none', borderRadius: 10, cursor: 'pointer', background: 'var(--primary)', color: '#fff' };
const btnSuave: CSSProperties = { padding: '9px 15px', fontSize: 13, fontWeight: 600, fontFamily: SANS, border: '1px solid var(--border-strong)', borderRadius: 10, cursor: 'pointer', background: 'var(--surface)', color: 'var(--ink)' };
const areaTexto: CSSProperties = { width: '100%', minHeight: 118, padding: '12px 14px', fontSize: 14, fontFamily: SANS, lineHeight: 1.55, border: '1px solid var(--border-strong)', borderRadius: 10, background: 'var(--surface)', color: 'var(--ink)', resize: 'vertical' };

function hostDe(url: string): string {
  try { const u = new URL(url); return u.hostname.replace(/^www\./, '') + (u.pathname === '/' ? '' : u.pathname); } catch { return url; }
}

export type LandingAnalizada = { url: string; veredicto: string | null; score: number | null };
export type DraftResumen = { id: number; titulo: string | null; pedido: string; created_at: string; spec: LandingSpec };

export function LandingWriterApp({
  analizadas, drafts, errorMsg,
}: { analizadas: LandingAnalizada[]; drafts: DraftResumen[]; errorMsg: string | null }) {
  const router = useRouter();
  const sp = useSearchParams();

  const [pedido, setPedido] = useState('');
  const [objetivo, setObjetivo] = useState<ObjetivoLanding>('agendar');
  const [base, setBase] = useState('');
  const [spec, setSpec] = useState<LandingSpec | null>(null);
  const [instruccion, setInstruccion] = useState('');
  const [estado, setEstado] = useState<'listo' | 'generando' | 'ajustando' | 'guardando'>('listo');
  const [aviso, setAviso] = useState<{ tono: 'bad' | 'good'; texto: string } | null>(null);
  const [copiado, setCopiado] = useState(false);

  // Deep link desde el Landing Analyst: /landing-writer?url=<landing analizada>.
  // Se aplica UNA sola vez. Antes dependía de `analizadas`, que es un array nuevo
  // en cada render del server component, así que el efecto volvía a correr en
  // cada router.refresh() y le pisaba al usuario la página que había elegido a
  // mano en el selector.
  const deepLinkAplicado = useRef(false);
  useEffect(() => {
    if (deepLinkAplicado.current) return;
    const u = sp.get('url');
    if (u && analizadas.some((a) => a.url === u)) { setBase(u); deepLinkAplicado.current = true; }
  }, [sp, analizadas]);

  const ocupado = estado !== 'listo';

  const generar = useCallback(async () => {
    if (!pedido.trim()) return;
    setEstado('generando'); setAviso(null);
    try {
      const r = await fetch('/api/landing-writer', {
        method: 'POST', headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ accion: 'generar', pedido, objetivo, basadoEnUrl: base || null }),
      });
      const j = await r.json();
      if (!j.ok) throw new Error(j.error || 'MaKo no pudo escribir la página.');
      setSpec(j.spec);
    } catch (e) { setAviso({ tono: 'bad', texto: e instanceof Error ? e.message : String(e) }); }
    finally { setEstado('listo'); }
  }, [pedido, objetivo, base]);

  const ajustar = useCallback(async () => {
    if (!spec || !instruccion.trim()) return;
    setEstado('ajustando'); setAviso(null);
    try {
      const r = await fetch('/api/landing-writer', {
        method: 'POST', headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ accion: 'ajustar', spec, instruccion }),
      });
      const j = await r.json();
      if (!j.ok) throw new Error(j.error || 'No se pudo aplicar el cambio.');
      setSpec(j.spec); setInstruccion('');
    } catch (e) { setAviso({ tono: 'bad', texto: e instanceof Error ? e.message : String(e) }); }
    finally { setEstado('listo'); }
  }, [spec, instruccion]);

  const guardar = useCallback(async () => {
    if (!spec) return;
    setEstado('guardando'); setAviso(null);
    try {
      const r = await fetch('/api/landing-writer', {
        method: 'POST', headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ accion: 'guardar', spec, pedido, objetivo, basadoEnUrl: base || null }),
      });
      const j = await r.json();
      if (!j.ok) throw new Error(j.error || 'No se pudo guardar.');
      setAviso({ tono: 'good', texto: 'Guardada. Queda en tus versiones.' });
      router.refresh();
    } catch (e) { setAviso({ tono: 'bad', texto: e instanceof Error ? e.message : String(e) }); }
    finally { setEstado('listo'); }
  }, [spec, pedido, objetivo, base, router]);

  const copiar = useCallback(async () => {
    if (!spec) return;
    try {
      await navigator.clipboard.writeText(specAMarkdown(spec));
      setCopiado(true); setTimeout(() => setCopiado(false), 2200);
    } catch { setAviso({ tono: 'bad', texto: 'El navegador no permitió copiar. Selecciona el texto a mano.' }); }
  }, [spec]);

  const opcionesBase = [
    { value: '', label: 'Desde cero', sub: 'Sin una página previa de referencia' },
    ...analizadas.map((a) => ({
      value: a.url,
      label: hostDe(a.url),
      sub: a.veredicto ? `${a.veredicto}${a.score != null ? ` · ${a.score}/10` : ''}` : 'Analizada',
    })),
  ];

  return (
    <main style={{ flex: 1, minWidth: 0, minHeight: '100vh', display: 'flex', flexDirection: 'column', padding: '28px 0 40px' }}>
      <header style={{ padding: '0 32px', marginBottom: 22 }}>
        <div style={{ display: 'flex', alignItems: 'center', gap: 9, marginBottom: 6 }}>
          <MakoLogo size={22} />
          <span style={eyebrow}>Landing Generator</span>
        </div>
        <h1 style={{ fontSize: 30, fontWeight: 650, letterSpacing: '-0.025em', margin: 0 }}>
          Tu página, escrita
        </h1>
      </header>

      <div style={{ display: 'flex', gap: 22, padding: '0 32px', alignItems: 'flex-start', flexWrap: 'wrap' }}>
        {/* PEDIDO */}
        <aside style={{ width: 340, flex: '0 0 auto', display: 'grid', gap: 16 }}>
          <div style={card}>
            <div style={{ ...eyebrow, marginBottom: 10 }}>Qué página necesitas</div>
            <textarea
              style={areaTexto}
              value={pedido}
              onChange={(e) => setPedido(e.target.value)}
              disabled={ocupado}
              placeholder="Ej: una página para el programa de acompañamiento, para dueños de negocio que ya facturan pero viven apagando incendios. Quiero que agenden un diagnóstico."
              aria-label="Qué página necesitas"
            />

            <div style={{ ...eyebrow, margin: '18px 0 8px' }}>Qué tiene que lograr</div>
            <Dropdown
              value={objetivo}
              onChange={(v) => setObjetivo(v as ObjetivoLanding)}
              options={OBJETIVOS_LANDING.map((o) => ({ value: o.value, label: o.label, sub: o.hint }))}
              width="100%"
              ariaLabel="Objetivo de la página"
              disabled={ocupado}
            />

            <div style={{ ...eyebrow, margin: '18px 0 8px' }}>Sobre cuál</div>
            <Dropdown
              value={base}
              onChange={setBase}
              options={opcionesBase}
              width="100%"
              ariaLabel="Página de referencia"
              disabled={ocupado}
            />
            {base && (
              <div style={{ marginTop: 9, fontSize: 12.5, color: 'var(--dim)', lineHeight: 1.5 }}>
                MaKo va a escribir resolviendo los hallazgos que encontró en esa página.
              </div>
            )}
            {!analizadas.length && (
              <div style={{ marginTop: 9, fontSize: 12.5, color: 'var(--dim)', lineHeight: 1.5 }}>
                Todavía no has analizado ninguna página.{' '}
                <Link href="/landing-analyst" style={{ color: 'var(--primary)', fontWeight: 600 }}>Analiza la actual primero →</Link>
              </div>
            )}

            <button type="button" onClick={generar} disabled={ocupado || !pedido.trim()}
              style={{ ...btnPrimario, width: '100%', marginTop: 18, opacity: ocupado || !pedido.trim() ? 0.55 : 1 }}>
              {estado === 'generando' ? 'MaKo está escribiendo…' : spec ? 'Escribir otra versión' : 'Escribir la página'}
            </button>
          </div>

          {/* Versiones guardadas */}
          {drafts.length > 0 && (
            <div style={card}>
              <div style={{ ...eyebrow, marginBottom: 12 }}>Tus versiones</div>
              <div style={{ display: 'grid', gap: 8 }}>
                {drafts.map((d) => (
                  <button key={d.id} type="button" onClick={() => { setSpec(d.spec); setPedido(d.pedido); }}
                    style={{ textAlign: 'left', padding: '10px 12px', borderRadius: 10, border: '1px solid var(--border)', background: 'var(--surface-2)', cursor: 'pointer', fontFamily: SANS }}>
                    <div style={{ fontSize: 13.5, fontWeight: 600 }}>{d.titulo || 'Sin nombre'}</div>
                    <div style={{ fontFamily: MONO, fontSize: 11, color: 'var(--faint)', marginTop: 2 }}>
                      {new Date(d.created_at).toLocaleDateString('es-MX', { day: 'numeric', month: 'short' })}
                    </div>
                  </button>
                ))}
              </div>
            </div>
          )}
        </aside>

        {/* PROPUESTA */}
        <section style={{ flex: 1, minWidth: 380, display: 'grid', gap: 16 }}>
          {aviso && (
            <div style={{ padding: '10px 14px', borderRadius: 10, fontSize: 13.5, lineHeight: 1.5,
              background: aviso.tono === 'bad' ? 'var(--bad-bg)' : 'var(--good-bg)', color: aviso.tono === 'bad' ? 'var(--bad)' : 'var(--good)' }}>
              {aviso.texto}
            </div>
          )}
          {errorMsg && (
            <div style={{ padding: '10px 14px', borderRadius: 10, fontSize: 13.5, background: 'var(--bad-bg)', color: 'var(--bad)' }}>{errorMsg}</div>
          )}

          {!spec ? (
            <div style={{ ...card, padding: 40, textAlign: 'center' }}>
              {/* Se centra con FLEX, no con el `textAlign: 'center'` del padre: el preflight
                  de Tailwind pone `svg { display: block }` y a un bloque el text-align no lo
                  mueve — el icono quedaba pegado a la izquierda. */}
              <div style={{ display: 'flex', justifyContent: 'center' }}><MakoLogo size={54} /></div>
              <h2 style={{ fontSize: 20, fontWeight: 650, margin: '16px 0 8px', letterSpacing: '-0.02em' }}>Cuéntale a MaKo qué página necesitas</h2>
              <p style={{ fontSize: 14, color: 'var(--dim)', lineHeight: 1.6, margin: '0 auto', maxWidth: 420 }}>
                Escribe la estructura y el texto completo —listo para pegar— usando tu oferta, tu proceso comercial y el diagnóstico de la página que ya tienes.
              </p>
            </div>
          ) : (
            <>
              {/* Cabecera de la propuesta */}
              <div style={card}>
                <div style={{ display: 'flex', justifyContent: 'space-between', gap: 14, flexWrap: 'wrap', alignItems: 'flex-start' }}>
                  <div style={{ minWidth: 220, flex: 1 }}>
                    <div style={eyebrow}>{objetivoLabel(spec.objetivo)}</div>
                    <h2 style={{ fontSize: 24, fontWeight: 650, letterSpacing: '-0.025em', margin: '8px 0 6px', lineHeight: 1.25 }}>{spec.headline}</h2>
                    <p style={{ margin: 0, fontSize: 15, color: 'var(--dim)', lineHeight: 1.55 }}>{spec.subheadline}</p>
                    <div style={{ display: 'inline-block', marginTop: 16, padding: '10px 20px', borderRadius: 10, background: 'var(--primary)', color: '#fff', fontSize: 14, fontWeight: 600 }}>
                      {spec.cta_principal}
                    </div>
                  </div>
                  <div style={{ display: 'grid', gap: 8, flex: 'none' }}>
                    <button type="button" onClick={copiar} style={btnSuave}>{copiado ? 'Copiado ✓' : 'Copiar todo'}</button>
                    <button type="button" onClick={guardar} disabled={ocupado} style={{ ...btnSuave, opacity: ocupado ? 0.55 : 1 }}>
                      {estado === 'guardando' ? 'Guardando…' : 'Guardar'}
                    </button>
                  </div>
                </div>

                {spec.rationale && (
                  <div style={{ display: 'flex', gap: 10, alignItems: 'flex-start', marginTop: 20, padding: '12px 15px', borderRadius: 10, background: 'var(--warn-bg)' }}>
                    <MakoLogo size={18} />
                    <div style={{ fontSize: 13.5, lineHeight: 1.55, color: 'var(--ink)' }}>{spec.rationale}</div>
                  </div>
                )}

                {(spec.avatar || spec.promesa) && (
                  <div style={{ display: 'flex', gap: 18, marginTop: 18, flexWrap: 'wrap', paddingTop: 16, borderTop: '1px solid var(--border)' }}>
                    {spec.avatar && (
                      <div style={{ flex: 1, minWidth: 200 }}>
                        <div style={eyebrow}>Le habla a</div>
                        <div style={{ fontSize: 13.5, marginTop: 5, lineHeight: 1.5 }}>{spec.avatar}</div>
                      </div>
                    )}
                    {spec.promesa && (
                      <div style={{ flex: 1, minWidth: 200 }}>
                        <div style={eyebrow}>Promete</div>
                        <div style={{ fontSize: 13.5, marginTop: 5, lineHeight: 1.5 }}>{spec.promesa}</div>
                      </div>
                    )}
                  </div>
                )}
              </div>

              {/* Bloques */}
              {spec.bloques.map((b, i) => (
                <div key={i} style={card}>
                  <div style={{ display: 'flex', gap: 9, alignItems: 'baseline', flexWrap: 'wrap', marginBottom: 10 }}>
                    <span style={{ fontFamily: MONO, fontSize: 10.5, fontWeight: 700, letterSpacing: '.06em', textTransform: 'uppercase', padding: '3px 9px', borderRadius: 999, background: 'var(--surface-2)', color: 'var(--dim)' }}>
                      {String(i + 1).padStart(2, '0')} · {TIPO_LABEL[b.tipo] ?? b.tipo}
                    </span>
                    <span style={{ fontSize: 17, fontWeight: 650, letterSpacing: '-0.015em' }}>{b.titulo}</span>
                  </div>
                  {b.copy && <p style={{ margin: '0 0 12px', fontSize: 14.5, lineHeight: 1.65, whiteSpace: 'pre-wrap' }}>{b.copy}</p>}
                  {b.bullets.length > 0 && (
                    <ul style={{ margin: '0 0 12px', paddingLeft: 20, display: 'grid', gap: 6 }}>
                      {b.bullets.map((x, k) => <li key={k} style={{ fontSize: 14, lineHeight: 1.55 }}>{x}</li>)}
                    </ul>
                  )}
                  {b.cta && (
                    <div style={{ display: 'inline-block', padding: '9px 18px', borderRadius: 10, background: 'var(--primary-bg)', color: 'var(--primary-strong)', fontSize: 13.5, fontWeight: 600 }}>{b.cta}</div>
                  )}
                  {b.nota && (
                    <div style={{ display: 'flex', gap: 8, alignItems: 'flex-start', marginTop: 12, paddingTop: 11, borderTop: '1px solid var(--border)' }}>
                      <MakoLogo size={15} />
                      <div style={{ fontSize: 12.5, color: 'var(--dim)', lineHeight: 1.5 }}>{b.nota}</div>
                    </div>
                  )}
                </div>
              ))}

              {/* SEO */}
              {(spec.meta_titulo || spec.meta_descripcion) && (
                <div style={card}>
                  <div style={{ ...eyebrow, marginBottom: 10 }}>Para buscadores</div>
                  {spec.meta_titulo && <div style={{ fontSize: 14, fontWeight: 600, marginBottom: 4 }}>{spec.meta_titulo}</div>}
                  {spec.meta_descripcion && <div style={{ fontSize: 13.5, color: 'var(--dim)', lineHeight: 1.5 }}>{spec.meta_descripcion}</div>}
                </div>
              )}

              {/* Ajuste */}
              <div style={{ ...card, background: 'var(--surface-2)' }}>
                <div style={{ ...eyebrow, marginBottom: 10 }}>Pídele un cambio</div>
                <div style={{ display: 'flex', gap: 10, flexWrap: 'wrap' }}>
                  <input
                    style={{ flex: 1, minWidth: 240, padding: '11px 14px', fontSize: 13.5, fontFamily: SANS, border: '1px solid var(--border-strong)', borderRadius: 10, background: 'var(--surface)', color: 'var(--ink)' }}
                    value={instruccion}
                    onChange={(e) => setInstruccion(e.target.value)}
                    onKeyDown={(e) => { if (e.key === 'Enter') ajustar(); }}
                    disabled={ocupado}
                    placeholder="Ej: el hero es muy largo, déjalo en dos frases"
                    aria-label="Cambio que quieres"
                  />
                  <button type="button" onClick={ajustar} disabled={ocupado || !instruccion.trim()}
                    style={{ ...btnSuave, opacity: ocupado || !instruccion.trim() ? 0.55 : 1 }}>
                    {estado === 'ajustando' ? 'Ajustando…' : 'Aplicar'}
                  </button>
                </div>
                <div style={{ display: 'flex', gap: 8, alignItems: 'center', marginTop: 11, fontSize: 12.5, color: 'var(--dim)' }}>
                  <Icon name="pen" size={14} />
                  Cambia solo lo que le pidas: el resto de la página queda igual.
                </div>
              </div>
            </>
          )}
        </section>
      </div>
    </main>
  );
}
