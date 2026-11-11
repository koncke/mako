'use client';

// =============================================================================
// La portada del Copywriter: «Encuentra tu siguiente OUTLIER» (11/11/2026, docs/diseno-copywriter.md D18)
// =============================================================================
// Martín (11/11/2026): «lo mismo que te acabo de decir con web generator, aplícalo para copywriting, me gustaría traer outliers…
// podríamos mantener templates con ciertas estructuras, pero también traer los outliers». COPIADA de la portada de Image
// (app/image-editor/carruseles/ExplorarCarruseles.tsx, que copia a Top Carousels), la misma que copió Video: el encabezado con su
// «OUTLIER» marcado, los botones, el buscador, el segmento, el total, el orden, la grilla y la tarjeta de Image (`TarjetaCarrusel`),
// con SUS clases. «Replicar» va donde Image pone «Editar», y tocar la tarjeta abre el original (./OutlierAbierto.tsx, el
// `CarruselAbierto` de Image con el texto donde van las láminas). Las plantillas QUEDAN: son «Crear desde cero».
// =============================================================================

import { useMemo, useState } from 'react';
import Link, { useRouter } from '@/app/_ui/Link';
import { ReportarASoporte } from '@/app/_ui/ReportarASoporte';
import { Dropdown } from '@/app/components/Dropdown';
import { explicarMultiplo } from '@/lib/multiplo-rendimiento';
import { contadorCorto, nivelDeMultiplo, rotuloOutlier } from '@/lib/carruseles/explorar';
import {
  FORMATOS_COPY, INFO_FORMATO, filtrarOutliersCopy, rotuloDeFormato, rotuloDiasAlAire,
  type FormatoCopy, type OrdenCopy, type OutlierCopy, type PortadaCopy,
} from '@/lib/copywriter/outliers';
import { pedirReplicar } from './cliente';
import { OutlierAbierto } from './OutlierAbierto';
import { RUTA_CREAR_COPY, RUTA_GUIONES_COPY } from './vista';
import s from '@/app/image-editor/carruseles/explorar.module.css';
import v from '@/app/video-editor/outliers.module.css';
import oc from './outliers.module.css';

const ORDENES: { value: OrdenCopy; label: string }[] = [
  { value: 'outlier', label: 'Mayor outlier' },
  { value: 'recientes', label: 'Más recientes' },
];

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

const chip = (activo: boolean) => ({
  height: 34, padding: '0 14px', borderRadius: 999, gap: 4, fontFamily: 'inherit', fontSize: 13.5, fontWeight: 550,
  border: `1px solid ${activo ? 'transparent' : 'var(--border)'}`,
  background: activo ? 'var(--primary-bg)' : 'var(--surface)',
  color: activo ? 'var(--primary-strong, var(--primary))' : 'var(--ink)',
});

const Lupa = () => (
  <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" aria-hidden><circle cx="11" cy="11" r="7" /><path d="m20 20-3.5-3.5" /></svg>
);

