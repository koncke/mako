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
//     y los números;
//   · «+ Seguir cuentas», como en Image: sin cuentas en Spy, la portada dice cómo llenarla.
//
// 11/11/2026 (tarde), Martín: «el único video que sí tenemos bien construido ni siquiera se ve la miniatura… los videos ni
// siquiera se pueden reproducir ahí mismo… no debería tener reels random al azar: lo que queremos es replicar patrones de
// edición». Por eso:
//   · la plantilla de MaKo lleva la portada REAL del reel en que se basa (el de los pistachos) y se ve como las demás;
//   · tocar una miniatura reproduce el reel ADENTRO de MaKo (./VerReel.tsx, el reproductor oficial de su red), con lo que enseña;
//   · llegan sólo los reels con un patrón de EDICIÓN (lib/video-outliers-criterio.ts), por cuánto superaron a su cuenta, con su
//     familia y un filtro por familia; la portada dice cuántos se midieron y cuántos quedaron.
// =============================================================================

import Link from '@/app/_ui/Link';
import { ReportarASoporte } from '@/app/_ui/ReportarASoporte';
import { explicarMultiplo } from '@/lib/multiplo-rendimiento';
import { contadorCorto, nivelDeMultiplo, rotuloOutlier } from '@/lib/carruseles/explorar';
import { plantillaGuiada } from '@/lib/video-plantillas';
import { recetaDe, type Receta } from '@/lib/video-recetas';
import { FAMILIAS_EDICION, embedDeReel, type FamiliaEdicion, type OutlierVideo, type PortadaOutliers } from '@/lib/video-outliers';
import s from '@/app/image-editor/carruseles/explorar.module.css';
import o from './outliers.module.css';
import { VerReel } from './VerReel';
import { RUTA_CREAR_VIDEO, rutaReplicar, rutaReplicarReceta } from './vista';

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
const quienDe = (x: OutlierVideo) => (x.creador.usuario ? `@${x.creador.usuario}` : x.creador.nombre);

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

/** La miniatura de una tarjeta: la imagen, o nada (la caja queda del color de la tarjeta), y el ▶. */
function Miniatura({ src, marca }: { src: string | null; marca?: string }) {
  return (
    <>
      {/* eslint-disable-next-line @next/next/no-img-element -- nuestro bucket o /public: sin referrer, como la tarjeta de Image */}
      {src ? <img src={src} alt="" className={s.miniImagen} loading="lazy" referrerPolicy="no-referrer" /> : null}
      {marca ? <span className={o.marca}>{marca}</span> : null}
      <span className={o.play} aria-hidden>▶</span>
    </>
  );
}

/** Cómo se hace un reel así: la receta de su patrón (lib/video-recetas.ts). */
function ComoSeHace({ r }: { r: Receta }) {
  return (
    <>
      <div className={o.verBloque}>
        <h3>Cómo se hace · {r.nombre}</h3>
        <p>{r.porque}</p>
      </div>
      <div className={o.verBloque}>
        <h3>Estructura ({r.duracionS} s)</h3>
        <ol>{r.estructura.map((b) => <li key={b.nombre}><b>{b.nombre}</b> ({b.desde}–{b.hasta} s): {b.que}</li>)}</ol>
      </div>
      <div className={o.verBloque}>
        <h3>La edición, en el editor de MaKo</h3>
        <ol>{r.edicion.map((p) => <li key={p}>{p}</li>)}</ol>
      </div>
      <div className={o.verBloque}>
        <h3>Grabarlo con tu avatar de IA</h3>
        <ol>{r.grabacion.avatar.map((p) => <li key={p}>{p}</li>)}</ol>
      </div>
      <div className={o.verBloque}>
        <h3>Si lo graba otra persona</h3>
        <ol>{r.grabacion.persona.map((p) => <li key={p}>{p}</li>)}</ol>
      </div>
    </>
  );
}

