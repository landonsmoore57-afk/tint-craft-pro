import { useState, useEffect } from "react";
import { useNavigate, useParams } from "react-router-dom";
import { supabase } from "@/integrations/supabase/client";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Textarea } from "@/components/ui/textarea";
import { useToast } from "@/hooks/use-toast";
import { Plus, Save, ArrowLeft, Download } from "lucide-react";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Switch } from "@/components/ui/switch";
import { QuoteSection } from "@/components/quote/QuoteSection";
import { QuoteTotalsPanel } from "@/components/quote/QuoteTotalsPanel";
import { calculateQuote, FilmData, SectionData, WindowData } from "@/lib/quoteCalculations";
import { format } from "date-fns";

export default function QuoteBuilder() {
  const { id } = useParams();
  const navigate = useNavigate();
  const { toast } = useToast();
  const [loading, setLoading] = useState(false);
  const [films, setFilms] = useState<FilmData[]>([]);

  // Quote header data
  const [customerName, setCustomerName] = useState("");
  const [customerEmail, setCustomerEmail] = useState("");
  const [customerPhone, setCustomerPhone] = useState("");
  const [siteAddress, setSiteAddress] = useState("");
  const [status, setStatus] = useState("Draft");
  
  // Quote settings
  const [globalFilmId, setGlobalFilmId] = useState<string | null>(null);
  const [taxPercent, setTaxPercent] = useState("0");
  const [discountFlat, setDiscountFlat] = useState("0");
  const [discountPercent, setDiscountPercent] = useState("0");
  const [travelFee, setTravelFee] = useState("0");
  const [depositPercent, setDepositPercent] = useState("0");
  const [travelTaxable, setTravelTaxable] = useState(false);
  const [notesCustomer, setNotesCustomer] = useState("");
  const [notesInternal, setNotesInternal] = useState("");

  // Sections and windows
  const [sections, setSections] = useState<SectionData[]>([
    {
      id: crypto.randomUUID(),
      name: "Main Area",
      room_id: null,
      custom_room_name: null,
      section_film_id: null,
      windows: [],
    },
  ]);

  useEffect(() => {
    fetchFilms();
    if (id && id !== "new") {
      loadQuote(id);
    }
  }, [id]);

  const fetchFilms = async () => {
    try {
      const { data, error } = await supabase
        .from("films")
        .select("*")
        .eq("active", true)
        .order("brand", { ascending: true });

      if (error) throw error;
      setFilms(data || []);
    } catch (error: any) {
      toast({
        title: "Error fetching films",
        description: error.message,
        variant: "destructive",
      });
    }
  };

  const loadQuote = async (quoteId: string) => {
    try {
      setLoading(true);
      
      const { data: quote, error: quoteError } = await supabase
        .from("quotes")
        .select("*")
        .eq("id", quoteId)
        .single();

      if (quoteError) throw quoteError;

      const { data: sectionsData, error: sectionsError } = await supabase
        .from("sections")
        .select("*")
        .eq("quote_id", quoteId)
        .order("position", { ascending: true });

      if (sectionsError) throw sectionsError;

      const { data: windowsData, error: windowsError } = await supabase
        .from("windows")
        .select("*")
        .in("section_id", sectionsData.map(s => s.id))
        .order("position", { ascending: true });

      if (windowsError) throw windowsError;

      // Populate form with quote data
      setCustomerName(quote.customer_name);
      setCustomerEmail(quote.customer_email || "");
      setCustomerPhone(quote.customer_phone || "");
      setSiteAddress(quote.site_address || "");
      setStatus(quote.status);
      setGlobalFilmId(quote.global_film_id);
      setTaxPercent(quote.tax_percent.toString());
      setDiscountFlat(quote.discount_flat.toString());
      setDiscountPercent(quote.discount_percent.toString());
      setTravelFee(quote.travel_fee.toString());
      setDepositPercent(quote.deposit_percent.toString());
      setTravelTaxable(quote.travel_taxable);
      setNotesCustomer(quote.notes_customer || "");
      setNotesInternal(quote.notes_internal || "");

      // Build sections with windows
      const loadedSections: SectionData[] = sectionsData.map(section => ({
        id: section.id,
        name: section.name,
        room_id: section.room_id,
        custom_room_name: section.custom_room_name,
        section_film_id: section.section_film_id,
        windows: windowsData
          .filter(w => w.section_id === section.id)
          .map(w => ({
            id: w.id,
            label: w.label,
            width_in: w.width_in,
            height_in: w.height_in,
            quantity: w.quantity,
            waste_factor_percent: w.waste_factor_percent,
            window_film_id: w.window_film_id,
            override_sell_per_sqft: w.override_sell_per_sqft,
          })),
      }));

      setSections(loadedSections);
    } catch (error: any) {
      toast({
        title: "Error loading quote",
        description: error.message,
        variant: "destructive",
      });
      navigate("/");
    } finally {
      setLoading(false);
    }
  };

  const generateQuoteNumber = () => {
    const date = format(new Date(), "yyyyMMdd");
    const random = Math.floor(Math.random() * 9999).toString().padStart(4, "0");
    return `Q-${date}-${random}`;
  };

  const saveQuote = async () => {
    if (!customerName.trim()) {
      toast({
        title: "Validation Error",
        description: "Customer name is required",
        variant: "destructive",
      });
      return;
    }

    try {
      setLoading(true);

      const { data: { user } } = await supabase.auth.getUser();
      if (!user) throw new Error("Not authenticated");

      const quoteData = {
        quote_number: id && id !== "new" ? undefined : generateQuoteNumber(),
        customer_name: customerName,
        customer_email: customerEmail || null,
        customer_phone: customerPhone || null,
        site_address: siteAddress || null,
        status,
        global_film_id: globalFilmId,
        discount_flat: parseFloat(discountFlat) || 0,
        discount_percent: parseFloat(discountPercent) || 0,
        tax_percent: parseFloat(taxPercent) || 0,
        travel_fee: parseFloat(travelFee) || 0,
        deposit_percent: parseFloat(depositPercent) || 0,
        travel_taxable: travelTaxable,
        notes_internal: notesInternal || null,
        notes_customer: notesCustomer || null,
        created_by: user.id,
      };

      let quoteId = id;

      if (!id || id === "new") {
        // Create new quote
        const { data: newQuote, error: quoteError } = await supabase
          .from("quotes")
          .insert([quoteData])
          .select()
          .single();

        if (quoteError) throw quoteError;
        quoteId = newQuote.id;
      } else {
        // Update existing quote
        const { error: quoteError } = await supabase
          .from("quotes")
          .update(quoteData)
          .eq("id", id);

        if (quoteError) throw quoteError;

        // Delete existing sections and windows (cascade will handle windows)
        await supabase.from("sections").delete().eq("quote_id", id);
      }

      // Insert sections and windows
      for (let sIndex = 0; sIndex < sections.length; sIndex++) {
        const section = sections[sIndex];
        
        const { data: newSection, error: sectionError } = await supabase
          .from("sections")
          .insert([{
            quote_id: quoteId,
            name: section.name,
            room_id: section.room_id,
            custom_room_name: section.custom_room_name,
            section_film_id: section.section_film_id,
            position: sIndex,
          }])
          .select()
          .single();

        if (sectionError) throw sectionError;

        // Insert windows
        if (section.windows.length > 0) {
          const windowsToInsert = section.windows.map((window, wIndex) => ({
            section_id: newSection.id,
            label: window.label,
            width_in: window.width_in,
            height_in: window.height_in,
            quantity: window.quantity,
            waste_factor_percent: window.waste_factor_percent,
            window_film_id: window.window_film_id,
            override_sell_per_sqft: window.override_sell_per_sqft,
            position: wIndex,
          }));

          const { error: windowsError } = await supabase
            .from("windows")
            .insert(windowsToInsert);

          if (windowsError) throw windowsError;
        }
      }

      toast({
        title: "Success",
        description: id && id !== "new" ? "Quote updated successfully" : "Quote created successfully",
      });

      navigate("/");
    } catch (error: any) {
      toast({
        title: "Error saving quote",
        description: error.message,
        variant: "destructive",
      });
    } finally {
      setLoading(false);
    }
  };

  const addSection = () => {
    setSections([
      ...sections,
      {
        id: crypto.randomUUID(),
        name: `Section ${sections.length + 1}`,
        room_id: null,
        custom_room_name: null,
        section_film_id: null,
        windows: [],
      },
    ]);
  };

  const updateSection = (sectionId: string, updates: Partial<SectionData>) => {
    setSections(sections.map(s => s.id === sectionId ? { ...s, ...updates } : s));
  };

  const deleteSection = (sectionId: string) => {
    if (sections.length === 1) {
      toast({
        title: "Cannot delete",
        description: "Quote must have at least one section",
        variant: "destructive",
      });
      return;
    }
    setSections(sections.filter(s => s.id !== sectionId));
  };

  const addWindow = (sectionId: string) => {
    setSections(sections.map(s => {
      if (s.id === sectionId) {
        return {
          ...s,
          windows: [
            ...s.windows,
            {
              id: crypto.randomUUID(),
              label: `Window ${s.windows.length + 1}`,
              width_in: 36,
              height_in: 48,
              quantity: 1,
              waste_factor_percent: 0,
              window_film_id: null,
              override_sell_per_sqft: null,
            },
          ],
        };
      }
      return s;
    }));
  };

  const updateWindow = (sectionId: string, windowId: string, updates: Partial<WindowData>) => {
    setSections(sections.map(s => {
      if (s.id === sectionId) {
        return {
          ...s,
          windows: s.windows.map(w => w.id === windowId ? { ...w, ...updates } : w),
        };
      }
      return s;
    }));
  };

  const deleteWindow = (sectionId: string, windowId: string) => {
    setSections(sections.map(s => {
      if (s.id === sectionId) {
        return {
          ...s,
          windows: s.windows.filter(w => w.id !== windowId),
        };
      }
      return s;
    }));
  };

  const downloadPDF = async () => {
    if (!id || id === "new") {
      toast({
        title: "Save first",
        description: "Please save the quote before downloading PDF",
        variant: "destructive",
      });
      return;
    }

    try {
      setLoading(true);

      const { data, error } = await supabase.functions.invoke('generate-pdf', {
        body: { quoteId: id },
        headers: {
          'Accept': 'text/html',
        },
      });

      if (error) throw error;

      // Create a printable HTML window
      const printWindow = window.open('', '_blank');
      if (printWindow) {
        printWindow.document.write(data);
        printWindow.document.close();
        
        // Trigger print dialog after content loads
        printWindow.onload = () => {
          setTimeout(() => {
            printWindow.print();
          }, 250);
        };
      }

      toast({
        title: "PDF ready",
        description: "Print dialog opened - save as PDF",
      });
    } catch (error: any) {
      toast({
        title: "PDF generation failed",
        description: error.message,
        variant: "destructive",
      });
    } finally {
      setLoading(false);
    }
  };

  // Calculate quote totals
  const calculation = calculateQuote(
    {
      global_film_id: globalFilmId,
      discount_flat: parseFloat(discountFlat) || 0,
      discount_percent: parseFloat(discountPercent) || 0,
      tax_percent: parseFloat(taxPercent) || 0,
      travel_fee: parseFloat(travelFee) || 0,
      travel_taxable: travelTaxable,
      sections,
    },
    films,
    parseFloat(depositPercent) || 0
  );

  if (loading) {
    return <div className="flex items-center justify-center min-h-screen">Loading...</div>;
  }

  return (
    <div className="space-y-6 pb-20">
      <div className="flex items-center justify-between">
        <div className="flex items-center gap-4">
          <Button variant="ghost" size="icon" onClick={() => navigate("/")}>
            <ArrowLeft className="h-4 w-4" />
          </Button>
          <div>
            <h1 className="text-3xl font-bold">
              {id && id !== "new" ? "Edit Quote" : "New Quote"}
            </h1>
            <p className="text-muted-foreground">Create a detailed quote for your customer</p>
          </div>
        </div>
        <div className="flex gap-2">
          {id && id !== "new" && (
            <Button onClick={downloadPDF} disabled={loading} variant="outline">
              <Download className="mr-2 h-4 w-4" />
              Download PDF
            </Button>
          )}
          <Button onClick={saveQuote} disabled={loading}>
            <Save className="mr-2 h-4 w-4" />
            Save Quote
          </Button>
        </div>
      </div>

      <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
        <div className="lg:col-span-2 space-y-6">
          {/* Customer Info */}
          <Card>
            <CardHeader>
              <CardTitle>Customer Information</CardTitle>
            </CardHeader>
            <CardContent className="space-y-4">
              <div className="grid grid-cols-2 gap-4">
                <div>
                  <Label>Customer Name *</Label>
                  <Input
                    value={customerName}
                    onChange={(e) => setCustomerName(e.target.value)}
                    placeholder="John Doe"
                  />
                </div>
                <div>
                  <Label>Email</Label>
                  <Input
                    type="email"
                    value={customerEmail}
                    onChange={(e) => setCustomerEmail(e.target.value)}
                    placeholder="john@example.com"
                  />
                </div>
                <div>
                  <Label>Phone</Label>
                  <Input
                    value={customerPhone}
                    onChange={(e) => setCustomerPhone(e.target.value)}
                    placeholder="(555) 123-4567"
                  />
                </div>
                <div>
                  <Label>Status</Label>
                  <Select value={status} onValueChange={setStatus}>
                    <SelectTrigger>
                      <SelectValue />
                    </SelectTrigger>
                    <SelectContent>
                      <SelectItem value="Draft">Draft</SelectItem>
                      <SelectItem value="Sent">Sent</SelectItem>
                      <SelectItem value="Approved">Approved</SelectItem>
                      <SelectItem value="Declined">Declined</SelectItem>
                    </SelectContent>
                  </Select>
                </div>
              </div>
              <div>
                <Label>Site Address</Label>
                <Input
                  value={siteAddress}
                  onChange={(e) => setSiteAddress(e.target.value)}
                  placeholder="123 Main St, City, State ZIP"
                />
              </div>
            </CardContent>
          </Card>

          {/* Quote Settings */}
          <Card>
            <CardHeader>
              <CardTitle>Quote Settings</CardTitle>
            </CardHeader>
            <CardContent className="space-y-4">
              <div>
                <Label>Default Film (applies to all windows unless overridden)</Label>
                <Select value={globalFilmId || "none"} onValueChange={(v) => setGlobalFilmId(v === "none" ? null : v)}>
                  <SelectTrigger>
                    <SelectValue placeholder="Select a film..." />
                  </SelectTrigger>
                  <SelectContent>
                    <SelectItem value="none">No default film</SelectItem>
                    {films.map((film) => (
                      <SelectItem key={film.id} value={film.id}>
                        {film.brand} {film.series} - {film.name} ({film.vlt}% VLT) - ${film.sell_per_sqft}/sqft
                      </SelectItem>
                    ))}
                  </SelectContent>
                </Select>
              </div>
              <div className="grid grid-cols-3 gap-4">
                <div>
                  <Label>Tax %</Label>
                  <Input
                    type="number"
                    step="0.1"
                    min="0"
                    max="100"
                    value={taxPercent}
                    onChange={(e) => setTaxPercent(e.target.value)}
                  />
                </div>
                <div>
                  <Label>Discount $</Label>
                  <Input
                    type="number"
                    step="0.01"
                    min="0"
                    value={discountFlat}
                    onChange={(e) => setDiscountFlat(e.target.value)}
                  />
                </div>
                <div>
                  <Label>Discount %</Label>
                  <Input
                    type="number"
                    step="0.1"
                    min="0"
                    max="100"
                    value={discountPercent}
                    onChange={(e) => setDiscountPercent(e.target.value)}
                  />
                </div>
                <div>
                  <Label>Travel Fee</Label>
                  <Input
                    type="number"
                    step="0.01"
                    min="0"
                    value={travelFee}
                    onChange={(e) => setTravelFee(e.target.value)}
                  />
                </div>
                <div>
                  <Label>Deposit %</Label>
                  <Input
                    type="number"
                    step="0.1"
                    min="0"
                    max="100"
                    value={depositPercent}
                    onChange={(e) => setDepositPercent(e.target.value)}
                  />
                </div>
                <div className="flex items-end gap-2">
                  <Switch
                    checked={travelTaxable}
                    onCheckedChange={setTravelTaxable}
                  />
                  <Label>Travel Taxable</Label>
                </div>
              </div>
              <div>
                <Label>Notes to Customer</Label>
                <Textarea
                  value={notesCustomer}
                  onChange={(e) => setNotesCustomer(e.target.value)}
                  rows={2}
                />
              </div>
              <div>
                <Label>Internal Notes</Label>
                <Textarea
                  value={notesInternal}
                  onChange={(e) => setNotesInternal(e.target.value)}
                  rows={2}
                />
              </div>
            </CardContent>
          </Card>

          {/* Sections */}
          {sections.map((section, index) => (
            <QuoteSection
              key={section.id}
              section={section}
              sectionIndex={index}
              films={films}
              calculation={calculation.sections.find(s => s.id === section.id)}
              onUpdateSection={updateSection}
              onDeleteSection={deleteSection}
              onAddWindow={addWindow}
              onUpdateWindow={updateWindow}
              onDeleteWindow={deleteWindow}
            />
          ))}

          <Button onClick={addSection} variant="outline" className="w-full">
            <Plus className="mr-2 h-4 w-4" />
            Add Section / Room
          </Button>
        </div>

        {/* Totals Panel */}
        <div className="lg:col-span-1">
          <QuoteTotalsPanel
            totals={calculation.totals}
            validationErrors={calculation.validation_errors}
          />
        </div>
      </div>
    </div>
  );
}
