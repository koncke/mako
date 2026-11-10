'use client';

// =============================================================================
// Marketing CoPilot — las secciones que NO son de anuncios: Esta semana, Plan y Qué medir (6/11/2026)
// =============================================================================
// Martín, 6/11/2026: «si ahora vamos a hacer diferentes funnels, y al final tú me entregas la misma pantalla que hoy en día, que tiene
// una tag que se llama campañas, es decir, campañas para un funnel orgánico, no tiene sentido». Un funnel sin anuncios (orgánico, YouTube,
// y un webinar o un lead magnet sin presupuesto) no tiene una cuenta que mirar: su pantalla es lo que hay que hacer esta semana, el plan
// y qué medir, y todo lo que se hace sale a la pantalla de MaKo donde ya existe (Calendario, Copywriting, Carruseles, Lead Magnet, Web
// Generator). Con anuncios, la sección «Plan» se suma a Hoy · Campañas · Biblioteca. El contenido sale de lib/media-buyer/copiloto.ts (puro).
// =============================================================================

import Link from 'next/link';
import { useEffect, useState } from 'react';
import { ConversacionCerebro, MakoEnLaTab } from '@/app/_chat/MakoEnLaTab';
import { anotarEstrellaPropia } from '@/app/_chat/estrella-propia';
import { CajaDeOrden } from './Hoy';
import { PanelDelFunnel } from './PanelDelFunnel';
import { CSS_OFFER } from '@/app/offer/estilos';

const SUGERENCIAS_DE_APERTURA = ['¿Qué hago esta semana?', '¿Y si pruebo otro funnel?', 'Revisemos mis números'] as const;
import { funnelElegido, medirDe, propuestaDe, tareasDeLaSemana, type PerfilCopiloto, type SeccionCopiloto } from '@/lib/media-buyer/copiloto';

const ROTULO: Record<SeccionCopiloto, string> = { hoy: 'Hoy', plan: 'Plan', campanas: 'Campañas', biblioteca: 'Biblioteca', semana: 'Esta semana', medir: 'Qué medir' };
export const rotuloDeSeccion = (s: SeccionCopiloto) => ROTULO[s];

/** La sección «Plan»: la propuesta que se aceptó, con sus pasos, y cómo cambiarla. */
export function SeccionPlan({ perfil }: { perfil: PerfilCopiloto }) {
  const pr = propuestaDe(perfil);
  const f = funnelElegido(perfil);
  if (!pr || !f) return null;
  return (
    <section className="aa-card" aria-label="Plan">
      <h2>{pr.titulo}</h2>
      {pr.inspirado ? <p className="aa-insp">{pr.inspirado}</p> : null}
      <ul className="aa-lista">{pr.puntos.map((x) => <li key={x}>{x}</li>)}</ul>
      <h3>Los primeros pasos</h3>
      <ol className="aa-lista">{pr.pasos.map((x) => <li key={x.texto}>{x.href ? <Link href={x.href} className="aa-link">{x.texto}</Link> : x.texto}</li>)}</ol>
      <p className="aa-nota"><Link href="/ads-manager?estrategia=1" className="aa-link">Cambiar mi estrategia</Link>: vuelvo a preguntarte lo que cambió.</p>
    </section>
  );
}

/** La sección «Esta semana»: qué hacer y dónde. */
export function SeccionSemana({ perfil }: { perfil: PerfilCopiloto }) {
  const tareas = tareasDeLaSemana(perfil);
  return (
    <section aria-label="Esta semana">
      <ul className="aa-tareas">
        {tareas.map((t) => (
          <li key={t.titulo} className="aa-card aa-tarea">
            <div><h3>{t.titulo}</h3><p>{t.detalle}</p></div>
            <Link href={t.href} className="aa-boton">{t.accion}</Link>
          </li>
        ))}
      </ul>
    </section>
  );
}

/** La sección «Qué medir»: el número que manda y lo que se mira. */
export function SeccionMedir({ perfil }: { perfil: PerfilCopiloto }) {
  const m = medirDe(perfil.funnel ?? funnelElegido(perfil)?.id, perfil);
  return (
    <section className="aa-card" aria-label="Qué medir">
      <h2>El número que manda</h2>
      <p className="aa-grande">{m.manda}</p>
      <h3>Lo que se mira</h3>
      <ul className="aa-lista">
        {m.medidas.map((x) => <li key={x.nombre}><b>{x.nombre}</b>: {x.que}{x.contexto ? <small> ({x.contexto})</small> : null}</li>)}
      </ul>
      <p className="aa-nota">Los leads y las llamadas de cada fuente están en el <Link href="/crm" className="aa-link">CRM</Link>.</p>
    </section>
  );
}

