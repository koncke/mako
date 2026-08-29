'use client';

// =============================================================================
// StoriesApp — MaKo escribe el día de stories
// =============================================================================
// Izquierda: el pedido (objetivo del día + la idea) y el historial de la sesión.
// Derecha: la secuencia como storyboard vertical y el botón que la manda a
// contenido_posts como borradores (uno por frame), a completar en /instagram.
//
// El historial NO persiste: el patrón writer del repo no tiene tabla genérica de
// historial (landing_drafts es propia del Landing Generator) y una migración
// nueva colisiona con la numeración de otras corridas — así que vive en memoria
// de la sesión de página, dicho honesto en la UI (anotado en pendientes).

import { useCallback, useState, type CSSProperties } from 'react';
import Link from '@/app/_ui/Link';
import { Pagina, PageHeader, Banner, Alert, Button } from '@/app/_ui';
import { MakoLogo } from '../_components/MakoBrand';
import { Dropdown } from '../components/Dropdown';
import { Storyboard } from './Storyboard';
import { OBJETIVOS_STORIES, empujaADm, type ObjetivoStories } from './objetivos';
import { generarSecuenciaAction, enviarSecuenciaAction } from './actions';
import type { PiezaStory } from '@/lib/ig-writer';

const MONO = "'Geist Mono', monospace";
const SANS = "'Geist', sans-serif";

const card: CSSProperties = { background: 'var(--surface)', border: '1px solid var(--border)', borderRadius: 14, padding: 20 };
const eyebrow: CSSProperties = { fontFamily: MONO, fontSize: 10.5, letterSpacing: '.14em', textTransform: 'uppercase', color: 'var(--faint)' };
const areaTexto: CSSProperties = { width: '100%', minHeight: 110, padding: '12px 14px', fontSize: 14, fontFamily: SANS, lineHeight: 1.55, border: '1px solid var(--border-strong)', borderRadius: 10, background: 'var(--surface)', color: 'var(--ink)', resize: 'vertical' };

type ItemHistorial = { pieza: PiezaStory; objetivo: ObjetivoStories; at: string };

