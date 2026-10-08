'use client';

// =============================================================================
// /api-mako › Operaciones — el catálogo navegable del registro
// =============================================================================
// Recibe el ÍNDICE por props (armado en el server, datos.ts) y pide el detalle de
// una operación recién cuando se abre: el registro entero son ~360 mil caracteres
// y no tiene por qué viajar al navegador (AGENTS.md, «ningún 'use client' importa un
// VALOR del registro»).
//
// El filtro por canal arranca en «Por HTTP» porque esta es la pantalla de la API:
// lo que un token puede pedir. «Todos los canales» muestra además lo que hoy corre
// sólo por WhatsApp o en el chat de la app — el mapa de qué sabe hacer MaKo.
// =============================================================================

import { useEffect, useMemo, useState } from 'react';
import { Button, EmptyState, Input, Modal, NoResults, Select, Spinner, Status, Tag, type Tono } from '@/app/_ui';
import { TEXTO_ALCANCE } from '@/lib/api-mako/alcance';
import { Icon } from '@/app/_components/icons';
import { detalleOperacion, probarOperacion } from './actions';
import type { AreaIndice, DetalleOp, OpIndice, Prueba } from './datos';
import { Codigo, Metodo, Mono, useCopiar } from './piezas';

type FiltroTipo = 'todas' | 'lectura' | 'accion';
type FiltroCanal = 'http' | 'todos';

const sinAcentos = (s: string) => s.normalize('NFD').replace(/[̀-ͯ]/g, '').toLowerCase();

const CANAL: Record<string, string> = { http: 'HTTP', whatsapp: 'WhatsApp', app: 'App' };

const COSTO: Record<string, { texto: string; tono: Tono }> = {
  gratis: { texto: 'Gratis', tono: 'good' },
  externo: { texto: 'Sale a un proveedor', tono: 'neutral' },
  ia: { texto: 'Usa IA', tono: 'mako' },
  dinero: { texto: 'Gasta plata', tono: 'bad' },
};

