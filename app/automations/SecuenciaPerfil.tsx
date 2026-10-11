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

import { useCallback, useEffect, useMemo, useRef, useState, type CSSProperties } from 'react';
import { createPortal } from 'react-dom';
import dynamic from 'next/dynamic';
import { usePilaDeshacer } from '@/app/_ui/usePilaDeshacer';
// LOS CRON (sexta tanda: varios por automatización, y la primera pantalla con Producto / Recurrente /
// Etiqueta / Instagram / Messenger / Email). El panel, su estado y lo que dice cada uno viven allá.
import { EditorDisparadores, useDisparadores, useTextoDisparador, type SecuenciaConDisparadores } from './EditorDisparadores';
import { disparoActualDe, iconoDeDisparador, esDelEmisor, EVENTOS_MAKO, TRIGGER_AVISO_MAKO } from '@/lib/disparadores';
import { frenoDelEvento } from '@/lib/aviso-evento';
import type { AudioSetting, SecuenciaDto, Opcion, PasoSecuenciaDto, ProductoOpcion } from './ChatAgentApp';
import { FlujoLienzo, type CambioPasos, type EtiquetaLienzo, type SeccionEtapas } from './FlujoLienzo';
import { usePosicionesLienzo } from './usePosicionesLienzo';
import { useBorradorSecuencia, ERROR_DESACTUALIZADO } from './useBorradorSecuencia';
import { Dropdown } from '@/app/components/Dropdown';
import { useEtiquetasTodas, avisarCambioEtiquetas } from '@/app/_components/etiquetas-cliente';
import { CrearConIA, type ListoCrearIA } from './CrearConIA';
import { BotonPila } from './BotonPila';
import { TRIGGER_RECORDATORIO, frenoDelRecordatorio } from '@/lib/recordatorio-automatizacion';
import { CANALES_PROBAR, type CanalProbar } from './PanelProbar';
import { useFaltanEnAcciones } from '@/app/_components/EditorAccionMako';
import { esPasoAccion } from '@/lib/nutricion-paso-accion';
import { franjaIA, BARRA_IA_ANCHO } from '@/lib/crear-ia-lugar';
import { resumenAvisos, edicionVigente } from '@/lib/flujo-ia-cliente';
import type { Objetivo } from '@/lib/setting-estrategia';
import { normalizar, esNodoMensaje, separarPasosIA } from '@/lib/flujo-grafo';
import { eliminar } from '@/lib/flujo-edicion';
import { MakoLogo } from '@/app/_components/MakoBrand';
import type { Muelles } from '@/lib/lienzo-grafo';
import { abrirFlujo } from '@/lib/flujo-legado';
import {
  insertarDesdeLienzo, renumerar, errorLegible, tarjetaDelError, estrategiaConLimpieza,
  disparoDeValor, canalesParaProbar, frenoDelFlujo,
  type QueAgregar,
} from '@/lib/flujo-conversacion';
import { EmojiPickerMini } from '@/app/plan/board/EmojiPicker';
import { abrirGuiaVoz } from '@/lib/chatbot-puerta';
// Un medio sin conectar frena Publicar (409) y Activar (décima tanda, GENERAL 6): el modal de la tab lo conecta ahí mismo.
import { ConectarMedio } from './ConectarMedio';
import { medioDelError, type Medio } from '@/lib/medios-automatizacion';

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
/** El alto de «Probar», «Activar» y «Publicar» (10/10/2026: «más grandes»). */
const ALTO_ACCION = 44;

const tarjetaChrome: CSSProperties = {
  background: 'var(--surface)', border: '1px solid var(--border)', borderRadius: 11,
  padding: '7px 12px', boxShadow: '0 2px 8px rgba(0,0,0,.06)',
};

/**
 * EL BOTÓN DE «PEDIRLE UN CAMBIO A MaKo», AL LADO DEL TÍTULO: ES EL LOGO (décima tanda, general 1, 11/10/2026:
 * «El botón de IA que está al lado del título debe ser del mismo tamaño del recuadro del título y estar
 * alineado... Y que sea el logo de MaKo, que es una estrella en el centro, sin la estrella chiquita arriba»).
 *
 * `MakoLogo` dibuja el recuadro negro con la chispa dorada SOLA y centrada; el `BotonMako` de la casa
 * (app/_ui/BotonMako.tsx) lleva `MakoStar`, que suma el punto chico arriba a la derecha. El lado es el alto
 * del título (`ALTO_ACCION`), así los dos miden lo mismo en la misma fila. Encendido (la barra abierta), el
 * aro dorado de siempre, con el radio del logo (13 de 48).
 */
export function BotonLogoMako({ onClick, title, encendido = false, lado }: { onClick: () => void; title: string; encendido?: boolean; lado: number }) {
  return (
    <button type="button" data-no-pan data-boton-logo-mako onClick={onClick} aria-pressed={encendido} title={title} aria-label={title}
      style={{
        flex: 'none', width: lado, height: lado, padding: 0, border: 'none', background: 'transparent', cursor: 'pointer',
        display: 'inline-flex', alignItems: 'center', justifyContent: 'center', boxSizing: 'border-box',
        borderRadius: Math.round((lado * 13) / 48), boxShadow: encendido ? '0 0 0 2px var(--mako)' : '0 1px 2px rgba(0,0,0,.18)',
      }}>
      <MakoLogo size={lado} animate={false} />
    </button>
  );
}

/**
 * «Tu forma de escribir» se ofrece UNA vez por visita: quien la cierra sin escribir guía no
 * la ve en cada casilla. Vive en el MÓDULO y no en un ref: el perfil se remonta al cambiar de
 * secuencia, y un ref la volvía a ofrecer en cada una (revisión del 06/10/2026). Con un F5 se
 * vuelve a ofrecer, que es lo que «una vez por visita» quiere decir.
 */
const guiaOfrecida = { enLaVisita: false };

