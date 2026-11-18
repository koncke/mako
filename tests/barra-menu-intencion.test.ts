// El menú de la barra del sitio no se cambia al cruzar en diagonal (18/11/2026, Martín: «aprieto MaKo Partners y no me redirecciona a
// ningún lado»). Para llegar a «MaKo Partners» (primera columna de Recursos) el mouse cruza «Producto» o «Industrias»; con el cambio
// instantáneo el clic caía en MaKo Agency. El que se abre espera y el que se va sigue visible: si el mouse llega antes, nada cambia.
import { test } from 'node:test';
import assert from 'node:assert/strict';
import { CSS_BARRA } from '../app/vsl/_sitio/estilos';

test('la barra: el menú que se abre espera y el que se va sigue visible un momento (cruzar en diagonal no lo cambia)', () => {
  assert.match(CSS_BARRA, /\.s-nav-it:hover>\.s-mega,\.s-nav-it:focus-within>\.s-mega\{[^}]*transition:[^}]*visibility 0s \.1\d?s/, 'abrir espera');
  assert.match(CSS_BARRA, /\.s-nav:hover \.s-nav-it:not\(:hover\)>\.s-mega\{[^}]*visibility 0s linear \.[2-9]\d*s/, 'el que se va sigue visible');
  assert.doesNotMatch(CSS_BARRA, /\.s-mega\{[^}]*pointer-events:none/, 'los clics los corta visibility (que espera), no pointer-events (que no)');
});
