'use client';

// =============================================================================
// IdentidadesFiscalesPanel — CRUD de las identidades fiscales del workspace
// =============================================================================
// Se cargan una sola vez acá y después se eligen como "Facturado por" en la tab
// Deal Details de cada lead. Puede haber varias; una puede ser la default.

import { useEffect, useRef, useState, type ReactNode } from 'react';
import { CuerpoGrupo, FilaAjustes, GrupoAjustes, Pastilla } from '../_ui/Ajustes';
import { ReportarASoporte } from '../_ui/ReportarASoporte';
import { ConfirmDialog } from '../_components/ChatItemMenu';
import {
  getIdentidadesFiscalesAction,
  saveIdentidadFiscalAction,
  deleteIdentidadFiscalAction,
  type IdentidadFiscal,
} from '../crm/[id]/deal-actions';



type FormState = {
  id: number | null;
  nombre: string;
  idFiscal: string;
  domicilio: string;
  correo: string;
  esDefault: boolean;
};

function Campo({ label, hint, children }: { label: string; hint?: string; children: ReactNode }) {
  return (
    <label style={{ display: 'block' }}>
      <span className="aj-rotulo">{label}</span>
      {children}
      {hint && <span style={{ display: 'block', fontSize: 11.5, marginTop: 5, color: 'var(--faint)' }}>{hint}</span>}
    </label>
  );
}

