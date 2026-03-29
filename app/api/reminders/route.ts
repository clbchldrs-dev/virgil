import { Receiver } from "@upstash/qstash";
import { Resend } from "resend";
import { getUserById, saveMemoryRecord } from "@/lib/db/queries";

const receiver = new Receiver({
  currentSigningKey: process.env.QSTASH_CURRENT_SIGNING_KEY!,
  nextSigningKey: process.env.QSTASH_NEXT_SIGNING_KEY!,
});

const resend = new Resend(process.env.RESEND_API_KEY);

export async function POST(request: Request) {
  const body = await request.text();
  const signature = request.headers.get("upstash-signature");

  if (!signature) {
    return new Response("Missing signature", { status: 401 });
  }

  const isValid = await receiver.verify({ body, signature }).catch(() => false);
  if (!isValid) {
    return new Response("Invalid signature", { status: 401 });
  }

  const payload = JSON.parse(body) as {
    userId: string;
    chatId: string;
    message: string;
    scheduledFor: string;
  };

  let emailSent = false;
  const owner = await getUserById({ id: payload.userId });
  const userEmail = owner?.email;

  if (userEmail && !userEmail.startsWith("guest-")) {
    try {
      await resend.emails.send({
        from: "Assistant <onboarding@resend.dev>",
        to: userEmail,
        subject: `Reminder: ${payload.message.slice(0, 60)}`,
        text: `Hey — you asked me to remind you:\n\n${payload.message}\n\n(Originally scheduled for ${payload.scheduledFor})`,
      });
      emailSent = true;
    } catch (error) {
      console.error(`Reminder email failed for user ${payload.userId}:`, error);
    }
  }

  await saveMemoryRecord({
    userId: payload.userId,
    chatId: payload.chatId,
    kind: "note",
    content: `Reminder delivered: ${payload.message}`,
    metadata: {
      type: "reminder-delivered",
      scheduledFor: payload.scheduledFor,
      emailSent,
    },
  });

  return new Response("OK", { status: 200 });
}
