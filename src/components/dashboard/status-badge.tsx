import { Badge } from "@/components/ui/badge";

type Variant =
  | "default"
  | "secondary"
  | "destructive"
  | "outline"
  | "success"
  | "warning";

const STATUS_VARIANT: Record<string, Variant> = {
  // Event lifecycle
  PROCESSED: "success",
  RECEIVED: "warning",
  PROCESSING: "warning",
  SKIPPED: "secondary",
  DUPLICATE: "secondary",
  // Action / delivery
  SUCCESS: "success",
  PENDING: "warning",
  FAILED: "destructive",
};

const STATUS_LABEL: Record<string, string> = {
  PROCESSED: "Processed",
  RECEIVED: "Received",
  PROCESSING: "Processing",
  SKIPPED: "Skipped",
  DUPLICATE: "Duplicate",
  SUCCESS: "Success",
  PENDING: "Pending",
  FAILED: "Failed",
};

export function StatusBadge({ status }: { status: string }) {
  const variant = STATUS_VARIANT[status] ?? "outline";
  const label = STATUS_LABEL[status] ?? status;
  return <Badge variant={variant}>{label}</Badge>;
}
