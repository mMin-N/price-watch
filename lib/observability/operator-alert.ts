import { Resend } from "resend";

export async function sendOperatorAlert(subject: string, body: string): Promise<void> {
  const email = process.env.OPERATOR_ALERT_EMAIL;
  const slackUrl = process.env.SLACK_WEBHOOK_URL;

  const tasks: Promise<unknown>[] = [];

  if (email && process.env.RESEND_API_KEY) {
    const resend = new Resend(process.env.RESEND_API_KEY);
    const from = process.env.RESEND_FROM_EMAIL ?? "alerts@example.com";
    tasks.push(
      resend.emails
        .send({
          from,
          to: email,
          subject: `[Dropt] ${subject}`,
          text: body,
        })
        .catch((err) => {
          console.error(JSON.stringify({ step: "operator_alert_email_failed", error: String(err) }));
        })
    );
  }

  if (slackUrl) {
    tasks.push(
      fetch(slackUrl, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ text: `*[Dropt]* ${subject}\n${body}` }),
      }).catch((err) => {
        console.error(JSON.stringify({ step: "operator_alert_slack_failed", error: String(err) }));
      })
    );
  }

  if (tasks.length === 0) {
    console.warn(JSON.stringify({ step: "operator_alert_skipped", subject, body }));
    return;
  }

  await Promise.all(tasks);
}
