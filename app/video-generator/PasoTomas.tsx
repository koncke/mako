'use client';

/**
 * Todas las tomas del anuncio en UNA pantalla.
 *
 * ── Qué reemplaza ───────────────────────────────────────────────────────────
 * Un paso por toma —`toma-1`, `cara`, `toma-2` … `toma-7`— o sea ocho pantallas
 * para una sola decisión repetida. El dueño: «que durante la generación de todos
 * los clips o tomas, que esos no representen muchos pasos del form, que
 * representen 1 solo paso… que el usuario pueda ir viendo todos los clips que va
 * generando, y los que aún no están generados que aparezcan con el placeholder».
 *
 * ── Grande arriba y tira abajo ──────────────────────────────────────────────
 * No es la forma más parecida al ícono que mandó —tarjetas apiladas—, y se eligió
 * igual: apiladas esconden las de atrás, y con siete u ocho tomas obligan a un
 * gesto para ver cada una. Grande arriba conserva la regla de la casa —lo que se
 * decide va ENORME— y la tira de abajo cumple lo que el apilado prometía: ver de
 * un vistazo cuáles están y cuáles faltan. Y no estrena una forma nueva: es la
 * misma que ya usa la pantalla final del anuncio.
 *
 * ⚠️ EL GATE DE LA CARA NO DESAPARECE, CAMBIA DE FORMA. El paso `cara` existía
 * para que nadie gastara ~105 créditos con una cara que no miró. Acá eso es el
 * botón: hasta que haya una toma aprobada, lo único que se ofrece es generar la
 * primera. La protección deja de ser una pared y pasa a ser el camino por
 * defecto, que es más barato de obedecer.
 */

import { useMemo } from 'react';
import { Button } from '@/app/_ui';
import { Icon } from '@/app/_components/icons';
import { IconoBorrar } from '@/app/_ui/BotonBorrar';
import { textoFlow, type CausaFlow } from '@/lib/flow-fallo-texto';
import { DURACIONES_FLOW, creditosDeClip } from '@/lib/costo-clip';
import type { PlanGuardado } from './video-datos';

/** En qué anda una toma. El orden importa: se evalúa de arriba abajo. */
export type EstadoToma = 'filmada' | 'generando' | 'fallada' | 'sin-texto' | 'pendiente';

export function estadoDeToma(item: PlanGuardado, n: number): EstadoToma {
  const v = item.video?.[String(n)];
  if (v?.url) return 'filmada';
  if (v?.error) return 'fallada';
  if (v?.trabajoId || v?.operacion) return 'generando';
  // ⚠️ Antes que `pendiente`: una toma sin texto no se puede filmar, y decir
  // «pendiente» sobre algo que el botón va a rechazar es prometer un camino que
  // no existe. Pasa con los clips que se agregan a mano, que nacen vacíos.
  if (!(item.plan.clips.find((c) => c.n === n)?.voz ?? '').trim()) return 'sin-texto';
  return 'pendiente';
}

const COLOR: Record<EstadoToma, string> = {
  filmada: 'var(--primary)',
  // ⚠️ Sin fallback. `--mako` existe (globals.css:123 y su variante oscura), así
  // que el `#d4a94a` que había acá nunca se pintaba — pero era un SEGUNDO dorado
  // de marca escrito a mano, esperando a que alguien renombrara el token para
  // tomar el control en silencio.
  generando: 'var(--mako)',
  // ⚠️ `--bad`, y antes decía `var(--danger, #f87171)`. `--danger` NO EXISTE en
  // ningún .css del repo, así que un `var()` con fallback siempre pintaba el hex
  // —un rojo que ningún tema da vuelta— y encima parecía un token. `--bad` sí
  // existe, y tiene su variante para fondo oscuro (globals.css:274).
  fallada: 'var(--bad)',
  // ⚠️ ÁMBAR, Y NO EL MISMO GRIS QUE `pendiente`. Son dos estados distintos y se
  // pintaban idénticos: el rótulo que los separaba vivía sólo en `title` y
  // `aria-label`, o sea en ningún lado que se vea. Y no son intercambiables —
  // `pendiente` es «todavía no le tocó», que se arregla solo esperando;
  // `sin-texto` es «esta toma no tiene qué decir», que NO se arregla solo y
  // bloquea el filmado. Uno es reposo y el otro es una deuda.
  'sin-texto': 'var(--warn)',
  pendiente: 'var(--border-strong)',
};

