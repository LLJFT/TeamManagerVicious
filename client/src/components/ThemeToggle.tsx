import { Palette } from "lucide-react";
import { Button } from "@/components/ui/button";
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu";
import { useTheme, siteStyles, SiteStyle } from "@/hooks/use-theme";
import { cn } from "@/lib/utils";

export function ThemeToggle() {
  const { style, setStyle } = useTheme();

  return (
    <DropdownMenu>
      <DropdownMenuTrigger asChild>
        <Button
          variant="ghost"
          size="icon"
          className="h-9 w-9"
          data-testid="button-style-toggle"
        >
          <Palette className="h-4 w-4" />
          <span className="sr-only">Change Style</span>
        </Button>
      </DropdownMenuTrigger>
      <DropdownMenuContent align="end">
        {siteStyles.map((s) => (
          <DropdownMenuItem
            key={s.id}
            onClick={() => setStyle(s.id)}
            className={cn(style === s.id && "bg-accent")}
            data-testid={`menu-style-${s.id}`}
          >
            {s.name}
          </DropdownMenuItem>
        ))}
      </DropdownMenuContent>
    </DropdownMenu>
  );
}
