'use client';

// =============================================================================
// CarouselsM — el carrusel en el teléfono: pedirlo, mirarlo como un post de Instagram, editarlo y copiarlo
// =============================================================================
// Ver ./page.tsx. Tres hojas, una a la vez: el pedido, una slide (su texto y su nota de diseño) y el caption. Lo
// que se edita queda en la pieza de la pantalla, como en escritorio, y es lo que copia «Copiar el carrusel».
// =============================================================================

import { useEffect, useRef, useState } from 'react';
import { Button } from '@/app/_ui/Button';
import { Icon } from '@/app/_components/icons';
import { rutaSeccion } from '@/lib/secciones-negocio';
import { CAPTION_MAX, CAPTION_VISIBLE } from '@/lib/ig-formatos';
import type { PiezaCarrusel } from '@/lib/ig-writer';
import { generarCarruselAction, type TipoCarrusel } from '@/app/carousels/actions';
import { TIPOS, carruselATexto, rolDeSlide } from '@/app/carousels/pieza';
import { copiarTexto } from '@/app/m/copywriting/api';
import {
  FilaM, ListaM, PieFijoM, PieM, SeccionM, SheetM, VacioM, useConexion, useToastM,
} from '@/app/m/_ui';
import { CampoM, ErrorLineaM, OpcionesM, RotuloM } from '../_creacion/escritor';

type Item = { at: string; pedido: string; pieza: PiezaCarrusel };
type Hoja = { tipo: 'pedido' } | { tipo: 'slide'; i: number } | { tipo: 'caption' } | null;

const OPCIONES_TIPO = TIPOS.map((t) => ({ value: t.value, label: t.label, hint: t.sub }));

const horaCorta = (iso: string) => {
  try { return new Date(iso).toLocaleTimeString('es-MX', { hour: '2-digit', minute: '2-digit' }); } catch { return ''; }
};

/** Las slides de costado, una por pantalla, con el «1/7» y los puntos de Instagram. */
function PostM({ pieza, onAbrir }: { pieza: PiezaCarrusel; onAbrir: (i: number) => void }) {
  const pista = useRef<HTMLDivElement>(null);
  const [actual, setActual] = useState(0);
  const total = pieza.slides.length;

  // La slide que se ve es la que el desplazamiento dejó al frente (el scroll-snap la centra).
  useEffect(() => {
    const el = pista.current;
    if (!el) return;
    const alMover = () => {
      const w = el.clientWidth || 1;
      setActual(Math.max(0, Math.min(total - 1, Math.round(el.scrollLeft / w))));
    };
    el.addEventListener('scroll', alMover, { passive: true });
    return () => el.removeEventListener('scroll', alMover);
  }, [total]);

  return (
    <div className="m-carousels-post">
      <div className="m-carousels-pista" ref={pista} data-m-sin-pull aria-roledescription="carrusel" aria-label={`${total} slides`}>
        {pieza.slides.map((s, i) => (
          <button key={i} type="button" className="m-carousels-slide" onClick={() => onAbrir(i)}
            aria-label={`Editar la slide ${i + 1} de ${total}`}>
            <span className="m-carousels-slide__n" aria-hidden>{i + 1}/{total}</span>
            <span className="m-carousels-slide__rol">{rolDeSlide(i, total)}</span>
            <span className="m-carousels-slide__texto">{s.texto || '—'}</span>
            {s.visual && <span className="m-carousels-slide__visual">{s.visual}</span>}
          </button>
        ))}
      </div>
      <div className="m-carousels-puntos" aria-hidden>
        {pieza.slides.map((_, i) => <i key={i} data-activo={i === actual ? '' : undefined} />)}
      </div>
    </div>
  );
}

