import { Palette } from "lucide-react";
import { Button } from "@/components/ui/button";
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu";
import { Tooltip, TooltipContent, TooltipTrigger } from "@/components/ui/tooltip";
import { useTheme, siteStyles, SiteStyle } from "@/hooks/use-theme";
import { cn } from "@/lib/utils";

export function ThemeToggle() {
  const { style, setStyle } = useTheme();

  return (
    <DropdownMenu>
      <Tooltip delayDuration={200}>
        <TooltipTrigger asChild>
          <DropdownMenuTrigger asChild>
            <Button
              variant="ghost"
              size="icon"
              className="h-9 w-9"
              data-testid="button-style-toggle"
              aria-label="Change theme"
            >
              <Palette className="h-4 w-4" />
              <span className="sr-only">Change Style</span>
            </Button>
          </DropdownMenuTrigger>
        </TooltipTrigger>
        <TooltipContent side="bottom">Change theme</TooltipContent>
      </Tooltip>
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
