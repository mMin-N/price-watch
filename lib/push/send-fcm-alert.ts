import admin from "firebase-admin";
import { createAdminClient } from "@/lib/supabase/admin";

let initialized = false;

function isFirebaseConfigured(): boolean {
  return !!(
    process.env.FIREBASE_PROJECT_ID &&
    process.env.FIREBASE_CLIENT_EMAIL &&
    process.env.FIREBASE_PRIVATE_KEY
  );
}

function getMessaging(): admin.messaging.Messaging | null {
  if (!isFirebaseConfigured()) {
    return null;
  }

  if (!initialized) {
    const privateKey = process.env.FIREBASE_PRIVATE_KEY!.replace(/\\n/g, "\n");
    admin.initializeApp({
      credential: admin.credential.cert({
        projectId: process.env.FIREBASE_PROJECT_ID!,
        clientEmail: process.env.FIREBASE_CLIENT_EMAIL!,
        privateKey,
      }),
    });
    initialized = true;
  }

  return admin.messaging();
}

function isInvalidTokenError(error: unknown): boolean {
  const code =
    error && typeof error === "object" && "code" in error
      ? String((error as { code: string }).code)
      : "";
  return (
    code === "messaging/registration-token-not-registered" ||
    code === "messaging/invalid-registration-token"
  );
}

export async function sendFcmAlert({
  token,
  title,
  body,
  data,
}: {
  token: string;
  title: string;
  body: string;
  data: Record<string, string>;
}): Promise<boolean> {
  const messaging = getMessaging();
  if (!messaging) {
    console.warn("Firebase not configured; skipping FCM");
    return false;
  }

  try {
    await messaging.send({
      token,
      notification: { title, body },
      data,
    });
    return true;
  } catch (error) {
    console.error(
      JSON.stringify({
        step: "fcm_error",
        message: error instanceof Error ? error.message : String(error),
      })
    );
    return false;
  }
}

export async function sendFcmAlertsToUser(
  userId: string,
  payload: { title: string; body: string; data: Record<string, string> }
): Promise<number> {
  try {
    const messaging = getMessaging();
    if (!messaging) {
      console.warn("Firebase not configured; skipping FCM");
      return 0;
    }

    const supabase = createAdminClient();
    const { data: rows, error } = await supabase
      .from("device_tokens")
      .select("id, fcm_token")
      .eq("user_id", userId);

    if (error) {
      console.error(
        JSON.stringify({ step: "fcm_load_tokens", message: error.message })
      );
      return 0;
    }

    if (!rows?.length) {
      return 0;
    }

    let sent = 0;
    for (const row of rows) {
      try {
        await messaging.send({
          token: row.fcm_token,
          notification: { title: payload.title, body: payload.body },
          data: payload.data,
        });
        sent++;
      } catch (error) {
        if (isInvalidTokenError(error)) {
          const { error: deleteError } = await supabase
            .from("device_tokens")
            .delete()
            .eq("id", row.id);

          if (deleteError) {
            console.error(
              JSON.stringify({
                step: "fcm_delete_token",
                message: deleteError.message,
              })
            );
          }
        } else {
          console.error(
            JSON.stringify({
              step: "fcm_error",
              message: error instanceof Error ? error.message : String(error),
            })
          );
        }
      }
    }

    return sent;
  } catch (error) {
    console.error(
      JSON.stringify({
        step: "fcm_alerts_to_user",
        message: error instanceof Error ? error.message : String(error),
      })
    );
    return 0;
  }
}
