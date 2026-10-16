'use client';

// =============================================================================
// ficha/pagos/bloques-deal — lo que se VENDIÓ: contrato, datos fiscales, servicio, promesa y obligaciones
// =============================================================================
// Hasta el 16/10/2026 esto eran cajas grises de sólo lectura con «—» (un ganado sin cargar dibujaba unas 15), y se
// editaba en «Editar deal», otra pantalla, que guardaba todo de una y reemplazaba los jsonb enteros. Ahora cada
// dato se edita donde se lee y escribe SU campo (`guardarCampoDealAction`, `guardarObligacionAction`: merge,
// historial y Deshacer). «Leer con IA» (el contrato y el documento fiscal) llena SÓLO lo vacío, campo por campo
// (`completarConDocumentoAction`). Las marcas `data-recorrido` son las que busca «Solucionar» un dato sin marcar.
// =============================================================================

import { useEffect, useRef, useState, useTransition, type CSSProperties } from 'react';
import { Button, Toast, useToast } from '@/app/_ui';
import { Dropdown } from '@/app/components/Dropdown';
import type { Lead } from '@/lib/leads';
import { marcaDato } from '@/lib/datos-aviso';
import { CAMPOS_DEAL, type ParteObligacion, type SeccionDeal } from '@/lib/pagos-campo';
import type { DocumentoLeido } from '@/lib/pagos-vistazo';
import { guardarCampoDealAction, guardarObligacionAction } from '@/app/crm/[id]/pagos-campo-actions';
import { getIdentidadesFiscalesAction, type IdentidadFiscal } from '@/app/crm/[id]/deal-actions';
import type { PropsBloque, CtxFicha } from '../tipos';
import { completarConDocumentoAction } from './documento-actions';
import { EnLinea } from './EnLinea';
import { Aviso, MONO, Tarjeta } from './piezas';

const caja: CSSProperties = { display: 'flex', flexDirection: 'column', gap: 4, padding: '10px 13px', borderRadius: 12, background: 'var(--surface-2)', border: '1px solid var(--border)', minWidth: 0 };
const etiqueta: CSSProperties = { fontSize: 12, color: 'var(--dim)' };
const grilla: CSSProperties = { display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(180px, 1fr))', gap: 10 };
const franja: CSSProperties = { display: 'flex', alignItems: 'center', gap: 12, flexWrap: 'wrap', padding: '12px 14px', background: 'var(--surface-2)', border: '1px solid var(--border)', borderRadius: 12 };
const COLUMNA: Record<SeccionDeal, 'deal_fiscal' | 'deal_servicio' | 'deal_promesa'> = { fiscal: 'deal_fiscal', servicio: 'deal_servicio', promesa: 'deal_promesa' };

/** Un campo de una sección del deal, editado en el lugar, con Deshacer. */
function useCampoDeal(ctx: CtxFicha) {
  const { toast, show, clear } = useToast();
  const guardar = (seccion: SeccionDeal, campo: string, v: string): Promise<string | null> =>
    guardarCampoDealAction(ctx.lead.id, { seccion, campo, valor: v || null }).then((r) => {
      if (!r.ok) return r.error;
      const col = COLUMNA[seccion];
      ctx.parchear({ [col]: { ...((ctx.lead[col] as Record<string, unknown> | null | undefined) ?? {}), [campo]: r.despues } } as Partial<Lead>);
      if (r.cambio) show('Guardado', () => { void guardarCampoDealAction(ctx.lead.id, { seccion, campo, valor: r.antes == null ? null : String(r.antes) }).then(() => ctx.releer()); });
      return null;
    });
  return { guardar, toast: <Toast state={toast} onClose={clear} />, show };
}

