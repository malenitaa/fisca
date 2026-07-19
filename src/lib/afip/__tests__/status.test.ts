import { describe, it, expect, vi, afterEach, beforeEach } from "vitest";

function dummyXml(tag: string, ns: string, ok: boolean) {
  const status = ok ? "OK" : "NO OK";
  return `<?xml version="1.0"?>
<soapenv:Envelope xmlns:soapenv="http://schemas.xmlsoap.org/soap/envelope/" xmlns:ar="${ns}">
  <soapenv:Body>
    <ar:${tag}Response>
      <ar:${tag}Result>
        <ar:AppServer>${status}</ar:AppServer>
        <ar:DbServer>${status}</ar:DbServer>
        <ar:AuthServer>${status}</ar:AuthServer>
      </ar:${tag}Result>
    </ar:${tag}Response>
  </soapenv:Body>
</soapenv:Envelope>`;
}

/** Responde OK a los 4 dummy calls (wsfe+wsfex × homologación+producción),
 * salvo que se indique ok:false para alguna URL de endpoint puntual. */
function stubFetch(overrides: Record<string, boolean> = {}) {
  vi.stubGlobal(
    "fetch",
    vi.fn(async (url: string, init: RequestInit) => {
      const soapAction = (init.headers as Record<string, string>).SOAPAction;
      const isFex = soapAction.includes("FEXDummy");
      const ok = overrides[url] ?? true;
      const xml = isFex
        ? dummyXml("FEXDummy", "http://ar.gov.afip.dif.fexv1/", ok)
        : dummyXml("FEDummy", "http://ar.gov.afip.dif.FEV1/", ok);
      return new Response(xml, { status: 200 });
    })
  );
}

beforeEach(() => {
  vi.resetModules();
  vi.useRealTimers();
});

afterEach(() => {
  vi.unstubAllGlobals();
});

describe("getAfipStatus", () => {
  it("ok:true cuando WSFE y WSFEX de producción responden OK", async () => {
    stubFetch();
    const { getAfipStatus } = await import("../status");

    const status = await getAfipStatus();

    expect(status.ok).toBe(true);
    expect(status.servicios.produccion.wsfe?.ok).toBe(true);
    expect(status.servicios.produccion.wsfex?.ok).toBe(true);
    expect(status.servicios.homologacion.wsfe?.ok).toBe(true);
  });

  it("ok:false si producción WSFE reporta problemas, aunque homologación esté OK", async () => {
    stubFetch({ "https://servicios1.afip.gov.ar/wsfev1/service.asmx": false });
    const { getAfipStatus } = await import("../status");

    const status = await getAfipStatus();

    expect(status.ok).toBe(false);
    expect(status.servicios.produccion.wsfe?.ok).toBe(false);
    expect(status.servicios.homologacion.wsfe?.ok).toBe(true);
  });

  it("homologación caída no afecta el ok general (solo importa producción)", async () => {
    stubFetch({ "https://wswhomo.afip.gov.ar/wsfev1/service.asmx": false });
    const { getAfipStatus } = await import("../status");

    const status = await getAfipStatus();

    expect(status.ok).toBe(true);
    expect(status.servicios.homologacion.wsfe?.ok).toBe(false);
  });

  it("ok:false (sin tirar) si AFIP no responde", async () => {
    vi.stubGlobal(
      "fetch",
      vi.fn(async () => {
        throw new Error("network down");
      })
    );
    const { getAfipStatus } = await import("../status");

    const status = await getAfipStatus();

    expect(status.ok).toBe(false);
    expect(status.servicios.produccion.wsfe).toBeNull();
  });

  it("cachea el resultado 60s: la segunda llamada no vuelve a pegarle a AFIP", async () => {
    stubFetch();
    const { getAfipStatus } = await import("../status");
    const fetchSpy = vi.mocked(fetch);

    await getAfipStatus();
    const callsAfterFirst = fetchSpy.mock.calls.length;
    await getAfipStatus();

    expect(fetchSpy.mock.calls.length).toBe(callsAfterFirst);
  });
});
