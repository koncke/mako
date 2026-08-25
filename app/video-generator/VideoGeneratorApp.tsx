'use client';

// =============================================================================
// VideoGeneratorApp — MaKo planifica el anuncio en video
// =============================================================================
// Izquierda: el pedido. Arriba de todo el CATÁLOGO DE PUESTAS EN ESCENA como
// tarjetas — es el «a la carta»: el cliente elige cómo quiere que se vea su
// anuncio antes de escribir una palabra. Después el tema, la duración y el
// historial.
//
// Derecha: el plan LISTO PARA PRODUCIR — un bloque por clip con lo que dice,
// qué se ve, la cámara y el prompt para pegar en el generador de video.
//
// Por qué el plan y no el video: iterar el texto es gratis y re-animar cuesta
// créditos. La tab entrega el plan aprobado ANTES de tocar un solo crédito.

import { useCallback, useMemo, useState, type CSSProperties } from 'react';
import Link from '@/app/_ui/Link';
import {
  Pagina, PageHeader, Section, Eyebrow, Button, Field, Textarea,
  Select, Alert, EmptyState, Tag, Status, MONO,
} from '@/app/_ui';
import { Icon } from '../_components/icons';
import type { PlanGuardado, EstadoContextoVideo } from './video-datos';
import {
  ACENTOS, CATALOGO_PUESTAS, DURACIONES_VIDEO, acentoEsVoseante, duracionReal,
  planATexto, puestaPorId, segundosDe,
} from './video-pedido';
import { generarPlanAction } from './actions';

const card: CSSProperties = {
  background: 'var(--surface)', border: '1px solid var(--border)',
  borderRadius: 'var(--r-lg)', padding: 'var(--card-pad)',
};

function fechaCorta(iso: string): string {
  try { return new Date(iso).toLocaleDateString('es-MX', { day: 'numeric', month: 'short' }); }
  catch { return ''; }
}

const OPCIONES_DURACION = DURACIONES_VIDEO.map((d) => ({
  value: d.value, label: d.label, sub: d.hint,
}));

const OPCIONES_ACENTO = ACENTOS.map((a) => ({ value: a.value, label: a.label }));

// ── El catálogo de puestas: las tarjetas que se eligen ───────────────────────

function TarjetaPuesta({
  id, nombre, descripcion, cuando, clips, habla, imagenesPrevias, confianza,
  elegida, onElegir,
}: {
  id: string; nombre: string; descripcion: string; cuando: string;
  clips: [number, number]; habla: 'siempre' | 'nunca' | 'mixto';
  imagenesPrevias: boolean; confianza: 'medido' | 'curso';
  elegida: boolean; onElegir: (id: string) => void;
}) {
  return (
    <button
      type="button"
      onClick={() => onElegir(id)}
      aria-pressed={elegida}
      style={{
        display: 'block', width: '100%', textAlign: 'left', cursor: 'pointer',
        background: elegida ? 'var(--primary-bg)' : 'var(--surface)',
        border: `1px solid ${elegida ? 'var(--primary)' : 'var(--border)'}`,
        borderRadius: 'var(--r-md)', padding: 12,
      }}
    >
      <div style={{ display: 'flex', alignItems: 'center', gap: 8, marginBottom: 4 }}>
        <span style={{ fontSize: 'var(--fs-md)', fontWeight: 650, color: 'var(--ink)' }}>{nombre}</span>
        {confianza === 'medido' && <Status tono="good">Probado</Status>}
      </div>
      <div style={{ fontSize: 'var(--fs-sm)', color: 'var(--dim)', lineHeight: 1.5 }}>{descripcion}</div>
      <div style={{ fontSize: 'var(--fs-sm)', color: 'var(--faint)', lineHeight: 1.5, marginTop: 6 }}>{cuando}</div>
      <div style={{ display: 'flex', flexWrap: 'wrap', gap: 6, marginTop: 8 }}>
        <Tag>{clips[0] === clips[1] ? `${clips[0]} clips` : `${clips[0]}-${clips[1]} clips`}</Tag>
        <Tag>{habla === 'siempre' ? 'Habla a cámara' : habla === 'nunca' ? 'Voz en off' : 'Alterna habla y off'}</Tag>
        {imagenesPrevias && <Tag>Requiere imágenes</Tag>}
      </div>
    </button>
  );
}

