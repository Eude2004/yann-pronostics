import { Moon, Sun, Monitor } from "lucide-react";
import { Button } from "@/components/ui/button";
import { useTheme } from "@/hooks/use-theme";

export function ThemeToggle({ className }: { className?: string }) {
  const { theme, toggleTheme } = useTheme();

  const label =
    theme === "system" ? "Thème : système (auto)" : theme === "light" ? "Thème : clair" : "Thème : sombre";
  const Icon = theme === "system" ? Monitor : theme === "light" ? Sun : Moon;

  return (
    <Button
      type="button"
      variant="outline"
      size="icon"
      onClick={toggleTheme}
      aria-label={label}
      title={label}
      className={className}
    >
      <Icon className="h-4 w-4" />
    </Button>
  );
}
