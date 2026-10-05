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
import { TRIGGER_ETAPA, TRIGGER_ENTREGA } from '@/lib/nutricion-etapa';

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

export function SecuenciaPerfil({ secuencia, objetivos, etiquetaEtapa, rolAdmin, audios, negocio, canalCaido, onAudioNuevo, secuencias, productos, disparadores, onAbrirClave, onElegir, onNueva, onProbar, onClose, onCambio, onWizard }: {
  secuencia: SecuenciaDto;
  /** Las del workspace: el lienzo las necesita para resolver el «Sigue con». */
  secuencias: ReadonlyArray<SecuenciaDto>;
  /** Los productos del CRM con sus etapas, para elegir el disparador. */
  productos: ProductoOpcion[];
  /** Las etiquetas de los 18 disparadores, para decir la verdad del que tiene puesto. */
  disparadores: Opcion[];
  onAbrirClave: (clave: string) => void;
  /** Cambiar de secuencia SIN salir del lienzo: no hay pantalla de listado. */
  onElegir?: (id: number) => void;
  /** Crear una. Está acá y no en una pantalla aparte por lo mismo. */
  onNueva?: () => void;
  /** Abre el CHAT de prueba. Lo decide quien monta: el chat es una vista hermana del
   *  lienzo, no un panel de adentro del editor. */
  onProbar?: () => void;
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
  onClose?: () => void;
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
  const esDeEntrega = secuencia.trigger_tipo === TRIGGER_ENTREGA;
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

    /**
   * ⚠️ LA CLASE VIAJA, NO SE DEDUCE DE LA KEY. Las etapas del embudo y las de la entrega
   * son dos listas que el cliente edita por separado: hoy no chocan, y el día que
   * alguien llame «facturando» a una etapa de entrega, adivinar por la clave mandaría el
   * disparador equivocado. La pantalla sabe de qué SECCIÓN del desplegable salió, así
   * que lo dice.
   */
  const guardarDisparador = async (etapa: string, clase: 'venta' | 'entrega', ambito: number | null) => {
    const j = await api(clase === 'entrega'
      ? { action: 'disparador', secuenciaId: secuencia.id, etapa, clase, productoId: ambito }
      : { action: 'disparador', secuenciaId: secuencia.id, etapa, funnelId: ambito });
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
  const prodSel = useMemo(() => (funnelSel == null ? null : productos.find((x) => x.funnelId === funnelSel) ?? null), [funnelSel, productos]);

  /**
   * Las etapas, en DOS secciones: por dónde pasa el lead antes de comprar (el embudo) y
   * por dónde pasa el cliente después (la entrega del servicio, el kanban de Customer
   * Success). Son dos preguntas distintas y en la misma lista plana se confunden: «hito
   * 2» y «Agenda R2» no son dos etapas del mismo camino.
   *
   * ⚠️ Y LA QUE ESTÁ PUESTA ENTRA SIEMPRE, MARCADA. Es la trampa del `<select>` que está
   * en AGENTS.md: un `value` que no está entre sus opciones no muestra nada y el primer
   * click lo BORRA — o sea que cambiar de producto podría reescribir el disparador sin
   * que nadie lo pida.
   */
  const seccionesEtapa = useMemo(() => {
    const venta = prodSel
      ? prodSel.etapas
      : [...new Map(productos.flatMap((x) => x.etapas).map((e) => [e.value, e])).values()];
    /**
     * ⚠️ LA ENTREGA SE OFRECE AUNQUE NO HAYA PRODUCTO ELEGIDO, Y UNA SECCIÓN POR
     * PRODUCTO. La primera versión la mostraba sólo con un producto ya elegido —porque
     * una etapa de entrega no significa nada sin él— y el resultado medido fue un
     * callejón: el desplegable abría con UNA sección, la de venta, así que desde la
     * pantalla no había forma de llegar a una secuencia de entrega ni de enterarse de
     * que existía. Una capacidad que no se ofrece no existe.
     *
     * El producto viaja en el VALOR (`entrega:<producto>:<etapa>`) y por eso no hace
     * falta elegirlo antes ni adivinarlo después: con los defaults, los dos productos
     * tienen las MISMAS cinco claves, así que deducirlo de la etapa sería elegir uno al
     * azar.
     */
    const deEntrega = prodSel ? [prodSel] : productos;
    const puesta = (secuencia.etapa ?? '').trim();
    const estaEnAlguna = [...venta, ...deEntrega.flatMap((x) => x.etapasEntrega)].some((e) => e.value === puesta);
    const secciones = [
      { title: 'Antes de comprar (tu embudo)', options: venta.map((e) => ({ ...e, value: `venta:${e.value}` })) },
    ];
    for (const pr of deEntrega) {
      if (!pr.etapasEntrega.length || pr.productoId == null) continue;
      secciones.push({
        // El rótulo nombra la pantalla donde esas etapas se mueven: sin eso, «Entrega»
        // no le dice nada a quien nunca abrió Customer Success. Y lleva el producto
        // cuando hay más de uno, que es lo único que las distingue.
        title: productos.length > 1 && !prodSel
          ? `Ya es cliente · ${pr.nombre} (Customer Success)`
          : 'Ya es cliente (la entrega, en Customer Success)',
        options: pr.etapasEntrega.map((e) => ({ ...e, value: `entrega:${pr.productoId}:${e.value}` })),
      });
    }
    if (puesta && !estaEnAlguna) {
      secciones.unshift({
        title: 'La que tiene puesta',
        options: [{
          value: esDeEntrega ? `entrega:${secuencia.producto_id ?? ''}:${puesta}` : `venta:${puesta}`,
          label: `${etiquetaEtapa(puesta)} (no es de este producto)`,
        }],
      });
    }
    return secciones;
  }, [prodSel, productos, secuencia.etapa, esDeEntrega, etiquetaEtapa]);

  const valorEtapa = esDeEntrega ? `entrega:${secuencia.producto_id ?? ''}:${secuencia.etapa}` : `venta:${secuencia.etapa}`;

  const etapaEstaEnElProducto = useMemo(() => {
    const base = prodSel
      ? [...prodSel.etapas, ...prodSel.etapasEntrega]
      : productos.flatMap((x) => [...x.etapas, ...x.etapasEntrega]);
    return !secuencia.etapa || base.some((e) => e.value === secuencia.etapa);
  }, [prodSel, productos, secuencia.etapa]);

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
    // ⚠️ `flex: 1` + `minHeight: 0`, NO `height: 100%`: el padre saca su alto de un flex,
    // y para el motor eso es un alto INDEFINIDO — Chrome lo resuelve igual y Safari
    // devuelve CERO, o sea la pantalla en blanco (AGENTS.md, ya pagado con un cliente).
    //
    // Y sin borde ni esquinas redondeadas: el recuadro ERA el problema. «No pongas a la
    // grilla chiquita en el medio en un recuadro, haz que ocupe TODA la tab».
    <div style={{ flex: 1, minHeight: 0, width: '100%', background: 'var(--surface)', display: 'flex', flexDirection: 'column', overflow: 'hidden' }}>
      {/* ⚠️ UNA SOLA BARRA, Y LO QUE NO ES DE TODOS LOS DÍAS VA ADENTRO DE «⋯».
          Martín: «aquí hay botones de más innecesarios y otros mal ubicados», con la
          captura al lado. Había SIETE controles repartidos en tres franjas: dos
          interruptores «Pausada» (uno duplicado), dos botones de probar, y abajo una
          fila con «Qué dice y a quién le sirve» + «Variantes de cada mensaje» y otra con
          «MaKo redacta (wizard)» + «Guardar». Cuatro de esos se usan de vez en cuando y
          le estaban comiendo ~90 px de alto al lienzo en todas las pantallas.
          Quedan arriba los tres que se tocan editando —el interruptor, Probar y
          Guardar— y los otros cuatro viven en el menú, que es el patrón que la casa ya
          usa en /admin y en la barra de clientes. */}
      <div style={{ flex: 'none', display: 'flex', alignItems: 'center', gap: 10, padding: '9px 14px', borderBottom: '1px solid var(--border)', minWidth: 0 }}>
        <span style={{ flex: 'none', width: 28, height: 28, borderRadius: '50%', background: 'var(--surface-2)', border: '1px solid var(--border)', display: 'flex', alignItems: 'center', justifyContent: 'center', fontSize: 15 }}>{est ? (EMOJI_OBJ[est.objetivo as Objetivo] ?? '🎯') : '⚑'}</span>
        <span style={{ minWidth: 0, flex: 1 }}>
          <span style={{ display: 'block', fontSize: 14, fontWeight: 600, color: 'var(--ink)', whiteSpace: 'nowrap', overflow: 'hidden', textOverflow: 'ellipsis' }}>{secuencia.nombre}</span>
          <span style={{ display: 'block', fontSize: 11.5, color: 'var(--faint)', whiteSpace: 'nowrap', overflow: 'hidden', textOverflow: 'ellipsis' }}>
            {pasosWa} WhatsApp · {pasosEmail} email{est?.probada_at ? ' · probada ✓' : ''}
          </span>
        </span>

        {flash && <span style={{ flex: 'none', fontSize: 12.5, fontWeight: 600, color: 'var(--good)' }}>{flash}</span>}

        <span style={{ flex: 'none', display: 'inline-flex', alignItems: 'center', gap: 7 }}>
          <span style={{ fontSize: 12.5, fontWeight: 600, color: activa ? 'var(--good)' : 'var(--dim)' }}>{activa ? 'Activa' : 'Pausada'}</span>
          {rolAdmin && (
            <button onClick={toggle} disabled={busy === 'toggle'} aria-pressed={activa} title={activa ? 'Pausar' : 'Activar'}
              style={{ width: 38, height: 22, borderRadius: 999, border: 'none', padding: 2, background: activa ? 'var(--good)' : 'var(--border-strong)', cursor: 'pointer', flex: 'none', transition: 'background .15s' }}>
              <span style={{ display: 'block', width: 18, height: 18, borderRadius: '50%', background: '#fff', transform: activa ? 'translateX(16px)' : 'none', transition: 'transform .15s' }} />
            </button>
          )}
        </span>

        {onProbar && (
          <button onClick={onProbar} style={{ flex: 'none', padding: '7px 13px', borderRadius: 10, border: '1px solid var(--border-strong)', background: 'var(--surface)', color: 'var(--ink)', fontSize: 13, fontWeight: 600, cursor: 'pointer', fontFamily: 'inherit' }}>▶ Probar</button>
        )}

        {rolAdmin && (
          <>
            <Dropdown
              value="" resetAfterSelect align="right" placeholder="⋯"
              ariaLabel="Más acciones de esta secuencia"
              disabled={busy != null}
              buttonStyle={{ padding: '7px 11px', fontSize: 13, borderRadius: 10 }}
              options={[
                { value: 'estrategia', label: 'Qué dice y a quién le sirve' },
                { value: 'variantes', label: busy === 'variantes' ? 'MaKo está escribiendo…' : 'Variantes de cada mensaje' },
                { value: 'wizard', label: 'MaKo redacta (wizard)' },
                // «Probar de verdad» MANDA MENSAJES REALES a tu teléfono: va en el menú y
                // no al lado del «Probar» de mentira, que es lo que lo hacía peligroso.
                { value: 'real', label: busy === 'probar' ? 'Enviando…' : 'Probar de verdad (te llega a ti)' },
              ]}
              onChange={(v) => {
                if (v === 'estrategia') { setErr(null); setEditandoEstrategia(true); }
                else if (v === 'variantes') void generarVariantes();
                else if (v === 'wizard') onWizard();
                else if (v === 'real') void probar();
              }}
            />
            <button onClick={guardar} disabled={busy === 'save'}
              style={{ flex: 'none', padding: '8px 16px', borderRadius: 10, border: 'none', background: 'var(--ink)', color: 'var(--on-ink)', fontSize: 13, fontWeight: 600, cursor: 'pointer', opacity: busy === 'save' ? 0.5 : 1, fontFamily: 'inherit' }}>
              {busy === 'save' ? 'Guardando…' : 'Guardar'}
            </button>
          </>
        )}
      </div>

      {/* ⚠️ SIN PADDING: «no quiero que esté en un contenedor, quiero que ocupe TODA la
          tab». Lo único que queda entre el lienzo y el borde de la pantalla es la línea
          del disparador, que es un control. */}
      <div style={{ flex: 1, minHeight: 0, display: 'flex', flexDirection: 'column' }}>
        {/* Sin `maxWidth`: el lienzo es de los que necesitan cada píxel. Lo que
            SÍ se acota es el texto de adentro de cada nodo, que lo hace el nodo. */}
        <div style={{ flex: 1, minHeight: 0, display: 'flex', flexDirection: 'column', width: '100%' }}>

          {/* El nombre, el estado y «Probar» viven en la barra de arriba. Lo que queda acá
              es el DISPARADOR, que es un control y no un rótulo: dice —y deja cambiar— qué
              hace que esta secuencia salga. */}
          <div style={{ flex: 'none', minWidth: 0, padding: '7px 14px', borderBottom: '1px solid var(--border)' }}>
              <div style={{ fontSize: 11.5, color: 'var(--faint)', display: 'flex', alignItems: 'center', gap: 5, flexWrap: 'wrap' }}>
                {rolAdmin && productos.length > 0 && (esDeEtapa || esDeEntrega || cambiandoAEtapa) ? (
                  <>
                    <span>Se dispara al caer en</span>
                    <Dropdown
                      value={valorEtapa}
                      secciones={seccionesEtapa}
                      onChange={(v) => {
                        // El valor trae la clase y, en la entrega, el producto:
                        // `venta:<etapa>` | `entrega:<producto>:<etapa>`.
                        const [clase, ...resto] = v.split(':');
                        if (clase === 'entrega') {
                          const [pid, ...keyPartes] = resto;
                          const producto = Number(pid);
                          if (!Number.isFinite(producto)) { setErr('Esa etapa de entrega no tiene producto: elegí una de la lista.'); return; }
                          void guardarDisparador(keyPartes.join(':'), 'entrega', producto);
                          return;
                        }
                        void guardarDisparador(resto.join(':'), 'venta', funnelSel);
                      }}
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
                        const enVenta = fid == null
                          ? productos.some((x) => x.etapas.some((e) => e.value === secuencia.etapa))
                          : !!pr?.etapas.some((e) => e.value === secuencia.etapa);
                        const enEntrega = !!pr?.etapasEntrega.some((e) => e.value === secuencia.etapa);
                        // Una secuencia de ENTREGA se re-apunta al producto nuevo; una de
                        // venta, al embudo nuevo. Si la etapa no existe en ninguno de los
                        // dos lados del producto elegido, no se guarda nada todavía.
                        if (esDeEntrega && enEntrega && pr?.productoId != null) void guardarDisparador(secuencia.etapa, 'entrega', pr.productoId);
                        else if (!esDeEntrega && enVenta) void guardarDisparador(secuencia.etapa, 'venta', fid);
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

          {/* El error va PEGADO al lienzo y no al fondo de una pantalla que ya no tiene
              fondo: es lo único que queda debajo, y sólo cuando hay algo que decir.
              Las cuatro acciones que vivían acá (la estrategia, las variantes, el wizard
              y el envío real) están en el menú de la barra. */}
          {err && <div style={{ flex: 'none', margin: '0 14px 12px', padding: '9px 12px', borderRadius: 9, fontSize: 13, border: '1px solid var(--bad)', background: 'var(--bad-bg)', color: 'var(--bad)' }}>{err}</div>}
        </div>
      </div>
    </div>
  );
}
