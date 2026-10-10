'use client';

// =============================================================================
// PanelProbar — «Probar» de UN canal: el teléfono de WhatsApp o la bandeja tipo Gmail
// =============================================================================
// Pedido de Martín (08/10/2026, punto 10), textual: «El botón de probar se rompe, aparece detrás
// de la sidebar y se ve horrible. No tiene la animación de entrada de los mensajes y tampoco puedo
// interactuar, para probarlo de verdad... Y tampoco veo la opción de probarlo realmente, con el
// número o email del usuario... Y para cerrar, un botón de CERRAR, no un "editar"... Y no hace
// falta que ocupe toda la pantalla. Mira como lo hace Manychat».
//
// Molde de ManyChat («Preview»): un teléfono AL LADO del lienzo, que sigue editable; ✕ para cerrar
// y ↻ para reiniciar; una caja para contestar como el contacto; «In messengers» manda la prueba a
// la app de verdad.
//
// Lo que sigue valiendo de la primera tanda, cada cosa con su porqué:
//   · NO REEMPLAZA AL LIENZO. Antes «Probar» desmontaba el editor (se perdía lo no publicado).
//   · RECORRE EL FLUJO LOCAL con lib/simulador-grafo.ts —la misma navegación que el motor—: en una
//     condición quien prueba elige la rama; una espera se dice y se sigue; una acción se nombra y
//     no se ejecuta.
//   · ESCRIBIR COMO EL LEAD PAUSA LA SALIDA y corre «Si responde» (sólo en WhatsApp: una respuesta
//     del lead es un WhatsApp). El server clasifica contra los casos locales (`clasificarEscenario`)
//     y un «MaKo contesta» se redacta con el redactor del motor.
//   · EL DESTINO DE LA PRUEBA REAL es el de QUIEN PRUEBA (su fila de `usuarios`), o vacío, y NO se
//     guarda. ⚠️ Antes venía con el contacto de reportes del NEGOCIO: el super admin probando el
//     flujo de un cliente le mandaba la prueba al cliente (revisión del 08/10/2026, lienzo-3).
//   · UNA TARJETA SALE DE VERDAD UNA VEZ POR PRUEBA (`debeSalirDeVerdad`): un «Ir a» que vuelve
//     sobre un mensaje ya mandado no lo reenvía (datos-4). El server además topea por destino.
//   · LLENA EL RECTÁNGULO QUE LE DA SU PADRE (`muelles`, lib/lienzo-grafo.ts), segunda tanda.
//
// ── TERCERA TANDA (09/10/2026): UN CANAL POR VEZ ─────────────────────────────────────
// Pedido de Martín, punto 14, textual: «Y al darle probar debería ser un desplegable para probar
// WhatsApp o Email. No que dentro me salga la interfaz de WhatsApp y a su vez me aparezca un campo
// de Email, es contraintuitivo... Si selecciono Email, claro que el diseño que debe aparecer es el
// de Gmail. Por defecto, siempre comienza la animación de prueba de recibiendo la automatización y
// claro un botón para probar con un número o email, dependiendo...». Decisión 14 del diseño.
//   · `canal` LO ELIGE EL DESPLEGABLE de «Probar» (SecuenciaPerfil, parte B) y el panel muestra
//     SÓLO ese canal. El recorrido es el mismo (las condiciones, las esperas y los hilos corren
//     igual: el reloj es uno), pero un mensaje del OTRO canal ni se dibuja ni sale. Filtrar acá y
//     no en el simulador es a propósito: el simulador recorre el flujo, el panel elige qué mirar.
//   · WHATSAPP = EL TELÉFONO de siempre (ChatHilo), con la caja para contestar como el lead.
//   · EMAIL = UNA BANDEJA TIPO GMAIL (`BandejaGmail`): la lista de lo que llega —remitente, asunto,
//     vista previa y cuándo llega— y al abrir uno, el mail con el MISMO render que sale
//     (`renderEmailHtml` con `paramsDeVista`, las reglas del envío; el remitente es el de
//     /api/email/dominio). Sin caja para contestar: una respuesta del lead es un WhatsApp.
//   · ARRANCA SOLO: abrir «Probar» y ver llegar los mensajes ES la prueba.
//   · ABAJO, UN BOTÓN PARA PROBARLO DE VERDAD, con TU número o TU email según el canal: vuelve a
//     arrancar el recorrido y cada mensaje que aparece sale de verdad por el envío que ya existía
//     (lib/prueba-paso.ts). Se fueron los dos interruptores a la vez («A mi WhatsApp» y «A mi
//     email» en la misma fila): con un canal por vez, un interruptor del otro no tiene sentido.
//     ↻ vuelve a la prueba sin envío.
//
// ── QUINTA TANDA (09/10/2026, punto 1) ────────────────────────────────────────────────
// Pedido literal: «En "Probar", no elimines el logo de WhatsApp o Email arriba a la izquierda, y pon
// al lado del botón de "Reiniciar" el botón de "Probar en WhatsApp", y que no esté desplegado el "Tu
// número", sino que al clickear ese botón salga el desplegable... Y primero el desplegable me debe
// ofrecer los números que ya tiene guardado, y abajo un botón de "Nuevo número", y que tenga el form
// que ya tenemos de número, con la característica con las banderas, etc... Esto mismo con Email. Y
// al darle probar en la automatización de bienvenida, no salió el mensaje que debería salir...».
//   · EL LOGO DEL CANAL arriba a la izquierda; «Probar en WhatsApp / Email» al lado de ↻ y el destino
//     en su desplegable (`MenuDestinos`): los guardados de QUIEN PRUEBA y «Nuevo número» con
//     `TelefonoConPais` (o «Nuevo email»), que se suma a sus guardados (lib/prueba-paso.ts).
//   · UNA CONDICIÓN LA DECIDE EL MOTOR con un lead RECIÉN LLEGADO (`hechosDeLeadNuevo` +
//     `elegirComoLead`, lib/simulador-grafo.ts), no siempre el «Sí»: con el «Sí», la Bienvenida
//     saltaba a otra automatización y no salía ningún mensaje. La espera NO era la causa: ya no espera.
//   · UN MENSAJE DE VARIAS PARTES (cuarta tanda, punto 15) sale parte por parte, y cada una sale de
//     verdad una vez (`${nodo}#${k}`). El audio, sin su transcripción.
//
// ── SEXTA TANDA (09/10/2026, «Probar» 1, 2 y 3) ─────────────────────────────────────────
// Pedido literal: «1. Mira la captura que te paso, está configurado el email y en PROBAR no salió
// nada. Al igual que WhatsApp, el email debe salir con su animación... 2. Los botones de Probar con
// WhatsApp / Email. Para probarlo en la vida real, deberían pedir emisor (siempre dentro de los email
// y numeros configurados, con la opción de agregar nuevo) y remitente... 3. En Email, elimina el
// texto de "Fin" que aparece abajo del todo».
//   · 1: NO ERA LA BANDEJA NI LA ANIMACIÓN. El lead de la prueba tenía WhatsApp siempre, así que una
//     condición «Tiene WhatsApp» salía por el «Sí» y el email del «Si no» no llegaba nunca (medido
//     con la #226 del ws1). Ahora el lead de cada canal se elige (`contactoParaProbar`,
//     lib/simulador-grafo.ts) en `arrancarRefs`, y la condición lo usa.
//   · 2: «Probar en WhatsApp / Email» abre el desplegable con DOS partes: «De» (las líneas de
//     WhatsApp del negocio o su remitente de email, con «Vincular nuevo») y «Para» (los guardados de
//     quien prueba, con «Nuevo»). El emisor elegido viaja en cada envío real (`emisor`); el server lo
//     vuelve a validar. ⚠️ Hoy hay UN remitente de email por negocio (lib/email-remitente.ts):
//     «Vincular nuevo» lo REEMPLAZA y el modal lo dice (`AVISO_REEMPLAZA`).
//   · 3: en la bandeja, las píldoras del recorrido («Fin», las esperas, las acciones) NO se dibujan:
//     la bandeja ya dice cuándo llega cada mail. Sólo lo que falló (`pildoraEnLaBandeja`).
//   · EL SIMULADOR DE CADA CANAL se elige en UN lugar (`CANALES_PROBAR`, `canalDelPaso` y el
//     `switch` del cuerpo, «EL SIMULADOR DE CADA CANAL»): sumar Instagram o Messenger es una fila y
//     un `case`.
//
// ⚠️ EL TEXTO DE ESTA PIEZA ES CORTO A PROPÓSITO (AGENTS.md, «el texto que se DIBUJA»): una
// píldora son 1-4 palabras. El porqué de cada cosa vive acá, no en la pantalla.

import { useEffect, useMemo, useRef, useState, type CSSProperties, type FormEvent, type ReactNode } from 'react';
import { createPortal } from 'react-dom';
import { ChatHilo, type HiloMsg } from '../whatsapp/_shared/ChatHilo';
import { Button, Modal } from '@/app/_ui';
import { EvolutionConnect } from '../whatsapp/EvolutionConnect';
import { opcionesDeSalida, valorDeSalida, RUTA_LINEAS, type LineaWa } from './SalidaWhatsApp';
import { VincularRemitente } from './EditorEmailGmail';
import { remitentesVinculados, partesDeRemitente } from '@/lib/email-remitente';
import type { DomState } from '../email/EmailApp';
import { useTitulosAcciones } from '@/app/_components/EditorAccionMako';
import { renderEmailHtml } from '@/lib/email-html';
import { paramsDeVista, nombreDelRemitente } from './EditorEmailGmail';
import { useCatalogosCondicion, catalogosDe } from './EditorCondicion';
import { nombresCatalogoDe } from '@/lib/condiciones-catalogo';
import type { AudioSetting, PasoSecuenciaDto, ProductoOpcion, SecuenciaDto } from './ChatAgentApp';
import type { EdicionLocal } from './SecuenciaPerfil';
import { claseDe, raizRespuesta, textoCasoRespuesta, rotuloSiNoDeRespuesta, nodoPorId } from '@/lib/flujo-grafo';
import {
  flujoParaProbar, firmaFlujo, iniciar, siguiente, pausarPorRespuesta, entrarEnRespuesta,
  escenarioParaRedactar, textoDeEjemplo, correoDeEjemplo, debeSalirDeVerdad, burbujaDeArchivo,
  hechosDeLeadNuevo, leadNuevoDelCron, elegirComoLead, sanearDestinoPrueba, contactoParaProbar, CONTACTO_COMPLETO,
  type EstadoSim, type NombresSim, type OpcionRama, type MensajePrueba, type DestinosGuardados, type ContactoPrueba, type EmisorPrueba,
} from '@/lib/simulador-grafo';
import { partesDe, type ParteMensaje } from '@/lib/mensaje-partes';
import { ICONOS_MAS, frenoDelFlujo } from '@/lib/flujo-conversacion';
import { PopoverWA } from '../whatsapp/_shared/ComposerWhatsApp';
import { TelefonoConPais } from '@/app/_components/TelefonoConPais';
import { DIAL_DEFAULT, splitTelefono, unirTelefono } from '@/lib/paises';
// Instagram y Messenger (sexta tanda, parte «canales»): el mismo recorrido, con su cara.
import { esCanalSocial, logoSocialSvg, NOMBRE_CANAL, type CanalSocial } from '@/lib/canal-social';
import { SimuladorSocial } from './SimuladorSocial';

