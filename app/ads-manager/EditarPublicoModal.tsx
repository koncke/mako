'use client';

// =============================================================================
// EditarPublicoModal — editar el PÚBLICO (segmentación) de un conjunto existente
// =============================================================================
// Carga la segmentación actual (GET), deja cambiar los LUGARES, públicos
// personalizados, ubicaciones, Advantage+, edad y género, y guarda (POST).
//
// ⚠️ El POST /{adset} con `targeting` REEMPLAZA el objeto entero, y la ruta NO mergea:
// la superposición vive ACÁ, sobre el crudo de Meta (`base`). Lo que no se edita
// (intereses, idiomas, lo que sea) se conserva porque se re-envía intacto. Los lugares
// van por `aplicarLugares` (lib/meta-geo.ts): el geo se toca SÓLO si cambiaron, y si el
// crudo trae algo que el parser no entiende, quedan en sólo lectura — re-escribirlos
// sería borrar en silencio lo que no se entendió. Tarea #715.
// =============================================================================

import { useEffect, useMemo, useState, type CSSProperties } from 'react';
import { Dropdown } from '../components/Dropdown';
import { MakoStar, MakoWord } from '../_components/MakoBrand';
import { GENEROS, type AudienceRef } from '@/lib/campaign-types';
import { aplicarLugares, explicarErrorGeo, lugaresCambiaron, lugaresDesdeMeta, type LecturaGeo, type LugarMeta } from '@/lib/meta-geo';
import { LugarPicker } from './LugarPicker';
import { LugaresLectura } from './LugaresLectura';

const MONO = "'Geist Mono', monospace";
const SANS = "'Geist', sans-serif";
const lbl: CSSProperties = { fontFamily: MONO, fontSize: 10.5, letterSpacing: '.08em', textTransform: 'uppercase', color: 'var(--faint)', marginBottom: 6, display: 'block' };
const btnDark: CSSProperties = { padding: '11px 20px', borderRadius: 12, border: 'none', background: 'var(--ink)', color: 'var(--surface)', fontFamily: SANS, fontSize: 14.5, fontWeight: 600, cursor: 'pointer' };
const btnGhost: CSSProperties = { padding: '11px 18px', borderRadius: 12, border: '1px solid var(--border-strong)', background: 'var(--surface)', color: 'var(--dim)', fontFamily: SANS, fontSize: 14, cursor: 'pointer' };
const chipStyle = (on: boolean): CSSProperties => ({ padding: '7px 14px', borderRadius: 999, border: `1px solid ${on ? 'var(--primary)' : 'var(--border-strong)'}`, background: on ? 'rgba(47,111,237,.10)' : 'var(--surface)', color: on ? 'var(--primary-strong)' : 'var(--dim)', fontFamily: SANS, fontSize: 13, cursor: 'pointer' });

const PLACEMENTS = [{ value: 'facebook', label: 'Facebook' }, { value: 'instagram', label: 'Instagram' }, { value: 'audience_network', label: 'Audience Network' }, { value: 'messenger', label: 'Messenger' }];
type AudItem = AudienceRef & { count?: number | null };

