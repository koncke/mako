'use client';

// =============================================================================
// CustomerSuccessM — la entrega como lista agrupada, y el sheet de un cliente
// =============================================================================
// Prototipo: docs/prototipos/mako-mobile-v2.html, data-ir="cs" y la plantilla «t-cliente».
//
//   [Servicio A | Servicio B]            sólo con más de un servicio
//   Onboarding                      3    una sección por etapa, con su conteo
//     (FR) Fernanda Ríos   hace 2 días
//          Estudio Luma
//   Primeras clases                 1
//     (EN) Emilio Navarro
//          Navarro Bienes Raíces
//          (• 21 días sin moverse)       la píldora con el punto rojo
//
// Sheet del cliente: las etapas (la actual con ✓; tocar otra lo mueve), «Escribirle por
// WhatsApp», «Reenviar la invitación al curso» y abajo «Pasar a <la siguiente>».
//
// ⚠️ MOVER ES `moverEntregaAction`, LA MISMA DE ESCRITORIO, y el DESHACER vuelve a llamar al
// server con la etapa anterior Y SU RELOJ (`relojPrevio`); si no tenía fila, la borra
// (`sacarDeEntregaAction`) y vuelve a la primera por la regla del reparto. Es lo que hace
// `moverEntrega` en app/customer-success/ClientesApp.tsx: revertir sólo la pantalla mentiría.
//
// ⚠️ LO MOVIDO SE PINTA ENCIMA DE LO QUE TRAJO EL SERVER (`MovidosCs`), sin `router.refresh()`:
// la action revalida /customer-success, no esta ruta. Cuando la página vuelve a pedir datos
// (tirar para refrescar) los props son nuevos y el overlay se limpia: manda la base.
// =============================================================================

import { useEffect, useMemo, useState } from 'react';
import { Button } from '@/app/_ui/Button';
import { Icon } from '@/app/_components/icons';
import { haptico } from '@/lib/haptico';
import { relojDeVuelta } from '@/lib/servicio-etapas';
import { moverEntregaAction, sacarDeEntregaAction } from '@/app/customer-success/actions';
import { invitarAlCursoDelProductoAction } from '@/app/customer-success/curso/invitar-actions';
import {
  FilaDatoM, FilaM, ListaM, PieM, PildoraM, SeccionM, SegmentadoM, SheetM, VacioM, useConexion, useToastM,
} from '@/app/m/_ui';
import {
  asignacionCon, claveMov, etapaDe, gruposDe, siguienteEtapa, tiempoDe,
  type ClienteCs, type EtapaCs, type FilaCs, type MovidosCs, type ServicioCs,
} from './reglas';

/** Hasta tres servicios entran en el segmentado; con más, una fila que abre la lista. */
const MAX_SEGMENTADO = 3;

