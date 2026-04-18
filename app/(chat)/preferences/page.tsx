import { redirect } from "next/navigation";
import { auth } from "@/app/(auth)/auth";

/** Model and chat options live in the chat toolbar; keep route for old links. */
export default async function PreferencesPage() {
  const session = await auth();
  if (!session?.user) {
    redirect("/login");
  }

  redirect("/");
}
