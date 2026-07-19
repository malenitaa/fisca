import { describe, it, expect, vi, afterEach } from "vitest";
import { EventEmitter } from "node:events";
import type { Agent } from "node:https";

const { mockHttpsRequest } = vi.hoisted(() => ({ mockHttpsRequest: vi.fn() }));

vi.mock("node:https", async (importOriginal) => {
  const actual = await importOriginal<typeof import("node:https")>();
  return { ...actual, request: mockHttpsRequest };
});

const { callWsfeSoap } = await import("../soap");

afterEach(() => {
  vi.unstubAllGlobals();
  mockHttpsRequest.mockReset();
});

const OK_RESPONSE = `<?xml version="1.0"?>
<soapenv:Envelope xmlns:soapenv="http://schemas.xmlsoap.org/soap/envelope/">
  <soapenv:Body><ok/></soapenv:Body>
</soapenv:Envelope>`;

interface CapturedHttpsCall {
  url: string;
  options: { method: string; agent: Agent; headers: Record<string, string> };
}

/** Simula un https.request exitoso y devuelve las llamadas capturadas. */
function stubHttpsRequestSuccess(): CapturedHttpsCall[] {
  const calls: CapturedHttpsCall[] = [];
  mockHttpsRequest.mockImplementation(
    (url: string, options: CapturedHttpsCall["options"], callback: (res: EventEmitter & { statusCode: number }) => void) => {
      calls.push({ url, options });
      const res = Object.assign(new EventEmitter(), { statusCode: 200 });
      queueMicrotask(() => {
        callback(res);
        res.emit("data", Buffer.from(OK_RESPONSE));
        res.emit("end");
      });
      return Object.assign(new EventEmitter(), { write: vi.fn(), end: vi.fn() });
    }
  );
  return calls;
}

function stubFetchSuccess() {
  const fetchMock = vi.fn(async () => new Response(OK_RESPONSE, { status: 200 }));
  vi.stubGlobal("fetch", fetchMock);
  return fetchMock;
}

describe("callWsfeSoap — TLS legacy scoping", () => {
  it("usa node:https con SECLEVEL=1 para servicios1.afip.gov.ar (WSFEv1 y WSFEXv1 de producción)", async () => {
    const httpsCalls = stubHttpsRequestSuccess();
    const fetchMock = stubFetchSuccess();

    await callWsfeSoap({
      endpoint: "https://servicios1.afip.gov.ar/wsfev1/service.asmx",
      soapAction: "x",
      body: "<ar:X/>",
    });
    await callWsfeSoap({
      endpoint: "https://servicios1.afip.gov.ar/wsfexv1/service.asmx",
      soapAction: "x",
      body: "<ar:X/>",
    });

    expect(httpsCalls).toHaveLength(2);
    expect(httpsCalls[0].options.agent.options.ciphers).toBe("DEFAULT@SECLEVEL=1");
    expect(httpsCalls[1].options.agent.options.ciphers).toBe("DEFAULT@SECLEVEL=1");
    expect(fetchMock).not.toHaveBeenCalled();
  });

  it("reutiliza la misma instancia de Agent entre llamadas a producción", async () => {
    const httpsCalls = stubHttpsRequestSuccess();
    stubFetchSuccess();

    await callWsfeSoap({
      endpoint: "https://servicios1.afip.gov.ar/wsfev1/service.asmx",
      soapAction: "x",
      body: "<ar:X/>",
    });
    await callWsfeSoap({
      endpoint: "https://servicios1.afip.gov.ar/wsfexv1/service.asmx",
      soapAction: "x",
      body: "<ar:X/>",
    });

    expect(httpsCalls[0].options.agent).toBe(httpsCalls[1].options.agent);
  });

  it.each([
    ["homologación WSFEv1", "https://wswhomo.afip.gov.ar/wsfev1/service.asmx"],
    ["homologación WSFEXv1", "https://wswhomo.afip.gov.ar/wsfexv1/service.asmx"],
    ["WSAA producción", "https://wsaa.afip.gov.ar/ws/services/LoginCms"],
    ["WSAA homologación", "https://wsaahomo.afip.gov.ar/ws/services/LoginCms"],
    ["host arbitrario (Supabase)", "https://tujoniyojrisiwtkjmse.supabase.co/rest/v1/algo"],
  ])("NO relaja TLS para %s — sigue usando fetch normal", async (_label, endpoint) => {
    stubHttpsRequestSuccess();
    const fetchMock = stubFetchSuccess();

    await callWsfeSoap({ endpoint, soapAction: "x", body: "<ar:X/>" });

    expect(mockHttpsRequest).not.toHaveBeenCalled();
    expect(fetchMock).toHaveBeenCalledOnce();
  });
});
