'use client';

// =============================================================================
// PlantillasPanel — gestión de plantillas de WhatsApp para aprobar en Meta
// =============================================================================
// Features: (1) validador con MaKo al editar, (3) enviar a aprobar a Meta con
// confirmación, (4) ver status (borrador/pending/approved/rejected) y filtrar.
// Las aprobadas vienen en vivo de Meta; los borradores de whatsapp_template_drafts.

import { useCallback, useEffect, useMemo, useState, type CSSProperties } from 'react';
import { Dropdown } from '../components/Dropdown';

const SANS = "'Geist', sans-serif";
const MONO = "'Geist Mono', monospace";

const ETAPAS = [
  { value: '', label: 'Sin etapa' },
  { value: 'nutri', label: 'Nutrición' },
  { value: 'postagenda', label: 'Post-agenda' },
  { value: 'noshow', label: 'No-show' },
  { value: 'nopaga', label: 'No paga' },
  { value: 'manual', label: 'Manual' },
];
const CATEGORIAS = [
  { value: 'marketing', label: 'Marketing' },
  { value: 'utility', label: 'Utility' },
  { value: 'authentication', label: 'Authentication' },
];

type Button = { type: 'QUICK_REPLY' | 'URL' | 'PHONE_NUMBER'; text: string; url?: string; phone_number?: string };
type Param = { name: string; example: string };
type Validacion = { riesgo: 'ALTO' | 'MEDIO' | 'BAJO'; categoria_sugerida: string; bloqueantes: string[]; razones: string[]; correcciones: string[] };
type Draft = {
  id?: number; name: string; language: string; category: 'marketing' | 'utility' | 'authentication';
  body: string; header?: string | null; footer?: string | null; buttons: Button[]; params: Param[];
  status: string; meta_template_id?: string | null; rejection_reason?: string | null; validacion?: Validacion | null; etapa?: string | null;
};
type MetaTpl = { name: string; language: string; category: string; status: string; body: string; params: string[]; metaId: string | null };

// Una fila unificada de la lista (borrador local o plantilla real de Meta).
type Item =
  | { kind: 'draft'; draft: Draft }
  | { kind: 'meta'; meta: MetaTpl };

const STATUS_META: Record<string, { label: string; color: string; bg: string }> = {
  borrador: { label: 'Borrador', color: 'var(--dim)', bg: 'var(--surface-2)' },
  pending: { label: 'En revisión', color: 'var(--warn)', bg: 'var(--auto-bubble)' },
  approved: { label: 'Aprobada', color: 'var(--good)', bg: 'var(--good-bg)' },
  rejected: { label: 'Rechazada', color: 'var(--bad)', bg: 'var(--bad-bg)' },
  paused: { label: 'Pausada', color: 'var(--dim)', bg: 'var(--surface-2)' },
  disabled: { label: 'Deshabilitada', color: 'var(--faint)', bg: 'var(--surface-2)' },
};
const statusChip = (s: string) => STATUS_META[s.toLowerCase()] ?? { label: s, color: 'var(--dim)', bg: 'var(--surface-2)' };

const RIESGO_META: Record<string, { color: string; bg: string; label: string }> = {
  ALTO: { color: 'var(--bad)', bg: 'var(--bad-bg)', label: 'Riesgo ALTO de rechazo' },
  MEDIO: { color: 'var(--warn)', bg: 'var(--auto-bubble)', label: 'Riesgo MEDIO' },
  BAJO: { color: 'var(--good)', bg: 'var(--good-bg)', label: 'Riesgo BAJO — probable aprobación' },
};

const FILTROS = [
  { value: 'todos', label: 'Todas' },
  { value: 'borrador', label: 'Borradores' },
  { value: 'pending', label: 'En revisión' },
  { value: 'approved', label: 'Aprobadas' },
  { value: 'rejected', label: 'Rechazadas' },
];

const emptyDraft = (): Draft => ({ name: '', language: 'es_MX', category: 'marketing', body: '', header: '', footer: '', buttons: [], params: [], status: 'borrador', etapa: '' });