export function Operaciones({ areas, operaciones, opInicial, onAbrir }: {
  areas: AreaIndice[];
  operaciones: OpIndice[];
  opInicial?: string;
  /** para que el shell escriba `?op=` en la URL (o lo saque con null) */
  onAbrir: (id: string | null) => void;
}) {
  const [q, setQ] = useState('');
  const [area, setArea] = useState('');
  const [tipo, setTipo] = useState<FiltroTipo>('todas');
  const [canal, setCanal] = useState<FiltroCanal>('http');
  const [abierta, setAbierta] = useState<string | null>(() => (opInicial && operaciones.some((o) => o.id === opInicial) ? opInicial : null));

  const tituloArea = useMemo(() => new Map(areas.map((a) => [a.area, a.titulo])), [areas]);

  const filtradas = useMemo(() => {
    const palabras = sinAcentos(q).split(/\s+/).filter(Boolean);
    return operaciones.filter((o) => {
      if (area && o.area !== area) return false;
      if (tipo === 'lectura' && o.tipo !== 'lectura') return false;
      if (tipo === 'accion' && o.tipo === 'lectura') return false;
      if (canal === 'http' && !o.canales.includes('http')) return false;
      if (!palabras.length) return true;
      const pajar = sinAcentos(`${o.id.replace(/_/g, ' ')} ${o.titulo} ${o.resumen} ${tituloArea.get(o.area) ?? ''}`);
      return palabras.every((p) => pajar.includes(p));
    });
  }, [operaciones, q, area, tipo, canal, tituloArea]);

  const porArea = useMemo(() => {
    const m = new Map<string, OpIndice[]>();
    for (const o of filtradas) m.set(o.area, [...(m.get(o.area) ?? []), o]);
    return areas.filter((a) => m.has(a.area)).map((a) => ({ ...a, ops: m.get(a.area)! }));
  }, [filtradas, areas]);

  const [abiertas, setAbiertas] = useState<Set<string>>(() => {
    const op = opInicial ? operaciones.find((o) => o.id === opInicial) : undefined;
    return new Set(op ? [op.area] : []);
  });
  const forzarAbiertas = !!q.trim() || !!area;

  const abrir = (id: string | null) => { setAbierta(id); onAbrir(id); };
  const limpiar = () => { setQ(''); setArea(''); setTipo('todas'); setCanal('http'); };
  const hayFiltro = !!q || !!area || tipo !== 'todas' || canal !== 'http';

  if (!operaciones.length) {
    return <EmptyState titulo="Sin operaciones" detalle="Tu plan no incluye ninguna tab con operaciones." />;
  }

  return (
    <div style={{ display: 'flex', flexDirection: 'column', gap: 16 }}>
      <div style={{ display: 'flex', gap: 10, flexWrap: 'wrap', alignItems: 'center' }}>
        <div style={{ flex: '1 1 240px', minWidth: 0 }}>
          <Input value={q} onChange={(e) => setQ(e.target.value)} placeholder="Buscar: lead, campaña, tarea…" aria-label="Buscar operaciones" />
        </div>
        <Select ariaLabel="Área" value={area} onChange={setArea} width={220}
          options={[{ value: '', label: 'Todas las áreas' }, ...areas.map((a) => ({ value: a.area, label: a.titulo }))]} />
        <Select ariaLabel="Tipo" value={tipo} onChange={(v) => setTipo(v as FiltroTipo)} width={150}
          options={[{ value: 'todas', label: 'Todas' }, { value: 'lectura', label: 'Lecturas' }, { value: 'accion', label: 'Acciones' }]} />
        <Select ariaLabel="Canal" value={canal} onChange={(v) => setCanal(v as FiltroCanal)} width={180}
          options={[{ value: 'http', label: 'Por HTTP' }, { value: 'todos', label: 'Todos los canales' }]} />
      </div>

      <div style={{ fontSize: 'var(--fs-meta)', color: 'var(--faint)' }}>
        {filtradas.length} de {operaciones.length}
        {hayFiltro && <> · <button type="button" onClick={limpiar} style={{ border: 'none', background: 'none', padding: 0, color: 'var(--primary)', cursor: 'pointer', font: 'inherit' }}>Limpiar</button></>}
      </div>

      {!filtradas.length ? <NoResults query={q || undefined} onLimpiar={limpiar} /> : porArea.map((a) => {
        // Cerradas hasta que alguien las pide: son ~380 filas, y la pregunta con que se
        // llega es «¿qué hay en CRM?», no leer todo. Con una búsqueda o un área elegida
        // se abren solas: ahí lo que queda ES la respuesta. Las filas de un área
        // cerrada no se dibujan (un <details> cerrado igual las mete al DOM).
        const abierta = forzarAbiertas || abiertas.has(a.area);
        return (
        <details key={a.area} className="mk-plegable" open={abierta}
          onToggle={(e) => {
            if (forzarAbiertas) return;
            const ahora = (e.currentTarget as HTMLDetailsElement).open;
            setAbiertas((s) => { const n = new Set(s); if (ahora) n.add(a.area); else n.delete(a.area); return n; });
          }}>
          <summary className="mk-plegable__resumen">
            <span className="mk-plegable__chev"><Icon name="chevron" size={15} /></span>
            {a.titulo}
            <span className="mk-plegable__n">{a.ops.length}</span>
          </summary>
          {abierta && <div className="mk-plegable__lista">
          {a.ops.map((o) => (
            <button key={o.id} type="button" className="mk-menu-fila" onClick={() => abrir(o.id)} aria-haspopup="dialog"
              style={{
                display: 'flex', gap: 12, alignItems: 'flex-start', width: '100%', textAlign: 'left',
                padding: '10px 6px', border: 'none', borderBottom: '1px solid var(--border)', background: 'none',
                cursor: 'pointer', font: 'inherit', color: 'inherit',
              }}>
              <span style={{ paddingTop: 2 }}><Metodo metodo={o.metodo} /></span>
              <span style={{ flex: 1, minWidth: 0, display: 'flex', flexDirection: 'column', gap: 3 }}>
                <span style={{ display: 'flex', gap: 8, alignItems: 'baseline', flexWrap: 'wrap' }}>
                  <span style={{ fontWeight: 600, color: 'var(--ink)', fontSize: 'var(--fs-md)' }}>{o.titulo}</span>
                  <Mono tenue>{o.id}</Mono>
                </span>
                <span style={{ fontSize: 'var(--fs-sm)', color: 'var(--dim)', lineHeight: 1.45 }}>{o.resumen}</span>
              </span>
              <span style={{ display: 'flex', gap: 6, flexWrap: 'wrap', justifyContent: 'flex-end', flex: 'none', maxWidth: 200 }}>
                {o.confirmacion === 'pantalla' && <Tag>Pantalla</Tag>}
                {o.confirmacion === 'chat' && <Tag>Pendiente</Tag>}
                {o.tipo === 'control' && <Tag>Control</Tag>}
                {!o.canales.includes('http') && <Tag>Sin HTTP</Tag>}
              </span>
            </button>
          ))}
          </div>}
        </details>
        );
      })}

      {abierta && <DetalleModal id={abierta} onCerrar={() => abrir(null)} />}
    </div>
  );
}

// ── El detalle de una operación ──────────────────────────────────────────────

