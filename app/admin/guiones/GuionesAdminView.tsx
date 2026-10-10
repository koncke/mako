'use client';

// =============================================================================
// GuionesAdminView — la fábrica de guiones del super-admin (sidebar → Guiones)
// =============================================================================
// Dos bibliotecas GLOBALES (las ven todos los clientes al crear un guion en la
// Matriz), cada una con su editor completo:
//  · ÁNGULOS — el enfoque del anuncio: requisitos, hooks de ejemplo, guía de
//    cuerpo y CTA, reglas siempre/nunca, preguntas al dueño y estructuras
//    compatibles.
//  · ESTRUCTURAS — el esqueleto de bloques (PAS, AIDA, BAB…): sus etiquetas son
//    CONTRATO con el parser que parte el guion en tarjetas (renombrarlas rompe
//    el render de guiones ya guardados; agregar estructuras nuevas es seguro).
// Guardar persiste el override completo en el OWNER_WS; Restaurar vuelve al
// catálogo de código.

import { useEffect, useState, type CSSProperties } from 'react';
import { IconoBorrar } from '@/app/_ui/BotonBorrar';
import { Icon } from '../../_components/icons';
import { Dropdown } from '../../components/Dropdown';

const MONO = "'Geist Mono', monospace";
const SANS = "'Geist', sans-serif";

type Angulo = { id: string; nombre: string; emoji: string; cuando: string; requisitos: string; ejemplosHook: string[]; cuerpo: string; cta: string; siempre: string[]; nunca: string[]; preguntas: string[]; estructuras: string[]; activo: boolean };
type Estructura = { id: string; nombre: string; emoji: string; cuando: string; etiquetas: string[]; guia: string; activo: boolean };

const card: CSSProperties = { background: 'var(--surface)', border: '1px solid var(--border)', borderRadius: 16 };
const input: CSSProperties = { width: '100%', padding: '10px 12px', borderRadius: 10, border: '1px solid var(--border-strong)', background: 'var(--surface)', color: 'var(--ink)', fontFamily: SANS, fontSize: 14, outline: 'none' };
const area: CSSProperties = { ...input, lineHeight: 1.55, resize: 'vertical' };
const labelStyle: CSSProperties = { fontFamily: MONO, fontSize: 10.5, letterSpacing: '.09em', textTransform: 'uppercase', color: 'var(--dim)', marginBottom: 6, display: 'block' };
const btnDark: CSSProperties = { padding: '10px 18px', borderRadius: 10, border: 'none', background: '#171511', color: '#F3F0E7', fontFamily: SANS, fontSize: 13.5, fontWeight: 600, cursor: 'pointer' };
const btnGhost: CSSProperties = { padding: '9px 14px', borderRadius: 10, border: '1px solid var(--border-strong)', background: 'var(--surface)', color: 'var(--dim)', fontFamily: SANS, fontSize: 13.5, fontWeight: 500, cursor: 'pointer' };
const bannerError: CSSProperties = { background: 'var(--bad-bg)', border: '1px solid var(--bad)', borderRadius: 12, padding: '11px 15px', fontSize: 13, color: 'var(--bad)', fontWeight: 600, lineHeight: 1.5 };

// Listas editadas como textarea de 1 ítem por línea (hooks, siempre, nunca, preguntas).
const aLineas = (arr: string[]) => arr.join('\n');
const deLineas = (s: string) => s.split('\n').map((l) => l.trim()).filter(Boolean);

/**
 * `tabExterna` la EMBEBE dentro del registro de Ads Writer (/admin/dev/ads-writer),
 * donde Ángulos y Estructuras son dos tabs más al lado de Roadmap. Con ella
 * puesta, esta vista no dibuja su propio encabezado ni su propia barra de tabs
 * —los pone la pantalla de afuera— y deja de ser un `<main>`, porque el `<main>`
 * de una pantalla es `Pagina` (regla de AGENTS.md).
 *
 * Sin `tabExterna` sigue funcionando sola, que es como la usa /admin/guiones.
 */
