'use client';

// =============================================================================
// MarcaView — la marca del negocio en el Second Brain («Voz y cara» → «Marca»): colores, fuentes y logo, en kits
// =============================================================================
// El pedido (llamada con Leila del 30/10/2026): que MaKo le pida su manual de marca, lo guarde en el Second Brain y lo use al
// diseñar, con varios kits («una agencia tiene muchos»). La estructura es la del Brand Kit de Canva (Image es la copia de
// Canva): un selector de kits arriba y tres bloques, Logo · Colores · Fuentes. Los colores y los nombres de los kits son del
// negocio; el aspecto, de la casa.
//
//   · «Subir manual»: MaKo lo lee (/api/marca, `leer`) y lo que entendió queda como un BORRADOR en esta misma forma, para
//     corregir y guardar. Nada se guarda sin «Guardar».
//   · El logo: de una imagen, MaKo propone el recorte (la caja que dio la IA, recortada acá); si no, se sube a mano. Se guarda
//     en «Subidos» del Image Editor (app/image-editor/mako/nube.ts), así el chat de Image lo puede poner.
//   · Las fuentes se eligen del catálogo del editor (app/image-editor/mako/fuentes.ts): una que el editor no tiene se ve,
//     marcada, y no se pierde.
// =============================================================================

import { useEffect, useMemo, useRef, useState, type CSSProperties } from 'react';
import { Star } from 'lucide-react';
import { BotonBorrar } from '@/app/_ui/BotonBorrar';
import { Confirm } from '@/app/_ui/Confirm';
import { ReportarASoporte } from '@/app/_ui/ReportarASoporte';
import { Dropdown, type DropdownOption } from '@/app/components/Dropdown';
import { FUENTES } from '@/app/image-editor/mako/fuentes';
import { aRaster, subirArchivo, IMAGEN_DIRECTA } from '@/app/image-editor/mako/nube';
import { cambiarKit, guardarKit, leerManual, useKitsDeMarca } from '@/app/_chat/kits-de-marca';
import {
  ROLES_COLOR, ROTULO_ROL, TOPES_MARCA, kitPorDefecto, normalizarHex,
  type BorradorMarca, type CajaLogo, type ColorMarca, type KitMarca, type LogoMarca, type RolColor,
} from '@/lib/marca/kits';

const SANS = "'Geist', sans-serif";
const TOPE_PDF_BYTES = 4 * 1024 * 1024;

type Edicion = {
  id: string | null;
  nombre: string;
  colores: ColorMarca[];
  titulos: string;
  texto: string;
  logo: LogoMarca | null;
  origen: string | null;
  /** El recorte que propone MaKo desde la imagen del manual (todavía sin subir). */
  logoPropuesto: { blob: Blob; url: string; ancho: number; alto: number } | null;
  usarPropuesto: boolean;
  /** Vino de leer un manual (el aviso de arriba lo dice). */
  leido: boolean;
};

const deKit = (k: KitMarca): Edicion => ({
  id: k.id, nombre: k.nombre, colores: k.colores, titulos: k.fuentes.titulos ?? '', texto: k.fuentes.texto ?? '',
  logo: k.logo, origen: k.origen, logoPropuesto: null, usarPropuesto: false, leido: false,
});
const VACIA: Edicion = { id: null, nombre: 'Mi marca', colores: [], titulos: '', texto: '', logo: null, origen: null, logoPropuesto: null, usarPropuesto: false, leido: false };

const caja: CSSProperties = { background: 'var(--surface)', border: '1px solid var(--border)', borderRadius: 14, padding: 16 };
const rotulo: CSSProperties = { fontSize: 13, fontWeight: 600, color: 'var(--ink)', margin: '0 0 10px' };
const btn: CSSProperties = { padding: '8px 14px', borderRadius: 10, border: '1px solid var(--border-strong)', background: 'var(--surface)', color: 'var(--ink)', fontFamily: SANS, fontSize: 13, fontWeight: 500, cursor: 'pointer' };
const btnPrimario: CSSProperties = { ...btn, border: 'none', background: 'var(--primary)', color: '#fff', fontWeight: 600 };

/** Una imagen como `HTMLImageElement` (para recortar o medir). */
async function imagenDe(blob: Blob): Promise<HTMLImageElement> {
  const url = URL.createObjectURL(blob);
  try {
    const img = new Image();
    img.src = url;
    await img.decode();
    return img;
  } finally { URL.revokeObjectURL(url); }
}

