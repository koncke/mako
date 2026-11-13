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

import { useEffect, useMemo, useRef, useState } from 'react';
import Link, { useRouter } from '@/app/_ui/Link';
import { ReportarASoporte } from '@/app/_ui/ReportarASoporte';
import { Dropdown } from '@/app/components/Dropdown';
import { explicarMultiplo } from '@/lib/multiplo-rendimiento';
import { contadorCorto, nivelDeMultiplo, rotuloOutlier } from '@/lib/carruseles/explorar';
import {
  ASPECTO_FORMATO, FORMATOS_COPY, INFO_FORMATO, PROPORCION_FORMATO, ROTULO_TEXTO, claveDeConsulta, filtrarOutliersCopy, imagenDelOriginal, sumarTanda, textoDeTarjeta,
  rotuloDeFormato, rotuloDiasAlAire, type FormatoCopy, type OrdenCopy, type OutlierCopy, type PortadaCopy,
} from '@/lib/copywriter/outliers';
import { pedirOutliers, pedirReplicar } from './cliente';
import { OutlierAbierto } from './OutlierAbierto';
import { RUTA_CREAR_COPY, RUTA_GUIONES_COPY } from './vista';
import s from '@/app/image-editor/carruseles/explorar.module.css';
import v from '@/app/video-editor/outliers.module.css';
import oc from './outliers.module.css';
import { TarjetaPlantilla } from '@/app/_crear/TarjetaPlantilla';
import { GrillaMixta } from '@/app/_crear/GrillaMixta';
import { usePortadaCrear } from '@/app/_crear/portada-ctx';
import type { PlantillaCrear } from '@/app/_crear/reglas';

/** Cuántas plantillas van en la fila de la portada (las demás, en «Ver todas»). */
const PLANTILLAS_EN_PORTADA = 8;

/** Cuántas tarjetas se dibujan por vez (la grilla de 4 columnas: 12 filas). */
const TANDA = 48;

/** El valor `ms` después de que dejó de cambiar: lo que se escribe en el buscador se pide al server al terminar de escribir. */
function useDiferido<T>(v: T, ms: number): T {
  const [d, setD] = useState(v);
  useEffect(() => { const t = setTimeout(() => setD(v), ms); return () => clearTimeout(t); }, [v, ms]);
  return d;
}

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

const proporcionDe = (o: OutlierCopy) => PROPORCION_FORMATO[o.formato];

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

/** El ícono de la red en la marca del marco: se distingue de un vistazo de dónde es el copy. */
function IconoRed({ formato }: { formato: FormatoCopy }) {
  if (formato === 'youtube') {
    return <svg width="15" height="15" viewBox="0 0 24 24" aria-hidden><rect x="2" y="5" width="20" height="14" rx="4" fill="#ff0033" /><path d="M10 9v6l5-3z" fill="#fff" /></svg>;
  }
  if (formato === 'anuncio') {
    return <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinejoin="round" aria-hidden><path d="M3 10v4h4l6 4V6L7 10z" /><path d="M17 9a4 4 0 0 1 0 6" strokeLinecap="round" /></svg>;
  }
  return <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" aria-hidden><rect x="3" y="3" width="18" height="18" rx="5" /><circle cx="12" cy="12" r="4" /><circle cx="17.5" cy="6.5" r="1" fill="currentColor" stroke="none" /></svg>;
}

/**
 * Lo que suma el pie de la tarjeta al alto (la grilla mixta lo usa para repartir las columnas): la cuenta y los números, y con portada
 * también el gancho y unos renglones de la transcripción. YouTube no lleva transcripción (sólo su título).
 */
function altoDelPie(o: OutlierCopy, telefono: boolean): number {
  const base = telefono ? 118 : 92;
  if (!imagenDelOriginal(o)) return base;
  if (o.formato === 'youtube') return base + (telefono ? 40 : 46);
  return base + (telefono ? 96 : 112);
}

