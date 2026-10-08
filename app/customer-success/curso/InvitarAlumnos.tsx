'use client';

// =============================================================================
// InvitarAlumnos — invitar alumnos DESDE EL EDITOR del curso de un producto
// =============================================================================
// Pedido de Martín (07/10/2026, item 9): «También en la vista de editor de curso debería poder
// invitar a alguien. Ya sea seleccionándolo de la lista de clientes que aún no estén invitados o
// invitándolo de 0, en ese caso, me debe pedir más datos para también agregarlo como cliente al
// kanban».
//
// Un botón y un modal con DOS caminos (dos pestañas, una pregunta cada una):
//   · «Clientes sin invitar»: los del producto que todavía no recibieron su invitación, con un
//     buscador; se eligen uno o varios y cada uno lleva su email (prellenado del CRM y editable).
//   · «Alguien nuevo»: nombre, email (obligatorio: es una invitación por mail), teléfono, empresa y
//     «Sin cobro». En UNA action se crea como cliente ganado, entra al kanban del producto en su
//     primera etapa y se lo invita (./invitar-actions.ts). Si se parece a alguien que ya existe, NO
//     falla: ofrece usar a ése.
//
// ⚠️ NO SE MONTA ACÁ: lo monta el editor del curso (CursoApp, otra pista de la misma tanda). Lo que
// necesita son las filas de Avance del producto (las mismas que ya arma la página del curso), con su
// email del CRM y su acceso CON la invitación (`accesosDeClientes`, lib/curso-admin.ts).
//
// ⚠️ LA LISTA SALE DE `clientesSinInvitar` (../curso-ficha-lectura.ts, con test): un cortado, un
// invitado o uno cuyo acceso no se pudo leer NO aparecen — invitarlo sería un segundo mail a ciegas.
//
// ⚠️ EL MODAL VA POR PORTAL AL BODY, como el de ./InvitarAlCurso.tsx: el editor tiene barras
// pegadas (sticky) y un z-index ahí adentro se resolvería contra ellas (AGENTS.md).
//
// ⚠️ TEXTOS CORTOS Y EN TÚ: lo lee el equipo del negocio, y los rótulos son de 1-3 palabras.

import { useCallback, useEffect, useId, useMemo, useRef, useState } from 'react';
import { createPortal } from 'react-dom';
import { Button, Checkbox, Field, Input, Modal, Tabs, TextField } from '@/app/_ui';
import { useRouter } from '@/app/_ui/Link';
import { emailUtilizable } from '@/lib/agencia-altas';
import { clientesSinInvitar, type AccesoDeFila, type ClienteSinInvitar } from '../curso-ficha-lectura';
import { invitarClientesAction, invitarNuevoAlumnoAction } from './invitar-actions';

/** Una fila de Avance, en lo que esta pieza mira (es la forma de `FilaConAcceso`, ./AvanceCurso.tsx). */
export type FilaParaInvitar = { leadId: number; nombre: string; empresa: string | null; email?: string | null; acceso: AccesoDeFila };

type Duplicado = { leadId: number; nombre: string; texto: string; ganado: boolean };

const msg = (e: unknown, def: string) => (e instanceof Error ? e.message : def);

export function InvitarAlumnos({ productoId, producto, filas, onListo }: {
  productoId: number;
  /** El nombre del producto: va en el título del modal. */
  producto: string;
  /** Las filas de Avance del producto (sus clientes, con su acceso y su email del CRM). */
  filas: readonly FilaParaInvitar[];
  /** Cuando algo salió (alguien quedó invitado o creado). La página ya se relee sola. */
  onListo?: () => void;
}) {
  const [abierto, setAbierto] = useState(false);
  return (
    <>
      <Button size="sm" variant="secondary" onClick={() => setAbierto(true)} title={`Invitar alumnos a ${producto}`}>
        Invitar alumnos
      </Button>
      {abierto && <ModalInvitarAlumnos productoId={productoId} producto={producto} filas={filas} onListo={onListo} onCerrar={() => setAbierto(false)} />}
    </>
  );
}

/**
 * El modal SOLO, para quien lo abre desde más de un lugar: el editor del curso lo abre con su botón
 * de la barra de arriba y con «Invitar alumnos» del menú de la marca (./CursoApp.tsx), con un solo
 * estado para los dos.
 */
