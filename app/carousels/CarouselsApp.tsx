'use client';

// =============================================================================
// CarouselsApp — MaKo escribe el carrusel, slide a slide
// =============================================================================
// Izquierda: el pedido (tema/objetivo + tipo) y el historial de la sesión.
// Derecha: la pieza — slides como tarjetas navegables con edición inline,
// caption editable y «Copiar el carrusel».
//
// ⚠️ Hasta el 06/10/2026 el cierre era «Enviar a publicación» (un borrador en el
// programador de /instagram) con un aviso para conectar la cuenta. Salieron con la
// tab Instagram (decisión de Martín): la pieza se copia y se publica a mano.
//
// El motor vive en lib/ig-writer.ts: acá solo UI + server actions propias
// (./actions.ts). Los límites técnicos y la
// doctrina salen de lib/ig-formatos.ts (fuente única) — incluida la doctrina
// NEGATIVA de hashtags: los cursos los descartan como palanca, así que la tab no
// los inventa; lo dice en pantalla en vez de rellenar con números de manual.

import { useCallback, useMemo, useState, type CSSProperties } from 'react';
import Link from '@/app/_ui/Link';
import { Pagina, Button } from '@/app/_ui';
import { MakoLogo } from '../_components/MakoBrand';
import { Dropdown } from '../components/Dropdown';
import { CAPTION_MAX, CAPTION_VISIBLE, LIMITES_CARRUSEL, LIMITES_IMAGEN } from '@/lib/ig-formatos';
// `import type` de un módulo server-only: se borra al compilar, no arrastra nada.
import type { PiezaCarrusel } from '@/lib/ig-writer';
import { generarCarruselAction, type TipoCarrusel } from './actions';

const MONO = "'Geist Mono', monospace";
const SANS = "'Geist', sans-serif";

const card: CSSProperties = { background: 'var(--surface)', border: '1px solid var(--border)', borderRadius: 14, padding: 20 };
const eyebrow: CSSProperties = { fontFamily: MONO, fontSize: 10.5, letterSpacing: '.14em', textTransform: 'uppercase', color: 'var(--faint)' };
const areaTexto: CSSProperties = { width: '100%', padding: '12px 14px', fontSize: 14, fontFamily: SANS, lineHeight: 1.55, border: '1px solid var(--border-strong)', borderRadius: 10, background: 'var(--surface)', color: 'var(--ink)', resize: 'vertical' };

const TIPOS: Array<{ value: TipoCarrusel; label: string; sub: string }> = [
  { value: 'educativo', label: 'Educativo', sub: 'Enseña una sola cosa; la respuesta va al final' },
  { value: 'storytelling', label: 'Storytelling', sub: 'Historia escena a escena con personaje consistente' },
  { value: 'venta', label: 'Venta', sub: 'Problema → solución ligada a tu oferta, CTA al cierre' },
];

/** Rol de la slide según su posición (la portada es el gancho; la última cierra). */
const rolDeSlide = (i: number, total: number) =>
  i === 0 ? 'Portada · gancho' : i === total - 1 ? 'Cierre · moraleja + CTA' : 'Desarrollo';

/**
 * El guion del carrusel como texto, para «Copiar el carrusel». Lo arma el CÓDIGO
 * desde la pieza editada, no el modelo: un dato exacto no se le vuelve a pedir a un
 * LLM.
 */
function notasDe(p: PiezaCarrusel): string {
  return [
    `Objetivo: ${p.objetivo || '—'}`,
    p.cta ? `CTA (última slide): ${p.cta}` : 'Sin CTA: pieza solo de alcance.',
    p.palabraClave ? `Palabra clave comment→DM: ${p.palabraClave}` : '',
    p.cta ? `Primer comentario sugerido: ${p.cta}` : '',
    `Imágenes finales SOLO ${LIMITES_IMAGEN.formato} (un PNG rebota) · ${LIMITES_CARRUSEL.itemsMin}-${LIMITES_CARRUSEL.itemsMax} slides.`,
    '',
    ...p.slides.map((s, i) =>
      `Slide ${i + 1} — ${rolDeSlide(i, p.slides.length)}\n  Texto en la imagen: ${s.texto || '—'}\n  Diseño: ${s.visual || '—'}`),
  ].filter(Boolean).join('\n');
}

