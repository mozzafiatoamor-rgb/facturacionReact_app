// ============================================================
// FACTURAPI.GS — Integración con Facturapi para timbrado CFDI
// Pega este código en tu proyecto de Google Apps Script
// ============================================================
//
// SETUP: Ve a Configuración del proyecto > Propiedades del script
// y agrega estas propiedades:
//   FACTURAPI_KEY = sk_test_xxxxx (tu API key de Facturapi)
//
// ============================================================

var FACTURAPI_BASE = 'https://www.facturapi.io/v2';

/**
 * Obtiene la API key de las propiedades del script.
 */
function getFacturapiKey_() {
  var key = PropertiesService.getScriptProperties().getProperty('FACTURAPI_KEY');
  if (!key) throw new Error('FACTURAPI_KEY no configurada en Script Properties');
  return key;
}

/**
 * Headers comunes para Facturapi.
 */
function facturApiHeaders_() {
  return {
    'Authorization': 'Bearer ' + getFacturapiKey_(),
    'Content-Type': 'application/json',
  };
}

/**
 * Mapea el tipo de pago de la app al código SAT.
 */
function mapPaymentForm_(tipoPago) {
  var map = {
    'Efectivo': '01',
    'Tarjeta Débito': '28',
    'Tarjeta Crédito': '04',
    'Transferencia': '03',
  };
  return map[tipoPago] || '99'; // 99 = Por definir
}

/**
 * Mapea el negocio al product_key del SAT.
 */
function mapProductKey_(negocio) {
  if (negocio === 'casaregina') {
    return '90111501'; // Servicios de hotelería
  }
  return '90101500'; // Servicios de restaurante y catering
}

/**
 * Mapea el negocio a la descripción del concepto.
 */
function mapProductDescription_(negocio) {
  if (negocio === 'casaregina') {
    return 'Servicio de hospedaje';
  }
  return 'Consumo de alimentos y bebidas';
}

/**
 * Crea o encuentra un cliente en Facturapi.
 * Si ya existe un cliente con ese RFC, Facturapi regresa el existente (200).
 * Si es nuevo, regresa 201.
 */
function findOrCreateCustomer_(data) {
  var payload = {
    legal_name: data.razonSocial,
    tax_id: data.rfc,
    tax_system: data.regimen.split(' - ')[0].trim(), // solo el código: "626"
    email: data.email,
    address: {
      zip: data.codigoPostal || '00000',
    },
  };

  if (data.telefono) {
    payload.phone = data.telefono;
  }

  var response = UrlFetchApp.fetch(FACTURAPI_BASE + '/customers', {
    method: 'post',
    headers: facturApiHeaders_(),
    payload: JSON.stringify(payload),
    muteHttpExceptions: true,
  });

  var code = response.getResponseCode();
  var body = JSON.parse(response.getContentText());

  if (code === 200 || code === 201) {
    return body.id;
  }

  throw new Error('Error creando cliente en Facturapi: ' + (body.message || JSON.stringify(body)));
}

/**
 * Crea y timbra una factura CFDI en Facturapi.
 */
function isPersonaMoral_(rfc) {
  // Persona moral: 12 caracteres. Persona física: 13 caracteres.
  return rfc && rfc.replace(/\s/g, '').length === 12;
}

function createInvoice_(customerId, data) {
  var monto = parseFloat(data.monto);
  var negocio = data.negocio || 'mozzafiato';
  var usoCfdi = data.usoCfdi.split(' - ')[0].trim(); // solo el código: "G03"
  var esHotel = (negocio === 'casaregina');
  var esMoral = isPersonaMoral_(data.rfc);

  // Impuestos federales
  var taxes = [{ type: 'IVA', rate: 0.16 }];

  // Retención ISR 10% solo para persona moral en hospedaje (Art. 106 LISR)
  if (esHotel && esMoral) {
    taxes.push({ type: 'ISR', rate: 0.10, withholding: true });
  }

  // Impuestos locales (ISH 4% Quintana Roo — solo hospedaje)
  var localTaxes = [];
  if (esHotel) {
    localTaxes.push({ name: 'ISH', rate: 0.04 });
  }

  var item = {
    quantity: 1,
    product: {
      description: mapProductDescription_(negocio),
      product_key: mapProductKey_(negocio),
      price: monto,
      tax_included: true,
      taxes: taxes,
    },
  };

  if (localTaxes.length > 0) {
    item.product.local_taxes = localTaxes;
  }

  var payload = {
    type: 'I', // Ingreso
    customer: customerId,
    payment_form: mapPaymentForm_(data.tipoPago),
    payment_method: 'PUE', // Pago en una sola exhibición
    use: usoCfdi,
    items: [item],
  };

  // Si hay folio/serie, agregarlo
  if (data.folioPrefix) {
    payload.series = data.folioPrefix;
  }

  var response = UrlFetchApp.fetch(FACTURAPI_BASE + '/invoices', {
    method: 'post',
    headers: facturApiHeaders_(),
    payload: JSON.stringify(payload),
    muteHttpExceptions: true,
  });

  var code = response.getResponseCode();
  var body = JSON.parse(response.getContentText());

  if (code === 200 || code === 201) {
    return body;
  }

  throw new Error('Error creando factura en Facturapi: ' + (body.message || JSON.stringify(body)));
}

/**
 * Descarga un archivo de Facturapi (PDF o XML) y lo regresa en base64.
 */
function downloadInvoiceFile_(invoiceId, format) {
  var response = UrlFetchApp.fetch(
    FACTURAPI_BASE + '/invoices/' + invoiceId + '/' + format,
    {
      method: 'get',
      headers: { 'Authorization': 'Bearer ' + getFacturapiKey_() },
      muteHttpExceptions: true,
    }
  );

  if (response.getResponseCode() !== 200) {
    throw new Error('Error descargando ' + format + ': ' + response.getContentText());
  }

  return Utilities.base64Encode(response.getContent());
}

/**
 * Envía la factura por correo electrónico al cliente.
 */
function sendInvoiceEmail_(invoiceId) {
  try {
    UrlFetchApp.fetch(
      FACTURAPI_BASE + '/invoices/' + invoiceId + '/email',
      {
        method: 'post',
        headers: facturApiHeaders_(),
        muteHttpExceptions: true,
      }
    );
  } catch (e) {
    // No lanzar error si falla el email — la factura ya se timbró
    Logger.log('Error enviando email de factura: ' + e.message);
  }
}

/**
 * Función principal: timbra una factura completa.
 * Llamada desde el frontend con action: 'timbrarFactura'.
 *
 * Recibe: { rfc, razonSocial, regimen, usoCfdi, email, codigoPostal,
 *           telefono, monto, tipoPago, negocio, folioPrefix, mesa, mesero }
 * Regresa: { success, invoiceId, uuid, pdfBase64, xmlBase64 }
 */
function timbrarFactura_(data) {
  // 1. Crear/encontrar cliente
  var customerId = findOrCreateCustomer_(data);

  // 2. Crear y timbrar factura
  var invoice = createInvoice_(customerId, data);

  // 3. Descargar PDF y XML
  var pdfBase64 = downloadInvoiceFile_(invoice.id, 'pdf');
  var xmlBase64 = downloadInvoiceFile_(invoice.id, 'xml');

  // 4. Enviar por email (async, no bloquea)
  sendInvoiceEmail_(invoice.id);

  return {
    invoiceId: invoice.id,
    uuid: invoice.uuid || '',
    folioNumber: invoice.folio_number || '',
    pdfBase64: pdfBase64,
    xmlBase64: xmlBase64,
  };
}
