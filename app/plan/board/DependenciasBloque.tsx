'use client';

// =============================================================================
// DependenciasBloque — «esto no puede empezar hasta que aquello termine»
// =============================================================================
// El bloque que va adentro del detalle de una tarea y del de un proyecto. Uno solo para
// los dos niveles: la anatomía es idéntica y mantener dos copias es garantizar que
// diverjan (es la regla de `.mk-fila` de AGENTS.md aplicada acá).
//
// Dibuja UNA sola lista: «Depende de» — qué frena a esto y por eso no se puede empezar hoy.
//
// ⚠️ ACÁ HABÍA UNA SEGUNDA LISTA, «DESTRABA A», Y LO QUE SE FUE ES LA LISTA, NO LA FEATURE.
// «La parte de "Depende de" debería ser solo depende de, nada de "destraba"» (25/09/2026).
// «Destraba a» era la vista INVERSA de la misma arista: las dos salían del MISMO
// `deps[]`, una filtrando por `deId` y la otra por `aId`. Sacar el render no toca ni una
// arista, así que la herencia de urgencia sigue viva y sigue moviendo el ranking:
//
//   · la urgencia heredada la calcula `resolverDeps` en `dependencias.ts`
//     (`u(A) = max(score(A), max{ u(B) : B espera a A }`) y sale en `EstadoDeps.urgencia`,
//     que es lo que come `curveTaskScores`. No mira esta pantalla ni sabe que existe.
//   · el candado del Kanban y la exclusión de Prioridades salen de `bloqueantes`, del
//     mismo resolvedor.
//
// O sea: si mañana una tarjeta sube de prioridad «sin motivo», el motivo puede seguir
// siendo que destraba algo grande — se ve en `score_razon`, ya no en una lista de acá.
//
// Y la arista NO queda huérfana al sacar la lista inversa: toda arista se dibuja, con su
// ×, en el detalle del que ESPERA. Desde el otro extremo nunca fue el único camino para
// borrarla, sólo el segundo.
// =============================================================================

import { useMemo, useState, type CSSProperties } from 'react';
import { type Dep, type ClaseDep, type EntidadDep, puedeDepender } from './dependencias';
import { LapizPrioridad } from './PrioridadAMano';

const SANS = "'Geist', sans-serif";
const MONO = "'Geist Mono', monospace";

/**
 * EL RÓTULO DE LA SECCIÓN, IDÉNTICO AL DE LOS CAMPOS DE AL LADO.
 *
 * «Que se vea como en las tareas» (25/09/2026). Este bloque vive en la columna derecha de
 * los dos detalles, pegado arriba de PROYECTOS, y hasta hoy se rotulaba distinto que sus
 * vecinos (11px / .14em / --dim / bold contra 10px / .08em / --faint). Dos cosas del mismo
 * rango en la misma columna no pueden verse distinto.
 *
 * ⚠️ ES UNA COPIA DE `rowLabel` (BoardShell.tsx), valor por valor, y no un import porque
 * ahí es una `const` de módulo sin exportar. Si alguno de los dos cambia, cambian los dos
 * — o vuelve la discordancia que este bloque acaba de pagar.
 */
const rotuloSeccion: CSSProperties = {
  fontFamily: MONO, fontSize: 10, letterSpacing: '.08em', textTransform: 'uppercase',
  color: 'var(--faint)', display: 'inline-flex', alignItems: 'center', gap: 2,
};

export type Candidato = { id: string; titulo: string; sub?: string; terminado?: boolean };

