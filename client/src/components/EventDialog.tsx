import { useEffect, useState } from "react";
import { useMutation, useQuery } from "@tanstack/react-query";
import { useForm } from "react-hook-form";
import { zodResolver } from "@hookform/resolvers/zod";
import { z } from "zod";
import { format } from "date-fns";
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import { Button } from "@/components/ui/button";
import {
  Form,
  FormControl,
  FormField,
  FormItem,
  FormLabel,
  FormMessage,
} from "@/components/ui/form";
import { Input } from "@/components/ui/input";
import { Textarea } from "@/components/ui/textarea";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { Popover, PopoverContent, PopoverTrigger } from "@/components/ui/popover";
import { Command, CommandEmpty, CommandGroup, CommandInput, CommandItem, CommandList } from "@/components/ui/command";
import { Check, ChevronsUpDown, X } from "lucide-react";
import { cn } from "@/lib/utils";
import { queryClient, apiRequest } from "@/lib/queryClient";
import { TIMEZONE_OPTIONS, getTzOffset, localToUtc, utcToLocal } from "@/lib/eventTimezones";
import { eventTypes, insertEventSchema, type Event, type Season, type EventCategory, type EventSubType, type Opponent } from "@shared/schema";
import { useGame } from "@/hooks/use-game";

const formSchema = insertEventSchema.extend({
  time: z.string().optional(),
  timezone: z.string().optional(),
  description: z.string().optional(),
  seasonId: z.string().optional(),
  eventSubType: z.string().optional(),
  opponentId: z.string().optional(),
});

type FormValues = z.infer<typeof formSchema>;

interface EventDialogProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  selectedDate?: Date;
  eventToEdit?: Event;
  onSuccess: (message: string) => void;
}

