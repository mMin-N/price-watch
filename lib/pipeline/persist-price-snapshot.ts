import type { SupabaseClient } from "@supabase/supabase-js";
import type { PriceFetchResult } from "@/lib/providers/price-provider";
import { APP_CURRENCY } from "@/lib/providers/normalize-price";
import { buildAlertMessage } from "@/lib/alert/build-alert-message";
import { resolveAlertActiveState } from "@/lib/alert/resolve-alert-active-state";
import { evaluateAlert } from "./evaluate-alert";
import { sendPriceAlertEmail } from "@/lib/email/send-alert";
import { sendFcmAlertsToUser } from "@/lib/push/send-fcm-alert";
import { availabilityFromFetch } from "@/lib/alert/compute-alert-active";
import {
  acquirePipelineLock,
  releasePipelineLock,
} from "./pipeline-lock";

export async function persistPriceSnapshot(
  supabase: SupabaseClient,
  trackedProductId: string,
  fetchResult: PriceFetchResult,
  correlationId: string,
  providerName = "zenrows"
) {
  await acquirePipelineLock(supabase, trackedProductId);

  try {
    return await persistPriceSnapshotLocked(
      supabase,
      trackedProductId,
      fetchResult,
      correlationId,
      providerName
    );
  } finally {
    await releasePipelineLock(supabase, trackedProductId);
  }
}

async function persistPriceSnapshotLocked(
  supabase: SupabaseClient,
  trackedProductId: string,
  fetchResult: PriceFetchResult,
  correlationId: string,
  providerName: string
) {
  const price = fetchResult.price;
  const currency = APP_CURRENCY;

  const { data: product, error: loadError } = await supabase
    .from("tracked_products")
    .select(
      "id, user_id, url, target_price, discount_alert_percent, baseline_price, title, target_price_alert_active, discount_alert_active"
    )
    .eq("id", trackedProductId)
    .single();

  if (loadError || !product) throw new Error("Tracked product not found");

  const baselinePrice = product.baseline_price ?? price;

  const { data: history, error: historyError } = await supabase
    .from("price_history")
    .insert({
      tracked_product_id: product.id,
      price,
      currency,
      provider: providerName,
    })
    .select("id")
    .single();

  if (historyError || !history) {
    throw new Error(historyError?.message ?? "Failed to insert price history");
  }
  console.log(
    JSON.stringify({ step: "db_write", correlationId, priceHistoryId: history.id, success: true })
  );

  const title = fetchResult.title ?? product.title;
  const availabilityStatus = availabilityFromFetch(fetchResult.isAvailable);
  const skipAlerts = fetchResult.isAvailable === false;

  const evaluation = skipAlerts
    ? { triggered: false, reason: null, discountPercent: null }
    : evaluateAlert(price, product.discount_alert_percent, baselinePrice);

  const alertState = skipAlerts
    ? {
        targetPriceAlertActive: false,
        discountAlertActive: product.discount_alert_active,
        shouldNotify: false,
      }
    : resolveAlertActiveState(
        price,
        product.discount_alert_percent,
        baselinePrice,
        product.discount_alert_active,
        evaluation
      );

  const { error: updateError } = await supabase
    .from("tracked_products")
    .update({
      last_price: price,
      last_fetched_at: new Date().toISOString(),
      currency,
      baseline_price: product.baseline_price ?? price,
      availability_status: availabilityStatus,
      target_price_alert_active: alertState.targetPriceAlertActive,
      discount_alert_active: alertState.discountAlertActive,
      consecutive_failures: 0,
      ...(title ? { title } : {}),
    })
    .eq("id", product.id);

  if (updateError) {
    throw new Error(`Failed to update tracked product: ${updateError.message}`);
  }

  console.log(
    JSON.stringify({
      step: "alert_eval",
      correlationId,
      targetPrice: product.target_price,
      discountAlertPercent: product.discount_alert_percent,
      baselinePrice,
      currentPrice: price,
      triggered: evaluation.triggered,
      reason: evaluation.reason,
      discountPercent: evaluation.discountPercent,
      shouldNotify: alertState.shouldNotify,
    })
  );

  if (!alertState.shouldNotify || !evaluation.reason) {
    return { price, currency, alerted: false, availabilityStatus };
  }

  const message = buildAlertMessage({
    currency,
    price,
    discountPercent: evaluation.discountPercent,
    discountAlertPercent: product.discount_alert_percent,
    baselinePrice,
  });

  const { data: notification, error: notificationError } = await supabase
    .from("notifications")
    .insert({
      user_id: product.user_id,
      tracked_product_id: product.id,
      message,
    })
    .select("id")
    .single();

  if (notificationError || !notification) {
    throw new Error(notificationError?.message ?? "Failed to insert notification");
  }

  const subjectReason = "Price drop";
  const fcmPromise = sendFcmAlertsToUser(product.user_id, {
    title: `[Dropt] ${subjectReason}`,
    body: message,
    data: {
      productId: product.id,
      notificationId: notification.id,
    },
  });

  const { data: profile, error: profileError } = await supabase
    .from("profiles")
    .select("email")
    .eq("id", product.user_id)
    .single();

  if (profileError) {
    throw new Error(`Failed to load profile: ${profileError.message}`);
  }

  const { error: alertLogError } = await supabase.from("alert_logs").insert({
    tracked_product_id: product.id,
    price_history_id: history.id,
    triggered_price: price,
    target_price: product.target_price,
    trigger_reason: evaluation.reason,
    discount_percent: evaluation.discountPercent,
    email_sent: false,
  });

  if (alertLogError) {
    throw new Error(`Failed to insert alert log: ${alertLogError.message}`);
  }

  let emailSent = false;
  if (profile?.email) {
    emailSent = await sendPriceAlertEmail({
      to: profile.email,
      productTitle: title ?? product.url,
      url: product.url,
      price,
      currency,
      reason: evaluation.reason,
      targetPrice: product.target_price,
      discountAlertPercent: product.discount_alert_percent,
      discountPercent: evaluation.discountPercent,
      baselinePrice,
    });

    const { error: emailFlagError } = await supabase
      .from("alert_logs")
      .update({ email_sent: emailSent })
      .eq("price_history_id", history.id);

    if (emailFlagError) {
      console.error(
        JSON.stringify({
          step: "alert_log_email_flag",
          correlationId,
          error: emailFlagError.message,
        })
      );
    }
  }

  const fcmSent = await fcmPromise;

  console.log(
    JSON.stringify({
      step: "notify",
      correlationId,
      notificationId: notification.id,
      emailSent,
      fcmSent,
    })
  );

  return { price, currency, alerted: true, availabilityStatus };
}
