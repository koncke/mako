'use client';

// =============================================================================
// CobroDeEtapaModal — «Vincular cobro»: qué producto cobra en Ganado, y por qué cuentas de Stripe o Mercado Pago
// =============================================================================
// Martín (22/10/2026): «Si conectamos la integración de Stripe y Mercado Pago, deberíamos poder vincular a la etapa GANADO
// en los 3 puntos, poder elegir el producto, tal como lo hacemos en "Asignar evento"... Y también que funcione igual, que
// pueda tener de MP y de Stripe al mismo tiempo... Y que pueda crear o editar los productos desde allí mismo... E incluso
// que pueda tener varias cuentas de stripe y MP conectadas». Se abre desde el «⋯» de la columna Ganado y su clic derecho
// (app/crm/CrmBoard.tsx), con el molde de «Asignar evento» (EventosDeEtapaModal.tsx).
//   · Cada producto vinculado, con su precio y una casilla por cuenta: Stripe y Mercado Pago a la vez, y varias de cada
//     uno. Con la casilla marcada, «Copiar link» da el link de pago de esa cuenta.
//   · «+ Producto»: elegir uno del catálogo o crearlo ahí mismo; nace vinculado con todas las cuentas. «Editar» lo cambia
//     en el lugar. «Quitar» lo desvincula y deja Deshacer.
//   · Sin cuentas, se conectan AHÍ MISMO (el modal de /integraciones arriba de éste: `BotonIntegracion`).
// El modelo y las acciones son de Cobros (app/crm/cobro-etapa-stub.ts dice dónde viven); lo que se dice, en
// app/crm/cobro-ganado.ts.
// =============================================================================

import { useCallback, useEffect, useState, type CSSProperties } from 'react';
import { createPortal } from 'react-dom';
import { Modal, Spinner, Toast, useToast, Button, SANS, MONO } from '@/app/_ui';
import { BotonIntegracion } from '@/app/_components/ConectarIntegracion';
import { IconoMenu } from '@/app/_ui/iconos-menu';
// ⚠️ STUB hasta que las acciones de Cobros lleguen a main (ver su cabecera): al integrar, este import cambia.
import {
  leerCobroDeEtapaAction, vincularProductoAEtapaAction, cambiarCuentasDelVinculoAction, desvincularProductoAction,
  guardarProductoCobroAction, linkDelVinculoAction,
  type FotoCobroEtapa, type ProductoCobro, type VinculoCobro,
} from './cobro-etapa-stub';
import { MAX_NOMBRE_PRODUCTO, NOMBRE_PROVEEDOR_PAGO, nombreDeCuenta, precioDeProducto, productoDeLoEscrito, productosParaVincular } from './cobro-ganado';

const TH: CSSProperties = {
  fontFamily: MONO, fontSize: 10, letterSpacing: '.08em', textTransform: 'uppercase',
  color: 'var(--faint)', fontWeight: 600, whiteSpace: 'nowrap',
};
const CASILLA: CSSProperties = { width: 16, height: 16, margin: 0, cursor: 'pointer', accentColor: 'var(--primary)' };
const CAMPO: CSSProperties = {
  height: 34, padding: '0 10px', borderRadius: 9, border: '1px solid var(--border-strong)', background: 'var(--surface)',
  color: 'var(--ink)', fontFamily: SANS, fontSize: 13.5, minWidth: 0,
};
const ENLACE: CSSProperties = { border: 'none', background: 'none', padding: 0, cursor: 'pointer', fontFamily: SANS, fontSize: 12.5, fontWeight: 600, color: 'var(--primary)' };
const ICONO: CSSProperties = { display: 'inline-flex', alignItems: 'center', justifyContent: 'center', width: 26, height: 26, border: 'none', borderRadius: 7, background: 'transparent', color: 'var(--dim)', cursor: 'pointer', padding: 0 };

/** Lo escrito en «Crear producto» / «Editar» (textos: lo valida `productoDeLoEscrito`). */
type Escrito = { nombre: string; tipo: 'unico' | 'suscripcion'; monto: string; meses: string; cuotas: string };
const VACIO: Escrito = { nombre: '', tipo: 'unico', monto: '', meses: '', cuotas: '' };
const deProducto = (p: ProductoCobro): Escrito => ({
  nombre: p.nombre, tipo: p.tipo, monto: p.montoUsd != null ? String(p.montoUsd) : '',
  meses: p.suscripcionMeses ? String(p.suscripcionMeses) : '', cuotas: p.cuotas ? String(p.cuotas) : '',
});

