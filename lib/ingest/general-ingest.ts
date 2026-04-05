import "server-only";

import { saveMemoryRecord } from "@/lib/db/queries";
import {
  mapIngestTypeToMemoryKind,
  type VirgilGeneralIngestBody,
} from "@/lib/ingest/virgil-general-ingest-schema";

export function persistGeneralIngest({
  userId,
  body,
}: {
  userId: string;
  body: VirgilGeneralIngestBody;
}) {
  const kind = mapIngestTypeToMemoryKind(body.type);
  const metadata: Record<string, unknown> = {
    ...(body.metadata ?? {}),
    source: body.source,
    ingestType: body.type,
  };
  return saveMemoryRecord({
    userId,
    kind,
    content: body.content,
    metadata,
  });
}
