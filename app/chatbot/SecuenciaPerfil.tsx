'use client';

// =============================================================================
// SecuenciaPerfil — perfil + edición de una secuencia de mensajes (réplica de TemplateDetalleModal)
// =============================================================================
// Cubre TODO el chat (inline, como en SuperAdmin). Explica CÓMO JUEGA (diagrama
// de pasos), deja editar la estrategia (objetivo/gancho/preguntas), activar/
// pausar, abrir el wizard para que MaKo redacte, y probarla DE VERDAD (te llega
// a tu teléfono/mail). Setter = solo lectura (sin botones de escritura).

import { useMemo, useState, type CSSProperties } from 'react';
import type { AudioSetting, SecuenciaDto, Opcion, PasoSecuenciaDto, ProductoOpcion } from './ChatAgentApp';
import { EstrategiaWizard } from './EstrategiaWizard';
import { FlujoLienzo } from './FlujoLienzo';
import { Dropdown } from '@/app/components/Dropdown';
import { DESENLACE_VACIO, type Desenlace, type ModoRespuesta, type Objetivo } from '@/lib/setting-estrategia';
import { TRIGGER_ETAPA } from '@/lib/nutricion-etapa';

const btn: CSSProperties = { padding: '9px 16px', borderRadius: 9, border: 'none', background: 'var(--primary)', color: '#fff', fontSize: 13, fontWeight: 600, cursor: 'pointer', fontFamily: 'inherit' };
const btnGhost: CSSProperties = { ...btn, background: 'transparent', color: 'var(--dim)', border: '1px solid var(--border-strong)' };
const inp: CSSProperties = { width: '100%', boxSizing: 'border-box', padding: '9px 12px', borderRadius: 9, border: '1px solid var(--border-strong)', background: 'var(--surface-2)', color: 'var(--ink)', fontSize: 13.5, fontFamily: "'Geist', sans-serif", outline: 'none' };

// ⚠️ ACÁ VIVÍAN `Paso` y `Flecha`, las cajas apiladas con un «↓» en el medio que
// dibujaban «¿Cómo juega?». Se fueron con las tres sub-tabs el 30/09/2026: eran
// ESTRICTAMENTE LINEALES —la rama de logrado/fallo no se dibujaba nunca— así que
// una secuencia encadenada con otra se veía igual que una que termina y no. Lo
// que las reemplaza es `FlujoLienzo`, donde las flechas salen del dato.

async function api(body: unknown): Promise<{ ok: boolean; error?: string; enviadosWa?: number; enviadosEmail?: number; avisos?: string[] }> {
  try { return await (await fetch('/api/chat-agent/secuencias', { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify(body) })).json(); } catch { return { ok: false, error: 'sin conexión' }; }
}

/** Las líneas no vacías de un textarea multilínea. */
const lineas = (s: string): string[] => s.split(/\r?\n/).map((x) => x.trim()).filter(Boolean);

const EMOJI_OBJ: Record<Objetivo, string> = { agendar: '📅', preparar: '🎯', reactivar: '🧲', cualificar: '❓', confirmar_pago: '💳' };

