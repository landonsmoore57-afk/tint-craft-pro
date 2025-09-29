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

  useEffect(() => {
    loadRooms();
  }, []);

  const loadRooms = async () => {
    try {
      const { data, error } = await supabase
        .from("rooms")
        .select("id, name")
        .order("name");

      if (error) throw error;
      setRooms(data || []);
    } catch (error: any) {
      toast({
        title: "Error loading rooms",
        description: error.message,
        variant: "destructive",
      });
    }
  };

  const createRoom = async (name: string) => {
    try {
      setLoading(true);
      const { data, error } = await supabase
        .from("rooms")
        .insert([{ name, is_common: false }])
        .select()
        .single();

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
      if (error.code === "23505") {
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
  const filteredRooms = search
    ? rooms.filter((room) =>
        room.name.toLowerCase().includes(search.toLowerCase())
      )
    : rooms;

  const showCreateOption = search && !filteredRooms.some(
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
        <Command>
          <CommandInput
            placeholder="Search rooms..."
            value={search}
            onValueChange={setSearch}
          />
          <CommandEmpty>
            {showCreateOption ? (
              <Button
                variant="ghost"
                className="w-full justify-start"
                onClick={() => createRoom(search)}
                disabled={loading}
              >
                Create "{search}"
              </Button>
            ) : (
              "No room found."
            )}
          </CommandEmpty>
          <CommandGroup>
            {filteredRooms.map((room) => (
              <CommandItem
                key={room.id}
                value={room.name}
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
