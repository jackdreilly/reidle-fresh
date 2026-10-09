import { useSession } from "@/lib/session";

export default function Account() {
  return <h1 class="text-2xl uppercase">{useSession().name}</h1>;
}
