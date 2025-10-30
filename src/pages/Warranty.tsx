import { useState, useEffect } from "react";
import { format } from "date-fns";
import { Calendar as CalendarIcon, ChevronDown, Copy, Download } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import { Calendar } from "@/components/ui/calendar";
import { Popover, PopoverContent, PopoverTrigger } from "@/components/ui/popover";
import { Collapsible, CollapsibleContent, CollapsibleTrigger } from "@/components/ui/collapsible";
import { Separator } from "@/components/ui/separator";
import { cn } from "@/lib/utils";
import { toast } from "@/hooks/use-toast";
import html2pdf from "html2pdf.js";
import logo from "@/assets/stlwt-logo.svg";

const DEFAULT_BODY_TEMPLATE = `St. Louis Window Tinting guarantees all materials and workmanship free of defect for a period of one (1) year from the date of substantial completion, {{effective_date_long}}. Work found defective during the guarantee period shall be replaced at the contractor's expense.

Craig Moore
Owner/President
St. Louis Window Tinting`;

export default function Warranty() {
  const [effectiveDate, setEffectiveDate] = useState<Date>(new Date());
  const [projectName, setProjectName] = useState("");
  const [bodyCopy, setBodyCopy] = useState(DEFAULT_BODY_TEMPLATE);
  const [issueDate, setIssueDate] = useState<Date>(new Date());
  const [recipientName, setRecipientName] = useState("");
  const [recipientAddress, setRecipientAddress] = useState("");
  const [footerNote, setFooterNote] = useState("");
  const [showMoreFields, setShowMoreFields] = useState(false);
  const [showLogo, setShowLogo] = useState(true);

  // Auto-save to localStorage
  useEffect(() => {
    const saved = localStorage.getItem("warranty-form");
    if (saved) {
      try {
        const data = JSON.parse(saved);
        if (data.effectiveDate) setEffectiveDate(new Date(data.effectiveDate));
        if (data.projectName) setProjectName(data.projectName);
        if (data.bodyCopy) setBodyCopy(data.bodyCopy);
        if (data.issueDate) setIssueDate(new Date(data.issueDate));
        if (data.recipientName) setRecipientName(data.recipientName);
        if (data.recipientAddress) setRecipientAddress(data.recipientAddress);
        if (data.footerNote) setFooterNote(data.footerNote);
      } catch (e) {
        console.error("Failed to load saved form data", e);
      }
    }
  }, []);

  useEffect(() => {
    const data = {
      effectiveDate: effectiveDate.toISOString(),
      projectName,
      bodyCopy,
      issueDate: issueDate.toISOString(),
      recipientName,
      recipientAddress,
      footerNote,
    };
    localStorage.setItem("warranty-form", JSON.stringify(data));
  }, [effectiveDate, projectName, bodyCopy, issueDate, recipientName, recipientAddress, footerNote]);

  const effectiveDateLong = format(effectiveDate, "MMMM d, yyyy");
  const issueDateLong = format(issueDate, "MMMM d, yyyy");

  const processedBodyCopy = bodyCopy.replace(/\{\{effective_date_long\}\}/g, effectiveDateLong);

  const isValid = projectName.trim() !== "";

  const handleDownloadPDF = () => {
    if (!isValid) {
      toast({
        title: "Validation Error",
        description: "Please fill in all required fields (Effective Date and Project).",
        variant: "destructive",
      });
      return;
    }

    const element = document.getElementById("warranty-preview");
    if (!element) return;

    const filename = `Warranty - ${projectName} - ${format(effectiveDate, "yyyy-MM-dd")}.pdf`;

    const opt = {
      margin: 1,
      filename,
      image: { type: "jpeg" as const, quality: 0.98 },
      html2canvas: { scale: 2 },
      jsPDF: { unit: "in", format: "letter", orientation: "portrait" as const },
    };

    html2pdf().set(opt).from(element).save();

    toast({
      title: "PDF Generated",
      description: `Downloading ${filename}`,
    });
  };

  const handleCopyToClipboard = () => {
    if (!isValid) {
      toast({
        title: "Validation Error",
        description: "Please fill in all required fields (Effective Date and Project).",
        variant: "destructive",
      });
      return;
    }

    let text = "";
    if (recipientName || recipientAddress) {
      if (recipientName) text += recipientName + "\n";
      if (recipientAddress) text += recipientAddress + "\n";
      text += "\n";
    }
    text += `${issueDateLong}\n\n`;
    text += `WARRANTY\n\n`;
    text += `Effective Date: ${effectiveDateLong}\n`;
    text += `Project: ${projectName}\n\n`;
    text += processedBodyCopy;
    if (footerNote) {
      text += `\n\n${footerNote}`;
    }

    navigator.clipboard.writeText(text);
    toast({
      title: "Copied to Clipboard",
      description: "Warranty letter copied as plain text.",
    });
  };

  return (
    <div className="flex h-screen w-full overflow-hidden">
      {/* Left Sidebar - Form */}
      <div className="w-96 border-r bg-background overflow-y-auto p-6 space-y-6">
        <div>
          <h1 className="text-2xl font-semibold mb-1">Warranty Letter</h1>
          <p className="text-sm text-muted-foreground">Generate professional warranty letters</p>
        </div>

        <Separator />

        <div className="space-y-4">
          <div className="space-y-2">
            <Label htmlFor="effective-date" className="flex items-center gap-1">
              Effective Date <span className="text-destructive">*</span>
            </Label>
            <Popover>
              <PopoverTrigger asChild>
                <Button
                  variant="outline"
                  className={cn(
                    "w-full justify-start text-left font-normal",
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
            <p className="text-xs text-muted-foreground">
              Displays as: {effectiveDateLong}
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
            <Label htmlFor="body-copy">Body Copy</Label>
            <Textarea
              id="body-copy"
              value={bodyCopy}
              onChange={(e) => setBodyCopy(e.target.value)}
              rows={12}
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
              <Popover>
                <PopoverTrigger asChild>
                  <Button
                    variant="outline"
                    className="w-full justify-start text-left font-normal"
                  >
                    <CalendarIcon className="mr-2 h-4 w-4" />
                    {format(issueDate, "PPP")}
                  </Button>
                </PopoverTrigger>
                <PopoverContent className="w-auto p-0" align="start">
                  <Calendar
                    mode="single"
                    selected={issueDate}
                    onSelect={(date) => date && setIssueDate(date)}
                    initialFocus
                    className="pointer-events-auto"
                  />
                </PopoverContent>
              </Popover>
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
          </CollapsibleContent>
        </Collapsible>

        <Separator />

        <div className="space-y-2">
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
      <div className="flex-1 overflow-y-auto bg-muted p-8">
        <div
          id="warranty-preview"
          className="max-w-[8.5in] mx-auto bg-white shadow-lg"
          style={{
            minHeight: "11in",
            padding: "1in",
            fontFamily: "Inter, system-ui, sans-serif",
          }}
        >
          {/* Header */}
          <div className="flex justify-between items-start mb-8">
            <div>
              {showLogo && (
                <img src={logo} alt="St. Louis Window Tinting" className="h-16 mb-4" />
              )}
              {(recipientName || recipientAddress) && (
                <div className="text-sm space-y-0.5">
                  {recipientName && <div className="font-medium">{recipientName}</div>}
                  {recipientAddress && (
                    <div className="whitespace-pre-line text-muted-foreground">
                      {recipientAddress}
                    </div>
                  )}
                </div>
              )}
            </div>
            <div className="text-sm text-right text-muted-foreground">
              {issueDateLong}
            </div>
          </div>

          {/* Title */}
          <div className="mb-6 text-center">
            <h2
              className="text-xl font-medium tracking-wider mb-2"
              style={{ color: "#0E2535" }}
            >
              WARRANTY
            </h2>
            <div className="h-px bg-border w-24 mx-auto" style={{ backgroundColor: "#0E2535" }} />
          </div>

          {/* Details */}
          <div className="mb-6 space-y-1 text-sm">
            <div>
              <span className="font-medium">Effective Date:</span> {effectiveDateLong}
            </div>
            <div>
              <span className="font-medium">Project:</span> {projectName || "[Project Name]"}
            </div>
          </div>

          {/* Body */}
          <div
            className="text-base whitespace-pre-line leading-relaxed mb-8"
            style={{ lineHeight: "1.6" }}
          >
            {processedBodyCopy}
          </div>

          {/* Footer */}
          {footerNote && (
            <div className="mt-12 pt-4 border-t text-xs text-muted-foreground">
              {footerNote}
            </div>
          )}
        </div>
      </div>
    </div>
  );
}
