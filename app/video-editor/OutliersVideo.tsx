// =============================================================================
// La portada de la tab Video: «Encuentra tu siguiente OUTLIER» (9/11/2026)
// =============================================================================
// Martín, 9/11/2026: «Tal como en imágenes, que se llame Video… vas a ver tus outliers primero». COPIADA de la portada de Image
// (app/image-editor/carruseles/ExplorarCarruseles.tsx, que copia a Top Carousels): el mismo encabezado con su «OUTLIER»
// marcado, las pastillas y «Crear desde cero», con SUS clases (explorar.module.css): una portada, un diseño.
//
// 11/11/2026, Martín con la captura: UNA tarjeta (la plantilla), sin imagen, «Dis…», «Creden…» y «Sin datos de su cuenta».
//   · los reels de las cuentas que el negocio sigue en Spy (lib/video-outliers-servidor.ts → FUENTE_SPY), con la tarjeta de
//     Image (`TarjetaCarrusel`): la miniatura que guardó Spy, el «×» con su color, el gancho, la cuenta con su foto, hace cuánto
//     y los números. Tocarla abre el original (no se republica);
//   · la plantilla de MaKo dice «MaKo te guía» (como su tarjeta en «Crear desde cero»), no un motivo de por qué no hay número, y
//     su estructura va en bandas que se leen enteras;
//   · «+ Seguir cuentas», como en Image: sin cuentas en Spy, la portada dice cómo llenarla.
// Sin la imagen de un tercero que no guardamos nosotros: la plantilla dibuja la ESTRUCTURA. Las fuentes que no se pudieron leer
// se dicen.
// =============================================================================

import Link from '@/app/_ui/Link';
import { ReportarASoporte } from '@/app/_ui/ReportarASoporte';
import { explicarMultiplo } from '@/lib/multiplo-rendimiento';
import { contadorCorto, nivelDeMultiplo, rotuloOutlier } from '@/lib/carruseles/explorar';
import { plantillaGuiada } from '@/lib/video-plantillas';
import type { OutlierVideo, PortadaOutliers } from '@/lib/video-outliers';
import s from '@/app/image-editor/carruseles/explorar.module.css';
import o from './outliers.module.css';
import { RUTA_CREAR_VIDEO, rutaReplicar } from './vista';

const RED: Record<OutlierVideo['red'], string> = { instagram: 'Instagram', tiktok: 'TikTok', youtube: 'YouTube', 'meta-ads': 'Anuncio de Meta' };

/** «hace 3 días»: lo mismo que la tarjeta de Image. */
function haceCuanto(iso: string | null | undefined, ahora: number): string {
  const t = Date.parse(iso ?? '');
  if (!Number.isFinite(t)) return '';
  const d = Math.max(0, Math.floor((ahora - t) / 86_400_000));
  if (d === 0) return 'hoy';
  if (d === 1) return 'ayer';
  if (d < 30) return `hace ${d} días`;
  const m = Math.floor(d / 30);
  return m < 12 ? `hace ${m} ${m === 1 ? 'mes' : 'meses'}` : `hace ${Math.floor(m / 12)} ${m < 24 ? 'año' : 'años'}`;
}

const inicial = (n: string) => Array.from(n.trim())[0]?.toUpperCase() ?? '·';

/** La estructura de la plantilla que lo replica: una banda por bloque, del alto de su tiempo, con su nombre entero. */
function Estructura({ plantilla }: { plantilla: string | null }) {
  const p = plantillaGuiada(plantilla);
  if (!p) return <div className={o.estructura} aria-hidden />;
  return (
    <div className={o.estructura} role="img" aria-label={`${p.bloques.length} bloques en ${p.duracionS} s`}>
      {p.bloques.map((b) => (
        <span key={b.id} className={o.tramo} data-mudo={b.mudo ? 'si' : undefined} style={{ flexGrow: b.tiempo[1] - b.tiempo[0], flexBasis: 0 }}>
          <b>{b.nombre}</b>
          <small>{Math.round(b.tiempo[0])}–{Math.round(b.tiempo[1])} s</small>
        </span>
      ))}
    </div>
  );
}

/** La plantilla guiada de MaKo (la fuente curada): se replica con MaKo, paso a paso. */
function TarjetaPlantilla({ x, telefono }: { x: OutlierVideo; telefono: boolean }) {
  return (
    <li className={s.tarjeta}>
      <div className={`${s.mini} ${o.mini916}`}>
        <Estructura plantilla={x.plantilla} />
        <span className={o.marca}>MaKo te guía</span>
      </div>
      <div className={s.pie}>
        <div className={s.fila1}><span className={s.gancho}>{x.titulo}</span></div>
        <p className={o.porque}>{x.porque}</p>
        <p className={o.basada}>Basada en un reel de {x.creador.usuario ? `@${x.creador.usuario}` : x.creador.nombre} en {RED[x.red]}</p>
        <div className={o.acciones}>
          {/* El armado guiado es del editor de la computadora: en el teléfono, sólo el original. */}
          {x.plantilla && !telefono && <Link href={rutaReplicar(x.plantilla)} className={o.replicar}>Replicar</Link>}
          <a href={x.url} target="_blank" rel="noopener noreferrer" className={s.pastilla}>Ver el original</a>
        </div>
      </div>
    </li>
  );
}

