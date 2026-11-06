'use client';

// =============================================================================
// Marketing CoPilot — la primera entrada: una charla que termina en un funnel propuesto (6/11/2026)
// =============================================================================
// Martín, 6/11/2026: «Cuando alguien entra por primera vez, que sea diferente el diseño… Que no hayan otras tabs… Que MaKo te vaya
// preguntando las cosas que hagan falta… Algo como lo que tenemos en "Funnel Coach"». La pantalla es la del arranque del Media
// Buyer (ArranqueMediaBuyer.tsx: el mismo marco, el mismo hilo, las mismas pastillas de Offer), con otra charla: la de
// lib/media-buyer/copiloto.ts (puro, con tests). Una pregunta por vez; cada respuesta se guarda en el momento (si se va, vuelve donde
// estaba). Al terminar, `router.refresh()`: la página ve el perfil completo y muestra la vista normal.
//
// ⚠️ UN SOLO CHAT (Martín, 6/11/2026, con captura: «Si hay un chat en el medio, por qué se abre el chat al costado»). Hasta ese día lo
//    que se escribía y no era la respuesta del paso abría el panel de MaKo a la izquierda (MakoEnLaTab) y la charla quedaba angosta,
//    con las tarjetas pisadas. Ahora se lee primero SIN IA (`interpretarEscrito`: volver, empezar de nuevo, la respuesta, lo que el
//    referente no enseña) y lo que queda lo contesta MaKo ACÁ, en el medio: el Cerebro de la persona (la misma conversación que la
//    estrella de la tab), con `desde.tab = 'Marketing CoPilot'`, o sea con el contexto del CoPilot y la IA del negocio. Sin IA, el
//    turno lo dice en el hilo con su botón de conectar (lib/mako-turno-app.ts). Esta pantalla NO monta MakoEnLaTab.
// ⚠️ EL MOTOR SE MONTA CON EL PRIMER MENSAJE LIBRE (`MotorDelCopiloto`): quien sólo toca pastillas no carga la lista de chats ni el hilo.
// ⚠️ LO QUE SE HABLA VA DEBAJO DE LA PREGUNTA EN LA QUE SE HABLÓ: cada envío y cada nota llevan su paso. Volver o empezar de nuevo
//    esconden lo de los pasos que quedaron sin contestar (si no, reaparecería al volver a preguntarlos).
// =============================================================================

import { useCallback, useEffect, useLayoutEffect, useMemo, useRef, useState } from 'react';
// El router de la casa: «terminar» vuelve a la misma pantalla con su `?ws=` (el super admin mirando a un cliente no cae en la suya).
import { useRouter } from '@/app/_ui/Link';
import { CajaChat } from '@/app/_chat/CajaChat';
import { useAppDeEscritorio } from '@/app/_chat/useAppDeEscritorio';
import { PanelDeChat } from '@/app/admin/operaciones/PanelChat';
import '@/app/admin/operaciones/centro.css';
import { HiloMako, type EnMensaje } from '@/app/_chat/HiloMako';
import { CSS_OFFER } from '@/app/offer/estilos';
import { itemsDeOffer, type ItemHilo } from '@/app/m/mako/chat-ui';
import { useChatCliente } from '@/app/second-brain/useChatCliente';
import { ASPECTO_MAKO } from '@/lib/centro-munecos';
import { asesorPorId, inspiradoEn, type IdAsesor } from '@/lib/asesores/catalogo';
import { queEnsena } from '@/lib/media-buyer/copiloto-referentes';
import type { ElegidoChat } from '@/lib/chat-mako-reglas';
import {
  RUTAS_COPILOTO, REFERENTES_COPILOTO, SIN_REFERENTE, acuseDeVolver, aplicarCambio, desdeDelCopiloto, funnelElegido, funnelPorId, interpretarEscrito, mensajesDeCopiloto,
  nombreDelReferente, pasoDeCopiloto, pasosRespondidos, plano, preguntaDeCopiloto, propuestaDe, textoDeFuera, volverUnPaso,
  type PasoCopiloto, type PerfilCopiloto,
} from '@/lib/media-buyer/copiloto';

