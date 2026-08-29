'use client';

// =============================================================================
// ProductosView — el catálogo de productos del negocio (paso del onboarding)
// =============================================================================
// Va DESPUÉS del Archivero a propósito: para entonces MaKo ya leyó el brief y los
// documentos, así que el paso arranca con el botón que importa —"Armalos vos,
// MaKo"— y el dueño CORRIGE en vez de redactar. Ese fue el pedido explícito:
// aprovechar lo que ya se cargó, no hacer tipear todo de nuevo.
//
// El alta manual es la excepción (cuando MaKo no tiene con qué), y va de a UNA
// pregunta por pantalla con opciones para tocar — nunca un formulario con todos
// los campos juntos.
//
// El catálogo es el que después usa el CRM: al cerrar un lead se elige un producto
// y el deal hereda su tipo de cobro, su precio y su plazo.

import { useCallback, useEffect, useState, type CSSProperties } from 'react';
import { WizardShell } from '../_components/WizardShell';

const MONO = "'Geist Mono', monospace";
const SANS = "'Geist', sans-serif";

type Producto = {
  id: number; nombre: string; tipo: 'unico' | 'suscripcion';
  monto_usd: number | null; suscripcion_meses: number | null;
  promesa: string | null; incluye: string | null; garantia: string | null;
  descripcion: string | null; activo: boolean; orden: number;
};
type Estado = { productos: Producto[]; tieneContexto: boolean };

const btnPrimary: CSSProperties = { padding: '12px 22px', borderRadius: 11, border: 'none', background: 'var(--primary)', color: '#fff', fontFamily: SANS, fontSize: 14.5, fontWeight: 600, cursor: 'pointer', display: 'inline-flex', alignItems: 'center', gap: 8 };
const btnGhost: CSSProperties = { padding: '9px 16px', borderRadius: 10, border: '1px solid var(--border-strong)', background: 'var(--surface)', color: 'var(--dim)', fontFamily: SANS, fontSize: 13, fontWeight: 500, cursor: 'pointer', display: 'inline-flex', alignItems: 'center', gap: 7 };
const eyebrow: CSSProperties = { fontFamily: MONO, fontSize: 10.5, letterSpacing: '.1em', textTransform: 'uppercase', color: 'var(--faint)' };
const linkBtn: CSSProperties = { background: 'none', border: 'none', color: 'var(--dim)', fontFamily: SANS, fontSize: 13, textDecoration: 'underline', cursor: 'pointer', padding: 0 };

const fmtUSD = (n: number | null) => (n == null ? 'sin precio' : '$' + n.toLocaleString('en-US'));

function MiniSpin({ light }: { light?: boolean }) {
  return <span style={{ width: 13, height: 13, borderRadius: '50%', border: `2px solid ${light ? 'rgba(255,255,255,.35)' : 'var(--border)'}`, borderTopColor: light ? '#fff' : 'var(--primary)', animation: 'prod-spin .8s linear infinite', display: 'inline-block', flex: 'none' }} />;
}

/** Campo editable inline: mismo gesto que las tarjetas del lead magnet. */
function Edit({ valor, ph, onSave, style }: { valor: string; ph?: string; onSave: (v: string) => void; style?: CSSProperties }) {
  return (
    <div className="prod-edit" contentEditable suppressContentEditableWarning spellCheck={false} data-ph={ph || 'Escribe…'}
      onBlur={(e) => { const nv = (e.currentTarget.textContent || '').replace(/\s+/g, ' ').trim(); if (nv !== (valor ?? '').trim()) onSave(nv); }}
      style={{ outline: 'none', cursor: 'text', borderRadius: 6, padding: '2px 6px', margin: '0 -6px', ...style }}
    >{valor}</div>
  );
}

function btnOpcion(activo: boolean): CSSProperties {
  return { width: '100%', padding: '12px 15px', borderRadius: 12, textAlign: 'left', fontFamily: SANS, cursor: 'pointer', border: `1px solid ${activo ? 'var(--primary)' : 'var(--border-strong)'}`, background: activo ? 'var(--primary-bg)' : 'var(--surface-2)', color: activo ? 'var(--primary)' : 'var(--ink)' };
}

