import { useState, useEffect, useCallback } from "react";
import { Check, ChevronsUpDown } from "lucide-react";
import { cn } from "@/lib/utils";
import { Button } from "@/components/ui/button";
import {
  Command,
  CommandEmpty,
  CommandGroup,
  CommandInput,
  CommandItem,
  CommandList,
} from "@/components/ui/command";
import {
  Popover,
  PopoverContent,
  PopoverTrigger,
} from "@/components/ui/popover";
import { supabase } from "@/integrations/supabase/client";
import { useToast } from "@/hooks/use-toast";

interface Film {
  id: string;
  brand: string;
  series: string;
  name: string;
  vlt: number | null;
  sku: string | null;
  active: boolean;
  cost_per_sqft: number;
  sell_per_sqft: number;
  security_film: boolean;
  notes: string | null;
}

interface FilmSelectorProps {
  value: string | null;
  onChange: (filmId: string | null) => void;
  placeholder?: string;
}

export function FilmSelector({ value, onChange, placeholder = "Select film..." }: FilmSelectorProps) {
  const { toast } = useToast();
  const [open, setOpen] = useState(false);
  const [films, setFilms] = useState<Film[]>([]);
  const [search, setSearch] = useState("");
  const [loading, setLoading] = useState(false);

  // Load top 10 suggestions when opened
  const loadSuggestions = useCallback(async () => {
    try {
      setLoading(true);
      const { data, error } = await supabase.functions.invoke('films-suggest', {
        body: { limit: 10 }
      });

      if (error) throw error;
      setFilms(data || []);
    } catch (error: any) {
      console.error('Error loading film suggestions:', error);
      toast({
        title: "Error loading films",
        description: error.message,
        variant: "destructive",
      });
    } finally {
      setLoading(false);
    }
  }, [toast]);

  // Search films when user types
  const searchFilms = useCallback(async (query: string) => {
    if (!query) {
      // If search is cleared, reload suggestions
      await loadSuggestions();
      return;
    }

    try {
      setLoading(true);
      
      // Construct URL with query parameters
      const url = `${import.meta.env.VITE_SUPABASE_URL}/functions/v1/films-search?q=${encodeURIComponent(query)}&limit=20`;
      
      const response = await fetch(url, {
        headers: {
          'Authorization': `Bearer ${import.meta.env.VITE_SUPABASE_PUBLISHABLE_KEY}`,
        }
      });
      
      if (!response.ok) {
        throw new Error(`Search failed: ${response.statusText}`);
      }
      
      const data = await response.json();
      setFilms(data || []);
    } catch (error: any) {
      console.error('Error searching films:', error);
      toast({
        title: "Error searching films",
        description: error.message,
        variant: "destructive",
      });
    } finally {
      setLoading(false);
    }
  }, [loadSuggestions, toast]);

  // Debounce search
  useEffect(() => {
    const timer = setTimeout(() => {
      if (search) {
        searchFilms(search);
      }
    }, 300);

    return () => clearTimeout(timer);
  }, [search, searchFilms]);

  // Load suggestions when opened
  useEffect(() => {
    if (open && !search) {
      loadSuggestions();
    }
  }, [open, search, loadSuggestions]);

  const selectedFilm = films.find((film) => film.id === value);

  const formatFilmDisplay = (film: Film) => {
    return `${film.brand} ${film.series} ${film.name}${film.vlt ? ` ${film.vlt}` : ''}`;
  };

  return (
    <Popover open={open} onOpenChange={setOpen}>
      <PopoverTrigger asChild>
        <Button
          variant="outline"
          role="combobox"
          aria-expanded={open}
          className="w-full justify-between"
        >
          {selectedFilm ? formatFilmDisplay(selectedFilm) : placeholder}
          <ChevronsUpDown className="ml-2 h-4 w-4 shrink-0 opacity-50" />
        </Button>
      </PopoverTrigger>
      <PopoverContent className="w-full p-0">
        <Command shouldFilter={false}>
          <CommandInput
            placeholder="Type to search films..."
            value={search}
            onValueChange={setSearch}
          />
          <CommandList>
            <CommandEmpty>
              {loading ? "Loading..." : search ? "No films found. Keep typing..." : "Type to search films..."}
            </CommandEmpty>
            <CommandGroup>
              {films.map((film) => (
                <CommandItem
                  key={film.id}
                  value={film.id}
                  onSelect={() => {
                    onChange(film.id === value ? null : film.id);
                    setOpen(false);
                    setSearch("");
                  }}
                >
                  <Check
                    className={cn(
                      "mr-2 h-4 w-4",
                      value === film.id ? "opacity-100" : "opacity-0"
                    )}
                  />
                  {formatFilmDisplay(film)}
                </CommandItem>
              ))}
            </CommandGroup>
          </CommandList>
        </Command>
      </PopoverContent>
    </Popover>
  );
}
