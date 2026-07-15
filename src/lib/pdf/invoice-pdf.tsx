import { Document, Page, View, Text, Image, StyleSheet, renderToBuffer } from "@react-pdf/renderer";
import { CONDICION_IVA_RECEPTOR, DOC_TIPOS, type FacturaItem } from "@/lib/afip/types";

const styles = StyleSheet.create({
  page: { padding: 32, fontSize: 10, fontFamily: "Helvetica" },
  headerRow: { flexDirection: "row", justifyContent: "space-between", marginBottom: 16 },
  title: { fontSize: 16, fontWeight: 700 },
  box: { border: "1px solid #000", padding: 8, marginBottom: 12 },
  row: { flexDirection: "row", justifyContent: "space-between", marginBottom: 2 },
  label: { color: "#555" },
  sectionTitle: { fontSize: 11, fontWeight: 700, marginBottom: 6 },
  table: { marginTop: 8 },
  tableHeaderRow: {
    flexDirection: "row",
    borderBottom: "1px solid #000",
    paddingBottom: 4,
    marginBottom: 4,
    fontWeight: 700,
  },
  tableRow: { flexDirection: "row", paddingVertical: 2 },
  colDesc: { flex: 5 },
  colCant: { flex: 1, textAlign: "right" },
  colPrecio: { flex: 2, textAlign: "right" },
  colImporte: { flex: 2, textAlign: "right" },
  totalRow: {
    flexDirection: "row",
    justifyContent: "flex-end",
    marginTop: 8,
    borderTop: "1px solid #000",
    paddingTop: 6,
  },
  footer: { marginTop: 24, flexDirection: "row", justifyContent: "space-between", alignItems: "flex-end" },
  caeBox: { fontSize: 9 },
});

export interface InvoicePdfData {
  emisorCuit: string;
  emisorRazonSocial: string;
  puntoVenta: number;
  numeroComprobante: number;
  fechaEmision: string;
  clienteDocTipo: number;
  clienteDocNro: string;
  clienteNombre: string | null;
  condicionIvaReceptorId: number;
  items: FacturaItem[];
  importeTotal: number;
  cae: string;
  caeVencimiento: string;
  qrDataUrl: string;
}

function fmtMoney(n: number): string {
  return n.toLocaleString("es-AR", { minimumFractionDigits: 2, maximumFractionDigits: 2 });
}

function docTipoLabel(value: number): string {
  return DOC_TIPOS.find((d) => d.value === value)?.label ?? String(value);
}

function condicionIvaLabel(value: number): string {
  return CONDICION_IVA_RECEPTOR.find((c) => c.value === value)?.label ?? String(value);
}

function InvoiceDocument(data: InvoicePdfData) {
  return (
    <Document>
      <Page size="A4" style={styles.page}>
        <View style={styles.headerRow}>
          <View>
            <Text style={styles.title}>{data.emisorRazonSocial || "Factura C"}</Text>
            <Text>CUIT: {data.emisorCuit}</Text>
            <Text>Condición frente al IVA: Responsable Monotributo</Text>
          </View>
          <View style={{ alignItems: "flex-end" }}>
            <Text style={{ fontSize: 14, fontWeight: 700 }}>FACTURA C</Text>
            <Text>
              N° {String(data.puntoVenta).padStart(5, "0")}-
              {String(data.numeroComprobante).padStart(8, "0")}
            </Text>
            <Text>Fecha de emisión: {data.fechaEmision}</Text>
          </View>
        </View>

        <View style={styles.box}>
          <Text style={styles.sectionTitle}>Cliente</Text>
          {data.clienteNombre && <Text>{data.clienteNombre}</Text>}
          <View style={styles.row}>
            <Text style={styles.label}>{docTipoLabel(data.clienteDocTipo)}</Text>
            <Text>{data.clienteDocTipo === 99 ? "Consumidor Final" : data.clienteDocNro}</Text>
          </View>
          <View style={styles.row}>
            <Text style={styles.label}>Condición frente al IVA</Text>
            <Text>{condicionIvaLabel(data.condicionIvaReceptorId)}</Text>
          </View>
        </View>

        <View style={styles.table}>
          <View style={styles.tableHeaderRow}>
            <Text style={styles.colDesc}>Descripción</Text>
            <Text style={styles.colCant}>Cant.</Text>
            <Text style={styles.colPrecio}>Precio unit.</Text>
            <Text style={styles.colImporte}>Importe</Text>
          </View>
          {data.items.map((item, i) => (
            <View key={i} style={styles.tableRow}>
              <Text style={styles.colDesc}>{item.descripcion}</Text>
              <Text style={styles.colCant}>{item.cantidad}</Text>
              <Text style={styles.colPrecio}>${fmtMoney(item.precioUnitario)}</Text>
              <Text style={styles.colImporte}>
                ${fmtMoney(item.cantidad * item.precioUnitario)}
              </Text>
            </View>
          ))}
        </View>

        <View style={styles.totalRow}>
          <Text style={{ fontWeight: 700 }}>Total: ${fmtMoney(data.importeTotal)}</Text>
        </View>

        <View style={styles.footer}>
          <View style={styles.caeBox}>
            <Text>CAE: {data.cae}</Text>
            <Text>Vencimiento CAE: {data.caeVencimiento}</Text>
          </View>
          {/* eslint-disable-next-line jsx-a11y/alt-text */}
          <Image src={data.qrDataUrl} style={{ width: 90, height: 90 }} />
        </View>
      </Page>
    </Document>
  );
}

export async function renderInvoicePdf(data: InvoicePdfData): Promise<Buffer> {
  return renderToBuffer(InvoiceDocument(data));
}