const ROTULO: Record<EstadoToma, string> = {
  filmada: 'Lista',
  generando: 'Filmando',
  fallada: 'No salió',
  'sin-texto': 'Falta el texto',
  pendiente: 'Sin filmar',
};

export function PasoTomas({
  item, sel, onSel, ocupado, correr, onEditarPrompt, onNoSeParece, arreglo, acciones,
}: {
  item: PlanGuardado;
  sel: number;
  onSel: (n: number) => void;
  ocupado: string;
  correr: (etiqueta: string, fn: () => Promise<{ ok: boolean; item?: PlanGuardado; error?: string }>, avanzar?: boolean) => void;
  onEditarPrompt: (n: number) => void;
  /**
   * «No se parece a mí»: lleva al escenario con la pregunta del parecido.
   *
   * ⚠️ Lo cazó el inventario que se corrió ANTES de escribir esta pantalla: era la
   * única forma de llegar al escenario preguntándose si la IA copió bien la cara,
   * y el paso único lo había perdido en silencio. Además es donde vive la
   * comparación foto/imagen — por eso no hace falta repetirla acá.
   */
  onNoSeParece: (n: number) => void;
  /**
   * Qué hace el botón que ARREGLA este fallo. Lo resuelve el padre, que es el que
   * tiene las actions y sabe qué escenario cubre cada toma.
   *
   * ⚠️ EXISTE PORQUE EL MENSAJE DECÍA QUÉ HACER Y NO HABÍA CÓMO HACERLO. Cada
   * causa de `textoFlow` declara su `accion` desde siempre —«Volver a generar el
   * escenario», «Decir qué cambiar»— y esta pantalla dibujaba el texto y ningún
   * botón. Es el antipatrón que el repo ya tiene escrito: escribir la salida no es
   * ofrecerla.
   *
   * Se vio en vivo con el filtro de caras de Google: el mensaje explicaba que lo
   * que destraba es generar otra vez la imagen del escenario, que además es
   * gratis, y la persona tenía que deducir sola a qué pantalla ir. Martín: «si
   * sale esto, ofrece ahí mismo solucionarlo, cambiando la imagen».
   *
   * `null` = para esta causa no hay nada que ESTA pantalla pueda ofrecer (el
   * puente, por ejemplo, se arregla en su propio aviso). Un botón que no
   * resuelve es peor que ninguno.
   */
  arreglo: (causa: CausaFlow, n: number) => { gratis: boolean; hacer: () => void; etiqueta?: string } | null;
  /** Las acciones del server, inyectadas: este componente no importa actions. */
  acciones: {
    generar: (n: number) => Promise<{ ok: boolean; item?: PlanGuardado; error?: string }>;
    descartar: (n: number) => Promise<{ ok: boolean; item?: PlanGuardado; error?: string }>;
    editar: (orden: { que: 'agregar'; despuesDe: number; segundos: number } | { que: 'quitar'; n: number } | { que: 'duracion'; n: number; segundos: number }) => Promise<{ ok: boolean; item?: PlanGuardado; error?: string }>;
    escribirVoz: (n: number, voz: string) => Promise<{ ok: boolean; item?: PlanGuardado; error?: string }>;
    recuperar: (n: number) => Promise<{ ok: boolean; item?: PlanGuardado; error?: string }>;
  };
}) {
  const clips = item.plan.clips;
  const estados = useMemo(
    () => new Map(clips.map((c) => [c.n, estadoDeToma(item, c.n)])),
    [item, clips],
  );
  const clip = clips.find((c) => c.n === sel) ?? clips[0];
  const estado = estados.get(sel) ?? 'pendiente';
  const marca = item.video?.[String(sel)];
  const trabajando = !!ocupado;

  // ⚠️ EL DEFAULT NO PUEDE SER UNA ACUSACIÓN. Era `?? 'contenido'`, o sea que
  // cualquier fallo sin causa guardada salía como «el filtro de contenido rechazó
  // cómo está escrito el escenario… hay que reescribirlo» — mandando a reescribir
  // un guion sobre una causa que nadie determinó. `desconocida` dice lo que se
  // sabe, que es nada, y no manda a arreglar algo que capaz está bien.
  const causa = marca?.error
    ? ((marca.errorCausa as CausaFlow) ?? 'desconocida')
    : undefined;
  // ⚠️ `errorDetalle` Y NO `errorCrudo`. El segundo es la EVIDENCIA —el JSON de
  // Google— y pasarlo como «lo que dijo el servidor» le dibujó a una clienta 1.600
  // caracteres de payload centrados en el recuadro donde va el video.
  const txt = causa ? textoFlow(causa, `la toma ${sel}`, marca?.errorAt, undefined, marca?.errorDetalle) : null;

  return (
    <div style={{ display: 'grid', gap: 14, justifyItems: 'center', width: 420 }}>
      {/* ── LO GRANDE: la toma que se está mirando ───────────────────────── */}
      <div style={{
        width: 300, aspectRatio: '9 / 16', borderRadius: 18, overflow: 'hidden',
        background: '#000', position: 'relative', display: 'grid', placeItems: 'center',
        boxShadow: '0 24px 70px rgba(0,0,0,.55)',
      }}>
        {estado === 'filmada' && marca?.url && (
          <video key={marca.url} src={marca.url} controls loop playsInline
            style={{ width: '100%', height: '100%', objectFit: 'cover' }} />
        )}
        {estado === 'generando' && (
          <div style={{ textAlign: 'center', color: 'var(--dim)', padding: 20 }}>
            <div className="mk-cargando-foto" aria-hidden style={{ marginBottom: 12 }} />
            <div style={{ fontSize: 'var(--fs-sm)' }}>Filmando la toma {sel}</div>
            <div style={{ fontSize: 'var(--fs-meta)', marginTop: 6 }}>Suele tardar entre 1 y 3 minutos.</div>
          </div>
        )}
        {estado === 'fallada' && txt && (() => {
          const arr = causa ? arreglo(causa, sel) : null;
          return (
            // ⚠️ SCROLLEA POR DENTRO. La caja tiene `overflow: hidden` y un alto
            // fijo: sin esto, un mensaje largo empuja al botón fuera del recuadro y
            // desaparece sin dejar rastro — que es peor que no tenerlo, porque el
            // texto sigue diciendo qué hacer.
            <div style={{
              display: 'flex', flexDirection: 'column', gap: 12, alignItems: 'center',
              textAlign: 'center', padding: 22, maxHeight: '100%', overflowY: 'auto',
            }} className="mk-scroll-y">
              <div>
                <div style={{ fontSize: 'var(--fs-md)', fontWeight: 650, color: 'var(--ink)' }}>{txt.titulo}</div>
                <div style={{ fontSize: 'var(--fs-sm)', color: 'var(--dim)', marginTop: 9, lineHeight: 1.5 }}>
                  {txt.detalle}
                </div>
              </div>
              {arr && (
                <div style={{ display: 'grid', gap: 5, justifyItems: 'center' }}>
                  {/* La etiqueta sale de `textoFlow`, que ya la escribió para esta
                      causa. Una segunda redacción acá sería el mismo texto en dos
                      lugares, y el que se queda viejo es el que nadie mira. */}
                  <Button
                    size="sm"
                    variant={arr.gratis ? 'mako' : 'secondary'}
                    disabled={trabajando}
                    loading={!!ocupado}
                    onClick={arr.hacer}
                  >
                    {/* ⚠️ La etiqueta viaja CON la acción. Cuando el remedio cambia
                        —la imagen ya probada manda a reescribir la línea, no a
                        rehacer la imagen— el rótulo tiene que cambiar con él, o el
                        botón promete una cosa y hace otra. Ya pasó en este archivo
                        con «Revisar el puente», que gastaba 15 créditos. */}
                    {arr.etiqueta ?? txt.accion}
                  </Button>
                  {/* ⚠️ LA CONSECUENCIA, PEGADA AL BOTÓN. Que el camino que destraba
                      sea GRATIS es la mitad del mensaje: sin decirlo, alguien que
                      acaba de ver fallar una toma no aprieta nada por miedo a pagar
                      otra. Y cuando sí cuesta, el número va antes del click. */}
                  <div style={{ fontSize: 'var(--fs-meta)', color: 'var(--faint)' }}>
                    {arr.gratis
                      ? 'No gasta créditos.'
                      : `Filmar de nuevo cuesta ${creditosDeClip(clip?.segundos ?? 8)} créditos.`}
                  </div>
                </div>
              )}
            </div>
          );
        })()}
        {(estado === 'pendiente' || estado === 'sin-texto') && (
          // El placeholder NO está vacío: muestra lo que esa toma va a decir. Es
          // lo único que distingue una toma de otra antes de filmarla.
          <div style={{ padding: 24, textAlign: 'center', color: 'var(--dim)' }}>
            <Icon name="video" size={34} />
            <div style={{ marginTop: 14, fontSize: 'var(--fs-sm)', lineHeight: 1.55 }}>
              {clip?.voz?.trim() || 'Esta toma todavía no dice nada. Escribe su línea abajo.'}
            </div>
          </div>
        )}
      </div>

      {/* ── LA TIRA: las que están y las que faltan ──────────────────────── */}
      <div style={{ display: 'flex', flexWrap: 'wrap', gap: 7, justifyContent: 'center', maxWidth: 420 }}>
        {clips.map((c) => {
          const e = estados.get(c.n) ?? 'pendiente';
          const activa = c.n === sel;
          return (
            <button
              key={c.n}
              type="button"
              onClick={() => onSel(c.n)}
              aria-current={activa}
              aria-label={`Toma ${c.n}: ${ROTULO[e]}`}
              title={`Toma ${c.n} · ${ROTULO[e]} · ${c.segundos}s`}
              style={{
                width: 40, aspectRatio: '9 / 16', borderRadius: 7, padding: 0, lineHeight: 0,
                cursor: 'pointer', position: 'relative', overflow: 'hidden',
                background: 'var(--surface-2)',
                border: activa ? '2px solid var(--primary)' : '1px solid var(--border)',
              }}
            >
              {e === 'filmada' && item.video?.[String(c.n)]?.url ? (
                <video src={item.video[String(c.n)]!.url} muted playsInline preload="metadata"
                  style={{ width: '100%', height: '100%', objectFit: 'cover' }} />
              ) : (
                <span style={{
                  display: 'grid', placeItems: 'center', width: '100%', height: '100%',
                  fontSize: 11, color: 'var(--faint)',
                }}>{c.n}</span>
              )}
              {/* La barrita de estado: color y rótulo, nunca sólo color. */}
              <span style={{
                position: 'absolute', left: 0, right: 0, bottom: 0, height: 3, background: COLOR[e],
              }} />
            </button>
          );
        })}
      </div>

      <div style={{ fontSize: 'var(--fs-sm)', color: 'var(--dim)' }}>
        Toma {sel} de {clips.length} · {ROTULO[estado]} · {clip?.segundos}s
        {creditosDeClip(clip?.segundos ?? 0) != null && estado !== 'filmada'
          ? ` · ${creditosDeClip(clip!.segundos)} créditos` : ''}
      </div>

      {/* ── LO QUE SE LE PUEDE HACER A ESTA TOMA ─────────────────────────── */}
      <div style={{ display: 'flex', gap: 9, flexWrap: 'wrap', justifyContent: 'center' }}>
        {estado === 'filmada' && (
          <Button size="sm" variant="secondary" disabled={trabajando}
            loading={ocupado === `rehacer-${sel}`}
            icon={<Icon name="regenerar" size={14} />}
            onClick={() => correr(`rehacer-${sel}`, async () => {
              const d = await acciones.descartar(sel);
              if (!d.ok) return d;
              return acciones.generar(sel);
            }, false)}
          >
            Rehacer
          </Button>
        )}
        {/* ⚠️ «VOLVER A FILMAR» NO SE OFRECE CUANDO SABEMOS QUE FALLA.

            El filtro de caras de Google no rechaza el prompt: rechaza LA CARA de la
            imagen del escenario, y refilmar le manda exactamente la misma. Ofrecerlo
            ahí es ofrecer un botón que ya sabemos que no funciona.

            Medido el 02/09/2026: una clienta lo apretó DIECISIETE veces seguidas
            —17 consultas de estado consecutivas, todas con `IDENTIFIABLE_PERSON_SAFETY`,
            sobre la misma imagen— y en toda esa hora no hubo una sola generación de
            imagen. El camino que destraba estaba a un click, es gratis, y la pantalla
            le ponía adelante el que no sirve.

            ⚠️ Y LA REGLA YA ESTABA ESCRITA, en el paso `toma` de `WizardAnuncio`:
            «ofrecer Volver a filmar ahí es ofrecer un botón que ya sabemos que
            falla». Aplicada en una pantalla de dos — y la que quedó sin aplicarla es
            la que se dibuja. Una regla en un lugar de dos no está implementada:
            está documentada.

            Lo que SÍ se ofrece para esa causa es el botón del recuadro de arriba,
            que genera otra imagen y no cuesta créditos. */}
        {(estado === 'pendiente' || (estado === 'fallada' && causa !== 'persona_publica')) && (
          <Button size="sm" variant="secondary" disabled={trabajando}
            loading={ocupado === `filmar-${sel}`}
            onClick={() => correr(`filmar-${sel}`, () => acciones.generar(sel), false)}
          >
            {estado === 'fallada' ? 'Volver a filmar' : 'Filmar esta'}
          </Button>
        )}
        {/* La salida para el que igual quiere insistir: existe, y está donde se lee
            DESPUÉS del camino bueno, no antes. Un camino cerrado del todo es peor
            que uno desaconsejado — el fallo es intermitente y la misma imagen ya
            produjo nueve tomas buenas. */}
        {estado === 'fallada' && causa === 'persona_publica' && (
          <Button size="sm" variant="tertiary" disabled={trabajando}
            loading={ocupado === `filmar-${sel}`}
            onClick={() => correr(`filmar-${sel}`, () => acciones.generar(sel), false)}
          >
            Intentar igual con esta imagen
          </Button>
        )}
        <Button size="sm" variant="tertiary" disabled={trabajando} onClick={() => onEditarPrompt(sel)}>
          Ver el prompt
        </Button>
        {estado === 'filmada' && (
          // La comparación cara/imagen vive en el paso del escenario, así que
          // esto lleva ALLÁ en vez de repetirla acá: una segunda comparación es
          // una segunda respuesta a la misma pregunta.
          <Button size="sm" variant="tertiary" disabled={trabajando} onClick={() => onNoSeParece(sel)}>
            No se parece a mí
          </Button>
        )}
      </div>

      {/* El clip que se descartó al rehacer. Va plegado porque es la excepción, y
          existe porque archivar sin ofrecer cómo volver es la misma pérdida con
          un rastro en la base. */}
      {(marca?.descartadas?.length ?? 0) > 0 && !marca?.url && (
        <Button size="sm" variant="tertiary" disabled={trabajando}
          loading={ocupado === `recuperar-${sel}`}
          onClick={() => correr(`recuperar-${sel}`, () => acciones.recuperar(sel), false)}
        >
          {`Volver al clip que descartaste · 0 créditos`}
        </Button>
      )}

      {/* ── EL EDITOR ────────────────────────────────────────────────────── */}
      <details style={{ width: '100%', maxWidth: 420 }}>
        <summary style={{ cursor: 'pointer', fontSize: 'var(--fs-sm)', color: 'var(--dim)', textAlign: 'center' }}>
          Cambiar el guion: sumar, quitar o acortar tomas
        </summary>
        <div style={{ display: 'grid', gap: 12, marginTop: 14 }}>
          <textarea
            className="mk-scroll-oscuro"
            defaultValue={clip?.voz ?? ''}
            key={`voz-${sel}-${clip?.voz ?? ''}`}
            rows={3}
            aria-label={`Lo que dice la toma ${sel}`}
            placeholder={`Lo que dice la toma ${sel}`}
            disabled={estado === 'filmada' || trabajando}
            onBlur={(e) => {
              const v = e.target.value.trim();
              if (v === (clip?.voz ?? '').trim()) return;
              correr(`voz-${sel}`, () => acciones.escribirVoz(sel, v), false);
            }}
            style={{
              width: '100%', padding: '10px 12px', borderRadius: 'var(--r-sm)',
              border: '1px solid var(--border)', background: 'var(--surface-2)',
              color: 'var(--ink)', fontSize: 'var(--fs-sm)', lineHeight: 1.5, resize: 'vertical',
            }}
          />
          <div style={{ fontSize: 'var(--fs-meta)', color: 'var(--faint)', textAlign: 'center' }}>
            {clip ? `${clip.palabras} palabras · entran ${clip.tope}` : ''}
            {clip && clip.palabras > clip.tope ? ' · no entra en este clip' : ''}
          </div>

          <div style={{ display: 'flex', gap: 8, alignItems: 'center', justifyContent: 'center', flexWrap: 'wrap' }}>
            <span style={{ fontSize: 'var(--fs-sm)', color: 'var(--dim)' }}>Dura</span>
            {DURACIONES_FLOW.map((s) => (
              <Button
                key={s}
                size="sm"
                variant={clip?.segundos === s ? 'primary' : 'tertiary'}
                disabled={trabajando || estado === 'filmada'}
                onClick={() => correr(`dur-${sel}`, () => acciones.editar({ que: 'duracion', n: sel, segundos: s }), false)}
              >
                {`${s}s`}
              </Button>
            ))}
          </div>

          <div style={{ display: 'flex', gap: 9, justifyContent: 'center', flexWrap: 'wrap' }}>
            <Button size="sm" variant="tertiary" disabled={trabajando}
              onClick={() => correr('agregar', async () => {
                const r = await acciones.editar({ que: 'agregar', despuesDe: sel, segundos: clip?.segundos ?? 8 });
                if (r.ok) onSel(sel + 1);
                return r;
              }, false)}
            >
              Sumar una toma aquí
            </Button>
            <Button size="sm" variant="tertiary" disabled={trabajando || clips.length <= 1}
              icon={<IconoBorrar size={15} />}
              onClick={() => correr('quitar', async () => {
                const r = await acciones.editar({ que: 'quitar', n: sel });
                if (r.ok) onSel(Math.max(1, sel - 1));
                return r;
              }, false)}
            >
              Quitar esta
            </Button>
          </div>
          <div style={{ fontSize: 'var(--fs-meta)', color: 'var(--faint)', textAlign: 'center' }}>
            Una toma ya filmada no se puede quitar ni acortar: descarta su clip primero — queda guardado.
          </div>
        </div>
      </details>
    </div>
  );
}
