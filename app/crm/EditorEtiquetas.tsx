'use client';

// =============================================================================
// EditorEtiquetas — el CRUD de las etiquetas del CRM (mig 0224), adentro del editor del embudo
// =============================================================================
// Pedido de Martín (08/10/2026, punto 12): «esas etiquetas debería poder editarse, como un CRUD,
// que el usuario elija qué nombres ponerles y si están vinculadas a etapas del CRM... esas mismas
// etiquetas que se asignan en MaKo, se pongan en esas ambas plataformas».
//
// Vive como la TERCERA subtab de app/crm/EtapasModal.tsx —el lugar donde el CRM edita sus
// etapas— y no como un modal encima: un modal sobre otro necesita que el de abajo se declare
// `contenedor` (AGENTS.md, la pila de modales), y acá no hay nada que ganar con dos capas. Las
// etiquetas son del NEGOCIO, no del producto: la misma lista se ve desde cualquier producto, y
// el vínculo a una etapa nombra su producto.
//
// El molde del CRUD es app/_comunidad/EditorCategorias.tsx: cada cambio se guarda en el acto y
// lo que vuelve del server es lo que se dibuja. Nunca se BORRA una etiqueta: se archiva (lo que
// la nombra apunta a su id), y antes se dice cuántas automatizaciones y leads la usan.
//
// ⚠️ LAS DE WHATSAPP NO SE CREAN DESDE ACÁ: Evolution 2.3.7 no expone crearlas. Se elige a cuál
// del celular corresponde, de las que ya existen (sin las listas del sistema), y la pantalla lo
// dice en tres palabras. El porqué largo, en lib/evolution.ts.
// =============================================================================

import { useCallback, useEffect, useState, type CSSProperties } from 'react';
import { Confirm } from '@/app/_ui/Confirm';
import { Dropdown, type DropdownGroup } from '@/app/components/Dropdown';
import { avisarCambioEtiquetas, type Etiqueta } from '@/app/_components/etiquetas-cliente';
import { COLORES_ETIQUETA, TOPE_NOMBRE_ETIQUETA, consecuenciaDeArchivar } from '@/lib/etiquetas-reglas';

const SANS = "'Geist', sans-serif";

type Producto = { id: number; nombre: string; esDefault: boolean; etapas: Array<{ key: string; label: string; dot: string | null }> };
type LabelCelular = { labelId: string; nombre: string; color: number | null };
type Uso = { disparadores: number | null; condiciones: number | null; acciones: number | null; leads: number | null };
type Datos = { etiquetas: Etiqueta[]; leads: Record<string, number> | null; whatsapp: LabelCelular[]; productos: Producto[] };

const SIN = '__sin__';

/** `${funnelId|'n'}:${key}` — 'n' es el producto del negocio (funnel_id NULL). */
const claveVinculo = (funnelId: number | null, key: string) => `${funnelId ?? 'n'}:${key}`;

async function post(cuerpo: Record<string, unknown>): Promise<{ ok: true; etiqueta: Etiqueta } | { ok: false; error: string }> {
  try {
    const r = await fetch('/api/crm/etiquetas', { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify(cuerpo) });
    const j = await r.json() as { ok?: boolean; etiqueta?: Etiqueta; error?: string };
    if (!j.ok || !j.etiqueta) return { ok: false, error: j.error || 'No se pudo guardar.' };
    return { ok: true, etiqueta: j.etiqueta };
  } catch {
    return { ok: false, error: 'No se pudo guardar.' };
  }
}

/**
 * La consecuencia de archivar, para la confirmación: la MISMA frase que dice MaKo antes del «sí»
 * (lib/etiquetas-reglas.ts, `consecuenciaDeArchivar`, con la decisión del 08/10/2026 adentro).
 */
const frenoDe = (u: Uso): string | null => consecuenciaDeArchivar(u);

