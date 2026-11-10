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
import { EditorDisparadores, useDisparadores, useTextoDisparador, disparadoresDeSecuencia, type SecuenciaConDisparadores } from './EditorDisparadores';
import { disparoActualDe, disparadorDeValorIA, recurrenteDeValorIA, iconoDeDisparador, esDelEmisor, canalesConComentario, EVENTOS_MAKO, TRIGGER_AVISO_MAKO } from '@/lib/disparadores';
import { frenoDelEvento } from '@/lib/aviso-evento';
import { problemasDeTokens } from '@/lib/tokens-del-flujo';
import type { AudioSetting, SecuenciaDto, Opcion, PasoSecuenciaDto, ProductoOpcion } from './ChatAgentApp';
import { FlujoLienzo, type CambioPasos, type EtiquetaLienzo, type SeccionEtapas } from './FlujoLienzo';
import { etapasDeCondicion } from '@/lib/condiciones-catalogos';
import { usePosicionesLienzo } from './usePosicionesLienzo';
import { useBorradorSecuencia, ERROR_DESACTUALIZADO } from './useBorradorSecuencia';
import { Dropdown } from '@/app/components/Dropdown';
import { useEtiquetasTodas, avisarCambioEtiquetas } from '@/app/_components/etiquetas-cliente';
import type { ListoCrearIA } from './CrearConIA';
import { ChatMako } from './ChatMako';
import type { FinIA } from './stream-ia';
import Link from '@/app/_ui/Link';
import { textoPorAprobar, dejaBorradores, POR_QUE_SE_APRUEBAN, POR_QUE_CORTO, RUTA_APROBAR } from '@/lib/mensajes-por-aprobar';
import { duplicadaDe, duplicadaAlActivar, avisoDuplicada } from '@/lib/automatizacion-duplicada';
import { avisoDisparadorQueNoDice, disparadorQueNoDice } from '@/lib/automatizacion-disparador-dice';
import { BotonPila } from './BotonPila';
import { TRIGGER_RECORDATORIO, frenoDelRecordatorio } from '@/lib/recordatorio-automatizacion';
import { CANALES_PROBAR, type CanalProbar } from './PanelProbar';
import { useFaltanEnAcciones } from '@/app/_components/EditorAccionMako';
import { esPasoAccion } from '@/lib/nutricion-paso-accion';
import { Icon } from '@/app/_components/icons';
import type { ComponentType } from 'react';
import { Confirm } from '@/app/_ui/Confirm';
import { AvisoRitmoConfirm } from './AvisoRitmoConfirm';
// Leila 2 (28/10/2026): al activar una por etapa, los que YA están en la etapa y no entran solos.
import { hayQuePreguntar, preguntaExistentes, textoAlActivar, type ExistentesEnEtapa } from '@/lib/etapa-existentes';
import type { AvisoDeRitmo } from '@/lib/ritmo-al-activar';
import { TRIGGER_ETAPA } from '@/lib/nutricion-etapa';
// El modal de Configuraciones NO se importa: arrastra acciones del servidor y lo pasa la tab como `Configuraciones`.
import { cronDeProspeccion, AVISO_PROSPECCION, type PropsConfiguraciones } from '@/lib/config-automatizacion';
import { resumenAvisos, edicionVigente, edicionTocaPasos } from '@/lib/flujo-ia-cliente';
import { TOPE_NOMBRE_SECUENCIA, nombreParaGuardar, type Objetivo } from '@/lib/setting-estrategia';
import { normalizar, esNodoMensaje, ID_INICIO } from '@/lib/flujo-grafo';
import { eliminar } from '@/lib/flujo-edicion';
import { MakoLogo } from '@/app/_components/MakoBrand';
import type { Muelles } from '@/lib/lienzo-grafo';
import { abrirFlujo } from '@/lib/flujo-legado';
import {
  insertarDesdeLienzo, renumerar, borradorAlAbrir, errorLegible, tarjetaDelError, estrategiaConLimpieza, disparoDeValor, canalesParaProbar, frenoDelFlujo,
  motivoParaNoProbar, cronSinElegir,
  type QueAgregar,
} from '@/lib/flujo-conversacion';
import { EmojiPickerMini } from '@/app/plan/board/EmojiPicker';
import { abrirGuiaVoz } from '@/lib/chatbot-puerta';
// Un medio sin conectar frena Publicar (409) y Activar (décima tanda, GENERAL 6): el modal de la tab lo conecta ahí mismo.
import { ConectarMedio, useEstadoMedios } from './ConectarMedio';
import { medioDelError, medioIADeLosCron, medioQueFrena, mediosQueUsa, type Medio } from '@/lib/medios-automatizacion';
import { ReportarASoporte } from '@/app/_ui/ReportarASoporte';
import { MetricasAutomatizacion } from './MetricasAutomatizacion';
import { RUTA_LINEAS } from './SalidaWhatsApp';

// El wizard son ~1.800 líneas y sólo se abre UNA vez por workspace (la primera vez que
// se tilda la IA): no tiene por qué viajar en el bundle de cada apertura del lienzo.
const OnboardingChatAgent = dynamic(() => import('./OnboardingChatAgent').then((m) => m.OnboardingChatAgent), { ssr: false });

async function api(body: unknown): Promise<{ ok: boolean; error?: string }> {
  try { return await (await fetch('/api/chat-agent/secuencias', { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify(body) })).json(); } catch { return { ok: false, error: 'sin conexión' }; }
}

const EMOJI_OBJ: Record<Objetivo, string> = { agendar: '📅', preparar: '🎯', reactivar: '🧲', cualificar: '❓', confirmar_pago: '💳' };

/** El tope del nombre: con 40 entran los seis vigentes (el más largo mide 39) y en la lista
 *  de la izquierda se lee entero (punto 3: «con un máximo de caracteres para los títulos»).
 *  Es el de la lib desde la undécima tanda: el mismo que el server y «Renombrar» de la lista. */
const NOMBRE_MAX = TOPE_NOMBRE_SECUENCIA;

/** Las tarjetas del chrome FLOTANTE: fondo propio para leerse sobre la cuadrícula del
 *  lienzo, y el mismo radio que el resto de la casa. Copiado de TemplateDetalleModal a
 *  propósito: son la misma pieza en las dos pantallas. */
/** El alto de «Probar», «Activar» y «Publicar» (10/10/2026: «más grandes»). */
const ALTO_ACCION = 44;

/**
 * EL CHAT DE MaKo Y LA CAPA QUE TAPA EL LIENZO MIENTRAS TRABAJA (decimotercera tanda, puntos 2 y 6). El chat es el hilo de
 * WhatsApp (ChatMako.tsx) y, desde el 20/10/2026, ES LA SIDEBAR (Martín, 16/10 punto 6 y 20/10 punto 5: «al abrir una
 * automatización, toda la sidebar se transforme en el chat con MaKo y que esté permanentemente abierta»): se monta por
 * portal en la ranura de la lista flotante (`ranuraChat`, SimuladorWhatsApp). Entre la decimocuarta tanda y esa fecha iba
 * en el muelle de «Probar» y se abría con el logo de MaKo. Hasta el 22/10/2026 la capa iba de la sidebar para la derecha
 * (`insetIzq`) y la barra de la app quedaba sin tapar.
 *
 * LA CAPA DE «MaKo trabajando» TAPA TODO EL LIENZO, PERO NO LA BARRA DE LA APP. La primera mañana del 22/10/2026 Martín
 * pidió que tapara «todo, incluso atrás de la sidebar» y fue por ENCIMA de la barra de la app (z 61). Esa misma noche,
 * mirando #289: «cuando está ejecutando algo, no debe deshabilitarme la navegación de la sidebar principal... Se debe
 * ejecutar en segundo plano. Si está bien que deshabilite la edición del lienzo». Queda a pantalla completa (también detrás
 * de la lista con el chat) y DEBAJO de la barra de la app (z 60, app/_components/Sidebar.tsx), que sigue nítida y se toca:
 * irse a otra tab no corta el turno (app/automations/stream-ia.ts). Encima de «Publicar» (`Z_ACCION_LIENZO`, 57); la lista
 * flotante con el chat sube a `Z_CHAT_ENCIMA` mientras tanto (SimuladorWhatsApp.tsx).
 */
export const Z_CAPA_MAKO = 58;
/** La lista flotante con el chat de MaKo, mientras MaKo trabaja: encima de la capa y debajo de la barra de la app. */
export const Z_CHAT_ENCIMA = 59;

const botonDisparadorDice: CSSProperties = { appearance: 'none', border: 0, background: 'none', padding: 0, font: 'inherit', fontWeight: 600, color: 'var(--primary)', cursor: 'pointer' };
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
 * aro dorado de siempre.
 *
 * ⚠️ CON LA CARA DEL TÍTULO (duodécima tanda, §2.7; Martín: «ese botón está más grande que el de al lado»). Ya
 * medía 44, igual que el título: lo que se veía más grande era el bloque negro macizo al lado de tarjetas claras.
 * Ahora es un recuadro `tarjetaChrome` (la superficie clara, el borde de 1 px, el radio y la sombra del título y
 * de «Probar») con el logo de `LADO_LOGO` adentro, centrado.
 */
