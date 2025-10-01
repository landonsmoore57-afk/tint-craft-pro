import { useState, useEffect } from "react";
import { useSearchParams, useNavigate } from "react-router-dom";
import { supabase } from "@/integrations/supabase/client";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { Accordion, AccordionContent, AccordionItem, AccordionTrigger } from "@/components/ui/accordion";
import { Calendar } from "@/components/ui/calendar";
import { Popover, PopoverContent, PopoverTrigger } from "@/components/ui/popover";
import { Tooltip, TooltipContent, TooltipProvider, TooltipTrigger } from "@/components/ui/tooltip";
import { useToast } from "@/hooks/use-toast";
import { format, startOfWeek, addWeeks } from "date-fns";
import { Calendar as CalendarIcon, Trash2, Eye } from "lucide-react";
import { cn } from "@/lib/utils";
import { formatRollPlan } from "@/lib/quoteCalculations";

interface RollPlan {
  slit_width_in: number;
  base_roll_in: 48 | 60 | 72;
  orientation: 'width-across' | 'height-across';
  waste_in: number;
  note?: string;
}

interface WindowSize {
  width_in: number;
  height_in: number;
  area_sqft_each: number;
  total_qty: number;
  film_id: string | null;
  film_display: string;
  roll_plan?: RollPlan | { error: string };
}

interface RoomSize {
  width_in: number;
  height_in: number;
  area_sqft_each: number;
  total_qty: number;
  roll_plan?: RollPlan | { error: string };
}

interface RoomSummary {
  room_label: string;
  total_windows_qty: number;
  sizes: RoomSize[];
}

interface JobItem {
  assignment_id: string;
  quote_id: string;
  quote_no: number;
  customer_name: string;
  site_address: string | null;
  status: string;
  window_summary: WindowSize[];
  rooms_summary: RoomSummary[];
}

interface JobGroup {
  job_date: string;
  items: JobItem[];
}

