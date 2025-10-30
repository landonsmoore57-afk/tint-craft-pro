import { useState, useEffect } from "react";
import { format } from "date-fns";
import { Calendar as CalendarIcon, ChevronDown, Copy, Download, Plus, Edit, Trash2, ArrowLeft, X } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import { Calendar } from "@/components/ui/calendar";
import { Popover, PopoverContent, PopoverTrigger } from "@/components/ui/popover";
import { Collapsible, CollapsibleContent, CollapsibleTrigger } from "@/components/ui/collapsible";
import { Separator } from "@/components/ui/separator";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import {
  AlertDialog,
  AlertDialogAction,
  AlertDialogCancel,
  AlertDialogContent,
  AlertDialogDescription,
  AlertDialogFooter,
  AlertDialogHeader,
  AlertDialogTitle,
} from "@/components/ui/alert-dialog";
import { cn } from "@/lib/utils";
import { toast } from "@/hooks/use-toast";
import { supabase } from "@/integrations/supabase/client";
import html2pdf from "html2pdf.js";
import logo from "@/assets/stlwt-logo.svg";
import signatureImg from "@/assets/craig-signature.png";

const DEFAULT_BODY_TEMPLATE = `St. Louis Window Tinting guarantees all materials and workmanship free of defect for a period of one (1) year from the date of substantial completion, {{effective_date_long}}. Work found defective during the guarantee period shall be replaced at the contractor's expense.

Craig Moore
Owner/President
St. Louis Window Tinting`;

interface Warranty {
  id: string;
  effective_date: string;
  project_name: string;
  project_address: string | null;
  body_copy: string;
  issue_date: string;
  recipient_name: string | null;
  recipient_address: string | null;
  footer_note: string | null;
  show_logo: boolean;
  show_signature: boolean;
  created_at: string;
  updated_at: string;
}

