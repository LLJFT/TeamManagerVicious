import { useMemo } from "react";
import { useQuery } from "@tanstack/react-query";
import { Card, CardContent, CardHeader } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Checkbox } from "@/components/ui/checkbox";
import { ChevronDown, ChevronRight, Filter } from "lucide-react";
import { useGame } from "@/hooks/use-game";
import type { EventCategory, EventSubType } from "@shared/schema";

interface Props {
  selectedSubTypes: Set<string>;
  onChange: (next: Set<string>) => void;
  showFilter: boolean;
  onToggleShow: () => void;
  expandedCategories: Set<string>;
  onToggleCategory: (catName: string) => void;
}

export function MultiSelectEventTypeFilter({
  selectedSubTypes,
  onChange,
  showFilter,
  onToggleShow,
  expandedCategories,
  onToggleCategory,
}: Props) {
  const { gameId, rosterId } = useGame();
  const enabled = !!(gameId && rosterId);
  const { data: eventCategories = [] } = useQuery<EventCategory[]>({
    queryKey: ["/api/event-categories", { gameId, rosterId }],
    enabled,
  });
  const { data: eventSubTypes = [] } = useQuery<EventSubType[]>({
    queryKey: ["/api/event-sub-types", { gameId, rosterId }],
    enabled,
  });

  const categoryGroups = useMemo(() => {
    const uniqueCats = Array.from(new Set(eventCategories.map(c => c.name)));
    return uniqueCats.map(catName => {
      const cat = eventCategories.find(c => c.name === catName)!;
      const subs = eventSubTypes.filter(s => {
        const matchingCat = eventCategories.find(c => c.id === s.categoryId);
        return matchingCat?.name === catName;
      });
      const uniqueSubs = subs.filter((s, i, arr) => arr.findIndex(x => x.name === s.name) === i);
      return { name: catName, color: cat.color, subTypes: uniqueSubs };
    });
  }, [eventCategories, eventSubTypes]);

  const toggleSubType = (subName: string) => {
    const next = new Set(selectedSubTypes);
    if (next.has(subName)) next.delete(subName);
    else next.add(subName);
    onChange(next);
  };

  const toggleAllInCategory = (catName: string) => {
    const group = categoryGroups.find(g => g.name === catName);
    if (!group) return;
    const subNames = group.subTypes.map(s => s.name);
    const allSelected = subNames.every(n => selectedSubTypes.has(n));
    const next = new Set(selectedSubTypes);
    if (allSelected) subNames.forEach(n => next.delete(n));
    else subNames.forEach(n => next.add(n));
    onChange(next);
  };

  if (categoryGroups.length === 0) return null;

  return (
    <Card className="mb-6">
      <CardHeader className="pb-2">
        <div className="flex items-center justify-between gap-2 flex-wrap">
          <div className="flex items-center gap-2 cursor-pointer" onClick={onToggleShow} data-testid="button-toggle-filter">
            <Filter className="h-4 w-4 text-muted-foreground" />
            <span className="text-sm font-medium">Filter by Event Sub-Types</span>
            {selectedSubTypes.size > 0 && (
              <Badge variant="secondary" className="text-xs">{selectedSubTypes.size} selected</Badge>
            )}
            {showFilter ? <ChevronDown className="h-4 w-4" /> : <ChevronRight className="h-4 w-4" />}
          </div>
          {selectedSubTypes.size > 0 && (
            <Button variant="ghost" size="sm" onClick={() => onChange(new Set())} data-testid="button-clear-filter">
              Clear All
            </Button>
          )}
        </div>
      </CardHeader>
      {showFilter && (
        <CardContent className="pt-0">
          <div className="space-y-2">
            {categoryGroups.map(group => {
              const isExpanded = expandedCategories.has(group.name);
              const subNames = group.subTypes.map(s => s.name);
              const selectedCount = subNames.filter(n => selectedSubTypes.has(n)).length;
              const allSelected = subNames.length > 0 && selectedCount === subNames.length;
              return (
                <div key={group.name} className="rounded-md border border-border">
                  <div className="flex items-center gap-2 p-2 cursor-pointer" onClick={() => onToggleCategory(group.name)}>
                    {isExpanded ? <ChevronDown className="h-4 w-4 text-muted-foreground" /> : <ChevronRight className="h-4 w-4 text-muted-foreground" />}
                    <div className="h-3 w-3 rounded-full shrink-0" style={{ backgroundColor: group.color || "#888" }} />
                    <span className="text-sm font-medium flex-1">{group.name}</span>
                    {selectedCount > 0 && <Badge variant="secondary" className="text-xs">{selectedCount}/{subNames.length}</Badge>}
                    <Checkbox
                      checked={allSelected}
                      onCheckedChange={() => toggleAllInCategory(group.name)}
                      onClick={(e) => e.stopPropagation()}
                      data-testid={`checkbox-category-${group.name}`}
                    />
                  </div>
                  {isExpanded && group.subTypes.length > 0 && (
                    <div className="border-t border-border px-4 py-2 space-y-1 bg-muted/20">
                      {group.subTypes.map(sub => (
                        <label key={sub.name} className="flex items-center gap-2 py-1 cursor-pointer text-sm" data-testid={`filter-subtype-${sub.name}`}>
                          <Checkbox
                            checked={selectedSubTypes.has(sub.name)}
                            onCheckedChange={() => toggleSubType(sub.name)}
                          />
                          <div className="h-2 w-2 rounded-full shrink-0" style={{ backgroundColor: sub.color || group.color || "#888" }} />
                          <span>{sub.name}</span>
                        </label>
                      ))}
                    </div>
                  )}
                </div>
              );
            })}
          </div>
        </CardContent>
      )}
    </Card>
  );
}

export function useMultiSelectFilterState() {
  // helper hook is intentionally not provided; consumers manage state
  return null;
}
