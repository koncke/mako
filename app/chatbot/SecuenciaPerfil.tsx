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
import { PasoAudioControl } from './PasoAudioControl';
import { MensajesChat } from './MensajesChat';
import { EstrategiaWizard } from './EstrategiaWizard';
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

/** Las líneas no vacías de un textarea multilínea. */
const lineas = (s: string): string[] => s.split(/\r?\n/).map((x) => x.trim()).filter(Boolean);

// Cómo se lee el desenlace en el resumen. El valor crudo (`agendo`, `pago`)
// no le dice nada a nadie: es vocabulario del motor.
const LOGRADO_TXT: Record<string, string> = {
  respondio: 'Termina cuando el lead responde cualquier cosa',
  agendo: 'Termina cuando el lead agenda una reunión',
  pago: 'Termina cuando el lead paga',
  ninguno: 'No cierra sola: sigue hasta que la pauses',
};

const EMOJI_OBJ: Record<Objetivo, string> = { agendar: '📅', preparar: '🎯', reactivar: '🧲', cualificar: '❓', confirmar_pago: '💳' };

export function SecuenciaPerfil({ secuencia, objetivos, etiquetaEtapa, rolAdmin, audios, negocio, canalCaido, onAudioNuevo, onClose, onCambio, onWizard }: {
  secuencia: SecuenciaDto;
  objetivos: Opcion[];
  etiquetaEtapa: (key: string) => string;
  rolAdmin: boolean;
  audios: AudioSetting[];
  /** Nombre del negocio: firma cada burbuja, como en el chat de verdad. */
  negocio: string;
  /** El WhatsApp del negocio está caído. */
  canalCaido: boolean;
  /** Un audio grabado desde un paso se suma a la biblioteca del padre. */
  onAudioNuevo: (a: AudioSetting) => void;
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
  // ¿Los mensajes salen solos, o quedan como borrador para mandar a mano? Tiene
  // que viajar en `guardar`: la API reconstruye la estrategia campo por campo, y
  // un campo que no se manda vuelve en `false` — o sea, guardar cualquier otra
  // cosa de la estrategia APAGABA el auto-envío sin decir nada.
  const [envioAuto, setEnvioAuto] = useState<boolean>(est?.envio_automatico ?? false);
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
  // La estrategia se EDITA en un wizard aparte, un paso por pantalla. La
  // sub-tab pasa a ser un RESUMEN legible: leer cómo juega la secuencia y
  // cambiarla son dos trabajos distintos, y el formulario denso servia mal a
  // los dos — para leerlo había que saltear inputs, y para editarlo había que
  // decidir siete cosas de una.
  const [editandoEstrategia, setEditandoEstrategia] = useState(false);

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
        modo, desenlace, escenarios: est?.escenarios ?? [],
        envio_automatico: envioAuto,
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

  // `delay_horas` entra acá porque en el chat el CUÁNDO se edita en el mismo
  // lugar que el mensaje: en el acordeón viejo el tiempo no se podía tocar de
  // ninguna manera — se veía «24 h» y había que salir al wizard para cambiarlo.
  const editarPaso = (orden: number, campo: 'cuerpo' | 'asunto' | 'delay_horas', val: string | number) =>
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
      if (r.ok) {
        setActiva(!activa);
        // ⚠️ «Activada ✓» ES CIERTO SOBRE LA FILA Y FALSO SOBRE EL RESULTADO.
        // Prender una secuencia de WhatsApp con el número caído la deja en verde
        // sin que salga un solo mensaje: cada paso falla y se reprograma +24h,
        // para siempre y sin síntoma. Pasó cinco días en la cuenta del dueño.
        // El toggle SÍ hizo su trabajo, así que no se falla — se dice qué falta.
        const soloWa = pasos.every((p) => p.canal === 'whatsapp');
        flashOk(
          !activa
            ? (canalCaido && soloWa
              ? 'Activada ✓ — pero tu WhatsApp está desconectado, así que todavía no va a salir nada. Reconéctalo en la tab WhatsApp.'
              : 'Activada ✓')
            : 'Pausada ✓',
        );
        onCambio();
      } else setErr(r.error || 'No se pudo cambiar.');
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
      flashOk(`MaKo lo dedujo de ${r.muestra ?? 0} leads ya evaluados — revísalo y guarda`);
    } catch { setErr('Sin conexión — prueba de nuevo.'); }
    setBusy(null);
  }

  const nPreg = preguntas.split('\n').filter((p) => p.trim()).length;
  const pasosWa = secuencia.pasos.filter((p) => p.canal === 'whatsapp').length;
  const pasosEmail = secuencia.pasos.filter((p) => p.canal === 'email').length;

  // EL WIZARD REEMPLAZA AL PANEL ENTERO, no vive adentro de la sub-tab: en modo
  // `desnudo` la pieza trae su propio fondo y `minHeight: 100vh`, asi que
  // anidarla bajo una topbar y unas tabs deja dos marcos peleando. Es lo mismo
  // que hace el onboarding de esta tab.
  if (editandoEstrategia) {
    return (
      <EstrategiaWizard
        nombreSecuencia={secuencia.nombre}
        objetivos={objetivos}
        valor={{ objetivo, gancho, preguntas, califica, descalifica, modo, desenlace, envioAuto }}
        onCambiar={(p) => {
          if (p.objetivo !== undefined) setObjetivo(p.objetivo);
          if (p.gancho !== undefined) setGancho(p.gancho);
          if (p.preguntas !== undefined) setPreguntas(p.preguntas);
          if (p.califica !== undefined) setCalifica(p.califica);
          if (p.descalifica !== undefined) setDescalifica(p.descalifica);
          if (p.modo !== undefined) setModo(p.modo);
          if (p.desenlace !== undefined) setDesenlace(p.desenlace);
          if (p.envioAuto !== undefined) setEnvioAuto(p.envioAuto);
        }}
        onSugerirCriterio={() => void sugerirCriterio()}
        sugiriendo={busy === 'criterio'}
        guardando={busy === 'save'}
        error={err}
        onGuardar={async () => { await guardar(); setEditandoEstrategia(false); }}
        onSalir={() => setEditandoEstrategia(false)}
      />
    );
  }


  return (
    <div style={{ height: '100%', width: '100%', background: 'var(--surface)', border: '1px solid var(--border)', borderRadius: 16, display: 'flex', flexDirection: 'column', overflow: 'hidden' }}>
      {/* Topbar fija (no scrollea) — patrón TemplateDetalleModal */}
      <div style={{ flex: 'none', display: 'flex', justifyContent: 'space-between', alignItems: 'center', padding: '14px 20px', borderBottom: '1px solid var(--border)' }}>
        <button onClick={onClose} title="Volver" style={{ display: 'inline-flex', alignItems: 'center', gap: 6, background: 'none', border: 'none', fontSize: 14, fontWeight: 600, color: 'var(--dim)', cursor: 'pointer', padding: 0, fontFamily: 'inherit' }}>← Volver al chat</button>
        {rolAdmin && <button onClick={probar} disabled={busy === 'probar'} style={{ background: 'none', border: 'none', color: 'var(--primary)', fontSize: 13, fontWeight: 600, cursor: 'pointer', opacity: busy === 'probar' ? 0.5 : 1 }}>{busy === 'probar' ? 'Enviando…' : '📲 Probar de verdad (te llega a ti)'}</button>}
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
          {/* ⚠️ ESTA SUB-TAB YA NO ES UN FORMULARIO: es lo que la secuencia HACE,
              en prosa, y un boton que abre el wizard.
              Pedia siete decisiones a la vez —objetivo, gancho, preguntas,
              califica, descalifica, que hacer al responder, cuando se logra,
              cuando falla— en una columna con dos textareas en grilla y cuatro
              dropdowns. Servia mal a los dos trabajos que se hacen aca: para
              LEER como juega habia que saltear inputs, y para EDITARLA habia
              que decidir todo junto. Se partieron: leer aca, editar en
              EstrategiaWizard, un paso por pantalla. */}
          <div style={{ fontFamily: "'Geist Mono', monospace", fontSize: 10.5, letterSpacing: '.09em', textTransform: 'uppercase', color: 'var(--dim)', marginBottom: 10 }}>¿Cómo juega?</div>
          <div style={{ marginBottom: 20 }}>
            <Paso icono="⚡" titulo="Se dispara cuando…" detalle={`El lead está parado en la etapa «${etiquetaEtapa(secuencia.etapa)}» de tu funnel.`} />
            <Flecha />
            <Paso icono="💬" titulo={`MaKo le manda la secuencia (${secuencia.pasos.length} mensajes)`} detalle="Con el anti-ban de siempre; los pasos de WhatsApp oficial esperan la plantilla aprobada por Meta." tono="mako" />
            <Flecha />
            {/* Sin esta línea no había forma de saber, mirando la secuencia, si
                sus mensajes salían o quedaban esperando a que alguien los mande. */}
            <Paso
              icono={envioAuto ? '📤' : '📝'}
              titulo={envioAuto ? 'Salen solos' : 'Quedan como borrador'}
              detalle={envioAuto
                ? 'Le llegan al lead sin que tengas que tocar nada, aunque todavía no haya pagado.'
                : 'A un lead que todavía no pagó, cada mensaje te queda como borrador para que lo mandes tú con un clic.'}
            />
            {nPreg > 0 && (<><Flecha /><Paso icono="❓" titulo={`Cualifica con ${nPreg} pregunta${nPreg === 1 ? '' : 's'}`} detalle={lineas(preguntas).slice(0, 3).join(' · ')} tono="mako" /></>)}
            <Flecha />
            <Paso icono="✅" titulo={objetivos.find((o) => o.value === objetivo)?.label ?? objetivo} detalle={gancho.trim() ? `Gancho: ${gancho.trim()}` : undefined} tono="dueno" />
            <Flecha />
            <Paso
              icono={desenlace.logrado === 'ninguno' ? '♾️' : '🏁'}
              titulo={LOGRADO_TXT[desenlace.logrado] ?? 'Termina cuando el lead responde'}
              detalle={
                (desenlace.falloHoras > 0
                  ? `Si pasan ${desenlace.falloHoras < 24 ? `${desenlace.falloHoras} horas` : `${Math.round(desenlace.falloHoras / 24)} día${desenlace.falloHoras >= 48 ? 's' : ''}`} sin respuesta, se da por perdida. `
                  : 'No se da por perdida nunca: sigue corriendo. ')
                + (modo === 'asistido' ? 'Si contestan, MaKo te deja el borrador.' : 'Si contestan, se frena y sigues tú.')
              }
            />
          </div>

          {/* El criterio, si esta puesto. Se muestra porque es lo que decide si
              la charla termina en llamada o en despedida — y no estaba a la
              vista en ningun lado sin abrir un textarea. */}
          {(califica.trim() || descalifica.trim()) && (
            <div style={{ marginBottom: 20 }}>
              <div style={{ fontFamily: "'Geist Mono', monospace", fontSize: 10.5, letterSpacing: '.09em', textTransform: 'uppercase', color: 'var(--dim)', marginBottom: 8 }}>A quién le sirve</div>
              <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 10 }}>
                {[{ t: '✓ Sí, si…', c: 'var(--good)', v: califica }, { t: '✕ No, si…', c: 'var(--bad)', v: descalifica }].map((col) => (
                  <div key={col.t}>
                    <div style={{ fontSize: 11.5, color: col.c, fontWeight: 600, marginBottom: 5 }}>{col.t}</div>
                    <ul style={{ margin: 0, padding: '0 0 0 16px', fontSize: 12.5, color: 'var(--dim)', lineHeight: 1.6 }}>
                      {lineas(col.v).map((x, i) => <li key={i}>{x}</li>)}
                      {!col.v.trim() && <li style={{ color: 'var(--faint)', listStyle: 'none', marginLeft: -16 }}>Sin definir</li>}
                    </ul>
                  </div>
                ))}
              </div>
            </div>
          )}

          {rolAdmin && (
            <button onClick={() => { setErr(null); setEditandoEstrategia(true); }} style={{ ...btn, marginBottom: 18 }}>
              Editar la estrategia
            </button>
          )}
          </>)}

          {tab === 'mensajes' && (<>
          {/* EL CHAT, no una lista de campos. Un mensaje de WhatsApp se juzga
              por cómo se ve al llegar; una fila plegada con 70 caracteres y
              puntos suspensivos no deja juzgar nada. El detalle de por qué la
              burbuja está copiada y no importada, en MensajesChat.tsx. */}
          <div style={{ fontFamily: "'Geist Mono', monospace", fontSize: 10.5, letterSpacing: '.09em', textTransform: 'uppercase', color: 'var(--dim)', margin: '4px 0 8px' }}>Lo que le llega al lead</div>
          <div style={{ fontSize: 12.5, color: 'var(--faint)', marginBottom: 10, lineHeight: 1.5 }}>
            Así, y en este orden. Toca cualquier mensaje para escribirlo, o el renglón gris para cambiar cuándo sale.
          </div>
          <div style={{ marginBottom: 16 }}>
            <MensajesChat
              pasos={pasos} audios={audios} rolAdmin={rolAdmin} negocio={negocio} busy={busy != null}
              onEditar={editarPaso} onAgregar={agregarPaso} onQuitar={quitarPaso}
              onAudio={(orden, id) => void setAudioDePaso(orden, id)}
              onAudioNuevo={onAudioNuevo} onError={setErr}
            />
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
