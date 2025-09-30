import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Accordion, AccordionContent, AccordionItem, AccordionTrigger } from "@/components/ui/accordion";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { Badge } from "@/components/ui/badge";
import { RoomSizeRollup, formatSqft, formatRollPlan } from "@/lib/quoteCalculations";
import { DoorOpen } from "lucide-react";
import { Tooltip, TooltipContent, TooltipProvider, TooltipTrigger } from "@/components/ui/tooltip";

interface RoomsSummaryProps {
  rollup: RoomSizeRollup[];
}

export function RoomsSummary({ rollup }: RoomsSummaryProps) {
  if (rollup.length === 0) {
    return (
      <Card className="border-primary/10">
        <CardHeader className="bg-gradient-to-r from-quote-calculation/10 to-accent/5 border-b">
          <CardTitle className="text-lg font-bold text-foreground flex items-center gap-2">
            <DoorOpen className="h-4 w-4" />
            Rooms Summary
          </CardTitle>
        </CardHeader>
        <CardContent className="p-6">
          <p className="text-muted-foreground text-center">No windows yet.</p>
        </CardContent>
      </Card>
    );
  }

  return (
    <Card className="border-primary/10">
      <CardHeader className="bg-gradient-to-r from-quote-calculation/10 to-accent/5 border-b">
        <CardTitle className="text-lg font-bold text-foreground flex items-center gap-2">
          <DoorOpen className="h-4 w-4" />
          Rooms Summary
        </CardTitle>
      </CardHeader>
      <CardContent className="p-0">
        <Accordion type="multiple" className="w-full">
          {rollup.map((room, idx) => (
            <AccordionItem key={idx} value={`room-${idx}`} className="border-b last:border-b-0">
              <AccordionTrigger className="px-6 py-4 hover:no-underline hover:bg-muted/50">
                <div className="flex items-center gap-3 w-full">
                  <span className="font-semibold text-left">{room.room_label}</span>
                  <Badge variant="secondary" className="ml-auto mr-2">
                    {room.total_windows_qty} {room.total_windows_qty === 1 ? 'window' : 'windows'}
                  </Badge>
                </div>
              </AccordionTrigger>
              <AccordionContent className="px-0 pb-0">
                <Table>
                  <TableHeader>
                    <TableRow className="bg-muted/30">
                      <TableHead className="pl-6">Size (W×H in)</TableHead>
                      <TableHead className="text-right">Area (sq ft each)</TableHead>
                      <TableHead className="text-right">Qty</TableHead>
                      <TableHead className="pr-6">Roll Size</TableHead>
                    </TableRow>
                  </TableHeader>
                  <TableBody>
                    {room.sizes.map((size, sizeIdx) => (
                      <TableRow key={sizeIdx}>
                        <TableCell className="font-mono pl-6">{size.width_in}×{size.height_in}</TableCell>
                        <TableCell className="text-right font-mono">{formatSqft(size.area_sqft_each)}</TableCell>
                        <TableCell className="text-right font-semibold">{size.total_qty}</TableCell>
                        <TableCell className="text-sm pr-6">
                          <TooltipProvider>
                            <Tooltip>
                              <TooltipTrigger asChild>
                                <span className="cursor-help">{formatRollPlan(size.roll_plan)}</span>
                              </TooltipTrigger>
                              <TooltipContent>
                                <p className="text-xs">Calculated with trim allowance of 0.5" per side</p>
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
      </CardContent>
    </Card>
  );
}
