'use client';

// =============================================================================
// SecuenciaPerfil — perfil + edición de una secuencia de mensajes (réplica de TemplateDetalleModal)
// =============================================================================
// Cubre TODO el chat (inline, como en SuperAdmin). Explica CÓMO JUEGA (diagrama
// de pasos), deja editar la estrategia (objetivo/gancho/preguntas), activar/
// pausar, abrir el wizard para que MaKo redacte, y probarla DE VERDAD (te llega
// a tu teléfono/mail). Setter = solo lectura (sin botones de escritura).

import { useEffect, useMemo, useState, type CSSProperties, type ReactNode } from 'react';
import { createPortal } from 'react-dom';
import dynamic from 'next/dynamic';
import { usePilaDeshacer } from '@/app/_ui/usePilaDeshacer';
import { EditorCron, SelectorDisparo, CRON_DEFAULT } from '@/app/_components/EditorCron';
import type { CronAviso } from '@/lib/cron-aviso';
import type { AudioSetting, SecuenciaDto, Opcion, PasoSecuenciaDto, ProductoOpcion } from './ChatAgentApp';
import { EstrategiaWizard } from './EstrategiaWizard';
import { FlujoLienzo } from './FlujoLienzo';
import { Dropdown } from '@/app/components/Dropdown';
import { DESENLACE_VACIO, type Desenlace, type ModoRespuesta, type Objetivo } from '@/lib/setting-estrategia';
import { TRIGGER_ETAPA, TRIGGER_ENTREGA } from '@/lib/nutricion-etapa';
import { abrirGuiaVoz } from '@/lib/chatbot-puerta';

// El wizard son ~1.800 líneas y sólo se abre UNA vez por workspace (la primera vez que
// se tilda la IA): no tiene por qué viajar en el bundle de cada apertura del lienzo.
const OnboardingChatAgent = dynamic(() => import('./OnboardingChatAgent').then((m) => m.OnboardingChatAgent), { ssr: false });

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

/** Las tarjetas del chrome FLOTANTE: fondo propio para leerse sobre la cuadrícula del
 *  lienzo, y el mismo radio que el resto de la casa. Copiado de TemplateDetalleModal a
 *  propósito: son la misma pieza en las dos pantallas. */
const tarjetaChrome: CSSProperties = {
  background: 'var(--surface)', border: '1px solid var(--border)', borderRadius: 11,
  padding: '7px 12px', boxShadow: '0 2px 8px rgba(0,0,0,.06)',
};

/**
 * «Tu forma de escribir» se ofrece UNA vez por visita: quien la cierra sin escribir guía no
 * la ve en cada casilla. Vive en el MÓDULO y no en un ref: el perfil se remonta al cambiar de
 * secuencia, y un ref la volvía a ofrecer en cada una (revisión del 06/10/2026). Con un F5 se
 * vuelve a ofrecer, que es lo que «una vez por visita» quiere decir.
 */
const guiaOfrecida = { enLaVisita: false };

