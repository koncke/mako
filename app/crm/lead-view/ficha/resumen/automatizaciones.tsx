'use client';

// =============================================================================
// ficha/resumen/automatizaciones — el bloque «Automatizaciones» de la ficha del lead (23/10/2026)
// =============================================================================
// Martín (23/10/2026): «Tal vez sería bueno crear un bloque dentro del detail de cada lead que esté relacionado a las
// automatizaciones, no? Para tener más claridad de lo que pasa... Y que claro, sea editable como el resto de bloques».
// Es el `automatizaciones-en-curso` del catálogo, que hasta hoy vivía en ./charla.tsx con el nombre y el paso: se mudó
// acá (no se duplica) y dice TODO lo que pasa, como la tarjeta «Sequences» del registro de un contacto en HubSpot:
//   · en qué automatizaciones está y en qué estado (el chip), en qué paso va y qué sale después, a qué hora (la del
//     negocio, `useTzWorkspace`), o POR QUÉ no le sale (el horario, la línea, un fallo: nunca silencio);
//   · lo que ya le salió, con su estado (enviado, entregado, leído o falló, con el error dicho claro);
//   · POR QUÉ no entró cuando se lo movió a una etapa con automatización («ya está adentro», «entra una sola vez»);
//   · las terminadas, plegadas abajo;
//   · «Frenar» y «Empezar de nuevo», con la pregunta antes (no se deshacen).
// Los datos y las acciones son de Automations (app/automations/automatizaciones-del-lead-actions.ts). Lo que el bloque
// dice sale de app/crm/automatizacion-lead.ts (puro, con test).
//
// Diseños (catálogo): «Lista» (una tarjeta por automatización), «Una línea» y «Línea de tiempo» (lo que salió y lo que
// viene, en orden). En el teléfono las tarjetas van una debajo de la otra y las acciones bajan (./estilo.ts).
// =============================================================================

import { useCallback, useState } from 'react';
import Link from '@/app/_ui/Link';
import { Button } from '@/app/_ui';
import { Confirm } from '@/app/_ui/Confirm';
import {
  chipDeInscripcion, estaViva, fechaCorta, lineaDelBloque, lineaDelEnvio, lineaDelProximo, preguntaDeEmpezarDeNuevo,
  preguntaDeFrenar, renglonesDeTarjeta, vistaVacia, type AutomatizacionesVista, type InscripcionVista,
} from '@/app/crm/automatizacion-lead';
import { ciudadDeZona } from '@/lib/por-que-no-sale';
import { useTzWorkspace } from '../../useTzWorkspace';
import type { PropsBloque } from '../tipos';
import { Bloque } from './piezas';
import { useLectura } from './lectura';
import { empezarDeNuevoDelBloque, frenarDelBloque, leerAutomatizacionesDelBloque } from './automatizaciones-datos';

/** «hoy 18:33», «ayer 16:33», «mañana 09:00» o «vie 24 oct, 09:12», en la zona del negocio (`fechaCorta`). */
function fechaEn(tz: string): (iso: string) => string {
  return (iso) => fechaCorta(iso, tz, Date.now());
}

type Accion = { tipo: 'frenar' | 'empezar'; aut: InscripcionVista };

