'use client';

// =============================================================================
// Media Buyer — «Nueva campaña» (/ads-manager/nueva): «lánzame una campaña» (lo prometido a la agencia de Thiago, 29/10/2026)
// =============================================================================
// La estructura es la de Ajustes (la página «AI Marketer settings» de Madgicx: título, Volver, la acción arriba y una tarjeta
// por tema), con las preguntas del «Quick creation» del Administrador de anuncios de Meta, en su orden: el objetivo y a dónde
// lleva, cuánto y hasta cuándo, dónde, y el anuncio. Lo que sale se ve ENTERO en un cartel antes del «Lanzar» (AGENTS.md: lo
// que mueve plata pasa por un modal que PREVISUALIZA), validado por el servidor contra la cuenta: la zona, la fecha y el tope.
// Todo pasa por lib/media-buyer/campana.ts (op `crear_campana`), la misma puerta que `proponer_crear_campana` de la API.
// =============================================================================

import { useEffect, useMemo, useState } from 'react';
import Link from 'next/link';
import { useRouter } from 'next/navigation';
import { Button, Modal, RadioGroup, Select, Switch, TextField, Toast, useToast } from '@/app/_ui';
import { ConectarViaZernio } from '@/app/_components/ConectarViaZernio';
import { ReportarASoporte } from '@/app/_ui/ReportarASoporte';
import { fmtDinero } from '@/lib/format';
import { leerMonto } from '@/lib/media-buyer/monto';
import { BOTONES_CAMPANA, CAMPANA_PRENDIDA_MEDIDA, EVENTOS_WEB, NOMBRE_OBJETIVO, OBJETIVOS_CAMPANA, type ObjetivoCampana } from '@/lib/media-buyer/campana-reglas';
import type { LugarZona } from '@/lib/media-buyer/zona';
import { ElegirLugares } from './ElegirLugares';
import { subirAlStaging } from './creativeUpload';

type Preparacion = {
  conectado: boolean; moneda: string | null; zona: LugarZona[]; hasta: string | null; presupuestoMaxDia: number | null; totalActivo: number;
  formularios: Array<{ id: string; name: string; status?: string }>; pixeles: Array<{ id: string; name: string }>;
  anuncios: Array<{ id: string; nombre: string; campana: string | null; prendido: boolean }>; avisos: string[];
};

const BOTON: Record<string, string> = {
  LEARN_MORE: 'Más información', SIGN_UP: 'Registrarte', APPLY_NOW: 'Solicitar ahora', BOOK_NOW: 'Reservar', CONTACT_US: 'Contactarnos',
  GET_QUOTE: 'Pedir cotización', SUBSCRIBE: 'Suscribirte', SHOP_NOW: 'Comprar', WHATSAPP_MESSAGE: 'Enviar WhatsApp',
};
const EVENTO: Record<string, string> = { LEAD: 'Registro (Lead)', SCHEDULE: 'Agendó (Schedule)', SUBMIT_APPLICATION: 'Envió solicitud', CONTACT: 'Contacto', COMPLETE_REGISTRATION: 'Completó registro' };

async function api<T = Record<string, unknown>>(body: Record<string, unknown>): Promise<T & { ok: boolean; error?: string }> {
  const r = await fetch('/api/media-buyer', { method: 'POST', headers: { 'content-type': 'application/json' }, body: JSON.stringify(body) });
  return (await r.json().catch(() => ({ ok: false, error: `Error ${r.status}` }))) as T & { ok: boolean; error?: string };
}