export function ModalInvitarAlumnos({ productoId, producto, filas, onListo, onCerrar }: {
  productoId: number; producto: string; filas: readonly FilaParaInvitar[]; onListo?: () => void; onCerrar: () => void;
}) {
  const sinInvitar = useMemo(() => clientesSinInvitar(filas), [filas]);
  // Con nadie sin invitar, arranca en «Alguien nuevo»: abrir una lista vacía es un paso de más.
  const [pestana, setPestana] = useState<'clientes' | 'nuevo'>(sinInvitar.length ? 'clientes' : 'nuevo');
  const [ocupado, setOcupado] = useState(false);
  const ocupadoRef = useRef(false);
  const router = useRouter();
  /** `onCerrar` estable (ver el porqué en ./InvitarAlCurso.tsx: el `Modal` depende de su identidad). */
  const alCerrar = useRef(onCerrar);
  alCerrar.current = onCerrar;
  const cerrar = useCallback(() => { if (!ocupadoRef.current) alCerrar.current(); }, []);
  const ocupar = (v: boolean) => { ocupadoRef.current = v; setOcupado(v); };
  /** Algo cambió en la base: se relee la página (la tabla Avance, la lista) y se avisa. */
  const hecho = () => { router.refresh(); onListo?.(); };

  return createPortal(
    <Modal titulo={`Invitar a ${producto}`} encabezado="Alumnos" ancho={600} anidada onCerrar={cerrar}>
      <Tabs
        tabs={[{ id: 'clientes', label: 'Clientes sin invitar', badge: sinInvitar.length }, { id: 'nuevo', label: 'Alguien nuevo' }]}
        activa={pestana}
        onCambio={(id) => { if (!ocupadoRef.current) setPestana(id === 'nuevo' ? 'nuevo' : 'clientes'); }}
      />
      {pestana === 'clientes'
        ? <Clientes lista={sinInvitar} ocupado={ocupado} ocupar={ocupar} hecho={hecho} />
        : <Nuevo productoId={productoId} ocupado={ocupado} ocupar={ocupar} hecho={hecho} />}
    </Modal>,
    document.body,
  );
}

// ── Clientes sin invitar ──────────────────────────────────────────────────────

function Clientes({ lista, ocupado, ocupar, hecho }: {
  lista: readonly ClienteSinInvitar[]; ocupado: boolean; ocupar: (v: boolean) => void; hecho: () => void;
}) {
  const [q, setQ] = useState('');
  const [elegidos, setElegidos] = useState<Set<number>>(() => new Set());
  /** El email de cada uno, editable: arranca con el del CRM. */
  const [emails, setEmails] = useState<Record<number, string>>(() => Object.fromEntries(lista.map((c) => [c.leadId, c.email])));
  /** El resultado de cada uno después de mandar: una frase por fila. */
  const [resultados, setResultados] = useState<Record<number, { enviado: boolean; texto: string }>>({});
  const [error, setError] = useState('');

  const t = q.trim().toLowerCase();
  const visibles = t ? lista.filter((c) => `${c.nombre} ${c.empresa ?? ''} ${emails[c.leadId] ?? ''}`.toLowerCase().includes(t)) : lista;
  /** Los elegidos que todavía no salieron (uno que ya quedó invitado no se vuelve a mandar). */
  const aMandar = [...elegidos].filter((id) => !resultados[id]?.enviado);
  const malos = aMandar.filter((id) => !emailUtilizable((emails[id] ?? '').trim()));

  const alternar = (id: number) => setElegidos((s) => { const n = new Set(s); if (n.has(id)) n.delete(id); else n.add(id); return n; });

  async function mandar() {
    if (!aMandar.length || malos.length || ocupado) return;
    ocupar(true);
    setError('');
    try {
      const r = await invitarClientesAction(aMandar.map((leadId) => ({ leadId, email: (emails[leadId] ?? '').trim() })));
      if (!r.ok) { setError(r.error); return; }
      setResultados((m) => ({ ...m, ...Object.fromEntries(r.resultados.map((x) => [x.leadId, { enviado: x.enviado, texto: x.texto }])) }));
      if (r.resultados.some((x) => x.enviado)) hecho();
    } catch (e) {
      setError(msg(e, 'No se pudo invitar.'));
    } finally {
      ocupar(false);
    }
  }

  if (!lista.length) return <p className="ina-nada">Todos sus clientes ya están invitados.</p>;
  return (
    <div className="ina-col">
      <Input value={q} placeholder="Buscar" aria-label="Buscar clientes" onChange={(e) => setQ(e.target.value)} />
      <ul className="ina-lista">
        {visibles.map((c) => {
          const res = resultados[c.leadId];
          const email = emails[c.leadId] ?? '';
          const sirve = emailUtilizable(email.trim());
          return (
            <li key={c.leadId} className="ina-fila">
              <Checkbox checked={elegidos.has(c.leadId)} disabled={ocupado || res?.enviado === true}
                label={<span className="ina-nom" title={c.nombre}>{c.nombre || 'Sin nombre'}{c.empresa ? <span className="ina-sub"> · {c.empresa}</span> : null}</span>}
                onChange={() => alternar(c.leadId)} />
              <Input type="email" value={email} placeholder="Email" aria-label={`Email de ${c.nombre || 'este cliente'}`}
                error={elegidos.has(c.leadId) && !sirve} disabled={ocupado || res?.enviado === true}
                onChange={(e) => setEmails((m) => ({ ...m, [c.leadId]: e.target.value }))} />
              {res && <span className={res.enviado ? 'ina-ok' : 'ina-mal'} title={res.texto}>{res.texto}</span>}
            </li>
          );
        })}
        {!visibles.length && <li className="ina-nada">Nadie coincide.</li>}
      </ul>
      {malos.length > 0 && <p className="ina-mal">Falta un email válido.</p>}
      {error && <p className="ina-mal">{error}</p>}
      <div className="ina-pie">
        {/* El botón dice LO QUE PASA y a cuántos: se le escribe a gente, y eso no se deshace. */}
        <Button variant="primary" loading={ocupado} disabled={!aMandar.length || malos.length > 0} onClick={() => void mandar()}>
          {aMandar.length > 1 ? `Invitar a ${aMandar.length}` : 'Invitar'}
        </Button>
      </div>
      <EstiloAlumnos />
    </div>
  );
}