/** El recorte del logo que dijo la IA (en % de la imagen), como PNG. */
async function recortar(archivo: File, c: CajaLogo): Promise<{ blob: Blob; ancho: number; alto: number } | null> {
  try {
    const img = await imagenDe(archivo);
    const x = Math.round((c.x / 100) * img.naturalWidth);
    const y = Math.round((c.y / 100) * img.naturalHeight);
    const w = Math.max(1, Math.round((c.ancho / 100) * img.naturalWidth));
    const h = Math.max(1, Math.round((c.alto / 100) * img.naturalHeight));
    const canvas = document.createElement('canvas');
    canvas.width = w; canvas.height = h;
    canvas.getContext('2d')!.drawImage(img, x, y, w, h, 0, 0, w, h);
    const blob = await new Promise<Blob | null>((ok) => canvas.toBlob(ok, 'image/png'));
    return blob ? { blob, ancho: w, alto: h } : null;
  } catch { return null; }
}

/** Una imagen pesada se achica antes de mandarla a leer (el pedido entero topa en 4 MB). */
async function paraLeer(f: File): Promise<File> {
  if (!f.type.startsWith('image/') || f.size <= 3 * 1024 * 1024) return f;
  try {
    const img = await imagenDe(f);
    const escala = Math.min(1, 2000 / Math.max(img.naturalWidth, img.naturalHeight));
    const canvas = document.createElement('canvas');
    canvas.width = Math.round(img.naturalWidth * escala); canvas.height = Math.round(img.naturalHeight * escala);
    canvas.getContext('2d')!.drawImage(img, 0, 0, canvas.width, canvas.height);
    const blob = await new Promise<Blob | null>((ok) => canvas.toBlob(ok, 'image/jpeg', 0.9));
    return blob ? new File([blob], f.name.replace(/\.\w+$/, '.jpg'), { type: 'image/jpeg' }) : f;
  } catch { return f; }
}

/** Sube el logo a «Subidos» (un SVG o un AVIF, antes a PNG: el bucket no los acepta). */
async function subirLogo(blob: Blob, nombre: string, ancho: number, alto: number): Promise<LogoMarca> {
  const directo = IMAGEN_DIRECTA.has(blob.type);
  const archivo = directo ? blob : await aRaster(blob, ancho, alto);
  const s = await subirArchivo(archivo, { nombre: directo ? nombre : nombre.replace(/\.\w+$/, '.png'), tipo: directo ? blob.type : 'image/png', ancho, alto });
  return { subidoId: s.id, url: s.url, nombre: s.nombre, ancho: s.ancho, alto: s.alto };
}

/** Las fuentes del editor como opciones (cada una escrita con su letra, como el selector de Google Docs). */
const OPCIONES_FUENTE: DropdownOption[] = FUENTES.map((f) => ({ value: f.family, label: f.family }));

function SelectorFuente({ valor, onCambio, rotuloCampo }: { valor: string; onCambio: (v: string) => void; rotuloCampo: string }) {
  const enEditor = !valor || FUENTES.some((f) => f.family.toLowerCase() === valor.toLowerCase());
  // Un valor que no está en la lista se agrega marcado: si no, el desplegable lo muestra vacío y el primer cambio lo borra.
  const opciones = [{ value: '', label: 'Sin elegir' }, ...(enEditor ? [] : [{ value: valor, label: `${valor} (no está en el editor)` }]), ...OPCIONES_FUENTE];
  return (
    <div style={{ display: 'grid', gap: 6, fontSize: 13, color: 'var(--dim)' }}>
      {rotuloCampo}
      <Dropdown value={valor} options={opciones} onChange={onCambio} search ariaLabel={`Fuente de ${rotuloCampo.toLowerCase()}`} width="100%" />
      {valor && <span style={{ fontFamily: `"${valor}", ${SANS}`, fontSize: 18, color: 'var(--ink)' }}>Así se ve tu marca</span>}
    </div>
  );
}

const OPCIONES_ROL: DropdownOption[] = [{ value: '', label: 'Sin rol' }, ...ROLES_COLOR.map((r) => ({ value: r, label: ROTULO_ROL[r] }))];

