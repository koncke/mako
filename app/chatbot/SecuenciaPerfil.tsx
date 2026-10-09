'use client';

// =============================================================================
// SecuenciaPerfil — una automatización del chatbot, editada sobre su lienzo
// =============================================================================
// Cubre TODO el chat (inline, como en SuperAdmin). El lienzo ES la pantalla: el título,
// el interruptor, «Probar», el deshacer y «Publicar» flotan encima (FlujoLienzo).
// Setter = solo lectura (sin botones de escritura).
//
// ⚠️ ESTE ARCHIVO ES DUEÑO DEL ESTADO: el array del flujo (`pasos`, cada elemento un nodo
// de lib/flujo-grafo.ts), su pila de deshacer y «Publicar». Todo cambio del lienzo sube
// por `onPasos`, así que Ctrl+Z deshace también una condición o un caso de «Si responde»
// —viven en `pasos`—, cosa que antes no pasaba: el deshacer apilaba sólo los pasos y el
// desenlace vivía en la estrategia.
//
// Lo que se guarda AL TOCAR (una decisión de un clic, sin texto que revisar): el
// disparador, el horario, la línea, el nombre y Activar. Lo que se guarda con PUBLICAR:
// el flujo entero, validado antes (`validarGrafo`).

import { useEffect, useMemo, useRef, useState, type CSSProperties, type ReactNode } from 'react';
import { createPortal } from 'react-dom';
import dynamic from 'next/dynamic';
import { usePilaDeshacer } from '@/app/_ui/usePilaDeshacer';
import { EditorCron, SelectorDisparo, CRON_DEFAULT } from '@/app/_components/EditorCron';
import type { CronAviso } from '@/lib/cron-aviso';
import type { AudioSetting, SecuenciaDto, Opcion, PasoSecuenciaDto, ProductoOpcion } from './ChatAgentApp';
import { FlujoLienzo, type CambioPasos, type EtiquetaLienzo, type SeccionEtapas } from './FlujoLienzo';
import { Dropdown } from '@/app/components/Dropdown';
import { useEtiquetasTodas, avisarCambioEtiquetas } from '@/app/_components/etiquetas-cliente';
import { CrearConIA, type ListoCrearIA } from './CrearConIA';
import type { CanalProbar } from './PanelProbar';
import { useFaltanEnAcciones } from '@/app/_components/EditorAccionMako';
import { esPasoAccion } from '@/lib/nutricion-paso-accion';
import { franjaIA, CAJA_IA_ANCHO, BARRA_IA_ANCHO, RESERVA_ABAJO_CREAR } from '@/lib/crear-ia-lugar';
import { resumenAvisos, edicionVigente } from '@/lib/flujo-ia-cliente';
import type { Objetivo } from '@/lib/setting-estrategia';
import { normalizar, borrarNodo, esNodoMensaje } from '@/lib/flujo-grafo';
import type { Muelles } from '@/lib/lienzo-grafo';
import { legadoAGrafo, esFlujoExplicito } from '@/lib/flujo-legado';
import {
  insertarDesdeLienzo, crearRespuesta, renumerar, errorLegible, tarjetaDelError, estrategiaConLimpieza,
  detalleDisparador, pasosDisparo, valorDisparo, pedidoDisparo, disparoDeValor, nombreEtiqueta,
  rotuloDisparo, canalesParaProbar, frenoDelFlujo,
  type QueAgregar, type DisparoActual,
} from '@/lib/flujo-conversacion';
import { EmojiPickerMini } from '@/app/plan/board/EmojiPicker';
import { abrirGuiaVoz } from '@/lib/chatbot-puerta';

// El wizard son ~1.800 líneas y sólo se abre UNA vez por workspace (la primera vez que
// se tilda la IA): no tiene por qué viajar en el bundle de cada apertura del lienzo.
const OnboardingChatAgent = dynamic(() => import('./OnboardingChatAgent').then((m) => m.OnboardingChatAgent), { ssr: false });

async function api(body: unknown): Promise<{ ok: boolean; error?: string }> {
  try { return await (await fetch('/api/chat-agent/secuencias', { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify(body) })).json(); } catch { return { ok: false, error: 'sin conexión' }; }
}

const EMOJI_OBJ: Record<Objetivo, string> = { agendar: '📅', preparar: '🎯', reactivar: '🧲', cualificar: '❓', confirmar_pago: '💳' };

/** El tope del nombre: con 40 entran los seis vigentes (el más largo mide 39) y en la lista
 *  de la izquierda se lee entero (punto 3: «con un máximo de caracteres para los títulos»). */
const NOMBRE_MAX = 40;

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

/** El disparador que trae la FILA (la prop), en la forma que usa el desplegable del CRON. */
export function disparoDeSecuencia(s: Pick<SecuenciaDto, 'trigger_tipo' | 'etapa' | 'funnel_id' | 'producto_id' | 'etiqueta_id'>): DisparoActual {
  return {
    trigger_tipo: s.trigger_tipo, etapa: s.etapa,
    funnel_id: s.funnel_id ?? null, producto_id: s.producto_id ?? null, etiqueta_id: s.etiqueta_id ?? null,
  };
}

/** Lo que distingue un disparador de otro: si cambia en la prop, el CRON se vuelve a sembrar. */
export const firmaDisparo = (d: DisparoActual): string =>
  [d.trigger_tipo, d.etapa ?? '', d.funnel_id ?? '', d.producto_id ?? '', d.etiqueta_id ?? ''].join('|');

/** La edición en curso de una automatización, tal como la ve el lienzo. */
export type EdicionLocal = {
  secuenciaId: number;
  pasos: PasoSecuenciaDto[];
  estrategia: SecuenciaDto['estrategia'];
  nombre: string;
  trigger_tipo: string;
  instance_name: string | null;
};

