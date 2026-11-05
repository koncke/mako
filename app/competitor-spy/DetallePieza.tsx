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
import { BotonIntegracion } from '../_components/ConectarIntegracion';
import { LogoRed, redDePieza } from './LogoRed';
import { Modal } from '@/app/_ui/Modal';
import { useRouter } from '@/app/_ui/Link';
import { ReportarASoporte } from '@/app/_ui/ReportarASoporte';
import { FORMATOS, formatoPorTexto, proporcionDe, puestoDe } from '@/lib/spy-detalle';
import { explicarMultiplo, multiplosDe, rotuloCortoDeMultiplo } from '@/lib/multiplo-rendimiento';
import { dibujarContador } from '@/lib/spy-reglas';
import { fechaCorta, miniaturaDePieza } from '@/lib/spy-vista';
import { tieneGuion, type VistaGuion } from '@/lib/spy-transcripcion';
import type { PiezaVista } from './actions';

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
        <BotonIntegracion servicio="openai" className="spy-boton" onConectado={onConectado}>Conectar GPT</BotonIntegracion>
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
        <BotonIntegracion servicio="apify-instagram" className="spy-boton" onConectado={onConectado}>Conectar</BotonIntegracion>
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

export function DetallePieza({ p, nombre, cara = null, seguidores = null, todas, analizando, onCerrar }: {
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
}) {
  const router = useRouter();
  const [copiando, setCopiando] = useState(false);
  const [copiada, setCopiada] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const { guion, pedir } = useGuion(p);

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
    x && !(x.veces == null && x.motivo === 'sin-formato') ? {
      k: x.formato === 'anuncio' ? 'Tiempo activo frente a su cuenta' : 'Frente a lo que suele hacer',
      v: rotuloCortoDeMultiplo(x), titulo: explicarMultiplo(x),
      tono: x.veces == null ? 'apagado' : x.veces >= 1.5 ? 'good' : x.veces < 0.5 ? 'bad' : undefined,
    } : null,
  ];
  const numeros = posibles.filter((n): n is NumeroDetalle => !!n);
  // Lo que dice su texto: la descripción de un video de YouTube o el texto de una publicación o un anuncio. El de un reel
  // va arriba, en su guion: su texto es el que acompaña al video y se ve en Instagram.
  const textoPropio = p.texto?.replace(/#[\p{L}\p{N}_]+/gu, '').trim() || null;
  const rotuloTexto = esVideoYt ? 'Descripción' : 'Su texto';

  const hacerUnoAsi = async () => {
    setCopiando(true); setError(null); setCopiada(false);
    try {
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

  return (
    <Modal
      titulo={p.titulo || a?.gancho || `Una pieza de ${nombre}`}
      encabezado={(
        <span className="spyd-red">
          {red && <LogoRed red={redDePieza(p.canal)!} box={16} />}
          {[RED[p.canal], TIPO[p.tipo], puesto].filter(Boolean).join(' · ')}
        </span>
      )}
      ancho={980}
      alto="min(90vh, 800px)"
      onCerrar={onCerrar}
      pie={(
        <>
          <span className="spyd-pie-nota" aria-live="polite">{copiada ? 'Copié su estructura: pégala donde quieras.' : 'MaKo arma el tuyo con su estructura y tu oferta.'}</span>
          <button type="button" className="mk-btn mk-btn--primary mk-btn--lg spyd-hacer" disabled={copiando} onClick={() => void hacerUnoAsi()}>
            <MakoStar size={18} color="currentColor" animate={copiando} /> {copiando ? 'Armándolo…' : 'Hacer uno así'}
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
            {cara ? <img src={cara} alt="" referrerPolicy="no-referrer" /> : <span data-cara aria-hidden>{nombre.slice(0, 1).toUpperCase()}</span>}
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

          {textoPropio && (
            <section>
              <div className="spyd-titulo"><h4>{rotuloTexto}</h4></div>
              <div className="spyd-guion" style={{ maxHeight: 180 }}><p style={{ whiteSpace: 'pre-wrap' }}>{textoPropio}</p></div>
            </section>
          )}
          {tags.length > 0 && <div className="spyd-tags">{tags.map((t) => <span key={t}>{t}</span>)}</div>}
        </div>
      </div>
    </Modal>
  );
}
