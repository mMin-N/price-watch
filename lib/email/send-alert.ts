import { Resend } from "resend";
import type { AlertTriggerReason } from "@/lib/pipeline/evaluate-alert";
import { buildAlertMessage } from "@/lib/alert/build-alert-message";

interface SendPriceAlertParams {
  to: string;
  productTitle: string;
  url: string;
  price: number;
  currency: string;
  reason: AlertTriggerReason;
  targetPrice: number | null;
  discountAlertPercent: number | null;
  discountPercent: number | null;
  baselinePrice: number | null;
}

export async function sendPriceAlertEmail(params: SendPriceAlertParams): Promise<boolean> {
  const apiKey = process.env.RESEND_API_KEY;
  const from = process.env.RESEND_FROM_EMAIL;
  if (!apiKey || !from) {
    console.warn("Resend not configured; skipping email");
    return false;
  }

  const subjectReason =
    params.reason === "discount_percent" ? "Discount alert" : "Target price reached";

  const body = buildAlertMessage({
    currency: params.currency,
    price: params.price,
    reason: params.reason,
    targetPrice: params.targetPrice,
    discountPercent: params.discountPercent,
    discountAlertPercent: params.discountAlertPercent,
    baselinePrice: params.baselinePrice,
  });

  const resend = new Resend(apiKey);
  const { error } = await resend.emails.send({
    from,
    to: params.to,
    subject: `[Price Watch] ${subjectReason}: ${params.productTitle}`,
    text: `Good news! ${params.productTitle} — ${body}\n\nView: ${params.url}`,
  });

  if (error) {
    console.error(JSON.stringify({ step: "email_error", message: error.message }));
    return false;
  }
  return true;
}
