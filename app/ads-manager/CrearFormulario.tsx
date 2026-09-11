'use client';

// =============================================================================
// CrearFormulario — un formulario instantáneo nuevo, sin salir de MaKo
// =============================================================================
// Aparece en el paso «¿Qué formulario instantáneo usas?» (y compacto en «Agregar
// conjunto»). Pide lo mínimo que Meta exige, con todo lo demás prellenado: las tres
// preguntas del perfil marcadas, el tipo «mayor intención» y la web del botón final
// (la landing cargada en MaKo o la web de la página). Lo único que no se puede
// adivinar es la política de privacidad, y Meta no publica un formulario sin ella.
//
// Crea en la página de Facebook del cliente: el botón dice eso pegado al botón, no
// reintenta solo, y se deshabilita mientras el pedido está en vuelo.
// =============================================================================

import { useEffect, useState, type CSSProperties } from 'react';
import {
  ETIQUETA_ESTANDAR, MAX_PREGUNTAS_PROPIAS, PREGUNTAS_ESTANDAR, erroresFormulario,
  type FormularioNuevo, type PreguntaEstandar,
} from '@/lib/meta-formularios';

const MONO = "'Geist Mono', monospace";
const SANS = "'Geist', sans-serif";

const hoy = () => new Date().toLocaleDateString('es-MX', { day: '2-digit', month: '2-digit', year: '2-digit' });

