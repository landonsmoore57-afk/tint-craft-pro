import { useState, useEffect } from "react";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Badge } from "@/components/ui/badge";
import { Switch } from "@/components/ui/switch";
import { Plus, Trash2, Settings2, Eraser, DollarSign } from "lucide-react";
import { SectionData, SectionCalculation, FilmData, WindowData } from "@/lib/quoteCalculations";
import { formatCurrency, formatSqft } from "@/lib/quoteCalculations";
import { RoomSelector } from "./RoomSelector";
import { FilmSelector } from "./FilmSelector";
import { supabase } from "@/integrations/supabase/client";
import { QuoteDimsPill } from "@/components/QuoteDimsPill";

interface QuoteSectionProps {
  section: SectionData;
  sectionIndex: number;
  films: FilmData[];
  calculation?: SectionCalculation;
  onUpdateSection: (sectionId: string, updates: Partial<SectionData>) => void;
  onDeleteSection: (sectionId: string) => void;
  onAddWindow: (sectionId: string) => void;
  onUpdateWindow: (sectionId: string, windowId: string, updates: Partial<WindowData>) => void;
  onDeleteWindow: (sectionId: string, windowId: string) => void;
}

export function QuoteSection({
  section,
  sectionIndex,
  films,
  calculation,
  onUpdateSection,
  onDeleteSection,
  onAddWindow,
  onUpdateWindow,
  onDeleteWindow,
}: QuoteSectionProps) {
  const [roomName, setRoomName] = useState<string | null>(null);
  const [quoteDimsExpanded, setQuoteDimsExpanded] = useState<Record<string, boolean>>({});

  useEffect(() => {
    const fetchRoomName = async () => {
      if (!section.room_id) {
        setRoomName(null);
        return;
      }
      
      try {
        const { data, error } = await supabase
          .from("rooms")
          .select("name")
          .eq("id", section.room_id)
          .single();
        
        if (error) throw error;
        setRoomName(data?.name || null);
      } catch (error) {
        console.error("Error fetching room name:", error);
        setRoomName(null);
      }
    };

    fetchRoomName();
  }, [section.room_id]);

  const displayTitle = section.custom_room_name || roomName || `Section ${sectionIndex + 1}`;

  const toggleQuoteDims = (windowId: string) => {
    setQuoteDimsExpanded(prev => ({ ...prev, [windowId]: !prev[windowId] }));
  };

  const hasQuoteDims = (window: WindowData) => {
    return window.quote_width_in != null && window.quote_height_in != null;
  };

  const clearQuoteDims = (windowId: string) => {
    onUpdateWindow(section.id, windowId, { quote_width_in: null, quote_height_in: null });
    setQuoteDimsExpanded(prev => ({ ...prev, [windowId]: false }));
  };

  return (
    <Card className="bg-quote-section border-quote-section-border shadow-sm hover:shadow-md transition-shadow">
      <CardHeader className="bg-gradient-to-r from-primary/5 to-accent/5 border-b border-quote-section-border">
        <div className="flex items-center justify-between gap-4">
          <div className="flex-1 space-y-3">
            <div className="flex items-center gap-2">
              <div className="w-2 h-2 rounded-full bg-primary"></div>
              <Label className="text-base font-semibold text-foreground">{displayTitle}</Label>
              {section.is_price_overridden && (
                <Badge variant="secondary" className="text-xs gap-1">
                  <DollarSign className="h-3 w-3" />
                  Manual Section Price
                </Badge>
              )}
            </div>
            <div>
              <Label className="text-sm font-medium text-muted-foreground">Room / Area</Label>
              <RoomSelector
                value={section.room_id}
                onChange={(roomId) => onUpdateSection(section.id, { room_id: roomId })}
              />
            </div>
            {section.room_id && (
              <div>
                <Label className="text-sm font-medium text-muted-foreground">Custom Name</Label>
                <Input
                  value={section.custom_room_name || ""}
                  onChange={(e) => onUpdateSection(section.id, { custom_room_name: e.target.value || null })}
                  placeholder="Custom name for this section (optional)"
                  className="text-sm bg-background"
                />
              </div>
            )}
          </div>
          <Button 
            variant="ghost" 
            size="icon" 
            onClick={() => onDeleteSection(section.id)}
            className="text-muted-foreground hover:text-destructive hover:bg-destructive/10"
          >
            <Trash2 className="h-4 w-4" />
          </Button>
        </div>
        <div className="pt-2">
          <Label className="text-sm font-medium text-muted-foreground">Film Override for Section</Label>
          <FilmSelector
            value={section.section_film_id}
            onChange={(filmId) => onUpdateSection(section.id, { section_film_id: filmId })}
            placeholder="Use quote default film..."
          />
        </div>
        
        {calculation && (
          <div className="pt-3 space-y-3">
            <div className="bg-muted/30 p-3 rounded-md border">
              <div className="flex items-center justify-between mb-2">
                <Label className="text-xs font-medium uppercase tracking-wide">Section Total Override</Label>
                <Switch
                  checked={section.is_price_overridden || false}
                  onCheckedChange={(checked) => {
                    onUpdateSection(section.id, { 
                      is_price_overridden: checked,
                      manual_override_total: checked ? calculation.section_total : null
                    });
                  }}
                />
              </div>
              
              {section.is_price_overridden ? (
                <div className="space-y-2">
                  <Label className="text-xs text-muted-foreground">Manual Section Total</Label>
                  <Input
                    type="number"
                    step="0.01"
                    min="0"
                    value={section.manual_override_total ?? ""}
                    onChange={(e) => {
                      const val = parseFloat(e.target.value);
                      onUpdateSection(section.id, { manual_override_total: val || 0 });
                    }}
                    className="bg-background"
                    placeholder="Enter manual section total"
                  />
                  <p className="text-xs text-muted-foreground">
                    Auto-calculated: {formatCurrency(calculation.section_total)}
                  </p>
                </div>
              ) : (
                <div className="text-sm font-bold">
                  Section Total: {formatCurrency(calculation.section_total)}
                </div>
              )}
            </div>
          </div>
        )}
      </CardHeader>
      <CardContent className="space-y-4 p-6">
        {section.windows.map((window, wIndex) => {
          const calc = calculation?.windows.find(w => w.id === window.id);
          return (
            <div key={window.id} className="bg-quote-window border border-quote-window-border rounded-lg p-4 space-y-4 transition-colors hover:bg-quote-window/80">
              <div className="flex items-center justify-between gap-4">
                <div className="flex items-center gap-2 flex-1">
                  <div className="w-1.5 h-1.5 rounded-full bg-accent"></div>
                  <Input
                    value={window.label}
                    onChange={(e) => onUpdateWindow(section.id, window.id, { label: e.target.value })}
                    className="font-medium bg-background border-0 shadow-none focus-visible:ring-1"
                    placeholder="Window name..."
                  />
                  {hasQuoteDims(window) && <QuoteDimsPill className="ml-1" />}
                </div>
                <div className="flex items-center gap-1">
                  <Button 
                    variant="ghost" 
                    size="icon"
                    onClick={() => toggleQuoteDims(window.id)}
                    className="text-muted-foreground hover:text-primary hover:bg-primary/10 h-8 w-8"
                    title="Add Quote dimensions (used for pricing)"
                  >
                    <Settings2 className="h-3.5 w-3.5" />
                  </Button>
                  <Button 
                    variant={(window.film_removal_fee_per_sqft ?? 0) > 0 ? "default" : "ghost"}
                    size="icon"
                    onClick={() => {
                      const currentFee = window.film_removal_fee_per_sqft ?? 0;
                      onUpdateWindow(section.id, window.id, { 
                        film_removal_fee_per_sqft: currentFee > 0 ? 0 : 2 
                      });
                    }}
                    className="h-8 w-8"
                    title="Film Removal (+$2/sqft)"
                  >
                    <Eraser className="h-3.5 w-3.5" />
                  </Button>
                  <Button 
                    variant="ghost" 
                    size="icon" 
                    onClick={() => onDeleteWindow(section.id, window.id)}
                    className="text-muted-foreground hover:text-destructive hover:bg-destructive/10 h-8 w-8"
                  >
                    <Trash2 className="h-3.5 w-3.5" />
                  </Button>
                </div>
              </div>
              
              <div className="space-y-3">
                <div>
                  <Label className="text-xs font-semibold text-foreground uppercase tracking-wide mb-2 block">Exact (Measured)</Label>
                  <div className="grid grid-cols-2 md:grid-cols-4 gap-3">
                    <div className="space-y-1">
                      <Label className="text-xs font-medium text-muted-foreground uppercase tracking-wide">Width (in)</Label>
                      <Input
                        type="number"
                        inputMode="numeric"
                        min="1"
                        step="1"
                        value={window.width_in}
                        onFocus={(e) => {
                          requestAnimationFrame(() => e.target.select());
                        }}
                        onChange={(e) => {
                          const val = e.target.value;
                          if (val === "") return;
                          const newVal = Math.max(1, parseInt(val) || 1);
                          onUpdateWindow(section.id, window.id, { width_in: newVal });
                        }}
                        className="bg-background text-center font-mono"
                      />
                    </div>
                    <div className="space-y-1">
                      <Label className="text-xs font-medium text-muted-foreground uppercase tracking-wide">Height (in)</Label>
                      <Input
                        type="number"
                        inputMode="numeric"
                        min="1"
                        step="1"
                        value={window.height_in}
                        onFocus={(e) => {
                          requestAnimationFrame(() => e.target.select());
                        }}
                        onChange={(e) => {
                          const val = e.target.value;
                          if (val === "") return;
                          const newVal = Math.max(1, parseInt(val) || 1);
                          onUpdateWindow(section.id, window.id, { height_in: newVal });
                        }}
                        className="bg-background text-center font-mono"
                      />
                    </div>
                    <div className="space-y-1">
                      <Label className="text-xs font-medium text-muted-foreground uppercase tracking-wide">Quantity</Label>
                      <Input
                        type="number"
                        inputMode="numeric"
                        min="1"
                        step="1"
                        value={window.quantity}
                        onFocus={(e) => {
                          requestAnimationFrame(() => e.target.select());
                        }}
                        onChange={(e) => {
                          const val = e.target.value;
                          if (val === "") return;
                          const newVal = Math.max(1, parseInt(val) || 1);
                          onUpdateWindow(section.id, window.id, { quantity: newVal });
                        }}
                        className="bg-background text-center font-mono"
                      />
                    </div>
                    <div className="space-y-1">
                      <Label className="text-xs font-medium text-muted-foreground uppercase tracking-wide">Waste %</Label>
                      <Input
                        type="number"
                        step="0.1"
                        value={window.waste_factor_percent}
                        onChange={(e) => onUpdateWindow(section.id, window.id, { waste_factor_percent: parseFloat(e.target.value) || 0 })}
                        className="bg-background text-center font-mono"
                      />
                    </div>
                  </div>
                </div>

                {(quoteDimsExpanded[window.id] || hasQuoteDims(window)) && (
                  <div className="bg-primary/5 border border-primary/20 rounded-lg p-3 space-y-2">
                    <div className="flex items-center justify-between">
                      <Label className="text-xs font-semibold text-primary uppercase tracking-wide">Quote Dimensions (Pricing Only)</Label>
                      {hasQuoteDims(window) && (
                        <Button
                          variant="ghost"
                          size="sm"
                          onClick={() => clearQuoteDims(window.id)}
                          className="text-xs h-6 px-2 text-muted-foreground hover:text-destructive"
                        >
                          Reset to Exact
                        </Button>
                      )}
                    </div>
                    <p className="text-xs text-muted-foreground">Used only for pricing and quote summaries. Jobs use Exact.</p>
                    <div className="grid grid-cols-2 gap-3">
                      <div className="space-y-1">
                        <Label className="text-xs font-medium text-muted-foreground uppercase tracking-wide">Quote Width (in)</Label>
                        <Input
                          type="number"
                          inputMode="numeric"
                          min="1"
                          step="1"
                          value={window.quote_width_in ?? ""}
                          placeholder={window.width_in.toString()}
                          onFocus={(e) => {
                            requestAnimationFrame(() => e.target.select());
                          }}
                          onChange={(e) => {
                            const val = e.target.value;
                            if (val === "") {
                              onUpdateWindow(section.id, window.id, { quote_width_in: null });
                              return;
                            }
                            const newVal = Math.max(1, parseInt(val) || 1);
                            onUpdateWindow(section.id, window.id, { quote_width_in: newVal });
                          }}
                          className="bg-background text-center font-mono border-primary/30"
                        />
                      </div>
                      <div className="space-y-1">
                        <Label className="text-xs font-medium text-muted-foreground uppercase tracking-wide">Quote Height (in)</Label>
                        <Input
                          type="number"
                          inputMode="numeric"
                          min="1"
                          step="1"
                          value={window.quote_height_in ?? ""}
                          placeholder={window.height_in.toString()}
                          onFocus={(e) => {
                            requestAnimationFrame(() => e.target.select());
                          }}
                          onChange={(e) => {
                            const val = e.target.value;
                            if (val === "") {
                              onUpdateWindow(section.id, window.id, { quote_height_in: null });
                              return;
                            }
                            const newVal = Math.max(1, parseInt(val) || 1);
                            onUpdateWindow(section.id, window.id, { quote_height_in: newVal });
                          }}
                          className="bg-background text-center font-mono border-primary/30"
                        />
                      </div>
                    </div>
                  </div>
                )}
              </div>
              
              <div className="space-y-1">
                <Label className="text-xs font-medium text-muted-foreground uppercase tracking-wide">Film Override</Label>
                <FilmSelector
                  value={window.window_film_id}
                  onChange={(filmId) => onUpdateWindow(section.id, window.id, { window_film_id: filmId })}
                  placeholder="Use section/quote default..."
                />
              </div>
              
              {calc && (
                <div className="space-y-3">
                  <div className="bg-quote-calculation text-quote-calculation-foreground p-3 rounded-md border">
                    <div className="grid grid-cols-1 md:grid-cols-3 gap-2 text-sm">
                      <div className="flex justify-between md:flex-col md:justify-start">
                        <span className="text-xs uppercase tracking-wide opacity-80">
                          Area {calc.used_dims === 'quote' && <span className="text-primary">(Quote)</span>}
                        </span>
                        <span className="font-semibold">{formatSqft(calc.effective_area_sqft)} sqft</span>
                      </div>
                      <div className="flex justify-between md:flex-col md:justify-start">
                        <span className="text-xs uppercase tracking-wide opacity-80">Rate</span>
                        <span className="font-semibold">{formatCurrency(calc.sell_per_sqft)}/sqft</span>
                      </div>
                      <div className="flex justify-between md:flex-col md:justify-start">
                        <span className="text-xs uppercase tracking-wide opacity-80">Line Total</span>
                        <span className="font-bold text-base">{formatCurrency(calc.line_total)}</span>
                      </div>
                    </div>
                  </div>

                  <div className="bg-muted/30 p-3 rounded-md border space-y-3">
                    <div className="flex items-center justify-between">
                      <Label className="text-xs font-medium uppercase tracking-wide">Manual Price Override</Label>
                      <div className="flex items-center gap-2">
                        {window.is_price_overridden && (
                          <Badge variant="secondary" className="text-xs gap-1">
                            <DollarSign className="h-3 w-3" />
                            Manual
                          </Badge>
                        )}
                        <Switch
                          checked={window.is_price_overridden || false}
                          onCheckedChange={(checked) => {
                            onUpdateWindow(section.id, window.id, { 
                              is_price_overridden: checked,
                              manual_price: checked ? calc.line_total : null
                            });
                          }}
                        />
                      </div>
                    </div>
                    
                    {window.is_price_overridden && (
                      <div className="space-y-2">
                        <Label className="text-xs text-muted-foreground">Manual Price</Label>
                        <Input
                          type="number"
                          step="0.01"
                          min="0"
                          value={window.manual_price ?? ""}
                          onChange={(e) => {
                            const val = parseFloat(e.target.value);
                            onUpdateWindow(section.id, window.id, { manual_price: val || 0 });
                          }}
                          className="bg-background"
                          placeholder="Enter manual price"
                        />
                        <p className="text-xs text-muted-foreground">
                          Auto-calculated: {formatCurrency(calc.line_total)}
                        </p>
                      </div>
                    )}
                  </div>
                </div>
              )}
            </div>
          );
        })}
        <Button 
          onClick={() => onAddWindow(section.id)} 
          variant="outline" 
          className="w-full border-dashed border-2 hover:border-primary hover:bg-primary/5 transition-colors"
        >
          <Plus className="mr-2 h-4 w-4" />
          Add Window
        </Button>
      </CardContent>
    </Card>
  );
}
