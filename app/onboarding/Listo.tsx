'use client';

// =============================================================================
// Listo — la última pantalla del onboarding. Lo que reemplazó al redirect
// =============================================================================
// Antes, terminar el wizard te dejaba en /plan sin decir una palabra. Y /plan es
// un tablero: alguien que acaba de contestar veinte pantallas aterrizaba en una
// grilla de tarjetas sin saber si eso era el premio, el siguiente paso, o dónde
// había quedado todo lo que acababa de cargar.
//
// Esta pantalla es el corte. Dice UNA cosa —terminaste— y ofrece caminos, cada uno
// con el número real de lo que hay del otro lado: «tu plan con 14 tareas» no es
// «ver tu plan». El número es la razón para hacer clic, y sale de
// /api/onboarding/listo, que lo mide; ninguno está escrito acá.
//
// ── LAS DOS REGLAS DE ESTA PANTALLA ────────────────────────────────────────
//
// 1. UNO ES EL RECOMENDADO, Y ES «TERMINAR DE CONFIGURAR MAKO». Pedido de Martín.
//    No es el más vistoso —crear creativos lo es— pero es el único que hace que
//    todos los demás funcionen: una tab sin configurar entrega resultados
//    genéricos, y un cliente que la prueba así concluye que MaKo es genérico.
//
// 2. SI NO ELIGE ESE, EL AVISO NO SE PIERDE. Lo que quedó sin configurar sigue
//    apareciendo en /general (lib/onboarding-pendientes.ts) hasta que se resuelva.
//    Esta pantalla no es la única vez que se le va a ofrecer, y por eso puede
//    permitirse no insistir acá: elegir otra cosa es una decisión válida.
//
// ⚠️ NINGUNA OPCIÓN SE INVENTA. Una tarjeta que ofrece «cargá tus leads» a alguien
// que ya tiene 300 leads cargados, o «hacé una Retro» sin Meta conectado (la Retro
// cruza ads: sin ads es una hoja vacía), enseña que las sugerencias de MaKo no
// miran nada. Cada tarjeta pregunta primero si tiene sentido para ESTE workspace.
// =============================================================================

import { useEffect, useState } from 'react';
import { conWs } from '@/lib/ws-tab';
import { useWs } from '@/app/_ui/Link';

const MONO = "'Geist Mono', monospace";
const SANS = "'Geist', sans-serif";

type Pendiente = { que: string; donde: string; ruta: string };
type Config = { key: string; titulo: string; href: string };
/** Qué tabs ve la capa que compró el cliente. Lo decide el server con `navEnCapa`. */
type Ve = { creativos: boolean; crm: boolean; retro: boolean; general: boolean; plan: boolean };
type Datos = { tareas: number; leads: number; retro: boolean; pendientes: Pendiente[]; config: Config[]; ve: Ve };

/** Fail-closed al revés: sin dato de capa se ofrece todo, que es lo que hacía antes.
 *  Es la degradación correcta — esconder caminos por una consulta caída es peor que
 *  ofrecer uno que rebota, y la capa 'completo' (el default) los ve todos igual. */
const VE_TODO: Ve = { creativos: true, crm: true, retro: true, general: true, plan: true };
/** El plan que MaKo acaba de escribir: `n` tareas esperando aprobación en `url`. */
export type Borrador = { url: string; n: number };

type Opcion = {
  key: string;
  titulo: string;
  detalle: string;
  href: string;
  /** La recomendada: una sola, y se dibuja distinta (marco de acento + sello). */
  recomendada?: boolean;
};

/**
 * Las opciones, armadas contra lo que el workspace REALMENTE tiene.
 *
 * Vive afuera del componente y sin nada de React a propósito: es la única parte con
 * decisiones (qué se ofrece, con qué número, en qué orden) y así se puede probar sin
 * montar una pantalla. Lo de adentro es puro dibujo.
 */
