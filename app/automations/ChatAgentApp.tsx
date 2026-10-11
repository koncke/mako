'use client';

// =============================================================================
// ChatAgentApp — la tab /automations (ex Chatbot, ex /setting)
// =============================================================================
// UNA pantalla: la lista de automatizaciones (y los mensajes de «MaKo en WhatsApp») flotando sobre
// el lienzo de la elegida (SimuladorWhatsApp). Las sub-tabs de antes (WhatsApp, Email, Plantillas,
// Dashboard) se fueron el 05/10/2026 — ver el comentario del <main> de abajo.
//
// NO hay sub-tab de audios, y es a propósito: grabar una nota de voz es parte de
// armar el mensaje, no un trámite aparte. Se decide y se graba DENTRO de cada
// mensaje de la secuencia (PasoAudioControl). Antes había que salir del wizard,
// ir a la biblioteca, grabar, volver y recién ahí colgarlo del paso — tres
// pantallas para una decisión, y la mitad de la gente no volvía. La biblioteca
// sigue existiendo por debajo: un audio grabado en una secuencia queda
// disponible para las demás.

import { Suspense, useCallback, useEffect, useRef, useState, type CSSProperties } from 'react';
import { useSearchParams } from 'next/navigation';
import { Icon } from '@/app/_components/icons';
// next/link NO: perdería el ?ws= y mandaría al super admin a SU propio WhatsApp
// en vez del que está mirando.
import Link, { useRouter } from '@/app/_ui/Link';
import { SimuladorWhatsApp, listaConCreando, type AbrirSecuencia, type Creando } from './SimuladorWhatsApp';
// «Configuraciones» (décima tanda, GENERAL 4): el horario de oficina y los límites, en un modal. Reemplaza al
// botón del horario (HorarioLista) en los mismos dos lugares.
import { ConfiguracionesBoton } from './ConfiguracionesBoton';
import { GaleriaPlantillas, type CreadaGaleria, type CreadaConIAGaleria, type SeccionGaleria } from './GaleriaPlantillas';
import { leerCopia, firmaDeCopia } from '@/lib/flujo-copia';
import { resumenAvisos } from '@/lib/flujo-ia-cliente';
// (Acá se importaba lib/chatbot-mensajes-mako.ts: el endpoint de Notificaciones y el link `?aviso=` de los
// Mensajes de MaKo de antes. Se fue el 11/10/2026: «MaKo en WhatsApp» son automatizaciones de esta misma lista,
// con el CRON «Evento de MaKo» — docs/diseno-mako-en-whatsapp-unificado.md.)
import type { CronAviso } from '@/lib/cron-aviso';
// ⚠️ ACÁ SE IMPORTABAN `HandoffsPanel` Y `RecordatorioReunion`, y se fueron el 08/10/2026 con
// el pedido de Martín: «Elimina completamente lo de arriba ese form que ocupa toda la pantalla,
// eso debería configurarse en las tarjetas» (punto 1) y «No entiendo por qué está el
// "Recordatorio de la reunión" cuando eso debe configurarse en las tarjetas!!!» (punto 2).
//   · Los casos que el formulario enseñaba son las ramas de la tarjeta «Si responde» del lienzo,
//     y «Otra cosa» es el hand-off. `resolverHandoff` y su acción en /api/chat-agent/secuencias
//     se quedan: los usa MaKo (`resolver_handoff`).
//   · El recordatorio de la reunión es una automatización más (lib/recordatorio-automatizacion.ts).
// La misma pieza que /whatsapp: el QR, su sondeo y la recuperación de una sesión caída.
import { EvolutionConnect } from '../whatsapp/EvolutionConnect';
import { abreEnQR, marcarWhatsappAlCargar, puertaAlRecargar, type OnboardingChatbot } from '@/lib/chatbot-puerta';
// El recorrido guiado de la tab (décima tanda, GENERAL 8), montado como el de CURSO.
import { AyudaAutomations, RecorridoAutomations, useRecorridoAutomations } from './RecorridoAutomations';

/** Cuánto se conserva la URL firmada de un audio ya cargado: la firma dura 12 h (lib/setting-audios.ts). */
const URL_AUDIO_VIGENTE_MS = 10 * 3_600_000;

/** El POST que marca «Tu WhatsApp» en el onboarding de la tab (lo usan el QR y el relleno al cargar). */
const marcarPasoWhatsapp = () => fetch('/api/chat-agent/onboarding', {
  method: 'POST', headers: { 'Content-Type': 'application/json' },
  body: JSON.stringify({ action: 'paso', paso: 'wa_no_oficial', tab: 'setting' }),
});
import type { Estrategia } from '@/lib/setting-estrategia';
import type { PasoGrafo } from '@/lib/flujo-grafo';
import type { ParteMensaje } from '@/lib/mensaje-partes';
import type { CanalSocial } from '@/lib/canal-social';
import { esPasoAccion } from '@/lib/nutricion-paso-accion';
import type { MetricasSecuencia } from '@/lib/setting-metricas';

export type PasoSecuenciaDto = {
  /**
   * Por dónde sale. Instagram y Messenger desde la sexta tanda (parte «canales», por Zernio): hasta la
   * segunda pasada el tipo decía sólo email y WhatsApp, y compilaba porque `esCanalSocial` angostaba el
   * canal a `never`. Con el tipo honesto, el compilador ve las ramas sociales.
   */
  orden: number; canal: 'email' | 'whatsapp' | CanalSocial; delay_horas: number;
  /**
   * El NÚMERO de WhatsApp de ESTE mensaje (sexta tanda, WhatsApp 2: «Si más adelante en la
   * automatización quiero enviar otro mensaje por otro de mis números vinculados en MaKo, se debería
   * poder»). `null`/ausente = el de la automatización. Lo lee el motor con `lineaDelPaso`.
   */
  linea?: string | null;
  asunto: string | null; preheader?: string | null; cuerpo: string;
  /** Sólo email: el cuerpo del editor rico, en HTML saneado. `cuerpo` es su texto plano (lib/nutricion.ts, `cuerpo_html`). */
  cuerpo_html?: string | null;
  /** Sólo email: el «De» que eligió el paso (punto 16 de la cuarta tanda). Ausente = el del workspace. */
  remitente?: string | null;
  proveedor?: 'oficial' | 'no_oficial'; template_wa: string | null; ancla?: 'reunion';
  /** 'ia' = MaKo reescribe el mensaje para cada lead (lib/paso-ia.ts); `cuerpo` es la base y el respaldo. */
  tipo?: 'texto' | 'audio' | 'ia' | 'media'; audio_id?: number | null;
  /**
   * Condición para que el paso salga. La UI la NECESITA: los dos audios de
   * apertura de la post-agenda son mutuamente excluyentes y sin mostrarlo la
   * pantalla se lee como que salen los dos.
   *
   * Faltaba solo en el TIPO, no en los datos: el JSON de la API la trae y
   * JavaScript no borra lo que TypeScript no declara, así que el round-trip
   * del editor nunca la perdió. Igual conviene nombrarla.
   */
  requiere?: 'respondio' | 'sin_respuesta' | 'ya_contactado' | 'primer_contacto';
  /** Formas alternativas de decir lo mismo: el motor sortea una en cada envío. */
  variantes?: string[];
  /**
   * VARIOS mensajes de WhatsApp en orden (cuarta tanda, punto 15). Ausente = el de siempre; `[]` =
   * «una sola parte», que es lo que manda el editor (lib/mensaje-partes.ts).
   */
  partes?: ParteMensaje[];
  /**
   * El paso «⚡ Acción de MaKo»: con esto el paso NO manda un mensaje, corre una acción del
   * registro (lib/nutricion-paso-accion.ts). La forma es la del editor compartido
   * (`EditorAccionMako`), así que viaja tal cual del panel a la fila.
   */
  accion?: { operacion?: string; params?: Record<string, unknown> } | null;
} & CamposDelFlujo;
/**
 * Lo que un paso suma para ser un NODO de un flujo con ramas (lib/flujo-grafo.ts, pedido de
 * Martín del 08/10/2026, punto 9). Todo opcional: una secuencia de antes no trae nada.
 * `tipo: 'media'` es un archivo o una imagen de la biblioteca (`media_id`, por referencia).
 * El AI Step (novena tanda) suma `paso_ia`, el tono (`instrucciones`) y el aviso de «Otra cosa»
 * (`otra_aviso`), y un «Si responde» soltado del CRON lleva `suelta`: viajaban igual sin declararse
 * (JavaScript no borra lo que TypeScript no declara), pero el lienzo tenía que castear para editarlos.
 */
