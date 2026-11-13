'use client';

// =============================================================================
// La portada de Web Generator: «Encuentra tu siguiente OUTLIER» (11/11/2026)
// =============================================================================
// Martín, 11/11/2026 (por el Cerebro): «generar lo mismo que venimos haciendo con el resto de tabs, de outliers, para sacar
// outliers de páginas que estén buenas… empezar por la competencia… por las páginas de todos los gurús». COPIADA de la portada
// de Video (app/video-editor/OutliersVideo.tsx), que copia a Image (app/image-editor/carruseles/ExplorarCarruseles.tsx): el
// mismo encabezado con su «OUTLIER» marcado, «+ Seguir cuentas» y «Crear desde cero», el mismo buscador, los mismos filtros, la
// misma grilla y la misma tarjeta, con SUS clases (explorar.module.css y outliers.module.css): una portada, un diseño. Lo único
// propio (./outliers-landings.module.css): la tarjeta grande con la página entera que baja al pasar el cursor, y la fila de
// plantillas (./PlantillasPortada.tsx).
//
// Va ADENTRO del armazón de Create (./PortadaWeb.tsx: el chat de MaKo a la izquierda y tus landings a un toque) desde la noche del
// 11/11 (Martín: «¿Dónde está el chat de MaKo para ir a trabajar las páginas anteriores…?»). En el teléfono, sola (/m/landing).
//
// La tarjeta: la captura LARGA de la página, el tipo arriba («VSL», «Webinar»…), el titular tal cual, de quién es (con su ficha
// de Spy si es tu competencia), por qué funciona, «Replicar» (Replicar arrancando con esa página, panel-reglas.ts) y «Ver el
// original». Los datos y sus reglas: lib/landing-outliers.ts y ./portada-reglas.ts.
// =============================================================================

import { useMemo, useState, type ReactNode } from 'react';
import Link from '@/app/_ui/Link';
import { ReportarASoporte } from '@/app/_ui/ReportarASoporte';
import { NOMBRE_TIPO, hostDeLanding, type OutlierLanding, type PortadaLandings, type TipoLanding } from '@/lib/landing-outliers';
import { RUTA_PANEL, duracionDelScroll, filtrarOutliers, linkEscrito, rutaReplicarLanding } from './portada-reglas';
import s from '@/app/image-editor/carruseles/explorar.module.css';
import o from '@/app/video-editor/outliers.module.css';
import l from './outliers-landings.module.css';
import { usePortadaCrear } from '@/app/_crear/portada-ctx';

const inicial = (n: string) => Array.from(n.trim())[0]?.toUpperCase() ?? '·';

const Lupa = () => (
  <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" aria-hidden><circle cx="11" cy="11" r="7" /><path d="m20 20-3.5-3.5" /></svg>
);

function Tarjeta({ x, telefono }: { x: OutlierLanding; telefono: boolean }) {
  // Una captura que no carga se saca: queda el marco de espera, no el ícono de imagen rota (13/11/2026, en el banco).
  const [rota, setRota] = useState(false);
  return (
    <li className={s.tarjeta}>
      {/* La landing ENTERA (su captura larga) en una tarjeta grande: al pasar el cursor baja sola de arriba a abajo (11/11/2026,
          Martín: «La tarjeta de una web tiene que ser mucho más grande, y si paso el cursor por arriba poder scrollearla, sin romper
          la eficiencia de la página»). La imagen carga recién cuando la tarjeta se acerca a la pantalla, y el scroll es un
          `transform`, que no vuelve a dibujar la página. */}
      <a href={x.url} target="_blank" rel="noopener noreferrer" className={`${s.mini} ${l.mini}`} aria-label={`Ver la página de ${x.quien.nombre}`}
        style={{ ['--dur' as string]: `${duracionDelScroll(x.alto)}s` }}>
        {/* Mientras llega la captura larga (o si no carga), el marco con el color de su tipo y el dominio de la página: nunca una caja
            gris vacía (13/11/2026, el Cerebro con la captura de producción, donde la VSL y el lead magnet salían grises mientras
            cargaban). La captura se dibuja encima. */}
        <span className={l.espera} data-tipo={x.tipo} aria-hidden><b>{hostDeLanding(x.url)}</b></span>
        {x.imagen && !rota && (
          // eslint-disable-next-line @next/next/no-img-element
          <img src={x.imagen} alt="" className={l.larga} width={640} height={x.alto ?? undefined} loading="lazy" decoding="async" onError={() => setRota(true)} />
        )}
        <span className={o.marca}>{NOMBRE_TIPO[x.tipo]}</span>
      </a>
      <div className={s.pie}>
        <div className={s.fila1}>
          <a href={x.url} target="_blank" rel="noopener noreferrer" className={s.gancho}>{x.titulo}</a>
        </div>
        <div className={s.creador}>
          <span className={s.cara} aria-hidden>{inicial(x.quien.nombre)}</span>
          {x.quien.competidorId != null ? (
            <Link href={`/competitor-spy?competidor=${x.quien.competidorId}`} className={s.quien} title={`Ver a ${x.quien.nombre} en Competitors Spy`}>{x.quien.nombre}</Link>
          ) : <span className={s.quien}>{x.quien.nombre}</span>}
          {x.quien.nicho ? <span className={s.cuando}>{x.quien.nicho}</span> : x.fuente === 'spy' ? <span className={s.cuando}>Tu competencia</span> : null}
        </div>
        {x.porque ? <p className={o.porque}>{x.porque}</p> : null}
        <div className={o.acciones}>
          {/* Replicar es del editor de la computadora: en el teléfono, sólo el original. */}
          {!telefono && <Link href={rutaReplicarLanding(x.url)} className={o.replicar}>Replicar</Link>}
          <a href={x.url} target="_blank" rel="noopener noreferrer" className={s.pastilla}>Ver el original</a>
        </div>
      </div>
    </li>
  );
}