function DetalleModal({ id, onCerrar }: { id: string; onCerrar: () => void }) {
  const [detalle, setDetalle] = useState<DetalleOp | null>(null);
  const [error, setError] = useState<string | null>(null);
  const { copiar, copiado } = useCopiar();

  useEffect(() => {
    let vivo = true;
    setDetalle(null); setError(null);
    detalleOperacion(id).then(
      (r) => { if (!vivo) return; if ('error' in r) setError(r.error); else setDetalle(r.detalle); },
      () => { if (vivo) setError('No se pudo abrir. Prueba de nuevo.'); },
    );
    return () => { vivo = false; };
  }, [id]);

  return (
    <Modal ancho={760} onCerrar={onCerrar}
      titulo={detalle?.titulo ?? 'Operación'}
      encabezado={<Mono>{detalle ? `${detalle.metodo} ${detalle.ruta}` : id}</Mono>}
      pie={<Button variant="secondary" onClick={onCerrar}>Cerrar</Button>}>
      {error ? <div style={{ color: 'var(--bad)', fontSize: 'var(--fs-sm)' }}>{error}</div>
        : !detalle ? <div style={{ display: 'flex', justifyContent: 'center', padding: 30 }}><Spinner /></div>
        : <CuerpoDetalle d={detalle} copiar={copiar} copiado={copiado} />}
    </Modal>
  );
}

function Rotulo({ children }: { children: string }) {
  return <div style={{ fontSize: 'var(--fs-meta)', fontWeight: 600, color: 'var(--faint)', textTransform: 'uppercase', letterSpacing: '.06em', marginBottom: 8 }}>{children}</div>;
}

