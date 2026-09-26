'use client';

// =============================================================================
// OfertasView — la OFERTA del negocio y a qué funnels se vende
// =============================================================================
// Va JUNTO al catálogo de productos, en el mismo paso del onboarding, porque son
// las dos mitades de la misma pregunta y separarlas obliga a explicar la
// diferencia dos veces:
//
//   producto = lo que se ENTREGA y se factura  → ProductosView (lo usa el CRM)
//   oferta   = cómo se PRESENTA para que se compre → esto (lo usan los writers)
//
// Arranca con «Ármala tú, MaKo»: para cuando se llega acá el brief y los
// documentos ya están cargados, así que el dueño CORRIGE en vez de redactar. El
// alta manual es la excepción y va de a UNA pregunta por pantalla.
//
// ⚠️ Lista con FILETE, no pila de tarjetas: son cosas del mismo tipo. Y sin
// `.mk-fila`, que lleva la marca dorada de «acá intervino MaKo» — un catálogo
// comercial no lo es.

import { useCallback, useEffect, useState, type CSSProperties } from 'react';
import { WizardShell } from '../_components/WizardShell';
import { URGENCIAS, urgenciaTexto, precioTexto, type Bono, type Oferta, type UrgenciaTipo } from '@/lib/oferta-modelo';
import { CANALES } from '@/lib/fase-diagnostico';

const MONO = "'Geist Mono', monospace";
const SANS = "'Geist', sans-serif";

type ProductoMini = { id: number; nombre: string };
type FunnelMini = { id: number; nombre: string; canal: string | null; esDefault: boolean };
type LigaProducto = { oferta_id: number; producto_id: number; rol: string };
type LigaFunnel = { funnel_id: number; oferta_id: number; es_principal: boolean };
type Campos = { nombre: string; precio: string; promesa: string; incluye: string; garantia: string };
type Estado = {
  ofertas: Oferta[]; productos: ProductoMini[]; funnels: FunnelMini[];
  ligasProducto: LigaProducto[]; ligasFunnel: LigaFunnel[];
  campos: Campos; origen: 'declarado' | 'brief' | 'sin-fila'; tieneContexto: boolean;
};

const btnPrimary: CSSProperties = { padding: '12px 22px', borderRadius: 11, border: 'none', background: 'var(--primary)', color: '#fff', fontFamily: SANS, fontSize: 14.5, fontWeight: 600, cursor: 'pointer', display: 'inline-flex', alignItems: 'center', gap: 8 };
const btnGhost: CSSProperties = { padding: '9px 16px', borderRadius: 10, border: '1px solid var(--border-strong)', background: 'var(--surface)', color: 'var(--dim)', fontFamily: SANS, fontSize: 13, fontWeight: 500, cursor: 'pointer', display: 'inline-flex', alignItems: 'center', gap: 7 };
const eyebrow: CSSProperties = { fontFamily: MONO, fontSize: 10.5, letterSpacing: '.1em', textTransform: 'uppercase', color: 'var(--faint)' };
const linkBtn: CSSProperties = { background: 'none', border: 'none', color: 'var(--dim)', fontFamily: SANS, fontSize: 13, textDecoration: 'underline', cursor: 'pointer', padding: 0 };
const chip: CSSProperties = { display: 'inline-flex', alignItems: 'center', gap: 6, padding: '4px 10px', borderRadius: 999, border: '1px solid var(--border-strong)', background: 'var(--surface-2)', color: 'var(--dim)', fontSize: 12.5, fontWeight: 600, fontFamily: SANS };

function MiniSpin({ light }: { light?: boolean }) {
  return <span style={{ width: 13, height: 13, borderRadius: '50%', border: `2px solid ${light ? 'rgba(255,255,255,.35)' : 'var(--border)'}`, borderTopColor: light ? '#fff' : 'var(--primary)', animation: 'ofe-spin .8s linear infinite', display: 'inline-block', flex: 'none' }} />;
}

