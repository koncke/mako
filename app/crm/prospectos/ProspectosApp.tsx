'use client';
// =============================================================================
// ProspectosApp — buscar, ordenar por puntaje y pasar al CRM (Leads Scraper)
// =============================================================================
// La referencia es la lista de Apollo: una tabla ordenada por puntaje, selección en lote, y una
// barra abajo con lo que se hace con los elegidos. Lo que cambia la pantalla:
//   · «Elegir los 100 mejores» es lo que faltaba desde el 03/10 (separar los 100 mejores de 1.000):
//     elige por puntaje entre los que se pueden contactar.
//   · Un prospecto sin email ni teléfono se ve, pero no va al CRM (la regla del importador): la
//     fila lo dice y el diálogo de «Pasar al CRM» lo cuenta.
//   · Mientras una búsqueda corre, la lista se vuelve a pedir cada 20 s: así entran los resultados
//     aunque el aviso de Apify no llegue.
// El trabajo termina cuando el lead entra al CRM: qué se le escribe lo decide Automations.

import { useCallback, useEffect, useMemo, useState, type CSSProperties } from 'react';
import Link from '@/app/_ui/Link';
import { Button, Modal, PageHeader, Select, RadioGroup, TextField, Status, EmptyState, ErrorState, Spinner, Toast, useToast } from '@/app/_ui';
import { Icon } from '@/app/_components/icons';
import { BotonIntegracion } from '@/app/_components/ConectarIntegracion';
import { CANTIDADES, FUENTES_PROSPECCION, contactable, rotuloDeBusqueda, techoUsd, type Cantidad, type FuenteProspeccion } from '@/lib/prospectos-reglas';
import type { Busqueda, Prospecto, ListaProspectos } from '@/lib/prospectos';
import { buscarProspectosAction, cambiarEstadoProspectosAction, funnelDeProspeccionAction, listarProspectosAction, pasarProspectosAlCrmAction } from './actions';

type FunnelOpcion = { id: number; nombre: string; esDefault: boolean };
type Vista = 'nuevo' | 'descartado' | 'en_crm';

const VISTAS: Array<{ id: Vista; label: string }> = [
  { id: 'nuevo', label: 'Por revisar' },
  { id: 'en_crm', label: 'En el CRM' },
  { id: 'descartado', label: 'Descartados' },
];

const MEJORES = 100;

const CSS = `
.pros-tabla { width: 100%; border-collapse: collapse; }
.pros-tabla th { text-align: left; font-size: 12px; font-weight: 600; color: var(--dim); padding: 10px 12px; border-bottom: 1px solid var(--border); white-space: nowrap; }
.pros-tabla td { padding: 12px; border-bottom: 1px solid var(--border); vertical-align: top; font-size: 14px; color: var(--ink); }
.pros-tabla tr[data-elegido="1"] td { background: var(--primary-bg, var(--surface-2)); }
.pros-contacto { display: flex; flex-direction: column; gap: 3px; min-width: 0; }
.pros-contacto span, .pros-contacto a { display: inline-flex; align-items: center; gap: 6px; color: var(--ink); text-decoration: none; overflow: hidden; text-overflow: ellipsis; white-space: nowrap; max-width: 260px; }
.pros-sub { font-size: 12.5px; color: var(--dim); margin-top: 2px; }
.pros-puntaje { display: inline-flex; align-items: center; justify-content: center; min-width: 38px; height: 26px; padding: 0 8px; border-radius: 999px; font-weight: 700; font-size: 13px; }
.pros-busquedas { display: flex; flex-wrap: wrap; gap: 8px; }
.pros-chip { display: inline-flex; align-items: center; gap: 8px; padding: 7px 12px; border: 1px solid var(--border); border-radius: 999px; background: var(--surface); font-size: 13px; color: var(--ink); max-width: 100%; }
.pros-chip span { overflow: hidden; text-overflow: ellipsis; white-space: nowrap; }
.pros-barra { position: sticky; bottom: 12px; z-index: 30; display: flex; flex-wrap: wrap; align-items: center; gap: 10px; padding: 12px 14px; margin-top: 14px; border-radius: 14px; background: var(--ink); color: var(--bg, #F3F5F8); box-shadow: 0 16px 40px rgba(18,21,27,.22); }
.pros-vistas { display: inline-flex; gap: 4px; padding: 4px; border-radius: 12px; background: var(--surface-2); flex-wrap: wrap; }
.pros-vistas button { border: none; background: none; padding: 7px 12px; border-radius: 9px; font: inherit; font-size: 13.5px; color: var(--dim); cursor: pointer; }
.pros-vistas button[aria-pressed="true"] { background: var(--surface); color: var(--ink); font-weight: 600; box-shadow: 0 1px 2px rgba(0,0,0,.06); }
.pros-cards { display: none; }
@media (max-width: 760px) {
  .pros-tabla { display: none; }
  .pros-cards { display: flex; flex-direction: column; gap: 10px; }
  .pros-card { border: 1px solid var(--border); border-radius: 14px; background: var(--surface); padding: 14px; display: flex; gap: 12px; }
  .pros-card[data-elegido="1"] { border-color: var(--primary); }
}
`;

