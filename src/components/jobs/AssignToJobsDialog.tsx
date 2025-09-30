import { useState } from "react";
import { Dialog, DialogContent, DialogDescription, DialogFooter, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import { Button } from "@/components/ui/button";
import { Calendar } from "@/components/ui/calendar";
import { supabase } from "@/integrations/supabase/client";
import { useToast } from "@/hooks/use-toast";
import { format } from "date-fns";
import { useNavigate } from "react-router-dom";

interface AssignToJobsDialogProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  quoteIds: string[];
  onSuccess?: () => void;
}

export function AssignToJobsDialog({ open, onOpenChange, quoteIds, onSuccess }: AssignToJobsDialogProps) {
  const [selectedDate, setSelectedDate] = useState<Date>();
  const [loading, setLoading] = useState(false);
  const { toast } = useToast();
  const navigate = useNavigate();

  const handleAssign = async () => {
    if (!selectedDate) return;

    setLoading(true);
    try {
      const jobDate = format(selectedDate, 'yyyy-MM-dd');
      const { data: { user } } = await supabase.auth.getUser();

      let assigned = 0;
      let reassigned = 0;

      // Upsert each quote assignment
      for (const quoteId of quoteIds) {
        // Check if assignment exists
        const { data: existing } = await supabase
          .from('job_assignments')
          .select('id')
          .eq('quote_id', quoteId)
          .maybeSingle();

        if (existing) {
          // Update existing
          const { error } = await supabase
            .from('job_assignments')
            .update({ job_date: jobDate })
            .eq('id', existing.id);

          if (error) throw error;
          reassigned++;
        } else {
          // Insert new
          const { error } = await supabase
            .from('job_assignments')
            .insert({
              quote_id: quoteId,
              job_date: jobDate,
              assigned_by: user?.id,
            });

          if (error) throw error;
          assigned++;
        }
      }

      const total = assigned + reassigned;
      const message = reassigned > 0
        ? `Assigned ${assigned} and reassigned ${reassigned} job(s) to ${format(selectedDate, 'MMM d, yyyy')}`
        : `Assigned ${total} job(s) to ${format(selectedDate, 'MMM d, yyyy')}`;

      toast({
        title: "Jobs assigned",
        description: message,
        action: (
          <Button variant="outline" size="sm" onClick={() => navigate(`/jobs?date=${jobDate}`)}>
            View Jobs
          </Button>
        ),
      });

      onSuccess?.();
      onOpenChange(false);
      setSelectedDate(undefined);
    } catch (error: any) {
      toast({
        title: "Assignment failed",
        description: error.message,
        variant: "destructive",
      });
    } finally {
      setLoading(false);
    }
  };

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent>
        <DialogHeader>
          <DialogTitle>Assign to Jobs</DialogTitle>
          <DialogDescription>
            Select a date to schedule {quoteIds.length} quote{quoteIds.length > 1 ? 's' : ''} for installation.
          </DialogDescription>
        </DialogHeader>

        <div className="flex justify-center py-4">
          <Calendar
            mode="single"
            selected={selectedDate}
            onSelect={setSelectedDate}
            disabled={(date) => date < new Date(new Date().setHours(0, 0, 0, 0))}
            initialFocus
          />
        </div>

        <DialogFooter>
          <Button variant="outline" onClick={() => onOpenChange(false)} disabled={loading}>
            Cancel
          </Button>
          <Button onClick={handleAssign} disabled={!selectedDate || loading}>
            {loading ? "Assigning..." : "Assign"}
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}
