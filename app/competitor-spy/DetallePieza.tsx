'use client';

// =============================================================================
// El detalle de una pieza del competidor, rehecho de cero (4/11/2026)
// =============================================================================
// Martín (por el Cerebro, 4/11): «En cada uno de los videos cuando entro no estás trayendo la transcripción, y tampoco me
// gusta el modal que hiciste, rediseñalo bien… Tampoco me gusta el botón de copiar estructura».
//
// Copiado de la ficha de un video del video de referencia (docs/diseno-competitors-spy.md §15, puntos 3 y 5): el video a la
// izquierda y, a la derecha, quién lo publicó (su foto y sus seguidores), sus números, su estructura y su GUION COMPLETO. De
// vidIQ, el número que dice si le fue bien («2,3× su mediana»: cuánto hizo frente a una pieza suya típica). De Linear, las
// propiedades en filas de etiqueta y valor, sin cajas dentro de cajas.
//
// EL GUION: el de un reel se pide solo al abrir (/api/competitor-spy/transcribir, lib/spy-transcripcion.ts) y mientras dice
// «Transcribiendo…». Un video de YouTube no tiene una forma permitida de leerse (docs/relevo/nube-spy.md): ahí va su
// descripción, y un bloque sin datos no se dibuja.
//
// «HACER UNO ASÍ» reemplaza al botón «Copiar estructura»: es la misma acción (/api/competitor-spy/copiar arma una página del
// Copywriter con su estructura y su texto citado, y MaKo la escribe con la oferta del negocio), dicha por lo que consigue y
// no por cómo funciona por dentro, con la estrella de MaKo y, al lado, qué va a pasar. Vive en el pie del modal: el pie no
// scrollea, así que se ve siempre aunque el guion sea largo.

import { useEffect, useMemo, useState, type ReactNode } from 'react';
import { Icon } from '../_components/icons';
import { BrandDefs } from '../_components/ServicioVisual';
import { MakoStar } from '../_components/MakoBrand';
import { BotonIntegracion, CON_SU_CLASE } from '../_components/ConectarIntegracion';
import { LogoRed, redDePieza } from './LogoRed';
import { iniciales } from '@/lib/unicode-seguro';
import { Modal } from '@/app/_ui/Modal';
import { useRouter } from '@/app/_ui/Link';
import { ReportarASoporte } from '@/app/_ui/ReportarASoporte';
import { FORMATOS, formatoPorTexto, proporcionDe, puestoDe } from '@/lib/spy-detalle';
import { explicarMultiplo, multiplosDe, rotuloCortoDeMultiplo } from '@/lib/multiplo-rendimiento';
import { dibujarContador } from '@/lib/spy-reglas';
import { fechaCorta, linksLegibles, miniaturaDePieza } from '@/lib/spy-vista';
import { CLAVE_SPY_RECHAZADA, tieneGuion, type VistaGuion } from '@/lib/spy-transcripcion';
import type { PiezaVista } from './actions';
import { Desarmar, avisarDesarme } from '@/app/video-editor/Desarmar';
import { DesarmarImagen } from './DesarmarImagen';
import { claveDeDesarme, fuenteDePiezaSpy, segundosIso, type FuenteDesarme } from '@/lib/video-desarmar';

