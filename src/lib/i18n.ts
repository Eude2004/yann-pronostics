import i18n from "i18next";
import { initReactI18next } from "react-i18next";
import LanguageDetector from "i18next-browser-languagedetector";
import { fr } from "@/lib/locales/fr";
import { en } from "@/lib/locales/en";

// On the server we don't have access to localStorage, so force "fr" to keep
// the SSR output stable and matching the client's first paint. On the client
// the LanguageDetector reads "yp_lang" from localStorage (default "fr").
const isServer = typeof window === "undefined";
const initialLng = isServer
  ? "fr"
  : (() => {
      try {
        const stored = localStorage.getItem("yp_lang");
        return stored === "en" || stored === "fr" ? stored : "fr";
      } catch {
        return "fr";
      }
    })();

if (!i18n.isInitialized) {
  i18n
    .use(LanguageDetector)
    .use(initReactI18next)
    .init({
      resources: {
        fr: { translation: fr },
        en: { translation: en },
      },
      lng: initialLng,
      fallbackLng: "fr",
      supportedLngs: ["fr", "en"],
      interpolation: { escapeValue: false },
      detection: {
        // localStorage only: never auto-switch from navigator (would mismatch SSR)
        order: ["localStorage"],
        lookupLocalStorage: "yp_lang",
        caches: ["localStorage"],
      },
      react: { useSuspense: false },
    });
}

export default i18n;
