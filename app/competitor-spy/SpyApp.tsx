'use client';

// =============================================================================
// Competitor Spy — buscador fijo, identidad, pestañas y una sola rejilla
// =============================================================================
// REHECHA el 31/10/2026 después de que Martín abriera la anterior («lista a la izquierda + cuatro
// acordeones por canal», sacada de la ficha del CRM) y la rechazara. Se midieron once productos de la
// categoría con el navegador; el relevamiento está en docs/hallazgos-competitors-spy.md. De dónde sale
// cada cosa:
//
//  · La barra fija con UN campo: Meta Ad Library y Google Ads Transparency. Ninguno de los once tiene
//    un «Agregar competidor»: tienen un buscador que no se va nunca. Pegar lleva a la ficha.
//  · Las migas con el selector y las píldoras de frescura, las pestañas, la banda de tres columnas, la
//    franja con «×» y el modal del «+» con dos pestañas: Foreplay Spyder (de sus capturas: la app pide
//    cuenta y no se entró).
//  · El bloque único de vacío, que deja todos los controles en su lugar: Google y Meta.
//  · La sección sin nada que decir se BORRA en vez de anunciarse: Semrush, medido con dos dominios.
//  · La tabla de competidores (filas, no tarjetas): Foreplay y BigSpy.
//
// NO HAY ONBOARDING (Martín, 31/10: «nada debe tener onboarding... limitas la experiencia del
// usuario»). Los cuatro pasos siguen en el catálogo porque MaKo los lee, pero los marca EL ACTO
// (lib/spy-actos.ts), no una pantalla.
//
// LAS REGLAS DE PRODUCTO QUE SIGUEN VALIENDO:
//  1. Un contador ausente no es cero (`dibujarContador`, y BigSpy es el contraejemplo: «0 / Likes»
//     sobre marcas con millones de creativos).
//  2. La etapa es NUESTRO criterio y se dice. «No se sabe desde cuándo» NO es «es nuevo».
//  3. Nada de «vs» ni de peleas: la política III.L de YouTube. Lo vigila tests/spy-reglas.test.ts.
//
// CUATRO ESTADOS QUE NO COMPARTEN COMPONENTE: cargando, leímos y no hay, no pudimos leer, cero
// competidores. Quién manda es `estadoDeResultados` (lib/spy-vista.ts), que se puede probar.
//
// ⚠️ NO HAY SEGUIMIENTO SOLO: se lee al agregar y al abrir una ficha de más de un día
// (`debeLeerAlAbrir`). No hay cron, así que no se dibuja nada que pida dos mediciones (deltas, línea
// de tiempo por día) y «Revisado hace 2 h» dice cuándo se leyó, sin prometer que se vigila.
//
// El copy va en español neutro, con «tú»: el producto se usa en México.

import { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import { Icon } from '../_components/icons';
import { BotonIntegracion } from '../_components/ConectarIntegracion';
import { ConfirmModal } from '../_components/ConfirmModal';
import { ModalShell } from '../_components/ModalShell';
import { Dropdown } from '../components/Dropdown';
import { AVISO_CORTE_VIEWCOUNT, ETAPA_ES_NUESTRO_CRITERIO, NOMBRE_CANAL, cruzaElCorte, dibujarContador } from '@/lib/spy-reglas';
import {
  canalesDe, cumpleFiltro, debeLeerAlAbrir, destinosDe, estadoDeResultados, fechaCorta, filtrarPiezas,
  fraseDeLectura, ganchosDe, haceCuanto, mezclaDeTipos, ordenarPiezas, pideConectarMeta,
  type FiltroSpy, type OrdenSpy,
} from '@/lib/spy-vista';
import type { Competidor, LecturaCanalSpy, ResumenPiezas } from '@/lib/spy';
import {
  analizarAction, competidoresAction, guardarAnuncioAction, piezasAction, quitarCompetidorAction,
  revisarAction, sumarCanalAction, sumarCompetidorAction, type PiezaVista,
} from './actions';
import { TarjetaPieza } from './TarjetaPieza';
import { OrdenSpy } from './OrdenSpy';

const CSS = `
.spy{min-height:100vh;background:var(--bg);color:var(--ink);font-size:13px}
.spy button{font:inherit}
.spy-barra{position:sticky;top:var(--pegado-arriba,0px);z-index:20;display:flex;align-items:center;gap:14px;height:56px;padding:0 20px;background:var(--surface-2);border-bottom:1px solid var(--border)}
.spy-marca{display:inline-flex;align-items:center;gap:8px;font-size:15px;font-weight:600;background:none;border:0;padding:0;color:var(--ink);cursor:pointer;white-space:nowrap}
.spy-campo{display:flex;align-items:center;gap:8px;flex:0 1 420px;min-width:0;height:36px;padding:0 10px;border:1px solid var(--border);border-radius:9px;background:var(--surface);color:var(--faint)}
.spy-campo:focus-within{border-color:var(--primary)}
.spy-campo input{flex:1;min-width:0;border:0;outline:0;background:none;color:var(--ink);font-size:13px}
.spy-x{display:inline-flex;background:none;border:0;padding:2px;color:var(--faint);cursor:pointer}
.spy-mas{margin-left:auto;display:inline-flex;align-items:center;justify-content:center;width:36px;height:36px;flex:none;border:0;border-radius:9px;background:var(--primary);color:var(--bg);cursor:pointer}
.spy-cuerpo{max-width:1240px;margin:0 auto;padding:16px 20px 40px}
.spy-boton{display:inline-flex;align-items:center;gap:7px;height:34px;padding:0 13px;border-radius:9px;border:1px solid var(--border);background:var(--surface-2);color:var(--ink);font-size:13px;cursor:pointer;white-space:nowrap;text-decoration:none}
.spy-boton:disabled{opacity:.55;cursor:default}
.spy-boton-primario{background:var(--primary);border-color:var(--primary);color:var(--bg)}
.spy-migas{display:flex;align-items:center;justify-content:space-between;gap:10px;flex-wrap:wrap}
.spy-identidad{display:flex;align-items:center;gap:12px;flex-wrap:wrap;margin-top:12px}
.spy-miga{display:inline-flex;align-items:center;gap:6px;background:none;border:0;padding:0;color:var(--dim);cursor:pointer;font-size:13px;white-space:nowrap}
.spy-avatar{display:inline-flex;align-items:center;justify-content:center;flex:none;width:40px;height:40px;border-radius:50%;background:var(--surface-2);border:1px solid var(--border);font-size:16px;font-weight:700;color:var(--dim)}
.spy-nombre{font-size:20px;font-weight:700;line-height:1.2}
.spy-pildora-gris{display:inline-flex;align-items:center;height:24px;padding:0 10px;border-radius:999px;background:var(--surface-2);border:1px solid var(--border);font-size:12px;color:var(--dim);white-space:nowrap}
.spy-acciones{display:flex;gap:8px;align-items:center;flex-wrap:wrap}
.spy-pestanas{display:flex;gap:22px;margin-top:16px;border-bottom:1px solid var(--border);overflow:auto hidden;scrollbar-width:none}
.spy-pestana{background:none;border:0;border-bottom:2px solid transparent;margin-bottom:-1px;padding:8px 0;color:var(--dim);font-size:14px;cursor:pointer;white-space:nowrap}
.spy-pestana[data-activa=true]{font-weight:700;color:var(--ink);border-bottom-color:var(--primary)}
.spy-pestana span{margin-left:6px;font-weight:400;color:var(--faint)}
.spy-franja{display:flex;align-items:center;gap:8px;margin-top:12px;padding:8px 12px;border-radius:9px;background:var(--surface-2);border:1px solid var(--border);font-size:12.5px;color:var(--dim)}
.spy-franja strong{color:var(--ink);white-space:nowrap}
.spy-franja .spy-x{margin-left:auto}
.spy-aviso{margin:10px 0 0;font-size:12.5px;line-height:1.6;color:var(--dim)}
.spy-error{color:var(--bad)}
.spy-banda{margin-top:12px;background:var(--surface-2);border:1px solid var(--border);border-radius:12px}
.spy-banda-cabecera{display:flex;align-items:center;gap:8px;width:100%;padding:12px 14px;background:none;border:0;color:var(--ink);cursor:pointer;text-align:left}
.spy-banda-frase{flex:1;font-size:13px;color:var(--dim);line-height:1.5}
.spy-banda-cols{display:grid;grid-template-columns:repeat(auto-fit,minmax(220px,1fr));border-top:1px solid var(--border)}
.spy-col{padding:12px 14px;border-left:1px solid var(--border);min-width:0}
.spy-col:first-child{border-left:0}
.spy-col h3{margin:0 0 8px;font-size:12.5px;font-weight:600;color:var(--ink)}
.spy-fila{display:flex;justify-content:space-between;gap:10px;padding:3px 0;font-size:12.5px;color:var(--dim)}
.spy-fila b{font-weight:400;overflow:hidden;text-overflow:ellipsis;white-space:nowrap;min-width:0}
.spy-fila span{flex:none;color:var(--faint);font-variant-numeric:tabular-nums}
.spy-herramientas{display:flex;align-items:center;gap:8px;flex-wrap:wrap;margin-top:14px}
.spy-buscar{display:flex;align-items:center;gap:6px;width:213px;height:34px;padding:0 9px;border:1px solid var(--border);border-radius:9px;background:var(--surface-2);color:var(--faint)}
.spy-buscar input{flex:1;min-width:0;border:0;outline:0;background:none;color:var(--ink);font-size:12.5px}
.spy-chip{display:inline-flex;align-items:center;gap:5px;height:30px;padding:0 11px;border-radius:999px;border:1px solid var(--border);background:var(--surface-2);color:var(--dim);font-size:12.5px;cursor:pointer;white-space:nowrap}
.spy-chip[data-activo=true]{border-color:var(--primary);color:var(--ink);font-weight:600}
.spy-chip:disabled{cursor:default;opacity:.6}
.spy-chip span{color:var(--faint);font-weight:400}
.spy-orden{margin-left:auto}
.spy-rejilla{display:grid;grid-template-columns:repeat(auto-fill,minmax(260px,1fr));gap:16px;margin-top:14px}
.spy-tarjeta{display:flex;flex-direction:column;background:var(--surface-2);border:1px solid var(--border);border-radius:12px;overflow:hidden;color:inherit;text-decoration:none;min-width:0}
a.spy-tarjeta:hover{border-color:var(--border-strong)}
.spy-tarjeta-cabecera{display:flex;align-items:center;gap:7px;height:40px;padding:0 12px;font-size:13px;font-weight:600}
.spy-tarjeta-estado{display:flex;align-items:center;gap:8px;min-height:30px;padding:0 12px 8px;font-size:12px;color:var(--faint)}
.spy-pildora{display:inline-flex;align-items:center;gap:5px;font-weight:600;color:var(--dim)}
.spy-punto{display:inline-block;width:7px;height:7px;border-radius:50%;background:var(--faint)}
.spy-punto-vivo{background:var(--good)}
.spy-rango{white-space:nowrap;overflow:hidden;text-overflow:ellipsis}
.spy-creativo{display:block;width:100%;aspect-ratio:16/9;object-fit:cover;background:var(--surface)}
.spy-creativo-texto{padding:12px;min-height:110px;background:var(--surface);font-size:13px;line-height:1.5;color:var(--dim);overflow:hidden}
.spy-contadores{display:grid;grid-template-columns:repeat(3,1fr);padding:10px 12px 0}
.spy-contador{min-width:0}
.spy-contador-valor{font-size:17px;font-weight:700;line-height:1.25}
.spy-contador-ausente{font-size:11.5px;line-height:21px;color:var(--faint);white-space:nowrap;overflow:hidden;text-overflow:ellipsis}
.spy-contador-etiqueta{font-size:11.5px;color:var(--faint)}
.spy-tarjeta-pie{padding:10px 12px 12px;display:flex;flex-direction:column;gap:3px}
.spy-destino{font-size:12px;font-weight:500;color:var(--faint);overflow:hidden;text-overflow:ellipsis;white-space:nowrap}
.spy-titulo-pieza{font-size:12.5px;font-weight:500;line-height:1.4;display:-webkit-box;-webkit-line-clamp:2;-webkit-box-orient:vertical;overflow:hidden}
.spy-etapa{font-size:11.5px;color:var(--faint);margin-top:2px}
.spy-esqueleto{min-height:300px;border-radius:12px;background:linear-gradient(100deg,var(--surface-2) 30%,var(--surface) 50%,var(--surface-2) 70%);background-size:300% 100%;border:1px solid var(--border);animation:spy-brillo 1.4s linear infinite}
@keyframes spy-brillo{from{background-position:100% 0}to{background-position:0 0}}
@media (prefers-reduced-motion:reduce){.spy-esqueleto{animation:none}}
.spy-vacio{display:flex;flex-direction:column;align-items:center;gap:8px;max-width:380px;margin:44px auto;text-align:center}
.spy-vacio h2{margin:0;font-size:18px;font-weight:700;line-height:1.3}
.spy-vacio p{margin:0;font-size:14px;line-height:1.55;color:var(--dim)}
.spy-vacio-botones{display:flex;gap:8px;flex-wrap:wrap;justify-content:center;margin-top:10px}
.spy-vacio-icono{display:inline-flex;align-items:center;justify-content:center;width:64px;height:64px;margin-bottom:16px;border-radius:16px;background:var(--surface-2);border:1px solid var(--border);color:var(--primary)}
.spy-pie{margin-top:22px;font-size:12px;line-height:1.7;color:var(--faint)}
.spy-pie p{margin:0}
.spy-oferta{margin-top:14px;max-width:760px;display:flex;flex-direction:column;gap:12px}
.spy-dato b{display:block;font-size:12px;font-weight:600;color:var(--faint);margin-bottom:2px}
.spy-dato{font-size:14px;line-height:1.55}
.spy-sitio{margin-top:14px;display:flex;flex-direction:column;gap:12px;align-items:flex-start;max-width:760px}
.spy-etiquetas{display:flex;gap:6px;flex-wrap:wrap}
.spy-envoltura-tabla{overflow-x:auto;margin-top:14px;background:var(--surface-2);border:1px solid var(--border);border-radius:12px}
.spy-tabla{width:100%;border-collapse:collapse;font-size:13px}
.spy-tabla th{padding:10px 14px;text-align:left;font-size:12px;font-weight:500;color:var(--faint);border-bottom:1px solid var(--border);white-space:nowrap}
.spy-tabla td{padding:10px 14px;border-bottom:1px solid var(--border);white-space:nowrap;color:var(--dim)}
.spy-tabla tr:last-child td{border-bottom:0}
.spy-tabla tbody tr{cursor:pointer}
.spy-tabla tbody tr:hover{background:var(--surface)}
.spy-tabla-nombre{display:flex;align-items:center;gap:10px;font-weight:600;color:var(--ink)}
.spy-tabla-nombre .spy-avatar{width:28px;height:28px;font-size:12px}
.spy-tabla-canales{display:flex;gap:8px}
.spy-lista-cabecera{display:flex;align-items:baseline;gap:10px;flex-wrap:wrap}
.spy-lista-cabecera h1{margin:0;font-size:20px;font-weight:700}
.spy-modal{padding:18px;display:flex;flex-direction:column;gap:12px}
.spy-modal h2{margin:0;font-size:16px;font-weight:700}
.spy-modal-cabecera{display:flex;align-items:center;justify-content:space-between;gap:10px}
.spy-modal-pestanas{display:flex;gap:18px;border-bottom:1px solid var(--border)}
.spy-entrada{width:100%;height:36px;padding:0 11px;border-radius:9px;border:1px solid var(--border);background:var(--surface);color:var(--ink);font-size:13px;box-sizing:border-box}
.spy-modal-pie{display:flex;justify-content:flex-end}
@media (max-width:640px){
  .spy-barra{padding:0 12px;gap:10px}
  .spy-marca span{display:none}
  .spy-cuerpo{padding:12px 16px 32px}
  .spy-buscar{width:100%}
  .spy-orden{margin-left:0}
  .spy-col{border-left:0;border-top:1px solid var(--border)}
  .spy-col:first-child{border-top:0}
}
`;

type Pestana = 'publica' | 'oferta' | 'sitio' | 'anuncios';

/**
 * La franja de una línea que ocupa el lugar del onboarding: lo que Foreplay pone en vez de un wizard.
 * Una por pestaña; se cierra y no vuelve.
 */
const FRANJA: Record<Pestana, { titulo: string; frase: string }> = {
  publica: { titulo: 'Lo que publica', frase: 'Los días los declara el canal; la etapa la calcula MaKo.' },
  oferta: { titulo: 'Su oferta', frase: 'La lee la IA de lo que publica. No es una afirmación suya.' },
  sitio: { titulo: 'Su sitio', frase: 'Qué piezas tiene su página.' },
  anuncios: { titulo: 'Anuncios', frase: 'Meta no entrega los de América Latina por su API: estos los guardaste tú.' },
};

// `localStorage` puede tirar en una ventana privada: la franja es una comodidad, no un estado.
const franjaCerrada = (t: Pestana): boolean => {
  try { return window.localStorage.getItem(`spy.franja.${t}`) === '1'; } catch { return false; }
};
const cerrarFranja = (t: Pestana): void => {
  try { window.localStorage.setItem(`spy.franja.${t}`, '1'); } catch { /* sin almacenamiento, vuelve la próxima */ }
};

function Franja({ pestana }: { pestana: Pestana }) {
  const [cerrada, setCerrada] = useState(true);
  useEffect(() => { setCerrada(franjaCerrada(pestana)); }, [pestana]);
  if (cerrada) return null;
  const f = FRANJA[pestana];
  return (
    <div className="spy-franja">
      <strong>{f.titulo}</strong>
      <span>{f.frase}</span>
      <button type="button" className="spy-x" aria-label="Cerrar" onClick={() => { cerrarFranja(pestana); setCerrada(true); }}>
        <Icon name="x" size={13} />
      </button>
    </div>
  );
}

const inicial = (nombre: string): string => nombre.replace(/^@/, '').charAt(0).toUpperCase() || '·';

function Vacio({ titulo, children, botones, icono }: { titulo: string; children?: React.ReactNode; botones?: React.ReactNode; icono?: React.ReactNode }) {
  return (
    <div className="spy-vacio">
      {icono && <div className="spy-vacio-icono">{icono}</div>}
      <h2>{titulo}</h2>
      {children}
      {botones && <div className="spy-vacio-botones">{botones}</div>}
    </div>
  );
}

function Esqueleto({ leyendo }: { leyendo: boolean }) {
  return (
    <>
      {leyendo && <p className="spy-aviso">Leyendo sus canales. Tarda unos segundos.</p>}
      <div className="spy-rejilla" aria-busy="true">
        {Array.from({ length: 8 }, (_, i) => <div key={i} className="spy-esqueleto" />)}
      </div>
    </>
  );
}

/** Un campo en un modal: agregar un canal o guardar un anuncio. */
function ModalCampo({ titulo, placeholder, boton, ocupado, error, onClose, onEnviar }: {
  titulo: string; placeholder: string; boton: string; ocupado: boolean; error: string | null;
  onClose: () => void; onEnviar: (valor: string) => void;
}) {
  const [valor, setValor] = useState('');
  return (
    <ModalShell w={460} label={titulo} onClose={onClose}>
      <div className="spy-modal">
        <div className="spy-modal-cabecera">
          <h2>{titulo}</h2>
          <button type="button" className="spy-x" aria-label="Cerrar" onClick={onClose}><Icon name="x" size={15} /></button>
        </div>
        <input
          autoFocus className="spy-entrada" placeholder={placeholder} value={valor}
          onChange={(e) => setValor(e.target.value)}
          onKeyDown={(e) => { if (e.key === 'Enter' && valor.trim() && !ocupado) onEnviar(valor.trim()); }}
        />
        {error && <p className="spy-aviso spy-error">{error}</p>}
        <div className="spy-modal-pie">
          <button type="button" className="spy-boton spy-boton-primario" disabled={!valor.trim() || ocupado} onClick={() => onEnviar(valor.trim())}>
            {ocupado ? 'Un momento…' : boton}
          </button>
        </div>
      </div>
    </ModalShell>
  );
}

/** El «+»: dos pestañas que se alternan, no dos pasos. La de Foreplay. */
function ModalAlta({ ocupado, error, onClose, onPegar, onAMano }: {
  ocupado: boolean; error: string | null; onClose: () => void;
  onPegar: (valor: string) => void;
  onAMano: (d: { nombre: string; instagram: string; youtube: string; sitio: string }) => void;
}) {
  const [pestana, setPestana] = useState<'pegar' | 'mano'>('pegar');
  const [pegado, setPegado] = useState('');
  const [d, setD] = useState({ nombre: '', instagram: '', youtube: '', sitio: '' });
  const listo = pestana === 'pegar' ? !!pegado.trim() : !!(d.instagram.trim() || d.youtube.trim() || d.sitio.trim());
  const enviar = () => { if (pestana === 'pegar') onPegar(pegado.trim()); else onAMano(d); };
  return (
    <ModalShell w={480} label="Mirar a alguien más" onClose={onClose}>
      <div className="spy-modal">
        <div className="spy-modal-cabecera">
          <h2>Mirar a alguien más</h2>
          <button type="button" className="spy-x" aria-label="Cerrar" onClick={onClose}><Icon name="x" size={15} /></button>
        </div>
        <div className="spy-modal-pestanas">
          <button type="button" className="spy-pestana" data-activa={pestana === 'pegar'} onClick={() => setPestana('pegar')}>Pegar un dato</button>
          <button type="button" className="spy-pestana" data-activa={pestana === 'mano'} onClick={() => setPestana('mano')}>Cargar a mano</button>
        </div>
        {pestana === 'pegar'
          ? (
            <input
              autoFocus className="spy-entrada" placeholder="Un @, un canal de YouTube o un sitio" value={pegado}
              onChange={(e) => setPegado(e.target.value)}
              onKeyDown={(e) => { if (e.key === 'Enter' && listo && !ocupado) enviar(); }}
            />
          )
          : (
            <>
              <input className="spy-entrada" placeholder="Nombre" value={d.nombre} onChange={(e) => setD({ ...d, nombre: e.target.value })} />
              <input className="spy-entrada" placeholder="@ de Instagram" value={d.instagram} onChange={(e) => setD({ ...d, instagram: e.target.value })} />
              <input className="spy-entrada" placeholder="Enlace de su canal de YouTube" value={d.youtube} onChange={(e) => setD({ ...d, youtube: e.target.value })} />
              <input className="spy-entrada" placeholder="Su sitio" value={d.sitio} onChange={(e) => setD({ ...d, sitio: e.target.value })} />
            </>
          )}
        {error && <p className="spy-aviso spy-error">{error}</p>}
        <div className="spy-modal-pie">
          <button type="button" className="spy-boton spy-boton-primario" disabled={!listo || ocupado} onClick={enviar}>
            {ocupado ? 'Un momento…' : 'Mirar'}
          </button>
        </div>
      </div>
    </ModalShell>
  );
}

function TablaCompetidores({ competidores, resumen, onAbrir }: {
  competidores: Competidor[]; resumen: Record<number, ResumenPiezas>; onAbrir: (id: number) => void;
}) {
  const desdes = Object.values(resumen).map((r) => r.desde).filter((d): d is string => !!d).sort();
  return (
    <>
      <div className="spy-lista-cabecera">
        <h1>Competidores</h1>
        <span className="spy-rango">
          {competidores.length} {competidores.length === 1 ? 'competidor' : 'competidores'}
          {desdes[0] ? ` · el más viejo desde el ${fechaCorta(desdes[0])}` : ''}
        </span>
      </div>
      <div className="spy-envoltura-tabla">
        <table className="spy-tabla">
          <thead>
            <tr><th>Nombre</th><th>Revisado</th><th>Desde</th><th>Piezas</th><th>Canales</th></tr>
          </thead>
          <tbody>
            {competidores.map((c) => {
              const r = resumen[c.id];
              return (
                <tr key={c.id} onClick={() => onAbrir(c.id)}>
                  <td><span className="spy-tabla-nombre"><span className="spy-avatar">{inicial(c.nombre)}</span>{c.nombre}</span></td>
                  <td>{c.mirado_en ? haceCuanto(c.mirado_en) : ''}</td>
                  <td>{r?.desde ? fechaCorta(r.desde) : ''}</td>
                  <td>
                    {r && r.vivas + r.idas > 0 && (
                      <span className="spy-pildora"><i className="spy-punto spy-punto-vivo" />{r.vivas} a la vista{r.idas ? ` · ${r.idas} ya no` : ''}</span>
                    )}
                  </td>
                  <td>
                    <span className="spy-tabla-canales">
                      {c.instagram && <span title={NOMBRE_CANAL.instagram}><Icon name="instagram" size={15} /></span>}
                      {c.youtube_id && <span title={NOMBRE_CANAL.youtube}><Icon name="youtube" size={15} /></span>}
                      {c.landing_url && <span title="Su sitio"><Icon name="web" size={15} /></span>}
                    </span>
                  </td>
                </tr>
              );
            })}
          </tbody>
        </table>
      </div>
    </>
  );
}

function Banda({ piezas, c, analizando, onAnalizar }: { piezas: PiezaVista[]; c: Competidor; analizando: boolean; onAnalizar: () => void }) {
  const [abierta, setAbierta] = useState(true);
  const mezcla = useMemo(() => mezclaDeTipos(piezas), [piezas]);
  const destinos = useMemo(() => destinosDe(piezas), [piezas]);
  const ganchos = useMemo(() => ganchosDe(piezas), [piezas]);
  const frase = fraseDeLectura(piezas, c.mirado_en);
  return (
    <section className="spy-banda">
      <button type="button" className="spy-banda-cabecera" aria-expanded={abierta} onClick={() => setAbierta((v) => !v)}>
        <span className="spy-banda-frase">{frase}</span>
        <span style={{ display: 'inline-flex', transform: abierta ? 'rotate(180deg)' : 'none' }}><Icon name="chevron" size={13} /></span>
      </button>
      {abierta && (
        <div className="spy-banda-cols">
          <div className="spy-col">
            <h3>Qué publica</h3>
            {mezcla.map((m) => <div key={m.rotulo} className="spy-fila"><b>{m.rotulo}</b><span>{m.n} · {m.pct}%</span></div>)}
          </div>
          {/* Sin destinos la columna no existe: no se anuncia su ausencia (Semrush). */}
          {destinos.length > 0 && (
            <div className="spy-col">
              <h3>A dónde manda ({destinos.length})</h3>
              {destinos.slice(0, 8).map((d) => <div key={d.rotulo} className="spy-fila"><b title={d.rotulo}>{d.rotulo}</b><span>{d.n} · {d.pct}%</span></div>)}
            </div>
          )}
          <div className="spy-col">
            <h3>Con qué abre</h3>
            {ganchos.length
              ? ganchos.map((g) => (
                <div key={g.gancho} className="spy-fila">
                  <b title={g.gancho}>{g.gancho}</b>
                  {g.dias != null && <span className="spy-pildora"><i className={g.sigue ? 'spy-punto spy-punto-vivo' : 'spy-punto'} />{g.dias} d</span>}
                </div>
              ))
              : (
                // El control apagado de Meta: se ve, dice por qué y trae su salida.
                <button type="button" className="spy-boton" disabled={analizando} onClick={onAnalizar}>
                  {analizando ? 'Leyendo con IA…' : 'Leer con IA'}
                </button>
              )}
          </div>
        </div>
      )}
    </section>
  );
}

export function SpyApp({ iniciales, resumenInicial, abierto, errorInicial }: {
  iniciales: Competidor[];
  resumenInicial: Record<number, ResumenPiezas>;
  /** El `?competidor=` de la URL. La ficha es una URL: se comparte, se marca y se vuelve. */
  abierto: number | null;
  errorInicial: string | null;
}) {
  const [competidores, setCompetidores] = useState<Competidor[]>(iniciales);
  const [resumen, setResumen] = useState(resumenInicial);
  const [elegido, setElegido] = useState<number | null>(abierto ?? (iniciales.length === 1 ? iniciales[0].id : null));
  const [piezas, setPiezas] = useState<PiezaVista[]>([]);
  const [trayendo, setTrayendo] = useState(false);
  const [leyendo, setLeyendo] = useState<number | null>(null);
  const [ordenando, setOrdenando] = useState<{ id: number; piezas: PiezaVista[] | null } | null>(null);
  const [analizando, setAnalizando] = useState(false);
  const [lecturas, setLecturas] = useState<Record<number, LecturaCanalSpy[]>>({});
  const [error, setError] = useState<string | null>(errorInicial);
  const [pestana, setPestana] = useState<Pestana>('publica');

  const [pegado, setPegado] = useState('');
  const [buscar, setBuscar] = useState('');
  const [filtros, setFiltros] = useState<FiltroSpy[]>([]);
  const [orden, setOrden] = useState<OrdenSpy>('mas-tiempo');
  const [modal, setModal] = useState<'alta' | 'canal' | 'anuncio' | 'quitar' | null>(null);
  const [ocupado, setOcupado] = useState(false);
  const [errorModal, setErrorModal] = useState<string | null>(null);

  const campo = useRef<HTMLInputElement>(null);
  // Qué ficha está abierta AHORA: una lectura que tarda no puede pisar la de otro competidor.
  const actual = useRef(elegido);
  actual.current = elegido;
  const yaLeidos = useRef(new Set<number>());

  const c = competidores.find((x) => x.id === elegido) ?? null;

  const recargarLista = useCallback(async () => {
    const r = await competidoresAction();
    if (r.ok) { setCompetidores(r.competidores); setResumen(r.resumen); }
    return r.ok ? r.competidores : null;
  }, []);

  const traerPiezas = useCallback(async (id: number) => {
    const p = await piezasAction(id);
    if (actual.current !== id) return null;
    if (p.ok) setPiezas(p.piezas);
    else setError(p.error);
    return p.ok ? p.piezas : null;
  }, []);

  // `animada`: la lectura se ve como sus piezas juntándose y repartiéndose en carpetas (./OrdenSpy.tsx). Una relectura sola de una ficha
  // que ya tiene piezas va callada: no le corre la pantalla a quien entró a mirar.
  const leer = useCallback(async (id: number, animada = true) => {
    yaLeidos.current.add(id);
    setLeyendo(id);
    if (animada) setOrdenando({ id, piezas: null });
    try {
      const r = await revisarAction(id);
      if (r.error) setError(r.error);
      // Siempre queda algo en `lecturas`, también si la acción falló: es lo que saca a la pantalla
      // del esqueleto, y una lista vacía se dibuja como «no pude», nunca como «no hay».
      setLecturas((prev) => ({ ...prev, [id]: r.canales }));
      await recargarLista();
      const p = await traerPiezas(id);
      // Sin piezas no hay nada que ordenar: se ve el estado de siempre («no encontré», «no pude»).
      if (animada) setOrdenando((v) => (v?.id !== id || actual.current !== id ? null : p?.length ? { id, piezas: p } : null));
    } catch (e) {
      setOrdenando(null);
      throw e;
    } finally {
      setLeyendo((v) => (v === id ? null : v));
    }
  }, [recargarLista, traerPiezas]);

  // Abrir una ficha: trae lo guardado y, si hace falta, lee. Sin botón que haya que encontrar.
  useEffect(() => {
    if (elegido == null) return;
    let vivo = true;
    setPiezas([]); setError(null); setBuscar(''); setFiltros([]); setPestana('publica'); setTrayendo(true); setOrdenando(null);
    void traerPiezas(elegido).then((p) => {
      if (!vivo) return;
      setTrayendo(false);
      const quien = competidores.find((x) => x.id === elegido);
      if (quien && debeLeerAlAbrir(quien, p?.length ?? 0, yaLeidos.current.has(elegido))) void leer(elegido, !p?.length);
    });
    return () => { vivo = false; };
    // `competidores` afuera a propósito: cada lectura la reescribe, y esto volvería a abrir la ficha.
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [elegido, traerPiezas, leer]);

  // Volver atrás en el navegador vuelve a la ficha o a la lista.
  useEffect(() => {
    const alVolver = () => {
      const v = Number(new URLSearchParams(window.location.search).get('competidor'));
      setElegido(Number.isInteger(v) && v > 0 ? v : null);
    };
    window.addEventListener('popstate', alVolver);
    return () => window.removeEventListener('popstate', alVolver);
  }, []);

  const irA = useCallback((id: number | null) => {
    setElegido(id);
    const url = new URL(window.location.href);
    if (id == null) url.searchParams.delete('competidor');
    else url.searchParams.set('competidor', String(id));
    window.history.pushState(null, '', url);
  }, []);

  const abrirRecienAgregado = async (id: number) => {
    await recargarLista();
    // Se lee aunque la ficha ya estuviera abierta: puede haber sumado un canal.
    yaLeidos.current.delete(id);
    if (actual.current === id) void leer(id);
    else irA(id);
  };

  const sumar = async (valor: string, nombre?: string): Promise<number | null> => {
    setOcupado(true); setError(null); setErrorModal(null);
    try {
      const r = await sumarCompetidorAction(valor, nombre);
      if (!r.ok) { setError(r.error); setErrorModal(r.error); return null; }
      return r.id;
    } finally {
      setOcupado(false);
    }
  };

  const pegarArriba = async () => {
    const id = await sumar(pegado.trim());
    if (id == null) return;
    setPegado('');
    await abrirRecienAgregado(id);
  };

  const alta = async (valor: string) => {
    const id = await sumar(valor);
    if (id == null) return;
    setModal(null);
    await abrirRecienAgregado(id);
  };

  const altaAMano = async (d: { nombre: string; instagram: string; youtube: string; sitio: string }) => {
    const ig = d.instagram.trim();
    const datos = [ig && (/^https?:/i.test(ig) || ig.startsWith('@') ? ig : `@${ig}`), d.youtube.trim(), d.sitio.trim()].filter(Boolean) as string[];
    const id = await sumar(datos[0], d.nombre.trim() || undefined);
    if (id == null) return;
    for (const otro of datos.slice(1)) {
      const r = await sumarCanalAction(id, otro);
      if (!r.ok) { setErrorModal(r.error); return; }
    }
    setModal(null);
    await abrirRecienAgregado(id);
  };

  const sumarCanal = async (valor: string) => {
    if (elegido == null) return;
    setOcupado(true); setErrorModal(null);
    try {
      const r = await sumarCanalAction(elegido, valor);
      if (!r.ok) { setErrorModal(r.error); return; }
      setModal(null);
      await abrirRecienAgregado(elegido);
    } finally {
      setOcupado(false);
    }
  };

  const guardarAnuncio = async (valor: string) => {
    if (elegido == null) return;
    setOcupado(true); setErrorModal(null);
    try {
      const r = await guardarAnuncioAction(elegido, valor);
      if (!r.ok) { setErrorModal(r.error); return; }
      setModal(null);
      await traerPiezas(elegido);
      await recargarLista();
      setPestana('anuncios');
    } finally {
      setOcupado(false);
    }
  };

  const analizar = async () => {
    if (elegido == null) return;
    setError(null); setAnalizando(true);
    try {
      const r = await analizarAction(elegido);
      if (!r.ok) { setError(r.error); return; }
      await recargarLista();
      await traerPiezas(elegido);
      setPestana('oferta');
    } finally {
      setAnalizando(false);
    }
  };

  const quitar = async () => {
    if (elegido == null) return;
    const r = await quitarCompetidorAction(elegido);
    setModal(null);
    if (!r.ok) { setError(r.error); return; }
    irA(null);
    await recargarLista();
  };

  const flujo = useMemo(() => piezas.filter((p) => p.canal === 'instagram' || p.canal === 'youtube'), [piezas]);
  const anuncios = useMemo(() => piezas.filter((p) => p.canal === 'anuncios'), [piezas]);
  const sitio = useMemo(() => piezas.find((p) => p.canal === 'landing') ?? null, [piezas]);
  const visibles = useMemo(() => ordenarPiezas(filtrarPiezas(flujo, buscar, filtros), orden), [flujo, buscar, filtros, orden]);

  // ⚠️ UNA PESTAÑA SIN NADA QUE DECIR NO EXISTE: no aparece vacía, no aparece.
  const pestanas: Array<{ key: Pestana; rotulo: string; n?: number }> = c ? [
    ...(c.instagram || c.youtube_id || flujo.length || !c.landing_url ? [{ key: 'publica' as const, rotulo: 'Lo que publica', n: flujo.length || undefined }] : []),
    ...(c.oferta?.promete ? [{ key: 'oferta' as const, rotulo: 'Su oferta' }] : []),
    ...(c.landing_url ? [{ key: 'sitio' as const, rotulo: 'Su sitio' }] : []),
    ...(anuncios.length ? [{ key: 'anuncios' as const, rotulo: 'Anuncios', n: anuncios.length }] : []),
  ] : [];
  const activa: Pestana = pestanas.some((p) => p.key === pestana) ? pestana : (pestanas[0]?.key ?? 'publica');

  const lecturasDe = elegido != null ? lecturas[elegido] ?? null : null;
  const estaLeyendo = leyendo != null && leyendo === elegido;
  const estado = c
    ? estadoDeResultados({ leyendo: estaLeyendo, trayendo, visibles: visibles.length, total: flujo.length, hayCanales: canalesDe(c), lecturas: lecturasDe })
    : 'hay';

  const desde = useMemo(() => piezas.map((p) => p.visto_primera_vez).sort()[0] ?? null, [piezas]);
  const fechasYoutube = flujo.filter((p) => p.canal === 'youtube' && p.publicada_en).map((p) => p.publicada_en as string).sort();
  const hayCorte = fechasYoutube.length > 1 && cruzaElCorte(fechasYoutube[0], fechasYoutube[fechasYoutube.length - 1]);

  const alternar = (f: FiltroSpy) => setFiltros((v) => (v.includes(f) ? v.filter((x) => x !== f) : [...v, f]));
  const cuantas = (f: FiltroSpy) => flujo.filter((p) => cumpleFiltro(p, f)).length;

  const revisarDeNuevo = (
    <button type="button" className="spy-boton" disabled={estaLeyendo || ordenando != null || elegido == null} onClick={() => { if (elegido != null) void leer(elegido); }}>
      Revisar de nuevo
    </button>
  );

  const motivos = (
    <>
      {(lecturasDe ?? []).map((l) => <p key={l.canal}>{l.detalle}</p>)}
      {error && <p>{error}</p>}
    </>
  );

  return (
    <main className="spy" data-spy>
      <style>{CSS}</style>

      {/* ── Zona 0: la barra fija. El campo no se va nunca: ni con la ficha abierta ni con cero. ── */}
      <div className="spy-barra">
        <button type="button" className="spy-marca" onClick={() => irA(null)}>
          <Icon name="spy" size={18} /><span>Competitor Spy</span>
        </button>
        <div className="spy-campo">
          <Icon name="search" size={14} />
          <input
            ref={campo}
            aria-label="Pega un @, un canal de YouTube o un sitio"
            placeholder="Pega un @, un canal de YouTube o un sitio"
            value={pegado}
            onChange={(e) => setPegado(e.target.value)}
            onKeyDown={(e) => { if (e.key === 'Enter' && pegado.trim() && !ocupado) void pegarArriba(); }}
          />
          {pegado && <button type="button" className="spy-x" aria-label="Limpiar" onClick={() => setPegado('')}><Icon name="x" size={13} /></button>}
        </div>
        <button type="button" className="spy-mas" aria-label="Mirar a alguien más" title="Mirar a alguien más" onClick={() => { setErrorModal(null); setModal('alta'); }}>
          <Icon name="plus" size={17} />
        </button>
      </div>

      <div className="spy-cuerpo">
        {!c && error && <p className="spy-aviso spy-error">{error}</p>}

        {/* ── Cero competidores: un bloque, cuatro elementos, nunca cuatro cajas. ── */}
        {!c && !competidores.length && (
          <Vacio
            icono={<Icon name="spy" size={28} />}
            titulo="Todavía no estás mirando a nadie"
            botones={<button type="button" className="spy-boton spy-boton-primario" onClick={() => campo.current?.focus()}>Pegar un dato</button>}
          >
            <p>Pega el @ de alguien de tu nicho, su canal o su sitio: lo leemos ahora.</p>
          </Vacio>
        )}

        {!c && competidores.length > 0 && <TablaCompetidores competidores={competidores} resumen={resumen} onAbrir={irA} />}

        {c && (
          <>
            {/* ── Zona 1: migas, identidad y frescura. Nada de «Sin revisar»: ese lugar es del competidor. ── */}
            <div className="spy-migas">
              <button type="button" className="spy-miga" onClick={() => irA(null)}>
                <span style={{ display: 'inline-flex', transform: 'rotate(90deg)' }}><Icon name="chevron" size={12} /></span>
                Competidores ({competidores.length})
              </button>
              <div className="spy-acciones">
                <button type="button" className="spy-boton" disabled={estaLeyendo || ordenando != null || !canalesDe(c)} onClick={() => void leer(c.id)}>
                  {estaLeyendo ? 'Revisando…' : 'Revisar ahora'}
                </button>
                <button type="button" className="spy-boton" disabled={analizando || !piezas.length} title={piezas.length ? undefined : 'Sale de lo que publica'} onClick={() => void analizar()}>
                  {analizando ? 'Leyendo su oferta…' : 'Qué vende y qué ataca'}
                </button>
                <Dropdown
                  ariaLabel="Más acciones"
                  value=""
                  width={190}
                  align="right"
                  resetAfterSelect
                  sinFlecha
                  botonLabel={<span aria-hidden>⋯</span>}
                  options={[
                    { value: 'canal', label: 'Agregar un canal' },
                    { value: 'anuncio', label: 'Guardar un anuncio' },
                    { value: 'quitar', label: 'Dejar de mirarlo' },
                  ]}
                  onChange={(v) => { setErrorModal(null); setModal(v as 'canal' | 'anuncio' | 'quitar'); }}
                  buttonStyle={{ height: 34, width: 34, justifyContent: 'center', padding: 0 }}
                />
              </div>
            </div>

            <div className="spy-identidad">
              <span className="spy-avatar">{inicial(c.nombre)}</span>
              {competidores.length > 1
                ? (
                  <Dropdown
                    ariaLabel="Cambiar de competidor"
                    value={String(c.id)}
                    options={competidores.map((x) => ({ value: String(x.id), label: x.nombre }))}
                    onChange={(v) => irA(Number(v))}
                    buttonStyle={{ border: 0, background: 'none', padding: 0, fontSize: 20, fontWeight: 700, color: 'var(--ink)' }}
                  />
                )
                : <span className="spy-nombre">{c.nombre}</span>}
              {estaLeyendo && c.mirado_en && <span className="spy-pildora-gris">Actualizando…</span>}
              {!estaLeyendo && c.mirado_en && <span className="spy-pildora-gris">Revisado {haceCuanto(c.mirado_en)}</span>}
              {desde && <span className="spy-pildora-gris">Lo seguimos desde el {fechaCorta(desde)}</span>}
              {c.instagram_seguidores != null && <span className="spy-pildora-gris">{dibujarContador(c.instagram_seguidores)} seguidores</span>}
              {c.youtube_suscriptores != null && <span className="spy-pildora-gris">{dibujarContador(c.youtube_suscriptores)} suscriptores</span>}
            </div>

            {/* Lo que falló al apretar algo se dice acá. El vacío «no pude» ya lo trae entre sus motivos. */}
            {error && !(activa === 'publica' && estado === 'no-pudo') && <p className="spy-aviso spy-error">{error}</p>}

            {/* ── Zona 2: pestañas, activas por peso y subrayado. Nunca acordeones. ── */}
            {pestanas.length > 1 && (
              <div className="spy-pestanas" role="tablist">
                {pestanas.map((p) => (
                  <button key={p.key} type="button" role="tab" aria-selected={activa === p.key} className="spy-pestana" data-activa={activa === p.key} onClick={() => setPestana(p.key)}>
                    {p.rotulo}{p.n != null && <span>{p.n}</span>}
                  </button>
                ))}
              </div>
            )}

            {/* Sin nada abajo, la franja explicaría una pantalla que no está. */}
            {(activa !== 'publica' || flujo.length > 0) && <Franja pestana={activa} />}

            {ordenando?.id === c.id && activa === 'publica' && <OrdenSpy nombre={c.nombre} piezas={ordenando.piezas} onTerminar={() => setOrdenando(null)} />}

            {activa === 'publica' && ordenando?.id !== c.id && (
              <>
                {flujo.length > 0 && <Banda piezas={flujo} c={c} analizando={analizando} onAnalizar={() => void analizar()} />}

                {flujo.length > 0 && (
                  <div className="spy-herramientas">
                    <label className="spy-buscar">
                      <Icon name="search" size={13} />
                      <input aria-label="Buscar en sus piezas" placeholder="Buscar en sus piezas" value={buscar} onChange={(e) => setBuscar(e.target.value)} />
                    </label>
                    {(['instagram', 'youtube'] as const).map((f) => {
                      const cargado = f === 'instagram' ? c.instagram : c.youtube_id;
                      // El control apagado de Meta: un canal sin cargar no se esconde ni miente; dice qué pasa y trae la salida.
                      if (!cargado) {
                        return <button key={f} type="button" className="spy-chip" onClick={() => { setErrorModal(null); setModal('canal'); }}>{NOMBRE_CANAL[f]} · Agregar</button>;
                      }
                      const n = cuantas(f);
                      const motivo = lecturasDe?.find((l) => l.canal === f)?.detalle;
                      return (
                        <button key={f} type="button" className="spy-chip" data-activo={filtros.includes(f)} disabled={!n} title={!n ? motivo : undefined} onClick={() => alternar(f)}>
                          {NOMBRE_CANAL[f]}{n > 0 && <span>{n}</span>}
                        </button>
                      );
                    })}
                    <button type="button" className="spy-chip" data-activo={filtros.includes('sigue')} disabled={!cuantas('sigue')} onClick={() => alternar('sigue')}>Sigue a la vista <span>{cuantas('sigue')}</span></button>
                    <button type="button" className="spy-chip" data-activo={filtros.includes('probado')} disabled={!cuantas('probado')} onClick={() => alternar('probado')}>Probado <span>{cuantas('probado')}</span></button>
                    <div className="spy-orden">
                      <Dropdown
                        ariaLabel="Ordenar"
                        value={orden}
                        width={240}
                        align="right"
                        buttonStyle={{ height: 34, fontSize: 13, fontWeight: 500 }}
                        options={[
                          { value: 'mas-tiempo', label: 'Lleva más tiempo a la vista' },
                          { value: 'mas-nuevo', label: 'Lo más nuevo' },
                        ]}
                        onChange={(v) => setOrden(v as OrdenSpy)}
                      />
                    </div>
                  </div>
                )}

                {/* ── Un solo estado para toda la zona de resultados, jamás uno por canal. ── */}
                {estado === 'hay' && (
                  <>
                    <div className="spy-rejilla">{visibles.map((p) => <TarjetaPieza key={p.id} p={p} />)}</div>
                    <footer className="spy-pie">
                      {c.mirado_en && <p>Lo que se pudo leer de sus canales públicos el {fechaCorta(c.mirado_en)}.</p>}
                      <p>{ETAPA_ES_NUESTRO_CRITERIO}</p>
                      {hayCorte && <p>{AVISO_CORTE_VIEWCOUNT}</p>}
                    </footer>
                  </>
                )}
                {estado === 'cargando' && <Esqueleto leyendo={estaLeyendo} />}
                {estado === 'sin-coincidencias' && (
                  <Vacio titulo="Nada coincide" botones={<button type="button" className="spy-boton" onClick={() => { setBuscar(''); setFiltros([]); }}>Quitar filtros</button>}>
                    <p>Ninguna de sus {flujo.length} piezas pasa esta búsqueda.</p>
                  </Vacio>
                )}
                {estado === 'sin-canales' && (
                  <Vacio titulo={`Dime dónde mirar a ${c.nombre}`} botones={<button type="button" className="spy-boton spy-boton-primario" onClick={() => { setErrorModal(null); setModal('canal'); }}>Agregar un canal</button>}>
                    <p>Su @, su canal de YouTube o su sitio.</p>
                  </Vacio>
                )}
                {estado === 'leido-sin-nada' && (
                  <Vacio titulo={`No encontré publicaciones de ${c.nombre}`} botones={revisarDeNuevo}>
                    <p>Leímos sus canales {c.mirado_en ? `el ${fechaCorta(c.mirado_en)} ` : ''}y no había nada público.</p>
                  </Vacio>
                )}
                {estado === 'no-pudo' && (
                  <Vacio
                    titulo={`No pude leer a ${c.nombre}`}
                    botones={(
                      <>
                        {pideConectarMeta(lecturasDe) && (
                          <BotonIntegracion servicio="meta" className="spy-boton spy-boton-primario" onConectado={() => void leer(c.id)}>
                            <Icon name="plug" size={14} /> Conectar Meta
                          </BotonIntegracion>
                        )}
                        {pideConectarMeta(lecturasDe) && (
                          <BotonIntegracion servicio="apify-instagram" className="spy-boton" onConectado={() => void leer(c.id)}>
                            Conectar Apify
                          </BotonIntegracion>
                        )}
                        {revisarDeNuevo}
                      </>
                    )}
                  >
                    {motivos}
                  </Vacio>
                )}
              </>
            )}

            {activa === 'oferta' && c.oferta && (
              <section className="spy-oferta">
                <div className="spy-dato"><b>Promete</b>{c.oferta.promete}</div>
                {c.oferta.aQuien && <div className="spy-dato"><b>A quién</b>{c.oferta.aQuien}</div>}
                {c.oferta.precio && <div className="spy-dato"><b>Precio que publica</b>{c.oferta.precio}</div>}
                {c.oferta.objecion && <div className="spy-dato"><b>Objeción que ataca</b>{c.oferta.objecion}</div>}
                {!!c.oferta.huecos.length && (
                  <div className="spy-dato">
                    <b>Lo que ataca y tu oferta no menciona</b>
                    <ul style={{ margin: 0, paddingLeft: 18 }}>{c.oferta.huecos.map((h) => <li key={h}>{h}</li>)}</ul>
                  </div>
                )}
              </section>
            )}

            {activa === 'sitio' && c.landing_url && (
              estaLeyendo && !sitio
                ? <Esqueleto leyendo />
                : (
                  <section className="spy-sitio">
                    <a className="spy-nombre" href={c.landing_url} target="_blank" rel="noreferrer noopener" style={{ color: 'inherit', fontSize: 16 }}>{sitio?.titulo ?? c.landing_url}</a>
                    {!!sitio?.piezasDePagina?.length && (
                      <div className="spy-etiquetas">{sitio.piezasDePagina.map((n) => <span key={n} className="spy-pildora-gris">{n}</span>)}</div>
                    )}
                    {!sitio && lecturasDe?.filter((l) => l.canal === 'landing').map((l) => <p key={l.canal} className="spy-aviso">{l.detalle}</p>)}
                    {/* ⚠️ El parámetro es `?analizar=`, el que el Web Generator entiende
                        (`derechaDeQuery`, app/web-generator/panel-reglas.ts). Un `?replicar=` no
                        existe en ese contrato: la query se ignora y el botón parece andar. */}
                    <a href={`/web-generator?analizar=${encodeURIComponent(c.landing_url)}`} className="spy-boton">Analizar y replicar su sitio</a>
                  </section>
                )
            )}

            {activa === 'anuncios' && (
              <div className="spy-rejilla">{anuncios.map((p) => <TarjetaPieza key={p.id} p={p} />)}</div>
            )}
          </>
        )}
      </div>

      {modal === 'alta' && <ModalAlta ocupado={ocupado} error={errorModal} onClose={() => setModal(null)} onPegar={(v) => void alta(v)} onAMano={(d) => void altaAMano(d)} />}
      {modal === 'canal' && c && <ModalCampo titulo={`Agregar un canal a ${c.nombre}`} placeholder="Su @, su canal de YouTube o su sitio" boton="Agregar" ocupado={ocupado} error={errorModal} onClose={() => setModal(null)} onEnviar={(v) => void sumarCanal(v)} />}
      {modal === 'anuncio' && c && <ModalCampo titulo="Guardar un anuncio" placeholder="Enlace del anuncio en la Biblioteca de Anuncios" boton="Guardar" ocupado={ocupado} error={errorModal} onClose={() => setModal(null)} onEnviar={(v) => void guardarAnuncio(v)} />}
      {modal === 'quitar' && c && <ConfirmModal msg={`¿Dejar de mirar a ${c.nombre}? Se borra lo que se leyó de él.`} confirmLabel="Dejar de mirarlo" onOk={() => void quitar()} onCancel={() => setModal(null)} />}
    </main>
  );
}
