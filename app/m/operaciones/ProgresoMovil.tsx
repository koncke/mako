'use client';

// =============================================================================
// El Centro en el teléfono: Chats · Avance · Pushes (16/10/2026), y el cartero en una hoja
// =============================================================================
// Las mismas vistas que la computadora (app/admin/operaciones/CentroApp.tsx), destiladas: Chats con su caja de
// escribir (ChatsMovil.tsx), Avance y Pushes. «Áreas» se fue en el rediseño de punta a punta («Eliminando las
// tabs innecesarias», Martín, 15/10): lo que decía es la lista de chats. El color va en el punto de la
// píldora, nunca en el texto (app/m/_ui/LEEME.md).
//
// ⚠️ La pantalla se refresca sola cada pocos segundos con la pestaña a la vista (el estado de los chats y la
// cola), y además se tira hacia abajo (PantallaM). Los pushes de Vercel llegan después de dibujar.

import { useCallback, useEffect, useMemo, useState } from 'react';
import {
  FilaM, ListaM, PildoraM, SeccionM, SegmentadoM, SheetM, VacioM, useToastM, type TonoPildora,
} from '@/app/m/_ui';
import {
  GRUPOS_PEDIDO, PESTANAS_CENTRO, ROTULO_GRUPO, ROTULO_PEDIDO, ROTULO_TIPO, diaDeNovedad, estadoDeProduccion, grupoPedido, hace,
  pushDelCommit, type EstadoPedidoP, type NovedadP, type PedidoP, type PestanaCentro,
} from '@/lib/progreso-reglas';
import type { LecturaPushes } from '@/lib/progreso';
import type { EstadoCarteros, Pedido } from '@/lib/operaciones';
import { carteroVivo } from '@/lib/operaciones-reglas';
import { completarChats, esperasPorChat, type ChatCentro, type DecisionEspera, type TrabajoP } from '@/lib/centro-chats';
import { fotoCentroAction, pushesCentroAction } from '@/app/admin/operaciones/acciones';
import { copiar, useFirma } from '@/app/admin/operaciones/mandar';
import { CarteroMovil } from './CentroMovil';
import { ChatsM } from './ChatsMovil';

const TONO_PEDIDO: Record<EstadoPedidoP, TonoPildora> = { pendiente: 'warn', en_curso: 'info', hecho: 'good' };
/** Cuántos hechos se ven antes de «Ver todos»: en el teléfono la lista se lee, no se recorre. */
const HECHOS_VISIBLES = 12;

/** El camino en una línea: quién lo tomó y dónde está. */
function caminoM(p: PedidoP, ahora: number): string {
  if (p.estado === 'hecho') return `En producción · ${p.tomo ?? 'sin chat'}`;
  const ultimo = p.pasos[p.pasos.length - 1];
  if (!ultimo) return `Nadie lo tomó · pedido ${hace(p.instante, ahora)}`;
  return `${p.tomo ?? ultimo.chat} · ${ROTULO_TIPO[ultimo.tipo] ?? ultimo.tipo} ${hace(p.ultimo, ahora)}`;
}