/** Campo editable inline: el mismo gesto que las tarjetas de producto. */
function Edit({ valor, ph, onSave, style }: { valor: string; ph?: string; onSave: (v: string) => void; style?: CSSProperties }) {
  return (
    <div className="ofe-edit" contentEditable suppressContentEditableWarning spellCheck={false} data-ph={ph || 'Escribe…'}
      onBlur={(e) => { const nv = (e.currentTarget.textContent || '').replace(/\s+/g, ' ').trim(); if (nv !== (valor ?? '').trim()) onSave(nv); }}
      style={{ outline: 'none', cursor: 'text', borderRadius: 6, padding: '2px 6px', margin: '0 -6px', ...style }}
    >{valor}</div>
  );
}

function btnOpcion(activo: boolean): CSSProperties {
  return { width: '100%', padding: '12px 15px', borderRadius: 12, textAlign: 'left', fontFamily: SANS, cursor: 'pointer', border: `1px solid ${activo ? 'var(--primary)' : 'var(--border-strong)'}`, background: activo ? 'var(--primary-bg)' : 'var(--surface-2)', color: activo ? 'var(--primary)' : 'var(--ink)' };
}

const campoInput: CSSProperties = { width: '100%', padding: '13px 15px', borderRadius: 12, border: '1px solid var(--border-strong)', background: 'var(--surface-2)', color: 'var(--ink)', fontFamily: SANS, fontSize: 16, outline: 'none', textAlign: 'center' };