const nada = () => {};
const TRAMOS = ['Funnel', 'Tus números', 'Propuesta'] as const;
const tramoDe = (p: PasoCopiloto): number => (p === 'entrada' || p === 'referente' || p === 'funnel' ? 0 : p === 'propuesta' || p === 'listo' ? 2 : 1);
const ORDEN_PASOS: readonly PasoCopiloto[] = ['entrada', 'referente', 'funnel', 'ticket', 'presupuesto', 'llamadas', 'ajuste', 'objetivo', 'ritmo', 'formato', 'competencia', 'propuesta', 'listo'];
const indice = (p: PasoCopiloto) => ORDEN_PASOS.indexOf(p);

async function guardar(perfil: PerfilCopiloto): Promise<boolean> {
  const r = await fetch('/api/media-buyer', { method: 'POST', headers: { 'content-type': 'application/json' }, body: JSON.stringify({ op: 'copiloto', perfil }) }).catch(() => null);
  return !!r?.ok;
}

/** Lo guardado, después de un turno de MaKo: si guardó un cambio (copiloto_media_buyer), la charla lo muestra. */
async function leerGuardado(): Promise<PerfilCopiloto | null> {
  const r = await fetch('/api/media-buyer', { method: 'POST', headers: { 'content-type': 'application/json' }, body: JSON.stringify({ op: 'copiloto_leer' }) }).catch(() => null);
  const j = r?.ok ? await r.json().catch(() => null) as { perfil?: PerfilCopiloto } | null : null;
  return j?.perfil ?? null;
}

/** Algo que dijo MaKo (o la persona) fuera del guion, pegado a la pregunta en la que pasó. */
type Nota = { id: string; paso: PasoCopiloto; de: 'mako' | 'yo'; texto: string; opciones?: Array<{ texto: string; perfil: PerfilCopiloto | null }>; visible: boolean };
/** Un mensaje para MaKo: sale por el motor, en orden. */
type Envio = { vez: number; paso: PasoCopiloto; texto: string; enviado: boolean; visible: boolean };

/** Lo que el motor (el chat del Cerebro) le pasa a la pantalla. */
type Motor = {
  items: readonly ItemHilo[]; listo: boolean; enCurso: boolean; segs: number; ahora: number;
  tarjeta: ReturnType<typeof useChatCliente>['tarjeta'];
  correrTarjeta: ReturnType<typeof useChatCliente>['correrTarjeta']; reintentar: ReturnType<typeof useChatCliente>['reintentar'];
  recargar: () => void; enviar: (t: string) => boolean; marcas: ReturnType<typeof useChatCliente>['marcas'];
};

/** El chat del Cerebro con el contexto del CoPilot: sin pantalla propia, pasa lo suyo hacia arriba. */
function MotorDelCopiloto({ pantalla, onMotor }: { pantalla: string; onMotor: (m: Motor) => void }) {
  const caja = useRef<HTMLTextAreaElement>(null);
  const [elegido, setElegido] = useState<ElegidoChat | null>(null);
  const desde = useMemo(() => desdeDelCopiloto(pantalla), [pantalla]);
  const k = useChatCliente({ elegido, setElegido, activo: false, entrarAlCerebro: true, chatInicial: null, opcionArmar: '', busca: '', caja, desde, quien: { nombre: 'MaKo', aspecto: ASPECTO_MAKO } });
  const ref = useRef(k);
  ref.current = k;
  useEffect(() => {
    onMotor({
      items: k.items, listo: k.esJefe && k.cargado && !k.errorCarga, enCurso: k.enCurso, segs: k.segs, ahora: k.ahora, tarjeta: k.tarjeta, marcas: k.marcas,
      correrTarjeta: (...a) => ref.current.correrTarjeta(...a), reintentar: (...a) => ref.current.reintentar(...a), recargar: () => ref.current.recargar(),
      enviar: (t) => ref.current.enviar(t),
    });
  }, [k.items, k.esJefe, k.cargado, k.errorCarga, k.enCurso, k.segs, k.ahora, k.tarjeta, k.marcas, onMotor]);
  return null;
}

