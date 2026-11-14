'use client';

// =============================================================================
// AnunciosSpy — la pestaña «Anuncios» de la ficha de un competidor, como Spyder de Foreplay (14/11/2026)
// =============================================================================
// Martín (por el chat de Landings, 14/11): «darle mucha prioridad al tema de anuncios, que nosotros no le estamos dando casi
// nada». Lo que Spyder muestra de una marca, con lo que Spy ya guardó de cada anuncio (las cuentas están en
// lib/spy-anuncios-ficha.ts, con test):
//   · arriba, cuántos siguen activos y en qué formato, y a dónde mandan;
//   · «Tests creativos»: los anuncios lanzados el mismo día, y «Ganador» cuando de la tanda queda uno solo activo;
//   · la línea de tiempo: una barra por anuncio con los días que corrió (verde si sigue, gris si terminó).
//
// ⚠️ NO REPITE LA GRILLA. Martín, 4/11: las pestañas de antes «partían lo mismo en seis lugares», y los anuncios quedaron en
// «Contenido», igual que el resto. Acá no hay otra grilla de anuncios: está lo que la grilla no dice (cuánto corrió cada uno, qué
// se lanzó junto y qué quedó vivo). Cada miniatura abre el mismo detalle de siempre.
// ⚠️ ES DE LA COMPUTADORA Y DEL TELÉFONO: trae su propia hoja (`spya-`), con las variables del tema y sus valores por defecto,
// porque en /m no está la hoja de SpyApp.
// =============================================================================

import { useMemo, useState } from 'react';
import type { Pieza } from '@/lib/spy';
import { fechaCorta, haceCuanto, miniaturaDePieza } from '@/lib/spy-vista';
import {
  VENTANAS, diasAlAire, frescuraDeAnuncios, landingsDeAnuncios, lineaDeTiempo, mezclaDeFormatos, sigueActivo, tandasDeAnuncios,
} from '@/lib/spy-anuncios-ficha';
import type { Medio } from '@/lib/spy-medio';

/** Lo que la pestaña lee de cada anuncio. */
export type AnuncioVista = Pick<Pieza, 'id' | 'canal' | 'ref' | 'miniatura' | 'titulo' | 'texto' | 'publicada_en' | 'visto_primera_vez'
  | 'visto_ultima_vez' | 'dejo_de_verse_en' | 'dominio_destino' | 'medio'>;

/** El color de cada formato: el mismo en el segmento de la barra y en el punto de su fila. */
const COLOR_MEDIO: Record<Medio, string> = { video: 'var(--s3,#4b6fa3)', imagen: 'var(--s2,#c0643c)', carrusel: 'var(--s4,#c4952c)' };

/** Cuántas tandas y cuántas filas de la línea de tiempo se ven antes de «Ver más». */
const TANDAS_VISIBLES = 4;
const FILAS_VISIBLES = 12;

