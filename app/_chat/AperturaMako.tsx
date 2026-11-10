'use client';

// =============================================================================
// AperturaMako — MaKo habla primero en un chat: UNA pregunta de hecho y sus botones (29/10/2026)
// =============================================================================
// docs/mako-iniciativa/plan.md §2.3. La pieza de toda superficie: lo que dice la apertura (lib/aperturas/) como un mensaje de
// MaKo en el hilo (`HiloMako`, el de todos los chats) y, abajo, SUS botones (las pastillas de Offer, `.of-pill`; el recomendado,
// `.of-pill--mako`). Lo tocado queda como burbuja de la persona y aparece el paso siguiente. No hay «Siguiente».
//   · NO ES EL BLOQUE `pregunta` DEL HILO: su `onResponder` manda un mensaje al turno (`k.enviar`), que sin la app de escritorio
//     no sale (useChatCliente.ts). Estos botones andan siempre: `respuesta`, `ir`, `hacer` y `callar` no usan la IA de nadie.
//   · NO ES UNA TARJETA ARRIBA DE LA CAJA (AGENTS.md, «todo lo que espera a Martín arriba de la caja va en UN bloque»): es un
//     mensaje de MaKo EN el hilo. Con algo en el bloque, la apertura calla (quien la monta lo dice con `libre`).
//   · NUNCA SE GUARDA en la conversación: el Cerebro es uno en toda la app y un mensaje guardado saldría en todas las tabs.
//   · Lo escrito en la caja NO se lee como respuesta: va al chat como siempre y la apertura se cierra (`escritos`).
//   · Las acciones comunes las hace la pieza: `instalar` es «Instalar MaKo» de la caja (InstalarMaKo, el mismo «ya lo descargó»)
//     y `conectar` abre «Tus cuentas de IA» ahí mismo. Las de la pantalla llegan en `acciones`, un `Record` tipado: ofrecer algo
//     que la pantalla no hace no compila.
// La guía de cada pestaña (lib/guia/, app/_ui/guia/) habla con ESTA pieza: su pregunta es una apertura (`guia:<tab>`).

import { useEffect, useMemo, useRef, useState } from 'react';
import { createPortal } from 'react-dom';
import dynamic from 'next/dynamic';
import Link from '@/app/_ui/Link';
import { HiloMako, type Quien } from './HiloMako';
import { ContextoWA } from '@/app/admin/operaciones/MensajeWA';
import { CSS_OFFER } from '@/app/offer/estilos';
import type { ItemHilo } from '@/app/m/mako/chat-ui';
import { anotarApertura, useMemoriaAperturas } from './aperturas-memoria';
import { pasoSinIA } from '@/lib/aperturas/comunes';
import {
  PREFIJO_NEGOCIO, claveApertura, decisionDeCallar, esAccionComun, puedeHablar, respuestasDeMemoria, saludoDe,
  type AccionComun, type Apertura, type Boton, type Superficie,
} from '@/lib/aperturas/reglas';

// Con `next/dynamic`: traen CSS y la pieza se dibuja en un test en node.
const InstalarMaKo = dynamic(() => import('./InstalarMaKo'), { ssr: false, loading: () => null });
const ModalCuentasIA = dynamic(() => import('./ModalCuentasIA'), { ssr: false, loading: () => null });

type AppDeEscritorio = 'tiene' | 'bloquea' | 'en-la-computadora';

/** Lo que dibuja la pieza: la apertura de ahora, lo que ya se dijo en esta visita y qué hacer con un toque. */
export type EstadoApertura<A extends string = string> = {
  apertura: Apertura<A> | null;
  /** Lo ya contestado en esta visita: lo que dijo MaKo y lo que tocó la persona. */
  charla: readonly { mako: string; yo: string }[];
  elegir: (b: Boton<A>) => void;
};

const nada = () => {};

/**
 * La apertura de una superficie para ESTA persona: corre la función con los hechos vivos y lo contestado, la calla según la
 * memoria (lib/aperturas/reglas.ts → puedeHablar) y anota lo que decide. `null` mientras no se sabe.
 *   · `libre`: nada encima (MaKo trabajando, algo en el bloque de preguntas, la guía hablando o señalando). Ocupado, calla.
 *   · `escritos`: cuántos mensajes escribió la persona en el chat; uno nuevo con la apertura a la vista la cierra.
 *   · `app` / `iaConectada`: para un `pedir` (sin ellos, el paso que falta: plan.md §2.6). `onPedir` manda el texto al chat.
 */