export function PrimeraEntrada({ nombre, inicial }: { nombre: string; inicial: PerfilCopiloto }) {
  const router = useRouter();
  const [p, setP] = useState<PerfilCopiloto>(inicial);
  const [texto, setTexto] = useState('');
  const [terminando, setTerminando] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [notas, setNotas] = useState<Nota[]>([]);
  const [envios, setEnvios] = useState<Envio[]>([]);
  const [motor, setMotor] = useState<Motor | null>(null);
  /** Los mensajes del Cerebro que ya estaban antes del primer envío de acá: no se dibujan (son de otras tabs). */
  const base = useRef<Set<string> | null>(null);
  const guardando = useRef<Promise<boolean>>(Promise.resolve(true));
  const [ahora] = useState(() => Date.now());
  const [busca, setBusca] = useState('');
  const hilo = useRef<HTMLDivElement>(null);
  const appEscritorio = useAppDeEscritorio();
  const paso = pasoDeCopiloto(p);
  const f = funnelElegido(p);
  const ref = p.referente ? asesorPorId(p.referente) : null;
  const tramo = tramoDe(paso);
  const hayAtras = pasosRespondidos(p).length > 0;

  const guardarYa = useCallback((sig: PerfilCopiloto) => { guardando.current = guardar(sig); return guardando.current; }, []);

  const terminar = async (sig: PerfilCopiloto) => {
    setTerminando(true);
    const ok = await guardarYa(sig);
    if (!ok) { setTerminando(false); setError('No pude guardarlo. Prueba otra vez.'); setP(aplicarCambio(sig, { aceptado: undefined })); return; }
    // Sin el `?estrategia=1` de «Cambiar mi estrategia»: con él puesto, la página volvería a mostrar la charla en vez de la vista normal.
    router.replace(window.location.pathname);
    router.refresh();
  };

  /** Lo que queda escondido al volver a un paso: lo de ese paso y los siguientes, que se vuelven a preguntar. */
  const esconderDesde = (desde: PasoCopiloto) => {
    const i = indice(desde);
    setNotas((ns) => ns.map((n) => (indice(n.paso) >= i ? { ...n, visible: false } : n)));
    setEnvios((es) => es.map((e) => (indice(e.paso) >= i ? { ...e, visible: false } : e)));
  };

  const nota = (n: Omit<Nota, 'id' | 'visible'>) => setNotas((ns) => [...ns, { ...n, id: `nota-${ns.length}-${Date.now()}`, visible: true }]);

  /** Pasar a otro perfil (respuesta, volver, empezar, una opción de una nota). */
  const ir = (sig: PerfilCopiloto) => {
    const antes = pasoDeCopiloto(p);
    const despues = pasoDeCopiloto(sig);
    if (indice(despues) <= indice(antes)) esconderDesde(despues);
    setP(sig);
    setError(null);
    if (despues === 'listo') void terminar(sig);
    else void guardarYa(sig);
  };

  const volver = () => { const v = volverUnPaso(p); if (v) ir(v.perfil); };
  const empezarDeNuevo = (dijo?: string) => {
    const previo = p;
    esconderDesde('entrada');
    // Lo que ya se habló con MaKo queda en su chat (el Cerebro), no en esta charla nueva.
    if (motor) base.current = new Set(motor.items.map((x) => x.id));
    setEnvios([]);
    setP({});
    void guardarYa({});
    if (dijo) nota({ paso: 'entrada', de: 'yo', texto: dijo });
    nota({ paso: 'entrada', de: 'mako', texto: 'Empezamos de nuevo.', opciones: [{ texto: 'Deshacer', perfil: previo }] });
  };

  // Lo que se habla con MaKo sale de a uno, cuando el Cerebro está abierto y libre.
  useEffect(() => {
    if (!motor?.listo || motor.enCurso) return;
    const sig = envios.find((e) => !e.enviado && e.visible);
    if (!sig) return;
    if (base.current == null) base.current = new Set(motor.items.map((x) => x.id));
    void guardando.current.then(() => {
      if (motor.enviar(sig.texto)) setEnvios((es) => es.map((e) => (e.vez === sig.vez ? { ...e, enviado: true } : e)));
    });
  }, [motor, envios]);

  // Al terminar un turno de MaKo, lo guardado puede haber cambiado (guardó el funnel que acordaron): se muestra.
  const estabaEnCurso = useRef(false);
  useEffect(() => {
    const ocupado = !!motor?.enCurso || !!motor?.tarjeta;
    if (estabaEnCurso.current && !ocupado) {
      void guardando.current.then(() => leerGuardado()).then((g) => {
        if (g && JSON.stringify(g) !== JSON.stringify(p)) setP(aplicarCambio(g, { aceptado: undefined }));
      });
    }
    estabaEnCurso.current = ocupado;
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [motor?.enCurso, motor?.tarjeta]);

  const escribir = (t: string) => {
    const r = interpretarEscrito(p, t);
    if (r.tipo === 'nada') { nota({ paso, de: 'yo', texto: t }); nota({ paso, de: 'mako', texto: 'Estamos en la primera pregunta: no hay nada antes.' }); return; }
    if (r.tipo === 'empezar') { empezarDeNuevo(t); return; }
    if (r.tipo === 'volver') {
      ir(r.perfil);
      const ahora = pasoDeCopiloto(r.perfil);
      nota({ paso: ahora, de: 'yo', texto: t });
      nota({ paso: ahora, de: 'mako', texto: acuseDeVolver(p, r.perfil) });
      return;
    }
    if (r.tipo === 'respuesta') { ir(r.perfil); return; }
    if (r.tipo === 'fuera') {
      const x = textoDeFuera(r.fuera);
      nota({ paso, de: 'yo', texto: t });
      nota({ paso, de: 'mako', texto: x.texto, opciones: x.opciones.map((o) => ({ texto: o.texto, perfil: o.cambio ? aplicarCambio(p, o.cambio) : null })) });
      return;
    }
    // Lo demás, a MaKo: con el paso en el que está y lo que falta preguntar.
    setEnvios((es) => [...es, { vez: Date.now(), paso, texto: t, enviado: false, visible: true }]);
  };

  // ── El hilo: la charla, y debajo de cada pregunta lo que se habló en ella ──
  const pantalla = `Marketing CoPilot · primera entrada · pregunta pendiente: «${preguntaDeCopiloto(paso, p, nombre)}»${f ? ` · funnel: ${f.nombre}` : ''}${ref ? ` · referente: ${ref.completo}` : ''}. Contesta lo que pregunta en 2 a 4 líneas y después vuelve a esa pregunta.`;
  const { items, listaEn } = useMemo(() => {
    const guion = itemsDeOffer(mensajesDeCopiloto(p, nombre)).filter((m) => m.k !== 'bloque');
    // Lo del motor, nuevo, partido por cada mensaje que salió de acá (en orden: el motor manda de a uno).
    const propios = motor && base.current ? motor.items.filter((x) => !base.current!.has(x.id)) : [];
    const grupos: ItemHilo[][] = [];
    for (const x of propios) {
      if (x.k === 'msg' && x.role === 'user') grupos.push([]);
      if (!grupos.length) grupos.push([]);
      grupos.at(-1)!.push(x.k === 'msg' ? { ...x, desde: undefined } : x);
    }
    const enviados = envios.filter((e) => e.enviado);
    const extras = new Map<PasoCopiloto, ItemHilo[]>();
    const sumar = (pa: PasoCopiloto, xs: ItemHilo[]) => extras.set(pa, [...(extras.get(pa) ?? []), ...xs]);
    // Notas y envíos, en el orden en que pasaron.
    const linea: Array<{ t: number; paso: PasoCopiloto; xs: ItemHilo[] }> = [];
    for (const n of notas) if (n.visible) linea.push({ t: Number(n.id.split('-').at(-1)), paso: n.paso, xs: [{ k: 'msg', id: n.id, role: n.de === 'yo' ? 'user' : 'assistant', texto: n.texto, at: null }] });
    enviados.forEach((e, i) => { if (e.visible && grupos[i]) linea.push({ t: e.vez, paso: e.paso, xs: grupos[i] }); });
    for (const e of envios) if (!e.enviado && e.visible) linea.push({ t: e.vez, paso: e.paso, xs: [{ k: 'msg', id: `pend-${e.vez}`, role: 'user', texto: e.texto, at: null, estado: 'enviando' }] });
    linea.sort((a, b) => a.t - b.t);
    for (const l of linea) sumar(l.paso, l.xs);
    const out: ItemHilo[] = [];
    const ultimoDe = new Map<PasoCopiloto, number>();
    guion.forEach((x, i) => { const m = /^of-cp-([a-z]+)$/.exec(x.id); if (m) ultimoDe.set(m[1] as PasoCopiloto, i); });
    // La grilla de los referentes va debajo del ÚLTIMO mensaje de MaKo de ese paso: con «me equivoqué» o una pregunta en el medio,
    // debajo de la pregunta quedaba arriba, y lo escrito y la respuesta, debajo de una lista de 32 tarjetas, fuera de la vista.
    let listaEn = 'of-cp-referente';
    guion.forEach((x, i) => {
      out.push(x);
      for (const [pa, j] of ultimoDe) if (j === i && extras.has(pa)) {
        const xs = extras.get(pa)!;
        if (pa === 'referente') for (const y of xs) if (y.k === 'msg' && y.role === 'assistant') listaEn = y.id;
        out.push(...xs);
        extras.delete(pa);
      }
    });
    for (const xs of extras.values()) out.push(...xs);
    return { items: out, listaEn };
  }, [p, nombre, motor, notas, envios]);

  const ultimaNota = [...notas].reverse().find((n) => n.visible);
  const ultimoItem = items.at(-1);
  // Las pastillas del paso, salvo que lo último sea una nota con sus propias opciones (se contestan ésas).
  const conOpcionesDeNota = !!ultimaNota?.opciones && ultimoItem?.id === ultimaNota.id;
  const ultimo = useMemo(() => mensajesDeCopiloto(p, nombre).at(-1), [p, nombre]);
  const opciones = !conOpcionesDeNota && ultimo?.de === 'mako' ? ultimo.opciones ?? [] : [];
  // Abajo de todo, salvo con los referentes a la vista: ahí se arranca por la pregunta y el buscador (la grilla es larga, y bajando
  // de una se veían los últimos de la lista).
  useLayoutEffect(() => {
    const h = hilo.current;
    if (!h) return;
    const refs = paso === 'referente' ? h.querySelector<HTMLElement>('.aa-refs-caja') : null;
    if (refs) h.scrollTop = Math.max(0, refs.getBoundingClientRect().top - h.getBoundingClientRect().top + h.scrollTop - 140);
    else h.scrollTop = h.scrollHeight;
  }, [items.length, terminando, motor?.enCurso, paso]);

  const responderPastilla = (t: string) => {
    const r = interpretarEscrito(p, t);
    if (r.tipo === 'respuesta' || r.tipo === 'volver') ir(r.perfil);
  };

  const elegirReferente = (id: IdAsesor) => ir(aplicarCambio(p, { referente: id }));

  const enMensaje = (m: { id: string }): EnMensaje | null => {
    if (m.id === listaEn && paso === 'referente') return { abajo: <Referentes busca={busca} onBusca={setBusca} apagado={terminando} onElegir={elegirReferente} onSinReferente={() => responderPastilla(SIN_REFERENTE)} /> };
    if (m.id === 'of-cp-competencia') {
      return { abajo: <p className="aa-nota"><a href={RUTAS_COPILOTO.competencia}>Ver Competitor Spy</a>: ahí quedan guardados los negocios que miramos.</p> };
    }
    if (m.id === 'of-cp-propuesta') {
      const pr = propuestaDe(p);
      if (!pr) return null;
      return {
        abajo: (
          <div className="aa-prop">
            <h3>{pr.titulo}</h3>
            {pr.inspirado ? <p className="aa-insp">{pr.inspirado}</p> : null}
            <ul>{pr.puntos.map((x) => <li key={x}>{x}</li>)}</ul>
            <h4>Lo primero</h4>
            <ol>{pr.pasos.map((s) => <li key={s.texto}>{s.href ? <a href={s.href}>{s.texto}</a> : s.texto}</li>)}</ol>
            <p className="aa-nota">¿Algo no te cierra? Escríbemelo abajo y lo hablamos.</p>
          </div>
        ),
      };
    }
    const n = notas.find((x) => x.id === m.id);
    if (n?.opciones && n.id === ultimaNota?.id && ultimoItem?.id === n.id) {
      return {
        abajo: (
          <div role="group" aria-label="Respuestas rápidas" className="aa-rapidas aa-rapidas--nota">
            {n.opciones.map((o) => (
              <button key={o.texto} type="button" className="of-pill" disabled={terminando}
                onClick={() => { setNotas((ns) => ns.map((x) => (x.id === n.id ? { ...x, opciones: undefined } : x))); if (o.perfil) ir(o.perfil); }}>{o.texto}</button>
            ))}
          </div>
        ),
      };
    }
    return null;
  };

  const onMotor = useCallback((m: Motor) => setMotor(m), []);
  const enCurso = terminando || !!motor?.enCurso || envios.some((e) => !e.enviado && e.visible);

  return (
    <div className="aa aa-arranque aa-copiloto">
      <style>{CSS_OFFER}</style>
      <header className="aa-arranque-cab">
        <h1>Marketing CoPilot</h1>
        {ref && f && queEnsena(ref.id)?.funnels.includes(f.id) ? <p className="aa-insp">{inspiradoEn(ref)}</p> : <p>Armemos tu plan para conseguir clientes, paso a paso.</p>}
        <ol className="aa-tramos" aria-label="Para empezar">
          {TRAMOS.map((t, i) => <li key={t} data-estado={i < tramo ? 'hecho' : i === tramo ? 'ahora' : 'falta'}><span aria-hidden>{i < tramo ? '✓' : i + 1}</span>{t}</li>)}
        </ol>
      </header>
      <div className="aa-arranque-hilo">
        <PanelDeChat hilo={hilo} estado={error ?? ''}
          cabecera={{ clave: 'marketing-copilot-entrada', titulo: 'MaKo', criatura: 'MaKo', aspecto: ASPECTO_MAKO, animo: enCurso ? 'trabajando' : 'despierto' }}
          caja={
            <div className="co-caja">
              <CajaChat texto={texto} onTexto={setTexto} placeholder="Responde o pregunta" enterManda ocupado={terminando} bloqueo={appEscritorio.bloqueo}
                onMandar={() => {
                  const t = texto.trim();
                  if (!t) return;
                  escribir(t);
                  setTexto('');
                }} />
            </div>
          }>
          <HiloMako items={items} quien={{ nombre: 'MaKo', aspecto: ASPECTO_MAKO }} ahora={motor?.ahora ?? ahora}
            escribiendo={terminando ? { segs: 1 } : motor?.enCurso ? { segs: motor.segs } : envios.some((e) => !e.enviado && e.visible) ? { segs: 0 } : null}
            tarjeta={motor?.tarjeta ?? null} onTarjeta={(x, a) => void motor?.correrTarjeta(x, a)} onReintentar={motor?.reintentar ?? nada} onRecargar={motor?.recargar ?? nada}
            marcas={motor?.marcas} enMensaje={enMensaje} />
          {opciones.length > 0 && paso !== 'referente' && (
            <div role="group" aria-label="Respuestas rápidas" className="aa-rapidas">
              {opciones.map((t) => <button key={t} type="button" className="of-pill" disabled={terminando} onClick={() => responderPastilla(t)}>{t}</button>)}
            </div>
          )}
          {hayAtras && (
            <div className="aa-nav-charla" role="group" aria-label="Moverse en la charla">
              <button type="button" disabled={terminando} onClick={volver}><span aria-hidden>‹</span> Volver</button>
              <button type="button" disabled={terminando} onClick={() => empezarDeNuevo()}>Empezar de nuevo</button>
            </div>
          )}
        </PanelDeChat>
      </div>
      {envios.length > 0 && <MotorDelCopiloto pantalla={pantalla} onMotor={onMotor} />}
    </div>
  );
}

/** Todos los referentes, con su cara, lo que enseña y sus estrategias; con un buscador. Primero los que arman un funnel. */
function Referentes({ busca, onBusca, apagado, onElegir, onSinReferente }: {
  busca: string; onBusca: (t: string) => void; apagado: boolean; onElegir: (id: IdAsesor) => void; onSinReferente: () => void;
}) {
  const q = plano(busca);
  const lista = REFERENTES_COPILOTO.filter((r) => {
    if (!q) return true;
    const e = queEnsena(r.id)!;
    return plano(`${nombreDelReferente(r.id)} ${e.tema} ${e.canal} ${r.funnels.map((x) => funnelPorId(x)!.corto).join(' ')}`).includes(q);
  });
  const conFunnel = lista.filter((r) => r.funnels.length);
  const otros = lista.filter((r) => !r.funnels.length);
  const tarjeta = (r: (typeof REFERENTES_COPILOTO)[number]) => {
    const e = queEnsena(r.id)!;
    return (
      <li key={r.id}>
        <button type="button" className="aa-ref" disabled={apagado} onClick={() => onElegir(r.id)}>
          <img src={`/asesores/${r.id}.png`} alt="" width={44} height={44} loading="lazy" />
          <span>
            <b>{nombreDelReferente(r.id)}</b>
            <small>{e.tema}</small>
            <span className="aa-ref-chips">
              {r.funnels.length ? r.funnels.map((x) => <i key={x}>{funnelPorId(x)!.corto}</i>) : <i data-otro="">{e.canal}</i>}
            </span>
          </span>
        </button>
      </li>
    );
  };
  return (
    <div className="aa-refs-caja">
      <input type="search" className="aa-refs-buscar" value={busca} onChange={(e) => onBusca(e.target.value)} placeholder="Buscar por nombre o tema: «webinar», «historias», «Doglio»"
        aria-label="Buscar un referente" />
      {conFunnel.length > 0 && <>
        <p className="aa-refs-grupo">Arman un funnel para conseguir clientes</p>
        <ul className="aa-refs" aria-label="Referentes con un funnel">{conFunnel.map(tarjeta)}</ul>
      </>}
      {otros.length > 0 && <>
        <p className="aa-refs-grupo">Enseñan otra parte de la venta</p>
        <ul className="aa-refs" aria-label="Referentes de otra parte de la venta">{otros.map(tarjeta)}</ul>
      </>}
      {!lista.length && <p className="aa-nota">Nadie con «{busca}». Prueba con un tema: anuncios, historias, YouTube, webinar.</p>}
      <button type="button" className="aa-refs-sin" disabled={apagado} onClick={onSinReferente}>{SIN_REFERENTE}</button>
    </div>
  );
}
