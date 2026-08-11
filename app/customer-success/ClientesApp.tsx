'use client';

// =============================================================================
// Clients — la cartera del programa
// =============================================================================
// Cards grandes, una por cliente. La regla de la casa dice «lista con filete, no
// pila de cajas», y acá la caja SE GANA: cada una carga cinco cosas distintas
// —quién es, cuánto avanzó, en qué bloque está parado, qué lo traba y su link—
// que en un renglón de tabla no entran sin abreviarlas hasta que dejan de
// leerse. El dueño pidió cards; esto es por qué corresponden.
//
// LA FIRMA: la barra de avance es el BORDE SUPERIOR de la card, a ancho
// completo. No una barrita adentro con margen a los costados —eso deja el hueco
// muerto que la regla del repo prohíbe— sino el filo mismo de la pieza. Se lee
// de reojo, en diagonal, que es como se mira una cartera el lunes a la mañana.
//
// El ORDEN lo decide `cs-cartera.ts` por urgencia y la pantalla no lo toca: si
// acá se pudiera ordenar por nombre, la lista volvería a obligar a leerla entera
// todas las semanas para encontrar los dos que importan.

import { useState } from 'react';
import { Pagina, PageHeader, Button, Modal, Banner, useToast, Toast } from '@/app/_ui';
import type { ClienteCartera } from '@/lib/cs-cartera';
import { emitirLinkAction, revocarLinksAction } from './actions';

type Emitido = { url: string; nombre: string };

/** Las iniciales, para que la card tenga un ancla visual sin pedirle una foto a
 *  nadie. Dos letras: más es un logo, una sola no distingue. */
