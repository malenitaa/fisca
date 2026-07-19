import forge from "node-forge";

/**
 * Genera un par de claves RSA-2048 y un CSR (PKCS#10) firmado con la clave
 * privada. El CSR es lo que la usuaria sube al portal de ARCA para que se
 * lo firmen y le devuelvan el .crt.
 *
 * Formato del subject requerido por ARCA:
 *   CN = <alias/razon social> (o CUIT si no hay alias)
 *   serialNumber = "CUIT <cuit>"
 *   C = AR
 *   O = <razon social o alias>
 */
export interface GeneratedCsr {
  privateKeyPem: string;
  csrPem: string;
}

export function generateCsr(params: {
  cuit: string;
  razonSocial?: string | null;
}): GeneratedCsr {
  const cuit = params.cuit.replace(/\D/g, "");
  if (cuit.length !== 11) {
    throw new Error("El CUIT debe tener 11 dígitos.");
  }
  const org = params.razonSocial?.trim() || `Contribuyente ${cuit}`;

  const keys = forge.pki.rsa.generateKeyPair({ bits: 2048, e: 0x10001 });

  const csr = forge.pki.createCertificationRequest();
  csr.publicKey = keys.publicKey;
  csr.setSubject([
    { name: "countryName", value: "AR" },
    { name: "organizationName", value: org },
    { name: "commonName", value: org.slice(0, 64) },
    { name: "serialName", type: "2.5.4.5", value: `CUIT ${cuit}` },
  ]);
  csr.sign(keys.privateKey, forge.md.sha256.create());

  const csrPem = forge.pki.certificationRequestToPem(csr);
  const privateKeyPem = forge.pki.privateKeyToPem(keys.privateKey);

  return { privateKeyPem, csrPem };
}

/**
 * Verifica que el .crt firmado por ARCA sea el que corresponde a la clave
 * privada que teníamos guardada. Comparamos los modulus RSA de ambos.
 */
export function certificateMatchesKey(certPem: string, privateKeyPem: string): boolean {
  try {
    const cert = forge.pki.certificateFromPem(certPem);
    const key = forge.pki.privateKeyFromPem(privateKeyPem) as forge.pki.rsa.PrivateKey;
    const certPubKey = cert.publicKey as forge.pki.rsa.PublicKey;
    return certPubKey.n.equals(key.n);
  } catch {
    return false;
  }
}
