// Copiado de polarsource/polar (Apache-2.0) y modificado para MaKo, clients/apps/web/src/components/Settings/settingsSections.ts. Aviso: lib/avisos/LICENSE-POLAR y lib/avisos/NOTICE-POLAR.
//
// Las secciones de Settings que MaKo llena (la barra: web/Dashboard/navigationSettings.tsx). Las demás de Polar
// (Subscriptions, Disputes, Customer Portal, Embedding, Domains, Access Tokens, Preview Features, Notifications, Profile,
// Security, OAuth Apps) no tienen un dato de MaKo detrás: se sacaron, con `isAvailable` y los anclas viejos
// (`LEGACY_SETTINGS_HASHES`, de cuando Settings era una sola página: MaKo nunca la tuvo).

export type SettingsSection = {
  readonly title: string
}

export const SETTINGS_SECTIONS = {
  payments: { title: 'Payments' },
  'customer-notifications': { title: 'Customer Notifications' },
} satisfies Record<string, SettingsSection>

export type SettingsSectionSlug = keyof typeof SETTINGS_SECTIONS

export const getSettingsSection = (slug: string): SettingsSection | undefined => {
  if (!Object.prototype.hasOwnProperty.call(SETTINGS_SECTIONS, slug)) {
    return undefined
  }
  return SETTINGS_SECTIONS[slug as SettingsSectionSlug]
}