export default function Jobs() {
  const [searchParams] = useSearchParams();
  const navigate = useNavigate();
  const [jobs, setJobs] = useState<JobGroup[]>([]);
  const [loading, setLoading] = useState(true);
  const [dateRange, setDateRange] = useState<{ from: Date; to: Date }>(() => {
    const from = startOfWeek(new Date(), { weekStartsOn: 1 });
    const to = addWeeks(from, 4);
    return { from, to };
  });
  const { toast } = useToast();

  useEffect(() => {
    fetchJobs();
  }, [dateRange]);

  useEffect(() => {
    const dateParam = searchParams.get('date');
    if (dateParam) {
      setTimeout(() => {
        const element = document.getElementById(`date-${dateParam}`);
        element?.scrollIntoView({ behavior: 'smooth', block: 'start' });
      }, 500);
    }
  }, [searchParams, jobs]);

  const fetchJobs = async () => {
    setLoading(true);
    try {
      const from = format(dateRange.from, 'yyyy-MM-dd');
      const to = format(dateRange.to, 'yyyy-MM-dd');

      const response = await fetch(
        `${import.meta.env.VITE_SUPABASE_URL}/functions/v1/list-jobs?from=${from}&to=${to}`,
        {
          headers: {
            'Content-Type': 'application/json',
          },
        }
      );

      if (!response.ok) {
        const error = await response.json();
        throw new Error(error.error || 'Failed to fetch jobs');
      }

      const data = await response.json();
      setJobs(data || []);
    } catch (error: any) {
      toast({
        title: "Error loading jobs",
        description: error.message,
        variant: "destructive",
      });
    } finally {
      setLoading(false);
    }
  };

  const handleUnassign = async (assignmentId: string) => {
    try {
      const { error } = await supabase
        .from('job_assignments')
        .delete()
        .eq('id', assignmentId);

      if (error) throw error;

      toast({
        title: "Job unassigned",
        description: "Quote removed from schedule",
      });

      fetchJobs();
    } catch (error: any) {
      toast({
        title: "Unassign failed",
        description: error.message,
        variant: "destructive",
      });
    }
  };

  const handleReschedule = async (assignmentId: string, newDate: Date) => {
    try {
      const jobDate = format(newDate, 'yyyy-MM-dd');
      const { error } = await supabase
        .from('job_assignments')
        .update({ job_date: jobDate })
        .eq('id', assignmentId);

      if (error) throw error;

      toast({
        title: "Job rescheduled",
        description: `Moved to ${format(newDate, 'MMM d, yyyy')}`,
      });

      fetchJobs();
    } catch (error: any) {
      toast({
        title: "Reschedule failed",
        description: error.message,
        variant: "destructive",
      });
    }
  };

  const setQuickRange = (weeks: number) => {
    const from = startOfWeek(new Date(), { weekStartsOn: 1 });
    const to = addWeeks(from, weeks);
    setDateRange({ from, to });
  };

  const getStatusColor = (status: string) => {
    return status === "done" ? "default" : "secondary";
  };

  const totalJobs = jobs.reduce((sum, g) => sum + g.items.length, 0);

  return (
    <div className="space-y-6">
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-3xl font-bold">Jobs</h1>
          <p className="text-muted-foreground">Scheduled installation jobs</p>
        </div>
        <div className="flex gap-2">
          <Button variant="outline" size="sm" onClick={() => setQuickRange(1)}>
            This Week
          </Button>
          <Button variant="outline" size="sm" onClick={() => setQuickRange(2)}>
            Next 2 Weeks
          </Button>
          <Button variant="outline" size="sm" onClick={() => setQuickRange(4)}>
            Next 4 Weeks
          </Button>
        </div>
      </div>

      <Card>
        <CardHeader>
          <div className="flex items-center justify-between">
            <div>
              <CardTitle>Schedule</CardTitle>
              <CardDescription>
                {format(dateRange.from, 'MMM d')} - {format(dateRange.to, 'MMM d, yyyy')} • {totalJobs} job{totalJobs !== 1 ? 's' : ''} scheduled
              </CardDescription>
            </div>
          </div>
        </CardHeader>

        <CardContent>
          {loading ? (
            <div className="text-center py-12 text-muted-foreground">Loading jobs...</div>
          ) : jobs.length === 0 ? (
            <div className="text-center py-12">
              <p className="text-muted-foreground">No jobs scheduled in this date range</p>
            </div>
          ) : (
            <div className="space-y-8">
              {jobs.map((group) => (
                <div key={group.job_date} id={`date-${group.job_date}`} className="space-y-4">
                  <div className="flex items-center gap-4 pb-4 mb-2 border-b-2 border-primary/20">
                    <div className="flex items-center gap-3 px-4 py-2 bg-primary/10 rounded-lg">
                      <CalendarIcon className="h-5 w-5 text-primary" />
                      <h3 className="text-xl font-bold text-primary">
                        {format(new Date(group.job_date + 'T00:00:00'), 'EEEE, MMMM d, yyyy')}
                      </h3>
                    </div>
                    <Badge variant="secondary" className="text-sm px-3 py-1">
                      {group.items.length} job{group.items.length !== 1 ? 's' : ''}
                    </Badge>
                  </div>

                  <div className="space-y-4">
                    {group.items.map((job) => (
                      <Card key={job.assignment_id} className="overflow-hidden border-l-4 border-l-primary/30">
                        <CardHeader className="bg-gradient-to-r from-primary/5 to-transparent">
                          <div className="flex items-start justify-between gap-4">
                            <div className="flex-1 min-w-0">
                              <div className="flex items-center gap-3 mb-1 flex-wrap">
                                <CardTitle className="text-lg">{job.customer_name}</CardTitle>
                                <Badge variant="outline" className="font-mono">
                                  #{job.quote_no}
                                </Badge>
                                <Badge variant={getStatusColor(job.status) as any} className="capitalize">
                                  {job.status}
                                </Badge>
                              </div>
                              {job.site_address && (
                                <CardDescription className="text-sm">{job.site_address}</CardDescription>
                              )}
                            </div>
                            
                            <div className="flex items-center gap-2">
                              <Button
                                variant="ghost"
                                size="sm"
                                onClick={() => navigate(`/quote/${job.quote_id}`)}
                              >
                                <Eye className="h-4 w-4 mr-2" />
                                View Quote
                              </Button>
                              <Popover>
                                <PopoverTrigger asChild>
                                  <Button variant="outline" size="sm">
                                    <CalendarIcon className="h-4 w-4 mr-2" />
                                    Reschedule
                                  </Button>
                                </PopoverTrigger>
                                <PopoverContent className="w-auto p-0" align="end">
                                  <Calendar
                                    mode="single"
                                    selected={new Date(group.job_date + 'T00:00:00')}
                                    onSelect={(date) => date && handleReschedule(job.assignment_id, date)}
                                    disabled={(date) => date < new Date(new Date().setHours(0, 0, 0, 0))}
                                    initialFocus
                                  />
                                </PopoverContent>
                              </Popover>
                              <Button
                                variant="ghost"
                                size="sm"
                                onClick={() => handleUnassign(job.assignment_id)}
                              >
                                <Trash2 className="h-4 w-4" />
                              </Button>
                            </div>
                          </div>
                        </CardHeader>

                        <CardContent className="pt-6">
                          {/* Window Summary */}
                          <div className="mb-6">
                            <div className="flex items-center justify-between mb-3">
                              <h4 className="text-sm font-semibold text-muted-foreground uppercase tracking-wider">
                                Window Summary
                              </h4>
                              <Badge variant="outline" className="bg-accent/10 border-accent/30">
                                Total: {job.window_summary.reduce((sum, w) => sum + w.total_qty, 0)} windows
                              </Badge>
                            </div>
                            <div className="rounded-lg border border-accent/20 overflow-hidden">
                              <Table>
                                <TableHeader>
                                  <TableRow className="bg-accent/5 hover:bg-accent/5">
                                    <TableHead className="font-semibold">Film</TableHead>
                                    <TableHead className="font-semibold">Size (W×H in)</TableHead>
                                    <TableHead className="text-right font-semibold">Qty</TableHead>
                                    <TableHead className="font-semibold">Roll Size</TableHead>
                                  </TableRow>
                                </TableHeader>
                                <TableBody>
                                  {job.window_summary.length > 0 ? (
                                    job.window_summary.map((size, idx) => (
                                      <TableRow key={idx}>
                                        <TableCell className="text-sm font-medium">
                                          {size.film_display}
                                        </TableCell>
                                        <TableCell className="font-mono font-medium">
                                          {size.width_in}×{size.height_in}
                                        </TableCell>
                                        <TableCell className="text-right font-semibold">
                                          {size.total_qty}
                                        </TableCell>
                                        <TableCell className="text-sm">
                                          <TooltipProvider>
                                            <Tooltip>
                                              <TooltipTrigger asChild>
                                                <span className="cursor-help">{formatRollPlan(size.roll_plan)}</span>
                                              </TooltipTrigger>
                                  <TooltipContent>
                                    <p className="text-xs">Calculated with cross-trim of 0.5" per side</p>
                                  </TooltipContent>
                                            </Tooltip>
                                          </TooltipProvider>
                                        </TableCell>
                                      </TableRow>
                                    ))
                                  ) : (
                                    <TableRow>
                                      <TableCell colSpan={4} className="text-center text-muted-foreground">
                                        No windows
                                      </TableCell>
                                    </TableRow>
                                  )}
                                </TableBody>
                              </Table>
                            </div>
                          </div>

                          {/* Rooms Summary */}
                          {job.rooms_summary && job.rooms_summary.length > 0 && (
                            <div>
                              <h4 className="text-sm font-semibold mb-3 text-muted-foreground uppercase tracking-wider">
                                Rooms Summary
                              </h4>
                              <Accordion type="single" collapsible className="w-full space-y-2">
                                {job.rooms_summary.map((room, idx) => (
                                  <AccordionItem 
                                    key={idx} 
                                    value={`room-${idx}`} 
                                    className="border border-primary/20 rounded-lg overflow-hidden bg-gradient-to-r from-primary/5 to-transparent"
                                  >
                                    <AccordionTrigger className="px-4 hover:no-underline hover:bg-primary/10">
                                      <div className="flex items-center gap-3">
                                        <span className="font-semibold">{room.room_label}</span>
                                        <Badge variant="secondary" className="text-xs bg-primary/20">
                                          {room.total_windows_qty} windows
                                        </Badge>
                                      </div>
                                    </AccordionTrigger>
                                    <AccordionContent className="px-4 pb-4 bg-card">
                                      <Table>
                                        <TableHeader>
                                          <TableRow className="bg-muted/30 hover:bg-muted/30">
                                            <TableHead className="font-semibold">Size (W×H in)</TableHead>
                                            <TableHead className="text-right font-semibold">Area (sq ft)</TableHead>
                                            <TableHead className="text-right font-semibold">Qty</TableHead>
                                            <TableHead className="font-semibold">Roll Size</TableHead>
                                          </TableRow>
                                        </TableHeader>
                                        <TableBody>
                                          {room.sizes.map((size, sizeIdx) => (
                                            <TableRow key={sizeIdx}>
                                              <TableCell className="font-mono font-medium">
                                                {size.width_in}×{size.height_in}
                                              </TableCell>
                                              <TableCell className="text-right tabular-nums">
                                                {size.area_sqft_each.toFixed(2)}
                                              </TableCell>
                                              <TableCell className="text-right font-semibold">
                                                {size.total_qty}
                                              </TableCell>
                                              <TableCell className="text-sm">
                                                <TooltipProvider>
                                                  <Tooltip>
                                                    <TooltipTrigger asChild>
                                                      <span className="cursor-help">{formatRollPlan(size.roll_plan)}</span>
                                                    </TooltipTrigger>
                                          <TooltipContent>
                                            <p className="text-xs">Calculated with cross-trim of 0.5" per side</p>
                                          </TooltipContent>
                                                  </Tooltip>
                                                </TooltipProvider>
                                              </TableCell>
                                            </TableRow>
                                          ))}
                                        </TableBody>
                                      </Table>
                                    </AccordionContent>
                                  </AccordionItem>
                                ))}
                              </Accordion>
                            </div>
                          )}
                        </CardContent>
                      </Card>
                    ))}
                  </div>
                </div>
              ))}
            </div>
          )}
        </CardContent>
      </Card>
    </div>
  );
}