const CSS = `
.spyd{display:grid;grid-template-columns:minmax(220px,300px) minmax(0,1fr);gap:24px;align-items:start}
.spyd[data-ancho=true]{grid-template-columns:minmax(0,1.15fr) minmax(0,1fr)}
.spyd-media{position:sticky;top:0;border-radius:16px;overflow:hidden;background:var(--sidebar,#16181d);box-shadow:var(--sombra-tarjeta)}
.spyd-media iframe,.spyd-media img{display:block;width:100%;height:100%;border:0;object-fit:cover}
.spyd-media__ir{position:absolute;left:50%;bottom:14px;transform:translateX(-50%);display:inline-flex;align-items:center;gap:8px;
  height:36px;padding:0 14px;border-radius:99px;background:rgba(0,0,0,.62);color:#fff;font-size:var(--fs-sm);font-weight:600;
  text-decoration:none;white-space:nowrap;backdrop-filter:blur(6px)}
.spyd-media__ir:hover{background:rgba(0,0,0,.78)}
.spyd-info{display:flex;flex-direction:column;gap:18px;min-width:0}
.spyd-quien{display:flex;align-items:center;gap:12px;min-width:0}
.spyd-quien img,.spyd-quien span[data-cara]{width:40px;height:40px;border-radius:50%;object-fit:cover;flex:0 0 auto;background:var(--surface-2);
  display:grid;place-items:center;font-weight:700;color:var(--dim)}
.spyd-quien div{display:flex;flex-direction:column;min-width:0}
.spyd-quien b{font-size:var(--fs-md);font-weight:600;overflow:hidden;text-overflow:ellipsis;white-space:nowrap}
.spyd-quien small{color:var(--dim);font-size:var(--fs-sm)}
.spyd-quien time{margin-left:auto;color:var(--faint);font-size:var(--fs-sm);white-space:nowrap}
.spyd-nums{display:grid;grid-template-columns:repeat(auto-fit,minmax(96px,1fr));border-radius:14px;overflow:hidden;
  box-shadow:inset 0 0 0 1px var(--border);background:var(--surface)}
.spyd-num{padding:12px 14px;min-width:0;box-shadow:inset -1px 0 0 var(--border)}
.spyd-num:last-child{box-shadow:none}
.spyd-num span{display:block;font-size:12px;color:var(--dim);white-space:nowrap;overflow:hidden;text-overflow:ellipsis}
.spyd-num b{display:block;margin-top:2px;font-size:20px;font-weight:700;letter-spacing:-.01em;font-variant-numeric:tabular-nums;color:var(--ink)}
.spyd-num[data-tono=good] b{color:var(--good)}
.spyd-num[data-tono=bad] b{color:var(--bad)}
.spyd-num[data-tono=apagado] b{font-size:14px;font-weight:600;line-height:24px;color:var(--dim);white-space:nowrap;overflow:hidden;text-overflow:ellipsis}
.spyd-props{display:flex;flex-direction:column;margin:0}
.spyd-props>div{display:grid;grid-template-columns:96px minmax(0,1fr);gap:12px;padding:9px 0;box-shadow:inset 0 -1px 0 var(--border)}
.spyd-props>div:last-child{box-shadow:none}
.spyd-props dt{color:var(--dim);font-size:var(--fs-sm)}
.spyd-props dd{margin:0;font-size:var(--fs-md);line-height:1.45;color:var(--ink);overflow-wrap:anywhere}
.spyd-titulo{display:flex;align-items:center;justify-content:space-between;gap:10px;margin:0 0 8px}
.spyd-titulo h4{margin:0;font-size:var(--fs-md);font-weight:600;color:var(--ink)}
.spyd-guion{max-height:300px;overflow:auto;padding:14px 16px;border-radius:14px;background:var(--surface-2);
  font-size:var(--fs-md);line-height:1.65;color:var(--ink)}
.spyd-guion p{margin:0 0 10px}
.spyd-guion p:last-child{margin:0}
.spyd-nota{display:flex;align-items:center;gap:10px;flex-wrap:wrap;margin:0;padding:11px 14px;border-radius:12px;
  background:var(--surface-2);color:var(--dim);font-size:var(--fs-sm);line-height:1.5}
.spyd-vivo{display:inline-flex;align-items:center;gap:8px;font-size:var(--fs-sm);color:var(--dim)}
.spyd-vivo i{width:7px;height:7px;border-radius:50%;background:var(--primary);animation:spydLatido 1.1s ease-in-out infinite}
@keyframes spydLatido{50%{opacity:.25}}
.spyd-mini{display:inline-flex;align-items:center;gap:6px;height:28px;padding:0 10px;border:0;border-radius:8px;background:none;
  color:var(--dim);font-size:12px;font-weight:600;cursor:pointer}
.spyd-mini:hover{background:var(--velo-hover);color:var(--ink)}
.spyd-tags{display:flex;gap:6px;flex-wrap:wrap}
.spyd-tags span{padding:3px 9px;border-radius:99px;background:var(--surface-2);font-size:12px;color:var(--dim)}
.spyd-pie-nota{margin-right:auto;color:var(--dim);font-size:var(--fs-sm);min-width:0}
.spyd-hacer{display:inline-flex;align-items:center;gap:8px}
.spyd-red{display:inline-flex;align-items:center;gap:8px}
@media (max-width:720px){.spyd,.spyd[data-ancho=true]{grid-template-columns:1fr}.spyd-media{position:relative;max-height:46vh;justify-self:center}.spyd-pie-nota{display:none}}
@media (prefers-reduced-motion:reduce){.spyd-vivo i{animation:none}}
`;

