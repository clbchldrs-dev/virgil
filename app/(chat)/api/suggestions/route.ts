import { auth } from "@/app/(auth)/auth";
import { getSuggestionsByDocumentId } from "@/lib/db/queries";
import { VirgilError } from "@/lib/errors";
import { suggestionWrongOwnerVirgilError } from "@/lib/security/idor";

export async function GET(request: Request) {
  const { searchParams } = new URL(request.url);
  const documentId = searchParams.get("documentId");

  if (!documentId) {
    return new VirgilError(
      "bad_request:api",
      "Parameter documentId is required."
    ).toResponse();
  }

  const session = await auth();

  if (!session?.user) {
    return new VirgilError("unauthorized:suggestions").toResponse();
  }

  const suggestions = await getSuggestionsByDocumentId({
    documentId,
  });

  const [suggestion] = suggestions;

  if (!suggestion) {
    return Response.json([], { status: 200 });
  }

  const rowErr = suggestionWrongOwnerVirgilError(suggestion, session.user.id);
  if (rowErr) {
    return rowErr.toResponse();
  }

  return Response.json(suggestions, { status: 200 });
}