const LADO_LOGO = 32;
export function BotonLogoMako({ onClick, title, encendido = false, lado }: { onClick: () => void; title: string; encendido?: boolean; lado: number }) {
  return (
    <button type="button" data-no-pan data-boton-logo-mako onClick={onClick} aria-pressed={encendido} title={title} aria-label={title}
      style={{
        ...tarjetaChrome, flex: 'none', width: lado, height: lado, padding: 0, cursor: 'pointer',
        display: 'inline-flex', alignItems: 'center', justifyContent: 'center', boxSizing: 'border-box',
        boxShadow: encendido ? `0 0 0 2px var(--mako), ${tarjetaChrome.boxShadow}` : tarjetaChrome.boxShadow,
      }}>
      <MakoLogo size={Math.min(LADO_LOGO, lado)} animate={false} />
    </button>
  );
}
// ⚠️ `BotonLogoMako` YA NO SE DIBUJA en el título (20/10/2026: el chat de MaKo está siempre, en la sidebar). Queda como
// la CARA del logo de MaKo que copia el CRM (app/crm/mako-crm/PanelMakoCrm.tsx) y que miden sus tests.

/** El título de la tuerca (y su `aria-label`). */
export const TITULO_TUERCA = 'Configuraciones de esta automatización';

/**
 * LA TUERCA DEL TÍTULO (20/10/2026), en el lugar del logo de MaKo y con su MISMA cara (`tarjetaChrome`, el lado del título):
 * abre Configuraciones de ESTA automatización.
 */

export const TITULO_METRICAS = 'Métricas de esta automatización';
export const TITULO_VOLVER_AL_LIENZO = 'Volver al flujo';

/**
 * «MÉTRICAS» (23/10/2026), al lado de la tuerca y con su MISMA cara: el lienzo se reemplaza por el dashboard de esta
 * automatización (`MetricasAutomatizacion`), y el mismo botón, marcado, vuelve al flujo.
 */
export function BotonMetricas({ onClick, lado, abierto }: { onClick: () => void; lado: number; abierto: boolean }) {
  const titulo = abierto ? TITULO_VOLVER_AL_LIENZO : TITULO_METRICAS;
  return (
    <button type="button" data-no-pan data-boton-metricas aria-pressed={abierto} onClick={onClick} title={titulo} aria-label={titulo}
      style={{
        ...tarjetaChrome, flex: 'none', height: lado, padding: '0 12px', cursor: 'pointer', boxSizing: 'border-box',
        color: abierto ? 'var(--primary-strong)' : 'var(--dim)', background: abierto ? 'var(--primary-bg)' : tarjetaChrome.background,
        border: abierto ? '1px solid var(--primary)' : tarjetaChrome.border,
        display: 'inline-flex', alignItems: 'center', gap: 6, fontSize: 13.5, fontWeight: 600, fontFamily: 'inherit',
      }}>
      <Icon name="analytics" size={17} />
      <span>{abierto ? 'Flujo' : 'Métricas'}</span>
    </button>
  );
}