const RED: Record<string, string> = { instagram: 'Instagram', youtube: 'YouTube', anuncios: 'la Biblioteca de Anuncios' };
const TIPO: Record<string, string> = { reel: 'Reel', publicacion: 'Publicación', video: 'Video', anuncio: 'Anuncio' };

/** Los hashtags de su texto, sin repetir, hasta 12. */
const hashtagsDe = (t: string | null): string[] => [...new Set((t ?? '').match(/#[\p{L}\p{N}_]+/gu) ?? [])].slice(0, 12);
/** «2,3×» con coma decimal, como se escribe en español. */

/** El guion: se pide solo al abrir y se vuelve a preguntar cada 5 s mientras se transcribe, hasta 5 minutos. */
function useGuion(p: PiezaVista): { guion: VistaGuion | null; pedir: () => void } {
  const [guion, setGuion] = useState<VistaGuion | null>(null);
  const [vuelta, setVuelta] = useState(0);
  const aplica = tieneGuion(p);
  useEffect(() => {
    if (!aplica) return;
    let vivo = true;
    let n = 0;
    let t: ReturnType<typeof setTimeout>;
    const preguntar = async () => {
      n += 1;
      type Resp = { ok: boolean; guion?: VistaGuion };
      const r: Resp = await fetch('/api/competitor-spy/transcribir', {
        method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify({ piezaId: p.id }), signal: AbortSignal.timeout(30_000),
      }).then((x) => x.json() as Promise<Resp>).catch(() => ({ ok: false }));
      if (!vivo) return;
      // Un pedido que no contestó no es «transcribiendo»: el bloque no se dibuja hasta saber (no queda latiendo para siempre).
      setGuion(r.ok && r.guion ? r.guion : { estado: 'no-aplica' });
      if (r.ok && r.guion?.estado === 'transcribiendo' && n < 60) t = setTimeout(() => { void preguntar(); }, 5000);
    };
    void preguntar();
    return () => { vivo = false; clearTimeout(t); };
  }, [aplica, p.id, vuelta]);
  return { guion: aplica ? guion : { estado: 'no-aplica' }, pedir: () => setVuelta((v) => v + 1) };
}

function BloqueGuion({ guion, onConectado }: { guion: VistaGuion | null; onConectado: () => void }) {
  const [copiado, setCopiado] = useState(false);
  if (guion?.estado === 'no-aplica') return null;
  let cuerpo: ReactNode;
  if (!guion || guion.estado === 'transcribiendo') {
    cuerpo = <p className="spyd-nota"><span className="spyd-vivo" aria-live="polite"><i />Transcribiendo…</span></p>;
  } else if (guion.estado === 'sin-ia') {
    cuerpo = (
      <p className="spyd-nota">
        Conecta tu GPT o tu Gemini para transcribirlo.
        {/* Escuchar un video lo hacen su GPT o su Gemini (Claude no escucha audio). Se conecta acá, sin salir de la tab. */}
        <BotonIntegracion servicio="openai" className="spy-boton" style={CON_SU_CLASE} onConectado={onConectado}>Conectar GPT</BotonIntegracion>
      </p>
    );
  } else if (guion.estado === 'sin-gemini') {
    // ⚠️ SIN «CONECTA TU GEMINI» (Martín, 25/10/2026: «le sigue diciendo que debe conectar su IA de Gemini, cuando dijimos que
    // todo eso se hace con … su claude o GPT»; lib/conectar-ia-reglas.ts). El guion de un video de YouTube sólo lo hace Gemini:
    // sin el del negocio, el bloque no se dibuja. Usar la clave de la plataforma es una decisión de Martín (docs/relevo/nube-spy.md).
    return null;
  } else if (guion.estado === 'sin-clave') {
    cuerpo = (
      <p className="spyd-nota">
        Para transcribirlo hace falta tu clave de Apify.
        <BotonIntegracion servicio="apify-instagram" className="spy-boton" style={CON_SU_CLASE} onConectado={onConectado}>Conectar</BotonIntegracion>
      </p>
    );
  } else if (guion.estado === 'clave-rechazada') {
    // 14/11/2026, la llamada con Julio: con la clave dando 401 decía «No pude traer el video de Instagram», y nada más. Es la clave, y
    // se arregla acá mismo: al guardarla, `onConectado` lo vuelve a pedir y la huella nueva lo destraba (`hayQueTranscribir`).
    cuerpo = (
      <p className="spyd-nota">
        {CLAVE_SPY_RECHAZADA}
        <BotonIntegracion servicio="apify-instagram" className="spy-boton" style={CON_SU_CLASE} onConectado={onConectado}>Revisar la clave</BotonIntegracion>
      </p>
    );
  } else if (guion.estado === 'listo' && guion.texto) {
    const texto = guion.texto;
    cuerpo = <div className="spyd-guion">{texto.split(/\n{2,}/).map((t, i) => <p key={i}>{t}</p>)}</div>;
    return (
      <section>
        <div className="spyd-titulo">
          <h4>Guion</h4>
          <button type="button" className="spyd-mini" onClick={() => { void navigator.clipboard.writeText(texto).then(() => setCopiado(true)); }}>
            <Icon name="copy" size={13} /> {copiado ? 'Copiado' : 'Copiar'}
          </button>
        </div>
        {cuerpo}
        {guion.motivo ? <p className="spyd-nota">{guion.motivo}</p> : null}
      </section>
    );
  } else {
    cuerpo = guion.motivo ? <p className="spyd-nota">{guion.motivo}</p> : null;
  }
  if (!cuerpo) return null;
  return <section><div className="spyd-titulo"><h4>Guion</h4></div>{cuerpo}</section>;
}

/** Un número de la fila de arriba: su rótulo, su valor y, si hace falta, su tono y su explicación (el título al pasar). */
type NumeroDetalle = { k: string; v: string; tono?: string; titulo?: string };

/**
 * LA CAJA donde se dibuja el detalle. En la computadora es el `Modal` de la casa (el default de abajo);
 * en el teléfono es una `SheetM` de MaKo Mobile, que es la ÚNICA diferencia entre los dos —el contenido,
 * el guion y «Hacer uno así» son los mismos—. Sin esta puerta, /m tendría que importar `Modal`, que es de
 * escritorio y no se usa ahí (AGENTS.md → «MaKo Mobile»), o copiar la pieza entera.
 */
export type MarcoDetalle = (partes: {
  titulo: ReactNode;
  /** El tipo de pieza y su puesto: va arriba del título, chico. */
  encabezado: ReactNode;
  /** La nota y «Hacer uno así»: en un pie que no scrollea. */
  pie: ReactNode;
  onCerrar: () => void;
  children: ReactNode;
}) => ReactNode;

const MARCO_MODAL: MarcoDetalle = ({ titulo, encabezado, pie, onCerrar, children }) => (
  <Modal titulo={titulo} encabezado={encabezado} ancho={980} alto="min(90vh, 800px)" onCerrar={onCerrar} pie={pie}>
    {children}
  </Modal>
);

/**
 * Desarma el video antes de copiarlo (ticket 97): la ruta devuelve lo guardado si ya está. Si otra pestaña lo está mirando, espera
 * a que termine (hasta 3 minutos). Nunca tira: si no se pudo, «Hacer uno así» copia sin la edición.
 */
async function desarmarAntes(fuente: FuenteDesarme, duracionS: number | null): Promise<void> {
  const pedir = (cuerpo: Record<string, unknown>) => fetch('/api/video-editor/desarmar', {
    method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify(cuerpo),
  }).then((r) => r.json() as Promise<{ ok?: boolean; motivo?: string; vista?: { estado?: string } }>).catch(() => null);
  const clave = claveDeDesarme(fuente.red, fuente.id);
  if (!clave) return;
  // La caja «Desarmar» de al lado lo muestra mientras tanto (en vez de ofrecer el botón).
  avisarDesarme(clave, false);
  try {
    const r = await pedir({ accion: 'desarmar', fuente, duracionS });
    if (r?.ok || r?.motivo !== 'ocupado') return;
    for (let i = 0; i < 36; i++) {
      await new Promise((listo) => setTimeout(listo, 5_000));
      const v = await pedir({ accion: 'ver', clave });
      if (v?.vista?.estado !== 'mirando') return;
    }
  } finally {
    avisarDesarme(clave, true);
  }
}

/** Una publicación de Instagram que no es video, o un anuncio de imagen: lo que la réplica de Image sabe leer. */
const esImagenDeSpy = (p: Pick<PiezaVista, 'canal' | 'tipo' | 'medio'>): boolean =>
  (p.canal === 'instagram' && p.tipo === 'publicacion' && p.medio !== 'video') || (p.canal === 'anuncios' && p.tipo === 'anuncio' && p.medio !== 'video');

export function DetallePieza({ p, nombre, cara = null, seguidores = null, todas, analizando, onCerrar, marco = MARCO_MODAL }: {
  p: PiezaVista;
  /** El nombre del competidor. */
  nombre: string;
  /** Su foto de perfil real (dentro del análisis privado del negocio, como la ficha). */
  cara?: string | null;
  /** «120 K seguidores» o «45 K suscriptores», ya dicho. */
  seguidores?: string | null;
  /** Las piezas del gráfico, para su puesto («#51 de 420») y su mediana. */
  todas: readonly PiezaVista[];
  analizando: boolean;
  onCerrar: () => void;
  /** La caja donde se dibuja (ver `MarcoDetalle`). Por defecto, el `Modal` de la computadora. */
  marco?: MarcoDetalle;
}) {
  const router = useRouter();
  const [copiando, setCopiando] = useState(false);
  // «Hacer uno así» de un video lo DESARMA primero (ticket 97): mientras, el botón lo dice.
  const [desarmando, setDesarmando] = useState(false);
  const [copiada, setCopiada] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const { guion, pedir } = useGuion(p);
  const fuenteVideo = useMemo(() => fuenteDePiezaSpy(p, nombre), [p, nombre]);

  const red = redDePieza(p.canal);
  const puesto = puestoDe(p.id, todas);
  // Su «3,7×»: la única cuenta de MaKo (lib/multiplo-rendimiento.ts). Sin número, se dice por qué («Sin datos suficientes»).
  const x = useMemo(() => multiplosDe(todas).get(p.id) ?? null, [todas, p.id]);
  const mini = miniaturaDePieza(p);
  const esVideoYt = p.canal === 'youtube' && /^[\w-]{11}$/.test(p.ref);
  const prop = proporcionDe(p);
  const ancho = prop.ancho > prop.alto;
  const a = p.analisis;
  const leida = !!(a && (a.gancho || a.angulo));
  // El mismo formato que la cuenta en «¿Qué formatos le funcionan?»: el de la IA, o el que la pieza dice de sí misma.
  const formatoId = (a?.formato && a.formato !== 'otro' ? a.formato : '') || formatoPorTexto(`${p.titulo ?? ''}\n${p.texto ?? ''}`);
  const formato = FORMATOS.find((f) => f.value === formatoId && f.value !== 'otro')?.label ?? null;
  const tags = hashtagsDe(p.texto);
  const posibles: Array<NumeroDetalle | null> = [
    p.vistas != null ? { k: 'Vistas', v: dibujarContador(p.vistas) } : null,
    p.megusta != null ? { k: 'Me gusta', v: dibujarContador(p.megusta) } : null,
    p.comentarios != null ? { k: 'Comentarios', v: dibujarContador(p.comentarios) } : null,
    // Sólo con su número (11/11/2026, mirado con capturas). Sin él, la cuarta cifra decía el motivo —«Falta un trámite con YouTube»,
    // «Menos de una semana»— en una celda de 96 px, cortado («Frente a lo qu… · Falta un trá…») y sin que se entendiera. La regla
    // de Martín (22/10): si un dato no está, no se muestra.
    x && x.veces != null ? {
      // Corto, para que entre en su celda; el porqué completo va en el globo (`explicarMultiplo`).
      k: 'Frente a su cuenta',
      v: rotuloCortoDeMultiplo(x), titulo: explicarMultiplo(x),
      tono: x.veces == null ? 'apagado' : x.veces >= 1.5 ? 'good' : x.veces < 0.5 ? 'bad' : undefined,
    } : null,
  ];
  const numeros = posibles.filter((n): n is NumeroDetalle => !!n);
  // Lo que dice su texto: la descripción de un video de YouTube o el texto de una publicación o un anuncio. El de un reel
  // va arriba, en su guion: su texto es el que acompaña al video y se ve en Instagram.
  // Sus links, como su sitio y su camino (sin el «?utm_…» que llenaba renglones); antes que los hashtags, por el «#» de un link.
  const textoPropio = (p.texto ? linksLegibles(p.texto) : '').replace(/#[\p{L}\p{N}_]+/gu, '').trim() || null;
  const rotuloTexto = esVideoYt ? 'Descripción' : 'Su texto';

  const hacerUnoAsi = async () => {
    setCopiando(true); setError(null); setCopiada(false);
    try {
      // Un video: la edición también se copia (13/11/2026, Martín en la llamada con Julio: «la edición también la copia, saca
      // fotograma por fotograma»). Se desarma con el Gemini del negocio (o se toma lo guardado: no se paga dos veces) y la ruta de
      // copiar lo escribe en la página. Si no se puede (sin Gemini, sin el video), se copia igual, como antes.
      if (fuenteVideo) {
        setDesarmando(true);
        await desarmarAntes(fuenteVideo, segundosIso(p.duracion)).finally(() => setDesarmando(false));
      }
      const r = await fetch('/api/competitor-spy/copiar', {
        method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify({ piezaId: p.id }),
      });
      const j = (await r.json().catch(() => null)) as { ok?: boolean; href?: string; texto?: string; error?: string } | null;
      if (j?.href) { router.push(j.href); return; }
      if (j?.texto) {
        // Sin el Copywriter (o si no se pudo crear la página), su estructura se lleva copiada: sirve igual.
        await navigator.clipboard.writeText(j.texto);
        setCopiada(true);
        return;
      }
      setError(j?.error ?? 'No pude armar uno con su estructura.');
    } catch {
      setError('No pude armar uno con su estructura. Revisa tu conexión y vuelve a intentar.');
    } finally {
      setCopiando(false);
    }
  };

  const Marco = marco;
  return (
    <Marco
      titulo={p.titulo || a?.gancho || `Una pieza de ${nombre}`}
      encabezado={(
        <span className="spyd-red">
          {red && <LogoRed red={redDePieza(p.canal)!} box={16} />}
          {[RED[p.canal], TIPO[p.tipo], puesto].filter(Boolean).join(' · ')}
        </span>
      )}
      onCerrar={onCerrar}
      pie={(
        <>
          <span className="spyd-pie-nota" aria-live="polite">{copiada ? 'Copié su estructura: pégala donde quieras.' : 'MaKo arma el tuyo con su estructura y tu oferta.'}</span>
          <button type="button" className="mk-btn mk-btn--primary mk-btn--lg spyd-hacer" disabled={copiando} onClick={() => void hacerUnoAsi()}>
            <MakoStar size={18} color="currentColor" animate={copiando} /> {desarmando ? 'Desarmando el video…' : copiando ? 'Armándolo…' : 'Hacer uno así'}
          </button>
        </>
      )}
    >
      <style>{CSS}</style>
      <BrandDefs />
      <div className="spyd" data-ancho={ancho}>
        <div className="spyd-media" style={{ aspectRatio: `${prop.ancho} / ${prop.alto}` }}>
          {esVideoYt
            ? <iframe src={`https://www.youtube-nocookie.com/embed/${encodeURIComponent(p.ref)}?rel=0&playsinline=1`} title={p.titulo ?? 'Video'} allow="fullscreen; picture-in-picture; encrypted-media" allowFullScreen loading="lazy" />
            : (
              <>
                {/* eslint-disable-next-line @next/next/no-img-element -- la sirve el CDN del canal; sin referrer, Meta contesta 403 */}
                {mini && <img src={mini} alt="" referrerPolicy="no-referrer" onError={(e) => { e.currentTarget.remove(); }} />}
                {p.url && (
                  <a className="spyd-media__ir" href={p.url} target="_blank" rel="noreferrer noopener">
                    {red && <LogoRed red={red} box={16} />}Ver en {RED[p.canal] ?? 'su red'}
                  </a>
                )}
              </>
            )}
        </div>

        <div className="spyd-info">
          <div className="spyd-quien">
            {/* eslint-disable-next-line @next/next/no-img-element -- su foto ya está en nuestro Storage o en el CDN de su red */}
            {/* La inicial, de la pieza de la casa: `slice(0, 1)` de «🔥 Alex» es media pieza del emoji y tira la pantalla
                al hidratar (ver SpyApp.tsx). En Spy los nombres vienen de Instagram, donde el emoji es la norma. */}
            {cara ? <img src={cara} alt="" referrerPolicy="no-referrer" /> : <span data-cara aria-hidden>{iniciales(nombre, 1, '·')}</span>}
            <div>
              <b>{nombre}</b>
              {seguidores && <small>{seguidores}</small>}
            </div>
            {p.publicada_en && <time dateTime={p.publicada_en}>{fechaCorta(p.publicada_en)}</time>}
          </div>

          {numeros.length > 0 && (
            <div className="spyd-nums">
              {numeros.map((n) => <div key={n.k} className="spyd-num" data-tono={n.tono} title={n.titulo}><span>{n.k}</span><b>{n.v}</b></div>)}
            </div>
          )}

          {/* Sin leer y sin la IA leyendo, el bloque no va: un bloque vacío no dice «falta». */}
          {(leida || analizando) && (
            <section>
              <div className="spyd-titulo"><h4>Su estructura</h4></div>
              {leida ? (
                <dl className="spyd-props">
                  {a?.gancho && <div><dt>Gancho</dt><dd>{a.gancho}</dd></div>}
                  {a?.angulo && <div><dt>Ángulo</dt><dd>{a.angulo}</dd></div>}
                  {formato && <div><dt>Formato</dt><dd>{formato}</dd></div>}
                </dl>
              ) : <p className="spyd-nota"><span className="spyd-vivo" aria-live="polite"><i />Analizando…</span></p>}
            </section>
          )}

          {error && <p className="spy-aviso spy-error" role="alert">{error}<ReportarASoporte error={error} accion="Hacer uno así en Competitors Spy" /></p>}

          <BloqueGuion guion={guion} onConectado={pedir} />

          {/* Ticket 97: un video (reel, YouTube, anuncio en video) se desarma plano a plano con el Gemini del negocio. */}
          {fuenteVideo ? <Desarmar fuente={fuenteVideo} duracionS={segundosIso(p.duracion)} editor={marco === MARCO_MODAL} /> : null}
          {/* Un carrusel o una imagen de anuncio: estructura, textos exactos, tipografía y paleta, y «Replicar en Image». */}
          {!fuenteVideo && esImagenDeSpy(p) ? <DesarmarImagen piezaId={p.id} /> : null}

          {textoPropio && (
            <section>
              <div className="spyd-titulo"><h4>{rotuloTexto}</h4></div>
              {/* Un video de YouTube no tiene guion arriba: su descripción usa el alto del modal (`min(90vh, 800px)` menos los
                  480 px de lo demás: 320 a 900 de alto, sin una segunda barra en el modal). Con 180, la caja se cortaba con su
                  barra y quedaban ~165 px vacíos debajo (mirado en producción el 11/11/2026). */}
              <div className="spyd-guion" style={{ maxHeight: esVideoYt ? 'clamp(180px, calc(min(90vh, 800px) - 480px), 320px)' : 180 }}><p style={{ whiteSpace: 'pre-wrap' }}>{textoPropio}</p></div>
            </section>
          )}
          {tags.length > 0 && <div className="spyd-tags">{tags.map((t) => <span key={t}>{t}</span>)}</div>}
        </div>
      </div>
    </Marco>
  );
}