export function opcionesDeCierre(d: Datos, plan: Borrador | null = null): Opcion[] {
  const plural = (n: number, uno: string, varios: string) => (n === 1 ? uno : varios);
  const ops: Opcion[] = [];

  // ── 1. La recomendada ────────────────────────────────────────────────────
  // Junta las dos formas de «te falta configurar»: las tabs que nunca se
  // recorrieron y lo que se postergó adentro del wizard. Son la misma frase para
  // el cliente —«esto todavía no está»— y separarlas en dos tarjetas obligaría a
  // elegir entre dos cosas que él lee igual.
  const faltan = [...d.config.map((c) => c.titulo), ...d.pendientes.map((p) => p.que)];
  if (faltan.length > 0) {
    ops.push({
      key: 'config',
      titulo: 'Terminar de configurar MaKo',
      // Se NOMBRA lo que falta, hasta tres. «Te faltan 4 cosas» no le dice si son
      // diez minutos o una tarde; los nombres sí.
      detalle: faltan.length <= 3
        ? faltan.join(' · ')
        : `${faltan.slice(0, 3).join(' · ')} y ${faltan.length - 3} más`,
      href: d.config[0]?.href ?? d.pendientes[0]?.ruta ?? '/integraciones',
      recomendada: true,
    });
  }

  // ── 2. Los creativos ─────────────────────────────────────────────────────
  // Va primero de los no-recomendados porque es el que produce algo visible el
  // mismo día, y es lo que el cliente vino a buscar.
  //
  // ⚠️ Todas las tarjetas de acá abajo preguntan si la capa VE esa tab. Ofrecer un
  // camino que rebota es peor que no ofrecerlo: el cliente hace clic, aterriza en otro
  // lado sin explicación, y aprende que lo que MaKo le ofrece no lleva a ningún lado —
  // justo en la pantalla que existe para ofrecerle caminos.
  const ve = d.ve ?? VE_TODO;

  if (ve.creativos) {
    ops.push({
      key: 'creativos',
      titulo: 'Crear tus creativos',
      detalle: 'MaKo escribe los guiones de tus anuncios con tu matriz, tu oferta y tu voz.',
      href: '/ads-writer',
    });
  }

  // ── 3. El plan ───────────────────────────────────────────────────────────
  //
  // ⚠️ EL BORRADOR MANDA SOBRE EL CONTEO, Y ESA DISTINCIÓN YA COSTÓ UN REPORTE.
  // Al cerrar el wizard, MaKo NO inserta tareas: deja una PROPUESTA en
  // /plan/revisar/<id> que el dueño confirma de a una (regla de la casa: el server
  // decide crear/ampliar/ignorar, nadie inserta a ciegas). O sea que un cliente
  // recién terminado tiene N tareas escritas y CERO en el tablero — que es
  // exactamente lo que se vio en vivo: «el plan del cliente está totalmente vacío y
  // ya creó tareas». Mandarlo a /plan acá sería repetir ese momento.
  //
  // Por eso, si hay borrador, la tarjeta apunta AHÍ y usa SU número. El conteo del
  // tablero es el fallback para quien vuelve a ver esta pantalla más tarde.
  const nPlan = plan?.n ?? d.tareas;
  ops.push({
    key: 'plan',
    titulo: nPlan > 0 ? `Revisar tu plan · ${nPlan} ${plural(nPlan, 'tarea', 'tareas')}` : 'Armar tu plan',
    detalle: plan
      ? 'MaKo las escribió con tu diagnóstico y tu negocio. Apruebas las que quieras, una por una.'
      : nPlan > 0
        ? 'El Perro Guardián ya las priorizó y te dice por qué. Puedes discutírselo.'
        : 'Cuéntale a MaKo en qué estás trabajando y el Perro Guardián lo ordena.',
    href: plan?.url ?? '/plan',
  });

  // ── 4. El CRM ────────────────────────────────────────────────────────────
  if (ve.crm) {
    ops.push({
      key: 'crm',
      titulo: d.leads > 0 ? `Trabajar tus ${d.leads} leads` : 'Cargar tus leads',
      detalle: d.leads > 0
        ? 'MaKo los mueve de etapa solo y te avisa a quién hay que contestarle.'
        : 'Sube tus contactos y MaKo empieza a seguirlos por ti.',
      href: '/crm',
    });
  }

  // ── 5. La Retro, SOLO si hay con qué ─────────────────────────────────────
  // La Retro cruza ads, leads, llamadas y dinero. Sin la fuente de los ads no hay
  // informe: hay una hoja vacía con el nombre de un producto arriba.
  if (d.retro && ve.retro) {
    ops.push({
      key: 'retro',
      titulo: 'Hacer tu primera Retro',
      detalle: 'Un informe de los últimos meses: qué funcionó, qué te costó dinero y qué hacer ahora.',
      href: '/experimentos',
    });
  }

  return ops;
}

