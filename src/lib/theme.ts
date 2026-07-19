/**
 * Fuente del script que decide el tema (oscuro/claro) antes de que se pinte
 * la página, para no tener un flash del tema equivocado. Corre en un
 * <script> bloqueante en el <head>, así que tiene que ser JS plano, sin
 * imports ni dependencias de React.
 *
 * Sigue automáticamente la preferencia del sistema (`prefers-color-scheme`),
 * sin toggle manual. Se re-suscribe a cambios en tiempo real.
 */
export function themeInitScript(): string {
  return `
    (function () {
      try {
        var mq = window.matchMedia("(prefers-color-scheme: dark)");
        var apply = function () { document.documentElement.classList.toggle("dark", mq.matches); };
        apply();
        if (mq.addEventListener) mq.addEventListener("change", apply);
        else if (mq.addListener) mq.addListener(apply);
      } catch (e) {}
    })();
  `;
}