const CSS = `
.spya{display:flex;flex-direction:column;gap:18px;min-width:0}
.spya h3{margin:0 0 14px;font-size:var(--fs-card,16px);font-weight:600;line-height:1.25;color:var(--ink)}
.spya-frescura{display:flex;flex-wrap:wrap;gap:8px}
.spya-frescura span{display:inline-flex;align-items:center;height:30px;padding:0 12px;border-radius:99px;background:var(--surface);
  box-shadow:inset 0 0 0 1px var(--border);color:var(--dim);font-size:var(--fs-sm,13px);font-weight:600}
.spya-cajas{display:grid;grid-template-columns:repeat(2,minmax(0,1fr));align-items:start;gap:var(--gap,18px)}
.spya-heroe{display:flex;align-items:baseline;flex-wrap:wrap;gap:8px}
.spya-heroe strong{font-size:44px;font-weight:700;line-height:1;letter-spacing:-.02em;font-variant-numeric:tabular-nums}
.spya-heroe span{color:var(--dim)}
.spya-caja,.spya-seccion{min-width:0;padding:18px 20px 20px;border-radius:var(--r-lg,16px);background:var(--surface);
  box-shadow:inset 0 0 0 1px var(--border)}
.spya-barra{display:flex;gap:3px;height:12px;margin-bottom:10px}
.spya-barra span{border-radius:4px;min-width:6px}
.spya-filas{display:flex;flex-direction:column;margin:0;padding:0;list-style:none}
.spya-filas li{position:relative;display:flex;align-items:center;gap:10px;min-height:36px}
.spya-filas i{width:10px;height:10px;border-radius:50%;flex:0 0 auto}
.spya-filas b{flex:1;min-width:0;font-weight:600;overflow:hidden;text-overflow:ellipsis;white-space:nowrap}
.spya-filas span{flex:0 0 auto;font-weight:600;color:var(--dim);font-variant-numeric:tabular-nums}
.spya-filas--destinos li{min-height:44px;padding-bottom:6px}
.spya-filas--destinos em{position:absolute;left:0;bottom:4px;height:4px;border-radius:2px;background:var(--s3,#4b6fa3);opacity:.75}
.spya-tandas{display:flex;flex-direction:column;gap:8px;margin:0;padding:0;list-style:none}
.spya-tanda{display:flex;align-items:center;gap:12px;width:100%;min-height:48px;padding:0 14px;border:0;border-radius:12px;
  background:var(--surface-2);color:var(--ink);font:inherit;text-align:left;cursor:pointer}
.spya-tanda b{flex:0 0 auto;font-weight:700}
.spya-tanda>span{flex:1;min-width:0;color:var(--dim);font-weight:500}
.spya-tanda svg{flex:0 0 auto;color:var(--dim);transition:transform .2s ease}
.spya-tanda[aria-expanded=true] svg{transform:rotate(180deg)}
.spya-ganador{flex:0 0 auto;display:inline-flex;align-items:center;height:26px;padding:0 10px;border-radius:99px;
  background:var(--good,#1f9d55);color:#fff;font-size:13px;font-weight:700}
.spya-tira{display:grid;grid-template-columns:repeat(auto-fill,minmax(112px,1fr));gap:10px;padding:12px 2px 4px}
.spya-mini{position:relative;display:block;aspect-ratio:4/5;padding:0;border:0;border-radius:12px;overflow:hidden;
  background:var(--surface-2);box-shadow:inset 0 0 0 1px var(--border);cursor:pointer}
.spya-mini[data-ganador]{box-shadow:0 0 0 2px var(--good,#1f9d55)}
.spya-mini img{display:block;width:100%;height:100%;object-fit:cover}
.spya-mini-texto{position:absolute;inset:0;padding:10px;overflow:hidden;color:var(--dim);font-size:13px;line-height:1.3;text-align:left}
.spya-dias{position:absolute;left:8px;bottom:8px;display:inline-flex;align-items:center;height:24px;padding:0 9px;border-radius:99px;
  background:rgba(18,21,27,.74);color:#fff;font-size:13px;font-weight:700;font-variant-numeric:tabular-nums}
.spya-dias[data-activo='si']{background:var(--good,#1f9d55)}
.spya-titulo{display:flex;align-items:center;justify-content:space-between;flex-wrap:wrap;gap:12px;margin-bottom:14px}
.spya-titulo h3{margin:0}
.spya-ventanas{display:inline-flex;padding:3px;border-radius:99px;background:var(--surface-2);box-shadow:inset 0 0 0 1px var(--border)}
.spya-ventanas button{height:30px;padding:0 12px;border:0;border-radius:99px;background:transparent;color:var(--dim);font:inherit;
  font-size:var(--fs-sm,13px);font-weight:600;cursor:pointer}
.spya-ventanas button[aria-pressed=true]{background:var(--surface);color:var(--ink);box-shadow:inset 0 0 0 1px var(--border)}
.spya-gantt{display:flex;flex-direction:column;gap:6px;margin:0;padding:0;list-style:none}
.spya-gantt li,.spya-eje{display:grid;grid-template-columns:36px minmax(0,1fr) 56px;align-items:center;gap:10px}
.spya-cara{width:36px;height:36px;padding:0;border:0;border-radius:8px;overflow:hidden;background:var(--surface-2);
  box-shadow:inset 0 0 0 1px var(--border);cursor:pointer}
.spya-cara img{display:block;width:100%;height:100%;object-fit:cover}
.spya-pista{position:relative;height:14px;border-radius:7px;background:var(--surface-2)}
.spya-pista i{position:absolute;top:0;bottom:0;border-radius:7px;background:var(--faint,#9aa0a6)}
.spya-pista i[data-activo='si']{background:var(--good,#1f9d55)}
.spya-ddias{text-align:right;font-weight:600;color:var(--dim);font-variant-numeric:tabular-nums}
.spya-eje{margin-top:8px;color:var(--faint);font-size:var(--fs-sm,13px)}
.spya-eje>span:nth-child(2){display:flex;justify-content:space-between}
.spya-mas{margin-top:12px;height:38px;padding:0 16px;border:0;border-radius:99px;background:var(--surface-2);
  box-shadow:inset 0 0 0 1px var(--border);color:var(--ink);font:inherit;font-weight:600;cursor:pointer}
.spya-vacio{margin:0;color:var(--dim)}
@media (max-width:760px){
  .spya-cajas{grid-template-columns:minmax(0,1fr)}
  .spya-caja,.spya-seccion{padding:16px}
  .spya-tira{grid-template-columns:repeat(3,minmax(0,1fr));gap:8px}
  .spya-gantt li,.spya-eje{grid-template-columns:32px minmax(0,1fr) 48px;gap:8px}
  .spya-cara{width:32px;height:32px}
}
`;

