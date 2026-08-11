'use client';

// =============================================================================
// La tarea de un bloque, como la ve el cliente de Mauricio
// =============================================================================
// Quien entra acá es un empresario que no maneja la computadora, sin cuenta en
// MaKo, probablemente desde el teléfono y probablemente apurado. Eso manda el
// diseño entero:
//
//   · UN bloque a la vez. La lista de 42 está detrás de un renglón, no adelante.
//   · Se guarda solo. Nada de un botón «Guardar» que si no se toca pierde todo.
//   · Sin login, sin contraseña, sin nada que instalar.
//
// EL ESTADO QUE BLOQUEA ES OTRO. Cuando MaKo ya reescribió la respuesta con lo
// hablado en la junta, esto NO muestra un resumen ni un link: muestra los dos
// textos enteros, uno al lado del otro. Aprobar algo que no se leyó es aprobar
// sin leer, y la regla de la casa es explícita: el estado que bloquea muestra el
// texto completo.

import { useCallback, useEffect, useRef, useState } from 'react';
import { PortalShell } from '@/app/conocimientos/CursoPortal';

// El tipo sale de `lib/cs-tarea-vista.ts`, que es quien lo arma. Declararlo de
// nuevo acá compilaba igual —son estructuralmente idénticos— y por eso mismo el
// día que uno cambie el otro no se entera.
import type { BloqueVista } from '@/lib/cs-tarea-vista';

type Guardado = 'limpio' | 'escribiendo' | 'guardando' | 'guardado' | 'error';

const ROTULO: Record<BloqueVista['estado'], string> = {
  pendiente: 'Sin contestar',
  contestada: 'Contestada',
  revisada_ia: 'Esperando tu ok',
  aprobada: 'Lista',
};