export function useApertura<H, A extends string>(p: {
  superficie: Superficie<H, A>;
  hechos: H | null;
  libre: boolean;
  escritos?: number;
  entidad?: string | null;
  app?: AppDeEscritorio | null;
  iaConectada?: boolean | null;
  onPedir?: (texto: string) => boolean;
}): EstadoApertura<A> {
  const mem = useMemoriaAperturas();
  const [locales, setLocales] = useState<Record<string, string>>({});
  const [charla, setCharla] = useState<{ mako: string; yo: string }[]>([]);
  const [cerrada, setCerrada] = useState(false);
  /** Lo que ya habló en esta visita: una vez a la vista, sigue (aunque su «vista» de hoy la callaría en la próxima). */
  const [hablaron, setHablaron] = useState<readonly string[]>([]);
  /** El pedido que no pudo salir (sin la app o sin su IA), con la clave de la apertura que lo pidió. */
  const [pendiente, setPendiente] = useState<{ clave: string; texto: string } | null>(null);
  const [saludo, setSaludo] = useState<string | null>(null);
  const [ahora] = useState(() => Date.now());

  const { superficie, hechos, libre } = p;
  const memoria = mem.memoria;
  // Lo de la superficie y lo del negocio (`negocio:plan` se contesta en el Ops Center o en el Plan: PREFIJO_NEGOCIO).
  const r = useMemo(() => ({ ...(memoria ? { ...respuestasDeMemoria(memoria, PREFIJO_NEGOCIO), ...respuestasDeMemoria(memoria, superficie.id) } : {}), ...locales }), [memoria, superficie.id, locales]);

  // El pendiente de esta visita, o el que quedó en la memoria de una visita de antes.
  const pendienteGuardado = useMemo(() => {
    if (!memoria) return null;
    for (const [k, a] of Object.entries(memoria)) if (k.startsWith(`${superficie.id}:`) && a.d === 'respondida' && a.pendiente) return { clave: k, texto: a.pendiente };
    return null;
  }, [memoria, superficie.id]);
  const pend = pendiente ?? pendienteGuardado;

  let actual: Apertura<A> | null = null;
  if (memoria && hechos != null && !cerrada) {
    const sinIA = pend ? pasoSinIA({ superficie: superficie.id, app: p.app ?? null, iaConectada: p.iaConectada ?? null, pendiente: { texto: pend.texto } }) as Apertura<A> | null : null;
    const a = sinIA ?? superficie.apertura(hechos, r);
    if (a) {
      const clave = claveApertura(a.id, a.entidad ?? p.entidad);
      if (hablaron.includes(clave) || puedeHablar(memoria[clave], a.alcance, ahora)) actual = a;
    }
  }
  const visible = libre ? actual : null;
  const claveVisible = visible ? claveApertura(visible.id, visible.entidad ?? p.entidad) : null;

  // A la vista por primera vez en esta visita: se anota «vista» (una vez por día cuenta como ignorada si no la contesta).
  useEffect(() => {
    if (!claveVisible || hablaron.includes(claveVisible)) return;
    setHablaron((xs) => [...xs, claveVisible]);
    if (saludo == null && mem.primeraVez) setSaludo(claveVisible);
    anotarApertura(claveVisible, 'vista');
  }, [claveVisible]); // eslint-disable-line react-hooks/exhaustive-deps

  // Lo escrito en la caja va al chat como siempre, y la apertura se cierra.
  const escritosAlVer = useRef<number | null>(null);
  useEffect(() => {
    if (visible && escritosAlVer.current == null) escritosAlVer.current = p.escritos ?? 0;
    if (escritosAlVer.current != null && (p.escritos ?? 0) > escritosAlVer.current) setCerrada(true);
  }, [visible, p.escritos]);

  const texto = visible && saludo === claveVisible ? `${saludoDe(mem.nombre)} ${visible.texto}` : visible?.texto ?? '';
  const apertura = visible ? { ...visible, texto } : null;

  const elegir = (b: Boton<A>) => {
    if (!visible || !claveVisible) return;
    const dijo = { mako: texto, yo: b.rotulo };
    switch (b.tipo) {
      case 'respuesta':
        setLocales((x) => ({ ...x, [visible.id]: b.valor }));
        anotarApertura(claveVisible, 'respondida', { valor: b.valor });
        setCharla((xs) => [...xs, dijo]);
        return;
      case 'callar':
        anotarApertura(claveVisible, decisionDeCallar(b.rotulo));
        if (pend && visible.id.endsWith(':pendiente')) { anotarApertura(pend.clave, 'respondida'); setPendiente(null); }
        setCerrada(true);
        return;
      case 'pedir': {
        const puede = p.app !== 'bloquea' && p.iaConectada !== false && !!p.onPedir;
        if (puede && p.onPedir!(b.pedido)) {
          // Salió: el turno lo toma (su burbuja es la del chat). Un pendiente que salió se borra de la memoria.
          anotarApertura(pend && visible.id.endsWith(':pendiente') ? pend.clave : claveVisible, 'respondida');
          setPendiente(null);
          setCerrada(true);
          return;
        }
        // No hay con qué: queda pendiente, y el paso que falta (instalar o conectar) toma su lugar.
        anotarApertura(claveVisible, 'respondida', { pendiente: b.pedido });
        setPendiente({ clave: claveVisible, texto: b.pedido });
        setCharla((xs) => [...xs, dijo]);
        return;
      }
      // `ir` y `hacer` no se anotan: el hecho cambia solo (cargó la oferta, se conectó la computadora), y si no cambió, mañana
      // vuelve a hablar. La pieza los dibuja (un link, la acción).
      default:
    }
  };
  return { apertura, charla: apertura ? charla : [], elegir };
}