export function NuevaCampana() {
  const router = useRouter();
  const { toast, show, clear } = useToast();
  const [prep, setPrep] = useState<Preparacion | null>(null);
  const [errorPrep, setErrorPrep] = useState<string | null>(null);
  /** Sin Meta conectada (el 409 `sinCuenta`): la pantalla ofrece conectar, no un texto suelto (producción, 10/11/2026). */
  const [sinCuenta, setSinCuenta] = useState(false);
  const [nombre, setNombre] = useState('');
  const [objetivo, setObjetivo] = useState<ObjetivoCampana>('formulario');
  const [formularioId, setFormularioId] = useState('');
  const [pixelId, setPixelId] = useState('');
  const [evento, setEvento] = useState<string>('LEAD');
  const [url, setUrl] = useState('');
  const [presupuesto, setPresupuesto] = useState('');
  const [hasta, setHasta] = useState('');
  const [lugares, setLugares] = useState<LugarZona[]>([]);
  const [origen, setOrigen] = useState<'subir' | 'anuncio'>('subir');
  const [archivo, setArchivo] = useState<{ path: string | null; media: 'imagen' | 'video'; nombre: string; progreso: number; error: string | null } | null>(null);
  const [anuncioId, setAnuncioId] = useState('');
  const [texto, setTexto] = useState('');
  const [titulo, setTitulo] = useState('');
  const [boton, setBoton] = useState('');
  // Hasta medir la creación por Zernio, nace en pausa siempre (campana-reglas.ts → CAMPANA_PRENDIDA_MEDIDA).
  const [enPausa, setEnPausa] = useState(!CAMPANA_PRENDIDA_MEDIDA);
  const [creada, setCreada] = useState<string[] | null>(null);
  const [revisando, setRevisando] = useState(false);
  const [resumen, setResumen] = useState<string | null>(null);
  const [lanzando, setLanzando] = useState(false);

  const leer = () => {
    void api<Preparacion>({ op: 'nueva_preparar' }).then((r) => {
      if (!r.ok) { if ((r as { sinCuenta?: boolean }).sinCuenta) { setSinCuenta(true); return; } setErrorPrep(r.error ?? 'No pude leer tu cuenta.'); return; }
      setSinCuenta(false);
      setPrep(r);
      // Lo del Media Buyer, de partida: su zona y su fecha de fin (la campaña no puede salir de ellas).
      setLugares((x) => (x.length ? x : r.zona));
      setHasta((x) => x || (r.hasta ?? ''));
    });
  };
  useEffect(leer, []);

  const entrada = useMemo(() => ({
    nombre, objetivo, presupuestoDia: leerMonto(presupuesto) ?? Number.NaN, lugares, hasta: hasta || null,
    formularioId: objetivo === 'formulario' ? formularioId || null : null,
    pixelId: objetivo === 'web' || objetivo === 'compras' ? pixelId || null : null,
    evento: objetivo === 'web' ? evento : null, url: url.trim() || null,
    creativo: origen === 'anuncio' ? { tipo: 'anuncio', adId: anuncioId } : { tipo: 'archivo', path: archivo?.path ?? '', media: archivo?.media ?? 'imagen' },
    texto, titulo: titulo.trim() || null, boton: boton || null, enPausa,
  }), [nombre, objetivo, presupuesto, lugares, hasta, formularioId, pixelId, evento, url, origen, anuncioId, archivo, texto, titulo, boton, enPausa]);

  const elegirArchivo = (f: File | null) => {
    if (!f) return;
    const media = f.type.startsWith('video/') ? 'video' : 'imagen';
    setArchivo({ path: null, media, nombre: f.name, progreso: 0, error: null });
    subirAlStaging(f, (p) => setArchivo((a) => (a ? { ...a, progreso: p } : a)))
      .then((r) => setArchivo((a) => (a ? { ...a, path: r.path, progreso: 100 } : a)), (e) => setArchivo((a) => (a ? { ...a, error: e instanceof Error ? e.message : String(e) } : a)));
  };

  const revisar = async () => {
    setRevisando(true);
    const r = await api<{ resumen: string }>({ op: 'crear_campana', soloRevisar: true, entrada });
    setRevisando(false);
    if (r.ok) setResumen(r.resumen); else show(r.error ?? 'Revisa los datos.', undefined, 'bad');
  };
  const lanzar = async () => {
    setLanzando(true);
    const r = await api<{ campaignId: string; avisos?: string[] }>({ op: 'crear_campana', entrada });
    setLanzando(false);
    setResumen(null);
    if (!r.ok) { show(r.error ?? 'No se pudo lanzar.', undefined, 'bad'); return; }
    // Lo que la relectura vio distinto de lo pedido se queda a la vista (no se navega): es lo que hay que revisar antes de prenderla.
    if (r.avisos?.length) { setCreada(r.avisos); return; }
    show(enPausa ? 'Campaña creada en pausa: préndela cuando la revises' : 'Campaña lanzada: Meta la revisa antes de mostrarla', undefined, 'good');
    router.push('/ads-manager');
  };

  const cab = (
    <header className="mba-ajustes-cab">
      <h1><span aria-hidden>🚀</span> Nueva campaña</h1>
      <span style={{ display: 'flex', gap: 10 }}>
        <Link href="/ads-manager" className="mb-secundario mba-volver-btn">Volver</Link>
        <Button loading={revisando} disabled={!prep?.conectado || (origen === 'subir' && !archivo?.path)} onClick={() => void revisar()}>Revisar y lanzar</Button>
      </span>
    </header>
  );

  // Lo mismo que dice abajo con la cuenta leída y sin conexión (`!prep.conectado`): el bloque «Conecta tu cuenta», con su botón.
  const conectar = (
    <section className="mba-card">
      <h2>Conecta tu cuenta</h2>
      <p style={{ margin: 0 }}>Para lanzar campañas, MaKo usa tu conexión de Facebook por Zernio.</p>
      <ConectarViaZernio red="metaads" volver="/ads-manager/nueva" size="sm" variant="secondary" onConectado={leer}>Conectar con Facebook</ConectarViaZernio>
    </section>
  );
  if (sinCuenta) return <div className="mb"><div className="mba-ajustes">{cab}{conectar}</div></div>;
  if (errorPrep) return <div className="mb"><div className="mba-ajustes">{cab}<section className="mba-card"><p style={{ margin: 0 }}>{errorPrep}</p></section></div></div>;
  if (!prep) return <div className="mb"><div className="mba-ajustes" aria-busy="true">{cab}<section className="mba-card"><p style={{ margin: 0, color: 'var(--dim)' }}>Leyendo tu cuenta…</p></section></div></div>;

  const tope = prep.presupuestoMaxDia;
  const libre = tope != null ? Math.max(0, tope - prep.totalActivo) : null;

  return (
    <div className="mb">
      <div className="mba-ajustes">
        {cab}

        {!prep.conectado && conectar}
        {prep.avisos.map((a) => <p key={a} className="mk-hint" style={{ margin: 0 }}>{a}</p>)}
        {creada && (
          <section className="mba-card" role="alert">
            <h2>Campaña creada en pausa: revísala antes de prenderla</h2>
            <ul style={{ margin: 0, paddingLeft: 18, display: 'flex', flexDirection: 'column', gap: 6 }}>{creada.map((a) => <li key={a}>{a}</li>)}</ul>
            <Link href="/ads-manager" className="mb-secundario mba-volver-btn">Volver a Marketing CoPilot</Link>
            <ReportarASoporte />
          </section>
        )}

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
          {CAMPANA_PRENDIDA_MEDIDA
            ? <Switch checked={enPausa} onChange={setEnPausa} label="Crearla en pausa" hint="La prendes después desde el Media Buyer." />
            : <p className="mk-hint" style={{ margin: 0 }}>Nace en pausa: la revisas en el Administrador de Meta y la prendes ahí (o le pides a MaKo que la prenda).</p>}
        </section>

        <section className="mba-card">
          <h2>Dónde</h2>
          <ElegirLugares etiqueta="Lugares" elegidos={lugares} onCambio={setLugares}
            ayuda={prep.zona.length ? 'Sólo dentro de la zona de tu Media Buyer.' : undefined} />
        </section>

        <section className="mba-card">
          <h2>Anuncio</h2>
          <RadioGroup label="Creativo" value={origen} onChange={(v) => setOrigen(v === 'anuncio' ? 'anuncio' : 'subir')} options={[
            { value: 'subir', label: 'Subir una imagen o un video' },
            { value: 'anuncio', label: 'Reusar un anuncio de tu cuenta', hint: 'Sale con su texto, su imagen o video y su botón.' },
          ]} />
          {origen === 'subir' ? (
            <div>
              <input type="file" accept="image/*,video/*" aria-label="Elegir archivo" onChange={(e) => elegirArchivo(e.target.files?.[0] ?? null)} />
              {archivo && <p className="mk-hint" style={{ margin: '6px 0 0' }}>{archivo.error ?? (archivo.path ? `${archivo.nombre}: listo` : `${archivo.nombre}: subiendo ${Math.round(archivo.progreso)}%`)}</p>}
            </div>
          ) : (
            <Select label="Anuncio" value={anuncioId} onChange={(v) => setAnuncioId(String(v))} search placeholder="Elige un anuncio"
              options={prep.anuncios.map((a) => ({ value: a.id, label: `${a.nombre}${a.campana ? ` · ${a.campana}` : ''}${a.prendido ? '' : ' (pausado)'}` }))} />
          )}
          {origen === 'subir' && (
            <>
              <TextField label="Texto principal" multiline value={texto} onChange={(e) => setTexto(e.target.value)} maxLength={2000} />
              <div className="mba-grilla">
                <TextField label="Título" value={titulo} onChange={(e) => setTitulo(e.target.value)} maxLength={255} />
                <Select label="Botón" value={boton} onChange={(v) => setBoton(String(v))} placeholder="El de siempre"
                  options={BOTONES_CAMPANA.map((b) => ({ value: b, label: BOTON[b] ?? b }))} />
              </div>
            </>
          )}
        </section>
      </div>

      {resumen && (
        <Modal titulo="¿Lanzamos esta campaña?" ancho={560} onCerrar={() => !lanzando && setResumen(null)}
          pie={<span style={{ display: 'flex', gap: 10, justifyContent: 'flex-end' }}>
            <Button variant="secondary" disabled={lanzando} onClick={() => setResumen(null)}>Volver</Button>
            <Button loading={lanzando} onClick={() => void lanzar()}>{enPausa ? 'Crear en pausa' : 'Lanzar'}</Button>
          </span>}>
          <ul style={{ margin: 0, paddingLeft: 18, display: 'flex', flexDirection: 'column', gap: 6 }}>
            {resumen.split(' · ').map((l) => <li key={l} style={{ whiteSpace: 'pre-wrap', overflowWrap: 'anywhere' }}>{l}</li>)}
          </ul>
        </Modal>
      )}
      <Toast state={toast} onClose={clear} />
    </div>
  );
}
