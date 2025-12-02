import { Palette, Check } from "lucide-react";
import { Button } from "@/components/ui/button";
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuLabel,
  DropdownMenuSeparator,
  DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu";
import { useTheme } from "@/hooks/use-theme";

export function ThemeSelector() {
  const { theme, setTheme, themes } = useTheme();

  return (
    <DropdownMenu>
      <DropdownMenuTrigger asChild>
        <Button
          variant="outline"
          size="icon"
          className="h-9 w-9"
          data-testid="button-theme-selector"
        >
          <Palette className="h-4 w-4" />
          <span className="sr-only">Select theme style</span>
        </Button>
      </DropdownMenuTrigger>
      <DropdownMenuContent align="end" className="w-56">
        <DropdownMenuLabel>Theme Style</DropdownMenuLabel>
        <DropdownMenuSeparator />
        {themes.map((themeOption) => (
          <DropdownMenuItem
            key={themeOption.id}
            onClick={() => setTheme(themeOption.id)}
            className="flex items-center gap-3 cursor-pointer"
            data-testid={`menu-item-theme-${themeOption.id}`}
          >
            <div
              className="w-4 h-4 rounded-full border border-border flex-shrink-0"
              style={{ backgroundColor: themeOption.previewColor }}
            />
            <div className="flex-1">
              <div className="font-medium">{themeOption.name}</div>
              <div className="text-xs text-muted-foreground">
                {themeOption.description}
              </div>
            </div>
            {theme === themeOption.id && (
              <Check className="h-4 w-4 text-primary flex-shrink-0" />
            )}
          </DropdownMenuItem>
        ))}
      </DropdownMenuContent>
    </DropdownMenu>
  );
}