/** La plantilla guiada de MaKo (la fuente curada): se replica con MaKo, paso a paso. También la usa la sección del editor. */
export function TarjetaPlantilla({ x, telefono }: { x: OutlierVideo; telefono: boolean }) {
  const replicar = x.plantilla && !telefono ? <Link href={rutaReplicar(x.plantilla)} className={o.replicar}>Replicar</Link> : null;
  return (
    <li className={s.tarjeta}>
      <VerReel
        embed={embedDeReel(x)}
        url={x.url}
        titulo={x.titulo}
        red={RED[x.red]}
        clase={`${s.mini} ${o.mini916}`}
        etiqueta={`Ver el reel de ${quienDe(x)} en que se basa «${x.titulo}»`}
        pie={replicar}
        detalle={(
          <>
            <div className={o.verBloque}>
              <h3>MaKo te guía</h3>
              <p>{x.porque}</p>
              <p className={o.verNota}>Basada en un reel de {quienDe(x)} en {RED[x.red]}. MaKo te lleva paso a paso: tu guion en sus bloques, tu personaje, tu voz y el montaje con su ritmo.</p>
            </div>
            <div className={o.verBloque}>
              <h3>Su estructura</h3>
              <div className={o.estructuraCaja}><Estructura plantilla={x.plantilla} /></div>
            </div>
          </>
        )}
      >
        <Miniatura src={x.miniatura} marca="MaKo te guía" />
      </VerReel>
      <div className={s.pie}>
        <div className={s.fila1}><span className={s.gancho}>{x.titulo}</span></div>
        <p className={o.porque}>{x.porque}</p>
        <p className={o.basada}>Basada en un reel de {quienDe(x)} en {RED[x.red]}</p>
        {/* El armado guiado es del editor de la computadora: en el teléfono, se mira el video. */}
        {replicar ? <div className={o.acciones}>{replicar}</div> : null}
      </div>
    </li>
  );
}

/** Un reel de una cuenta que el negocio sigue: la tarjeta de Image (`TarjetaCarrusel`), en 9:16, con lo que enseña. También la usa la sección del editor. */
export function TarjetaReel({ x, ahora, telefono = false }: { x: OutlierVideo; ahora: number; telefono?: boolean }) {
  const veces = x.multiplo?.veces ?? null;
  const nivel = nivelDeMultiplo(veces);
  const quien = quienDe(x);
  const cuando = haceCuanto(x.publicada, ahora);
  const familia = x.edicion ? FAMILIAS_EDICION[x.edicion.familia] : null;
  const receta = recetaDe(x.receta);
  const datos = (
    <div className={s.datos}>
      {/* Sin el dato, nada: «▶ —» en un reel que Spy no midió se leía como roto (producción, 11/11/2026). */}
      {x.vistas != null ? <span title="Vistas">▶ {contadorCorto(x.vistas)}</span> : null}
      {x.megusta != null ? <span title="Me gusta">♥ {contadorCorto(x.megusta)}</span> : null}
      {x.comentarios != null ? <span title="Comentarios">💬 {contadorCorto(x.comentarios)}</span> : null}
    </div>
  );
  return (
    <li className={s.tarjeta}>
      <VerReel
        embed={embedDeReel(x)}
        url={x.url}
        titulo={x.titulo}
        red={RED[x.red]}
        clase={`${s.mini} ${o.mini916}`}
        etiqueta={`Ver el reel de ${quien}`}
        // «Replicar» de su receta: arma el proyecto y MaKo la dice en el chat (./VideoEditorCliente.tsx). En el teléfono no hay editor.
        pie={receta && !telefono ? <Link href={rutaReplicarReceta(receta.id)} className={o.replicar}>Replicar</Link> : undefined}
        detalle={(
          <>
            <div className={o.verBloque}>
              <div className={s.creador}>
                {x.creador.foto
                  // eslint-disable-next-line @next/next/no-img-element
                  ? <img src={x.creador.foto} alt="" className={s.cara} referrerPolicy="no-referrer" />
                  : <span className={s.cara} aria-hidden>{inicial(x.creador.nombre)}</span>}
                <span className={s.quien}>{quien}</span>
                {cuando ? <span className={s.cuando}>{cuando}</span> : null}
              </div>
              {veces != null && nivel ? <p><span className={s.mult} data-nivel={nivel}>{rotuloOutlier(veces)}</span> {explicarMultiplo(x.multiplo)}</p> : null}
              {datos}
            </div>
            {x.edicion ? (
              <div className={o.verBloque}>
                <h3>Qué enseña de edición</h3>
                {familia ? <span className={o.familia}>{familia}</span> : null}
                <p><b>{x.edicion.patron}</b>. {x.edicion.motivo}</p>
                {x.edicion.base === 'portada' ? <p className={o.verNota}>Lo vi en su portada y su texto; los cortes y el ritmo se confirman mirando el video.</p> : null}
              </div>
            ) : null}
            {receta ? <ComoSeHace r={receta} /> : null}
          </>
        )}
      >
        <Miniatura src={x.miniatura} />
      </VerReel>
      <div className={s.pie}>
        <div className={s.fila1}>
          {veces != null && nivel ? (
            <span className={s.mult} data-nivel={nivel} title={explicarMultiplo(x.multiplo)}>{rotuloOutlier(veces)}</span>
          ) : null}
          <span className={s.gancho}>{x.titulo}</span>
        </div>
        {familia ? <span className={o.familia}>{familia}</span> : null}
        {x.edicion ? <p className={o.patronLinea}>{x.edicion.patron}</p> : null}
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
        {datos}
      </div>
    </li>
  );
}