const Flecha = () => (
  <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.2" strokeLinecap="round" strokeLinejoin="round" aria-hidden>
    <path d="m6 9 6 6 6-6" />
  </svg>
);

/** La miniatura de un anuncio, con sus días al aire (verde si sigue). Abre el mismo detalle de siempre. */
function Mini<T extends AnuncioVista>({ a, onAbrir, ahora, ganador }: { a: T; onAbrir: (a: T) => void; ahora: Date; ganador?: boolean }) {
  const src = miniaturaDePieza(a, ahora.getTime());
  const dias = diasAlAire(a, ahora);
  return (
    <button type="button" className="spya-mini" data-ganador={ganador || undefined} onClick={() => onAbrir(a)}
      aria-label={`Abrir el anuncio${dias != null ? `, ${dias} días al aire` : ''}${ganador ? ', el ganador de la tanda' : ''}`}>
      {src
        // eslint-disable-next-line @next/next/no-img-element -- la sirve el CDN de Meta; sin referrer, porque con él contesta 403
        ? <img src={src} alt="" loading="lazy" referrerPolicy="no-referrer" onError={(e) => { e.currentTarget.remove(); }} />
        : <span className="spya-mini-texto">{(a.titulo || a.texto || 'Anuncio').slice(0, 90)}</span>}
      {dias != null && <span className="spya-dias" data-activo={sigueActivo(a) ? 'si' : undefined}>{dias} d</span>}
    </button>
  );
}