/**
 * El tamaño que pide «Probar»: ancho y bajo (decisión 11 de la segunda tanda). La cuenta vive en
 * `muelles` (lib/lienzo-grafo.ts); esto es sólo el pedido.
 */
export const PANEL_PROBAR_ANCHO = 560;
export const PANEL_PROBAR_ALTO = 400;

/**
 * Qué se prueba: lo elige el desplegable de «Probar» (decisión 14 de la tercera tanda). Instagram y
 * Messenger (sexta tanda) corren el MISMO recorrido de acá y se dibujan con `SimuladorSocial`.
 */
export type CanalProbar = 'whatsapp' | 'email' | CanalSocial;

// ── LOS CANALES DE «PROBAR» (sexta tanda) ───────────────────────────────────────────
// UN lugar por canal: su logo, el rótulo del botón de verdad, qué dato del lead necesita
// (`contactoParaProbar`) y si su destino es un email. Sumar un canal (la parte «canales»: Instagram,
// Messenger) es una fila acá, su caso en `canalDelPaso` y su `case` en «EL SIMULADOR DE CADA CANAL»,
// al pie del componente. Lo que no tenga una fila, no se puede probar.
type DefCanalProbar = {
  logo: string;
  nombre: string;
  /** El botón de la prueba de verdad (y el título de su desplegable). */
  probarEn: string;
  /** El dato del lead de la prueba que este canal necesita para recibir algo. */
  contacto: keyof ContactoPrueba;
  /** El destino es un email (si no, un teléfono con su bandera). */
  destinoEsEmail: boolean;
};
export const CANALES_PROBAR: Record<CanalProbar, DefCanalProbar> = {
  whatsapp: { logo: ICONOS_MAS.whatsapp, nombre: 'WhatsApp', probarEn: 'Probar en WhatsApp', contacto: 'tieneTelefono', destinoEsEmail: false },
  email: { logo: ICONOS_MAS.email, nombre: 'Email', probarEn: 'Probar en Email', contacto: 'tieneEmail', destinoEsEmail: true },
  // Instagram y Messenger (parte «canales»): sólo el simulador, sin prueba de verdad (`probarEn` no se dibuja).
  // Su dato de contacto no es ni teléfono ni email: se toma el del WhatsApp para elegir el camino.
  instagram: { logo: logoSocialSvg('instagram'), nombre: NOMBRE_CANAL.instagram, probarEn: '', contacto: 'tieneTelefono', destinoEsEmail: false },
  messenger: { logo: logoSocialSvg('messenger'), nombre: NOMBRE_CANAL.messenger, probarEn: '', contacto: 'tieneTelefono', destinoEsEmail: false },
};

/** De qué canal es un mensaje del flujo. Un paso sin canal es un WhatsApp, como en el motor. */
export function canalDelPaso(p: { canal?: string | null }): CanalProbar {
  if (esCanalSocial(p.canal)) return p.canal;
  return p.canal === 'email' ? 'email' : 'whatsapp';
}

/**
 * ¿Una píldora del recorrido se dibuja en la BANDEJA? Sólo lo que falló, o lo que se pide a propósito
 * (`forzar`, «Ya salió · no se reenvía»). «Fin», las esperas y las acciones no (sexta tanda, «Probar»
 * 3: «En Email, elimina el texto de "Fin" que aparece abajo del todo»): la bandeja dice cuándo llega
 * cada mail y un renglón suelto abajo se lee como un mail que no llegó. En el teléfono van todas.
 */
export function pildoraEnLaBandeja(tono: 'ok' | 'bad' | null, forzar = false): boolean {
  return forzar || tono === 'bad';
}

const API = '/api/chat-agent/simulador';
const ESCRIBIENDO_MS = 600;
const ENTRE_MS = 350;
const PILDORA_MS = 300;
/** La píldora de un rearranque frenado (séptima tanda). El porqué lo dice el pie, al lado de Publicar. */
const TEXTO_FRENADO = 'Falta completar';
/** Entre una parte y la siguiente de un mismo mensaje (el motor deja un respiro parecido). */
const ENTRE_PARTES_MS = 500;

type Adjunto = { id: number; url: string | null; mime: string; nombre: string | null };
type Turno = { de: 'lead' | 'negocio'; texto: string };

/** Un mail que llegó a la bandeja de «Probar», con las variables del lead de ejemplo ya puestas. */
export type CorreoRecibido = {
  id: string; asunto: string; vistaPrevia: string; cuerpo: string;
  /** El cuerpo del editor rico, con las variables puestas (`correoDeEjemplo`). '' = un email de antes: se dibuja `cuerpo`. */
  html?: string;
  /** El minuto virtual en que llega (el reloj del hilo: una espera de un día = 1440). */
  minuto: number;
  leido: boolean;
};

/**
 * Cuándo llega, como lo dice una bandeja: «Ahora» el del minuto 0 y «+2 h» / «+1 d» los que van
 * después de una espera. Es relativo a propósito: la prueba no tiene un reloj de verdad.
 */
export function cuandoLlega(minuto: number): string {
  const m = Math.max(0, Math.round(Number(minuto) || 0));
  if (m === 0) return 'Ahora';
  if (m < 60) return `+${m} min`;
  if (m < 1440) return `+${Math.round(m / 60)} h`;
  return `+${Math.round(m / 1440)} d`;
}

/**
 * Quién manda el mail, para la bandeja: el nombre del remitente del workspace con la MISMA regla
 * que el envío (`nombreDelRemitente`, el editor de email) y su dirección. Sin remitente leído, el
 * nombre del negocio y sin dirección: no se inventa un mail.
 */
export function remitenteVisible(remitente: string, negocio: string): { nombre: string; mail: string } {
  const mail = (/<\s*([^>]+?)\s*>/.exec(remitente)?.[1] ?? (/^[^\s<>@]+@[^\s<>@]+$/.test(remitente.trim()) ? remitente.trim() : '')).trim();
  const nombre = nombreDelRemitente(remitente) || negocio.trim() || mail || 'Tu negocio';
  return { nombre, mail };
}

/** La vista previa de una fila: el preheader, o el principio del cuerpo sin las marcas. */
export function vistaDeFila(c: Pick<CorreoRecibido, 'vistaPrevia' | 'cuerpo'>): string {
  return c.vistaPrevia.trim() || c.cuerpo.replace(/[*_~]/g, '').replace(/\s+/g, ' ').trim();
}

const iconBtn: CSSProperties = {
  width: 30, height: 30, flex: 'none', borderRadius: 9, border: '1px solid var(--border-strong)',
  background: 'var(--surface)', color: 'var(--dim)', fontSize: 14, cursor: 'pointer', fontFamily: 'inherit',
  display: 'inline-flex', alignItems: 'center', justifyContent: 'center',
};
const cerrarBtn: CSSProperties = {
  ...iconBtn, width: 'auto', padding: '0 11px', gap: 5, color: 'var(--ink)', fontSize: 12.5, fontWeight: 600, whiteSpace: 'nowrap',
};
const inpReal: CSSProperties = {
  flex: 1, minWidth: 0, padding: '7px 10px', borderRadius: 9, border: '1px solid var(--border-strong)',
  background: 'var(--surface-2)', color: 'var(--ink)', fontSize: 13, fontFamily: "'Geist', sans-serif", outline: 'none',
};
const caja: CSSProperties = {
  position: 'absolute', inset: 0, display: 'flex', flexDirection: 'column', minHeight: 0,
  background: 'var(--surface)', border: '1px solid var(--border)', borderRadius: 16, overflow: 'hidden',
};
const recorte: CSSProperties = { minWidth: 0, whiteSpace: 'nowrap', overflow: 'hidden', textOverflow: 'ellipsis' };

/**
 * Lo que un estilo en línea no puede: el hover de la fila, la entrada de un mail nuevo y el pulso
 * de «recibiendo». Con `prefers-reduced-motion`, nada se mueve. Sin backticks acá adentro: es un
 * template literal y uno lo cerraría a la mitad.
 */
const CSS = `
.pp-fila{background:transparent;transition:background .14s ease}
.pp-fila:hover{background:var(--surface-2)}
.pp-entra{animation:pp-entra .32s cubic-bezier(.2,.8,.2,1) both}
@keyframes pp-entra{from{opacity:0;transform:translateY(-6px)}to{opacity:1;transform:none}}
.pp-pulso{animation:pp-pulso 1.1s ease-in-out infinite}
@keyframes pp-pulso{0%,100%{opacity:.45}50%{opacity:1}}
@media (prefers-reduced-motion: reduce){.pp-entra,.pp-pulso{animation:none}}
`;

/** El sobre de Gmail: la única tinta de marca de la bandeja (el resto, tokens de la casa). */
function SobreGmail() {
  return (
    <svg width="18" height="14" viewBox="0 0 24 18" aria-hidden="true" style={{ flex: 'none' }}>
      <path d="M2 18h4V8.2L0 3.6V16a2 2 0 0 0 2 2Z" fill="#4285F4" />
      <path d="M18 18h4a2 2 0 0 0 2-2V3.6l-6 4.6V18Z" fill="#34A853" />
      <path d="M18 1.2v7l6-4.6V2.4c0-2-2.3-3.2-3.9-2L18 1.2Z" fill="#FBBC04" />
      <path d="M6 8.2v-7L12 5.8l6-4.6v7L12 12.8 6 8.2Z" fill="#EA4335" />
      <path d="M0 2.4v1.2l6 4.6v-7L3.9.4C2.3-.8 0 .4 0 2.4Z" fill="#C5221F" />
    </svg>
  );
}

function Inicial({ nombre }: { nombre: string }) {
  return (
    <span aria-hidden style={{ width: 32, height: 32, borderRadius: '50%', flex: 'none', background: 'var(--primary)', color: 'var(--on-primary)', display: 'inline-flex', alignItems: 'center', justifyContent: 'center', fontSize: 14, fontWeight: 600 }}>
      {(nombre.trim()[0] ?? '·').toUpperCase()}
    </span>
  );
}

/**
 * La bandeja de «Probar» por email, tipo Gmail. Sin estado propio: lo que llegó, cuál está
 * abierto y si está llegando uno lo decide el panel. Lo nuevo va ARRIBA, como en una bandeja.
 */
