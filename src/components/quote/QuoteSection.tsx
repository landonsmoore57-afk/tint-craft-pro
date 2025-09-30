import { useState, useEffect } from "react";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Plus, Trash2 } from "lucide-react";
import { SectionData, SectionCalculation, FilmData, WindowData } from "@/lib/quoteCalculations";
import { formatCurrency, formatSqft } from "@/lib/quoteCalculations";
import { RoomSelector } from "./RoomSelector";
import { supabase } from "@/integrations/supabase/client";

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

  return (
    <Card className="bg-quote-section border-quote-section-border shadow-sm hover:shadow-md transition-shadow">
      <CardHeader className="bg-gradient-to-r from-primary/5 to-accent/5 border-b border-quote-section-border">
        <div className="flex items-center justify-between gap-4">
          <div className="flex-1 space-y-3">
            <div className="flex items-center gap-2">
              <div className="w-2 h-2 rounded-full bg-primary"></div>
              <Label className="text-base font-semibold text-foreground">{displayTitle}</Label>
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
          <Select
            value={section.section_film_id || "none"}
            onValueChange={(v) => onUpdateSection(section.id, { section_film_id: v === "none" ? null : v })}
          >
            <SelectTrigger className="bg-background">
              <SelectValue placeholder="Use quote default film..." />
            </SelectTrigger>
            <SelectContent>
              <SelectItem value="none">Use quote default</SelectItem>
              {films.map((film) => (
                <SelectItem key={film.id} value={film.id}>
                  <div className="flex flex-col">
                    <span className="font-medium">{film.brand} {film.series} - {film.name}</span>
                    <span className="text-xs text-muted-foreground">{film.vlt}% VLT • ${film.sell_per_sqft}/sqft</span>
                  </div>
                </SelectItem>
              ))}
            </SelectContent>
          </Select>
        </div>
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
                </div>
                <Button 
                  variant="ghost" 
                  size="icon" 
                  onClick={() => onDeleteWindow(section.id, window.id)}
                  className="text-muted-foreground hover:text-destructive hover:bg-destructive/10 h-8 w-8"
                >
                  <Trash2 className="h-3.5 w-3.5" />
                </Button>
              </div>
              
              <div className="grid grid-cols-2 md:grid-cols-4 gap-3">
                <div className="space-y-1">
                  <Label className="text-xs font-medium text-muted-foreground uppercase tracking-wide">Width (in)</Label>
                  <Input
                    type="number"
                    inputMode="decimal"
                    value={window.width_in}
                    onFocus={(e) => {
                      e.target.dataset.prev = e.target.value;
                      e.target.value = '';
                    }}
                    onBlur={(e) => {
                      const val = e.target.value.trim();
                      if (val === '') {
                        e.target.value = e.target.dataset.prev || '0';
                      }
                      onUpdateWindow(section.id, window.id, { width_in: Math.max(0, parseInt(e.target.value) || 0) });
                    }}
                    onChange={(e) => {
                      // Allow typing without triggering updates
                    }}
                    className="bg-background text-center font-mono"
                  />
                </div>
                <div className="space-y-1">
                  <Label className="text-xs font-medium text-muted-foreground uppercase tracking-wide">Height (in)</Label>
                  <Input
                    type="number"
                    inputMode="decimal"
                    value={window.height_in}
                    onFocus={(e) => {
                      e.target.dataset.prev = e.target.value;
                      e.target.value = '';
                    }}
                    onBlur={(e) => {
                      const val = e.target.value.trim();
                      if (val === '') {
                        e.target.value = e.target.dataset.prev || '0';
                      }
                      onUpdateWindow(section.id, window.id, { height_in: Math.max(0, parseInt(e.target.value) || 0) });
                    }}
                    onChange={(e) => {
                      // Allow typing without triggering updates
                    }}
                    className="bg-background text-center font-mono"
                  />
                </div>
                <div className="space-y-1">
                  <Label className="text-xs font-medium text-muted-foreground uppercase tracking-wide">Quantity</Label>
                  <Input
                    type="number"
                    value={window.quantity}
                    onChange={(e) => onUpdateWindow(section.id, window.id, { quantity: parseInt(e.target.value) || 1 })}
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
              
              <div className="space-y-1">
                <Label className="text-xs font-medium text-muted-foreground uppercase tracking-wide">Film Override</Label>
                <Select
                  value={window.window_film_id || "none"}
                  onValueChange={(v) => onUpdateWindow(section.id, window.id, { window_film_id: v === "none" ? null : v })}
                >
                  <SelectTrigger className="bg-background">
                    <SelectValue placeholder="Use section/quote default..." />
                  </SelectTrigger>
                  <SelectContent>
                    <SelectItem value="none">Use default</SelectItem>
                    {films.map((film) => (
                      <SelectItem key={film.id} value={film.id}>
                        <div className="flex flex-col">
                          <span className="font-medium">{film.brand} {film.series} - {film.name}</span>
                          <span className="text-xs text-muted-foreground">{film.vlt}% VLT • ${film.sell_per_sqft}/sqft</span>
                        </div>
                      </SelectItem>
                    ))}
                  </SelectContent>
                </Select>
              </div>
              
              {calc && (
                <div className="bg-quote-calculation text-quote-calculation-foreground p-3 rounded-md border">
                  <div className="grid grid-cols-1 md:grid-cols-3 gap-2 text-sm">
                    <div className="flex justify-between md:flex-col md:justify-start">
                      <span className="text-xs uppercase tracking-wide opacity-80">Area</span>
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
