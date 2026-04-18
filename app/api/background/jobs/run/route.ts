import { Receiver } from "@upstash/qstash";
import { processBackgroundJobById } from "@/lib/background-jobs/process-job";
import { handleBackgroundJobsRunPost } from "@/lib/reliability/background-job-run-handler";

export const maxDuration = 120;

export function POST(request: Request) {
  const currentSigningKey = process.env.QSTASH_CURRENT_SIGNING_KEY;
  const nextSigningKey = process.env.QSTASH_NEXT_SIGNING_KEY;
  return handleBackgroundJobsRunPost(request, {
    hasSigningKeys: () => Boolean(currentSigningKey && nextSigningKey),
    verifySignature: ({ body, signature }) => {
      if (!(currentSigningKey && nextSigningKey)) {
        return Promise.resolve(false);
      }
      const receiver = new Receiver({
        currentSigningKey,
        nextSigningKey,
      });
      return receiver.verify({ body, signature });
    },
    processJobById: processBackgroundJobById,
  });
}