export function AnunciosSpy<T extends AnuncioVista>({ anuncios, onAbrir, ahora: ahoraFijo }: {
  anuncios: readonly T[];
  onAbrir: (a: T) => void;
  /** Para el test: «hoy». */
  ahora?: Date;
}) {
  const ahora = useMemo(() => ahoraFijo ?? new Date(), [ahoraFijo]);
  const [ventana, setVentana] = useState<number>(90);
  /** La tanda abierta. `undefined` = todavía nadie tocó: abierta la más nueva. */
  const [abierta, setAbierta] = useState<string | null | undefined>(undefined);
  const [masTandas, setMasTandas] = useState(false);
  const [masFilas, setMasFilas] = useState(false);
  const frescura = useMemo(() => frescuraDeAnuncios(anuncios), [anuncios]);
  const mezcla = useMemo(() => mezclaDeFormatos(anuncios), [anuncios]);
  const landings = useMemo(() => landingsDeAnuncios(anuncios), [anuncios]);
  const tandas = useMemo(() => tandasDeAnuncios(anuncios, ahora), [anuncios, ahora]);
  const linea = useMemo(() => lineaDeTiempo(anuncios, ventana, ahora), [anuncios, ventana, ahora]);
  const conFecha = useMemo(() => anuncios.some((a) => !!a.publicada_en), [anuncios]);
  if (!anuncios.length) return null;

  const diaAbierto = abierta === undefined ? (tandas[0]?.dia ?? null) : abierta;
  const verTandas = masTandas ? tandas : tandas.slice(0, TANDAS_VISIBLES);
  const verFilas = masFilas ? linea.filas : linea.filas.slice(0, FILAS_VISIBLES);

  return (
    <div className="spya">
      <style>{CSS}</style>
      {/* «Updated 16h Ago · Data since…» de Spyder. Lo que está activo es lo que estaba activo en esa lectura. */}
      {(frescura.actualizado || frescura.desde) && (
        <div className="spya-frescura">
          {frescura.actualizado && <span>Actualizado {haceCuanto(frescura.actualizado, ahora)}</span>}
          {frescura.desde && <span>Desde el {fechaCorta(frescura.desde, ahora)}</span>}
        </div>
      )}

      <div className="spya-cajas">
        <section className="spya-caja" aria-label="Sus anuncios activos y su formato">
          {mezcla.activos
            ? <h3 className="spya-heroe"><strong>{mezcla.activos}</strong> <span>{mezcla.activos === 1 ? 'activo' : 'activos'} de {mezcla.total}</span></h3>
            : <h3>{mezcla.total} anuncios, ninguno activo</h3>}
          {mezcla.filas.length > 0 && (
            <>
              <div className="spya-barra" aria-hidden>
                {mezcla.filas.map((f) => <span key={f.medio} style={{ flex: f.n, background: COLOR_MEDIO[f.medio] }} />)}
              </div>
              <ul className="spya-filas">
                {mezcla.filas.map((f) => (
                  <li key={f.medio}><i style={{ background: COLOR_MEDIO[f.medio] }} aria-hidden /><b>{f.rotulo}</b><span>{f.n} · {f.pct}%</span></li>
                ))}
              </ul>
            </>
          )}
        </section>
        {landings.length > 0 && (
          <section className="spya-caja" aria-label="A dónde mandan sus anuncios">
            <h3>A dónde mandan</h3>
            <ul className="spya-filas spya-filas--destinos">
              {landings.map((l) => (
                <li key={l.rotulo}><b title={l.rotulo}>{l.rotulo}</b><span>{l.n} · {l.pct}%</span><em aria-hidden style={{ width: `${Math.max(l.pct, 2)}%` }} /></li>
              ))}
            </ul>
          </section>
        )}
      </div>

      {tandas.length > 0 && (
        <section className="spya-seccion" aria-label="Tests creativos">
          <h3>Tests creativos</h3>
          <ul className="spya-tandas">
            {verTandas.map((t) => {
              const esta = t.dia === diaAbierto;
              return (
                <li key={t.dia}>
                  <button type="button" className="spya-tanda" aria-expanded={esta} onClick={() => setAbierta(esta ? null : t.dia)}>
                    <b>{fechaCorta(`${t.dia}T12:00:00Z`, ahora)}</b>
                    <span>{t.anuncios.length} anuncios · {t.vivos === 0 ? 'ninguno sigue' : t.vivos === 1 ? '1 sigue activo' : `${t.vivos} siguen activos`}</span>
                    {t.ganador && <span className="spya-ganador">Ganador</span>}
                    <Flecha />
                  </button>
                  {esta && (
                    <div className="spya-tira">
                      {t.anuncios.map((a) => <Mini key={a.id} a={a} onAbrir={onAbrir} ahora={ahora} ganador={a === t.ganador} />)}
                    </div>
                  )}
                </li>
              );
            })}
          </ul>
          {tandas.length > TANDAS_VISIBLES && (
            <button type="button" className="spya-mas" onClick={() => setMasTandas((v) => !v)}>{masTandas ? 'Ver menos' : 'Ver más'}</button>
          )}
        </section>
      )}

      {conFecha && (
        <section className="spya-seccion" aria-label="Línea de tiempo">
          <div className="spya-titulo">
            <h3>Línea de tiempo</h3>
            <div className="spya-ventanas" role="group" aria-label="Cuánto mirar hacia atrás">
              {VENTANAS.map((v) => (
                <button key={v.dias} type="button" aria-pressed={ventana === v.dias} onClick={() => { setVentana(v.dias); setMasFilas(false); }}>{v.rotulo}</button>
              ))}
            </div>
          </div>
          {linea.filas.length ? (
            <>
              <ol className="spya-gantt">
                {verFilas.map((f) => {
                  const src = miniaturaDePieza(f.a, ahora.getTime());
                  return (
                    <li key={f.a.id}>
                      <button type="button" className="spya-cara" onClick={() => onAbrir(f.a)} aria-label="Abrir el anuncio">
                        {/* eslint-disable-next-line @next/next/no-img-element -- la sirve el CDN de Meta, sin referrer */}
                        {src && <img src={src} alt="" loading="lazy" referrerPolicy="no-referrer" onError={(e) => { e.currentTarget.remove(); }} />}
                      </button>
                      <span className="spya-pista">
                        <i data-activo={f.sigue ? 'si' : undefined} style={{ left: `${f.x0 * 100}%`, width: `${(f.x1 - f.x0) * 100}%` }} />
                      </span>
                      <span className="spya-ddias">{f.dias != null ? `${f.dias} d` : ''}</span>
                    </li>
                  );
                })}
              </ol>
              <div className="spya-eje" aria-hidden>
                <span />
                <span><span>{fechaCorta(new Date(linea.desde).toISOString(), ahora)}</span><span>Hoy</span></span>
                <span />
              </div>
              {linea.filas.length > FILAS_VISIBLES && (
                <button type="button" className="spya-mas" onClick={() => setMasFilas((v) => !v)}>{masFilas ? 'Ver menos' : 'Ver más'}</button>
              )}
            </>
          ) : (
            <p className="spya-vacio">Ninguno corrió en este tiempo.</p>
          )}
        </section>
      )}
    </div>
  );
}