/** El color del puntaje: verde arriba, ámbar en el medio, gris abajo. Nunca el único portador: va el número. */
function colorPuntaje(n: number): CSSProperties {
  if (n >= 60) return { background: 'var(--good-bg, rgba(46,160,67,.12))', color: 'var(--good)' };
  if (n >= 35) return { background: 'var(--warn-bg, rgba(210,153,34,.14))', color: 'var(--warn)' };
  return { background: 'var(--surface-2)', color: 'var(--dim)' };
}

function tamano(p: Prospecto): string | null {
  const d = p.datos ?? {};
  if (p.fuente === 'google_maps') {
    if (d.resenas == null && d.rating == null) return null;
    return `${d.rating != null ? `${String(d.rating).replace('.', ',')}★ · ` : ''}${d.resenas ?? 0} reseñas`;
  }
  return d.seguidores != null ? `${d.seguidores.toLocaleString('es')} seguidores` : null;
}

function Contacto({ p }: { p: Prospecto }) {
  return (
    <div className="pros-contacto">
      {p.telefono && <span title={p.telefono}>Tel. {p.telefono}</span>}
      {p.email && <a href={`mailto:${p.email}`} title={p.email}><Icon name="email" size={14} />{p.email}</a>}
      {p.web && <a href={p.web} target="_blank" rel="noopener noreferrer" title={p.web}><Icon name="web" size={14} />{p.web.replace(/^https?:\/\/(www\.)?/, '').replace(/\/$/, '')}</a>}
      {p.instagram && <a href={`https://www.instagram.com/${p.instagram}/`} target="_blank" rel="noopener noreferrer"><Icon name="instagram" size={14} />@{p.instagram}</a>}
      {!contactable(p) && <span style={{ color: 'var(--warn)' }}>Sin email ni teléfono</span>}
    </div>
  );
}

function EstadoBusqueda({ b }: { b: Busqueda }) {
  if (b.estado === 'corriendo') return <><Spinner size={14} /><span>Buscando…</span></>;
  if (b.estado === 'fallo') return <Status tono="bad">Falló</Status>;
  return <Status tono="good">{b.nuevos} nuevos</Status>;
}

