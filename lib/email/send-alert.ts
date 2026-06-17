import { Resend } from "resend";

interface SendPriceAlertParams {
  to: string;
  productTitle: string;
  url: string;
  price: number;
  targetPrice: number;
  currency: string;
}

export async function sendPriceAlertEmail(params: SendPriceAlertParams): Promise<boolean> {
  const apiKey = process.env.RESEND_API_KEY;
  const from = process.env.RESEND_FROM_EMAIL;
  if (!apiKey || !from) {
    console.warn("Resend not configured; skipping email");
    return false;
  }

  const resend = new Resend(apiKey);
  const { error } = await resend.emails.send({
    from,
    to: params.to,
    subject: `[Price Watch] Target price reached: ${params.productTitle}`,
    text: `Good news! ${params.productTitle} is now ${params.currency} ${params.price} (your target: ${params.currency} ${params.targetPrice}).\n\nView: ${params.url}`,
  });

  if (error) {
    console.error(JSON.stringify({ step: "email_error", message: error.message }));
    return false;
  }
  return true;
}