// ── Alta de una oferta: UNA pregunta por pantalla ────────────────────────────
// Usa el MAPA (`pasos` + `pasoActual`), no `total`/`idx`: tiene una rama (la
// urgencia agrega dos preguntas) y con la cuenta a secas la posición se
// desincroniza — es el antipatrón que el propio WizardShell documenta.
function NuevaOferta({ onGuardar, onClose, pending }: {
  onGuardar: (o: Record<string, unknown>) => void; onClose: () => void; pending: boolean;
}) {
  const [i, setI] = useState(0);
  const [nombre, setNombre] = useState('');
  const [promesa, setPromesa] = useState('');
  const [precio, setPrecio] = useState('');
  const [urg, setUrg] = useState<UrgenciaTipo | 'ninguna'>('ninguna');
  const [urgDato, setUrgDato] = useState('');
  const [urgHasta, setUrgHasta] = useState('');

  const conUrgencia = urg !== 'ninguna';
  const conFecha = urg === 'fecha' || urg === 'inicio';
  const PASOS = ['nombre', 'promesa', 'precio', 'urgencia',
    ...(conUrgencia ? ['urgencia-dato'] : []),
    ...(conUrgencia && conFecha ? ['urgencia-fecha'] : []),
  ];
  const actual = PASOS[Math.min(i, PASOS.length - 1)];
  const enUltimo = i >= PASOS.length - 1;
  const puede = actual === 'nombre' ? !!nombre.trim() : actual === 'urgencia-dato' ? !!urgDato.trim() : true;

  const cuerpo = () => {
    if (actual === 'nombre') return (
      <input value={nombre} onChange={(e) => setNombre(e.target.value)} placeholder="Ej: Negocio que Escala" autoFocus style={{ ...campoInput, maxWidth: 380, margin: '0 auto', display: 'block' }} />
    );
    if (actual === 'promesa') return (
      <textarea value={promesa} onChange={(e) => setPromesa(e.target.value)} rows={3} placeholder="De cuello de botella a dueño que escala" autoFocus style={{ ...campoInput, maxWidth: 460, margin: '0 auto', display: 'block', textAlign: 'left', resize: 'vertical' }} />
    );
    if (actual === 'precio') return (
      <input value={precio} onChange={(e) => setPrecio(e.target.value)} placeholder="2 pagos de 2.500 USD" autoFocus style={{ ...campoInput, maxWidth: 340, margin: '0 auto', display: 'block' }} />
    );
    if (actual === 'urgencia') return (
      <div style={{ display: 'flex', flexDirection: 'column', gap: 9, maxWidth: 420, margin: '0 auto' }}>
        {URGENCIAS.map((u) => (
          <button key={u.id} type="button" onClick={() => setUrg(u.id)} style={btnOpcion(urg === u.id)}>
            <div style={{ fontSize: 14.5, fontWeight: 700 }}>{u.label}</div>
          </button>
        ))}
        <button type="button" onClick={() => setUrg('ninguna')} style={btnOpcion(urg === 'ninguna')}>
          <div style={{ fontSize: 14.5, fontWeight: 700 }}>Ninguna</div>
        </button>
      </div>
    );
    if (actual === 'urgencia-dato') return (
      <input value={urgDato} onChange={(e) => setUrgDato(e.target.value)} autoFocus
        placeholder={URGENCIAS.find((u) => u.id === urg)?.ph ?? ''}
        style={{ ...campoInput, maxWidth: 400, margin: '0 auto', display: 'block' }} />
    );
    return (
      <input type="date" value={urgHasta} onChange={(e) => setUrgHasta(e.target.value)} autoFocus
        style={{ ...campoInput, maxWidth: 220, margin: '0 auto', display: 'block' }} />
    );
  };

  const pregunta = actual === 'nombre' ? '¿Cómo se llama tu oferta?'
    : actual === 'promesa' ? '¿Qué transformación promete?'
      : actual === 'precio' ? '¿Cómo se presenta el precio?'
        : actual === 'urgencia' ? '¿Hay algo que la limite?'
          : actual === 'urgencia-dato' ? '¿Cuál es el límite?'
            : '¿Hasta cuándo?';
  const sub = actual === 'precio' ? 'Tal como se lo dices al cliente. Puede ser una frase.'
    : actual === 'urgencia' ? 'Solo si es real. Una urgencia inventada se nota.'
      : actual === 'urgencia-fecha' ? 'Con la fecha, MaKo deja de usar la urgencia sola cuando vence.'
        : undefined;

  return (
    <WizardShell
      titulo="Nueva oferta"
      pasos={PASOS} pasoActual={actual}
      pregunta={pregunta} sub={sub}
      pending={pending}
      puedeAvanzar={puede}
      enUltimo={enUltimo}
      confirmLabel="Agregar oferta"
      atrasLabel={i === 0 ? 'Cancelar' : 'Atrás'}
      onAtras={() => (i === 0 ? onClose() : setI((p) => p - 1))}
      onSiguiente={() => setI((p) => Math.min(p + 1, PASOS.length - 1))}
      onConfirmar={() => onGuardar({
        nombre, promesa, precio_nota: precio,
        urgencia_tipo: conUrgencia ? urg : null,
        urgencia_dato: conUrgencia ? urgDato : null,
        urgencia_hasta: conUrgencia && conFecha ? urgHasta : null,
      })}
      onClose={onClose}
    >
      {cuerpo()}
    </WizardShell>
  );
}