/** Los campos de una sección, cada uno en su caja. `respaldo`: lo que se muestra si está vacío (el email del lead). */
function Campos({ ctx, seccion, campos, editando, guardar, respaldo, compacta = false }: {
  ctx: CtxFicha; seccion: SeccionDeal; campos: readonly string[]; editando: boolean;
  guardar: (s: SeccionDeal, c: string, v: string) => Promise<string | null>;
  respaldo?: Partial<Record<string, string | null>>;
  /** «Lista compacta»: un renglón por dato, el rótulo a la izquierda. */
  compacta?: boolean;
}) {
  const valores = (ctx.lead[COLUMNA[seccion]] ?? {}) as Record<string, string | null | undefined>;
  const rotulos = CAMPOS_DEAL[seccion] as Record<string, string>;
  return (
    <div style={compacta ? { display: 'flex', flexDirection: 'column' } : grilla}>
      {campos.map((c) => {
        const esFecha = c === 'fecha_inicio' || c === 'fecha_termino';
        const v = valores[c] ?? '';
        return (
          <div key={c} style={compacta
            ? { display: 'grid', gridTemplateColumns: 'minmax(120px, 34%) minmax(0, 1fr)', gap: 10, alignItems: 'baseline', padding: '7px 0', borderBottom: '1px solid var(--border)' }
            : { ...caja, gridColumn: c === 'que_es' || seccion === 'promesa' ? '1 / -1' : undefined }}>
            <span style={etiqueta}>{rotulos[c]}</span>
            <EnLinea valor={v} tipo={esFecha && (!v || /^\d{4}-\d{2}-\d{2}$/.test(v)) ? 'fecha' : c === 'que_es' || seccion === 'promesa' ? 'largo' : 'texto'}
              vacio={respaldo?.[c] ? `${respaldo[c]} (el del lead)` : '—'} titulo={`Edita ${rotulos[c].toLowerCase()}`} bloqueado={editando}
              estilo={{ fontSize: 14.5, lineHeight: 1.5 }} onGuardar={(x) => guardar(seccion, c, x)} />
          </div>
        );
      })}
    </div>
  );
}

/**
 * Subir un documento (el contrato o el fiscal) a su ruta y llenar lo vacío con lo que leyó. Sin archivo, relee el
 * contrato ya cargado (el «Leer con IA» de un contrato que ya está).
 */
function useLeerDocumento(ctx: CtxFicha, ruta: '/api/extract-contract' | '/api/extract-deal-fiscal') {
  const [leyendo, setLeyendo] = useState(false);
  const [resultado, setResultado] = useState<{ tono: 'verde' | 'rojo' | 'ambar'; texto: string } | null>(null);
  const leer = async (file?: File) => {
    setLeyendo(true); setResultado(null);
    try {
      const fd = new FormData();
      if (file) fd.append('file', file);
      fd.append('leadId', String(ctx.lead.id));
      const r = await fetch(ruta, { method: 'POST', body: fd });
      const j = (await r.json()) as DocumentoLeido & { error?: string; razon?: string | null; id_fiscal?: string | null; domicilio?: string | null; correo?: string | null };
      if (j.error) throw new Error(j.error);
      // El documento fiscal devuelve sus cuatro campos sueltos; el contrato, por sección.
      const doc: DocumentoLeido = ruta === '/api/extract-deal-fiscal' ? { fiscal: { razon: j.razon, id_fiscal: j.id_fiscal, domicilio: j.domicilio, correo: j.correo } } : j;
      const c = await completarConDocumentoAction(ctx.lead.id, doc);
      if (!c.ok) throw new Error(c.error);
      ctx.releer();
      setResultado(c.secciones.length
        ? { tono: c.fallaron ? 'ambar' : 'verde', texto: `Se completó (sólo lo vacío): ${c.secciones.join(', ')}.${c.fallaron ? ` ${c.fallaron} dato(s) no se pudieron guardar.` : ''}` }
        : { tono: 'verde', texto: file ? 'Documento guardado. No había datos vacíos para completar.' : 'Leído: no había datos vacíos para completar.' });
    } catch (e) {
      setResultado({ tono: 'rojo', texto: `No pude leer el documento: ${e instanceof Error ? e.message : String(e)}` });
    } finally { setLeyendo(false); }
  };
  return { leyendo, resultado, leer };
}

