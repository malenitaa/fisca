import { SplashView } from "@/components/splash-view";

/** Sin animación de entrada — este boundary se muestra después del splash
 * de la raíz o entre navegaciones internas, y la anim ya se ejecutó una
 * vez. Así se ve como un único splash continuo sin re-pulsear. */
export default function Loading() {
  return <SplashView />;
}
