'use client';

// =============================================================================
// El cartel rojo de arriba del Ops Center: los mensajes que esperan un chat cerrado (30/10/2026)
// =============================================================================
// Un mensaje a un chat cerrado se perdía en silencio y vencía en silencio: lo único que lo decía era una línea adentro de ese chat
// (medido el 30/10: 11, el más viejo de hacía 6 días). La cuenta es de MaKo (lib/centro-limbo.ts) y este cartel sale en la computadora y
// en el teléfono. Por cada uno, «Mandárselo a otro chat» o «Descartar».
//
// ⚠️ MANDARLO ES FIRMARLO DE NUEVO: la firma fija el destino, así que no se «mueve» el mensaje; sale uno nuevo firmado en ESTE
//    dispositivo (`mandarDelLimbo`) y recién entonces se da de baja el viejo. Por eso lo hace Martín y no la PC.

import { useState, type ComponentType, type ReactNode } from 'react';
import { Modal } from '@/app/_ui/Modal';
import { ReportarASoporte } from '@/app/_ui/ReportarASoporte';
import { chatRecibe, nombreCuenta, textoDeEnvio, type ChatCentro } from '@/lib/centro-chats';
import { chatsParaMandarle, queHacer, textoDeVence, textoDelCartel, type EnLimbo } from '@/lib/centro-limbo';
import type { Pedido } from '@/lib/operaciones';
import type { Centro } from './useCentro';

/** Lo que se ve de un mensaje antes de «Ver todo». */
const CORTO = 180;

function Fila({ centro: k, m, onElegirChat }: { centro: Centro; m: EnLimbo<Pedido>; onElegirChat: () => void }) {
  const p = m.pedido;
  const [entero, setEntero] = useState(false);
  const [seguro, setSeguro] = useState(false);
  const [ocupado, setOcupado] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const vence = textoDeVence(m, k.ahora);
  const largo = p.texto.length > CORTO;
  const hacer = queHacer(m);
  const descartar = async () => {
    setOcupado(true);
    setError(null);
    const e = await k.descartarDelLimbo(p);
    if (e) { setError(e); setOcupado(false); }
  };
  return (
    <li className="co-limbo__fila">
      <p className="co-limbo__para">
        <b>{p.destino_titulo ?? 'Chat sin nombre'}</b>
        {p.destino_cuenta && ` · ${nombreCuenta(p.destino_cuenta)}`}
        <span className={vence.pronto ? 'co-limbo__vence co-limbo__vence--pronto' : 'co-limbo__vence'}>{vence.texto}</span>
      </p>
      <p className="co-limbo__texto">{entero || !largo ? p.texto : `${p.texto.slice(0, CORTO).trimEnd()}…`}</p>
      {largo && <button type="button" className="co-limbo__ver" onClick={() => setEntero((v) => !v)}>{entero ? 'Ver menos' : 'Ver todo'}</button>}
      {hacer && <p className="co-limbo__nota">{hacer}</p>}
      {!!p.adjuntos?.length && <p className="co-limbo__nota">{`Llevaba ${p.adjuntos.length === 1 ? '1 archivo' : `${p.adjuntos.length} archivos`}: se manda sólo el texto.`}</p>}
      {error && <p className="co-limbo__error" role="alert">{error}<ReportarASoporte /></p>}
      <div className="co-limbo__acciones">
        {seguro ? (<>
          <button type="button" className="co-limbo__boton co-limbo__boton--mal" disabled={ocupado} onClick={() => void descartar()}>Sí, descartar</button>
          <button type="button" className="co-limbo__boton" disabled={ocupado} onClick={() => setSeguro(false)}>No</button>
        </>) : (<>
          <button type="button" className="co-limbo__boton co-limbo__boton--primario" onClick={onElegirChat}>Mandárselo a otro chat</button>
          <button type="button" className="co-limbo__boton" onClick={() => setSeguro(true)}>Descartar</button>
        </>)}
      </div>
    </li>
  );
}

/**
 * El paso de elegir el chat: los que reciben ahora, con los del mismo nombre primero (el «Cerebro» abierto, para uno cerrado).
 * ⚠️ EL TEXTO VA ENTERO: lo que se elige acá es a quién firmarle esto. La fila lo corta, y firmar lo que no se vio es firmar a ciegas.
 * ⚠️ `chatRecibe`, NO `envio.puede`: sin Runner, `comoSale` deja pasar a un chat cerrado. Se mandaba a otro chat cerrado, rotulado «Abierto».
 */