export function CrearFormulario({ onCreado, onCancelar, compacto = false, pageId = null }: {
  onCreado: (f: { id: string; name: string }) => void;
  onCancelar: () => void;
  compacto?: boolean;
  /** Página donde se crea. null = la de la credencial. */
  pageId?: string | null;
}) {
  const [f, setF] = useState<FormularioNuevo>({
    nombre: `Formulario MaKo ${hoy()}`,
    estandar: [...PREGUNTAS_ESTANDAR],
    propias: [],
    mayorIntencion: true,
    privacidadUrl: '',
    sitioUrl: '',
  });
  const [creando, setCreando] = useState(false);
  const [error, setError] = useState<string | null>(null);

  // Prellenar la web del botón final con lo que MaKo ya sabe. Si no llega, se escribe.
  useEffect(() => {
    let vivo = true;
    fetch(`/api/ads-manager/formulario-create${pageId ? `?page=${pageId}` : ''}`, { cache: 'no-store' }).then((r) => r.json())
      .then((j) => {
        if (!vivo || !j.ok || !j.base) return;
        const sugerido = (Array.isArray(j.base.landings) && j.base.landings[0]) || j.base.sitio || '';
        if (sugerido) setF((x) => (x.sitioUrl ? x : { ...x, sitioUrl: sugerido }));
      })
      .catch(() => { /* sin prellenado: el campo queda para escribir */ });
    return () => { vivo = false; };
  }, [pageId]);

  const faltan = erroresFormulario(f);
  const set = (patch: Partial<FormularioNuevo>) => { setF((x) => ({ ...x, ...patch })); setError(null); };
  const toggle = (t: PreguntaEstandar) => set({ estandar: f.estandar.includes(t) ? f.estandar.filter((x) => x !== t) : [...f.estandar, t] });

  async function crear() {
    if (faltan.length || creando) return;
    setCreando(true); setError(null);
    try {
      const r = await fetch('/api/ads-manager/formulario-create', { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify({ formulario: f, page: pageId }) });
      const j = await r.json();
      if (!j.ok || !j.formulario?.id) throw new Error(j.error || 'Meta no creó el formulario.');
      onCreado({ id: String(j.formulario.id), name: String(j.formulario.name ?? f.nombre) });
    } catch (e) {
      setError(e instanceof Error ? e.message : String(e));
    } finally {
      setCreando(false);
    }
  }

  const fs = compacto ? 13.5 : 15;
  const lbl: CSSProperties = { fontFamily: MONO, fontSize: 10.5, letterSpacing: '.08em', textTransform: 'uppercase', color: 'var(--faint)', marginBottom: 6, display: 'block' };
  const campo: CSSProperties = { width: '100%', boxSizing: 'border-box', padding: compacto ? '10px 12px' : '12px 14px', borderRadius: 11, border: '1px solid var(--border-strong)', background: 'var(--surface-2)', color: 'var(--ink)', fontFamily: SANS, fontSize: fs, outline: 'none' };
  const chip = (on: boolean): CSSProperties => ({ padding: compacto ? '6px 12px' : '8px 15px', borderRadius: 999, border: `1px solid ${on ? 'var(--primary)' : 'var(--border-strong)'}`, background: on ? 'rgba(47,111,237,.10)' : 'var(--surface)', color: on ? 'var(--primary-strong)' : 'var(--dim)', fontFamily: SANS, fontSize: compacto ? 12.5 : 14, cursor: 'pointer' });

  return (
    <div style={{ width: '100%', maxWidth: compacto ? undefined : 500, display: 'flex', flexDirection: 'column', gap: compacto ? 12 : 16, textAlign: 'left', alignSelf: 'center' }}>
      <label>
        <span style={lbl}>Nombre</span>
        <input value={f.nombre} onChange={(e) => set({ nombre: e.target.value })} style={campo} />
      </label>

      <div>
        <span style={lbl}>Preguntas</span>
        <div style={{ display: 'flex', gap: 7, flexWrap: 'wrap' }}>
          {PREGUNTAS_ESTANDAR.map((t) => (
            <button key={t} type="button" onClick={() => toggle(t)} style={chip(f.estandar.includes(t))}>{f.estandar.includes(t) ? '✓ ' : ''}{ETIQUETA_ESTANDAR[t]}</button>
          ))}
        </div>
        {f.propias.map((p, i) => (
          <div key={i} style={{ display: 'flex', gap: 7, marginTop: 8 }}>
            <input value={p} autoFocus={!p} placeholder="Tu pregunta, ej. ¿Qué tipo de propiedad buscas vender?"
              onChange={(e) => set({ propias: f.propias.map((x, k) => (k === i ? e.target.value : x)) })} style={campo} />
            <button type="button" aria-label="Quitar pregunta" onClick={() => set({ propias: f.propias.filter((_, k) => k !== i) })}
              style={{ width: 38, flex: 'none', borderRadius: 10, border: '1px solid var(--border-strong)', background: 'var(--surface)', color: 'var(--dim)', cursor: 'pointer' }}>✕</button>
          </div>
        ))}
        {f.propias.length < MAX_PREGUNTAS_PROPIAS && (
          <button type="button" onClick={() => set({ propias: [...f.propias, ''] })}
            style={{ marginTop: 8, border: 'none', background: 'transparent', color: 'var(--primary-strong)', fontFamily: SANS, fontSize: 13.5, fontWeight: 600, cursor: 'pointer', padding: 0 }}>+ Agregar una pregunta propia</button>
        )}
      </div>

      <div>
        <span style={lbl}>Tipo</span>
        <div style={{ display: 'flex', gap: 7, flexWrap: 'wrap' }}>
          <button type="button" onClick={() => set({ mayorIntencion: true })} style={chip(f.mayorIntencion)}>Mayor intención</button>
          <button type="button" onClick={() => set({ mayorIntencion: false })} style={chip(!f.mayorIntencion)}>Más volumen</button>
        </div>
        <p style={{ fontSize: 12, color: 'var(--faint)', margin: '6px 0 0', lineHeight: 1.45 }}>
          {f.mayorIntencion ? 'Revisan sus datos antes de enviar: llegan menos, y más reales.' : 'Se envía en un toque: llegan más, y menos filtrados.'}
        </p>
      </div>

      <label>
        <span style={lbl}>Link a tu política de privacidad</span>
        <input value={f.privacidadUrl} onChange={(e) => set({ privacidadUrl: e.target.value })} placeholder="https://tusitio.com/privacidad" style={campo} />
      </label>

      <label>
        <span style={lbl}>Al terminar, el botón lleva a</span>
        <input value={f.sitioUrl} onChange={(e) => set({ sitioUrl: e.target.value })} placeholder="https://tu-landing.com" style={campo} />
      </label>

      {error && <div style={{ fontSize: 13, color: 'var(--bad)', background: 'var(--bad-bg)', border: '1px solid var(--bad)', borderRadius: 10, padding: '10px 12px', lineHeight: 1.45 }}>{error}</div>}

      <div style={{ display: 'flex', flexDirection: 'column', gap: 8 }}>
        <div style={{ display: 'flex', gap: 10, justifyContent: 'flex-end', flexWrap: 'wrap' }}>
          <button type="button" onClick={onCancelar} disabled={creando}
            style={{ padding: '11px 18px', borderRadius: 12, border: '1px solid var(--border-strong)', background: 'var(--surface)', color: 'var(--dim)', fontFamily: SANS, fontSize: 14, cursor: creando ? 'default' : 'pointer' }}>Volver a elegir</button>
          <button type="button" onClick={crear} disabled={!!faltan.length || creando}
            style={{ padding: '11px 20px', borderRadius: 12, border: 'none', background: faltan.length || creando ? 'var(--border-strong)' : 'var(--ink)', color: 'var(--surface)', fontFamily: SANS, fontSize: 14.5, fontWeight: 600, cursor: faltan.length || creando ? 'default' : 'pointer' }}>
            {creando ? 'Creando en tu página…' : 'Crear formulario en tu página'}
          </button>
        </div>
        <p style={{ fontSize: 12.5, color: faltan.length ? 'var(--warn)' : 'var(--dim)', margin: 0, textAlign: 'right', lineHeight: 1.45 }}>
          {faltan.length ? faltan[0] : 'Se crea en tu página de Facebook y queda en tu Biblioteca de formularios.'}
        </p>
      </div>
    </div>
  );
}
