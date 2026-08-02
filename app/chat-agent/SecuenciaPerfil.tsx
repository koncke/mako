'use client';

// =============================================================================
// SecuenciaPerfil — perfil + edición de una secuencia de mensajes (réplica de TemplateDetalleModal)
// =============================================================================
// Cubre TODO el chat (inline, como en SuperAdmin). Explica CÓMO JUEGA (diagrama
// de pasos), deja editar la estrategia (objetivo/gancho/preguntas), activar/
// pausar, abrir el wizard para que MaKo redacte, y probarla DE VERDAD (te llega
// a tu teléfono/mail). Setter = solo lectura (sin botones de escritura).

import { useState, type CSSProperties } from 'react';
import { Dropdown } from '../components/Dropdown';
import type { AudioSetting, SecuenciaDto, Opcion, PasoSecuenciaDto } from './ChatAgentApp';
import { DESENLACE_VACIO, type Desenlace, type ModoRespuesta, type Objetivo } from '@/lib/setting-estrategia';

const btn: CSSProperties = { padding: '9px 16px', borderRadius: 9, border: 'none', background: 'var(--primary)', color: '#fff', fontSize: 13, fontWeight: 600, cursor: 'pointer', fontFamily: 'inherit' };
const btnGhost: CSSProperties = { ...btn, background: 'transparent', color: 'var(--dim)', border: '1px solid var(--border-strong)' };
const inp: CSSProperties = { width: '100%', boxSizing: 'border-box', padding: '9px 12px', borderRadius: 9, border: '1px solid var(--border-strong)', background: 'var(--surface-2)', color: 'var(--ink)', fontSize: 13.5, fontFamily: "'Geist', sans-serif", outline: 'none' };

function Paso({ icono, titulo, detalle, tono = 'neutro' }: { icono: string; titulo: string; detalle?: string; tono?: 'neutro' | 'mako' | 'dueno' }) {
  const bg = tono === 'mako' ? 'var(--primary-bg)' : 'var(--surface-2)';
  const bd = tono === 'mako' ? 'var(--primary-weak)' : 'var(--border)';
  return (
    <div style={{ display: 'flex', gap: 11, alignItems: 'flex-start', padding: '11px 13px', borderRadius: 12, background: bg, border: `1px solid ${bd}` }}>
      <span style={{ fontSize: 18, flex: 'none', lineHeight: 1.2 }}>{icono}</span>
      <div style={{ minWidth: 0 }}>
        <div style={{ fontWeight: 600, fontSize: 13.5, color: 'var(--ink)' }}>{titulo}</div>
        {detalle && <div style={{ fontSize: 12.5, color: 'var(--dim)', marginTop: 2, lineHeight: 1.45 }}>{detalle}</div>}
      </div>
    </div>
  );
}
const Flecha = () => <div style={{ display: 'flex', justifyContent: 'center', color: 'var(--faint)', fontSize: 14, margin: '2px 0' }}>↓</div>;

async function api(body: unknown): Promise<{ ok: boolean; error?: string; enviadosWa?: number; enviadosEmail?: number; avisos?: string[] }> {
  try { return await (await fetch('/api/chat-agent/secuencias', { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify(body) })).json(); } catch { return { ok: false, error: 'sin conexión' }; }
}

const EMOJI_OBJ: Record<Objetivo, string> = { agendar: '📅', preparar: '🎯', reactivar: '🧲', cualificar: '❓', confirmar_pago: '💳' };

