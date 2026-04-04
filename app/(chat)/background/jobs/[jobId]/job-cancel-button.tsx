"use client";

import { useRouter } from "next/navigation";
import { useState } from "react";
import { toast } from "sonner";
import { Button } from "@/components/ui/button";

export function JobCancelButton({ jobId }: { jobId: string }) {
  const router = useRouter();
  const [pending, setPending] = useState(false);

  const handleCancel = async () => {
    setPending(true);
    try {
      const res = await fetch(`/api/jobs/${jobId}`, { method: "DELETE" });
      const body = (await res.json().catch(() => ({}))) as {
        error?: string;
        status?: string;
      };
      if (!res.ok) {
        toast.error(body.error ?? "Could not cancel job");
        return;
      }
      toast.success("Job cancelled");
      router.refresh();
    } catch {
      toast.error("Request failed");
    } finally {
      setPending(false);
    }
  };

  return (
    <Button
      disabled={pending}
      onClick={() => {
        handleCancel();
      }}
      size="sm"
      type="button"
      variant="outline"
    >
      {pending ? "Cancelling…" : "Cancel job"}
    </Button>
  );
}
