'use client';

// =============================================================================
// Mensualidad — lo que la agencia paga este mes en MaKo, por fuera de MaKo (acuerdo con Código Inmobiliario, 30/10/2026)
// =============================================================================
// El total del mes (cubre del 5 al 5), sus renglones, las entradas por pagar, quién está en pausa, quién todavía está sin costo y
// hasta cuándo, y los meses anteriores con su «Pagado». Las reglas de Martín del 5/11/2026, en lib/agencia-mes-reglas.ts.
// La estructura es la de la «próxima factura» de un portal de facturación (Stripe Billing): el monto y hasta cuándo se
// paga arriba, con su estado; los renglones abajo, con el total al pie. Las piezas visuales son las del Agency Dashboard
// (las clases `ad-*` de AgencyApp.tsx), así se lee como parte de la misma pantalla. Desde cuándo cuenta CADA cliente va en
// la lista de cuentas de abajo (su columna «Mensualidad») y en su ficha: una segunda lista de los mismos clientes sobraba.
//
// ⚠️ Lo que ESCRIBE es del super admin parado en la agencia («Marcar pagado», «Corregir fecha», prender o apagar): la
//    agencia lo LEE. La puerta es del server (app/agency/actions.ts); esconder los botones no protege nada.
// ⚠️ Las reglas (quién cuenta, el total, los textos) viven en lib/agencia-mes-reglas.ts: acá no se calcula nada.
// =============================================================================

import { useEffect, useRef, useState } from 'react';
import { createPortal } from 'react-dom';
import { ErrorState, Modal } from '@/app/_ui';
import { useRouter } from '@/app/_ui/Link';
import { ConfirmDialog } from '@/app/_components/ChatItemMenu';
import type { MensualidadPantalla as DatosMensualidad, MesDeMensualidad, FilaMensualidad } from '@/lib/agencia-mes';
import { DIA_LIMITE_DE_PAGO, DIAS_SIN_COSTO, conceptoDeLinea, diaCorto, diaLargo, mesDe, mesSiguiente, nombreDelMes, periodoDelCiclo, sumarDias, usd, usdDia, type Pendiente } from '@/lib/agencia-mes-reglas';
import { corregirRelojAction, marcarEntradaPagadaAction, marcarMesPagadoAction, mensualidadPrendidaAction, quitarMesPagadoAction } from './actions';

type Aviso = (texto: string, tono?: 'good' | 'bad', deshacer?: () => void) => void;
type Resultado = { ok: true; resumen: string } | { ok: false; error: string };

/** Corre una acción, avisa lo que pasó y vuelve a pedir la página (los números salen del server). */
function useCorrer(onAviso: Aviso) {
  const router = useRouter();
  const [ocupado, setOcupado] = useState(false);
  const correr = async (fn: () => Promise<Resultado>, deshacer?: () => void) => {
    setOcupado(true);
    const r = await fn().catch(() => ({ ok: false as const, error: 'Sin conexión.' }));
    setOcupado(false);
    if (r.ok) { onAviso(r.resumen, 'good', deshacer); router.refresh(); } else onAviso(r.error, 'bad');
  };
  return { ocupado, correr };
}

