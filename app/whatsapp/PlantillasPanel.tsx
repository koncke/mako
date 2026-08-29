'use client';

// =============================================================================
// PlantillasPanel — gestión de plantillas de WhatsApp para aprobar en Meta
// =============================================================================
// Editor con validación EN VIVO de MaKo (riesgo + hallazgos con referencia a la
// regla de Meta + "Aplicar correcciones"), insertar variables del lead con
// autocompletado, persistencia del borrador en curso, envío a Meta con confirmación
// y vista de status (borrador/revisión/aprobada/rechazada) filtrable.

import { useCallback, useEffect, useMemo, useRef, useState, type CSSProperties } from 'react';
import { Dropdown } from '../components/Dropdown';
import { VARIABLES_LEAD, refDeRegla, explicarRechazo } from '../../lib/template-vars';

const SANS = "'Geist', sans-serif";
const MONO = "'Geist Mono', monospace";
const STORAGE_KEY = 'mako-wa-tpl-editor';

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
// Etapas del lead para el redactor "Levanta Muertos" de MaKo.
const ETAPAS_LM = [
  { value: 'pidio_info', label: 'Pidió info y se enfrió' },
  { value: 'vio_propuesta', label: 'Vio la propuesta / precio' },
  { value: 'objecion', label: 'Ghosting tras una objeción' },
  { value: 'frio', label: 'Frío / muy frío' },
  { value: 'depuracion', label: 'Depuración (último intento)' },
];

type Button = { type: 'QUICK_REPLY' | 'URL' | 'PHONE_NUMBER'; text: string; url?: string; phone_number?: string };
type Param = { name: string; example: string };
type HeaderMedia = { format: 'IMAGE' | 'VIDEO' | 'DOCUMENT'; handle: string; filename: string };
type Hallazgo = { regla: string; problema: string; correccion: string };
type Propuesta = { name?: string; category?: 'marketing' | 'utility' | 'authentication'; header?: string; body?: string; footer?: string } | null;
type Validacion = { riesgo: 'ALTO' | 'MEDIO' | 'BAJO'; categoria_sugerida: string; hallazgos: Hallazgo[]; propuesta: Propuesta };
type Draft = {
  id?: number; name: string; language: string; category: 'marketing' | 'utility' | 'authentication';
  body: string; header?: string | null; headerMedia?: HeaderMedia | null; footer?: string | null; buttons: Button[]; params: Param[];
  status: string; meta_template_id?: string | null; rejection_reason?: string | null; validacion?: Validacion | null; etapa?: string | null;
};
type MetaTpl = { name: string; language: string; category: string; status: string; body: string; header: string | null; headerFormat: string | null; footer: string | null; buttons: Button[]; params: string[]; rejectedReason: string | null; rejectedMotivo: string | null; metaId: string | null };
type Item = { kind: 'draft'; draft: Draft } | { kind: 'meta'; meta: MetaTpl };

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

const ejemploDe = (key: string) => VARIABLES_LEAD.find((v) => v.key === key)?.ejemplo ?? '';
const emptyDraft = (): Draft => ({ name: '', language: 'es_MX', category: 'marketing', body: '', header: '', footer: '', buttons: [], params: [], status: 'borrador', etapa: '' });

// Variables {{nombre}} del cuerpo (únicas, en orden). Deben ser nombradas.
function detectarVars(text: string): string[] {
  const out: string[] = [];
  const re = /\{\{\s*([a-z_][a-z0-9_]*)\s*\}\}/gi;
  let m: RegExpExecArray | null;
  while ((m = re.exec(text)) !== null) { const n = m[1].toLowerCase(); if (!out.includes(n)) out.push(n); }
  return out;
}

// Reemplaza {{var}} por su valor de ejemplo (para ver la versión "final").
function renderConEjemplos(text: string, ej: Map<string, string>): string {
  return (text || '').replace(/\{\{\s*([a-zA-Z0-9_]+)\s*\}\}/g, (_, n) => ej.get(n) || `{{${n}}}`);
}
const MEDIA_LABEL: Record<string, string> = { IMAGE: '🖼️ Imagen', VIDEO: '🎬 Video', DOCUMENT: '📄 Documento', TEXT: 'Texto' };

const inputBase: CSSProperties = { width: '100%', padding: '10px 12px', borderRadius: 10, border: '1px solid var(--border-strong)', background: 'var(--surface-2)', color: 'var(--ink)', fontFamily: SANS, fontSize: 13.5, outline: 'none' };
const labelBase: CSSProperties = { display: 'block', fontSize: 12, color: 'var(--dim)', marginBottom: 5, fontWeight: 600 };