function VerDoc({ src, nombre, onCerrar }: { src: string; nombre: string; onCerrar: () => void }) {
  return (
    <div style={{ border: '1px solid var(--border-strong)', borderRadius: 12, overflow: 'hidden', background: 'var(--surface-2)' }}>
      <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', gap: 10, padding: '8px 12px', background: 'var(--surface)', borderBottom: '1px solid var(--border)', flexWrap: 'wrap' }}>
        <span style={{ fontFamily: MONO, fontSize: 12, color: 'var(--dim)' }}>{nombre}</span>
        <Button variant="tertiary" size="sm" onClick={onCerrar}>Cerrar</Button>
      </div>
      <iframe src={src} title={nombre} style={{ display: 'block', width: '100%', height: 380, border: 'none', background: 'var(--surface-2)' }} />
    </div>
  );
}

// ─────────────────────────────────────────────────────────────────────────────

export function Contrato({ ctx, titulo, diseno, editando }: PropsBloque) {
  const { lead } = ctx;
  const archivo = useRef<HTMLInputElement | null>(null);
  const { leyendo, resultado, leer } = useLeerDocumento(ctx, '/api/extract-contract');
  const tiene = !!lead.contrato_path;
  const [ver, setVer] = useState(diseno === 'vista' && tiene);
  return (
    <Tarjeta titulo={titulo}>
      <input ref={archivo} type="file" accept=".pdf,image/*" style={{ display: 'none' }} onChange={(e) => { const f = e.target.files?.[0]; if (f) void leer(f); e.target.value = ''; }} />
      <div style={franja}>
        <div style={{ flex: 1, minWidth: 180 }}>
          <div style={{ fontSize: 13.5, fontWeight: 600, color: 'var(--ink)' }}>{lead.contrato_nombre ?? (tiene ? 'Contrato' : 'Sin contrato')}</div>
          <div style={{ fontSize: 12, color: 'var(--faint)', marginTop: 2 }}>{tiene ? 'Leerlo con IA completa servicio, promesa, obligaciones y datos fiscales (sólo lo vacío).' : 'Súbelo (PDF o foto) y se completa lo que esté vacío.'}</div>
        </div>
        {!editando && (
          <div style={{ display: 'flex', gap: 8, flexWrap: 'wrap' }}>
            {tiene && <Button variant="secondary" size="sm" onClick={() => setVer((v) => !v)}>{ver ? 'Cerrar' : 'Ver'}</Button>}
            {tiene && <a href={`/api/contract?leadId=${lead.id}`} style={{ fontSize: 13, fontWeight: 600, color: 'var(--primary)', textDecoration: 'none', alignSelf: 'center' }}>Descargar</a>}
            {tiene && <Button variant="secondary" size="sm" loading={leyendo} onClick={() => void leer()}>Leer con IA</Button>}
            <Button variant={tiene ? 'tertiary' : 'primary'} size="sm" disabled={leyendo} onClick={() => archivo.current?.click()}>{tiene ? 'Reemplazar' : 'Subir contrato'}</Button>
          </div>
        )}
      </div>
      {resultado && <Aviso tono={resultado.tono}>{resultado.texto}</Aviso>}
      {ver && tiene && <VerDoc src={`/api/doc?leadId=${lead.id}&kind=contrato`} nombre={lead.contrato_nombre ?? 'Contrato'} onCerrar={() => setVer(false)} />}
    </Tarjeta>
  );
}