const iniciales = (n: string) =>
  n.trim().split(/\s+/).slice(0, 2).map(p => p[0] ?? '').join('').toUpperCase();

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
          Whop no está conectado, así que MaKo no se entera de quién miró cada clase.
        </Banner>
      )}

      {/* Lo que hay que hacer, contado. Si no hay nada, no se dice nada: un
          cartel que siempre está deja de leerse. */}
      {(esperando > 0 || trabados > 0) && (
        <p className="cl-titular">
          {esperando > 0 && <><b>{esperando}</b> esperando tu ok</>}
          {esperando > 0 && trabados > 0 && <span className="sep">·</span>}
          {trabados > 0 && <><b>{trabados}</b> vieron la clase y no contestaron</>}
        </p>
      )}

      {clientes.length === 0 ? (
        <div className="cl-vacio">
          <p>Todavía no hay clientes en el programa.</p>
          <p>Entran solos cuando una venta se marca como ganada en el CRM.</p>
        </div>
      ) : (
        <ul className="cl-grid">
          {clientes.map((c) => {
            const pct = Math.min(100, Math.round((c.aprobados / Math.max(1, totalClases)) * 100));
            const pctC = Math.min(100, Math.round((c.contestados / Math.max(1, totalClases)) * 100));
            const urgente = c.esperandoSuOk > 0;
            return (
              <li key={c.leadId} className={`cl-card${urgente ? ' urgente' : ''}`}>
                {/* La firma: el avance ES el borde de arriba. */}
                <span className="cl-filo" aria-hidden>
                  <span className="c" style={{ width: `${pctC}%` }} />
                  <span className="a" style={{ width: `${pct}%` }} />
                </span>

                <div className="cl-quien">
                  <span className="ini" aria-hidden>{iniciales(c.nombre)}</span>
                  <span className="txt">
                    <span className="n">{c.nombre}</span>
                    {c.email && <span className="e">{c.email}</span>}
                  </span>
                </div>

                <p className="cl-cifra">
                  <b>{c.aprobados}</b><span className="de">/{totalClases}</span>
                  <span className="lab">bloques listos</span>
                </p>

                <p className="cl-bloque">
                  {c.bloqueActual
                    ? <>Va por <b>{c.bloqueActual}</b></>
                    : <>Terminó los {totalClases} bloques</>}
                </p>

                <ul className="cl-señales">
                  {c.esperandoSuOk > 0 && <li className="s-mako">{c.esperandoSuOk} esperando su ok</li>}
                  {c.vistosSinContestar > 0 && <li className="s-warn">{c.vistosSinContestar} vistos sin contestar</li>}
                  {c.diasSinTocar === null && <li className="s-gris">Todavía no empezó</li>}
                  {c.diasSinTocar !== null && c.diasSinTocar > 7 && (
                    <li className="s-bad">{c.diasSinTocar} días sin tocar nada</li>
                  )}
                  {c.links > 1 && <li className="s-bad">{c.links} links vivos</li>}
                </ul>

                <div className="cl-pie">
                  {c.links > 0 ? (
                    <>
                      <span className="cl-tiene">Tiene su link</span>
                      <button className="cl-b" disabled={cargando === c.leadId} onClick={() => setConfirmarRotar(c)}>
                        Emitir uno nuevo
                      </button>
                      <button className="cl-b" disabled={cargando === c.leadId} onClick={() => void revocar(c)}>
                        Cortar el acceso
                      </button>
                    </>
                  ) : (
                    <button className="cl-b primaria" disabled={cargando === c.leadId} onClick={() => void emitir(c, false)}>
                      {cargando === c.leadId ? 'Emitiendo…' : 'Darle su link'}
                    </button>
                  )}
                </div>
              </li>
            );
          })}
        </ul>
      )}

      {/* El token se muestra UNA vez: de la base solo sale su sha256. Se cierra a
          mano a propósito — uno que se cierre solo se lleva el link. */}
      {emitido && (
        <Modal titulo={`El link de ${emitido.nombre}`} onCerrar={() => setEmitido(null)}>
          <p style={{ margin: '0 0 14px', lineHeight: 1.55 }}>
            Mandáselo por WhatsApp o por mail. Entra sin cuenta y sin contraseña.
          </p>
          <div className="cl-token">{emitido.url}</div>
          <p style={{ margin: '12px 0 18px', lineHeight: 1.5, color: 'var(--dim)' }}>
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
            El link que tiene ahora <b>deja de andar</b>. Si lo estaba usando para contestar,
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

const CSS = `
.cl-titular{ font-size:15px; color:var(--dim); margin:2px 0 22px; }
.cl-titular b{ color:var(--ink); font-weight:700; font-size:17px; }
.cl-titular .sep{ margin:0 10px; color:var(--faint); }
.cl-vacio{ padding:60px 0; text-align:center; color:var(--dim); line-height:1.6; }
.cl-vacio p{ margin:0 0 4px; }

.cl-grid{ list-style:none; margin:0; padding:0; display:grid; gap:16px;
  grid-template-columns:repeat(auto-fill, minmax(290px, 1fr)); }

.cl-card{ position:relative; display:flex; flex-direction:column; gap:0;
  background:var(--surface); border:1px solid var(--border);
  border-radius:14px; padding:22px 20px 16px; overflow:hidden;
  transition:border-color .15s, transform .15s; }
.cl-card:hover{ border-color:var(--border-strong); }
.cl-card.urgente{ border-color:var(--mako); }

/* LA FIRMA: el avance es el filo de arriba, a ancho completo. */
.cl-filo{ position:absolute; inset:0 0 auto 0; height:3px; background:var(--border); }
.cl-filo .c, .cl-filo .a{ position:absolute; inset:0 auto 0 0; }
.cl-filo .c{ background:var(--faint); }
.cl-filo .a{ background:var(--good); }

.cl-quien{ display:flex; align-items:center; gap:12px; min-width:0; }
.cl-quien .ini{ flex:none; width:38px; height:38px; border-radius:11px; display:grid;
  place-items:center; background:var(--surface-2); border:1px solid var(--border);
  font-size:13px; font-weight:650; letter-spacing:.02em; color:var(--dim); }
.cl-quien .txt{ display:flex; flex-direction:column; gap:1px; min-width:0; }
.cl-quien .n{ font-size:15.5px; font-weight:640; letter-spacing:-.012em;
  white-space:nowrap; overflow:hidden; text-overflow:ellipsis; }
.cl-quien .e{ font-size:12px; color:var(--faint);
  white-space:nowrap; overflow:hidden; text-overflow:ellipsis; }

.cl-cifra{ display:flex; align-items:baseline; gap:7px; margin:20px 0 0; }
.cl-cifra b{ font-size:34px; font-weight:700; letter-spacing:-.045em;
  font-variant-numeric:tabular-nums; line-height:1; }
.cl-cifra .de{ font-size:16px; color:var(--faint); font-variant-numeric:tabular-nums; }
.cl-cifra .lab{ font-size:12.5px; color:var(--dim); margin-left:2px; }

.cl-bloque{ font-size:13.5px; line-height:1.5; color:var(--dim); margin:8px 0 0; }
.cl-bloque b{ color:var(--ink); font-weight:560; }

.cl-señales{ list-style:none; margin:14px 0 0; padding:0; display:flex; flex-wrap:wrap; gap:6px; }
.cl-señales li{ font-size:11.5px; letter-spacing:.01em; padding:3px 9px; border-radius:999px;
  border:1px solid var(--border-strong); color:var(--dim); }
.cl-señales .s-mako{ color:var(--mako-ink); border-color:var(--mako); background:var(--mako-bg); }
.cl-señales .s-warn{ color:var(--warn); border-color:color-mix(in srgb, var(--warn) 35%, transparent); }
.cl-señales .s-bad{ color:var(--bad); border-color:color-mix(in srgb, var(--bad) 35%, transparent); }

.cl-pie{ display:flex; align-items:center; gap:4px; flex-wrap:wrap; margin-top:auto;
  padding-top:16px; }
.cl-tiene{ font-size:11.5px; letter-spacing:.02em; color:var(--good); margin-right:auto; }
.cl-b{ background:none; border:0; padding:7px 9px; margin:0 -3px; border-radius:7px;
  font:inherit; font-size:13px; color:var(--dim); cursor:pointer; }
.cl-b:hover{ background:var(--surface-2); color:var(--ink); }
.cl-b.primaria{ background:var(--ink); color:var(--surface); padding:9px 15px;
  font-weight:560; margin:0; }
.cl-b.primaria:hover{ opacity:.88; background:var(--ink); color:var(--surface); }
.cl-b:disabled{ opacity:.45; cursor:default; }

.cl-token{ font-family:var(--mono, monospace); font-size:13px; line-height:1.5; word-break:break-all;
  padding:13px 15px; border-radius:9px; background:var(--surface-2); border:1px solid var(--border); }

@media(prefers-reduced-motion:reduce){ .cl-card{ transition:none; } }
`;