export function BandejaGmail({ correos, abierto, recibiendo, terminado, remitente, negocio, onAbrir, onVolver, entra }: {
  correos: readonly CorreoRecibido[];
  abierto: string | null;
  /**
   * El mail que ACABA de llegar: sólo ése entra con la animación (sexta tanda, «Probar» 1: «el email
   * debe salir con su animación»). Ausente = todos (lo de antes). Sin esto, volver de un mail abierto
   * re-animaba la bandeja entera, que se lee como que llegaron todos de nuevo.
   */
  entra?: string | null;
  /** Está por llegar uno: la fila que late arriba (el «escribiendo…» de una bandeja). */
  recibiendo: boolean;
  /** La prueba terminó: recién ahí «Sin correos» es un hecho y no un parpadeo. */
  terminado: boolean;
  remitente: string;
  negocio: string;
  onAbrir: (id: string) => void;
  onVolver: () => void;
}) {
  const de = remitenteVisible(remitente, negocio);
  const correo = abierto ? correos.find((c) => c.id === abierto) ?? null : null;
  if (correo) return <CorreoAbierto correo={correo} de={de} remitente={remitente} negocio={negocio} onVolver={onVolver} />;
  const sinLeer = correos.filter((c) => !c.leido).length;
  return (
    <div role="region" aria-label="Recibidos" style={caja}>
      <div style={{ flex: 'none', display: 'flex', alignItems: 'center', gap: 8, padding: '9px 14px', borderBottom: '1px solid var(--border)' }}>
        <SobreGmail />
        <span style={{ fontSize: 13.5, fontWeight: 700, color: 'var(--ink)' }}>Recibidos</span>
        {sinLeer > 0 && <span style={{ fontSize: 11.5, fontWeight: 700, color: 'var(--primary)' }}>{sinLeer}</span>}
      </div>
      <div className="mk-scroll-y" style={{ flex: 1, minHeight: 0, overflowY: 'auto' }}>
        {recibiendo && (
          <div aria-label="Llegando" className="pp-pulso" style={{ display: 'flex', gap: 11, alignItems: 'center', padding: '12px 14px', borderBottom: '1px solid var(--border)' }}>
            <span style={{ width: 32, height: 32, borderRadius: '50%', flex: 'none', background: 'var(--surface-2)' }} />
            <span style={{ flex: 1, display: 'flex', flexDirection: 'column', gap: 6 }}>
              <span style={{ width: '38%', height: 9, borderRadius: 5, background: 'var(--surface-2)' }} />
              <span style={{ width: '72%', height: 9, borderRadius: 5, background: 'var(--surface-2)' }} />
            </span>
          </div>
        )}
        {[...correos].reverse().map((c) => (
          <button key={c.id} type="button" onClick={() => onAbrir(c.id)} className={entra === undefined || entra === c.id ? 'pp-fila pp-entra' : 'pp-fila'} data-leido={c.leido ? '' : undefined}
            style={{ width: '100%', textAlign: 'left', display: 'flex', gap: 11, alignItems: 'flex-start', padding: '10px 14px', border: 'none', borderBottom: '1px solid var(--border)', cursor: 'pointer', fontFamily: 'inherit', color: 'var(--ink)' }}>
            <Inicial nombre={de.nombre} />
            <span style={{ minWidth: 0, flex: 1, display: 'flex', flexDirection: 'column', gap: 1 }}>
              <span style={{ display: 'flex', alignItems: 'baseline', gap: 8 }}>
                <span style={{ ...recorte, flex: 1, fontSize: 13.5, fontWeight: c.leido ? 500 : 700 }}>{de.nombre}</span>
                <span style={{ flex: 'none', fontSize: 12, fontWeight: c.leido ? 400 : 700, color: c.leido ? 'var(--faint)' : 'var(--ink)' }}>{cuandoLlega(c.minuto)}</span>
              </span>
              <span style={{ ...recorte, fontSize: 13, fontWeight: c.leido ? 400 : 700 }}>{c.asunto || 'Sin asunto'}</span>
              <span style={{ ...recorte, fontSize: 12.5, color: 'var(--faint)' }}>{vistaDeFila(c) || 'Sin escribir'}</span>
            </span>
          </button>
        ))}
        {terminado && !recibiendo && correos.length === 0 && (
          <div style={{ padding: 18, color: 'var(--faint)', fontSize: 13 }}>Sin correos</div>
        )}
      </div>
    </div>
  );
}

/**
 * Un mail abierto: el asunto, quién lo manda y el cuerpo con el MISMO render que sale. El iframe
 * va en una caja ABSOLUTA: un `height: 100%` contra un alto que sale de `flex: 1` es cero en
 * Safari (AGENTS.md); contra una caja con `inset: 0`, el alto es definido en los dos motores.
 */
function CorreoAbierto({ correo, de, remitente, negocio, onVolver }: {
  correo: CorreoRecibido; de: { nombre: string; mail: string }; remitente: string; negocio: string; onVolver: () => void;
}) {
  // Las variables del lead de ejemplo ya vienen puestas (`correoDeEjemplo`); `paramsDeVista` pone el
  // resto con las reglas del envío (asunto vacío, preheader, firma del remitente). Con el HTML del editor
  // rico (`cuerpoHtml` → `bodyHtml` de `renderEmailHtml`), el mail se ve con su formato, como sale.
  const html = useMemo(
    () => renderEmailHtml(paramsDeVista({ asunto: correo.asunto, preheader: correo.vistaPrevia, cuerpo: correo.cuerpo, cuerpoHtml: correo.html || null, negocio, remitente })),
    [correo.asunto, correo.vistaPrevia, correo.cuerpo, correo.html, negocio, remitente],
  );
  return (
    <div role="region" aria-label="Correo abierto" style={caja}>
      <div style={{ flex: 'none', display: 'flex', alignItems: 'center', gap: 8, padding: '7px 10px', borderBottom: '1px solid var(--border)' }}>
        <button type="button" onClick={onVolver} aria-label="Volver a Recibidos" title="Volver" style={iconBtn}>←</button>
        <span style={{ ...recorte, flex: 1, fontSize: 14, fontWeight: 700, color: 'var(--ink)' }}>{correo.asunto || 'Sin asunto'}</span>
      </div>
      <div style={{ flex: 'none', display: 'flex', alignItems: 'center', gap: 10, padding: '9px 14px' }}>
        <Inicial nombre={de.nombre} />
        <span style={{ minWidth: 0, flex: 1, display: 'flex', flexDirection: 'column' }}>
          <span style={{ ...recorte, fontSize: 13 }}>
            <strong style={{ color: 'var(--ink)' }}>{de.nombre}</strong>
            {de.mail && <span style={{ color: 'var(--faint)' }}> &lt;{de.mail}&gt;</span>}
          </span>
          <span style={{ fontSize: 12, color: 'var(--faint)' }}>para mí</span>
        </span>
        <span style={{ flex: 'none', fontSize: 12, color: 'var(--faint)' }}>{cuandoLlega(correo.minuto)}</span>
      </div>
      <div style={{ flex: 1, minHeight: 0, position: 'relative', borderTop: '1px solid var(--border)' }}>
        <div style={{ position: 'absolute', inset: 0 }}>
          <iframe title={correo.asunto || 'Correo'} srcDoc={html} sandbox="allow-popups allow-popups-to-escape-sandbox"
            style={{ display: 'block', width: '100%', height: '100%', border: 'none', background: '#fff' }} />
        </div>
      </div>
    </div>
  );
}

/**
 * Un destino como se LEE: el teléfono con la lada separada (`+52 2233550684`, como en Notificaciones:
 * un número de corrido es uno en el que nadie nota que la lada está mal) y el email tal cual.
 */
export function destinoLegible(d: string, esEmail: boolean): string {
  if (esEmail) return d.trim();
  const { lada, resto } = splitTelefono(d);
  return resto ? `${lada} ${resto}` : d.trim();
}

const cajaDestinos: CSSProperties = {
  width: 300, maxHeight: 360, overflowY: 'auto', padding: 6, background: 'var(--surface)', border: '1px solid var(--border-strong)',
  borderRadius: 12, boxShadow: '0 12px 34px rgba(18,21,27,.18)', fontFamily: "'Geist', sans-serif", display: 'flex', flexDirection: 'column', gap: 2,
};
const filaDestino: CSSProperties = {
  width: '100%', display: 'flex', alignItems: 'center', gap: 10, padding: '8px 10px', border: 'none', borderRadius: 8,
  background: 'transparent', color: 'var(--ink)', fontSize: 13.5, textAlign: 'left', cursor: 'pointer', fontFamily: 'inherit',
};

/** Un emisor que se puede elegir: una línea de WhatsApp o un remitente de email del negocio. */
export type OpcionEmisor = { valor: string; rotulo: string; color?: string };

/** Lo que el desplegable necesita del EMISOR (sexta tanda, «Probar» 2). Sin estado propio. */
export type EmisorDelMenu = {
  /** null = todavía cargando; 'error' = no se pudo leer (no es «no hay»). */
  opciones: OpcionEmisor[] | 'error' | null;
  elegido: string | null;
  onElegir: (valor: string) => void;
  onVincular: () => void;
  /** «Vincular nuevo» no se puede (sin permiso): la fila no se dibuja. */
  puedeVincular?: boolean;
};

const rotuloSeccion: CSSProperties = { padding: '6px 10px 2px', fontSize: 11.5, fontWeight: 600, color: 'var(--faint)' };

function IconoMas() {
  return (
    <svg width="14" height="14" viewBox="0 0 24 24" aria-hidden="true" fill="none" stroke="currentColor" strokeWidth={2.2} strokeLinecap="round" style={{ flex: 'none' }}>
      <path d="M12 5v14M5 12h14" />
    </svg>
  );
}
function IconoTilde({ visible }: { visible: boolean }) {
  return (
    <svg width="14" height="14" viewBox="0 0 24 24" aria-hidden="true" fill="none" stroke="currentColor" strokeWidth={2.2} strokeLinecap="round" strokeLinejoin="round" style={{ flex: 'none', visibility: visible ? 'visible' : 'hidden', color: 'var(--primary)' }}>
      <path d="M20 6 9 17l-5-5" />
    </svg>
  );
}

/**
 * El desplegable de «Probar en WhatsApp / Email». Sexta tanda («Probar» 2): arriba «De», el EMISOR
 * (las líneas o el remitente del negocio, con «Vincular nuevo»; elegir uno no arranca nada), y abajo
 * «Para», el DESTINO (quinta tanda, punto 1): primero los GUARDADOS de quien prueba (elegir uno prueba
 * ahí, desde el emisor elegido), y abajo «Nuevo número» / «Nuevo email», que abre el form de siempre.
 * Sin estado propio: lo decide el panel. Exportado para el test. Sin `emisor`, sólo «Para».
 *
 * ⚠️ «NO PUDE LEER» NO ES «NO TIENE» (AGENTS.md): con la lista caída se dice eso, y «Nuevo» sigue.
 */