export function SecuenciaPerfil({ secuencia, objetivos, etiquetaEtapa, rolAdmin, audios, onClose, onCambio, onWizard }: {
  secuencia: SecuenciaDto;
  objetivos: Opcion[];
  etiquetaEtapa: (key: string) => string;
  rolAdmin: boolean;
  audios: AudioSetting[];
  onClose: () => void;
  onCambio: () => void;
  onWizard: () => void;
}) {
  const est = secuencia.estrategia;
  // string y no Objetivo: el dueño puede haber escrito el suyo con "Otro".
  const [objetivo, setObjetivo] = useState<string>(est?.objetivo ?? 'agendar');
  const [gancho, setGancho] = useState(est?.gancho ?? '');
  const [preguntas, setPreguntas] = useState((est?.preguntas ?? []).join('\n'));
  const [modo, setModo] = useState<ModoRespuesta>(est?.modo ?? 'asistido');
  const [califica, setCalifica] = useState((est?.criterio?.califica ?? []).join('\n'));
  const [descalifica, setDescalifica] = useState((est?.criterio?.descalifica ?? []).join('\n'));
  const [activa, setActiva] = useState(secuencia.activa);
  const [busy, setBusy] = useState<string | null>(null);
  const [flash, setFlash] = useState<string | null>(null);
  const [err, setErr] = useState<string | null>(null);
  // Sub-tabs: el detalle mezclaba estrategia, mensajes y ajustes en una columna
  // larga, así que editar el mensaje 4 era scrollear a ciegas.
  const [tab, setTab] = useState<'estrategia' | 'mensajes' | 'variantes'>('estrategia');
  // Los pasos pasan a ser ESTADO: antes se pintaban en solo lectura y lo único
  // editable era colgarles un audio.
  const [pasos, setPasos] = useState<PasoSecuenciaDto[]>(secuencia.pasos);
  const [pasoAbierto, setPasoAbierto] = useState(0);
  const [desenlace, setDesenlace] = useState<Desenlace>(est?.desenlace ?? { ...DESENLACE_VACIO });

  const flashOk = (m: string) => { setFlash(m); setTimeout(() => setFlash(null), 2600); };

  const guardar = async () => {
    setBusy('save'); setErr(null);
    const r = await api({
      action: 'guardar-estrategia', secuenciaId: secuencia.id,
      estrategia: {
        objetivo, gancho: gancho.trim() || null, lead_magnet_id: est?.lead_magnet_id ?? null,
        preguntas: preguntas.split('\n').map((p) => p.trim()).filter(Boolean),
        criterio: {
          califica: califica.split('\n').map((s) => s.trim()).filter(Boolean),
          descalifica: descalifica.split('\n').map((s) => s.trim()).filter(Boolean),
        },
        modo, desenlace,
        usa_lead_magnet: est?.usa_lead_magnet ?? Boolean(est?.lead_magnet_id),
        notas: est?.notas ?? null, probada_at: est?.probada_at ?? null,
      },
    });
    if (!r.ok) { setErr(r.error || 'No se pudo guardar.'); setBusy(null); return; }
    // Los mensajes van por su propio endpoint (el mismo que usa el editor de
    // /whatsapp). setSecuenciaPasos mergea las variantes por orden, así que
    // guardar acá no las borra.
    try {
      const rp = await (await fetch('/api/whatsapp/secuencias', {
        method: 'PATCH', headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ id: secuencia.id, pasos }),
      })).json();
      if (!rp.ok) { setErr(rp.error || 'La estrategia se guardó, pero los mensajes no.'); setBusy(null); return; }
    } catch { setErr('La estrategia se guardó, pero los mensajes no.'); setBusy(null); return; }
    flashOk('Guardado ✓'); onCambio();
    setBusy(null);
  };

  const editarPaso = (orden: number, campo: 'cuerpo' | 'asunto', val: string) =>
    setPasos((prev) => prev.map((p) => (p.orden === orden ? { ...p, [campo]: val } : p)));

  const editarVariante = (orden: number, i: number, val: string) =>
    setPasos((prev) => prev.map((p) => (p.orden !== orden ? p : {
      ...p, variantes: (p.variantes ?? []).map((v, k) => (k === i ? val : v)),
    })));

  const quitarVariante = (orden: number, i: number) =>
    setPasos((prev) => prev.map((p) => (p.orden !== orden ? p : {
      ...p, variantes: (p.variantes ?? []).filter((_, k) => k !== i),
    })));

  /** Un paso nuevo al final, de WhatsApp no oficial (el default seguro). */
  const agregarPaso = () => setPasos((prev) => [...prev, {
    orden: prev.length + 1, canal: 'whatsapp', delay_horas: 24, asunto: null, cuerpo: '',
    proveedor: 'no_oficial', template_wa: null,
  }]);

  const quitarPaso = (orden: number) =>
    setPasos((prev) => prev.filter((p) => p.orden !== orden).map((p, i) => ({ ...p, orden: i + 1 })));

  /** MaKo escribe las variantes de todos los pasos, una sola vez. */
  async function generarVariantes() {
    setBusy('variantes'); setErr(null);
    const r = await api({ action: 'variantes', secuenciaId: secuencia.id });
    if (r.ok) { flashOk('Variantes escritas ✓'); onCambio(); } else setErr(r.error || 'No se pudieron generar.');
    setBusy(null);
  }

  const toggle = async () => {
    setBusy('toggle'); setErr(null);
    try {
      const r = await (await fetch('/api/whatsapp/secuencias', { method: 'PATCH', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify({ id: secuencia.id, activa: !activa }) })).json();
      if (r.ok) { setActiva(!activa); flashOk(!activa ? 'Activada ✓' : 'Pausada ✓'); onCambio(); } else setErr(r.error || 'No se pudo cambiar.');
    } catch { setErr('Sin conexión — prueba de nuevo.'); }
    setBusy(null);
  };

  const probar = async () => {
    setBusy('probar'); setErr(null);
    const r = await api({ action: 'probar', secuenciaId: secuencia.id });
    if (r.ok) flashOk(`Prueba enviada ✓ (${r.enviadosWa ?? 0} WhatsApp · ${r.enviadosEmail ?? 0} email)${r.avisos?.length ? ` — ${r.avisos[0]}` : ''}`);
    else setErr(r.error || 'La prueba no salió.');
    setBusy(null);
  };

  // Cada paso de WhatsApp puede ser TEXTO o una NOTA DE VOZ de la biblioteca
  // (reunión 31/07). Se persiste con el PATCH de secuencias (mismo endpoint que
  // el editor de /whatsapp): el motor fuerza no oficial para los audios.
  async function setAudioDePaso(orden: number, audioId: number | null) {
    setBusy('paso'); setErr(null);
    const pasosRef = pasos;
    try {
      const pasos = pasosRef.map((p) => (p.orden !== orden ? p : (
        audioId ? { ...p, canal: 'whatsapp' as const, tipo: 'audio' as const, audio_id: audioId } : { ...p, tipo: 'texto' as const, audio_id: null }
      )));
      const r = await (await fetch('/api/whatsapp/secuencias', { method: 'PATCH', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify({ id: secuencia.id, pasos }) })).json();
      if (r.ok) { setPasos(pasos); flashOk(audioId ? 'Audio asignado ✓' : 'Vuelto a texto ✓'); onCambio(); } else setErr(r.error || 'No se pudo guardar el paso.');
    } catch { setErr('Sin conexión — prueba de nuevo.'); }
    setBusy(null);
  }

  // MaKo deduce el criterio de los leads YA calificados del CRM. Es una
  // propuesta para corregir: el criterio real vive en la cabeza del dueño.
  async function sugerirCriterio() {
    setBusy('criterio'); setErr(null);
    try {
      const r = await (await fetch('/api/chat-agent/secuencias', { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify({ action: 'sugerir-criterio' }) })).json();
      if (!r.ok) { setErr(r.error || 'MaKo no pudo deducir el criterio.'); return; }
      setCalifica((r.criterio?.califica ?? []).join('\n'));
      setDescalifica((r.criterio?.descalifica ?? []).join('\n'));
      flashOk(`MaKo lo dedujo de ${r.muestra ?? 0} leads ya evaluados — revisalo y guarda`);
    } catch { setErr('Sin conexión — prueba de nuevo.'); }
    setBusy(null);
  }

  const nPreg = preguntas.split('\n').filter((p) => p.trim()).length;
  const pasosWa = secuencia.pasos.filter((p) => p.canal === 'whatsapp').length;
  const pasosEmail = secuencia.pasos.filter((p) => p.canal === 'email').length;

  return (
    <div style={{ height: '100%', width: '100%', background: 'var(--surface)', border: '1px solid var(--border)', borderRadius: 16, display: 'flex', flexDirection: 'column', overflow: 'hidden' }}>
      {/* Topbar fija (no scrollea) — patrón TemplateDetalleModal */}
      <div style={{ flex: 'none', display: 'flex', justifyContent: 'space-between', alignItems: 'center', padding: '14px 20px', borderBottom: '1px solid var(--border)' }}>
        <button onClick={onClose} title="Volver" style={{ display: 'inline-flex', alignItems: 'center', gap: 6, background: 'none', border: 'none', fontSize: 14, fontWeight: 600, color: 'var(--dim)', cursor: 'pointer', padding: 0, fontFamily: 'inherit' }}>← Volver al chat</button>
        {rolAdmin && <button onClick={probar} disabled={busy === 'probar'} style={{ background: 'none', border: 'none', color: 'var(--primary)', fontSize: 13, fontWeight: 600, cursor: 'pointer', opacity: busy === 'probar' ? 0.5 : 1 }}>{busy === 'probar' ? 'Enviando…' : '📲 Probar de verdad (te llega a vos)'}</button>}
      </div>
      <div style={{ flex: 1, overflowY: 'auto', padding: 24 }}>
        <div style={{ maxWidth: 560, margin: '0 auto' }}>

          <div style={{ display: 'flex', gap: 11, alignItems: 'center', minWidth: 0, marginBottom: 18 }}>
            <div style={{ width: 44, height: 44, borderRadius: '50%', flex: 'none', background: 'var(--surface-2)', border: '1px solid var(--border)', display: 'flex', alignItems: 'center', justifyContent: 'center', fontSize: 22 }}>{est ? (EMOJI_OBJ[est.objetivo as Objetivo] ?? '🎯') : '⚑'}</div>
            <div style={{ minWidth: 0, flex: 1 }}>
              <div style={{ fontSize: 16, fontWeight: 700, color: 'var(--ink)' }}>{secuencia.nombre}</div>
              <div style={{ fontSize: 11.5, color: 'var(--faint)' }}>{etiquetaEtapa(secuencia.etapa)} · {pasosWa} WhatsApp · {pasosEmail} email{est?.probada_at ? ' · probada ✓' : ''}</div>
            </div>
            <div style={{ flex: 'none', display: 'inline-flex', alignItems: 'center', gap: 8 }}>
              <span style={{ fontSize: 12.5, fontWeight: 600, color: activa ? 'var(--good)' : 'var(--dim)' }}>{activa ? 'Activa' : 'Pausada'}</span>
              {rolAdmin && (
                <button onClick={toggle} disabled={busy === 'toggle'} aria-pressed={activa} title={activa ? 'Pausar' : 'Activar'}
                  style={{ width: 42, height: 24, borderRadius: 999, border: 'none', padding: 2, background: activa ? 'var(--good)' : 'var(--border-strong)', cursor: 'pointer', flex: 'none', transition: 'background .15s' }}>
                  <span style={{ display: 'block', width: 20, height: 20, borderRadius: '50%', background: '#fff', transform: activa ? 'translateX(18px)' : 'none', transition: 'transform .15s' }} />
                </button>
              )}
            </div>
          </div>

          {/* Sub-tabs: antes todo vivía en una sola columna larga, así que editar
              el mensaje 4 era scrollear a ciegas hasta encontrarlo. */}
          <div style={{ display: 'inline-flex', background: 'var(--surface-2)', border: '1px solid var(--border)', borderRadius: 11, padding: 3, gap: 3, marginBottom: 16 }}>
            {([
              { k: 'estrategia' as const, t: 'Estrategia' },
              { k: 'mensajes' as const, t: `Mensajes (${pasos.length})` },
              { k: 'variantes' as const, t: 'Variantes' },
            ]).map((o) => (
              <button key={o.k} onClick={() => setTab(o.k)}
                style={{ padding: '7px 14px', borderRadius: 9, border: 'none', cursor: 'pointer', fontFamily: 'inherit', fontSize: 12.5, fontWeight: 600, background: tab === o.k ? 'var(--surface)' : 'transparent', color: tab === o.k ? 'var(--ink)' : 'var(--dim)' }}>
                {o.t}
              </button>
            ))}
          </div>

          {tab === 'estrategia' && (<>
          <div style={{ fontFamily: "'Geist Mono', monospace", fontSize: 10.5, letterSpacing: '.09em', textTransform: 'uppercase', color: 'var(--dim)', marginBottom: 10 }}>¿Cómo juega?</div>
          <div style={{ marginBottom: 20 }}>
            <Paso icono="⚡" titulo="Se dispara cuando…" detalle={`El lead está parado en la etapa «${etiquetaEtapa(secuencia.etapa)}» de tu funnel.`} />
            <Flecha />
            <Paso icono="💬" titulo={`MaKo le manda la secuencia (${secuencia.pasos.length} mensajes)`} detalle="Con el anti-ban de siempre; los pasos de WhatsApp oficial esperan la plantilla aprobada por Meta." tono="mako" />
            {nPreg > 0 && (<><Flecha /><Paso icono="❓" titulo={`Cualifica con ${nPreg} pregunta${nPreg === 1 ? '' : 's'}`} detalle="Sembradas con naturalidad en la charla — y la base del Setter IA." tono="mako" /></>)}
            <Flecha />
            <Paso icono="✅" titulo={objetivos.find((o) => o.value === objetivo)?.label ?? objetivo} detalle={gancho.trim() ? `Gancho: ${gancho.trim()}` : undefined} tono="dueno" />
          </div>

          <div style={{ fontFamily: "'Geist Mono', monospace", fontSize: 10.5, letterSpacing: '.09em', textTransform: 'uppercase', color: 'var(--dim)', marginBottom: 8 }}>La estrategia</div>
          <div style={{ display: 'flex', flexDirection: 'column', gap: 12, marginBottom: 14 }}>
            <div style={{ display: 'flex', gap: 10, alignItems: 'center', flexWrap: 'wrap' }}>
              <Dropdown value={objetivo} onChange={(v) => setObjetivo(v as Objetivo)} width={230} ariaLabel="Objetivo de la secuencia de mensajes"
                options={objetivos.map((o) => ({ value: o.value, label: `${EMOJI_OBJ[o.value as Objetivo] ?? ''} ${o.label}` }))} />
              <input value={gancho} onChange={(e) => setGancho(e.target.value)} placeholder="Gancho (lead magnet / oferta)…" style={{ ...inp, width: 'auto', flex: 1, minWidth: 180 }} disabled={!rolAdmin} />
            </div>
            <div>
              <div style={{ fontSize: 12, color: 'var(--faint)', marginBottom: 6 }}>Preguntas de cualificación — una por línea (el Setter y el simulador las usan en este orden):</div>
              <textarea value={preguntas} onChange={(e) => setPreguntas(e.target.value)} rows={5} placeholder={'¿Facturás más de …?\n¿Tienes equipo?'} style={{ ...inp, resize: 'vertical', lineHeight: 1.5 }} disabled={!rolAdmin} />
            </div>
            <div>
              <div style={{ display: 'flex', alignItems: 'center', gap: 10, flexWrap: 'wrap', marginBottom: 6 }}>
                <span style={{ fontSize: 12, color: 'var(--faint)' }}>Criterio de calificación — decide si la charla termina en llamada o en despedida:</span>
                {rolAdmin && (
                  <button onClick={() => void sugerirCriterio()} disabled={busy === 'criterio'} style={{ ...btnGhost, marginLeft: 'auto', padding: '5px 11px', fontSize: 11.5 }}>
                    {busy === 'criterio' ? 'Deduciendo…' : '✨ Que MaKo lo deduzca del CRM'}
                  </button>
                )}
              </div>
              <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 10 }}>
                <div>
                  <div style={{ fontSize: 11.5, color: 'var(--good)', fontWeight: 600, marginBottom: 4 }}>✓ Califica si…</div>
                  <textarea value={califica} onChange={(e) => setCalifica(e.target.value)} rows={4} placeholder={'Tiene equipo a cargo\nQuiere escalar sin depender de él'} style={{ ...inp, resize: 'vertical', lineHeight: 1.5 }} disabled={!rolAdmin} />
                </div>
                <div>
                  <div style={{ fontSize: 11.5, color: 'var(--bad)', fontWeight: 600, marginBottom: 4 }}>✕ No califica si…</div>
                  <textarea value={descalifica} onChange={(e) => setDescalifica(e.target.value)} rows={4} placeholder={'Recién arranca, sin facturación\nBusca empleo, no consultoría'} style={{ ...inp, resize: 'vertical', lineHeight: 1.5 }} disabled={!rolAdmin} />
                </div>
              </div>
            </div>
            <div>
              <div style={{ fontSize: 12, color: 'var(--faint)', marginBottom: 6 }}>Cuando el lead responde:</div>
              <div style={{ display: 'flex', gap: 8, flexWrap: 'wrap' }}>
                {([
                  { v: 'asistido' as const, t: '🙋 Te aviso y te dejo el borrador', d: 'MaKo redacta la respuesta y vos la apruebas con un clic' },
                  { v: 'automatico' as const, t: '⏸ Solo pausar', d: 'La secuencia se frena y seguís por tu cuenta' },
                ]).map((o) => (
                  <button key={o.v} onClick={() => rolAdmin && setModo(o.v)} disabled={!rolAdmin} title={o.d}
                    style={{ padding: '8px 13px', borderRadius: 10, cursor: rolAdmin ? 'pointer' : 'default', fontFamily: 'inherit', fontSize: 12.5, fontWeight: 600, border: '1px solid ' + (modo === o.v ? 'var(--ink)' : 'var(--border-strong)'), background: modo === o.v ? 'var(--ink)' : 'var(--surface-2)', color: modo === o.v ? 'var(--on-sidebar)' : 'var(--dim)' }}>
                    {o.t}
                  </button>
                ))}
              </div>
            </div>
          </div>

          {/* Cuándo deja de hacer falta esta secuencia. Sin esto seguía mandando
              pasos hasta quedarse sin pasos, y no había forma de encadenarla
              con la siguiente. */}
          <div style={{ fontFamily: "'Geist Mono', monospace", fontSize: 10.5, letterSpacing: '.09em', textTransform: 'uppercase', color: 'var(--dim)', margin: '4px 0 8px' }}>Cuándo termina</div>
          <div style={{ display: 'flex', flexDirection: 'column', gap: 10, marginBottom: 18 }}>
            <div style={{ display: 'flex', gap: 10, alignItems: 'center', flexWrap: 'wrap' }}>
              <span style={{ fontSize: 12, color: 'var(--good)', fontWeight: 600, minWidth: 74 }}>Se logra si</span>
              <Dropdown value={desenlace.logrado} onChange={(v) => setDesenlace((d) => ({ ...d, logrado: v as Desenlace['logrado'] }))} width={230} ariaLabel="Cuándo se logra"
                options={[
                  { value: 'respondio', label: 'Responde cualquier cosa' },
                  { value: 'agendo', label: 'Agenda una reunión' },
                  { value: 'pago', label: 'Paga' },
                  { value: 'ninguno', label: 'No cierra sola' },
                ]} />
            </div>
            <div style={{ display: 'flex', gap: 10, alignItems: 'center', flexWrap: 'wrap' }}>
              <span style={{ fontSize: 12, color: 'var(--warn)', fontWeight: 600, minWidth: 74 }}>Falla si</span>
              <Dropdown value={String(desenlace.falloDias)} onChange={(v) => setDesenlace((d) => ({ ...d, falloDias: Number(v) }))} width={230} ariaLabel="Cuándo falla"
                options={[
                  { value: '0', label: 'Nunca: la dejo corriendo' },
                  { value: '7', label: 'Pasan 7 días sin respuesta' },
                  { value: '14', label: 'Pasan 14 días sin respuesta' },
                  { value: '30', label: 'Pasan 30 días sin respuesta' },
                ]} />
            </div>
          </div>
          </>)}

          {tab === 'mensajes' && (<>
          {/* Los mensajes: cada paso de WhatsApp puede ser texto o nota de voz */}
          <div style={{ fontFamily: "'Geist Mono', monospace", fontSize: 10.5, letterSpacing: '.09em', textTransform: 'uppercase', color: 'var(--dim)', margin: '4px 0 8px' }}>Los mensajes</div>
          <div style={{ display: 'flex', flexDirection: 'column', gap: 8, marginBottom: 16 }}>
            {pasos.map((p) => {
              const audio = p.tipo === 'audio' && p.audio_id ? audios.find((a) => a.id === p.audio_id) : null;
              const abierto = pasoAbierto === p.orden;
              return (
                <div key={p.orden} style={{ borderRadius: 11, background: 'var(--surface-2)', border: '1px solid ' + (abierto ? 'var(--border-strong)' : 'var(--border)'), overflow: 'hidden' }}>
                  <button type="button" onClick={() => setPasoAbierto(abierto ? 0 : p.orden)}
                    style={{ width: '100%', display: 'flex', alignItems: 'center', gap: 8, padding: '11px 13px', background: 'none', border: 0, cursor: 'pointer', textAlign: 'left', fontFamily: 'inherit' }}>
                    <span style={{ flex: 'none', fontSize: 11.5, color: 'var(--faint)' }}>
                      {p.canal === 'email' ? '✉️ Email' : audio ? '🎙 Nota de voz' : '💬 WhatsApp'} · {p.orden}
                    </span>
                    <span style={{ flex: 1, minWidth: 0, fontSize: 12.5, color: 'var(--dim)', whiteSpace: 'nowrap', overflow: 'hidden', textOverflow: 'ellipsis' }}>
                      {audio ? audio.titulo : (p.cuerpo.slice(0, 70) || 'Sin texto todavía')}
                    </span>
                    {(p.variantes?.length ?? 0) > 0 && (
                      <span style={{ flex: 'none', fontSize: 10.5, color: 'var(--good)', border: '1px solid var(--good)', borderRadius: 6, padding: '1px 5px' }}>{p.variantes?.length} variantes</span>
                    )}
                    <span aria-hidden style={{ flex: 'none', color: 'var(--faint)', fontSize: 11, transform: abierto ? 'rotate(180deg)' : 'none', transition: 'transform .15s' }}>▾</span>
                  </button>

                  {abierto && (
                    <div style={{ padding: '0 13px 13px', display: 'flex', flexDirection: 'column', gap: 9 }}>
                      {p.canal === 'whatsapp' && rolAdmin && (
                        <Dropdown
                          value={audio ? String(audio.id) : ''}
                          onChange={(v) => void setAudioDePaso(p.orden, v ? Number(v) : null)}
                          width="100%"
                          ariaLabel={`Audio del mensaje ${p.orden}`}
                          buttonStyle={{ padding: '7px 11px', fontSize: 12.5 }}
                          options={[{ value: '', label: '💬 Texto escrito' }, ...audios.map((a) => ({ value: String(a.id), label: `🎙 ${a.titulo}` }))]}
                        />
                      )}
                      {audio ? (
                        <div style={{ display: 'flex', alignItems: 'center', gap: 10, flexWrap: 'wrap' }}>
                          {audio.url && <audio controls src={audio.url} style={{ height: 34, maxWidth: 260 }} />}
                          {audio.transcript && <span style={{ fontSize: 12, color: 'var(--faint)', flex: '1 1 180px' }}>{audio.transcript.slice(0, 120)}</span>}
                        </div>
                      ) : (
                        <>
                          {p.canal === 'email' && (
                            <input value={p.asunto ?? ''} onChange={(e) => editarPaso(p.orden, 'asunto', e.target.value)} placeholder="Asunto" style={{ ...inp, fontWeight: 600 }} disabled={!rolAdmin} />
                          )}
                          <textarea value={p.cuerpo} onChange={(e) => editarPaso(p.orden, 'cuerpo', e.target.value)} rows={p.canal === 'email' ? 6 : 4}
                            placeholder="Qué dice este mensaje…" style={{ ...inp, resize: 'vertical', lineHeight: 1.55 }} disabled={!rolAdmin} />
                        </>
                      )}
                      {rolAdmin && pasos.length > 1 && (
                        <button onClick={() => quitarPaso(p.orden)} style={{ background: 'none', border: 'none', color: 'var(--bad)', fontSize: 12.5, cursor: 'pointer', alignSelf: 'flex-start', padding: 0, fontFamily: 'inherit' }}>Quitar este mensaje</button>
                      )}
                    </div>
                  )}
                </div>
              );
            })}
            {rolAdmin && <button onClick={agregarPaso} style={{ ...btnGhost, alignSelf: 'flex-start' }}>+ Agregar un mensaje</button>}
          </div>
          </>)}

          {tab === 'variantes' && (<>
          <div style={{ fontSize: 13, color: 'var(--dim)', lineHeight: 1.6, marginBottom: 12 }}>
            El mismo mensaje dicho de formas distintas: el motor sortea una en cada envío. Mandarle el texto idéntico a cientos de personas es lo que WhatsApp busca para restringir un número, y además se lee como un bot.
          </div>
          {rolAdmin && (
            <button onClick={() => void generarVariantes()} disabled={busy === 'variantes'} style={{ ...btnGhost, marginBottom: 14 }}>
              {busy === 'variantes' ? 'MaKo está escribiendo…' : '✨ Que las escriba MaKo'}
            </button>
          )}
          <div style={{ display: 'flex', flexDirection: 'column', gap: 12, marginBottom: 16 }}>
            {pasos.filter((p) => p.tipo !== 'audio').map((p) => (
              <div key={p.orden} style={{ padding: '11px 13px', borderRadius: 11, background: 'var(--surface-2)', border: '1px solid var(--border)' }}>
                <div style={{ fontSize: 11.5, color: 'var(--faint)', marginBottom: 6 }}>Mensaje {p.orden}</div>
                <div style={{ fontSize: 12.5, color: 'var(--ink)', lineHeight: 1.5, marginBottom: 9, opacity: 0.7 }}>{p.cuerpo.slice(0, 140)}{p.cuerpo.length > 140 ? '…' : ''}</div>
                {(p.variantes ?? []).length === 0 ? (
                  <div style={{ fontSize: 12, color: 'var(--faint)' }}>Sin variantes: este mensaje sale siempre igual.</div>
                ) : (p.variantes ?? []).map((v, i) => (
                  <div key={i} style={{ display: 'flex', gap: 7, alignItems: 'flex-start', marginBottom: 7 }}>
                    <textarea value={v} onChange={(e) => editarVariante(p.orden, i, e.target.value)} rows={2} style={{ ...inp, resize: 'vertical', lineHeight: 1.5, flex: 1 }} disabled={!rolAdmin} />
                    {rolAdmin && <button onClick={() => quitarVariante(p.orden, i)} title="Quitar variante" style={{ background: 'none', border: 'none', color: 'var(--faint)', cursor: 'pointer', fontSize: 14, padding: '6px 2px' }}>✕</button>}
                  </div>
                ))}
              </div>
            ))}
          </div>
          </>)}

          {err && <div style={{ marginBottom: 12, padding: '9px 12px', borderRadius: 9, fontSize: 13, border: '1px solid var(--bad)', background: 'var(--bad-bg)', color: 'var(--bad)' }}>{err}</div>}

          {rolAdmin && (
            <div style={{ display: 'flex', alignItems: 'center', gap: 8, justifyContent: 'flex-end', marginTop: 4 }}>
              {flash && <span style={{ fontSize: 13, fontWeight: 600, color: 'var(--good)', marginRight: 'auto' }}>{flash}</span>}
              <button onClick={onWizard} style={btnGhost}>✍️ MaKo redacta (wizard)</button>
              <button onClick={guardar} disabled={busy === 'save'} style={{ ...btn, opacity: busy === 'save' ? 0.5 : 1 }}>{busy === 'save' ? 'Guardando…' : 'Guardar'}</button>
            </div>
          )}
        </div>
      </div>
    </div>
  );
}
