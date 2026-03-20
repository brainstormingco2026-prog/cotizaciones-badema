/**
 * Datos simulados de Contabilium para desarrollo sin credenciales.
 * Set de datos real de /api/comprobantes/search (TipoFc: "COT") - 14 cotizaciones.
 */

export type MockQuotation = {
  Id: number;
  IdCliente?: number;
  RazonSocial?: string;
  Email?: string;
  Telefono?: string;
  FechaAlta?: string;
  FechaEmision?: string;
  Numero?: string;
  TipoFc?: string;
  ImporteTotalNeto?: string;
  ImporteTotalBruto?: string;
  CondicionVenta?: string;
  Observaciones?: string;
  IDVendedor?: number;
  Estado?: string;
  Cliente?: { Id: number; RazonSocial: string; Email?: string; Telefono?: string };
  [k: string]: unknown;
};

const MOCK_ITEMS_COT: MockQuotation[] = [
  { Id: 73484633, IdCliente: 46182871, RazonSocial: "PEPAS", Email: "pepas@ejemplo.com", Telefono: "5491123456789", FechaAlta: "2023-04-05T15:28:34.773", FechaEmision: "2023-04-05T00:00:00", Numero: "0002-00000001", TipoFc: "COT", ImporteTotalNeto: "2.000,00", ImporteTotalBruto: "1.652,89", CondicionVenta: "Prueba 5", Observaciones: "COMPRA PRUEBA", IDVendedor: 19531 },
  { Id: 73484903, IdCliente: 46183286, RazonSocial: "PEPA1", Email: "pepa1@ejemplo.com", Telefono: "5491187654321", FechaAlta: "2023-04-05T15:30:28.37", FechaEmision: "2023-04-05T00:00:00", Numero: "0002-00000002", TipoFc: "COT", ImporteTotalNeto: "2.500,00", ImporteTotalBruto: "2.066,12", CondicionVenta: "Prueba 1", Observaciones: "30 días de cambio", IDVendedor: 19531 },
  { Id: 73485848, IdCliente: 46183287, RazonSocial: "PEPA2", Telefono: "5491199998888", FechaAlta: "2023-04-05T15:36:42.343", FechaEmision: "2023-04-05T00:00:00", Numero: "0002-00000003", TipoFc: "COT", ImporteTotalNeto: "1.000,00", ImporteTotalBruto: "826,45", CondicionVenta: "Prueba 1", Observaciones: "30 días de cambio", IDVendedor: 19531 },
  { Id: 73780592, IdCliente: 46182871, RazonSocial: "PEPAS", FechaAlta: "2023-04-10T12:22:22.567", FechaEmision: "2023-04-10T00:00:00", Numero: "0002-00000004", TipoFc: "COT", ImporteTotalNeto: "1.000,00", ImporteTotalBruto: "826,45", CondicionVenta: "Cuenta corriente", Observaciones: "30 días de cambio", IDVendedor: 0 },
  { Id: 73781116, IdCliente: 46182871, RazonSocial: "PEPAS", FechaAlta: "2023-04-10T12:25:12.13", FechaEmision: "2023-04-10T00:00:00", Numero: "0002-00000005", TipoFc: "COT", ImporteTotalNeto: "500,00", ImporteTotalBruto: "413,22", CondicionVenta: "Cuenta corriente", Observaciones: "30 días de cambio", IDVendedor: 0 },
  { Id: 73851014, IdCliente: 46482495, RazonSocial: "PATO PEPA", FechaAlta: "2023-04-11T09:30:04.683", FechaEmision: "2023-04-11T00:00:00", Numero: "0002-00000006", TipoFc: "COT", ImporteTotalNeto: "1.800,00", ImporteTotalBruto: "1.487,60", CondicionVenta: "Prueba 1", Observaciones: "30 días de cambio", IDVendedor: 19531 },
  { Id: 73851163, IdCliente: 46482495, RazonSocial: "PATO PEPA", FechaAlta: "2023-04-11T09:31:32.117", FechaEmision: "2023-04-11T00:00:00", Numero: "0002-00000007", TipoFc: "COT", ImporteTotalNeto: "1.000,00", ImporteTotalBruto: "826,45", CondicionVenta: "Prueba 1", Observaciones: "30 días de cambio", IDVendedor: 19532 },
  { Id: 73861717, IdCliente: 46488310, RazonSocial: "CONSUMIDOR FINAL", FechaAlta: "2023-04-11T11:00:22.58", FechaEmision: "2023-04-11T00:00:00", Numero: "0002-00000008", TipoFc: "COT", ImporteTotalNeto: "500,00", ImporteTotalBruto: "413,22", CondicionVenta: "Efectivo", Observaciones: " Factura de los productos que el cliente se lleva por un CAMBIO", IDVendedor: 19532 },
  { Id: 74027034, IdCliente: 46488310, RazonSocial: "CONSUMIDOR FINAL", FechaAlta: "2023-04-13T09:42:40.793", FechaEmision: "2023-04-13T00:00:00", Numero: "0002-00000009", TipoFc: "COT", ImporteTotalNeto: "1.000,00", ImporteTotalBruto: "826,45", CondicionVenta: "Efectivo", Observaciones: " Factura de los productos que el cliente se lleva por un CAMBIO", IDVendedor: 19532 },
  { Id: 74956376, IdCliente: 46488310, RazonSocial: "CONSUMIDOR FINAL", FechaAlta: "2023-04-24T17:24:55.623", FechaEmision: "2023-04-24T00:00:00", Numero: "0002-00000010", TipoFc: "COT", ImporteTotalNeto: "35.000,00", ImporteTotalBruto: "28.925,62", CondicionVenta: "Efectivo", Observaciones: "30 días de cambio", IDVendedor: 0 },
  { Id: 76303418, IdCliente: 46488310, RazonSocial: "CONSUMIDOR FINAL", FechaAlta: "2023-05-10T09:12:00.923", FechaEmision: "2023-05-10T00:00:00", Numero: "0002-00000011", TipoFc: "COT", ImporteTotalNeto: "2.500,00", ImporteTotalBruto: "2.066,12", CondicionVenta: "Efectivo", Observaciones: "30 días de cambio", IDVendedor: 19532 },
  { Id: 76303872, IdCliente: 46488310, RazonSocial: "CONSUMIDOR FINAL", FechaAlta: "2023-05-10T09:15:01.37", FechaEmision: "2023-05-10T00:00:00", Numero: "0002-00000012", TipoFc: "COT", ImporteTotalNeto: "1.100,00", ImporteTotalBruto: "909,09", CondicionVenta: "Efectivo", Observaciones: "30 días de cambio", IDVendedor: 19532 },
  { Id: 76593603, IdCliente: 46488310, RazonSocial: "CONSUMIDOR FINAL", FechaAlta: "2023-05-12T16:51:22.733", FechaEmision: "2023-05-12T00:00:00", Numero: "0002-00000013", TipoFc: "COT", ImporteTotalNeto: "4.840,00", ImporteTotalBruto: "4.000,00", CondicionVenta: "Prueba 1", Observaciones: "Creado desde API", IDVendedor: 0 },
  { Id: 76598366, IdCliente: 46488310, RazonSocial: "CONSUMIDOR FINAL", FechaAlta: "2023-05-12T17:22:32.217", FechaEmision: "2023-05-12T00:00:00", Numero: "0002-00000014", TipoFc: "COT", ImporteTotalNeto: "242,00", ImporteTotalBruto: "200,00", CondicionVenta: "Cuenta corriente", Observaciones: "Creado desde API", IDVendedor: 0 },
];

/**
 * Devuelve las 14 cotizaciones mock (formato API Contabilium TipoFc "COT").
 */
export function getMockQuotations(): MockQuotation[] {
  return MOCK_ITEMS_COT;
}
