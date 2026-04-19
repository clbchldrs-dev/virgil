import { redirect } from "next/navigation";

export default function SophonDailyRedirectPage() {
  redirect("/command-center?section=daily");
}