export default function Warranty() {
  const [view, setView] = useState<"dashboard" | "editor">("dashboard");
  const [warranties, setWarranties] = useState<Warranty[]>([]);
  const [loading, setLoading] = useState(true);
  const [currentWarrantyId, setCurrentWarrantyId] = useState<string | null>(null);
  const [deleteWarrantyId, setDeleteWarrantyId] = useState<string | null>(null);

  // Form state
  const [effectiveDate, setEffectiveDate] = useState<Date>(new Date());
  const [projectName, setProjectName] = useState("");
  const [projectAddress, setProjectAddress] = useState("");
  const [bodyCopy, setBodyCopy] = useState(DEFAULT_BODY_TEMPLATE);
  const [issueDate, setIssueDate] = useState<Date | null>(new Date());
  const [recipientName, setRecipientName] = useState("");
  const [recipientAddress, setRecipientAddress] = useState("");
  const [footerNote, setFooterNote] = useState("");
  const [showMoreFields, setShowMoreFields] = useState(false);
  const [showLogo, setShowLogo] = useState(true);
  const [showSignature, setShowSignature] = useState(false);

  useEffect(() => {
    fetchWarranties();
  }, []);

  const fetchWarranties = async () => {
    setLoading(true);
    const { data, error } = await supabase
      .from("warranties")
      .select("*")
      .order("created_at", { ascending: false });

    if (error) {
      toast({
        title: "Error",
        description: "Failed to load warranties",
        variant: "destructive",
      });
    } else {
      setWarranties(data || []);
    }
    setLoading(false);
  };

  const resetForm = () => {
    setCurrentWarrantyId(null);
    setEffectiveDate(new Date());
    setProjectName("");
    setProjectAddress("");
    setBodyCopy(DEFAULT_BODY_TEMPLATE);
    setIssueDate(new Date());
    setRecipientName("");
    setRecipientAddress("");
    setFooterNote("");
    setShowMoreFields(false);
    setShowLogo(true);
    setShowSignature(false);
  };

  const loadWarranty = (warranty: Warranty) => {
    setCurrentWarrantyId(warranty.id);
    // Parse dates correctly to avoid timezone shift
    const [year, month, day] = warranty.effective_date.split('-').map(Number);
    setEffectiveDate(new Date(year, month - 1, day));
    setProjectName(warranty.project_name);
    setProjectAddress(warranty.project_address || "");
    setBodyCopy(warranty.body_copy);
    if (warranty.issue_date) {
      const [iYear, iMonth, iDay] = warranty.issue_date.split('-').map(Number);
      setIssueDate(new Date(iYear, iMonth - 1, iDay));
    } else {
      setIssueDate(null);
    }
    setRecipientName(warranty.recipient_name || "");
    setRecipientAddress(warranty.recipient_address || "");
    setFooterNote(warranty.footer_note || "");
    setShowLogo(warranty.show_logo);
    setShowSignature(warranty.show_signature || false);
    setView("editor");
  };

  const handleCreateNew = () => {
    resetForm();
    setView("editor");
  };

  const handleBackToDashboard = () => {
    setView("dashboard");
    resetForm();
  };

  const saveWarranty = async () => {
    if (!projectName.trim()) {
      toast({
        title: "Validation Error",
        description: "Project name is required",
        variant: "destructive",
      });
      return false;
    }

    // Get current user from localStorage (custom auth)
    const storedUserId = localStorage.getItem('user_id');
    if (!storedUserId) {
      toast({
        title: "Error",
        description: "You must be logged in to save warranties",
        variant: "destructive",
      });
      return false;
    }

    const warrantyData = {
      user_id: storedUserId,
      effective_date: format(effectiveDate, "yyyy-MM-dd"),
      project_name: projectName,
      project_address: projectAddress || null,
      body_copy: bodyCopy,
      issue_date: issueDate ? format(issueDate, "yyyy-MM-dd") : null,
      recipient_name: recipientName || null,
      recipient_address: recipientAddress || null,
      footer_note: footerNote || null,
      show_logo: showLogo,
      show_signature: showSignature,
    };

    if (currentWarrantyId) {
      const { error } = await supabase
        .from("warranties")
        .update(warrantyData)
        .eq("id", currentWarrantyId);

      if (error) {
        console.error("Update error:", error);
        toast({
          title: "Error",
          description: "Failed to update warranty",
          variant: "destructive",
        });
        return false;
      }

      toast({
        title: "Saved",
        description: "Warranty updated successfully",
      });
    } else {
      const { data, error } = await supabase
        .from("warranties")
        .insert(warrantyData)
        .select()
        .single();

      if (error) {
        console.error("Insert error:", error);
        toast({
          title: "Error",
          description: "Failed to save warranty",
          variant: "destructive",
        });
        return false;
      }

      setCurrentWarrantyId(data.id);
      toast({
        title: "Saved",
        description: "Warranty created successfully",
      });
    }

    await fetchWarranties();
    return true;
  };

  const handleDelete = async () => {
    if (!deleteWarrantyId) return;

    const { error } = await supabase
      .from("warranties")
      .delete()
      .eq("id", deleteWarrantyId);

    if (error) {
      toast({
        title: "Error",
        description: "Failed to delete warranty",
        variant: "destructive",
      });
    } else {
      toast({
        title: "Deleted",
        description: "Warranty deleted successfully",
      });
      await fetchWarranties();
      
      if (currentWarrantyId === deleteWarrantyId) {
        handleBackToDashboard();
      }
    }

    setDeleteWarrantyId(null);
  };

  const effectiveDateLong = format(effectiveDate, "MMMM d, yyyy");
  const issueDateLong = issueDate ? format(issueDate, "MMMM d, yyyy") : null;
  const processedBodyCopy = bodyCopy.replace(/\{\{effective_date_long\}\}/g, effectiveDateLong);
  const isValid = projectName.trim() !== "";

  const handleDownloadPDF = async () => {
    if (!isValid) {
      toast({
        title: "Validation Error",
        description: "Please fill in all required fields",
        variant: "destructive",
      });
      return;
    }

    await saveWarranty();

    const element = document.getElementById("warranty-preview");
    if (!element) return;

    // Clone the element to avoid modifying the visible preview
    const clonedElement = element.cloneNode(true) as HTMLElement;
    
    // Convert SVG logo to PNG data URL for PDF rendering
    const logoImg = clonedElement.querySelector('img[alt="St. Louis Window Tinting"]') as HTMLImageElement;
    if (logoImg && showLogo) {
      try {
        // Create a canvas to convert SVG to PNG
        const img = new Image();
        img.crossOrigin = "anonymous";
        
        await new Promise((resolve, reject) => {
          img.onload = () => {
            const canvas = document.createElement('canvas');
            canvas.width = img.width * 2; // Higher resolution
            canvas.height = img.height * 2;
            const ctx = canvas.getContext('2d');
            if (ctx) {
              ctx.drawImage(img, 0, 0, canvas.width, canvas.height);
              logoImg.src = canvas.toDataURL('image/png');
              resolve(null);
            } else {
              reject(new Error('Failed to get canvas context'));
            }
          };
          img.onerror = reject;
          img.src = logo;
        });
      } catch (error) {
        console.error("Error converting logo for PDF:", error);
      }
    }

    const filename = `Warranty - ${projectName} - ${format(effectiveDate, "yyyy-MM-dd")}.pdf`;

    const opt = {
      margin: 0,
      filename,
      image: { type: "jpeg" as const, quality: 0.98 },
      html2canvas: { 
        scale: 2,
        useCORS: true,
        allowTaint: true,
        logging: false
      },
      jsPDF: { unit: "in", format: "letter", orientation: "portrait" as const },
    };

    // Wait a bit for image conversion to complete
    setTimeout(() => {
      html2pdf().set(opt).from(clonedElement).save();
      toast({
        title: "PDF Generated",
        description: `Downloading ${filename}`,
      });
    }, 100);
  };

  const handleCopyToClipboard = async () => {
    if (!isValid) {
      toast({
        title: "Validation Error",
        description: "Please fill in all required fields",
        variant: "destructive",
      });
      return;
    }

    await saveWarranty();

    let text = "";
    if (recipientName || recipientAddress) {
      if (recipientName) text += recipientName + "\n";
      if (recipientAddress) text += recipientAddress + "\n";
      text += "\n";
    }
    if (issueDateLong) text += `${issueDateLong}\n\n`;
    text += `WARRANTY\n\n`;
    text += `Effective Date: ${effectiveDateLong}\n`;
    text += `Project: ${projectName}\n`;
    if (projectAddress) text += `Address: ${projectAddress}\n`;
    text += `\n${processedBodyCopy}`;
    if (footerNote) {
      text += `\n\n${footerNote}`;
    }

    navigator.clipboard.writeText(text);
    toast({
      title: "Copied to Clipboard",
      description: "Warranty letter copied as plain text",
    });
  };

  if (view === "dashboard") {
    return (
      <div className="space-y-6">
        <div className="flex items-center justify-between">
          <div>
            <h1 className="text-3xl font-bold">Warranties</h1>
            <p className="text-muted-foreground mt-1">
              Manage your warranty letters
            </p>
          </div>
          <Button onClick={handleCreateNew} size="lg">
            <Plus className="mr-2 h-4 w-4" />
            Create New
          </Button>
        </div>

        {loading ? (
          <div className="text-center py-12">
            <p className="text-muted-foreground">Loading warranties...</p>
          </div>
        ) : warranties.length === 0 ? (
          <Card>
            <CardContent className="py-12 text-center">
              <p className="text-muted-foreground mb-4">No warranties yet</p>
              <Button onClick={handleCreateNew}>
                <Plus className="mr-2 h-4 w-4" />
                Create Your First Warranty
              </Button>
            </CardContent>
          </Card>
        ) : (
          <div className="grid gap-4 md:grid-cols-2 lg:grid-cols-3">
            {warranties.map((warranty) => (
              <Card key={warranty.id} className="hover:shadow-lg transition-shadow">
                <CardHeader>
                  <CardTitle className="text-lg">{warranty.project_name}</CardTitle>
                  <CardDescription>
                    {warranty.project_address && (
                      <div className="text-xs mb-1">{warranty.project_address}</div>
                    )}
                    <div className="text-xs">
                      Effective: {(() => {
                        const [year, month, day] = warranty.effective_date.split('-').map(Number);
                        return format(new Date(year, month - 1, day), "MMM d, yyyy");
                      })()}
                    </div>
                  </CardDescription>
                </CardHeader>
                <CardContent>
                  <div className="flex gap-2">
                    <Button
                      variant="outline"
                      size="sm"
                      className="flex-1"
                      onClick={() => loadWarranty(warranty)}
                    >
                      <Edit className="mr-2 h-3 w-3" />
                      Edit
                    </Button>
                    <Button
                      variant="outline"
                      size="sm"
                      onClick={() => setDeleteWarrantyId(warranty.id)}
                    >
                      <Trash2 className="h-3 w-3" />
                    </Button>
                  </div>
                </CardContent>
              </Card>
            ))}
          </div>
        )}

        <AlertDialog open={!!deleteWarrantyId} onOpenChange={() => setDeleteWarrantyId(null)}>
          <AlertDialogContent>
            <AlertDialogHeader>
              <AlertDialogTitle>Delete Warranty</AlertDialogTitle>
              <AlertDialogDescription>
                Are you sure you want to delete this warranty? This action cannot be undone.
              </AlertDialogDescription>
            </AlertDialogHeader>
            <AlertDialogFooter>
              <AlertDialogCancel>Cancel</AlertDialogCancel>
              <AlertDialogAction onClick={handleDelete}>Delete</AlertDialogAction>
            </AlertDialogFooter>
          </AlertDialogContent>
        </AlertDialog>
      </div>
    );
  }

  return (
    <div className="flex flex-col h-[calc(100vh-6rem)]">
      <div className="mb-4">
        <Button variant="ghost" onClick={handleBackToDashboard}>
          <ArrowLeft className="mr-2 h-4 w-4" />
          Back to Dashboard
        </Button>
      </div>

      <div className="flex-1 flex overflow-hidden border rounded-lg">
        {/* Left Sidebar - Form */}
        <div className="w-96 border-r bg-background overflow-y-auto p-6 space-y-6">
          <div>
            <h2 className="text-xl font-semibold mb-1">
              {currentWarrantyId ? "Edit" : "New"} Warranty
            </h2>
            <p className="text-sm text-muted-foreground">Fill in the details below</p>
          </div>

          <Separator />

          <div className="space-y-4">
            <div className="space-y-2">
              <Label htmlFor="effective-date" className="flex items-center gap-1">
                Effective Date <span className="text-destructive">*</span>
              </Label>
              <div className="flex gap-2">
                <Popover>
                  <PopoverTrigger asChild>
                    <Button
                      variant="outline"
                      className={cn(
                        "flex-1 justify-start text-left font-normal",
                        !effectiveDate && "text-muted-foreground"
                      )}
                    >
                      <CalendarIcon className="mr-2 h-4 w-4" />
                      {effectiveDate ? format(effectiveDate, "PPP") : <span>Pick a date</span>}
                    </Button>
                  </PopoverTrigger>
                  <PopoverContent className="w-auto p-0" align="start">
                    <Calendar
                      mode="single"
                      selected={effectiveDate}
                      onSelect={(date) => date && setEffectiveDate(date)}
                      initialFocus
                      className="pointer-events-auto"
                    />
                  </PopoverContent>
                </Popover>
                {effectiveDate && (
                  <Button
                    variant="outline"
                    size="icon"
                    onClick={() => setEffectiveDate(new Date())}
                    className="flex-shrink-0"
                  >
                    <X className="h-4 w-4" />
                  </Button>
                )}
              </div>
              <p className="text-xs text-muted-foreground">
                Displays as: {format(effectiveDate, "MMMM d, yyyy")}
              </p>
            </div>

            <div className="space-y-2">
              <Label htmlFor="project-name" className="flex items-center gap-1">
                Project <span className="text-destructive">*</span>
              </Label>
              <Input
                id="project-name"
                value={projectName}
                onChange={(e) => setProjectName(e.target.value)}
                placeholder="Enter project name"
                className={cn(!projectName.trim() && "border-destructive")}
              />
              {!projectName.trim() && (
                <p className="text-xs text-destructive">Project name is required</p>
              )}
            </div>

            <div className="space-y-2">
              <Label htmlFor="project-address">Project Address</Label>
              <Textarea
                id="project-address"
                value={projectAddress}
                onChange={(e) => setProjectAddress(e.target.value)}
                placeholder="Enter project address"
                rows={2}
              />
            </div>

            <div className="space-y-2">
              <Label htmlFor="body-copy">Body Copy</Label>
              <Textarea
                id="body-copy"
                value={bodyCopy}
                onChange={(e) => setBodyCopy(e.target.value)}
                rows={10}
                className="font-mono text-xs"
              />
              <p className="text-xs text-muted-foreground">
                Use {`{{effective_date_long}}`} to insert the formatted effective date
              </p>
            </div>
          </div>

          <Separator />

          <Collapsible open={showMoreFields} onOpenChange={setShowMoreFields}>
            <CollapsibleTrigger asChild>
              <Button variant="ghost" className="w-full justify-between">
                <span>More Fields</span>
                <ChevronDown className={cn("h-4 w-4 transition-transform", showMoreFields && "rotate-180")} />
              </Button>
            </CollapsibleTrigger>
            <CollapsibleContent className="space-y-4 pt-4">
              <div className="space-y-2">
                <Label htmlFor="issue-date">Issue Date</Label>
                <div className="flex gap-2">
                  <Popover>
                    <PopoverTrigger asChild>
                      <Button
                        variant="outline"
                        className={cn(
                          "flex-1 justify-start text-left font-normal",
                          !issueDate && "text-muted-foreground"
                        )}
                      >
                        <CalendarIcon className="mr-2 h-4 w-4" />
                        {issueDate ? format(issueDate, "PPP") : <span>No date</span>}
                      </Button>
                    </PopoverTrigger>
                    <PopoverContent className="w-auto p-0" align="start">
                      <Calendar
                        mode="single"
                        selected={issueDate || undefined}
                        onSelect={(date) => setIssueDate(date || null)}
                        initialFocus
                        className="pointer-events-auto"
                      />
                    </PopoverContent>
                  </Popover>
                  {issueDate && (
                    <Button
                      variant="outline"
                      size="icon"
                      onClick={() => setIssueDate(null)}
                      className="flex-shrink-0"
                    >
                      <X className="h-4 w-4" />
                    </Button>
                  )}
                </div>
              </div>

              <div className="space-y-2">
                <Label htmlFor="recipient-name">Recipient Name</Label>
                <Input
                  id="recipient-name"
                  value={recipientName}
                  onChange={(e) => setRecipientName(e.target.value)}
                  placeholder="Optional"
                />
              </div>

              <div className="space-y-2">
                <Label htmlFor="recipient-address">Recipient Address</Label>
                <Textarea
                  id="recipient-address"
                  value={recipientAddress}
                  onChange={(e) => setRecipientAddress(e.target.value)}
                  rows={3}
                  placeholder="Optional"
                />
              </div>

              <div className="space-y-2">
                <Label htmlFor="footer-note">Footer Note</Label>
                <Textarea
                  id="footer-note"
                  value={footerNote}
                  onChange={(e) => setFooterNote(e.target.value)}
                  rows={2}
                  placeholder="Optional fine print"
                />
              </div>

              <div className="flex items-center space-x-2">
                <input
                  type="checkbox"
                  id="show-logo"
                  checked={showLogo}
                  onChange={(e) => setShowLogo(e.target.checked)}
                  className="h-4 w-4"
                />
                <Label htmlFor="show-logo" className="cursor-pointer">
                  Show Logo
                </Label>
              </div>

              <div className="flex items-center space-x-2">
                <input
                  type="checkbox"
                  id="show-signature"
                  checked={showSignature}
                  onChange={(e) => setShowSignature(e.target.checked)}
                  className="h-4 w-4"
                />
                <Label htmlFor="show-signature" className="cursor-pointer">
                  Add Signature
                </Label>
              </div>
            </CollapsibleContent>
          </Collapsible>

          <Separator />

          <div className="space-y-2">
            <Button onClick={saveWarranty} variant="outline" className="w-full" disabled={!isValid}>
              Save Warranty
            </Button>
            <Button onClick={handleDownloadPDF} className="w-full" disabled={!isValid}>
              <Download className="mr-2 h-4 w-4" />
              Download PDF
            </Button>
            <Button onClick={handleCopyToClipboard} variant="outline" className="w-full" disabled={!isValid}>
              <Copy className="mr-2 h-4 w-4" />
              Copy to Clipboard
            </Button>
          </div>
        </div>

        {/* Right Preview */}
        <div className="flex-1 overflow-y-auto bg-gradient-to-br from-slate-50 to-slate-100 p-8">
          <div
            id="warranty-preview"
            className="max-w-[8.5in] mx-auto bg-white shadow-2xl rounded-sm overflow-hidden"
            style={{
              minHeight: "11in",
              fontFamily: "Inter, system-ui, sans-serif",
            }}
          >
            {/* Top Accent Bar */}
            <div className="h-2 bg-gradient-to-r from-[#0E2535] via-[#1a3a52] to-[#0E2535]" />
            
            <div style={{ padding: "0.75in" }}>
              {/* Header with Centered Logo */}
              <div className="mb-4">
                {showLogo && (
                  <div className="flex flex-col items-center mb-4">
                    <img 
                      src={logo} 
                      alt="St. Louis Window Tinting" 
                      className="h-20 w-auto animate-fade-in mb-2" 
                    />
                    <div className="flex items-center gap-2 text-base font-semibold" style={{ color: "#FF6B35" }}>
                      <span>Residential</span>
                      <span>•</span>
                      <span>Commercial</span>
                    </div>
                  </div>
                )}
                
                <div className="flex justify-between items-start gap-8">
                  <div className="flex-1">
                    {(recipientName || recipientAddress) && (
                      <div className="text-sm space-y-1 bg-slate-50 p-4 rounded-md border border-slate-200">
                        <div className="text-xs uppercase tracking-wide text-slate-500 font-semibold mb-2">To:</div>
                        {recipientName && <div className="font-semibold text-slate-900">{recipientName}</div>}
                        {recipientAddress && (
                          <div className="whitespace-pre-line text-slate-600 leading-relaxed">
                            {recipientAddress}
                          </div>
                        )}
                      </div>
                    )}
                  </div>
                  
                  {issueDateLong && (
                    <div className="text-right">
                      <div className="text-xs uppercase tracking-wide text-slate-500 font-semibold mb-1">Issue Date</div>
                      <div className="text-sm font-medium text-slate-900">{issueDateLong}</div>
                    </div>
                  )}
                </div>
              </div>

              {/* Title Section */}
              <div className="mb-4" style={{ textAlign: "center" }}>
                <h2
                  className="text-2xl font-bold tracking-wide"
                  style={{ color: "#0E2535", marginBottom: "8px" }}
                >
                  WARRANTY CERTIFICATE
                </h2>
                <div style={{ display: "flex", alignItems: "center", justifyContent: "center", gap: "8px" }}>
                  <div style={{ height: "1px", backgroundColor: "#0E2535", width: "128px" }} />
                  <div style={{ width: "8px", height: "8px", borderRadius: "50%", backgroundColor: "#0E2535" }} />
                  <div style={{ height: "1px", backgroundColor: "#0E2535", width: "128px" }} />
                </div>
              </div>

              {/* Details Box */}
              <div className="my-8 bg-gradient-to-br from-slate-50 to-white border-2 border-[#0E2535]/20 rounded-lg p-4 shadow-sm">
                <div className="grid grid-cols-1 gap-3">
                  <div className="flex items-start gap-3">
                    <div className="w-32 flex-shrink-0">
                      <span className="text-xs uppercase tracking-wide text-slate-500 font-semibold">Effective Date</span>
                    </div>
                    <div className="flex-1 font-medium text-slate-900 text-base">{effectiveDateLong}</div>
                  </div>
                  <div className="h-px bg-slate-200" />
                  <div className="flex items-start gap-3">
                    <div className="w-32 flex-shrink-0">
                      <span className="text-xs uppercase tracking-wide text-slate-500 font-semibold">Project</span>
                    </div>
                    <div className="flex-1 font-medium text-slate-900 text-base">{projectName || "[Project Name]"}</div>
                  </div>
                  {projectAddress && (
                    <>
                      <div className="h-px bg-slate-200" />
                      <div className="flex items-start gap-3">
                        <div className="w-32 flex-shrink-0">
                          <span className="text-xs uppercase tracking-wide text-slate-500 font-semibold">Address</span>
                        </div>
                        <div className="flex-1 font-medium text-slate-900 text-base">{projectAddress}</div>
                      </div>
                    </>
                  )}
                </div>
              </div>

              {/* Body Content */}
              <div className="mb-6">
                <div className="border-l-4 border-[#0E2535] pl-6 py-2">
                  <div
                    className="text-sm leading-relaxed text-slate-700"
                    style={{ lineHeight: "1.6" }}
                  >
                    {processedBodyCopy.split('\n').map((line, index, array) => {
                      // Check if we're at Craig Moore line (signature block starts)
                      const isCraigMooreLine = line.trim() === 'Craig Moore';
                      const isSignatureBlock = isCraigMooreLine || 
                        (index > 0 && array[index - 1].trim() === 'Craig Moore') ||
                        (index > 1 && array[index - 2].trim() === 'Craig Moore');
                      
                      // Skip signature block lines as they will be rendered separately
                      if (showSignature && isSignatureBlock) {
                        return null;
                      }
                      
                      return <div key={index}>{line}</div>;
                    })}
                  </div>
                </div>
                
                {/* Signature block - outside the bordered section */}
                {showSignature && processedBodyCopy.includes('Craig Moore') && (
                  <div className="pl-6 mt-3">
                    <div className="flex justify-between items-center">
                      {/* Left side - signature block text */}
                      <div style={{ width: "40%", transform: "translateY(-15%)" }}>
                        <div>Craig Moore</div>
                        <div>Owner/President</div>
                        <div>St. Louis Window Tinting</div>
                      </div>
                      
                      {/* Right side - actual signature image */}
                      <div className="flex items-center justify-start flex-1 pl-8">
                        <img 
                          src={signatureImg} 
                          alt="Craig Moore Signature"
                          className="w-80 h-auto"
                          style={{ 
                            filter: "contrast(1.3) brightness(0.3)",
                            imageRendering: "crisp-edges"
                          }}
                        />
                      </div>
                    </div>
                  </div>
                )}
              </div>

              {/* Footer */}
              {footerNote && (
                <div className="mt-8 pt-4 border-t-2 border-slate-200">
                  <div className="text-xs text-slate-500 leading-relaxed">
                    {footerNote}
                  </div>
                </div>
              )}
            </div>
            
            {/* Bottom Accent Bar */}
            <div className="h-2 bg-gradient-to-r from-[#0E2535] via-[#1a3a52] to-[#0E2535] mt-auto" />
          </div>
        </div>
      </div>
    </div>
  );
}
