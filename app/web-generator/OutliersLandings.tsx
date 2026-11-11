// =============================================================================
// La portada de Web Generator: «Encuentra tu siguiente OUTLIER» (11/11/2026)
// =============================================================================
// Martín, 11/11/2026 (por el Cerebro): «generar lo mismo que venimos haciendo con el resto de tabs, de outliers, para sacar
// outliers de páginas que estén buenas… empezar por la competencia… por las páginas de todos los gurús». COPIADA de la portada
// de Video (app/video-editor/OutliersVideo.tsx), que copia a Image (app/image-editor/carruseles/ExplorarCarruseles.tsx): el
// mismo encabezado con su «OUTLIER» marcado, «+ Seguir cuentas» y «Crear desde cero», la misma grilla y la misma tarjeta, con
// SUS clases (explorar.module.css y outliers.module.css): una portada, un diseño. Lo único propio (./outliers-landings.module.css):
// la miniatura apaisada de una página y el sitio dibujado con su nombre cuando no hay imagen.
//
// La tarjeta: la captura (o la imagen para compartir de la página), el tipo arriba («VSL», «Webinar»…), el titular tal cual, de
// quién es (con su ficha de Spy si es tu competencia), por qué funciona, «Replicar» (Replicar arrancando con esa página,
// panel-reglas.ts) y «Ver el original». Los datos y sus reglas: lib/landing-outliers.ts.
// =============================================================================

import Link from '@/app/_ui/Link';
import { ReportarASoporte } from '@/app/_ui/ReportarASoporte';
import { NOMBRE_TIPO, hostDeLanding, type OutlierLanding, type PortadaLandings } from '@/lib/landing-outliers';
import s from '@/app/image-editor/carruseles/explorar.module.css';
import o from '@/app/video-editor/outliers.module.css';
import l from './outliers-landings.module.css';

/** «Crear desde cero»: el Panel con «¿Qué vas a crear hoy?» y la lista de tus landings. */
export const RUTA_CREAR_LANDING = '/web-generator?panel=1';
/** «Replicar»: Replicar arrancando con esa página (el mismo link que «Copiar su sitio» de Spy). */
export const rutaReplicarLanding = (url: string): string => `/web-generator?replicar=${encodeURIComponent(url)}`;

const inicial = (n: string) => Array.from(n.trim())[0]?.toUpperCase() ?? '·';

function Tarjeta({ x, telefono }: { x: OutlierLanding; telefono: boolean }) {
  const host = hostDeLanding(x.url);
  return (
    <li className={s.tarjeta}>
      <a href={x.url} target="_blank" rel="noopener noreferrer" className={`${s.mini} ${l.mini}`} aria-label={`Ver la página de ${x.quien.nombre}`}>
        {x.imagen
          // eslint-disable-next-line @next/next/no-img-element
          ? <img src={x.imagen} alt="" className={`${s.miniImagen} ${l.arriba}`} loading="lazy" referrerPolicy="no-referrer" />
          : <span className={l.sitio}><b>{host}</b></span>}
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

export function OutliersLandings({ portada, telefono = false }: { portada: PortadaLandings; telefono?: boolean }) {
  const deSpy = portada.outliers.filter((x) => x.fuente === 'spy').length;
  const total = portada.outliers.length;
  return (
    <div className={s.raiz} data-telefono={telefono ? 'si' : undefined}>
      <div className={s.col}>
        <header className={s.cabeza}>
          <h1>Encuentra tu siguiente <mark>OUTLIER</mark></h1>
          <div className={s.botones}>
            <Link href="/competitor-spy" className={s.pastilla}>+ Seguir cuentas</Link>
            <Link href={RUTA_CREAR_LANDING} className={s.crear}><span aria-hidden>＋</span> Crear desde cero</Link>
          </div>
        </header>
        {portada.caidas.map((c) => (
          <div key={c.fuente} role="alert" className={o.caida}>
            <span>No pude leer {c.nombre}: {c.motivo}</span>
            <ReportarASoporte />
          </div>
        ))}
        {total > 0 && (
          <p className={o.total}>
            {total} {total === 1 ? 'página' : 'páginas'} que venden
            {deSpy > 0 ? ` · ${deSpy === 1 ? 'la de tu competencia primero' : `las ${deSpy} de tu competencia primero`}` : ''}
          </p>
        )}
        {total > 0 ? (
          <ul className={`${s.grilla} ${l.grilla}`}>
            {portada.outliers.map((x) => <Tarjeta key={x.id} x={x} telefono={telefono} />)}
          </ul>
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