function PedidosM({ pedidos, pushes, ahora }: { pedidos: PedidoP[]; pushes: LecturaPushes | null; ahora: number }) {
  const [abierto, setAbierto] = useState<string | null>(null);
  const [verHechos, setVerHechos] = useState(false);
  const lista = pushes?.ok ? pushes.pushes : [];
  const elegido = pedidos.find((p) => p.id === abierto) ?? null;
  if (!pedidos.length) return <VacioM frase="Ningún pedido anotado en estos días." />;
  return (
    <>
      {GRUPOS_PEDIDO.map((g) => {
        const todas = pedidos.filter((p) => grupoPedido(p, ahora) === g);
        if (!todas.length) return null;
        if (g === 'ahora' || g === 'empezado') todas.sort((a, b) => b.ultimo - a.ultimo);
        const filas = g === 'terminado' && !verHechos ? todas.slice(0, HECHOS_VISIBLES) : todas;
        return (
          <SeccionM key={g} titulo={`${ROTULO_GRUPO[g]} · ${todas.length}`}>
            <ListaM etiqueta={ROTULO_GRUPO[g]}>
              {filas.map((p) => (
                <FilaM
                  key={p.id}
                  titulo={<span className="m-operaciones-texto1">{p.texto}</span>}
                  segunda={<span className="m-operaciones-texto1">{caminoM(p, ahora)}</span>}
                  pill={<PildoraM tono={TONO_PEDIDO[p.estado]}>{ROTULO_PEDIDO[p.estado]}</PildoraM>}
                  onClick={() => setAbierto(p.id)}
                />
              ))}
              {filas.length < todas.length && (
                <FilaM titulo={`Ver los ${todas.length} terminados`} onClick={() => setVerHechos(true)} />
              )}
            </ListaM>
          </SeccionM>
        );
      })}
      <SheetM abierto={!!elegido} onCerrar={() => setAbierto(null)} titulo="Pedido">
        {elegido && (
          <div className="m-operaciones-hoja">
            <div className="m-operaciones-estado">
              <PildoraM tono={TONO_PEDIDO[elegido.estado]}>{ROTULO_PEDIDO[elegido.estado]}</PildoraM>
              <p className="m-operaciones-motivo">{`${elegido.areas.join(', ')} · ${hace(elegido.instante, ahora)}`}</p>
            </div>
            <p className="m-operaciones-texto">{elegido.texto}</p>
            {elegido.junto > 0 && (
              <p className="m-operaciones-motivo">{`Anotado junto con ${elegido.junto} ${elegido.junto === 1 ? 'pedido más' : 'pedidos más'}: lo que sigue responde a todos.`}</p>
            )}
            {elegido.pasos.length === 0
              ? <p className="m-operaciones-motivo">Ningún chat lo anotó como empezado todavía.</p>
              : (
                <ol className="m-operaciones-pasos">
                  {elegido.pasos.map((st, i) => (
                    <li key={i}>
                      <span className="m-operaciones-paso-quien">{`${st.chat} · ${ROTULO_TIPO[st.tipo] ?? st.tipo} · ${hace(st.instante, ahora)}`}</span>
                      <span>{st.titulo}</span>
                      {st.commits.map((c) => {
                        const push = pushDelCommit(c.sha, lista);
                        return <code key={c.sha} className="m-operaciones-commit">{`${c.sha.slice(0, 9)} ${c.msg}${push ? ` · subió ${hace(push.creado, ahora)}` : ''}`}</code>;
                      })}
                    </li>
                  ))}
                  {elegido.estado === 'hecho' && (
                    <li>
                      <span className="m-operaciones-paso-quien">En producción</span>
                      <span>Está en la versión publicada.</span>
                    </li>
                  )}
                </ol>
              )}
          </div>
        )}
      </SheetM>
    </>
  );
}

function NovedadesM({ lista, lectura, ahora }: { lista: NovedadP[]; lectura: LecturaPushes | null; ahora: number }) {
  const [abierto, setAbierto] = useState<string | null>(null);
  const prod = lectura?.ok ? estadoDeProduccion(lectura.pushes, ahora) : null;
  const elegido = lista.find((n) => n.id === abierto) ?? null;
  const dias: Array<{ dia: string; items: NovedadP[] }> = [];
  for (const n of lista) {
    const dia = diaDeNovedad(n.instante, ahora);
    const ult = dias[dias.length - 1];
    if (ult?.dia === dia) ult.items.push(n); else dias.push({ dia, items: [n] });
  }
  return (
    <>
      {prod && <p className="m-operaciones-nota">{prod.frase}</p>}
      {!lista.length && <VacioM frase="Nada publicado en estos días." />}
      {dias.map(({ dia, items }) => (
        <SeccionM key={dia} titulo={dia}>
          <ListaM etiqueta={dia}>
            {items.map((n) => (
              <FilaM
                key={n.id}
                titulo={<span className="m-operaciones-texto1">{n.titulo}</span>}
                segunda={`${n.area}${n.correccion ? ' · arreglo' : ''}`}
                onClick={() => setAbierto(n.id)}
              />
            ))}
          </ListaM>
        </SeccionM>
      ))}
      <SheetM abierto={!!elegido} onCerrar={() => setAbierto(null)} titulo={elegido?.area ?? 'Novedad'}>
        {elegido && (
          <div className="m-operaciones-hoja">
            <p className="m-operaciones-texto">{elegido.titulo}</p>
            {elegido.puntos.length > 0 && <ul className="m-operaciones-pasos">{elegido.puntos.map((p, i) => <li key={i}>{p}</li>)}</ul>}
            <p className="m-operaciones-motivo">{elegido.verEnApp ? `Se mira en ${elegido.verEnApp}, desde la computadora o el menú.` : 'Sin pantalla para mirar: es algo interno.'}</p>
          </div>
        )}
      </SheetM>
    </>
  );
}

const ETIQUETA: Record<PestanaCentro, string> = { chats: 'Chats', avance: 'Avance', pushes: 'Pushes' };
const REFRESCO_MS = 8000;

/** Lo de la cola que dibuja un chat (la misma forma que en la computadora). */
const trabajoDe = (p: Pedido): TrabajoP => ({
  id: p.id, destino: p.destino, destino_titulo: p.destino_titulo, destino_cuenta: p.destino_cuenta, created_at: p.created_at,
  texto: p.texto, estado: p.estado, motivo: p.motivo, entregado_at: p.entregado_at, cerrado_at: p.cerrado_at, cierre: p.cierre,
});