/**
 * La pieza: lo dicho en esta visita y la apertura de ahora, como mensajes de MaKo en el hilo, con sus botones abajo.
 * `acciones`: las de la pantalla (las comunes, `instalar` y `conectar`, las hace la pieza).
 */
export function AperturaMako<A extends string>({ estado, quien, acciones, onConectar }: {
  estado: EstadoApertura<A>;
  quien: Quien;
  acciones: Record<Exclude<A, AccionComun>, () => void>;
  /** «Conectar tu IA» de la pantalla, si ya tiene su «Tus cuentas de IA» (el Cerebro: al cerrarlo relee su IA). Sin esto, el de la pieza. */
  onConectar?: () => void;
}) {
  const [conectando, setConectando] = useState(false);
  const { apertura: a, charla } = estado;
  const items = useMemo<ItemHilo[]>(() => {
    const out: ItemHilo[] = [];
    charla.forEach((c, i) => {
      out.push({ k: 'msg', id: `ap-${i}-m`, role: 'assistant', texto: c.mako, at: null });
      out.push({ k: 'msg', id: `ap-${i}-y`, role: 'user', texto: c.yo, at: null });
    });
    if (a) out.push({ k: 'msg', id: `ap-${a.id}`, role: 'assistant', texto: a.texto, at: null });
    return out;
  }, [charla, a]);
  if (!a) return null;
  let recomendado = false;
  const clase = (b: Boton<A>) => {
    if (b.tipo === 'callar' || recomendado) return 'of-pill';
    recomendado = true;
    return 'of-pill of-pill--mako';
  };
  return (
    <div className="ch-apertura" data-apertura={a.id}>
      <style>{CSS_OFFER}</style>
      {/* Sin el menú de WhatsApp del chat: estos mensajes no están guardados (no se fijan, no se reaccionan). */}
      <ContextoWA.Provider value={null}>
        <HiloMako items={items} quien={quien} ahora={0} escribiendo={null} tarjeta={null} onTarjeta={nada} onReintentar={nada} onRecargar={nada} />
      </ContextoWA.Provider>
      {/* Las opciones con imagen (las fotos que ya subió, sus personajes): tocar una es contestar su valor. */}
      {a.galeria && a.galeria.length > 0 && (
        <div className="ch-apertura__galeria" role="group" aria-label={`${a.texto} (opciones)`}>
          {a.galeria.map((o) => (
            <button key={o.valor} type="button" className="ch-apertura__opcion" title={o.rotulo} aria-label={o.rotulo}
              onClick={() => estado.elegir({ tipo: 'respuesta', rotulo: o.rotulo, valor: o.valor })}>
              {/* eslint-disable-next-line @next/next/no-img-element */}
              <img src={o.imagen} alt="" loading="lazy" />
              <span>{o.rotulo}</span>
            </button>
          ))}
        </div>
      )}
      <div className="ch-apertura__botones" role="group" aria-label={a.texto}>
        {a.botones.map((b) => {
          const c = clase(b);
          if (b.tipo === 'ir') return <Link key={b.rotulo} className={c} href={b.href}>{b.rotulo}</Link>;
          if (b.tipo === 'hacer' && b.accion === 'instalar') return <span key={b.rotulo} className="ch-apertura__pieza"><InstalarMaKo /></span>;
          const tocar = () => {
            if (b.tipo === 'hacer') {
              if (b.accion === 'conectar') { if (onConectar) onConectar(); else setConectando(true); }
              else if (!esAccionComun(b.accion)) acciones[b.accion as Exclude<A, AccionComun>]();
            }
            estado.elegir(b);
          };
          return <button key={b.rotulo} type="button" className={c} onClick={tocar}>{b.rotulo}</button>;
        })}
      </div>
      {conectando && typeof document !== 'undefined' && createPortal(<ModalCuentasIA onCerrar={() => setConectando(false)} />, document.body)}
    </div>
  );
}