export function DatosFiscales({ ctx, titulo, diseno, editando }: PropsBloque) {
  const { lead } = ctx;
  const { guardar, toast, show } = useCampoDeal(ctx);
  const archivo = useRef<HTMLInputElement | null>(null);
  const { leyendo, resultado, leer } = useLeerDocumento(ctx, '/api/extract-deal-fiscal');
  const [identidades, setIdentidades] = useState<IdentidadFiscal[] | null>(null);
  const [ver, setVer] = useState(false);
  const [, start] = useTransition();
  useEffect(() => {
    let vivo = true;
    getIdentidadesFiscalesAction().then((l) => { if (vivo) setIdentidades(l); }).catch(() => { if (vivo) setIdentidades([]); });
    return () => { vivo = false; };
  }, []);
  const facturar = (v: string) => start(async () => {
    const r = await guardarCampoDealAction(lead.id, { seccion: 'lead', campo: 'facturado_por_id', valor: v ? Number(v) : null });
    if (!r.ok) { show(r.error, undefined, 'bad'); return; }
    ctx.parchear({ facturado_por_id: v ? Number(v) : null });
  });
  const tieneDoc = !!lead.deal_fiscal?.doc_path;
  const campos = Object.keys(CAMPOS_DEAL.fiscal);
  return (
    <Tarjeta titulo={titulo} marca={marcaDato('dealFiscal')}>
      <input ref={archivo} type="file" accept=".pdf,image/*" style={{ display: 'none' }} onChange={(e) => { const f = e.target.files?.[0]; if (f) void leer(f); e.target.value = ''; }} />
      <div style={{ ...caja, maxWidth: 440 }}>
        <span style={etiqueta}>Facturado por</span>
        <Dropdown value={lead.facturado_por_id != null ? String(lead.facturado_por_id) : ''} onChange={facturar} width="100%" ariaLabel="Facturado por"
          disabled={editando || identidades === null} placeholder={identidades === null ? 'Cargando…' : 'Elige una identidad'}
          options={[{ value: '', label: 'Sin definir' }, ...(identidades ?? []).map((i) => ({ value: String(i.id), label: i.nombre, sub: i.id_fiscal ?? undefined }))]} />
      </div>
      <Campos ctx={ctx} seccion="fiscal" campos={campos} editando={editando} guardar={guardar} respaldo={{ correo: lead.email }} compacta={diseno === 'compacta'} />
      <div style={franja} data-recorrido={marcaDato('dealFiscalDoc')}>
        <div style={{ flex: 1, minWidth: 180 }}>
          <div style={{ fontSize: 13.5, fontWeight: 600, color: 'var(--ink)' }}>{lead.deal_fiscal?.doc_nombre ?? (tieneDoc ? 'Documento fiscal' : 'Sin documento fiscal')}</div>
          <div style={{ fontSize: 12, color: 'var(--faint)', marginTop: 2 }}>La constancia, el RFC o el CUIT del cliente: se lee y completa lo vacío.</div>
        </div>
        {!editando && (
          <div style={{ display: 'flex', gap: 8, flexWrap: 'wrap' }}>
            {tieneDoc && <Button variant="secondary" size="sm" onClick={() => setVer((v) => !v)}>{ver ? 'Cerrar' : 'Ver'}</Button>}
            {tieneDoc && <a href={`/api/doc?leadId=${lead.id}&kind=fiscal&download=1`} style={{ fontSize: 13, fontWeight: 600, color: 'var(--primary)', textDecoration: 'none', alignSelf: 'center' }}>Descargar</a>}
            <Button variant={tieneDoc ? 'tertiary' : 'secondary'} size="sm" loading={leyendo} onClick={() => archivo.current?.click()}>{tieneDoc ? 'Reemplazar' : 'Subir documento'}</Button>
          </div>
        )}
      </div>
      {resultado && <Aviso tono={resultado.tono}>{resultado.texto}</Aviso>}
      {ver && tieneDoc && <VerDoc src={`/api/doc?leadId=${lead.id}&kind=fiscal`} nombre={lead.deal_fiscal?.doc_nombre ?? 'Documento fiscal'} onCerrar={() => setVer(false)} />}
      {toast}
    </Tarjeta>
  );
}