/** Alta manual: UNA pregunta por pantalla (nombre → cómo se cobra → precio → plazo). */
function NuevoProducto({ onGuardar, onClose, pending }: { onGuardar: (p: Record<string, unknown>) => void; onClose: () => void; pending: boolean }) {
  const [paso, setPaso] = useState(0);
  const [nombre, setNombre] = useState('');
  const [tipo, setTipo] = useState<'unico' | 'suscripcion'>('unico');
  const [monto, setMonto] = useState('');
  const [meses, setMeses] = useState('');

  const esSus = tipo === 'suscripcion';
  const PASOS = esSus ? ['nombre', 'tipo', 'monto', 'plazo'] : ['nombre', 'tipo', 'monto'];
  const actual = PASOS[Math.min(paso, PASOS.length - 1)];
  const enUltimo = paso >= PASOS.length - 1;
  const puede = actual === 'nombre' ? !!nombre.trim() : true;

  const campo: CSSProperties = { width: '100%', padding: '13px 15px', borderRadius: 12, border: '1px solid var(--border-strong)', background: 'var(--surface-2)', color: 'var(--ink)', fontFamily: SANS, fontSize: 16, outline: 'none', textAlign: 'center' };

  const cuerpo = () => {
    if (actual === 'nombre') return (
      <input value={nombre} onChange={(e) => setNombre(e.target.value)} placeholder="Ej: Mentoría 1:1" autoFocus style={{ ...campo, maxWidth: 360, margin: '0 auto', display: 'block' }} />
    );
    if (actual === 'tipo') return (
      <div style={{ display: 'flex', flexDirection: 'column', gap: 10, maxWidth: 380, margin: '0 auto' }}>
        <button type="button" onClick={() => setTipo('unico')} style={btnOpcion(!esSus)}>
          <div style={{ fontSize: 15, fontWeight: 700 }}>Pago único</div>
          <div style={{ fontSize: 12, fontWeight: 500, color: esSus ? 'var(--faint)' : 'inherit', marginTop: 2, opacity: esSus ? 1 : .75 }}>Se paga una vez, aunque sea en cuotas.</div>
        </button>
        <button type="button" onClick={() => setTipo('suscripcion')} style={btnOpcion(esSus)}>
          <div style={{ fontSize: 15, fontWeight: 700 }}>🔁 Suscripción mensual</div>
          <div style={{ fontSize: 12, fontWeight: 500, color: esSus ? 'inherit' : 'var(--faint)', marginTop: 2, opacity: esSus ? .75 : 1 }}>El cliente paga todos los meses.</div>
        </button>
      </div>
    );
    if (actual === 'monto') return (
      <input inputMode="numeric" value={monto} onChange={(e) => setMonto(e.target.value.replace(/[^\d.]/g, ''))} placeholder="0" autoFocus style={{ ...campo, maxWidth: 220, margin: '0 auto', display: 'block', fontSize: 22, fontWeight: 700 }} />
    );
    return (
      <div style={{ display: 'flex', flexDirection: 'column', gap: 12, maxWidth: 340, margin: '0 auto', alignItems: 'center' }}>
        <div style={{ display: 'flex', gap: 8, alignItems: 'center' }}>
          <input inputMode="numeric" value={meses} onChange={(e) => setMeses(e.target.value.replace(/[^\d]/g, ''))} placeholder="meses" autoFocus style={{ ...campo, maxWidth: 120 }} />
          <button type="button" onClick={() => setMeses('')} style={{ ...btnOpcion(!meses), width: 'auto', padding: '13px 18px', fontWeight: 700 }}>Indefinida</button>
        </div>
        <div style={{ fontSize: 12.5, color: 'var(--faint)', textAlign: 'center' }}>{meses ? `${meses} meses a plazo fijo` : 'Mes a mes, hasta que cancele'}</div>
      </div>
    );
  };

  const pregunta = actual === 'nombre' ? '¿Cómo se llama el producto?'
    : actual === 'tipo' ? '¿Cómo se cobra?'
      : actual === 'monto' ? (esSus ? '¿De cuánto es la mensualidad?' : '¿Cuánto sale?')
        : '¿Qué duración tiene?';
  const sub = actual === 'monto' ? (esSus ? 'Importe MENSUAL en USD. Si todavía no lo definiste, déjalo vacío.' : 'En USD. Si todavía no lo definiste, déjalo vacío.') : undefined;

  return (
    <WizardShell
      titulo="Nuevo producto"
      total={PASOS.length} idx={Math.min(paso, PASOS.length - 1)}
      pregunta={pregunta} sub={sub}
      pending={pending}
      puedeAvanzar={puede}
      enUltimo={enUltimo}
      confirmLabel="Agregar producto"
      atrasLabel={paso === 0 ? 'Cancelar' : 'Atrás'}
      onAtras={() => (paso === 0 ? onClose() : setPaso((p) => p - 1))}
      onSiguiente={() => setPaso((p) => Math.min(p + 1, PASOS.length - 1))}
      onConfirmar={() => onGuardar({ nombre, tipo, monto_usd: monto || null, suscripcion_meses: esSus ? (meses || null) : null })}
      onClose={onClose}
    >
      {cuerpo()}
    </WizardShell>
  );
}

