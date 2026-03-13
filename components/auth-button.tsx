import Link from "next/link";
import { Button } from "./ui/button";
import { createClient } from "@/lib/supabase/server";
import { LogoutButton } from "./logout-button";
import { ChevronRight } from "lucide-react";

export async function AuthButton() {
  const supabase = await createClient();

  // You can also use getUser() which will be slower.
  const { data } = await supabase.auth.getClaims();

  const user = data?.claims;

  return user ? (
    <div className="flex items-center gap-2">
      <div className="hidden rounded-full border border-border/70 bg-background px-3 py-1.5 sm:block">
        <p className="max-w-[220px] truncate text-xs font-medium text-foreground">{user.email}</p>
      </div>
      <LogoutButton />
    </div>
  ) : (
    <div className="flex gap-2">
      <Button asChild size="sm" variant="outline">
        <Link href="/auth/login">Ingresar</Link>
      </Button>
      <Button asChild size="sm" variant="default">
        <Link href="/auth/sign-up" className="inline-flex items-center gap-1">
          Crear cuenta
          <ChevronRight size={14} />
        </Link>
      </Button>
    </div>
  );
}
