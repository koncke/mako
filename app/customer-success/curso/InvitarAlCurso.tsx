'use client';

// =============================================================================
// InvitarAlCurso — invitar a un cliente al curso, y en qué quedó su invitación
// =============================================================================
// Pedido de Martín (06/10/2026): «Al igual que en la vista de Agencia, se debería poder INVITAR
// al cliente a MaKo para que tenga acceso al curso».
//
// LA FORMA es la de «Abrir cuenta» de la vista de Agencia (../CuentaDeMaKo.tsx): un botón que
// abre un modal que pide el email —prellenado con el del CRM y obligatorio—, por portal al body,
// `anidada`, con el estado visible y la opción de reenviar. LO DE ADENTRO es otra cosa: no se
// crea workspace, ni cuenta, ni hay aprobación cruzada (es el mismo negocio y el que invita es el
// dueño). Lo que se da es el acceso al CURSO, un link firmado (lib/curso-acceso.ts), y el mail
// lleva el link de entrada de la versión vigente.
//
// ⚠️ LO USAN TRES PANTALLAS, y por eso vive acá y no adentro de una: la caja «Acceso al curso» de
// la ficha (../FichaCurso.tsx), la columna «Acceso» de la tabla Avance (./AvanceCurso.tsx) y,
// desde el 07/10/2026, la opción «Invitar al curso» del menú de la tarjeta del kanban
// (../ClienteCard.tsx, que monta `ModalInvitar` sin botón). Con el modal escrito dos veces, uno
// de los dos se queda sin el «sólo si salió».
//
// ⚠️ Y EN LA TARJETA EL PORTAL TAMBIÉN SALVA EL ARRASTRE: la tarjeta es `draggable`, y un texto
// arrastrado adentro del campo del email subiría por el árbol de React hasta el `dragstart` del
// kanban. Lo corta la guarda de `agarrar` (KanbanEntrega.tsx), que mira si el gesto nació adentro
// de la tarjeta EN EL DOM — y un portal la saca del DOM.
//
// ⚠️ EL MODAL VA POR PORTAL AL BODY. En la ficha se abre adentro de OTRO modal (la ficha es un
// `contenedor`): montado ahí sería un descendiente de su DOM y la pila de modales lo apagaría
// con él. Y en la tabla vive adentro de una celda `sticky`/con scroll, que es un contexto de
// apilamiento: el z-index del modal se resolvería contra ella (AGENTS.md, la regla del sticky).
//
// #665 (06/10/2026): «m6-m9 por área con link propio del líder de área». Si el curso del cliente
// tiene clases por área y declaró sus áreas, el modal suma «Para»: el cliente, o el LÍDER de una de
// sus áreas. Al líder le llega SU link (`c2.`, sólo las clases por área de esa área) por
// `invitarLiderAction`; nunca una cuenta, ni la cookie del alumno, ni la línea de Google. El email de
// un líder arranca vacío (o con el de su invitación anterior): el del cliente es otra persona.
//
// ⚠️ SI EL MAIL NO SALIÓ, EL MODAL NO SE CIERRA: se queda abierto con el motivo. Cerrarlo y
// pintar «Invitado» sería el falso éxito de los avisos de aprobación de agencia; y cerrarlo con
// un error abajo, en una celda de la tabla, es un error que nadie lee.
//
// ── A UN CURSO (puntos 6, 7 y 10 del audio del 08/10/2026 a la noche) ─────────────────────────────
// `productoId` (opcional): el producto DESDE el que se invita — la tarjeta del kanban de ese producto, la
// tabla Avance de ese curso. Con él la invitación va por `invitarAlCursoDelProductoAction`
// (./invitar-actions.ts): el mail nombra sólo ese curso y el acceso pasa a abrir ése. Sin él (la ficha,
// que es de TODOS sus productos), por `invitarAlCursoAction` como siempre. Y si el correo no salió por
// su configuración, el modal monta el formulario del correo AHÍ MISMO (`CorreoAhiMismo`, ./InvitarAlumnos).

import { useId, useRef, useState } from 'react';
import { createPortal } from 'react-dom';
import { Button, Field, Input, Modal, Select, useOkFlash, type ButtonVariant } from '@/app/_ui';
import { emailUtilizable } from '@/lib/agencia-altas';
import { habilitarAccesoCursoAction, invitarAlCursoAction, invitarLiderAction } from '../curso-ficha-actions';
import { invitarAlCursoDelProductoAction } from './invitar-actions';
import { CorreoAhiMismo } from './InvitarAlumnos';
import type { CorreoQueFallo } from '@/lib/curso-invitar-reglas';
import { useCerrarEstable, useFocoInicial } from './dialogo-foco';
import {
  estadoDeInvitacion, fraseInvitacion,
  type AccesoFicha, type AccesoInvitacion, type AccesoLiderFicha, type AvisoInvitacionCurso,
} from '../curso-ficha-lectura';

