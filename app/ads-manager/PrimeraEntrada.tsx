'use client';

// =============================================================================
// Marketing CoPilot — la primera entrada: una charla que termina en un funnel propuesto (6/11/2026)
// =============================================================================
// Martín, 6/11/2026: «Cuando alguien entra por primera vez, que sea diferente el diseño… Que no hayan otras tabs… Que MaKo te vaya
// preguntando las cosas que hagan falta… Algo como lo que tenemos en "Funnel Coach"». La pantalla es la del arranque del Media
// Buyer (ArranqueMediaBuyer.tsx: el mismo marco, el mismo hilo, las mismas pastillas de Offer), con otra charla: la de
// lib/media-buyer/copiloto.ts (puro, con tests). Una pregunta por vez; cada respuesta se guarda en el momento (si se va, vuelve donde
// estaba); lo que se escribe en la caja y no es la respuesta del paso se discute con MaKo (el chat de la tab), con el estado a la vista.
// Al terminar, `router.refresh()`: la página ve el perfil completo y muestra la vista normal.
// =============================================================================

import { useLayoutEffect, useMemo, useRef, useState } from 'react';
import { useRouter } from 'next/navigation';
import { CajaChat } from '@/app/_chat/CajaChat';
import { useAppDeEscritorio } from '@/app/_chat/useAppDeEscritorio';
import { PanelDeChat } from '@/app/admin/operaciones/PanelChat';
import '@/app/admin/operaciones/centro.css';
import { HiloMako, type EnMensaje } from '@/app/_chat/HiloMako';
import { MakoEnLaTab } from '@/app/_chat/MakoEnLaTab';
import { CSS_OFFER } from '@/app/offer/estilos';
import { itemsDeOffer } from '@/app/m/mako/chat-ui';
import { ASPECTO_MAKO } from '@/lib/centro-munecos';
import { asesorPorId, inspiradoEn } from '@/lib/asesores/catalogo';
import {
  RUTAS_COPILOTO, REFERENTES_COPILOTO, aplicarCambio, funnelElegido, leerRespuestaCopiloto, mensajesDeCopiloto, pasoDeCopiloto, propuestaDe,
  type PasoCopiloto, type PerfilCopiloto,
} from '@/lib/media-buyer/copiloto';

const nada = () => {};
const TRAMOS = ['Funnel', 'Tus números', 'Propuesta'] as const;
const tramoDe = (p: PasoCopiloto): number => (p === 'entrada' || p === 'referente' || p === 'funnel' ? 0 : p === 'propuesta' || p === 'listo' ? 2 : 1);

async function guardar(perfil: PerfilCopiloto): Promise<boolean> {
  const r = await fetch('/api/media-buyer', { method: 'POST', headers: { 'content-type': 'application/json' }, body: JSON.stringify({ op: 'copiloto', perfil }) }).catch(() => null);
  return !!r?.ok;
}

