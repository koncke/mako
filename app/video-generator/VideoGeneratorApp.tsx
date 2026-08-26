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

import { useCallback, useMemo, useState } from 'react';
import Link from '@/app/_ui/Link';
import {
  Pagina, PageHeader, Section, Button, Textarea, Alert, Tag, Modal, MONO,
} from '@/app/_ui';
import { WizardShell } from '../_components/WizardShell';
import { Icon } from '../_components/icons';
import type { PlanGuardado, EstadoContextoVideo } from './video-datos';
import {
  ACENTOS, DURACIONES_VIDEO, acentoEsVoseante, duracionReal, guionATexto,
  puestaPorId, puestasOfrecidas, segundosDe, type Puesta,
} from './video-pedido';
import { generarPlanAction } from './actions';
import { PuentePanel } from './PuentePanel';
import type { Puente } from '@/lib/flow-cola';

type Vista = 'catalogo' | 'wizard' | 'anuncio';

const PASOS = ['tema', 'duracion', 'acento'] as const;
type Paso = (typeof PASOS)[number];

const PREGUNTA: Record<Paso, string> = {
  tema: '¿De qué habla tu anuncio?',
  duracion: '¿Cuánto tiene que durar?',
  acento: '¿Con qué acento habla?',
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
            color: '#fff', fontSize: 'var(--fs-lg)', fontWeight: 650, lineHeight: 1.25,
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
  historialInicial, contexto, puente,
}: {
  historialInicial: PlanGuardado[];
  contexto: EstadoContextoVideo | null;
  puente: Puente | null;
}) {
  const PLANTILLAS = useMemo(() => puestasOfrecidas(), []);

  const [historial, setHistorial] = useState<PlanGuardado[]>(historialInicial);
  const [actual, setActual] = useState<PlanGuardado | null>(null);
  // Siempre se entra al catálogo, aunque haya anuncios hechos: se viene a crear
  // uno nuevo, no a releer el anterior.
  const [vista, setVista] = useState<Vista>('catalogo');
  /** La plantilla abierta en el detalle. null = modal cerrado. */
  const [detalle, setDetalle] = useState<Puesta | null>(null);
  const [paso, setPaso] = useState<Paso>('tema');

  // Vacío a propósito: el botón «Crear» nace apagado y se enciende al elegir.
  // Con una preseleccionada, el marco azul dice «ya elegiste» sin que nadie
  // haya elegido.
  const [puestaId, setPuestaId] = useState<string>('');
  const [tema, setTema] = useState('');
  const [duracion, setDuracion] = useState<string>(DURACIONES_VIDEO[1].value);
  const [acento, setAcento] = useState<string>(ACENTOS[0].value);
  const [feedback, setFeedback] = useState('');
  const [verGuiones, setVerGuiones] = useState(false);
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const puesta = useMemo(() => puestaPorId(puestaId), [puestaId]);
  const puestaActual = useMemo(
    () => (actual ? puestaPorId(actual.plan.puestaId) : undefined),
    [actual],
  );
  const real = useMemo(
    () => (puesta ? duracionReal(puesta, segundosDe(duracion)) : null),
    [puesta, duracion],
  );
  const desvia = real ? Math.abs(real.segundos - segundosDe(duracion)) > 5 : false;

  const idx = PASOS.indexOf(paso);
  const puedeAvanzar = paso === 'tema' ? tema.trim().length > 0 : true;

  const empezar = useCallback((id: string) => {
    setPuestaId(id);
    setTema('');
    setPaso('tema');
    setError(null);
    setVista('wizard');
  }, []);

  const generar = useCallback(async (conFeedback: boolean) => {
    setBusy(true); setError(null);
    try {
      const out = await generarPlanAction({
        puestaId, tema, duracion, acento,
        feedback: conFeedback ? feedback : undefined,
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
  }, [puestaId, tema, duracion, acento, feedback, actual]);

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
        enUltimo={paso === 'acento'}
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
        {paso === 'tema' && (
          <>
            <Textarea
              rows={7}
              value={tema}
              onChange={(e) => setTema(e.target.value)}
              placeholder="Cuéntalo como se lo contarías a un cliente: qué pasó, a quién, y qué cambió."
            />
            <div style={{ fontSize: 'var(--fs-sm)', color: 'var(--faint)', marginTop: 10, textAlign: 'left' }}>
              No hace falta que esté prolijo ni que sea corto. Con un caso concreto alcanza.
            </div>

            {historial.length > 0 && (
              <div style={{ marginTop: 16, borderTop: '1px solid var(--border)', paddingTop: 12, textAlign: 'left' }}>
                <button
                  type="button"
                  onClick={() => setVerGuiones((v) => !v)}
                  aria-expanded={verGuiones}
                  style={{
                    background: 'transparent', border: 'none', padding: 0, cursor: 'pointer',
                    fontFamily: 'inherit', fontSize: 'var(--fs-sm)', color: 'var(--dim)',
                    textDecoration: 'underline', textUnderlineOffset: 3,
                  }}
                >
                  {verGuiones ? 'Ocultar' : `Ya escribiste ${historial.length} ${historial.length === 1 ? 'guion' : 'guiones'}`}
                </button>

                {verGuiones && (
                  <div style={{ display: 'grid', gap: 2, marginTop: 10 }}>
                    {historial.map((h) => (
                      <button
                        key={h.id}
                        type="button"
                        onClick={() => { setActual(h); setVista('anuncio'); }}
                        style={{
                          display: 'flex', alignItems: 'center', gap: 10, width: '100%',
                          textAlign: 'left', cursor: 'pointer', fontFamily: 'inherit',
                          background: 'transparent', border: 'none', padding: '7px 2px',
                          borderBottom: '1px solid var(--border)',
                        }}
                      >
                        <span style={{
                          flex: 1, minWidth: 0, fontSize: 'var(--fs-sm)', color: 'var(--ink)',
                          overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap',
                        }}>
                          {h.plan.titulo}
                        </span>
                        <span style={{ flex: 'none', fontSize: 'var(--fs-xs)', color: 'var(--faint)' }}>
                          {h.plan.duracionTotalSeg}s
                        </span>
                      </button>
                    ))}
                  </div>
                )}
              </div>
            )}
          </>
        )}

        {paso === 'duracion' && (
          <>
            <div style={{ display: 'grid', gap: 8 }}>
              {DURACIONES_VIDEO.map((o) => {
                const on = o.value === duracion;
                return (
                  <button
                    key={o.value}
                    type="button"
                    onClick={() => setDuracion(o.value)}
                    aria-pressed={on}
                    style={{
                      display: 'block', width: '100%', textAlign: 'left', cursor: 'pointer',
                      padding: '11px 14px', borderRadius: 'var(--r-md)', fontFamily: 'inherit',
                      background: on ? 'var(--primary-bg)' : 'var(--surface)',
                      border: `1px solid ${on ? 'var(--primary)' : 'var(--border)'}`,
                    }}
                  >
                    <div style={{ fontSize: 'var(--fs-md)', fontWeight: on ? 650 : 500, color: 'var(--ink)' }}>{o.label}</div>
                    <div style={{ fontSize: 'var(--fs-sm)', color: 'var(--dim)', marginTop: 2 }}>{o.hint}</div>
                  </button>
                );
              })}
            </div>
            {real && desvia && (
              <div style={{ marginTop: 10 }}>
                <Alert tono="warn">
                  Esta plantilla trabaja con tomas de {puesta?.segundosClip[0]} a{' '}
                  {puesta?.segundosClip[1]} segundos, así que tu anuncio va a durar{' '}
                  {real.segundos} y no {segundosDe(duracion)}.
                </Alert>
              </div>
            )}
          </>
        )}

        {paso === 'acento' && (
          <>
            <div style={{ display: 'grid', gap: 8 }}>
              {ACENTOS.map((o) => {
                const on = o.value === acento;
                return (
                  <button
                    key={o.value}
                    type="button"
                    onClick={() => setAcento(o.value)}
                    aria-pressed={on}
                    style={{
                      display: 'block', width: '100%', textAlign: 'left', cursor: 'pointer',
                      padding: '10px 14px', borderRadius: 'var(--r-md)', fontFamily: 'inherit',
                      background: on ? 'var(--primary-bg)' : 'var(--surface)',
                      border: `1px solid ${on ? 'var(--primary)' : 'var(--border)'}`,
                      fontSize: 'var(--fs-md)', fontWeight: on ? 650 : 500, color: 'var(--ink)',
                    }}
                  >
                    {o.label}
                  </button>
                );
              })}
            </div>
            <div style={{ fontSize: 'var(--fs-sm)', color: 'var(--faint)', marginTop: 12, textAlign: 'left' }}>
              Es el acento con el que va a hablar tu avatar.
            </div>
          </>
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
                  voseo={acentoEsVoseante(acento) ? [] : (c.voseo ?? [])}
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
        <Button
          variant="mako"
          size="lg"
          disabled={!puedeCrear}
          onClick={() => puestaId && empezar(puestaId)}
          icon={<Icon name="mako" size={16} />}
        >
          Crear
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

      {puente && (
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
