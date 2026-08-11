'use client';

// =============================================================================
// Clients — de quién es la pelota
// =============================================================================
// La card contesta UNA cosa y lidera con ella: ¿te toca a vos o le toca a él?
// No el avance del programa — eso contesta otra pregunta y además hoy está en
// cero para los trece.
//
// Tres grupos, y el orden es el de la urgencia real: TE TOCA A VOS primero
// (porque es lo que frena al cliente), después LE TOCA A ÉL, y al final AL DÍA.
// Una deuda tuya nunca queda tapada por una suya.
//
// La card muestra lo mínimo para decidir si abrirla; todo lo demás vive en el
// detalle, en tabs, igual que la ficha del CRM. Meter las cinco tabs en la card
// sería volver a la pared de datos que el dueño rechazó.

import { useState } from 'react';
import { Pagina, PageHeader, Button, Modal, Banner, useToast, Toast } from '@/app/_ui';
import type { ClienteCartera, Cancha } from '@/lib/cs-cartera';
import { emitirLinkAction, revocarLinksAction } from './actions';
import { DetalleCliente } from './DetalleCliente';

type Emitido = { url: string; nombre: string };

const GRUPOS: { cancha: Cancha; titulo: string; sub: string }[] = [
  { cancha: 'tuya', titulo: 'Te toca a vos', sub: 'Están frenados esperándote' },
  { cancha: 'suya', titulo: 'Le toca a él', sub: 'La pelota está de su lado' },
  { cancha: 'al-dia', titulo: 'Al día', sub: 'Sin nada pendiente' },
];

/** El reloj, dicho sin inventar. Sin contrato que diga cuánto dura, se muestra
 *  la semana sola: «semana 12» es un hecho, «12 de 26» sobre un total inventado
 *  es una decisión tomada sobre humo. */
export function textoReloj(r: { semana: number | null; semanasTotales: number | null; terminado: boolean }): string {
  if (r.semana === null) return '—';
  if (r.terminado) return `${r.semana} · terminó`;
  if (r.semanasTotales === null) return `semana ${r.semana}`;
  return `${r.semana} de ${r.semanasTotales}`;
}