export function EditarPublicoModal({ adsetId, adsetName, onClose, onSaved }: { adsetId: string; adsetName: string; onClose: () => void; onSaved: () => void }) {
  const [base, setBase] = useState<Record<string, unknown> | null>(null); // targeting CRUDO de Meta
  const [loadErr, setLoadErr] = useState<string | null>(null);
  const [audiencesAll, setAudiencesAll] = useState<AudItem[] | null>(null);
  // estados editables
  const [advantage, setAdvantage] = useState<0 | 1>(1);
  const [auds, setAuds] = useState<AudienceRef[]>([]);
  const [placements, setPlacements] = useState<string[] | null>(null);
  const [genero, setGenero] = useState('all');
  const [ageMin, setAgeMin] = useState<number | null>(null);
  const [ageMax, setAgeMax] = useState<number | null>(null);
  // lugares: la lectura del crudo (con lo que no se entendió) y lo que se está editando.
  const [lectura, setLectura] = useState<LecturaGeo | null>(null);
  const [lugares, setLugares] = useState<LugarMeta[]>([]);
  const [lugarOk, setLugarOk] = useState<boolean | null>(null);
  const [saving, setSaving] = useState(false); const [err, setErr] = useState<string | null>(null);

  useEffect(() => {
    let cancel = false;
    fetch(`/api/ads-manager/adset-targeting?adset_id=${encodeURIComponent(adsetId)}`, { cache: 'no-store' })
      .then((r) => r.json())
      .then((j) => {
        if (cancel) return;
        if (!j.ok) { setLoadErr(j.error || 'No se pudo cargar el conjunto'); return; }
        const t = (j.adset.targeting ?? {}) as Record<string, unknown>; setBase(t);
        const ta = t.targeting_automation as { advantage_audience?: unknown } | undefined;
        setAdvantage(Number(ta?.advantage_audience) === 1 ? 1 : 0);
        setAuds(Array.isArray(t.custom_audiences) ? (t.custom_audiences as Array<{ id?: unknown }>).map((a) => ({ id: String(a.id) })) : []);
        setPlacements(Array.isArray(t.publisher_platforms) && t.publisher_platforms.length ? (t.publisher_platforms as unknown[]).map(String) : null);
        const genders = Array.isArray(t.genders) ? (t.genders as unknown[]).map(Number) : [];
        const g = GENEROS.find((x) => JSON.stringify(x.genders) === JSON.stringify(genders)); setGenero(g?.value ?? 'all');
        setAgeMin(t.age_min != null ? Number(t.age_min) : null); setAgeMax(t.age_max != null ? Number(t.age_max) : null);
        const lec = lugaresDesdeMeta(t.geo_locations, t.excluded_geo_locations);
        setLectura(lec); setLugares(lec.lugares);
      })
      .catch((e) => { if (!cancel) setLoadErr(String(e)); });
    return () => { cancel = true; };
  }, [adsetId]);

  // "No pude preguntar" ≠ "pregunté y no hay": sin esto, un 403 se leía como una
  // cuenta sin públicos y el usuario iba a buscar el problema a Meta.
  useEffect(() => { fetch('/api/ads-manager/targeting?kind=audiences', { cache: 'no-store' }).then((r) => r.json()).then((j) => { setAudiencesAll(j.ok ? j.items : []); if (!j.ok) setLoadErr(`No pude traer tus públicos: ${j.error || 'error'}`); }).catch((e) => { setAudiencesAll([]); setLoadErr(`No pude traer tus públicos: ${String(e)}`); }); }, []);

  const nameById = useMemo(() => new Map((audiencesAll ?? []).map((a) => [a.id, a.name ?? a.id] as const)), [audiencesAll]);
  const opts = (audiencesAll ?? []).filter((a) => !auds.some((x) => x.id === a.id)).map((a) => ({ value: a.id, label: `${a.name ?? a.id}${a.count != null ? ` · ~${a.count.toLocaleString('es-MX')}` : ''}` }));
  // Para la búsqueda de lugares: el país de los lugares del PROPIO conjunto. No se pide
  // `kind=cuenta` como AgregarConjuntoModal: sería otra llamada a Meta por apertura, y el
  // país donde ya pauta este conjunto es mejor pista que el país fiscal de la cuenta.
  const sugerido = useMemo(() => lectura?.lugares.find((l) => l.pais)?.pais ?? null, [lectura]);
  const soloLectura = !!lectura?.noEntiendo.length;
  const geoCambio = !!lectura && !soloLectura && lugaresCambiaron(lectura, lugares);
  // Con lugares nuevos: al menos uno incluido y que Meta no los rechace (null = no se pudo
  // medir: no bloquea, como en las pantallas de creación). Sin cambios no se mira.
  const geoBloquea = geoCambio && (!lugares.some((l) => !l.excluir) || lugarOk === false);

  const guardar = async () => {
    if (!base || !lectura || geoBloquea) return;
    setSaving(true); setErr(null);
    try {
      // Superponemos SOLO lo editado sobre el targeting crudo. Los lugares PRIMERO y por su
      // función: sin cambios devuelve el geo crudo idéntico; con cambios lo re-escribe
      // conservando location_types; y tira antes de borrar algo que no entendió.
      const t: Record<string, unknown> = { ...aplicarLugares(base, lectura, lugares) };
      const genders = GENEROS.find((x) => x.value === genero)?.genders ?? [];
      if (genders.length) t.genders = genders; else delete t.genders;
      if (ageMin != null) t.age_min = ageMin; else delete t.age_min;
      if (ageMax != null) t.age_max = ageMax; else delete t.age_max;
      if (auds.length) t.custom_audiences = auds.map((a) => ({ id: a.id })); else delete t.custom_audiences;
      // Ubicaciones: coherencia con positions (Meta rechaza positions sin su plataforma).
      if (placements && placements.length) {
        t.publisher_platforms = placements;
        if (!placements.includes('facebook')) delete t.facebook_positions;
        if (!placements.includes('instagram')) delete t.instagram_positions;
      } else { delete t.publisher_platforms; delete t.facebook_positions; delete t.instagram_positions; }
      // Advantage+: si es 0 pero no hay señal fina, forzamos 1 (Meta rechaza 0 sin criterios).
      const hasFine = !!(t.age_min || t.age_max || (Array.isArray(t.genders) && t.genders.length) || (Array.isArray(t.custom_audiences) && t.custom_audiences.length) || (Array.isArray(t.flexible_spec) && (t.flexible_spec as unknown[]).length));
      t.targeting_automation = { ...(base.targeting_automation as Record<string, unknown> ?? {}), advantage_audience: advantage === 0 && !hasFine ? 1 : advantage };
      const targeting = t;
      const r = await fetch('/api/ads-manager/adset-targeting', { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify({ adset_id: adsetId, targeting }) });
      const j = await r.json();
      // Un rechazo de lugares viene en inglés y genérico; el que sirve es el subcode.
      if (!j.ok) throw new Error(explicarErrorGeo(j.error_subcode) ?? j.error ?? 'No se pudo guardar');
      onSaved();
    } catch (e) { setErr(e instanceof Error ? e.message : String(e)); }
    finally { setSaving(false); }
  };

  return (
    <div onClick={onClose} style={{ position: 'fixed', inset: 0, zIndex: 85, background: 'rgba(18,21,27,.55)', backdropFilter: 'blur(4px)', display: 'flex', alignItems: 'center', justifyContent: 'center', padding: '28px 18px', overflowY: 'auto' }}>
      <div onClick={(e) => e.stopPropagation()} style={{ width: '100%', maxWidth: 540, maxHeight: '92vh', display: 'flex', flexDirection: 'column', background: 'var(--surface)', border: '1px solid var(--border)', borderRadius: 20, boxShadow: '0 30px 80px rgba(18,21,27,.4)', overflow: 'hidden' }}>
        <div style={{ display: 'flex', alignItems: 'center', gap: 12, padding: '14px 20px', borderBottom: '1px solid var(--border)', flexShrink: 0 }}>
          <div style={{ display: 'inline-flex', alignItems: 'center', gap: 6, fontFamily: MONO, fontSize: 10.5, letterSpacing: '.12em', textTransform: 'uppercase', color: 'var(--dim)' }}><MakoStar size={12} /> <MakoWord base="var(--accent)">MaKo</MakoWord></div>
          <span style={{ fontFamily: SANS, fontSize: 14, fontWeight: 600, color: 'var(--ink)', margin: '0 auto', overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap', maxWidth: 300 }}>Editar público · {adsetName}</span>
          <button aria-label="Cerrar" onClick={onClose} style={{ width: 30, height: 30, flex: 'none', borderRadius: 9, border: '1px solid var(--border-strong)', background: 'var(--surface)', color: 'var(--dim)', fontSize: 14, cursor: 'pointer' }}>✕</button>
        </div>

        <div style={{ flex: 1, minHeight: 0, overflowY: 'auto', padding: '20px', display: 'flex', flexDirection: 'column', gap: 18 }}>
          {loadErr && <div style={{ fontSize: 13, color: 'var(--bad)', textAlign: 'center' }}>{loadErr}</div>}
          {!base && !loadErr && <div style={{ padding: '30px', textAlign: 'center', color: 'var(--dim)', fontSize: 14 }}>Cargando el público…</div>}
          {base && lectura && (
            <>
              <div>
                <span style={lbl}>Dónde se muestra</span>
                {soloLectura ? (
                  <LugaresLectura lectura={lectura} avisoNoEntiendo="Estos lugares se cambian en Meta. Lo demás se guarda igual." />
                ) : (
                  <LugarPicker compacto lugares={lugares} setLugares={setLugares} sugerido={sugerido} onValidez={setLugarOk} />
                )}
              </div>

              <div>
                <span style={lbl}>Optimización de audiencia (Advantage+)</span>
                <div style={{ display: 'flex', gap: 8 }}>
                  <button type="button" onClick={() => setAdvantage(1)} style={chipStyle(advantage === 1)}>Amplio (Meta optimiza)</button>
                  <button type="button" onClick={() => setAdvantage(0)} style={chipStyle(advantage === 0)}>Segmentación fina</button>
                </div>
              </div>

              <div>
                <span style={lbl}>Públicos personalizados (retargeting)</span>
                <Dropdown value="" resetAfterSelect placeholder={audiencesAll === null ? 'Cargando…' : opts.length ? 'Sumar un público…' : 'Sin públicos disponibles'} options={opts} onChange={(v) => { const a = (audiencesAll ?? []).find((x) => x.id === v); if (a) setAuds([...auds, { id: a.id, name: a.name }]); }} width="100%" />
                {auds.length > 0 && (
                  <div style={{ display: 'flex', gap: 8, flexWrap: 'wrap', marginTop: 8 }}>
                    {auds.map((a) => <span key={a.id} style={{ display: 'inline-flex', alignItems: 'center', gap: 6, padding: '6px 12px', borderRadius: 999, border: '1px solid var(--border-strong)', background: 'var(--surface-2)', fontSize: 13, color: 'var(--ink)' }}>{nameById.get(a.id) ?? a.name ?? a.id}<button type="button" onClick={() => setAuds(auds.filter((x) => x.id !== a.id))} style={{ border: 'none', background: 'transparent', cursor: 'pointer', color: 'var(--faint)', fontSize: 13, padding: 0 }}>✕</button></span>)}
                  </div>
                )}
              </div>

              <div>
                <span style={lbl}>Ubicaciones</span>
                <div style={{ display: 'flex', gap: 8, marginBottom: placements ? 8 : 0 }}>
                  <button type="button" onClick={() => setPlacements(null)} style={chipStyle(placements === null)}>Automáticas (Advantage+)</button>
                  <button type="button" onClick={() => setPlacements(placements ?? ['facebook', 'instagram'])} style={chipStyle(placements !== null)}>Manual</button>
                </div>
                {placements !== null && (
                  <div style={{ display: 'flex', gap: 8, flexWrap: 'wrap' }}>
                    {PLACEMENTS.map((p) => { const on = placements.includes(p.value); return <button key={p.value} type="button" onClick={() => setPlacements(on ? placements.filter((x) => x !== p.value) : [...placements, p.value])} style={chipStyle(on)}>{on ? '✓ ' : ''}{p.label}</button>; })}
                  </div>
                )}
              </div>

              <div style={{ display: 'flex', gap: 20, flexWrap: 'wrap' }}>
                <div>
                  <span style={lbl}>Género</span>
                  <div style={{ display: 'flex', gap: 8 }}>{GENEROS.map((g) => <button key={g.value} type="button" onClick={() => setGenero(g.value)} style={chipStyle(genero === g.value)}>{g.label}</button>)}</div>
                </div>
                <div>
                  <span style={lbl}>Edad</span>
                  <div style={{ display: 'flex', gap: 8, alignItems: 'center' }}>
                    <input value={ageMin ?? ''} inputMode="numeric" placeholder="18" onChange={(e) => { const n = Number(e.target.value.replace(/[^\d]/g, '')); setAgeMin(n >= 13 && n <= 65 ? n : null); }} style={{ width: 60, padding: '9px 10px', borderRadius: 10, border: '1px solid var(--border-strong)', background: 'var(--surface-2)', color: 'var(--ink)', fontFamily: SANS, fontSize: 14, outline: 'none', textAlign: 'center' }} />
                    <span style={{ color: 'var(--faint)' }}>a</span>
                    <input value={ageMax ?? ''} inputMode="numeric" placeholder="65" onChange={(e) => { const n = Number(e.target.value.replace(/[^\d]/g, '')); setAgeMax(n >= 13 && n <= 65 ? n : null); }} style={{ width: 60, padding: '9px 10px', borderRadius: 10, border: '1px solid var(--border-strong)', background: 'var(--surface-2)', color: 'var(--ink)', fontFamily: SANS, fontSize: 14, outline: 'none', textAlign: 'center' }} />
                  </div>
                </div>
              </div>
              {/* Decía «La ubicación geográfica … se conservan»: desde la #715 los lugares se
                  editan arriba. Lo que se conserva es lo que esta pantalla no muestra. */}
              <p style={{ fontSize: 11.5, color: 'var(--faint)', margin: 0, lineHeight: 1.5 }}>Los intereses y lo que no se ve aquí se conservan. Los cambios entran en revisión de Meta.</p>
            </>
          )}
        </div>

        {base && lectura && (
          <div style={{ flexShrink: 0, borderTop: '1px solid var(--border)', padding: '14px 20px', display: 'flex', alignItems: 'center', justifyContent: 'flex-end', gap: 12, flexWrap: 'wrap' }}>
            {/* La consecuencia de cambiar lugares, pegada al botón y en tinta normal (AGENTS.md):
                un conjunto que gasta pasa a gastar en otro lado, Meta lo vuelve a revisar y el
                aprendizaje arranca de cero. No se deshace volviendo atrás. Va en su propio
                renglón, justo encima: al lado, en 540 px, empujaba el botón a otra línea. */}
            {geoCambio && <span style={{ flexBasis: '100%', textAlign: 'right', fontSize: 12.5, color: 'var(--ink)', lineHeight: 1.4 }}>Cambia dónde gasta. Meta lo revisa y reinicia el aprendizaje.</span>}
            {err && <span style={{ fontSize: 12.5, color: 'var(--bad)', lineHeight: 1.4, marginRight: 'auto' }}>{err}</span>}
            <button aria-label="Cerrar" onClick={onClose} style={btnGhost}>Cancelar</button>
            <button onClick={guardar} disabled={saving || geoBloquea} style={{ ...btnDark, opacity: saving || geoBloquea ? 0.5 : 1, cursor: saving || geoBloquea ? 'default' : 'pointer' }}>{saving ? 'Guardando…' : geoCambio ? 'Guardar con los lugares nuevos' : 'Guardar público'}</button>
          </div>
        )}
      </div>
    </div>
  );
}
