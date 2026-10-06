'use client';

// =============================================================================
// StoriesApp — MaKo escribe el día de stories
// =============================================================================
// Izquierda: el pedido (objetivo del día + la idea) y el historial de la sesión.
// Derecha: la secuencia como storyboard vertical y «Copiar la secuencia».
//
// ⚠️ Hasta el 06/10/2026 el botón la mandaba como borradores (uno por frame) al
// programador de /instagram, con un aviso para conectar la cuenta. Salieron con la
// tab Instagram (decisión de Martín): la secuencia se copia y se publica a mano.
//
// El historial NO persiste: el patrón writer del repo no tiene tabla genérica de
// historial (landing_drafts es propia del Landing Generator) y una migración
// nueva colisiona con la numeración de otras corridas — así que vive en memoria
// de la sesión de página, dicho honesto en la UI (anotado en pendientes).

import { useCallback, useState, type CSSProperties } from 'react';
import { Pagina, PageHeader, Alert, Button } from '@/app/_ui';
import { MakoLogo } from '../_components/MakoBrand';
import { Dropdown } from '../components/Dropdown';
import { Storyboard } from './Storyboard';
import { OBJETIVOS_STORIES, empujaADm, type ObjetivoStories } from './objetivos';
import { generarSecuenciaAction } from './actions';
import type { PiezaStory } from '@/lib/ig-writer';

const MONO = "'Geist Mono', monospace";
const SANS = "'Geist', sans-serif";

const card: CSSProperties = { background: 'var(--surface)', border: '1px solid var(--border)', borderRadius: 14, padding: 20 };
const eyebrow: CSSProperties = { fontFamily: MONO, fontSize: 10.5, letterSpacing: '.14em', textTransform: 'uppercase', color: 'var(--faint)' };
const areaTexto: CSSProperties = { width: '100%', minHeight: 110, padding: '12px 14px', fontSize: 14, fontFamily: SANS, lineHeight: 1.55, border: '1px solid var(--border-strong)', borderRadius: 10, background: 'var(--surface)', color: 'var(--ink)', resize: 'vertical' };

type ItemHistorial = { pieza: PiezaStory; objetivo: ObjetivoStories; at: string };

/**
 * La secuencia como texto, para «Copiar la secuencia». La arma el CÓDIGO desde la
 * pieza, no el modelo: un dato exacto no se le vuelve a pedir a un LLM.
 */
function secuenciaATexto(p: PiezaStory): string {
  const ultimo = p.frames.length - 1;
  return [
    `STORIES DEL DÍA: ${p.idea}`,
    ...p.frames.map((f, i) => [
      `FRAME ${i + 1} · ${f.tipo}`,
      f.texto ? `Texto: ${f.texto}` : '',
      f.indicacion ? `Producción: ${f.indicacion}` : '',
      f.interactivoManual ? 'Interactivo: se agrega a mano en la app.' : '',
      i === ultimo && (p.cta || p.palabraClave)
        ? `Cierre: ${[p.cta, p.palabraClave ? `palabra clave ${p.palabraClave}` : ''].filter(Boolean).join(' · ')}`
        : '',
    ].filter(Boolean).join('\n')),
  ].join('\n\n');
}

export function StoriesApp({ piezaInicial = null }: { piezaInicial?: PiezaStory | null }) {
  const [objetivo, setObjetivo] = useState<ObjetivoStories>('conexion');
  const [pedido, setPedido] = useState('');
  const [pieza, setPieza] = useState<PiezaStory | null>(piezaInicial);
  const [historial, setHistorial] = useState<ItemHistorial[]>([]);
  const [estado, setEstado] = useState<'listo' | 'generando'>('listo');
  const [aviso, setAviso] = useState<{ tono: 'bad' | 'good'; texto: string } | null>(null);

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

  const [copiado, setCopiado] = useState(false);
  const copiar = useCallback(async () => {
    if (!pieza) return;
    try {
      await navigator.clipboard.writeText(secuenciaATexto(pieza));
      setCopiado(true);
      setTimeout(() => setCopiado(false), 2200);
    } catch { /* el navegador no permitió copiar; el texto queda a la vista */ }
  }, [pieza]);

  const interactivos = pieza ? pieza.frames.filter((f) => f.interactivoManual).length : 0;

  return (
    <Pagina>
      <PageHeader
        titulo="Stories"
        proposito="Secuencias de stories listas para grabar: una idea por día, frame por frame."
      />

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
                El último frame va a pedir responder la story con una palabra clave.
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
                cópialo.
              </div>
            </div>
          )}
        </aside>

        {/* ── La secuencia ── */}
        <section style={{ flex: 1, minWidth: 340, display: 'grid', gap: 14 }}>
          {aviso && (
            <Alert tono={aviso.tono}>
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
                  {' '}(encuesta, pregunta o slider): se agregan a mano en la app de Instagram
                  al publicar cada story.
                </Alert>
              )}

              <div style={{ ...card, display: 'grid', gap: 10 }}>
                <Button
                  variant="secondary"
                  onClick={() => void copiar()}
                  disabled={ocupado}
                  style={{ justifySelf: 'start' }}
                >
                  {copiado ? 'Copiado ✓' : 'Copiar la secuencia'}
                </Button>
              </div>
            </>
          )}
        </section>
      </div>
    </Pagina>
  );
}
