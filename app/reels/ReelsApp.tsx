'use client';

// =============================================================================
// ReelsApp — MaKo escribe el guion del reel
// =============================================================================
// Izquierda: el pedido (tema + objetivo + duración) y el historial. Derecha: el
// guion LEGIBLE PARA GRABAR — gancho, escenas numeradas con locución y cámara,
// moraleja, CTA, caption con el corte de los 125 caracteres marcado — con
// «Copiar el guion» y el ajuste con feedback.
//
// ⚠️ Hasta el 06/10/2026 había además «Enviar a publicación» (un borrador en el
// programador de /instagram) y un paso «Tu cuenta de Instagram». Salieron con la
// tab Instagram (decisión de Martín): el guion se copia y se publica a mano.
//
// El onboarding de la tab es un checklist adentro de la app, no un wizard que
// la tapa: nada de esta tab bloquea y el ensayo ES generar el primer guion.

import { useCallback, useState, type CSSProperties, type ReactNode } from 'react';
import Link from '@/app/_ui/Link';
import {
  Pagina, PageHeader, Section, Eyebrow, Button, Field, Textarea,
  Select, Alert, EmptyState, Tag, Mako, MONO,
} from '@/app/_ui';
import { Icon } from '../_components/icons';
import { CAPTION_VISIBLE, LIMITES_REEL } from '@/lib/ig-formatos';
// El perfil del negocio se completa donde viva hoy la sección (lib/secciones-negocio.ts): desde el 15/10/2026,
// Second Brain. Nunca `/onboarding`, que es sólo el wizard del primer ingreso.
import { rutaSeccion, lugarSeccion } from '@/lib/secciones-negocio';
import type { PiezaGuardada, EstadoContextoReels } from './reels-datos';
import { OBJETIVOS_REEL, DURACIONES_REEL, guionATexto } from './reel-pedido';
import { generarReelAction } from './actions';

export type OnboardingReels = {
  pendiente: boolean;
  contexto: EstadoContextoReels;
  ensayoHecho: boolean;
} | null;

const card: CSSProperties = {
  background: 'var(--surface)', border: '1px solid var(--border)',
  borderRadius: 'var(--r-lg)', padding: 'var(--card-pad)',
};

function fechaCorta(iso: string): string {
  try { return new Date(iso).toLocaleDateString('es-MX', { day: 'numeric', month: 'short' }); }
  catch { return ''; }
}

// ── El checklist del onboarding (tres etapas, ninguna tapa la tab) ───────────

function PasoRow({ done, titulo, children }: { done: boolean; titulo: string; children?: ReactNode }) {
  return (
    <div style={{ display: 'flex', gap: 10, alignItems: 'flex-start', padding: '10px 0', borderTop: '1px solid var(--border)' }}>
      <span aria-hidden style={{
        flex: 'none', width: 22, height: 22, borderRadius: 999, display: 'grid', placeItems: 'center',
        background: done ? 'var(--good-bg)' : 'var(--surface-2)',
        color: done ? 'var(--good)' : 'var(--faint)',
        border: done ? 'none' : '1px solid var(--border-strong)',
      }}>
        {done ? <Icon name="check" size={13} /> : <Icon name="dot" size={13} />}
      </span>
      <div style={{ minWidth: 0, flex: 1 }}>
        <div style={{ fontSize: 'var(--fs-md)', fontWeight: 600, color: 'var(--ink)' }}>{titulo}</div>
        {children && <div style={{ fontSize: 'var(--fs-sm)', color: 'var(--dim)', lineHeight: 1.55, marginTop: 3 }}>{children}</div>}
      </div>
    </div>
  );
}