const msg = (e: unknown, def: string) => (e instanceof Error ? e.message : def);

/** Lo que necesita el modal de invitar. Lo comparten el botón (`BotonInvitar`) y la tarjeta del kanban. */
type PropsInvitar = {
  leadId: number;
  nombre: string;
  /** El email del CRM, con el que se prellena. Se pide IGUAL: puede ser el del contacto comercial. */
  emailCrm: string | null | undefined;
  acceso: AccesoInvitacion | null;
  /**
   * Cada vez que el server contestó. `acceso` es el releído (`null` = no se pudo releer: quien
   * llama se queda con el que tenía) y `aviso` viene SÓLO cuando el modal se cerró con algo que
   * decir (el mail salió pero no quedó anotado): si el mail no salió, el motivo se dice adentro del
   * modal, que se queda abierto.
   */
  onListo: (acceso: AccesoFicha | null, aviso: AvisoInvitacionCurso | null) => void;
  /**
   * Las áreas del cliente, si su curso tiene clases por área (#665): el modal suma «Para» y se puede
   * invitar al LÍDER de un área a SUS tareas, con su propio link. Sin áreas (la tabla Avance, la
   * tarjeta del kanban, o un curso sin clases por área) el modal es el de siempre.
   */
  areas?: readonly string[];
  /** Los accesos de los líderes: de acá sale con qué email se prellena el de un área ya invitada. */
  lideres?: readonly AccesoLiderFicha[];
  /** Los líderes como quedaron después de invitar a uno. */
  onLideres?: (l: AccesoLiderFicha[]) => void;
  /**
   * El producto desde el que se invita (la tarjeta del kanban, la tabla Avance): el mail nombra sólo ese
   * curso y el acceso abre ése. Sin él, la invitación de siempre (ver la cabecera).
   */
  productoId?: number;
};

/**
 * El MODAL de invitar, sin botón: lo abre quien lo monta y lo cierra `onCerrar`.
 *
 * ⚠️ VIVE APARTE DEL BOTÓN DESDE EL 07/10/2026: la tarjeta del kanban lo abre desde una opción de su
 * menú «Acciones» (ClienteCard.tsx), donde un botón más no entra — la fila de la tarjeta es `nowrap`
 * y cada control extra la desborda. Con el modal escrito dos veces, uno se queda sin el «sólo si salió».
 *
 * `onEnviada`: el mail SALIÓ (para el «Enviada» del botón que lo abrió, si hay uno).
 */
