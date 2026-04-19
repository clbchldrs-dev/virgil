import { redirect } from "next/navigation";

export default function FlightDeckRedirectPage() {
  redirect("/command-center?section=triage");
}
