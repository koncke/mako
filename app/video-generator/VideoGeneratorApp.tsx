'use client';

// =============================================================================
// VideoGeneratorApp — el cliente elige una plantilla y MaKo le hace el anuncio
// =============================================================================
// Esta pantalla se rehízo TRES veces, y las tres correcciones del dueño valen más
// que el código:
//
// 1. «Se ve horrible todo junto» — ocho formatos como tarjetas de texto, todos a
//    la vez. Un formato de video se elige VIENDO el anuncio, no leyéndolo.
// 2. «Aún se ve complejo y lleno de texto» — el guion estaba escrito dos veces y
//    los siete prompts abiertos a la vez.
// 3. «No tiene ningún sentido que la persona entre y vea prompts y guiones.
//    Jamás debe ver prompts. Lo PRIMERO que tiene que ver es el CATÁLOGO.»
//
// De la tercera salen las dos reglas que gobiernan este archivo:
//
// **EL PROMPT NO SE MUESTRA NUNCA.** Es un detalle de implementación de cómo MaKo
// fabrica el video, del mismo orden que la query SQL detrás de una tabla. El
// cliente compró «MaKo me hace los anuncios», no «MaKo me pasa instrucciones para
// que yo se las pegue a otra herramienta». Los prompts se generan, se guardan y
// los consume la producción — no la pantalla.
//
// **LA HOME ES EL CATÁLOGO, siempre.** No el último anuncio. Se entra a elegir
// una plantilla, no a leer lo que ya se hizo; lo hecho está abajo, después.
//
// El flujo: catálogo → tres preguntas → el anuncio.

import { useCallback, useEffect, useMemo, useState, useRef } from 'react';
import Link from '@/app/_ui/Link';
import {
  Pagina, PageHeader, Section, Button, Alert, Tag, Modal, Status, Spinner,
  ErrorState, Confirm, MONO,
} from '@/app/_ui';
import { Icon } from '../_components/icons';
import type { PlanGuardado, EstadoContextoVideo } from './video-datos';
import {
  guionATexto,
  puestaPorId, puestasOfrecidas, type Puesta,
} from './video-pedido';
import { generarPlanAction, editarLineaPlanAction, reescribirTomaAction } from './actions';
import { PuentePanel, AvisoPuente, abrirPuente, estadoDelPuente } from './PuentePanel';
import type { Puente } from '@/lib/flow-cola';
import { cabidaDeGuion, soloHablado } from '@/lib/puestas-data';
import type { GuionDisponible } from './guiones-datos';
import type { AnuncioHecho } from './anuncios-datos';
import { CargarGuiones } from './CargarGuiones';
import {
  SeccionCard, parsearSecciones, reconstruirSecciones, EditarTexto, ICONO_SECCION_GUION,
} from '../components/SeccionCard';
import { editarGuionAction } from './cargar-guiones-action';
import {
  generarTomaAction, estadoTomaAction, pedirSaldoAction, saldoAction, escribirEscenasAction,
} from './video-action';
import { WizardAnuncio, Estudio } from './WizardAnuncio';
import { PreviaVolante } from './PreviaVolante';
import { TemaOscuro } from '../_components/TemaOscuro';
import { causaFlow, textoFlow, type CausaFlow } from '@/lib/flow-fallo-texto';
import { useSearchParams } from 'next/navigation';
import { useRouter } from 'next/navigation';

/**
 * ⚠️ `ejemplo` ES UNA VISTA DE LA TAB, no un paso del anuncio.
 *
 * Martín: «me gustaría que el primer paso de todo sea… el de "Así se verá tu
 * anuncio" donde se ve el template que elegí».
 *
 * Antes era un `Paso` de `WizardAnuncio`, y eso lo ataba a que YA existiera un
 * plan guardado —su acción necesitaba un `item.id` que en ese momento no existe—.
 * Como vista, ocurre justo después de elegir la plantilla y antes de todo lo
 * demás, que es donde tiene sentido: lo primero que se ve es lo que se acaba de
 * elegir, grande.
 */
type Vista = 'catalogo' | 'ejemplo' | 'wizard' | 'anuncio';

// ⚠️ UN SOLO PASO, y los otros dos no se «simplificaron»: no debían existir.
//
// El dueño sacó los tres originales, cada uno por su motivo:
//
//   · «¿De qué habla tu anuncio?» — «jamás me debe preguntar eso, para eso ya
//     existen guiones creados dentro de MaKo, debe traer esos». Escribir el tema
//     de nuevo era pedirle que reescriba a mano lo que MaKo ya le escribió.
//   · «¿Cuánto tiene que durar?» — «no tiene sentido. Durará lo que dure el
//     guion. Punto.» Y es literal: `cabidaDeGuion` lo calcula con la densidad de
//     palabras por segundo de la puesta.
//   · «¿Con qué acento habla?» — es un atributo del CLIENTE, no del anuncio.
//     Nadie graba uno en norteño y el siguiente en rioplatense. Sale del
//     workspace (lib/acento-workspace.ts) y su lugar es el onboarding de la tab.
//
// La regla que queda: **esta tab no pregunta nada que el sistema ya sepa.**
const PASOS = ['guion', 'revisar'] as const;
type Paso = (typeof PASOS)[number];

const PREGUNTA: Record<Paso, string> = {
  guion: '¿Cuál de tus guiones quieres grabar?',
  revisar: 'Revisa antes de generar',
};

/**
 * Pinta el `**énfasis**` del guion en negrita.
 *
 * El modelo lo marca en markdown porque es la instrucción que mejor obedece —y el
 * énfasis importa: es la palabra que el avatar levanta—, pero los asteriscos
 * crudos en pantalla se leen como un error.
 */
function Enfasis({ texto }: { texto: string }) {
  // Índices impares = lo que estaba entre asteriscos. Un asterisco suelto deja su
  // tramo sin negrita en vez de romper el texto, que es lo conservador.
  const partes = texto.split(/\*\*/);
  return (
    <>
      {partes.map((t, i) => (i % 2 === 1 ? <strong key={i}>{t}</strong> : <span key={i}>{t}</span>))}
    </>
  );
}

// ── El catálogo: la plantilla es el video ────────────────────────────────────
// Un click SELECCIONA (marco azul + tilde) — no dispara el flujo. Quien dispara
// es el botón «Crear» de arriba, que es el único de la pantalla. Con un botón por
// tarjeta había tres formas de empezar y ninguna se leía como la principal.
//
// La descripción no está acá: vive en el detalle. En la tarjeta, el video ya dice
// cómo se ve y el nombre alcanza para nombrarlo.

function Plantilla({
  nombre, video, poster, elegida, onElegir, onDetalle,
}: {
  nombre: string; video: string; poster: string;
  /**
   * ⚠️ Recibe la CAJA del recorte, medida en el handler del click.
   *
   * Es de donde arranca el vuelo. Y se mide acá y no después porque la tarjeta se
   * desmonta en el mismo commit en que cambia la vista: un
   * `getBoundingClientRect()` en un efecto llegaría tarde y mediría un elemento
   * que ya no está en el documento.
   */
  elegida: boolean; onElegir: (caja?: DOMRect) => void; onDetalle: () => void;
}) {
  const recorte = useRef<HTMLDivElement>(null);
  return (
    <div style={{ width: 220 }}>
      <button
        type="button"
        onClick={() => onElegir(recorte.current?.getBoundingClientRect())}
        onDoubleClick={onDetalle}
        aria-pressed={elegida}
        style={{
          display: 'block', width: '100%', padding: 0, cursor: 'pointer',
          background: 'transparent', border: 'none', fontFamily: 'inherit',
          borderRadius: 'var(--r-md)',
          outline: elegida ? '2px solid var(--primary)' : '1px solid var(--border)',
          outlineOffset: elegida ? 2 : 0,
        }}
      >
        <div ref={recorte} style={{ position: 'relative', borderRadius: 'var(--r-md)', overflow: 'hidden', lineHeight: 0 }}>
          {/* Muted + playsInline: sin las dos, el navegador no deja autoplay. */}
          <video
            src={video}
            poster={poster}
            autoPlay
            loop
            muted
            playsInline
            style={{ width: '100%', display: 'block', aspectRatio: '9 / 16', objectFit: 'cover' }}
          />
          <div style={{
            position: 'absolute', inset: 'auto 0 0 0', padding: '30px 12px 11px',
            background: 'linear-gradient(to top, rgba(0,0,0,.75), transparent)',
            color: '#fff', fontSize: 'var(--fs-card)', fontWeight: 650, lineHeight: 1.25,
            textAlign: 'left',
          }}>
            {nombre}
          </div>
          {elegida && (
            <div style={{
              position: 'absolute', top: 9, right: 9, width: 26, height: 26, borderRadius: 999,
              // `--on-ink` y no `#fff`: en oscuro `--primary` es un azul CLARO
              // (#7FA6F8) y encima el blanco no se lee. El token existe para
              // esto y se da vuelta solo.
              background: 'var(--primary)', color: 'var(--on-ink)', display: 'grid', placeItems: 'center',
              boxShadow: '0 1px 6px rgba(0,0,0,.35)',
            }}>
              <Icon name="check" size={15} />
            </div>
          )}
        </div>
      </button>

      <button
        type="button"
        onClick={onDetalle}
        style={{
          display: 'block', width: '100%', marginTop: 7, padding: '5px 0',
          background: 'transparent', border: 'none', cursor: 'pointer',
          fontFamily: 'inherit', fontSize: 'var(--fs-sm)', color: 'var(--dim)',
          textDecoration: 'underline', textUnderlineOffset: 3,
        }}
      >
        Ver más detalles
      </button>
    </div>
  );
}