export function SecuenciaPerfil({ secuencia, etiquetaEtapa, rolAdmin, audios, negocio, canalCaido, tz, insetIzq, onAudioNuevo, secuencias, productos, disparadores, onProbar, onCambio, onCambioLocal, insetDer, handoffs, muelles, revelar, onSinPublicar, pedidoIA }: {
  secuencia: SecuenciaDto;
  /** Las del workspace: el lienzo las necesita para resolver un «Ir a» y convertir un «Sigue con». */
  secuencias: ReadonlyArray<SecuenciaDto>;
  /** Los productos del CRM con sus etapas, para elegir el disparador. */
  productos: ProductoOpcion[];
  /** Las etiquetas de los disparadores (`TRIGGERS`), para decir la verdad del que tiene puesto. */
  disparadores: Opcion[];
  onAbrirClave: (clave: string) => void;
  /** Cambiar de secuencia SIN salir del lienzo: no hay pantalla de listado. */
  onElegir?: (id: number) => void;
  /** Crear una. Está acá y no en una pantalla aparte por lo mismo. */
  onNueva?: () => void;
  /**
   * Abre el panel de «Probar» en ESE canal (tercera tanda, decisión 14: un desplegable WhatsApp /
   * Email, sólo con los que el flujo usa). Lo decide quien monta: el panel es una vista hermana del
   * lienzo. Se llama recién cuando el flujo pasa lo mismo que Publicar (`frenoDelFlujo`).
   */
  onProbar?: (canal: CanalProbar) => void;
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
  /**
   * Lo que se está editando, SIN publicar, cada vez que cambia. Lo lee el panel de
   * «Probar» (punto 10: «no puedo interactuar, para probarlo de verdad»): tiene que probar
   * lo que se VE en el lienzo, no lo último guardado.
   */
  onCambioLocal?: (v: EdicionLocal) => void;
  /** Cuánto se corre lo que flota a la DERECHA (el panel de «Probar» abierto ocupa ese lado). */
  insetDer?: number;
  /**
   * Los hand-offs pendientes del workspace (GET /api/chat-agent/secuencias → `handoffs`): las
   * respuestas que no encajaron en ningún caso y esperan a una persona. Se cuentan los de ESTA
   * automatización y se marcan en la fila «Otra cosa» (revisión, costuras-5: sin el panel que
   * se borró, no se veían en ningún lado). Ausente = no se marca nada.
   */
  handoffs?: ReadonlyArray<{ secuenciaId: number | null }>;
  /** Dónde va cada cosa que flota (`muelles`, lib/lienzo-grafo.ts). Lo calcula la tab. */
  muelles?: Muelles | null;
  /** Las tarjetas aparecen de a una («Crear con IA», decisión 14). Lo pasa quien crea. */
  revelar?: { orden: string[]; clave: number } | null;
  /**
   * Hay cambios del flujo SIN PUBLICAR que la persona hizo (decisión 15). Lo lee la tab para
   * preguntar antes de cambiar de automatización: con el `key` por secuencia, cambiar remonta este
   * componente y lo no publicado se perdía sin aviso (medido, R1/R3).
   */
  onSinPublicar?: (hay: boolean) => void;
  /** «Crear con IA»: un pedido ya escrito (el «Armar una» de una etapa sin automatización). */
  pedidoIA?: string;
}) {
  const est = secuencia.estrategia;

  /**
   * EL FLUJO, Y LO DE ANTES CONVERTIDO.
   *
   * Una secuencia escrita antes del 08/10/2026 tiene su comportamiento fuera de las
   * tarjetas: la espera en `delay_horas`, la condición en `requiere`, «Solo a leads
   * recientes», «Sale sola», «Termina si agenda» y los casos del modo asistido. El lienzo
   * la muestra CONVERTIDA (`legadoAGrafo`, sólo lectura para esta parte) y Publicar guarda
   * los pasos nuevos y la estrategia con la LIMPIEZA, para que el motor viejo no repita lo
   * que ahora hacen las tarjetas. Un «Sigue con» apunta por CLAVE: `idDeClave` lo resuelve
   * con las secuencias del workspace.
   *
   * Se calcula UNA vez (al montar): el `key` por secuencia del caller lo vuelve a sembrar al
   * cambiar de secuencia.
   *
   * ⚠️ UN FLUJO DE TARJETAS NO SE CONVIERTE NUNCA (`esFlujoExplicito`). `legadoAGrafo` arma
   * la salida LINEAL desde el orden del array: pasado sobre un flujo con ramas (uno al que,
   * por ejemplo, la API de MaKo le volvió a poner un `delay_horas`), le aplasta las ramas en
   * una fila. Ahí lo de antes que quede en un paso se dibuja con su marca y el motor lo sigue
   * haciendo, y lo que quede en la ESTRATEGIA NO se limpia: el motor lo sigue haciendo
   * (el tope de antigüedad al inscribir, por ejemplo), y limpiarlo lo apagaría en silencio.
   * Tener ids NO es ser un flujo: una lista de antes que pasó por `setSecuenciaPasos` los
   * tiene (`o<i>`) y sigue siendo una lista que se convierte.
   */
  const [inicial] = useState(() => {
    const ordenados = [...secuencia.pasos].sort((a, b) => (a.orden ?? 0) - (b.orden ?? 0));
    const yaEsFlujo = esFlujoExplicito(ordenados);
    const r = yaEsFlujo
      ? { pasos: normalizar(ordenados), notas: [] as string[], convertida: false }
      : legadoAGrafo(ordenados, est, { idDeClave: (clave) => secuencias.find((s) => s.clave === clave)?.id ?? null });
    return { ...r, pasos: renumerar(r.pasos), publicado: JSON.stringify(renumerar(normalizar(ordenados))) };
  });
  const [pasos, setPasos] = useState<PasoSecuenciaDto[]>(inicial.pasos);
  const [convertida, setConvertida] = useState(inicial.convertida);
  const [publicado, setPublicado] = useState(inicial.publicado);
  const sinPublicar = convertida || JSON.stringify(pasos) !== publicado;

  /**
   * LO QUE LA PERSONA CAMBIÓ Y NO PUBLICÓ (decisión 15): el flujo de ahora contra el que vio al
   * abrir o al publicar por última vez. NO es `sinPublicar`: una secuencia de antes abre
   * CONVERTIDA (el lienzo la muestra en tarjetas) y eso dice «Sin publicar» sin que nadie haya
   * tocado nada. Preguntar «Tienes cambios sin publicar» ahí sería afirmar algo falso, y salir no
   * pierde nada: la conversión se vuelve a hacer al abrirla.
   */
  const [visto, setVisto] = useState(() => JSON.stringify(inicial.pasos));

  /**
   * «CREAR CON IA» (punto 11, decisión 14). Crear ya GUARDÓ la automatización (pausada) en el server:
   * lo que vuelve pasa a ser lo publicado y lo visto, y la tab relee (cambió el nombre y el disparador).
   * Editar es un BORRADOR local: UNA foto de deshacer y «Sin publicar». En los dos casos las tarjetas
   * aparecen de a una sobre el layout final (`revelar`), nunca armando el flujo de a pedazos.
   */
  const [revelarIA, setRevelarIA] = useState<{ orden: string[]; clave: number } | null>(null);
  const [editandoIA, setEditandoIA] = useState(false);
  /** Hay una tarjeta abierta (lo avisa el lienzo): la caja y la barra de la IA se esconden. */
  const [tarjetaAbierta, setTarjetaAbierta] = useState(false);
  const cambiosPropios = rolAdmin && JSON.stringify(pasos) !== visto;
  const avisarSinPublicar = useRef(onSinPublicar);
  useEffect(() => { avisarSinPublicar.current = onSinPublicar; });
  useEffect(() => { avisarSinPublicar.current?.(cambiosPropios); }, [cambiosPropios]);
  // Al desmontarse (cambió de automatización, se descartó), ya no hay nada sin publicar acá.
  useEffect(() => () => { avisarSinPublicar.current?.(false); }, []);
  /**
   * Y CERRAR LA PESTAÑA (o recargar) TAMBIÉN PREGUNTA mientras haya cambios. El navegador muestra
   * su propio cartel —no se le puede poner texto—: es el único que corre al cerrar.
   */
  useEffect(() => {
    if (!cambiosPropios) return;
    const alSalir = (e: BeforeUnloadEvent) => { e.preventDefault(); e.returnValue = ''; };
    window.addEventListener('beforeunload', alSalir);
    return () => window.removeEventListener('beforeunload', alSalir);
  }, [cambiosPropios]);

  /**
   * CÓMO SE DISPARA: POR TIEMPO O POR UNA ACCIÓN.
   *
   * ⚠️ `eligiendo` ES UN ESTADO PROPIO Y NO SE DERIVA DEL DATO. Toda secuencia tiene
   * `trigger_tipo`, así que «qué hay guardado» siempre contesta tiempo o acción y los
   * dos botones no aparecerían NUNCA: cambiar de modo sería imposible. La flecha pone
   * esto en true, que es lo que vuelve a la elección.
   */
  const [eligiendo, setEligiendo] = useState(false);

  /**
   * ⚠️ EL HORARIO SE PINTA OPTIMISTA, Y NO ES UN LUJO: MEDIDO, TARDABA 6 SEGUNDOS.
   *
   * `onCambio()` recarga el GET entero de la tab, así que esperar la vuelta para dibujar el
   * editor del horario deja el botón «Por tiempo» sin efecto visible por 4-6 s, y un botón
   * que hace su trabajo y te lo muestra cinco segundos después es indistinguible de uno
   * roto. `undefined` = «todavía no tocaron nada, manda la prop»: null es un valor VÁLIDO
   * del campo («se dispara por una acción»).
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

  /**
   * QUÉ LA DISPARA: un desplegable con TODO lo que puede disparar una automatización
   * (`pasosDisparo`), que reemplaza al par «texto + Cambiar a una etapa». Se guarda al
   * elegir (POST `action: 'trigger'`, lo implementa la parte del motor) y se pinta
   * optimista, con la vuelta si el server dice que no.
   */
  const [disparo, setDisparo] = useState<DisparoActual>(() => disparoDeSecuencia(secuencia));
  /**
   * ⚠️ Y SE VUELVE A SEMBRAR CUANDO EL SERVER LO CAMBIA (revisión de la segunda tanda, 09/10/2026).
   * «Crear con IA» guarda el disparador que eligió el modelo en el server (`setTriggerSecuencia`) y
   * el lienzo NO se remonta (el `key` es el id, que no cambia): con el `useState` sembrado una sola
   * vez, la tarjeta CRON seguía diciendo «A mano», el desplegable marcaba lo de antes y «Probar»
   * recibía el `trigger_tipo` viejo — y la pantalla donde se activa mostraba otro disparador que el
   * que iba a inscribir. Se compara EN EL RENDER (no en un efecto, que pintaría primero lo viejo).
   * No choca con el optimista de `guardarDisparo`: la prop sólo cambia cuando vuelve la relectura,
   * y vuelve al mismo valor que ya se pintó.
   */
  const firmaProp = firmaDisparo(disparoDeSecuencia(secuencia));
  const [firmaVista, setFirmaVista] = useState(firmaProp);
  if (firmaProp !== firmaVista) {
    setFirmaVista(firmaProp);
    setDisparo(disparoDeSecuencia(secuencia));
  }
  const guardarDisparo = async (valor: string) => {
    const body = pedidoDisparo(valor, secuencia.id);
    if (!body) return;
    const previo = disparo;
    setDisparo(disparoDeValor(valor, previo));
    const j = await api(body);
    if (!j.ok) { setDisparo(previo); setErr(j.error ?? 'No se pudo cambiar el disparador'); return; }
    setErr(null);
    onCambio();
  };

  /** El nombre, editable tocándolo. Se siembra de la prop y el `key` por secuencia del
   *  caller es lo que lo vuelve a sembrar al cambiar de secuencia. */
  const [nombre, setNombre] = useState(secuencia.nombre);
  const [editandoNombre, setEditandoNombre] = useState(false);
  const guardarNombre = async () => {
    setEditandoNombre(false);
    const t = nombre.trim().slice(0, NOMBRE_MAX);
    if (!t || t === secuencia.nombre) { setNombre(secuencia.nombre); return; }
    const j = await api({ action: 'nombre', secuenciaId: secuencia.id, nombre: t });
    if (!j.ok) { setErr(j.error ?? 'No se pudo cambiar el nombre'); setNombre(secuencia.nombre); return; }
    setErr(null);
    onCambio();
  };

  /**
   * EL EMOJI (mig 0229, `nutricion_secuencias.emoji`): se guarda al elegir, optimista y con la vuelta
   * si el server dice que no. Sin emoji guardado, el del objetivo (el de siempre). `undefined` en el
   * optimista = «todavía no tocaron nada, manda la prop». La lista de la izquierda lee el mismo campo
   * (`SecuenciaDto.emoji`) con el mismo respaldo.
   */
  const emojiProp = secuencia.emoji ?? null;
  const [emojiOptimista, setEmojiOptimista] = useState<string | null | undefined>(undefined);
  const emojiGuardado = emojiOptimista !== undefined ? emojiOptimista : emojiProp;
  const emojiVisto = emojiGuardado || (est ? (EMOJI_OBJ[est.objetivo as Objetivo] ?? '🎯') : '⚑');
  const guardarEmoji = async (e: string) => {
    const previo = emojiGuardado;
    setEmojiOptimista(e);
    const j = await api({ action: 'emoji', secuenciaId: secuencia.id, emoji: e });
    if (!j.ok) { setEmojiOptimista(previo); setErr(j.error ?? 'No se pudo cambiar el emoji'); return; }
    setErr(null);
    onCambio();
  };

  const [activa, setActiva] = useState(secuencia.activa);
  // El «⋯» de la lista prende o pausa sin remontar el lienzo (misma `key`): lo de afuera manda. Es el
  // ajuste de estado en el render (no un efecto): el interruptor cambia en el mismo pintado que la lista.
  const [activaVista, setActivaVista] = useState(secuencia.activa);
  if (secuencia.activa !== activaVista) { setActivaVista(secuencia.activa); setActiva(secuencia.activa); }
  const [busy, setBusy] = useState<string | null>(null);
  const [flash, setFlash] = useState<string | null>(null);
  const [err, setErr] = useState<string | null>(null);
  const flashOk = (m: string) => { setFlash(m); setTimeout(() => setFlash(null), 2600); };

  /**
   * LA PILA DE DESHACER del tablero. «¿Dónde está el botón de deshacer y rehacer al lado
   * del zoom? Debe funcionar el ctrl z».
   *
   * La foto es el array del flujo, que es TODO lo que el lienzo edita. `aplicar` devuelve
   * la foto ANTERIOR porque es lo que rehacer necesita.
   */
  // «Tu forma de escribir» abierto encima del lienzo. Va ANTES de la pila porque la apaga:
  // con el tutorial delante, un Ctrl+Z fuera de un campo de texto deshacía el lienzo de atrás.
  const [guiaVoz, setGuiaVoz] = useState(false);
  const { apilar, deshacer, rehacer, puedeDeshacer, puedeRehacer } = usePilaDeshacer<PasoSecuenciaDto[]>(
    (foto) => { const antes = pasos; setPasos(foto); return antes; },
    { activa: rolAdmin && !guiaVoz },
  );
  /**
   * UNA foto por gesto. El composer puede mandar dos cambios en el mismo tick (el texto y
   * la IA): con una foto por cambio, el primer Ctrl+Z desharía la mitad de un clic.
   */
  const apilado = useRef(false);
  const fotoAntes = () => {
    if (apilado.current) return;
    apilado.current = true;
    apilar(pasos.map((p) => ({ ...p })));
    queueMicrotask(() => { apilado.current = false; });
  };

  /** Los avisos de la IA: el que se dibuja y la lista entera (en el `title`). */
  const [avisosIA, setAvisosIA] = useState<{ texto: string; todos: string[] } | null>(null);
  const alListoIA = (r: ListoCrearIA): boolean => {
    const nuevos = renumerar(r.pasos as PasoSecuenciaDto[]);
    if (r.modo === 'crear') {
      const guardado = JSON.stringify(renumerar(normalizar(r.pasos as PasoSecuenciaDto[])));
      setPasos(nuevos);
      setPublicado(guardado);
      setVisto(JSON.stringify(nuevos));
      setConvertida(false);
      if (r.nombre) setNombre(r.nombre);
      // El disparador que quedó puesto (revisión, 09/10/2026): `disparo` se siembra al montar, y sin
      // esto la tarjeta CRON seguía diciendo el de antes («manual») hasta recargar.
      const puesto = r.disparador;
      if (puesto) setDisparo((d) => disparoDeValor(puesto, d));
      onCambio();
    } else {
      // ⚠️ SI EL LIENZO CAMBIÓ MIENTRAS LA IA TRABAJABA, NO SE PISA (revisión, 09/10/2026): el
      // resultado se armó sobre la foto que se mandó, y aplicarlo borraba la corrección del medio.
      if (!edicionVigente(r.base, pasos)) { setErr('Cambiaste el flujo: pídelo de nuevo'); return false; }
      fotoAntes();
      setPasos(nuevos);
      setEditandoIA(false);
    }
    // ⚠️ LAS ETIQUETAS QUE CREÓ LA IA SE ANUNCIAN, EN LOS DOS MODOS (revisión de la segunda tanda,
    // 09/10/2026). La ruta las crea en el SERVER, así que el selector «＋ Nueva» —que sí avisa— no
    // pasó por acá: la lista compartida (`useEtiquetasTodas`) seguía con la que pidió al montar, la
    // tarjeta 🏷️ decía «una etiqueta», el CRON «Se le puso «una etiqueta»» y el selector la daba
    // por borrada («Una etiqueta que ya no está»). Antes de revelar, para que las tarjetas nazcan
    // con el nombre en cuanto vuelve la lista.
    if (r.etiquetasNuevas.length) avisarCambioEtiquetas();
    setRevelarIA({ orden: r.orden, clave: Date.now() });
    const n = r.etiquetasNuevas.length;
    if (n) flashOk(n === 1 ? '1 etiqueta nueva' : `${n} etiquetas nuevas`);
    // ⚠️ EL AVISO QUE MÁS IMPORTA, NO EL PRIMERO QUE SALIÓ (revisión, 09/10/2026): «Elige qué la
    // dispara» o «va sin link» quedaban detrás de cualquier otro y no se veían nunca.
    const res = resumenAvisos(r.avisos);
    if (res) { setErr(res.texto); setAvisosIA(res); }
    return true;
  };

  /** EL CHOKE POINT: todo cambio del lienzo pasa por acá (y por eso todo se deshace). */
  const onPasos: CambioPasos = (fn, conFoto) => {
    if (conFoto) fotoAntes();
    setPasos((prev) => renumerar(fn(prev)));
  };

  /**
   * El ＋ de una salida, o del medio de una flecha: inserta EN ese puerto
   * (`insertarDesdeLienzo` → `insertarNodo`). Devuelve el id nuevo para que el lienzo abra
   * su panel. ⚠️ Ningún mensaje nace con espera: la espera es su propia tarjeta (punto 7).
   */
  const agregarEn = (nodo: string, puerto: string | undefined, que: QueAgregar): string | null => {
    const r = insertarDesdeLienzo(pasos, nodo, puerto, que);
    if (!r.id) return null;
    fotoAntes();
    setPasos(r.pasos);
    return r.id;
  };
  /** La papelera de la cabecera del panel (`borrarNodo`): una tarjeta simple se saca de la
   *  cadena; una condición o «Si responde» se lleva sus ramas, y el deshacer las devuelve. */
  const borrar = (id: string) => {
    fotoAntes();
    setPasos((prev) => renumerar(borrarNodo(prev, id)));
  };
  const nuevaRespuesta = (): string | null => {
    const r = crearRespuesta(pasos);
    if (r.pasos.length !== pasos.length) { fotoAntes(); setPasos(r.pasos); }
    return r.id;
  };

  /**
   * ⚠️ UN ERROR QUE FRENA PUBLICAR ABRE LA TARJETA CULPABLE (revisión, lienzo-6). El texto
   * sólo no alcanzaba: nombraba «Mensaje 4» y ninguna tarjeta lleva número. `vez` cambia en
   * cada pedido, así el mismo error dos veces la vuelve a abrir.
   */
  const [foco, setFoco] = useState<{ id: string; vez: number } | null>(null);
  /**
   * Lo que le falta a cada «⚡ Acción» según su formulario (el monto al mover a Ganado, el motivo de una
   * baja): lo frena `frenoDelFlujo` en Publicar y en Probar. Se pide sólo si hay una acción.
   */
  const faltanEnAccion = useFaltanEnAcciones(rolAdmin && pasos.some(esPasoAccion));
  const frenar = (mensaje: string, tarjeta: string | null) => {
    setErr(mensaje);
    if (tarjeta) setFoco((f) => ({ id: tarjeta, vez: (f?.vez ?? 0) + 1 }));
  };

  /**
   * PUBLICAR = VALIDAR, PATCH de los pasos y, si la secuencia se convirtió, la estrategia
   * con la LIMPIEZA.
   *
   * ⚠️ PRIMERO LOS PASOS. Si la limpieza fallara después, lo que queda es un flujo nuevo con
   * la estrategia vieja encima: el motor la ignora donde hay tarjetas («Si responde»
   * reemplaza al modo asistido) y lo demás repite un filtro que ya hace la tarjeta. Al
   * revés —limpiar primero y que fallen los pasos— la secuencia perdía su tope de
   * antigüedad con los pasos viejos puestos, o sea abría el acumulado entero.
   */
  const publicar = async () => {
    setErr(null);
    // La forma y lo que falta escribir, con la MISMA función que frena «Probar» (`frenoDelFlujo`).
    const freno = frenoDelFlujo(pasos, faltanEnAccion);
    if (freno) { frenar(freno.error, freno.tarjeta); return; }
    setBusy('save');
    try {
      const rp = await (await fetch('/api/whatsapp/secuencias', {
        method: 'PATCH', headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ id: secuencia.id, pasos }),
      })).json();
      // El server valida con la MISMA función y rechaza con su primer error, que trae ids.
      if (!rp.ok) {
        const e = rp.error ? String(rp.error) : '';
        frenar(e ? errorLegible(e, pasos) : 'No se pudo publicar.', e ? tarjetaDelError(e, pasos) : null);
        setBusy(null); return;
      }
    } catch { setErr('Sin conexión — prueba de nuevo.'); setBusy(null); return; }
    setPublicado(JSON.stringify(pasos));
    setVisto(JSON.stringify(pasos));
    if (convertida) {
      // ⚠️ SIN ESTRATEGIA NO SE MANDA NADA (revisión, lienzo-8): `estrategiaConLimpieza(null)`
      // es null, y antes inventaba `{ objetivo: 'agendar', … }` donde no había nada.
      const limpia = estrategiaConLimpieza(est);
      if (limpia) {
        const r = await api({ action: 'guardar-estrategia', secuenciaId: secuencia.id, estrategia: limpia });
        if (!r.ok) { setErr('Faltó limpiar lo de antes: publica otra vez.'); setBusy(null); onCambio(); return; }
      }
      setConvertida(false);
    }
    flashOk('Publicado ✓'); onCambio();
    setBusy(null);
  };

  /**
   * La primera vez que se prende «MaKo lo adapta», abre «Tu forma de escribir» (decisión
   * de Martín: «que ese tutorial se habilite la primera vez que se intente poner una tarjeta
   * de chat y activar la opción de "IA"»). El tipo del mensaje lo cambia el lienzo (es un
   * cambio local, con su deshacer); acá sólo se decide si abrir la guía.
   *
   * ⚠️ SE PREGUNTA POR LA GUÍA, NO POR EL TILDE DEL PASO (#745). El tilde se marca aunque no
   * se haya escrito ninguna guía. La regla vive en lib/chatbot-puerta.ts (`abrirGuiaVoz`).
   * Si la pregunta falla, NO se abre nada: la IA escribe igual con un registro neutro, y un
   * tutorial que salta por un error de red se lee como que la casilla hace otra cosa.
   */
  const abrirGuiaSiFalta = (on: boolean) => {
    if (!on || guiaOfrecida.enLaVisita) return;
    void (async () => {
      try {
        const j = await (await fetch('/api/chat-agent/onboarding?tab=setting', { cache: 'no-store' })).json();
        if (abrirGuiaVoz(j)) { guiaOfrecida.enLaVisita = true; setGuiaVoz(true); }
      } catch { /* sin red no se abre: ver arriba */ }
    })();
  };

  /**
   * LAS ETIQUETAS (GET /api/crm/etiquetas, lo hace la parte E): las usan el desplegable del
   * disparador («Se le puso «X»») y la fila «Tiene la etiqueta» de una condición. Sin
   * lista, las dos se dibujan igual con lo que hay puesto.
   *
   * ⚠️ CON LAS ARCHIVADAS (`?archivadas=1`, revisión costuras-11). Sin ellas, una condición o
   * un disparador que nombra una etiqueta archivada decía «Una etiqueta que ya no está» y el
   * dueño la reemplazaba creyendo que se había borrado. Las archivadas no se OFRECEN
   * (`seccionesDisparo` y el selector las filtran); sólo se nombran donde siguen puestas, con
   * «(archivada)» (`nombreEtiqueta`).
   *
   * ⚠️ ES LA LISTA COMPARTIDA (`useEtiquetasTodas`, segunda tanda), no una lectura propia: la
   * tarjeta 🏷️ y la condición crean etiquetas con el selector EXPORTADO («＋ Nueva»), que avisa
   * a todos los lectores. Con una lista propia, una etiqueta recién creada quedaba sin nombre en
   * su tarjeta hasta recargar.
   */
  const etiquetas: EtiquetaLienzo[] = useEtiquetasTodas() ?? [];

  /**
   * DE QUÉ NÚMERO SALE (pedido de Martín, 06/10/2026). Se guarda al elegir, como el
   * disparador. El selector sólo se dibuja con DOS líneas o más: con una, no hay nada que
   * elegir. El server valida la línea al guardar y al mandar.
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

  const toggle = async () => {
    setBusy('toggle'); setErr(null);
    try {
      const r = await (await fetch('/api/whatsapp/secuencias', { method: 'PATCH', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify({ id: secuencia.id, activa: !activa }) })).json();
      if (r.ok) {
        setActiva(!activa);
        // ⚠️ «Activada ✓» ES CIERTO SOBRE LA FILA Y FALSO SOBRE EL RESULTADO.
        // Prender una secuencia de WhatsApp con el número caído la deja en verde
        // sin que salga un solo mensaje: cada paso falla y se reprograma +24h,
        // para siempre y sin síntoma. El toggle SÍ hizo su trabajo, así que no se
        // falla — se dice qué falta.
        // Cuentan los MENSAJES: una acción, una espera o una condición corren con el
        // número caído (no son mensajes).
        const mensajes = pasos.filter((p) => esNodoMensaje(p));
        const soloWa = mensajes.length > 0 && mensajes.every((p) => p.canal === 'whatsapp');
        flashOk(
          !activa
            // El toast dice QUÉ pasó, corto (AGENTS.md, el texto que se dibuja): el porqué
            // —que con el número caído no sale nada— es este comentario.
            ? (caidaLaSec && soloWa ? 'Activada · WhatsApp desconectado' : 'Activada ✓')
            : 'Pausada ✓',
        );
        onCambio();
      } else setErr(r.error || 'No se pudo cambiar.');
    } catch { setErr('Sin conexión — prueba de nuevo.'); }
    setBusy(null);
  };

  // ── Lo que dice la tarjeta CRON y lo que ofrece su desplegable ──
  const todasLasEtapas = useMemo(() => productos.flatMap((p) => [...p.etapas, ...p.etapasEntrega]), [productos]);
  const nombreDelDisparo = {
    trigger_tipo: disparo.trigger_tipo, etapa: disparo.etapa,
    etiquetaTrigger: disparadores.find((d) => d.value === disparo.trigger_tipo)?.label ?? null,
    nombreEtapa: disparo.etapa ? (todasLasEtapas.find((e) => e.value === disparo.etapa)?.label ?? etiquetaEtapa(disparo.etapa)) : null,
    nombreEtiqueta: nombreEtiqueta(etiquetas, disparo.etiqueta_id),
  };
  const textoDisparo = detalleDisparador({ ...nombreDelDisparo, cron, tz });
  // Lo que está puesto y no está en la lista, dicho como es (sin el horario: esto es A QUIÉN). Un
  // disparador por EVENTO de antes cae acá: se muestra, ya no se ofrece (decisión 4).
  const textoActualDisparo = detalleDisparador({ ...nombreDelDisparo, cron: null });
  const secciones = pasosDisparo({ disparadores, productos, etiquetas, actual: disparo, textoActual: textoActualDisparo });
  /** Las etapas de VENTA de cada producto con embudo, para la fila «Está en la etapa». */
  const etapasCond: SeccionEtapas[] = productos.flatMap((pr) => (pr.funnelId == null || !pr.etapas.length ? [] : [{
    title: productos.length > 1 ? pr.nombre : 'Etapas', funnelId: pr.funnelId, options: pr.etapas,
  }]));

  // ── Lo que lee «Probar» ──
  // Sin estrategia, «Probar» prueba sin estrategia: la limpieza de null es null (lienzo-8).
  const estAPublicar = useMemo(() => (convertida ? ((estrategiaConLimpieza(est) ?? est) as unknown as SecuenciaDto['estrategia']) : est), [convertida, est]);

  /** Lo que «✦ guion» de una nota de voz necesita de la estrategia (revisión, costuras-4). */
  const paraGuion = useMemo(() => (est ? { objetivo: est.objetivo, gancho: est.gancho, preguntas: est.preguntas } : undefined), [est]);
  const pendientesOtraCosa = (handoffs ?? []).filter((h) => h.secuenciaId === secuencia.id).length;
  const cambioLocal = useRef(onCambioLocal);
  useEffect(() => { cambioLocal.current = onCambioLocal; });
  useEffect(() => {
    // En CADA cambio local, no al publicar: el panel de «Probar» prueba lo que se ve.
    cambioLocal.current?.({ secuenciaId: secuencia.id, pasos, estrategia: estAPublicar, nombre, trigger_tipo: disparo.trigger_tipo, instance_name: lineaSec });
  }, [secuencia.id, pasos, estAPublicar, nombre, disparo.trigger_tipo, lineaSec]);

  /** Dónde flotan la caja y la barra de «Crear con IA» (la franja de abajo; ver el render). */
  const franja = franjaIA(muelles, { izq: insetIzq, der: insetDer });

  /**
   * EL DESPLEGABLE DEL CRON, POR PASOS (tercera tanda, decisión 4): producto → «Adquisición de
   * clientes» / «Entrega del servicio» → la etapa (`pasosDisparo`, con `grupos` en el Dropdown).
   * El último paso dice sólo la etapa, así que el botón cerrado lo dice entero (`rotuloDisparo`).
   */
  const desplegableDisparo = (
    <Dropdown
      value={valorDisparo(disparo)} secciones={secciones} search width="100%"
      botonLabel={rotuloDisparo(secciones, valorDisparo(disparo), textoActualDisparo)}
      onChange={(v) => void guardarDisparo(v)} ariaLabel="Qué dispara esta automatización" disabled={busy != null}
    />
  );

  /**
   * «PROBAR» (tercera tanda, decisiones 13 y 14): se frena con lo mismo que Publicar
   * (`frenoDelFlujo`: `validarGrafo` + lo que falta escribir) y abre la tarjeta que falta, como las
   * tareas del curso; y es un desplegable WhatsApp / Email con sólo los canales que el flujo usa (con
   * uno solo, un botón). Quien monta abre el panel con ese canal (`onProbar(canal)`).
   */
  const canales = canalesParaProbar(pasos);
  const probar = (canal: CanalProbar) => {
    if (!onProbar) return;
    const freno = frenoDelFlujo(pasos, faltanEnAccion);
    if (freno) { frenar(freno.error, freno.tarjeta); return; }
    setErr(null);
    onProbar(canal);
  };
  const estiloProbar: CSSProperties = { ...tarjetaChrome, fontSize: 12.5, fontWeight: 600, color: 'var(--dim)', cursor: 'pointer', fontFamily: 'inherit' };

  /**
   * ⚠️ EL LIENZO ES LA PANTALLA. No hay barra, ni cabecera, ni pie: el título, el
   * interruptor, «Probar», el deshacer y «Publicar» FLOTAN encima, que es exactamente
   * cómo quedó el editor de /mensajes.
   */
  return (
    // `flex: 1` + `minHeight: 0`, NO `height: 100%`: el padre saca su alto de un flex y
    // para el motor eso es un alto INDEFINIDO — Chrome lo resuelve igual y Safari
    // devuelve CERO, o sea la pantalla en blanco (AGENTS.md, ya pagado con un cliente).
    <div style={{ flex: 1, minHeight: 0, width: '100%', display: 'flex', flexDirection: 'column', minWidth: 0, position: 'relative' }}>
      {/* «Crear con IA»: con la automatización VACÍA, la caja del pedido (como el «Create with AI»
          de ManyChat), y con tarjetas, la barra «Pídele un cambio». Empezar de cero sigue siendo el
          ＋ del CRON.

          ⚠️ LAS DOS VAN EN LA FRANJA DE ABAJO (`franjaIA`, lib/crear-ia-lugar.ts), entre la lista y
          lo que tapa la derecha, y la capa NO toma el puntero: sólo lo toma la pieza, que mide lo
          mismo que lo que dibuja (revisión de la segunda tanda, 09/10/2026). La caja era `inset: 0`
          centrada en el ancho total: tapaba la lista en ventanas angostas, parte de «Probar» y la
          tarjeta CRON ENTERA, que el encuadre centra justo ahí. Ahora el lienzo encuadra el CRON
          ARRIBA de la caja (`reservaAbajo`). Y la barra medía 560 con 460 dibujados: los 100 px de
          aire se comían los clics de lo de abajo.

          ⚠️ CON UNA TARJETA ABIERTA SE ESCONDEN, SIN DESMONTARSE: el panel del nodo abre en esa
          misma franja y quedaban encima de sus botones (el emoji y el 🔗 del editor tipo Gmail).
          Desmontar `CrearConIA` cortaría un pedido en vuelo de hasta un minuto. */}
      {rolAdmin && pasos.length === 0 && (
        <div data-crear-ia="crear" style={{ position: 'absolute', ...franja, display: tarjetaAbierta ? 'none' : 'flex', justifyContent: 'center', pointerEvents: 'none', zIndex: 4 }}>
          <div style={{ pointerEvents: 'auto', width: `min(${CAJA_IA_ANCHO}px, 100%)` }}>
            <CrearConIA modo="crear" secuenciaId={secuencia.id} pedidoInicial={pedidoIA} onListo={alListoIA} />
          </div>
        </div>
      )}
      {rolAdmin && editandoIA && pasos.length > 0 && (
        <div data-crear-ia="editar" style={{ position: 'absolute', ...franja, display: tarjetaAbierta ? 'none' : 'flex', justifyContent: 'center', pointerEvents: 'none', zIndex: 4 }}>
          <div style={{ pointerEvents: 'auto', width: `min(${BARRA_IA_ANCHO}px, 100%)` }}>
            <CrearConIA modo="editar" secuenciaId={secuencia.id} pasos={pasos} onListo={alListoIA} />
          </div>
        </div>
      )}
      <FlujoLienzo
        pasos={pasos}
        disparador={textoDisparo}
        secuencias={secuencias.filter((s) => s.id !== secuencia.id).map((s) => ({ id: s.id, nombre: s.nombre }))}
        audios={audios} negocio={negocio} rolAdmin={rolAdmin} busy={busy != null}
        envioAutoSecuencia={est?.envio_automatico === true}
        etiquetas={etiquetas} etapas={etapasCond} triggerTipo={disparo.trigger_tipo} productos={productos}
        paraGuion={paraGuion} foco={foco} pendientesOtraCosa={pendientesOtraCosa}
        onPasos={onPasos}
        onAgregar={rolAdmin ? agregarEn : undefined}
        onBorrar={rolAdmin ? borrar : undefined}
        onCrearRespuesta={rolAdmin ? nuevaRespuesta : undefined}
        onAudioNuevo={onAudioNuevo} onError={setErr}
        onModoIA={rolAdmin ? abrirGuiaSiFalta : undefined}
        insetIzq={insetIzq} insetDer={insetDer} muelles={muelles} revelar={revelarIA ?? revelar}
        onTarjetaAbierta={setTarjetaAbierta}
        reservaAbajo={rolAdmin && pasos.length === 0 ? RESERVA_ABAJO_CREAR : 0}
        chrome={(
          <div style={{ display: 'flex', alignItems: 'flex-start', gap: 10, width: '100%' }}>
            {/* El ancho es FIJO por lo mismo que en /mensajes: en modo edición el
                contenido es un `<input>`, que NO mide su texto —mide `size` por el
                avance del «0» de la fuente— así que con `maxWidth` la tarjeta encoge al
                hacer click. Con el ancho puesto, los dos estados miden lo mismo. */}
            <div style={{ ...tarjetaChrome, minWidth: 0, width: 400, display: 'flex', alignItems: 'center', gap: 8 }}>
              {/* EL EMOJI SE TOCA Y SE CAMBIA (tercera tanda, decisión 8; pedido literal: «No puedo
                  editar el emoji del título, y si debería... Dejame poner cualquier emoji, ya tenemos
                  un desplegable al respecto»). El selector es el de la casa (el de los proyectos del
                  Plan). Sin emoji guardado, el de su objetivo, como siempre. */}
              {rolAdmin
                ? <EmojiPickerMini value={emojiVisto} onPick={(e) => void guardarEmoji(e)} />
                : <span style={{ flex: 'none', fontSize: 18, lineHeight: 1 }}>{emojiVisto}</span>}
              <div style={{ minWidth: 0, flex: 1 }}>
                {/* El nombre se cambia HACIENDO CLICK EN ÉL, como en el resto de la
                    casa: un lápiz al lado es un segundo control para la misma acción. */}
                {editandoNombre ? (
                  <input
                    autoFocus value={nombre} maxLength={NOMBRE_MAX} onChange={(e) => setNombre(e.target.value)}
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

            {/* «Activar» en su propia tarjeta, a la derecha del título: adentro de la del
                título la hace de dos renglones y aprieta el nombre. */}
            <div style={{ ...tarjetaChrome, flex: 'none', display: 'inline-flex', alignItems: 'center', gap: 8 }}>
              <span style={{ fontSize: 12, fontWeight: 600, color: activa ? 'var(--good)' : 'var(--dim)' }}>Activar</span>
              <button onClick={toggle} disabled={!rolAdmin || busy === 'toggle'} aria-pressed={activa} title={activa ? 'Pausar' : 'Activar'}
                style={{ width: 38, height: 22, borderRadius: 999, border: 'none', padding: 2, background: activa ? 'var(--good)' : 'var(--border-strong)', cursor: rolAdmin ? 'pointer' : 'default', flex: 'none', transition: 'background .15s' }}>
                <span style={{ display: 'block', width: 18, height: 18, borderRadius: '50%', background: '#fff', transform: activa ? 'translateX(16px)' : 'none', transition: 'transform .15s' }} />
              </button>
            </div>

            {/* ⚠️ «PROBAR» A LA DERECHA DEL TODO, separado de Activar (punto 10: «el botón de
                probar debería estar a la derecha del todo, no pegado a "Activar"»). El
                `marginLeft: auto` lo empuja contra el borde derecho del chrome, que ya
                descuenta el panel de «Probar» abierto (`insetDer`). */}
            {onProbar && (
              <div style={{ marginLeft: 'auto', flex: 'none' }}>
                {canales.length > 1 ? (
                  <Dropdown value="" resetAfterSelect sinFlecha={false} botonLabel="▶ Probar" ariaLabel="Probar esta automatización"
                    options={canales.map((c) => ({ value: c, label: c === 'email' ? 'Email' : 'WhatsApp' }))}
                    buttonStyle={estiloProbar} onChange={(v) => v && probar(v === 'email' ? 'email' : 'whatsapp')} />
                ) : (
                  <button onClick={() => probar(canales[0])} title="Probar esta automatización" style={estiloProbar}>▶ Probar</button>
                )}
              </div>
            )}
          </div>
        )}
        herramientas={rolAdmin ? (
          <div style={{ display: 'inline-flex', alignItems: 'center', gap: 6 }}>
            <BotonPila titulo="Deshacer (Ctrl+Z)" onClick={deshacer} activo={puedeDeshacer}>↶</BotonPila>
            <BotonPila titulo="Rehacer (Ctrl+Y)" onClick={rehacer} activo={puedeRehacer}>↷</BotonPila>
            {pasos.length > 0 && (
              <BotonPila titulo="Pedirle un cambio a MaKo" onClick={() => setEditandoIA((v) => !v)} activo>✦</BotonPila>
            )}
          </div>
        ) : undefined}
        pie={rolAdmin ? (
          <div style={{ display: 'inline-flex', alignItems: 'center', gap: 10 }}>
            {/* El error va ACÁ, pegado al botón que lo produce: abajo del lienzo y a la
                izquierda nacía debajo de la lista de secuencias, que flota encima. */}
            {err ? (
              <span role="alert" title={avisosIA && avisosIA.texto === err ? avisosIA.todos.join('\n') : undefined} style={{ ...tarjetaChrome, maxWidth: 380, fontSize: 12.5, color: 'var(--bad)', borderColor: 'var(--bad)', lineHeight: 1.4 }}>{err}</span>
            ) : flash ? (
              <span style={{ ...tarjetaChrome, fontSize: 12.5, fontWeight: 600, color: 'var(--good)' }}>{flash}</span>
            ) : null}
            {/* ⚠️ «PUBLICAR», NO «GUARDAR»: es el mismo verbo que en /mensajes y dice lo
                que pasa: lo que está en el lienzo pasa a ser lo que MaKo manda.

                ⚠️ Y SIN EL CARTEL «Sin publicar» (tercera tanda, decisión 15; pedido literal: «se
                sobre entiende que si se puede apretar, es porque hay cambios sin publicar»): el botón
                está APAGADO cuando no hay nada que publicar. Una secuencia de antes que abre
                convertida a tarjetas cuenta como cambio (`sinPublicar`): publicarla es lo que la
                convierte, y lo que cambió se lee al pasar el cursor. */}
            <button onClick={() => void publicar()} disabled={busy === 'save' || !sinPublicar}
              title={sinPublicar && convertida && inicial.notas.length ? inicial.notas.join(' · ') : undefined}
              style={{ padding: '9px 18px', borderRadius: 9, border: 'none', background: 'var(--primary)', color: '#fff', fontSize: 13, fontWeight: 600, cursor: sinPublicar ? 'pointer' : 'default', opacity: busy === 'save' || !sinPublicar ? 0.45 : 1, fontFamily: 'inherit' }}>
              {busy === 'save' ? 'Publicando…' : 'Publicar'}
            </button>
          </div>
        ) : undefined}
        editorEntrada={(
          /**
           * LA TARJETA CRON, SIN RÓTULOS (punto 5: «Elimina los títulos de Cuando y Que...
           * Deja solo la flecha, sin aclarar nada»). Se fueron «Cuándo se dispara», «Qué lo
           * dispara», «A quién», «Sale por», «Solo a leads recientes» y «Sale sola». Queda:
           * la línea (si hay más de una), la ← para volver a elegir entre tiempo y acción, y
           * al lado lo elegido — el desplegable de disparadores o el horario.
           */
          <div>
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
                <div style={{ marginBottom: 10 }}>
                  {rolAdmin ? (
                    <Dropdown
                      value={lineaSec && lineaSec !== porDefault.linea ? lineaSec : ''}
                      options={opciones}
                      onChange={(v) => void guardarLinea(v || null)}
                      ariaLabel="Número de WhatsApp por el que sale esta automatización"
                      width="100%"
                    />
                  ) : (
                    <div style={{ fontSize: 12.5, color: 'var(--ink)' }}>{opciones.find((o) => o.value === (lineaSec ?? ''))?.label ?? porDefault.rotulo}</div>
                  )}
                  {caidaLaSec && <div style={{ fontSize: 11.5, color: 'var(--warn)', marginTop: 5 }}>Número desconectado</div>}
                </div>
              );
            })()}
            {rolAdmin ? (
              <>
                <SelectorDisparo
                  modo={eligiendo ? null : (cron ? 'tiempo' : 'accion')}
                  disabled={busy != null}
                  onModo={(m) => {
                    if (m === null) { setEligiendo(true); return; }
                    // Elegir uno APAGA el otro, y es una ESCRITURA y no un `disabled`: dejar
                    // el horario puesto y sólo grisarlo dejaría una secuencia que el motor
                    // sigue disparando por tiempo con la pantalla diciendo otra cosa.
                    if (m === 'tiempo' && !cron) { void guardarCron(CRON_DEFAULT); return; }
                    if (m === 'accion' && cron) { void guardarCron(null); return; }
                    setEligiendo(false);
                  }}
                  junto={cron
                    ? <EditorCron cron={cron} tz={tz} disabled={busy != null} onCron={(c) => void guardarCron(c)} />
                    : desplegableDisparo}
                />
                {/* ⚠️ CON HORARIO, EL DESPLEGABLE SIGUE: el horario dice CUÁNDO y esto dice A
                    QUIÉN. Un horario sin cohorte no inscribiría a nadie, y eso se leería como
                    que el agendado no funciona. */}
                {cron && !eligiendo && desplegableDisparo}
              </>
            ) : (
              <div style={{ fontSize: 12.5, color: 'var(--ink)', lineHeight: 1.5 }}>{textoDisparo}</div>
            )}
          </div>
        )}
      />
      {/* «Tu forma de escribir», encima de todo. Al `body` porque el lienzo vive adentro
          de contenedores con `transform` y `overflow`, y un `position: fixed` nacido ahí
          adentro se dibuja recortado o debajo (AGENTS.md: un sticky con z-index le
          clampea el z-index a lo que nace adentro). */}
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
