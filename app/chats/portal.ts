// =============================================================================
// El contenedor de los portales de Chats
// =============================================================================
// El `Dropdown` de la casa (app/components/Dropdown.tsx) monta su menú en <body>, que queda FUERA de
// la raíz `.rio` donde viven los tokens `--rio-*` de respond.io: el menú no heredaría nada del scope.
// Por eso los desplegables de la tab reciben `portalTo={portalRio()}`, un contenedor que ChatsApp
// dibuja adentro de sí misma (AGENTS.md, «un tema limitado a una clase no llega a los PORTALES»;
// molde: app/video-editor/portal.ts).
//
// Devuelve `null` cuando no existe (el render del server, o un componente montado fuera de la tab):
// el Dropdown cae a `document.body`, que es lo de siempre.

export const ID_PORTAL_RIO = 'rio-portal';

export function portalRio(): HTMLElement | null {
  if (typeof document === 'undefined') return null;
  return document.getElementById(ID_PORTAL_RIO);
}
