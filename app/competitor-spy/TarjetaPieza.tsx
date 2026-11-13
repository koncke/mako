'use client';

// =============================================================================
// Una pieza de Competitor Spy: la tarjeta de los outliers de Create (12/11/2026)
// =============================================================================
// REHECHA el 12/11/2026 con la tarjeta de los outliers de Create (Martín: cada outlier «en una tarjeta» que «englobe a la casilla»,
// con la forma de su plataforma; el Cerebro: «si en Spy hay piezas como los outliers de Create, el mismo diseño»). La caja, el marco,
// las marcas sobre la imagen, el múltiplo y el pie son las CLASES de app/image-editor/carruseles/explorar.module.css, las mismas que
// arman Image, Video, Web Generator y Copywriting (no hay un componente: cada portada arma su tarjeta con ellas). Lo propio de Spy
// está en ./tarjeta-pieza.module.css. La anterior (1/11) era la `.pcard` de fitlo: sin borde, con tinte por canal y una píldora.
//
// LO QUE SE CONSERVÓ DE LAS REGLAS:
//  · Su proporción real (Martín, 4/11): un reel vertical, una imagen cuadrada, un video de YouTube apaisado (`proporcionDe`).
//  · Un número ausente no es cero ni una frase: sólo van los que hay (Martín, con Leila, 4/11: «"No lo publica" se ve mal»).
//  · Si falta un dato, la línea se omite y la tarjeta se recompone. Nunca una clave ni un `ref`.
//  · ⚠️ LA ETAPA NO SE DIBUJA (4/11/2026): lo orgánico dice hace cuánto se publicó; un anuncio, cuántos días lleva al aire.
//  · «Analizando…» mientras la IA del negocio lee la pieza, sola y en segundo plano (`analizando`).
//  · Su «3,7×» (5/11/2026, lib/multiplo-rendimiento.ts), con el color de su nivel como en Create. Sin número no hay chip: nunca
//    un número inventado.
//
// ⚠️ LA MINIATURA SE DIBUJA DESDE LA URL VIVA Y NO SE GUARDA. La de YouTube se arma con el id.
// La de Instagram vence (es del CDN de Meta) y se reescribe en cada lectura (lib/spy.ts).

import { contadorDeTarjeta, destinoDePieza, fechaCorta, miniaturaDePieza, rotuloDeTipo, tiempoDePieza } from '@/lib/spy-vista';
import { proporcionDe } from '@/lib/spy-detalle';
import { chipDeMultiplo, explicarMultiplo, type Multiplo } from '@/lib/multiplo-rendimiento';
import { nivelDeMultiplo } from '@/lib/carruseles/explorar';
import s from '@/app/image-editor/carruseles/explorar.module.css';
import type { ReactNode } from 'react';
import { LogoRed, redDePieza } from './LogoRed';
import t from './tarjeta-pieza.module.css';
import type { PiezaVista } from './actions';

/** Los números de la tarjeta, en el orden de Create. Sólo los que hay: un contador ausente no se dibuja. */
export function numerosDeTarjeta(p: PiezaVista): Array<{ k: string; icono: string; valor: string; titulo: string }> {
  if (p.canal === 'anuncios') return [];
  return [
    { k: 'vistas', icono: '▶', valor: contadorDeTarjeta(p.vistas, p.metricas_leidas_en), titulo: 'vistas' },
    { k: 'megusta', icono: '♥', valor: contadorDeTarjeta(p.megusta, p.metricas_leidas_en), titulo: 'me gusta' },
    { k: 'comentarios', icono: '💬', valor: contadorDeTarjeta(p.comentarios, p.metricas_leidas_en), titulo: 'comentarios' },
  ].filter((n) => /^\d/.test(n.valor)).map((n) => ({ ...n, titulo: `${n.valor} ${n.titulo}` }));
}

