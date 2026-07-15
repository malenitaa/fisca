export const THEME_STORAGE_KEY = "theme";

/**
 * Fuente del script que decide el tema (oscuro/claro) antes de que se pinte
 * la página, para no tener un flash del tema equivocado. Corre en un
 * <script> bloqueante en el <head>, así que tiene que ser JS plano, sin
 * imports ni dependencias de React.
 */
export function themeInitScript(): string {
  return `
    (function () {
      try {
        var stored = localStorage.getItem("${THEME_STORAGE_KEY}");
        var isDark = stored === "dark" || (stored !== "light" && window.matchMedia("(prefers-color-scheme: dark)").matches);
        document.documentElement.classList.toggle("dark", isDark);
      } catch (e) {}
    })();
  `;
}
