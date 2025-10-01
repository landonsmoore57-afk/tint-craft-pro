import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { WindowSizeRollup, formatSqft, formatRollPlan } from "@/lib/quoteCalculations";
import { Maximize2 } from "lucide-react";
import { Tooltip, TooltipContent, TooltipProvider, TooltipTrigger } from "@/components/ui/tooltip";

interface WindowSummaryProps {
  rollup: WindowSizeRollup[];
}

export function WindowSummary({ rollup }: WindowSummaryProps) {
  if (rollup.length === 0) {
    return null;
  }

  return (
    <Card className="border-primary/10">
      <CardHeader className="bg-gradient-to-r from-quote-calculation/10 to-accent/5 border-b">
        <CardTitle className="text-lg font-bold text-foreground flex items-center gap-2">
          <Maximize2 className="h-4 w-4" />
          Window Summary
        </CardTitle>
      </CardHeader>
      <CardContent className="p-0">
        <Table>
          <TableHeader>
            <TableRow>
              <TableHead>Film</TableHead>
              <TableHead>Size (W×H in)</TableHead>
              <TableHead className="text-right">Qty</TableHead>
              <TableHead>Roll Size</TableHead>
            </TableRow>
          </TableHeader>
          <TableBody>
            {rollup.map((item, idx) => (
              <TableRow key={idx}>
                <TableCell className="text-sm font-medium">{item.film_display}</TableCell>
                <TableCell className="font-mono">{item.width_in}×{item.height_in}</TableCell>
                <TableCell className="text-right font-semibold">{item.total_qty}</TableCell>
                <TableCell className="text-sm">
                  <TooltipProvider>
                    <Tooltip>
                      <TooltipTrigger asChild>
                        <span className="cursor-help">{formatRollPlan(item.roll_plan)}</span>
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
      </CardContent>
    </Card>
  );
}