export function EventDialog({
  open,
  onOpenChange,
  selectedDate,
  eventToEdit,
  onSuccess,
}: EventDialogProps) {
  const isEditMode = !!eventToEdit;
  const { gameId, rosterId } = useGame();

  const { data: seasons = [] } = useQuery<Season[]>({
    queryKey: ["/api/seasons"],
  });

  const { data: eventCategories = [] } = useQuery<EventCategory[]>({
    queryKey: ["/api/event-categories"],
  });

  const { data: eventSubTypesAll = [] } = useQuery<EventSubType[]>({
    queryKey: ["/api/event-sub-types"],
  });

  const { data: opponents = [] } = useQuery<Opponent[]>({
    queryKey: ["/api/opponents", { gameId, rosterId }],
    enabled: !!gameId && !!rosterId,
  });
  const activeOpponents = opponents.filter(o => o.isActive);

  const [opponentPickerOpen, setOpponentPickerOpen] = useState(false);

  const allEventTypeOptions = eventCategories.length > 0
    ? Array.from(new Set(eventCategories.map(c => c.name)))
    : [...eventTypes];

  const defaultTz = (typeof window !== "undefined" && localStorage.getItem("home_calendar_tz")) || "UTC";
  const editTz = eventToEdit?.timezone || defaultTz;
  const editLocal = eventToEdit?.date
    ? utcToLocal(eventToEdit.date, eventToEdit.time || "", getTzOffset(editTz))
    : null;

  const form = useForm<FormValues>({
    resolver: zodResolver(formSchema),
    defaultValues: {
      title: eventToEdit?.title || "",
      eventType: eventToEdit?.eventType || (allEventTypeOptions[0] || "Tournament"),
      eventSubType: eventToEdit?.eventSubType || "",
      date: editLocal?.date || (selectedDate ? format(selectedDate, "yyyy-MM-dd") : format(new Date(), "yyyy-MM-dd")),
      time: editLocal?.time || "",
      timezone: editTz,
      description: eventToEdit?.description || "",
      seasonId: eventToEdit?.seasonId || "",
      opponentId: eventToEdit?.opponentId || "",
    },
  });

  const selectedEventType = form.watch("eventType");
  const matchingCategories = eventCategories.filter(c => c.name === selectedEventType);
  const selectedCategory = matchingCategories[0] || null;
  const matchingCategoryIds = new Set(matchingCategories.map(c => c.id));
  const filteredSubTypes = matchingCategoryIds.size > 0
    ? eventSubTypesAll.filter(s => matchingCategoryIds.has(s.categoryId))
    : [];
  const dedupedSubTypes = filteredSubTypes.filter((s, i, arr) => arr.findIndex(x => x.name === s.name) === i);

  useEffect(() => {
    if (eventToEdit) {
      const tz = eventToEdit.timezone || defaultTz;
      const local = utcToLocal(eventToEdit.date, eventToEdit.time || "", getTzOffset(tz));
      form.reset({
        title: eventToEdit.title,
        eventType: eventToEdit.eventType,
        eventSubType: eventToEdit.eventSubType || "",
        date: local.date || eventToEdit.date,
        time: local.time || "",
        timezone: tz,
        description: eventToEdit.description || "",
        seasonId: eventToEdit.seasonId || "",
        opponentId: eventToEdit.opponentId || "",
      });
    } else if (selectedDate) {
      form.setValue("date", format(selectedDate, "yyyy-MM-dd"));
    }
  }, [eventToEdit, selectedDate, form, defaultTz]);

  const saveEventMutation = useMutation({
    mutationFn: async (data: FormValues) => {
      const tz = data.timezone || "UTC";
      const offset = getTzOffset(tz);
      let utcDate = data.date;
      let utcTime: string | null = data.time || null;
      if (data.date && data.time) {
        const u = localToUtc(data.date, data.time, offset);
        utcDate = u.date;
        utcTime = u.time;
      }
      const payload = {
        ...data,
        date: utcDate,
        time: utcTime,
        timezone: tz,
        seasonId: data.seasonId === "" || data.seasonId === "none" ? null : data.seasonId,
        eventSubType: data.eventSubType === "" || data.eventSubType === "none" ? null : data.eventSubType,
        opponentId: data.opponentId === "" || data.opponentId === "none" ? null : data.opponentId,
      };
      if (isEditMode && eventToEdit) {
        const response = await apiRequest("PUT", `/api/events/${eventToEdit.id}`, payload);
        return response.json();
      } else {
        const response = await apiRequest("POST", "/api/events", payload);
        return response.json();
      }
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["/api/events"] });
      onSuccess(isEditMode ? "Event updated successfully" : "Event created successfully");
      form.reset();
      onOpenChange(false);
    },
    onError: (error: any) => {
      console.error("Error saving event:", error);
    },
  });

  const onSubmit = (data: FormValues) => {
    saveEventMutation.mutate(data);
  };

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="sm:max-w-[500px]" data-testid="dialog-event">
        <DialogHeader>
          <DialogTitle className="text-foreground">
            {isEditMode ? "Edit Event" : "Add New Event"}
          </DialogTitle>
        </DialogHeader>

        <Form {...form}>
          <form onSubmit={form.handleSubmit(onSubmit)} className="space-y-4">
            <FormField
              control={form.control}
              name="eventType"
              render={({ field }) => (
                <FormItem>
                  <FormLabel>Event Type</FormLabel>
                  <Select onValueChange={(val) => { field.onChange(val); form.setValue("eventSubType", ""); }} value={field.value}>
                    <FormControl>
                      <SelectTrigger data-testid="select-event-type">
                        <SelectValue placeholder="Select event type" />
                      </SelectTrigger>
                    </FormControl>
                    <SelectContent>
                      {allEventTypeOptions.map((type) => {
                        const cat = eventCategories.find(c => c.name === type);
                        return (
                          <SelectItem key={type} value={type}>
                            <div className="flex items-center gap-2">
                              {cat?.color && <div className="w-2.5 h-2.5 rounded-full flex-shrink-0" style={{ backgroundColor: cat.color }} />}
                              <span>{type}</span>
                            </div>
                          </SelectItem>
                        );
                      })}
                    </SelectContent>
                  </Select>
                  <FormMessage />
                </FormItem>
              )}
            />

            {dedupedSubTypes.length > 0 && (
              <FormField
                control={form.control}
                name="eventSubType"
                render={({ field }) => (
                  <FormItem>
                    <FormLabel>Sub Type (optional)</FormLabel>
                    <Select onValueChange={field.onChange} value={field.value || "none"}>
                      <FormControl>
                        <SelectTrigger data-testid="select-event-sub-type">
                          <SelectValue placeholder="Select sub type" />
                        </SelectTrigger>
                      </FormControl>
                      <SelectContent>
                        <SelectItem value="none">None</SelectItem>
                        {dedupedSubTypes.map((sub) => (
                          <SelectItem key={sub.id} value={sub.name}>
                            <div className="flex items-center gap-2">
                              {(sub.color || selectedCategory?.color) && <div className="w-2.5 h-2.5 rounded-full flex-shrink-0" style={{ backgroundColor: sub.color || selectedCategory?.color || "#3b82f6" }} />}
                              <span>{sub.name}</span>
                            </div>
                          </SelectItem>
                        ))}
                      </SelectContent>
                    </Select>
                    <FormMessage />
                  </FormItem>
                )}
              />
            )}

            <FormField
              control={form.control}
              name="title"
              render={({ field }) => (
                <FormItem>
                  <FormLabel>Title</FormLabel>
                  <FormControl>
                    <Input
                      placeholder="Event title"
                      {...field}
                      data-testid="input-event-title"
                    />
                  </FormControl>
                  <FormMessage />
                </FormItem>
              )}
            />

            <FormField
              control={form.control}
              name="opponentId"
              render={({ field }) => {
                const selected = activeOpponents.find(o => o.id === field.value);
                return (
                  <FormItem className="flex flex-col">
                    <FormLabel>Opponent (optional)</FormLabel>
                    <Popover open={opponentPickerOpen} onOpenChange={setOpponentPickerOpen}>
                      <PopoverTrigger asChild>
                        <FormControl>
                          <Button
                            type="button"
                            variant="outline"
                            role="combobox"
                            className={cn("justify-between font-normal", !selected && "text-muted-foreground")}
                            data-testid="button-opponent-picker"
                          >
                            <span className="truncate">{selected ? selected.name : "Select opponent..."}</span>
                            <div className="flex items-center gap-1 shrink-0">
                              {selected && (
                                <span
                                  role="button"
                                  tabIndex={0}
                                  onClick={(e) => { e.stopPropagation(); field.onChange(""); }}
                                  onKeyDown={(e) => { if (e.key === "Enter" || e.key === " ") { e.preventDefault(); e.stopPropagation(); field.onChange(""); } }}
                                  className="rounded-sm hover:bg-accent p-0.5"
                                  data-testid="button-clear-opponent"
                                >
                                  <X className="h-3.5 w-3.5 text-muted-foreground" />
                                </span>
                              )}
                              <ChevronsUpDown className="h-4 w-4 opacity-50" />
                            </div>
                          </Button>
                        </FormControl>
                      </PopoverTrigger>
                      <PopoverContent className="w-[--radix-popover-trigger-width] p-0" align="start">
                        <Command>
                          <CommandInput placeholder="Search opponents..." data-testid="input-opponent-search" />
                          <CommandList>
                            <CommandEmpty>No opponents found.</CommandEmpty>
                            <CommandGroup>
                              {activeOpponents.map((opp) => (
                                <CommandItem
                                  key={opp.id}
                                  value={opp.name + " " + (opp.shortName || "")}
                                  onSelect={() => { field.onChange(opp.id); setOpponentPickerOpen(false); }}
                                  data-testid={`option-opponent-${opp.id}`}
                                >
                                  <Check className={cn("mr-2 h-4 w-4", field.value === opp.id ? "opacity-100" : "opacity-0")} />
                                  <span className="truncate">{opp.name}</span>
                                  {opp.shortName && <span className="ml-2 text-xs text-muted-foreground">[{opp.shortName}]</span>}
                                </CommandItem>
                              ))}
                            </CommandGroup>
                          </CommandList>
                        </Command>
                      </PopoverContent>
                    </Popover>
                    <FormMessage />
                  </FormItem>
                );
              }}
            />

            <div className="grid grid-cols-2 gap-4">
              <FormField
                control={form.control}
                name="date"
                render={({ field }) => (
                  <FormItem>
                    <FormLabel>Date</FormLabel>
                    <FormControl>
                      <Input
                        type="date"
                        {...field}
                        data-testid="input-event-date"
                      />
                    </FormControl>
                    <FormMessage />
                  </FormItem>
                )}
              />

              <FormField
                control={form.control}
                name="time"
                render={({ field }) => (
                  <FormItem>
                    <FormLabel>Time (optional)</FormLabel>
                    <FormControl>
                      <Input
                        type="time"
                        {...field}
                        data-testid="input-event-time"
                      />
                    </FormControl>
                    <FormMessage />
                  </FormItem>
                )}
              />
            </div>

            <FormField
              control={form.control}
              name="timezone"
              render={({ field }) => (
                <FormItem>
                  <FormLabel>Timezone</FormLabel>
                  <Select onValueChange={field.onChange} value={field.value || "UTC"}>
                    <FormControl>
                      <SelectTrigger data-testid="select-event-timezone">
                        <SelectValue placeholder="Select timezone" />
                      </SelectTrigger>
                    </FormControl>
                    <SelectContent>
                      {TIMEZONE_OPTIONS.map(tz => (
                        <SelectItem key={tz.value} value={tz.value}>{tz.label}</SelectItem>
                      ))}
                    </SelectContent>
                  </Select>
                  <FormMessage />
                </FormItem>
              )}
            />

            <FormField
              control={form.control}
              name="seasonId"
              render={({ field }) => (
                <FormItem>
                  <FormLabel>Season (optional)</FormLabel>
                  <Select 
                    onValueChange={field.onChange} 
                    value={field.value || "none"}
                  >
                    <FormControl>
                      <SelectTrigger data-testid="select-event-season">
                        <SelectValue placeholder="Select season" />
                      </SelectTrigger>
                    </FormControl>
                    <SelectContent>
                      <SelectItem value="none">No Season</SelectItem>
                      {seasons.map((season) => (
                        <SelectItem key={season.id} value={season.id}>
                          {season.name}
                        </SelectItem>
                      ))}
                    </SelectContent>
                  </Select>
                  <FormMessage />
                </FormItem>
              )}
            />

            <FormField
              control={form.control}
              name="description"
              render={({ field }) => (
                <FormItem>
                  <FormLabel>Description (optional)</FormLabel>
                  <FormControl>
                    <Textarea
                      placeholder="Event details..."
                      {...field}
                      data-testid="input-event-description"
                    />
                  </FormControl>
                  <FormMessage />
                </FormItem>
              )}
            />

            <div className="flex justify-end gap-3 pt-4">
              <Button
                type="button"
                variant="outline"
                onClick={() => onOpenChange(false)}
                data-testid="button-cancel-event"
              >
                Cancel
              </Button>
              <Button
                type="submit"
                disabled={saveEventMutation.isPending}
                data-testid="button-save-event"
              >
                {saveEventMutation.isPending 
                  ? (isEditMode ? "Updating..." : "Creating...") 
                  : (isEditMode ? "Update Event" : "Create Event")}
              </Button>
            </div>
          </form>
        </Form>
      </DialogContent>
    </Dialog>
  );
}
