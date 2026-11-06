'use client';

// =============================================================================
// «Usar en un anuncio» — la pantalla (6/11/2026, lo prometido a la agencia de Thiago)
// =============================================================================
// La estructura es la de «Nueva campaña» del Media Buyer (app/ads-manager/NuevaCampana.tsx: la página «AI Marketer settings» de
// Madgicx con las preguntas del «Quick creation» de Meta, en su orden: el objetivo y a dónde lleva, cuánto y hasta cuándo, dónde
// y el anuncio), con la PIEZA ya puesta arriba: su vista previa y de dónde salió. Lo que cambia es el final: acá no se lanza.
// «Revisar la campaña» la PROPONE por la API de MaKo (`proponer_crear_campana`, /api/anuncio-desde-pieza) y lleva a
// /mako/revisar, donde se ve entera y una persona la confirma.
//
// La pieza sin video (un guion del Copywriter) elige uno: un video que MaKo ya hizo, o un archivo del disco (sube al staging).
// Mientras publicar por Zernio no esté probado con una cuenta real (`ZERNIO_ANUNCIOS_PROBADO`), la pantalla lo dice.
// =============================================================================

import { useEffect, useMemo, useState } from 'react';
import Link, { useRouter } from '@/app/_ui/Link';
import { Button, RadioGroup, Select, TextField, Toast, useToast } from '@/app/_ui';
import { ConectarViaZernio } from '@/app/_components/ConectarViaZernio';
import { ReportarASoporte } from '@/app/_ui/ReportarASoporte';
import { ElegirLugares } from '@/app/ads-manager/ElegirLugares';
import { fmtDinero } from '@/lib/format';
import { leerMonto } from '@/lib/media-buyer/monto';
import { BOTONES_CAMPANA, EVENTOS_WEB, NOMBRE_OBJETIVO, OBJETIVOS_CAMPANA, type ObjetivoCampana } from '@/lib/media-buyer/campana-reglas';
import type { LugarZona } from '@/lib/media-buyer/zona';
import { NOMBRE_ORIGEN, avisoDeZernio, entradaParaProponer, leerPieza, nombreSugerido, rutaUsarEnAnuncio, TOPE_TEXTO_ANUNCIO, type CreativoDePieza } from '@/lib/anuncio-desde-pieza';
import { subirPiezaAlStaging } from '@/app/_crear/usar-en-anuncio';

type CreativoListo = Exclude<CreativoDePieza, { tipo: 'toma' }>;
type Generado = { ref: string; titulo: string; toma: number | null; url: string; fecha: string | null };
type Preparacion = {
  conectado: boolean; moneda: string | null; zona: LugarZona[]; hasta: string | null; presupuestoMaxDia: number | null; totalActivo: number;
  formularios: Array<{ id: string; name: string }>; pixeles: Array<{ id: string; name: string }>; avisos: string[];
  pieza: { creativo: CreativoListo | null; vista: { url: string; media: 'imagen' | 'video' } | null; error: string | null };
  generados: Generado[]; zernioProbado: boolean; prendidaMedida: boolean;
};

const BOTON: Record<string, string> = {
  LEARN_MORE: 'Más información', SIGN_UP: 'Registrarte', APPLY_NOW: 'Solicitar ahora', BOOK_NOW: 'Reservar', CONTACT_US: 'Contactarnos',
  GET_QUOTE: 'Pedir cotización', SUBSCRIBE: 'Suscribirte', SHOP_NOW: 'Comprar', WHATSAPP_MESSAGE: 'Enviar WhatsApp',
};
const EVENTO: Record<string, string> = { LEAD: 'Registro (Lead)', SCHEDULE: 'Agendó (Schedule)', SUBMIT_APPLICATION: 'Envió solicitud', CONTACT: 'Contacto', COMPLETE_REGISTRATION: 'Completó registro' };