// ── Alta de un funnel para una oferta: canal → nombre ────────────────────────
// Dos preguntas cerradas y el nombre prellenado. El canal siembra las etapas con
// `templateDeCanal` del lado del server: un funnel que nace vacío es un funnel
// que hay que dibujar a mano antes de que sirva para algo.
function NuevoFunnel({ oferta, onCrear, onClose, pending }: {
  oferta: Oferta; onCrear: (canal: string, nombre: string) => void; onClose: () => void; pending: boolean;
}) {
  const [i, setI] = useState(0);
  const [canal, setCanal] = useState<string>('');
  const [nombre, setNombre] = useState('');
  const PASOS = ['canal', 'nombre'];
  const actual = PASOS[i];
  const sugerido = canal ? `${oferta.nombre} · ${CANALES.find((c) => c.id === canal)?.label ?? canal}` : oferta.nombre;

  return (
    <WizardShell
      titulo={`Nuevo funnel · ${oferta.nombre}`}
      pasos={PASOS} pasoActual={actual}
      pregunta={actual === 'canal' ? '¿Dónde se cierra esta venta?' : '¿Cómo se llama este funnel?'}
      sub={actual === 'canal' ? 'Con eso MaKo siembra las etapas.' : undefined}
      pending={pending}
      puedeAvanzar={actual === 'canal' ? !!canal : true}
      enUltimo={i === PASOS.length - 1}
      confirmLabel="Crear funnel"
      atrasLabel={i === 0 ? 'Cancelar' : 'Atrás'}
      onAtras={() => (i === 0 ? onClose() : setI(0))}
      onSiguiente={() => setI(1)}
      onConfirmar={() => onCrear(canal, (nombre.trim() || sugerido))}
      onClose={onClose}
    >
      {actual === 'canal' ? (
        <div style={{ display: 'flex', flexDirection: 'column', gap: 9, maxWidth: 440, margin: '0 auto' }}>
          {CANALES.map((c) => (
            <button key={c.id} type="button" onClick={() => setCanal(c.id)} style={btnOpcion(canal === c.id)}>
              <div style={{ fontSize: 14.5, fontWeight: 700 }}>{c.label}</div>
              <div style={{ fontSize: 12, fontWeight: 500, marginTop: 2, opacity: .75 }}>{c.desc}</div>
            </button>
          ))}
        </div>
      ) : (
        <input value={nombre} onChange={(e) => setNombre(e.target.value)} placeholder={sugerido} autoFocus
          style={{ ...campoInput, maxWidth: 420, margin: '0 auto', display: 'block' }} />
      )}
    </WizardShell>
  );
}

// ── La vista ─────────────────────────────────────────────────────────────────

