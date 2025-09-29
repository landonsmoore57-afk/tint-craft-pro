export interface FilmData {
  id: string;
  brand: string;
  series: string;
  name: string;
  vlt: number | null;
  cost_per_sqft: number;
  sell_per_sqft: number;
}

export interface WindowData {
  id: string;
  label: string;
  width_in: number;
  height_in: number;
  quantity: number;
  waste_factor_percent: number;
  window_film_id: string | null;
  override_sell_per_sqft: number | null;
}

export interface SectionData {
  id: string;
  name: string;
  room_id: string | null;
  custom_room_name: string | null;
  section_film_id: string | null;
  windows: WindowData[];
}

export interface QuoteData {
  global_film_id: string | null;
  discount_flat: number;
  discount_percent: number;
  tax_percent: number;
  travel_fee: number;
  travel_taxable: boolean;
  sections: SectionData[];
}

export interface WindowCalculation extends WindowData {
  area_sqft: number;
  effective_area_sqft: number;
  resolved_film: FilmData | null;
  sell_per_sqft: number;
  line_total: number;
}

export interface SectionCalculation extends Omit<SectionData, 'windows'> {
  windows: WindowCalculation[];
  section_total: number;
}

export interface QuoteTotals {
  subtotal: number;
  discount_flat_amount: number;
  discount_percent_amount: number;
  subtotal_after_discounts: number;
  travel_fee: number;
  taxable_base: number;
  tax_amount: number;
  grand_total: number;
  deposit_due: number;
}

export interface QuoteCalculationResult {
  sections: SectionCalculation[];
  totals: QuoteTotals;
  validation_errors: string[];
}

export function calculateQuote(
  quoteData: QuoteData,
  films: FilmData[],
  deposit_percent: number = 0
): QuoteCalculationResult {
  const validation_errors: string[] = [];
  const filmMap = new Map(films.map(f => [f.id, f]));

  // Resolve film for a window using precedence: window → section → global
  const resolveFilm = (
    window: WindowData,
    sectionFilmId: string | null,
    globalFilmId: string | null
  ): FilmData | null => {
    if (window.window_film_id) {
      const film = filmMap.get(window.window_film_id);
      if (film) return film;
    }
    if (sectionFilmId) {
      const film = filmMap.get(sectionFilmId);
      if (film) return film;
    }
    if (globalFilmId) {
      const film = filmMap.get(globalFilmId);
      if (film) return film;
    }
    return null;
  };

  // Calculate window line items
  const calculatedSections: SectionCalculation[] = quoteData.sections.map(section => {
    const calculatedWindows: WindowCalculation[] = section.windows.map(window => {
      // Basic validation
      if (window.width_in <= 0 || window.height_in <= 0) {
        validation_errors.push(`Window "${window.label}" has invalid dimensions`);
      }
      if (window.quantity <= 0) {
        validation_errors.push(`Window "${window.label}" has invalid quantity`);
      }

      // Calculate area
      const area_sqft = (window.width_in * window.height_in) / 144;
      const line_area_sqft = area_sqft * window.quantity;
      const effective_area_sqft = line_area_sqft * (1 + window.waste_factor_percent / 100);

      // Resolve film
      const resolved_film = resolveFilm(window, section.section_film_id, quoteData.global_film_id);
      
      if (!resolved_film && !window.override_sell_per_sqft) {
        validation_errors.push(`Window "${window.label}" has no film selected and no override price`);
      }

      // Determine sell price per sqft
      const sell_per_sqft = window.override_sell_per_sqft ?? resolved_film?.sell_per_sqft ?? 0;

      // Calculate line total
      const line_total = effective_area_sqft * sell_per_sqft;

      return {
        ...window,
        area_sqft,
        effective_area_sqft,
        resolved_film,
        sell_per_sqft,
        line_total,
      };
    });

    const section_total = calculatedWindows.reduce((sum, w) => sum + w.line_total, 0);

    return {
      ...section,
      windows: calculatedWindows,
      section_total,
    };
  });

  // Calculate totals
  const subtotal = calculatedSections.reduce((sum, s) => sum + s.section_total, 0);

  // Apply flat discount first
  const discount_flat_amount = Math.min(quoteData.discount_flat, subtotal);
  let subtotal_after_flat = subtotal - discount_flat_amount;

  // Apply percentage discount
  const discount_percent_amount = subtotal_after_flat * (quoteData.discount_percent / 100);
  const subtotal_after_discounts = subtotal_after_flat - discount_percent_amount;

  // Add travel fee
  const travel_fee = quoteData.travel_fee;

  // Calculate taxable base
  const taxable_base = quoteData.travel_taxable
    ? subtotal_after_discounts + travel_fee
    : subtotal_after_discounts;

  // Calculate tax
  const tax_amount = taxable_base * (quoteData.tax_percent / 100);

  // Grand total
  const grand_total = subtotal_after_discounts + travel_fee + tax_amount;

  // Deposit due
  const deposit_due = grand_total * (deposit_percent / 100);

  const totals: QuoteTotals = {
    subtotal,
    discount_flat_amount,
    discount_percent_amount,
    subtotal_after_discounts,
    travel_fee,
    taxable_base,
    tax_amount,
    grand_total,
    deposit_due,
  };

  return {
    sections: calculatedSections,
    totals,
    validation_errors,
  };
}

export function formatCurrency(amount: number): string {
  return new Intl.NumberFormat('en-US', {
    style: 'currency',
    currency: 'USD',
  }).format(amount);
}

export function formatSqft(sqft: number): string {
  return sqft.toFixed(2);
}