// ── El detalle: el anuncio entero, con audio ────────────────────────────────
// Acá vive todo lo que se sacó de la tarjeta. Y el anuncio completo con sonido,
// que es la única forma de juzgar de verdad un formato de video: en la tarjeta se
// ve cómo se mueve, acá se escucha cómo suena.

/**
 * El guion entero, con lo que la card ya no muestra.
 *
 * La card quedó con el título solo porque para ELEGIR alcanza con el nombre. Lo
 * que se sacó no se perdió: vive acá, que es donde se mira cuando se duda.
 *
 * El texto va con sus rótulos de sección visibles —GANCHO, HISTORIA, CTA— porque
 * son la estructura del guion, no ruido: quien lo va a grabar necesita ver dónde
 * abre y dónde cierra.
 */
/** Una fila «rótulo: valor» del paso de revisión. */
function Fila({ k, v, nota }: { k: string; v: string; nota?: string }) {
  return (
    <div style={{ display: 'flex', gap: 10, alignItems: 'baseline', flexWrap: 'wrap' }}>
      <span style={{ fontSize: 'var(--fs-sm)', color: 'var(--faint)', minWidth: 86 }}>{k}</span>
      <span style={{ fontSize: 'var(--fs-md)', color: 'var(--ink)', fontWeight: 600 }}>{v}</span>
      {nota && <span style={{ fontSize: 'var(--fs-meta)', color: 'var(--faint)' }}>({nota})</span>}
    </div>
  );
}

function DetalleGuion({
  guion, puesta, onCerrar, onUsar, onEditado,
}: {
  guion: GuionDisponible;
  puesta?: Puesta;
  onCerrar: () => void;
  onUsar: () => void;
  /** El guion cambió en el server: hay que volver a bajarlo. */
  onEditado: () => void;
}) {
  /*
    El texto vive en estado local mientras el modal está abierto.

    No se lee de `guion.texto` directamente porque guardar dispara un
    `router.refresh()` y las props tardan un viaje en volver: sin copia local, la
    frase recién escrita parpadearía a la versión vieja antes de asentarse. Se
    escribe optimista y el refresh confirma.
  */
  const [texto, setTexto] = useState(guion.texto);
  const [guardando, setGuardando] = useState(false);
  const [errorEdit, setErrorEdit] = useState<string | null>(null);

  const cab = puesta ? cabidaDeGuion(puesta, soloHablado(texto)) : null;
  const secciones = parsearSecciones(texto, undefined, 20);

  const guardar = useCallback(async (nuevo: string) => {
    setTexto(nuevo);
    setGuardando(true); setErrorEdit(null);
    try {
      const out = await editarGuionAction(guion.id, nuevo);
      if (!out.ok) { setErrorEdit(out.error); return; }
      onEditado();
    } catch (e) {
      setErrorEdit(e instanceof Error ? e.message : 'No se pudo guardar.');
    } finally {
      setGuardando(false);
    }
  }, [guion.id, onEditado]);
  return (
    <Modal
      titulo={guion.angulo || 'Sin título'}
      encabezado={guion.estructura || undefined}
      onCerrar={onCerrar}
      ancho={720}
      pie={
        <Button variant="mako" onClick={onUsar} icon={<Icon name="ia" size={15} />}>
          Usar este guion
        </Button>
      }
    >
      <div style={{
        display: 'flex', alignItems: 'center', gap: 10, flexWrap: 'wrap',
        fontSize: 'var(--fs-meta)', color: 'var(--faint)', marginBottom: 14,
      }}>
        <span>{guion.palabras} palabras</span>
        {cab && (
          <>
            <span>·</span>
            <span>{cab.segundosReales}s en {cab.clips} tomas{puesta ? ` con ${puesta.nombre}` : ''}</span>
          </>
        )}
        {guion.yaUsado && (
          <Tag color="var(--good)" icon={<Icon name="check" size={12} />}>
            Generado{guion.grabadoEn.length > 0 ? ` en ${guion.grabadoEn.join(' y ')}` : ''}
          </Tag>
        )}
      </div>

      {cab?.desborda && (
        <div style={{ marginBottom: 14 }}>
          <Alert tono="warn">
            No entra en <strong>{puesta?.nombre}</strong>: sobran {cab.palabrasDeMas} palabras.
            El final quedaría afuera.
          </Alert>
        </div>
      )}

      {/*
        El guion se lee por BLOQUES, con el mismo template desplegable que el
        lector de /ads-writer y la matriz del onboarding. Un guion es texto
        largo, y un muro de texto largo dentro de un modal con scroll propio no
        se lee: se hojea.

        El primero abierto y el resto cerrados: el GANCHO son los 3-5 segundos
        que deciden si el anuncio funciona, y es lo unico que hace falta ver
        para reconocer un guion sin leerlo entero.

        Si el guion no tiene rotulos —los cargados antes de que MaKo los
        ordenara, o uno donde el modelo no pudo— `parsearSecciones` devuelve
        vacio y se cae al texto plano. Un guion sin bloques se sigue leyendo.
      */}
      {errorEdit && <Alert tono="bad">{errorEdit}</Alert>}

      {secciones.length > 0 ? (
        <div style={{ display: 'flex', flexDirection: 'column', gap: 9, maxHeight: '52vh', overflowY: 'auto' }}>
          {secciones.map((s, i) => (
            <SeccionCard
              key={s.titulo + i}
              s={s}
              abiertoDefault={i === 0}
              icono={ICONO_SECCION_GUION[s.titulo] ?? '\u{1F3AC}'}
              size="sm"
            >
              <EditarTexto
                valor={s.texto}
                multiline
                disabled={guardando}
                onSave={(v) => void guardar(reconstruirSecciones(
                  secciones.map((sec, j) => (j === i ? { ...sec, texto: v } : sec)),
                ))}
                style={{ fontSize: 'var(--fs-sm)', color: 'var(--ink)', lineHeight: 1.6 }}
              />
            </SeccionCard>
          ))}
        </div>
      ) : (
        // Un guion sin rótulos —cargado antes de que MaKo los pusiera, o uno
        // donde el modelo no pudo— se edita ENTERO. No se pierde ni se bloquea:
        // el que no tiene bloques es justamente el que más ganas dan de corregir.
        <div style={{ maxHeight: '52vh', overflowY: 'auto' }}>
          <EditarTexto
            valor={texto}
            multiline
            disabled={guardando}
            onSave={(v) => void guardar(v)}
            style={{
              fontSize: 'var(--fs-md)', lineHeight: 1.7, color: 'var(--ink)',
              background: 'var(--surface-2)', border: '1px solid var(--border)',
              borderRadius: 10, padding: '12px 14px', margin: 0,
            }}
          />
        </div>
      )}

      {/* Que se puede escribir encima no se descubre solo: el campo se ve igual
          que un texto hasta que alguien le hace clic. Una línea lo dice. */}
      <div style={{ fontSize: 'var(--fs-meta)', color: 'var(--faint)', marginTop: 10 }}>
        {guardando ? 'Guardando…' : 'Haz clic en cualquier parte del guion para corregirlo.'}
      </div>
    </Modal>
  );
}

/**
 * Un anuncio terminado.
 *
 * Se reproduce ACÁ, con controles, en vez de abrir un modal: un anuncio de un
 * minuto se mira, no se explora, y meterle un paso de por medio a algo que ya
 * está hecho no agrega nada. Sin `autoPlay` y sin `loop` — cuatro videos
 * arrancando solos al abrir la pantalla es lo contrario de una galería.
 */
/**
 * Un anuncio terminado. Es una FILA, no una tarjeta.
 *
 * ⚠️ LA DIFERENCIA CON UNA PLANTILLA ES ESTRUCTURAL, no de color. El dueño:
 * «que se vea de una forma diferente a los template, está bien que se
 * previsualice, pero si son idénticos, se confunde».
 *
 * Y tenía razón: los dos eran un 9:16 de ~230 px en una grilla, así que la
 * pantalla mostraba dos paredes de videos verticales que se leían igual aunque
 * una fuera «lo que podés elegir» y la otra «lo que ya hiciste».
 *
 * La regla de la casa lo resuelve sin inventar nada: **un grupo de cosas del
 * mismo tipo es una lista con filete, no una pila de cajas.** Una plantilla es
 * algo que se ELIGE —y para eso hay que verla grande, en una pared donde
 * comparás—; un anuncio terminado es algo que se ABRE, y para eso alcanza con
 * reconocerlo. Miniatura chica a la izquierda, el nombre legible, y el video en
 * su tamaño real recién cuando lo pedís.
 *
 * Y el rótulo va POR FUERA del recorte, al revés que en las plantillas, donde va
 * quemado adentro. Es el mismo portador que ya usa el wizard: dentro contra
 * fuera dice «esto es un ejemplo» / «esto es tuyo» sin gastar una palabra, y
 * sobrevive a cualquier tema y a cualquier tamaño.
 */
