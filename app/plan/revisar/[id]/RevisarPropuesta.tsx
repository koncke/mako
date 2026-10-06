'use client';

import { useWs } from '@/app/_ui/Link';
import { conWs } from '@/lib/ws-tab';

// =============================================================================
// RevisarPropuesta — el dueño O el cliente confirma el borrador de MaKo
// =============================================================================
// SOLO wizard (WizardShell), nada de editor: los CIERRES de a uno (si hay) →
// confirmar. Al crear, las tareas las prioriza y describe el PERRO (nadie toca la
// prioridad a mano acá) y la revisión final se ve en el plan.
//
// ⛔ SIN PREGUNTAS (05/10/2026). Este wizard preguntaba de a una lo que MaKo no sabía
// («¿para cuándo?», «¿es una tarea o varias?»), después armaba repreguntas con lo
// contestado y al final proponía tareas extra salidas de las respuestas. Martín:
// «habíamos dicho de sacar absolutamente toda la fricción al agregar tareas». La fecha
// y la prioridad las pone el Perro solo y se cambian a mano en el detalle; lo que MaKo
// no pudo deducir va en el detalle de la tarea, no en un paso que la frena. Un borrador
// viejo que traiga preguntas guardadas se confirma igual: se ignoran.
//
// Lo que SÍ queda de a uno son los cierres: un «ya está hecho» dicho por IA acertó 8 de
// 17 la primera vez que se midió, y confirmarlo en una lista es la pantalla que no
// queremos. Eso no es fricción del alta: es una decisión sobre algo que ya existe.

import { useState } from 'react';
import { WizardShell } from '../../../_components/WizardShell';
import type { Propuesta } from '@/lib/plan-propuesta';

const SANS = "'Geist', sans-serif";
const MONO = "'Geist Mono', monospace";

/** El aplicado es LARGO de verdad: crea las tareas y después el Perro las puntúa por
 *  tandas. Un spinner, no el cuerpo del último paso con el título cambiado. */
function Cargando({ texto, sub }: { texto: string; sub?: string }) {
  return (
    <div style={{ display: 'flex', flexDirection: 'column', alignItems: 'center', gap: 14, padding: '18px 0' }}>
      <style>{'@keyframes mkSpin{to{transform:rotate(360deg)}}'}</style>
      <div style={{ width: 32, height: 32, borderRadius: '50%', border: '3px solid var(--border)', borderTopColor: 'var(--primary)', animation: 'mkSpin .8s linear infinite' }} />
      <span style={{ fontSize: 13, color: 'var(--dim)' }}>{texto}</span>
      {sub && <span style={{ fontSize: 12.5, color: 'var(--faint)', lineHeight: 1.5, maxWidth: 340, textAlign: 'center' }}>{sub}</span>}
    </div>
  );
}

function Mensaje({ texto, sub, ok, link }: { texto: string; sub?: string; ok?: boolean; link?: boolean }) {
  return (
    <main style={{ minHeight: '100vh', display: 'grid', placeItems: 'center', background: 'var(--bg)', color: 'var(--ink)', fontFamily: SANS, padding: 24 }}>
      <div style={{ textAlign: 'center', padding: '26px 30px', background: ok ? 'var(--good-bg)' : 'var(--surface)', border: `1px solid ${ok ? '#BFE6CD' : 'var(--border)'}`, borderRadius: 16, maxWidth: 420 }}>
        <div style={{ fontSize: 16, fontWeight: 700, color: ok ? 'var(--good)' : 'var(--ink)' }}>{texto}</div>
        {sub && <div style={{ fontSize: 13, color: 'var(--dim)', marginTop: 6 }}>{sub}</div>}
        {(!sub || link) && <a href="/plan" style={{ display: 'inline-block', marginTop: 14, padding: '9px 18px', borderRadius: 9, background: 'var(--ink)', color: 'var(--surface)', fontSize: 13.5, fontWeight: 600, textDecoration: 'none' }}>Ir al plan</a>}
      </div>
    </main>
  );
}

// Ya NO hay paso de bajas. La regla del dueño: «JAMÁS me debe preguntar si borrar una
// tarea. Si detecta que se está subiendo una que ya está, debe procesarlo internamente
// y decidir solo: ignorarla o ampliar el contexto de la que ya existe». Eso ahora pasa
// en el server (aplicarPropuestas), sin pantalla y sin checkbox.
type Step = { kind: 'cerrar'; i: number } | { kind: 'confirm' };

