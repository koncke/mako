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

import { useCallback, useEffect, useMemo, useState } from 'react';
import Link from '@/app/_ui/Link';
import {
  Pagina, PageHeader, Section, Button, Textarea, Alert, Tag, Modal, MONO,
} from '@/app/_ui';
import { WizardShell } from '../_components/WizardShell';
import { Icon } from '../_components/icons';
import type { PlanGuardado, EstadoContextoVideo } from './video-datos';
import {
  guionATexto,
  puestaPorId, puestasOfrecidas, type Puesta,
} from './video-pedido';
import { generarPlanAction } from './actions';
import { PuentePanel } from './PuentePanel';
import type { Puente } from '@/lib/flow-cola';
import { cabidaDeGuion } from '@/lib/puestas-data';
import type { GuionDisponible } from './guiones-datos';
import { CargarGuiones } from './CargarGuiones';

type Vista = 'catalogo' | 'wizard' | 'anuncio';

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
const PASOS = ['guion'] as const;
type Paso = (typeof PASOS)[number];

const PREGUNTA: Record<Paso, string> = {
  guion: '¿Cuál de tus guiones quieres grabar?',
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
  elegida: boolean; onElegir: () => void; onDetalle: () => void;
}) {
  return (
    <div style={{ width: 220 }}>
      <button
        type="button"
        onClick={onElegir}
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
        <div style={{ position: 'relative', borderRadius: 'var(--r-md)', overflow: 'hidden', lineHeight: 0 }}>
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
              background: 'var(--primary)', color: '#fff', display: 'grid', placeItems: 'center',
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

function DetalleFormato({
  puesta, onCerrar, onUsar,
}: {
  puesta: Puesta; onCerrar: () => void; onUsar: () => void;
}) {
  const ej = puesta.ejemplo!;
  return (
    <Modal
      titulo={puesta.nombre}
      encabezado={puesta.tecnico}
      onCerrar={onCerrar}
      ancho={720}
      pie={<Button variant="mako" onClick={onUsar} icon={<Icon name="mako" size={14} />}>Crear con este formato</Button>}
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

function LineaGuion({
  n, segundos, habla, voz, palabras, tope, voseo,
}: {
  n: number; segundos: number; habla: boolean; voz: string;
  palabras: number; tope: number; voseo: string[];
}) {
  const alerta = palabras > tope || voseo.length > 0;
  return (
    <div style={{
      display: 'flex', alignItems: 'flex-start', gap: 12, padding: '9px 0',
      borderTop: n === 1 ? 'none' : '1px solid var(--border)',
    }}>
      <span style={{
        flex: 'none', fontFamily: MONO, fontSize: 11, color: 'var(--faint)',
        minWidth: 40, paddingTop: 3,
      }}>
        {segundos}s
      </span>
      <div style={{ flex: 1, minWidth: 0 }}>
        <div style={{ fontSize: 'var(--fs-md)', color: 'var(--ink)', lineHeight: 1.6 }}>
          {habla ? <Enfasis texto={voz} /> : <em style={{ color: 'var(--dim)' }}><Enfasis texto={voz} /></em>}
        </div>
        {alerta && (
          <div style={{ fontSize: 'var(--fs-sm)', color: 'var(--warn)', lineHeight: 1.5, marginTop: 4 }}>
            {palabras > tope && <div>Es muy largo para {segundos} segundos. Pide acortarlo.</div>}
            {voseo.length > 0 && <div>Tiene palabras de otro país ({voseo.join(', ')}) para el acento elegido.</div>}
          </div>
        )}
      </div>
    </div>
  );
}

// ── La app ───────────────────────────────────────────────────────────────────

export function VideoGeneratorApp({
  historialInicial, contexto, puente, guiones }: {
  historialInicial: PlanGuardado[];
  contexto: EstadoContextoVideo | null;
  puente: Puente | null; guiones: GuionDisponible[] }) {
  const PLANTILLAS = useMemo(() => puestasOfrecidas(), []);

  const [historial, setHistorial] = useState<PlanGuardado[]>(historialInicial);
  const [actual, setActual] = useState<PlanGuardado | null>(null);
  // Siempre se entra al catálogo, aunque haya anuncios hechos: se viene a crear
  // uno nuevo, no a releer el anterior.
  const [vista, setVista] = useState<Vista>('catalogo');

  // El reloj que permite que «el puente anda» se apague solo. Arranca en `null`
  // para no decidir una rama con dos relojes distintos —el del server y el del
  // navegador— durante la hidratación.
  const [ahoraTick, setAhoraTick] = useState<number | null>(null);
  useEffect(() => {
    setAhoraTick(Date.now());
    const t = window.setInterval(() => setAhoraTick(Date.now()), 30000);
    return () => window.clearInterval(t);
  }, []);
  /** La plantilla abierta en el detalle. null = modal cerrado. */
  const [detalle, setDetalle] = useState<Puesta | null>(null);
  const [paso, setPaso] = useState<Paso>('guion');

  // Vacío a propósito: el botón «Crear» nace apagado y se enciende al elegir.
  // Con una preseleccionada, el marco azul dice «ya elegiste» sin que nadie
  // haya elegido.
  const [puestaId, setPuestaId] = useState<string>('');
  /** El guion de MaKo elegido. Es lo ÚNICO que el wizard pide. */
  const [guionId, setGuionId] = useState<string>('');
  /** El modal de pegar guiones propios. */
  const [cargando, setCargando] = useState(false);
  const [feedback, setFeedback] = useState('');
  const [verGuiones, setVerGuiones] = useState(false);
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const puesta = useMemo(() => puestaPorId(puestaId), [puestaId]);
  const puestaActual = useMemo(
    () => (actual ? puestaPorId(actual.plan.puestaId) : undefined),
    [actual],
  );
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

  const idx = PASOS.indexOf(paso);
  const puedeAvanzar = !!guionId;

  const empezar = useCallback((id: string) => {
    setPuestaId(id);
    setGuionId('');
    setPaso('guion');
    setError(null);
    setVista('wizard');
  }, []);

  const generar = useCallback(async (conFeedback: boolean) => {
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
        feedback,
        anteriorId: conFeedback ? actual?.id : undefined,
      });
      if (!out.ok) { setError(out.error); return; }
      setHistorial(out.historial);
      setActual(out.item);
      setFeedback('');
      setVista('anuncio');
    } finally {
      setBusy(false);
    }
  }, [puestaId, guion, feedback, actual]);

  const copiarGuion = useCallback(() => {
    if (!actual) return;
    navigator.clipboard.writeText(guionATexto(actual.plan)).catch(() => {
      /* sin portapapeles: el guion igual está en pantalla */
    });
  }, [actual]);

  // ── Las tres preguntas ─────────────────────────────────────────────────────
  if (vista === 'wizard') {
    return (
      <WizardShell
        titulo={puesta ? puesta.nombre : 'Nuevo anuncio'}
        pasos={PASOS}
        pasoActual={paso}
        pregunta={PREGUNTA[paso]}
        error={error}
        puedeAvanzar={puedeAvanzar}
        enUltimo
        confirmLabel="Crear mi anuncio"
        pending={busy}
        cargando={busy ? 'MaKo está escribiendo tu anuncio…' : null}
        atrasLabel={idx === 0 ? 'Cambiar plantilla' : 'Atrás'}
        onAtras={() => (idx === 0 ? setVista('catalogo') : setPaso(PASOS[idx - 1]))}
        onSiguiente={() => setPaso(PASOS[idx + 1])}
        onConfirmar={() => void generar(false)}
        onClose={() => setVista('catalogo')}
        fullscreen
        embebido
      >
        {paso === 'guion' && (
          <div style={{ textAlign: 'left' }}>
            {cargando && (
              <CargarGuiones
                onCerrar={() => setCargando(false)}
                onCargado={() => {
                  setCargando(false);
                  // Se recarga la página en vez de empujar los nuevos al estado
                  // local: los guiones bajan del server como props, así que
                  // agregarlos a mano acá crearía una segunda copia que se
                  // desincroniza en cuanto alguien los toque desde /ads-writer.
                  window.location.reload();
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
                  ángulo y tu avatar — o carga el tuyo acá abajo.
                </Alert>
                <button
                  type="button"
                  onClick={() => setCargando(true)}
                  style={{
                    display: 'flex', flexDirection: 'column', alignItems: 'center',
                    justifyContent: 'center', gap: 7, width: '100%', marginTop: 14,
                    padding: '28px 15px', borderRadius: 12, cursor: 'pointer',
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
                  <span style={{ fontSize: 26, lineHeight: 1 }}>＋</span>
                  <span style={{ fontSize: 'var(--fs-md)', fontWeight: 650 }}>Cargar un guion mío</span>
                  <span style={{ fontSize: 'var(--fs-meta)', lineHeight: 1.5, textAlign: 'center' }}>
                    Escríbelo, sube un archivo o pega un link.<br />Si trae varios, los separo.
                  </span>
                </button>
              </div>
            ) : (
              <div style={{ display: 'grid', gap: 10 }}>
                {guiones.map((g) => {
                  const elegido = g.id === guionId;
                  const cab = puesta ? cabidaDeGuion(puesta, g.hablado) : null;
                  return (
                    <button
                      key={g.id}
                      type="button"
                      onClick={() => setGuionId(g.id)}
                      aria-pressed={elegido}
                      style={{
                        display: 'block', width: '100%', textAlign: 'left', cursor: 'pointer',
                        fontFamily: 'inherit', padding: '13px 15px', borderRadius: 12,
                        background: elegido ? 'var(--primary-bg)' : 'var(--surface)',
                        border: `1.5px solid ${elegido ? 'var(--primary)' : 'var(--border)'}`,
                      }}
                    >
                      <div style={{
                        display: 'flex', alignItems: 'center', gap: 8, flexWrap: 'wrap',
                        marginBottom: 6,
                      }}>
                        <span style={{ fontSize: 'var(--fs-md)', fontWeight: 650, color: 'var(--ink)' }}>
                          {g.angulo || 'Sin ángulo'}
                        </span>
                        {g.estructura && <Tag>{g.estructura}</Tag>}
                        {/*
                          «Detectar si alguno ya fue creado con esta
                          funcionalidad» — pedido textual. No lo bloquea: grabar
                          otra versión del mismo guion es legítimo. Solo lo dice.
                        */}
                        {g.yaUsado && <Tag color="var(--faint)">Ya lo grabaste</Tag>}
                      </div>

                      <div style={{
                        fontSize: 'var(--fs-sm)', color: 'var(--dim)', lineHeight: 1.55,
                      }}>
                        {g.primeraLinea}…
                      </div>

                      {/* La duración DERIVADA, que es lo que reemplaza al paso que
                          preguntaba cuánto tenía que durar. */}
                      <div style={{
                        display: 'flex', alignItems: 'center', gap: 10, flexWrap: 'wrap',
                        marginTop: 8, fontSize: 'var(--fs-meta)', color: 'var(--faint)',
                      }}>
                        <span>{g.palabras} palabras</span>
                        {cab && (
                          <>
                            <span>·</span>
                            <span>{cab.segundosReales}s en {cab.clips} tomas</span>
                            {cab.desborda && (
                              <span style={{ color: 'var(--warn)', fontWeight: 650 }}>
                                · No entra en este formato: sobran {cab.palabrasDeMas} palabras
                              </span>
                            )}
                          </>
                        )}
                      </div>
                    </button>
                  );
                })}

                {/*
                  El placeholder va DENTRO de la lista y del mismo tamaño que una
                  card, no como un botón aparte: cargar un guion propio es una
                  opción más entre los guiones, no una acción de otra categoría.
                  Es el molde de «Crear nuevo proyecto» del board.

                  Punteado y no sólido porque no hay nada adentro todavía: el
                  borde dice «acá va a haber uno» sin fingir que ya lo hay.
                */}
                <button
                  type="button"
                  onClick={() => setCargando(true)}
                  style={{
                    display: 'flex', flexDirection: 'column', alignItems: 'center',
                    justifyContent: 'center', gap: 7, width: '100%',
                    padding: '20px 15px', borderRadius: 12, cursor: 'pointer',
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
                  <span style={{ fontSize: 24, lineHeight: 1 }}>＋</span>
                  <span style={{ fontSize: 'var(--fs-md)', fontWeight: 650 }}>Cargar un guion mío</span>
                  <span style={{ fontSize: 'var(--fs-meta)', lineHeight: 1.5, textAlign: 'center' }}>
                    Escríbelo, sube un archivo o pega un link.<br />Si trae varios, los separo.
                  </span>
                </button>
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

      </WizardShell>
    );
  }

  // ── El anuncio ─────────────────────────────────────────────────────────────
  if (vista === 'anuncio' && actual) {
    return (
      <Pagina>
        <PageHeader
          titulo={actual.plan.titulo}
          // Sin ícono: `arrow-left` no existe en el set y `<Icon>` no falla con
          // un nombre desconocido — cae a `dot` y dibuja un puntito.
          acciones={
            <Button variant="secondary" onClick={() => setVista('catalogo')}>
              Volver al catálogo
            </Button>
          }
          accion={
            <Button
              variant="mako"
              disabled
              title="La generación automática del video se enciende cuando termine la conexión con el generador"
            >
              Generar el video
            </Button>
          }
        />

        {error && <Alert tono="bad">{error}</Alert>}

        <div style={{ maxWidth: 780 }}>
          <div style={{ display: 'flex', flexWrap: 'wrap', gap: 6, marginBottom: 16 }}>
            {puestaActual && <Tag>{puestaActual.nombre}</Tag>}
            <Tag>{actual.plan.duracionTotalSeg} segundos</Tag>
            <Tag>{actual.plan.clips.length} tomas</Tag>
          </div>

          <Section
            titulo="Tu guion"
            accion={
              <Button size="sm" variant="tertiary" onClick={copiarGuion} icon={<Icon name="copy" size={13} />}>
                Copiar
              </Button>
            }
          >
            <div>
              {actual.plan.clips.map((c) => (
                <LineaGuion
                  key={c.n}
                  n={c.n}
                  segundos={c.segundos}
                  habla={c.habla}
                  voz={c.voz}
                  // Un anuncio guardado ANTES de que existieran estos campos no
                  // los trae: el historial vive en app_settings y no migra.
                  palabras={c.palabras ?? 0}
                  tope={c.tope ?? 0}
                  // Las marcas de voseo solo importan si el acento NO es rioplatense: en
                  // uno que sí lo es, «tenés» no es una filtración, es el idioma.
                  // El acento sale del PLAN —lo escribió el server al generarlo— y
                  // no de un estado de esta pantalla, que ya no lo pregunta.
                  voseo={actual.plan.acentoEsVoseante ? [] : (c.voseo ?? [])}
                />
              ))}
            </div>
          </Section>

          <div style={{ marginTop: 'var(--gap)' }}>
            <Section titulo="¿Le cambiamos algo?">
              <Textarea
                rows={2}
                value={feedback}
                onChange={(e) => setFeedback(e.target.value)}
                placeholder="El cierre no convence, la tercera toma dice lo mismo que la segunda..."
              />
              <div style={{ marginTop: 10 }}>
                <Button
                  variant="mako"
                  onClick={() => void generar(true)}
                  loading={busy}
                  disabled={!feedback.trim()}
                >
                  Reescribirlo
                </Button>
              </div>
            </Section>
          </div>
        </div>
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
  const puenteAnda = puente?.estado === 'listo'
    && !!puente.ultimoVisto
    && (ahoraTick == null || ahoraTick - new Date(puente.ultimoVisto).getTime() < 2 * 60 * 1000);

  return (
    <Pagina>
      {error && <Alert tono="bad">{error}</Alert>}

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
          disabled={!puedeCrear}
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
            onElegir={() => setPuestaId(p.id)}
            onDetalle={() => setDetalle(p)}
          />
        ))}
      </div>

      {/*
        El puente SOLO se muestra cuando hay algo que hacer con él.

        Es un paso previo, no una sección de esta pantalla: una vez que anda, el
        dueño no tiene por qué volver a leer cuatro pasos de instalación cada vez
        que entra a hacer un anuncio. «Ya comprobó que funcionaba, ya no debe
        aparecer.»

        Vivo y no recordado: un puente que dejó de llamar vuelve a mostrarse solo,
        que es exactamente cuando hay algo que hacer otra vez.
      */}
      {puente && !puenteAnda && (
        <div style={{ marginTop: 'var(--gap)', maxWidth: 780 }}>
          <PuentePanel inicial={puente} />
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
