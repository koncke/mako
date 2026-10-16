'use client';

// =============================================================================
// /m/curso — el curso elegido, sus módulos y sus clases, y la hoja de una clase
// =============================================================================
// Lo que se hace acá: elegir el curso (la lista «Cursos» del menú de la marca de escritorio), mirar sus
// módulos y sus clases en el orden de escritorio, y en la hoja de una clase cambiarle el ACCESO
// (Público | Privado, el mismo selector del menú «…» de escritorio, con `guardarBloqueoAction`) y leer su
// avance entre los alumnos del producto. Editar la clase, la estructura e invitar: en la computadora.
//
// ⚠️ EL CURSO ELEGIDO VIVE EN LA URL (`?producto=`, la clave de escritorio: QUERY_DE_SECCION), y se
//    DERIVA de `useSearchParams`, nunca de un `useState` copiado (docs/hallazgos-mobile.md, «Tanda 2»).
//    Cambiarlo es un `replaceState` sobre la URL de escritorio que muestra el navegador (LAS MISMAS
//    RUTAS): sin viaje al server, los cursos ya bajaron con la página.
// ⚠️ LO QUE DEVUELVE GUARDAR (la clase como quedó en la base) se guarda ENCIMA de las props y se suelta
//    cuando llegan otras del server (tirar para refrescar): las props no se copian a un estado.
// ⚠️ EL «DESHACER» LEE DE UN REF: corre desde el toast, segundos después, con otro render. Y nunca dos
//    guardados a la vez (`enCurso`): el segundo pisaría al primero en un orden que nadie elige.

import { useMemo, useRef, useState } from 'react';
import { useSearchParams } from 'next/navigation';
import { Icon } from '@/app/_components/icons';
import {
  FilaDatoM, FilaM, ListaM, SeccionM, SegmentadoM, SheetM, VacioM, ErrorM, useConexion, useToastM,
} from '@/app/m/_ui';
import { guardarBloqueoAction } from '@/app/customer-success/curso/modulos-actions';
import type { Acceso } from '@/app/customer-success/curso/bloqueo-editor';
import type { Bloqueo } from '@/lib/curso-bloqueo';
import {
  R, T, accesoDeClase, bloqueoDeAcceso, claseDatos, filasAvance, iconoDeClase, mismoBloqueo, productoElegido,
  rotuloClases, rotuloMinutos, seAbreDe, segundaDe,
  type ClaseDatos, type CursoDatos,
} from './modelo';

