import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { Accordion, AccordionContent, AccordionItem, AccordionTrigger } from "@/components/ui/accordion";
import { Calendar } from "@/components/ui/calendar";
import { Popover, PopoverContent, PopoverTrigger } from "@/components/ui/popover";
import { Tooltip, TooltipContent, TooltipProvider, TooltipTrigger } from "@/components/ui/tooltip";
import { format } from "date-fns";
import { Calendar as CalendarIcon, Trash2, Eye } from "lucide-react";
import { formatRollPlan } from "@/lib/quoteCalculations";

interface JobGroup {
  job_date: string;
  items: any[];
}

interface JobsDesktopViewProps {
  jobs: JobGroup[];
  onViewQuote: (quoteId: string) => void;
  onReschedule: (assignmentId: string, date: Date) => void;
  onUnassign: (assignmentId: string) => void;
  onComplete?: (quoteId: string, assignmentId: string) => void;
  getStatusColor: (status: string) => string;
  hideViewAction?: boolean;
  hideDeleteAction?: boolean;
}

export function JobsDesktopView({ 
  jobs, 
  onViewQuote, 
  onReschedule, 
  onUnassign,
  onComplete,
  getStatusColor,
  hideViewAction,
  hideDeleteAction
}: JobsDesktopViewProps) {
  return (
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
                      {!hideViewAction && (
                        <Button
                          variant="ghost"
                          size="sm"
                          onClick={() => onViewQuote(job.quote_id)}
                        >
                          <Eye className="h-4 w-4 mr-2" />
                          View Quote
                        </Button>
                      )}
                      {job.status.toLowerCase() !== 'done' && onComplete && (
                        <Button
                          variant="default"
                          size="sm"
                          onClick={() => onComplete(job.quote_id, job.assignment_id)}
                        >
                          Complete
                        </Button>
                      )}
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
                            onSelect={(date) => date && onReschedule(job.assignment_id, date)}
                            disabled={(date) => date < new Date(new Date().setHours(0, 0, 0, 0))}
                            initialFocus
                          />
                        </PopoverContent>
                      </Popover>
                      {!hideDeleteAction && (
                        <Button
                          variant="ghost"
                          size="sm"
                          onClick={() => onUnassign(job.assignment_id)}
                        >
                          <Trash2 className="h-4 w-4" />
                        </Button>
                      )}
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
                        Total: {job.window_summary.reduce((sum: number, w: any) => sum + w.total_qty, 0)} windows
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
                            job.window_summary.map((size: any, idx: number) => (
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
                        {job.rooms_summary.map((room: any, idx: number) => (
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
                                    <TableHead className="text-right font-semibold">Qty</TableHead>
                                    <TableHead className="font-semibold">Roll Size</TableHead>
                                  </TableRow>
                                </TableHeader>
                                <TableBody>
                                  {room.sizes.map((size: any, sizeIdx: number) => (
                                    <TableRow key={sizeIdx}>
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
  );
}