export function CentroMovilPestanas({ inicial, base, colaInicial, carterosIniciales, decisionesIniciales, pedidos, novedades, ahora: ahoraServer, sub }: {
  inicial: PestanaCentro;
  /** La mitad de la lista que sale de las bitácoras (lib/centro-chats.ts → chatsDeBitacoras). */
  base: ChatCentro[];
  colaInicial: Pedido[] | null;
  carterosIniciales: EstadoCarteros | null;
  decisionesIniciales: DecisionEspera[] | null;
  pedidos: PedidoP[];
  novedades: NovedadP[];
  ahora: number;
  sub: string;
}) {
  const [tab, setTab] = useState<PestanaCentro>(inicial);
  const [cola, setCola] = useState<Pedido[]>(colaInicial ?? []);
  const [locales, setLocales] = useState<TrabajoP[]>([]);
  const [estado, setEstado] = useState<EstadoCarteros | null>(carterosIniciales);
  const [decisiones, setDecisiones] = useState<DecisionEspera[]>(decisionesIniciales ?? []);
  const [ahora, setAhora] = useState(ahoraServer);
  const [pushes, setPushes] = useState<LecturaPushes | null>(null);
  const [cartero, setCartero] = useState(false);
  const toast = useToastM();
  const firma = useFirma(sub);

  // Lo recién mandado se ve enseguida; cuando el refresco lo trae de la cola, se usa el de la cola.
  const trabajos = useMemo(() => {
    const deCola = cola.map(trabajoDe);
    return [...locales.filter((l) => !deCola.some((w) => w.id === l.id)), ...deCola];
  }, [cola, locales]);
  const carteros = useMemo(() => estado?.carteros ?? [], [estado]);
  const esperas = useMemo(() => esperasPorChat(decisiones, carteros), [decisiones, carteros]);
  const chats = useMemo(() => completarChats(base, { carteros, trabajos, ahora }), [base, carteros, trabajos, ahora]);
  const abiertos = pedidos.filter((p) => p.estado !== 'hecho').length;

  const refrescar = useCallback(async () => {
    const f = await fotoCentroAction();
    if (f.ok) { setCola(f.pedidos); setEstado(f.carteros); if (f.decisiones) setDecisiones(f.decisiones); }
    setAhora(Date.now());
  }, []);
  useEffect(() => {
    const t = setInterval(() => { if (document.visibilityState === 'visible') refrescar(); }, REFRESCO_MS);
    return () => clearInterval(t);
  }, [refrescar]);
  useEffect(() => { let vivo = true; pushesCentroAction().then((p) => { if (vivo) setPushes(p); }).catch(() => {}); return () => { vivo = false; }; }, []);

  const cambiar = (t: PestanaCentro) => {
    setTab(t);
    try {
      const u = new URL(window.location.href);
      if (t === PESTANAS_CENTRO[0]) u.searchParams.delete('tab'); else u.searchParams.set('tab', t);
      window.history.replaceState(window.history.state, '', `${u.pathname}${u.search}`);
    } catch { /* la URL es una comodidad */ }
  };
  const copiarClave = async () => { if (firma.clave) toast(await copiar(firma.clave.spki) ? 'Clave copiada: pégala en el chat Cartero' : 'No pude copiar'); };
  const crearClave = async () => { toast((await firma.crear()) ? 'Clave creada: cópiala y pégala en el chat Cartero' : 'No pude crear la clave'); };
  const andando = carteros.filter((k) => carteroVivo(k, ahora)).length;

  return (
    <>
      <div className="m-operaciones-seg">
        <SegmentadoM<PestanaCentro>
          etiqueta="Vista del Centro"
          valor={tab}
          onCambio={cambiar}
          opciones={PESTANAS_CENTRO.map((id) => ({ id, label: ETIQUETA[id], n: id === 'avance' && abiertos ? abiertos : undefined }))}
        />
      </div>
      {tab === 'chats' && (
        <>
          <ChatsM
            chats={chats} carteros={carteros} pedidos={pedidos} trabajos={trabajos} pushes={pushes?.ok ? pushes.pushes : []} ahora={ahora}
            esperas={esperas} firma={firma} onEnviado={(t) => { setLocales((l) => [t, ...l]); refrescar(); }}
          />
          <ListaM etiqueta="Cartero">
            <FilaM icono="config" titulo="Cartero" segunda={`${andando} de ${carteros.length} dando vueltas`} onClick={() => setCartero(true)} navegacion />
          </ListaM>
        </>
      )}
      {tab === 'avance' && <PedidosM pedidos={pedidos} pushes={pushes} ahora={ahora} />}
      {tab === 'pushes' && <NovedadesM lista={novedades} lectura={pushes} ahora={ahora} />}
      <SheetM abierto={cartero} onCerrar={() => setCartero(false)} titulo="Cartero">
        <CarteroMovil carteros={estado ? carteros : null} clave={firma.clave} ahora={ahora} onCrearClave={crearClave} onCopiarClave={copiarClave} />
      </SheetM>
    </>
  );
}
