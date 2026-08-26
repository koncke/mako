'use client';

// =============================================================================
// VideoGeneratorApp — MaKo planifica el anuncio en video
// =============================================================================
// UNA PREGUNTA POR PANTALLA, con el molde de wizard del repo (WizardShell
// fullscreen embebido, el mismo de los onboardings de tab).
//
// La primera versión de esta pantalla puso las ocho puestas en escena como
// tarjetas con tres párrafos cada una, todas a la vez, al lado del formulario.
// El dueño la rechazó y tenía razón: eso no es elegir, es leer un catálogo.
//
// Dos decisiones que salieron de ahí y no se vuelven atrás:
//
// 1. **El formato se elige VIENDO el anuncio, no leyéndolo.** Cada puesta que se
//    ofrece muestra diez segundos del anuncio real que se produjo con ella. Un
//    formato descrito con palabras se elige a ciegas.
// 2. **Solo se ofrece lo que existe.** Hoy son dos, las dos producidas. Se suman
//    de a una, cuando hay un anuncio nuevo que mostrar.
//
// Cuando ya hay un plan, la pantalla es el PLAN: el wizard vuelve con «Hacer
// otro anuncio».

import { useCallback, useMemo, useState, type CSSProperties } from 'react';
import Link from '@/app/_ui/Link';
import {
  Pagina, PageHeader, Section, Eyebrow, Button, Textarea, Alert, Tag, Status, MONO,
} from '@/app/_ui';
import { WizardShell } from '../_components/WizardShell';
import { Icon } from '../_components/icons';
import type { PlanGuardado, EstadoContextoVideo } from './video-datos';
import {
  ACENTOS, DURACIONES_VIDEO, acentoEsVoseante, duracionReal, planATexto,
  puestaPorId, puestasOfrecidas, segundosDe,
} from './video-pedido';
import { generarPlanAction } from './actions';

const card: CSSProperties = {
  background: 'var(--surface)', border: '1px solid var(--border)',
  borderRadius: 'var(--r-lg)', padding: 'var(--card-pad)',
};

const PASOS = ['formato', 'tema', 'duracion', 'acento'] as const;
type Paso = (typeof PASOS)[number];

const PREGUNTA: Record<Paso, string> = {
  formato: '¿Cómo quieres que se vea tu anuncio?',
  tema: '¿De qué habla?',
  duracion: '¿Cuánto tiene que durar?',
  acento: '¿Con qué acento habla?',
};

function fechaCorta(iso: string): string {
  try { return new Date(iso).toLocaleDateString('es-MX', { day: 'numeric', month: 'short' }); }
  catch { return ''; }
}

// ── Elegir el formato: el anuncio real, en loop ──────────────────────────────

function TarjetaFormato({
  nombre, descripcion, video, poster, elegida, onElegir,
}: {
  nombre: string; descripcion: string; video: string; poster: string;
  elegida: boolean; onElegir: () => void;
}) {
  return (
    <button
      type="button"
      onClick={onElegir}
      aria-pressed={elegida}
      style={{
        display: 'block', width: 200, cursor: 'pointer', textAlign: 'center',
        background: 'transparent', border: 'none', padding: 0, fontFamily: 'inherit',
      }}
    >
      <div style={{
        position: 'relative', borderRadius: 'var(--r-md)', overflow: 'hidden',
        border: `2px solid ${elegida ? 'var(--primary)' : 'var(--border)'}`,
        boxShadow: elegida ? '0 0 0 4px var(--primary-bg)' : 'none',
        lineHeight: 0,
      }}>
        {/* Muted + playsInline: sin las dos, el navegador no deja autoplay. El
            audio no hace falta para juzgar la puesta — lo que se mira es cómo se
            mueve la cámara y qué hace la persona. */}
        <video
          src={video}
          poster={poster}
          autoPlay
          loop
          muted
          playsInline
          style={{ width: '100%', display: 'block', aspectRatio: '9 / 16', objectFit: 'cover' }}
        />
        {elegida && (
          <div style={{
            position: 'absolute', top: 8, right: 8, width: 24, height: 24, borderRadius: 999,
            background: 'var(--primary)', color: '#fff', display: 'grid', placeItems: 'center',
          }}>
            <Icon name="check" size={14} />
          </div>
        )}
      </div>
      <div style={{ fontSize: 'var(--fs-md)', fontWeight: 650, color: 'var(--ink)', marginTop: 10 }}>
        {nombre}
      </div>
      <div style={{ fontSize: 'var(--fs-sm)', color: 'var(--dim)', lineHeight: 1.5, marginTop: 3 }}>
        {descripcion}
      </div>
    </button>
  );
}

