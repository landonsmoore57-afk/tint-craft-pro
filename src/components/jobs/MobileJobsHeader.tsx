import { Input } from "@/components/ui/input";
import { Button } from "@/components/ui/button";
import { Search, SlidersHorizontal } from "lucide-react";
import { Badge } from "@/components/ui/badge";
import { cn } from "@/lib/utils";

interface MobileJobsHeaderProps {
  searchQuery: string;
  onSearchChange: (value: string) => void;
  activeFilter: string;
  onFilterChange: (filter: string) => void;
  onSort?: () => void;
}

const filters = [
  { id: "all", label: "All" },
  { id: "today", label: "Today" },
  { id: "upcoming", label: "Upcoming" },
  { id: "unscheduled", label: "Unscheduled" },
  { id: "completed", label: "Completed" },
];

export function MobileJobsHeader({ 
  searchQuery, 
  onSearchChange, 
  activeFilter, 
  onFilterChange,
  onSort 
}: MobileJobsHeaderProps) {
  return (
    <div className="space-y-3 pb-4 md:hidden">
      {/* Search Bar */}
      <div className="flex gap-2">
        <div className="relative flex-1">
          <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-muted-foreground" />
          <Input
            type="search"
            placeholder="Search jobs..."
            value={searchQuery}
            onChange={(e) => onSearchChange(e.target.value)}
            className="pl-9 h-11 touch-manipulation"
          />
        </div>
        <Button
          variant="outline"
          size="icon"
          className="h-11 w-11 flex-shrink-0 touch-manipulation"
          onClick={onSort}
        >
          <SlidersHorizontal className="h-4 w-4" />
        </Button>
      </div>

      {/* Filter Pills */}
      <div className="flex gap-2 overflow-x-auto pb-2 -mx-4 px-4 scrollbar-hide">
        {filters.map((filter) => (
          <Badge
            key={filter.id}
            variant={activeFilter === filter.id ? "default" : "outline"}
            className={cn(
              "cursor-pointer whitespace-nowrap px-4 py-2 text-sm touch-manipulation",
              activeFilter === filter.id && "bg-primary text-primary-foreground"
            )}
            onClick={() => onFilterChange(filter.id)}
          >
            {filter.label}
          </Badge>
        ))}
      </div>
    </div>
  );
}
