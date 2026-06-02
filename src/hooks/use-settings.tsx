import { useEffect, useState } from "react";
import { supabase } from "@/integrations/supabase/client";

export const DEFAULT_WHATSAPP = "654010951";

export function whatsappLink(phone: string, message?: string) {
  const digits = phone.replace(/\D/g, "");
  // Cameroon (+237) default if no country code
  const full = digits.length <= 9 ? `237${digits}` : digits;
  const base = `https://wa.me/${full}`;
  return message ? `${base}?text=${encodeURIComponent(message)}` : base;
}

export function useSettings() {
  const [settings, setSettings] = useState<Record<string, string>>({
    whatsapp_number: DEFAULT_WHATSAPP,
    site_name: "YANN PRONOSTICS",
  });
  const [loading, setLoading] = useState(true);

  const load = async () => {
    const { data } = await supabase.from("app_settings").select("key, value");
    if (data) {
      const map: Record<string, string> = {};
      data.forEach((r: any) => { if (r.value) map[r.key] = r.value; });
      setSettings((s) => ({ ...s, ...map }));
    }
    setLoading(false);
  };

  useEffect(() => { load(); }, []);
  return { settings, loading, reload: load };
}
