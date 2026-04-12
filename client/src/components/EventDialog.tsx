import { useEffect } from "react";
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
import { queryClient, apiRequest } from "@/lib/queryClient";
import { eventTypes, insertEventSchema, type Event, type Season, type EventCategory, type EventSubType } from "@shared/schema";

const formSchema = insertEventSchema.extend({
  time: z.string().optional(),
  description: z.string().optional(),
  seasonId: z.string().optional(),
  eventSubType: z.string().optional(),
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

  const { data: seasons = [] } = useQuery<Season[]>({
    queryKey: ["/api/seasons"],
  });

  const { data: eventCategories = [] } = useQuery<EventCategory[]>({
    queryKey: ["/api/event-categories"],
  });

  const { data: eventSubTypesAll = [] } = useQuery<EventSubType[]>({
    queryKey: ["/api/event-sub-types"],
  });

  const allEventTypeOptions = eventCategories.length > 0
    ? eventCategories.map(c => c.name)
    : [...eventTypes];

  const form = useForm<FormValues>({
    resolver: zodResolver(formSchema),
    defaultValues: {
      title: eventToEdit?.title || "",
      eventType: eventToEdit?.eventType || (allEventTypeOptions[0] || "Tournament"),
      eventSubType: eventToEdit?.eventSubType || "",
      date: eventToEdit?.date || (selectedDate ? format(selectedDate, "yyyy-MM-dd") : format(new Date(), "yyyy-MM-dd")),
      time: eventToEdit?.time || "",
      description: eventToEdit?.description || "",
      seasonId: eventToEdit?.seasonId || "",
    },
  });

  const selectedEventType = form.watch("eventType");
  const selectedCategory = eventCategories.find(c => c.name === selectedEventType);
  const filteredSubTypes = selectedCategory
    ? eventSubTypesAll.filter(s => s.categoryId === selectedCategory.id)
    : [];

  useEffect(() => {
    if (eventToEdit) {
      form.reset({
        title: eventToEdit.title,
        eventType: eventToEdit.eventType,
        eventSubType: eventToEdit.eventSubType || "",
        date: eventToEdit.date,
        time: eventToEdit.time || "",
        description: eventToEdit.description || "",
        seasonId: eventToEdit.seasonId || "",
      });
    } else if (selectedDate) {
      form.setValue("date", format(selectedDate, "yyyy-MM-dd"));
    }
  }, [eventToEdit, selectedDate, form]);

  const saveEventMutation = useMutation({
    mutationFn: async (data: FormValues) => {
      const payload = {
        ...data,
        seasonId: data.seasonId === "" || data.seasonId === "none" ? null : data.seasonId,
        eventSubType: data.eventSubType === "" || data.eventSubType === "none" ? null : data.eventSubType,
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

            {filteredSubTypes.length > 0 && (
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
                        {filteredSubTypes.map((sub) => (
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
