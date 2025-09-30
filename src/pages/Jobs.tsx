import { useState, useEffect } from "react";
import { useSearchParams } from "react-router-dom";
import { supabase } from "@/integrations/supabase/client";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { Accordion, AccordionContent, AccordionItem, AccordionTrigger } from "@/components/ui/accordion";
import { Calendar } from "@/components/ui/calendar";
import { Popover, PopoverContent, PopoverTrigger } from "@/components/ui/popover";
import { useToast } from "@/hooks/use-toast";
import { format, startOfWeek, addWeeks, addDays } from "date-fns";
import { Calendar as CalendarIcon, Trash2 } from "lucide-react";
import { cn } from "@/lib/utils";

interface WindowSize {
  width_in: number;
  height_in: number;
  area_sqft_each: number;
  total_qty: number;
}

interface RoomSize {
  width_in: number;
  height_in: number;
  area_sqft_each: number;
  total_qty: number;
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
  const [searchParams, setSearchParams] = useSearchParams();
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
    // If date param in URL, scroll to that date section
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

      const { data: { user } } = await supabase.auth.getUser();
      const { data: session } = await supabase.auth.getSession();

      const response = await fetch(
        `${import.meta.env.VITE_SUPABASE_URL}/functions/v1/list-jobs?from=${from}&to=${to}`,
        {
          headers: {
            Authorization: `Bearer ${session.session?.access_token}`,
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
            <CardTitle>
              {format(dateRange.from, 'MMM d')} - {format(dateRange.to, 'MMM d, yyyy')}
            </CardTitle>
            <div className="text-sm text-muted-foreground">
              {jobs.reduce((sum, g) => sum + g.items.length, 0)} job{jobs.reduce((sum, g) => sum + g.items.length, 0) !== 1 ? 's' : ''} scheduled
            </div>
          </div>
        </CardHeader>

        <CardContent>
          {loading ? (
            <div className="text-center py-8">Loading...</div>
          ) : jobs.length === 0 ? (
            <div className="text-center py-8 text-muted-foreground">
              No jobs scheduled in this date range
            </div>
          ) : (
            <div className="space-y-6">
              {jobs.map((group) => (
                <div key={group.job_date} id={`date-${group.job_date}`} className="space-y-3">
                  <div className="sticky top-0 bg-background/95 backdrop-blur supports-[backdrop-filter]:bg-background/60 py-2 border-b">
                    <h3 className="text-lg font-semibold">
                      {format(new Date(group.job_date + 'T00:00:00'), 'EEEE, MMMM d, yyyy')}
                    </h3>
                  </div>

                  {group.items.map((job) => (
                    <Card key={job.assignment_id}>
                      <CardHeader>
                        <div className="flex items-start justify-between">
                          <div>
                            <CardTitle className="text-lg">
                              {job.customer_name} — Quote #{job.quote_no}
                            </CardTitle>
                            {job.site_address && (
                              <p className="text-sm text-muted-foreground mt-1">{job.site_address}</p>
                            )}
                          </div>
                          <div className="flex items-center gap-2">
                            <Badge variant={getStatusColor(job.status) as any} className="capitalize">
                              {job.status}
                            </Badge>
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

                      <CardContent className="space-y-4">
                        {/* Window Summary */}
                        <div>
                          <h4 className="font-semibold mb-2">Window Summary</h4>
                          <div className="rounded-md border">
                            <Table>
                              <TableHeader>
                                <TableRow>
                                  <TableHead>Size (W×H in)</TableHead>
                                  <TableHead className="text-right">Area (sq ft each)</TableHead>
                                  <TableHead className="text-right">Qty</TableHead>
                                </TableRow>
                              </TableHeader>
                              <TableBody>
                                {job.window_summary.map((size, idx) => (
                                  <TableRow key={idx}>
                                    <TableCell className="font-mono">
                                      {size.width_in}×{size.height_in}
                                    </TableCell>
                                    <TableCell className="text-right">{size.area_sqft_each.toFixed(2)}</TableCell>
                                    <TableCell className="text-right font-medium">{size.total_qty}</TableCell>
                                  </TableRow>
                                ))}
                              </TableBody>
                            </Table>
                          </div>
                        </div>

                        {/* Rooms Summary */}
                        {job.rooms_summary && job.rooms_summary.length > 0 && (
                          <div>
                            <h4 className="font-semibold mb-2">Rooms Summary</h4>
                            <Accordion type="single" collapsible className="w-full">
                              {job.rooms_summary.map((room, idx) => (
                                <AccordionItem key={idx} value={`room-${idx}`}>
                                  <AccordionTrigger>
                                    <div className="flex items-center gap-2">
                                      <span className="font-medium">{room.room_label}</span>
                                      <Badge variant="outline">{room.total_windows_qty} windows</Badge>
                                    </div>
                                  </AccordionTrigger>
                                  <AccordionContent>
                                    <div className="rounded-md border">
                                      <Table>
                                        <TableHeader>
                                          <TableRow>
                                            <TableHead>Size (W×H in)</TableHead>
                                            <TableHead className="text-right">Area (sq ft each)</TableHead>
                                            <TableHead className="text-right">Qty</TableHead>
                                          </TableRow>
                                        </TableHeader>
                                        <TableBody>
                                          {room.sizes.map((size, sizeIdx) => (
                                            <TableRow key={sizeIdx}>
                                              <TableCell className="font-mono">
                                                {size.width_in}×{size.height_in}
                                              </TableCell>
                                              <TableCell className="text-right">{size.area_sqft_each.toFixed(2)}</TableCell>
                                              <TableCell className="text-right font-medium">{size.total_qty}</TableCell>
                                            </TableRow>
                                          ))}
                                        </TableBody>
                                      </Table>
                                    </div>
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
              ))}
            </div>
          )}
        </CardContent>
      </Card>
    </div>
  );
}