/** Las familias que hay en la portada, con cuántos reels tiene cada una (de más a menos). */
function familiasPresentes(xs: readonly OutlierVideo[]): Array<[FamiliaEdicion, number]> {
  const n = new Map<FamiliaEdicion, number>();
  for (const x of xs) if (x.edicion) n.set(x.edicion.familia, (n.get(x.edicion.familia) ?? 0) + 1);
  return [...n].sort((a, b) => b[1] - a[1]);
}

/**
 * La portada. `telefono`: la de MaKo Mobile (app/m/video-editor), con las reglas de teléfono de Image (dos columnas, la
 * cabecera más chica); `rutaCrear`: a dónde lleva «Crear desde cero» (en el teléfono, su «Nuevo video» y sus proyectos);
 * `rutaPortada`: la de esta portada, para el filtro por familia (`?patron=`); `familia`: la elegida (ya validada).
 */
export function OutliersVideo({
  portada, telefono = false, rutaCrear = RUTA_CREAR_VIDEO, rutaPortada = '/video-editor?ver=outliers', familia = null,
}: { portada: PortadaOutliers; telefono?: boolean; rutaCrear?: string; rutaPortada?: string; familia?: FamiliaEdicion | null }) {
  const ahora = Date.now();
  const reels = portada.outliers.filter((x) => !x.plantilla);
  const familias = familiasPresentes(reels);
  const visibles = familia ? portada.outliers.filter((x) => x.edicion?.familia === familia) : portada.outliers;
  const r = portada.resumen;
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
        {r && r.medidos > 0 ? (
          <p className={o.total}>
            {r.medidos} reels medidos de las cuentas que sigues · {r.conPatron} enseñan un patrón de edición · los que más superaron a su cuenta primero
            {r.debajo + r.descartados + r.dudosos + r.sinMirar > 0 ? (
              <span className={o.basada}>
                {' '}· Fuera: {[
                  r.debajo ? `${r.debajo} con un patrón que no superaron a su cuenta` : null,
                  r.descartados ? `${r.descartados} que son sólo hablar a cámara o podcast` : null,
                  r.dudosos ? `${r.dudosos} que se deciden mirando el video` : null,
                  r.sinMirar ? `${r.sinMirar} que todavía no miré` : null,
                ].filter(Boolean).join(', ')}.
              </span>
            ) : null}
          </p>
        ) : reels.length > 0 ? (
          <p className={o.total}>{reels.length} {reels.length === 1 ? 'reel' : 'reels'} de las cuentas que sigues · los que más superaron a su cuenta primero</p>
        ) : null}
        {familias.length > 1 ? (
          <nav className={s.filtros} aria-label="Patrones de edición">
            <Link href={rutaPortada} className={`${s.chip} ${!familia ? o.chipActivo : ''}`} aria-current={!familia ? 'page' : undefined}>Todos</Link>
            {familias.map(([f, n]) => (
              <Link key={f} href={`${rutaPortada}&patron=${f}`} className={`${s.chip} ${familia === f ? o.chipActivo : ''}`} aria-current={familia === f ? 'page' : undefined}>{FAMILIAS_EDICION[f]} · {n}</Link>
            ))}
          </nav>
        ) : null}
        {visibles.length > 0 ? (
          <ul className={`${s.grilla} ${o.grillaReels}`}>
            {visibles.map((x) => (x.plantilla ? <TarjetaPlantilla key={x.id} x={x} telefono={telefono} /> : <TarjetaReel key={x.id} x={x} ahora={ahora} telefono={telefono} />))}
          </ul>
        ) : null}
        {reels.length === 0 && (
          <div className={s.vacio}>
            {r && r.medidos > 0
              ? <p>Miré los {r.medidos} reels de las cuentas que sigues y ninguno enseña un patrón de edición para copiar. Sigue en Competitors Spy cuentas que editen sus reels.</p>
              : <p>Sigue en Competitors Spy las cuentas de tu nicho y aquí aparecen sus reels que enseñan un patrón de edición, para copiar el que te sirva.</p>}
            <Link href="/competitor-spy" className={s.boton}>Abrir Competitors Spy</Link>
          </div>
        )}
      </div>
    </div>
  );
}