export function SecuenciaPerfil({ secuencia, objetivos, etiquetaEtapa, rolAdmin, audios, negocio, canalCaido, onAudioNuevo, secuencias, productos, disparadores, onAbrirClave, onClose, onCambio, onWizard }: {
  secuencia: SecuenciaDto;
  /** Las del workspace: el lienzo las necesita para resolver el «Sigue con». */
  secuencias: ReadonlyArray<SecuenciaDto>;
  /** Los productos del CRM con sus etapas, para elegir el disparador. */
  productos: ProductoOpcion[];
  /** Las etiquetas de los 18 disparadores, para decir la verdad del que tiene puesto. */
  disparadores: Opcion[];
  onAbrirClave: (clave: string) => void;
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
  /**
   * EL DISPARADOR: «si un lead cae en ESTA etapa de ESTE producto».
   *
   * Pedido de Martín (05/10/2026). El dato existía en la base desde la mig 0170 y no
   * había pantalla: las 62 secuencias de producción tienen `funnel_id` NULL porque
   * ninguna lo ofrecía, y la etapa se fijaba al CREAR y no se podía cambiar.
   *
   * ⚠️ EL PRODUCTO ES ESTADO LOCAL Y LA ETAPA NO. Cambiar de producto no guarda nada
   * todavía: la etapa que estaba puesta puede no existir en el producto nuevo, y guardar
   * eso deja la secuencia colgada de una key que ese embudo no tiene — o sea, una
   * secuencia que no dispara nunca, sin error. Se guarda cuando el par es válido.
   */
  const [funnelSel, setFunnelSel] = useState<number | null>(secuencia.funnel_id ?? null);
  /**
   * ⚠️ NO TODA SECUENCIA SE DISPARA POR UNA ETAPA, Y DECIR QUE SÍ ERA MENTIRA.
   *
   * Hay 18 disparadores (`TRIGGERS`, lib/email-marketing.ts) y 17 consultan columnas del
   * funnel («dejó el formulario sin agendar», «no asistió a R1»…): para ésos la columna
   * `etapa` existe pero NO es lo que los dispara. La primera versión de este control
   * mostraba «Se dispara al caer en <etapa>» para todos, y guardar ahí convertía un
   * disparador de formulario en uno de etapa SIN QUE NADIE LO PIDIERA.
   *
   * Lo cazó el navegador, no el código: en el ws1 las tres secuencias tienen triggers
   * legacy (`instant_form_sin_agenda`) con `etapa` legacy (`nutri`, `postagenda`), que
   * además NO existe en ninguno de los dos productos del workspace.
   *
   * Así que el control se OFRECE y no se impone: si la secuencia ya se dispara por etapa,
   * se edita; si no, se dice por qué se dispara de verdad y hay un botón para cambiarla.
   */
  const [cambiandoAEtapa, setCambiandoAEtapa] = useState(false);
  const esDeEtapa = secuencia.trigger_tipo === TRIGGER_ETAPA;
  const etiquetaDisparador = disparadores.find((d) => d.value === secuencia.trigger_tipo)?.label ?? secuencia.trigger_tipo;
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
  // Antes esta pantalla la CONSERVABA sin editarla y el único lugar donde se
  // tocaba era el wizard. En el lienzo es el nodo de entrada: «a quién le
  // escribe» es la primera pregunta del flujo, no un detalle de configuración.
  const [antiguedad, setAntiguedad] = useState<number | null>(est?.antiguedad_max_horas ?? null);
  const [califica, setCalifica] = useState((est?.criterio?.califica ?? []).join('\n'));
  const [descalifica, setDescalifica] = useState((est?.criterio?.descalifica ?? []).join('\n'));
  const [activa, setActiva] = useState(secuencia.activa);
  const [busy, setBusy] = useState<string | null>(null);
  const [flash, setFlash] = useState<string | null>(null);
  const [err, setErr] = useState<string | null>(null);
  // Sub-tabs: el detalle mezclaba estrategia, mensajes y ajustes en una columna
  // larga, así que editar el mensaje 4 era scrollear a ciegas.
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
        // Ahora SÍ se edita, en el nodo de entrada del lienzo. La línea sigue
        // siendo obligatoria por lo mismo de antes: `guardar-estrategia` reescribe
        // el objeto ENTERO, así que lo que no se manda vuelve a su default — y el
        // default de este campo es «sin límite», o sea abrirle la secuencia a todo
        // el acumulado.
        antiguedad_max_horas: antiguedad,
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

    const guardarDisparador = async (etapa: string, funnelId: number | null) => {
    const j = await api({ action: 'disparador', secuenciaId: secuencia.id, etapa, funnelId });
    if (!j.ok) { setErr(j.error ?? 'No se pudo guardar el disparador'); return; }
    setErr(null);
    onCambio();
  };

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
  /**
   * Las etapas que se ofrecen: las del producto elegido, o la unión de todos cuando es
   * «Todos los productos».
   *
   * ⚠️ Y LA QUE ESTÁ PUESTA ENTRA SIEMPRE, MARCADA. Es la trampa del `<select>` que ya
   * está escrita en AGENTS.md: un `value` que no está entre sus `<option>` no muestra
   * nada —el control queda en la primera opción— y el primer click lo BORRA, o sea que
   * cambiar de producto podría reescribir el disparador sin que nadie lo pida.
   */
  const etapasOfrecidas = useMemo(() => {
    const pr = funnelSel == null ? null : productos.find((x) => x.funnelId === funnelSel);
    const base = pr
      ? pr.etapas
      : [...new Map(productos.flatMap((x) => x.etapas).map((e) => [e.value, e])).values()];
    if (secuencia.etapa && !base.some((e) => e.value === secuencia.etapa)) {
      return [{ value: secuencia.etapa, label: `${etiquetaEtapa(secuencia.etapa)} (no es de este producto)` }, ...base];
    }
    return base;
  }, [funnelSel, productos, secuencia.etapa, etiquetaEtapa]);

  const etapaEstaEnElProducto = useMemo(() => {
    const pr = funnelSel == null ? null : productos.find((x) => x.funnelId === funnelSel);
    const base = pr ? pr.etapas : productos.flatMap((x) => x.etapas);
    return !secuencia.etapa || base.some((e) => e.value === secuencia.etapa);
  }, [funnelSel, productos, secuencia.etapa]);

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
      <div style={{ flex: 1, minHeight: 0, display: 'flex', flexDirection: 'column', padding: 24 }}>
        {/* Sin `maxWidth`: el lienzo es de los que necesitan cada píxel. Lo que
            SÍ se acota es el texto de adentro de cada nodo, que lo hace el nodo. */}
        <div style={{ flex: 1, minHeight: 0, display: 'flex', flexDirection: 'column', width: '100%' }}>

          <div style={{ flex: 'none', display: 'flex', gap: 11, alignItems: 'center', minWidth: 0, marginBottom: 18 }}>
            <div style={{ width: 44, height: 44, borderRadius: '50%', flex: 'none', background: 'var(--surface-2)', border: '1px solid var(--border)', display: 'flex', alignItems: 'center', justifyContent: 'center', fontSize: 22 }}>{est ? (EMOJI_OBJ[est.objetivo as Objetivo] ?? '🎯') : '⚑'}</div>
            <div style={{ minWidth: 0, flex: 1 }}>
              <div style={{ fontSize: 16, fontWeight: 700, color: 'var(--ink)' }}>{secuencia.nombre}</div>
              <div style={{ fontSize: 11.5, color: 'var(--faint)', display: 'flex', alignItems: 'center', gap: 5, flexWrap: 'wrap' }}>
                {rolAdmin && productos.length > 0 && (esDeEtapa || cambiandoAEtapa) ? (
                  <>
                    <span>Se dispara al caer en</span>
                    <Dropdown
                      value={secuencia.etapa}
                      options={etapasOfrecidas}
                      onChange={(v) => void guardarDisparador(v, funnelSel)}
                      ariaLabel="Etapa que dispara la secuencia"
                      buttonStyle={{ fontSize: 11.5, padding: '2px 6px' }}
                    />
                    <span>de</span>
                    <Dropdown
                      value={funnelSel == null ? '' : String(funnelSel)}
                      options={[{ value: '', label: 'Todos los productos' }, ...productos.map((pr) => ({ value: String(pr.funnelId), label: pr.nombre }))]}
                      onChange={(v) => {
                        const fid = v === '' ? null : Number(v);
                        setFunnelSel(fid);
                        // Sólo se guarda si la etapa que ya está puesta existe en ese
                        // producto. Si no, se espera a que elija una de las suyas: la
                        // lista de arriba ya cambió y la de abajo lo dice.
                        const pr = fid == null ? null : productos.find((x) => x.funnelId === fid);
                        const vale = fid == null
                          ? productos.some((x) => x.etapas.some((e) => e.value === secuencia.etapa))
                          : !!pr?.etapas.some((e) => e.value === secuencia.etapa);
                        if (vale) void guardarDisparador(secuencia.etapa, fid);
                      }}
                      ariaLabel="Producto del que se miran las etapas"
                      buttonStyle={{ fontSize: 11.5, padding: '2px 6px' }}
                    />
                    {!etapaEstaEnElProducto && <span style={{ color: 'var(--warn)' }}>Elegí una etapa de este producto</span>}
                  </>
                ) : (
                  <>
                    <span>Se dispara: {etiquetaDisparador}</span>
                    {rolAdmin && productos.length > 0 && (
                      <button onClick={() => setCambiandoAEtapa(true)}
                        style={{ background: 'none', border: 'none', padding: 0, font: 'inherit', color: 'var(--primary)', cursor: 'pointer' }}>
                        Cambiar a una etapa
                      </button>
                    )}
                  </>
                )}
                <span>· {pasosWa} WhatsApp · {pasosEmail} email{est?.probada_at ? ' · probada ✓' : ''}</span>
              </div>
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

          {/* ⚠️ ACÁ HABÍA TRES SUB-TABS —Estrategia / Mensajes / Variantes— y se fueron
              el 30/09/2026. El pedido: «Quiero que los editables del flujo de
              conversación sea como el editable de Manychat, que tiene una pantalla tipo
              flujo, y ahí se edita todo».

              Las tres partían la misma secuencia en tres pantallas y ninguna mostraba
              la forma del conjunto: «Estrategia» dibujaba una columna de tarjetas con
              flechas ↓ que era ESTRICTAMENTE LINEAL —la rama de logrado/fallo no se
              dibujaba nunca, así que el encadenamiento con otra secuencia no existía en
              ninguna pantalla—, «Mensajes» tenía el chat, y «Variantes» una lista.

              El lienzo las reemplaza; no convive con ellas. Es la lección del editor de
              diagramas del funnel, borrado dos días antes: dos editores del mismo dato
              divergen, y el que se queda viejo es el que menos se abre. */}
          <FlujoLienzo
            pasos={pasos}
            estrategia={{ objetivo, gancho, preguntas: lineas(preguntas), modo, antiguedad_max_horas: antiguedad, envio_automatico: envioAuto, desenlace }}
            etiquetaEtapa={etiquetaEtapa(secuencia.etapa)}
            secuencias={secuencias.map((j) => ({ clave: j.clave, nombre: j.nombre }))}
            audios={audios} negocio={negocio} rolAdmin={rolAdmin} busy={busy != null}
            onEditarPaso={editarPaso} onAgregarPaso={agregarPaso} onQuitarPaso={quitarPaso}
            onAudio={(orden, id) => void setAudioDePaso(orden, id)}
            onAudioNuevo={onAudioNuevo} onError={setErr}
            onEditarVariante={editarVariante} onQuitarVariante={quitarVariante}
            onModo={setModo} onDesenlace={setDesenlace} onAntiguedad={setAntiguedad}
            onAbrirSecuencia={onAbrirClave}
          />

          {/* Lo que el lienzo NO edita, y por qué: el gancho, las preguntas y el
              criterio son lo que MaKo DICE, no la forma del flujo. Editarlos es
              decidir siete cosas juntas, y para eso está el wizard — un paso por
              pantalla, que es la regla de la casa. El lienzo lleva hasta acá. */}
          {rolAdmin && (
            <div style={{ flex: 'none', display: 'flex', gap: 8, flexWrap: 'wrap', marginTop: 14 }}>
              <button onClick={() => { setErr(null); setEditandoEstrategia(true); }} style={btnGhost}>Qué dice y a quién le sirve</button>
              <button onClick={() => void generarVariantes()} disabled={busy === 'variantes'} style={btnGhost}>
                {busy === 'variantes' ? 'MaKo está escribiendo…' : '✨ Variantes de cada mensaje'}
              </button>
            </div>
          )}
          {err && <div style={{ flex: 'none', marginBottom: 12, padding: '9px 12px', borderRadius: 9, fontSize: 13, border: '1px solid var(--bad)', background: 'var(--bad-bg)', color: 'var(--bad)' }}>{err}</div>}

          {rolAdmin && (
            <div style={{ flex: 'none', display: 'flex', alignItems: 'center', gap: 8, justifyContent: 'flex-end', marginTop: 10 }}>
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
