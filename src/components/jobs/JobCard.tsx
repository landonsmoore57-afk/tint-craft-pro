import { Card, CardContent } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Avatar, AvatarFallback } from "@/components/ui/avatar";
import { Button } from "@/components/ui/button";
import { Phone, MessageSquare, MapPin, MoreVertical, Calendar } from "lucide-react";
import { format } from "date-fns";
import { cn } from "@/lib/utils";

interface JobCardProps {
  job: {
    assignment_id: string;
    quote_no: number;
    customer_name: string;
    site_address: string | null;
    status: string;
    job_date?: string;
  };
  onView: () => void;
  onCall?: () => void;
  onMessage?: () => void;
  onDirections?: () => void;
  onMore?: () => void;
}

export function JobCard({ job, onView, onCall, onMessage, onDirections, onMore }: JobCardProps) {
  const getStatusColor = (status: string) => {
    switch (status.toLowerCase()) {
      case "done":
      case "completed":
        return "bg-green-500/10 text-green-700 border-green-200";
      case "in progress":
        return "bg-blue-500/10 text-blue-700 border-blue-200";
      case "scheduled":
        return "bg-purple-500/10 text-purple-700 border-purple-200";
      default:
        return "bg-gray-500/10 text-gray-700 border-gray-200";
    }
  };

  const getInitials = (name: string) => {
    return name
      .split(" ")
      .map((n) => n[0])
      .join("")
      .toUpperCase()
      .slice(0, 2);
  };

  return (
    <Card 
      className="mb-3 overflow-hidden border-l-4 border-l-primary/30 active:scale-[0.98] transition-transform touch-manipulation"
      onClick={onView}
    >
      <CardContent className="p-4 space-y-3">
        {/* Row 1: Customer Name & Status */}
        <div className="flex items-start justify-between gap-2">
          <h3 className="font-semibold text-base leading-tight flex-1 min-w-0">
            {job.customer_name}
          </h3>
          <Badge 
            variant="outline" 
            className={cn("capitalize text-xs", getStatusColor(job.status))}
          >
            {job.status}
          </Badge>
        </div>

        {/* Row 2: Address & Quote # */}
        <div className="flex items-center gap-2 text-sm text-muted-foreground">
          <MapPin className="h-4 w-4 flex-shrink-0" />
          <span className="truncate flex-1">
            {job.site_address || "No address"}
          </span>
          <Badge variant="secondary" className="font-mono text-xs flex-shrink-0">
            #{job.quote_no}
          </Badge>
        </div>

        {/* Row 3: Scheduled Date & Assigned */}
        <div className="flex items-center justify-between gap-2 text-sm">
          <div className="flex items-center gap-2 text-muted-foreground">
            <Calendar className="h-4 w-4" />
            <span>
              {job.job_date 
                ? format(new Date(job.job_date + 'T00:00:00'), 'MMM d, yyyy')
                : "Unscheduled"
              }
            </span>
          </div>
          <Avatar className="h-6 w-6">
            <AvatarFallback className="text-xs bg-primary/10 text-primary">
              {getInitials(job.customer_name)}
            </AvatarFallback>
          </Avatar>
        </div>

        {/* Row 4: Quick Actions */}
        <div className="flex gap-2 pt-2 border-t">
          <Button
            variant="ghost"
            size="sm"
            className="flex-1 h-11 touch-manipulation"
            onClick={(e) => {
              e.stopPropagation();
              onCall?.();
            }}
          >
            <Phone className="h-4 w-4 mr-2" />
            Call
          </Button>
          <Button
            variant="ghost"
            size="sm"
            className="flex-1 h-11 touch-manipulation"
            onClick={(e) => {
              e.stopPropagation();
              onMessage?.();
            }}
          >
            <MessageSquare className="h-4 w-4 mr-2" />
            SMS
          </Button>
          <Button
            variant="ghost"
            size="sm"
            className="flex-1 h-11 touch-manipulation"
            onClick={(e) => {
              e.stopPropagation();
              onDirections?.();
            }}
          >
            <MapPin className="h-4 w-4 mr-2" />
            Map
          </Button>
          <Button
            variant="ghost"
            size="icon"
            className="h-11 w-11 touch-manipulation"
            onClick={(e) => {
              e.stopPropagation();
              onMore?.();
            }}
          >
            <MoreVertical className="h-4 w-4" />
          </Button>
        </div>
      </CardContent>
    </Card>
  );
}