export function DependenciasBloque({ entidad, id, deps, candidatos, impacto, onAdd, onDel }: {
  entidad: EntidadDep;
  id: string;
  deps: Dep[];
  /** todo lo que se puede elegir del MISMO nivel, sin incluirse a sí mismo */
  candidatos: Candidato[];
  /** una frase con el RADIO de la escritura, para decirlo ANTES del click. */
  impacto?: (aId: string) => string;
  onAdd: (d: { entidad: EntidadDep; deId: string; aId: string; clase: ClaseDep; razon: string }) => Promise<{ ok: boolean; error?: string; camino?: string[] }>;
  onDel: (entidad: EntidadDep, deId: string, aId: string) => Promise<void> | void;
}) {
  const [abriendo, setAbriendo] = useState(false);
  const [q, setQ] = useState('');
  const [clase, setClase] = useState<ClaseDep>('bloquea');
  const [razon, setRazon] = useState('');
  const [elegido, setElegido] = useState<string | null>(null);
  const [error, setError] = useState('');
  const [guardando, setGuardando] = useState(false);

  // Sólo la dirección «yo espero a…». El filtro inverso (`d.aId === id`) ya no se calcula
  // acá: lo que ESTO destraba lo resuelve `resolverDeps`, no esta pantalla (ver cabecera).
  const espera = deps.filter((d) => d.entidad === entidad && d.deId === id);
  const nombre = (x: string) => candidatos.find((c) => c.id === x)?.titulo ?? x;
  const listo = (x: string) => candidatos.find((c) => c.id === x)?.terminado ?? false;

  // Los candidatos que cerrarían un círculo salen DESHABILITADOS con el motivo al lado, no
  // escondidos: esconderlos es no decir por qué, y el dueño se queda buscando una opción
  // que existe y no aparece.
  const opciones = useMemo(() => {
    const yaPuestos = new Set(espera.map((d) => d.aId));
    const t = q.trim().toLowerCase();
    return candidatos
      .filter((c) => c.id !== id && !yaPuestos.has(c.id))
      .filter((c) => !t || c.titulo.toLowerCase().includes(t) || (c.sub ?? '').toLowerCase().includes(t))
      .map((c) => ({ ...c, ciclo: !puedeDepender(deps, entidad, id, c.id).ok }))
      .slice(0, 40);
  }, [candidatos, deps, entidad, id, q, espera]);

  const guardar = async () => {
    if (!elegido) return;
    setGuardando(true); setError('');
    const r = await onAdd({ entidad, deId: id, aId: elegido, clase, razon: razon.trim() });
    setGuardando(false);
    if (!r.ok) { setError(r.error || 'No se pudo guardar.'); return; }
    setAbriendo(false); setElegido(null); setRazon(''); setQ(''); setClase('bloquea');
  };

  const Fila = ({ d }: { d: Dep }) => {
    const hecho = listo(d.aId);
    // ⚠️ EL ÍCONO LLEVA SU FRASE EN EL `title`, NO EN UN RENGLÓN PROPIO. «Van juntas — no
    // frena el arranque» se dibujaba como una línea más debajo de cada fila `ordena`: una
    // glosa enlatada, repetida por fila, que es justo el «texto innecesario» que el dueño
    // pidió sacar (25/09/2026). El significado no se perdió —ahora los TRES estados lo
    // dicen al pasar por encima, que antes no hacía ninguno—; lo que se fue es el renglón.
    const senal = d.clase === 'ordena'
      ? { glifo: '↔', que: 'Van juntas — no frena el arranque' }
      : hecho
        ? { glifo: '✓', que: 'Ya está terminada — no frena nada' }
        : { glifo: '🔒', que: 'Todavía no está terminada — frena a esto' };
    return (
      <div style={{ display: 'flex', alignItems: 'flex-start', gap: 8, padding: '7px 0', borderTop: '1px solid var(--border)' }}>
        <span title={senal.que} style={{ flex: 'none', fontSize: 12, marginTop: 1 }}>{senal.glifo}</span>
        <div style={{ flex: 1, minWidth: 0 }}>
          <div style={{ fontSize: 13, color: hecho ? 'var(--dim)' : 'var(--ink)', textDecoration: hecho ? 'line-through' : 'none', wordBreak: 'break-word' }}>{nombre(d.aId)}</div>
          {/* La razón es lo único que hace auditable la arista a las seis semanas: sin
              ella, el candado solo puede decir «falta terminarla» y nadie sabe por qué
              existe el vínculo. NO es «texto innecesario»: no es un rótulo nuestro, es lo
              que escribió la persona que creó el vínculo. */}
          {d.razon && <div style={{ fontSize: 11.5, color: 'var(--faint)', fontStyle: 'italic', marginTop: 2 }}>{d.razon}</div>}
        </div>
        <button onClick={() => void onDel(entidad, d.deId, d.aId)} title="Sacar esta dependencia" aria-label="Sacar esta dependencia"
          style={{ flex: 'none', border: 'none', background: 'transparent', cursor: 'pointer', color: 'var(--faint)', fontSize: 15, lineHeight: 1, padding: '0 2px' }}>×</button>
      </div>
    );
  };

  return (
    <div style={{ fontFamily: SANS }}>
      {/* ⚠️ EL LÁPIZ VA PEGADO AL RÓTULO, ADENTRO DEL `<label>`. «En lugar de "Agregar" en
          depende de, el botón del lápiz» (25/09/2026). Es EL MISMO `LapizPrioridad` que
          dibuja «PROYECTOS ✎» dos campos más abajo, con el mismo `tam={20}` — no una copia
          con otra cara: un control que significa «editá esto» tiene que verse igual en
          todos lados. Y no va con `flex: 1` en el medio: colgado del borde de la columna
          queda flotando lejos de lo que edita, que es el error que PROYECTOS ya pagó dos
          veces el mismo día.
          El `titulo` viaja a `title` Y a `aria-label`: un botón cuyo único contenido es un
          ícono se anuncia como «botón», a secas. */}
      <label style={{ ...rotuloSeccion, marginBottom: 6 }}>
        Depende de
        {!abriendo && (
          <LapizPrioridad tam={20} onClick={() => setAbriendo(true)}
            titulo={espera.length ? 'Agregar otra dependencia' : 'Agregar una dependencia'} />
        )}
      </label>

      {/* EL VACÍO, EN UNA LÍNEA. «En lugar de "Nada la frena y no frena nada. Se puede
          empezar hoy." simplemente "No depende de ninguna tarea"» (25/09/2026). Lo que
          se fue es la segunda mitad —que ESTO tampoco frena a nadie— y la conclusión
          («se puede empezar hoy»), que el vacío ya dice solo.

          La condición ya no mira la lista inversa (antes era `espera` Y `destraba` vacías):
          esta sección muestra una sola dirección, así que «no depende de nada» es toda la
          verdad sobre lo que dibuja. Que además destrabe algo sigue siendo cierto y sigue
          contando para el ranking — ver la cabecera del archivo.

          ⚠️ EL SUSTANTIVO LO DECIDE `entidad`, no se escribe fijo: este componente es UNO
          para los dos niveles y los candidatos de un proyecto son PROYECTOS. «No depende
          de ninguna tarea» en el detalle de un proyecto sería falso sobre lo único que la
          frase afirma. */}
      {espera.length === 0 && !abriendo && (
        <div style={{ fontSize: 12.5, color: 'var(--faint)', paddingBottom: 4 }}>
          No depende de {entidad === 'proyecto' ? 'ningún proyecto' : 'ninguna tarea'}
        </div>
      )}

      {espera.map((d) => <Fila key={d.aId} d={d} />)}

      {abriendo && (
        <div style={{ marginTop: 8, border: '1px solid var(--border-strong)', borderRadius: 10, padding: 12, background: 'var(--surface-2)' }}>
          {/* La pregunta que decide la clase, en la PANTALLA y no solo en la cabeza del que
              la carga. Es la mejor forma de operacionalizar la distinción del dueño:
              «correlacionado» vs «depende absolutamente de que el anterior termine». */}
          <div style={{ fontSize: 12.5, color: 'var(--ink)', marginBottom: 8, lineHeight: 1.45 }}>
            Si alguien empieza <strong>esto</strong> hoy, sin que lo otro esté terminado, ¿el trabajo que haga se tira?
          </div>
          <div style={{ display: 'flex', gap: 8, marginBottom: 10, flexWrap: 'wrap' }}>
            {([['bloquea', 'Sí — no se puede empezar antes'], ['ordena', 'No, pero van juntas']] as Array<[ClaseDep, string]>).map(([c, txt]) => (
              <button key={c} onClick={() => setClase(c)}
                style={{ border: `1px solid ${clase === c ? 'var(--primary)' : 'var(--border-strong)'}`, background: clase === c ? 'color-mix(in srgb, var(--primary) 10%, transparent)' : 'var(--surface)', color: clase === c ? 'var(--primary)' : 'var(--dim)', borderRadius: 9, padding: '6px 11px', cursor: 'pointer', fontFamily: SANS, fontSize: 12.5, fontWeight: 600 }}>{txt}</button>
            ))}
          </div>

          <input value={q} onChange={(e) => setQ(e.target.value)} placeholder={entidad === 'proyecto' ? 'Buscar un proyecto…' : 'Buscar una tarea…'}
            style={{ width: '100%', padding: '8px 12px', borderRadius: 9, border: '1px solid var(--border-strong)', background: 'var(--surface)', color: 'var(--ink)', fontSize: 13.5, outline: 'none', fontFamily: SANS, marginBottom: 8 }} />

          {/* Con tope de alto y scroll VISIBLE: un menú con overflow:hidden clipea sus
              últimas filas en silencio, que es la regla 4 de layout de AGENTS.md. */}
          <div className="mk-scroll-x" style={{ maxHeight: 210, overflowY: 'auto', border: '1px solid var(--border)', borderRadius: 8 }}>
            {opciones.length === 0 && <div style={{ padding: 10, fontSize: 12.5, color: 'var(--faint)' }}>No hay nada más para elegir.</div>}
            {opciones.map((c) => (
              <button key={c.id} disabled={c.ciclo} onClick={() => setElegido(c.id)} title={c.ciclo ? 'No se puede: eso ya espera a esto. Sería un círculo.' : ''}
                style={{ display: 'block', width: '100%', textAlign: 'left', border: 'none', borderBottom: '1px solid var(--border)', background: elegido === c.id ? 'color-mix(in srgb, var(--primary) 10%, transparent)' : 'transparent', padding: '8px 11px', cursor: c.ciclo ? 'not-allowed' : 'pointer', opacity: c.ciclo ? 0.45 : 1, fontFamily: SANS }}>
                <div style={{ fontSize: 13, color: 'var(--ink)', wordBreak: 'break-word' }}>{c.titulo}</div>
                <div style={{ fontSize: 11, color: 'var(--faint)' }}>{c.ciclo ? 'Ya espera a esto — sería un círculo' : (c.sub ?? '')}</div>
              </button>
            ))}
          </div>

          <input value={razon} onChange={(e) => setRazon(e.target.value)} placeholder="¿Qué produce lo otro que esto necesita?"
            style={{ width: '100%', padding: '8px 12px', borderRadius: 9, border: '1px solid var(--border-strong)', background: 'var(--surface)', color: 'var(--ink)', fontSize: 13, outline: 'none', fontFamily: SANS, margin: '8px 0' }} />

          {/* La consecuencia de lo irreversible va PEGADA al botón, en tinta normal y
              antes del click: una dependencia de proyecto frena decenas de tarjetas de un
              saque, y es la escritura de mayor palanca de todo el tablero. */}
          {elegido && impacto?.(elegido) && (
            <div style={{ fontSize: 12.5, color: 'var(--ink)', marginBottom: 8 }}>{impacto(elegido)}</div>
          )}
          {error && <div style={{ fontSize: 12.5, color: 'var(--bad, #C0392B)', marginBottom: 8 }}>{error}</div>}

          {/* `wrap` porque este bloque vive en la columna derecha de los DOS detalles
              (`COL_DER` en BoardShell.tsx, 264px desde el 25/09 — el número sale de medir
              justo el botón más largo de acá abajo): sin él los dos botones encogen y
              parten su propia etiqueta en dos renglones. Un layout se prueba con el ancho
              más angosto donde va a vivir, y acá el `wrap` es la red por si el cálculo
              falla por unos píxeles. */}
          <div style={{ display: 'flex', gap: 8, flexWrap: 'wrap' }}>
            {/* Cada botón nombra su acción y su objeto — nada de «Aceptar» / «Cancelar». */}
            <button disabled={!elegido || guardando} onClick={() => void guardar()}
              style={{ border: 'none', background: elegido ? 'var(--primary)' : 'var(--border-strong)', color: '#fff', borderRadius: 9, padding: '8px 14px', cursor: elegido ? 'pointer' : 'not-allowed', fontFamily: SANS, fontSize: 13, fontWeight: 700 }}>
              {guardando ? 'Guardando…' : clase === 'bloquea' ? 'Marcar que espera a esto' : 'Marcar que van juntas'}
            </button>
            <button onClick={() => { setAbriendo(false); setElegido(null); setError(''); }}
              style={{ border: '1px solid var(--border-strong)', background: 'var(--surface)', color: 'var(--dim)', borderRadius: 9, padding: '8px 14px', cursor: 'pointer', fontFamily: SANS, fontSize: 13, fontWeight: 600 }}>No agregar nada</button>
          </div>
        </div>
      )}
    </div>
  );
}