// ── Alguien nuevo ─────────────────────────────────────────────────────────────

function Nuevo({ productoId, ocupado, ocupar, hecho }: {
  productoId: number; ocupado: boolean; ocupar: (v: boolean) => void; hecho: () => void;
}) {
  const idNombre = useId();
  const [nombre, setNombre] = useState('');
  const [email, setEmail] = useState('');
  const [telefono, setTelefono] = useState('');
  const [empresa, setEmpresa] = useState('');
  const [sinCobro, setSinCobro] = useState(false);
  const [error, setError] = useState('');
  /** Con quién choca, si choca: la pantalla ofrece usarlo en vez de fallar. */
  const [duplicados, setDuplicados] = useState<Duplicado[] | null>(null);
  /** Lo que pasó después de crear: el cliente YA existe, así que el formulario no se vuelve a mandar. */
  const [listo, setListo] = useState<{ enviado: boolean; texto: string } | null>(null);
  const puede = nombre.trim().length > 1 && emailUtilizable(email.trim());

  // ⚠️ EL FOCO VA DESPUÉS DEL DEL MODAL, que enfoca su caja al montarse. Este componente es HIJO del
  // modal, así que su efecto corre ANTES que el del modal (los hijos primero): sin el `setTimeout`, el
  // modal le saca el foco al campo en el mismo commit.
  useEffect(() => {
    const t = window.setTimeout(() => (document.getElementById(idNombre) as HTMLInputElement | null)?.focus(), 0);
    return () => window.clearTimeout(t);
  }, [idNombre]);

  async function crear(extra: { usarLeadId?: number; crearIgual?: boolean } = {}) {
    if (ocupado || (!puede && !extra.usarLeadId)) return;
    ocupar(true);
    setError('');
    try {
      const r = await invitarNuevoAlumnoAction({ productoId, nombre, email, telefono, empresa, sinCobro, ...extra });
      if (!r.ok) {
        if (r.duplicados?.length) { setDuplicados(r.duplicados); return; }
        setError(r.error);
        return;
      }
      setDuplicados(null);
      setListo({ enviado: r.enviado, texto: r.texto });
      hecho();
    } catch (e) {
      setError(msg(e, 'No se pudo invitar.'));
    } finally {
      ocupar(false);
    }
  }

  if (listo) {
    return (
      <div className="ina-col">
        <p className={listo.enviado ? 'ina-ok' : 'ina-mal'}>{listo.enviado ? 'Cliente creado e invitado.' : listo.texto}</p>
        <div className="ina-pie">
          <Button variant="secondary" onClick={() => { setListo(null); setNombre(''); setEmail(''); setTelefono(''); setEmpresa(''); setSinCobro(false); }}>
            Invitar a otro
          </Button>
        </div>
        <EstiloAlumnos />
      </div>
    );
  }

  return (
    <div className="ina-col">
      {/* `Field` + `Input` y no `TextField`: el foco va a ESTE campo por id (ver el efecto de arriba),
          y `TextField` arma su propio id — pasarle otro desconectaría su rótulo. */}
      <Field label="Nombre" required htmlFor={idNombre}>
        <Input id={idNombre} value={nombre} placeholder="Nombre y apellido" disabled={ocupado}
          onChange={(e) => { setNombre(e.target.value); setDuplicados(null); }} />
      </Field>
      <TextField label="Email" required type="email" value={email} placeholder="persona@empresa.com" disabled={ocupado}
        hint="Le llega un correo con su acceso."
        onChange={(e) => { setEmail(e.target.value); setDuplicados(null); }} />
      <TextField label="Teléfono" type="tel" value={telefono} disabled={ocupado}
        onChange={(e) => { setTelefono(e.target.value); setDuplicados(null); }} />
      <TextField label="Empresa" value={empresa} disabled={ocupado} onChange={(e) => setEmpresa(e.target.value)} />
      <Checkbox checked={sinCobro} onChange={setSinCobro} label="Sin cobro" hint="Becado o bonificado." disabled={ocupado} />

      {/* EL DUPLICADO TIENE SALIDA: usar al que ya existe (el botón dice si además pasa a ser cliente)
          o crear otro igual. Un «ya existe» sin salida obliga a ir al CRM a buscarlo. */}
      {duplicados && (
        <div className="ina-dup">
          {duplicados.map((d) => (
            <div key={d.leadId} className="ina-dup-fila">
              <span className="ina-sub" title={d.texto}>{d.texto}</span>
              <Button size="sm" variant="primary" loading={ocupado} onClick={() => void crear({ usarLeadId: d.leadId })}>
                {d.ganado ? `Invitar a ${d.nombre}` : `Hacer cliente a ${d.nombre}`}
              </Button>
            </div>
          ))}
          <Button size="sm" variant="tertiary" disabled={ocupado || !puede} onClick={() => void crear({ crearIgual: true })}>Crear otro igual</Button>
        </div>
      )}
      {error && <p className="ina-mal">{error}</p>}
      {!duplicados && (
        <div className="ina-pie">
          {/* Lo que pasa, en el botón: se crea en el CRM, entra al kanban y le llega el mail. */}
          <Button variant="primary" loading={ocupado} disabled={!puede} onClick={() => void crear()}>Crear e invitar</Button>
        </div>
      )}
      <EstiloAlumnos />
    </div>
  );
}

