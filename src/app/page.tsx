import { cookies } from "next/headers";
import { redirect } from "next/navigation";
import { ROLE_COOKIE } from "@/lib/actors";

export default async function Home() {
  const jar = await cookies();
  const role = jar.get(ROLE_COOKIE)?.value ?? "provider";
  redirect(role === "provider" ? "/provider" : "/patient");
}