export function OfertasView({ onListo }: { onListo?: (listo: boolean) => void } = {}) {
  const [est, setEst] = useState<Estado | null>(null);
  const [cargando, setCargando] = useState(true);
  const [sugiriendo, setSugiriendo] = useState(false);
  const [guardando, setGuardando] = useState(false);
  const [nueva, setNueva] = useState(false);
  const [funnelPara, setFunnelPara] = useState<Oferta | null>(null);
  const [abierta, setAbierta] = useState<number | null>(null);
  const [err, setErr] = useState<string | null>(null);

  const cargar = useCallback(async () => {
    try {
      const r = await fetch('/api/onboarding/ofertas').then((x) => x.json());
      if (r?.ok) setEst(r as Estado);
      else setErr(r?.error ?? 'No se pudo cargar');
    } catch { setErr('No se pudo cargar'); }
    finally { setCargando(false); }
  }, []);
  useEffect(() => { cargar(); }, [cargar]);
  useEffect(() => { onListo?.(!!est && est.ofertas.length > 0); }, [est, onListo]);

  const post = async (body: Record<string, unknown>) => {
    const r = await fetch('/api/onboarding/ofertas', { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify(body) }).then((x) => x.json());
    if (r?.ok) { setEst(r as Estado); setErr(null); } else setErr(r?.error ?? 'No se pudo guardar');
    return !!r?.ok;
  };

  const sugerir = async () => { setSugiriendo(true); setErr(null); await post({ action: 'sugerir' }); setSugiriendo(false); };
  const guardarCampo = (o: Oferta, patch: Partial<Oferta>) => { void post({ action: 'guardar', oferta: { ...o, ...patch } }); };

  if (cargando) return <div style={{ fontFamily: SANS, fontSize: 14, color: 'var(--faint)', padding: 20 }}>Cargando tu oferta…</div>;

  const ofertas = est?.ofertas ?? [];
  const funnels = est?.funnels ?? [];
  const hoy = new Date();
  const funnelsDe = (o: Oferta) => (est?.ligasFunnel ?? []).filter((l) => l.oferta_id === o.id)
    .map((l) => funnels.find((f) => f.id === l.funnel_id)).filter((f): f is FunnelMini => !!f);
  const productosDe = (o: Oferta) => (est?.ligasProducto ?? []).filter((l) => l.oferta_id === o.id)
    .map((l) => (est?.productos ?? []).find((p) => p.id === l.producto_id)).filter((p): p is ProductoMini => !!p);

  return (
    <div style={{ fontFamily: SANS, marginBottom: 30 }}>
      <style>{'@keyframes ofe-spin{to{transform:rotate(360deg)}} .ofe-edit:empty:before{content:attr(data-ph);color:var(--faint)} .ofe-edit:hover{background:var(--surface-2)}'}</style>

      {ofertas.length === 0 && (
        <div style={{ textAlign: 'center', padding: '18px 0 8px' }}>
          <div style={{ fontSize: 15, color: 'var(--ink)', lineHeight: 1.6, maxWidth: 520, margin: '0 auto 18px' }}>
            {est?.tieneContexto
              ? 'Tu oferta es cómo presentas lo que vendes. MaKo puede armarla con lo que ya cargaste.'
              : 'Carga tu negocio o sube un documento en El Archivero, o agrégala a mano aquí abajo.'}
          </div>
          <div style={{ display: 'flex', gap: 10, justifyContent: 'center', flexWrap: 'wrap' }}>
            {est?.tieneContexto && (
              <button type="button" onClick={sugerir} disabled={sugiriendo} style={{ ...btnPrimary, opacity: sugiriendo ? .7 : 1 }}>
                {sugiriendo ? <><MiniSpin light /> Leyendo tu negocio…</> : '✦ Ármala tú, MaKo'}
              </button>
            )}
            <button type="button" onClick={() => setNueva(true)} style={btnGhost}>+ Agregar a mano</button>
          </div>
        </div>
      )}

      {ofertas.length > 0 && (
        <>
          <div style={{ display: 'flex', alignItems: 'baseline', justifyContent: 'space-between', marginBottom: 10, gap: 12, flexWrap: 'wrap' }}>
            <span style={eyebrow}>{ofertas.length} oferta{ofertas.length === 1 ? '' : 's'}</span>
            <div style={{ display: 'flex', gap: 14, alignItems: 'center' }}>
              {est?.tieneContexto && (
                <button type="button" onClick={sugerir} disabled={sugiriendo} style={linkBtn}>
                  {sugiriendo ? 'Completando…' : '✦ Que MaKo complete lo que falta'}
                </button>
              )}
              <button type="button" onClick={() => setNueva(true)} style={linkBtn}>+ Agregar otra</button>
            </div>
          </div>

          <div>
            {ofertas.map((o) => {
              const desdeBrief = o.desde_brief;
              const fs = funnelsDe(o);
              const ps = productosDe(o);
              const sinLigar = funnels.filter((f) => !fs.some((x) => x.id === f.id));
              const urg = urgenciaTexto(o, hoy);
              const abierto = abierta === o.id;
              return (
                <div key={o.id} style={{ borderTop: '1px solid var(--border)', padding: '15px 0' }}>
                  <div style={{ display: 'flex', alignItems: 'flex-start', justifyContent: 'space-between', gap: 12 }}>
                    <div style={{ minWidth: 0, flex: '1 1 auto' }}>
                      <Edit valor={o.nombre} ph="Nombre de la oferta" onSave={(v) => guardarCampo(o, { nombre: v })} style={{ fontSize: 16.5, fontWeight: 650, color: 'var(--ink)' }} />
                      <div style={{ display: 'flex', gap: 7, flexWrap: 'wrap', marginTop: 7, alignItems: 'center' }}>
                        {o.es_principal && <span style={{ ...chip, borderColor: 'var(--primary)', color: 'var(--primary)' }}>Principal</span>}
                        <span style={{ fontSize: 13.5, color: 'var(--dim)' }}>
                          {desdeBrief ? (est?.campos.precio || 'sin precio') : (precioTexto(o) || 'sin precio')}
                        </span>
                        {urg && <span style={chip}>{urg}</span>}
                      </div>
                    </div>
                    <div style={{ display: 'flex', gap: 10, alignItems: 'center', flex: 'none' }}>
                      {!o.es_principal && (
                        <button type="button" onClick={() => void post({ action: 'principal', id: o.id })} style={linkBtn}>Hacer principal</button>
                      )}
                      <button type="button" onClick={() => setAbierta(abierto ? null : o.id)} style={linkBtn}>{abierto ? 'Cerrar' : 'Ver todo'}</button>
                      <button type="button" onClick={() => void post({ action: 'borrar', id: o.id })} aria-label={`Borrar ${o.nombre}`}
                        style={{ border: 'none', background: 'transparent', color: 'var(--faint)', cursor: 'pointer', fontSize: 16, lineHeight: 1, padding: 2 }}>×</button>
                    </div>
                  </div>

                  {/* Los funnels por los que se vende. Es lo que hace que la oferta
                      no sea un producto con otro nombre: dos funnels distintos
                      pueden vender la misma con otra entrada. */}
                  <div style={{ display: 'flex', gap: 7, flexWrap: 'wrap', alignItems: 'center', marginTop: 11 }}>
                    <span style={eyebrow}>Funnels</span>
                    {fs.map((f) => (
                      <span key={f.id} style={chip}>
                        {f.nombre}
                        <button type="button" aria-label={`Desasociar ${f.nombre}`}
                          onClick={() => void post({ action: 'desligar-funnel', ofertaId: o.id, funnelId: f.id })}
                          style={{ border: 'none', background: 'transparent', color: 'var(--faint)', cursor: 'pointer', fontSize: 13, lineHeight: 1, padding: 0 }}>×</button>
                      </span>
                    ))}
                    {fs.length === 0 && <span style={{ fontSize: 12.5, color: 'var(--faint)' }}>ninguno todavía</span>}
                    {sinLigar.length > 0 && (
                      <select value="" onChange={(e) => { const v = Number(e.target.value); if (v) void post({ action: 'ligar-funnel', ofertaId: o.id, funnelId: v }); }}
                        aria-label={`Asociar un funnel a ${o.nombre}`}
                        style={{ ...chip, cursor: 'pointer', padding: '4px 8px' }}>
                        <option value="">+ Asociar</option>
                        {sinLigar.map((f) => <option key={f.id} value={f.id}>{f.nombre}</option>)}
                      </select>
                    )}
                    <button type="button" onClick={() => setFunnelPara(o)} style={linkBtn}>+ Nuevo funnel</button>
                  </div>

                  {/* Qué productos entrega. Vacío es válido: el catálogo es del CRM. */}
                  <div style={{ display: 'flex', gap: 7, flexWrap: 'wrap', alignItems: 'center', marginTop: 8 }}>
                    <span style={eyebrow}>Entrega</span>
                    {ps.map((p) => (
                      <span key={p.id} style={chip}>
                        {p.nombre}
                        <button type="button" aria-label={`Desligar ${p.nombre}`}
                          onClick={() => void post({ action: 'desligar-producto', ofertaId: o.id, productoId: p.id })}
                          style={{ border: 'none', background: 'transparent', color: 'var(--faint)', cursor: 'pointer', fontSize: 13, lineHeight: 1, padding: 0 }}>×</button>
                      </span>
                    ))}
                    {ps.length === 0 && <span style={{ fontSize: 12.5, color: 'var(--faint)' }}>ningún producto</span>}
                    {(est?.productos ?? []).filter((p) => !ps.some((x) => x.id === p.id)).length > 0 && (
                      <select value="" onChange={(e) => { const v = Number(e.target.value); if (v) void post({ action: 'ligar-producto', ofertaId: o.id, productoId: v }); }}
                        aria-label={`Ligar un producto a ${o.nombre}`}
                        style={{ ...chip, cursor: 'pointer', padding: '4px 8px' }}>
                        <option value="">+ Ligar producto</option>
                        {(est?.productos ?? []).filter((p) => !ps.some((x) => x.id === p.id)).map((p) => <option key={p.id} value={p.id}>{p.nombre}</option>)}
                      </select>
                    )}
                  </div>

                  {abierto && (
                    <div style={{ marginTop: 13, display: 'flex', flexDirection: 'column', gap: 9 }}>
                      {desdeBrief && (
                        <p style={{ fontSize: 12.5, color: 'var(--faint)', lineHeight: 1.55, margin: 0 }}>
                          Promesa, precio y garantía salen de tu brief. Edítalos ahí o escríbelos aquí para que manden estos.
                        </p>
                      )}
                      <Campo rot="Promesa" valor={desdeBrief ? (o.promesa ?? est?.campos.promesa ?? '') : (o.promesa ?? '')} ph="La transformación que compra el cliente" onSave={(v) => guardarCampo(o, { promesa: v })} />
                      <Campo rot="Incluye" valor={desdeBrief ? (o.incluye ?? est?.campos.incluye ?? '') : (o.incluye ?? '')} ph="Los entregables" onSave={(v) => guardarCampo(o, { incluye: v })} />
                      <Campo rot="Garantía" valor={desdeBrief ? (o.garantia ?? est?.campos.garantia ?? '') : (o.garantia ?? '')} ph="Si tienes" onSave={(v) => guardarCampo(o, { garantia: v })} />
                      <Campo rot="Precio" valor={o.precio_nota ?? ''} ph="2 pagos de 2.500 USD" onSave={(v) => guardarCampo(o, { precio_nota: v })} />
                      <Campo rot="Para quién" valor={o.para_quien ?? ''} ph="Para quién es, y para quién no" onSave={(v) => guardarCampo(o, { para_quien: v })} />
                      <Campo rot="Objeciones" valor={o.objeciones ?? ''} ph="Lo que más frena la compra" onSave={(v) => guardarCampo(o, { objeciones: v })} />
                      <Campo rot="Prueba" valor={o.prueba ?? ''} ph="Casos, números, testimonios" onSave={(v) => guardarCampo(o, { prueba: v })} />
                      <Bonos oferta={o} onSave={(bonos) => guardarCampo(o, { bonos })} />
                      <Urgencia oferta={o} onSave={(patch) => guardarCampo(o, patch)} />
                    </div>
                  )}
                </div>
              );
            })}
          </div>

          <p style={{ fontSize: 12.5, color: 'var(--faint)', marginTop: 14, lineHeight: 1.55 }}>
            La oferta es lo que MaKo usa para escribir. El producto es lo que el CRM cobra.
          </p>
        </>
      )}

      {err && <div style={{ marginTop: 14, fontSize: 13.5, color: 'var(--bad)', lineHeight: 1.5 }}>{err}</div>}

      {nueva && (
        <NuevaOferta
          pending={guardando}
          onClose={() => setNueva(false)}
          onGuardar={async (o) => { setGuardando(true); const ok = await post({ action: 'guardar', oferta: o }); setGuardando(false); if (ok) setNueva(false); }}
        />
      )}
      {funnelPara && (
        <NuevoFunnel
          oferta={funnelPara}
          pending={guardando}
          onClose={() => setFunnelPara(null)}
          onCrear={async (canal, nombre) => {
            setGuardando(true);
            const ok = await post({ action: 'crear-funnel', canal, nombre, ofertaId: funnelPara.id });
            setGuardando(false);
            if (ok) setFunnelPara(null);
          }}
        />
      )}
    </div>
  );
}