function AnuncioFila({ a, onVer }: { a: AnuncioHecho; onVer: () => void }) {
  const puesta = puestaPorId(a.puestaId);
  const mm = Math.floor(a.duracionSeg / 60);
  const ss = String(Math.round(a.duracionSeg % 60)).padStart(2, '0');

  return (
    <button type="button" className="mk-anuncio" onClick={onVer}>
      {/* El póster CONGELADO, no el video: son varios en pantalla y el
          movimiento periférico es el captador de atención más fuerte que hay. */}
      <img src={a.poster} alt="" className="mk-anuncio__mini" />
      <span className="mk-anuncio__medio">
        <span className="mk-anuncio__nombre">{a.titulo}</span>
        <span className="mk-anuncio__meta">
          {mm}:{ss}
          {puesta ? ` · ${puesta.nombre}` : ''}
        </span>
      </span>
      <span className="mk-anuncio__chev"><Icon name="chevron" size={15} /></span>
    </button>
  );
}

function DetalleFormato({
  puesta, onCerrar, onUsar,
}: {
  puesta: Puesta;
  onCerrar: () => void;
  /**
   * Opcional a propósito: el mismo modal se abre desde el CATÁLOGO, donde tiene
   * sentido crear con ese formato, y desde un anuncio YA CREADO, donde no. Sin
   * esto habría que duplicar el modal para leer lo mismo.
   */
  onUsar?: () => void;
}) {
  const ej = puesta.ejemplo!;
  return (
    <Modal
      titulo={puesta.nombre}
      encabezado={puesta.tecnico}
      onCerrar={onCerrar}
      ancho={720}
      pie={onUsar
        ? <Button variant="mako" onClick={onUsar} icon={<Icon name="mako" size={14} />}>Crear con este formato</Button>
        : undefined}
    >
      <div style={{ display: 'flex', gap: 18, alignItems: 'flex-start', flexWrap: 'wrap' }}>
        <video
          src={ej.completo}
          poster={ej.poster}
          controls
          playsInline
          style={{ width: 260, flex: 'none', borderRadius: 'var(--r-md)', display: 'block', background: '#000' }}
        />
        <div style={{ flex: 1, minWidth: 240 }}>
          <div style={{ fontSize: 'var(--fs-md)', color: 'var(--ink)', lineHeight: 1.6 }}>
            {puesta.descripcion}
          </div>
          <div style={{ fontSize: 'var(--fs-md)', color: 'var(--dim)', lineHeight: 1.6, marginTop: 10 }}>
            {puesta.cuando}
          </div>

          <div style={{ display: 'flex', flexWrap: 'wrap', gap: 6, marginTop: 14 }}>
            <Tag>{puesta.clips[0]}-{puesta.clips[1]} tomas</Tag>
            <Tag>{puesta.segundosClip[0]}-{puesta.segundosClip[1]} s por toma</Tag>
            <Tag>
              {puesta.habla === 'siempre' ? 'Habla a cámara'
                : puesta.habla === 'nunca' ? 'Voz en off'
                  : 'Alterna habla y voz en off'}
            </Tag>
            {puesta.personas === 2 && <Tag>Dos personas</Tag>}
          </div>

          <div style={{ fontSize: 'var(--fs-sm)', color: 'var(--faint)', marginTop: 14, lineHeight: 1.6 }}>
            El video de arriba es un anuncio real de {Math.round(ej.duracionSeg)} segundos hecho
            con este formato.
          </div>
        </div>
      </div>
    </Modal>
  );
}

// ── Una línea del guion ──────────────────────────────────────────────────────
// Solo lo que se DICE y cuánto dura. Nada de cámara, acción ni prompt: eso es
// cómo se fabrica, y el cliente no fabrica nada.

/**
 * El lugar del clip: vacío, generándose o con el video.
 *
 * Ocupa el MISMO espacio en los tres estados. Es lo que hace que la espera se
 * sienta como algo que está pasando y no como una pantalla rota: el hueco del
 * video ya está ahí, del tamaño que va a tener, desde el primer segundo.
 */
// ⚠️ ACÁ VIVÍAN `Lienzo`, `RielToma`, `LineaGuion` y `videoDe`, y también
// murieron `PasoEscenarios.tsx` y `VisorToma.tsx` enteros.
//
// No es una limpieza: es la consecuencia de que el anuncio dejó de ser una
// PÁGINA con todo a la vista y pasó a ser un WIZARD de siete pantallas
// (`WizardAnuncio.tsx`). Lo que hacían esas piezas —el hueco 9:16 por fila, el
// riel de estado de cada toma, la banda del escenario, el visor en un modal—
// existía para que catorce cosas convivieran en una pantalla. Con una decisión
// por pantalla no hay nada que hacer convivir.

/** Lo generado de una toma, si hay algo. */

/**
 * Lo que se puede hacer con esta toma, y en qué estado está.
 *
 * Cinco estados y NINGUNO reserva espacio para otro. El motivo por el que una
 * toma todavía no se puede filmar es propiedad del GRUPO —del escenario— y se
 * dice UNA vez en su cabecera, no siete veces adentro de siete cajas vacías.
 */


// ── La app ───────────────────────────────────────────────────────────────────