export function MenuDestinos({ refCaja, esEmail, guardados, onElegir, nuevo, onNuevo, onProbarNuevo, error, formTelefono, formEmail, puedeProbarNuevo, emisor }: {
  refCaja?: (el: HTMLDivElement | null) => void;
  esEmail: boolean;
  guardados: DestinosGuardados | 'error' | null;
  onElegir: (d: string) => void;
  nuevo: boolean;
  onNuevo: () => void;
  onProbarNuevo: (e: FormEvent) => void;
  error: string | null;
  formTelefono: ReactNode;
  formEmail: ReactNode;
  puedeProbarNuevo: boolean;
  emisor?: EmisorDelMenu;
}) {
  const lista = guardados && guardados !== 'error' ? (esEmail ? guardados.emails : guardados.telefonos) : [];
  return (
    <div ref={refCaja} role="menu" style={cajaDestinos}>
      <style>{'.pp-destino:hover{background:var(--surface-2)}'}</style>
      {emisor && (
        <div role="group" aria-label="De" style={{ borderBottom: '1px solid var(--border)', marginBottom: 4, paddingBottom: 4 }}>
          <div style={rotuloSeccion}>De</div>
          {emisor.opciones === null && <div style={{ padding: '7px 10px', fontSize: 13, color: 'var(--faint)' }}>Cargando…</div>}
          {emisor.opciones === 'error' && <div style={{ padding: '7px 10px', fontSize: 13, color: 'var(--dim)' }}>{esEmail ? 'No pude leer tu remitente' : 'No pude leer tus números'}</div>}
          {Array.isArray(emisor.opciones) && emisor.opciones.length === 0 && (
            <div style={{ padding: '7px 10px', fontSize: 13, color: 'var(--faint)' }}>{esEmail ? 'Sin remitente' : 'Sin números'}</div>
          )}
          {Array.isArray(emisor.opciones) && emisor.opciones.map((o) => (
            <button key={o.valor || '__default'} type="button" role="menuitemradio" aria-checked={o.valor === emisor.elegido} className="pp-destino"
              onClick={() => emisor.onElegir(o.valor)} style={filaDestino}>
              <IconoTilde visible={o.valor === emisor.elegido} />
              {o.color && <span aria-hidden style={{ width: 7, height: 7, borderRadius: '50%', background: o.color, flex: 'none' }} />}
              <span style={{ flex: 1, minWidth: 0, ...recorte }}>{o.rotulo}</span>
            </button>
          ))}
          {emisor.puedeVincular !== false && (
            <button type="button" className="pp-destino" onClick={emisor.onVincular} style={{ ...filaDestino, color: 'var(--primary)', fontWeight: 600 }}>
              <IconoMas /> Vincular nuevo
            </button>
          )}
        </div>
      )}
      {emisor && <div style={rotuloSeccion}>Para</div>}
      {guardados === null && <div style={{ padding: '9px 10px', fontSize: 13, color: 'var(--faint)' }}>Cargando…</div>}
      {guardados === 'error' && <div style={{ padding: '9px 10px', fontSize: 13, color: 'var(--dim)' }}>{esEmail ? 'No pude leer tus emails' : 'No pude leer tus números'}</div>}
      {lista.map((d) => (
        <button key={d} type="button" role="menuitem" className="pp-destino" onClick={() => onElegir(d)} style={filaDestino}>
          <span style={{ flex: 1, minWidth: 0, ...recorte }}>{destinoLegible(d, esEmail)}</span>
        </button>
      ))}
      {Array.isArray(lista) && guardados && guardados !== 'error' && lista.length === 0 && !nuevo && (
        <div style={{ padding: '9px 10px', fontSize: 13, color: 'var(--faint)' }}>{esEmail ? 'Sin emails guardados' : 'Sin números guardados'}</div>
      )}
      <div style={{ borderTop: '1px solid var(--border)', marginTop: 4, paddingTop: 4 }}>
        {nuevo ? (
          <form onSubmit={onProbarNuevo} style={{ display: 'flex', flexDirection: 'column', gap: 8, padding: '6px 4px 4px' }}>
            {esEmail ? formEmail : formTelefono}
            {error && <span role="alert" style={{ fontSize: 12, color: 'var(--bad)' }}>{error}</span>}
            <Button type="submit" size="sm" disabled={!puedeProbarNuevo}>Probar</Button>
          </form>
        ) : (
          <button type="button" className="pp-destino" onClick={onNuevo} style={{ ...filaDestino, color: 'var(--primary)', fontWeight: 600 }}>
            <IconoMas /> {esEmail ? 'Nuevo email' : 'Nuevo número'}
          </button>
        )}
      </div>
    </div>
  );
}

/**
 * Las líneas de WhatsApp del negocio como emisores, con la MISMA regla que el número de salida del
 * editor (`opcionesDeSalida`, SalidaWhatsApp.tsx): la de por default primero (valor ''), la de la
 * automatización SIEMPRE aunque ya no esté. Sin el renglón de vincular: ése lo pone el menú.
 */
export function emisoresDeLineas(lineas: readonly LineaWa[], deLaSecuencia: string | null): OpcionEmisor[] {
  return opcionesDeSalida(lineas, deLaSecuencia).filter((o) => !o.crear).map((o) => ({ valor: o.value, rotulo: o.label, ...(o.color ? { color: o.color } : {}) }));
}

/** El remitente de email del negocio como emisor (hoy UNO: lib/email-remitente.ts). */
export function emisoresDeRemitentes(vinculados: readonly string[]): OpcionEmisor[] {
  return vinculados.map((r) => {
    const p = partesDeRemitente(r);
    return { valor: r, rotulo: p.nombre !== p.mail ? `${p.nombre} <${p.mail}>` : p.mail };
  });
}

/**
 * Lo que viaja como `emisor` en cada envío real. Sólo lo que quien prueba ELIGIÓ: sin elegir, nada
 * (el server usa la línea de la automatización y el remitente del negocio). Una línea elegida vacía
 * ('') es «la de por default».
 */
export function emisorAEnviar(canal: CanalProbar, elegido: string | null): EmisorPrueba {
  if (elegido == null) return {};
  return canal === 'email' ? { remitente: elegido } : { linea: elegido };
}

/**
 * «Vincular nuevo» del emisor: el MISMO flujo que el resto de la app, en un modal y sin salir de
 * «Probar». WhatsApp: `EvolutionConnect` con `nueva` (el de SalidaWhatsApp y /whatsapp). Email: EL MISMO
 * MODAL del editor de Gmail (`VincularRemitente`, app/automations/EditorEmailGmail.tsx), que monta el
 * `DominioSetup` de /email y, como HOY un negocio tiene UN remitente, dice que lo REEMPLAZA
 * (`AVISO_REEMPLAZA`). Hasta la segunda pasada de la sexta tanda acá había una copia de ese modal: dos
 * modales para lo mismo son los que dejan de decir lo mismo. Y ése, si el dominio no llegó todavía, lo
 * lee él mismo (la copia decía «No se pudo abrir»).
 */
function VincularEmisor({ canal, dom, reemplaza, onCerrar, onLinea, onDominio }: {
  canal: CanalProbar; dom: DomState | null; reemplaza: boolean;
  onCerrar: () => void; onLinea: (linea: string) => void; onDominio: (d: DomState) => void;
}) {
  if (canal === 'email') return <VincularRemitente inicial={dom} reemplaza={reemplaza} onCerrar={onCerrar} onDominio={onDominio} />;
  // Al `body`: el panel vive en un muelle con z-index, y un `fixed` adentro de un contexto de
  // apilamiento queda debajo de lo que tenga un z mayor (AGENTS.md, el `sticky` con z-index).
  return createPortal(
    <Modal titulo="Vincular número" onCerrar={onCerrar} ancho={440}>
      <div style={{ display: 'flex', flexDirection: 'column', minHeight: 420 }}>
        <EvolutionConnect key="nueva-linea" nueva inline panelVisible ocultarChip onLineaCreada={onLinea} />
      </div>
    </Modal>,
    document.body,
  );
}

async function postar(body: Record<string, unknown>): Promise<Record<string, unknown> & { ok?: boolean; error?: string }> {
  try {
    const r = await fetch(API, { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify(body) });
    return await r.json();
  } catch {
    return { ok: false, error: 'Sin conexión' };
  }
}

async function blobABase64(b: Blob): Promise<string> {
  const buf = new Uint8Array(await b.arrayBuffer());
  let bin = '';
  const CH = 0x8000;
  for (let i = 0; i < buf.length; i += CH) bin += String.fromCharCode(...buf.subarray(i, i + CH));
  return btoa(bin);
}

