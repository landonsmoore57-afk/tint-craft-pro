import { useState, useEffect } from "react";
import { useNavigate } from "react-router-dom";
import { supabase } from "@/integrations/supabase/client";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { Badge } from "@/components/ui/badge";
import { Input } from "@/components/ui/input";
import { Checkbox } from "@/components/ui/checkbox";
import { useToast } from "@/hooks/use-toast";
import { Plus, Eye, Search, Download, X, Calendar as CalendarIcon } from "lucide-react";
import { format } from "date-fns";
import html2pdf from "html2pdf.js";
import { AssignToJobsDialog } from "@/components/jobs/AssignToJobsDialog";

interface Quote {
  id: string;
  quote_no: number;
  customer_name: string;
  customer_email: string | null;
  customer_phone: string | null;
  site_address: string | null;
  status: string;
  created_at: string;
  updated_at: string;
  pushed_to_jobber_at: string | null;
  is_scheduled: boolean;
}

export default function QuotesList() {
  const [quotes, setQuotes] = useState<Quote[]>([]);
  const [filteredQuotes, setFilteredQuotes] = useState<Quote[]>([]);
  const [loading, setLoading] = useState(true);
  const [searchQuery, setSearchQuery] = useState("");
  const [selectedIds, setSelectedIds] = useState<Set<string>>(new Set());
  const [statusFilter, setStatusFilter] = useState<"all" | "In-Progress" | "done">("all");
  const [jobberPushFilter, setJobberPushFilter] = useState<"all" | "yes" | "no">("all");
  const [scheduledFilter, setScheduledFilter] = useState<"all" | "scheduled" | "unscheduled">("all");
  const [exporting, setExporting] = useState(false);
  const [assignDialogOpen, setAssignDialogOpen] = useState(false);
  const navigate = useNavigate();
  const { toast } = useToast();

  useEffect(() => {
    fetchQuotes();
  }, []);

  useEffect(() => {
    filterQuotes();
  }, [quotes, searchQuery, statusFilter, jobberPushFilter, scheduledFilter]);

  const fetchQuotes = async () => {
    try {
      // Use edge function with service role to bypass RLS for PIN-based auth
      const supabaseUrl = 'https://jiyeljjdpyawaikgpkqu.supabase.co';
      const response = await fetch(`${supabaseUrl}/functions/v1/fetch-quotes`, {
        headers: {
          'Content-Type': 'application/json',
        },
      });

      if (!response.ok) {
        throw new Error('Failed to fetch quotes');
      }

      const data = await response.json();
      setQuotes(data || []);
    } catch (error: any) {
      console.error('Error fetching quotes:', error);
      toast({
        title: "Error fetching quotes",
        description: error.message,
        variant: "destructive",
      });
    } finally {
      setLoading(false);
    }
  };

  const filterQuotes = () => {
    let filtered = quotes;

    // Status filter
    if (statusFilter !== "all") {
      filtered = filtered.filter(q => q.status === statusFilter);
    }

    // Jobber Push filter
    if (jobberPushFilter !== "all") {
      filtered = filtered.filter(q => 
        jobberPushFilter === "yes" ? q.pushed_to_jobber_at !== null : q.pushed_to_jobber_at === null
      );
    }

    // Scheduled filter
    if (scheduledFilter !== "all") {
      filtered = filtered.filter(q => 
        scheduledFilter === "scheduled" ? q.is_scheduled : !q.is_scheduled
      );
    }

    // Search filter
    if (searchQuery.trim()) {
      const query = searchQuery.trim();
      const numericQuery = parseInt(query, 10);
      
      filtered = filtered.filter(q => {
        // Try numeric match on quote_no
        if (!isNaN(numericQuery) && q.quote_no === numericQuery) {
          return true;
        }
        
        // Text search on customer fields
        const searchLower = query.toLowerCase();
        return (
          q.customer_name.toLowerCase().includes(searchLower) ||
          q.customer_email?.toLowerCase().includes(searchLower) ||
          q.customer_phone?.includes(query) ||
          q.site_address?.toLowerCase().includes(searchLower)
        );
      });
    }

    setFilteredQuotes(filtered);
  };

  const handleSelectAll = (checked: boolean) => {
    if (checked) {
      setSelectedIds(new Set(filteredQuotes.map(q => q.id)));
    } else {
      setSelectedIds(new Set());
    }
  };

  const handleSelectQuote = (id: string, checked: boolean) => {
    const newSelected = new Set(selectedIds);
    if (checked) {
      newSelected.add(id);
    } else {
      newSelected.delete(id);
    }
    setSelectedIds(newSelected);
  };

  const handleBatchExport = async () => {
    setExporting(true);
    try {
      const { data, error } = await supabase.functions.invoke('batch-window-summary', {
        body: { ids: Array.from(selectedIds) },
      });

      if (error) throw error;

      // Convert HTML to PDF and download
      const element = document.createElement('div');
      element.innerHTML = data;
      element.style.width = '8.5in';
      
      const opt = {
        margin: 0.5,
        filename: `window-summary-batch-${Date.now()}.pdf`,
        image: { type: 'jpeg' as const, quality: 0.98 },
        html2canvas: { scale: 2, useCORS: true },
        jsPDF: { unit: 'in', format: 'letter', orientation: 'portrait' as const }
      };

      await html2pdf().set(opt).from(element).save();

      toast({
        title: "Export successful",
        description: `Downloaded window summary for ${selectedIds.size} quotes`,
      });

      setSelectedIds(new Set());
    } catch (error: any) {
      toast({
        title: "Export failed",
        description: error.message,
        variant: "destructive",
      });
    } finally {
      setExporting(false);
    }
  };

  const getStatusColor = (status: string) => {
    return status === "done" ? "default" : "secondary";
  };

  return (
    <div className="space-y-6">
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-3xl font-bold">Quotes</h1>
          <p className="text-muted-foreground">Manage your customer quotes</p>
        </div>
        <Button onClick={() => navigate("/quote/new")}>
          <Plus className="mr-2 h-4 w-4" />
          New Quote
        </Button>
      </div>

      {selectedIds.size > 0 && (
        <div className="fixed bottom-6 left-1/2 transform -translate-x-1/2 z-50">
          <Card className="shadow-lg border-2 border-primary/20">
            <CardContent className="flex items-center gap-4 p-4">
              <span className="font-semibold">{selectedIds.size} selected</span>
              <Button
                onClick={() => setAssignDialogOpen(true)}
                variant="secondary"
              >
                <CalendarIcon className="mr-2 h-4 w-4" />
                Assign to Jobs
              </Button>
              <Button
                onClick={handleBatchExport}
                disabled={exporting}
                variant="default"
              >
                <Download className="mr-2 h-4 w-4" />
                {exporting ? "Generating..." : "Window Summary Export"}
              </Button>
              <Button
                onClick={() => setSelectedIds(new Set())}
                variant="outline"
                size="icon"
              >
                <X className="h-4 w-4" />
              </Button>
            </CardContent>
          </Card>
        </div>
      )}

      <AssignToJobsDialog
        open={assignDialogOpen}
        onOpenChange={setAssignDialogOpen}
        quoteIds={Array.from(selectedIds)}
        onSuccess={() => {
          setSelectedIds(new Set());
          fetchQuotes();
        }}
      />

      <Card>
        <CardHeader>
          <div className="flex items-center justify-between mb-4">
            <div>
              <CardTitle>All Quotes</CardTitle>
              <CardDescription>
                {filteredQuotes.length} of {quotes.length} quote{quotes.length !== 1 ? "s" : ""}
              </CardDescription>
            </div>
            <div className="flex flex-col gap-3">
              <div className="flex items-center gap-2">
                <span className="text-sm font-medium text-muted-foreground w-20">Status:</span>
                <div className="flex gap-2">
                  <Button
                    variant={statusFilter === "all" ? "default" : "outline"}
                    size="sm"
                    onClick={() => setStatusFilter("all")}
                  >
                    All
                  </Button>
                  <Button
                    variant={statusFilter === "In-Progress" ? "default" : "outline"}
                    size="sm"
                    onClick={() => setStatusFilter("In-Progress")}
                  >
                    In-Progress
                  </Button>
                  <Button
                    variant={statusFilter === "done" ? "default" : "outline"}
                    size="sm"
                    onClick={() => setStatusFilter("done")}
                  >
                    Done
                  </Button>
                </div>
              </div>

              <div className="flex items-center gap-2">
                <span className="text-sm font-medium text-muted-foreground w-20">Jobber:</span>
                <div className="flex gap-2">
                  <Button
                    variant={jobberPushFilter === "all" ? "default" : "outline"}
                    size="sm"
                    onClick={() => setJobberPushFilter("all")}
                  >
                    All
                  </Button>
                  <Button
                    variant={jobberPushFilter === "yes" ? "default" : "outline"}
                    size="sm"
                    onClick={() => setJobberPushFilter("yes")}
                  >
                    Yes
                  </Button>
                  <Button
                    variant={jobberPushFilter === "no" ? "default" : "outline"}
                    size="sm"
                    onClick={() => setJobberPushFilter("no")}
                  >
                    No
                  </Button>
                </div>
              </div>

              <div className="flex items-center gap-2">
                <span className="text-sm font-medium text-muted-foreground w-20">Scheduled:</span>
                <div className="flex gap-2">
                  <Button
                    variant={scheduledFilter === "all" ? "default" : "outline"}
                    size="sm"
                    onClick={() => setScheduledFilter("all")}
                  >
                    All
                  </Button>
                  <Button
                    variant={scheduledFilter === "scheduled" ? "default" : "outline"}
                    size="sm"
                    onClick={() => setScheduledFilter("scheduled")}
                  >
                    Scheduled
                  </Button>
                  <Button
                    variant={scheduledFilter === "unscheduled" ? "default" : "outline"}
                    size="sm"
                    onClick={() => setScheduledFilter("unscheduled")}
                  >
                    Unscheduled
                  </Button>
                </div>
              </div>
            </div>
          </div>
          
          <div className="relative">
            <Search className="absolute left-3 top-1/2 transform -translate-y-1/2 h-4 w-4 text-muted-foreground" />
            <Input
              placeholder="Search by Quote # or customer..."
              value={searchQuery}
              onChange={(e) => setSearchQuery(e.target.value)}
              className="pl-10 pr-10"
            />
            {searchQuery && (
              <Button
                variant="ghost"
                size="icon"
                className="absolute right-1 top-1/2 transform -translate-y-1/2 h-7 w-7"
                onClick={() => setSearchQuery("")}
              >
                <X className="h-4 w-4" />
              </Button>
            )}
          </div>
        </CardHeader>
        
        <CardContent>
          <div className="rounded-md border">
            <Table>
              <TableHeader>
                <TableRow>
                  <TableHead className="w-12">
                    <Checkbox
                      checked={selectedIds.size > 0 && selectedIds.size === filteredQuotes.length}
                      onCheckedChange={handleSelectAll}
                    />
                  </TableHead>
                  <TableHead>Quote #</TableHead>
                  <TableHead>Customer</TableHead>
                  <TableHead>Site Address</TableHead>
                  <TableHead>Status</TableHead>
                  <TableHead>Jobber Push</TableHead>
                  <TableHead>Scheduled</TableHead>
                  <TableHead>Created</TableHead>
                  <TableHead className="text-right">Actions</TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {loading ? (
                  <TableRow>
                    <TableCell colSpan={9} className="text-center py-8">
                      Loading...
                    </TableCell>
                  </TableRow>
                ) : filteredQuotes.length === 0 ? (
                  <TableRow>
                    <TableCell colSpan={9} className="text-center py-8">
                      <div className="flex flex-col items-center gap-2">
                        <p className="text-muted-foreground">
                          {searchQuery || statusFilter !== "all" 
                            ? "No quotes match your filters" 
                            : "No quotes yet"}
                        </p>
                        {!searchQuery && statusFilter === "all" && (
                          <Button
                            variant="outline"
                            onClick={() => navigate("/quote/new")}
                          >
                            Create your first quote
                          </Button>
                        )}
                      </div>
                    </TableCell>
                  </TableRow>
                ) : (
                  filteredQuotes.map((quote) => (
                    <TableRow key={quote.id}>
                      <TableCell>
                        <Checkbox
                          checked={selectedIds.has(quote.id)}
                          onCheckedChange={(checked) => handleSelectQuote(quote.id, checked as boolean)}
                        />
                      </TableCell>
                      <TableCell className="font-medium font-mono">#{quote.quote_no}</TableCell>
                      <TableCell>
                        <div>
                          <div className="font-medium">{quote.customer_name}</div>
                          {quote.customer_email && (
                            <div className="text-sm text-muted-foreground">{quote.customer_email}</div>
                          )}
                        </div>
                      </TableCell>
                      <TableCell>{quote.site_address || "-"}</TableCell>
                      <TableCell>
                        <Badge variant={getStatusColor(quote.status) as any} className="capitalize">
                          {quote.status}
                        </Badge>
                      </TableCell>
                      <TableCell>
                        <Badge variant={quote.pushed_to_jobber_at ? "default" : "secondary"}>
                          {quote.pushed_to_jobber_at ? "Yes" : "No"}
                        </Badge>
                      </TableCell>
                      <TableCell>
                        <Badge variant={quote.is_scheduled ? "default" : "secondary"}>
                          {quote.is_scheduled ? "Scheduled" : "Unscheduled"}
                        </Badge>
                      </TableCell>
                      <TableCell>{format(new Date(quote.created_at), "MMM d, yyyy")}</TableCell>
                      <TableCell className="text-right">
                        <Button
                          variant="ghost"
                          size="icon"
                          onClick={() => navigate(`/quote/${quote.id}`)}
                        >
                          <Eye className="h-4 w-4" />
                        </Button>
                      </TableCell>
                    </TableRow>
                  ))
                )}
              </TableBody>
            </Table>
          </div>
        </CardContent>
      </Card>
    </div>
  );
}
