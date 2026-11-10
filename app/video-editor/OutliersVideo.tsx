// =============================================================================
// La portada de la tab Video: «Encuentra tu siguiente OUTLIER» (9/11/2026)
// =============================================================================
// Martín, 9/11/2026: «Tal como en imágenes, que se llame Video… vas a ver tus outliers primero». COPIADA de la portada de Image
// (app/image-editor/carruseles/ExplorarCarruseles.tsx, que copia a Top Carousels): el mismo encabezado con su «OUTLIER»
// marcado, las pastillas y «Crear desde cero», con SUS clases (explorar.module.css): una portada, un diseño.
//
// Cada tarjeta es un video que funciona (lib/video-outliers.ts): su creador, su número de outlier o por qué no lo hay, y
// «Replicar» cuando MaKo tiene la plantilla guiada que lo copia. Sin la imagen de un tercero (no se republica): la tarjeta
// dibuja la ESTRUCTURA de su plantilla (los bloques con sus tiempos). Las fuentes que no se pudieron leer se dicen.
// =============================================================================

import Link from '@/app/_ui/Link';
import { ReportarASoporte } from '@/app/_ui/ReportarASoporte';
import { rotuloCortoDeMultiplo, explicarMultiplo } from '@/lib/multiplo-rendimiento';
import { plantillaGuiada } from '@/lib/video-plantillas';
import type { OutlierVideo, PortadaOutliers } from '@/lib/video-outliers';
import s from '@/app/image-editor/carruseles/explorar.module.css';
import o from './outliers.module.css';
import { RUTA_CREAR_VIDEO, rutaReplicar } from './vista';

const RED: Record<OutlierVideo['red'], string> = { instagram: 'Instagram', tiktok: 'TikTok', youtube: 'YouTube', 'meta-ads': 'Anuncio de Meta' };

/** La estructura de la plantilla que lo replica: un tramo por bloque, del ancho de su tiempo. */
function Estructura({ plantilla }: { plantilla: string | null }) {
  const p = plantillaGuiada(plantilla);
  if (!p) return <div className={o.estructura} aria-hidden />;
  const total = p.bloques[p.bloques.length - 1].tiempo[1];
  return (
    <div className={o.estructura} role="img" aria-label={`${p.bloques.length} bloques en ${p.duracionS} s`}>
      {p.bloques.map((b) => (
        <span key={b.id} className={o.tramo} data-mudo={b.mudo ? 'si' : undefined} style={{ flexGrow: b.tiempo[1] - b.tiempo[0], flexBasis: 0 }}
          title={`${b.nombre}: ${b.tiempo[0]}–${b.tiempo[1]} s`}>
          <b>{b.nombre}</b>
          <small>{Math.round(b.tiempo[0])}–{Math.round(b.tiempo[1])} s</small>
        </span>
      ))}
      <span className={o.total}>{Math.round(total)} s</span>
    </div>
  );
}

function Tarjeta({ x }: { x: OutlierVideo }) {
  return (
    <li className={`${s.tarjeta} ${o.tarjeta}`}>
      <Estructura plantilla={x.plantilla} />
      <div className={o.cuerpo}>
        <div className={o.linea}>
          <span className={o.chip}>{RED[x.red]}</span>
          <span className={o.chip} title={explicarMultiplo(x.multiplo)}>{rotuloCortoDeMultiplo(x.multiplo)}</span>
        </div>
        <h2 className={o.titulo}>{x.titulo}</h2>
        <p className={o.porque}>{x.porque}</p>
        <p className={o.creador}>De {x.creador.nombre}{x.creador.usuario ? ` · @${x.creador.usuario}` : ''}</p>
        <div className={o.acciones}>
          {x.plantilla && <Link href={rutaReplicar(x.plantilla)} className={o.replicar}>Replicar</Link>}
          <a href={x.url} target="_blank" rel="noopener noreferrer" className={s.pastilla}>Ver el original</a>
        </div>
      </div>
    </li>
  );
}

export function OutliersVideo({ portada }: { portada: PortadaOutliers }) {
  return (
    <div className={s.raiz}>
      <div className={s.col}>
        <header className={s.cabeza}>
          <h1>Encuentra tu siguiente <mark>OUTLIER</mark></h1>
          <div className={s.botones}>
            <Link href={RUTA_CREAR_VIDEO} className={s.crear}><span aria-hidden>＋</span> Crear desde cero</Link>
          </div>
        </header>
        {portada.caidas.map((c) => (
          <div key={c.fuente} role="alert" className={o.caida}>
            <span>No pude leer {c.nombre}: {c.motivo}</span>
            <ReportarASoporte />
          </div>
        ))}
        {portada.outliers.length > 0 ? (
          <ul className={`${s.grilla} ${s.grillaAncha}`}>
            {portada.outliers.map((x) => <Tarjeta key={x.id} x={x} />)}
          </ul>
        ) : (
          <div className={s.vacio}>
            <p>Todavía no hay videos para copiar. Empieza con una plantilla.</p>
            <Link href={RUTA_CREAR_VIDEO} className={s.pastilla}>Crear desde cero</Link>
          </div>
        )}
      </div>
    </div>
  );
}