export function CursoM({ cursos, puedeEditar }: { cursos: CursoDatos[]; puedeEditar: boolean }) {
  const sp = useSearchParams();
  const productoId = productoElegido(cursos, sp.get('producto'));
  const toast = useToastM();
  const { enLinea } = useConexion();
  // El «Deshacer» corre desde un render viejo: la conexión de AHORA.
  const enLineaRef = useRef(enLinea);
  enLineaRef.current = enLinea;

  // Lo guardado en esta visita, encima de las props; se suelta cuando el server trae otras.
  const [base, setBase] = useState(cursos);
  const [cambios, setCambios] = useState<ReadonlyMap<number, ClaseDatos>>(new Map());
  if (base !== cursos) { setBase(cursos); setCambios(new Map()); }

  const curso = cursos.find((c) => c.productoId === productoId) ?? null;
  const clases = useMemo(
    () => (curso ? curso.modulos.flatMap((m) => m.clases.map((c) => cambios.get(c.id) ?? c)) : []),
    [curso, cambios],
  );
  const porId = useMemo(() => new Map(clases.map((c) => [c.id, c])), [clases]);
  const tituloDe = (id: number) => porId.get(id)?.titulo ?? null;
  // Para el «Deshacer» (corre desde un render viejo): la clase como está AHORA.
  const porIdRef = useRef(porId);
  porIdRef.current = porId;

  const [eligeCurso, setEligeCurso] = useState(false);
  const [claseId, setClaseId] = useState<number | null>(null);
  const [claseAbierta, setClaseAbierta] = useState(false);
  /** Lo que se pidió mientras el server contesta (se ve lo pedido, como en escritorio). */
  const [pedido, setPedido] = useState<Acceso | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [ocupado, setOcupado] = useState(false);
  const enCurso = useRef(false);

  const elegirCurso = (id: number) => {
    try {
      const u = new URL(window.location.href);
      u.searchParams.set('producto', String(id));
      window.history.replaceState(null, '', u.pathname + u.search + u.hash);
    } catch { /* sin URL no se pierde nada: es una comodidad */ }
    setEligeCurso(false);
  };

  // El sub-estado de la hoja se suelta al ABRIR la próxima, nunca al cerrar (sigue en pantalla 220 ms).
  const abrirClase = (id: number) => { setClaseId(id); setPedido(null); setError(null); setClaseAbierta(true); };

  /**
   * Guarda el candado de una clase por la MISMA action de escritorio (admin y producto propio, los mira
   * el server). Devuelve si quedó. `conDeshacer`: el toast «Acceso cambiado» con su vuelta atrás, que
   * vuelve a escribir lo de antes por este mismo camino (sin ofrecer deshacer el deshacer).
   */
  const guardar = async (id: number, b: Bloqueo | null, conDeshacer: boolean): Promise<boolean> => {
    const c = porIdRef.current.get(id);
    if (!c || enCurso.current) return false;
    if (!enLineaRef.current) { toast(T.sinConexion); return false; }
    const previo = c.bloqueo;
    enCurso.current = true;
    setOcupado(true);
    try {
      const r = await guardarBloqueoAction(c.productoId, { clase: c.id }, b);
      if (!r.ok) { setError(r.error); return false; }
      const nueva = r.clase ? claseDatos(r.clase, c.vinculado) : { ...c, bloqueo: b };
      setCambios((m) => new Map(m).set(c.id, nueva));
      if (conDeshacer && !mismoBloqueo(previo, nueva.bloqueo)) {
        toast(R.accesoCambiado, { deshacer: () => { void guardar(c.id, previo, false).then((ok) => { if (!ok) toast(T.noSeDeshizo); }); } });
      }
      return true;
    } catch {
      setError(R.noSeGuardo);
      return false;
    } finally {
      enCurso.current = false;
      setOcupado(false);
    }
  };

  const elegirAcceso = async (c: ClaseDatos, a: Acceso) => {
    if (enCurso.current || a === accesoDeClase(c)) return;
    setError(null);
    setPedido(a);
    await guardar(c.id, bloqueoDeAcceso(a), true);
    setPedido(null);
  };

  if (!curso) return <VacioM frase={`${R.sinServicios}.`} accion={{ rotulo: R.irAClientes, href: '/m/cs' }} />;

  const varios = cursos.length > 1;
  const total = curso.modulos.reduce((n, m) => n + m.clases.length, 0);
  const clase = claseId != null ? porId.get(claseId) ?? null : null;

  return (
    <div className="m-curso">
      <ListaM>
        {varios
          ? <FilaDatoM k={R.curso} v={curso.nombre} azul onClick={() => setEligeCurso(true)} />
          : <FilaDatoM k={R.curso} v={curso.nombre} />}
      </ListaM>

      {curso.errorClases ? (
        <ErrorM frase={T.sinLeerClases} />
      ) : total === 0 ? (
        <VacioM frase={T.cursoVacio} />
      ) : curso.modulos.map((m) => (
        <SeccionM key={m.clave} titulo={m.nombre} accion={<span className="m-curso-n">{rotuloClases(m.clases.length)}</span>}>
          {m.clases.length > 0 && (
            <ListaM etiqueta={m.nombre}>
              {m.clases.map((x) => {
                const c = cambios.get(x.id) ?? x;
                return (
                  <FilaM key={c.id} icono={iconoDeClase(c)} titulo={c.titulo} segunda={segundaDe(c, tituloDe)}
                    riel={rotuloMinutos(c.minutos)} onClick={() => abrirClase(c.id)} />
                );
              })}
            </ListaM>
          )}
        </SeccionM>
      ))}

      {varios && (
        <SheetM id="cursos" abierto={eligeCurso} onCerrar={() => setEligeCurso(false)} titulo={R.cursos} rotuloCerrar="Cerrar los cursos">
          <ListaM etiqueta={R.cursos}>
            {cursos.map((x) => (
              <FilaM key={x.productoId} titulo={x.nombre} navegacion chevron={false}
                riel={x.productoId === curso.productoId ? <span className="m-curso-check"><Icon name="check" size={20} /></span> : undefined}
                onClick={() => elegirCurso(x.productoId)} />
            ))}
          </ListaM>
        </SheetM>
      )}

      <SheetM id="clase" abierto={claseAbierta} onCerrar={() => setClaseAbierta(false)} titulo={clase?.titulo ?? ''}
        ocupado={ocupado} rotuloCerrar="Cerrar la clase">
        {clase ? (
          <HojaClase clase={clase} curso={curso} puedeEditar={puedeEditar} acceso={pedido ?? accesoDeClase(clase)}
            seAbre={seAbreDe(clase, tituloDe)} error={error} onAcceso={(a) => { void elegirAcceso(clase, a); }} />
        ) : (
          <VacioM frase={T.claseIda} />
        )}
      </SheetM>
    </div>
  );
}

/** La hoja de una clase: su acceso (lo que se cambia acá) y su avance (lo que se lee). */
function HojaClase({ clase, curso, puedeEditar, acceso, seAbre, error, onAcceso }: {
  clase: ClaseDatos;
  curso: CursoDatos;
  puedeEditar: boolean;
  acceso: Acceso;
  seAbre: string | null;
  error: string | null;
  onAcceso: (a: Acceso) => void;
}) {
  const avance = filasAvance(clase, curso.avance);
  return (
    <>
      <div className="m-curso-acceso">
        {puedeEditar ? (
          <SegmentadoM etiqueta={R.acceso} valor={acceso} onCambio={onAcceso}
            opciones={[{ id: 'publico', label: R.publico }, { id: 'privado', label: R.privado }]} />
        ) : (
          <ListaM><FilaDatoM k={R.acceso} v={acceso === 'publico' ? R.publico : R.privado} /></ListaM>
        )}
        {acceso === 'privado' && seAbre && (
          <ListaM><FilaDatoM k={R.seAbre} v={seAbre} /></ListaM>
        )}
        {error && <p className="m-curso-error" role="alert">{error}</p>}
      </div>

      <SeccionM titulo={T.avance}>
        {avance === 'error' ? (
          <p className="m-curso-error" role="alert">{R.sinAvance}</p>
        ) : avance === 'vacio' ? (
          <p className="m-curso-nota">{R.sinClientes}.</p>
        ) : (
          <ListaM etiqueta={T.avance}>
            {avance.map((f) => <FilaDatoM key={f.k} k={f.k} v={f.v} />)}
          </ListaM>
        )}
      </SeccionM>
    </>
  );
}