export function Mensualidad({ m, superAdmin, ver, resaltar = null, onAviso }: {
  m: DatosMensualidad;
  /** El super admin parado en la agencia: anota los pagos y la prende o apaga. */
  superAdmin: boolean;
  /** `?vista=mensualidad` (el link de los avisos): baja hasta acá al abrir. */
  ver: boolean;
  /** «Pagar su mes» del aviso de «Inspeccionar» (14/11/2026): baja hasta la entrada de ese cliente y la marca. `n` = otro toque. */
  resaltar?: { ws: number; n: number } | null;
  onAviso: Aviso;
}) {
  const raiz = useRef<HTMLElement | null>(null);
  const [pagar, setPagar] = useState<MesDeMensualidad | null>(null);
  const [entrada, setEntrada] = useState<Extract<Pendiente, { tipo: 'entrada' }> | null>(null);
  const [apagar, setApagar] = useState(false);
  const [marcada, setMarcada] = useState<number | null>(null);
  const { ocupado, correr } = useCorrer(onAviso);

  useEffect(() => { if (ver) raiz.current?.scrollIntoView({ block: 'start' }); }, [ver]);
  useEffect(() => {
    if (!resaltar) return;
    // Su renglón de «Entradas por pagar»; si no tiene (la pausa es por el mes entero), el total de arriba.
    const fila = raiz.current?.querySelector<HTMLElement>(`[data-entrada="${resaltar.ws}"]`) ?? null;
    (fila ?? raiz.current)?.scrollIntoView({ block: fila ? 'center' : 'start', behavior: 'smooth' });
    setMarcada(resaltar.ws);
    const t = setTimeout(() => setMarcada(null), 2600);
    return () => clearTimeout(t);
  }, [resaltar]);

  if (!m.ok) {
    return (
      <section ref={raiz} id="mensualidad" className="am">
        <ErrorState titulo="No pude armar tu mensualidad" detalle="Reintenta en un momento." detalleTecnico={m.error} />
      </section>
    );
  }
  // Apagada: la agencia sigue con el cobro por pasarela y no ve nada de esto; el super admin ve cómo quedaría.
  if (!m.config && !superAdmin) return null;

  const a = m.actual;
  const mesTxt = nombreDelMes(a.mes);
  const sinCosto = m.clientes.filter((c) => c.situacion.tipo === 'sin-costo' && c.situacion.entrada);
  const entradas = m.pendientes.filter((p): p is Extract<Pendiente, { tipo: 'entrada' }> => p.tipo === 'entrada' && p.limite <= sumarDias(m.hoy, 2));
  const enPausa = [...(m.agenciaEnPausa ? [m.agencia] : []), ...m.clientes.filter((c) => c.enPausa).map((c) => c.nombre)];
  // Apagada: se prende desde este mes si todavía no pasó su día 5; si pasó, desde el siguiente (el de hoy ya no se avisa).
  const desdeSugerido = Number(m.hoy.slice(8, 10)) <= DIA_LIMITE_DE_PAGO ? mesDe(m.hoy) : mesSiguiente(mesDe(m.hoy));

  return (
    <section ref={raiz} id="mensualidad" className="am" aria-labelledby="am-titulo">
      <div className="am-cab">
        <div className="am-cab-txt">
          <span className="am-eti" id="am-titulo">{m.config ? `Mensualidad de ${mesTxt}` : 'Mensualidad · apagada'}</span>
          <b className="am-total">{usd(a.cuenta.totalUsd)}</b>
          <span className="am-sub">
            {m.config
              ? `Cubre ${periodoDelCiclo(a.mes)}. Se paga del 1 al ${DIA_LIMITE_DE_PAGO} de ${mesTxt}, por ${m.config.medio}: el PDF y el comprobante van por el grupo de MaKo.`
              : `Así quedaría ${mesTxt} si la prendes. Se paga por fuera de MaKo: el PDF va por el grupo de WhatsApp con la agencia.`}
          </span>
        </div>
        <div className="am-cab-acc">
          {m.config && <EstadoPago mes={a} />}
          {superAdmin && m.config && !a.pagado && (
            <button type="button" className="ad-acc ad-acc--fuerte" disabled={ocupado} onClick={() => setPagar(a)}>Marcar pagado</button>
          )}
          {superAdmin && m.config && a.pago && a.pagado && (
            <button type="button" className="ad-acc" disabled={ocupado}
              onClick={() => void correr(() => quitarMesPagadoAction(a.mes, a.pago?.pagadoEl ?? null))}>Quitar «Pagado»</button>
          )}
          {superAdmin && !m.config && (
            <button type="button" className="ad-acc ad-acc--fuerte" disabled={ocupado}
              onClick={() => void correr(() => mensualidadPrendidaAction(desdeSugerido))}>Prender desde {nombreDelMes(desdeSugerido)}</button>
          )}
        </div>
      </div>

      <div className="ad-tabla am-tabla" role="table" aria-label={`La mensualidad de ${mesTxt}`}>
        <div className="ad-th am-fila" role="row"><span role="columnheader">Concepto</span><span role="columnheader">Monto</span></div>
        {a.cuenta.lineas.map((l, i) => (
          <div key={`${l.tipo}-${l.tipo === 'agencia' ? 0 : l.ws}-${i}`} className="ad-fila am-fila" role="row">
            <span role="cell" className="am-concepto">{conceptoDeLinea(l)}{l.tipo === 'mes' && <em>Cuenta desde el {diaCorto(l.desde)}</em>}</span>
            <span role="cell" className="ad-num">{usd(l.montoUsd)}</span>
          </div>
        ))}
        <div className="ad-fila am-fila am-pie" role="row"><span role="cell">Total</span><span role="cell" className="ad-num">{usd(a.cuenta.totalUsd)}</span></div>
      </div>
      {enPausa.length > 0 && (
        <p className="ad-nota am-pausa" role="status">En pausa hasta que entre el pago: {enPausa.join(' · ')}.</p>
      )}
      {m.config && entradas.length > 0 && (
        <>
          <h3 className="ad-sub">Entradas por pagar</h3>
          <div className="ad-tabla am-tabla" role="table" aria-label="Las entradas por pagar">
            {entradas.map((p) => (
              <div key={p.ws} className="ad-fila am-mes" role="row" data-entrada={p.ws} data-marcada={marcada === p.ws || undefined}>
                <span role="cell" className="am-concepto"><b>Entrada de {p.nombre}</b><em>{p.entrada.dias} días, del {diaCorto(p.entrada.desde)} al {diaCorto(p.entrada.hasta)} · {usdDia(p.entrada.tarifaUsd)} por día</em></span>
                <span role="cell"><span className="ad-est" data-tono={p.limite < m.hoy ? 'bad' : 'warn'}><i />{p.limite < m.hoy ? 'Vencida' : p.limite === m.hoy ? 'Vence hoy' : `Vence el ${diaCorto(p.limite)}`}</span></span>
                <span role="cell" className="ad-num">{usd(p.debeUsd)}</span>
                <span role="cell" className="ad-fila-acc">
                  {superAdmin && <button type="button" className="ad-acc" disabled={ocupado} onClick={() => setEntrada(p)}>Marcar pagada</button>}
                </span>
              </div>
            ))}
          </div>
        </>
      )}
      {sinCosto.length > 0 && (
        <p className="ad-nota">
          Todavía sin costo: {sinCosto.map((c) => `${c.nombre} hasta el ${c.situacion.tipo === 'sin-costo' ? diaCorto(c.situacion.hasta) : ''}`).join(' · ')}.
          {' '}Ese día paga su entrada: sus días hasta el próximo 5. Si un cliente no te pagó, dalo de baja antes y no se cobra.
        </p>
      )}

      {m.anteriores.length > 0 && (
        <>
          <h3 className="ad-sub">Meses anteriores</h3>
          <div className="ad-tabla am-tabla" role="table" aria-label="Los meses anteriores">
            {m.anteriores.map((x) => (
              <div key={x.mes} className="ad-fila am-mes" role="row">
                <span role="cell" className="am-concepto"><b className="am-mes-nombre">{nombreDelMes(x.mes)} {x.mes.slice(0, 4)}</b></span>
                <span role="cell"><EstadoPago mes={x} /></span>
                <span role="cell" className="ad-num">{usd(x.cuenta.totalUsd)}</span>
                <span role="cell" className="ad-fila-acc">
                  {superAdmin && !x.pagado && <button type="button" className="ad-acc" disabled={ocupado} onClick={() => setPagar(x)}>Marcar pagado</button>}
                </span>
              </div>
            ))}
          </div>
        </>
      )}

      {superAdmin && m.config && (
        <p className="ad-nota am-apagar">
          Prendida desde {nombreDelMes(m.config.desde)} {m.config.desde.slice(0, 4)}.{' '}
          <button type="button" className="am-link" disabled={ocupado} onClick={() => setApagar(true)}>Apagar la mensualidad</button>
        </p>
      )}

      {pagar && (
        <ModalPagado mes={pagar} hoy={m.hoy} ocupado={ocupado} onCerrar={() => setPagar(null)}
          onGuardar={(dia) => {
            const mes = pagar.mes;
            setPagar(null);
            void correr(() => marcarMesPagadoAction(mes, dia), () => void correr(() => quitarMesPagadoAction(mes, dia)));
          }} />
      )}
      {entrada && (
        <ModalEntrada p={entrada} hoy={m.hoy} ocupado={ocupado} onCerrar={() => setEntrada(null)}
          onGuardar={(dia) => {
            const ws = entrada.ws;
            setEntrada(null);
            void correr(() => marcarEntradaPagadaAction(ws, dia));
          }} />
      )}
      {apagar && (
        <ConfirmDialog titulo="¿Apagar la mensualidad de esta agencia?"
          detalle="Deja de mandar los PDF al grupo y de pausar a quien no paga. Lo que ya marcaste pagado queda anotado; las cuentas en pausa siguen así hasta que las reabras."
          confirmLabel="Apagar la mensualidad" onCancel={() => setApagar(false)}
          onConfirm={() => { setApagar(false); void correr(() => mensualidadPrendidaAction(null)); }} />
      )}
      <style dangerouslySetInnerHTML={{ __html: CSS }} />
    </section>
  );
}

