import { redirect } from "next/navigation";
import { cookies } from "next/headers";
import { SESSION_COOKIE_NAME, validateSession } from "@/lib/auth/session";

export default async function HomePage() {
  const cookieStore = cookies();
  const token = cookieStore.get(SESSION_COOKIE_NAME)?.value;

  if (token) {
    const session = await validateSession(token);
    if (session) {
      redirect("/dashboard");
    }
  }

  redirect("/login");
}
