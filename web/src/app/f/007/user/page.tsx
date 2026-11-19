import { redirect } from "next/navigation";
import { STUDENT_HOME } from "@/utils/routes";

export default function UserPage() {
  redirect(STUDENT_HOME);
}