export function PlantillasPanel({ initialSelect, makoSeed, onMakoSeedApplied }: { initialSelect?: string | null; makoSeed?: { objetivo: string; etapa: string } | null; onMakoSeedApplied?: () => void }) {
  const [drafts, setDrafts] = useState<Draft[]>([]);
  const [metas, setMetas] = useState<MetaTpl[]>([]);
  const [loading, setLoading] = useState(true);
  const [filtro, setFiltro] = useState('todos');
  const [filtroEtapa, setFiltroEtapa] = useState('todas');
  const [sel, setSel] = useState<Item | null>(null);
  const [edit, setEdit] = useState<Draft | null>(null);
  const [validacion, setValidacion] = useState<Validacion | null>(null);
  const [validacionStale, setValidacionStale] = useState(false); // el texto cambió desde la última validación
  const [validacionOpen, setValidacionOpen] = useState(true);     // recomendaciones desplegadas o cerradas (X)
  const [validando, setValidando] = useState(false);
  const [guardando, setGuardando] = useState(false);
  const [confirmEnviar, setConfirmEnviar] = useState(false);
  const [enviando, setEnviando] = useState(false);
  const [borrarMetaName, setBorrarMetaName] = useState<string | null>(null); // confirmar borrar plantilla de Meta
  const [subiendoMedia, setSubiendoMedia] = useState(false);
  const [cooldowns, setCooldowns] = useState<Record<string, number>>({}); // name → unix secs hasta cuando NO se puede reenviar (Meta procesa borrado)
  const [nowSec, setNowSec] = useState(() => Math.floor(Date.now() / 1000));
  const [error, setError] = useState<string | null>(null);
  const [aviso, setAviso] = useState<string | null>(null);
  const [restaurado, setRestaurado] = useState(false);
  // Redactor "Levanta Muertos" de MaKo.
  const [makoOpen, setMakoOpen] = useState(false);
  const [makoObjetivo, setMakoObjetivo] = useState('');
  const [makoEtapa, setMakoEtapa] = useState('frio');
  const [makoBusy, setMakoBusy] = useState(false);
  const [makoError, setMakoError] = useState<string | null>(null);

  const bodyRef = useRef<HTMLTextAreaElement>(null);
  const [autocomplete, setAutocomplete] = useState<{ partial: string } | null>(null);
  const debounceRef = useRef<ReturnType<typeof setTimeout> | null>(null);
  const lastValidatedRef = useRef<string>('');

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

  // Reloj para los cooldowns de reenvío (#1).
  useEffect(() => {
    setNowSec(Math.floor(Date.now() / 1000));
    const iv = setInterval(() => setNowSec(Math.floor(Date.now() / 1000)), 1000);
    return () => clearInterval(iv);
  }, []);
  // Cooldowns: persisten en localStorage (sobreviven recargas) y se purgan al vencer.
  useEffect(() => {
    try { const raw = localStorage.getItem('mako-wa-tpl-cooldowns'); if (raw) setCooldowns(JSON.parse(raw)); } catch { /* sin storage */ }
  }, []);
  const setCooldown = useCallback((name: string, until: number) => {
    setCooldowns((prev) => {
      const next = { ...prev, [name]: until };
      try { localStorage.setItem('mako-wa-tpl-cooldowns', JSON.stringify(next)); } catch { /* sin storage */ }
      return next;
    });
  }, []);
  const cooldownRestante = (name: string): number => Math.max(0, (cooldowns[name] ?? 0) - nowSec);

  // Restaurar el borrador en curso (texto + recomendaciones) al volver a la tab.
  useEffect(() => {
    try {
      const raw = localStorage.getItem(STORAGE_KEY);
      if (raw) {
        const s = JSON.parse(raw) as { edit?: Draft; validacion?: Validacion | null; validacionStale?: boolean; validacionOpen?: boolean };
        if (s.edit) {
          // El handle de media puede haber expirado en Meta → forzar re-subida.
          if (s.edit.headerMedia) s.edit.headerMedia = { ...s.edit.headerMedia, handle: '', filename: '' };
          setEdit(s.edit); setValidacion(s.validacion ?? null); setValidacionStale(!!s.validacionStale); setValidacionOpen(s.validacionOpen !== false);
        }
      }
    } catch { /* sin storage */ }
    setRestaurado(true);
  }, []);

  // Persistir el borrador en curso (para #3). Sólo tras restaurar, para no pisar.
  useEffect(() => {
    if (!restaurado) return;
    try {
      if (edit) localStorage.setItem(STORAGE_KEY, JSON.stringify({ edit, validacion, validacionStale, validacionOpen }));
      else localStorage.removeItem(STORAGE_KEY);
    } catch { /* sin storage */ }
  }, [edit, validacion, validacionStale, validacionOpen, restaurado]);

  const items: Item[] = useMemo(() => {
    const draftNames = new Set(drafts.map((d) => `${d.name}::${d.language}`));
    const out: Item[] = drafts.map((d) => ({ kind: 'draft', draft: d }));
    for (const m of metas) if (!draftNames.has(`${m.name}::${m.language}`)) out.push({ kind: 'meta', meta: m });
    return out;
  }, [drafts, metas]);

  const itemsFiltrados = useMemo(() => items.filter((it) => {
    const status = (it.kind === 'draft' ? it.draft.status : it.meta.status).toLowerCase();
    const etapa = it.kind === 'draft' ? (it.draft.etapa ?? '') : '';
    if (filtro !== 'todos' && status !== filtro) return false;
    if (filtroEtapa !== 'todas' && etapa !== filtroEtapa) return false;
    return true;
  }), [items, filtro, filtroEtapa]);

  const abrirNueva = () => { setSel(null); setEdit(emptyDraft()); setValidacion(null); setValidacionStale(false); setValidacionOpen(true); setError(null); setAviso(null); lastValidatedRef.current = ''; };
  // Clic en un item = VISTA (read-only). El editor se abre con "Editar".
  const abrirItem = (it: Item) => {
    setSel(it); setEdit(null); setValidacion(null); setError(null); setAviso(null); setAutocomplete(null);
  };
  // Salir del editor sin enviar a Meta: vuelve a la vista del item (o al vacío).
  const cancelarEdicion = () => {
    setEdit(null); setValidacion(null); setValidacionStale(false); setError(null); setAviso(null);
    try { localStorage.removeItem(STORAGE_KEY); } catch { /* sin storage */ }
  };
  // Botón "Editar" desde la vista: abre el editor del item seleccionado.
  const iniciarEdicion = () => {
    if (!sel) return;
    setError(null); setAviso(null); setAutocomplete(null); setValidacionOpen(true);
    if (sel.kind === 'draft') {
      setEdit({ ...sel.draft, header: sel.draft.header ?? '', headerMedia: sel.draft.headerMedia ?? null, footer: sel.draft.footer ?? '', buttons: sel.draft.buttons ?? [], params: sel.draft.params ?? [] });
      setValidacion(sel.draft.validacion ?? null); setValidacionStale(false);
      lastValidatedRef.current = sel.draft.validacion ? firma(sel.draft) : '';
    } else {
      editarMeta(sel.meta);
    }
  };

  // Editar una plantilla YA en Meta: la cargamos al editor (con su meta_template_id).
  // Al guardar cambios, se edita en Meta y vuelve a revisión.
  const editarMeta = (m: MetaTpl) => {
    const params = detectarVars(m.body).map((v) => ({ name: v, example: ejemploDe(v) }));
    setError(null); setAviso(null); setAutocomplete(null); // mantenemos sel para volver a la vista al cancelar
    setValidacion(null); setValidacionStale(false); setValidacionOpen(true); lastValidatedRef.current = '';
    // El header multimedia: Meta no devuelve el handle (expira) → pedimos re-subir
    // (handle vacío; el envío lo exige con headerMediaOk).
    const esMedia = m.headerFormat === 'IMAGE' || m.headerFormat === 'VIDEO' || m.headerFormat === 'DOCUMENT';
    setEdit({
      name: m.name, language: m.language, category: (['marketing', 'utility', 'authentication'].includes(m.category) ? m.category : 'marketing') as Draft['category'],
      body: m.body, header: esMedia ? '' : (m.header ?? ''),
      headerMedia: esMedia ? { format: m.headerFormat as HeaderMedia['format'], handle: '', filename: '' } : null,
      footer: m.footer ?? '', buttons: m.buttons ?? [], params,
      status: m.status, meta_template_id: m.metaId, rejection_reason: m.rejectedReason, etapa: '',
    });
  };

  // Deep-link desde el pop-up de aprobación: abrir esa plantilla cuando esté en la lista.
  const appliedSelectRef = useRef<string | null>(null);
  useEffect(() => {
    if (!initialSelect || initialSelect === appliedSelectRef.current) return;
    const target = initialSelect.toLowerCase();
    const it = items.find((i) => (i.kind === 'draft' ? i.draft.name : i.meta.name).toLowerCase() === target);
    if (it) { appliedSelectRef.current = initialSelect; abrirItem(it); }
  }, [initialSelect, items]);

  // Pre-carga del redactor "Levanta Muertos" cuando llegás desde el asesor de WhatsApp:
  // abre una plantilla nueva con el objetivo/etapa ya cargados y el panel de MaKo abierto.
  useEffect(() => {
    if (!makoSeed) return;
    abrirNueva();
    setMakoOpen(true);
    setMakoObjetivo(makoSeed.objetivo);
    setMakoEtapa(makoSeed.etapa);
    onMakoSeedApplied?.();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [makoSeed]);

  // Cuando se recarga la lista, sincronizar al editor abierto los campos que maneja
  // el server (status + motivo de rechazo), sin tocar el contenido que estás editando.
  useEffect(() => {
    setEdit((cur) => {
      if (!cur?.id) return cur;
      const fresh = drafts.find((d) => d.id === cur.id);
      if (fresh && (fresh.status !== cur.status || fresh.rejection_reason !== cur.rejection_reason)) {
        return { ...cur, status: fresh.status, rejection_reason: fresh.rejection_reason };
      }
      return cur;
    });
  }, [drafts]);

  // Si estabas editando una plantilla de Meta que ya no existe (borrada/cambió),
  // limpiamos el editor para no mandar un PATCH a un id fantasma.
  useEffect(() => {
    if (!edit?.meta_template_id || metas.length === 0) return;
    if (!metas.some((m) => m.metaId === edit.meta_template_id)) {
      setAviso('La plantilla que editabas ya no está en Meta (se borró o cambió). Vuelve a abrirla.');
      setEdit(null); setSel(null); setValidacion(null);
      try { localStorage.removeItem(STORAGE_KEY); } catch { /* sin storage */ }
    }
  }, [metas, edit?.meta_template_id]);

  // Firma del contenido relevante para saber si hay que revalidar.
  function firma(d: Draft): string { return JSON.stringify([d.category, d.header, d.body, d.footer, d.params]); }

  const syncParams = (d: Draft): Param[] => detectarVars(d.body).map((v) => d.params.find((p) => p.name === v) ?? { name: v, example: ejemploDe(v) });

  const patchEdit = (patch: Partial<Draft>) => {
    setEdit((cur) => {
      if (!cur) return cur;
      const next = { ...cur, ...patch };
      next.params = syncParams(next);
      return next;
    });
    setValidacionStale(true); // marcamos como desactualizada pero NO la borramos (#5)
  };
  const setParamExample = (name: string, example: string) =>
    setEdit((cur) => (cur ? { ...cur, params: cur.params.map((p) => (p.name === name ? { ...p, example } : p)) } : cur));

  const validar = useCallback(async (d: Draft) => {
    if (!d.body.trim()) return;
    setValidando(true); setError(null);
    lastValidatedRef.current = firma(d);
    try {
      const j = await fetch('/api/whatsapp/templates/validate', {
        method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify({ draft: d }),
      }).then((r) => r.json());
      if (j.ok) { setValidacion(j.validacion); setValidacionStale(false); if (j.validacion?.riesgo === 'ALTO') setValidacionOpen(true); }
      else setError(j.error || 'No se pudo validar.');
    } catch (e) { setError(e instanceof Error ? e.message : String(e)); }
    finally { setValidando(false); }
  }, []);

  // Auto-validación con debounce mientras escribís (#1). Sólo si cambió el contenido.
  useEffect(() => {
    if (!edit || !edit.body.trim()) return;
    if (firma(edit) === lastValidatedRef.current) return;
    if (debounceRef.current) clearTimeout(debounceRef.current);
    debounceRef.current = setTimeout(() => { void validar(edit); }, 1400);
    return () => { if (debounceRef.current) clearTimeout(debounceRef.current); };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [edit?.body, edit?.header, edit?.footer, edit?.category, edit?.params]);

  // ── Insertar variables (#4, #8, #9): en el cursor del cuerpo ──
  const insertarVar = (key: string) => {
    const ta = bodyRef.current;
    const token = `{{${key}}}`;
    setEdit((cur) => {
      if (!cur) return cur;
      const pos = ta ? ta.selectionStart : cur.body.length;
      const nuevo = cur.body.slice(0, pos) + token + cur.body.slice(ta ? ta.selectionEnd : cur.body.length);
      const next = { ...cur, body: nuevo };
      next.params = syncParams(next);
      // reponer el cursor después del token
      requestAnimationFrame(() => { if (ta) { const p = pos + token.length; ta.focus(); ta.setSelectionRange(p, p); } });
      return next;
    });
    setValidacionStale(true);
    setAutocomplete(null);
  };

  // Autocompletado inline: detecta "{{partial" sin cerrar antes del cursor.
  const onBodyChange = (e: React.ChangeEvent<HTMLTextAreaElement>) => {
    const val = e.target.value;
    patchEdit({ body: val });
    const pos = e.target.selectionStart;
    const m = val.slice(0, pos).match(/\{\{\s*([a-z_]*)$/i);
    setAutocomplete(m ? { partial: m[1].toLowerCase() } : null);
  };
  // Al elegir del autocomplete: reemplaza el "{{partial" por "{{key}}".
  const aplicarAutocomplete = (key: string) => {
    const ta = bodyRef.current;
    setEdit((cur) => {
      if (!cur) return cur;
      const pos = ta ? ta.selectionStart : cur.body.length;
      const before = cur.body.slice(0, pos);
      const after = cur.body.slice(pos);
      const reemplazado = before.replace(/\{\{\s*[a-z_]*$/i, `{{${key}}}`);
      const next = { ...cur, body: reemplazado + after };
      next.params = syncParams(next);
      requestAnimationFrame(() => { if (ta) { const p = reemplazado.length; ta.focus(); ta.setSelectionRange(p, p); } });
      return next;
    });
    setValidacionStale(true);
    setAutocomplete(null);
  };

  // Tipo de encabezado actual (para el selector): media, texto o ninguno.
  const headerTipo: string = edit?.headerMedia ? edit.headerMedia.format : (edit?.header ? 'TEXT' : 'NONE');
  const cambiarHeaderTipo = (tipo: string) => {
    if (tipo === 'NONE') patchEdit({ header: '', headerMedia: null });
    else if (tipo === 'TEXT') patchEdit({ headerMedia: null });
    // Media: seteamos un placeholder (handle vacío) para que el tipo "quede" elegido
    // y aparezca el botón de subir; el envío exige el handle (headerMediaOk).
    else patchEdit({ header: '', headerMedia: edit?.headerMedia?.format === tipo ? edit.headerMedia : { format: tipo as HeaderMedia['format'], handle: '', filename: '' } });
  };
  const subirMedia = async (file: File) => {
    setSubiendoMedia(true); setError(null);
    try {
      const fd = new FormData(); fd.append('file', file);
      const j = await fetch('/api/whatsapp/templates/media', { method: 'POST', body: fd }).then((r) => r.json());
      if (!j.ok) setError(j.error || 'No se pudo subir el archivo.');
      else patchEdit({ headerMedia: { format: j.format, handle: j.handle, filename: j.filename }, header: '' });
    } catch (e) { setError(e instanceof Error ? e.message : String(e)); }
    finally { setSubiendoMedia(false); }
  };

  const aplicarPropuesta = () => {
    const p = validacion?.propuesta;
    if (!p) return;
    setEdit((cur) => {
      if (!cur) return cur;
      const next = {
        ...cur,
        body: p.body ?? cur.body,
        header: p.header ?? cur.header,
        footer: p.footer ?? cur.footer,
        category: p.category ?? cur.category,
        name: p.name && /^[a-z0-9_]{1,512}$/.test(p.name) ? p.name : cur.name,
      };
      next.params = syncParams(next);
      return next;
    });
    setValidacionStale(true); // se revalida sola
    setAviso('Apliqué las correcciones de MaKo. Revisa el resultado.');
  };

  // MaKo redacta una plantilla con la metodología Levanta Muertos (y Meta-safe).
  const generarConMako = async () => {
    if (!makoObjetivo.trim() || makoBusy) return;
    setMakoBusy(true); setMakoError(null);
    try {
      const j = await fetch('/api/whatsapp/advisor', {
        method: 'POST', headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ action: 'draft_template', objetivo: makoObjetivo, etapa: makoEtapa }),
      }).then((r) => r.json());
      if (!j.ok) { setMakoError(j.error || 'No se pudo generar.'); return; }
      const d = j.draft as { name?: string; category?: Draft['category']; body?: string; footer?: string; variables?: Array<{ nombre: string; ejemplo: string }> };
      setEdit((cur) => {
        const base = cur ?? emptyDraft();
        const next: Draft = {
          ...base,
          name: d.name && /^[a-z0-9_]{1,512}$/.test(d.name) ? d.name : base.name,
          category: d.category ?? base.category,
          body: d.body ?? base.body,
          footer: d.footer ?? base.footer,
        };
        next.params = detectarVars(next.body).map((v) => {
          const found = (d.variables ?? []).find((x) => x.nombre === v);
          return { name: v, example: found?.ejemplo || ejemploDe(v) };
        });
        return next;
      });
      setValidacionStale(true); // se revalida sola
      setMakoOpen(false); setMakoObjetivo('');
      setAviso('MaKo redactó la plantilla con Levanta Muertos. Revísala y valida antes de enviar a Meta.');
    } catch (e) { setMakoError(e instanceof Error ? e.message : String(e)); }
    finally { setMakoBusy(false); }
  };

  const guardar = async (): Promise<number | null> => {
    if (!edit) return null;
    setGuardando(true); setError(null);
    try {
      const j = await fetch('/api/whatsapp/templates/drafts', {
        method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify({ draft: { ...edit, validacion } }),
      }).then((r) => r.json());
      if (!j.ok) { setError(j.error || 'No se pudo guardar.'); return null; }
      await cargar();
      setEdit({ ...j.draft, header: j.draft.header ?? '', footer: j.draft.footer ?? '', buttons: j.draft.buttons ?? [], params: j.draft.params ?? [] });
      setSel({ kind: 'draft', draft: j.draft });
      return j.draft.id ?? null;
    } catch (e) { setError(e instanceof Error ? e.message : String(e)); return null; }
    finally { setGuardando(false); }
  };

  // Meta bloquea recrear un nombre mientras procesa su borrado (~1 min).
  const esCooldownError = (msg: string) => /being deleted|try again|less than 1 minute|en menos de un minuto|content can't be added|rate.?limit|too many/i.test(msg || '');
  const manejarErrorEnvio = (msg: string) => {
    if (edit && esCooldownError(msg)) {
      setCooldown(edit.name, Math.floor(Date.now() / 1000) + 65);
      setError('Meta todavía está procesando el borrado anterior de esta plantilla. Espera ~1 minuto y reintenta (el botón se habilita solo).');
    } else setError(msg);
  };

  const enviarAMeta = async () => {
    if (!edit) return;
    if (edit.headerMedia && !edit.headerMedia.handle?.trim()) {
      setConfirmEnviar(false);
      setError('Sube (o re-sube) el archivo del encabezado antes de enviar a Meta.');
      return;
    }
    setEnviando(true); setError(null);
    try {
      if (edit.meta_template_id) {
        // Editar una plantilla EXISTENTE en Meta → vuelve a revisión.
        const j = await fetch('/api/whatsapp/templates/drafts', {
          method: 'PATCH', headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({ action: 'edit', metaId: edit.meta_template_id, draft: edit }),
        }).then((r) => r.json());
        if (!j.ok) manejarErrorEnvio(j.error || 'Meta rechazó los cambios.');
        else { setAviso('✓ Cambios enviados. La plantilla vuelve a revisión de Meta.'); setEdit((cur) => (cur ? { ...cur, status: 'pending' } : cur)); await cargar(); }
      } else {
        // Crear: SIEMPRE guardar primero (persiste el ejemplo de cada variable) y enviar.
        const id = await guardar();
        if (!id) { setEnviando(false); setConfirmEnviar(false); return; }
        const j = await fetch('/api/whatsapp/templates/drafts', {
          method: 'PATCH', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify({ action: 'submit', id }),
        }).then((r) => r.json());
        if (!j.ok) manejarErrorEnvio(j.error || 'Meta rechazó la solicitud.');
        else { setAviso('✓ Enviada a Meta. Queda en revisión (suele tardar minutos).'); setEdit((cur) => (cur ? { ...cur, status: 'pending' } : cur)); await cargar(); }
      }
    } catch (e) { setError(e instanceof Error ? e.message : String(e)); }
    finally { setEnviando(false); setConfirmEnviar(false); }
  };

  const borrar = async (id: number) => {
    setError(null);
    const nombre = (sel?.kind === 'draft' ? sel.draft.name : edit?.name) || '';
    const eraEnMeta = (sel?.kind === 'draft' ? sel.draft.status : edit?.status) !== 'borrador';
    try {
      const j = await fetch(`/api/whatsapp/templates/drafts?id=${id}`, { method: 'DELETE' }).then((r) => r.json());
      if (!j.ok) { setError(j.error || 'No se pudo borrar.'); return; }
      if (eraEnMeta && nombre) setCooldown(nombre, Math.floor(Date.now() / 1000) + 65); // Meta procesa el borrado ~1 min
      await cargar(); setEdit(null); setSel(null); setValidacion(null);
    } catch (e) { setError(e instanceof Error ? e.message : String(e)); }
  };

  // Borrar una plantilla que YA vive en Meta (por nombre). Destructivo → con confirmación.
  const ejecutarBorrarMeta = async () => {
    if (!borrarMetaName) return;
    setError(null);
    const nombre = borrarMetaName;
    try {
      const j = await fetch(`/api/whatsapp/templates/drafts?name=${encodeURIComponent(nombre)}`, { method: 'DELETE' }).then((r) => r.json());
      if (!j.ok) setError(j.error || 'No se pudo borrar.');
      else { setCooldown(nombre, Math.floor(Date.now() / 1000) + 65); await cargar(); setEdit(null); setSel(null); setValidacion(null); }
    } catch (e) { setError(e instanceof Error ? e.message : String(e)); }
    finally { setBorrarMetaName(null); }
  };

  const reconciliar = async () => {
    await fetch('/api/whatsapp/templates/drafts', { method: 'PATCH', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify({ action: 'reconcile' }) });
    await cargar();
  };

  const esEdicionMeta = !!edit?.meta_template_id; // editando una plantilla que ya está en Meta
  const nombreOk = edit ? /^[a-z0-9_]{1,512}$/.test(edit.name) : false;
  const bodyOk = edit ? edit.body.trim().length > 0 : false;
  const paramsCompletos = edit ? edit.params.every((p) => p.example.trim()) : false;
  const puedeGuardar = nombreOk && bodyOk && !guardando;
  const headerMediaOk = !edit?.headerMedia || !!edit.headerMedia.handle?.trim(); // si hay header media, exige el archivo subido
  const cooldownActivo = edit ? cooldownRestante(edit.name) : 0; // segundos a esperar (Meta procesa borrado)
  const puedeEnviar = puedeGuardar && paramsCompletos && headerMediaOk && cooldownActivo === 0 && (
    esEdicionMeta ? (edit?.status === 'approved' || edit?.status === 'rejected')
                  : (edit?.status === 'borrador' || edit?.status === 'rejected')
  );

  const btnPrimary: CSSProperties = { padding: '9px 16px', borderRadius: 10, border: 'none', background: '#14161B', color: '#F3F5F8', fontFamily: SANS, fontSize: 13, fontWeight: 600, cursor: 'pointer' };
  const btnGhost: CSSProperties = { padding: '9px 16px', borderRadius: 10, border: '1px solid var(--border-strong)', background: 'var(--surface)', color: 'var(--dim)', fontFamily: SANS, fontSize: 13, fontWeight: 600, cursor: 'pointer' };
  const acSugs = autocomplete ? VARIABLES_LEAD.filter((v) => v.key.startsWith(autocomplete.partial)) : [];

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
        {!edit && sel ? (
          <TemplatePreview item={sel} onEditar={iniciarEdicion} onEliminar={() => { const n = sel.kind === 'draft' ? sel.draft.name : sel.meta.name; const esBorrador = sel.kind === 'draft' && sel.draft.status === 'borrador'; if (esBorrador && sel.draft.id) void borrar(sel.draft.id); else setBorrarMetaName(n); }} />
        ) : !edit ? (
          <div style={{ flex: 1, display: 'flex', alignItems: 'center', justifyContent: 'center', color: 'var(--faint)', fontSize: 14, padding: 20, textAlign: 'center' }}>
            Elige una plantilla o crea una nueva para redactarla, validarla con MaKo y enviarla a aprobar a Meta.
          </div>
        ) : (
          <div style={{ flex: 1, minHeight: 0, overflowY: 'auto', padding: 22, display: 'flex', flexDirection: 'column', gap: 14 }}>
            <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', gap: 10 }}>
              <button onClick={cancelarEdicion} style={{ display: 'inline-flex', alignItems: 'center', gap: 6, border: 'none', background: 'transparent', color: 'var(--dim)', fontFamily: SANS, fontSize: 13.5, fontWeight: 600, cursor: 'pointer', padding: 0 }}>← Volver{sel ? ' (descartar cambios)' : ''}</button>
              <span style={{ fontSize: 11.5, color: 'var(--faint)', fontFamily: MONO }}>{edit.id || edit.meta_template_id ? 'Editando' : 'Nueva plantilla'}</span>
            </div>

            {!esEdicionMeta && (
              <div style={{ border: '1px solid var(--accent)', borderRadius: 12, background: 'rgba(200,135,12,.06)', overflow: 'hidden' }}>
                <button onClick={() => setMakoOpen((v) => !v)} style={{ width: '100%', display: 'flex', alignItems: 'center', justifyContent: 'space-between', gap: 8, padding: '10px 13px', background: 'transparent', border: 'none', cursor: 'pointer', fontFamily: SANS }}>
                  <span style={{ fontSize: 13, fontWeight: 600, color: '#9A6A09' }}>✨ Redactar con MaKo · metodología Levanta Muertos</span>
                  <span style={{ color: 'var(--faint)', fontSize: 11 }}>{makoOpen ? '▾' : '▸'}</span>
                </button>
                {makoOpen && (
                  <div style={{ padding: '0 13px 13px', display: 'flex', flexDirection: 'column', gap: 10 }}>
                    <div>
                      <label style={labelBase}>¿Qué quieres lograr con esta plantilla?</label>
                      <input value={makoObjetivo} onChange={(e) => setMakoObjetivo(e.target.value)} placeholder="Ej: reactivar leads que pidieron info y no agendaron" style={inputBase} />
                    </div>
                    <div style={{ display: 'flex', gap: 10, alignItems: 'flex-end', flexWrap: 'wrap' }}>
                      <div style={{ flex: '1 1 200px' }}>
                        <label style={labelBase}>Etapa del lead</label>
                        <Dropdown value={makoEtapa} onChange={setMakoEtapa} width="100%" ariaLabel="Etapa del lead" options={ETAPAS_LM} />
                      </div>
                      <button onClick={() => void generarConMako()} disabled={makoBusy || !makoObjetivo.trim()} style={{ ...btnPrimary, opacity: makoBusy || !makoObjetivo.trim() ? 0.55 : 1 }}>{makoBusy ? 'MaKo redactando…' : 'Redactar plantilla →'}</button>
                    </div>
                    {makoError && <div style={{ fontSize: 12, color: 'var(--bad)' }}>{makoError}</div>}
                    <div style={{ fontSize: 11, color: 'var(--faint)', lineHeight: 1.5 }}>MaKo redacta el cuerpo, la categoría y las variables siguiendo Levanta Muertos y las reglas de Meta. Después lo validas y lo mandas a aprobar.</div>
                  </div>
                )}
              </div>
            )}

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
              <div style={{ display: 'flex', alignItems: 'center', gap: 10, marginBottom: 5, flexWrap: 'wrap' }}>
                <label style={{ ...labelBase, margin: 0 }}>Encabezado (opcional)</label>
                <Dropdown value={headerTipo} onChange={cambiarHeaderTipo} width={170} ariaLabel="Tipo de encabezado" buttonStyle={{ padding: '6px 10px', fontSize: 12.5 }}
                  options={[{ value: 'NONE', label: 'Ninguno' }, { value: 'TEXT', label: 'Texto' }, { value: 'IMAGE', label: '🖼️ Imagen' }, { value: 'VIDEO', label: '🎬 Video' }, { value: 'DOCUMENT', label: '📄 Documento (PDF)' }]} />
                {headerTipo === 'NONE' && <span style={{ fontSize: 11.5, color: 'var(--faint)' }}>← elige Imagen / Video / Documento para adjuntar un archivo</span>}
              </div>
              {headerTipo === 'TEXT' && (
                <input value={edit.header ?? ''} maxLength={60} onChange={(e) => patchEdit({ header: e.target.value })} placeholder="Texto de encabezado (máx 60, sin variables)" style={inputBase} />
              )}
              {(headerTipo === 'IMAGE' || headerTipo === 'VIDEO' || headerTipo === 'DOCUMENT') && (
                <div style={{ display: 'flex', alignItems: 'center', gap: 10, flexWrap: 'wrap' }}>
                  {edit.headerMedia?.handle
                    ? <span style={{ fontSize: 13, color: 'var(--good)', fontWeight: 600 }}>✓ {MEDIA_LABEL[edit.headerMedia.format]} cargada: <code style={{ fontFamily: MONO }}>{edit.headerMedia.filename}</code></span>
                    : <span style={{ fontSize: 12.5, color: 'var(--warn)', fontWeight: 600 }}>↓ Sube una muestra ({headerTipo === 'IMAGE' ? 'jpg/png' : headerTipo === 'VIDEO' ? 'mp4' : 'pdf'}). Meta la usa para revisar; al enviar de verdad se reemplaza por el archivo real.</span>}
                  <label style={{ ...btnGhost, cursor: subiendoMedia ? 'default' : 'pointer', opacity: subiendoMedia ? 0.6 : 1 }}>
                    {subiendoMedia ? 'Subiendo…' : (edit.headerMedia?.handle ? 'Cambiar archivo' : 'Subir archivo')}
                    <input type="file" hidden disabled={subiendoMedia} accept={headerTipo === 'IMAGE' ? 'image/jpeg,image/png' : headerTipo === 'VIDEO' ? 'video/mp4' : 'application/pdf'} onChange={(e) => { const f = e.target.files?.[0]; if (f) void subirMedia(f); e.target.value = ''; }} />
                  </label>
                </div>
              )}
            </div>

            <div style={{ position: 'relative' }}>
              <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', gap: 8, marginBottom: 5 }}>
                <label style={{ ...labelBase, margin: 0 }}>Cuerpo del mensaje · escribe <code style={{ fontFamily: MONO, background: 'var(--surface-2)', border: '1px solid var(--border)', borderRadius: 4, padding: '1px 5px' }}>{'{{'}</code> o inserta una variable →</label>
                <Dropdown value="" onChange={(v) => v && insertarVar(v)} width={172} align="right" placeholder="+ Insertar variable" ariaLabel="Insertar variable"
                  options={VARIABLES_LEAD.map((v) => ({ value: v.key, label: v.label, sub: `{{${v.key}}} · ${v.descripcion}` }))}
                  buttonStyle={{ padding: '6px 10px', fontSize: 12.5 }} />
              </div>
              <textarea ref={bodyRef} value={edit.body} onChange={onBodyChange} onBlur={() => setTimeout(() => setAutocomplete(null), 150)} rows={5} maxLength={1024} placeholder="Hola {{nombre}}, te recordamos que tu reunión es mañana a las {{...}}…" style={{ ...inputBase, resize: 'vertical', lineHeight: 1.5, fontFamily: SANS }} />
              {acSugs.length > 0 && (
                <div style={{ position: 'absolute', left: 0, right: 0, top: 'calc(100% - 2px)', zIndex: 30, background: 'var(--surface)', border: '1px solid var(--border-strong)', borderRadius: 10, boxShadow: '0 14px 36px rgba(18,21,27,.18)', padding: 6, maxHeight: 220, overflowY: 'auto' }}>
                  {acSugs.map((v) => (
                    <button key={v.key} onMouseDown={(e) => { e.preventDefault(); aplicarAutocomplete(v.key); }} style={{ display: 'flex', flexDirection: 'column', alignItems: 'flex-start', width: '100%', textAlign: 'left', padding: '7px 10px', borderRadius: 7, border: 'none', background: 'transparent', cursor: 'pointer', fontFamily: SANS }}>
                      <span style={{ fontSize: 13, color: 'var(--ink)', fontWeight: 600 }}><code style={{ fontFamily: MONO }}>{`{{${v.key}}}`}</code> · {v.label}</span>
                      <span style={{ fontSize: 11.5, color: 'var(--dim)' }}>{v.descripcion}</span>
                    </button>
                  ))}
                </div>
              )}
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
                      <code style={{ flex: '0 0 150px', fontFamily: MONO, fontSize: 12.5, color: 'var(--ink)' }}>{`{{${p.name}}}`}</code>
                      <input value={p.example} onChange={(e) => setParamExample(p.name, e.target.value)} placeholder={`Ejemplo para ${p.name}`} style={{ ...inputBase, ...(!p.example.trim() ? { borderColor: 'var(--warn-fill)' } : {}) }} />
                    </div>
                  ))}
                </div>
              </div>
            )}

            <ButtonsEditor buttons={edit.buttons} onChange={(b) => patchEdit({ buttons: b })} />

            {edit.status === 'rejected' && edit.rejection_reason && (
              <div style={{ padding: '10px 12px', borderRadius: 10, border: '1px solid var(--bad)', background: 'var(--bad-bg)', color: 'var(--bad)', fontSize: 13 }}><strong>Meta la rechazó.</strong> {explicarRechazo(edit.rejection_reason)}</div>
            )}

            {/* Validación EN VIVO — con X para cerrar y pill para reabrir */}
            {validacionOpen && (validacion || validando) && (
              <ValidacionCard v={validacion} validando={validando} stale={validacionStale} onAplicar={aplicarPropuesta} onClose={() => setValidacionOpen(false)} />
            )}
            {!validacionOpen && validacion && (
              <button onClick={() => setValidacionOpen(true)} style={{ alignSelf: 'flex-start', display: 'inline-flex', alignItems: 'center', gap: 7, padding: '7px 12px', borderRadius: 999, border: `1px solid ${(RIESGO_META[validacion.riesgo] ?? RIESGO_META.MEDIO).color}`, background: (RIESGO_META[validacion.riesgo] ?? RIESGO_META.MEDIO).bg, color: (RIESGO_META[validacion.riesgo] ?? RIESGO_META.MEDIO).color, fontFamily: SANS, fontSize: 12.5, fontWeight: 600, cursor: 'pointer' }}>✨ Ver recomendaciones de MaKo · riesgo {validacion.riesgo}</button>
            )}

            {error && <Banner tono="bad" texto={error} onClose={() => setError(null)} />}
            {aviso && <Banner tono="good" texto={aviso} onClose={() => setAviso(null)} />}

            {/* Acciones */}
            <div style={{ display: 'flex', gap: 10, flexWrap: 'wrap', alignItems: 'center', paddingTop: 4 }}>
              <button onClick={() => { setValidacionOpen(true); void validar(edit); }} disabled={validando || !bodyOk} style={{ ...btnGhost, opacity: validando || !bodyOk ? 0.6 : 1 }}>{validando ? 'MaKo revisando…' : '✨ Validar ahora'}</button>
              {!esEdicionMeta && <button onClick={() => void guardar()} disabled={!puedeGuardar} style={{ ...btnGhost, opacity: !puedeGuardar ? 0.6 : 1 }}>{guardando ? 'Guardando…' : 'Guardar borrador'}</button>}
              <button onClick={() => setConfirmEnviar(true)} disabled={!puedeEnviar} title={cooldownActivo > 0 ? `Meta procesa el borrado: espera ${cooldownActivo}s` : (!paramsCompletos ? 'Completa los ejemplos de las variables' : '')} style={{ ...btnPrimary, marginLeft: 'auto', opacity: !puedeEnviar ? 0.5 : 1 }}>{cooldownActivo > 0 ? `Espera ${cooldownActivo}s…` : (esEdicionMeta ? 'Guardar cambios en Meta →' : 'Enviar a Meta a aprobar →')}</button>
              {esEdicionMeta
                ? <button onClick={() => setBorrarMetaName(edit.name)} style={{ ...btnGhost, color: 'var(--bad)', borderColor: 'var(--bad)' }}>Eliminar de Meta</button>
                : edit.id && <button onClick={() => void borrar(edit.id!)} style={{ ...btnGhost, color: 'var(--bad)', borderColor: 'var(--bad)' }}>Borrar</button>}
            </div>
            {cooldownActivo > 0 && <div style={{ fontSize: 11.5, color: 'var(--warn)' }}>Meta está procesando el borrado de <code style={{ fontFamily: MONO }}>{edit.name}</code>. Vas a poder reenviar en {cooldownActivo}s.</div>}
            {esEdicionMeta && <div style={{ fontSize: 11.5, color: 'var(--faint)' }}>Estás editando una plantilla que ya vive en Meta. Al guardar cambios vuelve a revisión (el nombre y el idioma no se pueden cambiar).</div>}
            {!paramsCompletos && edit.params.length > 0 && <div style={{ fontSize: 11.5, color: 'var(--faint)', textAlign: 'right' }}>Para enviar a Meta, completa los ejemplos de cada variable.</div>}
          </div>
        )}
      </div>

      {confirmEnviar && edit && (
        <div onClick={() => !enviando && setConfirmEnviar(false)} style={{ position: 'fixed', inset: 0, background: 'rgba(0,0,0,.45)', display: 'flex', alignItems: 'center', justifyContent: 'center', zIndex: 1000 }}>
          <div onClick={(e) => e.stopPropagation()} style={{ width: 'min(92vw, 460px)', background: 'var(--surface)', border: '1px solid var(--border)', borderRadius: 16, padding: 22, fontFamily: SANS }}>
            <div style={{ fontSize: 17, fontWeight: 600, color: 'var(--ink)', marginBottom: 8 }}>{esEdicionMeta ? 'Guardar cambios en Meta' : 'Enviar a aprobar a Meta'}</div>
            <div style={{ fontSize: 13.5, color: 'var(--dim)', lineHeight: 1.55 }}>
              {esEdicionMeta
                ? <>Vas a editar <code style={{ fontFamily: MONO }}>{edit.name}</code> en Meta. La plantilla <strong>vuelve a revisión</strong> (si estaba aprobada, deja de poder usarse hasta que la re-aprueben). Meta suele responder en minutos.</>
                : <>Vas a enviar <code style={{ fontFamily: MONO }}>{edit.name}</code> a Meta para revisión. Una vez enviada no se puede editar (sí borrar y rehacer). Meta suele responder en minutos.</>}
            </div>
            {validacion?.riesgo === 'ALTO' && <div style={{ marginTop: 12, padding: '9px 11px', borderRadius: 9, background: 'var(--bad-bg)', border: '1px solid var(--bad)', color: 'var(--bad)', fontSize: 12.5 }}>⚠ MaKo marcó riesgo ALTO de rechazo. Revisa las correcciones antes de enviar.</div>}
            <div style={{ display: 'flex', gap: 10, justifyContent: 'flex-end', marginTop: 18 }}>
              <button onClick={() => setConfirmEnviar(false)} disabled={enviando} style={btnGhost}>Cancelar</button>
              <button onClick={() => void enviarAMeta()} disabled={enviando} style={{ ...btnPrimary, opacity: enviando ? 0.6 : 1 }}>{enviando ? (esEdicionMeta ? 'Guardando…' : 'Enviando…') : (esEdicionMeta ? 'Confirmar cambios' : 'Confirmar y enviar')}</button>
            </div>
          </div>
        </div>
      )}

      {borrarMetaName && (
        <div onClick={() => setBorrarMetaName(null)} style={{ position: 'fixed', inset: 0, background: 'rgba(0,0,0,.45)', display: 'flex', alignItems: 'center', justifyContent: 'center', zIndex: 1000 }}>
          <div onClick={(e) => e.stopPropagation()} style={{ width: 'min(92vw, 440px)', background: 'var(--surface)', border: '1px solid var(--border)', borderRadius: 16, padding: 22, fontFamily: SANS }}>
            <div style={{ fontSize: 17, fontWeight: 600, color: 'var(--ink)', marginBottom: 8 }}>Eliminar de Meta</div>
            <div style={{ fontSize: 13.5, color: 'var(--dim)', lineHeight: 1.55 }}>Vas a <strong>eliminar</strong> <code style={{ fontFamily: MONO }}>{borrarMetaName}</code> de Meta. Si la usas en alguna secuencia, dejará de enviarse. Esta acción no se puede deshacer.</div>
            <div style={{ display: 'flex', gap: 10, justifyContent: 'flex-end', marginTop: 18 }}>
              <button onClick={() => setBorrarMetaName(null)} style={btnGhost}>Cancelar</button>
              <button onClick={() => void ejecutarBorrarMeta()} style={{ ...btnPrimary, background: 'var(--bad)' }}>Eliminar definitivamente</button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}

function Banner({ tono, texto, onClose }: { tono: 'good' | 'bad'; texto: string; onClose: () => void }) {
  const color = tono === 'bad' ? 'var(--bad)' : 'var(--good)';
  const bg = tono === 'bad' ? 'var(--bad-bg)' : 'var(--good-bg)';
  return (
    <div style={{ display: 'flex', alignItems: 'flex-start', gap: 10, padding: '10px 12px', borderRadius: 10, border: `1px solid ${color}`, background: bg, color, fontSize: 13 }}>
      <span style={{ flex: 1, minWidth: 0, lineHeight: 1.45 }}>{texto}</span>
      <button onClick={onClose} aria-label="Cerrar" title="Cerrar" style={{ flex: 'none', border: 'none', background: 'transparent', color, cursor: 'pointer', fontSize: 15, lineHeight: 1, padding: 0, opacity: 0.7 }}>✕</button>
    </div>
  );
}

function ValidacionCard({ v, validando, stale, onAplicar, onClose }: { v: Validacion | null; validando: boolean; stale: boolean; onAplicar: () => void; onClose: () => void }) {
  const r = v ? (RIESGO_META[v.riesgo] ?? RIESGO_META.MEDIO) : RIESGO_META.MEDIO;
  return (
    <div style={{ border: `1px solid ${v ? r.color : 'var(--border-strong)'}`, borderRadius: 12, padding: 14, background: v ? r.bg : 'var(--surface-2)' }}>
      <div style={{ display: 'flex', alignItems: 'center', gap: 8, marginBottom: v && v.hallazgos.length ? 10 : 0, flexWrap: 'wrap' }}>
        <span style={{ fontWeight: 700, fontSize: 13.5, color: v ? r.color : 'var(--dim)' }}>{v ? r.label : 'MaKo está revisando…'}</span>
        {validando && <span style={{ fontSize: 11.5, color: 'var(--dim)', fontFamily: MONO }}>actualizando…</span>}
        {!validando && stale && v && <span style={{ fontSize: 11, color: 'var(--warn)', fontFamily: MONO }}>· editaste, se revalida sola</span>}
        {v && <span style={{ marginLeft: 'auto', fontSize: 11, color: 'var(--dim)', fontFamily: MONO }}>sugerida: {v.categoria_sugerida}</span>}
        <button onClick={onClose} aria-label="Cerrar recomendaciones" title="Cerrar (la puedes reabrir abajo)" style={{ marginLeft: v ? 0 : 'auto', flex: 'none', border: 'none', background: 'transparent', color: v ? r.color : 'var(--dim)', cursor: 'pointer', fontSize: 15, lineHeight: 1, padding: 0, opacity: 0.7 }}>✕</button>
      </div>
      {v && v.hallazgos.map((h, i) => {
        const ref = refDeRegla(h.regla);
        return (
          <div key={i} style={{ display: 'flex', gap: 10, padding: '9px 0', borderTop: i ? '1px solid var(--border)' : 'none' }}>
            <div style={{ flex: 1, minWidth: 0 }}>
              <div style={{ fontSize: 13, color: 'var(--ink)', lineHeight: 1.45 }}><strong>{h.problema}</strong></div>
              {h.correccion && <div style={{ fontSize: 12.5, color: 'var(--dim)', marginTop: 2, lineHeight: 1.45 }}>→ {h.correccion}</div>}
            </div>
            <a href={ref.url} target="_blank" rel="noreferrer" title={`Ver en la doc de Meta: ${ref.titulo}`} style={{ flex: 'none', alignSelf: 'flex-start', fontSize: 11, fontWeight: 600, color: 'var(--primary)', textDecoration: 'none', whiteSpace: 'nowrap', border: '1px solid var(--border)', borderRadius: 7, padding: '3px 8px' }}>
              {h.regla ? `${h.regla} · ` : ''}regla ↗
            </a>
          </div>
        );
      })}
      {v?.propuesta && (
        <button onClick={onAplicar} style={{ marginTop: 10, padding: '8px 14px', borderRadius: 9, border: 'none', background: 'var(--ink)', color: 'var(--on-sidebar, #F3F5F8)', fontFamily: SANS, fontSize: 12.5, fontWeight: 600, cursor: 'pointer' }}>✨ Aplicar correcciones de MaKo</button>
      )}
    </div>
  );
}

// Vista read-only de una plantilla (borrador o de Meta), mostrando la versión
// FINAL (variables reemplazadas por sus ejemplos). El editor se abre con "Editar".
function TemplatePreview({ item, onEditar, onEliminar }: { item: Item; onEditar: () => void; onEliminar: () => void }) {
  const isDraft = item.kind === 'draft';
  const name = isDraft ? item.draft.name : item.meta.name;
  const status = (isDraft ? item.draft.status : item.meta.status).toLowerCase();
  const category = isDraft ? item.draft.category : item.meta.category;
  const language = isDraft ? item.draft.language : item.meta.language;
  const body = isDraft ? item.draft.body : item.meta.body;
  const headerText = isDraft ? (item.draft.headerMedia ? null : item.draft.header) : (item.meta.headerFormat === 'TEXT' ? item.meta.header : null);
  const headerFmt = isDraft ? (item.draft.headerMedia?.format ?? null) : (item.meta.headerFormat && item.meta.headerFormat !== 'TEXT' ? item.meta.headerFormat : null);
  const headerFile = isDraft ? item.draft.headerMedia?.filename : null;
  const footer = isDraft ? item.draft.footer : item.meta.footer;
  const buttons = isDraft ? item.draft.buttons : item.meta.buttons;
  const ejemplos = new Map<string, string>();
  if (isDraft) for (const p of item.draft.params) ejemplos.set(p.name, p.example || ejemploDe(p.name));
  else for (const n of item.meta.params) ejemplos.set(n, ejemploDe(n));
  const rejected = status === 'rejected' ? (isDraft ? explicarRechazo(item.draft.rejection_reason) : item.meta.rejectedMotivo) : null;
  const chip = statusChip(status);
  const btnGhost: CSSProperties = { padding: '9px 16px', borderRadius: 10, border: '1px solid var(--border-strong)', background: 'var(--surface)', color: 'var(--dim)', fontFamily: SANS, fontSize: 13, fontWeight: 600, cursor: 'pointer' };
  return (
    <div style={{ flex: 1, minHeight: 0, overflowY: 'auto', padding: 24, fontFamily: SANS }}>
      <div style={{ display: 'flex', alignItems: 'center', gap: 10, marginBottom: 14, flexWrap: 'wrap' }}>
        <span style={{ fontFamily: MONO, fontSize: 17, fontWeight: 600, color: 'var(--ink)' }}>{name}</span>
        <span style={{ fontSize: 11, fontWeight: 700, padding: '3px 10px', borderRadius: 999, color: chip.color, background: chip.bg }}>{chip.label}</span>
        <div style={{ marginLeft: 'auto', display: 'flex', gap: 8 }}>
          <button onClick={onEditar} style={{ ...btnGhost, background: 'var(--ink)', color: 'var(--on-sidebar, #F3F5F8)', border: 'none' }}>✎ Editar</button>
          <button onClick={onEliminar} style={{ ...btnGhost, color: 'var(--bad)', borderColor: 'var(--bad)' }}>Eliminar</button>
        </div>
      </div>
      <div style={{ fontSize: 12.5, color: 'var(--dim)', marginBottom: 16, fontFamily: MONO }}>{category} · {language}{ejemplos.size ? ` · vars: ${[...ejemplos.keys()].join(', ')}` : ''}</div>
      {rejected && (
        <div style={{ padding: '10px 12px', borderRadius: 10, border: '1px solid var(--bad)', background: 'var(--bad-bg)', color: 'var(--bad)', fontSize: 13, marginBottom: 14 }}><strong>Meta la rechazó.</strong> {rejected}</div>
      )}
      {/* Vista previa estilo WhatsApp con la versión final (ejemplos sustituidos) */}
      <div style={{ fontFamily: "'Geist Mono', monospace", fontSize: '10px', letterSpacing: '.1em', textTransform: 'uppercase', color: 'var(--faint)', marginBottom: 8 }}>Vista previa (con datos de ejemplo)</div>
      <div style={{ maxWidth: 460, padding: '12px 14px', borderRadius: 12, border: '1px solid var(--border)', background: 'var(--wa-bubble, var(--surface-2))' }}>
        {headerFmt && <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'center', height: 120, borderRadius: 8, background: 'var(--surface)', border: '1px dashed var(--border-strong)', color: 'var(--dim)', fontSize: 13, marginBottom: 8 }}>{MEDIA_LABEL[headerFmt] ?? headerFmt}{headerFile ? ` · ${headerFile}` : ''}</div>}
        {headerText && <div style={{ fontSize: 14, fontWeight: 700, color: 'var(--ink)', marginBottom: 6 }}>{renderConEjemplos(headerText, ejemplos)}</div>}
        <div style={{ color: 'var(--ink)', fontSize: 14, lineHeight: 1.55, whiteSpace: 'pre-wrap' }}>{renderConEjemplos(body, ejemplos) || '—'}</div>
        {footer && <div style={{ fontSize: 12, color: 'var(--dim)', marginTop: 8 }}>{footer}</div>}
        {buttons.length > 0 && (
          <div style={{ marginTop: 10, borderTop: '1px solid var(--border)', paddingTop: 8, display: 'flex', flexDirection: 'column', gap: 6 }}>
            {buttons.map((b, i) => <div key={i} style={{ textAlign: 'center', fontSize: 13, fontWeight: 600, color: 'var(--primary)' }}>{b.type === 'URL' ? '🔗 ' : b.type === 'PHONE_NUMBER' ? '📞 ' : '↩ '}{b.text}</div>)}
          </div>
        )}
      </div>
      {status !== 'borrador' && <div style={{ fontSize: 12, color: 'var(--faint)', marginTop: 14, lineHeight: 1.5 }}>Editar reenvía la plantilla a revisión de Meta. El nombre y el idioma no se pueden cambiar.</div>}
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