/** «Pagado el 03/12», «Entró US$ 200 · falta US$ 226» o «Sin pagar · hasta el 05/12». */
function EstadoPago({ mes }: { mes: MesDeMensualidad }) {
  if (mes.pagado) return <span className="ad-est" data-tono="good"><i />Pagado el {diaCorto(mes.pago?.pagadoEl ?? mes.cuenta.limite)}</span>;
  if (mes.pagadoUsd > 0) return <span className="ad-est" data-tono="warn"><i />Entró {usd(mes.pagadoUsd)} · falta {usd(mes.debeUsd)}</span>;
  return <span className="ad-est" data-tono="warn"><i />Sin pagar · hasta el {diaCorto(mes.cuenta.limite)}</span>;
}

function ModalEntrada({ p, hoy, ocupado, onCerrar, onGuardar }: {
  p: Extract<Pendiente, { tipo: 'entrada' }>; hoy: string; ocupado: boolean; onCerrar: () => void; onGuardar: (dia: string) => void;
}) {
  const [dia, setDia] = useState(hoy);
  return (
    <Modal titulo={`Pagada: la entrada de ${p.nombre}`} encabezado="Mensualidad" ancho={420} onCerrar={onCerrar}
      pie={
        <>
          <button type="button" className="ad-acc" onClick={onCerrar}>No marcar</button>
          <button type="button" className="ad-acc ad-acc--fuerte" disabled={ocupado || !dia} onClick={() => onGuardar(dia)}>Marcar {usd(p.debeUsd)} pagado</button>
        </>
      }>
      <label className="am-campo">
        <span>Día en que entró el pago</span>
        <input className="ad-buscar" type="date" value={dia} max={sumarDias(hoy, 1)} data-autofocus onChange={(e) => setDia(e.target.value)} />
      </label>
      <p className="ad-nota">Si estaba en pausa, vuelve a entrar. Sin la orden de Binance no sale el recibo: para eso, pídeselo a MaKo con la orden.</p>
    </Modal>
  );
}