export function PrimeraEntrada({ nombre, inicial }: { nombre: string; inicial: PerfilCopiloto }) {
  const router = useRouter();
  const [p, setP] = useState<PerfilCopiloto>(inicial);
  const [texto, setTexto] = useState('');
  const [terminando, setTerminando] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [pedido, setPedido] = useState<{ texto: string; vez: number } | null>(null);
  const [ahora] = useState(() => Date.now());
  const hilo = useRef<HTMLDivElement>(null);
  const appEscritorio = useAppDeEscritorio();
  const paso = pasoDeCopiloto(p);
  const items = useMemo(() => itemsDeOffer(mensajesDeCopiloto(p, nombre)).filter((m) => m.k !== 'bloque'), [p, nombre]);
  const ultimo = useMemo(() => mensajesDeCopiloto(p, nombre).at(-1), [p, nombre]);
  const opciones = ultimo?.de === 'mako' ? ultimo.opciones ?? [] : [];
  useLayoutEffect(() => { const h = hilo.current; if (h) h.scrollTop = h.scrollHeight; }, [items.length, terminando]);
  const tramo = tramoDe(paso);
  const f = funnelElegido(p);
  const ref = p.referente ? asesorPorId(p.referente) : null;

  const terminar = async (sig: PerfilCopiloto) => {
    setTerminando(true);
    const ok = await guardar(sig);
    if (!ok) { setTerminando(false); setError('No pude guardarlo. Prueba otra vez.'); setP(aplicarCambio(sig, { aceptado: undefined })); return; }
    // Sin el `?estrategia=1` de «Cambiar mi estrategia»: con él puesto, la página volvería a mostrar la charla en vez de la vista normal.
    router.replace(window.location.pathname);
    router.refresh();
  };

  const responder = (t: string): boolean => {
    const cambio = leerRespuestaCopiloto(paso, t, p);
    if (!cambio) return false;
    const sig = aplicarCambio(p, cambio);
    setP(sig);
    setError(null);
    if (pasoDeCopiloto(sig) === 'listo') void terminar(sig);
    else void guardar(sig);
    return true;
  };

  // Lo que se escribe y no es la respuesta del paso se discute con MaKo, con lo que ya se sabe adelante.
  const discutir = (t: string) => {
    const sabe = [f ? `funnel ${f.nombre}` : null, p.ticket != null ? `venta de US$${p.ticket}` : null, p.presupuestoMes != null ? `US$${p.presupuestoMes} al mes` : null, p.llamadas ? `llamadas: ${p.llamadas}` : null].filter(Boolean).join(', ');
    setPedido({ texto: `Marketing CoPilot${sabe ? ` (${sabe})` : ''}: ${t}`, vez: Date.now() });
  };

  const enMensaje = (m: { id: string }): EnMensaje | null => {
    if (m.id === 'of-cp-referente') {
      return {
        abajo: (
          <ul className="aa-refs" aria-label="Referentes">
            {REFERENTES_COPILOTO.map((r) => {
              const a = asesorPorId(r.id)!;
              return (
                <li key={r.id}>
                  <button type="button" className="aa-ref" disabled={terminando} onClick={() => responder(a.completo)}>
                    <img src={`/asesores/${a.id}.png`} alt="" width={44} height={44} loading="lazy" />
                    <span><b>{a.completo}</b><small>{r.frase}</small></span>
                  </button>
                </li>
              );
            })}
          </ul>
        ),
      };
    }
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
    return null;
  };

  return (
    <div className="aa aa-arranque aa-copiloto">
      <style>{CSS_OFFER}</style>
      <header className="aa-arranque-cab">
        <h1>Marketing CoPilot</h1>
        {ref && f ? <p className="aa-insp">{inspiradoEn(ref)}</p> : <p>Armemos tu plan para conseguir clientes, paso a paso.</p>}
        <ol className="aa-tramos" aria-label="Para empezar">
          {TRAMOS.map((t, i) => <li key={t} data-estado={i < tramo ? 'hecho' : i === tramo ? 'ahora' : 'falta'}><span aria-hidden>{i < tramo ? '✓' : i + 1}</span>{t}</li>)}
        </ol>
      </header>
      <div className="aa-arranque-hilo">
        <PanelDeChat hilo={hilo} estado={error ?? ''}
          cabecera={{ clave: 'marketing-copilot-entrada', titulo: 'MaKo', criatura: 'MaKo', aspecto: ASPECTO_MAKO, animo: terminando ? 'trabajando' : 'despierto' }}
          caja={
            <div className="co-caja">
              <CajaChat texto={texto} onTexto={setTexto} placeholder="Responde o cuéntame lo que piensas" enterManda ocupado={terminando} bloqueo={appEscritorio.bloqueo}
                onMandar={() => {
                  const t = texto.trim();
                  if (!t) return;
                  if (!responder(t)) discutir(t);
                  setTexto('');
                }} />
            </div>
          }>
          <HiloMako items={items} quien={{ nombre: 'MaKo', aspecto: ASPECTO_MAKO }} ahora={ahora} escribiendo={terminando ? { segs: 1 } : null}
            tarjeta={null} onTarjeta={nada} onReintentar={nada} onRecargar={nada} enMensaje={enMensaje} />
          {opciones.length > 0 && paso !== 'referente' && (
            <div role="group" aria-label="Respuestas rápidas" className="aa-rapidas">
              {opciones.map((t) => <button key={t} type="button" className="of-pill" disabled={terminando} onClick={() => responder(t)}>{t}</button>)}
            </div>
          )}
        </PanelDeChat>
      </div>
      <MakoEnLaTab tab="Marketing CoPilot" pedido={pedido} pantalla={`Marketing CoPilot · primera entrada · paso ${paso}${f ? ` · ${f.nombre}` : ''}`} encimaDeModales />
    </div>
  );
}