/** La tarjeta de Image (`TarjetaCarrusel`): la imagen, y abajo el «×», el gancho, la cuenta, hace cuánto y los números. */
function TarjetaCopy({ o, ahora, replicando, onAbrir, onReplicar }: {
  o: OutlierCopy; ahora: number; replicando: boolean; onAbrir: () => void; onReplicar: () => void;
}) {
  const veces = o.multiplo?.veces ?? null;
  const nivel = nivelDeMultiplo(veces);
  const aire = o.formato === 'anuncio' ? rotuloDiasAlAire(o.diasAlAire) : null;
  const quien = o.creador.usuario ? `@${o.creador.usuario}` : o.creador.nombre;
  const cuando = haceCuanto(o.publicada, ahora);
  return (
    <li className={s.tarjeta}>
      {/* Tocar la imagen abre el original; los botones de adentro hacen lo suyo. */}
      <div className={s.mini} data-anuncio={o.formato === 'anuncio' ? 'si' : undefined}
        onClick={(e) => { if (!(e.target as HTMLElement).closest('button, a')) onAbrir(); }}>
        {o.miniatura
          // eslint-disable-next-line @next/next/no-img-element
          ? <img src={o.miniatura} alt="" className={s.miniImagen} loading="lazy" referrerPolicy="no-referrer" draggable={false} />
          : <span className={s.sinFoto}>{o.gancho.slice(0, 140)}</span>}
        <span className={s.marcas}>
          {aire ? <span className={s.aire} data-activo="si">{aire}</span> : null}
        </span>
        <span className={s.sobreImagen}>
          <button type="button" className={s.editar} onClick={onReplicar} disabled={replicando}>{replicando ? 'Armando…' : 'Replicar'}</button>
        </span>
      </div>
      <div className={s.pie}>
        <div className={s.fila1}>
          {veces != null && nivel ? (
            <span className={s.mult} data-nivel={nivel} title={explicarMultiplo(o.multiplo)}>{rotuloOutlier(veces)}</span>
          ) : null}
          <button type="button" className={s.gancho} onClick={onAbrir}>{o.gancho}</button>
        </div>
        <p className={v.porque}>{o.texto}</p>
        <div className={s.creador}>
          {o.creador.foto
            // eslint-disable-next-line @next/next/no-img-element
            ? <img src={o.creador.foto} alt="" className={s.cara} referrerPolicy="no-referrer" />
            : <span className={s.cara} aria-hidden>{inicial(o.creador.nombre)}</span>}
          {o.creador.competidorId != null ? (
            <Link href={`/competitor-spy?competidor=${o.creador.competidorId}`} className={s.quien} title={`Ver el análisis de ${o.creador.nombre} en Competitors Spy`}>{quien}</Link>
          ) : <span className={s.quien}>{quien}</span>}
          {cuando && o.formato !== 'anuncio' ? <span className={s.cuando}>{cuando}</span> : null}
        </div>
        <div className={s.datos}>
          {o.formato === 'reel' || o.formato === 'youtube' ? <span title="Vistas">▶ {contadorCorto(o.vistas)}</span> : null}
          {o.formato !== 'anuncio' ? <span title="Me gusta">♥ {contadorCorto(o.megusta)}</span> : null}
          {o.formato !== 'anuncio' ? <span title="Comentarios">💬 {contadorCorto(o.comentarios)}</span> : null}
          <span className={s.formato}>{rotuloDeFormato(o)}</span>
        </div>
        {/* En el celular no hay «pasar el mouse»: «Replicar» queda a la vista, liviano. */}
        <button type="button" className={s.editarLiviano} onClick={onReplicar} disabled={replicando}>{replicando ? 'Armando…' : 'Replicar'}</button>
      </div>
    </li>
  );
}

/**
 * La portada. `telefono`: la de MaKo Mobile (app/m/copywriter), con las reglas de teléfono de Image; `rutaGuion`: a dónde lleva
 * la página replicada, con `{id}` (en el teléfono, su vista del guion con MaKo abierto: un texto y no una función, porque la arma
 * el server); `rutaGuiones` y `rutaCrear`: «Mis guiones» y «Crear desde cero».
 */