function ModalPagado({ mes, hoy, ocupado, onCerrar, onGuardar }: {
  mes: MesDeMensualidad; hoy: string; ocupado: boolean; onCerrar: () => void; onGuardar: (dia: string) => void;
}) {
  const [dia, setDia] = useState(hoy);
  return (
    <Modal titulo={`Pagado: ${nombreDelMes(mes.mes)}`} encabezado="Mensualidad" ancho={420} onCerrar={onCerrar}
      pie={
        <>
          <button type="button" className="ad-acc" onClick={onCerrar}>No marcar</button>
          <button type="button" className="ad-acc ad-acc--fuerte" disabled={ocupado || !dia} onClick={() => onGuardar(dia)}>Marcar {usd(mes.debeUsd)} pagado</button>
        </>
      }>
      <label className="am-campo">
        <span>Día en que entró el pago</span>
        <input className="ad-buscar" type="date" value={dia} max={sumarDias(hoy, 1)} data-autofocus onChange={(e) => setDia(e.target.value)} />
      </label>
      <p className="ad-nota">Queda anotado con este total, sin recibo (para el recibo, pídeselo a MaKo con la orden de Binance). Si la agencia o sus clientes estaban en pausa por este mes, vuelven a entrar.</p>
    </Modal>
  );
}

/**
 * «Corregir fecha» de un cliente (el super admin, en la ficha de su cuenta): desde qué día corren sus 14 días. Para una
 * cuenta que nació antes como prueba, por ejemplo.
 */