export type CamposDelFlujo = Pick<PasoGrafo, 'id' | 'siguiente' | 'nodo' | 'espera' | 'ramas' | 'casos' | 'si_no' | 'destino' | 'revisar' | 'media_id'
  // AI Step v2 (décima tanda): el MEDIO de la tarjeta (los campos nuevos del caso viajan en `casos`).
  | 'paso_ia' | 'instrucciones' | 'otra_aviso' | 'suelta' | 'medio'>;
export type AudioSetting = { id: number; titulo: string; media_mime: string; duracion_s: number | null; transcript: string | null; url: string | null };
export type SecuenciaDto = {
  id: number; clave: string; nombre: string; etapa: string; trigger_tipo: string;
  /**
   * Las etapas de un CRON con VARIAS (cuarta tanda, punto 14; mig 0230), crudas como vienen de la
   * fila. Cuáles disparan lo dice `etapasDe` (lib/nutricion-etapa.ts): manda si su primera es `etapa`.
   * `[]`/ausente = una sola, la de `etapa`.
   */
  etapas?: string[] | null;
  activa: boolean; pasos: PasoSecuenciaDto[]; inscriptos: number; enviados: number;
  estrategia: Estrategia | null; metricas: MetricasSecuencia;
  /** El EMBUDO al que se acota una secuencia de venta. null = todos los productos. */
  funnel_id?: number | null;
  /** El PRODUCTO de cuya ENTREGA cuelga (trigger entrega_actual, mig 0189). */
  producto_id?: number | null;
  /** Por qué número de WhatsApp sale (mig 0198). `null`/ausente = la línea por default. */
  instance_name?: string | null;
  /** La etiqueta que la dispara (`trigger_tipo: 'etiqueta_puesta'`, mig 0223). */
  etiqueta_id?: number | null;
  /** El emoji del título (mig 0229). `null`/ausente = el del objetivo. */
  emoji?: string | null;
  /** Dónde quedó cada tarjeta movida del lienzo (mig 0233). `{}` = ninguna; `null` = no se pudieron
   *  leer (el lienzo se mueve y no guarda). Ver lib/secuencia-posiciones.ts. */
  posiciones?: Record<string, { x: number; y: number }> | null;
  /**
   * LO QUE QUEDÓ A MEDIO ARMAR, SIN PUBLICAR (sexta tanda, punto 7; mig 0240, lib/secuencia-borrador.ts):
   * el lienzo abre esto en vez de lo publicado. `null` = no hay; AUSENTE = no se pudo leer (falta la
   * columna o falló la lectura): el lienzo abre lo publicado y no guarda borradores, para no pisar uno
   * que no vio.
   */
  borrador?: { pasos: PasoSecuenciaDto[]; guardado_at: string } | null;
  /** La huella de lo publicado que trajo el GET (`getSettingData`): el borrador la manda con cada guardado. */
  base?: string;
  /**
   * EL HORARIO con el que inscribe (mig 0192). `null`/ausente = se dispara por una
   * ACCIÓN, que es lo que hacen hoy todas las filas. Ver lib/nutricion-agenda.ts.
   */
  cron?: CronAviso | null;
};

/** Un producto del CRM con las etapas que el dueño le configuró. */
export type ProductoOpcion = {
  /** `null` = un servicio sin embudo propio: sólo trae etapas de ENTREGA (lib/setting-secuencias.ts). */
  funnelId: number | null; productoId: number | null; nombre: string; esDefault: boolean;
  /** Las del EMBUDO: por dónde pasa el lead antes de comprar. */
  etapas: Array<{ value: string; label: string }>;
  /** Las de la ENTREGA del servicio: por dónde pasa el CLIENTE después de comprar. */
  etapasEntrega: Array<{ value: string; label: string }>;
  origenEntrega: 'declarado' | 'default' | null;
};
export type Opcion = { value: string; label: string };

// Etiquetas de etapa: legacy del seed + stage keys derivadas; para etapas custom
// el GET trae las labels reales del funnel del workspace (prevalecen).
const ETAPA_LABEL: Record<string, string> = {
  nutri: 'No Agenda', postagenda: 'Post-agenda', noshow: 'No Show', nopaga: 'No Paga', manual: 'Manual',
  noshow_r1: 'No Show R1', noshow_r2: 'No Show R2', noshow_r3: 'No Show R3',
  nocompro: 'No Compró', nutridiaria: 'Nutrición diaria', reactivacion: 'Reactivación',
  reunion_excepcional: 'Reunión excepcional',
};

const btnDark: CSSProperties = { padding: '10px 18px', borderRadius: 11, border: 'none', background: 'var(--ink)', color: 'var(--on-ink)', fontFamily: "'Geist', sans-serif", fontSize: '14px', fontWeight: 600, cursor: 'pointer' };