/** Un cierre propuesto: el título de la tarjeta, la evidencia, y las tres respuestas.
 *  «Está a medias» existe porque es la respuesta REAL más frecuente: de 27 candidatas
 *  de la primera corrida, 19 no eran ni un sí ni un no. Sin ese botón, ese matiz se
 *  pierde y el trabajo de verificar se tira. */
function CierrePaso({ item, valor, onElegir }: {
  item: { id: string; evidencia: string; confianza?: 'alta' | 'media'; titulo?: string };
  valor: 'si' | 'medias' | 'no' | undefined;
  onElegir: (v: 'si' | 'medias' | 'no') => void;
}) {
  const OPS: Array<{ v: 'si' | 'medias' | 'no'; label: string; sub: string }> = [
    { v: 'si', label: 'Sí, está hecha', sub: 'la cierro y le dejo la evidencia' },
    { v: 'medias', label: 'Está a medias', sub: 'le subo el avance, no la cierro' },
    { v: 'no', label: 'No', sub: 'la dejo como está' },
  ];
  return (
    <div>
      <div style={{ padding: '12px 14px', borderRadius: 12, border: '1px solid var(--border)', background: 'var(--surface-2)', marginBottom: 14 }}>
        <div style={{ fontFamily: MONO, fontSize: 10, letterSpacing: '.08em', textTransform: 'uppercase', color: 'var(--faint)', marginBottom: 5 }}>
          Lo que encontré{item.confianza === 'media' ? ' · lo deduje, no lo verifiqué' : ''}
        </div>
        <div style={{ fontSize: 13.5, color: 'var(--ink)', lineHeight: 1.6 }}>{item.evidencia}</div>
      </div>
      <div style={{ display: 'flex', flexDirection: 'column', gap: 8 }}>
        {OPS.map((o) => {
          const on = valor === o.v;
          return (
            <button key={o.v} type="button" onClick={() => onElegir(o.v)}
              style={{ textAlign: 'left', padding: '11px 14px', borderRadius: 11, cursor: 'pointer', fontFamily: SANS,
                border: `1.5px solid ${on ? 'var(--primary)' : 'var(--border-strong)'}`,
                background: on ? 'var(--primary-bg)' : 'var(--surface)' }}>
              <div style={{ fontSize: 14, fontWeight: 650, color: on ? 'var(--primary)' : 'var(--ink)' }}>{o.label}</div>
              <div style={{ fontSize: 12.5, color: 'var(--dim)', marginTop: 2 }}>{o.sub}</div>
            </button>
          );
        })}
      </div>
    </div>
  );
}

import { ContextoDelBorrador } from './ContextoDelBorrador';