export function BotonTuerca({ onClick, lado }: { onClick: () => void; lado: number }) {
  return (
    <button type="button" data-no-pan data-boton-tuerca onClick={onClick} title={TITULO_TUERCA} aria-label={TITULO_TUERCA}
      style={{
        ...tarjetaChrome, flex: 'none', width: lado, height: lado, padding: 0, cursor: 'pointer', color: 'var(--dim)',
        display: 'inline-flex', alignItems: 'center', justifyContent: 'center', boxSizing: 'border-box',
      }}>
      <Icon name="tuerca" size={18} />
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
/** Las automatizaciones a las que ya se les dijo «Le escribe a un funnel de Prospección» en esta visita (como `guiaOfrecida`). */
const avisadaProspeccion = new Set<number>();

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
  freno: FrenoDeProbar | null;
  /** Muestra el freno donde lo muestra Publicar y abre la tarjeta que falta (o el modal del medio). Identidad fija. */
  frenar: (f: FrenoDeProbar) => void;
};

/** Lo que devuelve `frenoDelFlujo`: el error legible y la tarjeta a abrir. */
export type FrenoDelFlujo = NonNullable<ReturnType<typeof frenoDelFlujo>>;
/**
 * Lo que frena un ARRANQUE de «Probar»: la forma del flujo (`frenoDelFlujo`) o un medio sin conectar (`medioQueFrena`,
 * la cuenta de Publicar). Con `medio`, frenar abre el modal de ese medio en vez de una tarjeta.
 */
export type FrenoDeProbar = FrenoDelFlujo & { medio?: Medio; linea?: string | null };


export function SecuenciaPerfil({ secuencia, etiquetaEtapa, rolAdmin, audios, negocio, canalCaido, tz, insetIzq, onAudioNuevo, secuencias, productos, disparadores, onProbar, probarAbierto = false, onCerrarProbar, onCambio, onCambioLocal, insetDer, handoffs, muelles, revelar, onSinPublicar, descartarBorrador, onAccionTodo, cronAlAbrir = false, pedidoAlAbrir = null, ranuraChat = null, onVolverALista, Configuraciones, configPropia, onMakoTrabajando, onCrearOtra, onListaCambio }: {
  /** El modal de Configuraciones de UNA automatización (lo pasa la tab). Sin él, no hay tuerca. */
  Configuraciones?: ComponentType<PropsConfiguraciones>;
  /** ¿Esta automatización tiene configuración PROPIA? (lo pasa la tab: lee el server). Para el aviso de Prospección. */
  configPropia?: (secuenciaId: number) => Promise<boolean>;
  /**
   * DÓNDE VA EL CHAT DE MaKo (20/10/2026): la ranura de la sidebar (SimuladorWhatsApp). Está SIEMPRE montado ahí, sin
   * botón para abrirlo ni ✕; null = todavía no hay ranura (el primer render) o no es un admin.
   */
  ranuraChat?: HTMLElement | null;
  /** La «←» de la cabecera del chat: la sidebar vuelve a la lista de automatizaciones. */
  onVolverALista?: () => void;
  /**
   * MaKo ESTÁ ARMANDO ESTE FLUJO (punto 9 del feedback del 13/10/2026: «el pop-up del recorrido recién cuando la IA
   * terminó»). La tab espera a que termine para abrir el recorrido (`useRecorridoAutomations`, ChatAgentApp).
   */
  onMakoTrabajando?: (trabajando: boolean) => void;
  /** Los pedidos sueltos del chat de MaKo (16/10/2026, ./pedidos-chat.ts): crear OTRA por la puerta de «Pídeselo a MaKo». */
  onCrearOtra?: (pedido: string) => Promise<boolean>;
  /** Se eliminó o volvió OTRA automatización desde el chat: la lista se vuelve a leer. */
  onListaCambio?: () => void;
  // (Acá iba `makoAlAbrir`, abrir con el chat de MaKo abierto: desde el 20/10/2026 el chat está siempre, y el `?mako=1`
  // sólo saca a la sidebar de la lista, en SimuladorWhatsApp.)
  /** Abre con su CRON abierto (#882: la plantilla creada al instante elige su etapa ahí, con el mismo desplegable). */
  cronAlAbrir?: boolean;
  /**
   * EL PEDIDO CON EL QUE NACIÓ (decimotercera tanda, punto 2): el de «Pídeselo a MaKo» del modal «Nueva automatización».
   * La fila ya existe (vacía y pausada) y el chat lo manda solo, como CREAR sobre ella.
   */
  pedidoAlAbrir?: string | null;
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
    // Un borrador de antes se abre con UN AI Step por medio: `borradorAlAbrir` (lib/flujo-conversacion.ts), la MISMA
    // cadena que usa el teléfono (app/m/automations), con `juntarPasosIA` como `abrirFlujo`.
    const borrador = secuencia.borrador?.pasos?.length ? borradorAlAbrir(secuencia.borrador.pasos) : null;
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
  /** MaKo está trabajando (lo avisa el chat): la capa tapa el lienzo; el chat, en la sidebar, queda afuera. */
  const [chatTrabajando, setChatTrabajando] = useState(false);
  // Sube a la tab (el recorrido espera a que MaKo termine); al desmontar, deja de trabajar.
  const onMakoTrabajandoRef = useRef(onMakoTrabajando);
  useEffect(() => { onMakoTrabajandoRef.current = onMakoTrabajando; });
  useEffect(() => { onMakoTrabajandoRef.current?.(chatTrabajando); }, [chatTrabajando]);
  useEffect(() => () => { onMakoTrabajandoRef.current?.(false); }, []);
  /**
   * EL PEDIDO QUE NACIÓ EN EL MODAL (punto 2), hasta que el chat lo manda (`onPedidoInicialUsado`). Se ajusta AL DIBUJAR
   * cuando llega uno nuevo (el lienzo puede estar montado ya: la fila se abre antes de que el server conteste).
   */
  const [pedidoVisto, setPedidoVisto] = useState<string | null>(null);
  const [pedidoPendiente, setPedidoPendiente] = useState<string | null>(null);
  if ((pedidoAlAbrir ?? null) !== pedidoVisto) {
    setPedidoVisto(pedidoAlAbrir ?? null);
    if (pedidoAlAbrir?.trim()) setPedidoPendiente(pedidoAlAbrir);
  }
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
  /**
   * ⚠️ Y SE RE-SIEMBRA AL DIBUJAR cuando la prop cambia y no se está editando (undécima tanda, punto 5). Con
   * «Renombrar» del «⋯» de la lista la automatización ABIERTA cambia de nombre sin remontarse (mismo `key`): sin
   * esto el título seguía diciendo el viejo, y un clic + blur en él lo volvía a ESCRIBIR. Al dibujar y no en un
   * efecto: un efecto pintaría primero el viejo.
   */
  const [nombreVisto, setNombreVisto] = useState(secuencia.nombre);
  if (!editandoNombre && nombreVisto !== secuencia.nombre) { setNombreVisto(secuencia.nombre); setNombre(secuencia.nombre); }
  const guardarNombre = async () => {
    setEditandoNombre(false);
    const t = nombreParaGuardar(secuencia.nombre, nombre);
    if (!t) { setNombre(secuencia.nombre); return; }
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
  /** La línea de WhatsApp que frenó «Probar» (la de una tarjeta puede no ser la de la automatización). */
  const [lineaAConectar, setLineaAConectar] = useState<string | null | undefined>(undefined);
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
      // Duodécima tanda: con `disparadorDeValorIA`, lo MISMO que guardó el server (`ponerDisparador`). `disparoDeValor`
      // no entiende `instagram:dm`, `pago:aprobado` ni `etiqueta_agregada` y la tarjeta seguía con el de antes.
      // Un Recurrente (20/10/2026) viene con su horario: `recurrenteDeValorIA`, lo MISMO que guardó el server.
      const puesto = r.disparador ? (r.cron ? recurrenteDeValorIA(r.disparador, r.cron) : disparadorDeValorIA(r.disparador))[0] : undefined;
      if (puesto) crons.sembrarPrimero(puesto);
      onCambio();
    } else {
      // Las tarjetas van al BORRADOR, como un cambio a mano (con Publicar de por medio). Salvo la respuesta a «¿Cambio
      // qué la dispara?» (duodécima tanda, §3.4): vuelve con los pasos tal cual y no se toca el lienzo (`edicionTocaPasos`).
      if (edicionTocaPasos(r)) {
        // ⚠️ SI EL LIENZO CAMBIÓ MIENTRAS LA IA TRABAJABA, NO SE PISA (revisión, 09/10/2026): el
        // resultado se armó sobre la foto que se mandó, y aplicarlo borraba la corrección del medio.
        if (!edicionVigente(r.base, pasos)) { setErr('Cambiaste el flujo: pídelo de nuevo'); return false; }
        fotoAntes();
        setPasos(nuevos);
      }
      // ⚠️ EL CRON QUE ELIGIÓ LA PERSONA SE GUARDA YA (duodécima tanda, §2.6, decisión 13), por la MISMA acción del panel
      // del CRON (`crons.guardar` → POST `action: 'disparadores'`, EditorDisparadores.tsx), que lo pinta en la tarjeta y
      // relee la lista. No va al borrador. Llega sólo porque la persona tocó una opción o lo pidió. Una lista vacía (o
      // null) NO se guarda: dejaría la automatización sin CRON.
      if (r.disparadores?.length) crons.guardar(r.disparadores);
      // El chat queda ABIERTO: ahí está el resumen, los avisos y, si hay, la pregunta del CRON.
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
    // Al editar, los avisos van en el último mensaje de MaKo del chat (duodécima tanda): repetirlos acá es ruido.
    const res = resumenAvisos(r.avisos);
    if (res && r.modo === 'crear') { setErr(res.texto); setAvisosIA(res); }
    return true;
  };

  /**
   * MaKo TERMINÓ CON ESTA AUTOMATIZACIÓN CERRADA (22/10/2026, «Se debe ejecutar en segundo plano»): la persona se fue a
   * otra tab u otra automatización. Lo que armó va al BORRADOR por la MISMA acción que el lienzo (`action: 'borrador'`, con
   * la base que esta pestaña abrió y `keepalive`), y la lista se relee: al volver, el lienzo abre con eso, sin publicar.
   * Crear ya lo guardó la ruta; una respuesta sin cambios (`edicionTocaPasos`) no toca nada. Sin `setState`: está desmontado.
   */
  const guardarSinVer = (f: FinIA) => {
    if (f.t !== 'listo') return;
    if (f.listo.etiquetasNuevas.length) avisarCambioEtiquetas();
    if (f.listo.modo !== 'editar' || !edicionTocaPasos(f.listo)) { onListaCambio?.(); return; }
    void fetch('/api/chat-agent/secuencias', {
      method: 'POST', headers: { 'Content-Type': 'application/json' }, keepalive: true,
      body: JSON.stringify({ secuenciaId: secuencia.id, action: 'borrador', pasos: renumerar(f.listo.pasos as PasoSecuenciaDto[]), base: secuencia.base }),
    }).then(() => onListaCambio?.()).catch(() => {});
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
  // Con qué medio nace un AI Step nuevo: el de los CRON si todos llegan por el mismo medio social (10/11/2026).
  const medioIA = medioIADeLosCron(crons.lista);
  const agregarEn = (nodo: string, puerto: string | undefined, que: QueAgregar): string | null => {
    const r = insertarDesdeLienzo(pasos, nodo, puerto, que, Math.random, { medioIA });
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
  const [foco, setFoco] = useState<{ id: string | null; vez: number } | null>(null);
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
  // Los DATOS (undécima tanda, punto 4): un `{{dato}}` que esa tarjeta no puede mandar (o {{mensaje_mako}}) frena acá
  // con la MISMA `problemasDeTokens` que el server (`setSecuenciaPasos`), con el CRON y el evento de la fila.
  const frenoDeEsta = useCallback(
    (ps: typeof pasos) => frenoDelFlujo(ps, faltanEnAccion, problemasDeTokens(ps, disparo.trigger_tipo, eventoMako ?? undefined))
      ?? (esRecordatorio ? frenoDelRecordatorio(ps) : esEvento ? frenoDelEvento(ps, eventoMako) : null),
    [faltanEnAccion, esRecordatorio, esEvento, eventoMako, disparo.trigger_tipo],
  );
  // Identidad FIJA (sólo usa setters): viaja en `EdicionLocal` y un `frenar` nuevo por render
  // re-dispararía el efecto que la manda en cada tecla.
  const frenar = useCallback((mensaje: string, tarjeta: string | null) => {
    setErr(mensaje);
    if (tarjeta) setFoco((f) => ({ id: tarjeta, vez: (f?.vez ?? 0) + 1 }));
  }, []);
  // ⛔ ACÁ VIVÍAN `abrirMako` (el ✦ del título, que abría y cerraba el chat) y `makoAlAbrir` (abrir con el chat abierto).
  // Se fueron el 20/10/2026: el chat está SIEMPRE, en la sidebar (Martín: «que se elimine el icono de MaKo ya que quedará
  // siempre abierto»). En su lugar del título va la tuerca de Configuraciones de ESTA automatización.
  /** Configuraciones de ESTA automatización abierta (la tuerca del título). */
  const [configAbierta, setConfigAbierta] = useState(false);
  // «Métricas» (23/10/2026): el lienzo se reemplaza por el dashboard de ESTA automatización. El perfil se remonta al
  // cambiar de automatización, así que cada una abre en su lienzo.
  const [verMetricas, setVerMetricas] = useState(false);
  /** Lo que MaKo dice en el chat al activarla (`ChatMako.nota`): por qué sus mensajes quedan para que los apruebes. */
  const [notaChat, setNotaChat] = useState<{ id: string; texto: string } | null>(null);
  /** El aviso de Prospección pendiente, con lo que se iba a hacer (Publicar o Probar). */
  const [avisoProspeccion, setAvisoProspeccion] = useState<{ seguir: () => void } | null>(null);
  /** Una consulta de «¿tiene lo suyo?» en vuelo (`conAvisoProspeccion`): los clics de mientras no hacen nada. */
  const consultandoProspeccion = useRef(false);
  /** Cuántos y a qué ritmo (`conRitmo`), con lo que se iba a hacer. */
  const [avisoRitmo, setAvisoRitmo] = useState<(AvisoDeRitmo & { seguir: () => void }) | null>(null);
  /** El aviso de una automatización que ya le escribe lo mismo a la misma gente (`conAvisoDuplicada`), con lo que se iba a hacer. */
  const [avisoDup, setAvisoDup] = useState<{ texto: string; boton: string; seguir: () => void } | null>(null);
  /**
   * La persona contestó «… igual» al aviso de duplicada (el de la pantalla o el 409 `duplicada` del server): el pedido que
   * sigue (`toggle` o `publicar`) lo lleva como `aunqueDuplique` y lo consume. Sin eso, el server vuelve a preguntar.
   */
  const respondioIgual = useRef(false);
  /**
   * LOS QUE YA ESTÁN EN LA ETAPA (Leila 2, 28/10/2026: «la activé para todos los que están en reactivación… todavía no pasa
   * nada»). Al ACTIVAR una con un CRON «llega a etapa», se cuenta (`?existentes=`): los que entran solos y los que la ventana
   * de 90 días deja afuera. Si quedan afuera algunos, se pregunta; «Incluirlas» viaja como `incluirExistentes` en el toggle.
   */
  const [avisoExistentes, setAvisoExistentes] = useState<{ texto: string; entran: number; seguir: () => void } | null>(null);
  const incluirExistentes = useRef(false);
  const entranAlActivar = useRef(0);
  // Identidad FIJA (AGENTS.md: todo `<Modal>` recibe un `onCerrar` estable).
  // Al cerrar se relee: si le pusieron goteo u horario, el aviso ya no es cierto. Sólo si lo decía, y con la identidad fija del `onCerrar`.
  const alCerrarConfig = useRef<() => void>(() => {});
  alCerrarConfig.current = () => { if (secuencia.aviso_ritmo) onCambio(); };
  const cerrarConfig = useCallback(() => { setConfigAbierta(false); alCerrarConfig.current(); }, []);
  /**
   * EL CRON ABIERTO AL ENTRAR (`cronAlAbrir`, #882, 17/10/2026): una plantilla que arranca en una etapa se crea AL INSTANTE,
   * sin la pregunta del modal, y la etapa se elige acá. En el flanco y al dibujar: abre la tarjeta CRON (`foco`) y su
   * editor (`cronAbierto`).
   */
  const [cronPedido, setCronPedido] = useState(false);
  if (cronAlAbrir !== cronPedido) {
    setCronPedido(cronAlAbrir);
    if (cronAlAbrir) {
      setCronAbierto(crons.primero?.id ?? 'nuevo');
      setFoco((f) => ({ id: ID_INICIO, vez: (f?.vez ?? 0) + 1 }));
    }
  }
  /**
   * EL FRENO DE LO QUE SE VE, para el panel de «Probar» (séptima tanda): la MISMA `frenoDelFlujo` que
   * frenan Publicar y el botón «Probar» de abajo. El panel lo mira antes de cada rearranque (ver
   * `EdicionLocal.freno`).
   */
  const frenoLocal = useMemo(() => frenoDeEsta(pasos), [pasos, frenoDeEsta]);
  const frenarDesdeProbar = useCallback((f: FrenoDeProbar) => {
    if (f.medio) { setErr(null); setLineaAConectar(f.linea ?? null); setConectarMedio(f.medio); return; }
    frenar(f.error, f.tarjeta);
  }, [frenar]);

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
    // «Publicar igual» (`conAvisoDuplicada`): se usa UNA vez.
    const aunqueDuplique = respondioIgual.current;
    respondioIgual.current = false;
    // La forma y lo que falta escribir, con la MISMA función que frena «Probar» (`frenoDelFlujo`).
    const freno = frenoDeEsta(pasos);
    if (freno) { frenar(freno.error, freno.tarjeta); return; }
    setBusy('save');
    /** Publicó, pero algo no salió (los avisos de Instagram o Messenger: `asegurarAvisosSociales`). No frena: se dice. */
    let aviso: string | null = null;
    // ⚠️ PUBLICAR CAMBIA LA BASE DEL BORRADOR (revisión, 10/10/2026): lo que salga de su respiro mientras
    // el PATCH viaja espera, o saldría con la base vieja y el server diría que otro publicó.
    borrador.antesDePublicar();
    try {
      const rp = await (await fetch('/api/whatsapp/secuencias', {
        method: 'PATCH', headers: { 'Content-Type': 'application/json' },
        // `aunqueDuplique`: recién después de «Publicar igual» (el server pregunta lo mismo con una activa: 409 `duplicada`).
        body: JSON.stringify({ id: secuencia.id, pasos, ...(aunqueDuplique ? { aunqueDuplique: true } : {}) }),
      })).json();
      // El server valida con la MISMA función y rechaza con su primer error, que trae ids.
      if (!rp.ok) {
        borrador.noPublicado();
        // Otra activa ya le escribe lo mismo a la misma gente y la pantalla no lo vio (su lista era vieja): se pregunta acá.
        if (rp.duplicada) { setAvisoDup({ texto: String(rp.error), boton: 'Publicar igual', seguir: () => void publicar() }); setBusy(null); return; }
        const e = rp.error ? String(rp.error) : '';
        // Un 409 trae el `medio` (GENERAL 6): se abre «Conectar» ahí mismo en vez de señalar una tarjeta.
        const medio = rp.medio ? medioDelError(e) : null;
        // DECIMOCUARTA (punto 4): SIN el chip rojo «Conecta tu …» al lado de «Activar»: salta el modal y basta.
        if (medio) { setConectarMedio(medio); setBusy(null); return; }
        // La tarjeta: la que dice el server (`tarjeta`, un dato que no existe) o la que nombra el error.
        const tarjeta = typeof rp.tarjeta === 'string' && rp.tarjeta ? rp.tarjeta : e ? tarjetaDelError(e, pasos) : null;
        frenar(e ? errorLegible(e, pasos) : 'No se pudo publicar.', tarjeta);
        setBusy(null); return;
      }
      aviso = typeof rp.aviso === 'string' && rp.aviso ? rp.aviso : null;
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
    if (aviso) setErr(aviso);
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
  // ⚠️ SIN LA «REENTRADA» EN PANTALLA (23/10/2026, Martín por el Cerebro: «Una sola vez / otra vez que es reunión... para
  // eso tenemos CONDITION»). El motor sigue con la que tiene (`reentrada_efectiva`, lib/reentrada.ts); no se elige acá.
  useEffect(() => {
    let vivo = true;
    void (async () => {
      try {
        const j = await (await fetch(RUTA_LINEAS, { cache: 'no-store' })).json();
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
        const j = await (await fetch(RUTA_LINEAS, { cache: 'no-store' })).json();
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

  /**
   * Antes de ACTIVAR (Leila 2): cuenta a los que ya están en la etapa y, si la ventana deja afuera a algunos, pregunta. «No
   * pude contar» no frena: se activa como siempre. Una con horario no se mira (la decide su ocurrencia).
   */
  const conExistentes = async (seguir: () => void) => {
    incluirExistentes.current = false;
    entranAlActivar.current = 0;
    if (!rolAdmin || !crons.lista.some((d) => d.trigger_tipo === TRIGGER_ETAPA && !d.cron)) { seguir(); return; }
    setBusy('toggle');
    const e = await fetch(`/api/whatsapp/secuencias?existentes=${secuencia.id}`)
      .then((r) => r.json())
      .then((r: { ok?: boolean; existentes?: ExistentesEnEtapa | null }) => (r.ok ? r.existentes ?? null : null))
      .catch(() => null);
    setBusy(null);
    entranAlActivar.current = e?.entran ?? 0;
    if (!hayQuePreguntar(e)) { seguir(); return; }
    setAvisoExistentes({ texto: preguntaExistentes(e, e.etapas.map(etiquetaEtapa)), entran: e.entran, seguir });
  };
  /**
   * CUÁNTOS Y A QUÉ RITMO, antes de prenderla (Martín, 25/10/2026, lib/ritmo-al-activar.ts). El goteo vive escondido en
   * Configuraciones: sin esto se prendía sobre 200 leads sin haberlo visto. «No pude preguntar» no frena, como `conExistentes`.
   */
  const conRitmo = async (seguir: () => void) => {
    if (!rolAdmin) { seguir(); return; }
    setBusy('toggle');
    const a = await fetch(`/api/whatsapp/secuencias?ritmo=${secuencia.id}${incluirExistentes.current ? '&incluir=1' : ''}`)
      .then((r) => r.json())
      .then((r: { ok?: boolean; ritmo?: AvisoDeRitmo | null }) => (r.ok ? r.ritmo ?? null : null))
      .catch(() => null);
    setBusy(null);
    if (!a) { seguir(); return; }
    setAvisoRitmo({ ...a, seguir });
  };
  const toggle = async () => {
    setBusy('toggle'); setErr(null);
    // «Activar igual» (`conAvisoDuplicada`): se usa UNA vez.
    const aunqueDuplique = respondioIgual.current;
    respondioIgual.current = false;
    // «Incluirlas» (Leila 2): sólo al prender. Se conserva si el server pregunta por una duplicada y se vuelve con «Activar igual».
    const incluir = !activa && incluirExistentes.current;
    try {
      const r = await (await fetch('/api/whatsapp/secuencias', { method: 'PATCH', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify({ id: secuencia.id, activa: !activa, ...(aunqueDuplique ? { aunqueDuplique: true } : {}), ...(incluir ? { incluirExistentes: true } : {}) }) })).json();
      if (r.ok) {
        incluirExistentes.current = false;
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
            // Y cuántos de los que ya estaban en la etapa entran (Leila 2: «la pantalla dice cuántos entran»).
            ? (caidaLaSec && soloWa ? 'Activada · WhatsApp desconectado' : textoAlActivar(entranAlActivar.current, Number(r.incluidos) || 0))
            : 'Pausada ✓',
        );
        // Activada, pero no se pudo sumar a los que ya estaban: se dice (la activación no se deshace).
        if (r.aviso) setErr(String(r.aviso));
        // ⚠️ «ACTIVADA ✓» Y NO SALE NADA (20/10/2026, el Recurrente de Leila: 31 borradores esperando). A un lead que no
        // pagó, un mensaje de WhatsApp que no sale solo queda para que lo apruebes (lib/mensajes-por-aprobar.ts): el chat
        // lo dice al activarla, y la línea de al lado de «Activar» cuenta los que esperan.
        // Con lo PUBLICADO (revisión del 20/10/2026, noche): Activar prende la fila, no el borrador del lienzo.
        if (!activa && dejaBorradores(abiertoPublicado, est?.envio_automatico === true)) {
          setNotaChat({ id: `mako-aprobar-${Date.now().toString(36)}`, texto: `${POR_QUE_SE_APRUEBAN}. Se aprueban en Chats › Borradores.` });
        }
        onCambio();
      } else if (r.duplicada) {
        // El server la frenó (`setSecuenciaActiva` pregunta en TODOS los caminos): la misma pregunta, y con «Activar igual», otra vez.
        setAvisoDup({ texto: String(r.error), boton: 'Activar igual', seguir: () => void toggle() });
      } else {
        // Un medio sin conectar abre su modal y NO deja el chip rojo al lado de «Activar» (decimocuarta tanda, punto 4).
        const medio = medioDelError(r.error ? String(r.error) : null);
        if (medio) setConectarMedio(medio);
        else setErr(r.error || 'No se pudo cambiar.');
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
  const comentarioEn = useMemo(() => canalesConComentario(crons.lista), [crons.lista]);
  // Cerrar el panel olvida qué CRON estaba abierto: el próximo clic en la tarjeta abre el primero.
  useEffect(() => { if (!tarjetaAbierta) setCronAbierto(null); }, [tarjetaAbierta]);
  /**
   * Las etapas de VENTA de cada producto con embudo, para la fila «Está en la etapa». Con `etapasDeCondicion`, la MISMA
   * que arma lo que ve «Crear con IA» (`armarContexto`, lib/flujo-ia-crear.ts): con dos copias, una se queda vieja.
   */
  const etapasCond: SeccionEtapas[] = etapasDeCondicion(productos);
  /**
   * LO QUE DICE CONTRA LO QUE LA DISPARA (30/10/2026, lib/automatizacion-disparador-dice.ts): la #264 del ws13 avisa «Nuevo agendado» y
   * se dispara también en Lead. Es del cliente: se le dice en una línea y lo corrige él. «Está bien así» se recuerda en este navegador
   * mientras no cambie lo que se dijo.
   */
  const disparadorDice = rolAdmin ? disparadorQueNoDice({ nombre, pasos, disparan: crons.lista.filter((d) => d.trigger_tipo === TRIGGER_ETAPA && !d.cron).flatMap((d) => d.etapas?.length ? d.etapas : d.etapa ? [d.etapa] : []), etapas: (etapasCond.find((s) => s.funnelId === secuencia.funnel_id) ?? etapasCond[0])?.options ?? [] }) : null;
  const firmaDisparador = disparadorDice ? `${disparadorDice.dice}|${disparadorDice.otras.join(',')}` : null;
  const claveDisparador = `mako.disparador-dice.${secuencia.id}`;
  const [yaVistoDisparador, setYaVistoDisparador] = useState<string | null>(null);
  useEffect(() => { try { setYaVistoDisparador(window.localStorage.getItem(claveDisparador)); } catch { /* sin recordarlo */ } }, [claveDisparador]);
  // Afuera del pie: el pie tiene su tope de tamaño (tests/lienzo-sexta-tanda.test.ts).
  const avisoDisparadorDice = disparadorDice && yaVistoDisparador !== firmaDisparador && (
        <span data-disparador-dice="" role="status" style={{ ...tarjetaChrome, flex: 'none', maxWidth: 420, display: 'inline-flex', flexWrap: 'wrap', alignItems: 'center', gap: '2px 10px', fontSize: 12.5, fontWeight: 600, color: 'var(--warn)', lineHeight: 1.35 }}>
          <span>{avisoDisparadorQueNoDice(disparadorDice)}</span>
          <button type="button" onClick={() => { setCronAbierto(crons.primero?.id ?? 'nuevo'); setFoco((f) => ({ id: ID_INICIO, vez: (f?.vez ?? 0) + 1 })); }} style={botonDisparadorDice}>Cambiar disparador</button>
          {disparadorDice.fuente === 'nombre' && <button type="button" onClick={() => setEditandoNombre(true)} style={botonDisparadorDice}>Cambiar nombre</button>}
          <button type="button" onClick={() => { setYaVistoDisparador(firmaDisparador); try { if (firmaDisparador) window.localStorage.setItem(claveDisparador, firmaDisparador); } catch { /* sin recordarlo */ } }} style={{ ...botonDisparadorDice, color: 'var(--dim)' }}>Está bien así</button>
        </span>
  );

  /**
   * LOS MEDIOS QUE USA EL FLUJO Y SU ESTADO (la MISMA lectura que pinta el chip de la tarjeta). Se leen acá, antes de
   * mandarle el freno al panel: los REARRANQUES de «Probar» (↻, «Cambió · ↻», «Probar en WhatsApp») miraban sólo la forma
   * (`frenoLocal`), así que desconectar un medio con el panel abierto no frenaba hasta cerrarlo (pendiente de la
   * decimotercera tanda).
   */
  const usaMedios = useMemo(() => mediosQueUsa(pasos, crons.lista), [pasos, crons.lista]);
  const estadoMedios = useEstadoMedios(usaMedios, rolAdmin && !!onProbar);
  const frenoProbar = useMemo<FrenoDeProbar | null>(() => {
    if (frenoLocal) return frenoLocal;
    const falta = medioQueFrena(pasos, lineaSec, crons.lista, estadoMedios);
    return falta ? { error: falta.error, tarjeta: null, medio: falta.medio, linea: falta.linea } : null;
  }, [frenoLocal, pasos, lineaSec, crons.lista, estadoMedios]);

  // ── Lo que lee «Probar» ──
  // Sin estrategia, «Probar» prueba sin estrategia: la limpieza de null es null (lienzo-8).
  const estAPublicar = useMemo(() => (convertida && limpiar ? ((estrategiaConLimpieza(est) ?? est) as unknown as SecuenciaDto['estrategia']) : est), [convertida, limpiar, est]);

  /** Lo que «✦ guion» de una nota de voz necesita de la estrategia (revisión, costuras-4). */
  const paraGuion = useMemo(() => (est ? { objetivo: est.objetivo, gancho: est.gancho, preguntas: est.preguntas } : undefined), [est]);
  const pendientesOtraCosa = (handoffs ?? []).filter((h) => h.secuenciaId === secuencia.id).length;
  /** «31 mensajes esperando que los apruebes» (lib/mensajes-por-aprobar.ts). null = ninguno, o no se pudo leer. */
  const porAprobar = textoPorAprobar(secuencia.por_aprobar);
  const cambioLocal = useRef(onCambioLocal);
  useEffect(() => { cambioLocal.current = onCambioLocal; });
  useEffect(() => {
    // En CADA cambio local, no al publicar: el panel de «Probar» prueba lo que se ve, y con su freno.
    cambioLocal.current?.({
      secuenciaId: secuencia.id, pasos, estrategia: estAPublicar, nombre, trigger_tipo: disparo.trigger_tipo, instance_name: lineaSec,
      freno: frenoProbar, frenar: frenarDesdeProbar,
    });
  }, [secuencia.id, pasos, estAPublicar, nombre, disparo.trigger_tipo, lineaSec, frenoProbar, frenarDesdeProbar]);

  /**
   * «PROBAR» (tercera tanda, decisiones 13 y 14): se frena con lo mismo que Publicar
   * (`frenoDelFlujo`: `validarGrafo` + lo que falta escribir) y abre la tarjeta que falta, como las
   * tareas del curso; y es un desplegable WhatsApp / Email con sólo los canales que el flujo usa (con
   * uno solo, un botón). Quien monta abre el panel con ese canal (`onProbar(canal)`).
   */
  const canales = canalesParaProbar(pasos);
  /**
   * ⚠️ «PROBAR» FRENA CON UN MEDIO SIN CONECTAR (decimotercera tanda, punto 3; Martín, con #246 y sus tarjetas «Sin
   * conectar»: «Me dice "Sin zernio"... Pero me permite probarlo, eso no debería pasar, si falta un paso, en ese caso
   * de conexión, debe decirme que me falta conectar X cosa»). La cuenta es la de Publicar y Activar (`medioQueFrena`,
   * lib/medios-automatizacion.ts: las tarjetas Y el CRON, con la línea de cada una) sobre la MISMA lectura que pinta el
   * chip de la tarjeta (`useEstadoMedios`). Abre el modal de ese medio ahí mismo, que dice qué falta (desde la decimocuarta
   * tanda, punto 4, sin el chip rojo «Conecta tu …» al lado de «Activar»: «cuando lo intenten publicar o probar ya les va a
   * saltar»). «No pude
   * comprobarlo» no frena (conectar no lo arregla).
   */
  const probar = (canal: CanalProbar) => {
    if (!onProbar) return;
    const freno = frenoDeEsta(pasos);
    if (freno) { frenar(freno.error, freno.tarjeta); return; }
    const falta = medioQueFrena(pasos, lineaSec, crons.lista, estadoMedios);
    if (falta) { setErr(null); setLineaAConectar(falta.linea); setConectarMedio(falta.medio); return; }
    setErr(null);
    conAvisoProspeccion(() => onProbar(canal));
  };
  /**
   * EL AVISO DE PROSPECCIÓN (20/10/2026, Martín, 16/10 punto 5: «Solo cuando se selecciona etapas o algún funnel que esté
   * catalogado como "Prospección", debe saltar un warning para configurar eso al momento de darle a publicar o probar»):
   * si el CRON elige etapas de un funnel de Prospección (`cronDeProspeccion`) y la automatización no tiene configuración
   * propia, se pregunta antes: «Configurar» abre su modal; «Seguir igual» sigue. Una vez por automatización y visita.
   */
  /**
   * OTRA ACTIVA YA LE ESCRIBE LO MISMO A LA MISMA GENTE (20/10/2026: #282 y el d2 de #284 del ws11, la misma etapa con casi
   * el mismo recordatorio; cada lead lo recibía dos veces). Al ACTIVAR, y al PUBLICAR una que ya está activa: pausada,
   * publicar no le manda nada a nadie y se avisa al activarla. No frena (puede ser a propósito): pregunta. Compara lo que
   * se ve (el lienzo y los CRON de ahora) con lo PUBLICADO de las otras, que es lo que manda el motor.
   */
  const conAvisoDuplicada = (vaAMandar: boolean, boton: string, seguir: () => void, queManda: readonly PasoSecuenciaDto[] = pasos) => {
    if (!rolAdmin || !vaAMandar) { seguir(); return; }
    const otra = duplicadaDe(
      { id: secuencia.id, nombre, disparadores: crons.lista, pasos: queManda },
      secuencias.map((s) => ({ id: s.id, nombre: s.nombre, activa: s.activa, disparadores: disparadoresDeSecuencia(s), pasos: s.pasos ?? [] })),
    );
    if (!otra) { seguir(); return; }
    setAvisoDup({ texto: avisoDuplicada(otra), boton, seguir });
  };
  /**
   * UNA ACTIVA QUE YA LE ESCRIBE LO MISMO A LA MISMA GENTE QUE OTRA (revisión del 21/10/2026): se DICE al lado de «Activar»
   * mientras sea así, calculado de lo que hay (sus CRON de ahora y lo publicado). Era un aviso que salía al guardar un CRON
   * y se borraba con el guardado siguiente, o no salía si se cambiaba de automatización antes de que volviera. Un CRON se
   * guarda en vivo: no hay un «antes» donde preguntar sin frenar cada toque.
   */
  const dupActiva = useMemo(
    () => (rolAdmin && activa
      ? duplicadaAlActivar(secuencia as SecuenciaConDisparadores, secuencias as readonly SecuenciaConDisparadores[], disparadoresDeSecuencia, { pasos: abiertoPublicado, crons: crons.lista })
      : null),
    [rolAdmin, activa, secuencia, secuencias, abiertoPublicado, crons.lista],
  );
  const conAvisoProspeccion = (seguir: () => void) => {
    if (!rolAdmin || !Configuraciones || avisadaProspeccion.has(secuencia.id) || !cronDeProspeccion(crons.lista, productos, secuencia.funnel_id ?? null)) { seguir(); return; }
    // ⚠️ UNA CONSULTA A LA VEZ, Y LA QUE YA TIENE LO SUYO QUEDA AVISADA (revisión del 20/10/2026): sin esto cada clic
    // consultaba la configuración y un doble clic, con Publicar todavía habilitado, mandaba dos PATCH.
    if (consultandoProspeccion.current) return;
    consultandoProspeccion.current = true;
    void (configPropia ? configPropia(secuencia.id).catch(() => false) : Promise.resolve(false))
      .then((propia) => { if (propia) { avisadaProspeccion.add(secuencia.id); seguir(); } else setAvisoProspeccion({ seguir }); })
      .finally(() => { consultandoProspeccion.current = false; });
  };
  // «PROBAR» APAGADO MIENTRAS FALTE ALGO (16/10/2026, `motivoParaNoProbar`): el porqué al lado; con una tarjeta a medias,
  // tocarlo lleva a esa tarjeta (lo de Publicar).
  const frenoAhora = frenoDeEsta(pasos);
  const sinProbar = motivoParaNoProbar({ cronSinElegir: cronSinElegir(crons.lista), pasos, frena: !!frenoAhora });
  // LA QUE YA ESTÁ PRENDIDA SIN GOTEO O SIN HORARIO (30/10/2026, lib/ritmo-al-activar.ts): se dice, no se la frena ni se la cambia. Lo ve
  // quien ve la automatización, como en el teléfono (un setter no lo arregla, pero puede avisar). Ponerlo, sólo el admin. Va afuera
  // del pie para no levantar otro tope de tamaño de los tests (docs/hallazgos-chatbot.md).
  const avisoRitmoPrendida = activa && secuencia.aviso_ritmo && (
      <button type="button" data-sin-goteo="" disabled={!rolAdmin || !Configuraciones} onClick={() => setConfigAbierta(true)} title={rolAdmin ? 'Abrir Configuraciones' : undefined}
        style={{ ...tarjetaChrome, flex: 'none', maxWidth: 320, textAlign: 'left', font: 'inherit', fontSize: 12.5, fontWeight: 600, color: 'var(--warn)', lineHeight: 1.35, cursor: rolAdmin && Configuraciones ? 'pointer' : 'default' }}>
        {secuencia.aviso_ritmo.texto}
      </button>
  );
  // MÁS GRANDES (10/10/2026: «Pon el botón de "Publicar" y "Activar" y "Probar" más grandes»): los tres
  // con el mismo alto, `ALTO_ACCION`, para que se lean como la misma familia.
  const estiloProbar: CSSProperties = { ...tarjetaChrome, height: ALTO_ACCION, boxSizing: 'border-box', padding: '0 18px', display: 'inline-flex', alignItems: 'center', gap: 7, fontSize: 14.5, fontWeight: 700, color: 'var(--ink)', cursor: 'pointer', fontFamily: 'inherit' };


  /**
   * ⚠️ EL LIENZO ES LA PANTALLA. No hay barra, ni cabecera, ni pie: el título, el
   * interruptor, «Probar», el deshacer y «Publicar» FLOTAN encima, que es exactamente
   * cómo quedó el editor de /mensajes.
   */
  // LA CABECERA DEL LIENZO (el título, la tuerca, «Métricas» y «Probar»), aparte desde el 23/10/2026: la dibuja el lienzo
  // (`chrome`) y, con «Métricas» abierta, la vista de las métricas, que reemplaza al lienzo entero.
  const cabecera = (
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

            {/* LA TUERCA DE ESTA AUTOMATIZACIÓN, AL LADO DEL TÍTULO (Martín, 16/10/2026 punto 6: «El ícono de
                configuraciones pasa a estar en donde hoy vive "Pedirle un cambio a MaKo"»; y el 20/10: «que se elimine el
                icono de MaKo ya que quedará siempre abierto, y en su lugar que allí vaya el ícono de configuraciones»).
                Abre el horario y los límites de ESTA automatización (`ConfiguracionesModal` con `secuenciaId`). Ahí
                vivía el logo de MaKo (`BotonLogoMako`) desde la sexta tanda: el chat está ahora siempre, en la sidebar.
                ⚠️ TAMBIÉN PARA QUIEN NO ES ADMIN (revisión del 20/10/2026): el modal entra en sólo lectura (`puedeEditar` lo
                dice el server). Con `rolAdmin` acá, el setter perdió la vista del horario y los límites. */}
            {/* MIRANDO LAS MÉTRICAS NO VAN LA TUERCA NI «PROBAR» (24/10/2026, Martín: «Si estoy viendo las métricas no debería
                estar más el botón de "Probar" o "Configuraciones"... En su lugar, los botones de la barra de búsqueda, el filtro,
                los 3 puntitos»): esta cabecera es la mitad izquierda de la barra del informe (MetricasAutomatizacion). */}
            {Configuraciones && !verMetricas && (
              <BotonTuerca lado={ALTO_ACCION} onClick={() => setConfigAbierta(true)} />
            )}
            {/* «MÉTRICAS», AL LADO DE LA TUERCA (Martín, 23/10/2026: «un botón al lado del botón de configuraciones. Cuando
                se apreta, todo el lienzo se reemplaza por el dashboard de esas métricas»). Sólo el admin: el editor del
                Dashboard y sus datos son del admin (app/api/automations/metricas). Volver al lienzo es el MISMO botón. */}
            {rolAdmin && (
              // Abrir las métricas con la prueba abierta la cierra: su «✕ Cerrar» es el de esta barra, y en las métricas no está.
              <BotonMetricas lado={ALTO_ACCION} abierto={verMetricas} onClick={() => { if (!verMetricas && probarAbierto) onCerrarProbar?.(); setVerMetricas((v) => !v); }} />
            )}
            {/* SIN CHIP DE ESTADO (22/10/2026, Martín: «elimina el texto "Pausada, no sale nada", eso es completamente innecesario... Para
                eso ya tenemos el "ACTIVAR" de abajo»): el estado lo dice sólo el interruptor «Activar» del pie. */}

            {configAbierta && Configuraciones && <Configuraciones secuenciaId={secuencia.id} nombre={nombre || secuencia.nombre} onCerrar={cerrarConfig} />}
            {avisoProspeccion && (
              <Confirm message={AVISO_PROSPECCION} confirmLabel="Configurar" cancelLabel="Seguir igual" tone="primary"
                onConfirm={() => { avisadaProspeccion.add(secuencia.id); setAvisoProspeccion(null); setConfigAbierta(true); }}
                onCancel={() => { const s = avisoProspeccion.seguir; avisadaProspeccion.add(secuencia.id); setAvisoProspeccion(null); s(); }} />
            )}
            {avisoDup && (
              <Confirm message={avisoDup.texto} confirmLabel={avisoDup.boton} cancelLabel="Cancelar" tone="primary"
                onConfirm={() => { const s = avisoDup.seguir; setAvisoDup(null); respondioIgual.current = true; s(); }}
                onCancel={() => setAvisoDup(null)} />
            )}
            {/* Leila 2: «Incluirlas» las suma al activar; la otra activa sólo con las que entran solas. */}
            {avisoExistentes && (
              <Confirm message={avisoExistentes.texto} confirmLabel="Incluirlas"
                cancelLabel={avisoExistentes.entran ? `Sólo las ${avisoExistentes.entran}` : 'Activar sin ellas'} tone="primary"
                onConfirm={() => { const s = avisoExistentes.seguir; setAvisoExistentes(null); incluirExistentes.current = true; s(); }}
                onCancel={() => { const s = avisoExistentes.seguir; setAvisoExistentes(null); s(); }} />
            )}

            {/* «Poner goteo», «Poner horario»: abre Configuraciones y NO la prende. Cerrar el aviso nunca manda nada. */}
            {avisoRitmo && (
              <AvisoRitmoConfirm aviso={avisoRitmo} secuenciaId={secuencia.id} incluir={incluirExistentes.current} puedePoner={!!Configuraciones}
                onDescartado={(a) => { setAvisoRitmo((v) => (v ? { ...a, seguir: v.seguir } : v)); onCambio(); }}
                onConfirm={() => { const s = avisoRitmo.seguir; setAvisoRitmo(null); s(); }}
                onCancel={() => { const abrir = !!avisoRitmo.poner && !!Configuraciones; setAvisoRitmo(null); if (abrir) setConfigAbierta(true); }} />
            )}

            {/* ⚠️ «PROBAR» A LA DERECHA DEL TODO, separado de Activar (punto 10: «el botón de
                probar debería estar a la derecha del todo, no pegado a "Activar"»). El
                `marginLeft: auto` lo empuja contra el borde derecho del chrome, que ya
                descuenta el panel de «Probar» abierto (`insetDer`). */}
            {onProbar && !verMetricas && (
              <div style={{ marginLeft: 'auto', flex: 'none', display: 'inline-flex', alignItems: 'center', gap: 10 }}>
                {!probarAbierto && sinProbar && (
                  <button type="button" data-sin-probar onClick={() => { if (frenoAhora) frenar(frenoAhora.error, frenoAhora.tarjeta); }}
                    style={{ border: 'none', background: 'none', padding: 0, font: 'inherit', fontSize: 12.5, color: 'var(--dim)', whiteSpace: 'nowrap', cursor: frenoAhora ? 'pointer' : 'default' }}>
                    {sinProbar}
                  </button>
                )}
                {probarAbierto ? (
                  <button onClick={() => onCerrarProbar?.()} title="Cerrar la prueba" style={estiloProbar}>✕ Cerrar</button>
                ) : sinProbar ? (
                  <button disabled aria-disabled title={sinProbar} style={{ ...estiloProbar, opacity: 0.45, cursor: 'not-allowed' }}>▶ Probar</button>
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
  );

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
          Desmontar el chat cortaría un pedido en vuelo de hasta cinco minutos. */}
      {/* ⛔ LA CAJA «GENERAR CON IA» DEL LIENZO VACÍO SE FUE (décima tanda, 11/10/2026; docs/diseno-automations-galeria-v2.md
          §1, «decisión tomada, a confirmar»): pedirle a MaKo vive en el modal «Nueva automatización» («Pídeselo a MaKo»), y
          «Lienzo en blanco» con una caja de IA abajo es el botón doble que ya se sacó una vez. Su modo `crear` se fue en la
          duodécima con la caja (CrearConIA.tsx pasó a ser ChatMako.tsx): si Martín la quiere de vuelta, es el chat en modo
          galería con `secuenciaId` en esta franja (y `reservaAbajo={RESERVA_ABAJO_CREAR}` en el lienzo). */}
      {/* EL CHAT DE MaKo (duodécima tanda, §2.5): reemplaza a la barra «Pídele un cambio», en el MISMO lugar, con el hilo
          encima del composer y un alto máximo de ~45% del lienzo (crece hacia arriba desde la franja; el hilo scrollea). */}
      {/* DECIMOTERCERA TANDA: el chat ES el hilo de WhatsApp (punto 6), de alto fijo, y está también con el lienzo VACÍO
          (punto 2: la fila que nació con un pedido de «Nueva automatización», donde MaKo CREA). Mientras MaKo trabaja, la
          capa tapa TODA la pantalla (por portal, `position: fixed`) y la lista con el chat queda encima: el «escribiendo…», las fases y Cancelar. */}
      {rolAdmin && chatTrabajando && typeof document !== 'undefined' && createPortal(
        <div data-capa-mako="" aria-hidden style={{
          position: 'fixed', inset: 0, zIndex: Z_CAPA_MAKO,
          display: 'flex', justifyContent: 'center', alignItems: 'flex-start', paddingTop: '12vh',
          background: 'rgba(18,21,27,.32)', backdropFilter: 'blur(1.5px)',
        }}>
          {/* «QUE DENTRO APAREZCA UN LOADER» (punto 2): con el lienzo vacío, MaKo está creando la automatización. */}
          {pasos.length === 0 && (
            <div data-creando-mako="" style={{ ...tarjetaChrome, display: 'flex', alignItems: 'center', gap: 10, padding: '12px 16px', fontSize: 14, fontWeight: 600, color: 'var(--ink)' }}>
              <span className="mk-spin" style={{ width: 16, height: 16 }} aria-hidden />
              Creando tu automatización
            </div>
          )}
        </div>,
        document.body,
      )}
      {/* EL CHAT ES LA SIDEBAR (20/10/2026, Martín: «que quede SIEMPRE abierto en donde está la sidebar de todas las
          automatizaciones»): SIEMPRE montado, por portal en la ranura de la lista flotante (`ranuraChat`), sin ✕. La «←»
          de su cabecera vuelve a la lista (la ranura se esconde, no se desmonta: un pedido en vuelo sigue). Entre la
          decimocuarta tanda y esa fecha iba en el muelle de «Probar» y se abría con el logo de MaKo. */}
      {rolAdmin && ranuraChat && createPortal(
        <div data-crear-ia="editar" data-chat-sidebar="" style={{ flex: 1, minHeight: 0, display: 'flex', flexDirection: 'column', position: 'relative' }}>
          <ChatMako secuenciaId={secuencia.id} pasos={pasos} publicadas={secuencia.pasos?.length ?? 0} onListo={alListoIA}
            onVolver={onVolverALista}
            onTrabajando={setChatTrabajando} pedidoInicial={pedidoPendiente} onPedidoInicialUsado={() => setPedidoPendiente(null)}
            nombre={secuencia.nombre ?? ''} onCrearOtra={onCrearOtra} onListaCambio={onListaCambio} nota={notaChat}
            alTerminarSinVer={guardarSinVer}
            // La tuerca del título, también desde el globo de MaKo que habla de Configuraciones (24/10/2026, f19).
            onAbrirConfiguraciones={Configuraciones ? () => setConfigAbierta(true) : undefined} />
        </div>,
        ranuraChat,
      )}
      {/* «MÉTRICAS» ABIERTA: el lienzo entero se reemplaza por el dashboard de esta automatización, con la MISMA cabecera
          arriba (para volver con el mismo botón) y en el mismo lugar que el lienzo deja libre (los muelles de los costados). */}
      {verMetricas ? (
        <div data-vista-metricas style={{ flex: 1, minHeight: 0, position: 'relative', display: 'flex', flexDirection: 'column', paddingLeft: muelles ? muelles.insets.izq : insetIzq ?? 0, paddingRight: muelles ? muelles.insets.der : insetDer ?? 0 }}>
          <div style={{ position: 'relative', flex: 1, minHeight: 0 }}>
            <MetricasAutomatizacion secuenciaId={secuencia.id} izquierda={cabecera} titulo={nombre || secuencia.nombre} />
          </div>
        </div>
      ) : (
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
        medioIA={medioIA}
        onBorrar={rolAdmin ? borrar : undefined}
        onAudioNuevo={onAudioNuevo} onError={setErr}
        onModoIA={rolAdmin ? abrirGuiaSiFalta : undefined}
        insetIzq={insetIzq} insetDer={insetDer} muelles={muelles} revelar={revelarIA ?? revelar}
        onTarjetaAbierta={setTarjetaAbierta}
        posiciones={lugares.posiciones} onPosiciones={rolAdmin ? lugares.mover : undefined}
        linea={rolAdmin ? { actual: lineaSec, onElegir: elegirLineaDesdeEditor } : undefined}
        chrome={cabecera}
        herramientas={rolAdmin ? (
          // Pegado a esto, el lienzo pone «Acomodar» (FlujoLienzo): donde estaba el ✦ de MaKo, que
          // subió al lado del título (sexta tanda, puntos 8 y 14).
          <div style={{ display: 'inline-flex', alignItems: 'center', gap: 6 }}>
            <BotonPila titulo="Deshacer (Ctrl+Z)" onClick={deshacer} activo={puedeDeshacer}>↶</BotonPila>
            <BotonPila titulo="Rehacer (Ctrl+Y)" onClick={rehacer} activo={puedeRehacer}>↷</BotonPila>
          </div>
        ) : undefined}
        // ⛔ «Publicar» ya no va en el click derecho del lienzo (decimoquinta tanda, punto 5): sólo el botón.
        accionesTodo={rolAdmin && onAccionTodo ? { copiar: () => onAccionTodo('copiar'), duplicar: () => onAccionTodo('duplicar'), eliminar: () => onAccionTodo('eliminar') } : undefined}
        // El pie va también para quien no edita: ve si está activa (el interruptor, apagado). Lo de
        // escribir —el error, «Publicar»— es sólo del admin.
        pie={(
          <div style={{ display: 'inline-flex', alignItems: 'center', gap: 10 }}>
            {/* El error va ACÁ, pegado al botón que lo produce: abajo del lienzo y a la
                izquierda nacía debajo de la lista de secuencias, que flota encima. */}
            {rolAdmin && (err ? (
              <span role="alert" title={avisosIA && avisosIA.texto === err ? avisosIA.todos.join('\n') : undefined} style={{ ...tarjetaChrome, maxWidth: 380, fontSize: 12.5, color: 'var(--bad)', borderColor: 'var(--bad)', lineHeight: 1.4 }}>{err}<ReportarASoporte /></span>
            ) : flash ? (
              <span style={{ ...tarjetaChrome, fontSize: 12.5, fontWeight: 600, color: 'var(--good)' }}>{flash}</span>
            ) : null)}
            {/* ⛔ ACÁ VIVÍA «VOLVER A LO PUBLICADO» (revisión del 10/10/2026). Se fue en la décima tanda (general 5:
                «Elimina el botón de "Volver a lo publicado" que aparece al lado de "Activar", para eso ya tenemos
                el CTRL Z»): lo mismo es «Descartar cambios» en el «⋯» de la lista (`descartarCambios`). */}
            {/* LOS MENSAJES QUE ESPERAN QUE LOS APRUEBES (20/10/2026: el Recurrente de Leila «no salió» y eran 31
                borradores). Con el porqué corto y el link a donde se aprueban (Chats › Borradores). */}
            {avisoDisparadorDice}
            {dupActiva && (
              <span data-duplicada="" role="status" style={{ ...tarjetaChrome, flex: 'none', maxWidth: 320, fontSize: 12.5, fontWeight: 600, color: 'var(--warn)', lineHeight: 1.35 }}>
                {avisoDuplicada(dupActiva)}
              </span>
            )}
            {avisoRitmoPrendida}
            {porAprobar && (
              <Link href={RUTA_APROBAR} title={`${POR_QUE_SE_APRUEBAN}. Se aprueban en Chats › Borradores.`}
                style={{ ...tarjetaChrome, flex: 'none', minHeight: ALTO_ACCION, boxSizing: 'border-box', display: 'inline-flex', flexDirection: 'column', justifyContent: 'center', gap: 1, textDecoration: 'none' }}>
                <span style={{ fontSize: 13, fontWeight: 700, color: 'var(--warn)' }}>{porAprobar} →</span>
                <span style={{ fontSize: 11.5, color: 'var(--dim)' }}>{POR_QUE_CORTO}</span>
              </Link>
            )}
            {/* «ACTIVAR», AL LADO DE «PUBLICAR» (sexta tanda, punto 8: «Activar pasa a estar al lado de
                "Publicar"»). Las dos deciden qué sale y se miran juntas; arriba quedó el ✦ de MaKo.
                El rótulo dice el ESTADO cuando está prendida (recorrido visual del 30/10/2026, A3: «Activar» con el interruptor
                ya encendido no decía si estaba activa o si había que activarla). */}
            <div style={{ ...tarjetaChrome, flex: 'none', height: ALTO_ACCION, boxSizing: 'border-box', padding: '0 14px', display: 'inline-flex', alignItems: 'center', gap: 10 }}>
              <span style={{ fontSize: 14.5, fontWeight: 700, color: activa ? 'var(--good)' : 'var(--dim)' }}>{activa ? 'Activa' : 'Activar'}</span>
              <button onClick={() => (activa ? void toggle() : conAvisoDuplicada(true, 'Activar igual', () => void conExistentes(() => void conRitmo(() => void toggle())), abiertoPublicado))} disabled={!rolAdmin || busy === 'toggle'} aria-pressed={activa} title={activa ? 'Pausar' : 'Activar'}
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
              <button onClick={() => conAvisoProspeccion(() => conAvisoDuplicada(activa, 'Publicar igual', () => void publicar()))} disabled={busy === 'save' || !sinPublicar}
                title={sinPublicar && convertida && inicial.notas.length ? inicial.notas.join(' · ') : undefined}
                style={{ height: ALTO_ACCION, padding: '0 26px', borderRadius: 11, border: 'none', background: 'var(--primary)', color: '#fff', fontSize: 15, fontWeight: 700, cursor: sinPublicar ? 'pointer' : 'default', opacity: busy === 'save' || !sinPublicar ? 0.45 : 1, fontFamily: 'inherit' }}>
                {busy === 'save' ? 'Publicando…' : 'Publicar'}
              </button>
            )}
          </div>
        )}
        disparadores={filasCron}
        // Ticket #17 (28/10/2026): con un CRON de comentario, el mensaje de ese canal ofrece responder en público.
        comentarioEn={comentarioEn}
        // Un CRON del EMISOR (el recordatorio, un evento de MaKo) va SOLO: sin «＋ Nuevo CRON» en la tarjeta (11/10/2026).
        onNuevoDisparador={rolAdmin && !esDelEmisor(crons.primero) ? () => setCronAbierto('nuevo') : undefined}
        onAbrirDisparador={(id) => setCronAbierto(id)}
        editorEntrada={(
          /**
           * EL PANEL DEL CRON (sexta tanda: varios CRON, seis botones gigantes, cada uno con su editor).
           * Vive en EditorDisparadores. Desde el 17/10 (#846) sólo el disparo: el número es de cada WhatsApp, y la
           * reentrada no se elige en pantalla desde el 23/10/2026 (para eso están las condiciones).
           *
           * Lo que mide el PANEL (que no quede aire debajo) es del lienzo (`MUELLE`, lib/lienzo-grafo.ts).
           */
          <EditorDisparadores
            lista={crons.lista} editando={cronAbierto} onEditar={setCronAbierto} onGuardar={crons.guardar}
            productos={productos} etiquetas={etiquetas} disparadores={disparadores} etiquetaEtapa={etiquetaEtapa}
            tz={tz} busy={busy != null} rolAdmin={rolAdmin}
          />
        )}
      />
      )}
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
        <ConectarMedio medio={conectarMedio} linea={lineaAConectar !== undefined ? lineaAConectar : (secuencia.instance_name ?? null)}
          onCerrar={() => { setConectarMedio(null); setLineaAConectar(undefined); }}
          onConectado={() => { setConectarMedio(null); setLineaAConectar(undefined); setErr(null); }} />
      )}
    </div>
  );
}

