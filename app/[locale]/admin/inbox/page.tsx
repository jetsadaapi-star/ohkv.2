import { Inbox, Settings2 } from "lucide-react";
import Link from "@/components/language/link";
import { getTranslations, setRequestLocale } from "next-intl/server";
import { requireAdminPageAccess } from "@/lib/access/admin-page-guard";
import { ConversationInbox } from "@/components/chat/inbox/conversation-inbox";
import { InboxStatusChips } from "@/components/chat/inbox/inbox-status-chips";
import { VendorPageHeader } from "@/components/vendor/vendor-page-header";
import { Button } from "@/components/ui/button";
import { connectDB } from "@/lib/db";
import { listConversations } from "@/lib/conversations/service";
import { tryResolveConversationViewer } from "@/lib/conversations/viewer";

interface PageProps {
  params: Promise<{ locale: string }>;
  searchParams: Promise<{ [key: string]: string | string[] | undefined }>;
}

export default async function AdminInboxPage({ params, searchParams }: PageProps) {
  const { locale } = await params;
  const search = await searchParams;
  setRequestLocale(locale);

  const session = await requireAdminPageAccess(locale);
  const t = await getTranslations({ locale, namespace: "admin.inboxPage" });
  const chatT = await getTranslations({ locale, namespace: "chat" });
  const chatLabel = (key: string, fallback: string) =>
    chatT.has(key) ? chatT(key as never) : fallback;
  const selectedConversationId =
    typeof search.conversation === "string" ? search.conversation : undefined;

  await connectDB();
  const viewer = await tryResolveConversationViewer({ session });
  const conversations = viewer
    ? (await listConversations({ viewer, limit: 100 })).conversations
    : [];

  return (
    <div className="flex min-h-0 flex-col gap-4 [--inbox-offset:7.5rem] max-md:[--inbox-offset:10rem]">
      <VendorPageHeader
        icon={<Inbox />}
        tone="sky"
        title={t("title")}
        description={t("subtitle")}
        actions={
          <>
            <InboxStatusChips locale={locale} conversations={conversations} />
            <Button asChild variant="outline" size="sm" className="rounded-full">
              <Link href="/admin/settings/messaging">
                <Settings2 />
                {chatLabel("channels", "Channels")}
              </Link>
            </Button>
          </>
        }
      />

      <ConversationInbox
        locale={locale}
        viewerMode="store"
        title={chatLabel("inbox.adminTitle", "All conversations")}
        emptyTitle={chatLabel("inbox.emptyLiveChat", "No conversations yet")}
        initialConversations={conversations}
        initialSelectedConversationId={selectedConversationId}
      />
    </div>
  );
}
