import { useState, useEffect } from "react";
import { useParams, useNavigate } from "react-router-dom";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { Accordion, AccordionContent, AccordionItem, AccordionTrigger } from "@/components/ui/accordion";
import { ArrowLeft, Calendar, MapPin, Phone, MessageSquare } from "lucide-react";
import { useToast } from "@/hooks/use-toast";
import { format } from "date-fns";
import { formatRollPlan } from "@/lib/quoteCalculations";
import { Tooltip, TooltipContent, TooltipProvider, TooltipTrigger } from "@/components/ui/tooltip";

interface WindowSize {
  width_in: number;
  height_in: number;
  area_sqft_each: number;
  total_qty: number;
  film_id: string | null;
  film_display: string;
  roll_plan?: any;
}

interface RoomSize {
  width_in: number;
  height_in: number;
  area_sqft_each: number;
  total_qty: number;
  roll_plan?: any;
}

interface RoomSummary {
  room_label: string;
  total_windows_qty: number;
  sizes: RoomSize[];
}

interface JobDetail {
  assignment_id: string;
  quote_id: string;
  quote_no: number;
  customer_name: string;
  site_address: string | null;
  status: string;
  job_date: string;
  window_summary: WindowSize[];
  rooms_summary: RoomSummary[];
}

export default function JobDetail() {
  const { assignmentId } = useParams();
  const navigate = useNavigate();
  const { toast } = useToast();
  const [job, setJob] = useState<JobDetail | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    if (!assignmentId) {
      setError("No assignment ID provided");
      setLoading(false);
      return;
    }
    fetchJobDetail();
  }, [assignmentId]);

  const fetchJobDetail = async () => {
    if (!assignmentId) return;
    
    setLoading(true);
    setError(null);
    
    try {
      const supabaseUrl = 'https://jiyeljjdpyawaikgpkqu.supabase.co';
      const url = `${supabaseUrl}/functions/v1/list-jobs?assignment_id=${assignmentId}`;
      
      const response = await fetch(url, {
        headers: {
          'Content-Type': 'application/json',
        },
      });
      
      if (!response.ok) {
        const errorText = await response.text();
        throw new Error(`API Error ${response.status}: ${errorText.slice(0, 100)}`);
      }

      const data = await response.json();
      
      if (data && data.length > 0 && data[0].items && data[0].items.length > 0) {
        const jobData = data[0].items[0];
        setJob({
          ...jobData,
          job_date: data[0].job_date
        });
        setError(null);
        setLoading(false);
      } else {
        throw new Error("No job found with this ID");
      }
    } catch (err: any) {
      const errorMsg = err.message || "Failed to load job details";
      setError(errorMsg);
      setLoading(false);
      toast({
        title: "Error loading job",
        description: errorMsg,
        variant: "destructive",
        duration: 10000,
      });
    }
  };

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

  const handleCall = () => {
    window.location.href = `tel:+1234567890`;
  };

  const handleMessage = () => {
    window.location.href = `sms:+1234567890`;
  };

  const handleDirections = () => {
    if (job?.site_address) {
      const address = encodeURIComponent(job.site_address);
      window.location.href = `https://maps.apple.com/?q=${address}`;
    }
  };

  if (loading) {
    return (
      <div className="min-h-screen flex items-center justify-center pb-safe bg-background">
        <div className="text-center space-y-4 p-8">
          <div className="h-12 w-12 border-4 border-primary border-t-transparent rounded-full animate-spin mx-auto"></div>
          <p className="text-lg font-medium">Loading Job Details</p>
          <p className="text-sm text-muted-foreground">Assignment: {assignmentId?.slice(0, 8)}...</p>
        </div>
      </div>
    );
  }

  if (error) {
    return (
      <div className="min-h-screen flex items-center justify-center pb-safe px-4 bg-background">
        <div className="text-center space-y-4 p-8 max-w-md">
          <div className="text-6xl mb-4">⚠️</div>
          <h2 className="text-xl font-bold">Error Loading Job</h2>
          <p className="text-sm text-muted-foreground">{error}</p>
          <p className="text-xs text-muted-foreground font-mono bg-muted p-2 rounded">
            ID: {assignmentId}
          </p>
          <Button onClick={() => navigate("/jobs")} className="w-full">
            Back to Jobs
          </Button>
        </div>
      </div>
    );
  }

  if (!job) {
    return (
      <div className="min-h-screen flex items-center justify-center pb-safe px-4 bg-background">
        <div className="text-center space-y-4 p-8">
          <div className="text-6xl mb-4">🔍</div>
          <h2 className="text-xl font-bold">Job Not Found</h2>
          <p className="text-sm text-muted-foreground">No job data available</p>
          <Button onClick={() => navigate("/jobs")} className="w-full">
            Back to Jobs
          </Button>
        </div>
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-background pb-24">
      {/* Header */}
      <div className="sticky top-0 z-40 bg-background border-b">
        <div className="flex items-center gap-3 p-4">
          <Button
            variant="ghost"
            size="icon"
            onClick={() => navigate("/jobs")}
            className="touch-manipulation"
          >
            <ArrowLeft className="h-5 w-5" />
          </Button>
          <div className="flex-1">
            <h1 className="text-xl font-bold">{job.customer_name}</h1>
            <p className="text-sm text-muted-foreground">Job #{job.quote_no}</p>
          </div>
          <Badge 
            variant="outline" 
            className={`capitalize text-xs ${getStatusColor(job.status)}`}
          >
            {job.status}
          </Badge>
        </div>
      </div>

      <div className="p-4 space-y-4">
        {/* Job Info Card */}
        <Card>
          <CardHeader>
            <CardTitle className="text-base">Job Information</CardTitle>
          </CardHeader>
          <CardContent className="space-y-3">
            {job.job_date && (
              <div className="flex items-center gap-2 text-sm">
                <Calendar className="h-4 w-4 text-muted-foreground flex-shrink-0" />
                <span className="font-medium">
                  {format(new Date(job.job_date + 'T00:00:00'), 'EEEE, MMMM d, yyyy')}
                </span>
              </div>
            )}
            {job.site_address && (
              <div className="flex items-start gap-2 text-sm">
                <MapPin className="h-4 w-4 text-muted-foreground flex-shrink-0 mt-0.5" />
                <span>{job.site_address}</span>
              </div>
            )}
          </CardContent>
        </Card>

        {/* Quick Actions */}
        <div className="grid grid-cols-3 gap-2">
          <Button
            variant="outline"
            className="h-14 flex-col gap-1 touch-manipulation"
            onClick={handleCall}
          >
            <Phone className="h-4 w-4" />
            <span className="text-xs">Call</span>
          </Button>
          <Button
            variant="outline"
            className="h-14 flex-col gap-1 touch-manipulation"
            onClick={handleMessage}
          >
            <MessageSquare className="h-4 w-4" />
            <span className="text-xs">SMS</span>
          </Button>
          <Button
            variant="outline"
            className="h-14 flex-col gap-1 touch-manipulation"
            onClick={handleDirections}
          >
            <MapPin className="h-4 w-4" />
            <span className="text-xs">Directions</span>
          </Button>
        </div>

        {/* Window Summary */}
        <Card>
          <CardHeader>
            <div className="flex items-center justify-between">
              <CardTitle className="text-base">Window Summary</CardTitle>
              <Badge variant="outline" className="bg-accent/10">
                {job.window_summary.reduce((sum, w) => sum + w.total_qty, 0)} windows
              </Badge>
            </div>
          </CardHeader>
          <CardContent>
            <div className="space-y-3">
              {job.window_summary.length > 0 ? (
                job.window_summary.map((size, idx) => (
                  <div key={idx} className="border rounded-lg p-3 space-y-2">
                    <div className="flex items-start justify-between gap-2">
                      <div className="flex-1 min-w-0">
                        <p className="text-sm font-medium truncate">{size.film_display}</p>
                        <p className="text-xs text-muted-foreground font-mono">
                          {size.width_in}×{size.height_in}"
                        </p>
                      </div>
                      <Badge variant="secondary" className="flex-shrink-0">
                        {size.total_qty}×
                      </Badge>
                    </div>
                    <div className="text-xs text-muted-foreground">
                      <TooltipProvider>
                        <Tooltip>
                          <TooltipTrigger asChild>
                            <span className="cursor-help">
                              Roll: {formatRollPlan(size.roll_plan)}
                            </span>
                          </TooltipTrigger>
                          <TooltipContent>
                            <p className="text-xs">Calculated with cross-trim of 0.5" per side</p>
                          </TooltipContent>
                        </Tooltip>
                      </TooltipProvider>
                    </div>
                  </div>
                ))
              ) : (
                <p className="text-center text-sm text-muted-foreground py-4">No windows</p>
              )}
            </div>
          </CardContent>
        </Card>

        {/* Rooms Summary */}
        {job.rooms_summary && job.rooms_summary.length > 0 && (
          <Card>
            <CardHeader>
              <CardTitle className="text-base">Rooms Summary</CardTitle>
            </CardHeader>
            <CardContent>
              <Accordion type="single" collapsible className="w-full space-y-2">
                {job.rooms_summary.map((room, idx) => (
                  <AccordionItem 
                    key={idx} 
                    value={`room-${idx}`}
                    className="border rounded-lg overflow-hidden"
                  >
                    <AccordionTrigger className="px-3 py-2 hover:no-underline hover:bg-accent/50">
                      <div className="flex items-center gap-2 text-sm">
                        <span className="font-medium">{room.room_label}</span>
                        <Badge variant="secondary" className="text-xs">
                          {room.total_windows_qty}
                        </Badge>
                      </div>
                    </AccordionTrigger>
                    <AccordionContent className="px-3 pb-3">
                      <div className="space-y-2 pt-2">
                        {room.sizes.map((size, sizeIdx) => (
                          <div key={sizeIdx} className="flex items-center justify-between text-sm py-2 border-t first:border-t-0">
                            <span className="font-mono text-xs">
                              {size.width_in}×{size.height_in}"
                            </span>
                            <div className="flex items-center gap-3">
                              <Badge variant="secondary" className="text-xs">
                                {size.total_qty}×
                              </Badge>
                              <span className="text-xs text-muted-foreground">
                                {formatRollPlan(size.roll_plan)}
                              </span>
                            </div>
                          </div>
                        ))}
                      </div>
                    </AccordionContent>
                  </AccordionItem>
                ))}
              </Accordion>
            </CardContent>
          </Card>
        )}
      </div>
    </div>
  );
}