export function VideoGeneratorApp({
  historialInicial, contexto, puente, guiones, anuncios, saldo: saldoInicial, costoClip }: {
  historialInicial: PlanGuardado[];
  contexto: EstadoContextoVideo | null;
  puente: Puente | null; guiones: GuionDisponible[]; anuncios: AnuncioHecho[];
  saldo: { creditos: number | null; at: string | null; tier: string };
  costoClip: { creditos: number; medido: boolean } }) {
  const PLANTILLAS = useMemo(() => puestasOfrecidas(), []);

  const [historial, setHistorial] = useState<PlanGuardado[]>(historialInicial);
  const [actual, setActual] = useState<PlanGuardado | null>(null);
  const [editandoLinea, setEditandoLinea] = useState(false);
  /** La toma que se está generando ahora. null = ninguna. */
  const [generando, setGenerando] = useState<number | null>(null);
  const [saldo, setSaldo] = useState(saldoInicial);
  /** Qué toma se está mirando en el visor. `null` = ninguna. */
  const [viendo, setViendo] = useState<number | null>(null);
  const [rehaciendo, setRehaciendo] = useState(false);
  /**
   * ¿MaKo lo dice con las palabras de la persona, o el guion va tal cual?
   *
   * Arranca en SÍ porque es lo que suele quererse —un guion escrito como se
   * escribe suena leído— pero es una decisión del dueño: es su texto. Un guion
   * que ya se corrigió palabra por palabra no se toca.
   */
  // ⚠️ ARRANCA EN FALSE, y el cambio es de fondo: el guion se genera TAL CUAL
  // lo escribió el cliente, y la adaptación a su forma de hablar se PIDE después,
  // leyendo el resultado.
  //
  // Martín: «yo no pondría para nada un botón de "Tal cual lo escribiste", para
  // eso simplemente le doy siguiente sin apretar ese botón». Tiene razón y ordena
  // todo: lo que no se toca tiene que ser el texto de la persona, no una versión
  // que alguien reescribió. Con el default al revés, el «no» exigía una acción y
  // el botón tenía que ofrecer las dos.
  //
  // El control ya no vive acá: vive arriba del guion, que es donde se puede
  // juzgar si hace falta.
  const [adaptarVoz] = useState(false);

  /**
   * Refresca el saldo cuando se abre un anuncio.
   *
   * Ahí es cuando importa —es el momento previo a gastar— y no en cada carga de
   * la tab: preguntar por preguntar es tráfico contra Google desde la sesión del
   * cliente, y este proyecto ya midió lo que cuesta el tráfico de más.
   */
  const refrescarSaldo = useCallback(async () => {
    const p = await pedirSaldoAction();
    if (!p.ok) return;
    for (let i = 0; i < 6; i++) {
      await new Promise((r) => setTimeout(r, 3000));
      const s = await saldoAction(p.trabajoId).catch(() => null);
      if (s?.ok) {
        setSaldo(s.saldo);
        if (s.listo) return;
      }
    }
  }, []);
  // Siempre se entra al catálogo, aunque haya anuncios hechos: se viene a crear
  // uno nuevo, no a releer el anterior.
  const [vista, setVista] = useState<Vista>('catalogo');

  // ── EL EJEMPLO QUE VUELA ───────────────────────────────────────────────
  // Un solo nodo que recorre tres estaciones: la tarjeta que se apretó, el centro
  // de «Así se verá tu anuncio», y el riel. Vive acá arriba —y no en ninguna
  // pantalla— porque tiene que sobrevivir a los cambios de vista: un elemento que
  // se desmonta no se puede seguir con el ojo, y seguirlo con el ojo es todo el
  // argumento.
  const slotCentro = useRef<HTMLDivElement>(null);
  const slotRiel = useRef<HTMLDivElement>(null);
  const [cajaTarjeta, setCajaTarjeta] = useState<DOMRect | null>(null);
  const [rielPlegado, setRielPlegado] = useState(false);

  // El reloj que permite que «el puente anda» se apague solo. Arranca en `null`
  // para no decidir una rama con dos relojes distintos —el del server y el del
  // navegador— durante la hidratación.
  const [ahoraTick, setAhoraTick] = useState<number | null>(null);

  // ⚠️ EL PUENTE ES ESTADO, NO PROP. El `puente` que trae la página es un
  // snapshot del momento en que se sirvió; el desplegable lo re-pregunta cada
  // 15 s y necesita poder contárselo a quien decide si se puede avanzar.
  //
  // Sin esto, alguien que conecta su navegador desde el desplegable veía el
  // tilde verde AHÍ y el botón de crear seguía bloqueado hasta recargar: dos
  // partes de la misma pantalla contestando cosas distintas sobre el mismo
  // hecho, que es exactamente la trampa que el gate viene a evitar.
  const [puenteVivo, setPuenteVivo] = useState(puente);
  useEffect(() => {
    setAhoraTick(Date.now());
    const t = window.setInterval(() => setAhoraTick(Date.now()), 30000);
    return () => window.clearInterval(t);
  }, []);
  /** La plantilla abierta en el detalle. null = modal cerrado. */
  const [detalle, setDetalle] = useState<Puesta | null>(null);
  const [verAnuncio, setVerAnuncio] = useState<AnuncioHecho | null>(null);
  const router = useRouter();
  const [paso, setPaso] = useState<Paso>('guion');

  // Vacío a propósito: el botón «Crear» nace apagado y se enciende al elegir.
  // Con una preseleccionada, el marco azul dice «ya elegiste» sin que nadie
  // haya elegido.
  const [puestaId, setPuestaId] = useState<string>('');
  /** El guion de MaKo elegido. Es lo ÚNICO que el wizard pide. */
  const [guionId, setGuionId] = useState<string>('');
  /** El modal de pegar guiones propios. */
  const [cargando, setCargando] = useState(false);
  /** El guion abierto en el detalle. null = cerrado. */
  const [verGuion, setVerGuion] = useState<GuionDisponible | null>(null);
  const [verGuiones, setVerGuiones] = useState(false);
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const puesta = useMemo(() => puestaPorId(puestaId), [puestaId]);
  const puestaActual = useMemo(
    () => (actual ? puestaPorId(actual.plan.puestaId) : undefined),
    [actual],
  );

  /**
   * Lo que cuesta filmar UNA toma, en una frase, con el saldo real adentro.
   *
   * ⚠️ Vive acá y viaja a cada fila y al visor, en vez de que cada uno lo arme:
   * el saldo y el costo medido son de esta pantalla, y tres copias de la misma
   * frase son tres lugares donde puede quedar vieja.
   *
   * Y el tercer estado NO es «no alcanza»: cuando nunca se leyó el saldo se dice
   * que no se sabe. Decirle «no te alcanza» a alguien que sí tiene créditos es
   * peor que no decirle nada.
   */
  const costoDeUnaToma = useMemo(() => {
    const c = `~${costoClip.creditos}${costoClip.medido ? '' : ' (estimado)'}`;
    return saldo.creditos == null
      ? `Gasta ${c} créditos de Google. Todavía no leí cuántos te quedan.`
      : `Gasta ${c} de tus ${saldo.creditos} créditos de Google.`;
  }, [costoClip, saldo]);

  /** Si el saldo alcanza para lo que falta. `null` = no se sabe. */
  const alcanzaTodo = useMemo(() => {
    if (!actual || saldo.creditos == null) return null;
    const hechas = Object.values(actual.video ?? {}).filter((v) => v?.url).length;
    const faltan = Math.max(0, actual.plan.clips.length - hechas);
    return { ok: saldo.creditos >= faltan * costoClip.creditos, faltan, entran: Math.floor(saldo.creditos / Math.max(1, costoClip.creditos)) };
  }, [actual, saldo, costoClip]);
  const guion = useMemo(
    () => guiones.find((g) => g.id === guionId),
    [guiones, guionId],
  );

  /**
   * Cuánto va a durar ESTE guion en ESTE formato, y si entra.
   *
   * Reemplaza al paso «¿cuánto tiene que durar?»: el número se deriva del texto
   * (palabras ÷ densidad de la puesta) en vez de elegirse de un menú. Y avisa
   * cuando no entra, que antes se recortaba en silencio.
   */
  const cabida = useMemo(
    () => (puesta && guion ? cabidaDeGuion(puesta, guion.hablado) : null),
    [puesta, guion],
  );

  // ── Retomar el anuncio que estaba abierto ────────────────────────────────
  // Si la URL trae un `?plan=`, se abre ese. Es lo que hace que refrescar deje
  // al dueño donde estaba en vez de mandarlo al catálogo.
  //
  // Se busca en el historial que bajó del server, así que un plan que ya se
  // recortó del tope de 10 no vuelve: en ese caso se entra al catálogo, que es
  // la caída correcta —mejor la home que una pantalla vacía.
  const params = useSearchParams();
  useEffect(() => {
    const id = params.get('plan');
    if (!id || actual) return;
    const guardado = historial.find((e) => e.id === id);
    if (guardado) { setActual(guardado); setVista('anuncio'); }
    // Solo al montar: después manda el estado, no la URL.
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  const idx = PASOS.indexOf(paso);
  const puedeAvanzar = paso === 'guion' ? !!guionId : true;

  /**
   * Guarda una toma corregida a mano.
   *
   * El plan vuelve del server ya recalculado —palabras, tope y marcas de voseo
   * son MEDIDAS, no declaraciones— así que el estado local se reemplaza entero
   * con lo que devolvió, en vez de parchear el clip que se tocó.
   */
  const editarLinea = useCallback(async (n: number, voz: string) => {
    if (!actual) return;
    setEditandoLinea(true); setError(null);
    try {
      const out = await editarLineaPlanAction(actual.id, n, voz);
      if (!out.ok) { setError(out.error); return; }
      setActual(out.item);
      setHistorial((h) => h.map((e) => (e.id === out.item.id ? out.item : e)));
    } catch (e) {
      setError(e instanceof Error ? e.message : 'No se pudo guardar la toma.');
    } finally {
      setEditandoLinea(false);
    }
  }, [actual]);

  /** Le pide a MaKo el cambio de UNA toma. */
  const pedirCambio = useCallback(async (n: number, instruccion: string) => {
    if (!actual) return;
    setError(null);
    try {
      const out = await reescribirTomaAction(actual.id, n, instruccion);
      if (!out.ok) { setError(out.error); return; }
      setActual(out.item);
      setHistorial((h) => h.map((e) => (e.id === out.item.id ? out.item : e)));
    } catch (e) {
      setError(e instanceof Error ? e.message : 'No se pudo cambiar la toma.');
    }
  }, [actual]);

  /**
   * Manda a generar UNA toma.
   *
   * Una, y no las siete. La regla es del dueño y es económica: si el avatar no se
   * parece, descubrirlo cuesta un clip y no un anuncio entero. Y el primero es
   * además el que fija la cara que los siguientes heredan.
   */
  const generarToma = useCallback(async (n: number) => {
    if (!actual) return;
    setError(null);
    const out = await generarTomaAction(actual.id, n);
    if (!out.ok) { setError(out.error); return; }
    setActual(out.item);
    setGenerando(n);
  }, [actual]);

  /**
   * El latido que pregunta cómo va.
   *
   * Cada vuelta hace UN paso del lado del server —sacar el nombre de la
   * operación, o preguntar por el video— y nunca espera adentro: una action que
   * se queda esperando un minuto muere en el timeout de la plataforma.
   *
   * Se apaga solo cuando la toma queda lista o falla. Un intervalo que sigue
   * latiendo con la pestaña abierta y nada que esperar es tráfico contra Flow por
   * nada, y contra Flow el tráfico de más se paga en score.
   */
  useEffect(() => {
    if (generando == null || !actual) return;
    let vivo = true;
    const tick = async () => {
      const out = await estadoTomaAction(actual.id, generando).catch(() => null);
      if (!vivo || !out || !out.ok) return;
      setActual(out.item);
      if (out.estado.fase === 'listo' || out.estado.fase === 'error') {
        setGenerando(null);
        if (out.estado.fase === 'error') setError(out.estado.error);
      }
    };
    void tick();
    const id = setInterval(() => void tick(), 6000);
    return () => { vivo = false; clearInterval(id); };
  }, [generando, actual?.id]);

  // ¿El navegador está conectado AHORA? Es el hecho del que cuelga todo lo que
  // esta tab puede hacer, así que se calcula una vez y lo miran los dos lugares
  // que deciden: el gate de la entrada y el aviso.
  // ⚠️ Del MISMO juicio que pinta el aviso y la fila. Estaba escrito acá a mano
  // —el plazo, la comparación de fecha, el `=== 'listo'`— y eso son tres reglas
  // duplicadas: el día que una cambie, el botón y el cartel dicen cosas
  // distintas sobre el mismo navegador.
  const puenteAnda = estadoDelPuente(puenteVivo, ahoraTick).anda;

  const empezar = useCallback((id: string, caja?: DOMRect) => {
    // ⚠️ EL GATE, Y ESTÁ ACÁ A PROPÓSITO. El dueño: «y claro que no te deje
    // avanzar». Va en la ENTRADA y no adentro del recorrido por una razón que ya
    // costó caro en este repo: adentro, el dato del puente queda congelado en el
    // momento en que se entró —el desplegable que lo refresca vive en el
    // catálogo—, así que un gate ahí puede trabar a alguien que YA conectó.
    //
    // Y no se queda mudo: abrir la configuración ES la respuesta al click. Un
    // control que no hace nada es indistinguible de uno roto.
    if (!puenteAnda) { abrirPuente(); return; }
    setPuestaId(id);
    setGuionId('');
    setPaso('guion');
    setError(null);
    // ⚠️ La caja se mide en el HANDLER DEL CLICK, no después: la tarjeta se
    // desmonta en el mismo commit en que cambia la vista, así que un
    // `getBoundingClientRect()` en un efecto llegaría tarde y mediría un elemento
    // que ya no está.
    setCajaTarjeta(caja ?? null);
    setVista('ejemplo');
  }, [puenteAnda]);

  /**
   * Genera el plan del anuncio.
   *
   * Ya no toma `conFeedback`: ese parámetro existía para el bloque de «¿le
   * cambiamos algo?», que rehacía el plan ENTERO con un comentario suelto. Ahora
   * los cambios se piden POR TOMA (`reescribirTomaAction`), que cuesta una
   * llamada barata en vez de un plan completo y no toca las tomas que estaban
   * bien.
   */
  const generar = useCallback(async () => {
    setBusy(true); setError(null);
    try {
      const out = await generarPlanAction({
        puestaId,
        // Se manda el guion ENTERO, con sus rótulos: el modelo los usa para saber
        // qué parte es el gancho y qué parte el cierre. Lo que se le sacan los
        // rótulos es solo a la cuenta de palabras (`hablado`), porque eso mide
        // cuánto se TARDA en decirlo.
        guionId: guion?.id ?? '',
        guionTexto: guion?.texto ?? '',
        adaptarVoz,
      });
      if (!out.ok) { setError(out.error); return; }
      setHistorial(out.historial);
      setActual(out.item);
      setVista('anuncio');
      void refrescarSaldo();
      // El anuncio abierto queda en la URL. Sin esto, refrescar la página lo
      // perdía y devolvía al catálogo: el plan vive en el server pero la vista
      // vivía solo en el estado del cliente, y un F5 se lo lleva.
      window.history.replaceState(null, '', `?plan=${out.item.id}`);
    } finally {
      setBusy(false);
    }
  }, [puestaId, guion, adaptarVoz]);

  const copiarGuion = useCallback(() => {
    if (!actual) return;
    navigator.clipboard.writeText(guionATexto(actual.plan)).catch(() => {
      /* sin portapapeles: el guion igual está en pantalla */
    });
  }, [actual]);

  // ── Las tres preguntas ─────────────────────────────────────────────────────
  // ── «ASÍ SE VERÁ TU ANUNCIO»: el primer paso de todo ──────────────────────
  //
  // Martín: «me gustaría que el primer paso de todo sea… el de "Así se verá tu
  // anuncio" donde se ve el template que elegí. Y mi idea es que al darle
  // siguiente, haga una animación y se coloque al costado».
  //
  // Lo que hace que esto funcione no es esta pantalla: es que el video NO SE
  // DIBUJA acá. Acá hay un HUECO, y encima flota el mismo nodo que venía sobre la
  // tarjeta del catálogo. Por eso se puede seguir con el ojo, y por eso la
  // pantalla siguiente puede correrlo al costado sin cortes.
  if (vista === 'ejemplo' && puesta?.ejemplo) {
    return (
      <Pagina ancho="completo" densidad="compacta">
        <TemaOscuro />
        <Estudio
          // Una afirmación y no una pregunta: es el único paso donde no hay nada
          // que decidir. Y es el texto de Martín, textual.
          pregunta="Así se verá tu anuncio"
          paso={1}
          total={PASOS.length + 1}
          boton="Siguiente"
          onSiguiente={() => setVista('wizard')}
          atras="Cambiar formato"
          onAtras={() => { setVista('catalogo'); setCajaTarjeta(null); }}
          onSalir={() => { setVista('catalogo'); setCajaTarjeta(null); }}
        >
          <div style={{ display: 'flex', justifyContent: 'center' }}>
            {/* El hueco, con la MISMA medida que el lienzo de todas las pantallas
                que vienen. Eso es lo que hace que el ejemplo ocupe el asiento de
                lo que después va a ser tuyo. */}
            <div
              ref={slotCentro}
              style={{ height: 'min(62vh, 720px)', aspectRatio: '9 / 16', borderRadius: 18 }}
            />
          </div>
        </Estudio>
      {/* ⚠️ EL EJEMPLO VIVE ACÁ, no en ninguna pantalla. Es un solo nodo `fixed`
          que recorre las tres estaciones —la tarjeta, el centro, el riel— sin
          desmontarse ni una vez. Que sobreviva a los cambios de vista es toda la
          pieza: un elemento que se destruye y se vuelve a crear no se puede
          seguir con el ojo, y seguirlo con el ojo es lo que contesta «¿qué hace
          eso ahí?» sin gastar una palabra. */}
      {puesta?.ejemplo && (
        <PreviaVolante
          puesta={puesta}
          estacion="centro"
          cajaTarjeta={cajaTarjeta}
          slotCentro={slotCentro}
          slotRiel={slotRiel}
          plegado={rielPlegado}
          onToggle={() => setRielPlegado((v) => !v)}
        />
      )}
      </Pagina>
    );
  }

  if (vista === 'wizard') {
  // ⚠️ `Estudio` Y NO `WizardShell`. El dueño: «el primer paso de "¿Cuál de
  // tus guiones quieres grabar?" se quedó con el formato de form viejo».
  //
  // Y no era sólo estética: `WizardShell` es una tarjeta de 620 px con
  // tipografías fuera de la escala `--fs-*` y, sobre todo, NO monta el tema.
  // El recorrido real era oscuro → CLARO → oscuro, dos saltos en tres
  // pantallas del mismo flujo.
  //
  // Mudarlo trae además dos cosas gratis: el riel del ejemplo acompaña también
  // este paso —que es lo que se pidió cuando se dijo «durante toda la
  // creación»— y desaparecen del camino los dos botones de `WizardShell` con
  // `color: '#fff'` sobre `--primary`, que en oscuro dan 2,41:1 y no se leen.
    return (
      // `Pagina` con ancho completo, como el resto de la tab: el estudio es un
      // LIENZO y necesita cada píxel. Y envuelve para que el ejemplo que vuela
      // pueda ser hermano de la pantalla en vez de vivir adentro de ella.
      <Pagina ancho="completo" densidad="compacta">
      <TemaOscuro />
      <Estudio
        pregunta={PREGUNTA[paso]}
        paso={idx + 1}
        total={PASOS.length}
        puesta={puesta}
        error={error ?? undefined}
        // ⚠️ SIEMPRE «Siguiente», como en todo el resto. Lo que el botón hace de
        // más lo dice la línea de abajo, no su rótulo.
        boton={paso === 'revisar' ? 'Generar anuncio' : 'Siguiente'}
        consecuencia={paso === 'revisar' ? costoDeUnaToma : undefined}
        cargando={busy}
        atras={idx === 0 ? 'Cambiar plantilla' : 'Volver'}
        onAtras={() => (idx === 0 ? setVista('catalogo') : setPaso(PASOS[idx - 1]))}
        onSalir={() => setVista('catalogo')}
        slotRiel={slotRiel}
        plegado={rielPlegado}
        onSiguiente={() => {
          // En el último paso, «Siguiente» ES generar. Un solo camino de salida.
          if (paso === 'revisar') { void generar(); return; }
          if (!puedeAvanzar) return;
          // Si este guion YA tiene un plan, se abre ese en vez de mandar a
          // rehacerlo. Rehacerlo perdía el trabajo hecho —las tomas corregidas a
          // mano, los clips ya generados— y encima costaba una llamada al modelo
          // para volver a escribir algo que ya estaba escrito.
          if (paso === 'guion' && guion?.planId) {
            const guardado = historial.find((e) => e.id === guion.planId);
            if (guardado) {
              setActual(guardado);
              setVista('anuncio');
              window.history.replaceState(null, '', `?plan=${guardado.id}`);
              return;
            }
          }
          setPaso(PASOS[idx + 1]);
        }}
      >
        {paso === 'guion' && (
          <div style={{ textAlign: 'left' }}>
            {verGuion && (
              <DetalleGuion
                guion={verGuion}
                puesta={puesta}
                onCerrar={() => setVerGuion(null)}
                onUsar={() => { setGuionId(verGuion.id); setVerGuion(null); }}
                onEditado={() => router.refresh()}
              />
            )}

            {cargando && (
              <CargarGuiones
                onCerrar={() => setCargando(false)}
                onCargado={() => {
                  setCargando(false);
                  // `router.refresh()` y NO `window.location.reload()`.
                  //
                  // Los guiones bajan del server como props, así que hay que
                  // volver a pedirlos —agregarlos a mano al estado local crearía
                  // una segunda copia que se desincroniza en cuanto alguien los
                  // toque desde /ads-writer—. Pero recargar la página entera
                  // tiraba también el estado del cliente, y el estado del cliente
                  // es EN QUÉ PASO ESTABA: terminabas de cargar tus guiones y la
                  // app te devolvía a elegir la plantilla, con todo perdido.
                  //
                  // refresh() vuelve a correr el server component y deja el
                  // wizard donde estaba. Es el mismo dato, sin perder el lugar.
                  router.refresh();
                }}
              />
            )}

            {guiones.length === 0 ? (
              // No es un estado vacío decorativo: dice DÓNDE se arregla. Sin
              // guiones esta tab no tiene nada que grabar, y el lugar donde se
              // escriben es otra pantalla.
              // Sin guiones, el vacío no puede ser solo un aviso: tiene que
              // ofrecer las DOS salidas reales —que MaKo escriba uno, o cargar el
              // propio— porque un estado vacío que solo explica deja igual de
              // trabado que uno que no dice nada.
              <div>
                <Alert tono="warn" accion={{ label: 'Ir a Ads Writer', href: '/ads-writer' }}>
                  <strong>Todavía no tienes guiones escritos.</strong> Los anuncios de video se
                  graban a partir de un guion. MaKo puede escribirte uno en Ads Writer, con tu
                  ángulo y tu avatar — o carga el tuyo aquí abajo.
                </Alert>
                <button
                  type="button"
                  onClick={() => setCargando(true)}
                  style={{
                    display: 'flex', alignItems: 'center', justifyContent: 'center',
                    gap: 8, width: '100%', marginTop: 14,
                    padding: '15px', borderRadius: 12, cursor: 'pointer',
                    fontFamily: 'inherit', background: 'transparent',
                    border: '1.5px dashed var(--border-strong)',
                    color: 'var(--faint)', transition: 'border-color .12s, color .12s',
                  }}
                  onMouseEnter={(e) => {
                    e.currentTarget.style.borderColor = 'var(--primary)';
                    e.currentTarget.style.color = 'var(--primary)';
                  }}
                  onMouseLeave={(e) => {
                    e.currentTarget.style.borderColor = 'var(--border-strong)';
                    e.currentTarget.style.color = 'var(--faint)';
                  }}
                >
                  <span style={{ fontSize: 18, lineHeight: 1 }}>＋</span>
                  <span style={{ fontSize: 'var(--fs-md)', fontWeight: 650 }}>Nuevo guion</span>
                </button>
              </div>
            ) : (
              <div style={{ display: 'grid', gap: 10 }}>
                {/*
                  PRIMERA de la lista, no última.
                  //
                  Cargar el propio no es lo que se hace cuando no encontrás
                  ninguno: es una de las formas de arrancar, y ponerla al final la
                  convierte en el premio consuelo de haber revisado todo lo demás.
                  Arriba se ve sin scrollear y sin leer los otros.
                  //
                  Va DENTRO de la misma grilla y del mismo ancho que una card de
                  guion: es una opción más entre guiones, no una acción de otra
                  categoría. Es el molde de «Crear nuevo proyecto» del board.
                  //
                  Punteada y no sólida porque no hay nada adentro todavía: el
                  borde dice «acá va a haber uno» sin fingir que ya lo hay.
                */}
                <button
                  type="button"
                  onClick={() => setCargando(true)}
                  style={{
                    display: 'flex', alignItems: 'center', justifyContent: 'center',
                    gap: 8, width: '100%',
                    padding: '13px 15px', borderRadius: 12, cursor: 'pointer',
                    fontFamily: 'inherit', background: 'transparent',
                    border: '1.5px dashed var(--border-strong)',
                    color: 'var(--faint)', transition: 'border-color .12s, color .12s',
                  }}
                  onMouseEnter={(e) => {
                    e.currentTarget.style.borderColor = 'var(--primary)';
                    e.currentTarget.style.color = 'var(--primary)';
                  }}
                  onMouseLeave={(e) => {
                    e.currentTarget.style.borderColor = 'var(--border-strong)';
                    e.currentTarget.style.color = 'var(--faint)';
                  }}
                >
                  <span style={{ fontSize: 18, lineHeight: 1 }}>＋</span>
                  <span style={{ fontSize: 'var(--fs-md)', fontWeight: 650 }}>Nuevo guion</span>
                </button>

                {guiones.map((g) => {
                  const elegido = g.id === guionId;
                  const cab = puesta ? cabidaDeGuion(puesta, g.hablado) : null;
                  return (
                    <div
                      key={g.id}
                      role="button"
                      tabIndex={0}
                      aria-pressed={elegido}
                      onClick={() => setGuionId(g.id)}
                      // Doble click abre el detalle, como en las plantillas de la
                      // portada. El gesto ya existe en esta pantalla: repetirlo
                      // acá es gratis y no repetirlo obliga a aprender dos.
                      onDoubleClick={() => setVerGuion(g)}
                      onKeyDown={(e) => {
                        if (e.key === 'Enter' || e.key === ' ') { e.preventDefault(); setGuionId(g.id); }
                      }}
                      style={{
                        display: 'flex', alignItems: 'center', gap: 10, width: '100%',
                        cursor: 'pointer', padding: '13px 15px', borderRadius: 12,
                        background: elegido ? 'var(--primary-bg)' : 'var(--surface)',
                        border: `1.5px solid ${elegido ? 'var(--primary)' : 'var(--border)'}`,
                      }}
                    >
                      {/*
                        SOLO el título. Las palabras, la duración y el texto se
                        fueron al detalle: una lista donde cada fila trae cinco
                        datos no se lee, se escanea — y para ELEGIR entre guiones
                        alcanza con el nombre. Lo demás se mira cuando se duda, y
                        para eso está «Abrir».
                      */}
                      <span style={{
                        flex: 1, minWidth: 0, fontSize: 'var(--fs-md)', fontWeight: 650,
                        color: 'var(--ink)', overflow: 'hidden', textOverflow: 'ellipsis',
                        whiteSpace: 'nowrap',
                      }}>
                        {g.angulo || 'Sin título'}
                      </span>

                      {/* Lo único que sobrevive al lado del título es lo que
                          cambia una DECISIÓN: que ya lo grabaste, y que no entra
                          en este formato. Los dos hacen elegir distinto.

                          Y cuando se sabe CON QUÉ formato se grabó, se nombra:
                          «ya lo grabaste» a secas suena a callejón, cuando lo
                          que suele pasar es que se quiera el mismo guion en otro
                          formato — es exactamente lo que hizo el dueño con su
                          primer anuncio, grabado en Car Talks y en The Office. */}
                      {/*
                        TRES estados, no dos, y esa era la confusión: entre «no
                        toqué esto» y «hay un video» está «ya lo trabajé».
                        Poniéndole «Borrador» a todo, la etiqueta dejó de decir
                        nada — el dueño: «ahora tooodos están en borrador».

                        Por eso el guion intacto NO lleva etiqueta: es el estado
                        por defecto, y una etiqueta que está en todas las filas es
                        ruido, no información. Se marca lo que se APARTA de lo
                        normal.
                      */}
                      {g.yaUsado ? (
                        <Tag color="var(--good)" icon={<Icon name="check" size={12} />}>Generado</Tag>
                      ) : g.conPlan ? (
                        <Tag color="var(--primary)">Borrador</Tag>
                      ) : null}
                      {cab?.desborda && <Tag color="var(--warn)">No entra</Tag>}

                      <button
                        type="button"
                        onClick={(e) => { e.stopPropagation(); setVerGuion(g); }}
                        style={{
                          flex: 'none', background: 'transparent', border: 'none',
                          padding: '3px 6px', cursor: 'pointer', fontFamily: 'inherit',
                          fontSize: 'var(--fs-meta)', color: 'var(--dim)',
                          textDecoration: 'underline', textUnderlineOffset: 3,
                        }}
                      >
                        Abrir
                      </button>
                    </div>
                  );
                })}


              </div>
            )}

            {/*
              El aviso del desborde va PEGADO al botón que dispara, no arriba de
              todo: es la consecuencia de apretar, y arriba en gris no la lee
              nadie. Y no bloquea — el dueño puede querer grabarlo igual y editar
              después; lo que no puede pasar es que se recorte sin decirlo.
            */}
            {cabida?.desborda && (
              <div style={{ marginTop: 14 }}>
                <Alert tono="warn">
                  Este guion es más largo de lo que <strong>{puesta?.nombre}</strong> puede
                  contar: entran {cabida.palabras - cabida.palabrasDeMas} palabras y tiene{' '}
                  {cabida.palabras}. Si sigues, el final va a quedar afuera. Prueba con otro
                  formato o recorta el guion en Ads Writer.
                </Alert>
              </div>
            )}
          </div>
        )}


        {paso === 'revisar' && (
          <div style={{ textAlign: 'left', display: 'grid', gap: 14 }}>
            {/*
              Lo que se revisa NO es un resumen de lo que elegiste: es lo que el
              sistema puso SOLO y vos nunca viste. El formato y el guion los
              acabás de elegir; la cara, la duración y el acento los decidió MaKo,
              y son justo los que se notan recién en el video terminado.
            */}

            {/* La CARA. Va primero y va como IMAGEN: la pregunta que contesta es
                «¿es esta persona?», y un «3 fotos cargadas» se lee igual con las
                fotos correctas que con las de otro. */}
            <div style={{
              display: 'flex', alignItems: 'center', gap: 14,
              padding: '13px 15px', borderRadius: 12,
              background: 'var(--surface)', border: '1px solid var(--border)',
            }}>
              {contexto?.fotoUrl ? (
                // eslint-disable-next-line @next/next/no-img-element
                <img
                  src={contexto.fotoUrl}
                  alt="Tu cara de marca"
                  style={{ width: 62, height: 62, borderRadius: 10, objectFit: 'cover', flex: 'none' }}
                />
              ) : (
                <div style={{
                  width: 62, height: 62, borderRadius: 10, flex: 'none', display: 'grid',
                  placeItems: 'center', background: 'var(--surface-2)', color: 'var(--faint)',
                }}>
                  <Icon name="perfil" size={26} />
                </div>
              )}
              <div style={{ minWidth: 0 }}>
                <div style={{ fontSize: 'var(--fs-md)', fontWeight: 650, color: 'var(--ink)' }}>
                  {contexto?.tieneFotos ? 'Esta es la cara del avatar' : 'Todavía no cargaste tu cara'}
                </div>
                <div style={{ fontSize: 'var(--fs-sm)', color: 'var(--dim)', marginTop: 3, lineHeight: 1.5 }}>
                  {contexto?.tieneFotos
                    ? <>Si no eres tú, cámbiala en <Link href="/onboarding">Onboarding → Persona</Link>.</>
                    : <>Sin una foto tuya, cada toma sale con una persona distinta. Cárgala en <Link href="/onboarding">Onboarding → Persona</Link>.</>}
                </div>
              </div>
            </div>

            {/* Lo que MaKo derivó y nadie eligió. */}
            <div style={{
              padding: '13px 15px', borderRadius: 12,
              background: 'var(--surface)', border: '1px solid var(--border)',
              display: 'grid', gap: 9,
            }}>
              <Fila k="Formato" v={puesta?.nombre ?? '—'} />
              <Fila k="Guion" v={guion?.angulo || 'Sin título'} />
              <Fila
                k="Va a durar"
                v={cabida ? `${cabida.segundosReales} segundos en ${cabida.clips} tomas` : '—'}
              />
              <Fila k="Acento" v={contexto?.acento.etiqueta ?? "—"} nota={contexto?.acento.seguro ? undefined : 'lo deduje de tu zona horaria'} />
            </div>

            {/* ⚠️ ACÁ HABÍA UNA CASILLA: «Que MaKo lo diga con tus palabras».
                Se mudó a la pantalla del guion, y no es un cambio de lugar: la
                pregunta era «¿te gusta cómo suena?» hecha ANTES de que existiera
                nada que sonara. Se contesta leyendo, así que vive donde se lee. */}

            {cabida?.desborda && (
              <div style={{ marginTop: 14 }}>
                <Alert tono="warn">
                  Este guion es más largo de lo que <strong>{puesta?.nombre}</strong> puede
                  contar: entran {cabida.palabras - cabida.palabrasDeMas} palabras y tiene{' '}
                  {cabida.palabras}. Si sigues, el final va a quedar afuera. Prueba con otro
                  formato o recorta el guion en Ads Writer.
                </Alert>
              </div>
            )}
          </div>
        )}


        {paso === 'revisar' && (
          <div style={{ textAlign: 'left', display: 'grid', gap: 14 }}>
            {/*
              Lo que se revisa NO es un resumen de lo que elegiste: es lo que el
              sistema puso SOLO y vos nunca viste. El formato y el guion los
              acabás de elegir; la cara, la duración y el acento los decidió MaKo,
              y son justo los que se notan recién en el video terminado.
            */}

            {/* La CARA. Va primero y va como IMAGEN: la pregunta que contesta es
                «¿es esta persona?», y un «3 fotos cargadas» se lee igual con las
                fotos correctas que con las de otro. */}
            <div style={{
              display: 'flex', alignItems: 'center', gap: 14,
              padding: '13px 15px', borderRadius: 12,
              background: 'var(--surface)', border: '1px solid var(--border)',
            }}>
              {contexto?.fotoUrl ? (
                // eslint-disable-next-line @next/next/no-img-element
                <img
                  src={contexto.fotoUrl}
                  alt="Tu cara de marca"
                  style={{ width: 62, height: 62, borderRadius: 10, objectFit: 'cover', flex: 'none' }}
                />
              ) : (
                <div style={{
                  width: 62, height: 62, borderRadius: 10, flex: 'none', display: 'grid',
                  placeItems: 'center', background: 'var(--surface-2)', color: 'var(--faint)',
                }}>
                  <Icon name="perfil" size={26} />
                </div>
              )}
              <div style={{ minWidth: 0 }}>
                <div style={{ fontSize: 'var(--fs-md)', fontWeight: 650, color: 'var(--ink)' }}>
                  {contexto?.tieneFotos ? 'Esta es la cara del avatar' : 'Todavía no cargaste tu cara'}
                </div>
                <div style={{ fontSize: 'var(--fs-sm)', color: 'var(--dim)', marginTop: 3, lineHeight: 1.5 }}>
                  {contexto?.tieneFotos
                    ? <>Si no eres tú, cámbiala en <Link href="/onboarding">Onboarding → Persona</Link>.</>
                    : <>Sin una foto tuya, cada toma sale con una persona distinta. Cárgala en <Link href="/onboarding">Onboarding → Persona</Link>.</>}
                </div>
              </div>
            </div>

            {/* ⚠️ LA SEGUNDA CASILLA IGUAL. Estaba duplicada en los dos pasos del
                wizard, con el mismo texto y el mismo estado — y por eso al sacar
                una el compilador encontró la otra. La decisión se mudó a la
                pantalla del guion, donde hay algo que leer para tomarla. */}

            {cabida?.desborda && (
              <Alert tono="warn">
                El guion es más largo de lo que <strong>{puesta?.nombre}</strong> puede contar:
                sobran {cabida.palabrasDeMas} palabras y el final va a quedar afuera.
              </Alert>
            )}

            {/*
              Qué pasa al apretar, PEGADO al botón y en tinta normal.
              //
              Y dice lo que NO pasa: acá se escribe el plan —cómo se reparte el
              guion en tomas—, no se genera el video. Sin esa línea, «Generar
              anuncio» promete un video y devuelve un texto, que es la forma más
              barata de que alguien crea que algo se rompió.
            */}
            <div style={{ fontSize: 'var(--fs-sm)', color: 'var(--dim)', lineHeight: 1.6 }}>
              MaKo va a repartir tu guion en {cabida?.clips ?? '—'} tomas y escribir cómo se
              filma cada una. <strong>Todavía no se genera ningún video</strong> ni se gastan
              créditos de tu cuenta de Google.
            </div>
          </div>
        )}
      </Estudio>

      {/* ⚠️ EL EJEMPLO VIVE ACÁ, no en ninguna pantalla. Es un solo nodo `fixed`
          que recorre las tres estaciones —la tarjeta, el centro, el riel— sin
          desmontarse ni una vez. Que sobreviva a los cambios de vista es toda la
          pieza: un elemento que se destruye y se vuelve a crear no se puede
          seguir con el ojo, y seguirlo con el ojo es lo que contesta «¿qué hace
          eso ahí?» sin gastar una palabra. */}
      {puesta?.ejemplo && (
        <PreviaVolante
          puesta={puesta}
          estacion="riel"
          cajaTarjeta={cajaTarjeta}
          slotCentro={slotCentro}
          slotRiel={slotRiel}
          plegado={rielPlegado}
          onToggle={() => setRielPlegado((v) => !v)}
        />
      )}
      </Pagina>
    );
  }

  // ── El anuncio ─────────────────────────────────────────────────────────────
  // ══════════════════════════════════════════════════════════════════════════
  // EL ANUNCIO: un WIZARD, no una pagina
  // ══════════════════════════════════════════════════════════════════════════
  //
  // ⚠️ Aca vivian ~350 lineas: el header con su estado, la lista de escenarios,
  // la lista de tomas con su riel, el visor, los avisos de saldo y el aside. Todo
  // junto, y el dueno lo rechazo dos veces seguidas.
  //
  // La segunda vez lo dijo asi: «esta mal PLANTEADA DESDE EL ORIGEN. Es
  // contraintuitiva, no se deduce que hay que hacer en menos de 1 segundo. Tiene
  // MUCHOS textos. Ya muchas veces hablamos de hacer todo modular, que sea 1
  // SOLO PASO A LA VEZ. Hacer cosas GRANDES, ENORMES, en lugar de muchas cosas
  // juntas, con mucho texto, chiquito.»
  //
  // El intento del medio COMPACTO la pantalla —dos listas en una, la mitad de
  // alto, menos avisos— y siguio estando mal. Esa es la leccion cara: compactar
  // una pantalla sobrecargada la deja sobrecargada y mas chica. Lo que se pide es
  // SACAR pasos de la pantalla.
  //
  // Ahora son siete pantallas, una decision cada una, con el objeto de esa
  // decision ocupando el alto util. El chrome es `WizardShell`, el mismo del
  // onboarding: no se inventa uno.
  if (vista === 'anuncio' && actual) {
    return (
      // `Pagina` con ancho completo: el estudio es un LIENZO y necesita cada
      // píxel. La regla de la casa sigue en pie —una pantalla no elige su ancho,
      // lo elige `Pagina`— y `completo` es la variante que existe justo para
      // esto.
      <Pagina ancho="completo" densidad="compacta">
      {/* ⚠️ LA PANTALLA ENTERA, no un rectángulo negro adentro de una app clara.
          El dueño lo cortó de raíz: «si lo harás dark mode, hazlo todo, no que
          esté una parte blanca». `TemaOscuro` marca `<html data-tema="oscuro">`
          y los TOKENS redefinidos dan vuelta el fondo, los botones y los estados
          solos — que es la forma que este repo ya tiene escrita para una
          pantalla oscura, y la razón por la que no se pintan blancos a mano. */}
      <TemaOscuro />
      {/* El ejemplo sigue al costado durante todo el anuncio: es el tercer tramo
          del mismo vuelo, y el mismo nodo. */}
      {puestaActual?.ejemplo && (
        <PreviaVolante
          puesta={puestaActual}
          estacion="riel"
          cajaTarjeta={cajaTarjeta}
          slotCentro={slotCentro}
          slotRiel={slotRiel}
          plegado={rielPlegado}
          onToggle={() => setRielPlegado((v) => !v)}
        />
      )}
      <WizardAnuncio
        item={actual}
        slotRiel={slotRiel}
        plegado={rielPlegado}
        contexto={contexto}
        puesta={puestaActual}
        costoTexto={costoDeUnaToma}
        onCambio={(it) => {
          setActual(it);
          setHistorial((h) => h.map((e) => (e.id === it.id ? it : e)));
        }}
        onSalir={() => {
          setVista('catalogo');
          // Se limpia el `?plan=`: si quedara, refrescar reabriria el anuncio que
          // se acaba de cerrar.
          window.history.replaceState(null, '', window.location.pathname);
        }}
      />
      </Pagina>
    );
  }

  // ── El catálogo, que es la home ────────────────────────────────────────────
  // Sin «Tus anuncios»: un guion listo NO es un anuncio, y esa lista va a existir
  // cuando existan videos, en su propia tab. Los guiones ya escritos se retoman
  // desde adentro del proceso de crear (primer paso del wizard), que es donde
  // sirven — no en la portada.
  const puedeCrear = !!puestaId;

  // ¿El puente está andando AHORA? Se mira la FRESCURA de la última señal, no su
  // existencia: `ultimoVisto` es un campo con fecha, y usarlo como booleano ya
  // dejó los pasos en verde con una señal de 35 horas antes.
  return (
    <Pagina>
      {/* ⚠️ ACÁ FALTABA, y por eso «toda la tab» no estaba oscura.
          `TemaOscuro` sólo se montaba en la rama del anuncio, así que el catálogo
          —la primera pantalla que se ve— seguía claro. El dueño lo pidió dos
          veces: «si lo harás dark mode, hazlo todo» y ahora «toda la tab de
          video-generator, incluso la selección del template».
          Marca `<html data-tema="oscuro">` y los TOKENS dan vuelta el fondo, los
          botones y los estados solos. Es la razón por la que no se pintan blancos
          a mano: una pantalla nueva nace oscura sin tocar una línea. */}
      <TemaOscuro />
      {error && <Alert tono="bad">{error}</Alert>}

      {/* ⚠️ EL AVISO, ARRIBA DE TODO Y EN UNA LÍNEA. El dueño: «dentro de MaKo
          simplemente mostrar un aviso cuando esté desconectado».
          No repite los cuatro pasos —ésos viven en el desplegable del pie, en un
          solo lugar— ni adivina cuál falta: el botón abre esa configuración, que
          es donde el paso pendiente ya está marcado. */}
      {puente && !puenteAnda && <AvisoPuente puente={puenteVivo} ahora={ahoraTick} />}

      {contexto && !contexto.tieneFotos && (
        <Alert tono="warn">
          Antes de crear tu primer anuncio sube una foto tuya en{' '}
          <Link href="/onboarding">Onboarding → Persona</Link>: es la que le da la cara a tu
          avatar, y sin ella cada toma sale con una persona distinta.
        </Alert>
      )}

      {/* El título es el protagonista de la pantalla y el botón vive a su lado:
          es la única acción, así que se lee junto a lo que hay que hacer antes. */}
      <div style={{
        display: 'flex', alignItems: 'center', justifyContent: 'space-between',
        gap: 16, flexWrap: 'wrap', marginBottom: 22,
      }}>
        <h1 style={{
          margin: 0, fontSize: 'clamp(26px, 3.2vw, 34px)', fontWeight: 700,
          letterSpacing: '-.02em', color: 'var(--ink)', lineHeight: 1.15,
        }}>
          Elige el formato
        </h1>
        {/*
          El botón es la ÚNICA acción de la pantalla, así que pesa como tal: más
          alto, más aire a los lados y el texto más grande que un botón normal.
          Un `size="lg"` del kit lo dejaba del tamaño de cualquier otro y se leía
          como un control más entre varios — y acá no hay varios.
        */}
        <Button
          variant="mako"
          size="xl"
          disabled={!puedeCrear || (!!puente && !puenteAnda)}
          onClick={() => puestaId && empezar(puestaId)}
          icon={<Icon name="ia" size={19} />}
        >
          Crear mi anuncio
        </Button>
      </div>

      <div style={{ display: 'flex', gap: 22, flexWrap: 'wrap' }}>
        {PLANTILLAS.map((p) => (
          <Plantilla
            key={p.id}
            nombre={p.nombre}
            video={p.ejemplo!.video}
            poster={p.ejemplo!.poster}
            elegida={p.id === puestaId}
            // Un click ELIGE y arranca: es lo que pidió Martín —«al seleccionar
            // un template… que haga una animación y se ponga en el centro,
            // desapareciendo a los otros»— y de paso saca el paso intermedio de
            // apretar «Crear» arriba.
            onElegir={(caja) => empezar(p.id, caja)}
            onDetalle={() => setDetalle(p)}
          />
        ))}
      </div>

      {/*
        Los anuncios TERMINADOS, abajo de las plantillas.

        Va abajo y no arriba porque a esta pantalla se viene a crear uno nuevo:
        lo hecho es referencia, no destino. Y va acá y no en su propia tab porque
        el dueño lo pidió así — «por ahora los tendremos allí, luego lo
        mudaremos».

        Si no hay ninguno NO se muestra un vacío decorativo: una sección que dice
        «todavía no hay nada» en una pantalla donde todavía no puede haber nada
        es ruido. Aparece cuando hay algo que mirar.
      */}
      {anuncios.length > 0 && (
        // ⚠️ DESPLEGABLE Y CERRADO, que es lo que pidió el dueño. A esta pantalla
        // se viene a crear uno nuevo: lo hecho es referencia, no destino, así que
        // cuesta UNA fila hasta que alguien la pide. Con `<details>` nativo, que
        // trae gratis el teclado y el foco.
        //
        // El número va en el resumen: es lo que decide si vale la pena abrirlo.
        <details className="mk-plegable" style={{ marginTop: 40 }}>
          <summary className="mk-plegable__resumen">
            <span className="mk-plegable__chev"><Icon name="chevron" size={15} /></span>
            Anuncios terminados
            <span className="mk-plegable__n">{anuncios.length}</span>
          </summary>

          <div className="mk-plegable__lista">
            {anuncios.map((a) => (
              <AnuncioFila key={a.id} a={a} onVer={() => setVerAnuncio(a)} />
            ))}
          </div>
        </details>
      )}

      {/* El anuncio en su tamaño real, recién cuando se pide. La lista sirve para
          reconocerlo; mirarlo es otra cosa y merece la pantalla. */}
      {verAnuncio && (
        <Modal titulo={verAnuncio.titulo} onCerrar={() => setVerAnuncio(null)} ancho={520}>
          <video
            src={verAnuncio.url}
            poster={verAnuncio.poster}
            controls
            autoPlay
            playsInline
            style={{
              display: 'block', width: '100%', aspectRatio: '9 / 16',
              objectFit: 'cover', background: '#000', borderRadius: 'var(--r-md)',
            }}
          />
        </Modal>
      )}

      {/*
        ⚠️ SIEMPRE, Y PLEGADO. Antes se dibujaba sólo cuando el puente NO andaba,
        con el argumento de que «una vez que anda, el dueño no tiene por qué
        volver a leer cuatro pasos». El argumento era correcto y la conclusión no:
        aparecer/desaparecer hace que la única forma de reconectar sea que la cosa
        ya esté rota, y mientras tanto no hay dónde mirar el saldo.

        Plegado cuesta una fila, y esa fila DICE el estado —«Listo · 1.012
        créditos», «Falta abrir Google Flow»—, que es justo lo que antes obligaba
        a desplegar cuatro pasos para averiguar.
      */}
      {/* ⚠️ SIN ancho propio. Con `maxWidth: 780` la fila plegada terminaba 250 px
          antes que la de «Anuncios terminados», que es su hermana visual y su
          vecina inmediata: dos filetes de largo distinto uno encima del otro se
          leen como un error de maquetado. La medida de lectura se cuida ADENTRO,
          en el contenido, que es donde importa. */}
      {puente && (
        <div style={{ marginTop: 40 }}>
          <PuentePanel inicial={puente} saldo={saldo} onEstado={setPuenteVivo} />
        </div>
      )}

      {detalle && (
        <DetalleFormato
          puesta={detalle}
          onCerrar={() => setDetalle(null)}
          onUsar={() => { const id = detalle.id; setDetalle(null); empezar(id); }}
        />
      )}
    </Pagina>
  );
}