export function EditorEtiquetas() {
  const [datos, setDatos] = useState<Datos | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [nueva, setNueva] = useState('');
  const [enCurso, setEnCurso] = useState(false);
  const [aArchivar, setAArchivar] = useState<{ e: Etiqueta; freno: string } | null>(null);
  const [verArchivadas, setVerArchivadas] = useState(false);

  const cargar = useCallback(async () => {
    try {
      const r = await fetch('/api/crm/etiquetas?crud=1&archivadas=1', { cache: 'no-store' });
      const j = await r.json() as Partial<Datos> & { ok?: boolean; error?: string };
      if (!j.ok) throw new Error(j.error || 'No se pudieron leer.');
      setDatos({ etiquetas: j.etiquetas ?? [], leads: j.leads ?? null, whatsapp: j.whatsapp ?? [], productos: j.productos ?? [] });
    } catch (e) {
      setError(e instanceof Error ? e.message : 'No se pudieron leer.');
    }
  }, []);
  useEffect(() => { void cargar(); }, [cargar]);

  /** Aplica la etiqueta que devolvió el server. */
  const reemplazar = (e: Etiqueta) => {
    setDatos((d) => d ? { ...d, etiquetas: d.etiquetas.some((x) => x.id === e.id) ? d.etiquetas.map((x) => (x.id === e.id ? e : x)) : [...d.etiquetas, e] } : d);
    avisarCambioEtiquetas();
  };

  const correr = async (cuerpo: Record<string, unknown>) => {
    setEnCurso(true);
    setError(null);
    const r = await post(cuerpo);
    setEnCurso(false);
    if (!r.ok) { setError(r.error); return false; }
    reemplazar(r.etiqueta);
    return true;
  };

  const agregar = async () => {
    const n = nueva.trim();
    if (!n || enCurso) return;
    if (await correr({ action: 'crear', nombre: n })) setNueva('');
  };

  const pedirArchivar = async (e: Etiqueta) => {
    // ⚠️ SE PREGUNTA SÓLO SI ALGO LA USA: archivar una que nadie nombra no tiene nada que perder,
    // y una pregunta que no advierte enseña a ignorar las que sí.
    let freno: string | null = null;
    try {
      const r = await fetch(`/api/crm/etiquetas?uso=${e.id}`, { cache: 'no-store' });
      const j = await r.json() as { ok?: boolean; uso?: Uso };
      freno = j.ok && j.uso ? frenoDe(j.uso) : 'No pude ver quién la usa.';
    } catch { freno = 'No pude ver quién la usa.'; }
    if (freno) setAArchivar({ e, freno });
    else void correr({ action: 'archivar', id: e.id });
  };

  if (error && !datos) return <p role="alert" style={{ color: 'var(--bad)', fontSize: 13.5, fontFamily: SANS }}>{error}</p>;
  if (!datos) {
    return (
      <div style={{ display: 'flex', justifyContent: 'center', padding: '40px 0' }}>
        <span aria-label="Cargando" role="status" style={{ width: 22, height: 22, borderRadius: '50%', border: '2.5px solid var(--border)', borderTopColor: 'var(--primary)', animation: 'mk-giro .7s linear infinite', display: 'inline-block' }} />
      </div>
    );
  }

  const vivas = datos.etiquetas.filter((e) => !e.archivada_at);
  const archivadas = datos.etiquetas.filter((e) => e.archivada_at);
  // El vínculo se elige por producto: una columna por producto con sus etapas.
  const columnas: DropdownGroup[][] = [[{ title: '', options: [{ value: SIN, label: 'Sin etapa' }] }],
    ...datos.productos.map((p) => [{ title: p.nombre, options: p.etapas.map((s) => ({ value: claveVinculo(p.esDefault ? null : p.id, s.key), label: s.label, color: s.dot ?? undefined })) }])];
  const etiquetaDeVinculo = (e: Etiqueta): string | null => {
    if (!e.etapa_key) return null;
    const p = datos.productos.find((x) => (e.funnel_id == null ? x.esDefault : x.id === e.funnel_id));
    const s = p?.etapas.find((x) => x.key === e.etapa_key);
    return s ? (datos.productos.length > 1 ? `${p!.nombre} · ${s.label}` : s.label) : e.etapa_key;
  };
  // El último renglón dice lo único que hay que saber de esta lista: las de WhatsApp no se crean acá.
  const opcionesWa = [{ value: SIN, label: 'Sin WhatsApp' }, ...datos.whatsapp.map((l) => ({ value: l.labelId, label: l.nombre })),
    { value: '__info__', label: 'Se crean en el celular', disabled: true, sutil: true }];

  return (
    <div style={{ display: 'flex', flexDirection: 'column', gap: 6, fontFamily: SANS }}>
      {vivas.length === 0 && <p style={{ fontSize: 13.5, color: 'var(--dim)', margin: '0 0 6px' }}>Sin etiquetas todavía.</p>}
      {vivas.map((e) => (
        <FilaEtiqueta key={`${e.id}:${e.nombre}`} e={e} leads={datos.leads?.[String(e.id)] ?? null} enCurso={enCurso}
          columnas={columnas} vinculo={etiquetaDeVinculo(e)} opcionesWa={opcionesWa} hayWa={datos.whatsapp.length > 0}
          onGuardar={(cambio) => void correr({ action: 'editar', id: e.id, ...cambio })}
          onArchivar={() => void pedirArchivar(e)} />
      ))}

      <div style={{ display: 'flex', gap: 8, alignItems: 'center', marginTop: 6 }}>
        <input value={nueva} maxLength={TOPE_NOMBRE_ETIQUETA} placeholder="Nueva etiqueta" aria-label="Nombre de la etiqueta nueva"
          onChange={(ev) => setNueva(ev.target.value)} onKeyDown={(ev) => { if (ev.key === 'Enter') void agregar(); }}
          style={{ flex: '1 1 200px', minWidth: 0, height: 36, padding: '0 12px', borderRadius: 10, border: '1px solid var(--border-strong)', background: 'var(--surface)', color: 'var(--ink)', fontSize: 14, fontFamily: SANS }} />
        <button type="button" className="mk-icon-btn" onClick={() => void agregar()} disabled={enCurso || !nueva.trim()}
          style={{ height: 36, padding: '0 14px', fontSize: 13.5, fontWeight: 600 }}>Agregar</button>
      </div>
      {error && <p role="alert" style={{ color: 'var(--bad)', fontSize: 13, margin: '4px 0 0' }}>{error}</p>}

      {archivadas.length > 0 && (
        <div style={{ marginTop: 14 }}>
          <button type="button" onClick={() => setVerArchivadas((v) => !v)} aria-expanded={verArchivadas}
            style={{ background: 'none', border: 'none', padding: 0, color: 'var(--dim)', fontSize: 13, fontWeight: 600, cursor: 'pointer', fontFamily: SANS }}>
            Archivadas ({archivadas.length}) {verArchivadas ? '▴' : '▾'}
          </button>
          {verArchivadas && archivadas.map((e) => (
            <div key={e.id} style={{ display: 'flex', alignItems: 'center', gap: 8, padding: '6px 0' }}>
              <span aria-hidden style={{ width: 10, height: 10, borderRadius: 999, background: e.color, flex: 'none', opacity: 0.6 }} />
              <span style={{ flex: 1, minWidth: 0, fontSize: 13.5, color: 'var(--dim)', overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>{e.nombre}</span>
              <button type="button" className="mk-icon-btn" disabled={enCurso} onClick={() => void correr({ action: 'archivar', id: e.id, archivar: false })}
                style={{ height: 30, padding: '0 10px', fontSize: 12.5 }}>Recuperar</button>
            </div>
          ))}
        </div>
      )}

      {aArchivar && (
        <Confirm
          title={`¿Archivar «${aArchivar.e.nombre}»?`}
          message={aArchivar.freno}
          confirmLabel="Archivar etiqueta" cancelLabel="No archivar" tone="danger" loading={enCurso}
          onConfirm={async () => { const e = aArchivar.e; await correr({ action: 'archivar', id: e.id }); setAArchivar(null); }}
          onCancel={() => setAArchivar(null)} />
      )}
    </div>
  );
}

function FilaEtiqueta({ e, leads, enCurso, columnas, vinculo, opcionesWa, hayWa, onGuardar, onArchivar }: {
  e: Etiqueta;
  leads: number | null;
  enCurso: boolean;
  columnas: DropdownGroup[][];
  vinculo: string | null;
  opcionesWa: Array<{ value: string; label: string; disabled?: boolean; sutil?: boolean }>;
  hayWa: boolean;
  onGuardar: (cambio: Record<string, unknown>) => void;
  onArchivar: () => void;
}) {
  // El nombre se siembra de la fila; si el server lo cambia, la fila se remonta (`key` con el nombre).
  const [nombre, setNombre] = useState(e.nombre);
  const guardarNombre = () => { const n = nombre.trim(); if (n && n !== e.nombre) onGuardar({ nombre: n }); else setNombre(e.nombre); };
  const boton: CSSProperties = { height: 32, padding: '0 10px', borderRadius: 9, fontSize: 12.5 };
  return (
    <div style={{ display: 'flex', flexWrap: 'wrap', alignItems: 'center', gap: 8, padding: '4px 0' }}>
      {/* `value` vacío a propósito: con el color elegido, el botón dibujaría su punto Y el ícono. */}
      <Dropdown value="" width={44} ariaLabel={`Color de ${e.nombre}`} sinFlecha search={false}
        icono={<span aria-hidden style={{ width: 14, height: 14, borderRadius: 999, background: e.color, display: 'inline-block' }} />}
        botonLabel=" " buttonStyle={{ ...boton, padding: '0 8px' }}
        options={COLORES_ETIQUETA.map((c) => ({ value: c, label: c, color: c }))}
        onChange={(c) => { if (c !== e.color) onGuardar({ color: c }); }} />
      <input value={nombre} maxLength={TOPE_NOMBRE_ETIQUETA} aria-label="Nombre" disabled={enCurso}
        onChange={(ev) => setNombre(ev.target.value)} onBlur={guardarNombre}
        onKeyDown={(ev) => { if (ev.key === 'Enter') (ev.target as HTMLInputElement).blur(); }}
        style={{ flex: '1 1 160px', minWidth: 0, height: 32, padding: '0 10px', borderRadius: 9, border: '1px solid var(--border)', background: 'var(--surface)', color: 'var(--ink)', fontSize: 14, fontWeight: 600, fontFamily: SANS }} />
      <Dropdown value={vinculo ? claveVinculo(e.funnel_id, e.etapa_key ?? '') : ''} placeholder="Etapa" width={190}
        ariaLabel={`Etapa vinculada a ${e.nombre}`} buttonStyle={boton} columns={columnas} disabled={enCurso}
        botonLabel={vinculo ?? undefined}
        onChange={(v) => {
          if (v === SIN) { if (e.etapa_key) onGuardar({ vinculo: null }); return; }
          const i = v.indexOf(':');
          const f = v.slice(0, i);
          onGuardar({ vinculo: { funnelId: f === 'n' ? null : Number(f), etapaKey: v.slice(i + 1) } });
        }} />
      <span title={hayWa ? undefined : 'Se crean en el celular'} style={{ display: 'inline-flex' }}>
        <Dropdown value={e.wa_label_id ?? ''} placeholder={hayWa ? 'WhatsApp' : 'Se crean en el celular'} width={170}
          ariaLabel={`Etiqueta de WhatsApp de ${e.nombre}`} buttonStyle={boton} options={opcionesWa} disabled={enCurso || !hayWa}
          onChange={(v) => {
            if (v === SIN) { if (e.wa_label_id) onGuardar({ waLabelId: null }); return; }
            if (v !== e.wa_label_id) onGuardar({ waLabelId: v });
          }} />
      </span>
      <span title="Leads con esta etiqueta" style={{ minWidth: 28, textAlign: 'right', fontSize: 12.5, color: 'var(--dim)', fontVariantNumeric: 'tabular-nums' }}>{leads ?? '—'}</span>
      <button type="button" className="mk-icon-btn" data-tone="bad" onClick={onArchivar} disabled={enCurso}
        aria-label={`Archivar ${e.nombre}`} title="Archivar" style={{ height: 32, width: 32 }}>×</button>
    </div>
  );
}