export function ElegirChat({ centro: k, m, onVolver }: { centro: Centro; m: EnLimbo<Pedido>; onVolver: () => void }) {
  const [ocupado, setOcupado] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const recibe = (c: ChatCentro) => chatRecibe(c, k.envioDe(c));
  const lista = chatsParaMandarle(m.pedido.destino_titulo, k.chats, recibe);
  // Sin chats que reciban, lo que dice es por qué: casi siempre, que este dispositivo no tiene el Token para firmar.
  const sinClave = k.chats.map(k.envioDe).find((e) => !e.puede && (e.por === 'sin_clave' || e.por === 'clave_no_aceptada' || e.por === 'leyendo_clave'));
  const rotulo = (c: ChatCentro) => {
    const e = k.envioDe(c);
    return (c.estado === 'trabajando' ? 'Trabajando' : 'Abierto') + (e.puede && e.espera === 'cartero' ? ' · espera al Runner' : '');
  };
  const mandar = async (c: ChatCentro) => {
    setOcupado(true);
    setError(null);
    const e = await k.mandarDelLimbo(m.pedido, c);
    if (e) { setError(e); setOcupado(false); return; }
    onVolver();
  };
  return (
    <div className="co-limbo__elegir">
      <button type="button" className="co-limbo__ver" onClick={onVolver}>← Volver</button>
      <p className="co-limbo__nota">Vas a firmar este mensaje:</p>
      <p className="co-limbo__texto">{m.pedido.texto}</p>
      {error && <p className="co-limbo__error" role="alert">{error}<ReportarASoporte /></p>}
      {lista.length ? (
        <ul className="co-limbo__chats">
          {lista.map((c) => (
            <li key={c.clave}>
              <button type="button" className="co-limbo__chat" disabled={ocupado} onClick={() => void mandar(c)}>
                {c.titulo}
                <span className="co-limbo__vence">{rotulo(c)}</span>
              </button>
            </li>
          ))}
        </ul>
      ) : (
        <p className="co-limbo__nota">{(sinClave && textoDeEnvio(sinClave)) ?? (k.chats.some((c) => c.viejo) ? 'No se sabe qué chats están abiertos: la PC no da noticias.' : 'No hay ningún chat abierto ahora.')}</p>
      )}
    </div>
  );
}

function Lista({ centro: k }: { centro: Centro }) {
  const [eligiendo, setEligiendo] = useState<string | null>(null);
  const m = eligiendo ? k.limbo.find((x) => x.pedido.id === eligiendo) : null;
  if (m) return <ElegirChat centro={k} m={m} onVolver={() => setEligiendo(null)} />;
  return (
    <ul className="co-limbo__lista">
      {k.limbo.map((x) => <Fila key={x.pedido.id} centro={k} m={x} onElegirChat={() => setEligiendo(x.pedido.id)} />)}
    </ul>
  );
}

type HojaP = { abierto: boolean; onCerrar: () => void; titulo: string; snap?: 'alto'; children: ReactNode };

/** Arriba de la lista de chats. Sin nada esperando, no se dibuja. `Hoja`: en el teléfono, su hoja (SheetM) en vez del Modal. */
export function CartelLimbo({ centro: k, Hoja }: { centro: Centro; Hoja?: ComponentType<HojaP> }) {
  const [abierto, setAbierto] = useState(false);
  const texto = textoDelCartel(k.limbo, k.ahora);
  const titulo = 'Mensajes sin entregar';
  return (<>
    {texto && (
      <button type="button" className="co-limbo" aria-haspopup="dialog" aria-expanded={abierto} onClick={() => setAbierto(true)}>{texto}</button>
    )}
    {/* Abierto se queda aunque se vacíe (se ve «Ya no queda ninguno»): si no, descartar el último cierra todo de golpe. */}
    {abierto && !Hoja && (
      <Modal titulo={titulo} onCerrar={() => setAbierto(false)} ancho={560}>
        {k.limbo.length ? <Lista centro={k} /> : <p className="co-limbo__nota">Ya no queda ninguno.</p>}
      </Modal>
    )}
    {Hoja && (
      <Hoja abierto={abierto} onCerrar={() => setAbierto(false)} titulo={titulo} snap="alto">
        {k.limbo.length ? <Lista centro={k} /> : <p className="co-limbo__nota">Ya no queda ninguno.</p>}
      </Hoja>
    )}
  </>);
}