export function ServicioVendido({ ctx, titulo, diseno, editando }: PropsBloque) {
  const { lead } = ctx;
  const { guardar, toast, show } = useCampoDeal(ctx);
  const s = lead.deal_servicio ?? {};
  const inicioAMano = (v: string) => guardarCampoDealAction(lead.id, { seccion: 'lead', campo: 'fecha_inicio_servicio', valor: v || null }).then((r) => {
    if (!r.ok) return r.error;
    ctx.parchear({ fecha_inicio_servicio: v || null });
    if (r.cambio) show('Guardado', () => { void guardarCampoDealAction(lead.id, { seccion: 'lead', campo: 'fecha_inicio_servicio', valor: r.antes == null ? null : String(r.antes) }).then(() => ctx.releer()); });
    return null;
  });
  if (diseno === 'renglon') {
    const partes = [s.duracion, s.frecuencia, s.modalidad, s.sesiones].map((x) => x?.trim()).filter(Boolean);
    return (
      <Tarjeta titulo={titulo} marca={marcaDato('dealServicio')}>
        <EnLinea valor={s.que_es ?? ''} tipo="largo" titulo="Edita qué es el servicio" bloqueado={editando} estilo={{ fontSize: 14.5, fontWeight: 600 }} onGuardar={(v) => guardar('servicio', 'que_es', v)} />
        <span style={{ fontSize: 13.5, color: partes.length ? 'var(--dim)' : 'var(--faint)' }}>{partes.length ? partes.join(' · ') : 'Sin duración, frecuencia ni modalidad.'}</span>
        {toast}
      </Tarjeta>
    );
  }
  return (
    <Tarjeta titulo={titulo} marca={marcaDato('dealServicio')}>
      <Campos ctx={ctx} seccion="servicio" campos={Object.keys(CAMPOS_DEAL.servicio)} editando={editando} guardar={guardar} />
      <div style={{ ...caja, maxWidth: 260 }}>
        <span style={etiqueta}>Arrancó (cargado a mano)</span>
        <EnLinea valor={lead.fecha_inicio_servicio ?? ''} tipo="fecha" vacio="sin fecha" titulo="Edita cuándo arrancó el servicio" bloqueado={editando} estilo={{ fontSize: 14.5 }} onGuardar={inicioAMano} />
      </div>
      {toast}
    </Tarjeta>
  );
}

export function PromesaYGarantia({ ctx, titulo, diseno, editando }: PropsBloque) {
  const { guardar, toast } = useCampoDeal(ctx);
  const p = ctx.lead.deal_promesa ?? {};
  if (diseno === 'cita') {
    return (
      <Tarjeta titulo={titulo} marca={marcaDato('dealPromesa')}>
        <blockquote style={{ margin: 0, paddingLeft: 14, borderLeft: '3px solid var(--primary)', fontSize: 16, lineHeight: 1.5, color: 'var(--ink)' }}>
          <EnLinea valor={p.resultado ?? ''} tipo="largo" vacio="Sin promesa cargada" titulo="Edita el resultado prometido" bloqueado={editando} estilo={{ fontSize: 16 }} onGuardar={(v) => guardar('promesa', 'resultado', v)} />
        </blockquote>
        <span style={{ fontSize: 13, color: 'var(--dim)' }}>Garantía: <EnLinea valor={p.garantia ?? ''} tipo="largo" vacio="sin garantía" titulo="Edita la garantía" bloqueado={editando} estilo={{ fontSize: 13, display: 'inline' }} onGuardar={(v) => guardar('promesa', 'garantia', v)} /></span>
        {toast}
      </Tarjeta>
    );
  }
  return (
    <Tarjeta titulo={titulo} marca={marcaDato('dealPromesa')}>
      <Campos ctx={ctx} seccion="promesa" campos={Object.keys(CAMPOS_DEAL.promesa)} editando={editando} guardar={guardar} />
      {toast}
    </Tarjeta>
  );
}