function ChecklistOnboarding({ ob }: { ob: NonNullable<OnboardingReels> }) {
  return (
    <Section card>
      <div style={{ marginBottom: 4 }}>
        <Eyebrow>Para dejar la tab lista</Eyebrow>
      </div>
      <PasoRow done={ob.contexto.listo} titulo="Contexto del negocio">
        {ob.contexto.listo ? (
          ob.contexto.faltan.length
            ? <>MaKo ya conoce tu negocio. Aún sin datos de: {ob.contexto.faltan.join(', ')} — se completan en <Link href={rutaSeccion('archivero')} style={{ color: 'var(--primary)', fontWeight: 600 }}>{lugarSeccion('archivero')}</Link>.</>
            : 'MaKo ya conoce tu negocio: los guiones salen con tu oferta y tu avatar reales.'
        ) : (
          <>MaKo todavía no tiene el perfil de tu negocio (marca, oferta, avatar): los guiones saldrían genéricos. Complétalo en <Link href={rutaSeccion('archivero')} style={{ color: 'var(--primary)', fontWeight: 600 }}>{lugarSeccion('archivero')}</Link>.</>
        )}
      </PasoRow>
      <PasoRow done={ob.ensayoHecho} titulo="Tu primer guion">
        {ob.ensayoHecho
          ? 'Generado. La tab quedó probada con tus datos.'
          : 'Pide el primero aquí abajo: es la prueba de que la tab funciona con tu negocio.'}
      </PasoRow>
    </Section>
  );
}

// ── El guion, legible para grabar ────────────────────────────────────────────

function BloqueGuion({ rotulo, children }: { rotulo: string; children: ReactNode }) {
  return (
    <div style={{ paddingTop: 14, marginTop: 14, borderTop: '1px solid var(--border)' }}>
      <Eyebrow>{rotulo}</Eyebrow>
      <div style={{ marginTop: 8 }}>{children}</div>
    </div>
  );
}

