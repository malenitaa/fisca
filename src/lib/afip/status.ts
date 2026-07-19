import { AFIP_ENDPOINTS, type Ambiente } from "./config";
import { callWsfeSoap } from "./soap";

const WSFEX_NAMESPACE = "http://ar.gov.afip.dif.fexv1/";
const CACHE_MS = 60_000;
const TIMEOUT_MS = 5_000;

export interface DummyStatus {
  appServer: string;
  dbServer: string;
  authServer: string;
  ok: boolean;
}

export interface AfipStatus {
  /** Basado únicamente en producción — homologación es ambiente de prueba,
   * que esté caída no debería mostrarse como "ARCA con problemas". */
  ok: boolean;
  checkedAt: string;
  servicios: Record<Ambiente, { wsfe: DummyStatus | null; wsfex: DummyStatus | null }>;
}

function toDummyStatus(
  result: { AppServer?: unknown; DbServer?: unknown; AuthServer?: unknown } | undefined
): DummyStatus {
  const appServer = String(result?.AppServer ?? "");
  const dbServer = String(result?.DbServer ?? "");
  const authServer = String(result?.AuthServer ?? "");
  return {
    appServer,
    dbServer,
    authServer,
    ok: appServer === "OK" && dbServer === "OK" && authServer === "OK",
  };
}

/** FEDummy/FEXDummy son los métodos de "ping" que expone AFIP: no piden
 * Auth (Token/Sign/Cuit), solo informan si sus tres capas están OK. */
async function checkWsfeDummy(ambiente: Ambiente): Promise<DummyStatus> {
  const body = await callWsfeSoap({
    endpoint: AFIP_ENDPOINTS[ambiente].wsfe,
    soapAction: "http://ar.gov.afip.dif.FEV1/FEDummy",
    body: "<ar:FEDummy/>",
    serviceName: "WSFEv1",
  });
  const result = body?.FEDummyResponse as
    | { FEDummyResult?: { AppServer?: unknown; DbServer?: unknown; AuthServer?: unknown } }
    | undefined;
  return toDummyStatus(result?.FEDummyResult);
}

async function checkWsfexDummy(ambiente: Ambiente): Promise<DummyStatus> {
  const body = await callWsfeSoap({
    endpoint: AFIP_ENDPOINTS[ambiente].wsfex,
    soapAction: `${WSFEX_NAMESPACE}FEXDummy`,
    body: "<ar:FEXDummy/>",
    namespace: WSFEX_NAMESPACE,
    serviceName: "WSFEXv1",
  });
  const result = body?.FEXDummyResponse as
    | { FEXDummyResult?: { AppServer?: unknown; DbServer?: unknown; AuthServer?: unknown } }
    | undefined;
  return toDummyStatus(result?.FEXDummyResult);
}

function withTimeout<T>(promise: Promise<T>, ms: number): Promise<T> {
  return new Promise((resolve, reject) => {
    const timer = setTimeout(() => reject(new Error(`Timeout de ${ms}ms`)), ms);
    promise.then(
      (value) => {
        clearTimeout(timer);
        resolve(value);
      },
      (err) => {
        clearTimeout(timer);
        reject(err);
      }
    );
  });
}

async function safeDummy(check: () => Promise<DummyStatus>): Promise<DummyStatus | null> {
  try {
    return await withTimeout(check(), TIMEOUT_MS);
  } catch {
    return null;
  }
}

let cache: { status: AfipStatus; expiresAt: number } | null = null;

/** Pega a WSFEv1/WSFEXv1 de homologación y producción con el método
 * "dummy" (sin auth) y cachea el resultado 60s para no saturar a ARCA con
 * cada carga de /ayuda o del endpoint público. */
export async function getAfipStatus(): Promise<AfipStatus> {
  const now = Date.now();
  if (cache && cache.expiresAt > now) {
    return cache.status;
  }

  async function checkAmbiente(ambiente: Ambiente) {
    const [wsfe, wsfex] = await Promise.all([
      safeDummy(() => checkWsfeDummy(ambiente)),
      safeDummy(() => checkWsfexDummy(ambiente)),
    ]);
    return { wsfe, wsfex };
  }

  const [homologacion, produccion] = await Promise.all([
    checkAmbiente("homologacion"),
    checkAmbiente("produccion"),
  ]);

  const status: AfipStatus = {
    ok: produccion.wsfe?.ok === true && produccion.wsfex?.ok === true,
    checkedAt: new Date().toISOString(),
    servicios: { homologacion, produccion },
  };

  cache = { status, expiresAt: now + CACHE_MS };
  return status;
}
