'use client';

// =============================================================================
// Identidades fiscales en el teléfono: la lista y la hoja de cada una (Mercado Pago y Amazon en el celular)
// =============================================================================
// Las acciones de la computadora: guardar (con id edita, sin id crea; marcar «Default» desmarca el resto) y borrar.
// La lista viene del server: después de guardar, `router.refresh()` la vuelve a leer, y el `key` con el contenido
// re-siembra lo que se dibuja (un useState sembrado de props no se resiembra solo: AGENTS.md).
// =============================================================================

import { useEffect, useState } from 'react';
import { Button } from '@/app/_ui/Button';
import { useRouter } from '@/app/_ui/Link';
import { haptico } from '@/lib/haptico';
import { deleteIdentidadFiscalAction, saveIdentidadFiscalAction, type IdentidadFiscal } from '@/app/crm/[id]/deal-actions';
import { ErrorM, FilaM, InterruptorM, ListaM, PieM, PildoraM, SeccionM, SheetM, VacioM, useToastM } from '@/app/m/_ui';

type Form = { id: number | null; nombre: string; idFiscal: string; domicilio: string; correo: string; esDefault: boolean };
const VACIO: Form = { id: null, nombre: '', idFiscal: '', domicilio: '', correo: '', esDefault: false };
const deIdentidad = (x: IdentidadFiscal): Form => ({
  id: x.id, nombre: x.nombre, idFiscal: x.id_fiscal ?? '', domicilio: x.domicilio ?? '', correo: x.correo ?? '', esDefault: x.es_default,
});

export function FiscalM({ identidades }: { identidades: IdentidadFiscal[] | null }) {
  const router = useRouter();
  const toast = useToastM();
  const [form, setForm] = useState<Form | null>(null);
  const [ocupado, setOcupado] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [confirmar, setConfirmar] = useState(false);
  // El sub-estado se resetea al ABRIR (LEEME de app/m/_ui), nunca al cerrar.
  const abrir = (f: Form) => { setForm(f); setError(null); setConfirmar(false); };

  if (identidades == null) return <ErrorM frase="No se pudieron leer tus identidades fiscales." />;

  const guardar = async () => {
    if (!form || ocupado) return;
    if (!form.nombre.trim()) { setError('Falta la razón social'); return; }
    setOcupado(true); setError(null);
    try {
      await saveIdentidadFiscalAction({
        id: form.id, nombre: form.nombre, id_fiscal: form.idFiscal || null, domicilio: form.domicilio || null,
        correo: form.correo || null, es_default: form.esDefault,
      });
      haptico('success'); toast('Guardada');
      setForm(null);
      router.refresh();
    } catch (e) {
      haptico('error'); setError(e instanceof Error ? e.message : 'No se pudo guardar.');
    } finally { setOcupado(false); }
  };
  const borrar = async () => {
    if (!form?.id || ocupado) return;
    setOcupado(true);
    try {
      await deleteIdentidadFiscalAction(form.id);
      haptico('success'); toast('Borrada');
      setForm(null);
      router.refresh();
    } catch (e) {
      haptico('error'); setError(e instanceof Error ? e.message : 'No se pudo borrar.');
    } finally { setOcupado(false); }
  };

  return (
    <>
      {identidades.length === 0 ? (
        <VacioM frase="Todavía no cargaste una identidad fiscal. Es la razón social con la que facturas." />
      ) : (
        <SeccionM titulo="Con las que facturas">
          <ListaM>
            {identidades.map((x) => (
              <FilaM key={x.id} titulo={x.nombre} segunda={x.id_fiscal ?? x.correo ?? undefined}
                pill={x.es_default ? <PildoraM tono="info">Default</PildoraM> : undefined}
                onClick={() => abrir(deIdentidad(x))} />
            ))}
          </ListaM>
        </SeccionM>
      )}
      <ListaM>
        <FilaM navegacion icono="plus" titulo="Agregar una identidad" chevron={false}
          onClick={() => abrir({ ...VACIO, esDefault: identidades.length === 0 })} />
      </ListaM>

      <SheetM id="identidad" abierto={form != null} onCerrar={() => setForm(null)} ocupado={ocupado} snap="alto"
        titulo={form?.id ? 'Identidad fiscal' : 'Nueva identidad fiscal'} rotuloCerrar="Cerrar sin guardar"
        pie={form ? (
          <PieM consecuencia={confirmar ? 'Se borra de la lista. Las facturas ya hechas no cambian.' : undefined}>
            {confirmar
              ? <Button variant="danger" size="lg" full loading={ocupado} onClick={() => { void borrar(); }}>Borrar esta identidad</Button>
              : <Button variant="primary" size="lg" full loading={ocupado} onClick={() => { void guardar(); }}>Guardar</Button>}
            {form.id != null && !confirmar && (
              <button type="button" className="m-configuraciones-borrar" disabled={ocupado} onClick={() => setConfirmar(true)}>Borrar</button>
            )}
          </PieM>
        ) : undefined}>
        {form && <CamposFiscal form={form} onCambio={(f) => { setForm(f); setError(null); }} />}
        {error && <p className="m-configuraciones-aviso" data-tono="bad" role="alert">{error}</p>}
      </SheetM>
    </>
  );
}

function CamposFiscal({ form, onCambio }: { form: Form; onCambio: (f: Form) => void }) {
  // Los rótulos de la computadora (`Campo` de IdentidadesFiscalesPanel.tsx).
  const [f, setF] = useState(form);
  useEffect(() => { setF(form); }, [form]);
  const cambiar = (parcial: Partial<Form>) => { const n = { ...f, ...parcial }; setF(n); onCambio(n); };
  return (
    <>
      <label className="m-configuraciones-campo">
        <span>Razón social / nombre</span>
        <input className="m-configuraciones-entrada" value={f.nombre} autoComplete="organization" onChange={(e) => cambiar({ nombre: e.target.value })} />
      </label>
      <label className="m-configuraciones-campo">
        <span>Identificación fiscal (RFC, CUIT, NIT, EIN…)</span>
        <input className="m-configuraciones-entrada" value={f.idFiscal} autoCapitalize="characters" onChange={(e) => cambiar({ idFiscal: e.target.value })} />
      </label>
      <label className="m-configuraciones-campo">
        <span>Domicilio fiscal</span>
        <textarea className="m-configuraciones-entrada" rows={3} value={f.domicilio} autoComplete="street-address" onChange={(e) => cambiar({ domicilio: e.target.value })} />
      </label>
      <label className="m-configuraciones-campo">
        <span>Correo</span>
        <input className="m-configuraciones-entrada" type="email" inputMode="email" autoCapitalize="none" value={f.correo} onChange={(e) => cambiar({ correo: e.target.value })} />
      </label>
      <ListaM>
        <FilaM titulo="Default" segunda="La que se usa si no eliges otra"
          control={<InterruptorM etiqueta="Default" activo={f.esDefault} onCambio={(v) => cambiar({ esDefault: v })} />} />
      </ListaM>
    </>
  );
}
