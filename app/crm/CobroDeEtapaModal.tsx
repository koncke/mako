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
//     uno (hoy Cobros trae la principal de cada pasarela; las demás llegan después, con los mismos ids).
//   · SIN «COPIAR LINK» POR AHORA: `linkDelVinculoAction` todavía no da el link sin un lead (Cobros, 22/10). Vuelve
//     cuando lo dé.
//   · «+ Producto»: elegir uno del catálogo o crearlo ahí mismo; nace vinculado con todas las cuentas. «Editar» lo cambia
//     en el lugar. «Quitar» lo desvincula y deja Deshacer.
//   · Sin cuentas, se conectan AHÍ MISMO (el modal de /integraciones arriba de éste: `BotonIntegracion`).
// El modelo y las acciones son de Cobros (lib/cobro-etapa.ts y app/crm/cobro-etapa-actions.ts); lo que se dice, en
// app/crm/cobro-ganado.ts.
//
// SEGUNDA VUELTA (22/10/2026, noche): lo mismo que «Vincular evento» (Martín: «aplicá todo lo de abajo a los dos»):
//   · cada cambio queda EN EL LUGAR con lo que contestó el server (el vínculo, el producto): no se vuelve a leer todo;
//   · el CRM y la etapa arriba («Sprint 3 días › Ganado»); el texto largo («Cuando alguien paga…») va en una ⓘ;
//   · rediseñado con la hoja de los dos pop-ups (app/crm/vincular-etapa.ts): renglones y, por cuenta, una pastilla que
//     se prende o se apaga (en vez de una casilla con el nombre al lado).
// =============================================================================

import { PASARELAS } from '@/lib/cobros-tipos';
import { useCallback, useEffect, useState, type CSSProperties } from 'react';
import { createPortal } from 'react-dom';
import { Modal, Spinner, Toast, useToast, Button, SANS } from '@/app/_ui';
import { BotonIntegracion } from '@/app/_components/ConectarIntegracion';
import { IconoMenu } from '@/app/_ui/iconos-menu';
import {
  leerCobroDeEtapaAction, vincularProductoAEtapaAction, cambiarCuentasDelVinculoAction, desvincularProductoAction,
  guardarProductoCobroAction, preciosDeStripeAction, vincularPrecioDeStripeAction, type AvisoDeCuentaStripe, type PrecioDeStripe,
} from './cobro-etapa-actions';
import { TEXTO_AL_PAGAR, type FotoCobroEtapa, type ProductoCobro, type VinculoCobro } from '@/lib/cobro-etapa';
import {
  MAX_NOMBRE_PRODUCTO, NOMBRE_PROVEEDOR_PAGO, nombreDeCuenta, opcionesDeCobro, precioDeProducto, precioDeStripeTexto, productoDeLoEscrito,
} from './cobro-ganado';
import { CSS_VINCULAR, PASTILLA_CONECTAR } from './vincular-etapa';
import { ReportarASoporte } from '@/app/_ui/ReportarASoporte';

/** Un renglón de «+ Producto»: nombre · precio · ruedita. */
const FILA_OPCION: CSSProperties = { width: '100%', gridTemplateColumns: 'minmax(0, 1fr) auto auto', cursor: 'pointer', textAlign: 'left', font: 'inherit' };

const CAMPO: CSSProperties = {
  height: 34, padding: '0 10px', borderRadius: 9, border: '1px solid var(--border-strong)', background: 'var(--surface)',
  color: 'var(--ink)', fontFamily: SANS, fontSize: 13.5, minWidth: 0,
};

/** Lo escrito en «Crear producto» / «Editar» (textos: lo valida `productoDeLoEscrito`). */
type Escrito = { nombre: string; tipo: 'unico' | 'suscripcion'; monto: string; meses: string; cuotas: string };
const VACIO: Escrito = { nombre: '', tipo: 'unico', monto: '', meses: '', cuotas: '' };
const deProducto = (p: ProductoCobro): Escrito => ({
  nombre: p.nombre, tipo: p.tipo, monto: p.montoUsd != null ? String(p.montoUsd) : '',
  meses: p.suscripcionMeses ? String(p.suscripcionMeses) : '', cuotas: p.cuotas ? String(p.cuotas) : '',
});

