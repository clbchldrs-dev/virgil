import { redirect } from "next/navigation";

export default function BackgroundActivityRedirectPage() {
  redirect("/command-center?section=background");
}