/** La edición en curso de una automatización, tal como la ve el lienzo. */
export type EdicionLocal = {
  secuenciaId: number;
  pasos: PasoSecuenciaDto[];
  estrategia: SecuenciaDto['estrategia'];
  nombre: string;
  trigger_tipo: string;
  instance_name: string | null;
  /**
   * LO QUE FRENA «PROBAR» SOBRE ESTOS PASOS (séptima tanda): `frenoDelFlujo`, la MISMA función que frena
   * Publicar y el botón «Probar», con lo que le falta a cada acción. null = se puede probar. Viaja acá
   * porque el panel REARRANCA la prueba (↻, «Cambió · ↻», «Probar en WhatsApp») sobre lo que se edita
   * con el panel abierto, y hasta acá no lo miraba: desconectar una tarjeta con «Probar» abierto y
   * apretar ↻ corría —y mandaba de verdad— un flujo con una tarjeta suelta.
   */
  freno: FrenoDelFlujo | null;
  /** Muestra el freno donde lo muestra Publicar y abre la tarjeta que falta. Identidad fija. */
  frenar: (f: FrenoDelFlujo) => void;
};

/** Lo que devuelve `frenoDelFlujo`: el error legible y la tarjeta a abrir. */
export type FrenoDelFlujo = NonNullable<ReturnType<typeof frenoDelFlujo>>;

