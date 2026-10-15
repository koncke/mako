'use client';

// =============================================================================
// El Centro de Operaciones — la pantalla (etapa 1: la cola)
// =============================================================================
// Escribir un pedido, elegir el chat, firmarlo en ESTE dispositivo y verlo pasar por sus estados:
// escrito ≠ entregado ≠ hecho ≠ comprobado (docs/diseno-centro-de-operaciones.md §3).
//
// ⚠️ LOS CHATS QUE SE OFRECEN SON LOS QUE SUBE EL CARTERO, no una lista de acá: el id `local_…`
// es la única dirección que no se repite entre cuentas. Un chat que no está vivo se puede elegir
// igual: el pedido espera, y la fila dice qué espera (lib/operaciones-reglas.ts → motivoDeEspera).
// ⚠️ La pantalla se refresca sola cada pocos segundos, sólo con la pestaña a la vista.
// =============================================================================

import { useCallback, useEffect, useMemo, useState } from 'react';
import { Banner, Button, EmptyState, PageHeader, Pagina, Section, Status, Textarea, Toast, useToast, type Tono } from '@/app/_ui';
import { Select, type SelectOption } from '@/app/_ui/Select';
import {
  ROTULO, carteroVivo, todosLosChats, motivoDeEspera, nuevoPayload, armarFirmable,
  MAX_TEXTO, type Alcance, type EstadoPedido,
} from '@/lib/operaciones-reglas';
import type { EstadoCarteros, Pedido } from '@/lib/operaciones';
import { cancelarPedidoAction, crearTokenCarteroAction, encolarPedidoAction, fotoCentroAction } from './acciones';
import { claveDelDispositivo, crearClaveDelDispositivo, firmar, type ClaveDispositivo } from './clave-dispositivo';

const REFRESCO_MS = 8000;

const TONO_ESTADO: Record<EstadoPedido, Tono> = {
  escrito: 'neutral', tomado: 'info', entregado: 'info', no_entregado: 'bad',
  incierto: 'warn', hecho: 'good', comprobado: 'good', cancelado: 'neutral',
};

const hace = (iso: string | null, ahora: number): string => {
  if (!iso) return '—';
  const s = Math.max(0, Math.round((ahora - Date.parse(iso)) / 1000));
  if (s < 60) return 'recién';
  if (s < 3600) return `hace ${Math.round(s / 60)} min`;
  if (s < 86_400) return `hace ${Math.round(s / 3600)} h`;
  return `hace ${Math.round(s / 86_400)} d`;
};

const cuentaCorta = (c: string | null) => (c ? `Cuenta ${c.replace('claude', '')}` : 'Cuenta ?');