export function CobroDeEtapaModal({ funnelId, etapa, etapaNombre, crmNombre, onCerrar }: {
  funnelId: number;
  etapa: string;
  etapaNombre: string;
  /** El nombre del CRM, para decir dónde cobra («Sprint 3 días › Ganado»). */
  crmNombre: string;
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
  /**
   * Los precios de las cuentas de Stripe, EN VIVO (23/10/2026, la llamada con Mauricio: su producto estaba en Stripe con
   * precio y el pop-up decía «Este producto no tiene precio»). Llegan aparte y no frenan la foto. null = leyendo.
   */
  const [stripe, setStripe] = useState<{ precios: PrecioDeStripe[]; errores: AvisoDeCuentaStripe[] } | null>(null);

  const leer = useCallback(() => {
    setError(null);
    void leerCobroDeEtapaAction(funnelId, etapa)
      .then((r) => { if (r.ok) setFoto(r.foto); else setError(r.error); })
      .catch(() => setError('No pude leer los cobros de esta etapa. Intenta de nuevo.'));
    // En paralelo: «Volver a leer» y conectar una cuenta los traen de nuevo. Un fallo se dice, nunca es «no hay».
    setStripe(null);
    void preciosDeStripeAction()
      .then((r) => setStripe(r.ok ? { precios: r.precios, errores: r.errores } : { precios: [], errores: [{ cuenta: 'stripe', cuentaNombre: 'Stripe', error: r.error }] }))
      .catch(() => setStripe({ precios: [], errores: [{ cuenta: 'stripe', cuentaNombre: 'Stripe', error: 'no contestó' }] }));
  }, [funnelId, etapa]);
  useEffect(() => { leer(); }, [leer]);

  /** Una escritura: marca qué está ocupado. La foto la deja al día cada una, con lo que contestó el server (sin volver a leer). */
  const correr = async (clave: string, hacer: () => Promise<boolean>) => {
    setOcupado(clave);
    try { await hacer(); } catch { show('No se pudo guardar', undefined, 'bad'); } finally { setOcupado(null); }
  };
  /** El vínculo que contestó el server, en su lugar (o agregado). */
  const ponerVinculo = (v: VinculoCobro) =>
    setFoto((f) => (f ? { ...f, vinculos: f.vinculos.some((x) => x.id === v.id) ? f.vinculos.map((x) => (x.id === v.id ? v : x)) : [...f.vinculos, v] } : f));
  const ponerProducto = (p: ProductoCobro) =>
    setFoto((f) => (f ? { ...f, productos: f.productos.some((x) => x.id === p.id) ? f.productos.map((x) => (x.id === p.id ? p : x)) : [...f.productos, p] } : f));
  const todasLasCuentas = foto?.cuentas.map((c) => c.id) ?? [];

  const vincular = (productoId: number) => correr(`p:${productoId}`, async () => {
    const r = await vincularProductoAEtapaAction({ funnelId, etapa, productoId, cuentas: todasLasCuentas });
    if (!r.ok) { show(r.error, undefined, 'bad'); return false; }
    ponerVinculo(r.vinculo);
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
    ponerVinculo(r.vinculo);
    return true;
  });
  const quitar = (v: VinculoCobro, nombre: string) => correr(`v:${v.id}`, async () => {
    const r = await desvincularProductoAction(v.id);
    if (!r.ok) { show(r.error, undefined, 'bad'); return false; }
    setFoto((f) => (f ? { ...f, vinculos: f.vinculos.filter((x) => x.id !== v.id) } : f));
    const d = r.deshacer;
    show(`«${nombre}» ya no cobra aquí`, () => {
      void vincularProductoAEtapaAction(d).then((q) => { if (q.ok) ponerVinculo(q.vinculo); else show(q.error, undefined, 'bad'); });
    });
    return true;
  });
  /**
   * Un precio de Stripe: Cobros lo trae al catálogo (o le pone ese precio al de MaKo con el mismo nombre) y lo vincula.
   * Sin `cuentas`: cobra por la cuenta de Stripe donde está (las pastillas lo cambian después). El monto lo vuelve a leer
   * el server en Stripe: de acá sale sólo QUÉ precio.
   */
  const traerDeStripe = (precio: PrecioDeStripe) => correr(`s:${precio.precio}`, async () => {
    const r = await vincularPrecioDeStripeAction({ funnelId, etapa, cuenta: precio.cuenta, precio: precio.precio });
    // Si lo trajo y no se vinculó, el producto ya está en el catálogo: se pone igual, y el error dice qué quedó hecho.
    if ('producto' in r && r.producto) ponerProducto(r.producto);
    if (!r.ok) { show(r.error, undefined, 'bad'); return false; }
    ponerVinculo(r.vinculo);
    setStripe((s) => (s ? { ...s, precios: s.precios.map((x) => (x.precio === precio.precio ? { ...x, enMako: r.producto.id } : x)) } : s));
    setSumando(null);
    show(r.cambio === 'creado' ? `Traje «${r.producto.nombre}» de Stripe: cobra en «${etapaNombre}»`
      : r.cambio === 'precio' ? `«${r.producto.nombre}» con el precio de Stripe: cobra en «${etapaNombre}»`
        : `Cobra en «${etapaNombre}»`);
    return true;
  });
  /** Crear (y vincular con todas las cuentas) o guardar lo editado. */
  const guardarProducto = (escrito: Escrito, id?: number) => correr(id != null ? `e:${id}` : 'crear', async () => {
    const p = productoDeLoEscrito(escrito);
    if (!p.ok) { setErrorForm(p.error); return false; }
    setErrorForm(null);
    const r = await guardarProductoCobroAction(p.input, id);
    if (!r.ok) { setErrorForm(r.error); return false; }
    ponerProducto(r.producto);
    if (id != null) { setEditando(null); show('Producto guardado'); return true; }
    // Creado: el formulario se cierra YA. Si vincular se cae, reintentar con el mismo formulario crearía otro producto igual.
    setSumando(null);
    const v = await vincularProductoAEtapaAction({ funnelId, etapa, productoId: r.producto.id, cuentas: todasLasCuentas })
      .catch(() => ({ ok: false as const, error: 'no contestó' }));
    if (v.ok) ponerVinculo(v.vinculo);
    show(v.ok ? `Creado y cobra en «${etapaNombre}»` : `Creado, pero no se vinculó: ${v.error}`, undefined, v.ok ? undefined : 'bad');
    return true;
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
      {errorForm && <p role="alert" style={{ margin: 0, fontSize: 12.5, color: 'var(--bad)' }}>{errorForm}<ReportarASoporte /></p>}
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
        <li key={v.id} className="vx-fila vx-fila--abierta">
          {formProducto(editando.escrito, (e) => setEditando({ id: p.id, escrito: e }), () => void guardarProducto(editando.escrito, p.id),
            () => { setEditando(null); setErrorForm(null); }, 'Guardar', ocupado === `e:${p.id}`)}
        </li>
      );
    }
    return (
      <li key={v.id} className="vx-fila" data-aqui data-vinculo-cobro={v.id} style={{ gridTemplateColumns: '20px minmax(0, 1fr) auto auto' }}>
        <span aria-hidden style={{ color: 'var(--primary)', display: 'inline-flex' }}><IconoMenu nombre="dinero" size={16} /></span>
        <div className="vx-txt">
          <span className="vx-nombre" title={nombre}>{nombre}</span>
          {p && <span className="vx-meta">{precioDeProducto(p)}</span>}
        </div>
        <div className="vx-donde">{ocupado === `v:${v.id}` && <Spinner size={13} />}</div>
        <div style={{ display: 'inline-flex' }}>
          {foto.puedeEditar && p && (
            <button type="button" className="vx-icono" disabled={ocupado != null} aria-label={`Editar ${nombre}`} title="Editar"
              onClick={() => { setErrorForm(null); setEditando({ id: p.id, escrito: deProducto(p) }); }}>
              <IconoMenu nombre="editar" size={15} />
            </button>
          )}
          {foto.puedeEditar && (
            <button type="button" className="vx-icono" disabled={ocupado != null} aria-label={`Quitar ${nombre} de ${etapaNombre}`} title="Quitar"
              onClick={() => void quitar(v, nombre)}>
              <IconoMenu nombre="quitar" size={15} />
            </button>
          )}
        </div>
        {/* UNA PASTILLA POR CUENTA: Stripe y Mercado Pago a la vez, y varias de cada uno. Prendida = cobra por ahí. */}
        <div className="vx-cuentas" role="group" aria-label={`Cuentas por las que cobra ${nombre}`}>
          {foto.cuentas.map((c) => {
            const marcada = v.cuentas.includes(c.id);
            return (
              <button key={c.id} type="button" className="vx-cuenta" aria-pressed={marcada} disabled={!foto.puedeEditar || ocupado != null}
                onClick={() => void alternarCuenta(v, c.id)}>
                {marcada && <span aria-hidden>✓</span>}
                {nombreDeCuenta(c, foto.cuentas)}
              </button>
            );
          })}
        </div>
      </li>
    );
  };

  const opciones = foto ? opcionesDeCobro(foto, stripe?.precios ?? []) : [];
  const hayStripe = !!foto?.cuentas.some((c) => c.proveedor === 'stripe');
  /** Con más de una cuenta de Stripe, cada precio dice de cuál es. */
  const variasStripe = (foto?.cuentas.filter((c) => c.proveedor === 'stripe').length ?? 0) > 1;
  const contenido = (
    <div className="vx" style={{ fontFamily: SANS }}>
      <style>{CSS_VINCULAR}</style>
      <div className="vx-barra">
        {/* SIN CUENTAS, SE CONECTAN AHÍ MISMO: el modal de /integraciones arriba de éste (no se sale de la tab). */}
        {foto && foto.cuentas.length === 0 && PASARELAS.map((prov) => (
          <BotonIntegracion key={prov} servicio={prov} onConectado={() => leer()} style={PASTILLA_CONECTAR}>
            <IconoMenu nombre="link" size={14} /> Conectar {NOMBRE_PROVEEDOR_PAGO[prov]}
          </BotonIntegracion>
        ))}
        <span className="vx-elastico" />
        <span className="vx-info" role="img" aria-label={TEXTO_AL_PAGAR} title={TEXTO_AL_PAGAR}>ⓘ</span>
        <button type="button" className="vx-icono" aria-label="Volver a leer" title="Volver a leer" onClick={leer} disabled={!foto && !error}>
          <IconoMenu nombre="restaurar" size={15} />
        </button>
        {foto?.puedeEditar && foto.cuentas.length > 0 && !sumando && (
          <Button size="sm" icon={<IconoMenu nombre="agregar" size={15} />} disabled={ocupado != null}
            onClick={() => { setErrorForm(null); setSumando(opciones.length || (hayStripe && !stripe) ? { modo: 'elegir' } : { modo: 'crear', escrito: VACIO }); }}>
            Producto
          </Button>
        )}
      </div>

      {/* «+ PRODUCTO»: uno del catálogo, o crearlo ahí mismo (nace cobrando por todas las cuentas). */}
      {sumando?.modo === 'elegir' && (
        <div className="vx-form--crear" style={{ display: 'flex', flexDirection: 'column', gap: 8 }}>
          <ul className="vx-lista" role="listbox" aria-label="Productos para cobrar">
            {opciones.map((o) => {
              if (o.tipo === 'mako') {
                const p = o.producto;
                return (
                  <li key={`m${p.id}`} role="option" aria-selected={false}>
                    <button type="button" className="vx-fila" disabled={ocupado != null} onClick={() => void vincular(p.id)} style={FILA_OPCION}>
                      <span className="vx-nombre">{p.nombre}</span>
                      <span className="vx-meta">{precioDeProducto(p)}</span>
                      {ocupado === `p:${p.id}` ? <Spinner size={13} /> : <span />}
                    </button>
                  </li>
                );
              }
              const p = o.precio;
              const donde = variasStripe ? p.cuentaNombre : 'Stripe';
              // Uno que no se puede traer va APAGADO y dice por qué (otra moneda, el monto lo elige quien paga, ya cobra otra cosa).
              if (o.tipo === 'no') {
                return (
                  <li key={`n${p.precio}`} role="option" aria-selected={false} aria-disabled>
                    <div className="vx-fila" data-apagada style={{ ...FILA_OPCION, cursor: 'default', opacity: 0.75 }} title={p.noSe ?? undefined}>
                      <span className="vx-txt"><span className="vx-nombre" data-fuera>{p.nombre}</span><span className="vx-meta">{p.noSe}</span></span>
                      <span className="vx-meta">{precioDeStripeTexto(p)} · {donde}</span>
                      <span />
                    </div>
                  </li>
                );
              }
              return (
                <li key={`s${p.precio}`} role="option" aria-selected={false}>
                  <button type="button" className="vx-fila" disabled={ocupado != null} onClick={() => void traerDeStripe(p)} style={FILA_OPCION}>
                    <span className="vx-nombre">{o.producto?.nombre ?? p.nombre}</span>
                    <span className="vx-meta">{precioDeStripeTexto(p)} · {donde}</span>
                    {ocupado === `s:${p.precio}` ? <Spinner size={13} /> : <span />}
                  </button>
                </li>
              );
            })}
            {hayStripe && !stripe && (
              <li className="vx-fila vx-gris" aria-label="Leyendo los productos de Stripe" style={FILA_OPCION}><span /><span /><Spinner size={13} /></li>
            )}
          </ul>
          {stripe?.errores.map((e) => (
            <p key={e.cuenta} className="vx-nota" data-mal>No pude leer los productos de {e.cuentaNombre}: {e.error}</p>
          ))}
          <div style={{ display: 'flex', gap: 8 }}>
            <Button size="sm" variant="secondary" icon={<IconoMenu nombre="agregar" size={15} />} onClick={() => setSumando({ modo: 'crear', escrito: VACIO })}>Crear producto</Button>
            <Button size="sm" variant="secondary" onClick={() => setSumando(null)}>Cancelar</Button>
          </div>
        </div>
      )}
      {sumando?.modo === 'crear' && formProducto(sumando.escrito, (e) => setSumando({ modo: 'crear', escrito: e }), () => void guardarProducto(sumando.escrito),
        () => { setSumando(null); setErrorForm(null); }, 'Crear y vincular', ocupado === 'crear')}

      <ul className="vx-lista" aria-label={`Productos que cobran en ${etapaNombre}`} aria-busy={!foto && !error}>
        {foto?.vinculos.map(fila)}
        {!foto && !error && [0, 1].map((i) => <li key={`g${i}`} className="vx-fila vx-gris" aria-hidden><span /><span /><span /><span /></li>)}
      </ul>
      {!foto && error && <p className="vx-vacio" data-mal>{error}</p>}
      {foto && foto.vinculos.length === 0 && (
        <p className="vx-vacio">{foto.cuentas.length ? 'Ningún producto cobra aquí todavía.' : 'Conecta Stripe o Mercado Pago.'}</p>
      )}
      {foto && !foto.puedeEditar && <p className="vx-nota" data-mal>Sólo el administrador puede cambiar los cobros.</p>}
      <Toast state={toast} onClose={clear} />
    </div>
  );

  if (!montado) return null;
  return createPortal(
    <Modal titulo={<span style={{ display: 'inline-flex', alignItems: 'center', gap: 8 }}><IconoMenu nombre="dinero" size={18} /> Vincular cobro</span>}
      encabezado={<span className="vx-donde-titulo">{crmNombre} › {etapaNombre}</span>}
      onCerrar={onCerrar} ancho={640} alto="min(80vh, 620px)" sinFiletes>
      {contenido}
    </Modal>,
    document.body,
  );
}