export function SecuenciaPerfil({ secuencia, etiquetaEtapa, rolAdmin, audios, negocio, canalCaido, tz, insetIzq, onAudioNuevo, secuencias, productos, disparadores, onProbar, probarAbierto = false, onCerrarProbar, onCambio, onCambioLocal, insetDer, handoffs, muelles, revelar, onSinPublicar, descartarBorrador, onAccionTodo }: {
  // (Acá iban `arranque` y `onArranqueUsado`: la recién creada con un tipo de CRON elegido en «¿Qué la dispara?» del
  // modal abría su CRON en ese tipo. Se fueron con esos botones en la décima tanda, 11/10/2026.)
  /** Lo de la AUTOMATIZACIÓN ENTERA desde el click derecho del CRON (copiar, duplicar, eliminar): lo hace la lista. */
  onAccionTodo?: (accion: 'copiar' | 'duplicar' | 'eliminar') => void;
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
  /** «Probar» está abierto: el botón del chrome se vuelve «Cerrar» en el mismo lugar (cuarta tanda, punto 3). */
  probarAbierto?: boolean;
  onCerrarProbar?: () => void;
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
  /**
   * Lo llena este componente con «descartar lo no publicado» (lo pendiente no sale y el borrador se
   * borra). Lo llama la tab ANTES de cambiar de automatización cuando la persona elige «Descartar
   * cambios»: sin esto, el desmonte lo guardaba como borrador.
   */
  descartarBorrador?: { current: (() => void) | null };
  // (Acá vivía `pedidoIA`, el pedido que «Armar una» del pie de la lista le dejaba a «Crear con IA».
  // Salió el 10/10/2026 con el pie: era de una versión anterior.)
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
   *
   * ⚠️ SEXTA TANDA, SEGUNDA PASADA: ABRE CON `abrirFlujo` (lib/flujo-legado.ts), que hace las dos
   * cosas: la lista de antes convertida (`legadoAGrafo`; un flujo, tal cual) y SIN «Ir a» (`quitarIrA`,
   * punto 12: «"Go to" desaparece directamente»: a una tarjeta de acá, una flecha; a otra
   * automatización, se saca). Y la estrategia se limpia SÓLO si se convirtió una lista de antes
   * (`limpiarEstrategia`): sacar un «Ir a» de un flujo de tarjetas no toca la estrategia, y limpiarla
   * apagaría lo que el motor todavía hace por su lado (el tope de antigüedad al inscribir, por ejemplo).
   *
   * ⚠️ Y SI HAY UN BORRADOR (`secuencia.borrador`, mig 0240), se abre ESE: lo que la persona dejó a
   * medio armar sobre lo publicado de hoy (lib/secuencia-borrador.ts, `borradorVigente`).
   */
  const [inicial] = useState(() => {
    const ordenados = [...secuencia.pasos].sort((a, b) => (a.orden ?? 0) - (b.orden ?? 0));
    const r = abrirFlujo(ordenados, est, {
      idDeClave: (clave) => secuencias.find((s) => s.clave === clave)?.id ?? null,
      nombreDeSecuencia: (id) => secuencias.find((s) => s.id === id)?.nombre ?? null,
    });
    // Un borrador de antes del AI Step v2 también se abre con una tarjeta por caso (`separarPasosIA`, como `abrirFlujo`).
    const borrador = secuencia.borrador?.pasos?.length ? renumerar(normalizar(separarPasosIA(normalizar(secuencia.borrador.pasos)).pasos)) : null;
    // `abierto`: lo publicado tal como el lienzo lo abriría sin borrador («Descartar cambios» vuelve ahí).
    const abierto = renumerar(r.pasos);
    return { ...r, pasos: borrador ?? abierto, abierto, publicado: JSON.stringify(renumerar(normalizar(ordenados))) };
  });
  const [pasos, setPasos] = useState<PasoSecuenciaDto[]>(inicial.pasos);
  const [convertida, setConvertida] = useState(inicial.convertida);
  /** Publicar limpia la estrategia sólo si se convirtió una lista de antes (ver arriba). */
  const [limpiar, setLimpiar] = useState(inicial.limpiarEstrategia);
  const [publicado, setPublicado] = useState(inicial.publicado);
  const sinPublicar = convertida || JSON.stringify(pasos) !== publicado;

  /**
   * LO QUE LA PERSONA CAMBIÓ Y NO PUBLICÓ (decisión 15): el flujo de ahora contra el que vio al
   * abrir, al publicar por última vez o el último que quedó guardado como BORRADOR (segunda pasada de
   * la sexta tanda: guardado, salir no pierde nada). NO es `sinPublicar`: una secuencia de antes abre
   * CONVERTIDA (el lienzo la muestra en tarjetas) y eso dice «Sin publicar» sin que nadie haya
   * tocado nada. Preguntar «Tienes cambios sin publicar» ahí sería afirmar algo falso, y salir no
   * pierde nada: la conversión se vuelve a hacer al abrirla.
   */
  const [visto, setVisto] = useState(() => JSON.stringify(inicial.pasos));
  /**
   * LO PUBLICADO, TAL COMO EL LIENZO LO ABRE (`inicial.abierto` al montar; lo que se publicó, después). Es a lo
   * que vuelve «Descartar cambios» (`descartarCambios`). Hasta la décima tanda era `deBorrador`, que encendía el
   * botón «Volver a lo publicado» al lado de «Activar»; Martín lo sacó (general 5, 11/10/2026: «Elimina el botón
   * de "Volver a lo publicado"... para eso ya tenemos el CTRL Z... Y en todo caso, en los 3 puntitos de la
   * sidebar, a los que tienen cambios sin guardar, que aparezca la opción "Descartar cambios"»). El «⋯» de la
   * lista llama a esto por la ref `descartarBorrador` (app/automations/SimuladorWhatsApp.tsx).
   */
  const [abiertoPublicado, setAbiertoPublicado] = useState<PasoSecuenciaDto[]>(inicial.abierto);

  /**
   * EL BORRADOR (sexta tanda, punto 7; mig 0240, lib/secuencia-borrador.ts): cada cambio del flujo se
   * guarda solo, con un respiro, en su propia columna —nunca en `pasos`: el motor no lo lee, así una
   * tarjeta suelta no corre—. Sólo si el GET lo pudo leer (`secuencia.borrador` presente, aunque sea
   * null): si no, guardarlo pisaría uno que la pantalla no vio. Lo guardado pasa a ser lo «visto»:
   * desde ahí salir no pierde nada, y la tab deja de preguntar.
   */
  //
  // ⚠️ CON LA BASE DE LO QUE ESTA PESTAÑA ABRIÓ (`secuencia.base`, revisión del 10/10/2026): si mientras
  // tanto se publicó otra cosa, el server no lo guarda y el error lo dice (useBorradorSecuencia.ts). Y al
  // irse, si algo cambió en el server, se relee la lista (`onSalir`): volver acá en la misma visita abría
  // lo que trajo el GET de la entrada.
  const borrador = useBorradorSecuencia(secuencia.id, {
    puedeGuardar: rolAdmin && secuencia.borrador !== undefined,
    inicial: inicial.pasos,
    base: secuencia.base,
    onGuardado: (json) => setVisto(json),
    onError: (m) => setErr(m),
    onSalir: () => onCambio(),
  });
  // `borrador` lee refs: lo único que cambia algo es el flujo.
  // eslint-disable-next-line react-hooks/exhaustive-deps
  useEffect(() => { borrador.cambio(pasos); }, [pasos]);
  /**
   * «DESCARTAR CAMBIOS» DE LA TAB (revisión del 10/10/2026): la pregunta «Tienes cambios sin publicar» vive
   * en SimuladorWhatsApp, y cambiar de automatización DESMONTA este lienzo, cuyo desmonte despacha lo que
   * esperaba su respiro. O sea que «Descartar» lo GUARDABA como borrador, y al volver se abría lo que se
   * había descartado. Quien pregunta llama a esto ANTES de cambiar: lo pendiente no sale y el borrador se
   * borra (la lista se relee sola al irse: `onSalir`).
   *
   * ⚠️ DESDE LA DÉCIMA TANDA ES TAMBIÉN «DESCARTAR CAMBIOS» DEL «⋯» DE LA LISTA SOBRE LA QUE ESTÁ ABIERTA (general
   * 5), que no se va: el lienzo vuelve a lo publicado (`descartarCambios`, con su foto: Ctrl+Z lo devuelve) y el
   * borrador se borra. Por una ref (`descartarRef`): el efecto corre una vez y la función cambia en cada render.
   */
  const descartarRef = useRef<() => void>(() => { void borrador.descartar(); });
  useEffect(() => {
    if (!descartarBorrador) return;
    descartarBorrador.current = () => descartarRef.current();
    return () => { descartarBorrador.current = null; };
    // La función de verdad la lee de la ref en el momento del clic.
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [descartarBorrador]);

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
   * LOS CRON DE LA AUTOMATIZACIÓN (sexta tanda, CRON punto 10: «agrega la opción de tener más de un
   * CRON»). La lista —optimista, guardada UNA vez por respiro y vuelta a sembrar cuando el server la
   * cambia sin un guardado en camino— vive en `useDisparadores` (app/automations/EditorDisparadores.tsx),
   * y el panel en `EditorDisparadores`. Reemplaza al par «Por tiempo» / «Por una acción» (CRON punto
   * 2): el horario es de un CRON «Recurrente», no de la automatización.
   *
   * `disparo` es el PRIMERO en la forma de siempre: lo leen «Probar» (`trigger_tipo`), el catálogo de
   * las condiciones (`triggerTipo` del lienzo) y «Crear con IA». `setErr` va en una flecha: se declara
   * más abajo, y pasarlo pelado acá sería leerlo antes de que exista.
   */
  const crons = useDisparadores(secuencia as SecuenciaConDisparadores, { onCambio, onError: (m) => setErr(m) });
  const disparo = disparoActualDe(crons.primero);
  /** El CRON abierto en el panel: su id, 'nuevo' (el «＋ Nuevo CRON» de la tarjeta) o null (el primero). */
  const [cronAbierto, setCronAbierto] = useState<string | 'nuevo' | null>(null);

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
  /**
   * EL MEDIO QUE FRENÓ PUBLICAR O ACTIVAR (décima tanda, GENERAL 6: «no dejar publicarlo hasta que no lo
   * configure. Y esas configuraciones siempre allí mismo»). El server contesta 409 con el `medio` al publicar,
   * y «No se activó: Conecta tu …» al activar (`medioDelError`): las dos abren el mismo modal (ConectarMedio).
   */
  const [conectarMedio, setConectarMedio] = useState<Medio | null>(null);
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
      setLimpiar(false);
      // Ya lo guardó el server (publicado y pausado): no es un borrador, y lo publicado cambió. Como en
      // Publicar: el borrador de antes se borra y la base pasa a ser ésta (sin eso, el próximo cambio se
      // rechazaba con «Cambió lo publicado»). Un rechazo que llegó mientras la IA trabajaba ya no vale.
      void borrador.publicado(nuevos);
      setAbiertoPublicado(nuevos);
      setErr((e) => (e === ERROR_DESACTUALIZADO ? null : e));
      if (r.nombre) setNombre(r.nombre);
      // El disparador que quedó puesto (revisión, 09/10/2026): `disparo` se siembra al montar, y sin
      // esto la tarjeta CRON seguía diciendo el de antes («manual») hasta recargar.
      // Con varios CRON (sexta tanda), la IA pone el PRIMERO: los demás siguen como estaban.
      const puesto = r.disparador;
      if (puesto) crons.sembrarPrimero(disparoDeValor(puesto, disparo));
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
  /**
   * ELIMINAR UNA TARJETA (la papelera del panel y el click derecho): se va ELLA y lo que colgaba queda
   * SUELTO, nunca se borra (sexta tanda, punto 7: «Que se elimine una flecha no significa que se elimine
   * la tarjeta posterior, sino que queda "flotando"»). Hasta acá era `borrarNodo`, que reconectaba la
   * cadena y se llevaba las ramas de una condición. El deshacer lo devuelve todo.
   */
  const borrar = (id: string) => {
    const r = eliminar(pasos, id);
    if (!r.ok) { setErr(r.motivo); return; }
    fotoAntes();
    setPasos(renumerar(r.pasos));
  };
  // (Acá vivía `nuevaRespuesta`, el ＋ de la fila «Si responde» del CRON. Se fue con la fila: «Si
  // responde» nace de una CONDITION vacía, en su editor.)

  /**
   * «DESCARTAR CAMBIOS» (era «Volver a lo publicado», el botón al lado de «Activar»; décima tanda, general 5: ahora
   * vive en el «⋯» de la lista, sólo en las que tienen cambios sin publicar): el lienzo vuelve a lo publicado
   * (`abiertoPublicado`) y el borrador se borra en el server (después de lo que esté en vuelo, para que un
   * guardado lento no lo resucite). Con su foto: Ctrl+Z devuelve el borrador, que se vuelve a guardar solo. Al
   * terminar se relee la lista, o volver a esta automatización en la misma visita abría el borrador que trajo el
   * GET de la entrada. Si la tab está por irse (la pregunta de cambiar de automatización), lo mismo: el lienzo se
   * desmonta enseguida y lo que importa es que el borrador se borre.
   */
  const descartarCambios = () => {
    fotoAntes();
    setPasos(abiertoPublicado);
    setVisto(JSON.stringify(abiertoPublicado));
    // Un «Cambió lo publicado» se queda: lo que se abrió tampoco es lo de hoy, y sigue sin guardarse.
    setErr((e) => (e === ERROR_DESACTUALIZADO ? e : null));
    void borrador.descartar().then(() => onCambio());
    borrador.yaGuardado(abiertoPublicado);
  };
  useEffect(() => { descartarRef.current = descartarCambios; });

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
  /**
   * EL FRENO DE ESTA AUTOMATIZACIÓN: el de Publicar (`frenoDelFlujo`) y, con el CRON del recordatorio de la
   * reunión, lo que su emisor sabe mandar (`frenoDelRecordatorio`, lib/recordatorio-automatizacion.ts). Lo usan
   * Publicar, «Probar» y sus rearranques (`EdicionLocal.freno`): los tres frenan lo mismo que el server.
   *
   * Con el CRON «Evento de MaKo» (11/10/2026, «MaKo en WhatsApp»), lo que el emisor de ESE evento sabe correr
   * (`frenoDelEvento`, lib/aviso-evento.ts): sólo tarjetas MaKo, DELAY por tiempo y CONDITION de una rama —
   * nada al lead—. Es la misma función con la que frena el server (`setSecuenciaPasos`).
   */
  const esRecordatorio = disparo.trigger_tipo === TRIGGER_RECORDATORIO;
  const esEvento = disparo.trigger_tipo === TRIGGER_AVISO_MAKO;
  /** CUÁL evento (el `subtipo` de su CRON), sólo si es uno que existe. null = una automatización de las de siempre. */
  const eventoMako = esEvento ? (EVENTOS_MAKO.find((e) => e.subtipo === crons.primero?.subtipo)?.subtipo ?? null) : null;
  const frenoDeEsta = useCallback(
    (ps: typeof pasos) => frenoDelFlujo(ps, faltanEnAccion)
      ?? (esRecordatorio ? frenoDelRecordatorio(ps) : esEvento ? frenoDelEvento(ps, eventoMako) : null),
    [faltanEnAccion, esRecordatorio, esEvento, eventoMako],
  );
  // Identidad FIJA (sólo usa setters): viaja en `EdicionLocal` y un `frenar` nuevo por render
  // re-dispararía el efecto que la manda en cada tecla.
  const frenar = useCallback((mensaje: string, tarjeta: string | null) => {
    setErr(mensaje);
    if (tarjeta) setFoco((f) => ({ id: tarjeta, vez: (f?.vez ?? 0) + 1 }));
  }, []);
  /**
   * EL FRENO DE LO QUE SE VE, para el panel de «Probar» (séptima tanda): la MISMA `frenoDelFlujo` que
   * frenan Publicar y el botón «Probar» de abajo. El panel lo mira antes de cada rearranque (ver
   * `EdicionLocal.freno`).
   */
  const frenoLocal = useMemo(() => frenoDeEsta(pasos), [pasos, frenoDeEsta]);
  const frenarDesdeProbar = useCallback((f: FrenoDelFlujo) => frenar(f.error, f.tarjeta), [frenar]);

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
    const freno = frenoDeEsta(pasos);
    if (freno) { frenar(freno.error, freno.tarjeta); return; }
    setBusy('save');
    // ⚠️ PUBLICAR CAMBIA LA BASE DEL BORRADOR (revisión, 10/10/2026): lo que salga de su respiro mientras
    // el PATCH viaja espera, o saldría con la base vieja y el server diría que otro publicó.
    borrador.antesDePublicar();
    try {
      const rp = await (await fetch('/api/whatsapp/secuencias', {
        method: 'PATCH', headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ id: secuencia.id, pasos }),
      })).json();
      // El server valida con la MISMA función y rechaza con su primer error, que trae ids.
      if (!rp.ok) {
        borrador.noPublicado();
        const e = rp.error ? String(rp.error) : '';
        // Un 409 trae el `medio` (GENERAL 6): se abre «Conectar» ahí mismo en vez de señalar una tarjeta.
        const medio = rp.medio ? medioDelError(e) : null;
        if (medio) { setErr(e); setConectarMedio(medio); setBusy(null); return; }
        frenar(e ? errorLegible(e, pasos) : 'No se pudo publicar.', e ? tarjetaDelError(e, pasos) : null);
        setBusy(null); return;
      }
    } catch { borrador.noPublicado(); setErr('Sin conexión — prueba de nuevo.'); setBusy(null); return; }
    setPublicado(JSON.stringify(pasos));
    setVisto(JSON.stringify(pasos));
    // «Descartar cambios» vuelve, desde ahora, a esto.
    setAbiertoPublicado(pasos);
    // Lo publicado ya no es un borrador: se borra, y la base pasa a ser lo que se acaba de publicar (la
    // devuelve el server: el navegador no la puede calcular, ver lib/secuencia-borrador.ts).
    void borrador.publicado(pasos);
    // ⚠️ LA ESTRATEGIA SE LIMPIA SÓLO SI SE CONVIRTIÓ UNA LISTA DE ANTES (`limpiar`, de `abrirFlujo`).
    // Un flujo al que sólo se le sacó un «Ir a» también abre «convertido», y limpiarle la estrategia
    // apagaba lo que el motor todavía hace por su lado.
    if (convertida && limpiar) {
      // ⚠️ SIN ESTRATEGIA NO SE MANDA NADA (revisión, lienzo-8): `estrategiaConLimpieza(null)`
      // es null, y antes inventaba `{ objetivo: 'agendar', … }` donde no había nada.
      const limpia = estrategiaConLimpieza(est);
      if (limpia) {
        const r = await api({ action: 'guardar-estrategia', secuenciaId: secuencia.id, estrategia: limpia });
        if (!r.ok) { setErr('Faltó limpiar lo de antes: publica otra vez.'); setBusy(null); onCambio(); return; }
      }
    }
    setConvertida(false);
    setLimpiar(false);
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
   * DÓNDE QUEDÓ CADA TARJETA MOVIDA (quinta tanda, punto 2; mig 0233). Se guarda al soltar, con su
   * propia acción y no con Publicar (app/automations/usePosicionesLienzo.ts). Sólo el admin mueve: un
   * setter mira el flujo como quedó acomodado y panea. Fuera de la pila de deshacer, a propósito: la
   * pila es de lo que hace la automatización, y acomodar el dibujo no lo cambia.
   */
  const lugares = usePosicionesLienzo(secuencia.id, secuencia.posiciones, { puedeGuardar: rolAdmin, onError: setErr });

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
  /**
   * EL NÚMERO ELEGIDO DESDE EL EDITOR DE UN MENSAJE (cuarta tanda, punto 15): el mismo guardado que el
   * selector del CRON. Si es uno recién vinculado («Vincular nuevo»), la lista se vuelve a pedir antes:
   * sin eso, el selector del CRON lo dibujaba como «Un número que ya no está vinculado».
   */
  const elegirLineaDesdeEditor = async (linea: string | null) => {
    if (linea && !lineasWa.some((l) => l.linea === linea)) {
      try {
        const j = await (await fetch('/api/whatsapp/evolution/mensajes?lineas=1', { cache: 'no-store' })).json();
        if (j.ok) setLineasWa(j.lineas ?? []);
      } catch { /* sin lista nueva, se guarda igual: el server valida la línea */ }
    }
    await guardarLinea(linea);
  };
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
      } else {
        setErr(r.error || 'No se pudo cambiar.');
        const medio = medioDelError(r.error ? String(r.error) : null);
        if (medio) setConectarMedio(medio);
      }
    } catch { setErr('Sin conexión — prueba de nuevo.'); }
    setBusy(null);
  };

  // ── Lo que dice cada CRON (la tarjeta del lienzo, el texto del primero) ──
  // Con los nombres de las etapas en el kanban de SU ámbito y los de las etiquetas: `useTextoDisparador`
  // (app/automations/EditorDisparadores.tsx). Un disparador por EVENTO de antes se dice como es.
  const textosCron = useTextoDisparador({ productos, etiquetas, disparadores, etiquetaEtapa, tz });
  const textoDisparo = textosCron.texto(crons.primero);
  /** Las filas de la tarjeta CRON (las dibuja FlujoLienzo, parte «lienzo»): una por CRON, con su ícono. */
  const filasCron = crons.lista.map((d) => ({ id: d.id, texto: textosCron.texto(d), icono: iconoDeDisparador(d) }));
  // Cerrar el panel olvida qué CRON estaba abierto: el próximo clic en la tarjeta abre el primero.
  useEffect(() => { if (!tarjetaAbierta) setCronAbierto(null); }, [tarjetaAbierta]);
  /** Las etapas de VENTA de cada producto con embudo, para la fila «Está en la etapa». */
  const etapasCond: SeccionEtapas[] = productos.flatMap((pr) => (pr.funnelId == null || !pr.etapas.length ? [] : [{
    title: productos.length > 1 ? pr.nombre : 'Etapas', funnelId: pr.funnelId, options: pr.etapas,
  }]));

  // ── Lo que lee «Probar» ──
  // Sin estrategia, «Probar» prueba sin estrategia: la limpieza de null es null (lienzo-8).
  const estAPublicar = useMemo(() => (convertida && limpiar ? ((estrategiaConLimpieza(est) ?? est) as unknown as SecuenciaDto['estrategia']) : est), [convertida, limpiar, est]);

  /** Lo que «✦ guion» de una nota de voz necesita de la estrategia (revisión, costuras-4). */
  const paraGuion = useMemo(() => (est ? { objetivo: est.objetivo, gancho: est.gancho, preguntas: est.preguntas } : undefined), [est]);
  const pendientesOtraCosa = (handoffs ?? []).filter((h) => h.secuenciaId === secuencia.id).length;
  const cambioLocal = useRef(onCambioLocal);
  useEffect(() => { cambioLocal.current = onCambioLocal; });
  useEffect(() => {
    // En CADA cambio local, no al publicar: el panel de «Probar» prueba lo que se ve, y con su freno.
    cambioLocal.current?.({
      secuenciaId: secuencia.id, pasos, estrategia: estAPublicar, nombre, trigger_tipo: disparo.trigger_tipo, instance_name: lineaSec,
      freno: frenoLocal, frenar: frenarDesdeProbar,
    });
  }, [secuencia.id, pasos, estAPublicar, nombre, disparo.trigger_tipo, lineaSec, frenoLocal, frenarDesdeProbar]);

  /** Dónde flotan la caja y la barra de «Crear con IA» (la franja de abajo; ver el render). */
  const franja = franjaIA(muelles, { izq: insetIzq, der: insetDer });

  /**
   * «PROBAR» (tercera tanda, decisiones 13 y 14): se frena con lo mismo que Publicar
   * (`frenoDelFlujo`: `validarGrafo` + lo que falta escribir) y abre la tarjeta que falta, como las
   * tareas del curso; y es un desplegable WhatsApp / Email con sólo los canales que el flujo usa (con
   * uno solo, un botón). Quien monta abre el panel con ese canal (`onProbar(canal)`).
   */
  const canales = canalesParaProbar(pasos);
  const probar = (canal: CanalProbar) => {
    if (!onProbar) return;
    const freno = frenoDeEsta(pasos);
    if (freno) { frenar(freno.error, freno.tarjeta); return; }
    setErr(null);
    onProbar(canal);
  };
  // MÁS GRANDES (10/10/2026: «Pon el botón de "Publicar" y "Activar" y "Probar" más grandes»): los tres
  // con el mismo alto, `ALTO_ACCION`, para que se lean como la misma familia.
  const estiloProbar: CSSProperties = { ...tarjetaChrome, height: ALTO_ACCION, boxSizing: 'border-box', padding: '0 18px', display: 'inline-flex', alignItems: 'center', gap: 7, fontSize: 14.5, fontWeight: 700, color: 'var(--ink)', cursor: 'pointer', fontFamily: 'inherit' };

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
      {/* ⛔ LA CAJA «GENERAR CON IA» DEL LIENZO VACÍO SE FUE (décima tanda, 11/10/2026; docs/diseno-automations-galeria-v2.md
          §1, «decisión tomada, a confirmar»): pedirle a MaKo vive en el modal «Nueva automatización» («Pídeselo a MaKo»), y
          «Lienzo en blanco» con una caja de IA abajo es el botón doble que ya se sacó una vez. Si Martín la quiere de vuelta,
          es volver a montar `<CrearConIA modo="crear" secuenciaId={secuencia.id} onListo={alListoIA} />` con
          `pasos.length === 0` en esta franja (y `reservaAbajo={RESERVA_ABAJO_CREAR}` en el lienzo): el modo sigue vivo. */}
      {rolAdmin && editandoIA && pasos.length > 0 && (
        <div data-crear-ia="editar" style={{ position: 'absolute', ...franja, display: tarjetaAbierta ? 'none' : 'flex', justifyContent: 'center', pointerEvents: 'none', zIndex: 4 }}>
          <div style={{ pointerEvents: 'auto', width: `min(${BARRA_IA_ANCHO}px, 100%)` }}>
            <CrearConIA modo="editar" secuenciaId={secuencia.id} pasos={pasos} onListo={alListoIA} />
          </div>
        </div>
      )}
      <FlujoLienzo
        pasos={pasos} secuenciaId={secuencia.id}
        disparador={textoDisparo}
        // Sin las filas del EMISOR (el recordatorio, los eventos de MaKo, 11/10/2026): no se puede «ir a» una de
        // ésas — su emisor no inscribe leads (`inscribirEnSecuencia` las rechaza).
        secuencias={secuencias.filter((s) => s.id !== secuencia.id && !esDelEmisor(s)).map((s) => ({ id: s.id, nombre: s.nombre }))}
        audios={audios} negocio={negocio} rolAdmin={rolAdmin} busy={busy != null}
        envioAutoSecuencia={est?.envio_automatico === true}
        etiquetas={etiquetas} etapas={etapasCond} triggerTipo={disparo.trigger_tipo} eventoMako={eventoMako} productos={productos}
        paraGuion={paraGuion} foco={foco} pendientesOtraCosa={pendientesOtraCosa}
        onPasos={onPasos}
        onAgregar={rolAdmin ? agregarEn : undefined}
        onBorrar={rolAdmin ? borrar : undefined}
        onAudioNuevo={onAudioNuevo} onError={setErr}
        onModoIA={rolAdmin ? abrirGuiaSiFalta : undefined}
        insetIzq={insetIzq} insetDer={insetDer} muelles={muelles} revelar={revelarIA ?? revelar}
        onTarjetaAbierta={setTarjetaAbierta}
        posiciones={lugares.posiciones} onPosiciones={rolAdmin ? lugares.mover : undefined}
        linea={rolAdmin ? { actual: lineaSec, onElegir: elegirLineaDesdeEditor } : undefined}
        chrome={(
          <div style={{ display: 'flex', alignItems: 'flex-start', gap: 10, width: '100%' }}>
            {/* El ancho es FIJO por lo mismo que en /mensajes: en modo edición el
                contenido es un `<input>`, que NO mide su texto —mide `size` por el
                avance del «0» de la fuente— así que con `maxWidth` la tarjeta encoge al
                hacer click. Con el ancho puesto, los dos estados miden lo mismo. */}
            {/* ⚠️ DE ALTO FIJO (`ALTO_ACCION`), el mismo que el botón de MaKo de al lado y que «Probar»
                (décima tanda, general 1: «El botón de IA que está al lado del título debe ser del mismo tamaño
                del recuadro del título y estar alineado»). Medía lo que su contenido (el emoji de 34 + el
                relleno: 50) y el botón, 38: dos alturas en la misma fila. */}
            <div data-titulo-lienzo style={{ ...tarjetaChrome, minWidth: 0, width: 400, height: ALTO_ACCION, boxSizing: 'border-box', padding: '0 12px 0 4px', display: 'flex', alignItems: 'center', gap: 8 }}>
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

            {/* «PEDIRLE UN CAMBIO A MAKO», AL LADO DEL TÍTULO (sexta tanda, punto 8: «El botón de IA de
                "Pedirle un cambio a MaKo" ponlo al lado del cuadro del título, donde hoy está
                "activar"»). Vivía en la fila del zoom, como un ✦ más entre el deshacer; ahí quedó
                «Acomodar» (punto 14). Abre y cierra la barra de «Crear con IA» de abajo. */}
            {/* ⚠️ ES EL LOGO DE MaKo (`MakoLogo`, app/_components/MakoBrand.tsx), del alto del título (décima
                tanda, general 1: «Y que sea el logo de MaKo, que es una estrella en el centro, sin la estrella
                chiquita arriba»). El `BotonMako` de la casa lleva `MakoStar`, que dibuja la chispa CON el punto
                chico de arriba; el logo es la chispa sola, centrada en su recuadro negro. */}
            {rolAdmin && pasos.length > 0 && (
              <BotonLogoMako lado={ALTO_ACCION} encendido={editandoIA} onClick={() => setEditandoIA((v) => !v)} title="Pedirle un cambio a MaKo" />
            )}

            {/* ⚠️ «PROBAR» A LA DERECHA DEL TODO, separado de Activar (punto 10: «el botón de
                probar debería estar a la derecha del todo, no pegado a "Activar"»). El
                `marginLeft: auto` lo empuja contra el borde derecho del chrome, que ya
                descuenta el panel de «Probar» abierto (`insetDer`). */}
            {onProbar && (
              <div style={{ marginLeft: 'auto', flex: 'none' }}>
                {probarAbierto ? (
                  <button onClick={() => onCerrarProbar?.()} title="Cerrar la prueba" style={estiloProbar}>✕ Cerrar</button>
                ) : canales.length > 1 ? (
                  // Los canales que el flujo usa, con su logo (`CANALES_PROBAR`, el mismo lugar del que
                  // lee el panel): WhatsApp, Email, Instagram y Messenger. Hasta la segunda pasada lo
                  // que no era email se rotulaba y se probaba como WhatsApp.
                  // Sin la flecha de desplegable (10/10/2026: «Quita la flecha de la derecha… en el botón
                  // de probar»), y el menú ancla a la DERECHA del botón: pegado al borde, abriendo hacia
                  // la derecha se salía de la pantalla.
                  <Dropdown value="" resetAfterSelect sinFlecha align="right" botonLabel="▶ Probar" ariaLabel="Probar esta automatización"
                    options={canales.map((c) => ({ value: c, label: CANALES_PROBAR[c].nombre, icono: CANALES_PROBAR[c].logo }))}
                    buttonStyle={estiloProbar} onChange={(v) => { if (v && v in CANALES_PROBAR) probar(v as CanalProbar); }} />
                ) : (
                  <button onClick={() => probar(canales[0])} title="Probar esta automatización" style={estiloProbar}>▶ Probar</button>
                )}
              </div>
            )}
          </div>
        )}
        herramientas={rolAdmin ? (
          // Pegado a esto, el lienzo pone «Acomodar» (FlujoLienzo): donde estaba el ✦ de MaKo, que
          // subió al lado del título (sexta tanda, puntos 8 y 14).
          <div style={{ display: 'inline-flex', alignItems: 'center', gap: 6 }}>
            <BotonPila titulo="Deshacer (Ctrl+Z)" onClick={deshacer} activo={puedeDeshacer}>↶</BotonPila>
            <BotonPila titulo="Rehacer (Ctrl+Y)" onClick={rehacer} activo={puedeRehacer}>↷</BotonPila>
          </div>
        ) : undefined}
        // «Publicar» también desde el click derecho del lienzo (sexta tanda, punto 2), con la MISMA
        // función y apagado cuando el botón lo está.
        onPublicar={rolAdmin ? () => void publicar() : undefined}
        accionesTodo={rolAdmin && onAccionTodo ? { copiar: () => onAccionTodo('copiar'), duplicar: () => onAccionTodo('duplicar'), eliminar: () => onAccionTodo('eliminar') } : undefined}
        puedePublicar={sinPublicar && busy !== 'save'}
        // El pie va también para quien no edita: ve si está activa (el interruptor, apagado). Lo de
        // escribir —el error, «Publicar»— es sólo del admin.
        pie={(
          <div style={{ display: 'inline-flex', alignItems: 'center', gap: 10 }}>
            {/* El error va ACÁ, pegado al botón que lo produce: abajo del lienzo y a la
                izquierda nacía debajo de la lista de secuencias, que flota encima. */}
            {rolAdmin && (err ? (
              <span role="alert" title={avisosIA && avisosIA.texto === err ? avisosIA.todos.join('\n') : undefined} style={{ ...tarjetaChrome, maxWidth: 380, fontSize: 12.5, color: 'var(--bad)', borderColor: 'var(--bad)', lineHeight: 1.4 }}>{err}</span>
            ) : flash ? (
              <span style={{ ...tarjetaChrome, fontSize: 12.5, fontWeight: 600, color: 'var(--good)' }}>{flash}</span>
            ) : null)}
            {/* ⛔ ACÁ VIVÍA «VOLVER A LO PUBLICADO» (revisión del 10/10/2026). Se fue en la décima tanda (general 5:
                «Elimina el botón de "Volver a lo publicado" que aparece al lado de "Activar", para eso ya tenemos
                el CTRL Z»): lo mismo es «Descartar cambios» en el «⋯» de la lista (`descartarCambios`). */}
            {/* «ACTIVAR», AL LADO DE «PUBLICAR» (sexta tanda, punto 8: «Activar pasa a estar al lado de
                "Publicar"»). Las dos deciden qué sale y se miran juntas; arriba quedó el ✦ de MaKo. */}
            <div style={{ ...tarjetaChrome, flex: 'none', height: ALTO_ACCION, boxSizing: 'border-box', padding: '0 14px', display: 'inline-flex', alignItems: 'center', gap: 10 }}>
              <span style={{ fontSize: 14.5, fontWeight: 700, color: activa ? 'var(--good)' : 'var(--dim)' }}>Activar</span>
              <button onClick={toggle} disabled={!rolAdmin || busy === 'toggle'} aria-pressed={activa} title={activa ? 'Pausar' : 'Activar'}
                style={{ width: 46, height: 26, borderRadius: 999, border: 'none', padding: 3, background: activa ? 'var(--good)' : 'var(--border-strong)', cursor: rolAdmin ? 'pointer' : 'default', flex: 'none', transition: 'background .15s' }}>
                <span style={{ display: 'block', width: 20, height: 20, borderRadius: '50%', background: '#fff', transform: activa ? 'translateX(20px)' : 'none', transition: 'transform .15s' }} />
              </button>
            </div>
            {/* ⚠️ «PUBLICAR», NO «GUARDAR»: es el mismo verbo que en /mensajes y dice lo
                que pasa: lo que está en el lienzo pasa a ser lo que MaKo manda.

                ⚠️ Y SIN EL CARTEL «Sin publicar» (tercera tanda, decisión 15; pedido literal: «se
                sobre entiende que si se puede apretar, es porque hay cambios sin publicar»): el botón
                está APAGADO cuando no hay nada que publicar. Una secuencia de antes que abre
                convertida a tarjetas cuenta como cambio (`sinPublicar`): publicarla es lo que la
                convierte, y lo que cambió se lee al pasar el cursor. */}
            {rolAdmin && (
              <button onClick={() => void publicar()} disabled={busy === 'save' || !sinPublicar}
                title={sinPublicar && convertida && inicial.notas.length ? inicial.notas.join(' · ') : undefined}
                style={{ height: ALTO_ACCION, padding: '0 26px', borderRadius: 11, border: 'none', background: 'var(--primary)', color: '#fff', fontSize: 15, fontWeight: 700, cursor: sinPublicar ? 'pointer' : 'default', opacity: busy === 'save' || !sinPublicar ? 0.45 : 1, fontFamily: 'inherit' }}>
                {busy === 'save' ? 'Publicando…' : 'Publicar'}
              </button>
            )}
          </div>
        )}
        disparadores={filasCron}
        // Un CRON del EMISOR (el recordatorio, un evento de MaKo) va SOLO: sin «＋ Nuevo CRON» en la tarjeta (11/10/2026).
        onNuevoDisparador={rolAdmin && !esDelEmisor(crons.primero) ? () => setCronAbierto('nuevo') : undefined}
        onAbrirDisparador={(id) => setCronAbierto(id)}
        editorEntrada={(
          /**
           * EL PANEL DEL CRON (sexta tanda: varios CRON, seis botones gigantes, cada uno con su editor).
           * Vive en EditorDisparadores; acá queda lo que es de la AUTOMATIZACIÓN y no de un CRON: el
           * número de WhatsApp por el que sale, abajo de todo (`pie`).
           *
           * Lo que mide el PANEL (que no quede aire debajo) es del lienzo (`MUELLE`, lib/lienzo-grafo.ts).
           */
          <EditorDisparadores
            lista={crons.lista} editando={cronAbierto} onEditar={setCronAbierto} onGuardar={crons.guardar}
            productos={productos} etiquetas={etiquetas} disparadores={disparadores} etiquetaEtapa={etiquetaEtapa}
            tz={tz} busy={busy != null} rolAdmin={rolAdmin}
            pie={lineasWa.length > 1 ? (() => {
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
                <div style={{ display: 'flex', flexDirection: 'column', gap: 6, paddingTop: 10, borderTop: '1px solid var(--border)' }}>
                  <div style={{ fontSize: 12, fontWeight: 600, color: 'var(--dim)' }}>Número</div>
                  {rolAdmin ? (
                    <Dropdown
                      value={lineaSec && lineaSec !== porDefault.linea ? lineaSec : ''}
                      options={opciones}
                      onChange={(v) => void guardarLinea(v || null)}
                      ariaLabel="Número de WhatsApp por el que sale esta automatización"
                      width="100%"
                    />
                  ) : (
                    <div style={{ fontSize: 13.5, color: 'var(--ink)' }}>{opciones.find((o) => o.value === (lineaSec ?? ''))?.label ?? porDefault.rotulo}</div>
                  )}
                  {caidaLaSec && <div style={{ fontSize: 11.5, color: 'var(--warn)' }}>Número desconectado</div>}
                </div>
              );
            })() : undefined}
          />
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
      {/* CONECTAR AHÍ MISMO lo que frenó Publicar o Activar (GENERAL 6). Conectado, el aviso se va. */}
      {conectarMedio && rolAdmin && (
        <ConectarMedio medio={conectarMedio} linea={secuencia.instance_name ?? null}
          onCerrar={() => setConectarMedio(null)} onConectado={() => { setConectarMedio(null); setErr(null); }} />
      )}
    </div>
  );
}