function EstiloAlumnos() {
  return <style dangerouslySetInnerHTML={{ __html: CSS }} />;
}

// ⚠️ NINGÚN BACKTICK ACÁ ADENTRO, ni en un comentario: cierra la cadena a la mitad (AGENTS.md).
const CSS = `
.ina-col{ display:flex; flex-direction:column; gap:12px; min-width:0; }
.ina-lista{ list-style:none; margin:0; padding:0; max-height:340px; overflow-y:auto; display:flex; flex-direction:column; }
.ina-fila{ display:grid; grid-template-columns:minmax(0,1fr) minmax(0,220px); gap:6px 12px; align-items:center; padding:8px 2px; border-top:1px solid var(--border); }
.ina-fila:first-child{ border-top:0; }
.ina-fila > .ina-ok, .ina-fila > .ina-mal{ grid-column:1 / -1; margin:0; }
.ina-nom{ display:inline-block; max-width:100%; overflow:hidden; text-overflow:ellipsis; white-space:nowrap; vertical-align:bottom; }
.ina-sub{ font-size:var(--fs-meta); color:var(--dim); overflow-wrap:anywhere; }
.ina-ok{ margin:0; font-size:12.5px; color:var(--good); }
.ina-mal{ margin:0; font-size:12.5px; color:var(--bad); }
.ina-nada{ margin:8px 2px; font-size:13.5px; color:var(--faint); }
.ina-pie{ display:flex; justify-content:flex-end; gap:8px; }
.ina-dup{ display:flex; flex-direction:column; gap:8px; padding:10px 12px; border-radius:10px; background:var(--warn-bg); }
.ina-dup-fila{ display:flex; align-items:center; justify-content:space-between; gap:10px; }
.ina-dup > button{ align-self:flex-start; }
`;