/** Dos letras. Más es un logo; una sola no distingue a dos Franciscos. */
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
  const [abierto, setAbierto] = useState<ClienteCartera | null>(null);
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

  const porGrupo = (g: Cancha) => clientes.filter(c => c.cancha === g);

  return (
    <Pagina ancho="completo">
      <PageHeader titulo="Clients" proposito={`${clientes.length} en el programa`} />

      {!whopConectado && (
        <Banner tono="warn">Whop no está conectado, así que MaKo no se entera de quién miró cada clase.</Banner>
      )}

      {clientes.length === 0 ? (
        <div className="cl-vacio">
          <p>Todavía no hay clientes en el programa.</p>
          <p>Entran solos cuando una venta se marca como ganada en el CRM.</p>
        </div>
      ) : GRUPOS.map((g) => {
        const del = porGrupo(g.cancha);
        if (!del.length) return null;
        return (
          <section key={g.cancha} className={`cl-grupo g-${g.cancha}`}>
            <header>
              <h2>{g.titulo}</h2>
              <span className="n">{del.length}</span>
              <span className="s">{g.sub}</span>
            </header>
            <ul className="cl-grid">
              {del.map((c) => (
                <li key={c.leadId}>
                  <Card
                    c={c} totalClases={totalClases} cargando={cargando === c.leadId}
                    onAbrir={() => setAbierto(c)}
                    onDarLink={() => void emitir(c, false)}
                    onRotar={() => setConfirmarRotar(c)}
                    onRevocar={() => void revocar(c)}
                  />
                </li>
              ))}
            </ul>
          </section>
        );
      })}

      {abierto && (
        <DetalleCliente
          cliente={abierto} totalClases={totalClases}
          onCerrar={() => setAbierto(null)}
          onDarLink={() => void emitir(abierto, false)}
        />
      )}

      {/* El token se muestra UNA vez: de la base solo sale su sha256. */}
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

function Card({ c, totalClases, cargando, onAbrir, onDarLink, onRotar, onRevocar }: {
  c: ClienteCartera; totalClases: number; cargando: boolean;
  onAbrir: () => void; onDarLink: () => void; onRotar: () => void; onRevocar: () => void;
}) {
  const pct = Math.min(100, (c.aprobados / Math.max(1, totalClases)) * 100);
  const pctC = Math.min(100, (c.contestados / Math.max(1, totalClases)) * 100);

  return (
    <article className={`cl-card c-${c.cancha}`}>
      {/* El avance es el filo de la card, no una barrita con margen adentro. */}
      <span className="filo" aria-hidden>
        <span className="c" style={{ width: `${pctC}%` }} />
        <span className="a" style={{ width: `${pct}%` }} />
      </span>

      {/* La card ENTERA abre el detalle. Los botones de abajo viven fuera de
          este botón para que no queden anidados. */}
      <button className="cl-abrir" onClick={onAbrir}>
        <span className="quien">
          <span className="ini" aria-hidden>{iniciales(c.nombre)}</span>
          <span className="txt">
            <span className="n">{c.nombre}</span>
            {c.empresa && <span className="e">{c.empresa}</span>}
          </span>
        </span>

        <span className="razon">{c.razon}</span>

        <span className="hechos">
          <Hecho k="Última sesión" v={c.ultimaSesionHace === null ? 'Ninguna' : `hace ${c.ultimaSesionHace} d`} tono={c.ultimaSesionHace !== null && c.ultimaSesionHace > 21 ? 'bad' : undefined} />
          <Hecho k="Cobros" v={c.cuotasVencidas > 0 ? `${c.cuotasVencidas} vencida${c.cuotasVencidas > 1 ? 's' : ''}` : 'Al día'} tono={c.cuotasVencidas > 0 ? 'bad' : undefined} />
          <Hecho k="Semana" v={textoReloj(c.reloj)} tono={c.reloj.terminado ? 'warn' : undefined} />
        </span>
      </button>

      <div className="pie">
        {c.links > 0 ? (
          <>
            <span className="tiene">Tiene su link</span>
            <button className="b" disabled={cargando} onClick={onRotar}>Emitir uno nuevo</button>
            <button className="b" disabled={cargando} onClick={onRevocar}>Cortar el acceso</button>
          </>
        ) : (
          <button className="b primaria" disabled={cargando} onClick={onDarLink}>
            {cargando ? 'Emitiendo…' : 'Darle su link'}
          </button>
        )}
      </div>
    </article>
  );
}

function Hecho({ k, v, tono }: { k: string; v: string; tono?: 'bad' | 'warn' }) {
  return (
    <span className={`hecho${tono ? ` t-${tono}` : ''}`}>
      <span className="k">{k}</span>
      <span className="v">{v}</span>
    </span>
  );
}

const CSS = `
.cl-vacio{ padding:60px 0; text-align:center; color:var(--dim); line-height:1.6; }
.cl-vacio p{ margin:0 0 4px; }

.cl-grupo{ margin:0 0 34px; }
.cl-grupo > header{ display:flex; align-items:baseline; gap:10px; margin:0 0 14px;
  padding-bottom:9px; border-bottom:1px solid var(--border); }
.cl-grupo h2{ margin:0; font-size:15px; font-weight:660; letter-spacing:-.01em; }
.cl-grupo .n{ font-size:12px; font-variant-numeric:tabular-nums; color:var(--surface);
  background:var(--faint); border-radius:999px; padding:1px 8px; }
.cl-grupo.g-tuya .n{ background:var(--mako-ink); }
.cl-grupo .s{ margin-left:auto; font-size:12.5px; color:var(--faint); }

.cl-grid{ list-style:none; margin:0; padding:0; display:grid; gap:14px;
  grid-template-columns:repeat(auto-fill, minmax(300px, 1fr)); }

.cl-card{ position:relative; display:flex; flex-direction:column; height:100%;
  background:var(--surface); border:1px solid var(--border); border-radius:14px;
  overflow:hidden; transition:border-color .15s; }
.cl-card:hover{ border-color:var(--border-strong); }
.cl-card.c-tuya{ border-color:var(--mako); }

.cl-card .filo{ position:absolute; inset:0 0 auto 0; height:3px; background:var(--border); }
.cl-card .filo .c, .cl-card .filo .a{ position:absolute; inset:0 auto 0 0; }
.cl-card .filo .c{ background:var(--faint); }
.cl-card .filo .a{ background:var(--good); }

.cl-abrir{ flex:1; display:flex; flex-direction:column; gap:0; width:100%;
  background:none; border:0; padding:21px 19px 4px; text-align:left; font:inherit;
  color:inherit; cursor:pointer; }
.cl-abrir:hover .quien .n{ text-decoration:underline; text-underline-offset:3px; }

.quien{ display:flex; align-items:center; gap:11px; min-width:0; }
.quien .ini{ flex:none; width:36px; height:36px; border-radius:11px; display:grid; place-items:center;
  background:var(--surface-2); border:1px solid var(--border); font-size:12.5px; font-weight:660;
  color:var(--dim); }
.quien .txt{ display:flex; flex-direction:column; gap:1px; min-width:0; }
.quien .n{ font-size:15px; font-weight:640; letter-spacing:-.012em;
  white-space:nowrap; overflow:hidden; text-overflow:ellipsis; }
.quien .e{ font-size:12px; color:var(--faint);
  white-space:nowrap; overflow:hidden; text-overflow:ellipsis; }

/* La razón es el contenido de la card: por qué está en esta cancha. */
.razon{ display:block; margin:16px 0 0; font-size:15px; line-height:1.45;
  letter-spacing:-.008em; }
.c-tuya .razon{ color:var(--ink); }
.c-suya .razon, .c-al-dia .razon{ color:var(--dim); }

.hechos{ display:grid; grid-template-columns:repeat(3, 1fr); gap:10px; margin-top:18px;
  padding-top:14px; border-top:1px solid var(--border); }
.hecho{ display:flex; flex-direction:column; gap:2px; min-width:0; }
.hecho .k{ font-size:10px; letter-spacing:.09em; text-transform:uppercase; color:var(--faint); }
.hecho .v{ font-size:13px; font-variant-numeric:tabular-nums; white-space:nowrap;
  overflow:hidden; text-overflow:ellipsis; }
.hecho.t-bad .v{ color:var(--bad); }
.hecho.t-warn .v{ color:var(--warn); }

.pie{ display:flex; align-items:center; gap:3px; flex-wrap:wrap; padding:10px 16px 13px; }
.tiene{ font-size:11.5px; color:var(--good); margin-right:auto; padding-left:3px; }
.pie .b{ background:none; border:0; padding:7px 9px; border-radius:7px; font:inherit;
  font-size:12.5px; color:var(--dim); cursor:pointer; }
.pie .b:hover{ background:var(--surface-2); color:var(--ink); }
.pie .b.primaria{ background:var(--ink); color:var(--surface); padding:9px 15px; font-weight:560; }
.pie .b.primaria:hover{ opacity:.88; background:var(--ink); color:var(--surface); }
.pie .b:disabled{ opacity:.45; cursor:default; }

.cl-token{ font-family:var(--mono, monospace); font-size:13px; line-height:1.5; word-break:break-all;
  padding:13px 15px; border-radius:9px; background:var(--surface-2); border:1px solid var(--border); }

@media(prefers-reduced-motion:reduce){ .cl-card{ transition:none; } }
`;