export function StoriesApp({ igConectada, piezaInicial = null }: { igConectada: boolean; piezaInicial?: PiezaStory | null }) {
  const [objetivo, setObjetivo] = useState<ObjetivoStories>('conexion');
  const [pedido, setPedido] = useState('');
  const [pieza, setPieza] = useState<PiezaStory | null>(piezaInicial);
  const [historial, setHistorial] = useState<ItemHistorial[]>([]);
  const [estado, setEstado] = useState<'listo' | 'generando' | 'enviando'>('listo');
  const [aviso, setAviso] = useState<{ tono: 'bad' | 'good'; texto: string; href?: string } | null>(null);

  const ocupado = estado !== 'listo';

  const generar = useCallback(async () => {
    if (!pedido.trim() || ocupado) return;
    setEstado('generando');
    setAviso(null);
    const r = await generarSecuenciaAction(objetivo, pedido);
    setEstado('listo');
    if (!r.ok) { setAviso({ tono: 'bad', texto: r.error }); return; }
    setPieza(r.pieza);
    setHistorial((h) => [{ pieza: r.pieza, objetivo, at: new Date().toISOString() }, ...h]);
  }, [pedido, objetivo, ocupado]);

  const enviar = useCallback(async () => {
    if (!pieza || ocupado) return;
    setEstado('enviando');
    setAviso(null);
    const r = await enviarSecuenciaAction(pieza);
    setEstado('listo');
    if (!r.ok) { setAviso({ tono: 'bad', texto: r.error }); return; }
    setAviso({
      tono: 'good',
      texto: r.aviso ?? `${r.creados} ${r.creados === 1 ? 'borrador creado' : 'borradores creados'} en la tab Instagram.`,
      href: r.href,
    });
  }, [pieza, ocupado]);

  const interactivos = pieza ? pieza.frames.filter((f) => f.interactivoManual).length : 0;

  return (
    <Pagina>
      <PageHeader
        titulo="Stories"
        proposito="Secuencias de stories listas para grabar: una idea por día, frame por frame."
      />

      {!igConectada && (
        <Banner tono="warn" accion={{ label: 'Conectar en Instagram', href: '/instagram' }}>
          No hay una cuenta de Instagram conectada. Puedes escribir las secuencias igual;
          para publicarlas, conecta la cuenta en la tab Instagram.
        </Banner>
      )}

      <div style={{ display: 'flex', gap: 22, alignItems: 'flex-start', flexWrap: 'wrap', marginTop: 18 }}>
        {/* ── El pedido ── */}
        <aside style={{ width: 340, flex: '0 0 auto', display: 'grid', gap: 16 }}>
          <div style={card}>
            <div style={{ ...eyebrow, marginBottom: 8 }}>Qué quieres lograr hoy</div>
            <Dropdown
              value={objetivo}
              onChange={(v) => setObjetivo(v as ObjetivoStories)}
              options={OBJETIVOS_STORIES.map((o) => ({ value: o.value, label: o.label, sub: o.hint }))}
              width="100%"
              ariaLabel="Objetivo del día de stories"
              disabled={ocupado}
            />
            {empujaADm(objetivo) && (
              <div style={{ marginTop: 9, fontSize: 12.5, color: 'var(--dim)', lineHeight: 1.5 }}>
                El último frame va a pedir responder la story con una palabra clave: esas
                respuestas llegan al inbox de la tab Instagram.
              </div>
            )}

            <div style={{ ...eyebrow, margin: '18px 0 8px' }}>La idea del día</div>
            <textarea
              style={areaTexto}
              value={pedido}
              onChange={(e) => setPedido(e.target.value)}
              disabled={ocupado}
              placeholder="Ej: hoy cerré la tercera venta del mes con el mismo mensaje de apertura. Quiero contar qué cambié en el mensaje, sin revelarlo hasta el final."
              aria-label="La idea del día"
            />

            <Button
              variant="primary"
              full
              onClick={() => void generar()}
              loading={estado === 'generando'}
              disabled={ocupado || !pedido.trim()}
              style={{ marginTop: 16 }}
            >
              {estado === 'generando' ? 'MaKo está escribiendo…' : pieza ? 'Generar otra secuencia' : 'Generar secuencia'}
            </Button>
          </div>

          {historial.length > 0 && (
            <div style={card}>
              <div style={{ ...eyebrow, marginBottom: 10 }}>Secuencias de esta sesión</div>
              <div style={{ display: 'grid', gap: 8 }}>
                {historial.map((h, i) => (
                  <button
                    key={`${h.at}-${i}`}
                    type="button"
                    onClick={() => setPieza(h.pieza)}
                    style={{ textAlign: 'left', padding: '10px 12px', borderRadius: 10, border: '1px solid var(--border)', background: h.pieza === pieza ? 'var(--surface-2)' : 'var(--surface)', cursor: 'pointer', fontFamily: SANS }}
                  >
                    <div style={{ fontSize: 13.5, fontWeight: 600, lineHeight: 1.4 }}>{h.pieza.idea}</div>
                    <div style={{ fontFamily: MONO, fontSize: 11, color: 'var(--faint)', marginTop: 3 }}>
                      {OBJETIVOS_STORIES.find((o) => o.value === h.objetivo)?.label ?? h.objetivo}
                      {' · '}{h.pieza.frames.length} frames
                      {' · '}{new Date(h.at).toLocaleTimeString('es-MX', { hour: '2-digit', minute: '2-digit' })}
                    </div>
                  </button>
                ))}
              </div>
              <div style={{ marginTop: 10, fontSize: 12, color: 'var(--faint)', lineHeight: 1.5 }}>
                Este historial vive solo en esta sesión: lo que quieras conservar,
                envíalo a publicación.
              </div>
            </div>
          )}
        </aside>

        {/* ── La secuencia ── */}
        <section style={{ flex: 1, minWidth: 340, display: 'grid', gap: 14 }}>
          {aviso && (
            <Alert tono={aviso.tono} accion={aviso.href ? { label: 'Completar media en Instagram', href: aviso.href } : undefined}>
              {aviso.texto}
            </Alert>
          )}

          {!pieza ? (
            <div style={{ ...card, padding: 40, textAlign: 'center' }}>
              {/* Se centra con FLEX, no con el `textAlign: 'center'` del padre: el preflight
                  de Tailwind pone `svg { display: block }` y a un bloque el text-align no lo
                  mueve — el icono quedaba pegado a la izquierda. */}
              <div style={{ display: 'flex', justifyContent: 'center' }}><MakoLogo size={54} /></div>
              <h2 style={{ fontSize: 20, fontWeight: 650, margin: '16px 0 8px', letterSpacing: '-0.02em' }}>
                Cuéntale a MaKo la idea del día
              </h2>
              <p style={{ fontSize: 14, color: 'var(--dim)', lineHeight: 1.6, margin: '0 auto', maxWidth: 420 }}>
                Los reels atraen; las stories calientan y venden. MaKo arma el día completo
                —gancho, contexto, moraleja y cierre— con el formato de cada frame y su
                indicación de producción, usando tu perfil de negocio y tu funnel.
              </p>
            </div>
          ) : (
            <>
              <Storyboard pieza={pieza} />

              {interactivos > 0 && (
                <Alert tono="info">
                  {interactivos === 1 ? 'Un frame usa un elemento interactivo' : `${interactivos} frames usan elementos interactivos`}
                  {' '}(encuesta, pregunta o slider). La API de Meta no los publica: se agregan
                  a mano en la app de Instagram después de publicar cada story.
                </Alert>
              )}

              <div style={{ ...card, display: 'grid', gap: 10 }}>
                {/* La consecuencia, pegada al botón y antes del click. */}
                <div style={{ fontSize: 13.5, lineHeight: 1.55, color: 'var(--ink)' }}>
                  Crea {pieza.frames.length} {pieza.frames.length === 1 ? 'borrador' : 'borradores'} de story en la tab
                  Instagram — uno por frame. Ahí subes la media de cada uno y lo programas o publicas.
                </div>
                <Button
                  variant="secondary"
                  onClick={() => void enviar()}
                  loading={estado === 'enviando'}
                  disabled={ocupado}
                  style={{ justifySelf: 'start' }}
                >
                  Enviar {pieza.frames.length} {pieza.frames.length === 1 ? 'frame' : 'frames'} a publicación
                </Button>
                {!igConectada && (
                  <div style={{ fontSize: 12.5, color: 'var(--dim)', lineHeight: 1.5 }}>
                    Los borradores se crean igual sin cuenta conectada; para publicarlos,{' '}
                    <Link href="/instagram" style={{ color: 'var(--primary)', fontWeight: 600 }}>conecta Instagram</Link>.
                  </div>
                )}
              </div>
            </>
          )}
        </section>
      </div>
    </Pagina>
  );
}