export function CustomerSuccessM({ servicios, clientes }: { servicios: ServicioCs[]; clientes: ClienteCs[] }) {
  const toast = useToastM();
  const { enLinea } = useConexion();

  const [servId, setServId] = useState<number | null>(servicios[0]?.id ?? null);
  const s = servicios.find((x) => x.id === servId) ?? servicios[0] ?? null;

  const [movs, setMovs] = useState<MovidosCs>({});
  /** Invitados en esta sesión (`producto:lead`): su fila pasa a decir «Reenviar». */
  const [invitados, setInvitados] = useState<Record<string, true>>({});
  // Props nuevos = la página volvió a leer la base: lo movido ya está ahí, y manda la base.
  useEffect(() => { setMovs({}); setInvitados({}); }, [servicios]);

  const porId = useMemo(() => new Map(clientes.map((c) => [c.id, c])), [clientes]);
  const nombreDe = (id: number) => porId.get(id)?.nombre ?? 'Sin nombre';

  // El sheet: `clienteId` es el ÚLTIMO abierto (el contenido se queda mientras el sheet baja).
  const [clienteId, setClienteId] = useState<number | null>(null);
  const [abierto, setAbierto] = useState(false);
  const [eligeServicio, setEligeServicio] = useState(false);
  const [ocupado, setOcupado] = useState<string | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [confirmaCurso, setConfirmaCurso] = useState(false);

  if (!s) return <VacioM frase="Todavía no hay servicios para entregar." />;

  const asig = asignacionCon(s, movs);
  const grupos = gruposDe(s, asig, nombreDe);

  const abrir = (id: number) => {
    setClienteId(id);
    setError(null);
    setConfirmaCurso(false);
    setAbierto(true);
  };
  const cerrar = () => { if (!ocupado) setAbierto(false); };

  /** Deshace un movimiento: la etapa y el reloj de antes, o sin fila si no la tenía. */
  const deshacer = (leadId: number, productoId: number, previa: FilaCs | null) => {
    const k = claveMov(productoId, leadId);
    const pedido = previa
      ? moverEntregaAction(leadId, productoId, previa.etapa, previa.desde)
      : sacarDeEntregaAction(leadId, productoId);
    pedido
      .then((r) => {
        if (!r.ok) { haptico('error'); toast('No se pudo deshacer'); return; }
        setMovs((v) => ({ ...v, [k]: previa ? { etapa: previa.etapa, desde: relojDeVuelta(previa.desde) ?? new Date().toISOString() } : null }));
        toast('Deshecho');
      })
      .catch(() => { haptico('error'); toast('No se pudo deshacer'); });
  };

  const mover = async (leadId: number, destino: EtapaCs) => {
    if (ocupado) return;
    if (!enLinea) { toast('Sin conexión'); return; }
    const productoId = s.id;
    // La fila de ANTES, con lo movido encima: es lo que el deshacer repone.
    const previa = asig[leadId] ?? null;
    setOcupado(destino.key);
    setError(null);
    try {
      const r = await moverEntregaAction(leadId, productoId, destino.key);
      if (!r.ok) { haptico('error'); setError(r.error); return; }
      setAbierto(false);
      // Un movimiento que no movió nada no se anuncia ni se pinta.
      if (!r.cambio) return;
      haptico('success');
      setMovs((v) => ({ ...v, [claveMov(productoId, leadId)]: { etapa: r.hacia, desde: new Date().toISOString() } }));
      toast(`En ${r.rotulo}`, { deshacer: () => deshacer(leadId, productoId, previa) });
    } catch {
      haptico('error');
      setError('No se pudo mover. Vuelve a intentar.');
    } finally {
      setOcupado(null);
    }
  };

  const c = clienteId != null ? porId.get(clienteId) ?? null : null;
  const actual = clienteId != null ? etapaDe(s, asig, clienteId) : null;
  const siguiente = siguienteEtapa(s.etapas, actual);
  const cursoBase = clienteId != null ? s.curso?.[clienteId] ?? null : null;
  const curso = cursoBase && clienteId != null && invitados[claveMov(s.id, clienteId)] ? { ...cursoBase, reenviar: true } : cursoBase;

  const invitar = async () => {
    if (!c || !curso || ocupado) return;
    if (!enLinea) { toast('Sin conexión'); return; }
    const productoId = s.id;
    setOcupado('curso');
    setError(null);
    try {
      const r = await invitarAlCursoDelProductoAction(c.id, productoId, curso.email);
      if (!r.ok) { haptico('error'); setError(r.error); return; }
      // El acceso pudo nacer aunque el mail no saliera: lo que se dice sale de `enviado`.
      if (!r.enviado) { haptico('error'); setError(r.aviso.texto); return; }
      haptico('success');
      setInvitados((v) => ({ ...v, [claveMov(productoId, c.id)]: true }));
      setConfirmaCurso(false);
      setAbierto(false);
      toast(r.aviso.tono === 'warn' ? 'Enviada, sin anotar' : 'Invitación enviada');
    } catch {
      haptico('error');
      setError('No se pudo enviar. Vuelve a intentar.');
    } finally {
      setOcupado(null);
    }
  };

  const pie = confirmaCurso && curso ? (
    <PieM consecuencia={`Le llega a ${curso.email}.`}>
      <Button variant="primary" size="lg" full loading={ocupado === 'curso'} onClick={invitar}>
        {curso.reenviar ? 'Reenviar la invitación' : 'Enviar la invitación'}
      </Button>
      <Button variant="tertiary" size="lg" full disabled={!!ocupado} onClick={() => setConfirmaCurso(false)}>
        {curso.reenviar ? 'No reenviar' : 'No enviar'}
      </Button>
    </PieM>
  ) : siguiente && c ? (
    <PieM>
      <Button variant="primary" size="lg" full loading={ocupado === siguiente.key} disabled={!!ocupado && ocupado !== siguiente.key}
        onClick={() => mover(c.id, siguiente)}>
        {`Pasar a ${siguiente.label}`}
      </Button>
    </PieM>
  ) : undefined;

  const varios = servicios.length > 1;

  return (
    <div className="m-cs">
      {varios && servicios.length <= MAX_SEGMENTADO && (
        <div className="m-cs-seg">
          <SegmentadoM etiqueta="Servicio" valor={String(s.id)} onCambio={(v) => setServId(Number(v))}
            opciones={servicios.map((x) => ({ id: String(x.id), label: x.nombre }))} />
        </div>
      )}
      {varios && servicios.length > MAX_SEGMENTADO && (
        <div className="m-cs-seg">
          <ListaM>
            <FilaDatoM k="Servicio" v={s.nombre} azul onClick={() => setEligeServicio(true)} />
          </ListaM>
        </div>
      )}

      {!s.etapas.length ? (
        <VacioM frase="Este servicio no tiene etapas." />
      ) : !s.miembros.length ? (
        <VacioM frase="Todavía no hay clientes en este servicio." />
      ) : grupos.map((g) => (
        <SeccionM key={g.key} id={`m-cs-${g.key}`} titulo={g.label}
          accion={<span className="m-cs-n" aria-label={`${g.ids.length} ${g.ids.length === 1 ? 'cliente' : 'clientes'}`}>{g.ids.length}</span>}>
          {/* Una etapa vacía queda con su 0 en el título y sin caja: escritorio sacó el «Sin
              clientes.» de la columna vacía (05/10/2026) porque repetía el único dato que había. */}
          {g.ids.length > 0 && (
            <ListaM etiqueta={g.label}>
              {g.ids.map((id) => {
                const cli = porId.get(id);
                const t = tiempoDe(asig[id]);
                return (
                  <FilaM
                    key={id}
                    avatar={nombreDe(id)}
                    titulo={nombreDe(id)}
                    segunda={cli?.empresa ?? undefined}
                    riel={t && !t.trabado ? t.texto : undefined}
                    pill={t?.trabado ? <PildoraM tono="bad">{t.texto}</PildoraM> : undefined}
                    onClick={() => abrir(id)}
                  />
                );
              })}
            </ListaM>
          )}
        </SeccionM>
      ))}

      <SheetM id="cliente" abierto={abierto} onCerrar={cerrar} titulo={c?.nombre ?? 'Cliente'} snap="alto"
        ocupado={!!ocupado} pie={pie} rotuloCerrar="Cerrar el cliente">
        {error && <p className="m-cs-error" role="alert">{error}</p>}
        {c && (
          <>
            <ListaM etiqueta="Etapas">
              {s.etapas.map((e) => (e.key === actual ? (
                <FilaM key={e.key} titulo={e.label} navegacion etiqueta={`${e.label}, etapa actual`}
                  riel={<span className="m-cs-check"><Icon name="check" size={20} /></span>} />
              ) : (
                <FilaM key={e.key} titulo={e.label} navegacion chevron={false}
                  deshabilitada={!!ocupado && ocupado !== e.key}
                  riel={ocupado === e.key ? <span className="mk-spin m-cs-spin" aria-label="Moviendo" /> : undefined}
                  onClick={() => mover(c.id, e)} etiqueta={`Pasar a ${e.label}`} />
              )))}
            </ListaM>
            {(c.wa || curso) && (
              <ListaM>
                {c.wa && <FilaM icono="whatsapp" titulo="Escribirle por WhatsApp" navegacion href={c.wa} />}
                {curso && (
                  <FilaM icono="email" navegacion chevron={false} deshabilitada={!!ocupado}
                    titulo={curso.reenviar ? 'Reenviar la invitación al curso' : 'Invitar al curso'}
                    onClick={() => { setError(null); setConfirmaCurso(true); }} />
                )}
              </ListaM>
            )}
          </>
        )}
      </SheetM>

      {servicios.length > MAX_SEGMENTADO && (
        <SheetM id="servicio" abierto={eligeServicio} onCerrar={() => setEligeServicio(false)} titulo="Servicio" rotuloCerrar="Cerrar los servicios">
          <ListaM>
            {servicios.map((x) => (
              <FilaM key={x.id} titulo={x.nombre} navegacion chevron={false}
                riel={x.id === s.id ? <span className="m-cs-check"><Icon name="check" size={20} /></span> : String(x.miembros.length)}
                onClick={() => { setServId(x.id); setEligeServicio(false); }} />
            ))}
          </ListaM>
        </SheetM>
      )}
    </div>
  );
}
