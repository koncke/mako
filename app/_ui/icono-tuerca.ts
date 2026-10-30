// =============================================================================
// La TUERCA de Settings, en un solo lugar (25/10/2026)
// =============================================================================
// Martín: «revisa el logo de settings de toda la app, siempre debe ser la tuerca, no ese...» («ese» eran los controles
// deslizantes de `config`). Un engranaje de 8 dientes en la grilla de 24, con el mismo trazo que los demás íconos. Lo dibujan
// los dos sets: la barra (`Icon name="tuerca"`, app/_components/icons.tsx) y los desplegables (`configurar`,
// app/_ui/iconos-menu.tsx). Vive aparte porque esos dos se importan entre sí: definido en uno, el otro lo leía antes de tiempo
// («Cannot access 'TUERCA' before initialization»).

export const TUERCA = 'M10.04 5.18L10.50 2.52L13.50 2.52L13.96 5.18A7.1 7.1 0 0 1 15.44 5.79L17.64 4.23L19.77 6.36L18.21 8.56A7.1 7.1 0 0 1 18.82 10.04L21.48 10.50L21.48 13.50L18.82 13.96A7.1 7.1 0 0 1 18.21 15.44L19.77 17.64L17.64 19.77L15.44 18.21A7.1 7.1 0 0 1 13.96 18.82L13.50 21.48L10.50 21.48L10.04 18.82A7.1 7.1 0 0 1 8.56 18.21L6.36 19.77L4.23 17.64L5.79 15.44A7.1 7.1 0 0 1 5.18 13.96L2.52 13.50L2.52 10.50L5.18 10.04A7.1 7.1 0 0 1 5.79 8.56L4.23 6.36L6.36 4.23L8.56 5.79A7.1 7.1 0 0 1 10.04 5.18Z';
