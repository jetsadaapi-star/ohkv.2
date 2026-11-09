import { Skeleton } from "@/components/ui/skeleton";
import { OrdersListFallback } from "@/components/account/orders-list";

// Route-level fallback for the order history: the header row, the status
// tabs and the order rows, in the page's own shapes. Lives in the (list)
// route group so orders/[id] and pre-orders keep their own fallbacks.
export default function OrdersLoading() {
  return (
    <div className="mx-auto w-full max-w-5xl space-y-5" aria-busy="true">
      <div className="flex items-center gap-4">
        <Skeleton className="hidden size-12 rounded-2xl lg:block" />
        <div className="flex-1 space-y-2">
          <Skeleton className="hidden h-7 w-44 lg:block" />
          <Skeleton className="h-4 w-64" />
        </div>
        <Skeleton className="h-10 w-32 rounded-xl" />
      </div>
      <div className="flex gap-2">
        {Array.from({ length: 5 }).map((_, i) => (
          <Skeleton key={i} className="h-8 w-20 rounded-full" />
        ))}
      </div>
      <OrdersListFallback />
    </div>
  );
}
