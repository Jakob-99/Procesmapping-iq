import { redirect } from "next/navigation";

// Hjernen er forsiden. Gamle links hertil skal stadig virke.
export default function BrainPage() {
  redirect("/");
}
