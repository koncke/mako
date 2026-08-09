'use client';

// =============================================================================
// RevisarPropuesta — el dueño O el cliente responde el borrador de MaKo, de a 1
// =============================================================================
// SOLO wizard (WizardShell), nada de editor: preguntas de a UNA (ChoiceBody) →
// bajas sugeridas (checkbox, si hay) → confirmar. Al crear, las tareas las prioriza
// y describe el PERRO (nadie toca la prioridad a mano acá) y la revisión final se ve
// en el plan (modal "MaKo cargó tareas"). Las respuestas viajan como CONTEXTO al Perro.

import { useState, useEffect, type CSSProperties } from 'react';
import { WizardShell } from '../../../_components/WizardShell';
import { PreguntaCampo } from '../../board/guardian-form';
import { FilaCandidata, type FilaTarea } from '../../board/ReunionTareas';
import { ayudaDePregunta } from '@/lib/preguntas-contrato';
import type { Propuesta, PropuestaPregunta } from '@/lib/plan-propuesta';

/** Una tarea propuesta por el Perro a partir de las respuestas, con su estado en la UI. */
type TareaExtraUI = { titulo: string; detalle: string; porQue: string; incluir: boolean };

const SANS = "'Geist', sans-serif";
const MONO = "'Geist Mono', monospace";

// Loader mientras MaKo genera las repreguntas dinámicas — un spinner, NO el input.
function DynLoader({ texto = 'Analizando tus respuestas para profundizar…', sub }: { texto?: string; sub?: string }) {
  return (
    <div style={{ display: 'flex', flexDirection: 'column', alignItems: 'center', gap: 14, padding: '18px 0' }}>
      <style>{'@keyframes mkSpin{to{transform:rotate(360deg)}}'}</style>
      <div style={{ width: 32, height: 32, borderRadius: '50%', border: '3px solid var(--border)', borderTopColor: 'var(--primary)', animation: 'mkSpin .8s linear infinite' }} />
      <span style={{ fontSize: 13, color: 'var(--dim)' }}>{texto}</span>
      {sub && <span style={{ fontSize: 12.5, color: 'var(--faint)', lineHeight: 1.5, maxWidth: 340, textAlign: 'center' }}>{sub}</span>}
    </div>
  );
}

/**
 * DE QUÉ TAREA HABLA. Sin esto, una pregunta perfectamente sana sobre la tarea 14 de un
 * lote de 20 se lee como una pregunta al azar — y es la mitad de por qué las preguntas
 * "no tienen sentido". El modal del board ya usaba `sobre` para filtrar; acá no se
 * mostraba en ningún lado.
 */
