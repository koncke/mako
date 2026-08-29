'use client';

// =============================================================================
// Clients — la cartera del programa
// =============================================================================
// DOS COSAS MANDAN EN LA CARD, y en este orden:
//
//   1. EL RELOJ. «10 de 16 semanas», con la fecha de arranque y de dónde salió.
//      Es lo que dice si va bien o va tarde, y sale del CONTRATO de ese cliente
//      —no de una constante—: Sergio Esquer tiene 16 semanas, Jorge Negrete 3
//      meses. Si el contrato no lo dice, la card muestra «12 semanas» a secas:
//      un denominador inventado hace tomar decisiones sobre humo.
//   2. LA CANCHA. De quién es la pelota, y por qué, en una frase.
//
// Y abajo, en su propia banda, LO QUE SE LE PROMETIÓ. Sale de `deal_promesa` y
// es lo primero que hace falta antes de una sesión: la garantía de Sergio dice
// «continuar sesiones sin costo hasta instalación completa», y eso cambia qué
// significa que se haya pasado del plazo.
//
// Tres grupos, en orden de urgencia: TE TOCA A VOS primero, porque es lo que
// frena al cliente. Una deuda tuya nunca queda tapada por una suya. Los
// graduados y las bajas salen de la lista y viven abajo, plegados: no ensucian
// la cartera y no desaparecen.

import { useState } from 'react';
import { Pagina, PageHeader, Button, Modal, Banner, useToast, Toast } from '@/app/_ui';
import type { ClienteCartera, Cancha, EstadoCliente } from '@/lib/cs-cartera';
import { emitirLinkAction, revocarLinksAction, marcarEstadoAction } from './actions';
import { DetalleCliente } from './DetalleCliente';

type Emitido = { url: string; nombre: string };

const GRUPOS: { cancha: Cancha; titulo: string; sub: string }[] = [
  { cancha: 'tuya', titulo: 'Te toca a ti', sub: 'Están frenados esperándote' },
  { cancha: 'suya', titulo: 'Le toca a él', sub: 'La pelota está de su lado' },
  { cancha: 'al-dia', titulo: 'Al día', sub: 'Sin nada pendiente' },
];

const FUENTE: Record<string, string> = {
  contrato: 'según su contrato', ficha: 'según su ficha', cierre: 'desde el cierre de la venta',
};

const MES = ['ene', 'feb', 'mar', 'abr', 'may', 'jun', 'jul', 'ago', 'sep', 'oct', 'nov', 'dic'];
const fecha = (iso: string | null) => {
  if (!iso) return null;
  const d = new Date(iso);
  return Number.isFinite(d.getTime()) ? `${d.getUTCDate()} de ${MES[d.getUTCMonth()]}` : null;
};