export function RevisarPropuesta({ prop }: { prop: Propuesta }) {
  const [paso, setPaso] = useState(0);
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState('');
  const [done, setDone] = useState<'' | 'aplicada' | 'descartada'>('');
  /** Respuesta por cierre: 'si' cierra, 'medias' sube el avance y suma la evidencia,
   *  'no' no toca nada. Sin responder = 'no': el default nunca cierra sola. */
  const [cierreResp, setCierreResp] = useState<Record<number, 'si' | 'medias' | 'no'>>({});
  // La pestaña que se está mirando. Sin esto, volver «a lo tuyo» te devuelve
  // literalmente a lo TUYO aunque estuvieras revisando la cuenta de un cliente.
  const ws = useWs();
  const irPlan = () => { window.location.href = conWs('/plan', ws); };
  // Las tareas que ESTE wizard va a crear son solo las MÍAS: el server descarta las de
  // otras personas (aplicarPropuestas filtra esDeOtro), que viajan a SU tablero por su
  // propio camino. Contarlas acá hacía que el botón prometiera "Crear 3" y el server
  // contestara "No hay nada para crear ni borrar" — y como el wizard es bloqueante, la
  // única salida que quedaba era descartar el borrador entero.
  const mias = prop.tareas.filter((t) => !t.esDeOtro);
  const nT = mias.length;
  const nAjenas = prop.tareas.length - nT;
  // Cuántos proyectos abarcan las tareas (distintos nombres referenciados) — el dueño
  // quiere ver "N tareas en M proyectos", no solo las tareas.
  const nP = new Set(mias.map((t) => (t.proyecto || '').trim()).filter(Boolean)).size;
  const enProy = nP ? ` en ${nP} proyecto${nP === 1 ? '' : 's'}` : '';

  // Los cierres van PRIMERO, uno por paso. Es lo más delicado del borrador: MaKo
  // afirma que algo que ya está en el tablero ya está hecho, y acertó 8 de 17 la
  // primera vez que se midió. Por eso no hay lista con checkboxes ni «aceptar todo»:
  // se mira una, se lee la evidencia, se contesta, y recién ahí aparece la siguiente.
  const cierres = prop.cerrar ?? [];
  // UN BORRADOR PUEDE NO TRAER NINGUNA TAREA NUEVA y ser igual de valioso: el bot que
  // lee los commits (lib/cerrar-por-commits.ts) propone SOLO cierres, nunca crea nada.
  // Su primera corrida real dejó 10 propuestas y esta pantalla contestó «Este borrador
  // ya no tiene tareas» — el canal entero era inalcanzable desde la UI. Todo lo que
  // sigue cuenta las dos cosas, no solo las tareas.
  const nC = cierres.length;
  const nSi = cierres.filter((_, i) => cierreResp[i] === 'si').length;
  const nMedias = cierres.filter((_, i) => cierreResp[i] === 'medias').length;
  /** Sin tareas que crear, TODA la pantalla habla de cierres. Prometer «Crear 0» y
   *  después avisar «Creé 0 tareas» es peor que no mostrar nada. */
  const soloCierres = nT === 0 && nC > 0;
  /** «cierro 3 tareas y subo el avance de 1» — armado con lo que el dueño CONTESTÓ, no
   *  con lo que MaKo propuso. Las que dijo que no ni se nombran: quedan como estaban. */
  const fraseCierre = [
    nSi ? `cierro ${nSi} tarea${nSi === 1 ? '' : 's'}` : '',
    nMedias ? `subo el avance de ${nMedias}` : '',
  ].filter(Boolean).join(' y ');

  const steps: Step[] = [
    ...cierres.map((_, i) => ({ kind: 'cerrar' as const, i })),
    { kind: 'confirm' as const },
  ];
  const cur = steps[Math.min(paso, steps.length - 1)];
  const esUltimo = paso >= steps.length - 1;

  const enviar = async (action: 'aplicar' | 'descartar') => {
    setBusy(true); setError('');
    try {
      const cerrarIds = cierres.filter((_, i) => cierreResp[i] === 'si').map((c) => c.id);
      const aMediasIds = cierres.filter((_, i) => cierreResp[i] === 'medias').map((c) => c.id);
      const body = action === 'aplicar' ? { action, id: prop.id, cerrarIds, aMediasIds } : { action, id: prop.id };
      const r = await fetch('/api/plan-propuesta', { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify(body) }).then((res) => res.json());
      if (!r.ok) { setError(r.error || 'No se pudo.'); setBusy(false); return; }
      setDone(action === 'aplicar' ? 'aplicada' : 'descartada');
      setTimeout(irPlan, 1300);
    } catch (e) { setError(e instanceof Error ? e.message : 'Error de red.'); setBusy(false); }
  };

  if (prop.estado !== 'pendiente') return <Mensaje texto={`Este borrador ya fue ${prop.estado}.`} />;
  // Todo lo que queda es de OTRAS personas: no hay nada que crear acá. Se dice y se
  // manda al plan, donde el modal de la reunión sí tiene el reparto por persona.
  // Vacío de verdad = ni tareas ni cierres. Antes alcanzaba con no tener tareas.
  if (nT === 0 && nC === 0) {
    return <Mensaje ok texto={nAjenas ? `Aquí no te queda nada para crear: ${nAjenas === 1 ? 'la tarea que quedaba es' : `las ${nAjenas} tareas que quedaban son`} de otras personas.` : 'Este borrador ya no tiene tareas.'}
      sub="Repartilas desde tu plan: ahí MaKo te deja mandárselas a cada uno." link />;
  }
  if (done) {
    const hecho = soloCierres
      ? (fraseCierre ? `✓ Listo: ${fraseCierre}` : '✓ No cambié nada en tu tablero')
      : `✓ Creé ${nT} tarea${nT === 1 ? '' : 's'}${enProy}`;
    return <Mensaje ok texto={done === 'aplicada' ? hecho : '✓ Borrador descartado'} sub="Te llevo al plan…" />;
  }

  const crearLabel = !soloCierres ? `Crear ${nT}`
    : nSi ? `Cerrar ${nSi}`
    : nMedias ? `Guardar el avance de ${nMedias}`
      : 'Listo';
  const pregunta = cur.kind === 'cerrar' ? `¿«${cierres[cur.i]?.titulo || 'esta tarea'}» ya está hecha?`
    : soloCierres ? (fraseCierre ? `Listo — ${fraseCierre}` : 'No queda nada para cerrar')
      : `Listo — creo ${nT} tarea${nT === 1 ? '' : 's'}${enProy}`;
  const sub = cur.kind === 'cerrar' ? 'La tengo en tu tablero abierta, pero encontré esto. Tú decides.'
    : soloCierres ? 'Las que dijiste que no, quedan abiertas tal cual estaban.'
      : 'El Perro Guardián las prioriza y les pone fecha. Lo cambias a mano en el plan.';

  return (
    <WizardShell
      // UNA LÍNEA. El `resumen` puede traer la investigación entera (3.000 caracteres) y
      // acá se renderiza centrado y en mono, arriba de todo: era un muro de texto antes
      // de poder leer la pregunta. El texto completo va abajo, en ContextoDelBorrador.
      titulo={soloCierres ? `Borrador · ${nC} para revisar`
        : `Borrador · ${nT} tarea${nT === 1 ? '' : 's'}${enProy}`}
      total={steps.length} idx={Math.min(paso, steps.length - 1)}
      pregunta={busy ? (soloCierres ? 'Guardando…' : 'Creando…') : pregunta} sub={busy ? undefined : sub}
      puedeAvanzar={!busy} enUltimo={esUltimo} confirmLabel={crearLabel} pending={busy}
      atrasLabel={paso === 0 ? 'Cancelar' : 'Atrás'} siguienteLabel="Siguiente →"
      error={error || undefined}
      // No se puede cerrar a mitad (sin ✕, sin backdrop): solo se sale creando (Crear)
      // o descartando explícito (en el paso final), o Cancelar en el paso 0.
      bloqueante
      onClose={irPlan}
      onAtras={() => (paso === 0 ? irPlan() : setPaso(paso - 1))}
      onSiguiente={() => setPaso((p) => p + 1)}
      onConfirmar={() => enviar('aplicar')}
    >
      {busy ? (
        <Cargando
          texto={soloCierres ? 'Actualizando tu tablero…' : 'Creando las tareas y puntuándolas contra tu plan…'}
          sub={soloCierres ? 'Marco las que confirmaste y dejo el resto como estaba.' : 'Puede tardar unos segundos.'} />
      ) : cur.kind === 'cerrar' ? (
        <><CierrePaso item={cierres[cur.i]} valor={cierreResp[cur.i]} onElegir={(v) => setCierreResp((r) => ({ ...r, [cur.i]: v }))} />
        <ContextoDelBorrador texto={prop.resumen} /></>
      ) : (
        <div style={{ textAlign: 'center' }}>
          <div style={{ fontSize: 14, color: 'var(--dim)', lineHeight: 1.5 }}>
            {soloCierres
              ? (fraseCierre ? `De ${nC} que revisaste, ${fraseCierre}.` : `Revisaste ${nC} y no confirmaste ninguna.`)
              : `${nT} tarea${nT === 1 ? '' : 's'}${enProy}.`}
          </div>
          {!soloCierres && <ContextoDelBorrador texto={prop.resumen} />}
          <button onClick={() => enviar('descartar')} disabled={busy} style={{ marginTop: 14, border: 'none', background: 'transparent', color: 'var(--faint)', fontSize: 12.5, cursor: busy ? 'default' : 'pointer', textDecoration: 'underline', fontFamily: SANS }}>o descartar este borrador</button>
        </div>
      )}
    </WizardShell>
  );
}
