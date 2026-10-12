'use client';

// =============================================================================
// DialogoPublicar — «Publicar» + «Ajustes del sitio» de Gamma Sites
// =============================================================================
// Pedido de Martín (11/10/2026): «Replica por completo a Gamma». Copia del panel de sitio de
// Gamma (gamma-ui.md §6.2): la caja de estado («Tu sitio está listo para publicar» · «Tienes
// cambios que publicar» · «Tu sitio está actualizado» · «Tu sitio actualmente está
// deshabilitado») con [Publicar sitio], el interruptor del sitio, y los ajustes: dirección,
// nombre del sitio, favicon, la barra de navegación (logo, hasta 5 enlaces y 2 botones), el
// pie de página, el SEO con «Vista previa de la búsqueda» y «Compartir vista previa», la
// imagen para compartir, «Permitir la indexación en buscadores», el Píxel de Meta y «Hecho con
// MaKo». Abajo, «Anular publicación».
//
// PUBLICAR PROMUEVE LO GUARDADO (AGENTS.md «Un BORRADOR no es un DEFAULT, y publicar promueve
// lo GUARDADO»; D4 del diseño): `publicarSitio` llama PRIMERO a `guardarAhora()` —que manda lo
// pendiente y cancela el respiro del autoguardado— y publica la VERSIÓN que eso devuelve. El
// server renderiza desde la fila y exige esa versión: si otra pestaña guardó en el medio, es
// un conflicto y no se publica nada. tests/editor-landing-exportar.test.ts lo fija leyendo
// este archivo.
//
// Los ajustes del sitio son `config.sitio` y se escriben con `setConfig` (vía `useConfigViva`,
// que arma cada cambio desde la última configuración): el armazón los guarda con el resto. La
// dirección (slug), el interruptor del sitio y anular la publicación van directo al server
// (`slugDisponible`, `publicar`, `sitioActivo`, `despublicar`): son de la fila, no del documento.
//
// ⚠️ El contexto no trae el slug ni si el sitio está activo (contexto.ts). Al abrir se leen con
// `{accion:'abrir'}` (una lectura; nada de esto escribe el documento). Si esa lectura falla, el
// slug sale de `urlPublica` y el interruptor queda sin dibujar: no se afirma un estado que no se
// leyó.
//
// Lo que NO se dibuja, a propósito (decisión D4): dominio propio, Google Tag Manager y código
// personalizado. La sesión de MaKo es una cookie del mismo origen: un script ajeno en
// hola-mako.com podría llamar `/api/*` como el que mira. El Píxel de Meta sí: el código oficial
// lo arma el server con un id de sólo dígitos.
// =============================================================================

import { useEffect, useMemo, useRef, useState, type ReactNode } from 'react';
import { BotonBorrar } from '@/app/_ui/BotonBorrar';
import { APP_BASE_URL } from '@/lib/app-url';
import { PREFIJO_PUBLICO, slugDe, slugValido, textoDe, tituloDeTarjeta, type JsonNodo } from '@/lib/editor-landing/doc';
import { hrefPermitido } from '@/lib/editor-landing/especificacion';
import type { BotonNav, ConfigLanding, EnlaceNav } from '@/lib/editor-landing/api-tipos';
import { useEditorLanding } from '../contexto';
import {
  Campo, CampoImagen, EstilosGmp, FilaAjuste, Giro, Icono, Interruptor, MenuGma, ModalGma, Pestanas, Segmentado,
  cambiarSitio, copiarTexto, pedir, sinAcentos, useConfigViva, useConfirmaGma, useFijo, useRebote,
} from './piezas-gma';

const HOST = (() => { try { return new URL(APP_BASE_URL).host; } catch { return 'hola-mako.com'; } })();

/** Lo que se escribe en el campo de la dirección, ya en forma de slug (sin recortar guiones mientras se tipea). */
export function slugEscrito(v: string): string {
  return sinAcentos(v).replace(/\s+/g, '-').replace(/[^a-z0-9-]/g, '').replace(/-{2,}/g, '-').slice(0, 60);
}