export function AutomatizacionesDelLead({ ctx, titulo, diseno, epico }: PropsBloque) {
  const tz = useTzWorkspace();
  const fecha = fechaEn(tz);
  const [version, setVersion] = useState(0);
  // eslint-disable-next-line react-hooks/exhaustive-deps
  const leer = useCallback((id: number) => leerAutomatizacionesDelBloque(id), [version]);
  const { dato: r } = useLectura<AutomatizacionesVista>(ctx.lead.id, leer);
  const [accion, setAccion] = useState<Accion | null>(null);
  const [haciendo, setHaciendo] = useState(false);
  const [resultado, setResultado] = useState<{ texto: string; ok: boolean } | null>(null);
  const cancelar = useCallback(() => setAccion(null), []);

  const confirmar = async () => {
    if (!accion || haciendo) return;
    setHaciendo(true);
    try {
      const q = accion.tipo === 'frenar'
        ? await frenarDelBloque(ctx.lead.id, accion.aut.secuenciaId)
        : await empezarDeNuevoDelBloque(ctx.lead.id, accion.aut.secuenciaId);
      setResultado(q.ok ? { texto: q.resumen, ok: true } : { texto: q.error, ok: false });
    } catch {
      setResultado({ texto: accion.tipo === 'frenar' ? 'No se pudo frenar.' : 'No se pudo empezar de nuevo.', ok: false });
    }
    setHaciendo(false);
    setAccion(null);
    setVersion((v) => v + 1);
  };

  if (r === 'cargando') return null;
  if (r === null) {
    return <Bloque titulo={titulo} epico={epico}><span className="fr-sub">No pude leer sus automatizaciones. Vuelve a abrir la ficha en un rato.</span></Bloque>;
  }
  if (vistaVacia(r)) {
    // Frenó la última: lo dice, en vez de desaparecer sin explicación.
    return resultado ? <Bloque titulo={titulo} epico={epico}><span className="fr-sub" role="status">{resultado.texto}</span></Bloque> : null;
  }

  const pregunta = accion
    ? (accion.tipo === 'frenar'
      ? preguntaDeFrenar({ leads: 1, nombre: ctx.lead.nombre, auts: [accion.aut] })
      : preguntaDeEmpezarDeNuevo({ nombre: ctx.lead.nombre, aut: accion.aut }))
    : null;
  const zona = `Hora de ${ciudadDeZona(tz)}`;
  const derecha = <Link href="/automations" className="fr-link">Ver todas</Link>;
  const avisoResultado = resultado && <span className={`fr-sub${resultado.ok ? '' : ' fr-aut-mal'}`} role="status">{resultado.texto}</span>;

  // Una vez que no entró: arriba de todo, en ámbar, con lo que se puede hacer.
  const noEntro = r.noEntro.length > 0 && (
    <div className="fr-aut-noentro" role="note">
      {r.noEntro.map((n, i) => {
        const viva = r.vivas.find((v) => v.secuenciaId === n.secuenciaId);
        return (
          <div key={`${n.secuenciaId}-${i}`} className="fr-aut-noentro-fila">
            <span>{n.texto}{n.at ? <span className="fr-sub"> · {fecha(n.at)}</span> : null}</span>
            {viva?.puede.empezarDeNuevo && (
              <Button variant="secondary" size="sm" onClick={() => { setResultado(null); setAccion({ tipo: 'empezar', aut: viva }); }}>Empezar de nuevo</Button>
            )}
          </div>
        );
      })}
    </div>
  );

  const acciones = (a: InscripcionVista) => (
    <span className="fr-aut-acciones">
      {a.puede.empezarDeNuevo ? (
        <Button variant="tertiary" size="sm" onClick={() => { setResultado(null); setAccion({ tipo: 'empezar', aut: a }); }}>Empezar de nuevo</Button>
      ) : a.puede.porQueNo && estaViva(a) ? (
        // Por qué no (frenada, en pausa, con una persona): apagado y dicho, no escondido.
        <Button variant="tertiary" size="sm" disabled title={a.puede.porQueNo}>Empezar de nuevo</Button>
      ) : null}
      {estaViva(a) && a.puede.frenar && (
        <Button variant="tertiary" size="sm" onClick={() => { setResultado(null); setAccion({ tipo: 'frenar', aut: a }); }}>Frenar</Button>
      )}
    </span>
  );

  const chip = (a: InscripcionVista) => {
    const c = chipDeInscripcion(a);
    return <span className={`fr-aut-chip fr-aut-chip--${c.tono}`}>{c.texto}</span>;
  };

  // El historial entero, plegado: lo último ya lo dice el primer renglón, así que sólo con más de un envío.
  const enviados = (a: InscripcionVista, abierto: boolean) => a.enviados.length > 1 && (
    <details className="fr-plegado" open={abierto || undefined}>
      <summary>Historial ({a.enviados.length})</summary>
      <ul className="fr-aut-envios">
        {a.enviados.map((e, i) => {
          const l = lineaDelEnvio(e, fecha);
          return (
            <li key={`${e.at}-${i}`} className={`fr-aut-envio fr-aut-envio--${l.tono}`}>
              <span className="fr-aut-punto" aria-hidden />
              <span>{!e.que && e.paso && <strong>{e.paso} · </strong>}{l.texto}</span>
            </li>
          );
        })}
      </ul>
    </details>
  );

  // ── LA TARJETA (24/10/2026, Martín: «está bastante fea... No es funcional, rediseñala bien») ───────────────────────────
  // El nombre y su estado, y debajo lo que se pregunta quien abre la ficha, sin entrar a la automatización: qué le salió y
  // cuándo, si contestó, y qué sigue (o por qué no, o cómo terminó). `renglonesDeTarjeta` (app/crm/automatizacion-lead.ts).
  // Fuera el «Paso 5 de 9: CRON»: el número y el nombre son los del lienzo, no lo que le pasó al lead.
  const renglones = (a: InscripcionVista) => (
    <ul className="fr-aut-renglones">
      {renglonesDeTarjeta(a, fecha).map((r, k) => (
        <li key={`${r.tipo}-${k}`} className={`fr-aut-renglon fr-aut-renglon--${r.tipo} fr-aut-renglon--${r.tono}`}>
          <span className="fr-aut-punto" aria-hidden />
          <span>{r.texto}</span>
        </li>
      ))}
    </ul>
  );

  const tarjeta = (a: InscripcionVista) => (
    <div key={a.secuenciaId} className="fr-tarjeta fr-aut" data-automatizacion={a.secuenciaId}>
      <div className="fr-cab">
        <Link href={a.link} className="fr-link fr-aut-nombre">{a.nombre}</Link>
        {chip(a)}
      </div>
      {renglones(a)}
      {enviados(a, epico)}
      {acciones(a)}
    </div>
  );

  // «Una línea»: los nombres con su estado, y lo que no entró.
  if (diseno === 'linea' && !epico) {
    return (
      <>
        <Bloque titulo={titulo} epico={false} derecha={derecha}>
          {noEntro}
          <span className="fr-linea">{lineaDelBloque(r)}</span>
          {avisoResultado}
        </Bloque>
        {pregunta && <Confirm title={pregunta.titulo} message={pregunta.mensaje} confirmLabel={accion?.tipo === 'frenar' ? 'Frenar' : 'Empezar de nuevo'} tone={accion?.tipo === 'frenar' ? 'danger' : 'primary'} loading={haciendo} onConfirm={() => void confirmar()} onCancel={cancelar} />}
      </>
    );
  }

  // «Línea de tiempo»: por automatización, lo que salió (del más viejo al más nuevo) y, al final, lo que viene.
  if (diseno === 'tiempo') {
    return (
      <>
        <Bloque titulo={titulo} epico={epico} derecha={derecha}>
          {noEntro}
          {[...r.vivas, ...r.terminadas].map((a) => (
            <div key={a.secuenciaId} className="fr-aut-tiempo">
              <div className="fr-cab"><Link href={a.link} className="fr-link fr-aut-nombre">{a.nombre}</Link>{chip(a)}</div>
              <ul className="fr-aut-envios">
                {[...a.enviados].reverse().map((e, i) => {
                  const l = lineaDelEnvio(e, fecha);
                  return (
                    <li key={`${e.at}-${i}`} className={`fr-aut-envio fr-aut-envio--${l.tono}`}>
                      <span className="fr-aut-punto" aria-hidden />
                      <span>{!e.que && e.paso && <strong>{e.paso} · </strong>}{l.texto}</span>
                    </li>
                  );
                })}
                <li className="fr-aut-envio fr-aut-envio--proximo">
                  <span className="fr-aut-punto" aria-hidden />
                  <span>{lineaDelProximo(a, fecha)}</span>
                </li>
              </ul>
              {acciones(a)}
            </div>
          ))}
          <span className="fr-sub">{zona}</span>
          {avisoResultado}
        </Bloque>
        {pregunta && <Confirm title={pregunta.titulo} message={pregunta.mensaje} confirmLabel={accion?.tipo === 'frenar' ? 'Frenar' : 'Empezar de nuevo'} tone={accion?.tipo === 'frenar' ? 'danger' : 'primary'} loading={haciendo} onConfirm={() => void confirmar()} onCancel={cancelar} />}
      </>
    );
  }

  // «Lista» (el de entrada): una tarjeta por automatización viva; las terminadas, plegadas abajo.
  return (
    <>
      <Bloque titulo={titulo} epico={epico} derecha={derecha}>
        {noEntro}
        <div className="fr-aut-lista">{r.vivas.map(tarjeta)}</div>
        {r.terminadas.length > 0 && (
          <details className="fr-plegado" open={!r.vivas.length || undefined}>
            <summary>Terminadas ({r.terminadas.length})</summary>
            <div className="fr-aut-lista">{r.terminadas.map(tarjeta)}</div>
          </details>
        )}
        <span className="fr-sub">{zona}</span>
        {avisoResultado}
      </Bloque>
      {pregunta && <Confirm title={pregunta.titulo} message={pregunta.mensaje} confirmLabel={accion?.tipo === 'frenar' ? 'Frenar' : 'Empezar de nuevo'} tone={accion?.tipo === 'frenar' ? 'danger' : 'primary'} loading={haciendo} onConfirm={() => void confirmar()} onCancel={cancelar} />}
    </>
  );
}