function SobreQue({ sobre }: { sobre?: string[] }) {
  if (!sobre?.length) return null;
  return (
    <div style={{ display: 'flex', flexWrap: 'wrap', gap: 6, justifyContent: 'center', marginBottom: 4 }}>
      {sobre.slice(0, 4).map((t) => (
        <span key={t} title={t} style={{ maxWidth: 260, overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap', fontSize: 11.5, fontWeight: 600, color: 'var(--dim)', background: 'var(--surface-2)', border: '1px solid var(--border)', borderRadius: 999, padding: '3px 10px' }}>{t}</span>
      ))}
    </div>
  );
}

// El cuerpo de la pregunta lo dibuja `PreguntaCampo` (app/plan/board/guardian-form.tsx),
// el MISMO componente que usa el modal de reuniones del board. Antes cada pantalla tenía
// su propia versión y la misma pregunta se veía distinta según por dónde entraras.

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
type Step = { kind: 'cerrar'; i: number } | { kind: 'q'; i: number } | { kind: 'dyn'; i: number } | { kind: 'extra' } | { kind: 'confirm' };

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
  const [resp, setResp] = useState<Record<number, string>>({});
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState('');
  const [done, setDone] = useState<'' | 'aplicada' | 'descartada'>('');
  // Formulario DINÁMICO: tras las preguntas iniciales, MaKo genera repreguntas de
  // contexto según lo respondido. Se piden UNA vez (dynFetched) y se insertan como pasos.
  const [dynQs, setDynQs] = useState<PropuestaPregunta[]>([]);
  const [dynResp, setDynResp] = useState<Record<number, string>>({});
  const [dynFetched, setDynFetched] = useState(false);
  const [dynLoading, setDynLoading] = useState(false);
  /** Las tareas que SALIERON de lo que contestó. Nacen tildadas —el Perro las propuso
   *  desde sus propias palabras— pero se destildan con un clic, y el contexto se corrige
   *  ahí mismo. Es el mismo trato que las tareas de una reunión. */
  const [extras, setExtras] = useState<TareaExtraUI[]>([]);
  const [extrasFetched, setExtrasFetched] = useState(false);
  const [extrasLoading, setExtrasLoading] = useState(false);
  /** Respuesta por cierre: 'si' cierra, 'medias' sube el avance y suma la evidencia,
   *  'no' no toca nada. Sin responder = 'no': el default nunca cierra sola. */
  const [cierreResp, setCierreResp] = useState<Record<number, 'si' | 'medias' | 'no'>>({});
  // Persistencia (#2): si te salís del form y volvés al link, retomás donde ibas
  // (respuestas + repreguntas dinámicas incluidas). Vive en localStorage por propuesta.
  const LS_KEY = `mako.revisar.${prop.id}`;
  useEffect(() => {
    try {
      const raw = localStorage.getItem(LS_KEY);
      if (!raw) return;
      const s = JSON.parse(raw) as { paso?: number; resp?: Record<number, string>; dynQs?: PropuestaPregunta[]; dynResp?: Record<number, string>; dynFetched?: boolean; extras?: TareaExtraUI[]; extrasFetched?: boolean };
      if (Array.isArray(s.dynQs)) setDynQs(s.dynQs);
      if (s.dynResp) setDynResp(s.dynResp);
      if (s.dynFetched) setDynFetched(true);
      if (Array.isArray(s.extras)) setExtras(s.extras);
      if (s.extrasFetched) setExtrasFetched(true);
      if (s.resp) setResp(s.resp);
      if (typeof s.paso === 'number') setPaso(s.paso);
    } catch { /* ignore */ }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);
  useEffect(() => {
    // Las tareas extra van al localStorage como todo lo demás: son trabajo del dueño
    // (las destildó, les corrigió el texto) y un F5 no puede tirarlo.
    try { localStorage.setItem(LS_KEY, JSON.stringify({ paso, resp, dynQs, dynResp, dynFetched, extras, extrasFetched })); } catch { /* ignore */ }
  }, [LS_KEY, paso, resp, dynQs, dynResp, dynFetched, extras, extrasFetched]);
  const irPlan = () => { window.location.href = '/plan'; };
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
    ...prop.preguntas.map((_, i) => ({ kind: 'q' as const, i })),
    ...dynQs.map((_, i) => ({ kind: 'dyn' as const, i })),
    // El paso de las tareas que SALIERON de las respuestas. Solo aparece si el Perro
    // encontró alguna: un paso vacío que diga «no hay nada» es un clic de más.
    ...(extras.length ? [{ kind: 'extra' as const }] : []),
    { kind: 'confirm' as const },
  ];
  const cur = steps[Math.min(paso, steps.length - 1)];
  const esUltimo = paso >= steps.length - 1;
  const nExtra = extras.filter((e) => e.incluir).length;

  /** Todas las respuestas dadas, en el formato que espera el server. */
  const respuestasDadas = () => [
    ...prop.preguntas.map((q, i) => ({ pregunta: q.pregunta, respuesta: (resp[i] || '').trim() })),
    ...dynQs.map((q, i) => ({ pregunta: q.pregunta, respuesta: (dynResp[i] || '').trim() })),
  ].filter((r) => r.respuesta);

  // Avanzar. Dos cosas pasan solas al terminar de contestar, y en este orden:
  //   1. al salir de la ÚLTIMA pregunta inicial → las repreguntas dinámicas;
  //   2. al salir de la última pregunta DE TODAS → las tareas que salieron de lo
  //      contestado. Una «idea» tirada por WhatsApp casi nunca es una tarea: es un
  //      proyecto, y los pasos que faltan recién aparecen cuando el dueño contesta.
  const avanzar = async () => {
    const enUltimaInicial = cur.kind === 'q' && cur.i === prop.preguntas.length - 1;
    if (enUltimaInicial && !dynFetched && prop.preguntas.length > 0) {
      setDynLoading(true);
      try {
        const r = await fetch('/api/plan-propuesta', { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify({ action: 'profundizar', id: prop.id, respuestas: respuestasDadas() }) }).then((x) => x.json());
        if (r?.ok && Array.isArray(r.preguntas) && r.preguntas.length) { setDynQs(r.preguntas as PropuestaPregunta[]); setDynFetched(true); setDynLoading(false); setPaso((p) => p + 1); return; }
      } catch { /* sin repreguntas: seguimos */ }
      setDynFetched(true); setDynLoading(false);
    }
    // ¿Es la última pregunta que queda? Entonces toca buscar las tareas nuevas.
    const ultimaPregunta = (cur.kind === 'dyn' && cur.i === dynQs.length - 1)
      || (cur.kind === 'q' && cur.i === prop.preguntas.length - 1 && dynQs.length === 0);
    if (ultimaPregunta && !extrasFetched) {
      setExtrasFetched(true);
      const dadas = respuestasDadas();
      if (dadas.length) {
        setExtrasLoading(true);
        try {
          const r = await fetch('/api/plan-propuesta', { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify({ action: 'tareas-extra', id: prop.id, respuestas: dadas }) }).then((x) => x.json());
          if (r?.ok && Array.isArray(r.tareas) && r.tareas.length) {
            setExtras((r.tareas as Array<{ titulo: string; detalle: string; porQue: string }>).map((t) => ({ ...t, incluir: true })));
          }
        } catch { /* sin extras: seguimos */ } finally { setExtrasLoading(false); }
      }
    }
    setPaso((p) => p + 1);
  };

  const enviar = async (action: 'aplicar' | 'descartar') => {
    setBusy(true); setError('');
    try {
      // El contexto para el Perro junta las respuestas iniciales + las dinámicas.
      const contexto = [
        ...prop.preguntas.map((q, i) => (resp[i]?.trim() ? `${q.pregunta} → ${resp[i].trim()}` : null)),
        ...dynQs.map((q, i) => (dynResp[i]?.trim() ? `${q.pregunta} → ${dynResp[i].trim()}` : null)),
      ].filter(Boolean).join('\n');
      const cerrarIds = cierres.filter((_, i) => cierreResp[i] === 'si').map((c) => c.id);
      const aMediasIds = cierres.filter((_, i) => cierreResp[i] === 'medias').map((c) => c.id);
      // Las del borrador MÁS las que salieron de las respuestas y quedaron tildadas.
      // Van juntas y en una sola lista: el Perro las puntúa y las rutea en la misma
      // pasada, así que una tarea que apareció recién compite de igual a igual con las
      // que ya venían — que es justamente el punto de que las decida él.
      const tareas = action === 'aplicar' && nExtra
        ? [...mias, ...extras.filter((e) => e.incluir).map((e) => ({ titulo: e.titulo, detalle: e.detalle }))]
        : undefined;
      const body = action === 'aplicar' ? { action, id: prop.id, contexto, cerrarIds, aMediasIds, ...(tareas ? { tareas } : {}) } : { action, id: prop.id };
      const r = await fetch('/api/plan-propuesta', { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify(body) }).then((res) => res.json());
      if (!r.ok) { setError(r.error || 'No se pudo.'); setBusy(false); return; }
      try { localStorage.removeItem(LS_KEY); } catch { /* ignore */ } // ya se aplicó/descartó
      setDone(action === 'aplicar' ? 'aplicada' : 'descartada');
      setTimeout(irPlan, 1300);
    } catch (e) { setError(e instanceof Error ? e.message : 'Error de red.'); setBusy(false); }
  };

  if (prop.estado !== 'pendiente') return <Mensaje texto={`Este borrador ya fue ${prop.estado}.`} />;
  // Todo lo que queda es de OTRAS personas: no hay nada que crear acá. Se dice y se
  // manda al plan, donde el modal de la reunión sí tiene el reparto por persona.
  // Vacío de verdad = ni tareas ni cierres. Antes alcanzaba con no tener tareas.
  if (nT === 0 && nC === 0) {
    return <Mensaje ok texto={nAjenas ? `Acá no te queda nada para crear: ${nAjenas === 1 ? 'la tarea que quedaba es' : `las ${nAjenas} tareas que quedaban son`} de otras personas.` : 'Este borrador ya no tiene tareas.'}
      sub="Repartilas desde tu plan: ahí MaKo te deja mandárselas a cada uno." link />;
  }
  if (done) {
    const hecho = soloCierres
      ? (fraseCierre ? `✓ Listo: ${fraseCierre}` : '✓ No cambié nada en tu tablero')
      : `✓ Creé ${nT} tarea${nT === 1 ? '' : 's'}${enProy}`;
    return <Mensaje ok texto={done === 'aplicada' ? hecho : '✓ Borrador descartado'} sub="Te llevo al plan…" />;
  }

  const totalCrear = nT + nExtra;
  const crearLabel = !soloCierres ? `Crear ${totalCrear}`
    : nSi ? `Cerrar ${nSi}`
    : nMedias ? `Guardar el avance de ${nMedias}`
      : 'Listo';
  const pregunta = cur.kind === 'cerrar' ? `¿«${cierres[cur.i]?.titulo || 'esta tarea'}» ya está hecha?`
    : cur.kind === 'q' ? (prop.preguntas[cur.i]?.pregunta || '…')
    : cur.kind === 'dyn' ? (dynQs[cur.i]?.pregunta || '…')
    : cur.kind === 'extra' ? (extras.length === 1 ? 'De lo que contestaste sale una tarea más' : `De lo que contestaste salen ${extras.length} tareas más`)
    : soloCierres ? (fraseCierre ? `Listo — ${fraseCierre}` : 'No queda nada para cerrar')
      : `Listo — creo ${totalCrear} tarea${totalCrear === 1 ? '' : 's'}${enProy}`;
  // La ayuda de abajo del enunciado SALE DEL TIPO. Estaba hardcodeada en «Elegí una
  // opción o escribí la tuya» y se mostraba igual sobre una escala del 1 al 5, donde no
  // hay ni opciones ni dónde escribir: el renglón que explica cómo contestar decía una
  // cosa y el campo mostraba otra.
  const qActual = cur.kind === 'q' ? prop.preguntas[cur.i] : cur.kind === 'dyn' ? dynQs[cur.i] : undefined;
  const sub = cur.kind === 'cerrar' ? 'La tengo en tu tablero abierta, pero encontré esto. Vos decidís.'
    : qActual ? ayudaDePregunta(qActual.tipo, qActual.opciones.length > 0)
    : cur.kind === 'extra' ? 'Destildá lo que no vaya y corregí lo que haga falta. El proyecto y la prioridad los pone el Perro.'
    : soloCierres ? 'Las que dijiste que no, quedan abiertas tal cual estaban.'
      : 'El Perro Guardián las prioriza, las describe y les arma la checklist. La revisión final la ves en el plan.';

  return (
    <WizardShell
      // UNA LÍNEA. El `resumen` puede traer la investigación entera (3.000 caracteres) y
      // acá se renderiza centrado y en mono, arriba de todo: era un muro de texto antes
      // de poder leer la pregunta. El texto completo va abajo, en ContextoDelBorrador.
      // ⚠️ `totalCrear`, NO `nT`. El encabezado contaba solo las originales y el botón
      // sumaba las que salen de las respuestas: decía «Borrador · 2 tareas» arriba y
      // «Crear 3» abajo, en la misma pantalla. Lo que se muestra es lo que se va a crear.
      titulo={soloCierres ? `Borrador · ${nC} para revisar` : `Borrador · ${totalCrear} tarea${totalCrear === 1 ? '' : 's'}${enProy}`}
      total={steps.length} idx={Math.min(paso, steps.length - 1)}
      pregunta={dynLoading || extrasLoading ? 'MaKo está pensando…' : busy ? (soloCierres ? 'Guardando…' : 'Creando…') : pregunta} sub={dynLoading || extrasLoading || busy ? undefined : sub}
      puedeAvanzar={!busy && !dynLoading && !extrasLoading} enUltimo={esUltimo} confirmLabel={crearLabel} pending={busy || dynLoading || extrasLoading}
      atrasLabel={paso === 0 ? 'Cancelar' : 'Atrás'} siguienteLabel="Siguiente →"
      error={error || undefined}
      // No se puede cerrar a mitad (sin ✕, sin backdrop): si cerrás perdés las
      // respuestas y la ejecución queda a medias sin contexto. Solo se sale creando
      // (Crear) o descartando explícito (en el paso final), o Cancelar en el paso 0.
      bloqueante
      onClose={irPlan}
      onAtras={() => (paso === 0 ? irPlan() : setPaso(paso - 1))}
      onSiguiente={avanzar}
      onConfirmar={() => enviar('aplicar')}
    >
      {dynLoading ? (
        <DynLoader texto="MaKo está mirando tus respuestas…" />
      ) : extrasLoading ? (
        <DynLoader texto="El Perro está viendo si de tus respuestas sale más trabajo…"
          sub="Una idea suelta suele ser un proyecto entero: los pasos que faltan recién aparecen cuando contestás." />
      ) : busy ? (
        /* El aplicado es LARGO de verdad: crea las tareas y después el Perro las
           puntúa por tandas. Antes acá seguía dibujándose el cuerpo del último paso y
           lo único que cambiaba era el título a «Creando…» — se veía colgado, y encima
           quedaba a la vista el link de descartar mientras ya estaba guardando. */
        <DynLoader
          texto={soloCierres ? 'Actualizando tu tablero…' : 'Creando las tareas y puntuándolas contra tu plan…'}
          sub={soloCierres ? 'Marco las que confirmaste y dejo el resto como estaba.' : 'El Perro las ubica en la pirámide y les arma la checklist. Puede tardar unos segundos.'} />
      ) : cur.kind === 'cerrar' ? (
        <><CierrePaso item={cierres[cur.i]} valor={cierreResp[cur.i]} onElegir={(v) => setCierreResp((r) => ({ ...r, [cur.i]: v }))} />
        <ContextoDelBorrador texto={prop.resumen} /></>
      ) : cur.kind === 'q' ? (
        <>
          <SobreQue sobre={prop.preguntas[cur.i]?.sobre} />
          <PreguntaCampo q={prop.preguntas[cur.i]} value={resp[cur.i] || ''} onChange={(v) => setResp((r) => ({ ...r, [cur.i]: v }))} />
          <ContextoDelBorrador texto={prop.resumen} />
        </>
      ) : cur.kind === 'dyn' ? (
        <>
          <SobreQue sobre={dynQs[cur.i]?.sobre} />
          <PreguntaCampo q={dynQs[cur.i]} value={dynResp[cur.i] || ''} onChange={(v) => setDynResp((r) => ({ ...r, [cur.i]: v }))} />
        </>
      ) : cur.kind === 'extra' ? (
        // LA MISMA FILA que el modal de una reunión (FilaCandidata): checkbox para
        // dejarla entrar o no, y «corregir contexto» para arreglar el título y el
        // detalle ahí mismo. Es la misma decisión, así que es la misma pieza.
        <div style={{ display: 'flex', flexDirection: 'column', gap: 10, textAlign: 'left' }}>
          {extras.map((e, i) => (
            <div key={i} style={{ display: 'flex', flexDirection: 'column', gap: 3 }}>
              <FilaCandidata
                f={{ titulo: e.titulo, detalle: e.detalle, prioridad: 'media', incluir: e.incluir } as FilaTarea}
                onFila={(patch) => setExtras((xs) => xs.map((x, k) => (k === i ? { ...x, ...patch } as TareaExtraUI : x)))}
                personas={[]}
              />
              {/* De qué respuesta salió. Es lo que deja verificar de un vistazo que el
                  Perro no la inventó: sin esto, una tarea que apareció sola se lee como
                  ruido y se destilda por las dudas. */}
              {e.porQue && (
                <div style={{ fontSize: 11.5, color: 'var(--faint)', lineHeight: 1.45, paddingLeft: 32 }}>↳ {e.porQue}</div>
              )}
            </div>
          ))}
        </div>
      ) : (
        <div style={{ textAlign: 'center' }}>
          <div style={{ fontSize: 14, color: 'var(--dim)', lineHeight: 1.5 }}>
            {soloCierres
              ? (fraseCierre ? `De ${nC} que revisaste, ${fraseCierre}.` : `Revisaste ${nC} y no confirmaste ninguna.`)
              : `${totalCrear} tarea${totalCrear === 1 ? '' : 's'}${enProy}.`}
          </div>
          <button onClick={() => enviar('descartar')} disabled={busy} style={{ marginTop: 14, border: 'none', background: 'transparent', color: 'var(--faint)', fontSize: 12.5, cursor: busy ? 'default' : 'pointer', textDecoration: 'underline', fontFamily: SANS }}>o descartar este borrador</button>
        </div>
      )}
    </WizardShell>
  );
}