/** Un reel de una cuenta que el negocio sigue: la tarjeta de Image (`TarjetaCarrusel`), en 9:16. */
function TarjetaReel({ x, ahora }: { x: OutlierVideo; ahora: number }) {
  const veces = x.multiplo?.veces ?? null;
  const nivel = nivelDeMultiplo(veces);
  const quien = x.creador.usuario ? `@${x.creador.usuario}` : x.creador.nombre;
  const cuando = haceCuanto(x.publicada, ahora);
  return (
    <li className={s.tarjeta}>
      <a href={x.url} target="_blank" rel="noopener noreferrer" className={`${s.mini} ${o.mini916}`} aria-label={`Ver el reel de ${quien} en ${RED[x.red]}`}>
        {x.miniatura
          // eslint-disable-next-line @next/next/no-img-element
          ? <img src={x.miniatura} alt="" className={s.miniImagen} loading="lazy" referrerPolicy="no-referrer" />
          : null}
        <span className={o.play} aria-hidden>▶</span>
      </a>
      <div className={s.pie}>
        <div className={s.fila1}>
          {veces != null && nivel ? (
            <span className={s.mult} data-nivel={nivel} title={explicarMultiplo(x.multiplo)}>{rotuloOutlier(veces)}</span>
          ) : null}
          <a href={x.url} target="_blank" rel="noopener noreferrer" className={s.gancho}>{x.titulo}</a>
        </div>
        <div className={s.creador}>
          {x.creador.foto
            // eslint-disable-next-line @next/next/no-img-element
            ? <img src={x.creador.foto} alt="" className={s.cara} referrerPolicy="no-referrer" />
            : <span className={s.cara} aria-hidden>{inicial(x.creador.nombre)}</span>}
          {x.creador.competidorId != null ? (
            <Link href={`/competitor-spy?competidor=${x.creador.competidorId}`} className={s.quien} title={`Ver el análisis de ${x.creador.nombre} en Competitors Spy`}>{quien}</Link>
          ) : <span className={s.quien}>{quien}</span>}
          {cuando ? <span className={s.cuando}>{cuando}</span> : null}
        </div>
        <div className={s.datos}>
          {/* Sin el dato, nada: «▶ —» en un reel que Spy no midió se leía como roto (producción, 11/11/2026). */}
          {x.vistas != null ? <span title="Vistas">▶ {contadorCorto(x.vistas)}</span> : null}
          {x.megusta != null ? <span title="Me gusta">♥ {contadorCorto(x.megusta)}</span> : null}
          {x.comentarios != null ? <span title="Comentarios">💬 {contadorCorto(x.comentarios)}</span> : null}
        </div>
      </div>
    </li>
  );
}

/**
 * La portada. `telefono`: la de MaKo Mobile (app/m/video-editor), con las reglas de teléfono de Image (dos columnas, la
 * cabecera más chica); `rutaCrear`: a dónde lleva «Crear desde cero» (en el teléfono, su «Nuevo video» y sus proyectos).
 */
export function OutliersVideo({ portada, telefono = false, rutaCrear = RUTA_CREAR_VIDEO }: { portada: PortadaOutliers; telefono?: boolean; rutaCrear?: string }) {
  const ahora = Date.now();
  const reels = portada.outliers.filter((x) => !x.plantilla);
  return (
    <div className={s.raiz} data-telefono={telefono ? 'si' : undefined}>
      <div className={s.col}>
        <header className={s.cabeza}>
          <h1>Encuentra tu siguiente <mark>OUTLIER</mark></h1>
          <div className={s.botones}>
            <Link href="/competitor-spy" className={s.pastilla}>+ Seguir cuentas</Link>
            <Link href={rutaCrear} className={s.crear}><span aria-hidden>＋</span> Crear desde cero</Link>
          </div>
        </header>
        {portada.caidas.map((c) => (
          <div key={c.fuente} role="alert" className={o.caida}>
            <span>No pude leer {c.nombre}: {c.motivo}</span>
            <ReportarASoporte />
          </div>
        ))}
        {/* Fuera de `s.filtros`: en el teléfono esa fila no salta de renglón, y la frase se cortaba. */}
        {reels.length > 0 && (
          <p className={o.total}>{reels.length} {reels.length === 1 ? 'reel' : 'reels'} de las cuentas que sigues · los que más superaron a su cuenta primero</p>
        )}
        {portada.outliers.length > 0 ? (
          <ul className={`${s.grilla} ${o.grillaReels}`}>
            {portada.outliers.map((x) => (x.plantilla ? <TarjetaPlantilla key={x.id} x={x} telefono={telefono} /> : <TarjetaReel key={x.id} x={x} ahora={ahora} />))}
          </ul>
        ) : null}
        {reels.length === 0 && (
          <div className={s.vacio}>
            <p>Sigue en Competitors Spy las cuentas de tu nicho y aquí aparecen sus reels que mejor funcionan, para copiar el que te sirva.</p>
            <Link href="/competitor-spy" className={s.boton}>Abrir Competitors Spy</Link>
          </div>
        )}
      </div>
    </div>
  );
}
