'use client';

// =============================================================================
// LimitesEnvioPanel — los LÍMITES de las automatizaciones (Automations › Configuraciones › Límites)
// =============================================================================
// Décima tanda (11/10/2026, GENERAL 4), textual: «configuraciones sobre todo para limitaciones de todos los
// flujos, si estoy prospectando en frio con esto, que se tenga en cuenta las configuraciones que en su
// momento tuvimos en cuenta, como que no se envien más de X cantidad de mensajes... Que todo eso sea
// configurable.»
//
// Tres grupos —WhatsApp, Email y «MaKo contesta sola»— con un número y sus flechas por límite, rótulos de
// 1-3 palabras y «Restaurar» (vuelve todo a lo de fábrica). Las reglas, los rangos y lo de fábrica viven en
// lib/limites-envio.ts; esto sólo los dibuja.
//
// SIN TEXTO SUELTO (22/10/2026, Martín: «Jamás jamás pongas todo eso... Elimina todo el texto innecesario y diseñalo
// mejor»): las filas de FilasOpciones.tsx (nombre, número y unidad). Lo que se usó del cupo («24 h: 6 de 40») y la regla
// de «Primero lo que entra» van en el ⓘ del grupo; la ayuda de una fila que la necesita, en el suyo (`info`). Los topes de
// la LÍNEA no se apagan (son lo que la protege del baneo): sus filas dejan el hueco del interruptor.
//
// ⚠️ SE GUARDA SOLO, CADA CAMBIO, como el horario de oficina (HorarioEnvioPanel: «elimina el botón de
// guardar, si se hace un cambio ya se debe quedar guardado»). Lo que está fuera de rango NO se guarda: se
// dice al lado y lo de antes sigue mandando. Mientras un guardado está en vuelo el panel está «sucio»
// (`onSucio`): el modal de Configuraciones no se cierra hasta que termina.
//
// ⚠️ SÓLO UN ADMIN EDITA (`puedeEditar` sale del server, y guardar lo vuelve a exigir). El setter lo ve.

import { useEffect, useRef, useState, type CSSProperties } from 'react';
import { Icon } from '@/app/_components/icons';
import { FilaOpcion, Unidad } from './FilasOpciones';
import { getLimitesEnvioAction, saveLimitesEnvioAction } from '@/app/configuraciones/limites-actions';
import { textoPrioridad } from '@/lib/nutricion-prioridad';
import { FILAS_LINEA, conLimite, leerLimite, leerNumero, lineaDeUso, rangoDe, type FilaLimite, type LimitesEnvio, type UsoDelCupo } from '@/lib/limites-envio';

const SANS = "'Geist', sans-serif";

type Grupo = keyof LimitesEnvio;
type Uso = UsoDelCupo | null;

/**
 * El número con sus dos flechas. Las flechas no pasan del rango; lo escrito a mano se valida al salir.
 * `apagado` (22/10/2026, Anti-ban): la opción no aplica, el número se ve GRIS y no se toca (se prende con su interruptor).
 */