export function OutliersCopy({ portada, telefono = false, rutaGuion = '/copywriter/{id}', rutaGuiones = RUTA_GUIONES_COPY, rutaCrear = RUTA_CREAR_COPY }: {
  portada: PortadaCopy; telefono?: boolean; rutaGuion?: string; rutaGuiones?: string; rutaCrear?: string;
}) {
  const router = useRouter();
  const [ahora] = useState(() => Date.now());
  const [formato, setFormato] = useState<FormatoCopy | null>(null);
  const [q, setQ] = useState('');
  const [orden, setOrden] = useState<OrdenCopy>('outlier');
  const [abierto, setAbierto] = useState<OutlierCopy | null>(null);
  const [replicando, setReplicando] = useState<string | null>(null);
  const [aviso, setAviso] = useState<string | null>(null);

  const cuantos = useMemo(() => {
    const n = new Map<FormatoCopy, number>();
    for (const o of portada.outliers) n.set(o.formato, (n.get(o.formato) ?? 0) + 1);
    return n;
  }, [portada.outliers]);
  const vistos = useMemo(() => filtrarOutliersCopy(portada.outliers, { formato, q }, orden), [portada.outliers, formato, q, orden]);

  /** «Replicar»: la página nueva del tipo del original, y a ella; ahí MaKo pregunta para qué oferta. */
  const replicar = async (o: OutlierCopy) => {
    if (replicando) return;
    setReplicando(o.id);
    setAviso(null);
    const r = await pedirReplicar(o.id);
    if (!r.ok) { setReplicando(null); setAviso(`No se pudo replicar: ${r.error}`); return; }
    router.push(rutaGuion.replace('{id}', r.pagina.id));
  };

  const botones = (
    <div className={telefono ? `${s.botones} ${oc.botonesTelefono}` : s.botones}>
      <Link href="/competitor-spy" className={s.pastilla}>+ Seguir cuentas</Link>
      <Link href={rutaGuiones} className={s.pastilla}>Mis guiones</Link>
      <Link href={rutaCrear} className={s.crear}><span aria-hidden>＋</span> Crear desde cero</Link>
    </div>
  );

  const segmento = (
    <div className={s.segmento} role="radiogroup" aria-label="Qué ver">
      <button type="button" role="radio" aria-checked={formato === null} onClick={() => setFormato(null)}>Todos</button>
      {FORMATOS_COPY.filter((f) => cuantos.get(f)).map((f) => (
        <button key={f} type="button" role="radio" aria-checked={formato === f} onClick={() => setFormato(f)}>
          {INFO_FORMATO[f].plural}<span className={s.n}>{cuantos.get(f)}</span>
        </button>
      ))}
    </div>
  );

  return (
    <div className={s.raiz} data-telefono={telefono ? 'si' : undefined}>
      <div className={s.col}>
        <header className={s.cabeza}>
          <h1>Encuentra tu siguiente <mark>OUTLIER</mark></h1>
          {/* En el teléfono, debajo del título como en la computadora (en su fila deslizable): 11/11/2026, en producción a 375, al
              final de la fila de formatos («Todos · Anuncios · Reels · Carruseles · YouTube») quedaban fuera de la pantalla y
              «Mis guiones» y «Crear desde cero» no se veían. */}
          {telefono ? <div className={`${s.filtros} ${oc.filaTelefono}`}>{botones}</div> : botones}
          {portada.outliers.length > 0 && (
            <label className={s.busca}>
              <Lupa />
              <input type="search" value={q} onChange={(e) => setQ(e.target.value)} enterKeyHint="search"
                placeholder={telefono ? 'Busca copys o @creadores' : 'Busca ganchos, temas o @creadores'} aria-label="Buscar por gancho, tema o @creador" />
            </label>
          )}
        </header>

        {portada.caidas.map((c) => (
          <div key={c.fuente} role="alert" className={v.caida}>
            <span>No pude leer {c.nombre}: {c.motivo}</span>
            <ReportarASoporte />
          </div>
        ))}
        {aviso && <p role="alert" className={s.aviso}>{aviso}<ReportarASoporte /></p>}

        {portada.outliers.length === 0 ? (
          <>
            <div className={s.vacio}>
              <p>Sigue en Competitors Spy las cuentas de tu nicho y aquí aparecen sus anuncios, reels, carruseles y videos que mejor funcionan, para replicar el que te sirva.</p>
              <Link href="/competitor-spy" className={s.boton}>Abrir Competitors Spy</Link>
            </div>
          </>
        ) : (
          <>
            <div className={s.filtros}>
              {segmento}
              <span className={s.espacio} />
              {telefono ? null : (
                <span className={s.total}>{contadorCorto(vistos.length)} {vistos.length === 1 ? 'outlier' : 'outliers'}</span>
              )}
              <Dropdown value={orden} search={false} alContenido ariaLabel="Orden" align="right"
                options={ORDENES.map((x) => ({ value: x.value, label: x.label }))}
                botonLabel={<span>{ORDENES.find((x) => x.value === orden)?.label}</span>} onChange={(x) => setOrden(x as OrdenCopy)}
                buttonStyle={chip(false)} />
            </div>
            {vistos.length === 0 ? (
              <div className={s.vacio}><p>Nada con esa búsqueda.</p><button type="button" className={s.texto} onClick={() => { setQ(''); setFormato(null); }}>Quitar filtros</button></div>
            ) : (
              <ul className={s.grilla} aria-label="Outliers de copy">
                {vistos.map((o) => (
                  <TarjetaCopy key={o.id} o={o} ahora={ahora} replicando={replicando === o.id} onAbrir={() => setAbierto(o)} onReplicar={() => void replicar(o)} />
                ))}
              </ul>
            )}
          </>
        )}
      </div>
      {abierto ? (
        <OutlierAbierto o={abierto} telefono={telefono} replicando={replicando === abierto.id}
          onCerrar={() => setAbierto(null)} onReplicar={() => void replicar(abierto)} />
      ) : null}
    </div>
  );
}