function Campo({ rot, valor, ph, onSave }: { rot: string; valor: string; ph: string; onSave: (v: string) => void }) {
  return (
    <div>
      <span style={eyebrow}>{rot}</span>
      <Edit valor={valor} ph={ph} onSave={onSave} style={{ fontSize: 13.5, color: 'var(--ink)', lineHeight: 1.5 }} />
    </div>
  );
}

/** Los bonos. Se tildan y se editan; no hay un textarea donde se pierdan. */
function Bonos({ oferta, onSave }: { oferta: Oferta; onSave: (b: Bono[]) => void }) {
  const bs = oferta.bonos;
  return (
    <div>
      <span style={eyebrow}>Bonos</span>
      <div style={{ display: 'flex', flexDirection: 'column', gap: 6, marginTop: 4 }}>
        {bs.map((b, i) => (
          <div key={`${b.nombre}-${i}`} style={{ display: 'flex', gap: 8, alignItems: 'baseline' }}>
            <Edit valor={b.nombre} ph="Nombre del bono" style={{ fontSize: 13.5, color: 'var(--ink)', fontWeight: 600 }}
              onSave={(v) => onSave(bs.map((x, j) => (j === i ? { ...x, nombre: v } : x)).filter((x) => x.nombre))} />
            <Edit valor={b.porque} ph="qué objeción tumba" style={{ fontSize: 12.5, color: 'var(--dim)', flex: '1 1 auto' }}
              onSave={(v) => onSave(bs.map((x, j) => (j === i ? { ...x, porque: v } : x)))} />
            <button type="button" aria-label={`Quitar el bono ${b.nombre}`} onClick={() => onSave(bs.filter((_, j) => j !== i))}
              style={{ border: 'none', background: 'transparent', color: 'var(--faint)', cursor: 'pointer', fontSize: 14, lineHeight: 1 }}>×</button>
          </div>
        ))}
        <button type="button" onClick={() => onSave([...bs, { nombre: 'Bono nuevo', valor_usd: null, porque: '' }])} style={{ ...linkBtn, alignSelf: 'flex-start' }}>+ Agregar bono</button>
      </div>
    </div>
  );
}