type ItemHistorial = { at: string; pedido: string; pieza: PiezaCarrusel };

export function CarouselsApp({
  perfilCargado, piezaInicial = null,
}: { perfilCargado: boolean; piezaInicial?: PiezaCarrusel | null }) {
  const [pedido, setPedido] = useState('');
  const [tipo, setTipo] = useState<TipoCarrusel>('educativo');
  const [pieza, setPieza] = useState<PiezaCarrusel | null>(piezaInicial);
  const [slideIdx, setSlideIdx] = useState(0);
  const [estado, setEstado] = useState<'listo' | 'generando'>('listo');
  const [aviso, setAviso] = useState<{ tono: 'bad' | 'good'; texto: React.ReactNode } | null>(null);
  // Historial de la SESIÓN (memoria de página, se pierde al recargar — no hay
  // tabla genérica de historial de writers y una migración acá colisionaría con
  // otras corridas; queda anotado como pendiente).
  const [historial, setHistorial] = useState<ItemHistorial[]>(
    piezaInicial ? [{ at: new Date().toISOString(), pedido: 'Pieza de muestra del onboarding', pieza: piezaInicial }] : [],
  );

  const ocupado = estado !== 'listo';

  const generar = useCallback(async () => {
    if (!pedido.trim()) return;
    setEstado('generando'); setAviso(null);
    try {
      const r = await generarCarruselAction(pedido, tipo);
      if (!r.ok) throw new Error(r.error);
      setPieza(r.pieza);
      setSlideIdx(0);
      setHistorial((h) => [{ at: new Date().toISOString(), pedido, pieza: r.pieza }, ...h].slice(0, 20));
    } catch (e) {
      setAviso({ tono: 'bad', texto: e instanceof Error ? e.message : String(e) });
    } finally { setEstado('listo'); }
  }, [pedido, tipo]);

  const [copiado, setCopiado] = useState(false);
  const copiar = useCallback(async () => {
    if (!pieza) return;
    try {
      await navigator.clipboard.writeText(`${notasDe(pieza)}\n\nCaption:\n${pieza.caption}`);
      setCopiado(true);
      setTimeout(() => setCopiado(false), 2200);
    } catch { /* el navegador no permitió copiar; el texto queda a la vista */ }
  }, [pieza]);

  const editarSlide = useCallback((i: number, campo: 'texto' | 'visual', valor: string) => {
    setPieza((p) => p ? { ...p, slides: p.slides.map((s, k) => (k === i ? { ...s, [campo]: valor } : s)) } : p);
  }, []);

  const editarCaption = useCallback((valor: string) => {
    setPieza((p) => (p ? { ...p, caption: valor.slice(0, CAPTION_MAX) } : p));
  }, []);

  const slide = pieza?.slides[Math.min(slideIdx, (pieza?.slides.length ?? 1) - 1)] ?? null;
  const idxVivo = pieza ? Math.min(slideIdx, pieza.slides.length - 1) : 0;

  const fechaCorta = useMemo(
    () => (iso: string) => new Date(iso).toLocaleTimeString('es-MX', { hour: '2-digit', minute: '2-digit' }),
    [],
  );

  return (
    <Pagina>
      <header style={{ marginBottom: 22 }}>
        <div style={{ display: 'flex', alignItems: 'center', gap: 9, marginBottom: 6 }}>
          <MakoLogo size={22} />
          <span style={eyebrow}>Carousels</span>
        </div>
        <h1 style={{ fontSize: 30, fontWeight: 650, letterSpacing: '-0.025em', margin: 0 }}>
          Tu carrusel, slide a slide
        </h1>
      </header>

      <div style={{ display: 'flex', gap: 22, alignItems: 'flex-start', flexWrap: 'wrap' }}>
        {/* ── PEDIDO ── */}
        <aside style={{ width: 340, flex: '0 0 auto', display: 'grid', gap: 16 }}>
          <div style={card}>
            <div style={{ ...eyebrow, marginBottom: 10 }}>Qué carrusel necesitas</div>
            <textarea
              style={{ ...areaTexto, minHeight: 118 }}
              value={pedido}
              onChange={(e) => setPedido(e.target.value)}
              disabled={ocupado}
              placeholder="Ej: el error más común de tus clientes antes de trabajar contigo, que termine pidiendo un comentario con la palabra GUÍA."
              aria-label="Qué carrusel necesitas"
            />

            <div style={{ ...eyebrow, margin: '18px 0 8px' }}>De qué tipo</div>
            <Dropdown
              value={tipo}
              onChange={(v) => setTipo(v as TipoCarrusel)}
              options={TIPOS}
              width="100%"
              ariaLabel="Tipo de carrusel"
              disabled={ocupado}
            />

            <Button
              variant="primary"
              onClick={() => void generar()}
              loading={estado === 'generando'}
              disabled={ocupado || !pedido.trim()}
              style={{ width: '100%', marginTop: 18 }}
            >
              {estado === 'generando' ? 'MaKo está escribiendo…' : pieza ? 'Escribir otro carrusel' : 'Escribir el carrusel'}
            </Button>

            {!perfilCargado && (
              <div style={{ marginTop: 11, fontSize: 12.5, color: 'var(--dim)', lineHeight: 1.5 }}>
                Sin el perfil del negocio las piezas salen genéricas.{' '}
                <Link href="/onboarding" style={{ color: 'var(--primary)', fontWeight: 600 }}>Complétalo aquí →</Link>
              </div>
            )}
          </div>

          {/* Historial de la sesión */}
          {historial.length > 0 && (
            <div style={card}>
              <div style={{ ...eyebrow, marginBottom: 4 }}>Piezas de esta sesión</div>
              <div style={{ fontSize: 11.5, color: 'var(--faint)', marginBottom: 10 }}>
                Se pierden al recargar la página. Lo que quieras conservar, cópialo.
              </div>
              <div style={{ display: 'grid', gap: 8 }}>
                {historial.map((h, i) => (
                  <button
                    key={`${h.at}-${i}`}
                    type="button"
                    onClick={() => { setPieza(h.pieza); setSlideIdx(0); setAviso(null); }}
                    style={{ textAlign: 'left', padding: '10px 12px', borderRadius: 10, border: '1px solid var(--border)', background: 'var(--surface-2)', cursor: 'pointer', fontFamily: SANS }}
                  >
                    <div style={{ fontSize: 13.5, fontWeight: 600, overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>
                      {h.pieza.slides[0]?.texto || h.pedido}
                    </div>
                    <div style={{ fontFamily: MONO, fontSize: 11, color: 'var(--faint)', marginTop: 2 }}>
                      {h.pieza.slides.length} slides · {fechaCorta(h.at)}
                    </div>
                  </button>
                ))}
              </div>
            </div>
          )}
        </aside>

        {/* ── LA PIEZA ── */}
        <section style={{ flex: 1, minWidth: 380, display: 'grid', gap: 16 }}>
          {aviso && (
            <div style={{ padding: '10px 14px', borderRadius: 10, fontSize: 13.5, lineHeight: 1.5,
              background: aviso.tono === 'bad' ? 'var(--bad-bg)' : 'var(--good-bg)', color: aviso.tono === 'bad' ? 'var(--bad)' : 'var(--good)' }}>
              {aviso.texto}
            </div>
          )}

          {!pieza ? (
            <div style={{ ...card, padding: 40, textAlign: 'center' }}>
              {/* Se centra con FLEX, no con el `textAlign: 'center'` del padre: el preflight
                  de Tailwind pone `svg { display: block }` y a un bloque el text-align no lo
                  mueve — el icono quedaba pegado a la izquierda. */}
              <div style={{ display: 'flex', justifyContent: 'center' }}><MakoLogo size={54} /></div>
              <h2 style={{ fontSize: 20, fontWeight: 650, margin: '16px 0 8px', letterSpacing: '-0.02em' }}>Cuéntale a MaKo qué carrusel necesitas</h2>
              <p style={{ fontSize: 14, color: 'var(--dim)', lineHeight: 1.6, margin: '0 auto', maxWidth: 420 }}>
                Escribe el guion completo —portada-gancho, texto por slide, notas de diseño y
                caption— usando tu oferta, tu cliente ideal y tu funnel. Después editas cada
                slide y copias la pieza.
              </p>
            </div>
          ) : (
            <>
              {/* Cabecera de la pieza */}
              <div style={card}>
                <div style={eyebrow}>Objetivo de la pieza</div>
                <h2 style={{ fontSize: 20, fontWeight: 650, letterSpacing: '-0.02em', margin: '6px 0 0', lineHeight: 1.35 }}>
                  {pieza.objetivo || 'Sin objetivo declarado'}
                </h2>
                <div style={{ display: 'flex', gap: 8, flexWrap: 'wrap', marginTop: 12 }}>
                  <span style={{ fontFamily: MONO, fontSize: 11, padding: '4px 10px', borderRadius: 999, background: 'var(--surface-2)', color: 'var(--dim)' }}>
                    {pieza.slides.length} slides
                  </span>
                  {pieza.palabraClave && (
                    <span style={{ fontFamily: MONO, fontSize: 11, padding: '4px 10px', borderRadius: 999, background: 'var(--primary-bg)', color: 'var(--primary-strong)', fontWeight: 700 }}>
                      Palabra clave: {pieza.palabraClave}
                    </span>
                  )}
                </div>
                {pieza.cta && (
                  <div style={{ marginTop: 14, paddingTop: 13, borderTop: '1px solid var(--border)' }}>
                    <div style={eyebrow}>CTA de la última slide</div>
                    <div style={{ fontSize: 14, marginTop: 5, lineHeight: 1.5 }}>{pieza.cta}</div>
                    <div style={{ fontSize: 12.5, color: 'var(--dim)', marginTop: 6, lineHeight: 1.5 }}>
                      Primer comentario sugerido: el mismo CTA, para anclar la palabra clave
                      apenas salga el post.
                    </div>
                  </div>
                )}
              </div>

              {/* Slides navegables con edición inline */}
              <div style={card}>
                <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', gap: 10, flexWrap: 'wrap', marginBottom: 12 }}>
                  <div style={eyebrow}>Slides · edita el texto antes de exportar</div>
                  <div style={{ display: 'flex', gap: 8 }}>
                    <Button variant="tertiary" size="sm" onClick={() => setSlideIdx((i) => Math.max(0, i - 1))} disabled={idxVivo === 0}>
                      ← Slide anterior
                    </Button>
                    <Button variant="tertiary" size="sm" onClick={() => setSlideIdx((i) => Math.min(pieza.slides.length - 1, i + 1))} disabled={idxVivo >= pieza.slides.length - 1}>
                      Slide siguiente →
                    </Button>
                  </div>
                </div>

                {/* Miniaturas: envuelven, nunca scroll horizontal. */}
                <div style={{ display: 'flex', gap: 6, flexWrap: 'wrap', marginBottom: 14 }}>
                  {pieza.slides.map((s, i) => (
                    <button
                      key={i}
                      type="button"
                      onClick={() => setSlideIdx(i)}
                      aria-label={`Ir a la slide ${i + 1}`}
                      title={s.texto}
                      style={{
                        fontFamily: MONO, fontSize: 11.5, fontWeight: 700, padding: '6px 11px', borderRadius: 8, cursor: 'pointer',
                        border: `1px solid ${i === idxVivo ? 'var(--primary)' : 'var(--border-strong)'}`,
                        background: i === idxVivo ? 'var(--primary-bg)' : 'var(--surface)',
                        color: i === idxVivo ? 'var(--primary-strong)' : 'var(--dim)',
                      }}
                    >
                      {String(i + 1).padStart(2, '0')}
                    </button>
                  ))}
                </div>

                {slide && (
                  <div style={{ border: '1px solid var(--border)', borderRadius: 12, padding: 16, background: 'var(--surface-2)' }}>
                    <div style={{ display: 'flex', gap: 9, alignItems: 'baseline', flexWrap: 'wrap', marginBottom: 12 }}>
                      <span style={{ fontFamily: MONO, fontSize: 10.5, fontWeight: 700, letterSpacing: '.06em', textTransform: 'uppercase', padding: '3px 9px', borderRadius: 999, background: 'var(--surface)', border: '1px solid var(--border)', color: 'var(--dim)' }}>
                        Slide {idxVivo + 1} de {pieza.slides.length} · {rolDeSlide(idxVivo, pieza.slides.length)}
                      </span>
                    </div>

                    <div style={{ ...eyebrow, marginBottom: 6 }}>Texto en la imagen</div>
                    <textarea
                      style={{ ...areaTexto, minHeight: 74 }}
                      value={slide.texto}
                      onChange={(e) => editarSlide(idxVivo, 'texto', e.target.value)}
                      aria-label={`Texto de la slide ${idxVivo + 1}`}
                    />

                    <div style={{ ...eyebrow, margin: '12px 0 6px' }}>Nota de diseño</div>
                    <textarea
                      style={{ ...areaTexto, minHeight: 60, fontSize: 13 }}
                      value={slide.visual}
                      onChange={(e) => editarSlide(idxVivo, 'visual', e.target.value)}
                      aria-label={`Nota de diseño de la slide ${idxVivo + 1}`}
                    />

                    <div style={{ display: 'flex', gap: 8, alignItems: 'flex-start', marginTop: 12, paddingTop: 11, borderTop: '1px solid var(--border)' }}>
                      <MakoLogo size={15} />
                      <div style={{ fontSize: 12.5, color: 'var(--dim)', lineHeight: 1.5 }}>
                        {idxVivo === 0
                          ? 'La portada es el gancho: muestra el problema sin explicarlo y no revela la solución.'
                          : idxVivo === pieza.slides.length - 1
                            ? 'El cierre entrega la moraleja y pide el comentario con la palabra clave.'
                            : 'Texto corto dentro de la imagen y plano distinto al de la slide anterior — nunca un párrafo en una esquina.'}
                      </div>
                    </div>
                  </div>
                )}
              </div>

              {/* Caption */}
              <div style={card}>
                <div style={{ display: 'flex', alignItems: 'baseline', justifyContent: 'space-between', gap: 10, flexWrap: 'wrap', marginBottom: 8 }}>
                  <div style={eyebrow}>Caption</div>
                  <span style={{ fontFamily: MONO, fontSize: 11, color: pieza.caption.length > CAPTION_MAX - 100 ? 'var(--bad)' : 'var(--faint)' }}>
                    {pieza.caption.length}/{CAPTION_MAX} · visibles antes del «más»: {CAPTION_VISIBLE}
                  </span>
                </div>
                <textarea
                  style={{ ...areaTexto, minHeight: 84 }}
                  value={pieza.caption}
                  onChange={(e) => editarCaption(e.target.value)}
                  aria-label="Caption del carrusel"
                />
                <div style={{ fontSize: 12.5, color: 'var(--dim)', lineHeight: 1.5, marginTop: 8 }}>
                  Sin hashtags a propósito: los cursos los descartan como palanca — la palanca es
                  la portada. La caption solo refuerza la palabra clave del CTA.
                </div>
              </div>

              {/* Copiar la pieza */}
              <div style={{ ...card, background: 'var(--surface-2)' }}>
                <div style={{ ...eyebrow, marginBottom: 10 }}>Para publicar</div>
                <div style={{ fontSize: 12.5, color: 'var(--dim)', lineHeight: 1.5 }}>
                  Imágenes SOLO en {LIMITES_IMAGEN.formato} (un PNG rebota) ·{' '}
                  {LIMITES_CARRUSEL.itemsMin} a {LIMITES_CARRUSEL.itemsMax} ítems, se puede mezclar imagen y video ·
                  aspecto recomendado {LIMITES_IMAGEN.aspectoRecomendado}.
                </div>
                <Button
                  variant="secondary"
                  onClick={() => void copiar()}
                  disabled={ocupado}
                  style={{ marginTop: 14 }}
                >
                  {copiado ? 'Copiado ✓' : 'Copiar el carrusel'}
                </Button>
              </div>
            </>
          )}
        </section>
      </div>
    </Pagina>
  );
}
