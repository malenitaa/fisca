import { describe, it, expect, vi, afterEach, beforeEach } from "vitest";
import { EventEmitter } from "node:events";

const { mockHttpsRequest } = vi.hoisted(() => ({ mockHttpsRequest: vi.fn() }));

vi.mock("node:https", async (importOriginal) => {
  const actual = await importOriginal<typeof import("node:https")>();
  return { ...actual, request: mockHttpsRequest };
});

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

function xmlFor(soapAction: string, ok: boolean) {
  return soapAction.includes("FEXDummy")
    ? dummyXml("FEXDummy", "http://ar.gov.afip.dif.fexv1/", ok)
    : dummyXml("FEDummy", "http://ar.gov.afip.dif.FEV1/", ok);
}

/** Homologación (wswhomo.afip.gov.ar) sigue yendo por `fetch`. */
function stubFetchHomologacion(overrides: Record<string, boolean> = {}) {
  vi.stubGlobal(
    "fetch",
    vi.fn(async (url: string, init: RequestInit) => {
      const soapAction = (init.headers as Record<string, string>).SOAPAction;
      const ok = overrides[url] ?? true;
      return new Response(xmlFor(soapAction, ok), { status: 200 });
    })
  );
}

/** Producción (servicios1.afip.gov.ar) va por node:https con el Agent
 * legacy — ver soap.ts. */
function stubHttpsProduccion(overrides: Record<string, boolean> = {}) {
  mockHttpsRequest.mockImplementation(
    (
      url: string,
      options: { headers: Record<string, string> },
      callback: (res: EventEmitter & { statusCode: number }) => void
    ) => {
      const ok = overrides[url] ?? true;
      const res = Object.assign(new EventEmitter(), { statusCode: 200 });
      queueMicrotask(() => {
        callback(res);
        res.emit("data", Buffer.from(xmlFor(options.headers.SOAPAction, ok)));
        res.emit("end");
      });
      return Object.assign(new EventEmitter(), { write: vi.fn(), end: vi.fn() });
    }
  );
}

function stubHttpsProduccionDown() {
  mockHttpsRequest.mockImplementation(() => {
    const req = new EventEmitter() as EventEmitter & { write: () => void; end: () => void };
    req.write = vi.fn();
    req.end = vi.fn(() => {
      queueMicrotask(() => req.emit("error", new Error("network down")));
    });
    return req;
  });
}

beforeEach(() => {
  vi.resetModules();
  vi.useRealTimers();
  mockHttpsRequest.mockReset();
});

afterEach(() => {
  vi.unstubAllGlobals();
});

describe("getAfipStatus", () => {
  it("ok:true cuando WSFE y WSFEX de producción responden OK", async () => {
    stubFetchHomologacion();
    stubHttpsProduccion();
    const { getAfipStatus } = await import("../status");

    const status = await getAfipStatus();

    expect(status.ok).toBe(true);
    expect(status.servicios.produccion.wsfe?.ok).toBe(true);
    expect(status.servicios.produccion.wsfex?.ok).toBe(true);
    expect(status.servicios.homologacion.wsfe?.ok).toBe(true);
  });

  it("ok:false si producción WSFE reporta problemas, aunque homologación esté OK", async () => {
    stubFetchHomologacion();
    stubHttpsProduccion({ "https://servicios1.afip.gov.ar/wsfev1/service.asmx": false });
    const { getAfipStatus } = await import("../status");

    const status = await getAfipStatus();

    expect(status.ok).toBe(false);
    expect(status.servicios.produccion.wsfe?.ok).toBe(false);
    expect(status.servicios.homologacion.wsfe?.ok).toBe(true);
  });

  it("homologación caída no afecta el ok general (solo importa producción)", async () => {
    stubFetchHomologacion({ "https://wswhomo.afip.gov.ar/wsfev1/service.asmx": false });
    stubHttpsProduccion();
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
    stubHttpsProduccionDown();
    const { getAfipStatus } = await import("../status");

    const status = await getAfipStatus();

    expect(status.ok).toBe(false);
    expect(status.servicios.produccion.wsfe).toBeNull();
  });

  it("cachea el resultado 60s: la segunda llamada no vuelve a pegarle a AFIP", async () => {
    stubFetchHomologacion();
    stubHttpsProduccion();
    const { getAfipStatus } = await import("../status");
    const fetchSpy = vi.mocked(fetch);

    await getAfipStatus();
    const fetchCallsAfterFirst = fetchSpy.mock.calls.length;
    const httpsCallsAfterFirst = mockHttpsRequest.mock.calls.length;
    await getAfipStatus();

    expect(fetchSpy.mock.calls.length).toBe(fetchCallsAfterFirst);
    expect(mockHttpsRequest.mock.calls.length).toBe(httpsCallsAfterFirst);
  });
});