export function MarcaView() {
  const m = useKitsDeMarca();
  const [ed, setEd] = useState<Edicion | null>(null);
  const [sucio, setSucio] = useState(false);
  const [ocupado, setOcupado] = useState<'leer' | 'guardar' | 'borrar' | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [aviso, setAviso] = useState<string | null>(null);
  const [borrando, setBorrando] = useState(false);
  const manualRef = useRef<HTMLInputElement>(null);
  const logoRef = useRef<HTMLInputElement>(null);
  const kits = m.kits;
  const defecto = kits ? kitPorDefecto(kits) : null;

  // Al cargar, se abre el kit de por defecto (si hay). Lo que la persona abrió después manda.
  useEffect(() => {
    if (kits && !ed && defecto) setEd(deKit(defecto));
  }, [kits, ed, defecto]);
  // El recorte propuesto vive como un objeto URL: se suelta al cambiar.
  useEffect(() => () => { if (ed?.logoPropuesto) URL.revokeObjectURL(ed.logoPropuesto.url); }, [ed?.logoPropuesto]);

  const cambiar = (p: Partial<Edicion>) => { setEd((e) => (e ? { ...e, ...p } : e)); setSucio(true); setAviso(null); };
  const abrir = (k: KitMarca | null) => { setEd(k ? deKit(k) : { ...VACIA }); setSucio(!k); setError(null); setAviso(null); };

  const alElegirManual = async (f: File | undefined) => {
    if (!f) return;
    setError(null); setAviso(null);
    if (f.type === 'application/pdf' && f.size > TOPE_PDF_BYTES) { setError('El PDF pesa más de 4 MB: sube una imagen de tu paleta o la página de tu marca.'); return; }
    setOcupado('leer');
    const r = await leerManual(await paraLeer(f));
    setOcupado(null);
    if (!r.ok) { setError(r.error); return; }
    const b: BorradorMarca = r.borrador;
    let propuesto: Edicion['logoPropuesto'] = null;
    if (f.type.startsWith('image/') && b.logo.caja) {
      const c = await recortar(f, b.logo.caja);
      if (c) propuesto = { ...c, url: URL.createObjectURL(c.blob) };
    }
    setEd({
      id: null, nombre: b.nombre || 'Mi marca', colores: b.colores, titulos: b.fuentes.titulos ?? '', texto: b.fuentes.texto ?? '',
      logo: null, origen: f.name.slice(0, TOPES_MARCA.origen), logoPropuesto: propuesto, usarPropuesto: !!propuesto, leido: true,
    });
    setSucio(true);
  };

  const guardar = async () => {
    if (!ed) return;
    setOcupado('guardar'); setError(null);
    try {
      let logo = ed.logo;
      if (ed.logoPropuesto && ed.usarPropuesto) logo = await subirLogo(ed.logoPropuesto.blob, `Logo ${ed.nombre}.png`, ed.logoPropuesto.ancho, ed.logoPropuesto.alto);
      const r = await guardarKit({
        ...(ed.id ? { id: ed.id } : {}), nombre: ed.nombre, colores: ed.colores,
        fuentes: { titulos: ed.titulos || null, texto: ed.texto || null }, logo, origen: ed.origen,
      }, !kits?.kits.length);
      if (!r.ok) { setError(r.error); return; }
      m.poner(r.kits);
      const guardado = r.kits.kits.find((k) => k.id === r.id);
      if (guardado) setEd(deKit(guardado));
      setSucio(false);
      setAviso('Guardado. MaKo ya la usa en Image, Video y Web Generator.');
    } catch (e) {
      setError(e instanceof Error ? e.message : 'No pude guardar el logo. Vuelve a intentar.');
    } finally { setOcupado(null); }
  };

  const alSubirLogo = async (f: File | undefined) => {
    if (!f || !ed) return;
    if (!f.type.startsWith('image/')) { setError('El logo tiene que ser una imagen (PNG, JPG, WEBP o SVG).'); return; }
    setOcupado('guardar'); setError(null);
    try {
      const img = await imagenDe(f);
      const logo = await subirLogo(f, f.name, img.naturalWidth || 512, img.naturalHeight || 512);
      cambiar({ logo, usarPropuesto: false });
    } catch (e) {
      setError(e instanceof Error ? e.message : 'No pude subir el logo.');
    } finally { setOcupado(null); }
  };

  const ponerPorDefecto = async (id: string) => {
    const r = await cambiarKit('por-defecto', id);
    if (r.ok) m.poner(r.kits); else setError(r.error);
  };

  const borrar = async () => {
    if (!ed?.id) return;
    setOcupado('borrar');
    const r = await cambiarKit('borrar', ed.id);
    setOcupado(null); setBorrando(false);
    if (!r.ok) { setError(r.error); return; }
    m.poner(r.kits);
    const siguiente = kitPorDefecto(r.kits);
    setEd(siguiente ? deKit(siguiente) : null);
    setSucio(false);
  };

  const colorNuevo = useMemo(() => ['#111111', '#FFFFFF', '#2563EB', '#F59E0B'].find((h) => !ed?.colores.some((c) => c.hex === h)) ?? '#888888', [ed?.colores]);

  if (!kits) return <p style={{ color: 'var(--dim)', fontSize: 14 }}>Cargando tu marca…</p>;
  // «No pude leer» no es «no hay marca»: sin esto, la pantalla invitaba a subir un manual que ya estaba.
  if (m.error && !kits.kits.length) {
    return (
      <p role="alert" style={{ margin: 0, color: 'var(--bad)', fontSize: 13.5 }}>
        No pude leer tu marca. <button type="button" style={btn} onClick={m.recargar}>Volver a intentar</button><ReportarASoporte />
      </p>
    );
  }

  return (
    <div style={{ display: 'grid', gap: 14, fontFamily: SANS }}>
      <input ref={manualRef} type="file" accept="application/pdf,image/png,image/jpeg,image/webp" hidden
        onChange={(e) => { void alElegirManual(e.target.files?.[0]); e.target.value = ''; }} />
      <input ref={logoRef} type="file" accept="image/png,image/jpeg,image/webp,image/svg+xml" hidden
        onChange={(e) => { void alSubirLogo(e.target.files?.[0]); e.target.value = ''; }} />

      {/* Los kits, como pastillas (el de por defecto con su estrella), y las dos formas de sumar uno. */}
      <div style={{ display: 'flex', flexWrap: 'wrap', gap: 8, alignItems: 'center' }}>
        {kits.kits.map((k) => (
          <button key={k.id} type="button" onClick={() => abrir(k)} aria-pressed={ed?.id === k.id}
            style={{ ...btn, background: ed?.id === k.id ? 'var(--surface-2)' : 'var(--surface)', display: 'inline-flex', gap: 6, alignItems: 'center' }}>
            {k.id === kits.porDefecto && <Star size={13} aria-label="Por defecto" fill="currentColor" />}
            {k.colores.slice(0, 3).map((c) => <span key={c.hex} aria-hidden="true" style={{ width: 10, height: 10, borderRadius: 999, background: c.hex, border: '1px solid var(--border)' }} />)}
            {k.nombre}
          </button>
        ))}
        <button type="button" style={btnPrimario} disabled={ocupado !== null} onClick={() => manualRef.current?.click()}>
          {ocupado === 'leer' ? 'Leyendo tu manual…' : 'Subir manual de marca'}
        </button>
        <button type="button" style={btn} disabled={ocupado !== null} onClick={() => abrir(null)}>Armar a mano</button>
      </div>

      {error && <p role="alert" style={{ margin: 0, color: 'var(--bad)', fontSize: 13.5 }}>{error}<ReportarASoporte /></p>}
      {aviso && <p style={{ margin: 0, color: 'var(--good)', fontSize: 13.5 }}>{aviso}</p>}

      {!ed && (
        <div style={{ ...caja, textAlign: 'center', color: 'var(--dim)', fontSize: 14 }}>
          Sube tu manual de marca y MaKo saca tus colores, tus fuentes y tu logo.
        </div>
      )}

      {ed && (
        <div style={{ display: 'grid', gap: 12 }}>
          {ed.leido && <p style={{ margin: 0, fontSize: 13.5, color: 'var(--dim)' }}>Esto entendí de tu manual. Revísalo y guárdalo.</p>}
          <label style={{ display: 'grid', gap: 6, fontSize: 13, color: 'var(--dim)' }}>
            Nombre del kit
            <input value={ed.nombre} maxLength={TOPES_MARCA.nombre} onChange={(e) => cambiar({ nombre: e.target.value })}
              style={{ padding: '8px 10px', borderRadius: 10, border: '1px solid var(--border-strong)', background: 'var(--surface)', color: 'var(--ink)', fontFamily: SANS, fontSize: 14 }} />
          </label>

          <section style={caja}>
            <p style={rotulo}>Logo</p>
            <div style={{ display: 'flex', gap: 12, alignItems: 'center', flexWrap: 'wrap' }}>
              {ed.logoPropuesto && (
                <label style={{ display: 'flex', gap: 8, alignItems: 'center', fontSize: 13, color: 'var(--ink)' }}>
                  <input type="checkbox" checked={ed.usarPropuesto} onChange={(e) => cambiar({ usarPropuesto: e.target.checked })} />
                  {/* eslint-disable-next-line @next/next/no-img-element */}
                  <img src={ed.logoPropuesto.url} alt="El logo que encontré" style={{ height: 56, maxWidth: 160, objectFit: 'contain', borderRadius: 8, border: '1px solid var(--border)', background: 'var(--surface-2)' }} />
                  Usar este logo
                </label>
              )}
              {ed.logo && !(ed.logoPropuesto && ed.usarPropuesto) && (
                // eslint-disable-next-line @next/next/no-img-element
                <img src={ed.logo.url} alt={ed.logo.nombre} style={{ height: 56, maxWidth: 160, objectFit: 'contain', borderRadius: 8, border: '1px solid var(--border)', background: 'var(--surface-2)' }} />
              )}
              <button type="button" style={btn} disabled={ocupado !== null} onClick={() => logoRef.current?.click()}>{ed.logo ? 'Cambiar logo' : 'Subir logo'}</button>
              {ed.logo && <button type="button" style={btn} onClick={() => cambiar({ logo: null })}>Quitar</button>}
            </div>
          </section>

          <section style={caja}>
            <p style={rotulo}>Colores</p>
            <div style={{ display: 'flex', flexWrap: 'wrap', gap: 10 }}>
              {ed.colores.map((c, i) => (
                <div key={`${c.hex}:${i}`} style={{ display: 'grid', gap: 6, justifyItems: 'center', width: 104 }}>
                  <input type="color" aria-label={`Color ${i + 1}`} value={c.hex.toLowerCase()}
                    onChange={(e) => { const hex = normalizarHex(e.target.value); if (hex) cambiar({ colores: ed.colores.map((x, j) => (j === i ? { ...x, hex } : x)) }); }}
                    style={{ width: 56, height: 56, border: '1px solid var(--border)', borderRadius: 12, padding: 0, background: 'none', cursor: 'pointer' }} />
                  <span style={{ fontSize: 12, fontFamily: "'Geist Mono', monospace", color: 'var(--dim)' }}>{c.hex}</span>
                  <Dropdown ariaLabel="Para qué se usa" value={c.rol ?? ''} options={OPCIONES_ROL} width="100%"
                    onChange={(v) => {
                      const rol = (v || null) as RolColor | null;
                      // Un rol lo tiene un color: el que lo tenía queda sin rol.
                      cambiar({ colores: ed.colores.map((x, j) => (j === i ? { ...x, rol } : rol && x.rol === rol ? { ...x, rol: null } : x)) });
                    }} />
                  <button type="button" aria-label={`Quitar ${c.hex}`} title="Quitar de la paleta" onClick={() => cambiar({ colores: ed.colores.filter((_, j) => j !== i) })}
                    style={{ border: 'none', background: 'none', color: 'var(--dim)', cursor: 'pointer', fontSize: 13 }}>✕</button>
                </div>
              ))}
              {ed.colores.length < TOPES_MARCA.colores && (
                <button type="button" style={{ ...btn, width: 56, height: 56, borderRadius: 12, fontSize: 20 }} aria-label="Sumar un color"
                  onClick={() => cambiar({ colores: [...ed.colores, { hex: colorNuevo, rol: null }] })}>+</button>
              )}
            </div>
          </section>

          <section style={caja}>
            <p style={rotulo}>Fuentes</p>
            <div style={{ display: 'grid', gap: 12, gridTemplateColumns: 'repeat(auto-fit, minmax(220px, 1fr))' }}>
              <SelectorFuente rotuloCampo="Títulos" valor={ed.titulos} onCambio={(v) => cambiar({ titulos: v })} />
              <SelectorFuente rotuloCampo="Texto" valor={ed.texto} onCambio={(v) => cambiar({ texto: v })} />
            </div>
          </section>

          <div style={{ display: 'flex', gap: 10, alignItems: 'center', flexWrap: 'wrap' }}>
            <button type="button" style={btnPrimario} disabled={ocupado !== null || !sucio} onClick={() => void guardar()}>
              {ocupado === 'guardar' ? 'Guardando…' : 'Guardar'}
            </button>
            {ed.id && ed.id !== kits.porDefecto && <button type="button" style={btn} onClick={() => void ponerPorDefecto(ed.id!)}>Usar por defecto</button>}
            {ed.id && <BotonBorrar onClick={() => setBorrando(true)} title={`Borrar el kit «${ed.nombre}»`} texto="Borrar kit" style={{ marginLeft: 'auto' }} />}
          </div>
        </div>
      )}

      {borrando && ed?.id && (
        <Confirm title={`¿Borrar el kit «${ed.nombre}»?`} message="MaKo deja de usarlo en tus diseños." confirmLabel="Borrar kit" cancelLabel="No borrar"
          loading={ocupado === 'borrar'} onConfirm={() => void borrar()} onCancel={() => setBorrando(false)} />
      )}
    </div>
  );
}