export function Listo({ adminBar, nombre, plan = null }: { adminBar?: React.ReactNode; nombre?: string; plan?: Borrador | null }) {
  const ws = useWs();
  const [d, setD] = useState<Datos | null>(null);

  useEffect(() => {
    let vivo = true;
    (async () => {
      try {
        const j = await (await fetch('/api/onboarding/listo')).json();
        if (!vivo) return;
        // Un fallo NO deja la pantalla colgada: se cae al set neutro y las tarjetas
        // salen sin números. El cliente terminó el onboarding — lo último que puede
        // ver es un spinner eterno por una consulta de conteo.
        setD(j?.ok ? (j as Datos) : { tareas: 0, leads: 0, retro: false, pendientes: [], config: [], ve: VE_TODO });
      } catch {
        if (vivo) setD({ tareas: 0, leads: 0, retro: false, pendientes: [], config: [], ve: VE_TODO });
      }
    })();
    return () => { vivo = false; };
  }, []);

  const ops = d ? opcionesDeCierre(d, plan) : [];

  return (
    <div style={{ position: 'fixed', inset: 0, zIndex: 100, background: 'var(--bg)', fontFamily: SANS, display: 'flex', flexDirection: 'column' }}>
      {adminBar && <div style={{ flex: 'none' }}>{adminBar}</div>}
      <div style={{ flex: 1, minHeight: 0, overflowY: 'auto', display: 'flex', flexDirection: 'column', alignItems: 'center', justifyContent: 'center', padding: 'clamp(24px,6vh,64px) 20px 56px' }}>
        <div style={{ width: '100%', maxWidth: 760, display: 'flex', flexDirection: 'column', alignItems: 'center', gap: 34 }}>

          {/* El corte. Una línea chica que dice qué pasó y un título enorme que dice
              qué sigue — la pantalla no es un recibo, es una puerta. */}
          <div style={{ textAlign: 'center' }}>
            <div style={{ fontFamily: MONO, fontSize: 11.5, letterSpacing: '.14em', textTransform: 'uppercase', color: 'var(--accent)', marginBottom: 14 }}>
              ✦ Tu MaKo está listo
            </div>
            <h1 style={{ margin: 0, fontSize: 'clamp(26px,3.4vw,40px)', fontWeight: 640, letterSpacing: '-.025em', lineHeight: 1.15, color: 'var(--ink)' }}>
              {nombre ? `Ya tengo tu negocio adentro, ${nombre}.` : 'Ya tengo tu negocio adentro.'}
            </h1>
            <p style={{ margin: '12px 0 0', fontSize: 15.5, lineHeight: 1.5, color: 'var(--dim)' }}>
              ¿Qué quieres hacer ahora?
            </p>
          </div>

          {d === null ? (
            <div style={{ fontFamily: MONO, fontSize: 13, color: 'var(--faint)' }}>Preparando tu espacio…</div>
          ) : (
            <div style={{ width: '100%', display: 'flex', flexDirection: 'column', gap: 10 }}>
              {ops.map((o) => (
                <a
                  key={o.key}
                  href={conWs(o.href, ws)}
                  style={{
                    display: 'flex', alignItems: 'center', gap: 16, textDecoration: 'none',
                    padding: '18px 20px', borderRadius: 14,
                    // La recomendada se distingue por MARCO y no por relleno: un
                    // bloque lleno se lee como un botón primario y esta pantalla
                    // tiene cinco caminos igual de válidos, uno más aconsejado.
                    border: o.recomendada ? '1px solid var(--accent)' : '1px solid var(--border)',
                    background: o.recomendada ? 'var(--mako-bg, var(--surface))' : 'var(--surface)',
                  }}
                >
                  <div style={{ flex: 1, minWidth: 0 }}>
                    <div style={{ display: 'flex', alignItems: 'center', gap: 10, flexWrap: 'wrap' }}>
                      <span style={{ fontSize: 16, fontWeight: 640, color: 'var(--ink)', letterSpacing: '-.01em' }}>{o.titulo}</span>
                      {o.recomendada && (
                        <span style={{ fontFamily: MONO, fontSize: 9.5, letterSpacing: '.1em', textTransform: 'uppercase', color: 'var(--accent)', border: '1px solid var(--accent)', borderRadius: 999, padding: '2px 8px' }}>
                          Recomendado
                        </span>
                      )}
                    </div>
                    <div style={{ fontSize: 13.5, color: 'var(--dim)', lineHeight: 1.5, marginTop: 4 }}>{o.detalle}</div>
                  </div>
                  <span aria-hidden style={{ flex: 'none', fontSize: 18, color: o.recomendada ? 'var(--accent)' : 'var(--faint)' }}>→</span>
                </a>
              ))}
            </div>
          )}

          {/* La salida sin elegir nada. Existe a propósito: obligar a elegir un
              camino en la pantalla del final convertiría el cierre en un paso más. */}
          {/* El destino de la salida también depende de la capa: una que no ve /general
              (la de Project Manager ve solo el plan y MaKo) rebotaría contra el guard y
              aterrizaría en otro lado sin decir por qué. */}
          {d !== null && (
            <a href={conWs((d.ve ?? VE_TODO).general ? '/general' : '/plan', ws)} style={{ fontSize: 13.5, color: 'var(--faint)', textDecoration: 'underline' }}>
              Prefiero mirar solo
            </a>
          )}
        </div>
      </div>
    </div>
  );
}