export function ProspectosApp({ funnels, esAdmin }: { funnels: FunnelOpcion[]; esAdmin: boolean }) {
  const [lista, setLista] = useState<ListaProspectos | null>(null);
  const [vista, setVista] = useState<Vista>('nuevo');
  const [fuente, setFuente] = useState<'todas' | FuenteProspeccion>('todas');
  const [texto, setTexto] = useState('');
  const [elegidos, setElegidos] = useState<Set<number>>(new Set());
  const [buscar, setBuscar] = useState(false);
  const [pasar, setPasar] = useState(false);
  const [ocupado, setOcupado] = useState(false);
  const { toast, show, clear } = useToast();

  const cargar = useCallback(async () => {
    try { setLista(await listarProspectosAction()); } catch (e) { setLista({ error: e instanceof Error ? e.message : 'No pude leer la lista.' }); }
  }, []);
  useEffect(() => { void cargar(); }, [cargar]);

  const corriendo = lista && !('error' in lista) && lista.busquedas.some((b) => b.estado === 'corriendo');
  useEffect(() => {
    if (!corriendo) return;
    const t = setInterval(() => { void cargar(); }, 20_000);
    return () => clearInterval(t);
  }, [corriendo, cargar]);

  const todos = useMemo(() => (lista && !('error' in lista) ? lista.prospectos : []), [lista]);
  const visibles = useMemo(() => {
    const q = texto.trim().toLowerCase();
    return todos.filter((p) => p.estado === vista
      && (fuente === 'todas' || p.fuente === fuente)
      && (!q || [p.nombre, p.rubro, p.ciudad, p.email, p.instagram].some((x) => x?.toLowerCase().includes(q))));
  }, [todos, vista, fuente, texto]);
  const cuenta = (v: Vista) => todos.filter((p) => p.estado === v).length;

  const alternar = (id: number) => setElegidos((s) => { const n = new Set(s); if (n.has(id)) n.delete(id); else n.add(id); return n; });
  const elegirMejores = () => setElegidos(new Set(visibles.filter(contactable).slice(0, MEJORES).map((p) => p.id)));
  const elegidosVisibles = visibles.filter((p) => elegidos.has(p.id));

  async function cambiar(estado: 'nuevo' | 'descartado') {
    setOcupado(true);
    try {
      const r = await cambiarEstadoProspectosAction([...elegidos], estado);
      show(estado === 'descartado' ? `${r.cambiados} descartados` : `${r.cambiados} de vuelta`);
      setElegidos(new Set());
      await cargar();
    } catch (e) {
      show(e instanceof Error ? e.message : 'No se pudo', undefined, 'bad');
    } finally { setOcupado(false); }
  }

  if (!lista) return <div style={{ padding: 40, display: 'flex', justifyContent: 'center' }}><Spinner /></div>;

  return (
    <>
      <style>{CSS}</style>
      <PageHeader
        titulo="Prospectos"
        proposito="Busca negocios y perfiles, ordénalos por puntaje y pasa al CRM los que elijas."
        accion={esAdmin
          ? <Button variant="primary" icon={<Icon name="search" size={16} />} onClick={() => setBuscar(true)}>Nueva búsqueda</Button>
          : <Button variant="secondary" disabled title="Buscar se cobra en la cuenta de Apify del negocio: lo hace un admin">Nueva búsqueda</Button>}
        acciones={<Link href="/crm" style={{ fontSize: 14, color: 'var(--dim)', textDecoration: 'none' }}>Volver al CRM</Link>}
      />

      {'error' in lista ? (
        <ErrorState titulo="No pude leer los prospectos" detalle={lista.error} onReintentar={() => { setLista(null); void cargar(); }} />
      ) : (
        <>
          {lista.busquedas.length > 0 && (
            <div className="pros-busquedas" style={{ marginBottom: 16 }}>
              {lista.busquedas.slice(0, 6).map((b) => (
                <span key={b.id} className="pros-chip" title={b.motivo ?? undefined}>
                  <span>{rotuloDeBusqueda(b.parametros)}</span>
                  <EstadoBusqueda b={b} />
                </span>
              ))}
            </div>
          )}

          {todos.length === 0 ? (
            <EmptyState
              titulo="Todavía no buscaste prospectos"
              detalle="Busca negocios en Google Maps o perfiles de Instagram. Los resultados se ordenan por puntaje y tú eliges cuáles van al CRM."
              accion={esAdmin ? { label: 'Nueva búsqueda', onClick: () => setBuscar(true) } : undefined}
            />
          ) : (
            <>
              <div style={{ display: 'flex', flexWrap: 'wrap', alignItems: 'center', gap: 10, marginBottom: 12 }}>
                <div className="pros-vistas" role="group" aria-label="Qué prospectos ver">
                  {VISTAS.map((v) => (
                    <button key={v.id} type="button" aria-pressed={vista === v.id} onClick={() => { setVista(v.id); setElegidos(new Set()); }}>
                      {v.label} · {cuenta(v.id)}
                    </button>
                  ))}
                </div>
                <Select ariaLabel="Fuente" value={fuente} onChange={(v) => setFuente(v as typeof fuente)} width={170}
                  options={[{ value: 'todas', label: 'Todas las fuentes' }, ...Object.entries(FUENTES_PROSPECCION).map(([k, f]) => ({ value: k, label: f.nombre }))]} />
                <input value={texto} onChange={(e) => setTexto(e.target.value)} placeholder="Buscar en la lista" aria-label="Buscar en la lista"
                  style={{ flex: '1 1 200px', minWidth: 0, height: 38, padding: '0 12px', borderRadius: 10, border: '1px solid var(--border-strong)', background: 'var(--surface)', color: 'var(--ink)', font: 'inherit', fontSize: 14 }} />
                {vista === 'nuevo' && (
                  <Button variant="secondary" size="sm" onClick={elegirMejores}>Elegir los {MEJORES} mejores</Button>
                )}
              </div>

              {visibles.length === 0 ? (
                <EmptyState inline titulo="No hay prospectos en esta vista" detalle="Cambia de vista o de fuente." />
              ) : (
                <>
                  <table className="pros-tabla">
                    <thead>
                      <tr>
                        <th style={{ width: 36 }}>
                          <input type="checkbox" aria-label="Elegir todos los de esta vista"
                            checked={elegidosVisibles.length > 0 && elegidosVisibles.length === visibles.length}
                            onChange={(e) => setElegidos(e.target.checked ? new Set(visibles.map((p) => p.id)) : new Set())} />
                        </th>
                        <th>Prospecto</th>
                        <th>Contacto</th>
                        <th>Tamaño</th>
                        <th>Puntaje</th>
                      </tr>
                    </thead>
                    <tbody>
                      {visibles.map((p) => (
                        <tr key={p.id} data-elegido={elegidos.has(p.id) ? '1' : '0'}>
                          <td><input type="checkbox" aria-label={`Elegir ${p.nombre}`} checked={elegidos.has(p.id)} onChange={() => alternar(p.id)} /></td>
                          <td>
                            <div style={{ fontWeight: 600 }}>{p.nombre}</div>
                            <div className="pros-sub">{[p.rubro, p.ciudad, FUENTES_PROSPECCION[p.fuente].nombre].filter(Boolean).join(' · ')}</div>
                          </td>
                          <td><Contacto p={p} /></td>
                          <td style={{ whiteSpace: 'nowrap', color: 'var(--dim)' }}>{tamano(p) ?? '—'}</td>
                          <td>
                            <span className="pros-puntaje" style={colorPuntaje(p.puntaje)}>{p.puntaje}</span>
                            {p.razon && <div className="pros-sub" style={{ maxWidth: 280 }}>{p.razon}</div>}
                          </td>
                        </tr>
                      ))}
                    </tbody>
                  </table>

                  <div className="pros-cards">
                    {visibles.map((p) => (
                      <label key={p.id} className="pros-card" data-elegido={elegidos.has(p.id) ? '1' : '0'}>
                        <input type="checkbox" aria-label={`Elegir ${p.nombre}`} checked={elegidos.has(p.id)} onChange={() => alternar(p.id)} style={{ marginTop: 3 }} />
                        <div style={{ flex: 1, minWidth: 0, display: 'flex', flexDirection: 'column', gap: 8 }}>
                          <div style={{ display: 'flex', justifyContent: 'space-between', gap: 10 }}>
                            <div style={{ minWidth: 0 }}>
                              <div style={{ fontWeight: 600 }}>{p.nombre}</div>
                              <div className="pros-sub">{[p.rubro, p.ciudad, tamano(p)].filter(Boolean).join(' · ')}</div>
                            </div>
                            <span className="pros-puntaje" style={colorPuntaje(p.puntaje)}>{p.puntaje}</span>
                          </div>
                          <Contacto p={p} />
                          {p.razon && <div className="pros-sub">{p.razon}</div>}
                        </div>
                      </label>
                    ))}
                  </div>
                </>
              )}

              {elegidos.size > 0 && (
                <div className="pros-barra" role="region" aria-label="Acciones con los elegidos">
                  <strong style={{ marginRight: 'auto' }}>{elegidos.size} elegidos</strong>
                  {vista === 'nuevo' && <Button variant="primary" size="sm" disabled={ocupado} onClick={() => setPasar(true)}>Pasar al CRM</Button>}
                  {vista === 'nuevo' && <Button variant="secondary" size="sm" disabled={ocupado} onClick={() => void cambiar('descartado')}>Descartar</Button>}
                  {vista === 'descartado' && <Button variant="secondary" size="sm" disabled={ocupado} onClick={() => void cambiar('nuevo')}>Volver a la lista</Button>}
                  <Button variant="tertiary" size="sm" onClick={() => setElegidos(new Set())}>Quitar la selección</Button>
                </div>
              )}
            </>
          )}
        </>
      )}

      {buscar && <NuevaBusqueda onCerrar={() => setBuscar(false)} onLanzada={(rotulo) => { setBuscar(false); show(`Buscando: ${rotulo}`); void cargar(); }} />}
      {pasar && (
        <PasarAlCrm
          elegidos={todos.filter((p) => elegidos.has(p.id) && p.estado === 'nuevo')}
          funnels={funnels}
          onCerrar={() => setPasar(false)}
          onListo={(n, yaEstaban) => { setPasar(false); setElegidos(new Set()); show(yaEstaban ? `${n} en el CRM · ${yaEstaban} ya estaban` : `${n} en el CRM`); void cargar(); }}
        />
      )}
      <Toast state={toast} onClose={clear} />
    </>
  );
}