// ── Un clip del plan ─────────────────────────────────────────────────────────

function ClipCard({
  n, segundos, habla, voz, queSeVe, camara, imagenAdjunta, prompt, palabras, tope, voseo,
}: {
  n: number; segundos: number; habla: boolean; voz: string;
  queSeVe: string; camara: string; imagenAdjunta?: string; prompt: string;
  palabras: number; tope: number; voseo: string[];
}) {
  const [copiado, setCopiado] = useState(false);
  const copiar = useCallback(() => {
    navigator.clipboard.writeText(prompt).then(
      () => { setCopiado(true); window.setTimeout(() => setCopiado(false), 1600); },
      () => { /* sin portapapeles: el prompt igual está en pantalla para seleccionarlo */ },
    );
  }, [prompt]);

  return (
    <div style={{ ...card, padding: 14 }}>
      <div style={{ display: 'flex', alignItems: 'center', gap: 8, marginBottom: 8 }}>
        <Eyebrow>Clip {n}</Eyebrow>
        <Status tono={habla ? 'info' : 'neutral'}>{habla ? 'Habla' : 'Voz en off'}</Status>
        <Tag>{segundos} s</Tag>
        {palabras > tope && (
          <Status tono="warn">{palabras} palabras, entran {tope}</Status>
        )}
        {voseo.length > 0 && <Status tono="warn">Voseo</Status>}
      </div>

      <div style={{ fontSize: 'var(--fs-md)', color: 'var(--ink)', lineHeight: 1.6 }}>{voz}</div>

      {palabras > tope && (
        <div style={{ fontSize: 'var(--fs-sm)', color: 'var(--warn)', lineHeight: 1.55, marginTop: 6 }}>
          Este texto no entra en {segundos} segundos: el modelo va a cortar la frase o
          acelerar. Pide rehacer el plan indicando que acorte este clip.
        </div>
      )}

      {voseo.length > 0 && (
        <div style={{ fontSize: 'var(--fs-sm)', color: 'var(--warn)', lineHeight: 1.55, marginTop: 6 }}>
          Este clip tiene voseo rioplatense ({voseo.join(', ')}) y el acento elegido no lo
          usa. Pide rehacer el plan: cambiarlo a mano rompe el ritmo de la frase.
        </div>
      )}

      <div style={{ fontSize: 'var(--fs-sm)', color: 'var(--dim)', lineHeight: 1.55, marginTop: 8 }}>
        <div><strong style={{ color: 'var(--faint)', fontWeight: 600 }}>Qué se ve:</strong> {queSeVe}</div>
        <div><strong style={{ color: 'var(--faint)', fontWeight: 600 }}>Cámara:</strong> {camara}</div>
        {imagenAdjunta && (
          <div><strong style={{ color: 'var(--faint)', fontWeight: 600 }}>Adjuntar:</strong> {imagenAdjunta}</div>
        )}
      </div>

      <div style={{ marginTop: 10, borderTop: '1px solid var(--border)', paddingTop: 10 }}>
        <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', gap: 8, marginBottom: 6 }}>
          <Eyebrow>Prompt</Eyebrow>
          <Button
            size="sm"
            variant="tertiary"
            onClick={copiar}
            icon={<Icon name={copiado ? 'check' : 'copy'} size={13} />}
          >
            {copiado ? 'Copiado' : 'Copiar'}
          </Button>
        </div>
        <div style={{
          fontFamily: MONO, fontSize: 'var(--fs-xs)', color: 'var(--dim)',
          background: 'var(--surface-2)', borderRadius: 'var(--r-sm)', padding: 10,
          whiteSpace: 'pre-wrap', lineHeight: 1.55,
        }}>{prompt}</div>
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
  const [historial, setHistorial] = useState<PlanGuardado[]>(historialInicial);
  const [actual, setActual] = useState<PlanGuardado | null>(historialInicial[0] ?? null);
  const [puestaId, setPuestaId] = useState<string>(CATALOGO_PUESTAS[0].id);
  const [tema, setTema] = useState('');
  const [duracion, setDuracion] = useState<string>(DURACIONES_VIDEO[1].value);
  const [acento, setAcento] = useState<string>(ACENTOS[0].value);
  const [feedback, setFeedback] = useState('');
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const puesta = useMemo(() => puestaPorId(puestaId), [puestaId]);
  // Lo que REALMENTE va a durar, que no siempre es lo que dice el selector: una
  // puesta con piso de 7 clips de 8 s no puede entregar un anuncio de 30 s.
  const real = useMemo(
    () => (puesta ? duracionReal(puesta, segundosDe(duracion)) : null),
    [puesta, duracion],
  );
  const desvia = real ? Math.abs(real.segundos - segundosDe(duracion)) > 5 : false;

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
    } finally {
      setBusy(false);
    }
  }, [puestaId, tema, duracion, acento, feedback, actual]);

  const copiarGuion = useCallback(() => {
    if (!actual || !puesta) return;
    navigator.clipboard.writeText(planATexto(actual.plan, puesta.nombre)).catch(() => {
      /* sin portapapeles: el guion igual está en pantalla */
    });
  }, [actual, puesta]);

  return (
    <Pagina>
      <PageHeader titulo="Video Generator" />

      {contexto && !contexto.tieneFotos && (
        <Alert tono="warn">
          Este cliente no tiene ninguna foto cargada, y sin eso cada clip genera una cara
          distinta. Sube al menos una foto real en{' '}
          <Link href="/onboarding">Onboarding → Persona</Link> antes de planificar.
        </Alert>
      )}

      {/* ── El menú «a la carta»: a todo el ancho, para verlo de un vistazo ──
          Apilado en una columna angosta son 1.500 px de alto y el botón de
          generar cae fuera de pantalla: elegir el formato es LA decisión de esta
          tab y no puede pedir ocho scrolls. */}
      <Section titulo="Cómo quieres que se vea">
        <div style={{
          display: 'grid',
          gridTemplateColumns: 'repeat(auto-fill, minmax(280px, 1fr))',
          gap: 10,
        }}>
          {CATALOGO_PUESTAS.map((p) => (
            <TarjetaPuesta
              key={p.id}
              id={p.id}
              nombre={p.nombre}
              descripcion={p.descripcion}
              cuando={p.cuando}
              clips={p.clips}
              habla={p.habla}
              imagenesPrevias={p.imagenesPrevias}
              confianza={p.confianza}
              elegida={p.id === puestaId}
              onElegir={setPuestaId}
            />
          ))}
        </div>
      </Section>

      <div style={{ display: 'grid', gridTemplateColumns: 'minmax(320px, 420px) 1fr', gap: 'var(--gap)', alignItems: 'start' }}>
        {/* ── El pedido ── */}
        <div style={{ display: 'grid', gap: 'var(--gap)' }}>
          <Section titulo="De qué habla">
            <Field label="Tema o historia">
              <Textarea
                rows={5}
                value={tema}
                onChange={(e) => setTema(e.target.value)}
                placeholder="La historia que quieres contar, o el guion que ya tienes."
              />
            </Field>

            <Select
              label="Duración"
              value={duracion}
              onChange={setDuracion}
              options={OPCIONES_DURACION}
            />

            {/* El acento es un CAMPO y no un default: no se puede adivinar, y
                equivocarlo no se nota al leer — se nota cuando alguien lo dice
                en voz alta. Ya costó seis versiones de guion. */}
            <Select
              label="Acento"
              value={acento}
              onChange={setAcento}
              options={OPCIONES_ACENTO}
            />

            {puesta && real && (
              <div style={{ fontSize: 'var(--fs-sm)', color: 'var(--faint)', marginTop: 8 }}>
                Salen {real.clips} clips de {real.segundos} segundos en total.
                {puesta.imagenesPrevias && ' Antes de animar hay que generar las imágenes.'}
              </div>
            )}

            {puesta && real && desvia && (
              <div style={{ marginTop: 8 }}>
                <Alert tono="warn">
                  {puesta.nombre} necesita entre {puesta.clips[0]} y {puesta.clips[1]} clips
                  de {puesta.segundosClip[0]} a {puesta.segundosClip[1]} segundos, así que el
                  anuncio va a durar {real.segundos} segundos y no {segundosDe(duracion)}.
                  Si necesitas esa duración exacta, elige otra puesta.
                </Alert>
              </div>
            )}

            <div style={{ marginTop: 12 }}>
              <Button
                variant="mako"
                onClick={() => generar(false)}
                loading={busy}
                disabled={!tema.trim()}
              >
                Armar el plan
              </Button>
            </div>
          </Section>

          {historial.length > 0 && (
            <Section titulo="Historial">
              <div style={{ display: 'grid', gap: 6 }}>
                {historial.map((h) => (
                  <button
                    key={h.id}
                    type="button"
                    onClick={() => setActual(h)}
                    style={{
                      display: 'block', width: '100%', textAlign: 'left', cursor: 'pointer',
                      background: h.id === actual?.id ? 'var(--surface-2)' : 'transparent',
                      border: '1px solid var(--border)', borderRadius: 'var(--r-sm)', padding: '8px 10px',
                    }}
                  >
                    <div style={{ fontSize: 'var(--fs-sm)', color: 'var(--ink)', fontWeight: 600 }}>{h.plan.titulo}</div>
                    <div style={{ fontSize: 'var(--fs-xs)', color: 'var(--faint)', marginTop: 2 }}>
                      {h.plan.clips.length} clips · {h.plan.duracionTotalSeg} s · {fechaCorta(h.at)}
                    </div>
                  </button>
                ))}
              </div>
            </Section>
          )}
        </div>

        {/* ── El plan ── */}
        <div style={{ display: 'grid', gap: 'var(--gap)' }}>
          {error && <Alert tono="bad">{error}</Alert>}

          {!actual && !error && (
            <EmptyState
              titulo="Cuenta de qué va el anuncio"
              detalle="MaKo arma el plan completo con las reglas de la puesta que elegiste: qué dice cada clip, qué se ve, cómo se mueve la cámara y el prompt listo para pegar."
            />
          )}

          {actual && puesta && (
            <>
              <Section
                titulo={actual.plan.titulo}
                accion={
                  <Button
                    size="sm"
                    variant="tertiary"
                    onClick={copiarGuion}
                    icon={<Icon name="copy" size={13} />}
                  >
                    Copiar el guion
                  </Button>
                }
              >
                <div style={{ display: 'flex', flexWrap: 'wrap', gap: 6, marginBottom: 10 }}>
                  <Tag>{puesta.nombre}</Tag>
                  <Tag>{actual.plan.clips.length} clips</Tag>
                  <Tag>{actual.plan.duracionTotalSeg} s</Tag>
                  <Tag>Ritmo {actual.plan.ritmo}</Tag>
                </div>

                {actual.plan.imagenesNecesarias.length > 0 && (
                  <Alert tono="info">
                    <strong>Genera estas imágenes antes de animar:</strong>
                    <ol style={{ margin: '6px 0 0', paddingLeft: 18, lineHeight: 1.6 }}>
                      {actual.plan.imagenesNecesarias.map((img, i) => <li key={i}>{img}</li>)}
                    </ol>
                  </Alert>
                )}

                <div style={{ fontSize: 'var(--fs-sm)', color: 'var(--dim)', lineHeight: 1.7, marginTop: 10 }}>
                  {actual.plan.deCorrido}
                </div>
              </Section>

              <div style={{ display: 'grid', gap: 10 }}>
                {actual.plan.clips.map((c) => (
                  <ClipCard
                    key={c.n}
                    n={c.n}
                    segundos={c.segundos}
                    habla={c.habla}
                    voz={c.voz}
                    queSeVe={c.queSeVe}
                    camara={c.camara}
                    imagenAdjunta={c.imagenAdjunta}
                    prompt={c.prompt}
                    // Un plan guardado ANTES de que existieran estos campos no
                    // los trae: el historial vive en app_settings y no migra.
                    // Sin los `??` la pantalla explota al abrir uno viejo.
                    palabras={c.palabras ?? 0}
                    tope={c.tope ?? 0}
                    voseo={acentoEsVoseante(acento) ? [] : (c.voseo ?? [])}
                  />
                ))}
              </div>

              <Section titulo="Ajustar">
                <Field label="Qué cambiar">
                  <Textarea
                    rows={3}
                    value={feedback}
                    onChange={(e) => setFeedback(e.target.value)}
                    placeholder="El cierre no convence, el clip 3 dice lo mismo que el 2..."
                  />
                </Field>
                <Button
                  variant="mako"
                  onClick={() => generar(true)}
                  loading={busy}
                  disabled={!feedback.trim()}
                >
                  Rehacer el plan
                </Button>
              </Section>
            </>
          )}
        </div>
      </div>
    </Pagina>
  );
}
