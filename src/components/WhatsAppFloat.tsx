import { MessageCircle } from "lucide-react";
import { useSettings, whatsappLink } from "@/hooks/use-settings";

export function WhatsAppFloat() {
  const { settings } = useSettings();
  const href = whatsappLink(
    settings.whatsapp_number,
    "Bonjour YANN PRONOSTICS, j'ai besoin d'aide.",
  );
  return (
    <a
      href={href}
      target="_blank"
      rel="noreferrer"
      aria-label="Contacter sur WhatsApp"
      className="fixed bottom-5 right-5 z-50 group"
    >
      <div className="absolute inset-0 rounded-full bg-green-500/40 blur-xl group-hover:bg-green-500/60 transition" />
      <div className="relative flex items-center gap-2 bg-green-500 hover:bg-green-600 text-white font-semibold rounded-full shadow-2xl pl-3 pr-4 py-3 transition-transform group-hover:scale-105">
        <MessageCircle className="w-5 h-5" />
        <span className="hidden sm:inline text-sm">Besoin d'aide ?</span>
      </div>
    </a>
  );
}
