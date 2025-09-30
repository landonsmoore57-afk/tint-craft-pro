export interface FilmData {
  id: string;
  brand: string;
  series: string;
  name: string;
  vlt: number | null;
  cost_per_sqft: number;
  sell_per_sqft: number;
  security_film: boolean;
}

export interface MaterialData {
  id: string;
  key: string;
  name: string;
  unit: string;
  cost_per_linear_ft: number;
  sell_per_linear_ft: number;
  active: boolean;
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
  linear_feet: number;
  is_security: boolean;
}

export interface SectionCalculation extends Omit<SectionData, 'windows'> {
  windows: WindowCalculation[];
  section_total: number;
}

export interface QuoteSummary {
  key: string;
  label: string;
  materials_unit_price_sell: number;
  materials_unit_price_cost: number;
  materials_total: number;
  materials_cost_total: number;
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

export interface RollPlan {
  slit_width_in: number;
  base_roll_in: 48 | 60 | 72;
  orientation: 'width-across' | 'height-across';
  waste_in: number;
  note?: string;
}

export interface WindowSizeRollup {
  width_in: number;
  height_in: number;
  total_qty: number;
  area_sqft_each: number;
  roll_plan?: RollPlan | { error: string };
}

export interface RoomSize {
  width_in: number;
  height_in: number;
  area_sqft_each: number;
  total_qty: number;
  roll_plan?: RollPlan | { error: string };
}

export interface RoomSizeRollup {
  room_label: string;
  total_windows_qty: number;
  sizes: RoomSize[];
}

export interface RoomData {
  id: string;
  name: string;
}

export interface QuoteCalculationResult {
  sections: SectionCalculation[];
  windows_subtotal: number;
  total_linear_feet_security: number;
  summaries: QuoteSummary[];
  window_size_rollup: WindowSizeRollup[];
  rooms_summary: RoomSizeRollup[];
  validation_errors: string[];
}

export function calculateQuote(
  quoteData: QuoteData,
  films: FilmData[],
  materials: MaterialData[],
  rooms: RoomData[] = [],
  deposit_percent: number = 0,
  rollConfig: RollConfig = DEFAULT_ROLL_CONFIG
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

      // Calculate linear feet for security film (perimeter-based)
      const is_security = resolved_film?.security_film ?? false;
      const linear_feet = is_security 
        ? window.quantity * (2 * (window.width_in + window.height_in) / 12)
        : 0;

      return {
        ...window,
        area_sqft,
        effective_area_sqft,
        resolved_film,
        sell_per_sqft,
        line_total,
        linear_feet,
        is_security,
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
  const windows_subtotal = calculatedSections.reduce((sum, s) => sum + s.section_total, 0);

  // Calculate materials for security film windows
  const total_linear_feet_security = calculatedSections.reduce((sum, s) => 
    sum + s.windows.reduce((wSum, w) => wSum + w.linear_feet, 0), 0
  );

  // Get materials pricing
  const gasket = materials.find(m => m.key === 'gasket' && m.active);
  const caulk = materials.find(m => m.key === 'caulk' && m.active);

  // Build summaries for each material option
  const summaries: QuoteSummary[] = [];

  // Helper to calculate a summary
  const calculateSummary = (
    key: string,
    label: string,
    materials_unit_price_sell: number,
    materials_unit_price_cost: number
  ): QuoteSummary => {
    const materials_total = total_linear_feet_security * materials_unit_price_sell;
    const materials_cost_total = total_linear_feet_security * materials_unit_price_cost;
    const subtotal = windows_subtotal + materials_total;

    // Apply flat discount first
    const discount_flat_amount = Math.min(quoteData.discount_flat, subtotal);
    const subtotal_after_flat = subtotal - discount_flat_amount;

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

    return {
      key,
      label,
      materials_unit_price_sell,
      materials_unit_price_cost,
      materials_total,
      materials_cost_total,
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
  };

  // No Materials
  summaries.push(calculateSummary('no_materials', 'No Materials', 0, 0));

  // Gasket
  if (gasket) {
    summaries.push(calculateSummary('gasket', 'Gasket', gasket.sell_per_linear_ft, gasket.cost_per_linear_ft));
  } else if (total_linear_feet_security > 0) {
    validation_errors.push('Materials pricing missing for Gasket');
  }

  // Caulk
  if (caulk) {
    summaries.push(calculateSummary('caulk', 'Caulk', caulk.sell_per_linear_ft, caulk.cost_per_linear_ft));
  } else if (total_linear_feet_security > 0) {
    validation_errors.push('Materials pricing missing for Caulk');
  }

  // Window size rollup
  const sizeMap = new Map<string, { w: number; h: number; qty: number }>();
  for (const section of calculatedSections) {
    for (const win of section.windows) {
      const key = `${win.width_in}x${win.height_in}`;
      const item = sizeMap.get(key) ?? { w: win.width_in, h: win.height_in, qty: 0 };
      item.qty += Math.max(1, win.quantity || 1);
      sizeMap.set(key, item);
    }
  }
  const window_size_rollup: WindowSizeRollup[] = [...sizeMap.values()]
    .map(i => ({
      width_in: i.w,
      height_in: i.h,
      total_qty: i.qty,
      area_sqft_each: +((i.w * i.h) / 144).toFixed(2),
      roll_plan: pickRollForSize(i.w, i.h, rollConfig),
    }))
    .sort((a, b) => b.area_sqft_each - a.area_sqft_each || (a.width_in * a.height_in) - (b.width_in * b.height_in));

  // Rooms summary rollup
  const roomsMap = new Map<string, Map<string, { w: number; h: number; qty: number }>>();
  const roomTotals = new Map<string, number>();
  
  for (const section of quoteData.sections) {
    // Resolve room label: custom_room_name > rooms.name > section.name > 'Unassigned'
    let roomLabel = 'Unassigned';
    if (section.custom_room_name) {
      roomLabel = section.custom_room_name;
    } else if (section.room_id) {
      const room = rooms.find(r => r.id === section.room_id);
      roomLabel = room?.name || section.name || 'Unassigned';
    } else if (section.name) {
      roomLabel = section.name;
    }

    if (!roomsMap.has(roomLabel)) {
      roomsMap.set(roomLabel, new Map());
    }
    const sizeMap = roomsMap.get(roomLabel)!;

    for (const win of section.windows) {
      const qty = Math.max(1, win.quantity || 1);
      const key = `${win.width_in}x${win.height_in}`;
      const item = sizeMap.get(key) ?? { w: win.width_in, h: win.height_in, qty: 0 };
      item.qty += qty;
      sizeMap.set(key, item);

      roomTotals.set(roomLabel, (roomTotals.get(roomLabel) ?? 0) + qty);
    }
  }

  const rooms_summary: RoomSizeRollup[] = [...roomsMap.entries()]
    .map(([room, sizeMap]) => {
      const sizes = [...sizeMap.values()]
        .map(i => ({
          width_in: i.w,
          height_in: i.h,
          area_sqft_each: +((i.w * i.h) / 144).toFixed(2),
          total_qty: i.qty,
          roll_plan: pickRollForSize(i.w, i.h, rollConfig),
        }))
        .sort((a, b) =>
          b.area_sqft_each - a.area_sqft_each ||
          (a.width_in * a.height_in) - (b.width_in * b.height_in)
        );

      return {
        room_label: room,
        total_windows_qty: roomTotals.get(room) ?? 0,
        sizes,
      };
    })
    .sort((a, b) => {
      if (a.room_label === 'Unassigned') return 1;
      if (b.room_label === 'Unassigned') return -1;
      return a.room_label.localeCompare(b.room_label, undefined, { numeric: true });
    });

  return {
    sections: calculatedSections,
    windows_subtotal,
    total_linear_feet_security,
    summaries,
    window_size_rollup,
    rooms_summary,
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

// Roll size calculation helpers
export interface RollConfig {
  roll_widths_in: number[];
  allow_equal_splits: boolean;
  cross_trim_in: number;
  allow_rotation: boolean;
  exact_base_match_has_no_cross_trim?: boolean;
}

const DEFAULT_ROLL_CONFIG: RollConfig = {
  roll_widths_in: [48, 60, 72],
  allow_equal_splits: true,
  cross_trim_in: 0.5,
  allow_rotation: true,
  exact_base_match_has_no_cross_trim: true,
};

function buildSlitCatalog(bases: number[] = [48, 60, 72]): Array<{ slit: number; base: number }> {
  const map = new Map<number, number>(); // slit -> smallest base
  for (const b of [...bases].sort((a, b) => a - b)) {
    for (let n = 1; n <= 6; n++) {
      if (b % n === 0) {
        const slit = b / n;
        const prev = map.get(slit);
        if (!prev || b < prev) map.set(slit, b);
      }
    }
  }
  return [...map.entries()].sort((a, b) => a[0] - b[0]).map(([slit, base]) => ({ slit, base }));
}

export function pickRollForSize(
  W: number,
  H: number,
  cfg: RollConfig = DEFAULT_ROLL_CONFIG
): RollPlan | { error: string } {
  const bases = (cfg.roll_widths_in ?? [48, 60, 72]).slice().sort((a, b) => a - b);
  const crossTrim = cfg.cross_trim_in ?? 0;
  const allowRot = cfg.allow_rotation !== false;

  // 1) Exact base match wins (no cross-trim applied)
  for (const [dim, orient] of [[W, 'width-across'] as const, [H, 'height-across'] as const]) {
    if (bases.includes(dim)) {
      return {
        slit_width_in: dim,
        base_roll_in: dim as 48 | 60 | 72,
        orientation: orient,
        waste_in: 0,
        note: 'Exact base match',
      };
    }
  }

  // 2) Special 36" fallback → 72→36 slit
  for (const [dim, orient] of [[W, 'width-across'] as const, [H, 'height-across'] as const]) {
    if (dim === 36) {
      return {
        slit_width_in: 36,
        base_roll_in: 72,
        orientation: orient,
        waste_in: 0,
        note: '36-inch fallback (72→36)',
      };
    }
  }

  // 3) Minimal-waste with rotation + cross-trim
  const candidates = buildSlitCatalog(bases);
  type Plan = { slit_width_in: number; base_roll_in: 48 | 60 | 72; orientation: 'width-across' | 'height-across'; waste_in: number; note?: string };
  let best: Plan | null = null;

  const orientations: Array<{ need: number; orient: Plan['orientation'] }> = [
    { need: W + 2 * crossTrim, orient: 'width-across' }
  ];
  if (allowRot) orientations.push({ need: H + 2 * crossTrim, orient: 'height-across' });

  for (const d of orientations) {
    for (const { slit, base } of candidates) {
      if (slit + 1e-6 >= d.need) {
        const waste = +(slit - d.need).toFixed(2);
        const plan: Plan = { 
          slit_width_in: slit, 
          base_roll_in: base as 48 | 60 | 72, 
          orientation: d.orient, 
          waste_in: waste,
          note: slit !== base ? `Minimal waste (${base}→${slit})` : undefined,
        };
        if (!best
          || plan.waste_in < best.waste_in
          || (plan.waste_in === best.waste_in && plan.base_roll_in < best.base_roll_in)
          || (plan.waste_in === best.waste_in && plan.base_roll_in === best.base_roll_in && plan.slit_width_in === plan.base_roll_in)
          || (plan.waste_in === best.waste_in && plan.base_roll_in === best.base_roll_in && plan.slit_width_in === best.slit_width_in && plan.orientation === 'width-across')
        ) {
          best = plan;
        }
        break;
      }
    }
  }

  return best ?? { error: 'Oversize — no roll fits' };
}

export function formatRollPlan(plan: RollPlan | { error: string } | undefined): string {
  if (!plan) return 'N/A';
  if ('error' in plan) return plan.error;

  const { slit_width_in, base_roll_in, orientation, waste_in, note } = plan;

  // Exact base match
  if (note === 'Exact base match') {
    return `${base_roll_in}" roll (exact fit, ${orientation})`;
  }

  // 36" fallback
  if (note === '36-inch fallback (72→36)') {
    return `72" roll → 36" slit (${orientation})`;
  }

  // Minimal waste with slit
  if (slit_width_in !== base_roll_in) {
    return `${base_roll_in}" roll → ${slit_width_in}" slit (${orientation}, waste ${waste_in.toFixed(2)}")`;
  }

  // No slit, exact fit
  return `${base_roll_in}" roll (${orientation}, waste ${waste_in.toFixed(2)}")`;
}