export function CorregirReloj({ fila, puede, onAviso }: { fila: FilaMensualidad; puede: boolean; onAviso: Aviso }) {
  const [abierto, setAbierto] = useState(false);
  const [dia, setDia] = useState(fila.corregido ?? fila.invitado);
  const { ocupado, correr } = useCorrer(onAviso);
  const cuenta = dia ? sumarDias(dia, DIAS_SIN_COSTO) : null;
  const guardar = (nuevo: string | null) => {
    const antes = fila.corregido;
    setAbierto(false);
    void correr(() => corregirRelojAction(fila.ws, nuevo), () => void correr(() => corregirRelojAction(fila.ws, antes)));
  };
  return (
    <>
      <div style={{ marginTop: 8 }}>
        <button type="button" className="ad-acc" disabled={ocupado} onClick={() => setAbierto(true)}>Corregir fecha</button>
      </div>
      {/* Por PORTAL: se abre desde la ficha de la cuenta (otro Modal); adentro de ella, la pila de modales lo apagaría con la ficha. */}
      {abierto && typeof document !== 'undefined' && createPortal(
        <Modal titulo={`Corregir la fecha de ${fila.nombre}`} encabezado="Mensualidad" ancho={460} anidada onCerrar={() => setAbierto(false)}
          pie={
            <>
              {fila.corregido && <button type="button" className="ad-acc" disabled={ocupado || !puede} onClick={() => guardar(null)}>Volver a la invitación</button>}
              <button type="button" className="ad-acc ad-acc--fuerte" disabled={ocupado || !puede || !dia} onClick={() => guardar(dia)}>Guardar la fecha</button>
            </>
          }>
          {!puede && <p className="ad-nota" role="status">Aplica la migración 0402 para poder corregir fechas.</p>}
          <label className="am-campo">
            <span>Sus {DIAS_SIN_COSTO} días corren desde</span>
            <input className="ad-buscar" type="date" value={dia} data-autofocus onChange={(e) => setDia(e.target.value)} />
          </label>
          <p className="ad-nota">Invitado el {diaLargo(fila.invitado)}.{cuenta ? ` Con esta fecha cuenta desde el ${diaLargo(cuenta)}.` : ''}</p>
        </Modal>,
        document.body,
      )}
    </>
  );
}

// ⚠️ NINGÚN BACKTICK ACÁ ADENTRO, ni en un comentario: cierra la cadena a la mitad.
const CSS = `
.am{ margin:0 0 26px; background:var(--surface); border:1px solid var(--border); border-radius:16px; padding:18px 18px 16px; scroll-margin-top:calc(16px + var(--barra-agencia, 0px)); }
.am-cab{ display:flex; gap:16px; align-items:flex-start; justify-content:space-between; flex-wrap:wrap; margin:0 0 14px; }
.am-cab-txt{ display:flex; flex-direction:column; gap:4px; min-width:0; }
.am-eti{ font-size:var(--fs-sm); font-weight:650; color:var(--dim); }
.am-total{ font-size:34px; line-height:1.1; font-weight:800; letter-spacing:-.03em; color:var(--ink); font-variant-numeric:tabular-nums; }
.am-sub{ font-size:13.5px; color:var(--dim); }
.am-cab-acc{ display:inline-flex; gap:10px; align-items:center; flex-wrap:wrap; justify-content:flex-end; }
.am-tabla .am-fila{ grid-template-columns:minmax(0, 1fr) 140px; padding:10px 16px; }
.am-tabla .am-fila > :last-child{ text-align:right; }
.am-tabla .am-mes{ grid-template-columns:minmax(140px, 1fr) minmax(200px, 1.4fr) 120px minmax(130px, auto); padding:8px 16px; transition:background-color .5s ease; }
/* La entrada que se vino a pagar desde el aviso de «Inspeccionar»: se marca un momento y se apaga sola. */
.am-tabla .am-mes[data-marcada]{ background:var(--bad-bg); transition:none; }
.am-tabla .ad-num{ text-align:right; }
.am-concepto{ min-width:0; display:flex; flex-direction:column; gap:2px; font-size:14px; color:var(--ink); }
.am-concepto b{ font-weight:650; overflow:hidden; text-overflow:ellipsis; white-space:nowrap; }
.am-concepto em{ font-style:normal; font-size:12.5px; color:var(--dim); }
.am-mes-nombre::first-letter{ text-transform:uppercase; }
.am-pie{ background:var(--surface-2); font-weight:700; }
.am-pie .ad-num{ font-size:15px; }
.am-campo{ display:flex; flex-direction:column; gap:6px; margin:0 0 4px; }
.am-campo span{ font-size:13px; font-weight:600; color:var(--ink); }
.am-campo .ad-buscar{ max-width:none; }
.am-apagar{ margin-top:14px; }
.am-pausa{ color:var(--bad); font-weight:600; }
.am-link{ border:0; background:none; padding:0; font:inherit; color:var(--bad); cursor:pointer; text-decoration:underline; }
@media (max-width: 980px){
  .am-tabla .am-mes{ grid-template-columns:1fr auto; row-gap:4px; }
}
`;