export function PanelProbar({ secuencia, edicion, secuencias, audios, negocio, rolAdmin, etiquetaEtapa, canal, onCerrar, style, productos }: {
  /** La automatización GUARDADA: su id, su línea y, si el lienzo todavía no mandó nada, sus pasos. */
  secuencia: SecuenciaDto;
  /** Lo que el lienzo tiene SIN publicar (`onCambioLocal`). Es lo que se prueba. */
  edicion: EdicionLocal | null;
  secuencias: ReadonlyArray<SecuenciaDto>;
  audios: AudioSetting[];
  negocio: string;
  rolAdmin: boolean;
  etiquetaEtapa: (key: string) => string;
  /** El canal que se prueba: el teléfono de WhatsApp o la bandeja de email. Uno solo. */
  canal: CanalProbar;
  onCerrar: () => void;
  /** Dónde se acopla: lo decide quien monta. */
  style?: CSSProperties;
  /**
   * Los productos con sus etapas, para que la condición diga el nombre de lo elegido del catálogo
   * («Está en el embudo de «Mentoría»», no «un producto»), como la tarjeta del lienzo.
   */
  productos?: ProductoOpcion[];
}) {
  const propia = edicion && edicion.secuenciaId === secuencia.id ? edicion : null;
  const pasosVivos = propia?.pasos ?? secuencia.pasos;
  const estVivo = propia ? propia.estrategia : secuencia.estrategia;
  /** El flujo que se ve AHORA en el lienzo, ya en tarjetas. */
  const flujoVivo = useMemo(() => flujoParaProbar(pasosVivos, estVivo, {
    idDeClave: (clave) => secuencias.find((s) => s.clave === clave)?.id ?? null,
  }).pasos, [pasosVivos, estVivo, secuencias]);
  const firmaViva = useMemo(() => firmaFlujo(flujoVivo), [flujoVivo]);
  /** La huella del flujo con el que arrancó esta prueba: si cambia, el panel lo dice. */
  const [firmaProbada, setFirmaProbada] = useState(firmaViva);
  /**
   * ⚠️ LO QUE FRENA «PROBAR» FRENA TAMBIÉN CADA REARRANQUE (séptima tanda, 10/10/2026). Pedido de Martín:
   * «una tarjeta sin conexiones puede estar, pero como borrador, al probar o publicar no debería dejar».
   * El botón «▶ Probar» ya se frenaba (`frenoDelFlujo` en SecuenciaPerfil), pero ↻, «Cambió · ↻» y
   * «Probar en WhatsApp» rearrancan sobre lo que se edita CON EL PANEL ABIERTO y no miraban nada:
   * desconectar una tarjeta y apretar ↻ corría —y con «Probar en WhatsApp», MANDABA— un flujo con una
   * tarjeta suelta. Es la MISMA función (la trae `EdicionLocal.freno`, con lo que le falta a cada
   * acción); sin edición todavía, la del flujo guardado. Frenar dice el porqué donde lo dice Publicar
   * y abre la tarjeta (`frenar`); el panel sólo marca que no arrancó.
   */
  const freno = useMemo(() => (propia ? propia.freno : frenoDelFlujo(flujoVivo, null)), [propia, flujoVivo]);

  const [mensajes, setMensajes] = useState<HiloMsg[]>([]);
  const [typing, setTyping] = useState<{ lado: 'left' | 'right'; autor?: string } | null>(null);
  const [opciones, setOpciones] = useState<OpcionRama[] | null>(null);
  // La bandeja (canal email).
  const [correos, setCorreos] = useState<CorreoRecibido[]>([]);
  const [abierto, setAbierto] = useState<string | null>(null);
  const [recibiendo, setRecibiendo] = useState(false);
  const [terminado, setTerminado] = useState(false);
  /** En la bandeja no hay hilo donde poner una píldora: va la última, en un renglón. */
  const [aviso, setAviso] = useState<{ texto: string; tono: 'ok' | 'bad' | null } | null>(null);
  const [remitente, setRemitente] = useState('');
  /** La prueba DE VERDAD de este recorrido, y su destino (precargado, NO se guarda). */
  const [real, setReal] = useState(false);
  const [destino, setDestino] = useState('');

  // Nombres que las píldoras necesitan: las etiquetas, los títulos de las acciones y los archivos
  // de la biblioteca. Se piden sólo si el flujo los usa.
  const usaAccion = flujoVivo.some((p) => p.accion != null && typeof p.accion === 'object');
  const titulosAccion = useTitulosAcciones(usaAccion);
  const usaEtiqueta = flujoVivo.some((p) => (p.ramas ?? []).some((r) => (r.filas ?? []).some((f) => f.campo === 'etiqueta')));
  const usaMedia = canal !== 'email' && flujoVivo.some((p) => p.tipo === 'media');
  const [etiquetas, setEtiquetas] = useState<Map<number, string>>(new Map());
  const [adjuntos, setAdjuntos] = useState<Adjunto[]>([]);

  useEffect(() => {
    if (!usaEtiqueta) return;
    let vivo = true;
    void fetch('/api/crm/etiquetas', { cache: 'no-store' }).then((r) => r.json()).then((j) => {
      if (!vivo || !Array.isArray(j?.etiquetas)) return;
      setEtiquetas(new Map((j.etiquetas as Array<{ id: number; nombre: string }>).map((e) => [Number(e.id), String(e.nombre)])));
    }).catch(() => { /* la condición dice «una etiqueta» */ });
    return () => { vivo = false; };
  }, [usaEtiqueta]);

  useEffect(() => {
    if (!usaMedia) return;
    let vivo = true;
    // A la defensiva: si la biblioteca no llega, la burbuja dice el nombre del archivo.
    void fetch('/api/chat-agent/adjuntos', { cache: 'no-store' }).then((r) => r.json()).then((j) => {
      const lista = (Array.isArray(j?.adjuntos) ? j.adjuntos : []) as Array<Record<string, unknown>>;
      if (!vivo) return;
      setAdjuntos(lista.map((a) => ({
        id: Number(a.id), url: typeof a.url === 'string' ? a.url : null,
        mime: String(a.media_mime ?? ''), nombre: typeof a.nombre_archivo === 'string' ? a.nombre_archivo : typeof a.titulo === 'string' ? a.titulo : null,
      })));
    }).catch(() => { /* sin biblioteca */ });
    return () => { vivo = false; };
  }, [usaMedia]);

  // El remitente del workspace, para la bandeja: el MISMO que lee el editor de email. Sin él, la
  // fila dice el nombre del negocio (`remitenteVisible`). Y lo mismo es el EMISOR del email de la
  // prueba real (sexta tanda): los vinculados salen de esta respuesta (`remitentesVinculados`).
  const [dom, setDom] = useState<DomState | 'error' | null>(null);
  useEffect(() => {
    if (canal !== 'email') return;
    let vivo = true;
    // Con tope: la ruta le pregunta a Resend en vivo, y sin `signal` una conexión caída no vuelve nunca.
    void fetch('/api/email/dominio', { cache: 'no-store', signal: AbortSignal.timeout(20_000) }).then((r) => r.json()).then((j) => {
      if (!vivo) return;
      if (j?.ok && typeof j.remitente === 'string') { setRemitente(j.remitente); setDom(j as DomState); } else setDom('error');
    }).catch(() => { if (vivo) setDom('error'); });
    return () => { vivo = false; };
  }, [canal]);

  // LAS LÍNEAS DE WHATSAPP DEL NEGOCIO, para el EMISOR de la prueba real (sexta tanda, «Probar» 2). Las
  // mismas que ofrece el número de salida del editor (`/api/whatsapp/evolution/mensajes?lineas=1`).
  // Sólo el admin manda de verdad: sólo él las pide. «No pude leer» no es «no tiene».
  const [lineas, setLineas] = useState<LineaWa[] | 'error' | null>(null);
  /** Sube al vincular una línea nueva: la lista se vuelve a pedir. */
  const [vueltaLineas, setVueltaLineas] = useState(0);
  useEffect(() => {
    if (!rolAdmin || canal !== 'whatsapp') return;
    let vivo = true;
    void fetch(RUTA_LINEAS, { cache: 'no-store', signal: AbortSignal.timeout(20_000) }).then((r) => r.json()).then((j: { ok?: boolean; lineas?: LineaWa[] }) => {
      if (vivo) setLineas(j?.ok && Array.isArray(j.lineas) ? j.lineas : 'error');
    }).catch(() => { if (vivo) setLineas('error'); });
    return () => { vivo = false; };
  }, [rolAdmin, canal, vueltaLineas]);

  /** El emisor que ELIGIÓ quien prueba (null = el de siempre: la línea de la automatización / el remitente del negocio). */
  const [emisor, setEmisor] = useState<string | null>(null);
  const [vinculando, setVinculando] = useState(false);
  const vinculados = dom && dom !== 'error' ? remitentesVinculados(dom) : [];
  const opcionesEmisor: OpcionEmisor[] | 'error' | null = canal === 'email'
    ? (dom === 'error' ? 'error' : dom === null ? null : emisoresDeRemitentes(vinculados))
    : (lineas === 'error' ? 'error' : lineas === null ? null : emisoresDeLineas(lineas, secuencia.instance_name ?? null));
  const emisorVisible = emisor ?? (canal === 'email' ? vinculados[0] ?? null : Array.isArray(lineas) ? valorDeSalida(lineas, secuencia.instance_name ?? null) : null);
  const rotuloEmisor = Array.isArray(opcionesEmisor) ? opcionesEmisor.find((o) => o.valor === emisorVisible)?.rotulo ?? null : null;

  // LOS DESTINOS GUARDADOS de QUIEN PRUEBA (quinta tanda, punto 1): su teléfono y su email, y los que
  // guardó con «Nuevo número». Sólo admin, que es el único que manda. «No pude leer» no es «no tiene»:
  // con la lista caída el desplegable lo dice y «Nuevo número» sigue a mano.
  const [guardados, setGuardados] = useState<DestinosGuardados | 'error' | null>(null);
  useEffect(() => {
    if (!rolAdmin) return;
    let vivo = true;
    void fetch(`${API}?destino=1`, { cache: 'no-store', signal: AbortSignal.timeout(20_000) }).then((r) => r.json()).then((j) => {
      if (!vivo) return;
      if (!j?.ok) { setGuardados('error'); return; }
      const lista = (v: unknown, uno: unknown) => (Array.isArray(v) ? v.map(String) : uno ? [String(uno)] : []);
      setGuardados({ telefonos: lista(j.telefonos, j.telefono), emails: lista(j.emails, j.email) });
    }).catch(() => { if (vivo) setGuardados('error'); });
    return () => { vivo = false; };
  }, [rolAdmin]);

  // Los catálogos de las condiciones (cursos, clases, posts, campañas) para nombrar lo elegido, con la
  // MISMA lectura que el editor y la tarjeta (`useCatalogosCondicion`). Sólo si hay una condición y es admin.
  const usaCondicion = flujoVivo.some((p) => claseDe(p) === 'condicion');
  const remotosCond = useCatalogosCondicion(rolAdmin && usaCondicion);
  const nombres: NombresSim = useMemo(() => ({
    etiqueta: (id) => etiquetas.get(id) ?? null,
    etapa: (key) => etiquetaEtapa(key),
    secuencia: (id) => secuencias.find((s) => s.id === id)?.nombre ?? null,
    accion: (op) => titulosAccion?.get(op) ?? null,
    catalogo: nombresCatalogoDe(catalogosDe({ etapas: [], productos: productos ?? [], remotos: remotosCond })),
  }), [etiquetas, etiquetaEtapa, secuencias, titulosAccion, productos, remotosCond]);

  // ── El motor del panel ─────────────────────────────────────────────────────
  // Todo lo que leen los timers va por REF: un timer agendado en un render viejo tiene que ver
  // el estado de ahora. Lo que cambia con las props se copia a `ctx` después de cada render.
  const flujoRef = useRef(flujoVivo);
  const simRef = useRef<EstadoSim>(iniciar(flujoVivo));
  const msgsRef = useRef<HiloMsg[]>([]);
  const correosRef = useRef<CorreoRecibido[]>([]);
  const run = useRef(0);
  const timers = useRef<number[]>([]);
  const seq = useRef(0);
  const colaReal = useRef<Promise<void>>(Promise.resolve());
  const yaSalioUno = useRef(false);
  /**
   * ¿Este recorrido sale de verdad? Es un ref además del estado: el botón lo prende y arranca el
   * recorrido EN EL MISMO handler, antes de que `ctx` se copie en el render siguiente.
   */
  const realRef = useRef(false);
  /** Las tarjetas que ya salieron DE VERDAD en esta prueba (`debeSalirDeVerdad`). ↻ lo vacía. */
  const enviadosReal = useRef(new Set<string>());
  /** Cuántas veces escribió el lead en esta prueba: en «Si responde» cada turno sale de nuevo. */
  const turnoLead = useRef(0);
  /** El «no se reenvía» se dice UNA vez por prueba: en un bucle serían veinte píldoras. */
  const dijoRepetido = useRef(false);
  /**
   * Ya salió un mensaje en esta prueba (de cualquier canal): para el motor, desde ahí el lead «ya fue
   * contactado», y una condición sobre eso se decide con ese dato (`hechosDeLeadNuevo`).
   */
  const huboMensaje = useRef(false);
  /** Quién entra según el CRON de lo que se ve (`leadNuevoDelCron`): su etapa, su etiqueta. */
  const leadDelCron = useMemo(() => leadNuevoDelCron({
    trigger_tipo: propia?.trigger_tipo ?? secuencia.trigger_tipo, etapa: secuencia.etapa,
    funnel_id: secuencia.funnel_id, producto_id: secuencia.producto_id, etiqueta_id: secuencia.etiqueta_id,
  }), [propia?.trigger_tipo, secuencia.trigger_tipo, secuencia.etapa, secuencia.funnel_id, secuencia.producto_id, secuencia.etiqueta_id]);
  const leadRef = useRef(leadDelCron);
  useEffect(() => { leadRef.current = leadDelCron; }, [leadDelCron]);
  /**
   * Si el lead de la prueba tiene teléfono / email (sexta tanda, «Probar» 1): se ELIGE al arrancar
   * para que le llegue lo del canal que se prueba (`contactoParaProbar`). Lo usa cada condición.
   */
  const contactoRef = useRef<ContactoPrueba>(CONTACTO_COMPLETO);
  const contactoDe = (f: typeof flujoVivo): ContactoPrueba =>
    contactoParaProbar(f, (p) => canalDelPaso(p) === canal, CANALES_PROBAR[canal].contacto, leadRef.current, ctx.current.nombres);
  const emisorReal = emisorAEnviar(canal, emisor);
  const ctx = useRef({ nombres, negocio, audios, adjuntos, destino, canal, secuenciaId: secuencia.id, emisor: emisorReal });
  useEffect(() => {
    ctx.current = { nombres, negocio, audios, adjuntos, destino, canal, secuenciaId: secuencia.id, emisor: emisorReal };
  });

  const firma = () => ctx.current.negocio || 'Tu negocio';
  const nuevoId = (pre: string) => `${pre}-${++seq.current}`;
  const poner = (m: HiloMsg) => { msgsRef.current = [...msgsRef.current, m]; setMensajes(msgsRef.current); };
  /** El mail que acaba de llegar es el único que entra con la animación (`entra` de la bandeja). */
  const [entra, setEntra] = useState<string | null>(null);
  const ponerCorreo = (c: CorreoRecibido) => { correosRef.current = [...correosRef.current, c]; setCorreos(correosRef.current); setEntra(c.id); };
  /**
   * Una píldora: en el teléfono, adentro del hilo; en la bandeja, el renglón de abajo, y sólo si
   * `pildoraEnLaBandeja` (sexta tanda, «Probar» 3: sin «Fin»). `forzar`: va en la bandeja igual.
   */
  const sistema = (texto: string, tono: 'ok' | 'bad' | null = null, forzar = false) => {
    if (ctx.current.canal === 'email') { if (pildoraEnLaBandeja(tono, forzar)) setAviso({ texto, tono }); return; }
    poner({ id: nuevoId('sis'), fromMe: false, tipo: 'sistema', tono, texto, fecha: new Date().toISOString() });
  };
  const luego = (ms: number, fn: () => void) => {
    const r0 = run.current;
    timers.current.push(window.setTimeout(() => { if (run.current === r0) fn(); }, ms));
  };
  const cortar = () => { run.current += 1; timers.current.forEach(clearTimeout); timers.current = []; };

  /** La charla, para el redactor: lo que dijo el lead y lo que contestó el negocio. */
  const historial = (): Turno[] => msgsRef.current
    .filter((m) => m.tipo !== 'sistema')
    .map((m) => ({ de: m.fromMe ? 'lead' as const : 'negocio' as const, texto: m.texto || (m.tipo === 'audio' ? '(nota de voz)' : '(un archivo)') }));

  /**
   * Manda DE VERDAD lo que apareció, en orden, si este recorrido es el de verdad, el mensaje es del
   * canal del panel y esa tarjeta todavía no salió en esta prueba. Lo que no sale de verdad se mira
   * PRIMERO: una tarjeta que pasó sin envío no cuenta como mandada.
   */
  const mandarReal = (m: MensajePrueba, nodo: string, enRespuesta: boolean) => {
    const c = ctx.current;
    const vaWa = realRef.current && c.canal === 'whatsapp' && m.canal === 'whatsapp';
    const vaEmail = realRef.current && c.canal === 'email' && m.canal === 'email';
    if (!vaWa && !vaEmail) return;
    if (!debeSalirDeVerdad(enviadosReal.current, nodo, enRespuesta, turnoLead.current)) {
      if (!dijoRepetido.current) { dijoRepetido.current = true; sistema('Ya salió · no se reenvía', null, true); }
      return;
    }
    const destinoReal = vaEmail ? { telefono: null, email: c.destino } : { telefono: c.destino, email: null };
    const r0 = run.current;
    colaReal.current = colaReal.current.then(async () => {
      const primero = !yaSalioUno.current;
      yaSalioUno.current = true;
      // El EMISOR elegido (sexta tanda): un pedido; el server lo vuelve a validar.
      const j = await postar({ action: 'enviar-real', secuenciaId: c.secuenciaId, destino: destinoReal, mensaje: m, primero, emisor: c.emisor });
      if (!j.ok) {
        if (primero) yaSalioUno.current = false;
        if (run.current === r0) sistema(`No salió · ${j.error ?? 'error'}`, 'bad');
      }
    });
  };

  /**
   * UNA parte de un mensaje de WhatsApp, como le llega al lead, y su envío de verdad. `clave`: la de
   * esa parte para `debeSalirDeVerdad` (cada parte sale una vez por prueba, no una por tarjeta).
   *
   * ⚠️ El audio SIN la transcripción (cuarta tanda, punto 15: «elimina la transcripción de los audios,
   * es innecesario»): al lead le llega una nota de voz, no un texto debajo.
   */
  const mostrarParte = (parte: ParteMensaje, clave: string, enRespuesta: boolean) => {
    const c = ctx.current;
    const ahora = new Date().toISOString();
    if (parte.tipo === 'audio') {
      const a = c.audios.find((x) => x.id === parte.audio_id) ?? null;
      poner(a?.url
        ? { id: nuevoId('au'), fromMe: false, autor: firma(), tipo: 'audio', mediaUrl: a.url, texto: null, fecha: ahora }
        : { id: nuevoId('au'), fromMe: false, autor: firma(), texto: '🎙 Sin audio elegido', fecha: ahora });
      mandarReal({ canal: 'whatsapp', tipo: 'audio', audio_id: parte.audio_id, texto: '' }, clave, enRespuesta);
      return;
    }
    if (parte.tipo === 'media') {
      const adj = c.adjuntos.find((x) => x.id === parte.media_id) ?? null;
      const caption = textoDeEjemplo(parte.cuerpo ?? '', c.negocio);
      // El documento con SU nombre y el caption aparte, como le llega al lead (costuras-8).
      poner({ id: nuevoId('md'), fromMe: false, autor: firma(), ...burbujaDeArchivo(adj, caption), fecha: ahora });
      mandarReal({ canal: 'whatsapp', tipo: 'media', media_id: parte.media_id, texto: caption }, clave, enRespuesta);
      return;
    }
    const texto = textoDeEjemplo(parte.cuerpo, c.negocio);
    poner({ id: nuevoId('tx'), fromMe: false, autor: firma(), texto: texto.trim() || 'Sin escribir', fecha: ahora });
    if (texto.trim()) mandarReal({ canal: 'whatsapp', tipo: 'texto', texto }, clave, enRespuesta);
  };

  /**
   * Dibuja un mensaje del flujo como le llega al lead, y lo manda si el recorrido es de verdad.
   * Devuelve cuánto tarda en terminar de aparecer (las partes que vienen después de la primera).
   */
  const mostrarPaso = (p: PasoSecuenciaDto, nodo: string, redactado?: string, enRespuesta = false, minuto = 0): number => {
    const c = ctx.current;
    const ahora = new Date().toISOString();
    if (p.canal === 'email') {
      // A la BANDEJA, con las variables del lead de ejemplo; lo que sale de verdad es lo que se ve.
      const correo = correoDeEjemplo(p, c.negocio);
      ponerCorreo({ id: nuevoId('em'), ...correo, minuto, leido: false });
      mandarReal({ canal: 'email', tipo: 'texto', texto: correo.cuerpo, asunto: correo.asunto, ...(correo.html ? { html: correo.html } : {}) }, nodo, enRespuesta);
      return 0;
    }
    // ⚠️ VARIOS MENSAJES POR TARJETA (cuarta tanda, punto 15: «un audio primero y luego un link»): cada
    // parte EN ORDEN, como las manda el motor, con un respiro entre una y otra. `partesDe` lee también
    // lo de antes: un audio con pie son dos burbujas, el audio y el texto de después. Un «MaKo lo
    // adapta» es UN texto: va por abajo.
    if (redactado == null && p.tipo !== 'ia') {
      const lista = partesDe(p);
      if (!lista.length) { poner({ id: nuevoId('tx'), fromMe: false, autor: firma(), texto: 'Sin escribir', fecha: ahora }); return 0; }
      // `luego` corta solo si la prueba se reinicia en el medio (↻, el lead que escribe).
      lista.forEach((parte, k) => {
        const clave = lista.length > 1 ? `${nodo}#${k}` : nodo;
        if (k === 0) mostrarParte(parte, clave, enRespuesta);
        else luego(k * ENTRE_PARTES_MS, () => mostrarParte(parte, clave, enRespuesta));
      });
      return (lista.length - 1) * ENTRE_PARTES_MS;
    }
    const texto = redactado ?? textoDeEjemplo(p.cuerpo, c.negocio);
    // En la salida, un «Lo adapta MaKo» muestra el texto BASE: a cada lead le llega otro.
    const marca = p.tipo === 'ia' && !enRespuesta ? ' · ✦' : '';
    poner({ id: nuevoId('tx'), fromMe: false, autor: `${firma()}${marca}`, texto: texto.trim() || 'Sin escribir', fecha: ahora });
    if (texto.trim()) mandarReal({ canal: 'whatsapp', tipo: 'texto', texto }, nodo, enRespuesta);
    return 0;
  };

  /** Corre UN evento del flujo y agenda el que sigue. */
  function avanzar() {
    const { evento, estado } = siguiente(flujoRef.current, simRef.current, ctx.current.nombres);
    simRef.current = estado;
    if (!evento) return;
    switch (evento.t) {
      case 'mensaje': {
        const paso = evento.paso as PasoSecuenciaDto;
        const delPaso: CanalProbar = canalDelPaso(paso);
        // Salga por el canal que salga, desde acá el lead «ya fue contactado» (para las condiciones).
        huboMensaje.current = true;
        // UN CANAL POR VEZ: lo del otro canal ni se dibuja ni sale. El recorrido sigue igual (sus
        // esperas y sus condiciones son del flujo, no del canal).
        if (delPaso !== ctx.current.canal) { luego(0, avanzar); return; }
        const minuto = estado.ahora;
        if (delPaso === 'email') {
          setRecibiendo(true);
          luego(ESCRIBIENDO_MS, () => { setRecibiendo(false); mostrarPaso(paso, evento.nodo, undefined, evento.enRespuesta, minuto); luego(ENTRE_MS, avanzar); });
          return;
        }
        setTyping({ lado: 'left', autor: firma() });
        // «MaKo contesta» en «Si responde»: lo redacta el redactor del motor con el caso LOCAL.
        if (evento.enRespuesta && paso.tipo === 'ia') {
          const r0 = run.current;
          void postar({
            action: 'responder', secuenciaId: ctx.current.secuenciaId, historial: historial(),
            escenario: escenarioParaRedactar(simRef.current, paso),
          }).then((j) => {
            if (run.current !== r0) return;
            setTyping(null);
            if (j.ok && typeof j.respuesta === 'string') mostrarPaso(paso, evento.nodo, j.respuesta, true);
            else sistema(`⚠ ${j.error ?? 'MaKo no pudo responder'}`, 'bad');
            luego(ENTRE_MS, avanzar);
          });
          return;
        }
        luego(ESCRIBIENDO_MS, () => { setTyping(null); const resto = mostrarPaso(paso, evento.nodo, undefined, evento.enRespuesta); luego(ENTRE_MS + resto, avanzar); });
        return;
      }
      case 'espera':
      case 'accion':
      case 'salto':
        sistema(evento.texto);
        luego(PILDORA_MS, avanzar);
        return;
      // ⚠️ CUARTA TANDA, PUNTOS 3 Y 17: «elimina los botones de "Tiene WhatsApp" y "Si no", eso no
      // tiene sentido». Con una condición primera la prueba se quedaba PARADA esperando la rama. Sin
      // botones, la condición se decide sola.
      // ⚠️ QUINTA TANDA, PUNTO 1: sola, pero NO siempre por el «Sí». Así, la Bienvenida entraba por el
      // «Sí» de «Agendó», saltaba a otra automatización y no salía ningún mensaje (medido: «Esperar 1 h»
      // y «↪ Sigue en…», nada más). La decide el MOTOR (`elegirSalida`) con un lead RECIÉN LLEGADO por
      // este CRON: sin agenda, sin pago, entrado ahora, y lo que esta prueba ya le mandó o le contestó.
      case 'condicion': {
        // ⚠️ SEXTA TANDA, «PROBAR» 1: con el CONTACTO elegido para el canal (`contactoRef`). Con
        // teléfono y email siempre, «Tiene WhatsApp» salía por el «Sí» y el email del «Si no» no
        // llegaba nunca a la bandeja.
        const r = elegirComoLead(flujoRef.current, simRef.current, hechosDeLeadNuevo({
          ...leadRef.current, ...contactoRef.current, yaContactado: huboMensaje.current, respondio: turnoLead.current > 0,
        }));
        simRef.current = r.estado;
        if (!r.opcion) { sistema('Fin'); setTerminado(true); return; }
        luego(0, avanzar);
        return;
      }
      case 'fin':
        sistema(evento.texto);
        setTerminado(true);
        return;
    }
  }

  /**
   * ¿HAY QUE FRENAR ESTE ARRANQUE? (`freno`, arriba.) Si sí, dice el porqué donde lo dice Publicar y abre
   * la tarjeta que falta; el panel deja la píldora una vez (no una por clic) y no arranca nada.
   */
  const frenado = (): boolean => {
    if (!freno) return false;
    propia?.frenar(freno);
    const ultimo = msgsRef.current[msgsRef.current.length - 1];
    if (ctx.current.canal === 'email' || ultimo?.texto !== TEXTO_FRENADO) sistema(TEXTO_FRENADO, 'bad', true);
    return true;
  };

  /** Arranca la prueba desde la primera tarjeta, con el flujo que se ve ahora. */
  const arrancarRefs = () => {
    flujoRef.current = flujoVivo;
    simRef.current = iniciar(flujoVivo);
    contactoRef.current = contactoDe(flujoVivo);
    msgsRef.current = [];
    correosRef.current = [];
    yaSalioUno.current = false;
    enviadosReal.current = new Set();
    turnoLead.current = 0;
    dijoRepetido.current = false;
    huboMensaje.current = false;
    luego(150, avanzar);
  };

  // Al abrir: arranca solo. Abrir «Probar» y ver llegar los mensajes ES la prueba. (El botón que lo
  // abre ya frenó; esto es la red, por si el flujo cambió en el medio.)
  useEffect(() => {
    if (!frenado()) arrancarRefs();
    return () => cortar();
    // Sólo al montar: reiniciar es ↻, no cada tecla del lienzo. Otro canal es otro panel (`key`).
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  /** Vuelve a empezar. `deVerdad`: este recorrido sale al destino de abajo. ↻ es sin envío. */
  const reiniciar = (deVerdad = false) => {
    // Lo que se ve tiene una tarjeta suelta o algo sin completar: no se rearranca (y lo de antes queda).
    if (frenado()) return;
    cortar();
    setMensajes([]); setTyping(null); setOpciones(null);
    setCorreos([]); setAbierto(null); setRecibiendo(false); setTerminado(false); setAviso(null);
    realRef.current = deVerdad; setReal(deVerdad);
    setFirmaProbada(firmaViva);
    arrancarRefs();
  };

  // ── «Probar en WhatsApp / Email» (quinta tanda, punto 1) ─────────────────────────────────────
  // Un botón al lado de ↻ que abre un desplegable: primero los destinos GUARDADOS de quien prueba y
  // abajo «Nuevo número» / «Nuevo email», que abre el form de siempre (el teléfono con su bandera,
  // `TelefonoConPais`). Elegir uno arranca el MISMO recorrido, desde el principio y de verdad.
  const [menu, setMenu] = useState(false);
  const [btnProbar, setBtnProbar] = useState<HTMLButtonElement | null>(null);
  const [cajaMenu, setCajaMenu] = useState<HTMLDivElement | null>(null);
  const [nuevo, setNuevo] = useState(false);
  const [lada, setLada] = useState(DIAL_DEFAULT);
  const [numero, setNumero] = useState('');
  const [nuevoEmail, setNuevoEmail] = useState('');
  const [errNuevo, setErrNuevo] = useState<string | null>(null);
  const cerrarMenu = () => { setMenu(false); setNuevo(false); setErrNuevo(null); };

  /** El mismo recorrido, desde el principio y de verdad, a `d`. */
  const probarA = (d: string) => {
    const limpio = d.trim();
    if (!limpio) return;
    cerrarMenu();
    // ⚠️ ANTES DE TOCAR EL DESTINO: frenado, el recorrido de verdad no arranca y nada sale.
    if (frenado()) return;
    setDestino(limpio);
    // Antes del primer envío: `ctx` se copia después del render, y el recorrido arranca ahora.
    ctx.current = { ...ctx.current, destino: limpio };
    reiniciar(true);
  };

  /** «Nuevo número» / «Nuevo email»: se valida con la regla del server, se guarda y se prueba. */
  const probarNuevo = (e: FormEvent) => {
    e.preventDefault();
    if (frenado()) { cerrarMenu(); return; }
    const d = esEmail ? sanearDestinoPrueba({ email: nuevoEmail }).email : sanearDestinoPrueba({ telefono: unirTelefono(lada, numero) }).telefono;
    if (!d) { setErrNuevo(esEmail ? 'Email inválido' : 'Número incompleto'); return; }
    // Se suma a los de QUIEN PRUEBA sin esperar: la prueba no depende de que se guarde.
    void postar({ action: 'guardar-destino', destino: esEmail ? { email: d } : { telefono: d } }).then((j) => {
      if (j.ok && Array.isArray(j.telefonos) && Array.isArray(j.emails)) setGuardados({ telefonos: j.telefonos.map(String), emails: j.emails.map(String) });
    });
    setNumero(''); setNuevoEmail('');
    probarA(d);
  };

  const abrirCorreo = (id: string) => {
    setAbierto(id);
    // Al volver a la bandeja, nada entra de nuevo: ya llegó.
    setEntra(null);
    correosRef.current = correosRef.current.map((c) => (c.id === id ? { ...c, leido: true } : c));
    setCorreos(correosRef.current);
  };

  /**
   * El lead escribió (o mandó un audio): la salida se PAUSA y corre «Si responde» con el caso
   * que elija el clasificador. Devuelve la transcripción, si era un audio.
   */
  const alResponder = async (cuerpo: { mensaje?: string; audioBase64?: string; audioMime?: string }): Promise<string | null> => {
    cortar();
    // Un turno nuevo del lead: lo que «Si responde» conteste ahora sale de verdad otra vez.
    turnoLead.current += 1;
    setTyping(null); setOpciones(null);
    const p = pausarPorRespuesta(simRef.current);
    simRef.current = p.estado;
    if (p.pausoLaSalida) sistema('⏸ Se pausa');
    if (!raizRespuesta(flujoRef.current)) { sistema('MaKo no contesta'); return null; }
    const r0 = run.current;
    setTyping({ lado: 'left', autor: firma() });
    const j = await postar({ action: 'clasificar', pasos: flujoRef.current, ...cuerpo });
    if (run.current !== r0) return null;
    setTyping(null);
    if (!j.ok) { sistema(`⚠ ${j.error ?? 'No se pudo clasificar'}`, 'bad'); return null; }
    const e = entrarEnRespuesta(flujoRef.current, simRef.current, typeof j.casoId === 'string' ? j.casoId : null);
    simRef.current = e.estado;
    // ⚠️ CON LAS PALABRAS DE LA TARJETA (restos de versiones anteriores, 10/10/2026): «Si responde» se
    // DIBUJA como la CONDITION que escucha (sexta tanda, punto 12), con una fila «Su respuesta trata de
    // «…»» por caso y «Si no» al final. Acá seguía diciendo «Si responde · Otra cosa», los nombres de
    // antes. (El título del caso que viaja al redactor sigue siendo «Otra cosa»: es el del motor.) Y sin
    // casos, «Respondió», como la tarjeta: la MISMA función (séptima tanda).
    sistema(e.caso?.id ? textoCasoRespuesta(e.caso) : rotuloSiNoDeRespuesta(nodoPorId(flujoRef.current, raizRespuesta(flujoRef.current))));
    luego(PILDORA_MS, avanzar);
    return typeof j.transcript === 'string' ? j.transcript : null;
  };

  async function enviarTexto(texto: string): Promise<boolean> {
    poner({ id: nuevoId('lead'), fromMe: true, texto, fecha: new Date().toISOString() });
    await alResponder({ mensaje: texto });
    return true;
  }

  async function enviarArchivo(blob: Blob, tipo: '' | 'audio', fileName: string, caption?: string): Promise<boolean> {
    const url = URL.createObjectURL(blob);
    if (tipo === 'audio') {
      const id = nuevoId('lead-audio');
      poner({ id, fromMe: true, tipo: 'audio', mediaUrl: url, fecha: new Date().toISOString() });
      const transcript = await alResponder({ audioBase64: await blobABase64(blob), audioMime: blob.type || 'audio/mpeg' });
      if (transcript) {
        msgsRef.current = msgsRef.current.map((m) => (m.id === id ? { ...m, texto: `🎙 ${transcript}` } : m));
        setMensajes(msgsRef.current);
      }
      return true;
    }
    const esImg = blob.type.startsWith('image/');
    poner({ id: nuevoId('lead-file'), fromMe: true, tipo: esImg ? 'image' : 'document', mediaUrl: url, texto: caption || fileName, fecha: new Date().toISOString() });
    await alResponder({ mensaje: `[el lead mandó un archivo: ${fileName}]${caption ? ` ${caption}` : ''}` });
    return true;
  }

  const cambio = firmaViva !== firmaProbada;
  const def = CANALES_PROBAR[canal];
  /** El destino de la prueba de verdad es un email (si no, un teléfono). */
  const esEmail = def.destinoEsEmail;
  /** Instagram o Messenger: el mismo recorrido, dibujado con `SimuladorSocial` y sin prueba de verdad. */
  const social = esCanalSocial(canal) ? canal : null;

  /** «Vincular nuevo» del emisor: se cierra el desplegable y se abre el flujo de siempre. */
  const abrirVincular = () => { cerrarMenu(); setVinculando(true); };
  /** La línea recién vinculada pasa a ser el emisor, y el desplegable vuelve a abrirse para elegir «Para». */
  const alVincularLinea = (linea: string) => {
    setVinculando(false);
    setVueltaLineas((v) => v + 1);
    setEmisor(linea);
    setMenu(true);
  };
  /** El dominio cambió en el flujo de /email: el remitente nuevo (si apareció uno) pasa a ser el emisor. */
  const alVincularDominio = (d: DomState) => {
    const antes = vinculados;
    setDom(d);
    if (typeof d.remitente === 'string') setRemitente(d.remitente);
    const recien = remitentesVinculados(d).filter((r) => !antes.includes(r));
    if (recien.length === 1) setEmisor(recien[0]);
  };

  // LLENA EL RECTÁNGULO DEL PADRE (`width/height: 100%`): el lugar y el tamaño los decide quien lo
  // monta (`muelles`). Un padre que lo ancla arriba Y abajo sin dar alto lo dimensiona con el
  // ancla: ahí un `height: 100%` lo estiraría más allá del borde de abajo.
  const raiz: CSSProperties = {
    display: 'flex', flexDirection: 'column', minHeight: 0, gap: 8, padding: 10,
    width: '100%', height: '100%',
    background: 'var(--surface)', border: '1px solid var(--border)', borderRadius: 18,
    boxShadow: '0 8px 28px rgba(18,21,27,.12)', boxSizing: 'border-box', ...style,
  };
  if (style?.top != null && style?.bottom != null && style.height == null) delete raiz.height;

  // ── EL SIMULADOR DE CADA CANAL (sexta tanda) ─────────────────────────────────────────────────
  // UN `switch`, y es el único lugar donde se decide qué se dibuja por canal. La parte «canales»
  // enchufa acá Instagram y Messenger: su fila en `CANALES_PROBAR`, su caso en `canalDelPaso` y su
  // `case` acá. El recorrido, los envíos de verdad y la cabecera ya leen el canal de esos dos lugares.
  let simulador: ReactNode;
  switch (canal) {
    case 'email':
      // La BANDEJA tipo Gmail: lo que llega, con el MISMO render que sale. Sin caja para contestar.
      simulador = (
        <BandejaGmail correos={correos} abierto={abierto} recibiendo={recibiendo} terminado={terminado} entra={entra}
          remitente={remitente} negocio={negocio} onAbrir={abrirCorreo} onVolver={() => setAbierto(null)} />
      );
      break;
    case 'instagram':
    case 'messenger':
      // El DM como lo ve el lead (parte «canales»): el MISMO recorrido, con la cara de Instagram o Messenger.
      simulador = <SimuladorSocial canal={canal} mensajes={mensajes} typing={typing} onEnviarTexto={enviarTexto} negocio={negocio} />;
      break;
    case 'whatsapp':
    default:
      // EL TELÉFONO: el hilo con su animación y la caja para contestar como el lead.
      simulador = (
        <div style={{ position: 'absolute', inset: 0, display: 'flex', flexDirection: 'column' }}>
          <ChatHilo
            accent="var(--wa)" accentBubble="var(--wa-bubble)"
            mensajes={mensajes} typing={typing} animarNuevos
            draftKey={`probar-${secuencia.id}`}
            placeholder="Responde como el lead…"
            onEnviarTexto={enviarTexto} onEnviarArchivo={enviarArchivo}
            /* Vacío a propósito: arranca solo y en 150 ms ya está el «escribiendo…». Un «Sin
               mensajes» que aparece y se va se lee como un parpadeo. */
            vacio={<></>}
          />
        </div>
      );
  }

  return (
    <section aria-label="Probar" data-canal={canal} style={raiz}>
      <style>{CSS}</style>
      {/* LA CABECERA, EN UN RENGLÓN (cuarta tanda, punto 3: «no me gusta que "Probar en mi WhatsApp"
          esté abajo del todo, tiene que estar arriba a la izquierda, en donde hoy está el texto
          "Probar WhatsApp", elimina ese texto. Y que el botón diga "Probar en WhatsApp". Y el botón
          de "Cerrar" debería estar donde hoy está el botón de "probar"»). Desde la QUINTA tanda
          (punto 1): a la izquierda el logo del canal; a la derecha «Cambió», «Probar en WhatsApp» (con
          su desplegable, sólo el admin manda) y ↻. El «Cerrar» es el «▶ Probar» del chrome
          (SecuenciaPerfil). */}
      <div style={{ flex: 'none', display: 'flex', alignItems: 'center', gap: 8, padding: '2px 2px 0', whiteSpace: 'nowrap' }}>
        {/* EL LOGO DEL CANAL, arriba a la izquierda (quinta tanda, punto 1: «no elimines el logo de
            WhatsApp o Email arriba a la izquierda»). Los mismos del ＋ (`ICONOS_MAS`), por `CANALES_PROBAR`. */}
        {/* eslint-disable-next-line @next/next/no-img-element */}
        <img src={def.logo} alt={def.nombre} width={22} height={22} style={{ flex: 'none', display: 'block' }} />
        <div style={{ flex: 1, minWidth: 0, display: 'flex' }}>
          {rolAdmin && real && (
            <div role="status" style={{ display: 'flex', alignItems: 'center', gap: 7, fontSize: 12.5, color: 'var(--dim)', ...recorte }}>
              <span aria-hidden style={{ width: 7, height: 7, borderRadius: '50%', background: 'var(--good)', flex: 'none' }} />
              {/* Desde dónde y a dónde (sexta tanda, «Probar» 2). Sin emisor leído, sólo a dónde. */}
              {rotuloEmisor ? `${rotuloEmisor} → ${destinoLegible(destino, esEmail)}` : `Llega a ${destinoLegible(destino, esEmail)}`}
            </div>
          )}
        </div>
        {cambio && (
          <button type="button" onClick={() => reiniciar()} title="Reiniciar con lo último"
            style={{ flex: 'none', background: 'none', border: 'none', padding: 0, font: 'inherit', fontSize: 12, fontWeight: 600, color: 'var(--warn)', cursor: 'pointer' }}>
            Cambió · ↻
          </button>
        )}
        {/* «PROBAR EN WHATSAPP» AL LADO DE ↻, y el emisor y el destino en un DESPLEGABLE que abre el
            botón (quinta tanda, punto 1; sexta, «Probar» 2). Sólo el admin manda de verdad. */}
        {/* Sin «Probar en Instagram» de verdad: Meta no deja escribirle primero a nadie (SimuladorSocial). */}
        {rolAdmin && !real && !social && (
          <Button ref={setBtnProbar} size="sm" aria-haspopup="dialog" aria-expanded={menu}
            onClick={() => (menu ? cerrarMenu() : !frenado() && setMenu(true))}>{def.probarEn}</Button>
        )}
        <button type="button" onClick={() => reiniciar()} title="Reiniciar" aria-label="Reiniciar" style={iconBtn}>↻</button>
      </div>
      {menu && rolAdmin && (
        <PopoverWA ancla={btnProbar} etiqueta={def.probarEn} onCerrar={cerrarMenu}>
          <MenuDestinos
            refCaja={setCajaMenu} esEmail={esEmail} guardados={guardados} onElegir={probarA}
            nuevo={nuevo} onNuevo={() => { setNuevo(true); setErrNuevo(null); }} onProbarNuevo={probarNuevo} error={errNuevo}
            formTelefono={(
              <TelefonoConPais lada={lada} numero={numero} onLada={setLada} onNumero={(v) => { setNumero(v); setErrNuevo(null); }}
                inputStyle={inpReal} portalTo={cajaMenu} anchoLada={112} autoFocus />
            )}
            formEmail={(
              <input value={nuevoEmail} onChange={(e) => { setNuevoEmail(e.target.value); setErrNuevo(null); }} type="email" inputMode="email" autoFocus
                aria-label="Nuevo email" placeholder="nombre@correo.com" style={inpReal} />
            )}
            puedeProbarNuevo={esEmail ? !!nuevoEmail.trim() : !!numero.trim()}
            emisor={{ opciones: opcionesEmisor, elegido: emisorVisible, onElegir: setEmisor, onVincular: abrirVincular }}
          />
        </PopoverWA>
      )}
      {vinculando && rolAdmin && (
        <VincularEmisor canal={canal} dom={dom && dom !== 'error' ? dom : null} reemplaza={vinculados.length > 0}
          onCerrar={() => setVinculando(false)} onLinea={alVincularLinea} onDominio={alVincularDominio} />
      )}

      {/* El cuerpo va en una caja ABSOLUTA: `ChatHilo` se mide con `height: 100%`, y contra un
          alto que sale de `flex: 1` eso es CERO en Safari (AGENTS.md). Con `inset: 0` el alto
          es definido en los dos motores. */}
      <div style={{ flex: 1, minHeight: 0, position: 'relative' }}>
        {simulador}
      </div>

      {/* En la bandeja no hay hilo: la última píldora que falló va en un renglón debajo (sin «Fin»). */}
      {canal === 'email' && aviso && (
        <div style={{ flex: 'none', display: 'flex', flexDirection: 'column', gap: 6, padding: '0 2px' }}>
          <span role="status" style={{ fontSize: 12.5, color: aviso.tono === 'bad' ? 'var(--bad)' : 'var(--dim)', ...recorte }}>{aviso.texto}</span>
        </div>
      )}
    </section>
  );
}
