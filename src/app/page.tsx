import { redirect } from "next/navigation";

export default function Home() {
  redirect("/discover"); // middleware sends signed-out visitors to /login
}
