'use client';

// =============================================================================
// EtapasModal — el embudo entero se edita SIN salir del CRM
// =============================================================================
// Pedido de Martín (28/09/2026): «Quiero eliminar la ruta de funnel, que todo se edite
// como un pop-up dentro del mismo CRM. Así es más simple. Y que sea simple la edición,
// nada compleja».
//
// ⚠️ NO ES `FunnelEditor` ADENTRO DE UN `Modal`, y esa era la salida barata. Ese editor
// son 527 líneas: dibuja el mapa de transiciones, las plantillas de canal y la tarjeta de
// entradas, autoguarda el jsonb ENTERO con un debounce por tecla, y asume que es la
// pantalla (`<main>`, altos en `vh`, su propia URL). Meterlo en una caja habría traído las
// seis decisiones de «Montar una PANTALLA adentro de un modal» y, sobre todo, habría
// contestado lo contrario de lo que se pidió: más simple, no lo mismo en una ventana más
// chica. El editor completo sigue vivo en /onboarding y /second-brain, que es donde se
// configura el negocio entero.
//
// ⚠️ Y CADA CAMBIO ES UNA OPERACIÓN PROPIA, no un «Guardar» al final. El pipeline crudo
// vive en el server (el tablero recibe las etapas ya DERIVADAS), así que mandar una lista
// reconstruida desde esta pantalla le haría perder todo lo que la derivación agrega. Se
// pide «renombra ésta», «sube ésta», «apagá esta nutrición», y el server parcha el
// original — el mismo contrato que ya usa el menú «···» de cada columna.
//
// ── Lo que cambió el 29/09/2026, con el pedido de Martín al lado ─────────────────────
//  2. «No está la edición de NUTRICIÓN dentro de la edición del funnel, te propongo que
//     sea otra subtab dentro del modal» → las dos subtabs de abajo.
//  3. «Haz que el modal sea más ancho» → 760.
//  4. «Falta la opción de ELIMINAR, renombrar, los funnel» → el pie de la subtab Etapas.
//  5. «Que no aparezcan en el editable las etapas que no se puedan editar» → las cuatro
//     terminales salieron de la lista que se reordena y viven en su propio bloque, más
//     abajo y más apagado. Siguen renombrándose, que es lo que él mismo decidió el 28/09.
//  6. «Junto con editar el nombre del funnel/producto» → el título es un campo.
//  7. «Elimina los textos innecesarios, como "Cada cambio se guarda al momento"» → se fue,
//     y el botón dejó de llamarse «Listo» para no prometer un guardado que no hace.

import { useCallback, useEffect, useState, useTransition } from 'react';
import { useRouter, useWs } from '@/app/_ui/Link';
import { conWs } from '@/lib/ws-tab';
import { Modal } from '@/app/_ui/Modal';
import { MAX_LABEL_ETAPA } from '@/lib/pipeline';
import { EmbudoEntradas } from './EmbudoEntradas';
import {
  editarEtapaAction, embudoEnDetalleAction, renombrarEmbudoAction, archivarEmbudoAction,
  type EmbudoEnDetalle, type EtapaDelFunnel, type OpEtapa,
} from './actions';

const SANS = "'Geist', sans-serif";
const MONO = "'Geist Mono', monospace";

/** El botoncito de una acción por fila. Sin texto: el `aria-label` lleva la frase. */
function AccionFila({ etiqueta, onClick, disabled, children }: {
  etiqueta: string;
  onClick: () => void;
  disabled?: boolean;
  children: React.ReactNode;
}) {
  return (
    <button
      type="button"
      onClick={onClick}
      disabled={disabled}
      aria-label={etiqueta}
      title={etiqueta}
      style={{
        width: 28, height: 28, flex: 'none', display: 'inline-flex', alignItems: 'center', justifyContent: 'center',
        borderRadius: 8, border: '1px solid transparent', background: 'transparent', fontFamily: SANS, fontSize: 13,
        color: disabled ? 'var(--faint)' : 'var(--dim)', cursor: disabled ? 'default' : 'pointer', opacity: disabled ? 0.45 : 1,
      }}
    >
      {children}
    </button>
  );
}

/** El rótulo chico que encabeza un bloque. */
function Rotulo({ children }: { children: React.ReactNode }) {
  return (
    <span style={{ display: 'block', fontFamily: MONO, fontSize: 10.5, letterSpacing: '.09em', textTransform: 'uppercase', color: 'var(--faint)', marginBottom: 8 }}>
      {children}
    </span>
  );
}