function VistaGuion({ item }: { item: PiezaGuardada }) {
  const p = item.pieza;
  const [copiado, setCopiado] = useState(false);
  const copiar = useCallback(async () => {
    try {
      await navigator.clipboard.writeText(guionATexto(p));
      setCopiado(true);
      setTimeout(() => setCopiado(false), 2200);
    } catch { /* el navegador no permitió copiar; el texto queda a la vista */ }
  }, [p]);

  const captionVisible = p.caption.slice(0, CAPTION_VISIBLE);
  const captionResto = p.caption.slice(CAPTION_VISIBLE);

  return (
    <div style={card}>
      {/* Cabecera: objetivo + duración + acciones */}
      <div style={{ display: 'flex', gap: 12, alignItems: 'flex-start', flexWrap: 'wrap' }}>
        <div style={{ flex: 1, minWidth: 220 }}>
          <Eyebrow>Guion del reel</Eyebrow>
          <div style={{ display: 'flex', gap: 8, alignItems: 'center', flexWrap: 'wrap', marginTop: 7 }}>
            {p.objetivo && <span style={{ fontSize: 'var(--fs-sm)', color: 'var(--dim)' }}>{p.objetivo}</span>}
            <Tag>{p.duracionEstimadaSeg} s · máx {LIMITES_REEL.maxSeg} s</Tag>
          </div>
        </div>
        <div className="mk-row" style={{ flex: 'none' }}>
          <Button variant="secondary" icon={<Icon name="copy" size={14} />} onClick={copiar}>
            {copiado ? 'Copiado ✓' : 'Copiar el guion'}
          </Button>
        </div>
      </div>

      {/* GANCHO — el 80% del esfuerzo del video */}
      <BloqueGuion rotulo="Gancho · primeros 3 segundos">
        <p style={{ margin: 0, fontSize: 'var(--fs-card)', fontWeight: 650, letterSpacing: '-0.015em', lineHeight: 1.35, color: 'var(--ink)' }}>
          «{p.hook.frase}»
        </p>
        <dl style={{ margin: '10px 0 0', display: 'grid', gap: 6 }}>
          {p.hook.tituloEnPantalla && (
            <div style={{ display: 'flex', gap: 8, fontSize: 'var(--fs-sm)', lineHeight: 1.5 }}>
              <dt style={{ flex: 'none', color: 'var(--faint)', fontFamily: MONO, fontSize: 11, paddingTop: 2 }}>TÍTULO EN PANTALLA</dt>
              <dd style={{ margin: 0, color: 'var(--ink)' }}>«{p.hook.tituloEnPantalla}»</dd>
            </div>
          )}
          {p.hook.visual && (
            <div style={{ display: 'flex', gap: 8, fontSize: 'var(--fs-sm)', lineHeight: 1.5 }}>
              <dt style={{ flex: 'none', color: 'var(--faint)', fontFamily: MONO, fontSize: 11, paddingTop: 2 }}>VISUAL</dt>
              <dd style={{ margin: 0, color: 'var(--dim)' }}>{p.hook.visual}</dd>
            </div>
          )}
        </dl>
      </BloqueGuion>

      {/* ESCENAS */}
      <BloqueGuion rotulo={`Escenas (${p.escenas.length})`}>
        <ol style={{ margin: 0, padding: 0, listStyle: 'none', display: 'grid', gap: 0 }}>
          {p.escenas.map((e, i) => (
            <li key={i} style={{ display: 'flex', gap: 12, padding: '10px 0', borderTop: i ? '1px solid var(--border)' : 'none' }}>
              <span aria-hidden style={{ flex: 'none', fontFamily: MONO, fontSize: 11, color: 'var(--faint)', paddingTop: 3 }}>
                {String(i + 1).padStart(2, '0')}
              </span>
              <div style={{ minWidth: 0 }}>
                <p style={{ margin: 0, fontSize: 'var(--fs-md)', lineHeight: 1.6, color: 'var(--ink)', whiteSpace: 'pre-wrap' }}>{e.texto}</p>
                {e.indicacionVisual && (
                  <p style={{ margin: '4px 0 0', fontSize: 'var(--fs-sm)', color: 'var(--dim)', lineHeight: 1.5 }}>
                    <Icon name="video" size={13} /> {e.indicacionVisual}
                  </p>
                )}
              </div>
            </li>
          ))}
        </ol>
      </BloqueGuion>

      {/* MORALEJA */}
      {p.moraleja && (
        <BloqueGuion rotulo="Moraleja · 10-15 segundos">
          <p style={{ margin: 0, fontSize: 'var(--fs-md)', lineHeight: 1.6 }}>{p.moraleja}</p>
        </BloqueGuion>
      )}

      {/* CTA */}
      <BloqueGuion rotulo="CTA · 5-7 segundos">
        {p.cta ? (
          <>
            <p style={{ margin: 0, fontSize: 'var(--fs-md)', fontWeight: 600, lineHeight: 1.55 }}>{p.cta}</p>
            {p.palabraClave && (
              <p style={{ margin: '8px 0 0', fontSize: 'var(--fs-sm)', color: 'var(--dim)', lineHeight: 1.55 }}>
                Palabra clave: <strong style={{ color: 'var(--ink)' }}>{p.palabraClave}</strong>.
              </p>
            )}
          </>
        ) : (
          <p style={{ margin: 0, fontSize: 'var(--fs-sm)', color: 'var(--dim)', lineHeight: 1.55 }}>
            Sin CTA a propósito: este reel es solo de alcance (la metodología lo permite).
          </p>
        )}
      </BloqueGuion>

      {/* CAPTION */}
      {p.caption && (
        <BloqueGuion rotulo="Caption">
          <p style={{ margin: 0, fontSize: 'var(--fs-md)', lineHeight: 1.6, whiteSpace: 'pre-wrap' }}>
            <span>{captionVisible}</span>
            {captionResto && <span style={{ color: 'var(--faint)' }}>{captionResto}</span>}
          </p>
          <p style={{ margin: '8px 0 0', fontSize: 'var(--fs-meta)', color: 'var(--faint)', lineHeight: 1.5 }}>
            Lo marcado en tinta es lo visible antes del «… más» ({CAPTION_VISIBLE} caracteres).
            {' '}Hashtags: los cursos los descartan como palanca — la palanca es el gancho; si agregas, pocos y descriptivos.
          </p>
        </BloqueGuion>
      )}
    </div>
  );
}

// ── La app ───────────────────────────────────────────────────────────────────