export function ClientesApp({ clientes, totalClases, whopConectado }: {
  clientes: ClienteCartera[];
  totalClases: number;
  whopConectado: boolean;
}) {
  const [emitido, setEmitido] = useState<Emitido | null>(null);
  const [cargando, setCargando] = useState<number | null>(null);
  const [confirmarRotar, setConfirmarRotar] = useState<ClienteCartera | null>(null);
  const [abierto, setAbierto] = useState<ClienteCartera | null>(null);
  const [verCerrados, setVerCerrados] = useState(false);
  const { toast, show, clear } = useToast();

  async function emitir(c: ClienteCartera, rotar: boolean, porWhatsApp = false) {
    setCargando(c.leadId); setConfirmarRotar(null);
    const r = await emitirLinkAction(c.leadId, rotar, porWhatsApp);
    setCargando(null);
    if (!r.ok) { show(r.error, undefined, 'bad'); return; }
    if (r.mandado) {
      // Ya lo tiene: mostrarle el token igual sería pedirle que copie algo que
      // ya viajó. El cartel solo aparece cuando hay que copiar de verdad.
      show(`Link enviado a ${r.nombre} por WhatsApp.`, undefined, 'good');
      return;
    }
    if (r.avisoEnvio) show(`El link quedó emitido, pero no se pudo enviar: ${r.avisoEnvio}`, undefined, 'warn');
    setEmitido({ url: r.url, nombre: r.nombre });
  }

  async function revocar(c: ClienteCartera) {
    setCargando(c.leadId);
    const r = await revocarLinksAction(c.leadId);
    setCargando(null);
    show(r.ok ? `El link de ${c.nombre} dejó de andar.` : 'No se pudo revocar.', undefined, r.ok ? 'good' : 'bad');
  }

  async function marcar(c: ClienteCartera, estado: EstadoCliente) {
    setCargando(c.leadId); setAbierto(null);
    const r = await marcarEstadoAction(c.leadId, estado);
    setCargando(null);
    show(r.ok ? `${c.nombre} quedó como ${estado}.` : (r.error ?? 'No se pudo guardar.'),
      undefined, r.ok ? 'good' : 'bad');
  }

  const activos = clientes.filter(c => c.estado === 'activo' || c.estado === 'pausado');
  const cerrados = clientes.filter(c => c.estado === 'graduado' || c.estado === 'baja');

  return (
    <Pagina ancho="completo">
      <PageHeader titulo="Clients" proposito={`${activos.length} en el programa`} />

      {!whopConectado && (
        <Banner tono="warn">Whop no está conectado, así que MaKo no se entera de quién miró cada clase.</Banner>
      )}

      {activos.length === 0 ? (
        <div className="cl-vacio">
          <p>Todavía no hay clientes activos en el programa.</p>
          <p>Entran solos cuando una venta se marca como ganada en el CRM.</p>
        </div>
      ) : GRUPOS.map((g) => {
        const del = activos.filter(c => c.cancha === g.cancha);
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
                    c={c} cargando={cargando === c.leadId}
                    onAbrir={() => setAbierto(c)}
                    onDarLink={() => void emitir(c, false)}
                    onMandarLink={() => void emitir(c, false, true)}
                    onRotar={() => setConfirmarRotar(c)}
                    onRevocar={() => void revocar(c)}
                  />
                </li>
              ))}
            </ul>
          </section>
        );
      })}

      {cerrados.length > 0 && (
        <section className="cl-cerrados">
          <button onClick={() => setVerCerrados(v => !v)}>
            {verCerrados ? 'Ocultar' : 'Ver'} los {cerrados.length} que ya terminaron
          </button>
          {verCerrados && (
            <ul>
              {cerrados.map(c => (
                <li key={c.leadId}>
                  <button onClick={() => setAbierto(c)}>
                    <span className="n">{c.nombre}</span>
                    <span className="e">{c.empresa ?? ''}</span>
                    <span className={`s e-${c.estado}`}>{c.estado === 'graduado' ? 'Graduado' : 'Baja'}</span>
                  </button>
                </li>
              ))}
            </ul>
          )}
        </section>
      )}

      {abierto && (
        <DetalleCliente
          cliente={abierto} totalClases={totalClases}
          onCerrar={() => setAbierto(null)}
          onDarLink={() => void emitir(abierto, false)}
          onMarcar={(e) => void marcar(abierto, e)}
        />
      )}

      {emitido && (
        <Modal titulo={`El link de ${emitido.nombre}`} onCerrar={() => setEmitido(null)}>
          <p style={{ margin: '0 0 14px', lineHeight: 1.55 }}>
            Mandáselo por WhatsApp o por mail. Entra sin cuenta y sin contraseña.
          </p>
          <div className="cl-token">{emitido.url}</div>
          <p style={{ margin: '12px 0 18px', lineHeight: 1.5, color: 'var(--dim)' }}>
            <b>Cópialo ahora.</b> No se puede volver a ver: de esto solo guardamos una huella,
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

function Card({ c, cargando, onAbrir, onDarLink, onMandarLink, onRotar, onRevocar }: {
  c: ClienteCartera; cargando: boolean;
  onAbrir: () => void; onDarLink: () => void; onMandarLink: () => void;
  onRotar: () => void; onRevocar: () => void;
}) {
  const r = c.reloj;
  // El filo es el TIEMPO transcurrido del contrato, no el avance del temario:
  // es lo que se puede pintar con lo que sabemos hoy.
  const pct = r.semana && r.semanasTotales ? Math.min(100, (r.semana / r.semanasTotales) * 100) : 0;
  const arranque = fecha(r.arranque);
  const subtitulo = [c.empresa, c.promesa.queEs].filter(Boolean).join(' · ');

  return (
    <article className={`cl-card c-${c.cancha}`}>
      <span className="filo" aria-hidden><span style={{ width: `${pct}%` }} /></span>

      <button className="cl-abrir" onClick={onAbrir}>
        <span className="cab">
          <span className="quien">
            <span className="n">{c.nombre}</span>
            <span className="e">{subtitulo || 'Sin empresa cargada'}</span>
          </span>
          <span className={`chip ch-${c.cancha}`}>
            {c.cancha === 'tuya' ? 'Te toca' : c.cancha === 'suya' ? 'Le toca' : 'Al día'}
          </span>
        </span>

        <span className="reloj">
          {r.semana === null ? (
            <span className="sin">Sin fecha de arranque</span>
          ) : (
            <>
              <span className="num">{r.semana}</span>
              <span className="de">
                {r.semanasTotales ? `de ${r.semanasTotales} semanas` : 'semanas'}
                {r.terminado && <span className="paso"> · se pasó</span>}
              </span>
            </>
          )}
        </span>
        {arranque && (
          <span className="arranque">
            Arrancó el {arranque}{r.fuenteArranque ? ` · ${FUENTE[r.fuenteArranque]}` : ''}
          </span>
        )}

        <span className="razon">{c.razon}</span>
        <span className="sub">
          {c.ultimaSesionHace === null
            ? 'Todavía no tuvieron ninguna sesión'
            : `Última sesión hace ${c.ultimaSesionHace} días`}
          {c.cuotasVencidas > 0 && ` · ${c.cuotasVencidas} ${c.cuotasVencidas === 1 ? 'cuota vencida' : 'cuotas vencidas'}`}
        </span>
      </button>

      {c.promesa.resultado && (
        <div className="promesa">
          <span className="k">Le prometiste</span>
          <span className="v">{c.promesa.resultado}</span>
        </div>
      )}

      <div className="pie">
        {c.links > 0 ? (
          <>
            <span className="tiene">Tiene su link</span>
            <button className="b" disabled={cargando} onClick={onRotar}>Emitir uno nuevo</button>
            <button className="b" disabled={cargando} onClick={onRevocar}>Cortar el acceso</button>
          </>
        ) : (
          <>
            <button className="b primaria" disabled={cargando} onClick={onMandarLink}>
              {cargando ? 'Enviando…' : 'Mandarle su link'}
            </button>
            <button className="b" disabled={cargando} onClick={onDarLink}>Solo copiarlo</button>
          </>
        )}
      </div>
    </article>
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
  grid-template-columns:repeat(auto-fill, minmax(310px, 1fr)); }
.cl-grid > li{ display:flex; }

.cl-card{ position:relative; display:flex; flex-direction:column; width:100%;
  background:var(--surface); border:1px solid var(--border); border-radius:14px;
  overflow:hidden; transition:border-color .15s; }
.cl-card:hover{ border-color:var(--border-strong); }
.cl-card.c-tuya{ border-color:var(--mako); }
.cl-card .filo{ position:absolute; inset:0 0 auto 0; height:3px; background:var(--border); }
.cl-card .filo span{ display:block; height:100%; background:var(--ink); }

.cl-abrir{ flex:1; display:flex; flex-direction:column; width:100%; background:none; border:0;
  padding:20px 19px 16px; text-align:left; font:inherit; color:inherit; cursor:pointer; }
.cl-abrir:hover .quien .n{ text-decoration:underline; text-underline-offset:3px; }

.cab{ display:flex; align-items:flex-start; justify-content:space-between; gap:12px; }
.quien{ display:flex; flex-direction:column; gap:2px; min-width:0; }
.quien .n{ font-size:16px; font-weight:640; letter-spacing:-.015em;
  white-space:nowrap; overflow:hidden; text-overflow:ellipsis; }
.quien .e{ font-size:12px; color:var(--faint); white-space:nowrap; overflow:hidden;
  text-overflow:ellipsis; }
.chip{ flex:none; font-size:11px; padding:3px 9px; border-radius:6px;
  background:var(--surface-2); color:var(--dim); border:1px solid var(--border-strong); }
.chip.ch-tuya{ background:var(--mako-bg); color:var(--mako-ink); border-color:var(--mako); }

/* El reloj: el número más grande de la card. */
.reloj{ display:flex; align-items:baseline; gap:8px; margin:18px 0 0; }
.reloj .num{ font-size:38px; font-weight:700; letter-spacing:-.045em; line-height:1;
  font-variant-numeric:tabular-nums; }
.reloj .de{ font-size:14px; color:var(--faint); }
.reloj .paso{ color:var(--warn); }
.reloj .sin{ font-size:15px; color:var(--faint); }
.arranque{ display:block; margin:5px 0 0; font-size:11.5px; color:var(--faint); }

.razon{ display:block; margin:16px 0 0; font-size:14.5px; line-height:1.45; }
.c-tuya .razon{ color:var(--ink); }
.c-suya .razon, .c-al-dia .razon{ color:var(--dim); }
.sub{ display:block; margin:4px 0 0; font-size:12.5px; line-height:1.45; color:var(--faint); }

.promesa{ display:flex; flex-direction:column; gap:3px; padding:11px 19px;
  background:var(--surface-2); border-top:1px solid var(--border); }
.promesa .k{ font-size:10px; letter-spacing:.09em; text-transform:uppercase; color:var(--faint); }
.promesa .v{ font-size:13px; line-height:1.45; }

.pie{ display:flex; align-items:center; gap:3px; flex-wrap:wrap; padding:11px 16px 13px; }
.tiene{ font-size:11.5px; color:var(--good); margin-right:auto; padding-left:3px; }
.pie .b{ background:none; border:0; padding:7px 9px; border-radius:7px; font:inherit;
  font-size:12.5px; color:var(--dim); cursor:pointer; }
.pie .b:hover{ background:var(--surface-2); color:var(--ink); }
.pie .b.primaria{ background:var(--ink); color:var(--surface); padding:9px 15px; font-weight:560; }
.pie .b.primaria:hover{ opacity:.88; background:var(--ink); color:var(--surface); }
.pie .b:disabled{ opacity:.45; cursor:default; }

.cl-cerrados{ margin:8px 0 30px; }
.cl-cerrados > button{ background:none; border:0; padding:8px 0; font:inherit; font-size:13px;
  color:var(--dim); cursor:pointer; }
.cl-cerrados > button:hover{ color:var(--ink); }
.cl-cerrados ul{ list-style:none; margin:8px 0 0; padding:0; }
.cl-cerrados li > button{ display:flex; align-items:center; gap:12px; width:100%; background:none;
  border:0; border-top:1px solid var(--border); padding:11px 2px; text-align:left; font:inherit;
  cursor:pointer; }
.cl-cerrados li > button:hover{ background:var(--surface-2); }
.cl-cerrados .n{ font-size:14px; }
.cl-cerrados .e{ font-size:12.5px; color:var(--faint); }
.cl-cerrados .s{ margin-left:auto; font-size:11px; color:var(--faint); }
.cl-cerrados .s.e-graduado{ color:var(--good); }

.cl-token{ font-family:var(--mono, monospace); font-size:13px; line-height:1.5; word-break:break-all;
  padding:13px 15px; border-radius:9px; background:var(--surface-2); border:1px solid var(--border); }

@media(prefers-reduced-motion:reduce){ .cl-card{ transition:none; } }
`;