export function GuionesAdminView({ tabExterna }: { tabExterna?: 'angulos' | 'estructuras' } = {}) {
  const [tabPropia, setTabPropia] = useState<'angulos' | 'estructuras'>('angulos');
  const tab = tabExterna ?? tabPropia;
  const setTab = setTabPropia;
  // El contenedor es un string constante por montaje, NO un componente definido
  // en el render: eso remontaría el subárbol en cada tecla y vaciaría los campos.
  const Cont = tabExterna ? 'div' : 'main';
  const [angulos, setAngulos] = useState<Angulo[] | null>(null);
  const [estructuras, setEstructuras] = useState<Estructura[] | null>(null);
  const [abierto, setAbierto] = useState<string | null>(null);
  const [guardando, setGuardando] = useState(false);
  const [msg, setMsg] = useState<string | null>(null);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    Promise.all([
      fetch('/api/admin/guion-angulos').then((r) => r.json()),
      fetch('/api/admin/guion-estructuras').then((r) => r.json()),
    ]).then(([ja, je]) => {
      if (ja.ok) setAngulos(ja.angulos as Angulo[]); else setError(ja.error || 'No se pudieron cargar los ángulos.');
      if (je.ok) setEstructuras(je.estructuras as Estructura[]); else setError(je.error || 'No se pudieron cargar las estructuras.');
    }).catch((e) => setError(e instanceof Error ? e.message : String(e)));
  }, []);

  const guardar = async (accion: 'guardar' | 'reset') => {
    setGuardando(true); setError(null); setMsg(null);
    try {
      const esAng = tab === 'angulos';
      const url = esAng ? '/api/admin/guion-angulos' : '/api/admin/guion-estructuras';
      const body = accion === 'reset' ? { action: 'reset' } : (esAng ? { action: 'guardar', angulos } : { action: 'guardar', estructuras });
      const j = await (await fetch(url, { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify(body) })).json();
      if (!j.ok) { setError(j.error || 'No se pudo guardar.'); return; }
      if (esAng) setAngulos(j.angulos as Angulo[]); else setEstructuras(j.estructuras as Estructura[]);
      setMsg(accion === 'reset' ? 'Catálogo restaurado a los defaults.' : 'Guardado — ya está vivo para todos los clientes.');
    } catch (e) { setError(e instanceof Error ? e.message : String(e)); }
    finally { setGuardando(false); }
  };

  const edAngulo = (id: string, patch: Partial<Angulo>) => { setAngulos((as) => (as ? as.map((a) => (a.id === id ? { ...a, ...patch } : a)) : as)); setMsg(null); };
  const edEstructura = (id: string, patch: Partial<Estructura>) => { setEstructuras((es) => (es ? es.map((e) => (e.id === id ? { ...e, ...patch } : e)) : es)); setMsg(null); };

  const tabBtn = (on: boolean): CSSProperties => ({
    padding: '10px 2px', marginRight: 26, background: 'transparent', border: 'none', cursor: 'pointer',
    fontFamily: SANS, fontSize: 15, fontWeight: on ? 600 : 500, color: on ? 'var(--ink)' : 'var(--dim)',
    borderBottom: on ? '2px solid var(--accent)' : '2px solid transparent',
  });

  const estructuraOpts = (estructuras ?? []).map((e) => ({ value: e.id, label: `${e.emoji} ${e.nombre}` }));

  return (
    <Cont style={tabExterna ? undefined : { flex: 1, minWidth: 0, padding: '34px 44px 60px' }}>
      {!tabExterna && (
        <header style={{ display: 'flex', alignItems: 'center', gap: 12, marginBottom: 4 }}>
          <span style={{ display: 'inline-flex', color: 'var(--accent)' }}><Icon name="escribir" size={34} /></span>
          <h1 style={{ fontWeight: 600, fontSize: 42, letterSpacing: '-0.025em', lineHeight: 1, margin: 0, color: 'var(--ink)' }}>Ads Writer</h1>
        </header>
      )}
      <div style={tabExterna ? undefined : { maxWidth: 980, marginTop: 18 }}>
        {!tabExterna && (
          <div style={{ display: 'flex', alignItems: 'center', borderBottom: '1px solid var(--border)', marginBottom: 16 }}>
            <button style={tabBtn(tab === 'angulos')} onClick={() => { setTab('angulos'); setAbierto(null); setMsg(null); }}>Ángulos</button>
            <button style={tabBtn(tab === 'estructuras')} onClick={() => { setTab('estructuras'); setAbierto(null); setMsg(null); }}>Estructuras</button>
          </div>
        )}

        {error && !angulos && !estructuras && <div style={bannerError}>{error}</div>}
        {((tab === 'angulos' && !angulos) || (tab === 'estructuras' && !estructuras)) && !error && (
          <div style={{ ...card, padding: 22, color: 'var(--faint)', fontFamily: MONO, fontSize: 13 }}>Cargando…</div>
        )}

        {/* ── ÁNGULOS ── */}
        {tab === 'angulos' && angulos && (
          <div style={{ display: 'flex', flexDirection: 'column', gap: 12 }}>
            <div style={{ fontSize: 13.5, color: 'var(--dim)', lineHeight: 1.6 }}>
              El <b>enfoque</b> de cada anuncio. Todo lo que cargues aquí (hooks, reglas, preguntas) es lo que recibe la IA — y las <b>preguntas</b> se le hacen al cliente justo antes de generar.
            </div>
            {angulos.map((a) => {
              const on = abierto === a.id;
              return (
                <div key={a.id} style={{ ...card, padding: 0, overflow: 'hidden', opacity: a.activo ? 1 : 0.55 }}>
                  <div style={{ display: 'flex', alignItems: 'center', gap: 10, padding: '13px 16px' }}>
                    <button type="button" onClick={() => setAbierto(on ? null : a.id)} style={{ flex: 1, minWidth: 0, display: 'flex', alignItems: 'center', gap: 10, background: 'none', border: 0, cursor: 'pointer', textAlign: 'left', fontFamily: SANS, padding: 0 }}>
                      <span aria-hidden style={{ fontSize: 17, flex: 'none' }}>{a.emoji}</span>
                      <span style={{ fontSize: 14.5, fontWeight: 700, color: 'var(--ink)', flex: 'none' }}>{a.nombre}</span>
                      <span style={{ fontSize: 12, color: 'var(--faint)', minWidth: 0, overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>{a.cuando}</span>
                      <span aria-hidden style={{ marginLeft: 'auto', flex: 'none', color: 'var(--faint)', fontSize: 12, transform: on ? 'rotate(180deg)' : 'none', transition: 'transform .15s' }}>▾</span>
                    </button>
                    <button type="button" onClick={() => edAngulo(a.id, { activo: !a.activo })} style={{ ...btnGhost, padding: '6px 11px', fontSize: 12 }}>{a.activo ? 'Activo' : 'Apagado'}</button>
                    <button type="button" onClick={() => { setAngulos((as) => (as ? as.filter((x) => x.id !== a.id) : as)); setMsg(null); }} aria-label="Borrar" title="Borrar" style={{ ...btnGhost, padding: '5px 8px', fontSize: 12, display: 'inline-flex', alignItems: 'center' }}><IconoBorrar size={15} /></button>
                  </div>
                  {on && (
                    <div style={{ borderTop: '1px solid var(--border)', padding: 16, display: 'flex', flexDirection: 'column', gap: 12 }}>
                      <div style={{ display: 'grid', gridTemplateColumns: '70px 1fr', gap: 10 }}>
                        <div><label style={labelStyle}>Emoji</label><input style={input} value={a.emoji} onChange={(e) => edAngulo(a.id, { emoji: e.target.value })} /></div>
                        <div><label style={labelStyle}>Nombre</label><input style={input} value={a.nombre} onChange={(e) => edAngulo(a.id, { nombre: e.target.value })} /></div>
                      </div>
                      <div><label style={labelStyle}>Cuándo usarlo (1 frase, se ve en la card)</label><input style={input} value={a.cuando} onChange={(e) => edAngulo(a.id, { cuando: e.target.value })} /></div>
                      <div><label style={labelStyle}>Requisitos (qué debe existir en el negocio para usarlo)</label><textarea rows={2} style={area} value={a.requisitos} onChange={(e) => edAngulo(a.id, { requisitos: e.target.value })} /></div>
                      <div><label style={labelStyle}>Ejemplos de hook (uno por línea, con [placeholders])</label><textarea rows={4} style={area} value={aLineas(a.ejemplosHook)} onChange={(e) => edAngulo(a.id, { ejemplosHook: deLineas(e.target.value) })} /></div>
                      <div><label style={labelStyle}>Guía del cuerpo</label><textarea rows={4} style={area} value={a.cuerpo} onChange={(e) => edAngulo(a.id, { cuerpo: e.target.value })} /></div>
                      <div><label style={labelStyle}>Guía del CTA</label><textarea rows={2} style={area} value={a.cta} onChange={(e) => edAngulo(a.id, { cta: e.target.value })} /></div>
                      <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 10 }}>
                        <div><label style={labelStyle}>Siempre (uno por línea)</label><textarea rows={4} style={area} value={aLineas(a.siempre)} onChange={(e) => edAngulo(a.id, { siempre: deLineas(e.target.value) })} /></div>
                        <div><label style={labelStyle}>Nunca (uno por línea)</label><textarea rows={4} style={area} value={aLineas(a.nunca)} onChange={(e) => edAngulo(a.id, { nunca: deLineas(e.target.value) })} /></div>
                      </div>
                      <div><label style={labelStyle}>Preguntas al cliente antes de generar (una por línea)</label><textarea rows={3} style={area} value={aLineas(a.preguntas)} onChange={(e) => edAngulo(a.id, { preguntas: deLineas(e.target.value) })} /></div>
                      <div>
                        <label style={labelStyle}>Estructuras compatibles (la primera es la sugerida)</label>
                        <div style={{ display: 'flex', flexWrap: 'wrap', gap: 7, marginBottom: 8 }}>
                          {a.estructuras.map((id, i) => {
                            const e = (estructuras ?? []).find((x) => x.id === id);
                            return (
                              <span key={id} style={{ display: 'inline-flex', alignItems: 'center', gap: 6, fontFamily: SANS, fontSize: 12, padding: '6px 11px', borderRadius: 999, border: '1px solid var(--primary)', background: 'var(--primary-bg)', color: 'var(--primary)', fontWeight: 600 }}>
                                {e ? `${e.emoji} ${e.nombre}` : id}{i === 0 ? ' · sugerida' : ''}
                                <button type="button" onClick={() => edAngulo(a.id, { estructuras: a.estructuras.filter((x) => x !== id) })} style={{ border: 'none', background: 'none', color: 'inherit', cursor: 'pointer', padding: 0, fontSize: 12 }}>✕</button>
                              </span>
                            );
                          })}
                        </div>
                        <Dropdown value="" placeholder="+ Agregar estructura…" resetAfterSelect width={280}
                          options={estructuraOpts.filter((o) => !a.estructuras.includes(o.value))}
                          onChange={(v) => edAngulo(a.id, { estructuras: [...a.estructuras, v] })} />
                      </div>
                    </div>
                  )}
                </div>
              );
            })}
            <div style={{ display: 'flex', alignItems: 'center', gap: 10, flexWrap: 'wrap' }}>
              <button type="button" style={btnGhost}
                onClick={() => { const id = `angulo-${Date.now().toString(36)}`; setAngulos((as) => ([...(as ?? []), { id, nombre: 'Nuevo ángulo', emoji: '🎬', cuando: '', requisitos: '', ejemplosHook: [], cuerpo: '', cta: '', siempre: [], nunca: [], preguntas: [], estructuras: ['gancho-historia-cta'], activo: true }])); setAbierto(id); }}>
                + Agregar ángulo
              </button>
              <button type="button" onClick={() => guardar('guardar')} disabled={guardando} style={{ ...btnDark, opacity: guardando ? 0.6 : 1 }}>{guardando ? 'Guardando…' : 'Guardar cambios'}</button>
              <button type="button" onClick={() => guardar('reset')} disabled={guardando} style={btnGhost}>Restaurar defaults</button>
              {msg && <span style={{ fontSize: 13, color: 'var(--good)', fontWeight: 600 }}>{msg}</span>}
              {error && <span style={{ fontSize: 13, color: 'var(--bad)', fontWeight: 600 }}>{error}</span>}
            </div>
          </div>
        )}

        {/* ── ESTRUCTURAS ── */}
        {tab === 'estructuras' && estructuras && (
          <div style={{ display: 'flex', flexDirection: 'column', gap: 12 }}>
            <div style={{ fontSize: 13.5, color: 'var(--dim)', lineHeight: 1.6 }}>
              El <b>esqueleto</b> de bloques del guion. Ojo: las <b>etiquetas</b> son el contrato con el visor de guiones — renombrarlas rompe el render de los guiones ya guardados con esa estructura; agregar estructuras nuevas es seguro.
            </div>
            {estructuras.map((e) => {
              const on = abierto === e.id;
              return (
                <div key={e.id} style={{ ...card, padding: 0, overflow: 'hidden', opacity: e.activo ? 1 : 0.55 }}>
                  <div style={{ display: 'flex', alignItems: 'center', gap: 10, padding: '13px 16px' }}>
                    <button type="button" onClick={() => setAbierto(on ? null : e.id)} style={{ flex: 1, minWidth: 0, display: 'flex', alignItems: 'center', gap: 10, background: 'none', border: 0, cursor: 'pointer', textAlign: 'left', fontFamily: SANS, padding: 0 }}>
                      <span aria-hidden style={{ fontSize: 17, flex: 'none' }}>{e.emoji}</span>
                      <span style={{ fontSize: 14.5, fontWeight: 700, color: 'var(--ink)', flex: 'none' }}>{e.nombre}</span>
                      <span style={{ fontFamily: MONO, fontSize: 10.5, color: 'var(--faint)', minWidth: 0, overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>{e.etiquetas.join(' → ')}</span>
                      <span aria-hidden style={{ marginLeft: 'auto', flex: 'none', color: 'var(--faint)', fontSize: 12, transform: on ? 'rotate(180deg)' : 'none', transition: 'transform .15s' }}>▾</span>
                    </button>
                    <button type="button" onClick={() => edEstructura(e.id, { activo: !e.activo })} style={{ ...btnGhost, padding: '6px 11px', fontSize: 12 }}>{e.activo ? 'Activa' : 'Apagada'}</button>
                    <button type="button" onClick={() => { setEstructuras((es) => (es ? es.filter((x) => x.id !== e.id) : es)); setMsg(null); }} aria-label="Borrar" title="Borrar" style={{ ...btnGhost, padding: '5px 8px', fontSize: 12, display: 'inline-flex', alignItems: 'center' }}><IconoBorrar size={15} /></button>
                  </div>
                  {on && (
                    <div style={{ borderTop: '1px solid var(--border)', padding: 16, display: 'flex', flexDirection: 'column', gap: 12 }}>
                      <div style={{ display: 'grid', gridTemplateColumns: '70px 1fr', gap: 10 }}>
                        <div><label style={labelStyle}>Emoji</label><input style={input} value={e.emoji} onChange={(ev) => edEstructura(e.id, { emoji: ev.target.value })} /></div>
                        <div><label style={labelStyle}>Nombre</label><input style={input} value={e.nombre} onChange={(ev) => edEstructura(e.id, { nombre: ev.target.value })} /></div>
                      </div>
                      <div><label style={labelStyle}>Cuándo conviene</label><input style={input} value={e.cuando} onChange={(ev) => edEstructura(e.id, { cuando: ev.target.value })} /></div>
                      <div>
                        <label style={labelStyle}>Etiquetas de los bloques, EN ORDEN (una por línea, en MAYÚSCULA)</label>
                        <textarea rows={4} style={{ ...area, fontFamily: MONO, fontSize: 13 }} value={aLineas(e.etiquetas)} onChange={(ev) => edEstructura(e.id, { etiquetas: deLineas(ev.target.value).map((l) => l.toUpperCase()) })} />
                      </div>
                      <div><label style={labelStyle}>Guía por bloque (para la IA)</label><textarea rows={7} style={area} value={e.guia} onChange={(ev) => edEstructura(e.id, { guia: ev.target.value })} /></div>
                    </div>
                  )}
                </div>
              );
            })}
            <div style={{ display: 'flex', alignItems: 'center', gap: 10, flexWrap: 'wrap' }}>
              <button type="button" style={btnGhost}
                onClick={() => { const id = `estructura-${Date.now().toString(36)}`; setEstructuras((es) => ([...(es ?? []), { id, nombre: 'Nueva estructura', emoji: '🧱', cuando: '', etiquetas: ['GANCHO', 'CUERPO', 'CTA'], guia: '', activo: true }])); setAbierto(id); }}>
                + Agregar estructura
              </button>
              <button type="button" onClick={() => guardar('guardar')} disabled={guardando} style={{ ...btnDark, opacity: guardando ? 0.6 : 1 }}>{guardando ? 'Guardando…' : 'Guardar cambios'}</button>
              <button type="button" onClick={() => guardar('reset')} disabled={guardando} style={btnGhost}>Restaurar defaults</button>
              {msg && <span style={{ fontSize: 13, color: 'var(--good)', fontWeight: 600 }}>{msg}</span>}
              {error && <span style={{ fontSize: 13, color: 'var(--bad)', fontWeight: 600 }}>{error}</span>}
            </div>
          </div>
        )}
      </div>
    </Cont>
  );
}