export function TarjetaPieza({ p, analizando = false, multiplo = null, onAbrir, extra }: {
  p: PiezaVista;
  analizando?: boolean;
  /** Su múltiplo, calculado sobre TODAS las piezas del competidor (`multiplosDe`): una tarjeta sola no tiene con qué comparar. */
  multiplo?: Multiplo | null;
  /** Abre su detalle (DetallePieza.tsx, con «Copiar estructura»). Sin esto, la tarjeta lleva a la pieza en su red. */
  onAbrir?: () => void;
  /**
   * Lo que va DEBAJO de los números, dentro del pie (las alertas de los seguidos: de quién es, el ángulo y «¿Creamos uno
   * parecido?», ./Seguidos.tsx). Un botón de acá frena el clic: si no, abriría la tarjeta. Quien lo usa le pasa a la grilla el
   * alto de más (`pie` de GrillaPiezas), o la grilla mixta se descuadra.
   */
  extra?: ReactNode;
}) {
  const esAnuncio = p.canal === 'anuncios';
  const tiempo = tiempoDePieza(p);
  const miniatura = miniaturaDePieza(p);
  // El texto ya se ve en el marco cuando no hay miniatura: abajo no se repite.
  const titulo = p.analisis?.gancho || p.titulo || (miniatura && p.texto ? p.texto.split('\n')[0].slice(0, 160) : null) || null;
  const destino = destinoDePieza(p);
  const { ancho, alto } = proporcionDe(p);
  const red = redDePieza(p.canal);
  const chip = chipDeMultiplo(multiplo);
  const nivel = chip ? nivelDeMultiplo(multiplo?.veces) : null;
  const numeros = numerosDeTarjeta(p);
  // Un anuncio pegado no dice cuándo empezó; el que se guardó desde la Biblioteca sí.
  const cuando = esAnuncio && tiempo.dias == null ? `Lo viste el ${fechaCorta(p.visto_primera_vez)}`
    : tiempo.dias == null ? null
      : esAnuncio ? `${tiempo.dias} d al aire`
        : tiempo.dias === 0 ? 'Hoy' : `Hace ${tiempo.dias} d`;

  const cuerpo = (
    <>
      <div className={s.mini} style={{ aspectRatio: `${ancho} / ${alto}` }}>
        {p.texto && <span className={t.texto}>{p.texto.slice(0, 220)}</span>}
        {miniatura && (
          /* ⚠️ `referrerPolicy="no-referrer"` NO ES DECORACIÓN: sin eso el CDN de Meta (scontent.cdninstagram.com) devuelve 403 a
             toda imagen pedida desde otro dominio. Sin referrer, la sirve. */
          // eslint-disable-next-line @next/next/no-img-element -- la sirve el CDN del canal, y no pasa por nuestro optimizador
          <img className={t.foto} src={miniatura} alt="" loading="lazy" referrerPolicy="no-referrer"
            onError={(e) => { e.currentTarget.remove(); }} />
        )}
        <span className={`${s.marcas} ${t.marcas}`}>
          {red && <span className={t.red}><LogoRed red={red} box={16} />{rotuloDeTipo(p.tipo)}</span>}
          {cuando && <span className={s.aire} data-activo={esAnuncio && tiempo.sigue ? 'si' : undefined} title={tiempo.linea}>{cuando}</span>}
          {analizando && <span className={s.aire} aria-live="polite">Analizando…</span>}
        </span>
      </div>
      <div className={s.pie}>
        {(chip || titulo) && (
          <div className={s.fila1}>
            {chip && nivel && <span className={s.mult} data-nivel={nivel} title={explicarMultiplo(multiplo)}>{chip}</span>}
            {titulo && <span className={s.gancho} title={titulo}>{titulo}</span>}
          </div>
        )}
        {(numeros.length > 0 || destino) && (
          <div className={s.datos}>
            {numeros.map((n) => <span key={n.k} title={n.titulo}>{n.icono} {n.valor}</span>)}
            {destino && <span className={t.destino} title={`Manda a ${destino}`}>→ {destino}</span>}
          </div>
        )}
        {extra && <div className={t.extra}>{extra}</div>}
      </div>
    </>
  );

  // ⚠️ CON `onAbrir` ES UN `div` CON ROL DE BOTÓN, no un `<button>`: adentro van bloques (un botón sólo admite texto en
  // línea) y cambiar la etiqueta le cambiaría la hoja por defecto (AGENTS.md, «Cambiar la ETIQUETA de un elemento…»).
  if (onAbrir) {
    return (
      <div className={`${s.tarjeta} ${t.abrir}`} data-canal={p.canal} role="button" tabIndex={0}
        aria-label={`Ver ${titulo ?? rotuloDeTipo(p.tipo)}`}
        onClick={onAbrir} onKeyDown={(e) => { if (e.key === 'Enter' || e.key === ' ') { e.preventDefault(); onAbrir(); } }}>
        {cuerpo}
      </div>
    );
  }
  return p.url
    ? <a className={`${s.tarjeta} ${t.abrir}`} data-canal={p.canal} href={p.url} target="_blank" rel="noreferrer noopener">{cuerpo}</a>
    : <div className={s.tarjeta} data-canal={p.canal}>{cuerpo}</div>;
}