export function ReelsApp({ historialInicial, onboarding }: {
  historialInicial: PiezaGuardada[];
  /** null = agencia sin impersonar (sin workspace del que leer). */
  onboarding: OnboardingReels;
}) {
  const [historial, setHistorial] = useState<PiezaGuardada[]>(historialInicial);
  const [actual, setActual] = useState<PiezaGuardada | null>(historialInicial[0] ?? null);
  const [ob, setOb] = useState<OnboardingReels>(onboarding);

  const [tema, setTema] = useState('');
  const [objetivo, setObjetivo] = useState<string>(OBJETIVOS_REEL[0].value);
  const [duracion, setDuracion] = useState<string>(DURACIONES_REEL[0].value);
  const [feedback, setFeedback] = useState('');

  // busy POR ACCIÓN: un solo flag compartido pone «Enviando…» en el botón
  // equivocado (regla de la skill de onboarding, vale para toda la tab).
  const [busyGenerar, setBusyGenerar] = useState(false);
  const [busyAjustar, setBusyAjustar] = useState(false);
  const [aviso, setAviso] = useState<{ tono: 'bad' | 'good'; texto: ReactNode } | null>(null);

  const generando = busyGenerar || busyAjustar;

  const aplicarResultado = useCallback((item: PiezaGuardada, hist: PiezaGuardada[]) => {
    setActual(item);
    setHistorial(hist);
    setFeedback('');
    // El primer guion cierra el ensayo (lo marcó el server); el checklist local
    // se actualiza sin re-pedir la página.
    setOb((o) => (o ? { ...o, ensayoHecho: true, pendiente: !o.contexto.listo } : o));
  }, []);

  const generar = useCallback(async () => {
    if (!tema.trim() || busyGenerar) return;
    setBusyGenerar(true); setAviso(null);
    try {
      const r = await generarReelAction({ tema, objetivo, duracion });
      if (!r.ok) { setAviso({ tono: 'bad', texto: r.error }); return; }
      aplicarResultado(r.item, r.historial);
    } catch (e) {
      setAviso({ tono: 'bad', texto: e instanceof Error ? e.message : String(e) });
    } finally { setBusyGenerar(false); }
  }, [tema, objetivo, duracion, busyGenerar, aplicarResultado]);

  const reescribir = useCallback(async () => {
    if (!actual || !feedback.trim() || busyAjustar) return;
    setBusyAjustar(true); setAviso(null);
    try {
      const r = await generarReelAction({
        tema: actual.pedido || tema, objetivo, duracion, feedback, anteriorId: actual.id,
      });
      if (!r.ok) { setAviso({ tono: 'bad', texto: r.error }); return; }
      aplicarResultado(r.item, r.historial);
    } catch (e) {
      setAviso({ tono: 'bad', texto: e instanceof Error ? e.message : String(e) });
    } finally { setBusyAjustar(false); }
  }, [actual, feedback, tema, objetivo, duracion, busyAjustar, aplicarResultado]);

  return (
    <Pagina>
      <PageHeader
        titulo="Reels"
        proposito="Guiones listos para grabar — gancho, escenas, moraleja y CTA — escritos con los datos reales de tu negocio y la metodología de los cursos."
      />

      {ob && ob.pendiente && <ChecklistOnboarding ob={ob} />}

      {onboarding == null && (
        <Alert tono="warn">
          Sin workspace activo: entra al workspace de un cliente para escribir sus guiones.
        </Alert>
      )}

      <div style={{ display: 'flex', gap: 20, alignItems: 'flex-start', flexWrap: 'wrap' }}>
        {/* PEDIDO + HISTORIAL */}
        <aside style={{ width: 340, flex: '1 1 300px', maxWidth: 420, display: 'grid', gap: 16 }}>
          <div style={card}>
            <Field label="Tema o idea del reel" htmlFor="reel-tema">
              <Textarea
                id="reel-tema"
                value={tema}
                onChange={(e) => setTema(e.target.value)}
                disabled={generando}
                rows={4}
                placeholder="Ej: el error que comete todo dueño de negocio al responder leads tarde, y qué hacemos nosotros distinto."
              />
            </Field>
            <div style={{ display: 'grid', gap: 12, marginTop: 12 }}>
              <Select
                label="Qué tiene que lograr"
                value={objetivo}
                onChange={setObjetivo}
                disabled={generando}
                options={OBJETIVOS_REEL.map((o) => ({ value: o.value, label: o.label, sub: o.hint }))}
              />
              <Select
                label="Duración"
                value={duracion}
                onChange={setDuracion}
                disabled={generando}
                options={DURACIONES_REEL.map((d) => ({ value: d.value, label: d.label, sub: d.hint }))}
              />
            </div>
            <Button
              variant="primary"
              full
              style={{ marginTop: 16 }}
              onClick={generar}
              loading={busyGenerar}
              disabled={generando || !tema.trim()}
            >
              {actual ? 'Escribir otro guion' : 'Escribir el guion'}
            </Button>
          </div>

          {historial.length > 0 && (
            <div style={card}>
              <div style={{ marginBottom: 10 }}><Eyebrow>Tus guiones</Eyebrow></div>
              <div style={{ display: 'grid', gap: 8 }}>
                {historial.map((h) => (
                  <button
                    key={h.id}
                    type="button"
                    onClick={() => { setActual(h); setAviso(null); }}
                    aria-current={actual?.id === h.id || undefined}
                    style={{
                      textAlign: 'left', padding: '10px 12px', borderRadius: 'var(--r-md)', cursor: 'pointer',
                      border: `1px solid ${actual?.id === h.id ? 'var(--border-strong)' : 'var(--border)'}`,
                      background: actual?.id === h.id ? 'var(--surface-2)' : 'var(--surface)',
                    }}
                  >
                    <div style={{ fontSize: 'var(--fs-sm)', fontWeight: 600, color: 'var(--ink)', overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>
                      «{h.pieza.hook.frase}»
                    </div>
                    <div style={{ display: 'flex', gap: 8, alignItems: 'center', marginTop: 3 }}>
                      <span style={{ fontFamily: MONO, fontSize: 11, color: 'var(--faint)' }}>{fechaCorta(h.at)}</span>
                    </div>
                  </button>
                ))}
              </div>
              <p style={{ margin: '10px 0 0', fontSize: 'var(--fs-meta)', color: 'var(--faint)', lineHeight: 1.5 }}>
                Se guardan los últimos 10 guiones de este workspace.
              </p>
            </div>
          )}
        </aside>

        {/* GUION */}
        <section style={{ flex: '10 1 420px', minWidth: 0, display: 'grid', gap: 16, alignContent: 'start' }}>
          {aviso && <Alert tono={aviso.tono}>{aviso.texto}</Alert>}

          {generando ? (
            <div style={card}>
              <Mako
                estado="analizando"
                titulo={busyAjustar ? 'Reescribiendo el guion con tu cambio' : 'Escribiendo el guion'}
                fuente="tu funnel, el perfil del negocio y la metodología de los cursos"
                datos={[{ k: 'Tarda', v: 'menos de un minuto' }]}
              />
            </div>
          ) : !actual ? (
            <EmptyState
              titulo="Pídele el primer guion a MaKo"
              detalle="Escribe el tema, elige el objetivo y la duración. El guion sale con gancho, escenas para grabar, moraleja, CTA y caption — aterrizado en tu oferta y tu avatar."
              ico={<Icon name="videogen" size={26} />}
            />
          ) : (
            <>
              <VistaGuion item={actual} />

              {/* Ajuste con feedback */}
              <div style={{ ...card, background: 'var(--surface-2)' }}>
                <div style={{ marginBottom: 10 }}><Eyebrow>Pídele un cambio</Eyebrow></div>
                <div style={{ display: 'flex', gap: 10, flexWrap: 'wrap' }}>
                  <Textarea
                    value={feedback}
                    onChange={(e) => setFeedback(e.target.value)}
                    disabled={generando}
                    rows={2}
                    style={{ flex: 1, minWidth: 240 }}
                    placeholder="Ej: el gancho suena a anuncio; prueba uno de curiosidad. Y la escena 3 sobra."
                    aria-label="Qué cambiar del guion"
                  />
                  <Button
                    variant="secondary"
                    onClick={reescribir}
                    loading={busyAjustar}
                    disabled={generando || !feedback.trim()}
                    style={{ alignSelf: 'flex-start' }}
                  >
                    Reescribir el guion
                  </Button>
                </div>
                <p style={{ display: 'flex', gap: 7, alignItems: 'center', margin: '10px 0 0', fontSize: 'var(--fs-meta)', color: 'var(--dim)' }}>
                  <Icon name="pen" size={13} /> Sale una versión nueva aplicando tu feedback; la anterior queda en el historial.
                </p>
              </div>
            </>
          )}
        </section>
      </div>
    </Pagina>
  );
}