export default function CentroOperaciones({ sub, pedidosIniciales, carterosIniciales, embebido = false }: {
  /** Dentro de la pestaña «Trabajos» del Centro: sin su propia página ni su encabezado. */
  embebido?: boolean;
  sub: string;
  pedidosIniciales: Pedido[];
  carterosIniciales: EstadoCarteros;
}) {
  const [pedidos, setPedidos] = useState(pedidosIniciales);
  const [estado, setEstado] = useState(carterosIniciales);
  const [ahora, setAhora] = useState(() => Date.now());
  const [clave, setClave] = useState<ClaveDispositivo | null | undefined>(undefined);
  const [destino, setDestino] = useState('');
  const [texto, setTexto] = useState('');
  const [alcance, setAlcance] = useState<Alcance>('solo_esto');
  const [enviando, setEnviando] = useState(false);
  const [token, setToken] = useState<string | null>(null);
  const [abierto, setAbierto] = useState<string | null>(null);
  const { toast, show: mostrar, clear: ocultar } = useToast();
  const show = (t: { msg: string; tono: Tono }) => mostrar(t.msg, undefined, t.tono);

  useEffect(() => { claveDelDispositivo(sub).then(setClave); }, [sub]);

  const refrescar = useCallback(async () => {
    const f = await fotoCentroAction();
    if (f.ok) { setPedidos(f.pedidos); setEstado(f.carteros); }
    setAhora(Date.now());
  }, []);

  useEffect(() => {
    const t = setInterval(() => { if (document.visibilityState === 'visible') refrescar(); }, REFRESCO_MS);
    return () => clearInterval(t);
  }, [refrescar]);

  const carteros = estado.carteros;
  const chats = useMemo(() => todosLosChats(carteros), [carteros]);
  // La clave tiene que estar aceptada por el cartero de cada cuenta: se cargan a mano, una por PC.
  const sinClave = clave ? carteros.filter((k) => !k.claves.includes(clave.id)).map((k) => k.cuenta) : [];

  const opciones: SelectOption[] = useMemo(() => [...chats]
    .sort((a, b) => Number(b.vivo) - Number(a.vivo) || (b.actividad ?? '').localeCompare(a.actividad ?? ''))
    .map((c) => ({
      value: c.local,
      label: c.titulo,
      sub: `${cuentaCorta(c.cuenta)} · ${c.vivo ? (c.estado === 'busy' ? 'trabajando' : 'abierto') : 'cerrado'}`,
      icono: c.vivo ? 'check' : undefined,
    })), [chats]);

  const chatElegido = chats.find((c) => c.local === destino) ?? null;

  async function mandar() {
    if (!clave || !chatElegido || !texto.trim() || enviando) return;
    if (texto.length > MAX_TEXTO) { show({ msg: 'Texto muy largo', tono: 'bad' }); return; }
    setEnviando(true);
    try {
      const payload = nuevoPayload({
        id: crypto.randomUUID(), texto, destino: chatElegido.local,
        cuenta: chatElegido.cuenta, titulo: chatElegido.titulo, alcance,
      }, Date.now());
      const firmado = armarFirmable(payload);
      const firma = await firmar(clave, firmado);
      const r = await encolarPedidoAction({ firmado, firma, clavePublica: clave.spki });
      if (!r.ok) { show({ msg: r.error, tono: 'bad' }); return; }
      setTexto('');
      setAlcance('solo_esto');
      show({ msg: 'Trabajo firmado', tono: 'good' });
      await refrescar();
    } catch (e) {
      show({ msg: e instanceof Error ? e.message : 'No pude firmar', tono: 'bad' });
    } finally {
      setEnviando(false);
    }
  }

  async function nuevaClave() {
    try { setClave(await crearClaveDelDispositivo(sub)); } catch { show({ msg: 'No pude crear la clave', tono: 'bad' }); }
  }

  async function nuevoToken() {
    const r = await crearTokenCarteroAction();
    if (r.ok) setToken(r.token); else show({ msg: r.error, tono: 'bad' });
  }

  async function cancelar(id: string) {
    const r = await cancelarPedidoAction(id);
    show(r.ok ? { msg: 'Cancelado', tono: 'good' } : { msg: r.error ?? 'No se pudo', tono: 'bad' });
    await refrescar();
  }

  const copiar = (s: string, msg: string) => { navigator.clipboard?.writeText(s).then(() => show({ msg, tono: 'good' })); };

  const contenido = (
    <>
      {!embebido && (
        <PageHeader
          titulo="Centro de Operaciones"
          proposito="Trabajos firmados para los chats de Claude."
          estado={carteros.length
            ? <span style={{ display: 'flex', gap: 6, flexWrap: 'wrap' }}>{carteros.map((k) => (
              <Status key={k.cuenta} tono={carteroVivo(k, ahora) ? 'good' : 'warn'}>{cuentaCorta(k.cuenta)} · {hace(k.vistoAt, ahora)}</Status>
            ))}</span>
            : <Status tono="warn">Sin carteros</Status>}
        />
      )}

      <Section titulo="Nuevo trabajo" card>
        <div style={{ display: 'flex', flexDirection: 'column', gap: 12 }}>
          {clave === null && (
            <Banner tono="warn" alcance="local" accion={{ label: 'Crear clave', onClick: nuevaClave }}>
              Este dispositivo no tiene clave de firma.
            </Banner>
          )}
          {clave && sinClave.length > 0 && (
            <Banner tono="warn" alcance="local" accion={{ label: 'Copiar clave', onClick: () => copiar(clave.spki, 'Clave copiada') }}>
              Falta aceptar esta clave ({clave.id}) en: {sinClave.map(cuentaCorta).join(', ')}.
            </Banner>
          )}
          <Select
            label="Chat"
            value={destino}
            onChange={setDestino}
            options={opciones}
            placeholder={opciones.length ? 'Elige el chat' : 'Ningún cartero subió chats todavía'}
            disabled={!opciones.length}
          />
          <Textarea
            value={texto}
            onChange={(e) => setTexto(e.target.value)}
            rows={6}
            placeholder="Qué hay que hacer"
            aria-label="Trabajo"
            error={texto.length > MAX_TEXTO}
          />
          <div style={{ display: 'flex', flexWrap: 'wrap', gap: 8, alignItems: 'center', justifyContent: 'space-between' }}>
            <div role="radiogroup" aria-label="Alcance" style={{ display: 'flex', gap: 6, flexWrap: 'wrap' }}>
              <Button size="sm" variant={alcance === 'solo_esto' ? 'primary' : 'tertiary'} aria-pressed={alcance === 'solo_esto'} onClick={() => setAlcance('solo_esto')}>Sólo esto</Button>
              <Button size="sm" variant={alcance === 'de_ahora_en_mas' ? 'primary' : 'tertiary'} aria-pressed={alcance === 'de_ahora_en_mas'} onClick={() => setAlcance('de_ahora_en_mas')}>Y de ahora en más</Button>
            </div>
            <Button variant="mako" loading={enviando} disabled={!clave || !chatElegido || !texto.trim()} onClick={mandar}>
              Firmar y mandar
            </Button>
          </div>
          {chatElegido && !chatElegido.vivo && (
            <span style={{ fontSize: 'var(--fs-sm)', color: 'var(--text-dim)' }}>
              Ese chat está cerrado: sale cuando lo abras.
            </span>
          )}
        </div>
      </Section>

      <Section titulo="Trabajos">
        {pedidos.length === 0
          ? <EmptyState titulo="Todavía no mandaste ningún trabajo a los chats" detalle={estado.tokenPista ? 'El primero se escribe arriba.' : 'Falta el token del cartero: se crea abajo, en Carteros.'} inline />
          : (
            <div style={{ display: 'flex', flexDirection: 'column' }}>
              {pedidos.map((p) => {
                const espera = motivoDeEspera(p, carteros, ahora);
                const ver = abierto === p.id;
                return (
                  <div key={p.id} className="mk-fila" style={{ display: 'flex', flexDirection: 'column', gap: 4, padding: '10px 0', borderBottom: '1px solid var(--border)' }}>
                    <div style={{ display: 'flex', gap: 8, alignItems: 'center', flexWrap: 'wrap' }}>
                      <Status tono={TONO_ESTADO[p.estado]}>{ROTULO[p.estado]}</Status>
                      <strong style={{ fontSize: 'var(--fs-sm)' }}>{p.destino_titulo ?? p.destino}</strong>
                      <span style={{ fontSize: 'var(--fs-meta)', color: 'var(--text-dim)' }}>{cuentaCorta(p.destino_cuenta)} · {hace(p.created_at, ahora)}</span>
                      <span style={{ flex: 1 }} />
                      {p.estado === 'escrito' && <Button size="sm" variant="tertiary" onClick={() => cancelar(p.id)}>Cancelar</Button>}
                      <Button size="sm" variant="tertiary" onClick={() => setAbierto(ver ? null : p.id)}>{ver ? 'Cerrar' : 'Ver'}</Button>
                    </div>
                    {(espera || p.motivo) && (
                      <span style={{ fontSize: 'var(--fs-meta)', color: p.estado === 'no_entregado' ? 'var(--bad)' : 'var(--text-dim)' }}>{espera ?? p.motivo}</span>
                    )}
                    <span style={{ fontSize: 'var(--fs-sm)', color: 'var(--text)', whiteSpace: ver ? 'pre-wrap' : 'nowrap', overflow: 'hidden', textOverflow: 'ellipsis' }}>{p.texto}</span>
                    {ver && p.cierre && (
                      <dl style={{ display: 'grid', gridTemplateColumns: 'max-content 1fr', gap: '2px 10px', fontSize: 'var(--fs-sm)', margin: '6px 0 0' }}>
                        <dt>Decidido</dt><dd style={{ margin: 0 }}>{p.cierre.decidido || '—'}</dd>
                        <dt>Hecho</dt><dd style={{ margin: 0 }}>{p.cierre.hecho || '—'}</dd>
                        <dt>Comprobado</dt><dd style={{ margin: 0 }}>{p.cierre.comprobado || '—'}</dd>
                        <dt>Sigue</dt><dd style={{ margin: 0 }}>{p.cierre.sigue || '—'}</dd>
                        {p.cierre.prueba && <><dt>Prueba</dt><dd style={{ margin: 0 }}>{p.cierre.prueba}</dd></>}
                      </dl>
                    )}
                  </div>
                );
              })}
            </div>
          )}
      </Section>

      <Section titulo="Carteros" card>
        <div style={{ display: 'flex', flexDirection: 'column', gap: 10, fontSize: 'var(--fs-sm)' }}>
          {carteros.length === 0 && <span>Ningún cartero pasó todavía.</span>}
          {carteros.map((k) => (
            <span key={k.cuenta}>
              <strong>{cuentaCorta(k.cuenta)}</strong>
              {` · ${k.vistoAt ? `pasó ${hace(k.vistoAt, ahora)}` : 'nunca pasó'}`}
              {k.version ? ` · v${k.version}` : ''}
              {` · ${k.chats.filter((c) => c.vivo).length} chats abiertos`}
            </span>
          ))}
          {estado.tokenPista && <span style={{ color: 'var(--text-dim)' }}>Token …{estado.tokenPista}</span>}
          {/* La clave pública de ESTE dispositivo: se carga a mano en la PC (`cartero.mjs clave …`). */}
          {clave && (
            <span style={{ display: 'flex', gap: 8, alignItems: 'center', flexWrap: 'wrap' }}>
              <span style={{ color: 'var(--text-dim)' }}>Clave de este dispositivo: {clave.id}</span>
              <Button size="sm" variant="tertiary" onClick={() => copiar(clave.spki, 'Clave copiada')}>Copiar clave</Button>
            </span>
          )}
          {token
            ? (
              <Banner tono="info" alcance="local" accion={{ label: 'Copiar', onClick: () => copiar(token, 'Token copiado') }}>
                Token nuevo: se muestra una sola vez.
              </Banner>
            )
            : <div><Button size="sm" variant="secondary" onClick={nuevoToken}>{estado.tokenPista ? 'Cambiar token' : 'Crear token'}</Button></div>}
        </div>
      </Section>

      <Toast state={toast} onClose={ocultar} />
    </>
  );
  return embebido ? contenido : <Pagina>{contenido}</Pagina>;
}