// =============================================================================
// DEEP LINK: /automations?stab=<whatsapp|email|dashboard>&sec=<id>
// =============================================================================
// Existe porque MaKo manda acá desde otra pantalla: cuando termina de escribir
// una secuencia, su tarjeta dice «Ver los 5 mensajes» y NO los dibuja —los
// mensajes se editan acá, así que dibujarlos allá garantiza que un día digan
// algo distinto de lo que se ve en esta tab—.
//
// ⚠️ Antes de esto, la carpeta entera no tenía UN SOLO `useSearchParams`: el
// link existía y dejaba al usuario en la puerta, mirando la lista completa y
// buscando cuál de todas era. «Linkear en vez de dibujar» sin ancla por entidad
// no es linkear, es dejar a alguien en la recepción.
//
// El vocabulario (`?stab=`, y el id como parámetro) es el mismo de /whatsapp
// —`?canal`, `?chat`, `?lead`, `?stab`— a propósito: un usuario que aprendió a
// leer una URL de MaKo no tiene que volver a aprenderla en cada tab.
//
// ⚠️ `?sec=` ABRE EL LIENZO DE ESA AUTOMATIZACIÓN, NO EL WIZARD (revisión adversarial del
// 08/10/2026, costuras-5). El aviso de una charla que pasó a una persona
// (lib/chat-agent-handoff.ts) dice «súmalo como «Su respuesta trata de…»» con este link, y el wizard
// de 9 pasos no tiene «Si responde»: es la tarjeta del lienzo. Y el lienzo ES hoy el editor de
// los mensajes, que es lo que el link de MaKo («Ver los 5 mensajes») prometía.
export function ChatAgentApp() {
  // `useSearchParams` exige un boundary de Suspense, igual que en /whatsapp.
  return (
    <Suspense fallback={null}>
      <ChatAgentInner />
    </Suspense>
  );
}