/**
 * La tarjeta de un outlier de COPY, en UNA caja. Arriba, el MARCO con la forma de su plataforma (YouTube 16:9, reel 9:16, carrusel
 * 4:5, anuncio 1:1):
 *   · con portada (la del reel, la primera lámina, la miniatura de YouTube), la portada LIMPIA, sin nada encima salvo la marca de la
 *     red. 13/11/2026, el Cerebro con el banco: las portadas ya traen su título escrito, y el gancho encima quedaba DOS veces, uno
 *     tapando al otro. El texto va debajo, en la parte blanca: el gancho en negrita y unos renglones de la transcripción con «…»;
 *   · sin portada, el marco con el color de su red y el gancho grande adentro, con la transcripción (nunca una caja blanca vacía).
 * Al pasar el cursor, el ▶ si es un video y «Replicar». Abajo, la cuenta y los números. Tocar el marco abre el original entero.
 */
function TarjetaCopy({ o, ahora, replicando, onAbrir, onReplicar }: {
  o: OutlierCopy; ahora: number; replicando: boolean; onAbrir: () => void; onReplicar: () => void;
}) {
  const [rota, setRota] = useState(false);
  const veces = o.multiplo?.veces ?? null;
  const nivel = nivelDeMultiplo(veces);
  const aire = o.formato === 'anuncio' ? rotuloDiasAlAire(o.diasAlAire) : null;
  const quien = o.creador.usuario ? `@${o.creador.usuario}` : o.creador.nombre;
  const cuando = haceCuanto(o.publicada, ahora);
  // El gancho y lo que le sigue, sin repetirse (un gancho cortado con «…» no es el principio del texto: lib/copywriter/outliers.ts).
  const texto = textoDeTarjeta(o);
  const gancho = texto.gancho;
  const sigue = o.formato === 'youtube' ? '' : texto.sigue;
  const original = rota ? null : imagenDelOriginal(o);
  const video = o.formato === 'reel' || o.formato === 'youtube';
  return (
    <li className={`${s.tarjeta} ${oc.tarjeta}`} data-formato={o.formato}>
      <div className={`${s.mini} ${oc.marco}`} data-con-imagen={original ? 'si' : undefined} style={{ aspectRatio: ASPECTO_FORMATO[o.formato] }}
        onClick={(e) => { if (!(e.target as HTMLElement).closest('button, a')) onAbrir(); }}>
        {original ? (
          <>
            {/* eslint-disable-next-line @next/next/no-img-element */}
            <img src={original} alt="" className={oc.portada} loading="lazy" referrerPolicy="no-referrer" draggable={false} onError={() => setRota(true)} />
            {video ? <span className={oc.play} aria-hidden>▶</span> : null}
          </>
        ) : (
          <div className={oc.copy}>
            <button type="button" className={oc.ganchoGrande} onClick={onAbrir}>{gancho}</button>
            {sigue ? <p className={oc.sigue}>{sigue}</p> : null}
          </div>
        )}
        <span className={`${s.marcas} ${oc.marcas}`}>
          <span className={oc.red} title={`${rotuloDeFormato(o)} · ${ROTULO_TEXTO[o.deDonde]}`}>
            <IconoRed formato={o.formato} />
            {/* En el teléfono, sólo el ícono: el nombre tapaba la cara y el nombre de las portadas tipo tuit (13/11/2026, el Cerebro). */}
            <span className={oc.redNombre}>{o.formato === 'carrusel' && (o.laminas ?? 0) > 1 ? `Carrusel · ${o.laminas}` : INFO_FORMATO[o.formato].label}</span>
          </span>
          {/* Con el guion transcripto, se nota (12/11/2026, prueba en producción: 46 de los primeros 48 reels traían sólo su pie, y
              replicar el pie no copia lo que se DICE en la pieza). */}
          {o.deDonde === 'guion' ? <span className={oc.conGuion}>Guion</span> : null}
        </span>
        <span className={s.sobreImagen}>
          <button type="button" className={s.editar} onClick={onReplicar} disabled={replicando}>{replicando ? 'Armando…' : 'Replicar'}</button>
        </span>
      </div>
      <div className={s.pie}>
        {original ? (
          // Con portada, el texto va acá y no encima de la imagen (que ya trae el suyo).
          <div className={oc.textoPie}>
            <button type="button" className={oc.ganchoPie} onClick={onAbrir}>{gancho}</button>
            {sigue ? <p className={oc.siguePie}>{sigue}</p> : null}
          </div>
        ) : null}
        <div className={s.creador}>
          {veces != null && nivel ? (
            <span className={s.mult} data-nivel={nivel} title={explicarMultiplo(o.multiplo)}>{rotuloOutlier(veces)}</span>
          ) : null}
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
          {/* Los días al aire de un anuncio van acá y no en el marco: a 375 su pastilla bajaba de renglón y tapaba el gancho (banco, 12/11). */}
          {aire ? <span title="Días al aire">⏱ {aire}</span> : null}
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
export function OutliersCopy({ portada, telefono = false, rutaGuion = '/copywriter/{id}', rutaGuiones = RUTA_GUIONES_COPY, rutaCrear = RUTA_CREAR_COPY, plantillas, onPlantilla }: {
  portada: PortadaCopy; telefono?: boolean; rutaGuion?: string; rutaGuiones?: string; rutaCrear?: string;
  /**
   * Las plantillas con estructura, AL LADO de los outliers (11/11/2026, Martín: «además de los outliers, también deberían estar los
   * templates»; la regla «Create: orden y outliers»). Una fila con la tarjeta común de Create (app/_crear/TarjetaPlantilla.tsx, sin
   * tocarla) y «Ver todas» a «Crear desde cero». Sin esto (el teléfono), no se dibuja.
   */
  plantillas?: readonly PlantillaCrear[];
  onPlantilla?: (p: PlantillaCrear) => Promise<string | null>;
}) {
  const router = useRouter();
  const [ahora] = useState(() => Date.now());
  const [formato, setFormato] = useState<FormatoCopy | null>(null);
  const [q, setQ] = useState('');
  const [orden, setOrden] = useState<OrdenCopy>('outlier');
  const [abierto, setAbierto] = useState<OutlierCopy | null>(null);
  const [replicando, setReplicando] = useState<string | null>(null);
  const [aviso, setAviso] = useState<string | null>(null);
  const [usando, setUsando] = useState<string | null>(null);
  const [activa, setActiva] = useState<string | null>(null);

  // La cuenta de cada formato y el total son los de TODA la portada, aunque la página traiga sólo la primera tanda.
  const cuantos = useMemo(() => {
    const n = new Map<FormatoCopy, number>();
    if (portada.porFormato) for (const f of FORMATOS_COPY) n.set(f, portada.porFormato[f] ?? 0);
    else for (const o of portada.outliers) n.set(o.formato, (n.get(o.formato) ?? 0) + 1);
    return n;
  }, [portada.outliers, portada.porFormato]);
  const totalPortada = portada.total ?? portada.outliers.length;

  // La portada por tandas (13/11/2026, el Cerebro: mandaba los 924 outliers de una, 1,19 MB). Con `portada.total`, la página trajo
  // la primera tanda y el resto se pide al server (`pedirOutliers`), filtrado y ordenado allá con la misma función; al cambiar el
  // filtro, la lista vuelve a pedirse desde la primera. Mientras llega, se ve lo que ya está a mano filtrado acá. Sin `total` (el
  // banco), la portada entera está acá y se filtra acá, como antes.
  const remota = portada.total != null;
  const [conocidos, setConocidos] = useState<OutlierCopy[]>(portada.outliers);
  const aMano = useMemo(() => filtrarOutliersCopy(remota ? conocidos : portada.outliers, { formato, q }, orden),
    [remota, conocidos, portada.outliers, formato, q, orden]);
  const qPedida = useDiferido(q, 300);
  const consulta = useMemo(() => ({ filtros: { formato, q: qPedida }, orden }), [formato, qPedida, orden]);
  const clave = claveDeConsulta(consulta.filtros, consulta.orden);
  const [lista, setLista] = useState(() => ({ clave: claveDeConsulta({ formato: null, q: '' }, 'outlier'), items: portada.outliers, total: totalPortada }));
  const [pidiendo, setPidiendo] = useState(false);
  // Una tanda que no llegó no se vuelve a pedir sola al bajar (sería un pedido por cada movimiento): queda «Ver más».
  const [fallo, setFallo] = useState(false);
  const ultima = useRef(clave);
  ultima.current = clave;
  const traer = async (desde: number) => {
    const c = clave;
    setPidiendo(true);
    const r = await pedirOutliers({ ...consulta, desde });
    if (ultima.current !== c) return; // otro filtro mientras tanto: manda el último
    setPidiendo(false);
    setFallo(!r.ok);
    if (!r.ok) { setAviso(`No pude traer más outliers: ${r.error}`); return; }
    setConocidos((ya) => sumarTanda(ya, r.outliers));
    setLista((l) => ({ clave: c, items: desde === 0 || l.clave !== c ? r.outliers : sumarTanda(l.items, r.outliers), total: r.total }));
  };
  useEffect(() => {
    if (!remota) return;
    if (lista.clave === clave) { setPidiendo(false); return; }
    void traer(0);
  }, [clave]); // eslint-disable-line react-hooks/exhaustive-deps
  // Lo que ya llegó del server para lo que se está mirando (con lo escrito al día, no sólo lo pedido).
  const alDia = remota && lista.clave === claveDeConsulta({ formato, q }, orden);

  // De a TANDA tarjetas (11/11/2026, Martín: «anda increíblemente lento». Medido: se dibujaban las 2.291 de una, 46.030 elementos,
  // y cada cambio de filtro tardaba de 1 a 7 s). Al bajar se suman solas; «Ver más» por si el navegador no avisa (una pestaña de
  // fondo no dispara el IntersectionObserver). Cambiar el filtro vuelve a la primera tanda.
  const [mostrar, setMostrar] = useState(TANDA);
  const vistos = alDia ? lista.items : aMano;
  const total = !remota ? aMano.length : alDia ? lista.total : null;
  const enGrilla = useMemo(() => (alDia ? vistos : vistos.slice(0, mostrar)), [alDia, vistos, mostrar]);
  const faltan = alDia ? lista.total - lista.items.length : remota ? 0 : vistos.length - mostrar;
  const cargarMas = () => {
    if (!remota) setMostrar((n) => n + TANDA);
    else if (alDia && !pidiendo) void traer(lista.items.length);
  };
  useEffect(() => { setMostrar(TANDA); }, [formato, q, orden]);
  const fin = useRef<HTMLDivElement>(null);
  useEffect(() => {
    const el = fin.current;
    if (!el || faltan <= 0 || pidiendo || fallo || typeof IntersectionObserver === 'undefined') return;
    const io = new IntersectionObserver((es) => { if (es.some((e) => e.isIntersecting)) cargarMas(); }, { rootMargin: '800px' });
    io.observe(el);
    return () => io.disconnect();
  }, [faltan, pidiendo, fallo, enGrilla.length]); // eslint-disable-line react-hooks/exhaustive-deps

  /** «Replicar»: la página nueva del tipo del original, y a ella; ahí MaKo pregunta para qué oferta. */
  const replicar = async (o: OutlierCopy) => {
    if (replicando) return;
    setReplicando(o.id);
    setAviso(null);
    const r = await pedirReplicar(o.id);
    if (!r.ok) { setReplicando(null); setAviso(`No se pudo replicar: ${r.error}`); return; }
    router.push(rutaGuion.replace('{id}', r.pagina.id));
  };

  // Sin chat en la portada (12/11/2026): «Mis guiones» abre la lista a la izquierda (`usePortadaCrear`); en el teléfono, su ruta.
  const pantalla = usePortadaCrear();
  const botones = (
    <div className={telefono ? `${s.botones} ${oc.botonesTelefono}` : s.botones}>
      <Link href="/competitor-spy" className={s.pastilla}>+ Seguir cuentas</Link>
      {pantalla
        ? <button type="button" className={s.pastilla} onClick={pantalla.verProyectos}>Mis guiones</button>
        : <Link href={rutaGuiones} className={s.pastilla}>Mis guiones</Link>}
      <Link href={rutaCrear} className={s.nuevo}><span aria-hidden>＋</span> Nuevo copy</Link>
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
          {/* En el teléfono, debajo del título como en la computadora (11/11/2026: al final de la fila de formatos no se veían). Y
              en DOS renglones si no entran, no en una fila que se desliza: el 12/11, a 375, «+ Crear desde cero» quedaba cortado a la
              derecha (prueba de Copywriting en producción) y el botón de crear es el principal. */}
          {botones}
          {totalPortada > 0 && (
            <label className={s.busca}>
              <Lupa />
              <input type="search" value={q} onChange={(e) => setQ(e.target.value)} enterKeyHint="search"
                placeholder={telefono ? 'Busca copys o @creadores' : 'Busca ganchos, temas o @creadores'} aria-label="Buscar por gancho, tema o @creador" />
            </label>
          )}
        </header>

        {plantillas?.length && onPlantilla ? (
          <section className={oc.plantillas} aria-labelledby="copy-plantillas">
            <div className={oc.plantillasCabeza}>
              <h2 id="copy-plantillas" className="cr-plantillas__titulo">Plantillas con estructura</h2>
              <Link href={rutaCrear} className={s.texto}>Ver todas</Link>
            </div>
            <div className={oc.plantillasFila}>
              {plantillas.slice(0, PLANTILLAS_EN_PORTADA).map((pl) => (
                <TarjetaPlantilla key={pl.id} pl={pl} activa={activa === pl.id} usando={usando}
                  onActiva={(si) => setActiva((a) => (si ? pl.id : a === pl.id ? null : a))}
                  onUsar={() => {
                    if (usando) return;
                    setUsando(pl.id);
                    setAviso(null);
                    void onPlantilla(pl).then((e) => { setUsando(null); if (e) setAviso(e); });
                  }} />
              ))}
            </div>
          </section>
        ) : null}

        {portada.caidas.map((c) => (
          <div key={c.fuente} role="alert" className={v.caida}>
            <span>No pude leer {c.nombre}: {c.motivo}</span>
            <ReportarASoporte />
          </div>
        ))}
        {aviso && <p role="alert" className={s.aviso}>{aviso}<ReportarASoporte /></p>}

        {totalPortada === 0 ? (
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
              {telefono || total == null ? null : (
                <span className={s.total}>{contadorCorto(total)} {total === 1 ? 'outlier' : 'outliers'}</span>
              )}
              <Dropdown value={orden} search={false} alContenido ariaLabel="Orden" align="right"
                options={ORDENES.map((x) => ({ value: x.value, label: x.label }))}
                botonLabel={<span>{ORDENES.find((x) => x.value === orden)?.label}</span>} onChange={(x) => setOrden(x as OrdenCopy)}
                buttonStyle={chip(false)} />
            </div>
            {vistos.length === 0 && remota && !alDia ? (
              <div className={s.vacio}><p>Buscando…</p></div>
            ) : vistos.length === 0 ? (
              <div className={s.vacio}><p>Nada con esa búsqueda.</p><button type="button" className={s.texto} onClick={() => { setQ(''); setFormato(null); }}>Quitar filtros</button></div>
            ) : (
              <>
                {/* Cada una con la forma de su red: en columnas, sin los huecos que dejaba un reel al lado de los de YouTube. */}
                <GrillaMixta items={enGrilla} clave={(o) => o.id} proporcion={proporcionDe} etiqueta="Outliers de copy"
                  pie={(o) => altoDelPie(o, telefono)} minimo={telefono ? 150 : 250} hueco={telefono ? 10 : 20} fila={telefono ? 14 : 22}
                  porDefecto={telefono ? 2 : 4}
                  render={(o) => (
                    <TarjetaCopy o={o} ahora={ahora} replicando={replicando === o.id} onAbrir={() => setAbierto(o)} onReplicar={() => void replicar(o)} />
                  )} />
                {faltan > 0 ? (
                  <div ref={fin} className={oc.masAbajo}>
                    <button type="button" className={s.pastilla} onClick={cargarMas} disabled={pidiendo}>{pidiendo ? 'Trayendo…' : `Ver más (${faltan})`}</button>
                  </div>
                ) : null}
              </>
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
