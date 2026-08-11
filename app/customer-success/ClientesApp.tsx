'use client';

// =============================================================================
// Clients — la cartera del programa
// =============================================================================
// Una FILA por cliente, no una tarjeta: son piezas del mismo tipo y la regla de
// la casa es explícita — tres tarjetas del mismo tamaño apiladas son el
// contenedor perezoso, la caja se gana.
//
// El orden lo decide `cs-cartera.ts` por URGENCIA, y la pantalla no lo toca: si
// acá se pudiera reordenar por nombre, la lista volvería a obligar a leerla
// entera todas las semanas para encontrar los dos que importan.

import { useState } from 'react';
import { Pagina, PageHeader, Button, Status, EmptyState, Modal, Banner, useToast, Toast, MONO } from '@/app/_ui';
import type { ClienteCartera } from '@/lib/cs-cartera';
import { emitirLinkAction, revocarLinksAction } from './actions';

type Emitido = { url: string; nombre: string };

export function ClientesApp({ clientes, totalClases, whopConectado }: {
  clientes: ClienteCartera[];
  totalClases: number;
  whopConectado: boolean;
}) {
  const [emitido, setEmitido] = useState<Emitido | null>(null);
  const [cargando, setCargando] = useState<number | null>(null);
  const [confirmarRotar, setConfirmarRotar] = useState<ClienteCartera | null>(null);
  const { toast, show, clear } = useToast();

  async function emitir(c: ClienteCartera, rotar: boolean) {
    setCargando(c.leadId);
    setConfirmarRotar(null);
    const r = await emitirLinkAction(c.leadId, rotar);
    setCargando(null);
    if (r.ok) setEmitido({ url: r.url, nombre: r.nombre });
    else show(r.error, undefined, 'bad');
  }

  async function revocar(c: ClienteCartera) {
    setCargando(c.leadId);
    const r = await revocarLinksAction(c.leadId);
    setCargando(null);
    show(r.ok ? `El link de ${c.nombre} dejó de andar.` : 'No se pudo revocar.', undefined, r.ok ? 'good' : 'bad');
  }

  const esperando = clientes.reduce((s, c) => s + c.esperandoSuOk, 0);
  const trabados = clientes.reduce((s, c) => s + c.vistosSinContestar, 0);

  return (
    <Pagina ancho="completo">
      <PageHeader
        titulo="Clients"
        proposito={`${clientes.length} en el programa · ${totalClases} bloques cada uno`}
      />

      {!whopConectado && (
        <Banner tono="warn">
          Whop no está conectado, así que MaKo no se entera de quién miró cada clase. Se conecta en Integraciones.
        </Banner>
      )}

      {/* Lo que hay que hacer, arriba y contado. Si no hay nada, no se dice nada:
          un cartel que siempre está deja de leerse. */}
      {(esperando > 0 || trabados > 0) && (
        <div style={{ display: 'flex', gap: 18, flexWrap: 'wrap', margin: '4px 0 18px' }}>
          {esperando > 0 && <Dato n={esperando} que="esperando el ok de tu cliente" tono="mako" />}
          {trabados > 0 && <Dato n={trabados} que="vieron la clase y no contestaron" tono="warn" />}
        </div>
      )}

      {clientes.length === 0 ? (
        <EmptyState
          titulo="Todavía no hay clientes en el programa"
          detalle="Entran solos cuando una venta se marca como ganada en el CRM."
        />
      ) : (
        <ul className="mk-lista-cs">
          {clientes.map((c) => (
            <li key={c.leadId} className="mk-fila-cs">
              <div className="cs-quien">
                <span className="n">{c.nombre}</span>
                {c.email && <span className="e">{c.email}</span>}
              </div>

              <div className="cs-avance">
                <Barra hechos={c.aprobados} contestados={c.contestados} total={totalClases} />
                <span className="cs-cifra">{c.aprobados} de {totalClases} listos</span>
                {c.bloqueActual && <span className="cs-bloque">{c.bloqueActual}</span>}
              </div>

              <div className="cs-estado">
                {c.esperandoSuOk > 0 && <Status tono="mako">{c.esperandoSuOk} esperando su ok</Status>}
                {c.vistosSinContestar > 0 && <Status tono="warn">{c.vistosSinContestar} vistos sin contestar</Status>}
                {c.diasSinTocar === null
                  ? <Status tono="neutral">Sin empezar</Status>
                  : c.diasSinTocar > 7 && <Status tono="bad">{c.diasSinTocar} días sin tocar nada</Status>}
              </div>

              <div className="cs-acciones">
                {c.links > 0 ? (
                  <>
                    <Status tono="good">Con link</Status>
                    <Button size="sm" variant="tertiary" disabled={cargando === c.leadId} onClick={() => setConfirmarRotar(c)}>
                      Emitir uno nuevo
                    </Button>
                    <Button size="sm" variant="tertiary" disabled={cargando === c.leadId} onClick={() => void revocar(c)}>
                      Cortarle el acceso
                    </Button>
                  </>
                ) : (
                  <Button size="sm" disabled={cargando === c.leadId} onClick={() => void emitir(c, false)}>
                    {cargando === c.leadId ? 'Emitiendo…' : 'Darle su link'}
                  </Button>
                )}
              </div>
            </li>
          ))}
        </ul>
      )}

      {/* El token se muestra UNA vez: de la base solo sale su sha256. El modal se
          cierra a mano a propósito — uno que se cierre solo se lleva el link. */}
      {emitido && (
        <Modal titulo={`El link de ${emitido.nombre}`} onCerrar={() => setEmitido(null)}>
          <p style={{ margin: '0 0 14px', lineHeight: 1.55 }}>
            Mandáselo por WhatsApp o por mail. Entra sin cuenta y sin contraseña.
          </p>
          <div className="cs-token">{emitido.url}</div>
          <p style={{ margin: '12px 0 18px', lineHeight: 1.5, color: 'var(--ink-70)' }}>
            <b>Copialo ahora.</b> No se puede volver a ver: de esto solo guardamos una huella,
            así que si se pierde hay que emitir uno nuevo y el anterior deja de andar.
          </p>
          <div style={{ display: 'flex', gap: 10, flexWrap: 'wrap' }}>
            <Button onClick={() => { void navigator.clipboard.writeText(emitido.url); show('Link copiado.', undefined, 'good'); }}>
              Copiar el link
            </Button>
            <Button variant="tertiary" onClick={() => setEmitido(null)}>Ya lo copié</Button>
          </div>
        </Modal>
      )}

      {confirmarRotar && (
        <Modal titulo={`Emitir un link nuevo para ${confirmarRotar.nombre}`} onCerrar={() => setConfirmarRotar(null)}>
          <p style={{ margin: '0 0 18px', lineHeight: 1.55 }}>
            El link que tiene ahora <b>deja de andar</b>. Si ya lo estaba usando para contestar,
            va a tener que entrar por el nuevo. Lo que escribió no se pierde.
          </p>
          <div style={{ display: 'flex', gap: 10, flexWrap: 'wrap' }}>
            <Button onClick={() => void emitir(confirmarRotar, true)}>Emitir el nuevo y cortar el viejo</Button>
            <Button variant="tertiary" onClick={() => setConfirmarRotar(null)}>Dejar el que tiene</Button>
          </div>
        </Modal>
      )}

      <Toast state={toast} onClose={clear} />
      <style dangerouslySetInnerHTML={{ __html: CSS }} />
    </Pagina>
  );
}