async function api<T>(body: Record<string, unknown>): Promise<T & { ok: boolean; error?: string }> {
  const r = await fetch('/api/anuncio-desde-pieza', { method: 'POST', headers: { 'content-type': 'application/json' }, body: JSON.stringify(body) });
  return (await r.json().catch(() => ({ ok: false, error: `Error ${r.status}` }))) as T & { ok: boolean; error?: string };
}

/** La dirección de una propuesta (absoluta, con su `?ws=`) como ruta de la app, para el router que conserva la pestaña. */
const rutaDe = (url: string): string => { try { const u = new URL(url); return `${u.pathname}${u.search}`; } catch { return url; } };

export function UsarEnAnuncio({ pieza: piezaQuery }: { pieza: Record<string, string> }) {
  const router = useRouter();
  const { toast, show, clear } = useToast();
  const pieza = useMemo(() => leerPieza(piezaQuery), [piezaQuery]);
  const [prep, setPrep] = useState<Preparacion | null>(null);
  const [errorPrep, setErrorPrep] = useState<string | null>(null);
  const [nombre, setNombre] = useState(() => nombreSugerido(pieza));
  const [objetivo, setObjetivo] = useState<ObjetivoCampana>('formulario');
  const [formularioId, setFormularioId] = useState('');
  const [pixelId, setPixelId] = useState('');
  const [evento, setEvento] = useState<string>('LEAD');
  const [url, setUrl] = useState('');
  const [presupuesto, setPresupuesto] = useState('');
  const [hasta, setHasta] = useState('');
  const [lugares, setLugares] = useState<LugarZona[]>([]);
  const [texto, setTexto] = useState(pieza.texto);
  const [titulo, setTitulo] = useState('');
  const [boton, setBoton] = useState('');
  // La pieza sin video (o con uno que no se pudo resolver): elegir uno de MaKo o subir uno.
  const [elegido, setElegido] = useState<CreativoListo | null>(null);
  const [subida, setSubida] = useState<{ nombre: string; progreso: number; error: string | null } | null>(null);
  const [proponiendo, setProponiendo] = useState(false);

  const leer = () => {
    setErrorPrep(null);
    void api<Preparacion>({ op: 'preparar', pieza: piezaQuery }).then((r) => {
      if (!r.ok) { setErrorPrep(r.error ?? 'No pude leer tu cuenta.'); return; }
      setPrep(r);
      setLugares((x) => (x.length ? x : r.zona));
      setHasta((x) => x || (r.hasta ?? ''));
    });
  };
  useEffect(leer, [piezaQuery]);

  const creativo: CreativoListo | null = prep?.pieza.creativo ?? elegido;

  const elegirArchivo = (f: File | null) => {
    if (!f) return;
    setElegido(null);
    setSubida({ nombre: f.name, progreso: 0, error: null });
    void subirPiezaAlStaging(f, f.name, (p) => setSubida((s) => (s ? { ...s, progreso: p } : s))).then((r) => {
      if (!r.ok) { setSubida((s) => (s ? { ...s, error: r.error } : s)); return; }
      setSubida((s) => (s ? { ...s, progreso: 100 } : s));
      setElegido({ tipo: 'archivo', path: r.path, media: r.media });
    });
  };

  const proponer = async () => {
    if (!creativo) return;
    setProponiendo(true);
    const entrada = entradaParaProponer({
      nombre, objetivo, presupuestoDia: leerMonto(presupuesto), formularioId, pixelId, evento, url, hasta, lugares, texto, titulo, boton,
    }, creativo);
    const r = await api<{ url: string }>({ op: 'proponer', entrada });
    setProponiendo(false);
    if (!r.ok) { show(r.error ?? 'Revisa los datos.', undefined, 'bad'); return; }
    router.push(rutaDe(r.url));
  };

  const cab = (
    <header className="mba-ajustes-cab">
      <h1><span aria-hidden>📣</span> Usar en un anuncio</h1>
      <span style={{ display: 'flex', gap: 10 }}>
        <Link href="/ads-manager" className="mb-secundario mba-volver-btn">Ir al Media Buyer</Link>
        <Button loading={proponiendo} disabled={!prep?.conectado || !creativo || !texto.trim()} onClick={() => void proponer()}>Revisar la campaña</Button>
      </span>
    </header>
  );

  if (errorPrep) {
    return (
      <div className="mb"><div className="mba-ajustes">{cab}
        <section className="mba-card" role="alert"><p style={{ margin: 0 }}>{errorPrep}</p><Button variant="secondary" size="sm" onClick={leer}>Volver a intentar</Button><ReportarASoporte /></section>
      </div></div>
    );
  }
  if (!prep) return <div className="mb"><div className="mba-ajustes" aria-busy="true">{cab}<section className="mba-card"><p style={{ margin: 0, color: 'var(--dim)' }}>Leyendo tu cuenta…</p></section></div></div>;

  const tope = prep.presupuestoMaxDia;
  const libre = tope != null ? Math.max(0, tope - prep.totalActivo) : null;
  const vista = prep.pieza.vista ?? (elegido?.tipo === 'generado' ? (() => { const g = prep.generados.find((x) => x.ref === elegido.ref); return g ? { url: g.url, media: 'video' as const } : null; })() : null);
  const aviso = avisoDeZernio(prep.zernioProbado);

  return (
    <div className="mb">
      <div className="mba-ajustes">
        {cab}

        {!prep.conectado && (
          <section className="mba-card">
            <h2>Conecta tu cuenta</h2>
            <p style={{ margin: 0 }}>Para lanzar anuncios, MaKo usa tu conexión de Facebook por Zernio.</p>
            <ConectarViaZernio red="metaads" volver={rutaUsarEnAnuncio({ origen: pieza.origen, titulo: pieza.titulo, texto: pieza.texto, creativo: pieza.creativo })} size="sm" variant="secondary" onConectado={leer}>Conectar con Facebook</ConectarViaZernio>
          </section>
        )}
        {aviso && <p className="mk-hint" style={{ margin: 0 }}>{aviso}</p>}
        {prep.avisos.map((a) => <p key={a} className="mk-hint" style={{ margin: 0 }}>{a}</p>)}

        <section className="mba-card">
          <h2>La pieza</h2>
          <p className="mk-hint" style={{ margin: 0 }}>Desde {NOMBRE_ORIGEN[pieza.origen]}{pieza.titulo ? ` · ${pieza.titulo}` : ''}</p>
          {vista && (vista.media === 'video'
            ? <video src={vista.url} controls playsInline preload="metadata" style={{ maxWidth: 320, maxHeight: 400, borderRadius: 10, background: '#000' }} />
            : <img src={vista.url} alt="La imagen del anuncio" style={{ maxWidth: 320, maxHeight: 400, borderRadius: 10, objectFit: 'contain' }} />)}
          {prep.pieza.error && <p className="mk-hint" role="alert" style={{ margin: 0 }}>{prep.pieza.error}<ReportarASoporte /></p>}
          {!prep.pieza.creativo && (
            <>
              <Select label="Un video que MaKo ya hizo" value={elegido?.tipo === 'generado' ? elegido.ref : ''} search
                placeholder={prep.generados.length ? 'Elige un video' : 'Todavía no hiciste videos con MaKo'}
                onChange={(v) => { setSubida(null); setElegido(v ? { tipo: 'generado', ref: String(v) } : null); }}
                options={prep.generados.map((g) => ({ value: g.ref, label: `${g.titulo}${g.toma ? ` · toma ${g.toma}` : ''}` }))} />
              <div>
                <input type="file" accept="image/jpeg,image/png,image/webp,video/mp4,video/quicktime" aria-label="O sube una imagen o un video" onChange={(e) => elegirArchivo(e.target.files?.[0] ?? null)} />
                {subida && <p className="mk-hint" style={{ margin: '6px 0 0' }} role={subida.error ? 'alert' : undefined}>{subida.error ?? (subida.progreso >= 100 ? `${subida.nombre}: listo` : `${subida.nombre}: subiendo ${Math.round(subida.progreso)}%`)}<ReportarASoporte /></p>}
              </div>
            </>
          )}
        </section>

        <section className="mba-card">
          <h2>Objetivo</h2>
          <TextField label="Nombre de la campaña" value={nombre} onChange={(e) => setNombre(e.target.value)} maxLength={200} />
          <RadioGroup label="Qué buscas" value={objetivo} onChange={(v) => setObjetivo(v as ObjetivoCampana)}
            options={OBJETIVOS_CAMPANA.map((o) => ({ value: o, label: NOMBRE_OBJETIVO[o] }))} />
          {objetivo === 'formulario' && (
            <Select label="Formulario" value={formularioId} onChange={(v) => setFormularioId(String(v))} placeholder={prep.formularios.length ? 'Elige un formulario' : 'Sin formularios en tu página'}
              options={prep.formularios.map((f) => ({ value: f.id, label: f.name }))} />
          )}
          {(objetivo === 'web' || objetivo === 'compras') && (
            <div className="mba-grilla">
              <Select label="Píxel" value={pixelId} onChange={(v) => setPixelId(String(v))} placeholder={prep.pixeles.length ? 'Elige tu píxel' : 'Sin píxeles en tu cuenta'}
                options={prep.pixeles.map((p) => ({ value: p.id, label: p.name }))} />
              {objetivo === 'web' && <Select label="Evento" value={evento} onChange={(v) => setEvento(String(v))} options={EVENTOS_WEB.map((e) => ({ value: e, label: EVENTO[e] }))} />}
            </div>
          )}
          <TextField label={objetivo === 'formulario' ? 'Página de tu negocio (opcional)' : 'Página a la que lleva'} value={url} onChange={(e) => setUrl(e.target.value)}
            placeholder="https://" inputMode="url" />
        </section>

        <section className="mba-card">
          <h2>Presupuesto y fecha</h2>
          <div className="mba-grilla">
            <TextField label="Por día" inputMode="decimal" value={presupuesto} onChange={(e) => setPresupuesto(e.target.value)} suffix={prep.moneda ?? undefined}
              hint={libre != null ? `Tu tope deja ${fmtDinero(libre)} por día para prender.` : undefined} />
            <TextField label="Hasta" type="date" value={hasta} onChange={(e) => setHasta(e.target.value)}
              hint={prep.hasta ? `Tu Media Buyer trabaja hasta el ${prep.hasta.slice(8, 10)}/${prep.hasta.slice(5, 7)}.` : 'Vacío: sin fecha de fin.'} />
          </div>
          {!prep.prendidaMedida && <p className="mk-hint" style={{ margin: 0 }}>Nace en pausa: la revisas y la prendes en el Administrador de Meta (o se lo pides a MaKo).</p>}
        </section>

        <section className="mba-card">
          <h2>Dónde</h2>
          <ElegirLugares etiqueta="Lugares" elegidos={lugares} onCambio={setLugares}
            ayuda={prep.zona.length ? 'Sólo dentro de la zona de tu Media Buyer.' : undefined} />
        </section>

        <section className="mba-card">
          <h2>Texto</h2>
          <TextField label="Texto principal" multiline value={texto} onChange={(e) => setTexto(e.target.value)} maxLength={TOPE_TEXTO_ANUNCIO} />
          <div className="mba-grilla">
            <TextField label="Título" value={titulo} onChange={(e) => setTitulo(e.target.value)} maxLength={255} />
            <Select label="Botón" value={boton} onChange={(v) => setBoton(String(v))} placeholder="El de siempre"
              options={BOTONES_CAMPANA.map((b) => ({ value: b, label: BOTON[b] ?? b }))} />
          </div>
        </section>
      </div>
      <Toast state={toast} onClose={clear} />
    </div>
  );
}