export function ModalInvitar({ leadId, nombre, emailCrm, acceso, onListo, areas, lideres, onLideres, productoId, onCerrar, onEnviada }: PropsInvitar & {
  onCerrar: () => void;
  onEnviada?: () => void;
}) {
  const id = useId();
  const estado = estadoDeInvitacion(acceso);
  const reenviar = estado.tipo === 'invitado';
  const quien = nombre || 'este cliente';
  /** Con qué email arranca cada destinatario: el cliente, con el de su invitación o el del CRM; un
   *  líder, con el de su invitación si ya tenía una — nunca con el del cliente, que es otra persona. */
  const emailDe = (area: string) => area
    ? lideres?.find((l) => l.area === area)?.email ?? ''
    : (estado.tipo === 'invitado' ? estado.email : null) ?? emailCrm ?? '';
  /** A quién: `''` = el cliente; un nombre = el líder de esa área. */
  const [para, setPara] = useState('');
  // Reenviar arranca con la dirección a la que ya se mandó; invitar, con la del CRM. Se siembra UNA
  // vez: el modal se monta al abrirse, así que cada apertura arranca de nuevo.
  const [correo, setCorreo] = useState(() => emailDe(''));
  const [mandando, setMandando] = useState(false);
  const mandandoRef = useRef(false);
  const [error, setError] = useState('');
  /** Si el correo no salió por su configuración, de quién fue: el formulario aparece ahí mismo. */
  const [correoMal, setCorreoMal] = useState<CorreoQueFallo>(null);

  /**
   * ⚠️ `onCerrar` ESTABLE, no una flecha nueva en cada render. El efecto de `Modal` depende de
   * `onCerrar`: con una identidad nueva por tecla, su limpieza devuelve el foco al botón de atrás
   * y vuelve a enfocar la caja — o sea que el campo pierde el foco con cada letra. Lo que mira si
   * hay un envío en curso va por ref, y el `onCerrar` de quien lo monta también: así la identidad
   * no cambia aunque el padre pase una flecha nueva en cada render.
   */
  const cerrar = useCerrarEstable(onCerrar, mandando);

  // ⚠️ EL FOCO AL CAMPO VA CUANDO LA CAJA YA SE VE: el primer render del `Modal` es `display:none` y
  // un `.focus()` sobre algo escondido no hace nada (medido: el foco quedaba en el body).
  useFocoInicial(id);
  const sirve = emailUtilizable(correo);
  const conAreas = (areas?.length ?? 0) > 0;

  async function mandar() {
    if (!sirve || mandandoRef.current) return;
    mandandoRef.current = true;
    setMandando(true);
    setError('');
    try {
      // ⚠️ AL LÍDER VA SU PROPIA ACTION (`invitarLiderAction`): su link es otro (`c2.`, sólo sus
      // clases) y su mail no ofrece entrar con Google. El acceso del cliente no se toca. Con producto,
      // la del producto (ver la cabecera); sin él, la de la ficha.
      const r = para ? await invitarLiderAction(leadId, para, correo)
        : productoId ? await invitarAlCursoDelProductoAction(leadId, productoId, correo)
          : await invitarAlCursoAction(leadId, correo);
      if (!r.ok) { setError(r.error); return; }
      if ('lideres' in r && r.lideres) onLideres?.(r.lideres);
      // Sólo la action del producto dice de quién fue un correo caído (`correo`); las otras dos, no.
      setCorreoMal(!r.enviado && 'correo' in r ? (r as { correo: CorreoQueFallo }).correo : null);
      if (!r.enviado) {
        // El acceso pudo haber nacido igual (se crea antes de mandar): se pinta, sin aviso.
        if ('acceso' in r) onListo(r.acceso, null);
        setError(r.aviso.texto);
        return;
      }
      // `onCerrar` y no `cerrar`: `cerrar` se niega mientras hay un envío en curso, y éste terminó.
      onCerrar();
      onEnviada?.();
      onListo('acceso' in r ? r.acceso : null, r.aviso.tono === 'warn' ? r.aviso : null);
    } catch (e) {
      setError(msg(e, 'No se pudo invitar.'));
    } finally {
      mandandoRef.current = false;
      setMandando(false);
    }
  }

  return createPortal(
    <Modal
      titulo={para ? `Invitar al líder de ${para}` : reenviar ? `Reenviar a ${quien}` : `Invitar a ${quien}`}
      encabezado="Acceso al curso"
      ancho={440}
      /* ⚠️ `anidada`: en la ficha se abre DESDE un control de la ficha y es parte de la misma
         tarea, así que la de atrás se sigue viendo. Sin esto la ficha desaparece y parece
         que el botón la cerró. En la tabla y en el kanban no hay nada atrás y no cambia nada. */
      anidada
      onCerrar={cerrar}
      pie={
        <>
          <Button variant="secondary" disabled={mandando} onClick={cerrar}>Cancelar</Button>
          {/* El botón dice LO QUE PASA: se le escribe a alguien, y eso no se deshace. */}
          <Button variant="primary" loading={mandando} disabled={!sirve} onClick={() => void mandar()}>
            Mandar invitación
          </Button>
        </>
      }
    >
      {/* A QUIÉN (#665): el cliente o el líder de una de sus áreas. Cambiar de destinatario
          cambia el email con el que arranca: el del cliente no es el de su líder. */}
      {conAreas && (
        <Select label="Para" value={para} width="100%"
          options={[{ value: '', label: nombre || 'El cliente' }, ...(areas ?? []).map((a) => ({ value: a, label: `Líder de ${a}` }))]}
          onChange={(v) => { setPara(v); setCorreo(emailDe(v)); setError(''); }} />
      )}
      {/* La consecuencia, pegada al campo y ANTES del click. Si algo falla, el motivo
          ocupa su lugar. */}
      <Field label={para ? `Email del líder de ${para}` : `Email de ${nombre || 'el cliente'}`} htmlFor={id}
        hint={para ? 'Le llega el link de sus tareas.' : 'Le llega un correo con su acceso.'} error={error || undefined}>
        <Input id={id} type="email" value={correo} placeholder="persona@empresa.com"
          onChange={(e) => setCorreo(e.target.value)}
          onKeyDown={(e) => { if (e.key === 'Enter') void mandar(); }} />
      </Field>
      {/* Punto 10: el correo, ahí mismo. Se guarda y se vuelve a apretar «Mandar invitación». */}
      {correoMal && <CorreoAhiMismo cual={correoMal} />}
    </Modal>,
    document.body,
  );
}