// Variables {{nombre}} del cuerpo (únicas, en orden). DEBEN ser nombradas (empezar
// con letra o _): Meta usa parameter_format NAMED y rechaza posicionales {{1}}.
function detectarVars(text: string): string[] {
  const out: string[] = [];
  const re = /\{\{\s*([a-z_][a-z0-9_]*)\s*\}\}/gi;
  let m: RegExpExecArray | null;
  while ((m = re.exec(text)) !== null) { const n = m[1].toLowerCase(); if (!out.includes(n)) out.push(n); }
  return out;
}

const inputBase: CSSProperties = { width: '100%', padding: '10px 12px', borderRadius: 10, border: '1px solid var(--border-strong)', background: 'var(--surface-2)', color: 'var(--ink)', fontFamily: SANS, fontSize: 13.5, outline: 'none' };
const labelBase: CSSProperties = { display: 'block', fontSize: 12, color: 'var(--dim)', marginBottom: 5, fontWeight: 600 };

export function PlantillasPanel() {
  const [drafts, setDrafts] = useState<Draft[]>([]);
  const [metas, setMetas] = useState<MetaTpl[]>([]);
  const [loading, setLoading] = useState(true);
  const [filtro, setFiltro] = useState('todos');
  const [filtroEtapa, setFiltroEtapa] = useState('todas');
  const [sel, setSel] = useState<Item | null>(null);
  const [edit, setEdit] = useState<Draft | null>(null);  // borrador en edición (o null)
  const [validando, setValidando] = useState(false);
  const [validacion, setValidacion] = useState<Validacion | null>(null);
  const [guardando, setGuardando] = useState(false);
  const [confirmEnviar, setConfirmEnviar] = useState(false);
  const [enviando, setEnviando] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [aviso, setAviso] = useState<string | null>(null);

  const cargar = useCallback(async () => {
    setLoading(true);
    try {
      const j = await fetch('/api/whatsapp/templates/drafts').then((r) => r.json());
      if (j.ok) { setDrafts(j.drafts ?? []); setMetas(j.meta ?? []); }
      else setError(j.error || 'No se pudieron cargar las plantillas.');
    } catch (e) { setError(e instanceof Error ? e.message : String(e)); }
    finally { setLoading(false); }
  }, []);

  useEffect(() => { void cargar(); }, [cargar]);

  // Lista unificada: borradores locales + plantillas de Meta que NO tienen borrador
  // con el mismo nombre (evita duplicar las ya enviadas que seguimos viendo localmente).
  const items: Item[] = useMemo(() => {
    const draftNames = new Set(drafts.map((d) => `${d.name}::${d.language}`));
    const out: Item[] = drafts.map((d) => ({ kind: 'draft', draft: d }));
    for (const m of metas) {
      if (!draftNames.has(`${m.name}::${m.language}`)) out.push({ kind: 'meta', meta: m });
    }
    return out;
  }, [drafts, metas]);

  const itemsFiltrados = useMemo(() => items.filter((it) => {
    const status = (it.kind === 'draft' ? it.draft.status : it.meta.status).toLowerCase();
    const etapa = it.kind === 'draft' ? (it.draft.etapa ?? '') : '';
    if (filtro !== 'todos' && status !== filtro) return false;
    if (filtroEtapa !== 'todas' && etapa !== filtroEtapa) return false;
    return true;
  }), [items, filtro, filtroEtapa]);

  const abrirNueva = () => { setSel(null); setEdit(emptyDraft()); setValidacion(null); setError(null); setAviso(null); };
  const abrirItem = (it: Item) => {
    setSel(it); setError(null); setAviso(null);
    if (it.kind === 'draft') {
      setEdit({ ...it.draft, header: it.draft.header ?? '', footer: it.draft.footer ?? '', buttons: it.draft.buttons ?? [], params: it.draft.params ?? [] });
      setValidacion(it.draft.validacion ?? null);
    } else {
      setEdit(null); setValidacion(null);  // las de Meta son sólo lectura
    }
  };

  // Sincroniza la lista de params con las variables del CUERPO (header/footer van
  // estáticos; Meta requiere el ejemplo de cada variable del body).
  const syncParams = (d: Draft): Param[] => {
    const vars = detectarVars(d.body);
    return vars.map((v) => d.params.find((p) => p.name === v) ?? { name: v, example: '' });
  };
  const patchEdit = (patch: Partial<Draft>) => {
    setEdit((cur) => {
      if (!cur) return cur;
      const next = { ...cur, ...patch };
      next.params = syncParams(next);
      return next;
    });
    setValidacion(null); // cualquier cambio invalida la validación previa
  };
  const setParamExample = (name: string, example: string) =>
    setEdit((cur) => (cur ? { ...cur, params: cur.params.map((p) => (p.name === name ? { ...p, example } : p)) } : cur));

  const validar = async () => {
    if (!edit) return;
    setValidando(true); setError(null);
    try {
      const j = await fetch('/api/whatsapp/templates/validate', {
        method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify({ draft: edit }),
      }).then((r) => r.json());
      if (j.ok) setValidacion(j.validacion);
      else setError(j.error || 'No se pudo validar.');
    } catch (e) { setError(e instanceof Error ? e.message : String(e)); }
    finally { setValidando(false); }
  };

  const guardar = async (): Promise<number | null> => {
    if (!edit) return null;
    setGuardando(true); setError(null);
    try {
      const j = await fetch('/api/whatsapp/templates/drafts', {
        method: 'POST', headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ draft: { ...edit, validacion } }),
      }).then((r) => r.json());
      if (!j.ok) { setError(j.error || 'No se pudo guardar.'); return null; }
      await cargar();
      setEdit({ ...j.draft, header: j.draft.header ?? '', footer: j.draft.footer ?? '', buttons: j.draft.buttons ?? [], params: j.draft.params ?? [] });
      setSel({ kind: 'draft', draft: j.draft });
      setAviso('Borrador guardado.');
      return j.draft.id ?? null;
    } catch (e) { setError(e instanceof Error ? e.message : String(e)); return null; }
    finally { setGuardando(false); }
  };

  const enviarAMeta = async () => {
    if (!edit) return;
    setEnviando(true); setError(null);
    try {
      // Guardar primero (asegura id + última versión), luego enviar.
      const id = edit.id ?? (await guardar());
      if (!id) { setEnviando(false); setConfirmEnviar(false); return; }
      const j = await fetch('/api/whatsapp/templates/drafts', {
        method: 'PATCH', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify({ action: 'submit', id }),
      }).then((r) => r.json());
      if (!j.ok) setError(j.error || 'Meta rechazó la solicitud.');
      else {
        setAviso('✓ Enviada a Meta. Queda en revisión (suele tardar minutos).');
        setEdit((cur) => (cur ? { ...cur, status: 'pending' } : cur));
        await cargar();
      }
    } catch (e) { setError(e instanceof Error ? e.message : String(e)); }
    finally { setEnviando(false); setConfirmEnviar(false); }
  };

  const borrar = async (id: number) => {
    setError(null);
    try {
      const j = await fetch(`/api/whatsapp/templates/drafts?id=${id}`, { method: 'DELETE' }).then((r) => r.json());
      if (!j.ok) { setError(j.error || 'No se pudo borrar.'); return; }
      await cargar(); setEdit(null); setSel(null);
    } catch (e) { setError(e instanceof Error ? e.message : String(e)); }
  };

  const reconciliar = async () => {
    await fetch('/api/whatsapp/templates/drafts', { method: 'PATCH', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify({ action: 'reconcile' }) });
    await cargar();
  };

  const nombreOk = edit ? /^[a-z0-9_]{1,512}$/.test(edit.name) : false;
  const bodyOk = edit ? edit.body.trim().length > 0 : false;
  const paramsCompletos = edit ? edit.params.every((p) => p.example.trim()) : false;
  const puedeGuardar = nombreOk && bodyOk && !guardando;
  const puedeEnviar = puedeGuardar && paramsCompletos && (edit?.status === 'borrador' || edit?.status === 'rejected');

  const btnPrimary: CSSProperties = { padding: '9px 16px', borderRadius: 10, border: 'none', background: '#171511', color: '#F3F0E7', fontFamily: SANS, fontSize: 13, fontWeight: 600, cursor: 'pointer' };
  const btnGhost: CSSProperties = { padding: '9px 16px', borderRadius: 10, border: '1px solid var(--border-strong)', background: 'var(--surface)', color: 'var(--dim)', fontFamily: SANS, fontSize: 13, fontWeight: 600, cursor: 'pointer' };

  return (
    <div style={{ flex: 1, minHeight: 0, display: 'grid', gridTemplateColumns: '330px 1fr', gap: 16 }}>
      {/* LISTA */}
      <div style={{ background: 'var(--surface)', border: '1px solid var(--border)', borderRadius: 16, display: 'flex', flexDirection: 'column', minHeight: 0, overflow: 'hidden' }}>
        <div style={{ padding: '14px 14px 12px', borderBottom: '1px solid var(--border)', display: 'flex', flexDirection: 'column', gap: 9 }}>
          <button onClick={abrirNueva} style={{ ...btnPrimary, width: '100%' }}>+ Nueva plantilla</button>
          <Dropdown value={filtro} onChange={setFiltro} width="100%" ariaLabel="Filtrar por estado" options={FILTROS} buttonStyle={{ padding: '8px 11px', fontSize: 13 }} />
          <Dropdown value={filtroEtapa} onChange={setFiltroEtapa} width="100%" ariaLabel="Filtrar por etapa" options={[{ value: 'todas', label: 'Todas las etapas' }, ...ETAPAS.filter((e) => e.value)]} buttonStyle={{ padding: '8px 11px', fontSize: 13 }} />
        </div>
        <div style={{ flex: 1, minHeight: 0, overflowY: 'auto', padding: 8, display: 'flex', flexDirection: 'column', gap: 6 }}>
          {loading && <div style={{ padding: 16, color: 'var(--dim)', fontSize: 13.5 }}>Cargando…</div>}
          {!loading && itemsFiltrados.length === 0 && <div style={{ padding: 16, color: 'var(--faint)', fontSize: 13.5 }}>Sin plantillas en este filtro.</div>}
          {itemsFiltrados.map((it, idx) => {
            const name = it.kind === 'draft' ? it.draft.name : it.meta.name;
            const status = it.kind === 'draft' ? it.draft.status : it.meta.status.toLowerCase();
            const body = it.kind === 'draft' ? it.draft.body : it.meta.body;
            const etapa = it.kind === 'draft' ? (it.draft.etapa ?? '') : '';
            const chip = statusChip(status);
            const activo = sel && ((sel.kind === 'draft' && it.kind === 'draft' && sel.draft.id === it.draft.id) || (sel.kind === 'meta' && it.kind === 'meta' && sel.meta.name === it.meta.name));
            return (
              <div key={`${it.kind}-${name}-${idx}`} onClick={() => abrirItem(it)} style={{ padding: '11px 12px', borderRadius: 11, cursor: 'pointer', background: activo ? 'var(--surface-2)' : 'transparent', border: '1px solid ' + (activo ? 'var(--border-strong)' : 'transparent') }}>
                <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', gap: 8 }}>
                  <span style={{ fontWeight: 600, fontSize: 13.5, color: 'var(--ink)', whiteSpace: 'nowrap', overflow: 'hidden', textOverflow: 'ellipsis', fontFamily: MONO }}>{name || '(sin nombre)'}</span>
                  <span style={{ flex: 'none', fontSize: 10.5, fontWeight: 700, padding: '2px 8px', borderRadius: 999, color: chip.color, background: chip.bg }}>{chip.label}</span>
                </div>
                <div style={{ fontSize: 12, color: 'var(--dim)', marginTop: 3, whiteSpace: 'nowrap', overflow: 'hidden', textOverflow: 'ellipsis' }}>{body || '—'}</div>
                {etapa && <div style={{ fontSize: 10.5, color: 'var(--faint)', marginTop: 3, fontFamily: MONO }}>{ETAPAS.find((e) => e.value === etapa)?.label ?? etapa}</div>}
              </div>
            );
          })}
        </div>
        <button onClick={() => void reconciliar()} style={{ ...btnGhost, margin: 8, borderRadius: 10 }}>↻ Sincronizar status con Meta</button>
      </div>

      {/* DETALLE / EDITOR */}
      <div style={{ background: 'var(--surface)', border: '1px solid var(--border)', borderRadius: 16, display: 'flex', flexDirection: 'column', minHeight: 0, overflow: 'hidden' }}>
        {!edit && sel?.kind === 'meta' ? (
          <MetaView meta={sel.meta} />
        ) : !edit ? (
          <div style={{ flex: 1, display: 'flex', alignItems: 'center', justifyContent: 'center', color: 'var(--faint)', fontSize: 14, padding: 20, textAlign: 'center' }}>
            Elegí una plantilla de la lista o creá una nueva para redactarla, validarla con MaKo y enviarla a aprobar a Meta.
          </div>
        ) : (
          <div style={{ flex: 1, minHeight: 0, overflowY: 'auto', padding: 22, display: 'flex', flexDirection: 'column', gap: 14 }}>
            <div style={{ display: 'flex', gap: 12, flexWrap: 'wrap' }}>
              <div style={{ flex: '1 1 200px' }}>
                <label style={labelBase}>Nombre (minúsculas, guiones bajos)</label>
                <input value={edit.name} onChange={(e) => patchEdit({ name: e.target.value.toLowerCase().replace(/[^a-z0-9_]/g, '_') })} placeholder="recordatorio_24hs" style={{ ...inputBase, fontFamily: MONO, ...(edit.name && !nombreOk ? { borderColor: 'var(--bad)' } : {}) }} />
              </div>
              <div style={{ flex: '0 0 160px' }}>
                <label style={labelBase}>Categoría</label>
                <Dropdown value={edit.category} onChange={(v) => patchEdit({ category: v as Draft['category'] })} width="100%" ariaLabel="Categoría" options={CATEGORIAS} />
              </div>
              <div style={{ flex: '0 0 110px' }}>
                <label style={labelBase}>Idioma</label>
                <input value={edit.language} onChange={(e) => patchEdit({ language: e.target.value })} style={{ ...inputBase, fontFamily: MONO }} />
              </div>
              <div style={{ flex: '0 0 150px' }}>
                <label style={labelBase}>Etapa del funnel</label>
                <Dropdown value={edit.etapa ?? ''} onChange={(v) => patchEdit({ etapa: v })} width="100%" ariaLabel="Etapa" options={ETAPAS} />
              </div>
            </div>

            <div>
              <label style={labelBase}>Encabezado (opcional, máx 60, texto fijo sin variables)</label>
              <input value={edit.header ?? ''} maxLength={60} onChange={(e) => patchEdit({ header: e.target.value })} placeholder="Texto de encabezado" style={inputBase} />
            </div>

            <div>
              <label style={labelBase}>Cuerpo del mensaje · usá <code style={{ fontFamily: MONO, background: 'var(--surface-2)', border: '1px solid var(--border)', borderRadius: 4, padding: '1px 5px' }}>{'{{nombre}}'}</code> para variables</label>
              <textarea value={edit.body} onChange={(e) => patchEdit({ body: e.target.value })} rows={5} maxLength={1024} placeholder="Hola {{nombre}}, te recordamos que tu reunión es mañana a las {{hora}}…" style={{ ...inputBase, resize: 'vertical', lineHeight: 1.5, fontFamily: SANS }} />
              <div style={{ fontSize: 11, color: 'var(--faint)', marginTop: 3, textAlign: 'right', fontFamily: MONO }}>{edit.body.length}/1024</div>
            </div>

            <div>
              <label style={labelBase}>Pie (opcional, máx 60, sin variables)</label>
              <input value={edit.footer ?? ''} maxLength={60} onChange={(e) => patchEdit({ footer: e.target.value })} placeholder="Equipo Mauricio Bustos" style={inputBase} />
            </div>

            {edit.params.length > 0 && (
              <div>
                <label style={labelBase}>Ejemplos de las variables (obligatorio para Meta)</label>
                <div style={{ display: 'flex', flexDirection: 'column', gap: 8 }}>
                  {edit.params.map((p) => (
                    <div key={p.name} style={{ display: 'flex', alignItems: 'center', gap: 10 }}>
                      <code style={{ flex: '0 0 130px', fontFamily: MONO, fontSize: 12.5, color: 'var(--ink)' }}>{`{{${p.name}}}`}</code>
                      <input value={p.example} onChange={(e) => setParamExample(p.name, e.target.value)} placeholder={`Ejemplo para ${p.name}`} style={{ ...inputBase, ...(!p.example.trim() ? { borderColor: 'var(--warn-fill)' } : {}) }} />
                    </div>
                  ))}
                </div>
              </div>
            )}

            <ButtonsEditor buttons={edit.buttons} onChange={(b) => patchEdit({ buttons: b })} />

            {/* Validación */}
            {validacion && <ValidacionCard v={validacion} />}

            {error && <div style={{ padding: '10px 12px', borderRadius: 10, border: '1px solid var(--bad)', background: 'var(--bad-bg)', color: 'var(--bad)', fontSize: 13 }}>{error}</div>}
            {aviso && <div style={{ padding: '10px 12px', borderRadius: 10, border: '1px solid var(--good)', background: 'var(--good-bg)', color: 'var(--good)', fontSize: 13 }}>{aviso}</div>}

            {edit.status === 'rejected' && edit.rejection_reason && (
              <div style={{ padding: '10px 12px', borderRadius: 10, border: '1px solid var(--bad)', background: 'var(--bad-bg)', color: 'var(--bad)', fontSize: 13 }}>Meta la rechazó: {edit.rejection_reason}</div>
            )}

            {/* Acciones */}
            <div style={{ display: 'flex', gap: 10, flexWrap: 'wrap', alignItems: 'center', paddingTop: 4 }}>
              <button onClick={() => void validar()} disabled={validando || !bodyOk} style={{ ...btnGhost, opacity: validando || !bodyOk ? 0.6 : 1 }}>{validando ? 'MaKo revisando…' : '✨ Validar con MaKo'}</button>
              <button onClick={() => void guardar()} disabled={!puedeGuardar} style={{ ...btnGhost, opacity: !puedeGuardar ? 0.6 : 1 }}>{guardando ? 'Guardando…' : 'Guardar borrador'}</button>
              <button onClick={() => setConfirmEnviar(true)} disabled={!puedeEnviar} title={!paramsCompletos ? 'Completá los ejemplos de las variables' : ''} style={{ ...btnPrimary, marginLeft: 'auto', opacity: !puedeEnviar ? 0.5 : 1 }}>Enviar a Meta a aprobar →</button>
              {edit.id && <button onClick={() => void borrar(edit.id!)} style={{ ...btnGhost, color: 'var(--bad)', borderColor: 'var(--bad)' }}>Borrar</button>}
            </div>
            {!paramsCompletos && edit.params.length > 0 && <div style={{ fontSize: 11.5, color: 'var(--faint)', textAlign: 'right' }}>Para enviar a Meta, completá los ejemplos de cada variable.</div>}
          </div>
        )}
      </div>

      {/* Confirmación de envío a Meta */}
      {confirmEnviar && edit && (
        <div onClick={() => !enviando && setConfirmEnviar(false)} style={{ position: 'fixed', inset: 0, background: 'rgba(0,0,0,.45)', display: 'flex', alignItems: 'center', justifyContent: 'center', zIndex: 1000 }}>
          <div onClick={(e) => e.stopPropagation()} style={{ width: 'min(92vw, 460px)', background: 'var(--surface)', border: '1px solid var(--border)', borderRadius: 16, padding: 22, fontFamily: SANS }}>
            <div style={{ fontSize: 17, fontWeight: 600, color: 'var(--ink)', marginBottom: 8 }}>Enviar a aprobar a Meta</div>
            <div style={{ fontSize: 13.5, color: 'var(--dim)', lineHeight: 1.55 }}>Vas a enviar <code style={{ fontFamily: MONO }}>{edit.name}</code> a Meta para revisión. Una vez enviada no se puede editar (sí borrar y rehacer). Meta suele responder en minutos.</div>
            {validacion?.riesgo === 'ALTO' && <div style={{ marginTop: 12, padding: '9px 11px', borderRadius: 9, background: 'var(--bad-bg)', border: '1px solid var(--bad)', color: 'var(--bad)', fontSize: 12.5 }}>⚠ MaKo marcó riesgo ALTO de rechazo. Revisá las correcciones antes de enviar.</div>}
            <div style={{ display: 'flex', gap: 10, justifyContent: 'flex-end', marginTop: 18 }}>
              <button onClick={() => setConfirmEnviar(false)} disabled={enviando} style={btnGhost}>Cancelar</button>
              <button onClick={() => void enviarAMeta()} disabled={enviando} style={{ ...btnPrimary, opacity: enviando ? 0.6 : 1 }}>{enviando ? 'Enviando…' : 'Confirmar y enviar'}</button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}

function ValidacionCard({ v }: { v: Validacion }) {
  const r = RIESGO_META[v.riesgo] ?? RIESGO_META.MEDIO;
  return (
    <div style={{ border: `1px solid ${r.color}`, borderRadius: 12, padding: 14, background: r.bg }}>
      <div style={{ display: 'flex', alignItems: 'center', gap: 8, marginBottom: 8 }}>
        <span style={{ fontWeight: 700, fontSize: 13.5, color: r.color }}>{r.label}</span>
        <span style={{ marginLeft: 'auto', fontSize: 11, color: 'var(--dim)', fontFamily: MONO }}>sugerida: {v.categoria_sugerida}</span>
      </div>
      {v.razones.length > 0 && (
        <div style={{ marginBottom: v.correcciones.length ? 8 : 0 }}>
          <div style={{ fontSize: 11.5, fontWeight: 700, color: 'var(--dim)', marginBottom: 3 }}>POR QUÉ</div>
          <ul style={{ margin: 0, paddingLeft: 18, display: 'flex', flexDirection: 'column', gap: 2 }}>
            {v.razones.map((x, i) => <li key={i} style={{ fontSize: 12.5, color: 'var(--ink)', lineHeight: 1.45 }}>{x}</li>)}
          </ul>
        </div>
      )}
      {v.correcciones.length > 0 && (
        <div>
          <div style={{ fontSize: 11.5, fontWeight: 700, color: 'var(--dim)', marginBottom: 3 }}>CÓMO ARREGLARLO</div>
          <ul style={{ margin: 0, paddingLeft: 18, display: 'flex', flexDirection: 'column', gap: 2 }}>
            {v.correcciones.map((x, i) => <li key={i} style={{ fontSize: 12.5, color: 'var(--ink)', lineHeight: 1.45 }}>{x}</li>)}
          </ul>
        </div>
      )}
    </div>
  );
}

function MetaView({ meta }: { meta: MetaTpl }) {
  const chip = statusChip(meta.status.toLowerCase());
  return (
    <div style={{ flex: 1, minHeight: 0, overflowY: 'auto', padding: 24, fontFamily: SANS }}>
      <div style={{ display: 'flex', alignItems: 'center', gap: 10, marginBottom: 14 }}>
        <span style={{ fontFamily: MONO, fontSize: 17, fontWeight: 600, color: 'var(--ink)' }}>{meta.name}</span>
        <span style={{ fontSize: 11, fontWeight: 700, padding: '3px 10px', borderRadius: 999, color: chip.color, background: chip.bg }}>{chip.label}</span>
      </div>
      <div style={{ fontSize: 12.5, color: 'var(--dim)', marginBottom: 16, fontFamily: MONO }}>{meta.category} · {meta.language}{meta.params.length ? ` · vars: ${meta.params.join(', ')}` : ''}</div>
      <div style={{ padding: '14px 16px', borderRadius: 12, border: '1px solid var(--border)', background: 'var(--surface-2)', color: 'var(--ink)', fontSize: 14, lineHeight: 1.55, whiteSpace: 'pre-wrap' }}>{meta.body || '—'}</div>
      <div style={{ fontSize: 12, color: 'var(--faint)', marginTop: 14, lineHeight: 1.5 }}>Esta plantilla ya vive en Meta. Su status se sincroniza automáticamente. Para cambiarla, creá una nueva versión.</div>
    </div>
  );
}

function ButtonsEditor({ buttons, onChange }: { buttons: Button[]; onChange: (b: Button[]) => void }) {
  const add = (type: Button['type']) => onChange([...buttons, type === 'URL' ? { type, text: '', url: '' } : type === 'PHONE_NUMBER' ? { type, text: '', phone_number: '' } : { type, text: '' }]);
  const patch = (i: number, p: Partial<Button>) => onChange(buttons.map((b, j) => (j === i ? { ...b, ...p } as Button : b)));
  const del = (i: number) => onChange(buttons.filter((_, j) => j !== i));
  return (
    <div>
      <label style={labelBase}>Botones (opcional)</label>
      <div style={{ display: 'flex', flexDirection: 'column', gap: 8 }}>
        {buttons.map((b, i) => (
          <div key={i} style={{ display: 'flex', gap: 8, alignItems: 'center', flexWrap: 'wrap' }}>
            <span style={{ flex: '0 0 92px', fontSize: 11, fontFamily: MONO, color: 'var(--dim)' }}>{b.type === 'QUICK_REPLY' ? 'Respuesta' : b.type === 'URL' ? 'Enlace' : 'Teléfono'}</span>
            <input value={b.text} maxLength={25} onChange={(e) => patch(i, { text: e.target.value })} placeholder="Texto del botón" style={{ ...inputBase, flex: '1 1 130px', width: 'auto' }} />
            {b.type === 'URL' && <input value={b.url ?? ''} onChange={(e) => patch(i, { url: e.target.value })} placeholder="https://tudominio.com/…" style={{ ...inputBase, flex: '1 1 180px', width: 'auto', fontFamily: MONO }} />}
            {b.type === 'PHONE_NUMBER' && <input value={b.phone_number ?? ''} onChange={(e) => patch(i, { phone_number: e.target.value })} placeholder="+5216863996369" style={{ ...inputBase, flex: '1 1 150px', width: 'auto', fontFamily: MONO }} />}
            <button onClick={() => del(i)} style={{ border: 'none', background: 'transparent', color: 'var(--bad)', cursor: 'pointer', fontSize: 16, padding: 2 }}>✕</button>
          </div>
        ))}
      </div>
      <div style={{ display: 'flex', gap: 8, marginTop: buttons.length ? 8 : 0 }}>
        <button onClick={() => add('QUICK_REPLY')} style={{ fontSize: 12, padding: '6px 10px', borderRadius: 8, border: '1px dashed var(--border-strong)', background: 'transparent', color: 'var(--dim)', cursor: 'pointer' }}>+ Respuesta rápida</button>
        <button onClick={() => add('URL')} style={{ fontSize: 12, padding: '6px 10px', borderRadius: 8, border: '1px dashed var(--border-strong)', background: 'transparent', color: 'var(--dim)', cursor: 'pointer' }}>+ Enlace</button>
      </div>
    </div>
  );
}