export function CobroDeEtapaModal({ funnelId, etapa, etapaNombre, onCerrar }: {
  funnelId: number;
  etapa: string;
  etapaNombre: string;
  onCerrar: () => void;
}) {
  const [montado, setMontado] = useState(false);
  const [foto, setFoto] = useState<FotoCobroEtapa | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [ocupado, setOcupado] = useState<string | null>(null);
  const { toast, show, clear } = useToast();
  useEffect(() => { setMontado(true); }, []);
  /** «+ Producto»: elegir del catálogo, o crear uno con lo escrito. */
  const [sumando, setSumando] = useState<null | { modo: 'elegir' } | { modo: 'crear'; escrito: Escrito }>(null);
  /** El producto que se edita en el lugar. */
  const [editando, setEditando] = useState<{ id: number; escrito: Escrito } | null>(null);
  const [errorForm, setErrorForm] = useState<string | null>(null);

  const leer = useCallback(() => {
    setError(null);
    void leerCobroDeEtapaAction(funnelId, etapa)
      .then((r) => { if (r.ok) setFoto(r.foto); else setError(r.error); })
      .catch(() => setError('No pude leer los cobros de esta etapa. Intenta de nuevo.'));
  }, [funnelId, etapa]);
  useEffect(() => { leer(); }, [leer]);

  /** Una escritura: marca qué está ocupado y, si cambió algo, vuelve a leer. */
  const correr = async (clave: string, hacer: () => Promise<boolean>) => {
    setOcupado(clave);
    try { if (await hacer()) leer(); } catch { show('No se pudo guardar', undefined, 'bad'); } finally { setOcupado(null); }
  };
  const todasLasCuentas = foto?.cuentas.map((c) => c.id) ?? [];

  const vincular = (productoId: number) => correr(`p:${productoId}`, async () => {
    const r = await vincularProductoAEtapaAction({ funnelId, etapa, productoId, cuentas: todasLasCuentas });
    if (!r.ok) { show(r.error, undefined, 'bad'); return false; }
    setSumando(null);
    show(`Cobra en «${etapaNombre}»`);
    return true;
  });
  const alternarCuenta = (v: VinculoCobro, cuentaId: string) => correr(`v:${v.id}`, async () => {
    const cuentas = v.cuentas.includes(cuentaId) ? v.cuentas.filter((c) => c !== cuentaId) : [...v.cuentas, cuentaId];
    // Sin ninguna cuenta el producto no cobra por ningún lado: eso es «Quitar», que lo dice y se deshace.
    if (!cuentas.length) { show('Deja al menos una cuenta, o quita el producto.', undefined, 'bad'); return false; }
    const r = await cambiarCuentasDelVinculoAction(v.id, cuentas);
    if (!r.ok) { show(r.error, undefined, 'bad'); return false; }
    return true;
  });
  const quitar = (v: VinculoCobro, nombre: string) => correr(`v:${v.id}`, async () => {
    const r = await desvincularProductoAction(v.id);
    if (!r.ok) { show(r.error, undefined, 'bad'); return false; }
    const d = r.deshacer;
    show(`«${nombre}» ya no cobra aquí`, () => {
      void vincularProductoAEtapaAction(d).then((q) => { if (!q.ok) show(q.error, undefined, 'bad'); leer(); });
    });
    return true;
  });
  /** Crear (y vincular con todas las cuentas) o guardar lo editado. */
  const guardarProducto = (escrito: Escrito, id?: number) => correr(id != null ? `e:${id}` : 'crear', async () => {
    const p = productoDeLoEscrito(escrito);
    if (!p.ok) { setErrorForm(p.error); return false; }
    setErrorForm(null);
    const r = await guardarProductoCobroAction(p.input, id);
    if (!r.ok) { setErrorForm(r.error); return false; }
    if (id != null) { setEditando(null); show('Producto guardado'); return true; }
    const v = await vincularProductoAEtapaAction({ funnelId, etapa, productoId: r.producto.id, cuentas: todasLasCuentas });
    setSumando(null);
    show(v.ok ? `Creado y cobra en «${etapaNombre}»` : `Creado, pero no se vinculó: ${v.error}`, undefined, v.ok ? undefined : 'bad');
    return true;
  });
  const copiarLink = (v: VinculoCobro, cuentaId: string) => correr(`l:${v.id}:${cuentaId}`, async () => {
    const r = await linkDelVinculoAction(v.id, cuentaId);
    if (!r.ok) { show(r.error, undefined, 'bad'); return false; }
    try { await navigator.clipboard.writeText(r.url); show('Link de pago copiado'); } catch { show(r.url); }
    return false;
  });

  const formProducto = (escrito: Escrito, poner: (e: Escrito) => void, guardar: () => void, cancelar: () => void, rotulo: string, cargando: boolean) => (
    <form onSubmit={(ev) => { ev.preventDefault(); guardar(); }}
      style={{ display: 'flex', flexDirection: 'column', gap: 8, padding: 12, borderRadius: 12, background: 'var(--surface-2)' }}>
      <div style={{ display: 'flex', alignItems: 'center', gap: 8, flexWrap: 'wrap' }}>
        <input autoFocus value={escrito.nombre} maxLength={MAX_NOMBRE_PRODUCTO} placeholder="Nombre del producto" aria-label="Nombre del producto"
          onChange={(ev) => poner({ ...escrito, nombre: ev.target.value })} style={{ ...CAMPO, flex: '1 1 220px' }} />
        <select value={escrito.tipo} aria-label="Cómo se cobra" onChange={(ev) => poner({ ...escrito, tipo: ev.target.value as Escrito['tipo'] })} style={CAMPO}>
          <option value="unico">Pago único</option>
          <option value="suscripcion">Suscripción</option>
        </select>
        <input value={escrito.monto} inputMode="decimal" aria-label={escrito.tipo === 'suscripcion' ? 'USD por mes' : 'Precio en USD'}
          placeholder={escrito.tipo === 'suscripcion' ? 'USD por mes' : 'Precio en USD'}
          onChange={(ev) => poner({ ...escrito, monto: ev.target.value })} style={{ ...CAMPO, width: 130 }} />
        {escrito.tipo === 'suscripcion'
          ? <input value={escrito.meses} inputMode="numeric" aria-label="Meses" placeholder="Meses (vacío: sin fin)"
            onChange={(ev) => poner({ ...escrito, meses: ev.target.value })} style={{ ...CAMPO, width: 170 }} />
          : <input value={escrito.cuotas} inputMode="numeric" aria-label="Cuotas" placeholder="Cuotas (1)"
            onChange={(ev) => poner({ ...escrito, cuotas: ev.target.value })} style={{ ...CAMPO, width: 110 }} />}
      </div>
      {errorForm && <p role="alert" style={{ margin: 0, fontSize: 12.5, color: 'var(--bad)' }}>{errorForm}</p>}
      <div style={{ display: 'flex', gap: 8 }}>
        <Button size="sm" type="submit" loading={cargando} disabled={ocupado != null}>{rotulo}</Button>
        <Button size="sm" variant="secondary" onClick={cancelar}>Cancelar</Button>
      </div>
    </form>
  );

  const fila = (v: VinculoCobro) => {
    if (!foto) return null;
    const p = foto.productos.find((x) => x.id === v.productoId);
    const nombre = p?.nombre ?? `Producto #${v.productoId}`;
    if (p && editando?.id === p.id) {
      return (
        <div key={v.id} role="row" style={{ padding: 8, borderTop: '1px solid var(--border)' }}>
          {formProducto(editando.escrito, (e) => setEditando({ id: p.id, escrito: e }), () => void guardarProducto(editando.escrito, p.id),
            () => { setEditando(null); setErrorForm(null); }, 'Guardar', ocupado === `e:${p.id}`)}
        </div>
      );
    }
    return (
      <div key={v.id} role="row" data-vinculo-cobro={v.id} style={{ padding: '11px 12px', borderTop: '1px solid var(--border)', display: 'flex', flexDirection: 'column', gap: 8 }}>
        <div style={{ display: 'flex', alignItems: 'center', gap: 10, minWidth: 0 }}>
          <span role="cell" style={{ flex: 1, minWidth: 0, overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>
            <span style={{ fontSize: 13.5, fontWeight: 600, color: 'var(--ink)' }}>{nombre}</span>
            {p && <span style={{ marginLeft: 8, fontSize: 12.5, color: 'var(--dim)' }}>{precioDeProducto(p)}</span>}
          </span>
          {ocupado === `v:${v.id}` && <Spinner size={13} />}
          {foto.puedeEditar && p && (
            <button type="button" disabled={ocupado != null} aria-label={`Editar ${nombre}`} title="Editar" style={ICONO}
              onClick={() => { setErrorForm(null); setEditando({ id: p.id, escrito: deProducto(p) }); }}>
              <IconoMenu nombre="editar" size={15} />
            </button>
          )}
          {foto.puedeEditar && (
            <button type="button" disabled={ocupado != null} aria-label={`Quitar ${nombre} de ${etapaNombre}`} title="Quitar" style={ICONO}
              onClick={() => void quitar(v, nombre)}>
              <IconoMenu nombre="quitar" size={15} />
            </button>
          )}
        </div>
        {/* UNA CASILLA POR CUENTA: Stripe y Mercado Pago a la vez, y varias de cada uno. */}
        <div role="cell" style={{ display: 'flex', alignItems: 'center', gap: 16, flexWrap: 'wrap' }}>
          {foto.cuentas.map((c) => {
            const marcada = v.cuentas.includes(c.id);
            return (
              <span key={c.id} style={{ display: 'inline-flex', alignItems: 'center', gap: 8, fontSize: 13, color: 'var(--ink)' }}>
                <label style={{ display: 'inline-flex', alignItems: 'center', gap: 6, cursor: foto.puedeEditar ? 'pointer' : 'default' }}>
                  <input type="checkbox" style={CASILLA} checked={marcada} disabled={!foto.puedeEditar || ocupado != null}
                    onChange={() => void alternarCuenta(v, c.id)} />
                  {nombreDeCuenta(c, foto.cuentas)}
                </label>
                {marcada && <button type="button" disabled={ocupado != null} onClick={() => void copiarLink(v, c.id)} style={ENLACE}>Copiar link</button>}
              </span>
            );
          })}
        </div>
      </div>
    );
  };

  const paraVincular = foto ? productosParaVincular(foto) : [];
  const contenido = (
    <div style={{ fontFamily: SANS }}>
      <div style={{ display: 'flex', alignItems: 'center', gap: 10, flexWrap: 'wrap', marginBottom: 12 }}>
        <span style={{ fontSize: 13.5, color: 'var(--dim)', flex: '1 1 260px' }}>
          Cuando alguien paga este producto, pasa a «{etapaNombre}» aquí, con su plan de pagos.
        </span>
        {foto?.puedeEditar && foto.cuentas.length > 0 && !sumando && (
          <Button size="sm" icon={<IconoMenu nombre="agregar" size={15} />} disabled={ocupado != null}
            onClick={() => { setErrorForm(null); setSumando(paraVincular.length ? { modo: 'elegir' } : { modo: 'crear', escrito: VACIO }); }}>
            Producto
          </Button>
        )}
        <Button size="sm" variant="secondary" onClick={leer}>Actualizar</Button>
      </div>

      {/* SIN CUENTAS, SE CONECTAN AHÍ MISMO: el modal de /integraciones arriba de éste (no se sale de la tab). */}
      {foto && foto.cuentas.length === 0 && (
        <div style={{ display: 'flex', alignItems: 'center', gap: 8, flexWrap: 'wrap', marginBottom: 12, fontSize: 13, color: 'var(--dim)' }}>
          <span>Conecta Stripe o Mercado Pago para cobrar desde esta etapa.</span>
          {(['stripe', 'mercadopago'] as const).map((prov) => (
            <BotonIntegracion key={prov} servicio={prov} onConectado={() => leer()}
              style={{ display: 'inline-flex', alignItems: 'center', gap: 6, height: 30, padding: '0 12px', borderRadius: 99, border: '1px solid var(--border-strong)', background: 'var(--surface)', color: 'var(--ink)', fontWeight: 600, fontSize: 13 }}>
              <IconoMenu nombre="link" size={14} /> Conectar {NOMBRE_PROVEEDOR_PAGO[prov]}
            </BotonIntegracion>
          ))}
        </div>
      )}

      {/* «+ PRODUCTO»: uno del catálogo, o crearlo ahí mismo (nace cobrando por todas las cuentas). */}
      {sumando?.modo === 'elegir' && (
        <div style={{ display: 'flex', flexDirection: 'column', gap: 8, padding: 12, marginBottom: 12, borderRadius: 12, background: 'var(--surface-2)' }}>
          <span style={{ fontSize: 13, color: 'var(--dim)' }}>Elige un producto de tu catálogo:</span>
          <div role="listbox" aria-label="Productos del catálogo" style={{ display: 'flex', flexDirection: 'column', gap: 4 }}>
            {paraVincular.map((p) => (
              <button key={p.id} type="button" role="option" aria-selected={false} disabled={ocupado != null} onClick={() => void vincular(p.id)}
                style={{ display: 'flex', alignItems: 'center', gap: 8, padding: '8px 10px', borderRadius: 9, border: '1px solid var(--border)', background: 'var(--surface)', cursor: 'pointer', fontFamily: SANS, textAlign: 'left' }}>
                <span style={{ flex: 1, minWidth: 0, fontSize: 13.5, fontWeight: 600, color: 'var(--ink)' }}>{p.nombre}</span>
                <span style={{ fontSize: 12.5, color: 'var(--dim)' }}>{precioDeProducto(p)}</span>
                {ocupado === `p:${p.id}` && <Spinner size={13} />}
              </button>
            ))}
          </div>
          <div style={{ display: 'flex', gap: 8 }}>
            <Button size="sm" variant="secondary" icon={<IconoMenu nombre="agregar" size={15} />} onClick={() => setSumando({ modo: 'crear', escrito: VACIO })}>Crear producto</Button>
            <Button size="sm" variant="secondary" onClick={() => setSumando(null)}>Cancelar</Button>
          </div>
        </div>
      )}
      {sumando?.modo === 'crear' && (
        <div style={{ marginBottom: 12 }}>
          {formProducto(sumando.escrito, (e) => setSumando({ modo: 'crear', escrito: e }), () => void guardarProducto(sumando.escrito),
            () => { setSumando(null); setErrorForm(null); }, 'Crear y vincular', ocupado === 'crear')}
        </div>
      )}

      <div role="table" aria-label={`Productos que cobran en ${etapaNombre}`} style={{ border: '1px solid var(--border)', borderRadius: 12, overflow: 'hidden' }}>
        <div role="row" style={{ display: 'flex', gap: 10, padding: '9px 12px', background: 'var(--surface-2)' }}>
          <span style={{ ...TH, flex: 1 }}>Producto</span>
          <span style={TH}>Cuentas</span>
        </div>
        {foto?.vinculos.map(fila)}
        {!foto && !error && <div style={{ padding: '34px 0', display: 'flex', justifyContent: 'center', borderTop: '1px solid var(--border)' }}><Spinner size={18} /></div>}
        {!foto && error && <p style={vacio('var(--bad)')}>{error}</p>}
        {foto && foto.vinculos.length === 0 && (
          <p style={vacio()}>{foto.cuentas.length ? 'Ningún producto cobra en esta etapa todavía.' : 'Sin una cuenta conectada no hay con qué cobrar.'}</p>
        )}
      </div>
      {foto && !foto.puedeEditar && (
        <p style={{ margin: '10px 0 0', fontSize: 12.5, color: 'var(--warn)' }}>Sólo el administrador puede cambiar los cobros.</p>
      )}
      <Toast state={toast} onClose={clear} />
    </div>
  );

  if (!montado) return null;
  return createPortal(
    <Modal titulo={<span style={{ display: 'inline-flex', alignItems: 'center', gap: 8 }}><IconoMenu nombre="dinero" size={18} /> Vincular cobro</span>}
      encabezado={<span style={{ fontSize: 12.5, color: 'var(--faint)' }}>{etapaNombre}</span>}
      onCerrar={onCerrar} ancho={820} alto="min(80vh, 640px)" sinFiletes>
      {contenido}
    </Modal>,
    document.body,
  );
}

const vacio = (color = 'var(--dim)'): CSSProperties => ({
  fontFamily: SANS, fontSize: 13.5, color, padding: '28px 12px', margin: 0, textAlign: 'center', borderTop: '1px solid var(--border)',
});