export default function TareaCliente({
  token, nombre, bloques, inicial,
}: {
  token: string;
  nombre: string | null;
  bloques: BloqueVista[];
  /** El bloque que corresponde abrir: el que espera aprobación, o el primero sin contestar. */
  inicial: string;
}) {
  const [abiertoId, setAbiertoId] = useState(inicial);
  const [verLista, setVerLista] = useState(false);
  const [datos, setDatos] = useState<Record<string, BloqueVista>>(
    () => Object.fromEntries(bloques.map(b => [b.claseId, b])),
  );
  const bloque = datos[abiertoId] ?? bloques[0];

  const [estadoGuardado, setEstadoGuardado] = useState<Guardado>('limpio');
  const timer = useRef<ReturnType<typeof setTimeout> | null>(null);

  const mandar = useCallback(async (claseId: string, texto: string, accion: 'guardar' | 'aprobar') => {
    setEstadoGuardado('guardando');
    try {
      const r = await fetch('/api/compartido/tarea', {
        method: 'POST',
        headers: { 'content-type': 'application/json' },
        body: JSON.stringify({ token, claseId, texto, accion }),
      });
      if (!r.ok) throw new Error(String(r.status));
      const j = await r.json() as { estado: BloqueVista['estado'] };
      setDatos(d => ({ ...d, [claseId]: { ...d[claseId], respuesta: texto, estado: j.estado } }));
      setEstadoGuardado('guardado');
    } catch {
      // Que se VEA. Acaba de escribir algo a mano: dejarlo creer que quedó
      // guardado es la peor forma de fallar acá.
      setEstadoGuardado('error');
    }
  }, [token]);

  // Autosave con freno. Un POST por tecla es ruido; dos segundos de quietud es
  // lo que separa «terminó de escribir una idea» de «está pensando».
  const alEscribir = (texto: string) => {
    setDatos(d => ({ ...d, [bloque.claseId]: { ...d[bloque.claseId], respuesta: texto } }));
    setEstadoGuardado('escribiendo');
    if (timer.current) clearTimeout(timer.current);
    timer.current = setTimeout(() => { void mandar(bloque.claseId, texto, 'guardar'); }, 2000);
  };

  // Si cierra la pestaña con algo sin mandar, se manda igual. `keepalive` es lo
  // que hace que el request sobreviva a la navegación.
  useEffect(() => {
    const alSalir = () => {
      if (estadoGuardado !== 'escribiendo') return;
      navigator.sendBeacon?.(
        '/api/compartido/tarea',
        new Blob([JSON.stringify({ token, claseId: bloque.claseId, texto: bloque.respuesta, accion: 'guardar' })],
          { type: 'application/json' }),
      );
    };
    window.addEventListener('pagehide', alSalir);
    return () => window.removeEventListener('pagehide', alSalir);
  }, [estadoGuardado, token, bloque]);

  useEffect(() => { window.scrollTo({ top: 0, behavior: 'instant' as ScrollBehavior }); }, [abiertoId, verLista]);

  const hechos = bloques.filter(b => datos[b.claseId]?.estado === 'aprobada').length;

  return (
    <PortalShell
      marca={
        <span className="al-brand">
          <span className="b">Tu <span>tarea</span></span>
          <span className="sub">{nombre ? `${nombre} · ` : ''}Sistema Negocio que Escala</span>
        </span>
      }
      tag={<span className="al-toptag">{hechos} de {bloques.length} listas</span>}
    >
      <style dangerouslySetInnerHTML={{ __html: CSS }} />

      {verLista ? (
        <div className="tc">
          <button className="tc-volver" onClick={() => setVerLista(false)}>← Volver a la tarea</button>
          <ul className="tc-lista">
            {bloques.map(b => {
              const d = datos[b.claseId];
              return (
                <li key={b.claseId}>
                  <button
                    className={`tc-fila${b.claseId === abiertoId ? ' es' : ''}`}
                    onClick={() => { setAbiertoId(b.claseId); setVerLista(false); }}
                  >
                    <span className="t">{b.rotulo}</span>
                    <span className={`p e-${d?.estado ?? 'pendiente'}`}>{ROTULO[d?.estado ?? 'pendiente']}</span>
                  </button>
                </li>
              );
            })}
          </ul>
        </div>
      ) : (
        <div className="tc">
          <button className="tc-volver" onClick={() => setVerLista(true)}>Ver los {bloques.length} bloques</button>

          <p className="tc-mod">{bloque.modulo}</p>
          <h1 className="tc-h1">{bloque.rotulo.replace(/^[\d.]+\s·\s/, '')}</h1>
          <p className="tc-preg">{bloque.pregunta}</p>
          {bloque.atoro && <p className="tc-ojo"><b>Ojo con esto.</b> {bloque.atoro}</p>}
          {bloque.quienContesta !== 'dueño' && (
            <p className="tc-ojo">Este bloque lo contesta <b>el líder del área</b>, no el dueño.</p>
          )}

          {bloque.estado === 'revisada_ia' && bloque.respuestaIa ? (
            <Aprobar
              bloque={bloque}
              onAprobar={(texto) => void mandar(bloque.claseId, texto, 'aprobar')}
              guardando={estadoGuardado === 'guardando'}
            />
          ) : (
            <>
              <textarea
                className="tc-area"
                value={bloque.respuesta}
                onChange={(e) => alEscribir(e.target.value)}
                placeholder="Escribí acá. Se guarda solo."
                rows={14}
                autoFocus
              />
              <p className={`tc-est e-${estadoGuardado}`}>
                {estadoGuardado === 'guardado' && 'Guardado.'}
                {estadoGuardado === 'guardando' && 'Guardando…'}
                {estadoGuardado === 'escribiendo' && 'Se guarda solo en unos segundos.'}
                {estadoGuardado === 'error' && 'No se pudo guardar. Revisá la conexión y tocá afuera del recuadro.'}
                {estadoGuardado === 'limpio' && 'Se guarda solo mientras escribís.'}
              </p>
            </>
          )}
        </div>
      )}

      <p className="al-shared-ft">Enlace privado · MaKo</p>
    </PortalShell>
  );
}

/** Los DOS textos enteros. Nada de resumen ni de link: aprobar lo que no se leyó
 *  es aprobar sin leer. Y los botones nombran su acción y su objeto, nunca «Sí»
 *  o «Aceptar» a secas. */
function Aprobar({ bloque, onAprobar, guardando }: {
  bloque: BloqueVista; onAprobar: (texto: string) => void; guardando: boolean;
}) {
  const [texto, setTexto] = useState(bloque.respuestaIa ?? '');
  return (
    <div className="tc-apr">
      <p className="tc-apr-int">
        Después de la junta, MaKo reescribió tu respuesta con lo que hablaron. Comparala con
        la tuya y quedate con la que prefieras. Podés editarla antes de aprobar.
      </p>

      <div className="tc-dos">
        <section>
          <h2>Lo que escribiste vos</h2>
          <div className="tc-txt">{bloque.respuesta || <em>Estaba vacío.</em>}</div>
        </section>
        <section>
          <h2>Lo que propone MaKo</h2>
          <textarea className="tc-area chico" value={texto} onChange={(e) => setTexto(e.target.value)} rows={12} />
        </section>
      </div>

      <div className="tc-btns">
        <button className="tc-ok" disabled={guardando} onClick={() => onAprobar(texto)}>
          {guardando ? 'Guardando…' : 'Aprobar este texto'}
        </button>
        <button className="tc-no" disabled={guardando} onClick={() => onAprobar(bloque.respuesta)}>
          Dejar el mío
        </button>
      </div>
      <p className="tc-cons">Lo que apruebes queda como la respuesta final de este bloque.</p>
    </div>
  );
}

