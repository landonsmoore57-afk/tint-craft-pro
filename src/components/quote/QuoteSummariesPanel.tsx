import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Alert, AlertDescription } from "@/components/ui/alert";
import { Button } from "@/components/ui/button";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { QuoteSummary, formatCurrency } from "@/lib/quoteCalculations";
import { AlertCircle, Download } from "lucide-react";

interface QuoteSummariesPanelProps {
  summaries: QuoteSummary[];
  totalLinearFeet: number;
  validationErrors: string[];
  quoteId?: string;
  onDownloadPDF: (summaryKey?: string) => void;
}

export function QuoteSummariesPanel({ 
  summaries, 
  totalLinearFeet,
  validationErrors,
  quoteId,
  onDownloadPDF
}: QuoteSummariesPanelProps) {
  return (
    <div className="space-y-4">
      {validationErrors.length > 0 && (
        <Alert variant="destructive" className="border-destructive/20 bg-destructive/5">
          <AlertCircle className="h-4 w-4" />
          <AlertDescription className="text-sm">
            <div className="font-medium mb-2">Validation Issues:</div>
            <ul className="space-y-1">
              {validationErrors.map((error, i) => (
                <li key={i} className="flex items-start gap-2">
                  <span className="w-1 h-1 rounded-full bg-destructive mt-2 flex-shrink-0"></span>
                  <span>{error}</span>
                </li>
              ))}
            </ul>
          </AlertDescription>
        </Alert>
      )}

      <Tabs defaultValue={summaries[0]?.key || 'no_materials'} className="w-full">
        <TabsList className="grid w-full" style={{ gridTemplateColumns: `repeat(${summaries.length}, 1fr)` }}>
          {summaries.map(summary => (
            <TabsTrigger key={summary.key} value={summary.key}>
              {summary.label}
            </TabsTrigger>
          ))}
        </TabsList>
        
        {summaries.map(summary => (
          <TabsContent key={summary.key} value={summary.key}>
            <Card className="shadow-lg border-primary/10">
              <CardHeader className="bg-gradient-to-r from-quote-totals/10 to-accent/5 border-b">
                <CardTitle className="text-lg font-bold text-foreground flex items-center gap-2">
                  <div className="w-2 h-2 rounded-full bg-quote-totals"></div>
                  Quote Summary — {summary.label}
                </CardTitle>
              </CardHeader>
              <CardContent className="space-y-4 p-6">
                <div className="space-y-3">
                  <div className="flex justify-between items-center text-sm">
                    <span className="text-muted-foreground">Subtotal</span>
                    <span className="font-semibold font-mono">{formatCurrency(summary.subtotal)}</span>
                  </div>
                  
                  {summary.materials_total > 0 && (
                    <div className="flex flex-col gap-1 text-sm">
                      <div className="flex justify-between items-center">
                        <span className="text-muted-foreground">Materials ({summary.label})</span>
                        <span className="font-semibold font-mono text-primary">{formatCurrency(summary.materials_total)}</span>
                      </div>
                      <div className="text-xs text-muted-foreground pl-4">
                        {totalLinearFeet.toFixed(2)} ft @ {formatCurrency(summary.materials_unit_price_sell)}/ft
                      </div>
                    </div>
                  )}

                  {summary.discount_flat_amount > 0 && (
                    <div className="flex justify-between items-center text-sm">
                      <span className="text-muted-foreground">Discount (Flat)</span>
                      <span className="font-semibold font-mono text-accent">-{formatCurrency(summary.discount_flat_amount)}</span>
                    </div>
                  )}
                  
                  {summary.discount_percent_amount > 0 && (
                    <div className="flex justify-between items-center text-sm">
                      <span className="text-muted-foreground">Discount (%)</span>
                      <span className="font-semibold font-mono text-accent">-{formatCurrency(summary.discount_percent_amount)}</span>
                    </div>
                  )}
                  
                  {summary.travel_fee > 0 && (
                    <div className="flex justify-between items-center text-sm">
                      <span className="text-muted-foreground">Travel Fee</span>
                      <span className="font-semibold font-mono">{formatCurrency(summary.travel_fee)}</span>
                    </div>
                  )}
                  
                  <div className="flex justify-between items-center text-sm">
                    <span className="text-muted-foreground">Tax</span>
                    <span className="font-semibold font-mono">{formatCurrency(summary.tax_amount)}</span>
                  </div>
                </div>
                
                <div className="border-t border-border pt-4">
                  <div className="flex justify-between items-center">
                    <span className="font-bold text-lg">Grand Total</span>
                    <span className="font-bold text-xl text-quote-totals font-mono">
                      {formatCurrency(summary.grand_total)}
                    </span>
                  </div>
                </div>
                
                {summary.deposit_due > 0 && (
                  <div className="bg-quote-calculation rounded-lg p-4 border border-quote-calculation-foreground/20">
                    <div className="flex justify-between items-center">
                      <div>
                        <div className="font-semibold text-quote-calculation-foreground">Deposit Due</div>
                        <div className="text-xs text-quote-calculation-foreground/70 uppercase tracking-wide">
                          Due upon signing
                        </div>
                      </div>
                      <span className="font-bold text-lg text-quote-calculation-foreground font-mono">
                        {formatCurrency(summary.deposit_due)}
                      </span>
                    </div>
                  </div>
                )}

                {quoteId && quoteId !== 'new' && (
                  <div className="flex flex-col gap-2 pt-4">
                    <Button onClick={() => onDownloadPDF(summary.key)} variant="outline" className="w-full">
                      <Download className="mr-2 h-4 w-4" />
                      Download PDF ({summary.label})
                    </Button>
                  </div>
                )}
              </CardContent>
            </Card>
          </TabsContent>
        ))}
      </Tabs>

      {quoteId && quoteId !== 'new' && summaries.length > 1 && (
        <Button onClick={() => onDownloadPDF('all')} variant="default" className="w-full">
          <Download className="mr-2 h-4 w-4" />
          Download PDF (All Summaries)
        </Button>
      )}
    </div>
  );
}
