import { redirect } from "next/navigation";
import { auth } from "@/app/(auth)/auth";
import { DeploymentCapabilitiesPanel } from "@/components/deployment/capabilities-panel";

export default async function DeploymentPage() {
  const session = await auth();
  if (!session?.user) {
    redirect("/login");
  }

  return (
    <div className="mx-auto flex min-h-0 w-full max-w-2xl flex-col gap-6 px-4 py-8">
      <header className="space-y-1">
        <h1 className="font-semibold text-2xl text-foreground tracking-tight">
          This deployment
        </h1>
        <p className="text-muted-foreground text-sm">
          What this server supports: cloud vs local inference and companion
          tools. Details differ between your laptop and hosted Vercel — this
          page reflects the instance you are using now.
        </p>
      </header>
      <DeploymentCapabilitiesPanel />
    </div>
  );
}
