import { NextResponse } from "next/server";

/**
 * Apple App Site Association — habilita WebAuthn/Passkeys en el WebView
 * de Capacitor. iOS lo pide en https://<dominio>/.well-known/apple-app-site-association
 * cuando la app declara Associated Domains con `webcredentials:<dominio>`.
 *
 * El TEAM_ID + Bundle ID que se declaran acá tienen que matchear los del
 * proyecto iOS de Capacitor. Se leen de env vars para no hardcodear.
 */

const BUNDLE_ID = "ar.malenitaa.fisca";

export async function GET() {
  const teamId = process.env.IOS_TEAM_ID;
  if (!teamId) {
    // Sin Team ID no podemos armar el AASA. Devolvemos 404 para que iOS
    // no cachee un archivo malformado.
    return new NextResponse("IOS_TEAM_ID missing", { status: 404 });
  }

  const payload = {
    webcredentials: {
      apps: [`${teamId}.${BUNDLE_ID}`],
    },
    applinks: {
      apps: [],
      details: [
        {
          appID: `${teamId}.${BUNDLE_ID}`,
          paths: ["*"],
        },
      ],
    },
  };

  return new NextResponse(JSON.stringify(payload), {
    status: 200,
    headers: {
      "Content-Type": "application/json",
      // iOS descarga este archivo periódicamente; cache corta para poder
      // corregir errores rápido.
      "Cache-Control": "public, max-age=3600",
    },
  });
}