// ── Nueva búsqueda ───────────────────────────────────────────────────────────

function NuevaBusqueda({ onCerrar, onLanzada }: { onCerrar: () => void; onLanzada: (rotulo: string) => void }) {
  const [fuente, setFuente] = useState<FuenteProspeccion>('google_maps');
  const [que, setQue] = useState('');
  const [donde, setDonde] = useState('');
  const [cuantos, setCuantos] = useState<Cantidad>(100);
  const [error, setError] = useState<string | null>(null);
  const [conectar, setConectar] = useState(false);
  const [enviando, setEnviando] = useState(false);
  const pideDonde = FUENTES_PROSPECCION[fuente].pideDonde;
  const techo = techoUsd({ fuente, cuantos });

  async function enviar() {
    setEnviando(true); setError(null);
    try {
      const r = await buscarProspectosAction({ fuente, que, donde, cuantos });
      if (r.ok) onLanzada(r.rotulo);
      else { setError(r.error); setConectar(r.conectar === 'apify'); }
    } catch (e) {
      setError(e instanceof Error ? e.message : 'No se pudo lanzar la búsqueda.');
    } finally { setEnviando(false); }
  }

  return (
    <Modal titulo="Nueva búsqueda de prospectos" onCerrar={onCerrar} ancho={560}
      pie={(
        <div style={{ display: 'flex', flexDirection: 'column', gap: 8, width: '100%' }}>
          <div style={{ fontSize: 13, color: 'var(--ink)' }}>Se cobra en tu cuenta de Apify: hasta US${techo.toFixed(2)}.</div>
          <div style={{ display: 'flex', gap: 10, justifyContent: 'flex-end', flexWrap: 'wrap' }}>
            {conectar && <BotonIntegracion servicio="apify" onConectado={() => { setConectar(false); setError(null); }}>Conectar Apify</BotonIntegracion>}
            <Button variant="primary" loading={enviando} disabled={!que.trim() || (pideDonde && !donde.trim())} onClick={() => void enviar()}>
              Buscar {cuantos}
            </Button>
          </div>
        </div>
      )}>
      <div style={{ display: 'flex', flexDirection: 'column', gap: 16 }}>
        <RadioGroup label="Dónde buscar" value={fuente} onChange={(v) => setFuente(v as FuenteProspeccion)} options={[
          { value: 'google_maps', label: 'Google Maps', hint: 'Negocios locales, con teléfono y web' },
          { value: 'instagram', label: 'Instagram', hint: 'Perfiles públicos por palabra clave' },
        ]} />
        <TextField label="Qué buscas" value={que} onChange={(e) => setQue(e.target.value)} maxLength={80}
          placeholder={fuente === 'google_maps' ? 'inmobiliarias' : 'coach de negocios'} />
        {pideDonde && (
          <TextField label="Dónde" value={donde} onChange={(e) => setDonde(e.target.value)} maxLength={80} placeholder="Tijuana, México" />
        )}
        <Select label="Cuántos" value={String(cuantos)} onChange={(v) => setCuantos(Number(v) as Cantidad)}
          options={CANTIDADES.map((n) => ({ value: String(n), label: String(n) }))} />
        {error && <div role="alert" style={{ fontSize: 13.5, color: 'var(--bad)' }}>{error}</div>}
      </div>
    </Modal>
  );
}