// ── Elegir de una lista corta ────────────────────────────────────────────────

function Opciones({
  value, onChange, options,
}: {
  value: string;
  onChange: (v: string) => void;
  options: readonly { value: string; label: string; hint?: string }[];
}) {
  return (
    <div style={{ display: 'grid', gap: 8 }}>
      {options.map((o) => {
        const on = o.value === value;
        return (
          <button
            key={o.value}
            type="button"
            onClick={() => onChange(o.value)}
            aria-pressed={on}
            style={{
              display: 'block', width: '100%', textAlign: 'left', cursor: 'pointer',
              padding: '11px 14px', borderRadius: 'var(--r-md)',
              background: on ? 'var(--primary-bg)' : 'var(--surface)',
              border: `1px solid ${on ? 'var(--primary)' : 'var(--border)'}`,
              fontFamily: 'inherit',
            }}
          >
            <div style={{ fontSize: 'var(--fs-md)', fontWeight: on ? 650 : 500, color: 'var(--ink)' }}>
              {o.label}
            </div>
            {o.hint && (
              <div style={{ fontSize: 'var(--fs-sm)', color: 'var(--dim)', marginTop: 2 }}>{o.hint}</div>
            )}
          </button>
        );
      })}
    </div>
  );
}

/**
 * Pinta el `**énfasis**` del guion en negrita.
 *
 * El modelo lo marca en markdown porque es la instrucción que mejor obedece —y
 * el énfasis importa: es la palabra que el avatar levanta—, pero los asteriscos
 * crudos en pantalla se leen como un error. En el PROMPT quedan tal cual: ahí sí
 * los tiene que ver el modelo de video.
 */
function Enfasis({ texto }: { texto: string }) {
  // Índices impares = lo que estaba entre asteriscos. Un asterisco suelto deja
  // su tramo sin negrita en vez de romper el texto, que es lo conservador.
  const partes = texto.split(/\*\*/);
  return (
    <>
      {partes.map((t, i) => (i % 2 === 1 ? <strong key={i}>{t}</strong> : <span key={i}>{t}</span>))}
    </>
  );
}

// ── Un clip del plan: fila compacta que se abre ─────────────────────────────
// Cerrada muestra lo único que hace falta para ubicarlo: qué dice. Lo técnico
// —qué se ve, cámara, el prompt en inglés— vive adentro, porque es material de
// producción y no de revisión: al aprobar un guion nadie lee inglés técnico.