/** El botón «Invitar» (o «Reenviar invitación» si ya se lo invitó) y su modal. */
export function BotonInvitar({ variant = 'secondary', ...props }: PropsInvitar & { variant?: ButtonVariant }) {
  const [abierto, setAbierto] = useState(false);
  const enviada = useOkFlash();
  const reenviar = estadoDeInvitacion(props.acceso).tipo === 'invitado';
  const quien = props.nombre || 'este cliente';
  return (
    <>
      <Button size="sm" variant={variant} ok={enviada.ok} okLabel="Enviada" onClick={() => setAbierto(true)}
        title={reenviar ? `Mandarle otra vez el acceso a ${quien}` : `Mandarle a ${quien} su acceso al curso`}>
        {reenviar ? 'Reenviar invitación' : 'Invitar'}
      </Button>
      {abierto && <ModalInvitar {...props} onCerrar={() => setAbierto(false)} onEnviada={enviada.flash} />}
    </>
  );
}

/**
 * La columna «Acceso» de la tabla Avance: el estado de su invitación en una frase y el botón
 * que le corresponde (Invitar / Reenviar invitación / Volver a habilitar).
 *
 * `onAcceso`: el acceso como quedó después de invitar o habilitar, para que la fila lo pinte sin
 * esperar a que la página se vuelva a leer.
 */
export function CeldaAcceso({ leadId, nombre, emailCrm, acceso, onAcceso, productoId }: {
  leadId: number;
  nombre: string;
  emailCrm: string | null | undefined;
  /** `null` = no se pudo leer: no se ofrece nada (no se invita a ciegas). */
  acceso: AccesoInvitacion | null;
  onAcceso: (a: AccesoFicha) => void;
  /** El curso de la tabla: con él, «Invitar» invita a ESE curso (ver la cabecera). */
  productoId?: number;
}) {
  const [habilitando, setHabilitando] = useState(false);
  const [error, setError] = useState('');

  if (!acceso) return <span className="av-vacio">—</span>;
  const estado = estadoDeInvitacion(acceso);
  const frase = fraseInvitacion(estado);

  async function habilitar() {
    setHabilitando(true);
    setError('');
    try {
      const r = await habilitarAccesoCursoAction(leadId);
      if (!r.ok) setError(r.error);
      else onAcceso(r.acceso);
    } catch (e) {
      setError(msg(e, 'No se pudo habilitar.'));
    } finally {
      setHabilitando(false);
    }
  }

  return (
    <span className="ia-celda">
      {frase && (
        // ⚠️ La fecha de «Invitado · 6 oct» se formatea en el NAVEGADOR (su zona horaria).
        <span suppressHydrationWarning className={estado.tipo === 'cortado' ? 'av-mal' : 'ia-frase'} title={frase}>{frase}</span>
      )}
      {estado.tipo === 'cortado' ? (
        // El link que sale después es NUEVO: los viejos siguen sin abrir (la versión subió al cortar).
        <Button size="sm" variant="tertiary" loading={habilitando} onClick={() => void habilitar()}>Volver a habilitar</Button>
      ) : (
        <BotonInvitar leadId={leadId} nombre={nombre} emailCrm={emailCrm} acceso={acceso} variant="tertiary" productoId={productoId}
          onListo={(a, aviso) => { if (a) onAcceso(a); setError(aviso?.texto ?? ''); }} />
      )}
      {error && <span className="av-mal ia-mal" title={error}>{error}</span>}
    </span>
  );
}

/** La hoja de la celda. La monta, una vez, la tabla que usa `CeldaAcceso`. */
export function EstiloInvitar() {
  return <style dangerouslySetInnerHTML={{ __html: CSS }} />;
}

// ⚠️ NINGÚN BACKTICK ACÁ ADENTRO, ni en un comentario: cierra la cadena a la mitad.
const CSS = `
.ia-celda{ display:inline-flex; align-items:center; gap:8px; }
.ia-frase{ font-size:var(--fs-meta); color:var(--dim); max-width:240px; overflow:hidden; text-overflow:ellipsis; white-space:nowrap; }
.ia-mal{ max-width:200px; overflow:hidden; text-overflow:ellipsis; white-space:nowrap; }
`;