/**
 * La urgencia. El TIPO es un chip cerrado y no un textarea, y lleva fecha aparte:
 * así el sistema puede apagar el ángulo de urgencia EN CÓDIGO cuando vence, en vez
 * de confiar en que el modelo se acuerde.
 */
function Urgencia({ oferta, onSave }: { oferta: Oferta; onSave: (p: Partial<Oferta>) => void }) {
  return (
    <div>
      <span style={eyebrow}>Urgencia</span>
      <div style={{ display: 'flex', gap: 6, flexWrap: 'wrap', marginTop: 5, alignItems: 'center' }}>
        {URGENCIAS.map((u) => (
          <button key={u.id} type="button"
            onClick={() => onSave(oferta.urgencia_tipo === u.id ? { urgencia_tipo: null, urgencia_dato: null, urgencia_hasta: null } : { urgencia_tipo: u.id })}
            style={{ ...chip, cursor: 'pointer', ...(oferta.urgencia_tipo === u.id ? { borderColor: 'var(--primary)', color: 'var(--primary)' } : {}) }}>
            {u.label}
          </button>
        ))}
      </div>
      {oferta.urgencia_tipo && (
        <div style={{ marginTop: 7, display: 'flex', flexDirection: 'column', gap: 6 }}>
          <Edit valor={oferta.urgencia_dato ?? ''} ph={URGENCIAS.find((u) => u.id === oferta.urgencia_tipo)?.ph ?? ''}
            onSave={(v) => onSave({ urgencia_dato: v })} style={{ fontSize: 13.5, color: 'var(--ink)' }} />
          <Edit valor={oferta.urgencia_razon ?? ''} ph="Por qué es real" onSave={(v) => onSave({ urgencia_razon: v })} style={{ fontSize: 12.5, color: 'var(--dim)' }} />
          <label style={{ fontSize: 12.5, color: 'var(--dim)', display: 'inline-flex', gap: 8, alignItems: 'center' }}>
            Hasta
            <input type="date" value={oferta.urgencia_hasta ?? ''} onChange={(e) => onSave({ urgencia_hasta: e.target.value || null })}
              style={{ padding: '4px 8px', borderRadius: 8, border: '1px solid var(--border-strong)', background: 'var(--surface-2)', color: 'var(--ink)', fontFamily: SANS, fontSize: 12.5 }} />
          </label>
        </div>
      )}
    </div>
  );
}