/**
 * `rutaCrear`: en el teléfono, la lista de landings de /m/landing (su ruta no lleva la query de la computadora), como Video.
 * `plantillas`: las plantillas de la tab, AL LADO de los outliers (memoria «Create: orden y outliers», 11/11/2026): van arriba,
 * en una fila (./PlantillasPortada.tsx). En el teléfono no: crear es de la computadora.
 */
export function OutliersLandings({ portada, telefono = false, rutaCrear = RUTA_PANEL, plantillas }: {
  portada: PortadaLandings; telefono?: boolean; rutaCrear?: string; plantillas?: ReactNode;
}) {
  const pantalla = usePortadaCrear();
  const [q, setQ] = useState('');
  const [tipo, setTipo] = useState<TipoLanding | null>(null);
  const total = portada.outliers.length;
  // Los tipos que hay, en el orden de la grilla: un filtro que da cero no se ofrece.
  const tipos = useMemo(() => [...new Set(portada.outliers.map((x) => x.tipo))], [portada.outliers]);
  const vistas = useMemo(() => filtrarOutliers(portada.outliers, q, tipo), [portada.outliers, q, tipo]);
  const link = telefono ? null : linkEscrito(q);
  return (
    <div className={s.raiz} data-telefono={telefono ? 'si' : undefined}>
      <div className={s.col}>
        <header className={s.cabeza}>
          <h1>Encuentra tu siguiente <mark>OUTLIER</mark></h1>
          <div className={s.botones}>
            <Link href="/competitor-spy" className={s.pastilla}>+ Seguir cuentas</Link>
            {/* La portada va sin el chat (12/11/2026): tus landings se abren a la izquierda. */}
            {pantalla ? <button type="button" className={s.pastilla} onClick={pantalla.verProyectos}>Mis landings</button> : null}
            {/* En el teléfono no se crea una landing (es de la computadora: la lista lo dice): el botón lleva a las tuyas. */}
            <Link href={rutaCrear} className={telefono ? s.pastilla : s.nuevo}>{telefono ? 'Tus landings' : <><span aria-hidden>＋</span> Nueva landing</>}</Link>
          </div>
          {total > 0 && (
            <label className={s.busca}>
              <Lupa />
              <input type="search" value={q} onChange={(e) => setQ(e.target.value)} enterKeyHint="search"
                placeholder={telefono ? 'Busca una página' : 'Busca páginas, nichos o marcas, o pega el link de una para replicarla'}
                aria-label="Buscar páginas por titular, nicho o marca, o pegar el link de una página para replicarla" />
            </label>
          )}
          {tipos.length > 1 && (
            <div className={`${s.filtros} ${l.filtros}`} role="group" aria-label="Tipo de página">
              <button type="button" className={s.chip} aria-pressed={tipo === null} onClick={() => setTipo(null)}>Todas</button>
              {tipos.map((t) => (
                <button key={t} type="button" className={s.chip} aria-pressed={tipo === t} onClick={() => setTipo(tipo === t ? null : t)}>{NOMBRE_TIPO[t]}</button>
              ))}
            </div>
          )}
        </header>
        {portada.caidas.map((c) => (
          <div key={c.fuente} role="alert" className={o.caida}>
            <span>No pude leer {c.nombre}: {c.motivo}</span>
            <ReportarASoporte />
          </div>
        ))}
        {link && (
          <div className={o.caida} role="status">
            <span>¿Replicar {hostDeLanding(link)}?</span>
            <Link href={rutaReplicarLanding(link)} className={o.replicar}>Replicar esta página</Link>
          </div>
        )}
        {!q && !tipo && plantillas}
        {/* Sin la frase de totales («52 páginas que venden · las 2 de tu competencia primero · 2 esperan su captura»): era texto que
            explica la pantalla (13/11/2026, el Cerebro con la captura de producción; Martín, 12/11: fuera los textos que explican). */}
        {vistas.length > 0 ? (
          // En el teléfono, de a una: una página apaisada en dos columnas medía 180px y no se leía (11/11/2026). Es la grilla
          // ancha de Image (la de las miniaturas de YouTube), que en el teléfono va de a una.
          <ul className={`${s.grilla} ${l.grilla}${telefono ? ` ${s.grillaAncha}` : ''}`}>
            {vistas.map((x) => <Tarjeta key={x.id} x={x} telefono={telefono} />)}
          </ul>
        ) : total > 0 ? (
          <div className={s.vacio}>
            <p>Ninguna página coincide con «{q || NOMBRE_TIPO[tipo ?? 'sitio']}».</p>
            <button type="button" className={s.boton} onClick={() => { setQ(''); setTipo(null); }}>Ver todas</button>
          </div>
        ) : (
          <div className={s.vacio}>
            <p>Sigue en Competitors Spy a tu competencia y aquí aparecen sus páginas, para replicar la que te sirva.</p>
            <Link href="/competitor-spy" className={s.boton}>Abrir Competitors Spy</Link>
          </div>
        )}
      </div>
    </div>
  );
}
