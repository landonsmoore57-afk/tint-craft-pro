import { useState, useEffect } from "react";
import { Check, ChevronsUpDown } from "lucide-react";
import { cn } from "@/lib/utils";
import { Button } from "@/components/ui/button";
import {
  Command,
  CommandEmpty,
  CommandGroup,
  CommandInput,
  CommandItem,
} from "@/components/ui/command";
import {
  Popover,
  PopoverContent,
  PopoverTrigger,
} from "@/components/ui/popover";
import { supabase } from "@/integrations/supabase/client";
import { useToast } from "@/hooks/use-toast";

interface Room {
  id: string;
  name: string;
}

interface RoomSelectorProps {
  value: string | null;
  onChange: (roomId: string | null) => void;
}

export function RoomSelector({ value, onChange }: RoomSelectorProps) {
  const { toast } = useToast();
  const [open, setOpen] = useState(false);
  const [rooms, setRooms] = useState<Room[]>([]);
  const [search, setSearch] = useState("");
  const [loading, setLoading] = useState(false);

  // Load top 10 suggestions when opened
  const loadSuggestions = async () => {
    try {
      setLoading(true);
      const { data, error } = await supabase.functions.invoke('rooms-suggest', {
        body: { limit: 10 }
      });

      if (error) throw error;
      setRooms(data || []);
    } catch (error: any) {
      console.error('Error loading room suggestions:', error);
      toast({
        title: "Error loading rooms",
        description: error.message,
        variant: "destructive",
      });
    } finally {
      setLoading(false);
    }
  };

  // Search rooms when user types
  const searchRooms = async (query: string) => {
    if (!query) {
      // If search is cleared, reload suggestions
      await loadSuggestions();
      return;
    }

    try {
      setLoading(true);
      const { data, error } = await supabase.functions.invoke('rooms-search', {
        body: { q: query, limit: 20 }
      });

      if (error) throw error;
      setRooms(data || []);
    } catch (error: any) {
      console.error('Error searching rooms:', error);
      toast({
        title: "Error searching rooms",
        description: error.message,
        variant: "destructive",
      });
    } finally {
      setLoading(false);
    }
  };

  // Debounce search
  useEffect(() => {
    const timer = setTimeout(() => {
      if (search) {
        searchRooms(search);
      }
    }, 300);

    return () => clearTimeout(timer);
  }, [search]);

  // Load suggestions when opened
  useEffect(() => {
    if (open && !search) {
      loadSuggestions();
    }
  }, [open, search]);

  const createRoom = async (name: string) => {
    try {
      setLoading(true);
      
      // Use edge function to bypass RLS for PIN-based auth
      const { data, error } = await supabase.functions.invoke('rooms-create', {
        body: { name }
      });

      if (error) throw error;

      setRooms([...rooms, data]);
      onChange(data.id);
      setOpen(false);
      setSearch("");

      toast({
        title: "Room created",
        description: `"${name}" added to room library`,
      });
    } catch (error: any) {
      const status = error?.status || error?.context?.status;
      if (status === 409 || error.message?.includes('duplicate')) {
        toast({
          title: "Room already exists",
          description: "A room with this name already exists",
          variant: "destructive",
        });
      } else {
        toast({
          title: "Error creating room",
          description: error.message,
          variant: "destructive",
        });
      }
    } finally {
      setLoading(false);
    }
  };

  const selectedRoom = rooms.find((room) => room.id === value);
  
  const showCreateOption = search && !rooms.some(
    (room) => room.name.toLowerCase() === search.toLowerCase()
  );

  return (
    <Popover open={open} onOpenChange={setOpen}>
      <PopoverTrigger asChild>
        <Button
          variant="outline"
          role="combobox"
          aria-expanded={open}
          className="w-full justify-between"
        >
          {selectedRoom ? selectedRoom.name : "Select room..."}
          <ChevronsUpDown className="ml-2 h-4 w-4 shrink-0 opacity-50" />
        </Button>
      </PopoverTrigger>
      <PopoverContent className="w-full p-0">
        <Command shouldFilter={false}>
          <CommandInput
            placeholder="Type to search rooms..."
            value={search}
            onValueChange={setSearch}
          />
          <CommandEmpty>
            {loading ? (
              "Loading..."
            ) : showCreateOption ? (
              <Button
                variant="ghost"
                className="w-full justify-start"
                onClick={() => createRoom(search)}
                disabled={loading}
              >
                Create "{search}"
              </Button>
            ) : search ? (
              "No room found. Keep typing..."
            ) : (
              "Type to search rooms..."
            )}
          </CommandEmpty>
          <CommandGroup>
            {rooms.map((room) => (
              <CommandItem
                key={room.id}
                value={room.id}
                onSelect={() => {
                  onChange(room.id === value ? null : room.id);
                  setOpen(false);
                  setSearch("");
                }}
              >
                <Check
                  className={cn(
                    "mr-2 h-4 w-4",
                    value === room.id ? "opacity-100" : "opacity-0"
                  )}
                />
                {room.name}
              </CommandItem>
            ))}
          </CommandGroup>
        </Command>
      </PopoverContent>
    </Popover>
  );
}