export function IdentidadesFiscalesPanel() {
  const [lista, setLista] = useState<IdentidadFiscal[] | null>(null);
  const [form, setForm] = useState<FormState | null>(null);
  const [busy, setBusy] = useState(false);
  const [err, setErr] = useState<string | null>(null);
  const [confirmBorrar, setConfirmBorrar] = useState<IdentidadFiscal | null>(null);
  const [leyendo, setLeyendo] = useState(false);
  const fileRef = useRef<HTMLInputElement | null>(null);

  // Sube el documento fiscal propio (PDF/foto) y prellena el form con lo extraído
  // (solo lo que esté vacío — no pisa lo que ya cargaste).
  const subirDocFiscal = async (file: File) => {
    if (!form) return;
    setErr(null);
    setLeyendo(true);
    try {
      const fd = new FormData();
      fd.append('file', file);
      const r = await fetch('/api/extract-fiscal', { method: 'POST', body: fd });
      const j = await r.json();
      if (j.error) throw new Error(j.error);
      setForm((prev) => prev && ({
        ...prev,
        nombre: prev.nombre.trim() || j.razon || '',
        idFiscal: prev.idFiscal.trim() || j.id_fiscal || '',
        domicilio: prev.domicilio.trim() || j.domicilio || '',
        correo: prev.correo.trim() || j.correo || '',
      }));
    } catch (e) {
      setErr(`No se pudo leer el documento: ${e instanceof Error ? e.message : String(e)}`);
    } finally {
      setLeyendo(false);
      if (fileRef.current) fileRef.current.value = '';
    }
  };

  const cargar = async () => {
    try { setLista(await getIdentidadesFiscalesAction()); }
    catch (e) { setErr(e instanceof Error ? e.message : String(e)); setLista([]); }
  };
  useEffect(() => { void cargar(); }, []);

  const nueva = () => { setErr(null); setForm({ id: null, nombre: '', idFiscal: '', domicilio: '', correo: '', esDefault: (lista ?? []).length === 0 }); };
  const editar = (i: IdentidadFiscal) => { setErr(null); setForm({ id: i.id, nombre: i.nombre, idFiscal: i.id_fiscal ?? '', domicilio: i.domicilio ?? '', correo: i.correo ?? '', esDefault: i.es_default }); };

  const guardar = async () => {
    if (!form || !form.nombre.trim()) return;
    setErr(null);
    setBusy(true);
    try {
      await saveIdentidadFiscalAction({
        id: form.id ?? undefined,
        nombre: form.nombre,
        id_fiscal: form.idFiscal,
        domicilio: form.domicilio,
        correo: form.correo,
        es_default: form.esDefault,
      });
      await cargar();
      setForm(null);
    } catch (e) {
      setErr(e instanceof Error ? e.message : String(e));
    } finally {
      setBusy(false);
    }
  };

  const hacerDefault = async (i: IdentidadFiscal) => {
    setErr(null);
    setBusy(true);
    try {
      await saveIdentidadFiscalAction({ id: i.id, nombre: i.nombre, id_fiscal: i.id_fiscal, domicilio: i.domicilio, correo: i.correo, es_default: true });
      await cargar();
    } catch (e) {
      setErr(e instanceof Error ? e.message : String(e));
    } finally {
      setBusy(false);
    }
  };

  const borrar = async (i: IdentidadFiscal) => {
    setConfirmBorrar(null);
    setErr(null);
    setBusy(true);
    try {
      await deleteIdentidadFiscalAction(i.id);
      await cargar();
    } catch (e) {
      setErr(e instanceof Error ? e.message : String(e));
    } finally {
      setBusy(false);
    }
  };

  // EN EL MOLDE DE SETTINGS (25/10/2026, Martín: «En settings no me gusta el diseño de "... Identidades fiscales..."... Fijate
  // pagina por pagina como lo hacen otras apps»). Era un título suelto y una tarjeta con cajitas grises adentro, los botones como
  // links de colores y un «+ Agregar» punteado. Ahora es una sección (su título y para qué sirve a la izquierda) con UNA FILA por
  // identidad, como las direcciones de facturación de Stripe y Vercel: el nombre con «Por defecto», sus datos debajo y las
  // acciones a la derecha; el formulario se abre en la misma tarjeta y «Agregar» va al pie.
  return (
    <>
      <GrupoAjustes titulo="Identidades fiscales" descripcion="Tus razones sociales. En cada venta del CRM eliges con cuál facturas («Facturado por»)."
        pie={!form && lista !== null ? <button type="button" className="aj-boton" data-variante="borde" onClick={nueva}>Agregar identidad</button> : undefined}>
        {lista === null ? (
          <CuerpoGrupo><p className="aj-texto" style={{ margin: 0 }}>Cargando…</p></CuerpoGrupo>
        ) : lista.length === 0 && !form ? (
          <CuerpoGrupo><p className="aj-texto" style={{ margin: 0 }}>Todavía no cargaste ninguna.</p></CuerpoGrupo>
        ) : lista.map((i) => (
          <FilaAjustes key={i.id} apilada icono="dinero"
            titulo={<>{i.nombre}{i.es_default && <> <Pastilla tono="good">Por defecto</Pastilla></>}</>}
            detalle={[i.id_fiscal, i.correo, i.domicilio].filter(Boolean).join(' · ') || '—'}
            fin={
              <>
                {!i.es_default && <button type="button" className="aj-boton" data-variante="texto" disabled={busy} onClick={() => void hacerDefault(i)}>Usar por defecto</button>}
                <button type="button" className="aj-boton" data-variante="texto" onClick={() => editar(i)}>Editar</button>
                <button type="button" className="aj-boton" data-variante="texto" style={{ color: 'var(--bad)' }} onClick={() => setConfirmBorrar(i)}>Borrar</button>
              </>
            } />
        ))}

        {form && (
          <div className="aj-grupo-cuerpo aj-fiscal-form">
            {/* Subir el documento fiscal propio → IA rellena los campos de abajo. */}
            <input ref={fileRef} type="file" accept=".pdf,image/*" style={{ display: 'none' }} onChange={(e) => { const f = e.target.files?.[0]; if (f) void subirDocFiscal(f); }} />
            <div className="aj-fiscal-form__leer">
              <button type="button" className="aj-boton" data-variante="borde" disabled={leyendo} onClick={() => fileRef.current?.click()}>
                {leyendo ? 'Leyendo documento…' : 'Llenar desde un PDF o una foto'}
              </button>
              <span className="aj-texto" style={{ margin: 0 }}>MaKo lee tu constancia (RFC, CUIT…) y llena lo que esté vacío. Revísalo antes de guardar.</span>
            </div>
            <div className="aj-fiscal-form__campos">
              <Campo label="Razón social o nombre">
                <input className="aj-campo" value={form.nombre} onChange={(e) => setForm({ ...form, nombre: e.target.value })} />
              </Campo>
              <Campo label="Identificación fiscal" hint="RFC, CUIT, NIT, EIN… según el país.">
                <input className="aj-campo" value={form.idFiscal} onChange={(e) => setForm({ ...form, idFiscal: e.target.value })} />
              </Campo>
              <Campo label="Domicilio fiscal">
                <input className="aj-campo" value={form.domicilio} onChange={(e) => setForm({ ...form, domicilio: e.target.value })} />
              </Campo>
              <Campo label="Correo">
                <input className="aj-campo" type="email" value={form.correo} onChange={(e) => setForm({ ...form, correo: e.target.value })} />
              </Campo>
            </div>
            <label className="aj-fiscal-form__defecto">
              <input type="checkbox" checked={form.esDefault} onChange={(e) => setForm({ ...form, esDefault: e.target.checked })} />
              Usarla por defecto
            </label>
            <div className="aj-acciones" style={{ justifyContent: 'flex-end' }}>
              <button type="button" className="aj-boton" data-variante="texto" onClick={() => setForm(null)} disabled={busy}>Cancelar</button>
              <button type="button" className="aj-boton" disabled={busy || !form.nombre.trim()} onClick={() => void guardar()}>
                {busy ? 'Guardando…' : form.id ? 'Guardar cambios' : 'Agregar identidad'}
              </button>
            </div>
          </div>
        )}

        {err && <CuerpoGrupo><p className="aj-error" role="alert" style={{ margin: 0 }}>{err}<ReportarASoporte /></p></CuerpoGrupo>}
      </GrupoAjustes>

      {confirmBorrar && (
        <ConfirmDialog
          titulo="¿Borrar esta identidad?"
          detalle={`"${confirmBorrar.nombre}" se borra del workspace. Los deals que la tenían como Facturado por quedan sin identidad asignada.`}
          confirmLabel="Borrar"
          danger
          onCancel={() => setConfirmBorrar(null)}
          onConfirm={() => void borrar(confirmBorrar)}
        />
      )}
    </>
  );
}