export function Numero({ valor, min, max, disabled: noEdita, etiqueta, onCambio, onInvalido, apagado = false }: {
  valor: number; min: number; max: number; disabled: boolean; etiqueta: string;
  onCambio: (n: number) => void; onInvalido: (error: string | null) => void; apagado?: boolean;
}) {
  const disabled = noEdita || apagado;
  const [texto, setTexto] = useState(String(valor));
  // Lo guardado cambió por otro lado («Restaurar», la lectura): el campo lo sigue.
  const [visto, setVisto] = useState(valor);
  if (visto !== valor) { setVisto(valor); setTexto(String(valor)); }
  const escribir = (t: string) => {
    setTexto(t);
    const r = leerNumero(t, min, max);
    if (r.ok) { onInvalido(null); onCambio(r.n); } else onInvalido(r.error);
  };
  const flecha = (d: 1 | -1) => {
    const n = Math.min(max, Math.max(min, valor + d));
    setTexto(String(n)); onInvalido(null);
    if (n !== valor) onCambio(n);
  };
  const btn: CSSProperties = {
    width: 22, height: 15, padding: 0, border: 'none', background: 'transparent', color: 'var(--dim)',
    display: 'flex', alignItems: 'center', justifyContent: 'center', cursor: disabled ? 'default' : 'pointer',
  };
  return (
    <div data-numero-apagado={apagado ? '' : undefined} style={{ display: 'inline-flex', alignItems: 'center', border: `1px solid ${apagado ? 'var(--border)' : 'var(--border-strong)'}`, borderRadius: 10, background: apagado ? 'var(--surface-2)' : 'var(--surface)', height: 34, boxSizing: 'border-box', overflow: 'hidden', flex: 'none' }}>
      <input value={texto} disabled={disabled} inputMode="numeric" aria-label={etiqueta}
        onChange={(e) => escribir(e.target.value.replace(/[^\d]/g, ''))}
        onKeyDown={(e) => { if (e.key === 'ArrowUp') { e.preventDefault(); flecha(1); } else if (e.key === 'ArrowDown') { e.preventDefault(); flecha(-1); } }}
        style={{ width: 52, height: '100%', border: 'none', outline: 'none', background: 'transparent', textAlign: 'center', fontFamily: SANS, fontSize: 14.5, fontWeight: 600, color: apagado ? 'var(--faint)' : 'var(--ink)' }} />
      <div style={{ display: 'flex', flexDirection: 'column', borderLeft: '1px solid var(--border)' }}>
        <button type="button" aria-label={`Subir ${etiqueta}`} disabled={disabled || valor >= max} onClick={() => flecha(1)} style={btn}>
          <span style={{ display: 'flex', transform: 'rotate(180deg)' }}><Icon name="chevron" size={13} /></span>
        </button>
        <button type="button" aria-label={`Bajar ${etiqueta}`} disabled={disabled || valor <= min} onClick={() => flecha(-1)} style={{ ...btn, borderTop: '1px solid var(--border)' }}>
          <Icon name="chevron" size={13} />
        </button>
      </div>
    </div>
  );
}

/**
 * EL ⓘ DE UN GRUPO (22/10/2026): lo que ya salió del cupo y, en WhatsApp, la regla de la cola («Primero lo que entra»,
 * 21/10/2026). Eran dos líneas de texto sueltas arriba y abajo del grupo.
 */
export function infoDelGrupo(titulo: string, uso: Uso, l: LimitesEnvio): string | undefined {
  const partes = [lineaDeUso(titulo, uso, l), titulo === 'WhatsApp' ? textoPrioridad(l.wa) : null].filter((x): x is string => !!x);
  return partes.length ? partes.join('. ') : undefined;
}

/**
 * LOS LÍMITES DE LA LÍNEA, como estado de la pantalla (23/10/2026: era el componente `LimitesEnvioPanel`, con sus tres
 * bloques juntos). UN estado para toda la línea: dos instancias, una por bloque, guardaban cada una su copia ENTERA y la
 * segunda pisaba a la primera. `onSucio`: hay un guardado en vuelo (el modal no se cierra mientras tanto).
 */