/** El slug de una URL pública (`…/l/<slug>` o `…/l/<slug>/<ruta>`), o null. */
export function slugDeUrl(url: string | null): string | null {
  if (!url) return null;
  const tras = url.split(PREFIJO_PUBLICO + '/')[1];
  const s = tras ? tras.split(/[/?#]/)[0] : '';
  return s || null;
}

/** Sólo los dígitos, hasta 20 (el id de un Píxel de Meta). */
export function pixelEscrito(v: string): string {
  return v.replace(/\D/g, '').slice(0, 20);
}

type Info = { slug: string | null; sitioActivo: boolean | null; publicadoAt: string | null };
type Chequeo = { slug: string; disponible: boolean; motivo: string | null; sugerencia: string | null };
type Pestana = 'ajustes' | 'navegacion' | 'seo';

const CSS_PUBLICAR = [
  '.gmp-estado{display:flex;align-items:center;gap:12px;padding:14px 16px;margin-bottom:14px;border-radius:12px;background:var(--gmp-suave)}',
  '.gmp-estado-icono{display:inline-flex;align-items:center;justify-content:center;width:36px;height:36px;flex:none;border-radius:50%;background:var(--gmp-azul-claro);color:var(--gmp-sobre-azul-claro)}',
  '.gmp-estado-tit{flex:1;min-width:0;font-size:14px;font-weight:600;color:var(--gmp-tinta)}',
  '.gmp-url-pub{display:flex;align-items:center;gap:6px;margin:-4px 0 14px;padding:8px 10px;border:1px solid var(--gmp-borde);border-radius:8px}',
  '.gmp-url-pub a{flex:1;min-width:0;overflow:hidden;text-overflow:ellipsis;white-space:nowrap;color:var(--gmp-azul-linea);font-weight:500;text-decoration:none}',
  '.gmp-url-pub a:hover{text-decoration:underline}',
  '.gmp-direccion{display:flex;align-items:stretch;border:1px solid var(--gmp-borde);border-radius:6px;overflow:hidden;background:var(--gmp-fondo)}',
  '.gmp-direccion:focus-within{border-color:var(--gmp-azul-linea);box-shadow:0 0 0 1px var(--gmp-azul-linea)}',
  '.gmp-direccion span{display:flex;align-items:center;padding:0 4px 0 12px;background:var(--gmp-suave);color:var(--gmp-tenue);font-size:14px;white-space:nowrap}',
  '.gmp-direccion input{flex:1;min-width:0;height:36px;padding:0 10px;border:0;background:transparent;color:var(--gmp-tinta);font:inherit;font-size:14px;outline:none}',
  '.gmp-chequeo{display:flex;align-items:center;gap:6px;min-height:18px;font-size:12px}',
  '.gmp-nav-tarjetas{display:grid;grid-template-columns:1fr 1fr;gap:10px;margin-bottom:16px}',
  '.gmp-nav-tarjeta{display:grid;gap:8px;padding:10px;border:1.5px solid var(--gmp-borde);border-radius:12px;background:var(--gmp-fondo);color:var(--gmp-tinta);font-size:13px;font-weight:600;text-align:left;cursor:pointer}',
  '.gmp-nav-tarjeta[aria-pressed="true"]{border-color:var(--gmp-azul-linea);background:var(--gmp-azul-claro);color:var(--gmp-sobre-azul-claro)}',
  '.gmp-fila-enlace{display:grid;grid-template-columns:minmax(0,1fr) minmax(0,1.3fr) auto;gap:6px;align-items:center;margin-bottom:6px}',
  '.gmp-fila-boton{display:grid;grid-template-columns:minmax(0,1fr) minmax(0,1.3fr) auto auto;gap:6px;align-items:center;margin-bottom:6px}',
  '.gmp-google{padding:14px 16px;border:1px solid var(--gmp-borde);border-radius:12px;background:#fff;font-family:Arial,Helvetica,sans-serif}',
  '.gmp-google-sitio{display:flex;align-items:center;gap:8px;font-size:12px;color:#202124}',
  '.gmp-google-sitio i{display:inline-flex;width:26px;height:26px;border-radius:50%;background:#f1f3f4 center/16px no-repeat}',
  '.gmp-google-url{color:#4d5156;font-size:12px}',
  '.gmp-google-tit{margin:6px 0 3px;color:#1a0dab;font-size:19px;line-height:1.3;overflow:hidden;text-overflow:ellipsis;white-space:nowrap}',
  '.gmp-google-desc{color:#4d5156;font-size:13.5px;line-height:1.55;display:-webkit-box;-webkit-line-clamp:2;-webkit-box-orient:vertical;overflow:hidden}',
  '.gmp-og{max-width:420px;border:1px solid var(--gmp-borde);border-radius:12px;overflow:hidden;background:var(--gmp-fondo)}',
  '.gmp-og-img{aspect-ratio:1.91/1;background:var(--gmp-suave) center/cover no-repeat;display:flex;align-items:center;justify-content:center;color:var(--gmp-tenue)}',
  '.gmp-og-cuerpo{padding:10px 12px;border-top:1px solid var(--gmp-borde)}',
  '.gmp-og-dom{font-size:11px;letter-spacing:.04em;text-transform:uppercase;color:var(--gmp-tenue)}',
  '.gmp-og-tit{margin:2px 0;font-size:14.5px;font-weight:600;color:var(--gmp-tinta);overflow:hidden;text-overflow:ellipsis;white-space:nowrap}',
  '.gmp-og-desc{font-size:12.5px;color:var(--gmp-texto);overflow:hidden;text-overflow:ellipsis;white-space:nowrap}',
  '@media (max-width:560px){.gmp-fila-enlace,.gmp-fila-boton{grid-template-columns:minmax(0,1fr) auto}.gmp-nav-tarjetas{grid-template-columns:1fr}}',
].join('\n');

// ─────────────────────────────────────────────────────────────────────────────
// El destino de un enlace de la barra: una sección, una página o una URL
// ─────────────────────────────────────────────────────────────────────────────

type Destinos = { secciones: { valor: string; texto: string }[]; paginas: { valor: string; texto: string }[] };

function useDestinos(): () => Destinos {
  const { editor, paginas, paginaActual } = useEditorLanding();
  return () => {
    const pag = paginas.find((p) => p.id === paginaActual) ?? paginas[0];
    const nodos = (editor ? (editor.getJSON().content as JsonNodo[] | undefined) : pag?.doc.content) ?? [];
    const secciones = nodos
      .filter((n) => n.type === 'tarjeta' && typeof n.attrs?.id === 'string')
      .map((n) => ({ valor: '#t-' + String(n.attrs!.id), texto: tituloDeTarjeta(n) || 'Sección sin título' }));
    return { secciones, paginas: paginas.map((p) => ({ valor: 'pagina:' + p.id, texto: p.titulo || (p.ruta ? '/' + p.ruta : 'Inicio') })) };
  };
}

function SelectorDestino({ valor, onCambiar, etiqueta }: { valor: string; onCambiar: (v: string) => void; etiqueta: string }) {
  const destinos = useDestinos();
  const [abierto, setAbierto] = useState<Destinos | null>(null);
  const [url, setUrl] = useState('');
  const btn = useRef<HTMLButtonElement>(null);
  const rotulo = useMemo(() => {
    if (!valor || valor === '#') return 'Sin destino';
    const d = destinos();
    return d.secciones.find((s) => s.valor === valor)?.texto ?? d.paginas.find((p) => p.valor === valor)?.texto ?? valor;
    // `destinos` lee el editor en el momento: el rótulo se recalcula cuando cambia el valor.
  }, [valor]); // eslint-disable-line react-hooks/exhaustive-deps
  const urlValida = url.trim() ? hrefPermitido(url.trim()) : null;
  const aplicarUrl = () => { if (urlValida) { onCambiar(urlValida); setAbierto(null); } };
  return (
    <>
      <button ref={btn} type="button" className="gmp-selector" aria-label={etiqueta} aria-haspopup="menu"
        onClick={() => { setUrl(/^(https?:|mailto:|tel:)/i.test(valor) ? valor : ''); setAbierto(abierto ? null : destinos()); }}>
        <span>{rotulo}</span><Icono nombre="flecha" tam={14} />
      </button>
      {abierto && (
        <MenuGma ancla={btn.current} onCerrar={() => setAbierto(null)} ancho={280} etiqueta={etiqueta}>
          {abierto.secciones.length > 0 && <div className="gmp-menu-grupo">Secciones</div>}
          {abierto.secciones.map((s) => (
            <button key={s.valor} type="button" role="menuitem" className="gmp-menu-item" data-activo={s.valor === valor ? '' : undefined}
              onClick={() => { onCambiar(s.valor); setAbierto(null); }}>
              <Icono nombre="secciones" tam={14} /><span>{s.texto}</span>
            </button>
          ))}
          {abierto.paginas.length > 1 && <div className="gmp-menu-grupo">Páginas</div>}
          {abierto.paginas.length > 1 && abierto.paginas.map((p) => (
            <button key={p.valor} type="button" role="menuitem" className="gmp-menu-item" data-activo={p.valor === valor ? '' : undefined}
              onClick={() => { onCambiar(p.valor); setAbierto(null); }}>
              <Icono nombre="pagina" tam={14} /><span>{p.texto}</span>
            </button>
          ))}
          <div className="gmp-menu-grupo">URL</div>
          <div style={{ display: 'flex', gap: 6, padding: '0 4px 4px' }}>
            <input className="gmp-input" data-autofoco value={url} placeholder="https://" aria-label="URL del enlace" style={{ height: 32 }}
              onChange={(e) => setUrl(e.target.value)} onKeyDown={(e) => { if (e.key === 'Enter') { e.preventDefault(); aplicarUrl(); } }} />
            <button type="button" className="gmp-btn gmp-btn-primario gmp-btn-chico" disabled={!urlValida} onClick={aplicarUrl}>Usar</button>
          </div>
        </MenuGma>
      )}
    </>
  );
}

// ─────────────────────────────────────────────────────────────────────────────
// El diálogo
// ─────────────────────────────────────────────────────────────────────────────

export function DialogoPublicar({ onCerrar }: { onCerrar?: () => void } = {}) {
  const { dialogo } = useEditorLanding();
  if (dialogo !== 'publicar') return null;
  return <DialogoPublicarAbierto onCerrar={onCerrar} />;
}

function DialogoPublicarAbierto({ onCerrar }: { onCerrar?: () => void }) {
  const {
    docId, titulo, guardarAhora, setDialogo, urlPublica, cambiosSinPublicar, estado, recargar, avisar, paginas, contenido,
  } = useEditorLanding();
  const { config, cambiar } = useConfigViva();
  const { confirmar, nodoConfirma } = useConfirmaGma();
  const cerrar = useFijo(() => (onCerrar ? onCerrar() : setDialogo(null)));
  const sitio = config.sitio;
  const ponerSitio = (parcial: Partial<ConfigLanding['sitio']>) => cambiar((c) => cambiarSitio(c, parcial));
  const ponerNav = (parcial: Partial<ConfigLanding['sitio']['nav']>) => cambiar((c) => cambiarSitio(c, { nav: { ...c.sitio.nav, ...parcial } }));

  const [pestana, setPestana] = useState<Pestana>('ajustes');
  const [info, setInfo] = useState<Info | null>(null);
  const [slug, setSlug] = useState('');
  const [chequeo, setChequeo] = useState<Chequeo | null>(null);
  const [chequeando, setChequeando] = useState(false);
  const [publicando, setPublicando] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [url, setUrl] = useState<string | null>(urlPublica);
  const slugRebote = useRebote(slug, 400);

  // Lo que el contexto no trae: el slug guardado y el interruptor del sitio.
  useEffect(() => {
    let vivo = true;
    void (async () => {
      const r = await pedir<'abrir'>({ accion: 'abrir', id: docId });
      if (!vivo) return;
      if (r.ok) {
        setInfo({ slug: r.doc.slug, sitioActivo: r.doc.sitioActivo, publicadoAt: r.doc.publicadoAt });
        setSlug(r.doc.slug ?? slugDe(titulo));
        if (r.doc.urlPublica) setUrl(r.doc.urlPublica);
      } else {
        const s = slugDeUrl(urlPublica);
        // Sin la lectura no se sabe la fecha: alcanza con saber si hay una dirección publicada.
        setInfo({ slug: s, sitioActivo: null, publicadoAt: urlPublica ? new Date(0).toISOString() : null });
        setSlug(s ?? slugDe(titulo));
      }
    })();
    return () => { vivo = false; };
  }, [docId]); // eslint-disable-line react-hooks/exhaustive-deps

  // Chequeo en vivo de la dirección (con un respiro de 400 ms).
  useEffect(() => {
    const s = slugRebote;
    if (!s) { setChequeo(null); return; }
    let vivo = true;
    setChequeando(true);
    void pedir<'slugDisponible'>({ accion: 'slugDisponible', id: docId, slug: s }).then((r) => {
      if (!vivo) return;
      setChequeando(false);
      if (r.ok) setChequeo({ slug: r.slug, disponible: r.disponible, motivo: r.motivo, sugerencia: r.sugerencia });
      else setChequeo({ slug: s, disponible: false, motivo: r.error, sugerencia: null });
    });
    return () => { vivo = false; };
  }, [slugRebote, docId]);

  const publicado = !!info?.publicadoAt || !!url;
  const pendientes = cambiosSinPublicar || estado === 'sin-guardar' || estado === 'guardando';
  const slugListo = slugValido(slug) && chequeo?.slug === slug && chequeo.disponible;
  const puedePublicar = slugListo && !publicando && !chequeando && estado !== 'conflicto';

  const tituloEstado = !publicado ? 'Tu sitio está listo para publicar'
    : info?.sitioActivo === false ? 'Tu sitio actualmente está deshabilitado'
      : pendientes ? 'Tienes cambios que publicar' : 'Tu sitio está actualizado';

  /**
   * Publicar = guardar lo pendiente YA y publicar ESA versión. Nunca al revés: con el respiro
   * del autoguardado en curso, publicar sin guardar sale con el texto de hace un segundo y el
   * cartel dice «publicado».
   */
  const publicarSitio = async () => {
    setPublicando(true);
    setError(null);
    const version = await guardarAhora();
    if (version == null) {
      setPublicando(false);
      setError('No se pudo guardar');
      return;
    }
    const r = await pedir<'publicar'>({ accion: 'publicar', id: docId, version, slug });
    setPublicando(false);
    if (!r.ok) {
      setError(r.conflicto ? 'Hay una versión más nueva' : r.error);
      return;
    }
    setUrl(r.url);
    setInfo({ slug: r.slug, sitioActivo: true, publicadoAt: r.publicadoAt });
    avisar('Sitio publicado');
    void recargar();
  };

  const cambiarActivo = async (valor: boolean) => {
    const r = await pedir<'sitioActivo'>({ accion: 'sitioActivo', id: docId, valor });
    if (!r.ok) { setError(r.error); return; }
    setInfo((i) => (i ? { ...i, sitioActivo: r.sitioActivo } : i));
    avisar(r.sitioActivo ? 'Sitio habilitado' : 'Sitio deshabilitado');
  };

  const despublicar = async () => {
    const ok = await confirmar({ titulo: 'Anular publicación', texto: 'La dirección deja de mostrar la página.', boton: 'Anular publicación' });
    if (!ok) return;
    const r = await pedir<'despublicar'>({ accion: 'despublicar', id: docId });
    if (!r.ok) { setError(r.error); return; }
    setUrl(null);
    setInfo((i) => (i ? { ...i, publicadoAt: null } : i));
    avisar('Sitio sin publicar');
    void recargar();
  };

  const copiar = async () => { if (url && (await copiarTexto(url))) avisar('Enlace copiado'); };

  // ── Barra de navegación ──
  const destinos = useDestinos();
  const agregarEnlace = () => {
    if (sitio.nav.enlaces.length >= 5) return;
    const usadas = new Set(sitio.nav.enlaces.map((e) => e.destino));
    const libre = destinos().secciones.find((s) => !usadas.has(s.valor));
    const nuevo: EnlaceNav = libre ? { texto: libre.texto.slice(0, 40), destino: libre.valor } : { texto: 'Enlace', destino: '#' };
    ponerNav({ enlaces: [...sitio.nav.enlaces, nuevo], mostrar: true });
  };
  const ponerEnlace = (i: number, parcial: Partial<EnlaceNav>) => ponerNav({ enlaces: sitio.nav.enlaces.map((e, j) => (j === i ? { ...e, ...parcial } : e)) });
  const agregarBoton = () => {
    if (sitio.nav.botones.length >= 2) return;
    const nuevo: BotonNav = { texto: sitio.nav.botones.length ? 'Más información' : 'Empezar', destino: '#', estilo: sitio.nav.botones.length ? 'secundario' : 'primario' };
    ponerNav({ botones: [...sitio.nav.botones, nuevo], mostrar: true });
  };
  const ponerBoton = (i: number, parcial: Partial<BotonNav>) => ponerNav({ botones: sitio.nav.botones.map((b, j) => (j === i ? { ...b, ...parcial } : b)) });

  // ── SEO ──
  const pixel = sitio.metaPixelId ?? '';
  const pixelCorto = pixel.length > 0 && pixel.length < 5;
  const tituloBusqueda = sitio.seoTitulo.trim() || titulo || 'Landing';
  const inicio = contenido.paginas.find((p) => p.ruta === '') ?? paginas[0];
  const descripcionBusqueda = sitio.seoDescripcion.trim() || (inicio ? textoDe(inicio.doc as JsonNodo, ' ').replace(/\s+/g, ' ').trim().slice(0, 160) : '');
  const urlVista = url ?? `https://${HOST}${PREFIJO_PUBLICO}/${slug || 'tu-pagina'}`;

  let cuerpo: ReactNode;
  if (pestana === 'ajustes') {
    cuerpo = (
      <>
        <Campo etiqueta="Dirección" htmlFor="gmp-slug">
          <div className="gmp-direccion">
            <span>{HOST}{PREFIJO_PUBLICO}/</span>
            <input id="gmp-slug" value={slug} spellCheck={false} autoComplete="off" aria-label="Dirección de la página"
              onChange={(e) => setSlug(slugEscrito(e.target.value))} onBlur={() => setSlug((s) => s.replace(/^-+|-+$/g, ''))} />
          </div>
          <div className="gmp-chequeo" aria-live="polite">
            {chequeando || (slug && chequeo?.slug !== slug) ? <Giro chico etiqueta="Revisando" /> : null}
            {!chequeando && chequeo?.slug === slug && chequeo.disponible && <span className="gmp-ok"><Icono nombre="check" tam={13} style={{ display: 'inline' }} /> Disponible</span>}
            {!chequeando && chequeo?.slug === slug && !chequeo.disponible && (
              <>
                <span className="gmp-error">{chequeo.motivo ?? 'No disponible'}</span>
                {chequeo.sugerencia && (
                  <button type="button" className="gmp-btn gmp-btn-fantasma gmp-btn-chico" onClick={() => setSlug(chequeo.sugerencia!)}>
                    Usar {chequeo.sugerencia}
                  </button>
                )}
              </>
            )}
          </div>
        </Campo>
        <Campo etiqueta="Nombre del sitio" htmlFor="gmp-nombre-sitio">
          <input id="gmp-nombre-sitio" className="gmp-input" value={sitio.nombre} maxLength={80} placeholder={titulo}
            onChange={(e) => ponerSitio({ nombre: e.target.value })} />
        </Campo>
        <CampoImagen etiqueta="Favicon" valor={sitio.favicon} ancho={40} ayuda="128 × 128" onCambiar={(u) => ponerSitio({ favicon: u })} />
        <Campo etiqueta="Píxel de Meta (Facebook)" htmlFor="gmp-pixel" error={pixelCorto ? 'Entre 5 y 20 dígitos' : null}
          ayuda="El ID de tu píxel, del Administrador de eventos.">
          <input id="gmp-pixel" className="gmp-input" value={pixel} inputMode="numeric" placeholder="123456789012345"
            onChange={(e) => { const d = pixelEscrito(e.target.value); ponerSitio({ metaPixelId: d || null }); }} />
        </Campo>
        <hr className="gmp-sep" />
        <FilaAjuste titulo="Hecho con MaKo">
          <Interruptor etiqueta="Hecho con MaKo" activo={sitio.marcaMako} onCambiar={(v) => ponerSitio({ marcaMako: v })} />
        </FilaAjuste>
      </>
    );
  } else if (pestana === 'navegacion') {
    cuerpo = (
      <>
        <p className="gmp-grupo-tit">Navegación</p>
        <div className="gmp-nav-tarjetas" role="group" aria-label="Navegación">
          <button type="button" className="gmp-nav-tarjeta" aria-pressed={sitio.nav.mostrar} onClick={() => ponerNav({ mostrar: true })}>
            <svg viewBox="0 0 120 56" width="100%" aria-hidden><rect x="1" y="1" width="118" height="54" rx="6" fill="none" stroke="currentColor" opacity=".35" /><rect x="1" y="1" width="118" height="12" rx="6" fill="currentColor" opacity=".25" /><rect x="8" y="5" width="14" height="4" rx="2" fill="currentColor" /><rect x="70" y="5" width="12" height="4" rx="2" fill="currentColor" opacity=".6" /><rect x="86" y="5" width="12" height="4" rx="2" fill="currentColor" opacity=".6" /><rect x="102" y="4" width="12" height="6" rx="3" fill="currentColor" /></svg>
            Barra de navegación superior
          </button>
          <button type="button" className="gmp-nav-tarjeta" aria-pressed={!sitio.nav.mostrar} onClick={() => ponerNav({ mostrar: false })}>
            <svg viewBox="0 0 120 56" width="100%" aria-hidden><rect x="1" y="1" width="118" height="54" rx="6" fill="none" stroke="currentColor" opacity=".35" /><rect x="30" y="20" width="60" height="5" rx="2.5" fill="currentColor" opacity=".5" /><rect x="40" y="30" width="40" height="4" rx="2" fill="currentColor" opacity=".35" /></svg>
            Sin barra de navegación
          </button>
        </div>
        {sitio.nav.mostrar && (
          <>
            <CampoImagen etiqueta="Logotipo" valor={sitio.nav.logo} ancho={96} proporcion="3 / 1" onCambiar={(u) => ponerNav({ logo: u })} />
            <p className="gmp-grupo-tit">Enlaces</p>
            {sitio.nav.enlaces.map((e, i) => (
              <div key={i} className="gmp-fila-enlace">
                <input className="gmp-input" value={e.texto} maxLength={40} aria-label={`Texto del enlace ${i + 1}`} onChange={(ev) => ponerEnlace(i, { texto: ev.target.value })} />
                <SelectorDestino etiqueta={`Destino del enlace ${i + 1}`} valor={e.destino} onCambiar={(d) => ponerEnlace(i, { destino: d })} />
                <BotonBorrar talla="md" title={`Eliminar el enlace ${i + 1}`} onClick={() => ponerNav({ enlaces: sitio.nav.enlaces.filter((_, j) => j !== i) })} />
              </div>
            ))}
            {sitio.nav.enlaces.length < 5 && (
              <button type="button" className="gmp-btn gmp-btn-fantasma gmp-btn-chico" onClick={agregarEnlace}><Icono nombre="mas" tam={14} />Añadir un enlace</button>
            )}
            <p className="gmp-grupo-tit">Botones</p>
            {sitio.nav.botones.map((b, i) => (
              <div key={i} className="gmp-fila-boton">
                <input className="gmp-input" value={b.texto} maxLength={40} aria-label={`Texto del botón ${i + 1}`} onChange={(ev) => ponerBoton(i, { texto: ev.target.value })} />
                <SelectorDestino etiqueta={`Destino del botón ${i + 1}`} valor={b.destino} onCambiar={(d) => ponerBoton(i, { destino: d })} />
                <Segmentado etiqueta={`Estilo del botón ${i + 1}`} valor={b.estilo}
                  opciones={[{ valor: 'primario', texto: 'Primario' }, { valor: 'secundario', texto: 'Secundario' }]}
                  onCambiar={(v) => ponerBoton(i, { estilo: v })} />
                <BotonBorrar talla="md" title={`Eliminar el botón ${i + 1}`} onClick={() => ponerNav({ botones: sitio.nav.botones.filter((_, j) => j !== i) })} />
              </div>
            ))}
            {sitio.nav.botones.length < 2 && (
              <button type="button" className="gmp-btn gmp-btn-fantasma gmp-btn-chico" onClick={agregarBoton}><Icono nombre="mas" tam={14} />Añadir un botón</button>
            )}
          </>
        )}
        <hr className="gmp-sep" />
        <FilaAjuste titulo="Pie de página">
          <Interruptor etiqueta="Pie de página" activo={sitio.pie.mostrar} onCambiar={(v) => ponerSitio({ pie: { ...sitio.pie, mostrar: v } })} />
        </FilaAjuste>
        {sitio.pie.mostrar && (
          <Campo etiqueta="Texto del pie de página" contador={sitio.pie.texto.length} tope={300} htmlFor="gmp-pie">
            <textarea id="gmp-pie" className="gmp-input" value={sitio.pie.texto} maxLength={300}
              onChange={(e) => ponerSitio({ pie: { ...sitio.pie, texto: e.target.value } })} />
          </Campo>
        )}
      </>
    );
  } else {
    cuerpo = (
      <>
        <Campo etiqueta="Título" contador={sitio.seoTitulo.length} tope={60} htmlFor="gmp-seo-tit">
          <input id="gmp-seo-tit" className="gmp-input" value={sitio.seoTitulo} maxLength={60} placeholder={titulo}
            onChange={(e) => ponerSitio({ seoTitulo: e.target.value })} />
        </Campo>
        <Campo etiqueta="Descripción" contador={sitio.seoDescripcion.length} tope={160} htmlFor="gmp-seo-desc">
          <textarea id="gmp-seo-desc" className="gmp-input" value={sitio.seoDescripcion} maxLength={160}
            onChange={(e) => ponerSitio({ seoDescripcion: e.target.value })} />
        </Campo>
        <CampoImagen etiqueta="Imagen para compartir" valor={sitio.ogImagen} ancho={96} proporcion="1.91 / 1" ayuda="1200 × 630"
          onCambiar={(u) => ponerSitio({ ogImagen: u })} />
        <FilaAjuste titulo="Permitir la indexación en buscadores">
          <Interruptor etiqueta="Permitir la indexación en buscadores" activo={sitio.indexar} onCambiar={(v) => ponerSitio({ indexar: v })} />
        </FilaAjuste>
        <p className="gmp-grupo-tit">Vista previa de la búsqueda</p>
        <div className="gmp-google" aria-label="Vista previa de la búsqueda">
          <div className="gmp-google-sitio">
            <i style={sitio.favicon ? { backgroundImage: `url("${sitio.favicon}")` } : undefined} />
            <div><div>{sitio.nombre.trim() || HOST}</div><div className="gmp-google-url">{urlVista.replace(/^https?:\/\//, '')}</div></div>
          </div>
          <div className="gmp-google-tit">{tituloBusqueda}</div>
          <div className="gmp-google-desc">{descripcionBusqueda || ' '}</div>
        </div>
        <p className="gmp-grupo-tit">Compartir vista previa</p>
        <div className="gmp-og" aria-label="Compartir vista previa">
          <div className="gmp-og-img" style={sitio.ogImagen ? { backgroundImage: `url("${sitio.ogImagen}")` } : undefined}>
            {!sitio.ogImagen && <Icono nombre="imagen" tam={26} />}
          </div>
          <div className="gmp-og-cuerpo">
            <div className="gmp-og-dom">{HOST}</div>
            <div className="gmp-og-tit">{tituloBusqueda}</div>
            {descripcionBusqueda && <div className="gmp-og-desc">{descripcionBusqueda}</div>}
          </div>
        </div>
      </>
    );
  }

  return (
    <ModalGma titulo="Publicar" icono={<Icono nombre="globo" tam={22} style={{ color: 'var(--gmp-titulo)' }} />} onCerrar={cerrar}
      ancho={680} alto="min(90vh, 820px)" ocupado={publicando}
      pie={(
        <>
          {publicado && (
            <button type="button" className="gmp-btn gmp-btn-peligro" onClick={() => void despublicar()} disabled={publicando}>Anular publicación</button>
          )}
          <span style={{ flex: 1 }} />
          <button type="button" className="gmp-btn gmp-btn-primario" onClick={cerrar} disabled={publicando}>Listo</button>
        </>
      )}>
      <EstilosGmp extra={{ href: 'gmp-publicar', css: CSS_PUBLICAR }} />
      <div className="gmp-estado">
        <span className="gmp-estado-icono"><Icono nombre="globo" tam={18} /></span>
        <span className="gmp-estado-tit">{info ? tituloEstado : <Giro chico />}</span>
        <button type="button" className="gmp-btn gmp-btn-primario" disabled={!puedePublicar} onClick={() => void publicarSitio()}>
          {publicando ? <Giro chico etiqueta="Publicando" /> : <Icono nombre="subir" tam={14} />}Publicar sitio
        </button>
      </div>
      {error && <p className="gmp-error" style={{ margin: '-6px 0 12px' }} role="alert">{error}</p>}
      {url && (
        <div className="gmp-url-pub">
          <Icono nombre="enlace" tam={15} />
          <a href={url} target="_blank" rel="noopener noreferrer">{url.replace(/^https?:\/\//, '')}</a>
          <button type="button" className="gmp-x" onClick={() => void copiar()} aria-label="Copiar enlace" title="Copiar enlace"><Icono nombre="copiar" tam={15} /></button>
          <button type="button" className="gmp-x" onClick={() => window.open(url, '_blank', 'noopener,noreferrer')} aria-label="Abrir en nueva pestaña" title="Abrir en nueva pestaña">
            <Icono nombre="abrir" tam={15} />
          </button>
        </div>
      )}
      {publicado && info?.sitioActivo !== null && info?.sitioActivo !== undefined && (
        <FilaAjuste titulo="Sitio habilitado">
          <Interruptor etiqueta="Activar la publicación del sitio" activo={info.sitioActivo} onCambiar={(v) => void cambiarActivo(v)} />
        </FilaAjuste>
      )}
      <div style={{ margin: '6px 0 14px' }}>
        <Pestanas etiqueta="Ajustes del sitio" valor={pestana} onCambiar={setPestana}
          opciones={[{ valor: 'ajustes', texto: 'Ajustes', icono: 'engrane' }, { valor: 'navegacion', texto: 'Navegación', icono: 'navegacion' }, { valor: 'seo', texto: 'SEO', icono: 'buscar' }]} />
      </div>
      {cuerpo}
      {nodoConfirma}
    </ModalGma>
  );
}

export default DialogoPublicar;
