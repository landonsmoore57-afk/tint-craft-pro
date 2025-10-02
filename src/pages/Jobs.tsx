import { useState, useEffect } from "react";
import { useSearchParams, useNavigate } from "react-router-dom";
import { supabase } from "@/integrations/supabase/client";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { useToast } from "@/hooks/use-toast";
import { format, startOfWeek, addWeeks, isToday, isFuture } from "date-fns";
import { Plus } from "lucide-react";
import { JobCard } from "@/components/jobs/JobCard";
import { MobileJobsHeader } from "@/components/jobs/MobileJobsHeader";
import { JobsDesktopView } from "@/components/jobs/JobsDesktopView";
import { useAuth } from "@/contexts/AuthContext";

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
  const { role } = useAuth();
  const [jobs, setJobs] = useState<JobGroup[]>([]);
  const [loading, setLoading] = useState(true);
  const [searchQuery, setSearchQuery] = useState("");
  const [activeFilter, setActiveFilter] = useState("all");
  const [dateRange, setDateRange] = useState<{ from: Date; to: Date }>(() => {
    const from = startOfWeek(new Date(), { weekStartsOn: 1 });
    const to = addWeeks(from, 4);
    return { from, to };
  });
  const { toast } = useToast();

  const isTinter = role === 'tinter';

  // Restore scroll position on mount
  useEffect(() => {
    const pos = sessionStorage.getItem('jobs:scrollY');
    if (pos) window.scrollTo(0, Number(pos));
  }, []);

  // Save scroll position
  useEffect(() => {
    const onScroll = () => sessionStorage.setItem('jobs:scrollY', String(window.scrollY));
    window.addEventListener('scroll', onScroll);
    return () => window.removeEventListener('scroll', onScroll);
  }, []);

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

  const handleCall = (job: JobItem) => {
    // In a real app, would fetch customer phone from quote
    window.location.href = `tel:+1234567890`;
  };

  const handleMessage = (job: JobItem) => {
    // In a real app, would fetch customer phone from quote
    window.location.href = `sms:+1234567890`;
  };

  const handleDirections = (job: JobItem) => {
    if (job.site_address) {
      const address = encodeURIComponent(job.site_address);
      // iOS opens Apple Maps, Android opens Google Maps
      window.location.href = `https://maps.apple.com/?q=${address}`;
    }
  };

  // Filter jobs based on search and active filter
  const filteredJobs = jobs.map(group => ({
    ...group,
    items: group.items.filter(job => {
      // Search filter
      const matchesSearch = searchQuery === "" || 
        job.customer_name.toLowerCase().includes(searchQuery.toLowerCase()) ||
        job.site_address?.toLowerCase().includes(searchQuery.toLowerCase()) ||
        job.quote_no.toString().includes(searchQuery);

      // Date filter
      let matchesFilter = true;
      const jobDate = new Date(group.job_date + 'T00:00:00');
      
      switch (activeFilter) {
        case "today":
          matchesFilter = isToday(jobDate);
          break;
        case "upcoming":
          matchesFilter = isFuture(jobDate);
          break;
        case "unscheduled":
          matchesFilter = !group.job_date;
          break;
        case "completed":
          matchesFilter = job.status.toLowerCase() === "done" || job.status.toLowerCase() === "completed";
          break;
        default:
          matchesFilter = true;
      }

      return matchesSearch && matchesFilter;
    })
  })).filter(group => group.items.length > 0);

  const totalJobs = filteredJobs.reduce((sum, g) => sum + g.items.length, 0);
  
  // Flatten for mobile view
  const allJobs = filteredJobs.flatMap(group => 
    group.items.map(item => ({ ...item, job_date: group.job_date }))
  );

  return (
    <div className="space-y-6 pb-24 md:pb-6" style={{ paddingBottom: 'calc(6rem + env(safe-area-inset-bottom))' }}>
      {/* Desktop Header */}
      <div className="hidden md:flex items-center justify-between">
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

      {/* Mobile Header */}
      <div className="md:hidden">
        <h1 className="text-2xl font-bold mb-4">Jobs</h1>
        <MobileJobsHeader
          searchQuery={searchQuery}
          onSearchChange={setSearchQuery}
          activeFilter={activeFilter}
          onFilterChange={setActiveFilter}
        />
      </div>

      {/* Desktop View */}
      <Card className="hidden md:block">
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
          ) : filteredJobs.length === 0 ? (
            <div className="text-center py-12">
              <p className="text-muted-foreground">No jobs found</p>
            </div>
          ) : (
            <JobsDesktopView
              jobs={filteredJobs}
              onViewQuote={(quoteId) => navigate(`/quote/${quoteId}`)}
              onReschedule={handleReschedule}
              onUnassign={handleUnassign}
              getStatusColor={getStatusColor}
              hideViewAction={isTinter}
              hideDeleteAction={isTinter}
            />
          )}
        </CardContent>
      </Card>

      {/* Mobile View - Card List with Date Headers */}
      <div className="md:hidden space-y-6">
        {loading ? (
          <div className="text-center py-12 text-muted-foreground">
            <div className="h-8 w-8 border-4 border-primary border-t-transparent rounded-full animate-spin mx-auto mb-4"></div>
            Loading jobs...
          </div>
        ) : filteredJobs.length === 0 ? (
          <div className="text-center py-12 px-4">
            <div className="mb-4 text-6xl">📋</div>
            <h3 className="text-lg font-semibold mb-2">No jobs found</h3>
            <p className="text-sm text-muted-foreground mb-4">
              {searchQuery || activeFilter !== "all" 
                ? "Try adjusting your filters" 
                : "Get started by creating your first job"
              }
            </p>
          </div>
        ) : (
          <>
            {filteredJobs.map((group) => (
              <div key={group.job_date} className="space-y-3">
                {/* Date Header */}
                <div className="sticky top-16 z-30 bg-background/95 backdrop-blur-sm py-2 -mx-4 px-4 border-b">
                  <div className="flex items-center gap-2">
                    <div className="h-1 w-1 rounded-full bg-primary"></div>
                    <h3 className="text-sm font-semibold text-primary">
                      {format(new Date(group.job_date + 'T00:00:00'), 'EEEE, MMMM d')}
                    </h3>
                    <Badge variant="secondary" className="text-xs">
                      {group.items.length}
                    </Badge>
                  </div>
                </div>
                
                {/* Jobs for this date */}
                {group.items.map((job) => (
                  <JobCard
                    key={job.assignment_id}
                    job={job}
                    onView={() => navigate(`/jobs/${job.assignment_id}`)}
                    onCall={() => handleCall(job)}
                    onMessage={() => handleMessage(job)}
                    onDirections={() => handleDirections(job)}
                    hideViewAction={false}
                  />
                ))}
              </div>
            ))}
          </>
        )}
      </div>

      {/* Mobile FAB - Only show for admins */}
      {!isTinter && (
        <Button
          className="md:hidden fixed bottom-20 right-4 h-14 w-14 rounded-full shadow-lg z-40 touch-manipulation"
          size="icon"
          onClick={() => navigate("/")}
          style={{
            bottom: "calc(5rem + env(safe-area-inset-bottom))"
          }}
        >
          <Plus className="h-6 w-6" />
        </Button>
      )}
    </div>
  );
}
