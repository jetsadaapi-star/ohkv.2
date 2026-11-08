import { withApi } from "@/lib/api/handler";
import { successResponse } from "@/lib/api/response";
import { isAdmin } from "@/lib/access/rbac";
import { deleteClipComment } from "@/lib/clips/clips-service";

/** DELETE /api/clips/:id/comments/:commentId — the writer, or the marketplace. */
export const DELETE = withApi<{ id: string; commentId: string }>(
  { auth: "user", rateLimit: { action: "storefront:clips:comment-delete", preset: "lenient" } },
  async ({ params, session }) =>
    successResponse(
      await deleteClipComment(params.id, params.commentId, {
        id: session.user.id,
        isAdmin: isAdmin(session.user),
      }),
    ),
);