/** Las dos listas: lo que hace el cliente y lo que hace el prestador. Cada renglón se edita, se quita o se agrega. */
export function Obligaciones({ ctx, titulo, diseno, editando }: PropsBloque) {
  const { lead } = ctx;
  const { toast, show, clear } = useToast();
  const [nuevo, setNuevo] = useState<Record<ParteObligacion, string>>({ cliente: '', prestador: '' });
  const [pending, start] = useTransition();
  const listas = { cliente: lead.deal_obligaciones?.cliente ?? [], prestador: lead.deal_obligaciones?.prestador ?? [] };
  const aplicar = (cambio: Parameters<typeof guardarObligacionAction>[1]) =>
    guardarObligacionAction(lead.id, cambio).then((r) => {
      if (!r.ok) return r.error;
      ctx.parchear({ deal_obligaciones: r.obligaciones });
      const atras = r.deshacer;
      show('Guardado', () => { void guardarObligacionAction(lead.id, atras).then((x) => { if (x.ok) ctx.parchear({ deal_obligaciones: x.obligaciones }); }); });
      return null;
    });
  const agregar = (parte: ParteObligacion) => start(async () => {
    const texto = nuevo[parte].trim();
    if (!texto) return;
    const e = await aplicar({ accion: 'agregar', parte, texto });
    if (e) show(e, undefined, 'bad'); else setNuevo((n) => ({ ...n, [parte]: '' }));
  });
  const lista = (parte: ParteObligacion, nombre: string) => (
    <div style={{ ...caja, gap: 8 }}>
      <span style={{ fontSize: 12.5, fontWeight: 600, color: 'var(--dim)' }}>{nombre}</span>
      {listas[parte].length === 0 && <span style={{ fontSize: 14, color: 'var(--faint)' }}>—</span>}
      <ul style={{ margin: 0, paddingLeft: diseno === 'tabla' ? 0 : 18, listStyle: diseno === 'tabla' ? 'none' : undefined, display: 'flex', flexDirection: 'column', gap: 4 }}>
        {listas[parte].map((o, i) => (
          <li key={`${i}-${o}`} style={{ display: 'flex', alignItems: 'flex-start', gap: 8, fontSize: 14, lineHeight: 1.5 }}>
            <span style={{ flex: 1, minWidth: 0 }}>
              <EnLinea valor={o} titulo="Edita el renglón" bloqueado={editando} estilo={{ fontSize: 14 }}
                onGuardar={(v) => (v ? aplicar({ accion: 'editar', parte, indice: i, texto: v, esperado: o }) : aplicar({ accion: 'quitar', parte, indice: i, esperado: o }))} />
            </span>
            {!editando && <Button variant="tertiary" size="sm" disabled={pending} onClick={() => start(async () => { const e = await aplicar({ accion: 'quitar', parte, indice: i, esperado: o }); if (e) show(e, undefined, 'bad'); })}>Quitar</Button>}
          </li>
        ))}
      </ul>
      {!editando && (
        <div style={{ display: 'flex', gap: 6 }}>
          <input className="mk-input" value={nuevo[parte]} maxLength={500} placeholder="Agregar…" aria-label={`Agregar una obligación ${parte === 'cliente' ? 'del cliente' : 'del prestador'}`}
            onChange={(e) => setNuevo((n) => ({ ...n, [parte]: e.target.value }))} onKeyDown={(e) => { if (e.key === 'Enter') { e.preventDefault(); agregar(parte); } }} />
          <Button variant="secondary" size="sm" disabled={pending || !nuevo[parte].trim()} onClick={() => agregar(parte)}>Agregar</Button>
        </div>
      )}
    </div>
  );
  return (
    <Tarjeta titulo={titulo} marca={marcaDato('dealObligaciones')}>
      <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(220px, 1fr))', gap: 10 }}>
        {lista('cliente', 'Del cliente')}
        {lista('prestador', 'Del prestador')}
      </div>
      <Toast state={toast} onClose={clear} />
    </Tarjeta>
  );
}
