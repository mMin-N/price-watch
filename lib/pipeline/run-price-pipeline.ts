import type { SupabaseClient } from "@supabase/supabase-js";
import type { PriceProvider } from "@/lib/providers/price-provider";
import { shouldTriggerAlert } from "./evaluate-alert";
import { sendPriceAlertEmail } from "@/lib/email/send-alert";

export async function runPricePipeline(
  supabase: SupabaseClient,
  trackedProductId: string,
  provider: PriceProvider
) {
  const correlationId = `${trackedProductId}-${Date.now()}`;

  const { data: product, error: loadError } = await supabase
    .from("tracked_products")
    .select("id, user_id, url, target_price, title")
    .eq("id", trackedProductId)
    .single();

  if (loadError || !product) throw new Error("Tracked product not found");
  console.log(JSON.stringify({ step: "input", correlationId, url: product.url, userId: product.user_id }));

  const { price, currency } = await provider.fetchPrice(product.url);

  const { data: history, error: historyError } = await supabase
    .from("price_history")
    .insert({
      tracked_product_id: product.id,
      price,
      currency,
      provider: "zenrows",
    })
    .select("id")
    .single();

  if (historyError || !history) throw new Error("Failed to insert price history");
  console.log(JSON.stringify({ step: "db_write", correlationId, priceHistoryId: history.id, success: true }));

  await supabase
    .from("tracked_products")
    .update({ last_price: price, last_fetched_at: new Date().toISOString(), currency })
    .eq("id", product.id);

  const triggered = shouldTriggerAlert(price, product.target_price);
  console.log(JSON.stringify({
    step: "alert_eval",
    correlationId,
    targetPrice: product.target_price,
    currentPrice: price,
    triggered,
  }));

  if (!triggered) return { price, currency, alerted: false };

  const { data: existingAlert } = await supabase
    .from("alert_logs")
    .select("id")
    .eq("price_history_id", history.id)
    .maybeSingle();

  if (existingAlert) return { price, currency, alerted: false };

  const message = `Price dropped to ${currency} ${price} (target: ${product.target_price})`;
  const { data: notification } = await supabase
    .from("notifications")
    .insert({
      user_id: product.user_id,
      tracked_product_id: product.id,
      message,
    })
    .select("id")
    .single();

  const { data: profile } = await supabase
    .from("profiles")
    .select("email")
    .eq("id", product.user_id)
    .single();

  let emailSent = false;
  if (profile?.email) {
    emailSent = await sendPriceAlertEmail({
      to: profile.email,
      productTitle: product.title ?? product.url,
      url: product.url,
      price,
      targetPrice: product.target_price!,
      currency,
    });
  }

  await supabase.from("alert_logs").insert({
    tracked_product_id: product.id,
    price_history_id: history.id,
    triggered_price: price,
    target_price: product.target_price!,
    email_sent: emailSent,
  });

  console.log(JSON.stringify({ step: "notify", correlationId, notificationId: notification?.id, emailSent }));

  return { price, currency, alerted: true };
}
