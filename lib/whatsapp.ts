/**
 * Envía un mensaje de WhatsApp vía CallMeBot.
 *
 * Cada vendedor debe activar su número una sola vez:
 * 1. Agregar +34 644 59 39 84 a sus contactos
 * 2. Enviar el mensaje: "I allow callmebot to send me messages"
 * 3. Recibirá su API key por WhatsApp
 * 4. Cargar esa API key en el CRM (sección Vendedores)
 *
 * El número `to` debe estar en formato internacional con + (ej: +5493517604973).
 * El `apiKey` es el key personal que CallMeBot le envió al vendedor.
 */
export async function sendWhatsApp(to: string, message: string, apiKey: string): Promise<void> {
  if (!apiKey) {
    throw new Error("CallMeBot API key no configurada para este vendedor");
  }

  const phone = to.startsWith("+") ? to : `+${to.replace(/\D/g, "")}`;

  const url = new URL("https://api.callmebot.com/whatsapp.php");
  url.searchParams.set("phone", phone);
  url.searchParams.set("text", message);
  url.searchParams.set("apikey", apiKey);

  const res = await fetch(url.toString());

  if (!res.ok) {
    const err = await res.text();
    throw new Error(`CallMeBot error ${res.status}: ${err}`);
  }
}
