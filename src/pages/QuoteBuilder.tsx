import { useState, useEffect } from "react";
import { useNavigate, useParams } from "react-router-dom";
import { supabase } from "@/integrations/supabase/client";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Textarea } from "@/components/ui/textarea";
import { useToast } from "@/hooks/use-toast";
import { Plus, Save, ArrowLeft, Download, X, Info, ExternalLink } from "lucide-react";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Switch } from "@/components/ui/switch";
import { Alert, AlertDescription } from "@/components/ui/alert";
import { QuoteSection } from "@/components/quote/QuoteSection";
import { QuoteSummariesPanel } from "@/components/quote/QuoteSummariesPanel";
import { WindowSummary } from "@/components/quote/WindowSummary";
import { RoomsSummary } from "@/components/quote/RoomsSummary";
import { calculateQuote, FilmData, MaterialData, RoomData, SectionData, WindowData, formatCurrency } from "@/lib/quoteCalculations";
import { format } from "date-fns";
import { FilmSelector } from "@/components/quote/FilmSelector";
import { useAuth } from "@/contexts/AuthContext";

export default function QuoteBuilder() {
  const { id } = useParams();
  const navigate = useNavigate();
  const { toast } = useToast();
  const { user } = useAuth();
  const [loading, setLoading] = useState(id && id !== "new");
  const [films, setFilms] = useState<FilmData[]>([]);
  const [materials, setMaterials] = useState<MaterialData[]>([]);
  const [rooms, setRooms] = useState<RoomData[]>([]);
  const [jobberConnected, setJobberConnected] = useState(false);
  const [pushingToJobber, setPushingToJobber] = useState(false);

  // Quote header data
  const [customerName, setCustomerName] = useState("");
  const [customerEmail, setCustomerEmail] = useState("");
  const [customerPhone, setCustomerPhone] = useState("");
  const [siteAddress, setSiteAddress] = useState("");
  const [status, setStatus] = useState("draft");
  const [customerType, setCustomerType] = useState("Residential");
  
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

  // Default film banner
  const [showDefaultFilmBanner, setShowDefaultFilmBanner] = useState(false);
  const [defaultFilmName, setDefaultFilmName] = useState("");

  useEffect(() => {
    const initializeQuote = async () => {
      await fetchFilms();
      await fetchMaterials();
      await fetchRooms();
      
      if (id && id !== "new") {
        loadQuote(id);
      } else if (id === "new") {
        // Load default film for new quotes
        await loadDefaultFilm();
      }
      
      // Check Jobber connection
      await checkJobberConnection();
    };
    
    initializeQuote();
  }, [id]);

  const loadDefaultFilm = async () => {
    try {
      // Get company settings
      const { data: settings, error: settingsError } = await supabase
        .from("company_settings")
        .select("default_film_id")
        .limit(1)
        .maybeSingle();

      if (settingsError && settingsError.code !== "PGRST116") throw settingsError;

      // If there's a default film ID, fetch the film details
      if (settings?.default_film_id) {
        const { data: film, error: filmError } = await supabase
          .from("films")
          .select("id, brand, series, name, vlt, active")
          .eq("id", settings.default_film_id)
          .single();

        if (filmError) throw filmError;

        if (film && film.active) {
          setGlobalFilmId(film.id);
          setDefaultFilmName(`${film.brand} ${film.series} ${film.name}${film.vlt ? ` ${film.vlt}` : ''}`);
          setShowDefaultFilmBanner(true);
        }
      }
    } catch (error: any) {
      console.error('Error loading default film:', error);
      // Don't show error toast for missing default film - it's optional
    }
  };

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

  const fetchMaterials = async () => {
    try {
      const { data, error } = await supabase
        .from("materials")
        .select("*")
        .eq("active", true);

      if (error) throw error;
      setMaterials(data || []);
    } catch (error: any) {
      toast({
        title: "Error fetching materials",
        description: error.message,
        variant: "destructive",
      });
    }
  };

  const fetchRooms = async () => {
    try {
      const { data, error } = await supabase
        .from("rooms")
        .select("id, name")
        .order("name");

      if (error) throw error;
      setRooms(data || []);
    } catch (error: any) {
      toast({
        title: "Error fetching rooms",
        description: error.message,
        variant: "destructive",
      });
    }
  };

  const loadQuote = async (quoteId: string) => {
    try {
      setLoading(true);
      
      // Use edge function to bypass RLS for PIN-based auth
      const { data, error } = await supabase.functions.invoke('fetch-quote-details', {
        body: { quoteId }
      });

      if (error) throw error;

      const { quote, sections: sectionsData, windows: windowsData } = data;

      if (!quote) {
        throw new Error("Quote not found");
      }

      // Populate form with quote data
      setCustomerName(quote.customer_name);
      setCustomerEmail(quote.customer_email || "");
      setCustomerPhone(quote.customer_phone || "");
      setSiteAddress(quote.site_address || "");
      setStatus(quote.status);
      setCustomerType(quote.customer_type || "Residential");
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
          .map(w => {
            console.log('Loading window from DB:', {
              label: w.label,
              film_removal_fee_per_sqft: w.film_removal_fee_per_sqft
            });
            return {
              id: w.id,
              label: w.label,
              width_in: w.width_in,
              height_in: w.height_in,
              quote_width_in: w.quote_width_in,
              quote_height_in: w.quote_height_in,
              quantity: w.quantity,
              waste_factor_percent: w.waste_factor_percent,
              window_film_id: w.window_film_id,
              override_sell_per_sqft: w.override_sell_per_sqft,
              film_removal_fee_per_sqft: w.film_removal_fee_per_sqft ?? 0,
            };
          }),
      }));

      console.log('Loaded sections with windows:', loadedSections[0]?.windows[0]);

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

      // Get the current user ID from localStorage (PIN auth)
      const userId = localStorage.getItem('user_id');
      if (!userId) {
        throw new Error("Not authenticated - please log in again");
      }

      // Base quote data
      const quoteData: any = {
        id: id === "new" ? undefined : id,
        quote_number: `Q-${Date.now()}`,
        customer_name: customerName,
        customer_email: customerEmail || null,
        customer_phone: customerPhone || null,
        site_address: siteAddress || null,
        status: status,
        customer_type: customerType,
        global_film_id: globalFilmId,
        discount_flat: parseFloat(discountFlat) || 0,
        discount_percent: parseFloat(discountPercent) || 0,
        tax_percent: parseFloat(taxPercent) || 0,
        travel_fee: parseFloat(travelFee) || 0,
        deposit_percent: parseFloat(depositPercent) || 0,
        travel_taxable: travelTaxable,
        notes_internal: notesInternal || null,
        notes_customer: notesCustomer || null,
        created_by: userId,
      };

      // Sections data with windows
      const sectionsData = sections.map((section, sIndex) => ({
        id: section.id,
        name: section.name,
        room_id: section.room_id,
        custom_room_name: section.custom_room_name,
        section_film_id: section.section_film_id,
        position: sIndex,
        windows: section.windows.map((window, wIndex) => ({
          id: window.id,
          label: window.label,
          width_in: window.width_in,
          height_in: window.height_in,
          quote_width_in: window.quote_width_in || null,
          quote_height_in: window.quote_height_in || null,
          quantity: window.quantity || 1,
          waste_factor_percent: window.waste_factor_percent || 0,
          window_film_id: window.window_film_id || null,
          override_sell_per_sqft: window.override_sell_per_sqft || null,
          film_removal_fee_per_sqft: window.film_removal_fee_per_sqft ?? 0,
          position: wIndex,
        })),
      }));

      console.log('Saving quote - first window sample:', sectionsData[0]?.windows[0]);

      // Direct fetch to save-quote function
      const functionsUrl = import.meta.env.VITE_SUPABASE_URL?.replace(/\/$/, '') + '/functions/v1';
      const appToken = import.meta.env.VITE_SUPABASE_PUBLISHABLE_KEY;
      
      console.log('Save quote debug:', {
        functionsUrl,
        hasToken: !!appToken,
        tokenLength: appToken?.length,
        userId: userId
      });
      
      const res = await fetch(`${functionsUrl}/save-quote`, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          'x-app-token': appToken,
          'x-app-actor-id': userId,
        },
        body: JSON.stringify({ quote: quoteData, sections: sectionsData }),
      });

      console.log('Save response status:', res.status);
      
      let body: any = {};
      try { body = await res.json(); } catch { /* ignore */ }
      
      console.log('Save response body:', body);

      if (!res.ok) {
        if (res.status === 401 || body?.code === 'BAD_TOKEN') {
          throw new Error('Authentication failed. Please refresh and try again.');
        }
        if (res.status === 404) {
          throw new Error('Save function not found. Please contact support.');
        }
        throw new Error(body?.error || `Save failed (HTTP ${res.status})`);
      }
      if (!body?.ok) throw new Error(body?.error || 'Save failed');

      toast({
        title: "Success",
        description: id && id !== "new" ? "Quote updated successfully" : "Quote created successfully",
      });
    } catch (error: any) {
      console.error('Save quote error:', error);
      toast({
        title: "Error saving quote",
        description: error.message || "Failed to save quote",
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
              quote_width_in: null,
              quote_height_in: null,
              quantity: 1,
              waste_factor_percent: 0,
              window_film_id: null,
              override_sell_per_sqft: null,
              film_removal_fee_per_sqft: 0,
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

  const downloadPDF = async (summaryKey?: string) => {
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
        body: { quoteId: id, summary: summaryKey },
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

  const checkJobberConnection = async () => {
    if (!user?.id) return;
    
    try {
      const { data } = await supabase
        .from("integration_jobber_tokens")
        .select("id")
        .eq("account_id", user.id)
        .maybeSingle();
      
      setJobberConnected(!!data);
    } catch (error) {
      console.error("Error checking Jobber connection:", error);
    }
  };

  const pushToJobber = async () => {
    if (!id || id === "new") {
      toast({
        title: "Save first",
        description: "Please save the quote before pushing to Jobber",
        variant: "destructive",
      });
      return;
    }

    if (!jobberConnected) {
      toast({
        title: "Connect Jobber",
        description: "Please connect Jobber in Settings first",
        variant: "destructive",
      });
      return;
    }

    if (!user?.id) {
      toast({
        title: "Authentication Required",
        description: "Please log in to push quotes to Jobber",
        variant: "destructive",
      });
      return;
    }

    try {
      setPushingToJobber(true);

      const { data, error } = await supabase.functions.invoke('jobber-push-quote', {
        body: { 
          quoteId: id,
          userId: user.id,
        },
      });

      if (error) throw error;

      if (!data?.ok) {
        throw new Error(data?.error || 'Failed to push quote to Jobber');
      }

      toast({
        title: "Pushed to Jobber",
        description: "Quote successfully created in Jobber",
      });
    } catch (error: any) {
      toast({
        title: "Push to Jobber failed",
        description: error.message,
        variant: "destructive",
      });
    } finally {
      setPushingToJobber(false);
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
    materials,
    rooms,
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
          {jobberConnected && id && id !== "new" && (
            <Button 
              onClick={pushToJobber} 
              disabled={pushingToJobber || loading}
              variant="outline"
            >
              <ExternalLink className="mr-2 h-4 w-4" />
              {pushingToJobber ? 'Pushing...' : 'Push to Jobber'}
            </Button>
          )}
          <Button onClick={saveQuote} disabled={loading}>
            <Save className="mr-2 h-4 w-4" />
            Save Quote
          </Button>
        </div>
      </div>

      {/* Default Film Banner */}
      {showDefaultFilmBanner && (
        <Alert className="border-primary/20 bg-primary/5">
          <Info className="h-4 w-4 text-primary" />
          <AlertDescription className="flex items-center justify-between">
            <span>
              Default film applied: <strong>{defaultFilmName}</strong>. You can change this in Quote Settings below.
            </span>
            <Button
              variant="ghost"
              size="sm"
              onClick={() => setShowDefaultFilmBanner(false)}
              className="h-auto p-1"
            >
              <X className="h-4 w-4" />
            </Button>
          </AlertDescription>
        </Alert>
      )}

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
                  <Label>Customer Type</Label>
                  <Select value={customerType} onValueChange={setCustomerType}>
                    <SelectTrigger>
                      <SelectValue />
                    </SelectTrigger>
                    <SelectContent>
                      <SelectItem value="Residential">Residential</SelectItem>
                      <SelectItem value="Commercial">Commercial</SelectItem>
                    </SelectContent>
                  </Select>
                </div>
                <div>
                  <Label>Status</Label>
                  <Select value={status} onValueChange={setStatus}>
                    <SelectTrigger>
                      <SelectValue className="capitalize" />
                    </SelectTrigger>
                    <SelectContent>
                      <SelectItem value="draft">Draft</SelectItem>
                      <SelectItem value="done">Done</SelectItem>
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
          Add Room
          </Button>

          {/* Quote Settings */}
          <Card>
            <CardHeader>
              <CardTitle>Quote Settings</CardTitle>
            </CardHeader>
            <CardContent className="space-y-4">
              <div>
                <Label>Default Film (applies to all windows unless overridden)</Label>
                <FilmSelector
                  value={globalFilmId}
                  onChange={setGlobalFilmId}
                  placeholder="Select a film..."
                />
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
        </div>

        {/* Totals Panel */}
        <div className="lg:col-span-1 space-y-4">
          <QuoteSummariesPanel
            summaries={calculation.summaries}
            totalLinearFeet={calculation.total_linear_feet_security}
            validationErrors={calculation.validation_errors}
            quoteId={id}
            onDownloadPDF={downloadPDF}
          />
          <WindowSummary rollup={calculation.window_size_rollup} />
          <RoomsSummary rollup={calculation.rooms_summary} />
        </div>
      </div>
    </div>
  );
}