// ── Pasar al CRM ─────────────────────────────────────────────────────────────

function PasarAlCrm({ elegidos, funnels, onCerrar, onListo }: {
  elegidos: Prospecto[]; funnels: FunnelOpcion[]; onCerrar: () => void; onListo: (n: number, yaEstaban: number) => void;
}) {
  const van = elegidos.filter(contactable);
  const noVan = elegidos.length - van.length;
  const [funnel, setFunnel] = useState<string>(String(funnels.find((f) => f.esDefault)?.id ?? funnels[0]?.id ?? ''));
  const [enviando, setEnviando] = useState(false);
  const [error, setError] = useState<string | null>(null);

  // El funnel por defecto: el que declara «Prospección» (decisión 9). Si no hay uno solo, el del negocio.
  useEffect(() => {
    let vivo = true;
    void funnelDeProspeccionAction().then((id) => { if (vivo && id != null) setFunnel(String(id)); }).catch(() => {});
    return () => { vivo = false; };
  }, []);

  async function enviar() {
    setEnviando(true); setError(null);
    try {
      const r = await pasarProspectosAlCrmAction(van.map((p) => p.id), funnel ? Number(funnel) : null);
      if (r.errores.length && !r.creados && !r.enriquecidos) { setError(r.errores[0]); return; }
      onListo(r.creados + r.enriquecidos, r.omitidos);
    } catch (e) {
      setError(e instanceof Error ? e.message : 'No se pudo pasar al CRM.');
    } finally { setEnviando(false); }
  }

  return (
    <Modal titulo={`Pasar ${van.length} al CRM`} onCerrar={onCerrar} ancho={500}
      pie={(
        <div style={{ display: 'flex', justifyContent: 'flex-end', width: '100%' }}>
          <Button variant="primary" loading={enviando} disabled={!van.length} onClick={() => void enviar()}>
            Pasar {van.length} al CRM
          </Button>
        </div>
      )}>
      <div style={{ display: 'flex', flexDirection: 'column', gap: 14 }}>
        {funnels.length > 1 && (
          <Select label="A qué funnel" value={funnel} onChange={setFunnel}
            options={funnels.map((f) => ({ value: String(f.id), label: f.nombre }))} />
        )}
        <div style={{ fontSize: 14, color: 'var(--ink)' }}>
          Entran en la primera etapa. Si alguno ya está en tu CRM, no se duplica.
        </div>
        {noVan > 0 && <div style={{ fontSize: 13.5, color: 'var(--warn)' }}>{noVan} sin email ni teléfono: no van.</div>}
        {error && <div role="alert" style={{ fontSize: 13.5, color: 'var(--bad)' }}>{error}</div>}
      </div>
    </Modal>
  );
}