export function ProductosView({ onListo }: { onListo?: (listo: boolean) => void } = {}) {
  const [est, setEst] = useState<Estado | null>(null);
  const [cargando, setCargando] = useState(true);
  const [sugiriendo, setSugiriendo] = useState(false);
  const [guardando, setGuardando] = useState(false);
  const [nuevo, setNuevo] = useState(false);
  const [err, setErr] = useState<string | null>(null);

  const cargar = useCallback(async () => {
    try {
      const r = await fetch('/api/onboarding/productos').then((x) => x.json());
      if (r?.ok) setEst({ productos: r.productos ?? [], tieneContexto: !!r.tieneContexto });
      else setErr(r?.error ?? 'No se pudo cargar');
    } catch { setErr('No se pudo cargar'); }
    finally { setCargando(false); }
  }, []);
  useEffect(() => { cargar(); }, [cargar]);
  useEffect(() => { onListo?.(!!est && est.productos.length > 0); }, [est, onListo]);

  const post = async (body: Record<string, unknown>) => {
    const r = await fetch('/api/onboarding/productos', { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify(body) }).then((x) => x.json());
    if (r?.ok) { setEst({ productos: r.productos ?? [], tieneContexto: !!r.tieneContexto }); setErr(null); }
    else setErr(r?.error ?? 'No se pudo guardar');
    return !!r?.ok;
  };

  const sugerir = async () => { setSugiriendo(true); setErr(null); await post({ action: 'sugerir' }); setSugiriendo(false); };
  const guardarCampo = (p: Producto, patch: Partial<Producto>) => { void post({ action: 'guardar', producto: { ...p, ...patch } }); };
  const borrar = (id: number) => { void post({ action: 'borrar', id }); };

  if (cargando) return <div style={{ fontFamily: SANS, fontSize: 14, color: 'var(--faint)', padding: 20 }}>Cargando tus productos…</div>;

  const productos = est?.productos ?? [];

  return (
    <div style={{ fontFamily: SANS }}>
      <style>{'@keyframes prod-spin{to{transform:rotate(360deg)}} .prod-edit:empty:before{content:attr(data-ph);color:var(--faint)} .prod-edit:hover{background:var(--surface-2)}'}</style>

      {/* Lo primero es que MaKo los arme: el dueño ya cargó el brief y los documentos. */}
      {productos.length === 0 && (
        <div style={{ textAlign: 'center', padding: '18px 0 8px' }}>
          <div style={{ fontSize: 15, color: 'var(--ink)', lineHeight: 1.6, maxWidth: 520, margin: '0 auto 18px' }}>
            {est?.tieneContexto
              ? 'Ya cargaste tu negocio y tus documentos. MaKo puede armar tu catálogo con eso — tú solo corriges lo que no le salga bien.'
              : 'Todavía no hay con qué armarlos solos: carga tu negocio o sube un documento en El Archivero, o agrégalos a mano aquí abajo.'}
          </div>
          <div style={{ display: 'flex', gap: 10, justifyContent: 'center', flexWrap: 'wrap' }}>
            {est?.tieneContexto && (
              <button type="button" onClick={sugerir} disabled={sugiriendo} style={{ ...btnPrimary, opacity: sugiriendo ? .7 : 1 }}>
                {sugiriendo ? <><MiniSpin light /> Leyendo tu negocio…</> : '✦ Ármalos tú, MaKo'}
              </button>
            )}
            <button type="button" onClick={() => setNuevo(true)} style={btnGhost}>+ Agregar a mano</button>
          </div>
        </div>
      )}

      {productos.length > 0 && (
        <>
          <div style={{ display: 'flex', alignItems: 'baseline', justifyContent: 'space-between', marginBottom: 12, gap: 12, flexWrap: 'wrap' }}>
            <span style={eyebrow}>{productos.length} producto{productos.length === 1 ? '' : 's'}</span>
            <div style={{ display: 'flex', gap: 14, alignItems: 'center' }}>
              {est?.tieneContexto && (
                <button type="button" onClick={sugerir} disabled={sugiriendo} style={linkBtn}>
                  {sugiriendo ? 'Completando…' : '✦ Que MaKo complete lo que falta'}
                </button>
              )}
              <button type="button" onClick={() => setNuevo(true)} style={linkBtn}>+ Agregar otro</button>
            </div>
          </div>

          <div style={{ display: 'flex', flexDirection: 'column', gap: 10 }}>
            {productos.map((p) => (
              <div key={p.id} style={{ border: '1px solid var(--border)', borderRadius: 14, padding: '15px 17px', background: 'var(--surface)' }}>
                <div style={{ display: 'flex', alignItems: 'flex-start', justifyContent: 'space-between', gap: 12 }}>
                  <Edit valor={p.nombre} ph="Nombre del producto" onSave={(v) => guardarCampo(p, { nombre: v })} style={{ fontSize: 16.5, fontWeight: 650, color: 'var(--ink)' }} />
                  <button type="button" onClick={() => borrar(p.id)} aria-label={`Borrar ${p.nombre}`} style={{ border: 'none', background: 'transparent', color: 'var(--faint)', cursor: 'pointer', fontSize: 16, lineHeight: 1, padding: 2, flex: 'none' }}>×</button>
                </div>

                {/* Tipo y precio: se tocan, no se escriben. */}
                <div style={{ display: 'flex', gap: 8, alignItems: 'center', flexWrap: 'wrap', marginTop: 10 }}>
                  <button type="button" onClick={() => guardarCampo(p, { tipo: p.tipo === 'unico' ? 'suscripcion' : 'unico' })}
                    style={{ padding: '5px 11px', borderRadius: 999, border: '1px solid var(--border-strong)', background: 'var(--surface-2)', color: 'var(--dim)', fontSize: 12.5, fontWeight: 600, cursor: 'pointer', fontFamily: SANS }}>
                    {p.tipo === 'suscripcion' ? '🔁 Suscripción mensual' : 'Pago único'}
                  </button>
                  <span style={{ fontSize: 13.5, color: 'var(--dim)' }}>
                    <Edit valor={p.monto_usd != null ? String(p.monto_usd) : ''} ph="precio"
                      onSave={(v) => { const n = parseFloat(v.replace(/[^\d.]/g, '')); guardarCampo(p, { monto_usd: Number.isFinite(n) ? n : null }); }}
                      style={{ display: 'inline-block', minWidth: 46, fontWeight: 650, color: 'var(--ink)' }} />
                    <span style={{ marginLeft: 2 }}>USD{p.tipo === 'suscripcion' ? '/mes' : ''}</span>
                  </span>
                  {p.tipo === 'suscripcion' && (
                    <span style={{ fontSize: 12.5, color: 'var(--faint)' }}>· {p.suscripcion_meses ? `${p.suscripcion_meses} meses` : 'indefinida'}</span>
                  )}
                </div>

                {/* Lo que MaKo completó del brief y los documentos. */}
                <div style={{ marginTop: 11, display: 'flex', flexDirection: 'column', gap: 7 }}>
                  <div><span style={eyebrow}>Promesa</span><Edit valor={p.promesa ?? ''} ph="La transformación que compra el cliente" onSave={(v) => guardarCampo(p, { promesa: v })} style={{ fontSize: 13.5, color: 'var(--ink)', lineHeight: 1.5 }} /></div>
                  <div><span style={eyebrow}>Incluye</span><Edit valor={p.incluye ?? ''} ph="Los entregables" onSave={(v) => guardarCampo(p, { incluye: v })} style={{ fontSize: 13.5, color: 'var(--ink)', lineHeight: 1.5 }} /></div>
                  <div><span style={eyebrow}>Garantía</span><Edit valor={p.garantia ?? ''} ph="Si tienes" onSave={(v) => guardarCampo(p, { garantia: v })} style={{ fontSize: 13.5, color: 'var(--ink)', lineHeight: 1.5 }} /></div>
                </div>
              </div>
            ))}
          </div>

          <p style={{ fontSize: 12.5, color: 'var(--faint)', marginTop: 14, lineHeight: 1.55 }}>
            Este catálogo es el que usa el CRM: al cerrar un lead eliges uno y el deal hereda su precio y su forma de cobro.
          </p>
        </>
      )}

      {err && <div style={{ marginTop: 14, fontSize: 13.5, color: 'var(--bad)', lineHeight: 1.5 }}>{err}</div>}

      {nuevo && (
        <NuevoProducto
          pending={guardando}
          onClose={() => setNuevo(false)}
          onGuardar={async (p) => { setGuardando(true); const ok = await post({ action: 'guardar', producto: p }); setGuardando(false); if (ok) setNuevo(false); }}
        />
      )}
    </div>
  );
}