const CSS = `
.tc{ max-width:760px; margin:0 auto; padding:8px 0 48px; }
.tc-volver{ background:none; border:0; padding:6px 0; font-family:var(--mono); font-size:11px;
  letter-spacing:.1em; text-transform:uppercase; color:var(--ink-40); cursor:pointer; }
.tc-volver:hover{ color:var(--ink); }
.tc-mod{ font-family:var(--mono); font-size:11px; letter-spacing:.11em; text-transform:uppercase;
  color:var(--ink-40); margin:18px 0 6px; }
.tc-h1{ font-family:var(--disp); font-weight:800; font-size:clamp(26px,4.4vw,38px); letter-spacing:-.03em;
  line-height:1.08; margin:0 0 14px; }
.tc-preg{ font-size:17px; line-height:1.55; margin:0 0 16px; }
.tc-ojo{ border-left:2px solid var(--lime-ink); padding:8px 0 8px 14px; margin:0 0 16px;
  font-size:14.5px; line-height:1.5; color:var(--ink-70); }
.tc-area{ width:100%; box-sizing:border-box; padding:16px; font:inherit; font-size:16px; line-height:1.6;
  border:1px solid var(--ink-15); border-radius:10px; background:var(--surface); color:var(--ink);
  resize:vertical; }
.tc-area:focus{ outline:none; border-color:var(--ink-40); }
.tc-area.chico{ font-size:15px; }
.tc-est{ font-family:var(--mono); font-size:11px; letter-spacing:.07em; color:var(--ink-40); margin:8px 0 0; }
.tc-est.e-error{ color:var(--bad, #C0392B); }
.tc-est.e-guardado{ color:var(--lime-ink); }

.tc-lista{ list-style:none; margin:18px 0 0; padding:0; }
.tc-fila{ width:100%; display:flex; justify-content:space-between; align-items:center; gap:12px;
  background:none; border:0; border-bottom:1px solid var(--ink-15); padding:13px 2px; text-align:left;
  font:inherit; cursor:pointer; }
.tc-fila:hover{ background:var(--ink-05, rgba(0,0,0,.03)); }
.tc-fila.es .t{ font-weight:700; }
.tc-fila .t{ font-size:15px; line-height:1.35; }
.tc-fila .p{ flex:none; font-family:var(--mono); font-size:10px; letter-spacing:.09em;
  text-transform:uppercase; color:var(--ink-40); }
.tc-fila .p.e-aprobada{ color:var(--lime-ink); }
.tc-fila .p.e-revisada_ia{ color:var(--mako, #B8860B); }

.tc-apr-int{ font-size:15px; line-height:1.55; color:var(--ink-70); margin:0 0 18px; }
.tc-dos{ display:grid; gap:20px; grid-template-columns:1fr; }
@media(min-width:820px){ .tc-dos{ grid-template-columns:1fr 1fr; } }
.tc-dos h2{ font-family:var(--mono); font-size:10.5px; letter-spacing:.11em; text-transform:uppercase;
  color:var(--ink-40); margin:0 0 8px; font-weight:600; }
.tc-txt{ white-space:pre-wrap; font-size:15px; line-height:1.6; padding:16px; border-radius:10px;
  background:var(--ink-05, rgba(0,0,0,.03)); color:var(--ink-70); }
.tc-btns{ display:flex; flex-wrap:wrap; gap:10px; margin:22px 0 0; }
.tc-ok, .tc-no{ font:inherit; font-size:15px; font-weight:600; padding:12px 20px; border-radius:9px; cursor:pointer; }
.tc-ok{ background:var(--ink); color:var(--surface); border:1px solid var(--ink); }
.tc-no{ background:none; color:var(--ink); border:1px solid var(--ink-15); }
.tc-ok:disabled, .tc-no:disabled{ opacity:.5; cursor:default; }
.tc-cons{ font-size:13.5px; line-height:1.5; color:var(--ink-70); margin:10px 0 0; }
`;