/**
 * La pantalla de la COMPUTADORA de un funnel sin anuncios (9/11/2026): la de la charla, en dos columnas. MaKo a la izquierda (el
 * Cerebro con el contexto del CoPilot, como la tarjeta de Create: ConversacionCerebro) y a la derecha el panel del funnel «En marcha»
 * con Tu funnel · Esta semana · Qué medir (PanelDelFunnel.tsx). El teléfono sigue con `SinAnuncios` (abajo), que tiene su hoja de MaKo.
 */
export function EstrategiaCopiloto({ perfil }: { perfil: PerfilCopiloto }) {
  const f = funnelElegido(perfil);
  const [vista, setVista] = useState<'chat' | 'funnel'>('funnel');
  const [pedido, setPedido] = useState<{ texto: string; vez: number } | null>(null);
  // El chat de MaKo está a la vista: la estrella de la barra (app/_chat/EstrellaDeLaApp.tsx) no va, como en Create (lib/estrella-rutas.ts →
  // CON_CHAT_A_LA_VISTA). La ruta no sirve: /ads-manager también es Hoy, que sí la lleva. En producción (10/11/2026) la estrella tapaba la caja.
  useEffect(() => anotarEstrellaPropia(), []);
  // Lo primero que dice MaKo aquí (si el Cerebro no tiene nada más reciente): las tres cosas que se hacen con un funnel en marcha, como
  // los arranques sugeridos de las referencias (Zapier, HubSpot). Cada una sale al chat tal cual, con el contexto del CoPilot.
  const apertura = (
    <div className="cp-apertura">
      <p>{f ? `Tu funnel está en marcha: ${f.nombre}. ¿Qué miramos?` : '¿Qué miramos de tu estrategia?'}</p>
      <div className="aa-rapidas" role="group" aria-label="Para empezar">
        {SUGERENCIAS_DE_APERTURA.map((s) => <button key={s} type="button" className="of-pill" onClick={() => { setVista('chat'); setPedido({ texto: s, vez: Date.now() }); }}>{s}</button>)}
      </div>
    </div>
  );
  return (
    <div className="aa aa-dos aa-copiloto">
      <style>{CSS_OFFER}</style>
      <h1 className="cp-oculto">Marketing CoPilot</h1>
      <div className="cp" data-vista={vista}>
        <div className="cp-switch" role="group" aria-label="Qué ver">
          <button type="button" aria-pressed={vista === 'chat'} onClick={() => setVista('chat')}>MaKo</button>
          <button type="button" aria-pressed={vista === 'funnel'} onClick={() => setVista('funnel')}>Tu funnel</button>
        </div>
        <section className="cp-chat" aria-label="MaKo en Marketing CoPilot">
          <div className="cp-chat-cerebro">
            <ConversacionCerebro tab="Marketing CoPilot" titulo="MaKo" apertura={apertura} aperturaHastaEscribir pedido={pedido} onMandado={() => setPedido(null)}
              pantalla={`Marketing CoPilot · ${f?.nombre ?? 'sin funnel'} · el panel muestra su funnel, esta semana y qué medir`} />
          </div>
        </section>
        <PanelDelFunnel perfil={perfil} modo="listo" />
      </div>
    </div>
  );
}

/** La pantalla de un funnel sin anuncios EN EL TELÉFONO: tres secciones, sin Campañas, sin cuenta de Meta. */
export function SinAnuncios({ perfil }: { perfil: PerfilCopiloto }) {
  const f = funnelElegido(perfil);
  const [sec, setSec] = useState<'semana' | 'plan' | 'medir'>('semana');
  const [pedido, setPedido] = useState<{ texto: string; vez: number } | null>(null);
  return (
    <div className="aa aa-sinanuncios">
      <nav className="aa-top" aria-label="Marketing CoPilot">
        <div role="tablist" className="aa-tabs">
          {(['semana', 'plan', 'medir'] as const).map((s) => (
            <button key={s} type="button" role="tab" className="aa-tab" aria-selected={sec === s} onClick={() => setSec(s)}>{ROTULO[s]}</button>
          ))}
        </div>
        <div className="aa-top-der">{f ? <span className="aa-etiqueta">{f.nombre}</span> : null}</div>
      </nav>
      <div className="aa-pagina">
        <CajaDeOrden placeholder="Pídele algo a MaKo" onPedir={(texto) => setPedido({ texto: `Marketing CoPilot: ${texto}`, vez: Date.now() })} />
        {sec === 'semana' && <SeccionSemana perfil={perfil} />}
        {sec === 'plan' && <SeccionPlan perfil={perfil} />}
        {sec === 'medir' && <SeccionMedir perfil={perfil} />}
      </div>
      <MakoEnLaTab tab="Marketing CoPilot" pedido={pedido} pantalla={`Marketing CoPilot · ${f?.nombre ?? ''} · sección ${ROTULO[sec]}`} encimaDeModales />
    </div>
  );
}