function Dato({ n, que, tono }: { n: number; que: string; tono: 'mako' | 'warn' }) {
  return (
    <span className="cs-dato">
      <b style={{ color: tono === 'mako' ? 'var(--mako-ink)' : 'var(--warn)' }}>{n}</b> {que}
    </span>
  );
}

/** El avance como BORDE de la fila, no como barra con ancho propio: una barra
 *  suelta adentro de una lista deja el mismo hueco muerto que un max-width.
 *  Y se recorta al 100% siempre. */
function Barra({ hechos, contestados, total }: { hechos: number; contestados: number; total: number }) {
  const pct = (n: number) => `${Math.min(100, (n / Math.max(1, total)) * 100)}%`;
  return (
    <span className="cs-barra" aria-hidden>
      <span className="c" style={{ width: pct(contestados) }} />
      <span className="a" style={{ width: pct(hechos) }} />
    </span>
  );
}

const CSS = `
.mk-lista-cs{ list-style:none; margin:0; padding:0; }
.mk-fila-cs{ display:grid; gap:10px 20px; align-items:center; padding:15px 2px;
  border-bottom:1px solid var(--border);
  grid-template-columns:1fr; }
@media(min-width:900px){ .mk-fila-cs{ grid-template-columns:minmax(180px,1.3fr) minmax(200px,1.4fr) auto auto; } }
.cs-quien{ display:flex; flex-direction:column; gap:2px; min-width:0; }
.cs-quien .n{ font-weight:650; font-size:15px; }
.cs-quien .e{ font-size:12.5px; color:var(--ink-40); overflow:hidden; text-overflow:ellipsis; }
.cs-avance{ display:flex; flex-direction:column; gap:5px; min-width:0; }
.cs-barra{ display:block; position:relative; height:3px; border-radius:2px; background:var(--ink-15); overflow:hidden; }
.cs-barra .c, .cs-barra .a{ position:absolute; inset:0 auto 0 0; border-radius:2px; }
.cs-barra .c{ background:var(--ink-40); }
.cs-barra .a{ background:var(--lime-ink, var(--good)); }
.cs-cifra{ font-family:${MONO}; font-size:11px; letter-spacing:.06em; color:var(--ink-40); }
.cs-bloque{ font-size:12.5px; color:var(--ink-70); overflow:hidden; text-overflow:ellipsis; white-space:nowrap; }
.cs-estado{ display:flex; gap:6px; flex-wrap:wrap; }
.cs-acciones{ display:flex; gap:6px; flex-wrap:wrap; align-items:center; }
.cs-dato{ font-size:14px; color:var(--ink-70); }
.cs-dato b{ font-size:19px; font-weight:750; margin-right:5px; }
.cs-token{ font-family:${MONO}; font-size:13px; line-height:1.5; word-break:break-all;
  padding:13px 15px; border-radius:9px; background:var(--ink-05, rgba(0,0,0,.04));
  border:1px solid var(--border); }
`;
