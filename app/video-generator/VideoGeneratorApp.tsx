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
  Pagina, PageHeader, Section, Button, Textarea, Alert, Tag, Status, MONO,
} from '@/app/_ui';
import { WizardShell } from '../_components/WizardShell';
import { Icon } from '../_components/icons';
import type { PlanGuardado, EstadoContextoVideo } from './video-datos';
import {
  ACENTOS, DURACIONES_VIDEO, acentoEsVoseante, duracionReal, guionATexto,
  puestaPorId, puestasOfrecidas, segundosDe,
} from './video-pedido';
import { generarPlanAction } from './actions';

type Vista = 'catalogo' | 'wizard' | 'anuncio';

const PASOS = ['tema', 'duracion', 'acento'] as const;
type Paso = (typeof PASOS)[number];

const PREGUNTA: Record<Paso, string> = {
  tema: '¿De qué habla tu anuncio?',
  duracion: '¿Cuánto tiene que durar?',
  acento: '¿Con qué acento habla?',
};

function fechaCorta(iso: string): string {
  try { return new Date(iso).toLocaleDateString('es-MX', { day: 'numeric', month: 'short' }); }
  catch { return ''; }
}

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

function Plantilla({
  nombre, descripcion, video, poster, onElegir,
}: {
  nombre: string; descripcion: string; video: string; poster: string;
  onElegir: () => void;
}) {
  return (
    <button
      type="button"
      onClick={onElegir}
      style={{
        display: 'block', width: 230, cursor: 'pointer', textAlign: 'left',
        background: 'transparent', border: 'none', padding: 0, fontFamily: 'inherit',
      }}
    >
      <div style={{
        position: 'relative', borderRadius: 'var(--r-md)', overflow: 'hidden',
        border: '1px solid var(--border)', lineHeight: 0,
      }}>
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
          position: 'absolute', inset: 'auto 0 0 0', padding: '26px 12px 10px',
          background: 'linear-gradient(to top, rgba(0,0,0,.72), transparent)',
          color: '#fff', fontSize: 'var(--fs-md)', fontWeight: 650, lineHeight: 1.3,
        }}>
          {nombre}
        </div>
      </div>
      <div style={{ fontSize: 'var(--fs-sm)', color: 'var(--dim)', lineHeight: 1.5, marginTop: 8 }}>
        {descripcion}
      </div>
      {/* Un <span> y no un <Button>: la tarjeta ENTERA ya es el botón, y un
          <button> dentro de otro es HTML inválido — React lo reporta como
          mismatch de hidratación, que se lee como un bug de datos y no lo es. */}
      <span style={{
        display: 'block', marginTop: 10, textAlign: 'center',
        padding: '8px 12px', borderRadius: 'var(--r-sm)',
        background: 'var(--surface-2)', border: '1px solid var(--border-strong)',
        fontSize: 'var(--fs-sm)', fontWeight: 600, color: 'var(--ink)',
      }}>
        Usar esta plantilla
      </span>
    </button>
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
  historialInicial, contexto,
}: {
  historialInicial: PlanGuardado[];
  contexto: EstadoContextoVideo | null;
}) {
  const PLANTILLAS = useMemo(() => puestasOfrecidas(), []);

  const [historial, setHistorial] = useState<PlanGuardado[]>(historialInicial);
  const [actual, setActual] = useState<PlanGuardado | null>(null);
  // Siempre se entra al catálogo, aunque haya anuncios hechos: se viene a crear
  // uno nuevo, no a releer el anterior.
  const [vista, setVista] = useState<Vista>('catalogo');
  const [paso, setPaso] = useState<Paso>('tema');

  const [puestaId, setPuestaId] = useState<string>(PLANTILLAS[0]?.id ?? '');
  const [tema, setTema] = useState('');
  const [duracion, setDuracion] = useState<string>(DURACIONES_VIDEO[1].value);
  const [acento, setAcento] = useState<string>(ACENTOS[0].value);
  const [feedback, setFeedback] = useState('');
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
  return (
    <Pagina>
      <PageHeader titulo="Video Generator" />

      {error && <Alert tono="bad">{error}</Alert>}

      {contexto && !contexto.tieneFotos && (
        <Alert tono="warn">
          Antes de crear tu primer anuncio sube una foto tuya en{' '}
          <Link href="/onboarding">Onboarding → Persona</Link>: es la que le da la cara a tu
          avatar, y sin ella cada toma sale con una persona distinta.
        </Alert>
      )}

      <Section titulo="Elige el estilo de tu anuncio">
        <div style={{ display: 'flex', gap: 20, flexWrap: 'wrap' }}>
          {PLANTILLAS.map((p) => (
            <Plantilla
              key={p.id}
              nombre={p.nombre}
              descripcion={p.descripcion}
              video={p.ejemplo!.video}
              poster={p.ejemplo!.poster}
              onElegir={() => empezar(p.id)}
            />
          ))}
        </div>
      </Section>

      {historial.length > 0 && (
        <div style={{ marginTop: 'var(--gap)' }}>
          <Section titulo="Tus anuncios">
            <div style={{ display: 'grid', gap: 4 }}>
              {historial.map((h) => (
                <button
                  key={h.id}
                  type="button"
                  onClick={() => { setActual(h); setVista('anuncio'); }}
                  style={{
                    display: 'flex', alignItems: 'center', gap: 10, width: '100%',
                    textAlign: 'left', cursor: 'pointer', fontFamily: 'inherit',
                    background: 'transparent', border: 'none',
                    borderBottom: '1px solid var(--border)', padding: '9px 2px',
                  }}
                >
                  <span style={{ flex: 1, minWidth: 0, fontSize: 'var(--fs-md)', color: 'var(--ink)', overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>
                    {h.plan.titulo}
                  </span>
                  <Status tono="neutral">Guion listo</Status>
                  <span style={{ flex: 'none', fontSize: 'var(--fs-xs)', color: 'var(--faint)' }}>
                    {fechaCorta(h.at)}
                  </span>
                </button>
              ))}
            </div>
          </Section>
        </div>
      )}
    </Pagina>
  );
}