export function CarouselsM({ perfilCargado }: { perfilCargado: boolean }) {
  const toast = useToastM();
  const { enLinea } = useConexion();
  const [pedido, setPedido] = useState('');
  const [tipo, setTipo] = useState<TipoCarrusel>('educativo');
  const [pieza, setPieza] = useState<PiezaCarrusel | null>(null);
  const [sesion, setSesion] = useState<Item[]>([]);
  const [hoja, setHoja] = useState<Hoja>(null);
  // La slide que se edita queda puesta mientras su hoja se va (LEEME.md).
  const [slideEnHoja, setSlideEnHoja] = useState(0);
  const [escribiendo, setEscribiendo] = useState(false);
  const [error, setError] = useState('');
  const [verMas, setVerMas] = useState(false);

  const escribir = async () => {
    if (escribiendo || !pedido.trim()) return;
    setEscribiendo(true); setError('');
    try {
      const r = await generarCarruselAction(pedido, tipo);
      if (!r.ok) { setError(r.error); return; }
      setPieza(r.pieza);
      setSesion((h) => [{ at: new Date().toISOString(), pedido, pieza: r.pieza }, ...h].slice(0, 20));
      setPedido('');
      setVerMas(false);
      setHoja(null);
      toast('Carrusel listo');
    } catch {
      setError('No se pudo escribir el carrusel. Revisa tu conexión y vuelve a intentar.');
    } finally {
      setEscribiendo(false);
    }
  };

  const editarSlide = (i: number, campo: 'texto' | 'visual', valor: string) => {
    setPieza((p) => (p ? { ...p, slides: p.slides.map((s, k) => (k === i ? { ...s, [campo]: valor } : s)) } : p));
  };
  const editarCaption = (valor: string) => setPieza((p) => (p ? { ...p, caption: valor.slice(0, CAPTION_MAX) } : p));

  const copiar = async () => {
    if (!pieza) return;
    toast((await copiarTexto(carruselATexto(pieza))) ? 'Carrusel copiado' : 'No se pudo copiar');
  };

  const slide = pieza?.slides[Math.min(slideEnHoja, pieza.slides.length - 1)] ?? null;
  const visible = pieza ? pieza.caption.slice(0, CAPTION_VISIBLE) : '';
  const resto = pieza ? pieza.caption.slice(CAPTION_VISIBLE) : '';

  return (
    <>
      {!perfilCargado && (
        <ListaM>
          <FilaM icono="cerebro" titulo="MaKo todavía no conoce tu negocio" segunda="Sin eso, los carruseles salen genéricos" href={rutaSeccion('archivero')} />
        </ListaM>
      )}

      {!pieza ? (
        <VacioM frase="Cuéntale a MaKo qué carrusel necesitas." />
      ) : (
        <>
          <PostM pieza={pieza} onAbrir={(i) => { setSlideEnHoja(i); setHoja({ tipo: 'slide', i }); }} />
          <button type="button" className="m-carousels-caption" onClick={() => setHoja({ tipo: 'caption' })}
            aria-label="Editar el caption">
            {verMas || !resto ? pieza.caption : <>{visible}<span className="m-carousels-caption__mas">… más</span></>}
          </button>
          {resto && !verMas && (
            <button type="button" className="m-carousels-vermas" onClick={() => setVerMas(true)}>Ver el caption entero</button>
          )}
          <section className="m-carousels-datos">
            {pieza.objetivo && (<><RotuloM>Objetivo</RotuloM><p className="m-carousels-datos__t">{pieza.objetivo}</p></>)}
            <RotuloM>CTA</RotuloM>
            <p className="m-carousels-datos__t">
              {pieza.cta ?? 'Sin CTA: pieza de alcance.'}
              {pieza.palabraClave && <> · <strong>{pieza.palabraClave}</strong></>}
            </p>
          </section>
        </>
      )}

      {sesion.length > 1 && (
        <SeccionM titulo="De esta sesión">
          <ListaM>
            {sesion.map((h) => (
              <FilaM
                key={h.at}
                leading={<span className="m-carousels-mini" aria-hidden><Icon name="carousel" size={18} /></span>}
                titulo={h.pieza.slides[0]?.texto || h.pedido}
                segunda={`${h.pieza.slides.length} slides · ${horaCorta(h.at)}`}
                chevron={false}
                onClick={() => { setPieza(h.pieza); setVerMas(false); }}
              />
            ))}
          </ListaM>
        </SeccionM>
      )}

      <PieFijoM>
        {pieza && (
          <Button variant="primary" size="lg" full icon={<Icon name="copy" size={18} />} onClick={() => void copiar()}>
            Copiar el carrusel
          </Button>
        )}
        <Button variant={pieza ? 'tertiary' : 'mako'} size="lg" full icon={pieza ? undefined : <Icon name="mako" size={18} />}
          disabled={!enLinea} onClick={() => { setError(''); setHoja({ tipo: 'pedido' }); }}>
          {pieza ? 'Escribir otro carrusel' : 'Escribir el carrusel'}
        </Button>
      </PieFijoM>

      <SheetM
        id="pedido-carrusel"
        abierto={hoja?.tipo === 'pedido'}
        onCerrar={() => setHoja(null)}
        titulo="Nuevo carrusel"
        snap="alto"
        ocupado={escribiendo}
        rotuloCerrar="Cerrar el pedido"
        pie={(
          <PieM consecuencia={escribiendo ? 'MaKo está escribiendo. Tarda unos segundos.' : undefined}>
            <Button variant="mako" size="lg" full icon={<Icon name="mako" size={18} />} loading={escribiendo}
              disabled={!pedido.trim() || !enLinea} onClick={() => void escribir()}>
              Escribir el carrusel
            </Button>
          </PieM>
        )}
      >
        <CampoM valor={pedido} onCambio={setPedido} etiqueta="Qué carrusel necesitas" deshabilitado={escribiendo}
          placeholder="Qué carrusel necesitas" />
        <SeccionM titulo="De qué tipo">
          <OpcionesM opciones={OPCIONES_TIPO} valor={tipo} onCambio={setTipo} etiqueta="De qué tipo" deshabilitado={escribiendo} />
        </SeccionM>
        {error && <ErrorLineaM>{error}</ErrorLineaM>}
      </SheetM>

      <SheetM
        id="slide-carrusel"
        abierto={hoja?.tipo === 'slide' && slide != null}
        onCerrar={() => setHoja(null)}
        titulo={pieza ? `Slide ${slideEnHoja + 1} de ${pieza.slides.length}` : 'Slide'}
        snap="alto"
        rotuloCerrar="Listo"
        pie={<PieM><Button variant="primary" size="lg" full onClick={() => setHoja(null)}>Listo</Button></PieM>}
      >
        {slide && pieza && (
          <>
            <RotuloM>{rolDeSlide(slideEnHoja, pieza.slides.length)}</RotuloM>
            <CampoM valor={slide.texto} onCambio={(v) => editarSlide(slideEnHoja, 'texto', v)} etiqueta={`Texto de la slide ${slideEnHoja + 1}`} filas={4} />
            <RotuloM>Nota de diseño</RotuloM>
            <CampoM valor={slide.visual} onCambio={(v) => editarSlide(slideEnHoja, 'visual', v)} etiqueta={`Nota de diseño de la slide ${slideEnHoja + 1}`} filas={4} />
          </>
        )}
      </SheetM>

      <SheetM
        id="caption-carrusel"
        abierto={hoja?.tipo === 'caption' && pieza != null}
        onCerrar={() => setHoja(null)}
        titulo="Caption"
        snap="alto"
        rotuloCerrar="Listo"
        pie={<PieM consecuencia={pieza ? `${pieza.caption.length} de ${CAPTION_MAX} caracteres` : undefined}>
          <Button variant="primary" size="lg" full onClick={() => setHoja(null)}>Listo</Button>
        </PieM>}
      >
        {pieza && <CampoM valor={pieza.caption} onCambio={editarCaption} etiqueta="Caption" filas={9} />}
      </SheetM>
    </>
  );
}
