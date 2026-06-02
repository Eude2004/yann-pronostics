import { useTranslation } from "react-i18next";
import { useEffect, useState } from "react";
import { Languages } from "lucide-react";
import { Button } from "@/components/ui/button";
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu";
import { supabase } from "@/integrations/supabase/client";
import { useAuth } from "@/hooks/use-auth";

const LANGS = [
  { code: "fr", label: "Français" },
  { code: "en", label: "English" },
];

export function LanguageToggle() {
  const { i18n } = useTranslation();
  const { user } = useAuth();
  const [mounted, setMounted] = useState(false);

  useEffect(() => setMounted(true), []);

  // Load saved locale from profile on login (one-shot)
  useEffect(() => {
    if (!user) return;
    (async () => {
      const { data } = await supabase
        .from("profiles")
        .select("locale")
        .eq("id", user.id)
        .maybeSingle();
      if (data?.locale && data.locale !== i18n.language) {
        i18n.changeLanguage(data.locale);
      }
    })();
  }, [user, i18n]);

  const change = async (code: string) => {
    await i18n.changeLanguage(code);
    try {
      localStorage.setItem("yp_lang", code);
    } catch {}
    if (user) {
      await supabase.from("profiles").update({ locale: code }).eq("id", user.id);
    }
  };

  const current = mounted ? (i18n.language?.startsWith("en") ? "EN" : "FR") : "FR";

  return (
    <DropdownMenu>
      <DropdownMenuTrigger asChild>
        <Button variant="ghost" size="sm" className="h-9 px-2 gap-1.5">
          <Languages className="w-4 h-4" />
          <span className="text-xs font-semibold">{current}</span>
        </Button>
      </DropdownMenuTrigger>
      <DropdownMenuContent align="end">
        {LANGS.map((l) => (
          <DropdownMenuItem key={l.code} onClick={() => change(l.code)}>
            {l.label}
          </DropdownMenuItem>
        ))}
      </DropdownMenuContent>
    </DropdownMenu>
  );
}