function CuerpoDetalle({ d, copiar, copiado }: { d: DetalleOp; copiar: (k: string, t: string) => void; copiado: string | null }) {
  const costo = COSTO[d.costo] ?? { texto: d.costo, tono: 'neutral' as Tono };
  return (
    <div style={{ display: 'flex', flexDirection: 'column', gap: 20 }}>
      <div style={{ display: 'flex', gap: 6, flexWrap: 'wrap' }}>
        <Status tono={d.tipo === 'lectura' ? 'good' : 'info'}>{d.tipo === 'lectura' ? 'Lectura' : d.tipo === 'control' ? 'Control' : 'Acción'}</Status>
        <Status tono={costo.tono}>{costo.texto}</Status>
        {d.lenta && <Status tono="warn">Puede tardar</Status>}
        {d.canales.map((c) => <Tag key={c}>{CANAL[c] ?? c}</Tag>)}
      </div>

      <p style={{ margin: 0, fontSize: 'var(--fs-md)', color: 'var(--ink)', lineHeight: 1.6, whiteSpace: 'pre-wrap' }}>{d.descripcion}</p>

      <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(200px, 1fr))', gap: 12 }}>
        <Dato k="Token mínimo" v={TEXTO_ALCANCE[d.alcance].titulo} />
        {d.confirmacion && <Dato k="Se confirma" v={d.confirmacion === 'chat' ? 'Pendiente: la confirma una persona' : `En una pantalla (${d.pantalla ?? '/mako/revisar'})`} />}
        {/* Un paso «⚡ Acción» de un flujo corre cualquier acción del canal `app` sin pedir el
            sí: se da al armar el paso (decisión A de Martín, 08/10; lib/api-mako/flujo.ts). */}
        {d.tipo === 'accion' && <Dato k="En una automatización" v={d.canales.includes('app') ? 'Corre sola: el sí se da al armar el paso' : 'No disponible'} />}
        {d.escribe && <Dato k="Escribe" v={d.escribe} />}
        {d.reversible != null && <Dato k="Se puede deshacer" v={d.reversible ? 'Sí' : 'No'} />}
        {d.salida && <Dato k="Devuelve" v={d.formatos?.length ? `${d.salida} · ?formato= ${d.formatos.join(', ')}` : d.salida} />}
        {d.requisitos.map((r) => <Dato key={r} k="Requisito" v={r} />)}
        {!!d.alias.length && <Dato k="También responde como" v={d.alias.join(', ')} />}
      </div>

      <div>
        <Rotulo>Parámetros</Rotulo>
        {!d.parametros.length ? <div style={{ fontSize: 'var(--fs-sm)', color: 'var(--faint)' }}>Sin parámetros.</div> : (
          <div className="mk-scroll-x" style={{ overflowX: 'auto' }}>
            <table style={{ width: '100%', borderCollapse: 'collapse', fontSize: 'var(--fs-sm)' }}>
              <tbody>
                {d.parametros.map((p) => (
                  <tr key={p.nombre} style={{ borderTop: '1px solid var(--border)' }}>
                    <td style={{ padding: '8px 10px 8px 0', verticalAlign: 'top', whiteSpace: 'nowrap' }}>
                      <Mono>{p.nombre}</Mono>{p.obligatorio && <span style={{ color: 'var(--bad)' }} title="Obligatorio"> *</span>}
                    </td>
                    <td style={{ padding: '8px 10px', verticalAlign: 'top', whiteSpace: 'nowrap', color: 'var(--faint)' }}>{p.tipo}</td>
                    <td style={{ padding: '8px 0 8px 10px', verticalAlign: 'top', color: 'var(--dim)', lineHeight: 1.5 }}>
                      {p.descripcion}
                      {p.enum && <div style={{ marginTop: 4 }}><Mono tenue>{p.enum.join(' | ')}</Mono></div>}
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        )}
      </div>

      <div>
        <Rotulo>Ejemplo</Rotulo>
        {d.curl ? <Codigo texto={d.curl} clave="curl" copiar={copiar} copiado={copiado} />
          : <div style={{ fontSize: 'var(--fs-sm)', color: 'var(--dim)' }}>No sale por HTTP: corre por {d.canales.map((c) => CANAL[c] ?? c).join(' y ')}.</div>}
      </div>

      {d.probable && <Probar d={d} />}
    </div>
  );
}

function Dato({ k, v }: { k: string; v: string }) {
  return (
    <div style={{ display: 'flex', flexDirection: 'column', gap: 3, minWidth: 0 }}>
      <span style={{ fontSize: 'var(--fs-meta)', color: 'var(--faint)' }}>{k}</span>
      <span style={{ fontSize: 'var(--fs-sm)', color: 'var(--ink)', lineHeight: 1.45 }}>{v}</span>
    </div>
  );
}

// ── Probar: la lectura corre de verdad, con tus datos ─────────────────────────

function Probar({ d }: { d: DetalleOp }) {
  // Solo los parámetros de primer nivel: los de un `object` no van por query string.
  const params = d.parametros.filter((p) => !p.nombre.includes('.') && !p.tipo.startsWith('object'));
  const [valores, setValores] = useState<Record<string, string>>({});
  const [corriendo, setCorriendo] = useState(false);
  const [r, setR] = useState<Prueba | null>(null);
  const { copiar, copiado } = useCopiar();

  const correr = async () => {
    setCorriendo(true); setR(null);
    try { setR(await probarOperacion(d.id, valores)); }
    catch { setR({ ok: false, error: 'No se pudo correr. Prueba de nuevo.' }); }
    finally { setCorriendo(false); }
  };

  return (
    <div style={{ borderTop: '1px solid var(--border)', paddingTop: 16, display: 'flex', flexDirection: 'column', gap: 12 }}>
      <Rotulo>Probar con tus datos</Rotulo>
      {params.length > 0 && (
        <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(200px, 1fr))', gap: 10 }}>
          {params.map((p) => (
            <label key={p.nombre} style={{ display: 'flex', flexDirection: 'column', gap: 4, minWidth: 0 }}>
              <span style={{ fontSize: 'var(--fs-meta)', color: 'var(--dim)' }}><Mono>{p.nombre}</Mono>{p.obligatorio && <span style={{ color: 'var(--bad)' }}> *</span>}</span>
              {p.enum || p.tipo === 'boolean' ? (
                <Select ariaLabel={p.nombre} value={valores[p.nombre] ?? ''} onChange={(v) => setValores((x) => ({ ...x, [p.nombre]: v }))}
                  options={[{ value: '', label: '—' }, ...(p.enum ?? ['true', 'false']).map((e) => ({ value: e, label: e }))]} />
              ) : (
                <Input value={valores[p.nombre] ?? ''} placeholder={p.ejemplo ?? (p.tipo === 'string[]' ? 'a,b,c' : '')}
                  onChange={(e) => setValores((x) => ({ ...x, [p.nombre]: e.target.value }))} />
              )}
            </label>
          ))}
        </div>
      )}
      <div><Button onClick={() => void correr()} loading={corriendo}>Probar</Button></div>
      {r && !r.ok && (
        <div style={{ fontSize: 'var(--fs-sm)', color: 'var(--bad)' }}>
          {r.error}{r.faltan?.length ? ` Falta: ${r.faltan.join(', ')}.` : ''}
        </div>
      )}
      {r && r.ok && (
        <div style={{ display: 'flex', flexDirection: 'column', gap: 8 }}>
          <div style={{ display: 'flex', gap: 8, alignItems: 'center', fontSize: 'var(--fs-meta)', color: 'var(--faint)' }}>
            <Status tono="good">200</Status> {r.formato} · {r.ms} ms{r.recortado ? ' · recortado' : ''}
          </div>
          <Codigo texto={r.texto || '(vacío)'} clave="prueba" copiar={copiar} copiado={copiado} alto={360} />
        </div>
      )}
    </div>
  );
}