function ClipFila({
  n, segundos, habla, voz, queSeVe, camara, imagenAdjunta, prompt, palabras, tope, voseo,
}: {
  n: number; segundos: number; habla: boolean; voz: string;
  queSeVe: string; camara: string; imagenAdjunta?: string; prompt: string;
  palabras: number; tope: number; voseo: string[];
}) {
  const [abierto, setAbierto] = useState(false);
  const [copiado, setCopiado] = useState(false);

  const copiar = useCallback(() => {
    navigator.clipboard.writeText(prompt).then(
      () => { setCopiado(true); window.setTimeout(() => setCopiado(false), 1600); },
      () => { /* sin portapapeles: se puede abrir la fila y seleccionarlo a mano */ },
    );
  }, [prompt]);

  const alerta = palabras > tope || voseo.length > 0;

  return (
    <div style={{
      border: `1px solid ${alerta ? 'var(--warn)' : 'var(--border)'}`,
      borderRadius: 'var(--r-md)', background: 'var(--surface)', overflow: 'hidden',
    }}>
      <div style={{ display: 'flex', alignItems: 'flex-start', gap: 10, padding: '10px 12px' }}>
        <button
          type="button"
          onClick={() => setAbierto((v) => !v)}
          aria-expanded={abierto}
          style={{
            flex: 1, minWidth: 0, display: 'flex', alignItems: 'flex-start', gap: 10,
            background: 'transparent', border: 'none', padding: 0, cursor: 'pointer',
            textAlign: 'left', fontFamily: 'inherit',
          }}
        >
          <span style={{
            flex: 'none', fontFamily: MONO, fontSize: 11, color: 'var(--faint)',
            minWidth: 44, paddingTop: 2,
          }}>
            {n} · {segundos}s
          </span>
          <span style={{ flex: 1, minWidth: 0, fontSize: 'var(--fs-md)', color: 'var(--ink)', lineHeight: 1.55 }}>
            {habla ? <Enfasis texto={voz} /> : <em style={{ color: 'var(--dim)' }}><Enfasis texto={voz} /></em>}
          </span>
        </button>
        <Button
          size="sm"
          variant="tertiary"
          onClick={copiar}
          icon={<Icon name={copiado ? 'check' : 'copy'} size={13} />}
        >
          {copiado ? 'Listo' : 'Prompt'}
        </Button>
      </div>

      {alerta && (
        <div style={{ padding: '0 12px 10px 66px', fontSize: 'var(--fs-sm)', color: 'var(--warn)', lineHeight: 1.5 }}>
          {palabras > tope && <div>No entra en {segundos} s: {palabras} palabras y entran {tope}.</div>}
          {voseo.length > 0 && <div>Tiene voseo ({voseo.join(', ')}) y el acento elegido no lo usa.</div>}
        </div>
      )}

      {abierto && (
        <div style={{ padding: '0 12px 12px 66px', borderTop: '1px solid var(--border)', paddingTop: 10 }}>
          <div style={{ fontSize: 'var(--fs-sm)', color: 'var(--dim)', lineHeight: 1.55 }}>
            <div><strong style={{ color: 'var(--faint)', fontWeight: 600 }}>Qué se ve:</strong> {queSeVe}</div>
            <div><strong style={{ color: 'var(--faint)', fontWeight: 600 }}>Cámara:</strong> {camara}</div>
            {imagenAdjunta && (
              <div><strong style={{ color: 'var(--faint)', fontWeight: 600 }}>Adjuntar:</strong> {imagenAdjunta}</div>
            )}
          </div>
          <div style={{
            fontFamily: MONO, fontSize: 'var(--fs-xs)', color: 'var(--dim)',
            background: 'var(--surface-2)', borderRadius: 'var(--r-sm)', padding: 10,
            whiteSpace: 'pre-wrap', lineHeight: 1.55, marginTop: 8,
          }}>{prompt}</div>
        </div>
      )}
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
  const OFRECIDAS = useMemo(() => puestasOfrecidas(), []);

  const [historial, setHistorial] = useState<PlanGuardado[]>(historialInicial);
  const [actual, setActual] = useState<PlanGuardado | null>(historialInicial[0] ?? null);
  // El wizard se abre solo cuando no hay nada que mostrar. Con un plan en
  // pantalla, la pantalla es el plan.
  const [abierto, setAbierto] = useState(historialInicial.length === 0);
  const [paso, setPaso] = useState<Paso>('formato');

  const [puestaId, setPuestaId] = useState<string>(OFRECIDAS[0]?.id ?? '');
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
  const puedeAvanzar =
    paso === 'formato' ? !!puestaId
      : paso === 'tema' ? tema.trim().length > 0
        : true;

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
      setAbierto(false);
      setPaso('formato');
    } finally {
      setBusy(false);
    }
  }, [puestaId, tema, duracion, acento, feedback, actual]);

  const copiarGuion = useCallback(() => {
    if (!actual || !puestaActual) return;
    navigator.clipboard.writeText(planATexto(actual.plan, puestaActual.nombre)).catch(() => {
      /* sin portapapeles: el guion igual está en pantalla */
    });
  }, [actual, puestaActual]);

  // ── El wizard ──────────────────────────────────────────────────────────────
  if (abierto) {
    return (
      <WizardShell
        titulo="Video Generator"
        pasos={PASOS}
        pasoActual={paso}
        pregunta={PREGUNTA[paso]}
        error={error}
        puedeAvanzar={puedeAvanzar}
        enUltimo={paso === 'acento'}
        confirmLabel="Armar el plan"
        pending={busy}
        atrasLabel={idx === 0 ? 'Cancelar' : 'Atrás'}
        onAtras={() => (idx === 0 ? setAbierto(false) : setPaso(PASOS[idx - 1]))}
        onSiguiente={() => setPaso(PASOS[idx + 1])}
        onConfirmar={() => void generar(false)}
        onClose={() => setAbierto(false)}
        // Sin un plan al que volver, «Cancelar» no lleva a ningún lado.
        hideAtras={idx === 0 && historial.length === 0}
        fullscreen
        embebido
      >
        {paso === 'formato' && (
          <>
            {contexto && !contexto.tieneFotos && (
              <div style={{ marginBottom: 14 }}>
                <Alert tono="warn">
                  Este cliente no tiene ninguna foto cargada, y sin eso cada clip genera una
                  cara distinta. Súbela en <Link href="/onboarding">Onboarding → Persona</Link>.
                </Alert>
              </div>
            )}
            <div style={{ display: 'flex', gap: 18, justifyContent: 'center', flexWrap: 'wrap' }}>
              {OFRECIDAS.map((p) => (
                <TarjetaFormato
                  key={p.id}
                  nombre={p.nombre}
                  descripcion={p.descripcion}
                  video={p.ejemplo!.video}
                  poster={p.ejemplo!.poster}
                  elegida={p.id === puestaId}
                  onElegir={() => setPuestaId(p.id)}
                />
              ))}
            </div>
            {/* Decía «hechos con este mismo generador» y era falso: los cuatro
                anuncios se produjeron a mano. El copy tiene que ser CIERTO. */}
            <div style={{ fontSize: 'var(--fs-sm)', color: 'var(--faint)', marginTop: 16 }}>
              Los dos son anuncios reales que ya están corriendo.
            </div>
          </>
        )}

        {paso === 'tema' && (
          <>
            <Textarea
              rows={7}
              value={tema}
              onChange={(e) => setTema(e.target.value)}
              placeholder="Cuenta la historia como se la contarías a un cliente. Si ya tienes el guion escrito, pégalo tal cual."
            />
            <div style={{ fontSize: 'var(--fs-sm)', color: 'var(--faint)', marginTop: 10, textAlign: 'left' }}>
              No hace falta que esté prolijo. Lo que sirve es el caso concreto: qué pasó,
              a quién, y qué cambió.
            </div>
          </>
        )}

        {paso === 'duracion' && (
          <>
            <Opciones value={duracion} onChange={setDuracion} options={DURACIONES_VIDEO} />
            {puesta && real && (
              <div style={{ fontSize: 'var(--fs-sm)', color: 'var(--faint)', marginTop: 12, textAlign: 'left' }}>
                {puesta.nombre}: {real.clips} clips, {real.segundos} segundos en total.
              </div>
            )}
            {puesta && real && desvia && (
              <div style={{ marginTop: 10 }}>
                <Alert tono="warn">
                  {puesta.nombre} necesita entre {puesta.clips[0]} y {puesta.clips[1]} clips de{' '}
                  {puesta.segundosClip[0]} a {puesta.segundosClip[1]} segundos, así que va a
                  durar {real.segundos} y no {segundosDe(duracion)}.
                </Alert>
              </div>
            )}
          </>
        )}

        {paso === 'acento' && (
          <>
            <Opciones value={acento} onChange={setAcento} options={ACENTOS} />
            <div style={{ fontSize: 'var(--fs-sm)', color: 'var(--faint)', marginTop: 12, textAlign: 'left' }}>
              Es el acento con el que va a hablar el avatar. Equivocarlo no se nota al leer
              el guion: se nota cuando lo dice en voz alta.
            </div>
          </>
        )}
      </WizardShell>
    );
  }

  // ── El plan ────────────────────────────────────────────────────────────────
  return (
    <Pagina>
      <PageHeader
        titulo="Video Generator"
        accion={
          <Button
            variant="mako"
            onClick={() => { setAbierto(true); setPaso('formato'); setTema(''); }}
          >
            Hacer otro anuncio
          </Button>
        }
      />

      {error && <Alert tono="bad">{error}</Alert>}

      {actual && puestaActual && (
        <div style={{ display: 'grid', gridTemplateColumns: 'minmax(0, 1fr) 240px', gap: 'var(--gap)', alignItems: 'start' }}>
          <div style={{ display: 'grid', gap: 'var(--gap)' }}>
            {/* EL GUION, una sola vez y en grande. Es lo único que se juzga para
                aprobar el anuncio, así que es lo único que se lee de entrada. */}
            <Section
              titulo={actual.plan.titulo}
              accion={
                <Button
                  size="sm"
                  variant="tertiary"
                  onClick={copiarGuion}
                  icon={<Icon name="copy" size={13} />}
                >
                  Copiar todo
                </Button>
              }
            >
              <div style={{ display: 'flex', flexWrap: 'wrap', gap: 6, marginBottom: 12 }}>
                <Tag>{puestaActual.nombre}</Tag>
                <Tag>{actual.plan.clips.length} clips</Tag>
                <Tag>{actual.plan.duracionTotalSeg} s</Tag>
              </div>
            </Section>

            {actual.plan.imagenesNecesarias.length > 0 && (
              <Alert tono="info">
                <strong>Genera estas imágenes antes de animar:</strong>
                <ol style={{ margin: '6px 0 0', paddingLeft: 18, lineHeight: 1.6 }}>
                  {actual.plan.imagenesNecesarias.map((img, i) => <li key={i}>{img}</li>)}
                </ol>
              </Alert>
            )}

            <Section titulo="El guion" nota="Abre un clip para ver la toma y el prompt">
              <div style={{ display: 'grid', gap: 6 }}>
                {actual.plan.clips.map((c) => (
                  <ClipFila
                    key={c.n}
                    n={c.n}
                    segundos={c.segundos}
                    habla={c.habla}
                    voz={c.voz}
                    queSeVe={c.queSeVe}
                    camara={c.camara}
                    imagenAdjunta={c.imagenAdjunta}
                    prompt={c.prompt}
                    // Un plan guardado ANTES de que existieran estos campos no los
                    // trae: el historial vive en app_settings y no migra.
                    palabras={c.palabras ?? 0}
                    tope={c.tope ?? 0}
                    voseo={acentoEsVoseante(acento) ? [] : (c.voseo ?? [])}
                  />
                ))}
              </div>
            </Section>

            <Section titulo="¿Le cambiamos algo?">
              <Textarea
                rows={2}
                value={feedback}
                onChange={(e) => setFeedback(e.target.value)}
                placeholder="El cierre no convence, el clip 3 dice lo mismo que el 2..."
              />
              <div style={{ marginTop: 10 }}>
                <Button
                  variant="mako"
                  onClick={() => void generar(true)}
                  loading={busy}
                  disabled={!feedback.trim()}
                >
                  Rehacer el plan
                </Button>
              </div>
            </Section>
          </div>

          {historial.length > 1 && (
            <Section titulo="Anteriores">
              <div style={{ display: 'grid', gap: 4 }}>
                {historial.map((h) => (
                  <button
                    key={h.id}
                    type="button"
                    onClick={() => setActual(h)}
                    style={{
                      display: 'block', width: '100%', textAlign: 'left', cursor: 'pointer',
                      background: h.id === actual.id ? 'var(--surface-2)' : 'transparent',
                      border: 'none', borderRadius: 'var(--r-sm)', padding: '7px 9px',
                      fontFamily: 'inherit',
                    }}
                  >
                    <div style={{
                      fontSize: 'var(--fs-sm)', color: 'var(--ink)',
                      fontWeight: h.id === actual.id ? 650 : 500,
                      overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap',
                    }}>
                      {h.plan.titulo}
                    </div>
                    <div style={{ fontSize: 'var(--fs-xs)', color: 'var(--faint)', marginTop: 1 }}>
                      {fechaCorta(h.at)}
                    </div>
                  </button>
                ))}
              </div>
            </Section>
          )}
        </div>
      )}
    </Pagina>
  );
}
