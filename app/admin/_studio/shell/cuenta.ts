// La cuenta de quien mira Admin (el super admin) y lo que hacen las opciones de su menú. Las usan los dos menús de Studio
// que la muestran: el pie del sidebar (nav-user) y el avatar de la cabecera (account-switcher). En Studio son datos de
// muestra y las opciones no hacen nada; acá llevan a las pantallas de MaKo que dicen lo mismo.

export type CuentaSa = { readonly name: string; readonly email: string; readonly avatar: string }

export const OPCIONES_CUENTA = {
  account: "/perfil",
  billing: "/admin?tab=billing",
  notifications: "/perfil/notificaciones",
} as const

/** Cerrar sesión: el mismo pedido que la barra de MaKo (app/_components/Sidebar.tsx). */
export async function cerrarSesion() {
  await fetch("/api/auth/logout", { method: "POST" })
  window.location.href = "/login"
}
