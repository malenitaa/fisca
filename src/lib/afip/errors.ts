/**
 * Error de negocio proveniente de AFIP/ARCA (WSAA o WSFEv1). El mensaje es
 * siempre el motivo real devuelto por el webservice, nunca un texto genérico,
 * para poder mostrárselo tal cual al usuario.
 */
export class AfipError extends Error {
  code?: string;

  constructor(message: string, code?: string) {
    super(message);
    this.name = "AfipError";
    this.code = code;
  }
}