export function SecuenciaPerfil({ secuencia, objetivos, etiquetaEtapa, rolAdmin, audios, negocio, canalCaido, tz, insetIzq, onAudioNuevo, secuencias, productos, disparadores, onAbrirClave, onElegir, onNueva, onProbar, onClose, onCambio, onWizard }: {
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
  /** La zona del negocio: la NOMBRA el texto del horario, no se adivina. */
  tz: string | null;
  /** Cuánto se corre lo que flota, para no nacer debajo de la lista de secuencias. */
  insetIzq?: number;
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

  /**
   * CÓMO SE DISPARA: POR TIEMPO O POR UNA ACCIÓN.
   *
   * Martín, con la captura delante: «el CRON está mal, lo habíamos hecho ya… con las 2
   * opciones por tiempo o por acción». El control es el MISMO que el de /mensajes, y
   * por eso vive en `app/_components/EditorCron.tsx` desde hoy: se extrajo ANTES de
   * usarlo acá, que es la regla de la casa — copiarlo cuesta cero y después divergen.
   *
   * ⚠️ `eligiendo` ES UN ESTADO PROPIO Y NO SE DERIVA DEL DATO. Toda secuencia tiene
   * `trigger_tipo`, así que «qué hay guardado» siempre contesta tiempo o acción y los
   * dos botones no aparecerían NUNCA: cambiar de modo sería imposible. La flecha pone
   * esto en true, que es lo que vuelve a la elección — pedido textual: «si se quiere
   * cambiar debería retroceder, no que aparezcan siempre ambos botones».
   */
  const [eligiendo, setEligiendo] = useState(false);

  /**
   * ⚠️ EL HORARIO SE PINTA OPTIMISTA, Y NO ES UN LUJO: MEDIDO, TARDABA 6 SEGUNDOS.
   *
   * `onCambio()` recarga el GET entero de la tab (secuencias + métricas de 30 días +
   * la serie diaria), así que esperar la vuelta para dibujar el editor del horario deja
   * el botón «Por tiempo» sin ningún efecto visible por 4-6 s. Medido en el navegador
   * el 05/10/2026, sondeando cada vez que pasaba: a los 3.001 ms el editor NO estaba, a
   * los 6.001 sí. Y un botón que hace su trabajo y recién te lo muestra cinco segundos
   * después es indistinguible de un botón roto — ya es regla de esta casa.
   *
   * `undefined` significa «todavía no tocaron nada, manda la prop». Un `null` a secas no
   * alcanzaría: null es un valor VÁLIDO del campo («se dispara por una acción»), así que
   * con null como centinela apagar el horario no se podría pintar hasta la recarga.
   */
  const [cronOptimista, setCronOptimista] = useState<CronAviso | null | undefined>(undefined);
  const cron = cronOptimista !== undefined ? cronOptimista : (secuencia.cron ?? null);
  const guardarCron = async (c: CronAviso | null) => {
    setEligiendo(false);
    const previo = cron;
    setCronOptimista(c);
    const j = await api({ action: 'cron', secuenciaId: secuencia.id, cron: c });
    // Y si el server dice que no, se VUELVE. Un optimista que no revierte es una
    // pantalla que afirma un horario que no está guardado.
    if (!j.ok) { setCronOptimista(previo); setErr(j.error ?? 'No se pudo guardar el horario'); return; }
    setErr(null);
    onCambio();
  };
  /** El nombre, editable tocándolo. Se siembra de la prop y el `key` por secuencia del
   *  caller es lo que lo vuelve a sembrar al cambiar de secuencia. */
  const [nombre, setNombre] = useState(secuencia.nombre);
  const [editandoNombre, setEditandoNombre] = useState(false);
  const guardarNombre = async () => {
    setEditandoNombre(false);
    const t = nombre.trim();
    if (!t || t === secuencia.nombre) { setNombre(secuencia.nombre); return; }
    const j = await api({ action: 'nombre', secuenciaId: secuencia.id, nombre: t });
    if (!j.ok) { setErr(j.error ?? 'No se pudo cambiar el nombre'); setNombre(secuencia.nombre); return; }
    setErr(null);
    onCambio();
  };

  /**
   * LA PILA DE DESHACER del tablero. «¿Dónde está el botón de deshacer y rehacer al lado
   * del zoom? Debe funcionar el ctrl z».
   *
   * La foto es el array de pasos, que es lo único que el lienzo edita. `aplicar` devuelve
   * la foto ANTERIOR porque es lo que rehacer necesita; sin eso, rehacer no tendría de
   * dónde sacar el estado que se deshizo.
   */
  // «Tu forma de escribir» abierto encima del lienzo (ver `setModoIA`). Va ANTES de la
  // pila porque la apaga: con el tutorial delante, un Ctrl+Z fuera de un campo de texto
  // deshacía el lienzo de atrás — y lo primero que deshacía era la casilla recién tildada.
  const [guiaVoz, setGuiaVoz] = useState(false);
  const { apilar, deshacer, rehacer, puedeDeshacer, puedeRehacer } = usePilaDeshacer<PasoSecuenciaDto[]>(
    (foto) => { const antes = pasos; setPasos(foto); return antes; },
    { activa: rolAdmin && !guiaVoz },
  );
  /** Una foto ANTES de cada cambio: apilar después deja el deshacer un paso corrido. */
  const antesDeCambiar = () => apilar(pasos.map((p) => ({ ...p })));

  /**
   * Agregar un paso DESPUÉS de una tarjeta. El ＋ del lienzo dice dónde entra, así que
   * el paso tiene que entrar ahí: insertar y renumerar, no apilar al final.
   */
  const agregarTras = (idNodo: string, que: 'mensaje' | 'accion' = 'mensaje') => {
    antesDeCambiar();
    const m = /^paso-(\d+)$/.exec(idNodo);
    const tras = m ? Number(m[1]) : 0;   // `entrada` → 0, o sea primero de todo
    setPasos((prev) => {
      // «⚡ Acción de MaKo» (decisión de Martín, 08/10/2026): nace SIN ELEGIR —el lienzo le
      // abre el panel— y con espera 0: lo normal es que acompañe al paso anterior («le
      // escribe y lo mueve de etapa»), no que espere un día como un mensaje nuevo.
      const nuevo: PasoSecuenciaDto = que === 'accion'
        ? {
          orden: 0, canal: 'whatsapp', delay_horas: 0, asunto: null, cuerpo: '',
          proveedor: 'no_oficial', template_wa: null, accion: { operacion: '', params: {} },
        }
        : {
          orden: 0, canal: 'whatsapp', delay_horas: 24, asunto: null, cuerpo: '',
          proveedor: 'no_oficial', template_wa: null,
        };
      const antes = prev.filter((p) => p.orden <= tras);
      const despues = prev.filter((p) => p.orden > tras);
      return [...antes, nuevo, ...despues].map((p, i) => ({ ...p, orden: i + 1 }));
    });
  };
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

  /**
   * Qué acción corre un paso «⚡ Acción» y con qué datos. Estado local, como el texto de un
   * mensaje: se guarda con «Publicar» (y `setSecuenciaPasos` frena una acción sin elegir).
   * Cambiar DE ACCIÓN entra a la pila de deshacer; tipear un dato no, igual que el texto.
   */
  const editarAccion = (orden: number, v: { operacion?: string; params?: Record<string, unknown> }) => {
    const antes = pasos.find((p) => p.orden === orden)?.accion?.operacion ?? '';
    if ((v.operacion ?? '') !== antes) antesDeCambiar();
    setPasos((prev) => prev.map((p) => (p.orden === orden ? { ...p, accion: { operacion: v.operacion ?? '', params: v.params ?? {} } } : p)));
  };

  const editarVariante = (orden: number, i: number, val: string) =>
    setPasos((prev) => prev.map((p) => (p.orden !== orden ? p : {
      ...p, variantes: (p.variantes ?? []).map((v, k) => (k === i ? val : v)),
    })));

  const quitarVariante = (orden: number, i: number) =>
    setPasos((prev) => prev.map((p) => (p.orden !== orden ? p : {
      ...p, variantes: (p.variantes ?? []).filter((_, k) => k !== i),
    })));

  /**
   * «Lo adapta MaKo» en un paso (pedido de Martín, 05/10: «haz el interruptor de IA»).
   * Es estado local, como el texto: se guarda con «Publicar» y entra a la pila de
   * deshacer. Apagarlo vuelve a `texto` y el paso sale con el cuerpo, como siempre.
   *
   * ⚠️ LA PRIMERA VEZ ABRE «Tu forma de escribir». Decisión de Martín: «que ese
   * tutorial se habilite la primera vez que se intente poner una tarjeta de chat y
   * activar la opción de "IA"». «Primera vez» es «el negocio todavía no tiene guía de
   * voz», y se pregunta al server en el momento: un flag en el navegador no sabe si la
   * guía ya se armó desde otra pestaña o desde otro usuario del mismo negocio. Si la
   * pregunta falla, NO se abre nada: la IA escribe igual con un registro neutro, y un
   * tutorial que salta por un error de red se lee como que la casilla hace otra cosa.
   *
   * ⚠️ SE PREGUNTA POR LA GUÍA, NO POR EL TILDE DEL PASO (#745). El tilde se marca aunque
   * no se haya escrito ninguna guía, y el ws9 y Código Inmobiliario lo tenían sin guía:
   * la IA escribía con un registro neutro y el tutorial no se abría nunca. La regla vive
   * en lib/chatbot-puerta.ts (`abrirGuiaVoz`).
   */
  const setModoIA = (orden: number, on: boolean) => {
    antesDeCambiar();
    setPasos((prev) => prev.map((p) => (p.orden !== orden ? p : { ...p, tipo: on ? 'ia' as const : 'texto' as const })));
    if (!on || guiaOfrecida.enLaVisita) return;
    void (async () => {
      try {
        const j = await (await fetch('/api/chat-agent/onboarding?tab=setting', { cache: 'no-store' })).json();
        if (abrirGuiaVoz(j)) { guiaOfrecida.enLaVisita = true; setGuiaVoz(true); }
      } catch { /* sin red no se abre: ver arriba */ }
    })();
  };

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
  /**
   * DE QUÉ NÚMERO SALE (pedido de Martín, 06/10/2026: «dentro del chatbot una opción para
   * seleccionar de qué número sale esa automatización»). Se guarda al elegir, como el
   * disparador: no es texto que se edita, es una decisión de un clic.
   *
   * El selector sólo se dibuja con DOS líneas o más: con una, no hay nada que elegir. La lista
   * es la de la bandeja (`?lineas=1`, que puede leer cualquier miembro), y el server valida la
   * línea al guardar y al mandar — una que no es del negocio no se guarda ni manda.
   */
  const [lineasWa, setLineasWa] = useState<Array<{ linea: string; rotulo: string; estado: string; esDefault: boolean }>>([]);
  const [lineaSec, setLineaSec] = useState<string | null>(secuencia.instance_name ?? null);
  useEffect(() => {
    let vivo = true;
    void (async () => {
      try {
        const j = await (await fetch('/api/whatsapp/evolution/mensajes?lineas=1', { cache: 'no-store' })).json();
        if (vivo && j.ok) setLineasWa(j.lineas ?? []);
      } catch { /* sin lista, no se ofrece elegir */ }
    })();
    return () => { vivo = false; };
  }, []);
  // ¿La línea por la que sale ESTA secuencia puede mandar? Con un solo número es la pregunta de
  // siempre (`canalCaido`, sondeada). Con varios, la de la secuencia: mirar la de por default
  // decía «Activada ✓» sobre una secuencia que sale por una línea caída.
  const lineaDeLaSec = lineasWa.length > 1
    ? (lineaSec ? lineasWa.find((l) => l.linea === lineaSec) ?? null : (lineasWa.find((l) => l.esDefault) ?? lineasWa[0]))
    : null;
  const caidaLaSec = lineasWa.length > 1
    ? !lineaDeLaSec || (lineaDeLaSec.estado !== 'conectado' && lineaDeLaSec.estado !== 'conectando')
    : canalCaido;
  const guardarLinea = async (linea: string | null) => {
    const antes = lineaSec;
    setLineaSec(linea);
    try {
      const r = await (await fetch('/api/whatsapp/secuencias', { method: 'PATCH', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify({ id: secuencia.id, linea }) })).json();
      if (!r.ok) { setLineaSec(antes); setErr(r.error || 'No se pudo cambiar el número.'); return; }
      setErr(null);
      onCambio();
    } catch { setLineaSec(antes); setErr('Sin conexión — prueba de nuevo.'); }
  };

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
            ? (caidaLaSec && soloWa
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
     *
     * ⚠️ UNA SECUENCIA EN UNA ETAPA CON CLASES SE SUMA AL MENSAJE DEL CURSO. Cuando el curso
     * mueve solo a un cliente a una etapa con clases, ya le escribe «ya tienes abierta X»
     * (lib/curso-avance.ts), y el mismo movimiento dispara el evento de entrega: con una
     * secuencia colgada de esa etapa le llegan los dos. No se avisa en pantalla porque este
     * selector no sabe qué etapas tienen clases; queda escrito acá y en
     * docs/hallazgos-customer-success.md.
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


  /**
   * ⚠️ EL LIENZO ES LA PANTALLA. No hay barra, ni cabecera, ni pie: el título, el
   * interruptor, «Probar», el deshacer y «Publicar» FLOTAN encima, que es exactamente
   * cómo quedó el editor de /mensajes y lo que Martín pidió replicar «tal cual».
   *
   * Lo que se fue, con su pedido al lado:
   *  · la barra con el nombre y los botones → «elimina todo el título y la topbar, ahí
   *    debe estar la grilla»;
   *  · el menú «⋯» → «ese desplegable no tiene ningún sentido, eso se configura con las
   *    tarjetas, elimínalo»;
   *  · «Guardar» → «no existe el botón de GUARDAR, solo el de publicar, y está abajo»;
   *  · la línea del disparador → ahora se edita adentro de la tarjeta de entrada.
   */
  return (
    // `flex: 1` + `minHeight: 0`, NO `height: 100%`: el padre saca su alto de un flex y
    // para el motor eso es un alto INDEFINIDO — Chrome lo resuelve igual y Safari
    // devuelve CERO, o sea la pantalla en blanco (AGENTS.md, ya pagado con un cliente).
    <div style={{ flex: 1, minHeight: 0, width: '100%', display: 'flex', flexDirection: 'column', minWidth: 0 }}>
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
        onModoIA={rolAdmin ? setModoIA : undefined}
        onAccion={rolAdmin ? editarAccion : undefined}
        onModo={setModo} onDesenlace={setDesenlace} onAntiguedad={setAntiguedad}
        onEnvioAuto={rolAdmin ? setEnvioAuto : undefined}
        onAbrirSecuencia={onAbrirClave}
        onAgregarTras={agregarTras}
        insetIzq={insetIzq}
        chrome={(
          <div style={{ display: 'flex', alignItems: 'flex-start', gap: 10 }}>
            {/* El ancho es FIJO por lo mismo que en /mensajes: en modo edición el
                contenido es un `<input>`, que NO mide su texto —mide `size` por el
                avance del «0» de la fuente— así que con `maxWidth` la tarjeta encoge al
                hacer click. Con el ancho puesto, los dos estados miden lo mismo. */}
            <div style={{ ...tarjetaChrome, minWidth: 0, width: 400, display: 'flex', alignItems: 'center', gap: 8 }}>
              <span style={{ flex: 'none', fontSize: 18, lineHeight: 1 }}>{est ? (EMOJI_OBJ[est.objetivo as Objetivo] ?? '🎯') : '⚑'}</span>
              <div style={{ minWidth: 0, flex: 1 }}>
                {/* El nombre se cambia HACIENDO CLICK EN ÉL, como en el resto de la
                    casa: un lápiz al lado es un segundo control para la misma acción. */}
                {editandoNombre ? (
                  <input
                    autoFocus value={nombre} onChange={(e) => setNombre(e.target.value)}
                    onBlur={() => void guardarNombre()}
                    onKeyDown={(e) => { if (e.key === 'Enter') void guardarNombre(); if (e.key === 'Escape') { setNombre(secuencia.nombre); setEditandoNombre(false); } }}
                    style={{ width: '100%', boxSizing: 'border-box', padding: 0, border: 'none', outline: 'none', background: 'transparent', color: 'var(--ink)', fontSize: 14.5, fontWeight: 700, fontFamily: 'inherit' }}
                  />
                ) : (
                  <button onClick={() => rolAdmin && setEditandoNombre(true)} title={rolAdmin ? 'Cambiar el nombre' : undefined}
                    style={{ display: 'block', width: '100%', textAlign: 'left', padding: 0, border: 'none', background: 'none', cursor: rolAdmin ? 'text' : 'default', color: 'var(--ink)', fontSize: 14.5, fontWeight: 700, fontFamily: 'inherit', whiteSpace: 'nowrap', overflow: 'hidden', textOverflow: 'ellipsis' }}>
                    {nombre || secuencia.nombre}
                  </button>
                )}
              </div>
            </div>

            {/* «Activar» en su propia tarjeta, a la derecha del título: igual que en
                /mensajes, y por el mismo motivo —adentro de la del título la hace de dos
                renglones y aprieta el nombre. */}
            <div style={{ ...tarjetaChrome, flex: 'none', display: 'inline-flex', alignItems: 'center', gap: 8 }}>
              <span style={{ fontSize: 12, fontWeight: 600, color: activa ? 'var(--good)' : 'var(--dim)' }}>Activar</span>
              <button onClick={toggle} disabled={!rolAdmin || busy === 'toggle'} aria-pressed={activa} title={activa ? 'Pausar' : 'Activar'}
                style={{ width: 38, height: 22, borderRadius: 999, border: 'none', padding: 2, background: activa ? 'var(--good)' : 'var(--border-strong)', cursor: rolAdmin ? 'pointer' : 'default', flex: 'none', transition: 'background .15s' }}>
                <span style={{ display: 'block', width: 18, height: 18, borderRadius: '50%', background: '#fff', transform: activa ? 'translateX(16px)' : 'none', transition: 'transform .15s' }} />
              </button>
            </div>

            {onProbar && (
              <button onClick={onProbar} title="Ver cómo le llega esta secuencia al lead"
                style={{ ...tarjetaChrome, flex: 'none', fontSize: 12.5, fontWeight: 600, color: 'var(--dim)', cursor: 'pointer', fontFamily: 'inherit' }}>▶ Probar</button>
            )}
          </div>
        )}
        herramientas={rolAdmin ? (
          <div style={{ display: 'inline-flex', alignItems: 'center', gap: 6 }}>
            <BotonPila titulo="Deshacer (Ctrl+Z)" onClick={deshacer} activo={puedeDeshacer}>↶</BotonPila>
            <BotonPila titulo="Rehacer (Ctrl+Y)" onClick={rehacer} activo={puedeRehacer}>↷</BotonPila>
          </div>
        ) : undefined}
        pie={rolAdmin ? (
          <div style={{ display: 'inline-flex', alignItems: 'center', gap: 10 }}>
            {flash && <span style={{ ...tarjetaChrome, fontSize: 12.5, fontWeight: 600, color: 'var(--good)' }}>{flash}</span>}
            {/* ⚠️ «PUBLICAR», NO «GUARDAR»: «no existe el botón de GUARDAR, solo el de
                publicar, y está abajo». Es el mismo verbo que en /mensajes y dice lo que
                pasa: lo escrito pasa a ser lo que MaKo manda. */}
            <button onClick={guardar} disabled={busy === 'save'}
              style={{ padding: '9px 18px', borderRadius: 9, border: 'none', background: 'var(--primary)', color: '#fff', fontSize: 13, fontWeight: 600, cursor: 'pointer', opacity: busy === 'save' ? 0.45 : 1, fontFamily: 'inherit' }}>
              {busy === 'save' ? 'Publicando…' : 'Publicar'}
            </button>
          </div>
        ) : undefined}
        editorEntrada={(
          <div style={{ marginBottom: 12 }}>
            {lineasWa.length > 1 && (() => {
              // ⚠️ La línea guardada entra SIEMPRE a las opciones, aunque se haya ido: un
              // `value` que no está entre sus opciones se dibuja como la primera y el primer
              // clic lo pisa (AGENTS.md, el `<select>` que borra datos).
              const porDefault = lineasWa.find((l) => l.esDefault) ?? lineasWa[0];
              const opciones = [
                { value: '', label: `${porDefault.rotulo} (por default)`, color: porDefault.estado === 'conectado' ? 'var(--good)' : 'var(--warn)' },
                ...lineasWa.filter((l) => l.linea !== porDefault.linea).map((l) => ({ value: l.linea, label: l.rotulo, color: l.estado === 'conectado' ? 'var(--good)' : 'var(--warn)' })),
                ...(lineaSec && !lineasWa.some((l) => l.linea === lineaSec) ? [{ value: lineaSec, label: 'Un número que ya no está vinculado' }] : []),
              ];
              return (
                <div style={{ marginBottom: 12 }}>
                  <label style={{ display: 'block', fontSize: 11, fontWeight: 600, letterSpacing: '.04em', textTransform: 'uppercase', color: 'var(--faint)', marginBottom: 6 }}>Sale por</label>
                  {rolAdmin ? (
                    <Dropdown
                      value={lineaSec && lineaSec !== porDefault.linea ? lineaSec : ''}
                      options={opciones}
                      onChange={(v) => void guardarLinea(v || null)}
                      ariaLabel="Número de WhatsApp por el que sale esta secuencia"
                      width="100%"
                    />
                  ) : (
                    <div style={{ fontSize: 12.5, color: 'var(--ink)' }}>{opciones.find((o) => o.value === (lineaSec ?? ''))?.label ?? porDefault.rotulo}</div>
                  )}
                  {caidaLaSec && <div style={{ fontSize: 11.5, color: 'var(--warn)', marginTop: 5 }}>Ese número está desconectado</div>}
                </div>
              );
            })()}
            <label style={{ display: 'block', fontSize: 11, fontWeight: 600, letterSpacing: '.04em', textTransform: 'uppercase', color: 'var(--faint)', marginBottom: 6 }}>Cuándo se dispara</label>
            {rolAdmin && (
              <SelectorDisparo
                modo={eligiendo ? null : (cron ? 'tiempo' : 'accion')}
                disabled={busy != null}
                onModo={(m) => {
                  if (m === null) { setEligiendo(true); return; }
                  // Elegir uno APAGA el otro, y es una ESCRITURA y no un `disabled`:
                  // dejar el horario puesto y sólo grisarlo dejaría una secuencia que
                  // el motor sigue disparando por tiempo con la pantalla diciendo que
                  // la dispara una acción.
                  if (m === 'tiempo' && !cron) { void guardarCron(CRON_DEFAULT); return; }
                  if (m === 'accion' && cron) { void guardarCron(null); return; }
                  setEligiendo(false);
                }}
              />
            )}
            {cron && (
              <div style={{ marginBottom: 12 }}>
                <EditorCron cron={cron} tz={tz} disabled={!rolAdmin || busy != null} onCron={(c) => void guardarCron(c)}
                  nota={(
                    // ⚠️ EL HORARIO DICE CUÁNDO, NO A QUIÉN. El motor sigue necesitando
                    // la cohorte —a quién le escribe— así que el selector de abajo no se
                    // esconde: un horario sin cohorte no inscribiría a nadie, y eso se
                    // leería como que el agendado no funciona.
                    <span style={{ fontSize: 11, color: 'var(--faint)', lineHeight: 1.4 }}>
                      En ese momento inscribe a quien esté en lo que elijas abajo.
                    </span>
                  )} />
              </div>
            )}
            <label style={{ display: 'block', fontSize: 11, fontWeight: 600, letterSpacing: '.04em', textTransform: 'uppercase', color: 'var(--faint)', marginBottom: 6 }}>{cron ? 'A quién' : 'Qué lo dispara'}</label>
            {rolAdmin && productos.length > 0 && (esDeEtapa || esDeEntrega || cambiandoAEtapa) ? (
              <div style={{ display: 'flex', flexDirection: 'column', gap: 7 }}>
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
                  width="100%"
                />
                <Dropdown
                  value={funnelSel == null ? '' : String(funnelSel)}
                  // Sólo los que tienen EMBUDO: un servicio sin embudo no tiene etapas de venta,
                  // y su `funnelId` null se volvería la opción «null». Sus etapas de entrega
                  // salen igual en el desplegable de arriba, con «Todos los productos».
                  options={[{ value: '', label: 'Todos los productos' }, ...productos.flatMap((pr) => (pr.funnelId == null ? [] : [{ value: String(pr.funnelId), label: pr.nombre }]))]}
                  onChange={(v) => {
                    const fid = v === '' ? null : Number(v);
                    setFunnelSel(fid);
                    const pr = fid == null ? null : productos.find((x) => x.funnelId === fid);
                    const enVenta = fid == null
                      ? productos.some((x) => x.etapas.some((e) => e.value === secuencia.etapa))
                      : !!pr?.etapas.some((e) => e.value === secuencia.etapa);
                    const enEntrega = !!pr?.etapasEntrega.some((e) => e.value === secuencia.etapa);
                    if (esDeEntrega && enEntrega && pr?.productoId != null) void guardarDisparador(secuencia.etapa, 'entrega', pr.productoId);
                    else if (!esDeEntrega && enVenta) void guardarDisparador(secuencia.etapa, 'venta', fid);
                  }}
                  ariaLabel="Producto del que se miran las etapas"
                  width="100%"
                />
                {!etapaEstaEnElProducto && <span style={{ fontSize: 11.5, color: 'var(--warn)' }}>Elegí una etapa de este producto</span>}
              </div>
            ) : (
              <div style={{ fontSize: 12.5, color: 'var(--ink)', lineHeight: 1.5 }}>
                {etiquetaDisparador}
                {rolAdmin && productos.length > 0 && (
                  <button onClick={() => setCambiandoAEtapa(true)}
                    style={{ display: 'block', marginTop: 6, background: 'none', border: 'none', padding: 0, font: 'inherit', fontSize: 12.5, color: 'var(--primary)', cursor: 'pointer' }}>
                    Cambiar a una etapa
                  </button>
                )}
              </div>
            )}
          </div>
        )}
      />
      {err && <div style={{ flex: 'none', margin: '8px 14px 0', padding: '9px 12px', borderRadius: 9, fontSize: 13, border: '1px solid var(--bad)', background: 'var(--bad-bg)', color: 'var(--bad)' }}>{err}</div>}
      {/* «Tu forma de escribir», encima de todo. Al `body` porque el lienzo vive adentro
          de contenedores con `transform` y `overflow`, y un `position: fixed` nacido ahí
          adentro se dibuja recortado o debajo (AGENTS.md: un sticky con z-index le
          clampea el z-index a lo que nace adentro). La casilla queda tildada igual: sin
          guía, MaKo escribe con un registro neutro. */}
      {guiaVoz && typeof document !== 'undefined' && createPortal(
        <OnboardingChatAgent soloPaso="contexto" onListo={() => setGuiaVoz(false)} />,
        document.body,
      )}
    </div>
  );
}

/** Los dos botones de la pila, pegados al zoom. Mismo molde que el de /mensajes. */
function BotonPila({ titulo, onClick, activo, children }: {
  titulo: string; onClick: () => void; activo: boolean; children: ReactNode;
}) {
  return (
    <button type="button" onClick={onClick} disabled={!activo} title={titulo} aria-label={titulo}
      style={{
        width: 26, height: 26, padding: 0, display: 'inline-flex', alignItems: 'center', justifyContent: 'center',
        borderRadius: 8, border: '1px solid var(--border)', background: 'var(--surface)',
        color: activo ? 'var(--dim)' : 'var(--faint)', fontSize: 15, fontFamily: 'inherit',
        cursor: activo ? 'pointer' : 'default', opacity: activo ? 1 : 0.45,
      }}>
      {children}
    </button>
  );
}