export function useLimitesDeLaLinea(onSucio?: (sucio: boolean) => void) {
  const [l, setL] = useState<LimitesEnvio | null>(null);
  const [fabrica, setFabrica] = useState<LimitesEnvio | null>(null);
  const [uso, setUso] = useState<Uso>(null);
  const [puedeEditar, setPuedeEditar] = useState(false);
  const [aviso, setAviso] = useState('');
  /** Los campos escritos a mano que no valen, por `grupo.campo`: mientras haya uno, no se guarda nada. */
  const [invalidos, setInvalidos] = useState<Record<string, string>>({});
  const [enVuelo, setEnVuelo] = useState(false);
  /** Sube con «Restaurar»: los números vuelven a leer lo guardado aunque tuvieran algo escrito que no valía. */
  const [vuelta, setVuelta] = useState(0);
  const respiro = useRef<ReturnType<typeof setTimeout> | null>(null);
  const pedido = useRef(0);

  useEffect(() => {
    let vivo = true;
    getLimitesEnvioAction()
      .then((d) => { if (!vivo) return; setL(d.limites); setFabrica(d.fabrica); setUso(d.uso); setPuedeEditar(d.puedeEditar); })
      .catch(() => { if (vivo) setAviso('No pude leer los límites.'); });
    return () => { vivo = false; if (respiro.current) clearTimeout(respiro.current); };
  }, []);
  useEffect(() => { onSucio?.(enVuelo); }, [enVuelo, onSucio]);

  /** Cada cambio se GUARDA, con un respiro: tres flechas seguidas son un guardado, no tres. */
  const guardar = (nuevo: LimitesEnvio) => {
    setL(nuevo);
    setAviso('');
    if (respiro.current) clearTimeout(respiro.current);
    setEnVuelo(true);
    const n = ++pedido.current;
    respiro.current = setTimeout(() => {
      void saveLimitesEnvioAction(nuevo)
        .catch(() => ({ ok: false, error: 'No se pudo guardar.' } as const))
        .then((r) => {
          if (n !== pedido.current) return;
          setEnVuelo(false);
          if (!r.ok) { setAviso(r.error || 'No se pudo guardar.'); return; }
          if ('limites' in r && r.limites) setL(r.limites);
        });
    }, 350);
  };
  const cambiar = (base: LimitesEnvio, grupo: Grupo, campo: string, n: number) => {
    if (Object.keys(invalidos).some((k) => k !== `${grupo}.${campo}`)) { setL(conLimite(base, grupo, campo, n)); return; }
    guardar(conLimite(base, grupo, campo, n));
  };
  const marcarInvalido = (clave: string, error: string | null) => setInvalidos((prev) => {
    if (!error) { if (!(clave in prev)) return prev; const { [clave]: _, ...resto } = prev; void _; return resto; }
    return prev[clave] === error ? prev : { ...prev, [clave]: error };
  });
  const off = !puedeEditar;
  /** Una fila de la línea (sin interruptor: no se apaga). */
  const fila = (f: FilaLimite) => {
    if (!l) return null;
    const clave = `${f.grupo}.${f.campo}`;
    const [min, max] = rangoDe(f.grupo, f.campo);
    return (
      <FilaOpcion key={clave} nombre={f.rotulo} info={f.info} sinInterruptor error={invalidos[clave]} datos={{ 'data-limite': clave }}>
        <Numero key={`${clave}:${vuelta}`} valor={leerLimite(l, f.grupo, f.campo)} min={min} max={max} disabled={off} etiqueta={f.rotulo}
          onCambio={(n) => cambiar(l, f.grupo, f.campo, n)} onInvalido={(e) => marcarInvalido(clave, e)} />
        <Unidad>{f.unidad}</Unidad>
      </FilaOpcion>
    );
  };
  /** ¿Algo de lo que está EN la pantalla difiere de lo de fábrica? (las horas del negocio no están: no cuentan). */
  const difiere = !!l && !!fabrica && FILAS_LINEA.some((f) => leerLimite(l, f.grupo, f.campo) !== leerLimite(fabrica, f.grupo, f.campo));
  /** «Restaurar»: lo de fábrica de lo que se ve, SIN tocar las horas a la misma persona del negocio (no están en la pantalla). */
  const restaurar = () => {
    if (!l || !fabrica) return;
    setInvalidos({}); setVuelta((v) => v + 1);
    guardar({ ...fabrica, wa: { ...fabrica.wa, personaHoras: l.wa.personaHoras }, email: { ...fabrica.email, personaHoras: l.email.personaHoras } });
  };
  return {
    listo: !!l && !!fabrica, aviso, off, difiere, restaurar,
    /** Las filas de un grupo («wa», «email», «mako»), en su orden. */
    filasDe: (grupo: Grupo) => FILAS_LINEA.filter((f) => f.grupo === grupo).map(fila),
    /** El ⓘ de un bloque (lo que se usó del cupo y, en WhatsApp, la regla de la cola). */
    info: (titulo: string) => (l ? infoDelGrupo(titulo, uso, l) : undefined),
  };
}
