/**
 * Envía un mensaje de WhatsApp vía Twilio.
 *
 * Variables de entorno requeridas:
 *   TWILIO_ACCOUNT_SID     — Account SID (empieza con "AC")
 *   TWILIO_AUTH_TOKEN      — Auth Token
 *   TWILIO_WHATSAPP_FROM   — Número de origen en formato "whatsapp:+14155238886"
 *
 * El número `to` debe incluir código de país (ej: +5491155556666).
 */
export async function sendWhatsApp(to: string, message: string): Promise<void> {
  const accountSid = process.env.TWILIO_ACCOUNT_SID;
  const authToken = process.env.TWILIO_AUTH_TOKEN;
  const from = process.env.TWILIO_WHATSAPP_FROM;

  if (!accountSid || !authToken || !from) {
    throw new Error("WhatsApp no configurado: faltan variables TWILIO_*");
  }

  const phone = to.startsWith("+") ? to : `+${to.replace(/\D/g, "")}`;

  const body = new URLSearchParams({
    From: from,
    To: `whatsapp:${phone}`,
    Body: message,
  });

  const res = await fetch(
    `https://api.twilio.com/2010-04-01/Accounts/${accountSid}/Messages.json`,
    {
      method: "POST",
      headers: {
        Authorization: `Basic ${Buffer.from(`${accountSid}:${authToken}`).toString("base64")}`,
        "Content-Type": "application/x-www-form-urlencoded",
      },
      body,
    }
  );

  if (!res.ok) {
    const err = await res.text();
    throw new Error(`Twilio error ${res.status}: ${err}`);
  }
}