function ChatAgentInner() {
  const [secuencias, setSecuencias] = useState<SecuenciaDto[] | null>(null);
  /** Respuestas que cayeron en «Otra cosa» sin resolver (ex banner del hand-off): las marca la tarjeta. */
  const [sinCaso, setSinCaso] = useState<ReadonlyArray<{ secuenciaId: number | null }>>([]);
  const [rolAdmin, setRolAdmin] = useState(false);
  const [objetivos, setObjetivos] = useState<Opcion[]>([]);
  const [etapas, setEtapas] = useState<Opcion[]>([]);
  const [productos, setProductos] = useState<ProductoOpcion[]>([]);
  const [disparadores, setDisparadores] = useState<Opcion[]>([]);
  // ⚠️ ACÁ VIVÍAN LOS «HUECOS» (las etapas de nutrición sin secuencia) y el pedido de «Armar una».
  // Alimentaban el pie de la lista, «7 etapas sin secuencia · Armar una», que salió el 10/10/2026:
  // era del modelo de UNA secuencia por etapa de nutrición (el del 5/10), contaba sólo el primer
  // CRON de cada automatización y le decía «secuencia» a lo que ya es una automatización. Martín, con
  // la captura de su ws9: «siguen habiendo cosas de versiones anteriores que están mal».
  /** La zona del negocio: la dice el texto del horario, no se adivina. */
  const [tz, setTz] = useState<string | null>(null);
  const [negocio, setNegocio] = useState('');
  const [error, setError] = useState<string | null>(null);
  const [audios, setAudios] = useState<AudioSetting[]>([]);
  /** La automatización que pidió abrir el deep link `?sec=`: se abre en su LIENZO. */
  const [abrirSec, setAbrirSec] = useState<AbrirSecuencia | null>(null);
  /**
   * «＋ Nueva» en vuelo: un doble clic mandaba dos `crear_vacia` y dejaba dos filas vacías. Es un
   * ref y no un estado porque el segundo clic llega antes de que el primero vuelva a dibujar.
   */
  const creandoNueva = useRef(false);
  /** La fila de «＋ Nueva» mientras el server la crea (decisión 7): ver `crearNueva`. */
  const [creando, setCreando] = useState<Creando | null>(null);
  /**
   * EL FALLO DE CREAR ES SUYO, NO EL DE LA CARGA (revisión de la segunda tanda, 09/10/2026). Iba a
   * `error`, que es el de `load()`: con cero automatizaciones el estado vacío se dibuja sólo con
   * `!error`, así que un «＋ Nueva» fallido se llevaba el estado vacío Y su botón hasta un F5. Se
   * dibuja pegado al botón que lo produjo.
   */
  const [errCrear, setErrCrear] = useState<string | null>(null);
  /**
   * «＋ Nueva» abre la GALERÍA (10/10/2026: «hagamos la galería de las más comunes»): en blanco o desde una plantilla.
   * `seccion: 'mako'` = la abrió «＋ Nuevo mensaje» y va a la sección «MaKo en WhatsApp» (11/10/2026).
   */
  const [galeria, setGaleria] = useState<false | { seccion?: SeccionGaleria }>(false);
  /**
   * El onboarding de esta tab es UNA pregunta: ¿hay un WhatsApp vinculado?
   *
   * Eran once pasos y un wizard de 1.800 líneas. Martín (05/10): «esa pestaña ya no
   * requeriría un onboarding, al menos que no tengas vinculado WhatsApp todavía; lo único
   * que tiene que salir es el QR». Lo demás encontró su casa en la propia tab —el audio se
   * graba en cada paso del lienzo, el ensayo es el simulador, aprobar es Publicar— y el
   * oficial salió del producto (#832).
   *
   * `null` = todavía no se sabe: ni el QR ni la tab, porque dibujar una y reemplazarla
   * medio segundo después es el flash que hace sentir la app rota.
   */
  const [enOnboarding, setEnOnboarding] = useState<boolean | null>(null);
  // Estado del WhatsApp del negocio. Arranca en 'desconocido' a propósito: hasta
  // que la API conteste, la pantalla no afirma que esta conectado NI que no.
  const [canal, setCanal] = useState<{ estado: string; desde: string | null; desvinculado?: boolean }>({ estado: 'desconocido', desde: null });
  // Solo estos dos son un hecho negativo comprobado. 'desconocido', 'conectando'
  // y un estado que no conozcamos NO acusan nada: es la misma regla que el paso
  // del WhatsApp en el onboarding, donde afirmar «desconectado» sobre un corte
  // momentaneo mandaba a re-escanear un QR que no hacia falta.
  const canalCaido = canal.estado === 'desconectado' || canal.estado === 'sin_vincular';
  /**
   * ¿El envío REAL de WhatsApp de este negocio está prendido? (#328). Es un interruptor
   * aparte de la línea: con la línea conectada y esto en `false` no sale nada, y la
   * pantalla no lo decía — el ws1 estuvo así desde el 29/09 con dos secuencias activas.
   * `null` = no se sabe todavía (o no se pudo leer): no se afirma nada.
   */
  const [envioWa, setEnvioWa] = useState<boolean | null>(null);
  const [prendiendo, setPrendiendo] = useState(false);
  const [errEnvio, setErrEnvio] = useState<string | null>(null);

  /** Cuándo se firmó la URL que se está mostrando de cada audio (ver el merge de abajo). */
  const firmaAudio = useRef(new Map<number, number>());

  const load = useCallback(async () => {
    // El estado de la línea, para la puerta del QR (#745): se decide abajo, con el onboarding.
    let estadoCanal = 'desconocido';
    let errorCarga: string | null = null;
    try {
      const r = await fetch('/api/chat-agent/secuencias', { cache: 'no-store' });
      const j = await r.json();
      // ⚠️ SIN `return`: cortar acá dejaba la pantalla en «Abriendo Automations…» para siempre,
      // porque la puerta se decide más abajo. Con el error puesto, la pantalla lo muestra.
      if (!j.ok) { errorCarga = j.error || 'No se pudieron cargar las automatizaciones.'; throw new Error(errorCarga ?? ''); }
      const lista = j.secuencias as SecuenciaDto[];
      setSecuencias(lista); setRolAdmin(Boolean(j.rolAdmin));
      setSinCaso(Array.isArray(j.handoffs) ? (j.handoffs as Array<{ secuenciaId: number | null }>) : []);
      setObjetivos(j.objetivos ?? []); setEtapas(j.etapas ?? []);
      setProductos(j.productos ?? []); setDisparadores(j.disparadores ?? []);
      setTz(j.tz ?? null);
      setNegocio(j.negocio ?? '');
      setCanal(j.canal ?? { estado: 'desconocido', desde: null });
      estadoCanal = typeof j.canal?.estado === 'string' ? j.canal.estado : 'desconocido';
      setEnvioWa(typeof j.envioWhatsapp === 'boolean' ? j.envioWhatsapp : null);
      setError(null);
    } catch {
      setError(errorCarga ?? 'Sin conexión — recarga la página.');
      setSecuencias([]);
    }
    // Biblioteca de audios (admin-only: el 403 del setter deja la lista vacía).
    //
    // ⚠️ LA URL DE UN AUDIO YA CARGADO SE CONSERVA (#350). Cada `load()` vuelve a firmar
    // todas las URLs, y `load()` corre apenas se asigna un audio a un paso: el reproductor
    // del audio recién grabado cambiaba de `src` y volvía a 0 mientras sonaba. Es el
    // anti-parpadeo de la bandeja (EmpresaInbox). Pero la firma VENCE a las 12 h: la URL
    // vieja se conserva sólo mientras le quedan horas, y después se toma la nueva.
    try {
      const ra = await fetch('/api/chat-agent/audios', { cache: 'no-store' });
      const ja = await ra.json();
      if (ja.ok) {
        const ahora = Date.now();
        setAudios((prev) => {
          const urlPorId = new Map(prev.filter((a) => a.url).map((a) => [a.id, a.url] as const));
          return ((ja.audios ?? []) as AudioSetting[]).map((a) => {
            const firmada = firmaAudio.current.get(a.id);
            if (a.url && urlPorId.has(a.id) && firmada != null && ahora - firmada < URL_AUDIO_VIGENTE_MS) {
              return { ...a, url: urlPorId.get(a.id)! };
            }
            firmaAudio.current.set(a.id, ahora);
            return a;
          });
        });
      }
    } catch { /* sin audios */ }
    // ¿La tab arranca en su onboarding? (403 del setter → la ve normal)
    try {
      const ro = await fetch('/api/chat-agent/onboarding?tab=setting', { cache: 'no-store' });
      const jo = await ro.json();
      // ⚠️ Un 403 (el setter, que no es admin) SÍ ve la tab normal — es su caso
      // legítimo y por eso el fallback es `false`. Cualquier OTRA falla, no: si
      // no se pudo saber si el onboarding está completo, mostrar el dashboard es
      // afirmar que sí lo está. Es la misma regla que el paso del WhatsApp
      // oficial: «no pudimos preguntarlo» no es «está listo».
      const onboarding: OnboardingChatbot = jo.ok
        ? (jo.estado?.status === 'done' ? 'hecho' : 'pendiente')
        : (ro.status === 403 ? 'sin_permiso' : 'no_se_pudo');
      // ⚠️ EL ESTADO DE LA LÍNEA GANA AL TILDE (#745). El tilde de «Tu WhatsApp» se
      // guardaba una vez y nadie lo volvía a comparar: el ws9 lo tiene desde el 05/08 con
      // cero líneas, y veía el lienzo sin número. La regla vive en lib/chatbot-puerta.ts.
      // Y una vez a la vista el lienzo, un recargue no lo cambia salvo un 'sin_vincular'.
      const calculada = abreEnQR({ onboarding, canal: estadoCanal });
      setEnOnboarding((actual) => puertaAlRecargar({ actual, calculada, canal: estadoCanal }));
      // La línea ya conectada con el paso pendiente (vinculó por /whatsapp): se marca, o
      // «Tu forma de escribir» contesta «falta completar Tu WhatsApp» al terminarla.
      if (marcarWhatsappAlCargar({ onboarding, canal: estadoCanal })) void marcarPasoWhatsapp().catch(() => {});
    } catch (e) {
      // Sin red tampoco se afirma que está listo: se muestra el onboarding, que
      // es reversible (se sigue de largo), en vez del dashboard, que no lo es.
      // Salvo que el lienzo ya esté a la vista: un corte de red no saca a nadie de una edición.
      console.error('[chatbot] no se pudo leer el estado del onboarding:', e);
      setEnOnboarding((actual) => puertaAlRecargar({ actual, calculada: true, canal: estadoCanal }));
    }
  }, []);
  useEffect(() => { void load(); }, [load]);

  // ⛔ ACÁ SE LEÍAN LOS MENSAJES DE MAKO DE ANTES (`cargarAvisos`, quinta tanda), los que el negocio había
  // «eliminado» (`cargarOcultos`, novena tanda) y se recuperaban desde la galería (`restaurarMensaje`), todo por
  // el endpoint de Configuraciones › Notificaciones. Se fueron el 11/10/2026: un mensaje de «MaKo en WhatsApp» es
  // una fila más de `/api/chat-agent/secuencias` (lo trae `load()`), nace de la galería y se archiva como
  // cualquier automatización. Un setter lo ve como a las demás.

  /**
   * «NUEVA» (decisión 14 de la segunda tanda): una automatización VACÍA y pausada, y se abre su
   * lienzo con la caja de «Crear con IA». Empezar de cero es tocar el ＋ del CRON. (Hasta el 10/10/2026
   * recibía un `pedido` que precargaba la caja: lo mandaba «Armar una» del pie, que salió.)
   *
   * ⚠️ AL INSTANTE (tercera tanda, decisión 7). Martín: «al apretarlo… si se tarda en crearlo, un
   * loader... Mejor si se crea automáticamente la tarjeta en la sidebar y se abre el lienzo, y que el
   * loader en todo caso esté al entrar al lienzo… para esas 2 acciones no debería tardar nada».
   * Antes la fila aparecía DESPUÉS del POST y del `load()` entero. Ahora:
   *   1. la fila «Nueva automatización» aparece YA al final de la lista (`creando` +
   *      `listaConCreando`), elegida, con el lienzo abierto y su loader adentro;
   *   2. cuando el server contesta, la fila toma su id real (la selección la sigue por su clave) y
   *      el `load()` trae la de verdad, que la reemplaza sola: mismo id;
   *   3. si falla, la fila se va —vuelve la que estaba elegida— y el error queda pegado al botón.
   * `creando` es un ESTADO aparte y no una fila metida en `secuencias`: un `load()` de otra pantalla
   * en el medio la borraría.
   */
  const crearNueva = async () => {
    if (creandoNueva.current) return;
    creandoNueva.current = true;
    setErrCrear(null);
    const temporal = -Date.now();
    setCreando({ temporal, id: null });
    setAbrirSec({ id: temporal });
    try {
      const r = await (await fetch('/api/chat-agent/secuencias', { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify({ action: 'crear_vacia' }) })).json();
      if (!r?.ok || !(Number(r.secuenciaId) > 0)) { setErrCrear(r?.error ?? 'No se pudo crear'); return; }
      // (Acá se guardaba `arranque`: el tipo de CRON elegido en «¿Qué la dispara?» del modal, que abría su CRON en
      // ese tipo. Se fue con esos botones en la décima tanda: «eso ya lo hacemos dentro en el CRON».)
      setCreando({ temporal, id: Number(r.secuenciaId) });
      await load();
    } catch { setErrCrear('Sin conexión — prueba de nuevo.'); } finally { setCreando(null); creandoNueva.current = false; }
  };
  /**
   * «＋ Nueva»: la galería. «Lienzo en blanco» es `crearNueva`, la de siempre (la galería no tiene su propia copia).
   * «＋ Nuevo mensaje» la abre con el filtro «MaKo en WhatsApp» puesto (`seccion: 'mako'`).
   */
  const abrirGaleria = (seccion?: SeccionGaleria) => { setErrCrear(null); setGaleria({ seccion }); };
  /**
   * LA QUE ARMÓ MaKo DESDE «PÍDESELO A MaKo» (décima tanda, punto 6): ya está GUARDADA y pausada (la fila nació al
   * guardar, lib/flujo-ia-crear.ts). Se cierra el modal, se trae la lista y se abre; el aviso que más importa («Elige
   * qué la dispara en el CRON») queda pegado al botón, como el de una plantilla.
   */
  const alCrearConIA = async (r: CreadaConIAGaleria) => {
    setGaleria(false);
    setErrCrear(resumenAvisos(r.avisos)?.texto ?? null);
    await load();
    setAbrirSec({ id: r.secuenciaId });
  };
  /**
   * CREAR DESDE LO COPIADO (copiar flujo, 10/10/2026): el aviso al entrar a la tab y «Pegar lo copiado» del
   * modal. Nace APAGADA (lib/flujo-copia-negocio.ts); lo que no existe en este negocio queda vacío y en rojo.
   */
  const crearDesdeCopia = async (texto: string) => {
    setErrCrear(null);
    try {
      const r = await (await fetch('/api/chat-agent/secuencias', { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify({ action: 'crear_desde_copia', copia: texto }) })).json();
      if (!r?.ok || !(Number(r.secuenciaId) > 0)) { setErrCrear(r?.error ?? 'No se pudo pegar'); return; }
      setErrCrear(typeof r.aviso === 'string' ? r.aviso : null);
      await load();
      setAbrirSec({ id: Number(r.secuenciaId) });
    } catch { setErrCrear('Sin conexión — prueba de nuevo.'); }
  };
  /**
   * «COPIASTE UN FLUJO, ¿LO CREO?» (10/10/2026: «al entrar a la tab de automations, si detecta que tenes
   * copiado un flujo nuevo, que te proponga crearlo»). Se mira el portapapeles al entrar y al volver a la
   * pestaña. Leerlo puede pedir permiso al navegador; sin permiso, no hay aviso. «Ahora no» se recuerda
   * por COPIA (su firma, en este navegador): la misma copia no se vuelve a ofrecer, una nueva sí.
   */
  const [ofrecerCopia, setOfrecerCopia] = useState<{ texto: string; nombre: string; firma: string } | null>(null);
  useEffect(() => {
    if (!rolAdmin) return;
    const mirar = () => {
      if (typeof navigator === 'undefined' || !navigator.clipboard?.readText || document.visibilityState !== 'visible') return;
      navigator.clipboard.readText().then((t) => {
        const c = leerCopia(t);
        if (!c || c.que !== 'flujo') return;
        const firma = firmaDeCopia(t);
        let vista = false;
        try { vista = localStorage.getItem('mako.copia-ofrecida') === firma; } catch { /* sin storage */ }
        if (!vista) setOfrecerCopia({ texto: t, nombre: c.nombre ?? 'Automatización', firma });
      }).catch(() => { /* sin permiso o sin foco: no se ofrece */ });
    };
    mirar();
    window.addEventListener('focus', mirar);
    return () => window.removeEventListener('focus', mirar);
  }, [rolAdmin]);
  const descartarCopia = (crear: boolean) => {
    const o = ofrecerCopia;
    setOfrecerCopia(null);
    if (!o) return;
    try { localStorage.setItem('mako.copia-ofrecida', o.firma); } catch { /* sin storage */ }
    if (crear) void crearDesdeCopia(o.texto);
  };
  /** Una creada desde una plantilla: se trae la lista y se abre su lienzo. El aviso (la etapa no se pudo guardar) va pegado al botón. */
  const alCrearDePlantilla = async (r: CreadaGaleria) => {
    setGaleria(false);
    setErrCrear(r.aviso);
    await load();
    setAbrirSec({ id: r.secuenciaId });
  };
  /** La lista que se dibuja: la del server más la fila que se está creando (`listaConCreando`). */
  const visibles = secuencias === null ? null : listaConCreando(secuencias, creando);
  /**
   * EL RECORRIDO DE LA TAB (décima tanda, GENERAL 8: «tal como lo tenemos en el tutorial de "CURSO"»),
   * ./RecorridoAutomations.tsx. Se abre solo, a quien arma (un admin, como el de CURSO), la primera vez que ve la
   * lista con su lienzo: nunca con el cartel vacío, con la galería encima ni mientras se crea una. El «?» es de
   * todos. Va antes de los `return` de abajo (AGENTS.md: ningún hook detrás de un return).
   */
  const recorrido = useRecorridoAutomations(rolAdmin && enOnboarding === false && visibles !== null && visibles.length > 0 && creando === null && !galeria);

  // ── El ancla del deep link ────────────────────────────────────────────────
  // Se aplica UNA sola vez. Sin el ref, cada render volvería a forzar la sub-tab
  // y el usuario no podría moverse de donde lo dejó el link: el parámetro sigue
  // en la URL, así que el efecto lo re-aplicaría para siempre. Es el mismo
  // cuidado que `lastSearchRef` en /whatsapp.
  const params = useSearchParams();
  /**
   * Y LA URL DICE LA QUE SE ESTÁ VIENDO (décima tanda, NUEVA AUTOMATIZACIÓN 9). La lista avisa la elegida
   * (`onElegida`, SimuladorWhatsApp) y acá se escribe `?sec=` con el router de app/_ui/Link (conserva el `?ws=`) y
   * `scroll: false`, sin tocar el resto de la query. El ancla de abajo lo lee como un cambio y vuelve a pedir la misma:
   * la lista no hace nada (`elegir` ignora la que ya está elegida).
   */
  const router = useRouter();
  const escribirSec = useCallback((id: number) => {
    const q = new URLSearchParams(params.toString());
    if (q.get('sec') === String(id)) return;
    q.set('sec', String(id));
    router.replace(`/automations?${q.toString()}`, { scroll: false });
  }, [params, router]);
  const anclaAplicada = useRef(false);
  // ⚠️ El ancla se aplicaba UNA sola vez por montaje, y el App Router NO remonta el client
  // component al cambiar el query: estando ya en /automations, el segundo aviso de plantilla
  // rechazada no hacía nada. Se compara la query entera, como en /whatsapp.
  const ultimaQuery = useRef('');
  useEffect(() => {
    const q = params.toString();
    const cambio = q !== ultimaQuery.current;
    ultimaQuery.current = q;
    if (anclaAplicada.current && !cambio) return;
    // ⚠️ `?stab=` YA NO ELIGE NADA: las cuatro sub-tabs se fueron el 05/10 y la tab es
    // UNA sola pantalla. Los links viejos (`?stab=plantillas`, `?stab=dashboard`) caen
    // acá y abren el Chatbot, que es lo correcto: un parámetro que ya no existe no
    // puede dejar la pantalla en blanco. Las plantillas de Meta viven en /whatsapp y
    // los números en /chat-analyst.
    const sec = params.get('sec');
    if (!sec) { anclaAplicada.current = true; return; }
    // Hay que esperar a que carguen: sin la lista no se puede resolver ni la
    // clave ni comprobar que el id exista. Y comprobar que exista importa —
    // abrir un id de otro workspace mostraría una secuencia vacía en vez de
    // decir que no está.
    if (secuencias === null) return;
    // Se acepta el id numérico Y la clave («noshow»): MaKo arma el link desde el
    // catálogo de capacidades, donde tiene el nombre de la secuencia y no
    // siempre su id.
    const n = Number(sec);
    const hallada = Number.isInteger(n) && n > 0
      ? secuencias.find((s) => s.id === n)
      : secuencias.find((s) => s.clave === sec);
    // Un objeto NUEVO por pedido: el mismo id en un segundo aviso vuelve a abrirla.
    if (hallada) setAbrirSec({ id: hallada.id });
    anclaAplicada.current = true;
  }, [params, secuencias]);

  // (Acá iba el ancla del link de Notificaciones, `/automations?aviso=<id>`, que abría el lienzo de un Mensaje
  // de MaKo de antes. Se fue el 11/10/2026: ese link ya no lo arma nadie, y uno viejo abre la lista de siempre.
  // Un mensaje de «MaKo en WhatsApp» es una automatización y se abre con `?sec=`, como todas.)

  const etiquetaEtapa = useCallback(
    (key: string) => etapas.find((e) => e.value === key)?.label ?? ETAPA_LABEL[key] ?? key,
    [etapas],
  );

  // Mientras no sabemos si va el onboarding o la tab, NO se pinta ninguna de
  // las dos: mostrar la tab y reemplazarla medio segundo después por el wizard
  // es un flash que hace sentir la app rota.
  // OJO con `height: '100vh'` en este main: es hijo de una columna flex, y
  // `flex: 1` implica `flex-basis: 0%`, que ANULA el height. El main colapsa a
  // la altura del spinner y el `alignItems: center` no tiene nada que centrar →
  // loader diminuto pegado al techo. Va `minHeight`, que sí manda.
  if (enOnboarding === null) {
    return (
      <main style={{ flex: 1, minWidth: 0, minHeight: '100vh', display: 'flex', flexDirection: 'column', alignItems: 'center', justifyContent: 'center', gap: 14 }}>
        <style>{'@keyframes mako-spin{to{transform:rotate(360deg)}}'}</style>
        <span style={{ width: 34, height: 34, border: '3px solid var(--border)', borderTopColor: 'var(--accent-soft)', borderRadius: '50%', display: 'inline-block', animation: 'mako-spin .8s linear infinite' }} />
        <span style={{ fontSize: 14, color: 'var(--dim)' }}>Abriendo Automations…</span>
      </main>
    );
  }

  // Sin línea vinculada, la tab ES el QR: ocupa la pantalla en vez de abrir un pop-up sobre
  // un lienzo que todavía no puede mandar nada. `EvolutionConnect` es la misma pieza que usa
  // /whatsapp —ahí viven el sondeo, el QR y la recuperación de una sesión caída— y en modo
  // `inline` se dibuja sola y desaparece en cuanto engancha.
  //
  // (Hasta el 11/10/2026 el link `?aviso=<id>` de Notificaciones pasaba por encima del QR: era el único lugar
  // donde se editaba un Mensaje de MaKo. Esos mensajes son hoy automatizaciones de esta lista, y el link se fue.)
  if (enOnboarding) {
    return (
      <main style={{ flex: 1, minWidth: 0, minHeight: '100vh', display: 'flex', flexDirection: 'column', padding: '30px 36px 24px', gap: 16 }}>
        <div>
          <h1 style={{ fontWeight: 600, fontSize: 34, letterSpacing: '-0.025em', margin: 0, color: 'var(--ink)' }}>Automations</h1>
          <p style={{ fontSize: 14, color: 'var(--dim)', margin: '6px 0 0' }}>Vincula tu WhatsApp para armar tus automatizaciones.</p>
        </div>
        <EvolutionConnect inline onEstado={(e) => {
          if (e !== 'conectado') return;
          // El canal se da por conectado EN EL ACTO: si no, el lienzo abría con el aviso rojo
          // de «todavía no vinculaste tu WhatsApp» hasta que volviera el `load()`.
          setCanal({ estado: 'conectado', desde: null });
          setEnOnboarding(false);
          // Vincular desde ACÁ también marca el paso (#745): antes sólo cambiaba el estado
          // local, y lo demás que lee el tilde (lo que MaKo sabe del negocio, «¿está listo?»)
          // seguía diciendo «falta Tu WhatsApp» sobre un número conectado. En paralelo con el
          // recargue: si falla, el lienzo abre igual (la puerta mira la línea, no el tilde).
          void marcarPasoWhatsapp().catch(() => {});
          void load();
        }} />
      </main>
    );
  }

  /** Prende el envío real de WhatsApp (#328). Lo valida el server: exige un número conectado. */
  async function prenderEnvio() {
    setPrendiendo(true); setErrEnvio(null);
    try {
      const r = await fetch('/api/whatsapp/envio', {
        method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify({ on: true }),
      });
      const j = await r.json().catch(() => ({}));
      if (!r.ok || !j.ok) { setErrEnvio(j.error || 'No se pudo prender.'); return; }
      setEnvioWa(Boolean(j.envioHabilitado));
    } catch {
      setErrEnvio('Sin conexión.');
    } finally {
      setPrendiendo(false);
    }
  }

  return (
    // ⚠️ LA TAB ESTIRA CON FLEX Y NO SCROLLEA: el lienzo de abajo se lleva todo el alto
    // que sobre. Con `overflowY: auto` acá y un alto calculado adentro, el lienzo quedaba
    // chico y la pantalla a medio llenar — que es lo que Martín marcó dos veces. La regla
    // está en AGENTS.md: una vista a pantalla completa estira con flex, `height: 100%` no
    // existe, y el hijo que estira lleva `flex: 1` + `minHeight: 0`.
    // ⚠️ EL PADDING SE FUE DEL <main> Y VIVE EN CADA FRANJA. Con padding acá, la fila
    // del editor arranca a 28 px del borde y el lienzo queda adentro de un marco — que
    // es lo que Martín marcó tres veces. Ahora el título y los avisos llevan el suyo y
    // el lienzo llega al borde de la tab.
    <main style={{ flex: 1, minWidth: 0, height: '100vh', overflow: 'hidden', display: 'flex', flexDirection: 'column' }}>
      {/* ⚠️ EL ENCABEZADO SE DESARMÓ EL 05/10/2026, y lo que se fue no fue por estética
          (Martín, textual): «Elimina las pestañas, ya no hay "Email" si todo se crea en
          un mismo lugar… Ya no hay plantillas si todo es lo mismo… Y la pestaña de
          dashboard ponlo en una nueva ruta dentro de "Analysts"», «Elimina el botón
          grande de "Nueva secuencia", si ya tenemos otro para eso… elimina lo de
          "Archivar todo…", elimina "Tus secuencias: pruébalas como el lead…"».

          Las cuatro sub-tabs partían UNA cosa en cuatro pantallas: el email y el
          WhatsApp son dos canales de la MISMA secuencia y se arman en el mismo lienzo,
          las plantillas de Meta son del canal oficial —que ya no gobierna este editor—
          y los números son otra pregunta, así que viven en /chat-analyst.

          Y los dos botones de la derecha: el de crear ya está en la grilla (la tarjeta
          punteada), y «Archivar todas» era una salida de emergencia para las secuencias
          que el sistema sembraba solo, que hace rato no se siembran. */}
      {/* ⚠️ ACÁ HABÍA UN <header> CON «Chatbot», Y SE FUE EL 05/10/2026.
          Martín, con la captura de /mensajes al lado: «elimina todo el título y la
          topbar, ahí debe estar la grilla».

          Es la tercera pasada del mismo pedido —antes cayeron las cuatro sub-tabs y los
          dos botones grandes— y lo que lo cierra es que el lienzo arranque en el borde
          de arriba. El nombre de la tab ya lo dice la navegación de la izquierda, que es
          la que contesta «dónde estoy»; repetirlo acá costaba 46 px de pizarra, que es
          lo único que esta pantalla tiene para dar.

          Lo que una pantalla sin cabecera SÍ necesita es que el editor diga qué se está
          editando: el nombre vive flotando sobre el lienzo, y es editable. */}

      {/* EL NÚMERO CAÍDO CON LAS SECUENCIAS EN VERDE.
          Una secuencia dice «Activa» y eso se lee como que está enviando. Si el
          WhatsApp del negocio está desconectado, no envía nada: cada paso falla
          y se reintenta al día siguiente, para siempre y sin síntoma. Pasó en la
          cuenta del dueño — la sesión se cayó el 3/09, la tab siguió en verde, y
          el primer lead real de la secuencia recién prendida no recibió nada.
          El estado del número solo se veía en el onboarding, o sea justo hasta
          que el dueño lo terminaba.
          Solo se avisa si hay alguna secuencia ACTIVA: con todo pausado, el
          número desconectado no rompe nada y el aviso sería ruido. */}
      {canalCaido && (secuencias ?? []).some((s) => s.activa) && (
        <div style={{ flex: 'none', background: 'var(--bad-bg)', border: '1px solid var(--bad)', borderRadius: 12, padding: '12px 16px', margin: '0 24px 12px', display: 'flex', alignItems: 'center', gap: 12, flexWrap: 'wrap' }}>
          <span style={{ color: 'var(--bad)', display: 'inline-flex' }}><Icon name="alert" size={17} /></span>
          <div style={{ fontSize: '13.5px', color: 'var(--ink)', flex: 1, minWidth: 220 }}>
            {canal.estado === 'sin_vincular' ? (
              <>Tienes automatizaciones activas y <strong>todavía no vinculaste tu WhatsApp</strong>. No se está enviando nada.</>
            ) : (
              canal.desvinculado ? (
                // ⚠️ EL DUEÑO LEYO «tu WhatsApp esta desconectado», ABRIO WHATSAPP
                // Y LO ENCONTRO PERFECTO. Y era cierto: su TELEFONO anda. Lo que
                // se cayo es el dispositivo vinculado que usa MaKo, y eso no se
                // nota desde el telefono salvo mirando «Dispositivos vinculados».
                // Nombrar el hecho —y decir que su telefono esta bien— es la
                // diferencia entre un aviso que se cree y uno que se descarta.
                <>Tienes automatizaciones activas y <strong>WhatsApp cerró la sesión del dispositivo vinculado</strong>
                  {canal.desde ? <> el {new Date(canal.desde).toLocaleDateString('es-MX', { day: 'numeric', month: 'long' })}</> : null}.
                  {' '}Tu teléfono está bien: lo que hay que volver a vincular es el dispositivo que usa MaKo.
                  {' '}Mientras tanto no se envía nada.</>
              ) : (
                <>Tienes automatizaciones activas y <strong>tu WhatsApp está desconectado</strong>
                  {canal.desde ? <> desde el {new Date(canal.desde).toLocaleDateString('es-MX', { day: 'numeric', month: 'long' })}</> : null}.
                  {' '}No se está enviando nada: cada mensaje falla y se reintenta al día siguiente.</>
              )
            )}
          </div>
          <Link href="/whatsapp" style={{ ...btnDark, textDecoration: 'none', whiteSpace: 'nowrap' }}>Volver a conectarlo</Link>
        </div>
      )}

      {/* EL ENVÍO APAGADO CON LAS SECUENCIAS EN VERDE (#328). Es un interruptor aparte de
          la línea: con el número conectado y esto apagado no sale nada, y sólo se veía en la
          pastilla de /whatsapp. Medido el 06/10: el ws1 lo tenía apagado desde el 29/09 con
          dos secuencias activas. No se dice POR QUÉ se apagó: no queda registrado quién lo
          tocó, y una causa inventada es peor que ninguna. Con la línea caída no va: el aviso
          rojo de arriba ya dice que no sale nada. */}
      {!canalCaido && envioWa === false && (secuencias ?? []).some((s) => s.activa && s.pasos.some((p) => p.canal === 'whatsapp' && !esPasoAccion(p))) && (
        <div style={{ flex: 'none', background: 'var(--warn-bg)', border: '1px solid var(--warn)', borderRadius: 12, padding: '12px 16px', margin: '0 24px 12px', display: 'flex', alignItems: 'center', gap: 12, flexWrap: 'wrap' }}>
          <span style={{ color: 'var(--warn)', display: 'inline-flex' }}><Icon name="alert" size={17} /></span>
          <div style={{ fontSize: '13.5px', color: 'var(--ink)', flex: 1, minWidth: 220 }}>
            <strong>El envío de WhatsApp está apagado.</strong> Tus automatizaciones activas no mandan nada.
            {errEnvio && <span style={{ color: 'var(--bad)' }}> {errEnvio}</span>}
          </div>
          {rolAdmin && (
            <button onClick={() => void prenderEnvio()} disabled={prendiendo} style={{ ...btnDark, whiteSpace: 'nowrap', opacity: prendiendo ? 0.6 : 1 }}>
              {prendiendo ? 'Prendiendo…' : 'Prender el envío'}
            </button>
          )}
        </div>
      )}

      {error && (
        <div style={{ flex: 'none', background: 'var(--bad-bg)', border: '1px solid var(--bad)', borderRadius: 12, padding: '12px 16px', margin: '0 24px 12px', color: 'var(--bad)', fontSize: '13.5px' }}>{error}</div>
      )}

      {secuencias === null && !error && <div style={{ color: 'var(--dim)', fontSize: '14px' }}>Cargando automatizaciones…</div>}

      {visibles !== null && visibles.length === 0 && !error && (
        <div style={{ background: 'var(--surface)', border: '1px dashed var(--border-strong)', borderRadius: 14, padding: '28px 24px', color: 'var(--dim)', fontSize: '14px' }}>
          Todavía no hay automatizaciones.
          {rolAdmin && (
            <div style={{ marginTop: 14, display: 'flex', alignItems: 'center', gap: 10, flexWrap: 'wrap' }}>
              <button onClick={() => abrirGaleria()} style={btnDark}>＋ Nueva</button>
              {/* CONFIGURACIONES TAMBIÉN ACÁ (era el horario): sin ninguna automatización la lista no se dibuja,
                  y un negocio nuevo no tenía dónde ponerlo «allí mismo». */}
              <ConfiguracionesBoton />
              <AyudaAutomations onClick={recorrido.reabrir} />
              {errCrear && <span role="alert" style={{ fontSize: 13, color: 'var(--bad)' }}>{errCrear}</span>}
            </div>
          )}
        </div>
      )}


      {/* EL QUE ESTIRA, Y PEGADO A LOS BORDES. Todo lo de arriba es `flex: none` con su
          propio padding; esto se lleva el alto que sobra y llega hasta el borde de la
          tab, que es lo que significa «que ocupe TODA la tab». */}
      {visibles !== null && visibles.length > 0 && (
        <SimuladorWhatsApp
          secuencias={visibles} objetivos={objetivos} etiquetaEtapa={etiquetaEtapa} productos={productos} disparadores={disparadores}
          negocio={negocio} rolAdmin={rolAdmin} audios={audios} canalCaido={canalCaido} tz={tz} onAudioNuevo={(a) => setAudios((prev) => [a, ...prev.filter((x) => x.id !== a.id)])}
          onNueva={abrirGaleria} errorNueva={errCrear} onReload={() => void load()}
          abrir={abrirSec} onElegida={escribirSec}
          handoffs={sinCaso}
          /* CONFIGURACIONES, ahí mismo en la lista (décima tanda, GENERAL 4; era el botón del horario, 10/10/2026:
             «haz que se pueda configurar allí mismo, sin redirigir»): un modal con el horario de oficina y los
             límites. El admin edita; el resto ve. Va como nodo y no adentro de la lista: ver `horario` en
             SimuladorWhatsApp (las acciones arrastran `server-only`). */
          horario={(
            // El «?» del recorrido va al lado del horario: los dos son de la tab entera, no de una automatización.
            <span style={{ display: 'inline-flex', alignItems: 'center', gap: 4 }}>
              <ConfiguracionesBoton />
              <AyudaAutomations onClick={recorrido.reabrir} />
            </span>
          )}
          /* ⚠️ ACÁ IBA EL PIE DE LA LISTA, «N etapas sin secuencia · Armar una», y salió el 10/10/2026
             (restos de versiones anteriores). Venía del modelo de UNA secuencia por etapa de
             nutrición, contaba sólo el primer CRON de cada automatización (ni `etapas` ni la lista de
             CRON de la mig 0241), miraba sólo el embudo por default y hablaba de «secuencias». Si
             vuelve, se rehace sobre los CRON (`vistasPorDisparador`, lib/disparadores.ts) y pasa por
             la puerta de crear de la lista (`nueva`), que pregunta por lo no publicado. */
        />
      )}

      {/* LA GALERÍA de «＋ Nueva» (sólo un admin crea). «Lienzo en blanco» es la vacía de siempre. */}
      {galeria && rolAdmin && (
        <GaleriaPlantillas productos={productos} onCerrar={() => setGaleria(false)} seccion={galeria.seccion}
          onBlanco={() => { setGaleria(false); void crearNueva(); }}
          onPegar={(t) => { setGaleria(false); void crearDesdeCopia(t); }}
          onCreada={(r) => void alCrearDePlantilla(r)}
          onCreadaIA={(r) => void alCrearConIA(r)}
          // El recordatorio de la reunión es UNO por negocio: si ya está en la lista, su plantilla se dibuja apagada.
          triggersVivos={(secuencias ?? []).map((s) => s.trigger_tipo)} />
      )}

      {/* «COPIASTE UN FLUJO»: arriba al centro, sobre el lienzo, hasta que se conteste. */}
      {ofrecerCopia && (
        <div role="dialog" aria-label="Crear lo copiado" style={{
          position: 'fixed', top: 18, left: '50%', transform: 'translateX(-50%)', zIndex: 58,
          display: 'flex', alignItems: 'center', gap: 12, padding: '10px 12px 10px 16px', borderRadius: 14,
          background: 'var(--surface)', border: '1px solid var(--border-strong)', boxShadow: '0 12px 32px rgba(0,0,0,.16)', fontSize: 13.5, color: 'var(--ink)',
        }}>
          <span>Copiaste «<strong>{ofrecerCopia.nombre}</strong>». ¿Crearla?</span>
          <button type="button" onClick={() => descartarCopia(true)} style={{ ...btnDark, padding: '7px 14px', fontSize: 13 }}>Crear</button>
          <button type="button" onClick={() => descartarCopia(false)} style={{ padding: '7px 10px', border: 'none', background: 'transparent', color: 'var(--dim)', fontSize: 13, fontWeight: 600, cursor: 'pointer', fontFamily: 'inherit' }}>Ahora no</button>
        </div>
      )}

      {/* EL RECORRIDO (GENERAL 8): su capa y sus marcas. Va adentro del <main>: busca lo que señala acá adentro. */}
      <RecorridoAutomations abierto={recorrido.abierto} onCerrar={recorrido.onCerrar} />
    </main>
  );
}

/**
 * Primera pantalla del Chatbot cuando no hay NADA configurado: en vez de
 * empujar los 11 pasos, se pregunta por dónde arrancar. Cada opción es un
 * recorrido real (lib/tab-onboarding-state.ts) y comparten los pasos, así que
 * elegir "solo WhatsApp" hoy y "todo" mañana no repite lo ya hecho.
 */