type Sub = 'etapas' | 'nutricion' | 'entradas';

export function EtapasModal({ funnelId, nombre, subInicial, onCerrar }: {
  /** El embudo que se edita. `null`/`undefined` = el del negocio. */
  funnelId?: number | null;
  /** Cómo se llama, para no pintar la caja vacía mientras carga. */
  nombre: string;
  /** Con qué subtab abre. La pide la URL (`?embudo=entradas`) para que un link pueda
   *  llevar a una configuración y no sólo a una pantalla. */
  subInicial?: Sub;
  onCerrar: () => void;
}) {
  const router = useRouter();
  const ws = useWs();
  const [sub, setSub] = useState<Sub>(subInicial ?? 'etapas');
  const [emb, setEmb] = useState<EmbudoEnDetalle | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [renombrando, setRenombrando] = useState<string | null>(null);
  const [borrar, setBorrar] = useState<EtapaDelFunnel | null>(null);
  const [eliminarEmbudo, setEliminarEmbudo] = useState(false);
  const [trabajando, startTrabajo] = useTransition();

  const cargar = useCallback(async () => {
    const r = await embudoEnDetalleAction(funnelId ?? undefined);
    if (!r.ok) { setError(r.error); return; }
    setError(null);
    setEmb(r.embudo);
  }, [funnelId]);

  useEffect(() => { void cargar(); }, [cargar]);

  const aplicar = (op: OpEtapa) => {
    startTrabajo(async () => {
      const r = await editarEtapaAction(op, funnelId ?? undefined);
      if (!r.ok) { setError(r.error); return; }
      setError(null);
      setRenombrando(null);
      setBorrar(null);
      await cargar();
      // ⚠️ EL TABLERO DE ATRÁS SE REFRESCA EN CADA CAMBIO, no al cerrar. Las columnas se
      // leen en el server: sin esto, quien renombra una etapa y mira detrás del pop-up ve
      // el nombre viejo, que es exactamente «le di y no pasó nada».
      router.refresh();
    });
  };

  const guardarNombreEtapa = (e: EtapaDelFunnel, valor: string) => {
    const limpio = valor.trim();
    // Sin cambio no se escribe: el `onBlur` también salta al apretar Escape o al hacer
    // clic afuera, y un guardado por cada foco perdido es ruido en el historial.
    if (!limpio || limpio === e.label) { setRenombrando(null); return; }
    aplicar({ op: 'renombrar', key: e.key, label: limpio });
  };

  const guardarNombreEmbudo = (valor: string) => {
    const limpio = valor.trim();
    if (!emb || !limpio || limpio === emb.nombre) return;
    startTrabajo(async () => {
      const r = await renombrarEmbudoAction(funnelId ?? null, limpio);
      if (!r.ok) { setError(r.error); return; }
      setError(null);
      await cargar();
      router.refresh();
    });
  };

  const confirmarEliminar = () => {
    if (funnelId == null) return;
    startTrabajo(async () => {
      const r = await archivarEmbudoAction(funnelId);
      if (!r.ok) { setError(r.error); return; }
      // ⚠️ NAVEGACIÓN DURA, NO `router.refresh()`. Medido en el navegador el 29/09/2026: con
      // `push('/crm') + refresh()` la lista del selector quedaba SIEMPRE UN PASO ATRÁS —tras
      // eliminar seguía mostrando el embudo, y tras recuperarlo mostraba la lista de antes de
      // recuperarlo— mientras la base decía la verdad en las dos. Esperé 4 s y no alcanzó.
      //
      // Acá lo que cambió no es una fila del tablero: es QUÉ EMBUDOS EXISTEN, que es el dato
      // del que cuelga media pantalla. Un borrado que parece no haber pasado es peor que uno
      // lento, así que se paga la recarga entera y se ve la verdad.
      //
      // ⚠️ Y VA CON `conWs`: es la cuarta forma de navegar de AGENTS.md, y sin el `?ws=` el
      // super admin que está mirando a un cliente termina en SU propio CRM.
      window.location.href = conWs('/crm', ws);
    });
  };

  const etapas = emb?.etapas ?? [];
  const ultima = etapas.length - 1;

  return (
    <Modal
      titulo={
        // ⚠️ EL TÍTULO ES UN CAMPO: «Junto con editar el nombre del funnel/producto». Editar
        // el nombre en el lugar donde se lee es un paso menos que un modal adentro del modal,
        // y acá la caja ya es el detalle de ESTE embudo.
        //
        // Ojo con lo que se escribe: si el embudo tiene producto principal, esto renombra el
        // PRODUCTO y no el funnel — la pantalla muestra el del producto, así que tocar el
        // otro sería un guardado que funciona y no se ve.
        <input
          defaultValue={emb?.nombre ?? nombre}
          key={emb?.nombre ?? nombre}
          maxLength={60}
          aria-label="Nombre del embudo"
          onBlur={(e) => guardarNombreEmbudo(e.target.value)}
          onKeyDown={(e) => { if (e.key === 'Enter') (e.target as HTMLInputElement).blur(); }}
          style={{
            width: '100%', fontFamily: SANS, fontWeight: 600, fontSize: 21, letterSpacing: '-0.01em',
            color: 'var(--ink)', background: 'transparent', border: '1px solid transparent',
            borderRadius: 8, padding: '2px 8px', margin: '0 0 0 -8px', outline: 'none',
          }}
          onFocus={(e) => { e.target.style.background = 'var(--surface-2)'; e.target.style.borderColor = 'var(--primary)'; }}
          onBlurCapture={(e) => { e.target.style.background = 'transparent'; e.target.style.borderColor = 'transparent'; }}
        />
      }
      ancho={760}
      // ⚠️ EL ALTO ES UN NÚMERO, NO UN TOPE, y es una regla que Martín ya reclamó dos veces:
      // «JAMÁS achiques el tamaño de un detail según lo que contenga dentro». Las dos subtabs
      // miden cosas muy distintas —«Etapas» son diez filas y «Nutrición» pueden ser dos— así
      // que con el `max-height` del primitive la caja saltaría de 620 px a 260 al tocar una
      // pastilla, y el borde que se mueve se lleva puesto lo que cuelga adentro.
      //
      // El `min()` con el viewport sigue: una caja más alta que la ventana deja el pie afuera.
      alto="min(85vh, 620px)"
      // El título es un `<input>`, así que el lector de pantalla necesita el nombre aparte.
      etiqueta={`Editar el embudo ${emb?.nombre ?? nombre}`}
      onCerrar={onCerrar}
      pie={(
        // ⚠️ «Cerrar», NO «Listo». Se fue el renglón que decía «Cada cambio se guarda al
        // momento» («elimina los textos innecesarios») y sin él un botón que dice «Listo» se
        // lee como «Guardar»: quien cierre con la cruz creería que perdió lo que hizo. El
        // rótulo del botón cuesta una palabra; el renglón costaba una frase.
        <button type="button" onClick={onCerrar}
          style={{ padding: '11px 22px', borderRadius: 10, border: 'none', background: 'var(--primary)', color: '#fff', fontSize: 14, fontWeight: 700, cursor: 'pointer', fontFamily: SANS }}>
          Cerrar
        </button>
      )}
    >
      {/* Las dos subtabs. «Te propongo que sea otra subtab dentro del modal». */}
      <div style={{ display: 'inline-flex', background: 'var(--surface-2)', border: '1px solid var(--border)', borderRadius: 999, padding: 3, marginBottom: 18 }}>
        {/* ⚠️ TRES SUBTABS, y la tercera llegó el 29/09/2026 cuando Martín pidió eliminar
            TAMBIÉN el editor completo de /onboarding: «Tienes que eliminar esto, ya te lo
            habia pedido». Con esa pantalla fuera, «¿cómo entra tu gente?» se quedaba sin
            ningún lugar — y lo leen los audios, el ensayo, las secuencias, el generador de
            landings y el estructurador de campañas. El corte entre las tres es por PREGUNTA:
            por dónde PASA un lead, qué se le manda cuando se enfría, y cómo LLEGÓ. */}
        {([['etapas', 'Etapas'], ['nutricion', 'Nutrición'], ['entradas', 'Cómo entran']] as Array<[Sub, string]>).map(([k, txt]) => (
          <button key={k} type="button" onClick={() => setSub(k)}
            style={{
              border: 'none', background: sub === k ? 'var(--surface)' : 'transparent',
              color: sub === k ? 'var(--ink)' : 'var(--dim)', fontWeight: sub === k ? 600 : 500,
              fontSize: 13.5, padding: '7px 16px', borderRadius: 999, cursor: 'pointer', fontFamily: SANS,
              boxShadow: sub === k ? '0 1px 2px rgba(18,21,27,.08)' : 'none',
            }}>
            {txt}
          </button>
        ))}
      </div>

      {!emb && !error && <p style={{ fontSize: 13.5, color: 'var(--dim)', margin: 0 }}>Cargando…</p>}

      {emb && sub === 'etapas' && (
        <>
          {/* ⚠️ AVISA, NO BLOQUEA, y va ARRIBA de las etapas. Es la decisión del 17/09:
              guardar nunca se bloquea, y lo que falta queda pendiente. Lo que no puede es
              que el embudo quede roto Y CALLADO — el caso real fue una inmobiliaria que tipó
              su descarte como «cierre», y con eso el sistema le pedía el MONTO DE LA VENTA
              para descalificar a alguien, sin que nada fallara nunca.

              Debajo de la lista no lo lee nadie: para cuando alguien llega ahí ya tocó lo
              que venía a tocar. */}
          {emb.problemas.length > 0 && (
            <div style={{ display: 'grid', gap: 6, marginBottom: 12 }}>
              {emb.problemas.map((t) => (
                <p key={t} style={{ margin: 0, padding: '9px 12px', borderRadius: 10, border: '1px solid var(--warn-fill)', background: 'var(--warn-bg)', color: 'var(--warn)', fontSize: 13, lineHeight: 1.5 }}>{t}</p>
              ))}
            </div>
          )}
          <div style={{ display: 'flex', flexDirection: 'column', gap: 4 }}>
            {etapas.map((e, i) => (
              <div key={e.key}
                style={{ display: 'flex', alignItems: 'center', gap: 8, padding: '7px 8px 7px 11px', borderRadius: 10, border: '1px solid var(--border)', background: 'var(--surface-2)' }}>
                <span style={{ width: 9, height: 9, flex: 'none', borderRadius: '50%', background: e.dot }} />
                {renombrando === e.key ? (
                  <input
                    autoFocus
                    defaultValue={e.label}
                    maxLength={MAX_LABEL_ETAPA}
                    onBlur={(ev) => guardarNombreEtapa(e, ev.target.value)}
                    onKeyDown={(ev) => {
                      if (ev.key === 'Enter') (ev.target as HTMLInputElement).blur();
                      if (ev.key === 'Escape') setRenombrando(null);
                    }}
                    style={{ flex: 1, minWidth: 0, fontFamily: SANS, fontWeight: 600, fontSize: 14, color: 'var(--ink)', background: 'var(--surface)', border: '1px solid var(--primary)', borderRadius: 7, padding: '4px 8px', outline: 'none' }}
                  />
                ) : (
                  <button
                    type="button"
                    onClick={() => setRenombrando(e.key)}
                    title={`Cambiar el nombre de ${e.label}`}
                    style={{ flex: 1, minWidth: 0, textAlign: 'left', fontFamily: SANS, fontWeight: 600, fontSize: 14, color: 'var(--ink)', background: 'none', border: 'none', padding: '4px 0', cursor: 'pointer', whiteSpace: 'nowrap', overflow: 'hidden', textOverflow: 'ellipsis' }}
                  >
                    {e.label}
                  </button>
                )}
                {/* La última etapa propia no puede bajar: el intercambio sería contra el
                    cierre, que va último, y el server lo rechaza siempre. Un botón que se
                    puede apretar y nunca funciona se lee como que la app está rota. */}
                <AccionFila etiqueta={`Subir ${e.label}`} disabled={trabajando || i === 0}
                  onClick={() => aplicar({ op: 'mover', key: e.key, delta: -1 })}>↑</AccionFila>
                <AccionFila etiqueta={`Bajar ${e.label}`} disabled={trabajando || i === ultima}
                  onClick={() => aplicar({ op: 'mover', key: e.key, delta: 1 })}>↓</AccionFila>
                <AccionFila etiqueta={`Quitar ${e.label}`} disabled={trabajando}
                  onClick={() => setBorrar(e)}>✕</AccionFila>
              </div>
            ))}

            <button
              type="button"
              disabled={trabajando}
              onClick={() => aplicar({ op: 'agregar' })}
              style={{ marginTop: 6, padding: '10px 12px', borderRadius: 10, border: '1px dashed var(--border-strong)', background: 'none', color: 'var(--dim)', fontFamily: SANS, fontSize: 13.5, fontWeight: 600, cursor: trabajando ? 'default' : 'pointer', textAlign: 'left' }}
            >
              + Agregar etapa
            </button>
          </div>

          {/* ⚠️ LAS CUATRO TERMINALES, FUERA DE LA LISTA QUE SE REORDENA. Pedido de Martín
              (29/09): «que no aparezcan en el editable las etapas que no se puedan editar».
              No se borran del pop-up —el 28/09 decidió que están siempre y que SÍ se les
              puede cambiar el nombre— pero dejan de ocupar la mitad de la lista con seis
              botones apagados, que es lo que se veía. Acá son sólo nombres, clicables. */}
          {emb.fijas.length > 0 && (
            <div style={{ marginTop: 22 }}>
              <Rotulo>En todos tus embudos</Rotulo>
              <div style={{ display: 'flex', flexWrap: 'wrap', gap: 6 }}>
                {emb.fijas.map((e) => (
                  renombrando === e.key ? (
                    <input
                      key={e.key}
                      autoFocus
                      defaultValue={e.label}
                      maxLength={MAX_LABEL_ETAPA}
                      onBlur={(ev) => guardarNombreEtapa(e, ev.target.value)}
                      onKeyDown={(ev) => {
                        if (ev.key === 'Enter') (ev.target as HTMLInputElement).blur();
                        if (ev.key === 'Escape') setRenombrando(null);
                      }}
                      style={{ width: 170, fontFamily: SANS, fontWeight: 600, fontSize: 13, color: 'var(--ink)', background: 'var(--surface)', border: '1px solid var(--primary)', borderRadius: 999, padding: '5px 11px', outline: 'none' }}
                    />
                  ) : (
                    <button
                      key={e.key}
                      type="button"
                      onClick={() => setRenombrando(e.key)}
                      title={`Cambiar el nombre de ${e.label}. Esta etapa está en todos tus embudos y no se puede quitar.`}
                      style={{ display: 'inline-flex', alignItems: 'center', gap: 7, padding: '5px 12px', borderRadius: 999, border: '1px solid var(--border)', background: 'var(--surface-2)', color: 'var(--dim)', fontFamily: SANS, fontSize: 13, fontWeight: 600, cursor: 'pointer' }}
                    >
                      <span style={{ width: 8, height: 8, borderRadius: '50%', background: e.dot }} />
                      {e.label}
                    </button>
                  )
                ))}
              </div>
            </div>
          )}

          {/* Eliminar el embudo. Va al fondo y apagado: es lo último que alguien viene a
              hacer acá, y ponerlo arriba lo vuelve un botón que se aprieta sin querer. */}
          {!emb.esDefault && funnelId != null && !eliminarEmbudo && (
            <div style={{ marginTop: 24, paddingTop: 16, borderTop: '1px solid var(--border)' }}>
              <button type="button" onClick={() => setEliminarEmbudo(true)}
                style={{ padding: '8px 14px', borderRadius: 9, border: '1px solid var(--border-strong)', background: 'none', color: 'var(--bad)', fontFamily: SANS, fontSize: 13.5, fontWeight: 600, cursor: 'pointer' }}>
                Eliminar este embudo
              </button>
            </div>
          )}

          {eliminarEmbudo && (
            <div style={{ marginTop: 24, borderRadius: 10, padding: '13px 15px', background: 'var(--surface-2)', border: '1px solid var(--border-strong)' }}>
              {/* ⚠️ LA CONSECUENCIA, PEGADA AL BOTÓN Y CON EL NÚMERO. «Con mucho cuidado si un
                  funnel tiene leads»: el número es lo que convierte esto en una decisión. Y
                  se dice que se PUEDE recuperar, porque es verdad —la fila no se borra— y
                  porque sin eso nadie aprieta. */}
              <p style={{ margin: 0, fontSize: 13.5, color: 'var(--ink)', lineHeight: 1.55 }}>
                Eliminar <strong>{emb.nombre}</strong>.{' '}
                {emb.leads > 0
                  ? <>Sus <strong>{emb.leads} {emb.leads === 1 ? 'lead' : 'leads'}</strong> dejan de verse hasta que lo recuperes.</>
                  : emb.leads === 0
                    ? <>No tiene ningún lead.</>
                    : <>No se pudo contar cuántos leads tiene.</>}{' '}
                Se guarda entero y lo recuperas desde «Embudos eliminados».
              </p>
              <div style={{ display: 'flex', gap: 8, marginTop: 11, justifyContent: 'flex-end' }}>
                <button type="button" onClick={() => setEliminarEmbudo(false)}
                  style={{ padding: '8px 14px', fontSize: 13.5, color: 'var(--dim)', background: 'none', border: 'none', cursor: 'pointer', fontFamily: SANS }}>
                  No eliminarlo
                </button>
                <button type="button" disabled={trabajando} onClick={confirmarEliminar}
                  style={{ padding: '8px 16px', borderRadius: 9, border: 'none', background: 'var(--bad)', color: '#fff', fontSize: 13.5, fontWeight: 700, cursor: trabajando ? 'default' : 'pointer', fontFamily: SANS }}>
                  Eliminar el embudo
                </button>
              </div>
            </div>
          )}
        </>
      )}

      {emb && sub === 'nutricion' && (
        <div style={{ display: 'flex', flexDirection: 'column', gap: 4 }}>
          {emb.nutriciones.length === 0 ? (
            // Un vacío dice qué falta y dónde se arregla, en UNA frase. Y no miente con un
            // comparativo: acá el cero es de verdad cero.
            <p style={{ fontSize: 13.5, color: 'var(--dim)', margin: 0, lineHeight: 1.55 }}>
              Este embudo no tiene nutriciones. Salen de las etapas: agrega una reunión o un
              pago y aparecen solas.
            </p>
          ) : emb.nutriciones.map((n) => (
            <label key={n.id}
              style={{ display: 'flex', alignItems: 'center', gap: 11, padding: '9px 12px', borderRadius: 10, border: '1px solid var(--border)', background: 'var(--surface-2)', cursor: trabajando ? 'default' : 'pointer' }}>
              <input
                type="checkbox"
                checked={n.activa}
                disabled={trabajando}
                onChange={(e) => aplicar({ op: 'nutricion', id: n.id, activa: e.target.checked })}
                style={{ width: 16, height: 16, flex: 'none', accentColor: 'var(--primary)', cursor: trabajando ? 'default' : 'pointer' }}
              />
              <span style={{ minWidth: 0, fontFamily: SANS, fontSize: 14, color: n.activa ? 'var(--ink)' : 'var(--faint)' }}>
                <strong style={{ fontWeight: 600 }}>{n.desdeLabel}</strong>
                <span style={{ color: 'var(--faint)', margin: '0 7px' }}>→</span>
                {n.haciaLabel}
              </span>
            </label>
          ))}
        </div>
      )}

      {emb && sub === 'entradas' && (
        <EmbudoEntradas
          key={`${emb.id}:${emb.entradas.join(",")}`}
          initial={emb.entradas}
          initialEvento={emb.evento}
          canal={emb.canal}
          funnelId={funnelId ?? undefined}
          onGuardado={() => { void cargar(); router.refresh(); }}
        />
      )}

      {borrar && (
        <div style={{ marginTop: 14, borderRadius: 10, padding: '12px 14px', background: 'var(--surface-2)', border: '1px solid var(--border-strong)' }}>
          {/* La consecuencia, pegada al botón y en tinta normal: los leads no se borran,
              se quedan sin columna. Es el dato que decide, y es el que nadie adivina. */}
          <p style={{ margin: 0, fontSize: 13.5, color: 'var(--ink)', lineHeight: 1.5 }}>
            Quitar <strong>{borrar.label}</strong>. Los leads que estén ahí no se borran: quedan fuera del embudo hasta que los muevas.
          </p>
          <div style={{ display: 'flex', gap: 8, marginTop: 10, justifyContent: 'flex-end' }}>
            <button type="button" onClick={() => setBorrar(null)}
              style={{ padding: '8px 14px', fontSize: 13.5, color: 'var(--dim)', background: 'none', border: 'none', cursor: 'pointer', fontFamily: SANS }}>
              No quitarla
            </button>
            <button type="button" disabled={trabajando} onClick={() => aplicar({ op: 'eliminar', key: borrar.key })}
              style={{ padding: '8px 16px', borderRadius: 9, border: 'none', background: 'var(--bad)', color: '#fff', fontSize: 13.5, fontWeight: 700, cursor: trabajando ? 'default' : 'pointer', fontFamily: SANS }}>
              Quitar la etapa
            </button>
          </div>
        </div>
      )}

      {error && (
        <div style={{ marginTop: 12, borderRadius: 10, padding: '10px 14px', fontSize: 13.5, fontWeight: 600, background: 'var(--bad-bg)', color: 'var(--bad)' }}>{error}</div>
      )}
    </Modal>
  );
}
