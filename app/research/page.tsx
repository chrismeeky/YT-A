'use client';

import { useState, useEffect, useRef, useCallback } from 'react';
import { useSearchParams, useRouter } from 'next/navigation';
import {
  ResponsiveContainer, BarChart, Bar, XAxis, YAxis, Tooltip,
  ReferenceLine, Cell,
} from 'recharts';
import { useStorage } from '@/components/StorageProvider';
import { BETA_MODE } from '@/lib/beta';
import type { ResearchChannel, ResearchVideo, ChannelBookmark } from '@/lib/types';

// ─── Helpers ──────────────────────────────────────────────────────────────

function thumbUrl(url: string): string {
  if (!url) return '';
  return `/api/research/thumbnail?url=${encodeURIComponent(url)}`;
}

function parseDurSecs(dur: string): number {
  if (!dur || dur === 'N/A') return 0;
  const parts = dur.split(':').map(Number);
  if (parts.length === 3) return parts[0] * 3600 + parts[1] * 60 + parts[2];
  if (parts.length === 2) return parts[0] * 60 + parts[1];
  return parts[0];
}

function fmtAvgDur(secs: number): string {
  const h = Math.floor(secs / 3600);
  const m = Math.floor((secs % 3600) / 60);
  const s = Math.floor(secs % 60);
  if (h > 0) return `${h}:${String(m).padStart(2, '0')}:${String(s).padStart(2, '0')}`;
  return `${m}:${String(s).padStart(2, '0')}`;
}

function fmt(n: number): string {
  if (n >= 1_000_000) return `${(n / 1_000_000).toFixed(1)}M`;
  if (n >= 1_000) return `${(n / 1_000).toFixed(1)}K`;
  return String(n);
}

function fmtDate(iso: string): string {
  if (!iso) return '—';
  return new Date(iso).toLocaleDateString('en-US', { year: 'numeric', month: 'short', day: 'numeric' });
}

function outlierLabel(score: number): { label: string; color: string; bg: string } {
  if (score >= 1.5) return { label: 'Viral', color: '#22c55e', bg: 'rgba(34,197,94,0.12)' };
  if (score >= 0.8) return { label: 'Strong', color: '#84cc16', bg: 'rgba(132,204,22,0.12)' };
  if (score >= 0.4) return { label: 'Average', color: '#eab308', bg: 'rgba(234,179,8,0.12)' };
  if (score >= 0.1) return { label: 'Below Avg', color: '#f97316', bg: 'rgba(249,115,22,0.12)' };
  return { label: 'Low', color: '#ef4444', bg: 'rgba(239,68,68,0.12)' };
}

function timeAgo(iso: string): string {
  if (!iso) return '—';
  const diff = Date.now() - new Date(iso).getTime();
  const days = Math.floor(diff / 86400000);
  if (days < 1) return 'Today';
  if (days < 7) return `${days}d ago`;
  if (days < 30) return `${Math.floor(days / 7)}w ago`;
  if (days < 365) return `${Math.floor(days / 30)}mo ago`;
  return `${Math.floor(days / 365)}y ago`;
}

// ─── Country list (ISO 3166-1 alpha-2) ───────────────────────────────────

const WORLD_COUNTRIES: { code: string; name: string }[] = [
  { code: 'AF', name: 'Afghanistan' },
  { code: 'AL', name: 'Albania' },
  { code: 'DZ', name: 'Algeria' },
  { code: 'AD', name: 'Andorra' },
  { code: 'AO', name: 'Angola' },
  { code: 'AG', name: 'Antigua and Barbuda' },
  { code: 'AR', name: 'Argentina' },
  { code: 'AM', name: 'Armenia' },
  { code: 'AU', name: 'Australia' },
  { code: 'AT', name: 'Austria' },
  { code: 'AZ', name: 'Azerbaijan' },
  { code: 'BS', name: 'Bahamas' },
  { code: 'BH', name: 'Bahrain' },
  { code: 'BD', name: 'Bangladesh' },
  { code: 'BB', name: 'Barbados' },
  { code: 'BY', name: 'Belarus' },
  { code: 'BE', name: 'Belgium' },
  { code: 'BZ', name: 'Belize' },
  { code: 'BJ', name: 'Benin' },
  { code: 'BT', name: 'Bhutan' },
  { code: 'BO', name: 'Bolivia' },
  { code: 'BA', name: 'Bosnia and Herzegovina' },
  { code: 'BW', name: 'Botswana' },
  { code: 'BR', name: 'Brazil' },
  { code: 'BN', name: 'Brunei' },
  { code: 'BG', name: 'Bulgaria' },
  { code: 'BF', name: 'Burkina Faso' },
  { code: 'BI', name: 'Burundi' },
  { code: 'CV', name: 'Cabo Verde' },
  { code: 'KH', name: 'Cambodia' },
  { code: 'CM', name: 'Cameroon' },
  { code: 'CA', name: 'Canada' },
  { code: 'CF', name: 'Central African Republic' },
  { code: 'TD', name: 'Chad' },
  { code: 'CL', name: 'Chile' },
  { code: 'CN', name: 'China' },
  { code: 'CO', name: 'Colombia' },
  { code: 'KM', name: 'Comoros' },
  { code: 'CG', name: 'Congo' },
  { code: 'CD', name: 'Congo (DRC)' },
  { code: 'CR', name: 'Costa Rica' },
  { code: 'CI', name: "Côte d'Ivoire" },
  { code: 'HR', name: 'Croatia' },
  { code: 'CU', name: 'Cuba' },
  { code: 'CY', name: 'Cyprus' },
  { code: 'CZ', name: 'Czech Republic' },
  { code: 'DK', name: 'Denmark' },
  { code: 'DJ', name: 'Djibouti' },
  { code: 'DM', name: 'Dominica' },
  { code: 'DO', name: 'Dominican Republic' },
  { code: 'EC', name: 'Ecuador' },
  { code: 'EG', name: 'Egypt' },
  { code: 'SV', name: 'El Salvador' },
  { code: 'GQ', name: 'Equatorial Guinea' },
  { code: 'ER', name: 'Eritrea' },
  { code: 'EE', name: 'Estonia' },
  { code: 'SZ', name: 'Eswatini' },
  { code: 'ET', name: 'Ethiopia' },
  { code: 'FJ', name: 'Fiji' },
  { code: 'FI', name: 'Finland' },
  { code: 'FR', name: 'France' },
  { code: 'GA', name: 'Gabon' },
  { code: 'GM', name: 'Gambia' },
  { code: 'GE', name: 'Georgia' },
  { code: 'DE', name: 'Germany' },
  { code: 'GH', name: 'Ghana' },
  { code: 'GR', name: 'Greece' },
  { code: 'GD', name: 'Grenada' },
  { code: 'GT', name: 'Guatemala' },
  { code: 'GN', name: 'Guinea' },
  { code: 'GW', name: 'Guinea-Bissau' },
  { code: 'GY', name: 'Guyana' },
  { code: 'HT', name: 'Haiti' },
  { code: 'HN', name: 'Honduras' },
  { code: 'HU', name: 'Hungary' },
  { code: 'IS', name: 'Iceland' },
  { code: 'IN', name: 'India' },
  { code: 'ID', name: 'Indonesia' },
  { code: 'IR', name: 'Iran' },
  { code: 'IQ', name: 'Iraq' },
  { code: 'IE', name: 'Ireland' },
  { code: 'IL', name: 'Israel' },
  { code: 'IT', name: 'Italy' },
  { code: 'JM', name: 'Jamaica' },
  { code: 'JP', name: 'Japan' },
  { code: 'JO', name: 'Jordan' },
  { code: 'KZ', name: 'Kazakhstan' },
  { code: 'KE', name: 'Kenya' },
  { code: 'KI', name: 'Kiribati' },
  { code: 'KP', name: 'North Korea' },
  { code: 'KR', name: 'South Korea' },
  { code: 'KW', name: 'Kuwait' },
  { code: 'KG', name: 'Kyrgyzstan' },
  { code: 'LA', name: 'Laos' },
  { code: 'LV', name: 'Latvia' },
  { code: 'LB', name: 'Lebanon' },
  { code: 'LS', name: 'Lesotho' },
  { code: 'LR', name: 'Liberia' },
  { code: 'LY', name: 'Libya' },
  { code: 'LI', name: 'Liechtenstein' },
  { code: 'LT', name: 'Lithuania' },
  { code: 'LU', name: 'Luxembourg' },
  { code: 'MG', name: 'Madagascar' },
  { code: 'MW', name: 'Malawi' },
  { code: 'MY', name: 'Malaysia' },
  { code: 'MV', name: 'Maldives' },
  { code: 'ML', name: 'Mali' },
  { code: 'MT', name: 'Malta' },
  { code: 'MH', name: 'Marshall Islands' },
  { code: 'MR', name: 'Mauritania' },
  { code: 'MU', name: 'Mauritius' },
  { code: 'MX', name: 'Mexico' },
  { code: 'FM', name: 'Micronesia' },
  { code: 'MD', name: 'Moldova' },
  { code: 'MC', name: 'Monaco' },
  { code: 'MN', name: 'Mongolia' },
  { code: 'ME', name: 'Montenegro' },
  { code: 'MA', name: 'Morocco' },
  { code: 'MZ', name: 'Mozambique' },
  { code: 'MM', name: 'Myanmar' },
  { code: 'NA', name: 'Namibia' },
  { code: 'NR', name: 'Nauru' },
  { code: 'NP', name: 'Nepal' },
  { code: 'NL', name: 'Netherlands' },
  { code: 'NZ', name: 'New Zealand' },
  { code: 'NI', name: 'Nicaragua' },
  { code: 'NE', name: 'Niger' },
  { code: 'NG', name: 'Nigeria' },
  { code: 'MK', name: 'North Macedonia' },
  { code: 'NO', name: 'Norway' },
  { code: 'OM', name: 'Oman' },
  { code: 'PK', name: 'Pakistan' },
  { code: 'PW', name: 'Palau' },
  { code: 'PA', name: 'Panama' },
  { code: 'PG', name: 'Papua New Guinea' },
  { code: 'PY', name: 'Paraguay' },
  { code: 'PE', name: 'Peru' },
  { code: 'PH', name: 'Philippines' },
  { code: 'PL', name: 'Poland' },
  { code: 'PT', name: 'Portugal' },
  { code: 'QA', name: 'Qatar' },
  { code: 'RO', name: 'Romania' },
  { code: 'RU', name: 'Russia' },
  { code: 'RW', name: 'Rwanda' },
  { code: 'KN', name: 'Saint Kitts and Nevis' },
  { code: 'LC', name: 'Saint Lucia' },
  { code: 'VC', name: 'Saint Vincent and the Grenadines' },
  { code: 'WS', name: 'Samoa' },
  { code: 'SM', name: 'San Marino' },
  { code: 'ST', name: 'São Tomé and Príncipe' },
  { code: 'SA', name: 'Saudi Arabia' },
  { code: 'SN', name: 'Senegal' },
  { code: 'RS', name: 'Serbia' },
  { code: 'SC', name: 'Seychelles' },
  { code: 'SL', name: 'Sierra Leone' },
  { code: 'SG', name: 'Singapore' },
  { code: 'SK', name: 'Slovakia' },
  { code: 'SI', name: 'Slovenia' },
  { code: 'SB', name: 'Solomon Islands' },
  { code: 'SO', name: 'Somalia' },
  { code: 'ZA', name: 'South Africa' },
  { code: 'SS', name: 'South Sudan' },
  { code: 'ES', name: 'Spain' },
  { code: 'LK', name: 'Sri Lanka' },
  { code: 'SD', name: 'Sudan' },
  { code: 'SR', name: 'Suriname' },
  { code: 'SE', name: 'Sweden' },
  { code: 'CH', name: 'Switzerland' },
  { code: 'SY', name: 'Syria' },
  { code: 'TW', name: 'Taiwan' },
  { code: 'TJ', name: 'Tajikistan' },
  { code: 'TZ', name: 'Tanzania' },
  { code: 'TH', name: 'Thailand' },
  { code: 'TL', name: 'Timor-Leste' },
  { code: 'TG', name: 'Togo' },
  { code: 'TO', name: 'Tonga' },
  { code: 'TT', name: 'Trinidad and Tobago' },
  { code: 'TN', name: 'Tunisia' },
  { code: 'TR', name: 'Turkey' },
  { code: 'TM', name: 'Turkmenistan' },
  { code: 'TV', name: 'Tuvalu' },
  { code: 'UG', name: 'Uganda' },
  { code: 'UA', name: 'Ukraine' },
  { code: 'AE', name: 'United Arab Emirates' },
  { code: 'GB', name: 'United Kingdom' },
  { code: 'US', name: 'United States' },
  { code: 'UY', name: 'Uruguay' },
  { code: 'UZ', name: 'Uzbekistan' },
  { code: 'VU', name: 'Vanuatu' },
  { code: 'VE', name: 'Venezuela' },
  { code: 'VN', name: 'Vietnam' },
  { code: 'YE', name: 'Yemen' },
  { code: 'ZM', name: 'Zambia' },
  { code: 'ZW', name: 'Zimbabwe' },
];

// ─── Filter constants & scale helpers ────────────────────────────────────

const OUTLIER_MAX  = 5.0;
const DAYS_MAX     = 3650;
const VIEWS_STEPS  = 300;
const SUBS_STEPS   = 300;
const VIEWS_MAX    = 2_000_000;
const SUBS_MAX     = 10_000_000;

const sliderToViews = (pos: number) => Math.round((pos / VIEWS_STEPS) ** 2 * VIEWS_MAX);
const sliderToSubs  = (pos: number) => Math.round((pos / SUBS_STEPS)  ** 2 * SUBS_MAX);

function fmtViews(pos: number, steps: number, max: number): string {
  const v = Math.round((pos / steps) ** 2 * max);
  if (pos === steps) return `${fmt(v)}+`;
  return fmt(v);
}

function fmtDays(d: number, isMax: boolean): string {
  if (isMax && d >= DAYS_MAX) return '10y+';
  if (d >= 365) return `${(d / 365).toFixed(1)}y`;
  if (d >= 30)  return `${Math.round(d / 30)}mo`;
  return `${d}d`;
}

interface FilterState {
  outlierRange: [number, number];
  daysRange:    [number, number];
  viewsSlider:  [number, number];
  subsSlider:   [number, number];
  countries:    string[];
}

const DEFAULT_FILTERS: FilterState = {
  outlierRange: [0, OUTLIER_MAX],
  daysRange:    [0, DAYS_MAX],
  viewsSlider:  [0, VIEWS_STEPS],
  subsSlider:   [0, SUBS_STEPS],
  countries:    [],
};

function countryFlag(code: string): string {
  if (!code || code.length !== 2) return '';
  return String.fromCodePoint(
    0x1F1E6 + code.toUpperCase().charCodeAt(0) - 65,
    0x1F1E6 + code.toUpperCase().charCodeAt(1) - 65,
  );
}

function countActiveFilters(f: FilterState): number {
  return [
    f.outlierRange[0] > 0 || f.outlierRange[1] < OUTLIER_MAX,
    f.daysRange[0]    > 0 || f.daysRange[1]    < DAYS_MAX,
    f.viewsSlider[0]  > 0 || f.viewsSlider[1]  < VIEWS_STEPS,
    f.subsSlider[0]   > 0 || f.subsSlider[1]   < SUBS_STEPS,
    f.countries.length > 0,
  ].filter(Boolean).length;
}

function applyFilters(channels: ResearchChannel[], f: FilterState): ResearchChannel[] {
  return channels.filter(ch => {
    if (ch.outlierScore < f.outlierRange[0]) return false;
    if (f.outlierRange[1] < OUTLIER_MAX && ch.outlierScore > f.outlierRange[1]) return false;

    const ageDays = (Date.now() - new Date(ch.publishedAt).getTime()) / 86_400_000;
    if (ageDays < f.daysRange[0]) return false;
    if (f.daysRange[1] < DAYS_MAX && ageDays > f.daysRange[1]) return false;

    const viewsMin = sliderToViews(f.viewsSlider[0]);
    const viewsMax = sliderToViews(f.viewsSlider[1]);
    if (ch.avgRecentViews < viewsMin) return false;
    if (f.viewsSlider[1] < VIEWS_STEPS && ch.avgRecentViews > viewsMax) return false;

    const subsMin = sliderToSubs(f.subsSlider[0]);
    const subsMax = sliderToSubs(f.subsSlider[1]);
    if (ch.subscriberCount < subsMin) return false;
    if (f.subsSlider[1] < SUBS_STEPS && ch.subscriberCount > subsMax) return false;

    // Country is handled by baking country names into the search query, not by filtering here,
    // because snippet.country is empty on ~95% of YouTube channels.

    return true;
  });
}

// ─── Dual Range Slider ────────────────────────────────────────────────────

function DualRangeSlider({
  steps,
  value,
  onChange,
  toLabel,
}: {
  steps: number;
  value: [number, number];
  onChange: (v: [number, number]) => void;
  toLabel: (pos: number, isMax: boolean) => string;
}) {
  const [lo, hi] = value;
  const containerRef = useRef<HTMLDivElement>(null);

  // Keep mutable refs so the global event handlers always see latest values
  const stateRef = useRef({ lo, hi, steps, dragging: null as 'lo' | 'hi' | null });
  stateRef.current.lo = lo;
  stateRef.current.hi = hi;
  stateRef.current.steps = steps;
  const onChangeRef = useRef(onChange);
  onChangeRef.current = onChange;

  const posFromClientX = (clientX: number) => {
    if (!containerRef.current) return 0;
    const rect = containerRef.current.getBoundingClientRect();
    const { steps } = stateRef.current;
    return Math.max(0, Math.min(steps, Math.round(((clientX - rect.left) / rect.width) * steps)));
  };

  const commitMove = (clientX: number) => {
    const { dragging, lo, hi } = stateRef.current;
    if (!dragging) return;
    const pos = posFromClientX(clientX);
    if (dragging === 'lo') onChangeRef.current([Math.min(pos, hi - 1), hi]);
    else                   onChangeRef.current([lo, Math.max(pos, lo + 1)]);
  };

  const handlePointerDown = (e: React.MouseEvent | React.TouchEvent) => {
    e.preventDefault();
    const clientX = 'touches' in e ? e.touches[0].clientX : e.clientX;
    const pos = posFromClientX(clientX);
    const { lo, hi } = stateRef.current;
    // Pick whichever thumb is closer; tie goes to lo so it can be pushed right
    stateRef.current.dragging = Math.abs(pos - lo) <= Math.abs(pos - hi) ? 'lo' : 'hi';
    commitMove(clientX);
  };

  useEffect(() => {
    const onMouseMove  = (e: MouseEvent)  => commitMove(e.clientX);
    const onTouchMove  = (e: TouchEvent)  => { e.preventDefault(); commitMove(e.touches[0].clientX); };
    const onPointerUp  = ()               => { stateRef.current.dragging = null; };

    document.addEventListener('mousemove',  onMouseMove);
    document.addEventListener('mouseup',    onPointerUp);
    document.addEventListener('touchmove',  onTouchMove, { passive: false });
    document.addEventListener('touchend',   onPointerUp);
    return () => {
      document.removeEventListener('mousemove',  onMouseMove);
      document.removeEventListener('mouseup',    onPointerUp);
      document.removeEventListener('touchmove',  onTouchMove);
      document.removeEventListener('touchend',   onPointerUp);
    };
  }, []); // eslint-disable-line react-hooks/exhaustive-deps

  const pctLo = (lo / steps) * 100;
  const pctHi = (hi / steps) * 100;

  return (
    <div className="space-y-2">
      <div className="flex justify-between text-xs font-medium" style={{ color: 'var(--text)' }}>
        <span>{toLabel(lo, false)}</span>
        <span>{toLabel(hi, true)}</span>
      </div>
      <div
        ref={containerRef}
        className="relative h-5 flex items-center select-none cursor-pointer"
        onMouseDown={handlePointerDown}
        onTouchStart={handlePointerDown}
      >
        <div className="absolute w-full h-1.5 rounded-full" style={{ background: '#1e1e2e' }} />
        <div
          className="absolute h-1.5 rounded-full"
          style={{ left: `${pctLo}%`, right: `${100 - pctHi}%`, background: '#6366f1' }}
        />
        {/* Lo thumb */}
        <div
          className="absolute w-3.5 h-3.5 rounded-full border-2 border-white"
          style={{ left: `${pctLo}%`, transform: 'translateX(-50%)', background: '#6366f1', boxShadow: '0 1px 4px rgba(0,0,0,0.6)' }}
        />
        {/* Hi thumb */}
        <div
          className="absolute w-3.5 h-3.5 rounded-full border-2 border-white"
          style={{ left: `${pctHi}%`, transform: 'translateX(-50%)', background: '#6366f1', boxShadow: '0 1px 4px rgba(0,0,0,0.6)' }}
        />
      </div>
    </div>
  );
}

// ─── Filter Panel ─────────────────────────────────────────────────────────

function FilterPanel({
  filters,
  onChange,
  onReset,
  totalResults,
  filteredCount,
  availableCountries,
}: {
  filters: FilterState;
  onChange: (f: FilterState) => void;
  onReset: () => void;
  totalResults: number;
  filteredCount: number;
  availableCountries: string[];
}) {
  const [countryOpen, setCountryOpen] = useState(false);
  const [countrySearch, setCountrySearch] = useState('');
  const countryRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    if (!countryOpen) return;
    setCountrySearch('');
    const handler = (e: MouseEvent) => {
      if (countryRef.current && !countryRef.current.contains(e.target as Node)) {
        setCountryOpen(false);
      }
    };
    document.addEventListener('mousedown', handler);
    return () => document.removeEventListener('mousedown', handler);
  }, [countryOpen]);

  // All world countries; ones in results appear first with a count badge
  const availableSet = new Set(availableCountries);
  const countryList = (() => {
    const q = countrySearch.toLowerCase();
    const all = WORLD_COUNTRIES.filter(
      c => !q || c.name.toLowerCase().includes(q) || c.code.toLowerCase().includes(q),
    );
    const inResults = all.filter(c => availableSet.has(c.code));
    const rest      = all.filter(c => !availableSet.has(c.code));
    return [...inResults, ...rest];
  })();

  const set = <K extends keyof FilterState>(key: K, val: FilterState[K]) =>
    onChange({ ...filters, [key]: val });

  const toggleCountry = (code: string) => {
    const next = filters.countries.includes(code)
      ? filters.countries.filter(c => c !== code)
      : [...filters.countries, code];
    set('countries', next);
  };

  return (
    <div className="rounded-xl border p-4 mt-3" style={{ background: 'var(--surface-2)', borderColor: 'var(--border)' }}>
      <div className="grid grid-cols-2 gap-x-8 gap-y-5">
        {/* Outlier Score */}
        <div>
          <p className="text-[10px] uppercase tracking-wide font-semibold mb-2" style={{ color: 'var(--text-3)' }}>
            Outlier Score
          </p>
          <DualRangeSlider
            steps={50}
            value={[Math.round(filters.outlierRange[0] * 10), Math.round(filters.outlierRange[1] * 10)]}
            onChange={([lo, hi]) => set('outlierRange', [lo / 10, hi / 10])}
            toLabel={(pos, isMax) => isMax && pos === 50 ? `${(pos / 10).toFixed(1)}×+` : `${(pos / 10).toFixed(1)}×`}
          />
        </div>

        {/* Channel Age */}
        <div>
          <p className="text-[10px] uppercase tracking-wide font-semibold mb-2" style={{ color: 'var(--text-3)' }}>
            Channel Age
          </p>
          <DualRangeSlider
            steps={Math.round(DAYS_MAX / 30)}
            value={[Math.round(filters.daysRange[0] / 30), Math.round(filters.daysRange[1] / 30)]}
            onChange={([lo, hi]) => set('daysRange', [lo * 30, hi * 30])}
            toLabel={(pos, isMax) => fmtDays(pos * 30, isMax)}
          />
        </div>

        {/* Avg Views */}
        <div>
          <p className="text-[10px] uppercase tracking-wide font-semibold mb-2" style={{ color: 'var(--text-3)' }}>
            Avg Views
          </p>
          <DualRangeSlider
            steps={VIEWS_STEPS}
            value={filters.viewsSlider}
            onChange={v => set('viewsSlider', v)}
            toLabel={(pos, isMax) => fmtViews(pos, VIEWS_STEPS, VIEWS_MAX) + (isMax && pos < VIEWS_STEPS ? '' : '')}
          />
        </div>

        {/* Subscribers */}
        <div>
          <p className="text-[10px] uppercase tracking-wide font-semibold mb-2" style={{ color: 'var(--text-3)' }}>
            Subscribers
          </p>
          <DualRangeSlider
            steps={SUBS_STEPS}
            value={filters.subsSlider}
            onChange={v => set('subsSlider', v)}
            toLabel={(pos, isMax) => fmtViews(pos, SUBS_STEPS, SUBS_MAX)}
          />
        </div>
      </div>

      {/* Country filter */}
      <div className="mt-5" ref={countryRef}>
          <p className="text-[10px] uppercase tracking-wide font-semibold mb-1" style={{ color: 'var(--text-3)' }}>
            Country
          </p>
          <p className="text-[9px] mb-2" style={{ color: 'var(--text-3)', opacity: 0.6 }}>
            Adds country name to your search query
          </p>
          <div className="relative">
            {/* Trigger */}
            <button
              onClick={() => setCountryOpen(o => !o)}
              className="w-full flex items-center justify-between px-3 py-2 rounded-lg text-xs border transition-colors"
              style={{
                background: 'var(--surface)',
                borderColor: filters.countries.length > 0 ? '#6366f1' : 'var(--border)',
                color: 'var(--text)',
              }}
            >
              <span className="truncate" style={{ color: filters.countries.length > 0 ? 'var(--text)' : 'var(--text-3)' }}>
                {filters.countries.length === 0
                  ? 'All countries'
                  : filters.countries.map(c => {
                      const name = WORLD_COUNTRIES.find(w => w.code === c)?.name ?? c;
                      return `${countryFlag(c)} ${name}`;
                    }).join(', ')}
              </span>
              <span style={{ color: 'var(--text-3)' }}>{countryOpen ? '▲' : '▼'}</span>
            </button>

            {/* Dropdown */}
            {countryOpen && (
              <div
                className="absolute z-50 w-full mt-1 rounded-lg border flex flex-col"
                style={{ background: 'var(--surface)', borderColor: 'var(--border)', maxHeight: '260px' }}
              >
                {/* Search */}
                <div className="p-2 border-b flex-shrink-0" style={{ borderColor: 'var(--border)' }}>
                  <input
                    autoFocus
                    value={countrySearch}
                    onChange={e => setCountrySearch(e.target.value)}
                    placeholder="Search countries…"
                    className="w-full rounded-md px-2.5 py-1.5 text-xs outline-none border"
                    style={{ background: 'var(--surface-2)', borderColor: 'var(--border)', color: 'var(--text)' }}
                  />
                </div>
                {/* List */}
                <div className="overflow-y-auto flex-1">
                  {countryList.length === 0 && (
                    <p className="text-xs text-center py-4" style={{ color: 'var(--text-3)' }}>No countries found</p>
                  )}
                  {countryList.map(({ code, name }) => {
                    const active = filters.countries.includes(code);
                    const inResults = availableSet.has(code);
                    return (
                      <button
                        key={code}
                        onClick={() => toggleCountry(code)}
                        className="w-full flex items-center gap-2 px-3 py-2 text-xs transition-colors hover:bg-white/5 text-left"
                      >
                        <span
                          className="w-3.5 h-3.5 rounded-sm flex-shrink-0 flex items-center justify-center border text-[9px] font-bold"
                          style={active
                            ? { background: '#6366f1', borderColor: '#6366f1', color: '#fff' }
                            : { borderColor: 'var(--border)' }}
                        >
                          {active ? '✓' : ''}
                        </span>
                        <span>{countryFlag(code)}</span>
                        <span className="flex-1" style={{ color: active ? '#fff' : 'var(--text)' }}>{name}</span>
                        <span className="text-[10px] flex-shrink-0" style={{ color: 'var(--text-3)' }}>{code}</span>
                        {inResults && (
                          <span className="w-1.5 h-1.5 rounded-full flex-shrink-0" style={{ background: '#6366f1' }} title="Found in results" />
                        )}
                      </button>
                    );
                  })}
                </div>
              </div>
            )}
          </div>

          {/* Selected badges */}
          {filters.countries.length > 0 && (
            <div className="flex flex-wrap gap-1.5 mt-2">
              {filters.countries.map(code => {
                const name = WORLD_COUNTRIES.find(w => w.code === code)?.name ?? code;
                return (
                  <button
                    key={code}
                    onClick={() => toggleCountry(code)}
                    className="flex items-center gap-1 px-2 py-0.5 rounded-full text-xs font-medium transition-colors"
                    style={{ background: '#6366f1', color: '#fff' }}
                  >
                    <span>{countryFlag(code)}</span>
                    <span>{name}</span>
                    <span className="opacity-70">×</span>
                  </button>
                );
              })}
            </div>
          )}
        </div>

      {/* Footer */}
      <div className="flex items-center justify-between mt-4 pt-3 border-t" style={{ borderColor: 'var(--border)' }}>
        <p className="text-xs" style={{ color: 'var(--text-3)' }}>
          {filteredCount === totalResults
            ? `Showing all ${totalResults} channels`
            : <><span className="font-semibold" style={{ color: 'var(--text)' }}>{filteredCount}</span> of {totalResults} channels match</>}
        </p>
        <button
          onClick={onReset}
          className="text-xs px-3 py-1.5 rounded-lg transition-colors"
          style={{ background: 'var(--surface)', color: 'var(--text-3)', border: '1px solid var(--border)' }}
        >
          Reset filters
        </button>
      </div>
    </div>
  );
}

// ─── Performance Trend Chart ──────────────────────────────────────────────

interface ChartPoint {
  label: string;
  views: number;
  title: string;
  publishedAt: string;
  color: string;
}

function PerformanceTrendChart({ videos, avgViews }: { videos: ResearchVideo[]; avgViews: number }) {
  const sorted = [...videos].sort(
    (a, b) => new Date(a.publishedAt).getTime() - new Date(b.publishedAt).getTime(),
  );

  const data: ChartPoint[] = sorted.map(v => {
    const ratio = avgViews > 0 ? v.viewCount / avgViews : 0;
    const color = ratio >= 1.5 ? '#22c55e'
      : ratio >= 0.85 ? '#84cc16'
      : ratio >= 0.5  ? '#eab308'
      : '#ef4444';
    return {
      label: new Date(v.publishedAt).toLocaleDateString('en-US', { month: 'short', day: 'numeric' }),
      views: v.viewCount,
      title: v.title,
      publishedAt: v.publishedAt,
      color,
    };
  });

  const maxViews = Math.max(...data.map(d => d.views), avgViews);

  const CustomTooltip = ({ active, payload }: { active?: boolean; payload?: { payload: ChartPoint }[] }) => {
    if (!active || !payload?.length) return null;
    const d = payload[0].payload;
    const ratio = avgViews > 0 ? d.views / avgViews : 0;
    return (
      <div className="rounded-lg border p-3 max-w-[220px] shadow-xl" style={{ background: '#1a1a2e', borderColor: '#2a2a3e' }}>
        <p className="text-xs font-semibold leading-snug mb-2" style={{ color: '#e4e4f0' }}>{d.title}</p>
        <div className="space-y-1">
          <div className="flex items-center justify-between gap-4">
            <span className="text-[10px]" style={{ color: '#71717a' }}>Views</span>
            <span className="text-xs font-bold" style={{ color: d.color }}>{d.views.toLocaleString()}</span>
          </div>
          <div className="flex items-center justify-between gap-4">
            <span className="text-[10px]" style={{ color: '#71717a' }}>vs avg</span>
            <span className="text-xs font-semibold" style={{ color: d.color }}>{ratio.toFixed(2)}×</span>
          </div>
          <div className="flex items-center justify-between gap-4">
            <span className="text-[10px]" style={{ color: '#71717a' }}>Date</span>
            <span className="text-xs" style={{ color: '#a1a1aa' }}>{fmtDate(d.publishedAt)}</span>
          </div>
        </div>
      </div>
    );
  };

  const fmtYAxis = (v: number) => {
    if (v >= 1_000_000) return `${(v / 1_000_000).toFixed(1)}M`;
    if (v >= 1_000) return `${(v / 1_000).toFixed(0)}K`;
    return String(v);
  };

  return (
    <div>
      <div className="flex items-center justify-between mb-3">
        <p className="text-xs font-semibold uppercase tracking-wide" style={{ color: 'var(--text-3)' }}>
          Performance Trend
        </p>
        <div className="flex items-center gap-3 text-[10px]" style={{ color: 'var(--text-3)' }}>
          <span className="flex items-center gap-1"><span className="inline-block w-2 h-2 rounded-sm bg-[#22c55e]" />Viral</span>
          <span className="flex items-center gap-1"><span className="inline-block w-2 h-2 rounded-sm bg-[#84cc16]" />Strong</span>
          <span className="flex items-center gap-1"><span className="inline-block w-2 h-2 rounded-sm bg-[#eab308]" />Avg</span>
          <span className="flex items-center gap-1"><span className="inline-block w-2 h-2 rounded-sm bg-[#ef4444]" />Low</span>
        </div>
      </div>
      <div className="rounded-xl border overflow-hidden" style={{ background: '#0f0f1a', borderColor: 'var(--border)' }}>
        <ResponsiveContainer width="100%" height={180}>
          <BarChart data={data} margin={{ top: 16, right: 12, bottom: 4, left: 8 }} barCategoryGap="25%">
            <XAxis
              dataKey="label"
              tick={{ fontSize: 9, fill: '#52525b' }}
              axisLine={false}
              tickLine={false}
            />
            <YAxis
              tickFormatter={fmtYAxis}
              tick={{ fontSize: 9, fill: '#52525b' }}
              axisLine={false}
              tickLine={false}
              width={36}
              domain={[0, maxViews * 1.15]}
            />
            <Tooltip content={<CustomTooltip />} cursor={{ fill: 'rgba(99,102,241,0.08)' }} />
            <ReferenceLine
              y={avgViews}
              stroke="#6366f1"
              strokeDasharray="4 3"
              strokeWidth={1.5}
              label={{ value: 'avg', position: 'insideTopRight', fontSize: 9, fill: '#6366f1', dy: -4 }}
            />
            <Bar dataKey="views" radius={[3, 3, 0, 0]}>
              {data.map((entry, i) => (
                <Cell key={i} fill={entry.color} fillOpacity={0.85} />
              ))}
            </Bar>
          </BarChart>
        </ResponsiveContainer>
        <div className="px-4 pb-3 flex items-center gap-1.5">
          <div className="w-3 h-px border-t-2 border-dashed border-[#6366f1]" />
          <span className="text-[10px]" style={{ color: '#6366f1' }}>avg {fmt(avgViews)} views</span>
        </div>
      </div>
    </div>
  );
}

// ─── Channel Card ─────────────────────────────────────────────────────────

function ChannelCard({
  channel,
  bookmarked,
  onSelect,
  onToggleBookmark,
}: {
  channel: ResearchChannel;
  bookmarked: boolean;
  onSelect: () => void;
  onToggleBookmark: (e: React.MouseEvent) => void;
}) {
  const ol = outlierLabel(channel.outlierScore);

  return (
    <div
      onClick={onSelect}
      className="rounded-xl border cursor-pointer transition-all hover:border-[#6366f1] hover:shadow-lg group"
      style={{ background: 'var(--surface)', borderColor: 'var(--border)' }}
    >
      {/* Thumbnail */}
      <div className="relative h-20 rounded-t-xl overflow-hidden bg-[#1a1a1a]">
        {channel.thumbnail ? (
          <img
            src={thumbUrl(channel.thumbnail)}
            alt=""
            className="w-full h-full object-cover opacity-60 group-hover:opacity-80 transition-opacity"
            onError={e => { (e.target as HTMLImageElement).style.display = 'none'; }}
          />
        ) : null}
        {!channel.thumbnail && (
          <div className="w-full h-full flex items-center justify-center text-3xl">📺</div>
        )}
        {/* Bookmark button */}
        <button
          onClick={onToggleBookmark}
          className="absolute top-2 right-2 w-7 h-7 rounded-full flex items-center justify-center transition-colors"
          style={{ background: bookmarked ? '#6366f1' : 'rgba(0,0,0,0.5)' }}
          title={bookmarked ? 'Remove bookmark' : 'Bookmark channel'}
        >
          <span className="text-xs">{bookmarked ? '★' : '☆'}</span>
        </button>
      </div>

      <div className="p-3 space-y-2">
        <div>
          <p className="font-semibold text-sm truncate" style={{ color: 'var(--text)' }}>{channel.title}</p>
          {channel.customUrl && (
            <p className="text-xs truncate" style={{ color: 'var(--text-3)' }}>{channel.customUrl}</p>
          )}
        </div>

        {/* Stats row */}
        <div className="grid grid-cols-2 gap-x-3 gap-y-1 text-xs" style={{ color: 'var(--text-3)' }}>
          <div>
            <span className="block text-[10px] uppercase tracking-wide opacity-60">Subscribers</span>
            <span className="font-medium" style={{ color: 'var(--text)' }}>{fmt(channel.subscriberCount)}</span>
          </div>
          <div>
            <span className="block text-[10px] uppercase tracking-wide opacity-60">All-time Avg</span>
            <span className="font-medium" style={{ color: 'var(--text)' }}>{fmt(channel.avgRecentViews)}</span>
          </div>
          <div>
            <span className="block text-[10px] uppercase tracking-wide opacity-60">Videos</span>
            <span className="font-medium" style={{ color: 'var(--text)' }}>{fmt(channel.videoCount)}</span>
          </div>
          <div>
            <span className="block text-[10px] uppercase tracking-wide opacity-60">Country</span>
            <span className="font-medium" style={{ color: 'var(--text)' }}>{channel.country || '—'}</span>
          </div>
        </div>

        {/* Outlier badge */}
        <div className="flex items-center gap-2">
          <span
            className="inline-flex items-center gap-1 px-2 py-0.5 rounded-full text-xs font-semibold"
            style={{ color: ol.color, background: ol.bg }}
          >
            {ol.label}
          </span>
          <span className="text-xs" style={{ color: 'var(--text-3)' }}>
            ~{channel.outlierScore.toFixed(2)}× est.
          </span>
        </div>
      </div>
    </div>
  );
}

// ─── Channel Detail Drawer ────────────────────────────────────────────────

function ChannelDrawer({
  channel,
  bookmarked,
  bookmarkNote,
  bookmarkTags,
  onClose,
  onToggleBookmark,
  onSaveNote,
}: {
  channel: ResearchChannel;
  bookmarked: boolean;
  bookmarkNote: string;
  bookmarkTags: string[];
  onClose: () => void;
  onToggleBookmark: () => void;
  onSaveNote: (note: string, tags: string[]) => void;
}) {
  const router = useRouter();
  const [loadingDetail, setLoadingDetail] = useState(false);
  const [detail, setDetail] = useState<ResearchChannel | null>(null);
  const [noteText, setNoteText] = useState(bookmarkNote);
  const [tagsText, setTagsText] = useState(bookmarkTags.join(', '));
  const [apiKey, setApiKey] = useState<string | null>(null);
  const [videoTab, setVideoTab] = useState<'recent' | 'popular'>('recent');
  const storage = useStorage();

  useEffect(() => {
    storage.getSettings().then(s => setApiKey(s.youtubeApiKey));
  }, [storage]);

  useEffect(() => {
    setNoteText(bookmarkNote);
    setTagsText(bookmarkTags.join(', '));
  }, [bookmarkNote, bookmarkTags]);

  useEffect(() => {
    if (!channel.id || apiKey === null) return;
    setLoadingDetail(true);
    setDetail(null);
    fetch('/api/research/channel', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ channelId: channel.id, uploadsPlaylistId: channel.uploadsPlaylistId, youtubeApiKey: apiKey }),
    })
      .then(r => r.json())
      .then(data => { if (data.channel) setDetail(data.channel); })
      .finally(() => setLoadingDetail(false));
  }, [channel.id, apiKey]);

  const data = detail ?? channel;
  const ol = outlierLabel(data.outlierScore);

  return (
    <div className="fixed inset-0 z-50 flex justify-end" onClick={onClose}>
      <div
        className="w-full max-w-lg h-full overflow-y-auto flex flex-col border-l shadow-2xl"
        style={{ background: 'var(--surface)', borderColor: 'var(--border)' }}
        onClick={e => e.stopPropagation()}
      >
        {/* Header */}
        <div className="flex items-center gap-3 p-4 border-b sticky top-0 z-10" style={{ background: 'var(--surface)', borderColor: 'var(--border)' }}>
          <button onClick={onClose} className="text-lg opacity-60 hover:opacity-100 transition-opacity" style={{ color: 'var(--text)' }}>✕</button>
          <div className="flex-1 min-w-0">
            <p className="font-semibold text-sm truncate" style={{ color: 'var(--text)' }}>{data.title}</p>
            {data.customUrl && <p className="text-xs truncate" style={{ color: 'var(--text-3)' }}>{data.customUrl}</p>}
          </div>
          <button
            onClick={onToggleBookmark}
            className="flex items-center gap-1.5 px-3 py-1.5 rounded-lg text-xs font-medium transition-colors"
            style={bookmarked
              ? { background: '#6366f1', color: '#fff' }
              : { background: 'var(--surface-2)', color: 'var(--text)' }}
          >
            {bookmarked ? '★ Saved' : '☆ Save'}
          </button>
          <button
            onClick={() => {
              const channelUrl = data.customUrl
                ? `https://www.youtube.com/${data.customUrl}`
                : `https://www.youtube.com/channel/${data.id}`;
              router.push(`/?channel=${encodeURIComponent(channelUrl)}`);
            }}
            className="flex items-center gap-1.5 px-3 py-1.5 rounded-lg text-xs font-medium transition-colors flex-shrink-0"
            style={{ background: '#6366f1', color: '#fff' }}
          >
            Analyze
          </button>
          <a
            href={`https://www.youtube.com/${data.customUrl || `channel/${data.id}`}`}
            target="_blank"
            rel="noopener noreferrer"
            className="flex items-center gap-1.5 px-3 py-1.5 rounded-lg text-xs font-medium transition-colors"
            style={{ background: 'var(--surface-2)', color: 'var(--text)' }}
            onClick={e => e.stopPropagation()}
          >
            ↗ YouTube
          </a>
        </div>

        <div className="flex-1 p-4 space-y-5">
          {/* Channel profile */}
          <div className="flex gap-4 items-start">
            {data.thumbnail && (
              <img
                src={thumbUrl(data.thumbnail)}
                alt=""
                className="w-16 h-16 rounded-full object-cover flex-shrink-0 border"
                style={{ borderColor: 'var(--border)' }}
                onError={e => { (e.target as HTMLImageElement).style.display = 'none'; }}
              />
            )}
            <div className="flex-1 min-w-0">
              <p className="font-bold text-base" style={{ color: 'var(--text)' }}>{data.title}</p>
              {data.country && <p className="text-xs mt-0.5" style={{ color: 'var(--text-3)' }}>📍 {data.country}</p>}
              <p className="text-xs mt-0.5" style={{ color: 'var(--text-3)' }}>Created {fmtDate(data.publishedAt)}</p>
            </div>
          </div>

          {/* Key metrics */}
          <div className="grid grid-cols-2 gap-3">
            {[
              { label: 'Subscribers', value: fmt(data.subscriberCount) },
              { label: 'Total Views', value: fmt(data.viewCount) },
              { label: 'Videos', value: fmt(data.videoCount) },
              { label: 'All-time Avg', value: fmt(channel.avgRecentViews), muted: true },
              ...(detail && !loadingDetail
                ? [{ label: 'Recent Avg (15 vids)', value: fmt(detail.avgRecentViews), highlight: true }]
                : loadingDetail
                  ? [{ label: 'Recent Avg (15 vids)', value: '…', muted: true }]
                  : []),
              ...(detail && !loadingDetail && detail.recentVideos.length > 0 ? (() => {
                const valid = detail.recentVideos.filter(v => parseDurSecs(v.duration) > 0);
                if (!valid.length) return [];
                const avg = valid.reduce((s, v) => s + parseDurSecs(v.duration), 0) / valid.length;
                return [{ label: 'Avg Length', value: fmtAvgDur(Math.round(avg)) }];
              })() : []),
            ].map(({ label, value, highlight, muted }) => (
              <div
                key={label}
                className="rounded-lg p-3 border"
                style={{
                  background: highlight ? 'rgba(99,102,241,0.08)' : 'var(--surface-2)',
                  borderColor: highlight ? '#6366f1' : 'var(--border)',
                }}
              >
                <p className="text-[10px] uppercase tracking-wide opacity-60 mb-1" style={{ color: highlight ? '#6366f1' : 'var(--text-3)' }}>{label}</p>
                <p className="text-lg font-bold" style={{ color: muted && !highlight ? 'var(--text-3)' : 'var(--text)' }}>{value}</p>
              </div>
            ))}
          </div>

          {/* Outlier score */}
          <div className="rounded-lg p-4 border" style={{ background: 'var(--surface-2)', borderColor: 'var(--border)' }}>
            <div className="flex items-center justify-between mb-2">
              <div>
                <p className="text-xs font-semibold uppercase tracking-wide" style={{ color: 'var(--text-3)' }}>Outlier Score</p>
                <p className="text-[10px] mt-0.5" style={{ color: 'var(--text-3)' }}>
                  {loadingDetail ? 'Estimating…' : detail ? 'Based on last 15 videos' : 'All-time estimate'}
                </p>
              </div>
              <span className="inline-flex items-center gap-1 px-2.5 py-1 rounded-full text-xs font-bold" style={{ color: ol.color, background: ol.bg }}>
                {ol.label}
              </span>
            </div>
            <p className="text-3xl font-bold" style={{ color: ol.color }}>{data.outlierScore.toFixed(2)}×</p>
            <p className="text-xs mt-1" style={{ color: 'var(--text-3)' }}>
              {loadingDetail
                ? 'Calculating from recent videos…'
                : detail
                  ? `Avg ${fmt(detail.avgRecentViews)} views (last 15) vs ${fmt(data.subscriberCount)} subs`
                  : `Avg ${fmt(channel.avgRecentViews)} views (all-time) vs ${fmt(data.subscriberCount)} subs`}
            </p>
            <div className="mt-2 h-1.5 rounded-full overflow-hidden bg-[#1a1a1a]">
              <div
                className="h-full rounded-full transition-all"
                style={{ width: `${Math.min(data.outlierScore * 50, 100)}%`, background: ol.color }}
              />
            </div>
            {/* All-time vs recent comparison */}
            {detail && !loadingDetail && (
              <div className="mt-3 pt-3 border-t flex items-center justify-between" style={{ borderColor: 'var(--border)' }}>
                <div className="text-center">
                  <p className="text-[10px] uppercase tracking-wide opacity-60 mb-0.5" style={{ color: 'var(--text-3)' }}>All-time Est.</p>
                  <p className="text-sm font-semibold" style={{ color: 'var(--text-3)' }}>~{channel.outlierScore.toFixed(2)}×</p>
                </div>
                <div className="text-[10px]" style={{ color: 'var(--text-3)' }}>vs</div>
                <div className="text-center">
                  <p className="text-[10px] uppercase tracking-wide opacity-60 mb-0.5" style={{ color: 'var(--text-3)' }}>Recent (15 vids)</p>
                  <p className="text-sm font-semibold" style={{ color: ol.color }}>{detail.outlierScore.toFixed(2)}×</p>
                </div>
              </div>
            )}
          </div>

          {/* Performance trend chart */}
          {detail && !loadingDetail && detail.recentVideos.length > 1 && (
            <PerformanceTrendChart
              videos={detail.recentVideos}
              avgViews={detail.avgRecentViews}
            />
          )}

          {detail && !loadingDetail && (
            <PostingPattern videos={detail.recentVideos} />
          )}

          {/* Description */}
          {data.description && (
            <div>
              <p className="text-xs font-semibold uppercase tracking-wide mb-2" style={{ color: 'var(--text-3)' }}>About</p>
              <p className="text-sm leading-relaxed line-clamp-4" style={{ color: 'var(--text)' }}>{data.description}</p>
            </div>
          )}

          {/* Recent videos */}
          {loadingDetail && (
            <div className="flex items-center gap-2 text-sm" style={{ color: 'var(--text-3)' }}>
              <span className="animate-spin">⟳</span> Loading recent videos…
            </div>
          )}
          {!loadingDetail && detail && detail.recentVideos.length > 0 && (
            <div>
              <div className="flex items-center justify-between mb-3">
                <p className="text-xs font-semibold uppercase tracking-wide" style={{ color: 'var(--text-3)' }}>
                  Videos ({detail.recentVideos.length})
                </p>
                <div className="flex rounded-md overflow-hidden border text-[10px] font-medium" style={{ borderColor: 'var(--border)' }}>
                  {(['recent', 'popular'] as const).map(tab => (
                    <button
                      key={tab}
                      onClick={() => setVideoTab(tab)}
                      className="px-2.5 py-1 transition-colors capitalize"
                      style={videoTab === tab
                        ? { background: '#6366f1', color: '#fff' }
                        : { background: 'var(--surface-2)', color: 'var(--text-3)' }}
                    >
                      {tab}
                    </button>
                  ))}
                </div>
              </div>
              <div className="space-y-2">
                {(videoTab === 'recent'
                  ? detail.recentVideos
                  : [...detail.recentVideos].sort((a, b) => b.viewCount - a.viewCount)
                ).map(v => (
                  <VideoRow key={v.id} video={v} channelOutlierScore={detail.outlierScore} />
                ))}
              </div>
            </div>
          )}

          {/* Bookmark note */}
          {bookmarked && (
            <div className="rounded-lg p-4 border" style={{ background: 'var(--surface-2)', borderColor: 'var(--border)' }}>
              <p className="text-xs font-semibold uppercase tracking-wide mb-3" style={{ color: 'var(--text-3)' }}>Bookmark Notes</p>
              <textarea
                value={noteText}
                onChange={e => setNoteText(e.target.value)}
                placeholder="Add notes about this channel…"
                rows={3}
                className="w-full rounded-lg px-3 py-2 text-sm resize-none border outline-none focus:border-[#6366f1] transition-colors"
                style={{ background: 'var(--surface)', borderColor: 'var(--border)', color: 'var(--text)' }}
              />
              <div className="mt-2">
                <label className="text-xs block mb-1" style={{ color: 'var(--text-3)' }}>Tags (comma separated)</label>
                <input
                  value={tagsText}
                  onChange={e => setTagsText(e.target.value)}
                  placeholder="e.g. finance, competitor, niche-idea"
                  className="w-full rounded-lg px-3 py-2 text-sm border outline-none focus:border-[#6366f1] transition-colors"
                  style={{ background: 'var(--surface)', borderColor: 'var(--border)', color: 'var(--text)' }}
                />
              </div>
              <button
                onClick={() => onSaveNote(noteText, tagsText.split(',').map(t => t.trim()).filter(Boolean))}
                className="mt-2 px-3 py-1.5 rounded-lg text-xs font-medium transition-colors"
                style={{ background: '#6366f1', color: '#fff' }}
              >
                Save Notes
              </button>
            </div>
          )}
        </div>
      </div>
    </div>
  );
}

// ─── Posting Pattern ─────────────────────────────────────────────────────

function PostingPattern({ videos }: { videos: ResearchVideo[] }) {
  if (videos.length < 3) return null;

  const tz = Intl.DateTimeFormat().resolvedOptions().timeZone;
  const dayNames = ['Sun', 'Mon', 'Tue', 'Wed', 'Thu', 'Fri', 'Sat'];
  const dayCounts = new Array(7).fill(0);
  const hourCounts = new Array(24).fill(0);

  for (const v of videos) {
    const d = new Date(v.publishedAt);
    dayCounts[d.getDay()]++;
    hourCounts[d.getHours()]++;
  }

  const maxDay = Math.max(...dayCounts);

  // Average posts per week across the span of the video list
  const timestamps = videos.map(v => new Date(v.publishedAt).getTime());
  const spanMs = Math.max(...timestamps) - Math.min(...timestamps);
  const spanWeeks = spanMs / (7 * 86_400_000);
  const avgPerWeek = spanWeeks > 0 ? videos.length / spanWeeks : videos.length;
  const avgPerWeekStr = avgPerWeek % 1 < 0.25 || avgPerWeek % 1 > 0.75
    ? `${Math.round(avgPerWeek)}x`
    : `${avgPerWeek.toFixed(1)}x`;

  // Group hours into buckets for the summary
  const buckets = [
    { label: 'late night', range: [0, 6] },
    { label: 'morning', range: [6, 12] },
    { label: 'afternoon', range: [12, 18] },
    { label: 'evening', range: [18, 24] },
  ];
  const bucketTotals = buckets.map(b =>
    hourCounts.slice(b.range[0], b.range[1]).reduce((a, c) => a + c, 0),
  );
  const topBucket = buckets[bucketTotals.indexOf(Math.max(...bucketTotals))];

  // Most common individual hour → format as "3pm"
  const topHour = hourCounts.indexOf(Math.max(...hourCounts));
  const topHourStr = topHour === 0 ? '12am'
    : topHour < 12  ? `${topHour}am`
    : topHour === 12 ? '12pm'
    : `${topHour - 12}pm`;

  const topDays = dayNames
    .filter((_, i) => maxDay > 0 && dayCounts[i] >= maxDay * 0.75)
    .join(' & ') || dayNames[dayCounts.indexOf(maxDay)];

  const shortTz = (() => {
    try {
      return new Intl.DateTimeFormat('en', { timeZoneName: 'short', timeZone: tz })
        .formatToParts(new Date())
        .find(p => p.type === 'timeZoneName')?.value ?? tz;
    } catch { return tz; }
  })();

  return (
    <div>
      <p className="text-xs font-semibold uppercase tracking-wide mb-2" style={{ color: 'var(--text-3)' }}>
        Posting Pattern
        <span className="ml-1 normal-case font-normal">· {shortTz}</span>
      </p>
      <div className="rounded-lg p-3 space-y-2.5" style={{ background: 'var(--surface-2)' }}>
        {/* Day-of-week bar chart */}
        <div className="flex gap-1 items-end h-8">
          {dayNames.map((name, i) => {
            const pct = maxDay > 0 ? dayCounts[i] / maxDay : 0;
            return (
              <div key={i} className="flex flex-col items-center gap-1 flex-1">
                <div
                  className="w-full rounded-sm transition-all"
                  style={{
                    height: `${Math.max(3, Math.round(pct * 24))}px`,
                    background: pct > 0
                      ? `rgba(99,102,241,${0.2 + pct * 0.8})`
                      : 'var(--border)',
                  }}
                />
                <span className="text-[9px]" style={{ color: 'var(--text-3)' }}>{name}</span>
              </div>
            );
          })}
        </div>
        <p className="text-xs" style={{ color: 'var(--text-3)' }}>
          Usually posts on{' '}
          <span style={{ color: 'var(--text)' }}>{topDays}</span>
          {' '}in the{' '}
          <span style={{ color: 'var(--text)' }}>{topBucket.label}</span>
          {' '}by{' '}
          <span style={{ color: 'var(--text)' }}>{topHourStr} {shortTz}</span>
          {' · '}
          <span style={{ color: 'var(--text)' }}>{avgPerWeekStr} per week</span>
        </p>
      </div>
    </div>
  );
}

function VideoRow({ video, channelOutlierScore }: { video: ResearchVideo; channelOutlierScore: number }) {
  const isAboveAvg = channelOutlierScore > 0 && video.viewCount > 0;
  const localPostedAt = new Date(video.publishedAt).toLocaleString('en-US', {
    weekday: 'short', month: 'short', day: 'numeric', hour: 'numeric', minute: '2-digit',
  });
  return (
    <a
      href={`https://www.youtube.com/watch?v=${video.id}`}
      target="_blank"
      rel="noopener noreferrer"
      className="flex gap-3 items-center rounded-lg p-2 hover:bg-[#1a1a1a] transition-colors group"
      onClick={e => e.stopPropagation()}
    >
      <div className="relative w-20 h-12 rounded overflow-hidden flex-shrink-0 bg-[#1a1a1a]">
        <img
            src={thumbUrl(video.thumbnail)}
            alt=""
            className="w-full h-full object-cover"
            onError={e => { (e.target as HTMLImageElement).style.display = 'none'; }}
          />
        {video.duration && video.duration !== 'N/A' && (
          <span className="absolute bottom-0.5 right-0.5 bg-black/80 text-[9px] text-white px-1 rounded">
            {video.duration}
          </span>
        )}
      </div>
      <div className="flex-1 min-w-0">
        <p className="text-xs font-medium line-clamp-2 group-hover:text-[#6366f1] transition-colors" style={{ color: 'var(--text)' }}>
          {video.title}
        </p>
        <div className="flex items-center gap-2 mt-1">
          <span className="text-[10px]" style={{ color: 'var(--text-3)' }}>{fmt(video.viewCount)} views</span>
          <span className="text-[10px]" style={{ color: 'var(--text-3)' }}>·</span>
          <span className="text-[10px]" style={{ color: 'var(--text-3)' }}>{localPostedAt}</span>
          {isAboveAvg && video.viewCount > 0 && (
            <span className="text-[10px] px-1 rounded" style={{ background: 'rgba(99,102,241,0.15)', color: '#6366f1' }}>
              ↗ {fmt(video.viewCount)}
            </span>
          )}
        </div>
      </div>
    </a>
  );
}

// ─── Bookmark Card ────────────────────────────────────────────────────────

function BookmarkCard({
  bookmark,
  onSelect,
  onRemove,
}: {
  bookmark: ChannelBookmark;
  onSelect: () => void;
  onRemove: (e: React.MouseEvent) => void;
}) {
  const ol = outlierLabel(bookmark.channel.outlierScore);
  return (
    <div
      onClick={onSelect}
      className="rounded-xl border cursor-pointer transition-all hover:border-[#6366f1] hover:shadow-lg"
      style={{ background: 'var(--surface)', borderColor: 'var(--border)' }}
    >
      <div className="p-4 space-y-3">
        <div className="flex items-start gap-3">
          {bookmark.channel.thumbnail && (
            <img
              src={thumbUrl(bookmark.channel.thumbnail)}
              alt=""
              className="w-10 h-10 rounded-full object-cover flex-shrink-0 border"
              style={{ borderColor: 'var(--border)' }}
              onError={e => { (e.target as HTMLImageElement).style.display = 'none'; }}
            />
          )}
          <div className="flex-1 min-w-0">
            <p className="font-semibold text-sm truncate" style={{ color: 'var(--text)' }}>{bookmark.channel.title}</p>
            <p className="text-xs truncate" style={{ color: 'var(--text-3)' }}>{bookmark.channel.customUrl || `channel/${bookmark.channel.id}`}</p>
          </div>
          <button
            onClick={onRemove}
            className="text-xs opacity-40 hover:opacity-100 transition-opacity flex-shrink-0"
            style={{ color: '#ef4444' }}
            title="Remove bookmark"
          >
            ✕
          </button>
        </div>

        <div className="flex items-center gap-3 text-xs" style={{ color: 'var(--text-3)' }}>
          <span>{fmt(bookmark.channel.subscriberCount)} subs</span>
          <span>·</span>
          <span>{fmt(bookmark.channel.avgRecentViews)} avg views</span>
          <span className="ml-auto inline-flex items-center gap-1 px-2 py-0.5 rounded-full text-xs font-semibold whitespace-nowrap flex-shrink-0" style={{ color: ol.color, background: ol.bg }}>
            {ol.label} {bookmark.channel.outlierScore.toFixed(2)}×
          </span>
        </div>

        {bookmark.note && (
          <p className="text-xs line-clamp-2 italic" style={{ color: 'var(--text-3)' }}>{bookmark.note}</p>
        )}

        {bookmark.tags.length > 0 && (
          <div className="flex flex-wrap gap-1">
            {bookmark.tags.map(tag => (
              <span key={tag} className="text-[10px] px-2 py-0.5 rounded-full border" style={{ borderColor: 'var(--border)', color: 'var(--text-3)' }}>
                {tag}
              </span>
            ))}
          </div>
        )}

        <p className="text-[10px]" style={{ color: 'var(--text-3)' }}>Saved {timeAgo(bookmark.savedAt)}</p>
      </div>
    </div>
  );
}

// ─── Main Page ────────────────────────────────────────────────────────────

export default function ResearchPage() {
  const storage = useStorage();
  const searchParams = useSearchParams();

  const [tab, setTab] = useState<'search' | 'bookmarks'>('search');
  const [query, setQuery] = useState(() => searchParams.get('q') ?? '');
  const [results, setResults] = useState<ResearchChannel[]>([]);
  const [nextPageToken, setNextPageToken] = useState<string | undefined>();
  const [searching, setSearching] = useState(false);
  const [loadingMore, setLoadingMore] = useState(false);
  const [searchError, setSearchError] = useState('');
  const [lastQuery, setLastQuery] = useState('');

  const [bookmarks, setBookmarks] = useState<ChannelBookmark[]>([]);
  const [bookmarkIds, setBookmarkIds] = useState<Set<string>>(new Set());

  const [selectedChannel, setSelectedChannel] = useState<ResearchChannel | null>(null);
  const [drawerNote, setDrawerNote] = useState('');
  const [drawerTags, setDrawerTags] = useState<string[]>([]);

  const [sortBy, setSortBy] = useState<'outlier' | 'subs' | 'views'>(() => {
    const s = searchParams.get('sort');
    return s === 'subs' || s === 'views' ? s : 'outlier';
  });
  const [sortDir, setSortDir] = useState<'desc' | 'asc'>(() =>
    searchParams.get('dir') === 'asc' ? 'asc' : 'desc'
  );
  const [filters, setFilters] = useState<FilterState>(() => {
    const n = (key: string, fallback: number) => {
      const v = parseFloat(searchParams.get(key) ?? '');
      return isNaN(v) ? fallback : v;
    };
    const cc = searchParams.get('cc');
    return {
      outlierRange: [n('ol0', 0), n('ol1', OUTLIER_MAX)],
      daysRange:    [n('d0', 0),  n('d1', DAYS_MAX)],
      viewsSlider:  [n('v0', 0),  n('v1', VIEWS_STEPS)],
      subsSlider:   [n('s0', 0),  n('s1', SUBS_STEPS)],
      countries:    cc ? cc.split(',').filter(Boolean) : [],
    };
  });
  const [filtersOpen, setFiltersOpen] = useState(false);
  const [apiKey, setApiKey] = useState('');
  const [noApiKey, setNoApiKey] = useState(false);

  const inputRef = useRef<HTMLInputElement>(null);
  const initialQueryRef = useRef(searchParams.get('q') ?? '');

  useEffect(() => {
    storage.getSettings().then(s => {
      setApiKey(s.youtubeApiKey);
      setNoApiKey(!s.youtubeApiKey);
    });
    storage.listBookmarks().then(bms => {
      setBookmarks(bms);
      setBookmarkIds(new Set(bms.map(b => b.channel.id)));
    });
  }, [storage]);

  // Sync state to URL so filters + query survive reload
  useEffect(() => {
    const p = new URLSearchParams();
    if (query) p.set('q', query);
    if (sortBy !== 'outlier') p.set('sort', sortBy);
    if (sortDir !== 'desc') p.set('dir', sortDir);
    if (filters.outlierRange[0] !== 0)          p.set('ol0', String(filters.outlierRange[0]));
    if (filters.outlierRange[1] !== OUTLIER_MAX) p.set('ol1', String(filters.outlierRange[1]));
    if (filters.daysRange[0] !== 0)              p.set('d0',  String(filters.daysRange[0]));
    if (filters.daysRange[1] !== DAYS_MAX)       p.set('d1',  String(filters.daysRange[1]));
    if (filters.viewsSlider[0] !== 0)            p.set('v0',  String(filters.viewsSlider[0]));
    if (filters.viewsSlider[1] !== VIEWS_STEPS)  p.set('v1',  String(filters.viewsSlider[1]));
    if (filters.subsSlider[0] !== 0)             p.set('s0',  String(filters.subsSlider[0]));
    if (filters.subsSlider[1] !== SUBS_STEPS)    p.set('s1',  String(filters.subsSlider[1]));
    if (filters.countries.length > 0)            p.set('cc',  filters.countries.join(','));
    const qs = p.toString();
    window.history.replaceState(null, '', qs ? `/research?${qs}` : '/research');
  }, [query, sortBy, sortDir, filters]);

  const refreshBookmarks = useCallback(async () => {
    const bms = await storage.listBookmarks();
    setBookmarks(bms);
    setBookmarkIds(new Set(bms.map(b => b.channel.id)));
  }, [storage]);

  const doSearch = useCallback(async (q: string, token?: string) => {
    if (!q.trim()) return;
    const isLoadMore = !!token;
    if (isLoadMore) setLoadingMore(true); else setSearching(true);
    setSearchError('');

    try {
      const res = await fetch('/api/research/search', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ query: q, youtubeApiKey: apiKey, pageToken: token, maxResults: 20 }),
      });
      const data = await res.json() as { channels?: ResearchChannel[]; nextPageToken?: string; error?: string };
      if (!res.ok) throw new Error(data.error ?? 'Search failed');

      if (isLoadMore) {
        setResults(prev => {
          const seen = new Set(prev.map(c => c.id));
          const fresh = (data.channels ?? []).filter(c => !seen.has(c.id));
          return [...prev, ...fresh];
        });
      } else {
        const seen = new Set<string>();
        const deduped = (data.channels ?? []).filter(c => seen.has(c.id) ? false : (seen.add(c.id), true));
        setResults(deduped);
        setLastQuery(q);
      }
      setNextPageToken(data.nextPageToken);
    } catch (err) {
      const raw = err instanceof Error ? err.message : 'Search failed';
      const stripped = raw.replace(/<[^>]*>/g, '');
      const friendly = stripped.includes('quota')
        ? "You've hit the YouTube API daily quota limit. It resets at midnight Pacific time — try again tomorrow or use a different API key."
        : stripped.includes('API key')
          ? 'Invalid YouTube API key. Check your key in Settings.'
          : stripped.includes('keyInvalid') || stripped.includes('forbidden')
            ? 'API key is invalid or missing permissions. Check Settings.'
            : stripped || 'Search failed. Please try again.';
      setSearchError(friendly);
    } finally {
      if (isLoadMore) setLoadingMore(false); else setSearching(false);
    }
  }, [apiKey]);

  // Bake selected country names into the search query so YouTube returns relevant channels.
  // snippet.country is empty on ~95% of channels, making post-fetch filtering useless.
  const buildEffectiveQuery = useCallback((baseQuery: string, countries: string[]) => {
    if (!countries.length) return baseQuery;
    const names = countries
      .map(c => WORLD_COUNTRIES.find(w => w.code === c)?.name ?? c)
      .join(' ');
    return `${baseQuery} ${names}`;
  }, []);

  // Auto-run search from URL on first load once the API key is available
  useEffect(() => {
    if (apiKey && initialQueryRef.current) {
      const eq = buildEffectiveQuery(initialQueryRef.current, filters.countries);
      doSearch(eq);
      initialQueryRef.current = '';
    }
  }, [apiKey, doSearch]); // eslint-disable-line react-hooks/exhaustive-deps

  // Re-search when country selection changes (and user has already searched)
  const prevCountriesKeyRef = useRef(filters.countries.join(','));
  useEffect(() => {
    const key = filters.countries.join(',');
    if (key === prevCountriesKeyRef.current) return;
    prevCountriesKeyRef.current = key;
    if (!query.trim() || !apiKey) return;
    doSearch(buildEffectiveQuery(query, filters.countries));
  }, [filters.countries, query, apiKey, doSearch, buildEffectiveQuery]);

  const handleSearch = (e: React.FormEvent) => {
    e.preventDefault();
    doSearch(buildEffectiveQuery(query, filters.countries));
  };

  const sortedResults = [...results].sort((a, b) => {
    const dir = sortDir === 'desc' ? 1 : -1;
    if (sortBy === 'outlier') return dir * (b.outlierScore - a.outlierScore);
    if (sortBy === 'subs') return dir * (b.subscriberCount - a.subscriberCount);
    return dir * (b.avgRecentViews - a.avgRecentViews);
  });

  const filteredResults = applyFilters(sortedResults, filters);
  const activeFilterCount = countActiveFilters(filters);

  const availableCountries = (() => {
    const freq: Record<string, number> = {};
    for (const ch of results) {
      const code = (ch.country ?? '').toUpperCase().trim();
      if (code.length === 2) freq[code] = (freq[code] ?? 0) + 1;
    }
    return Object.entries(freq)
      .sort((a, b) => b[1] - a[1])
      .map(([code]) => code);
  })();

  // When non-country filters are active and few results show, auto-load the next page.
  useEffect(() => {
    if (!nextPageToken || !lastQuery || searching || loadingMore) return;
    const nonCountryFilters = activeFilterCount - (filters.countries.length > 0 ? 1 : 0);
    if (nonCountryFilters === 0) return;
    if (filteredResults.length >= 10) return;

    const timer = setTimeout(() => doSearch(lastQuery, nextPageToken), 600);
    return () => clearTimeout(timer);
  }, [filteredResults.length, nextPageToken, activeFilterCount, filters.countries.length, lastQuery, searching, loadingMore, doSearch]);

  const handleToggleBookmark = async (channel: ResearchChannel, e?: React.MouseEvent) => {
    e?.stopPropagation();
    if (bookmarkIds.has(channel.id)) {
      await storage.deleteBookmark(channel.id);
    } else {
      const bm: ChannelBookmark = {
        channel,
        note: '',
        tags: [],
        savedAt: new Date().toISOString(),
      };
      await storage.saveBookmark(bm);
    }
    await refreshBookmarks();
  };

  const handleSaveNote = async (note: string, tags: string[]) => {
    if (!selectedChannel) return;
    const existing = await storage.getBookmark(selectedChannel.id);
    if (existing) {
      await storage.saveBookmark({ ...existing, note, tags });
      await refreshBookmarks();
      setDrawerNote(note);
      setDrawerTags(tags);
    }
  };

  const openDrawer = (channel: ResearchChannel) => {
    setSelectedChannel(channel);
    const bm = bookmarks.find(b => b.channel.id === channel.id);
    setDrawerNote(bm?.note ?? '');
    setDrawerTags(bm?.tags ?? []);
  };

  return (
    <div className="flex-1 flex flex-col min-h-0 overflow-hidden">
      {/* Page header */}
      <div className="border-b px-6 py-4 flex-shrink-0" style={{ borderColor: 'var(--border)' }}>
        <div className="flex items-center justify-between">
          <div>
            <h1 className="text-xl font-bold" style={{ color: 'var(--text)' }}>Channel Research</h1>
            <p className="text-sm mt-0.5" style={{ color: 'var(--text-3)' }}>Find and analyze YouTube channels by niche or keyword</p>
          </div>
          {/* Tabs */}
          <div className="flex rounded-lg border overflow-hidden" style={{ borderColor: 'var(--border)' }}>
            {(['search', 'bookmarks'] as const).map(t => (
              <button
                key={t}
                onClick={() => setTab(t)}
                className="px-4 py-2 text-sm font-medium capitalize transition-colors"
                style={tab === t
                  ? { background: '#6366f1', color: '#fff' }
                  : { background: 'var(--surface)', color: 'var(--text-3)' }}
              >
                {t === 'bookmarks' ? `Bookmarks${bookmarks.length > 0 ? ` (${bookmarks.length})` : ''}` : 'Search'}
              </button>
            ))}
          </div>
        </div>
      </div>

      {noApiKey && !BETA_MODE && (
        <div className="mx-6 mt-4 flex-shrink-0 rounded-lg border border-yellow-500/30 bg-yellow-500/10 px-4 py-3 text-sm" style={{ color: '#facc15' }}>
          No YouTube API key found. Add one in{' '}
          <a href="/settings" className="underline font-medium">Settings</a>{' '}
          to start researching channels.
        </div>
      )}

      {/* Search tab */}
      {tab === 'search' && (
        <div className="flex-1 flex flex-col min-h-0 overflow-hidden">
          {/* Search bar */}
          <div className="px-6 py-4 border-b flex-shrink-0" style={{ borderColor: 'var(--border)' }}>
            <form onSubmit={handleSearch} className="flex gap-3">
              <input
                ref={inputRef}
                value={query}
                onChange={e => setQuery(e.target.value)}
                placeholder="Search by niche, keyword, or topic (e.g. personal finance, fitness, cooking)…"
                className="flex-1 rounded-lg px-4 py-2.5 text-sm border outline-none focus:border-[#6366f1] transition-colors"
                style={{ background: 'var(--surface-2)', borderColor: 'var(--border)', color: 'var(--text)' }}
                disabled={searching || !apiKey}
              />
              <button
                type="submit"
                disabled={searching || !query.trim() || !apiKey}
                className="px-5 py-2.5 rounded-lg text-sm font-semibold transition-colors disabled:opacity-40"
                style={{ background: '#6366f1', color: '#fff' }}
              >
                {searching ? 'Searching…' : 'Search'}
              </button>
            </form>

            {results.length > 0 && (
              <div className="flex items-center gap-3 mt-3">
                <span className="text-xs" style={{ color: 'var(--text-3)' }}>
                  {activeFilterCount > 0
                    ? <><span className="font-semibold" style={{ color: 'var(--text)' }}>{filteredResults.length}</span> of {results.length} channels</>
                    : <>{results.length} channels for &ldquo;{lastQuery}&rdquo;</>}
                </span>

                <div className="ml-auto flex items-center gap-2">
                  {/* Filters toggle */}
                  <button
                    onClick={() => setFiltersOpen(o => !o)}
                    className="flex items-center gap-1.5 text-xs px-2.5 py-1 rounded-md transition-colors"
                    style={filtersOpen || activeFilterCount > 0
                      ? { background: '#6366f1', color: '#fff' }
                      : { background: 'var(--surface-2)', color: 'var(--text-3)' }}
                  >
                    ⚡ Filters
                    {activeFilterCount > 0 && (
                      <span className="inline-flex items-center justify-center w-4 h-4 rounded-full text-[10px] font-bold bg-white text-[#6366f1]">
                        {activeFilterCount}
                      </span>
                    )}
                  </button>

                  <div className="w-px h-4 bg-[#2a2a3a]" />

                  <span className="text-xs" style={{ color: 'var(--text-3)' }}>Sort:</span>
                  {(['outlier', 'subs', 'views'] as const).map(s => (
                    <button
                      key={s}
                      onClick={() => {
                        if (sortBy === s) setSortDir(d => d === 'desc' ? 'asc' : 'desc');
                        else { setSortBy(s); setSortDir('desc'); }
                      }}
                      className="text-xs px-2.5 py-1 rounded-md transition-colors flex items-center gap-1"
                      style={sortBy === s
                        ? { background: '#6366f1', color: '#fff' }
                        : { background: 'var(--surface-2)', color: 'var(--text-3)' }}
                    >
                      {s === 'outlier' ? 'Outlier Score' : s === 'subs' ? 'Subscribers' : 'Avg Views'}
                      {sortBy === s && <span>{sortDir === 'desc' ? '↓' : '↑'}</span>}
                    </button>
                  ))}
                </div>
              </div>
            )}

            {/* Filter panel */}
            {filtersOpen && results.length > 0 && (
              <FilterPanel
                filters={filters}
                onChange={setFilters}
                onReset={() => setFilters(DEFAULT_FILTERS)}
                totalResults={results.length}
                filteredCount={filteredResults.length}
                availableCountries={availableCountries}
              />
            )}
          </div>

          {/* Results */}
          <div className="flex-1 overflow-y-auto px-6 py-4">
            {searchError && (
              <div className="rounded-lg border border-red-500/30 bg-red-500/10 px-4 py-3 text-sm mb-4" style={{ color: '#f87171' }}>
                {searchError}
              </div>
            )}

            {searching && (
              <div className="flex flex-col items-center justify-center py-20 gap-3">
                <div className="text-3xl animate-spin">⟳</div>
                <p className="text-sm" style={{ color: 'var(--text-3)' }}>Searching YouTube…</p>
              </div>
            )}

            {!searching && results.length === 0 && !searchError && (
              <div className="flex flex-col items-center justify-center py-20 gap-3 text-center">
                <div className="text-5xl opacity-20">🔍</div>
                <p className="text-base font-medium" style={{ color: 'var(--text)' }}>Search for channels</p>
                <p className="text-sm max-w-sm" style={{ color: 'var(--text-3)' }}>
                  Enter a niche, keyword, or topic to discover YouTube channels and analyze their outlier potential.
                </p>
                <div className="flex flex-wrap gap-2 mt-2 justify-center">
                  {['personal finance', 'minimalism', 'tech reviews', 'cooking', 'true crime', 'ai tools'].map(s => (
                    <button
                      key={s}
                      onClick={() => { setQuery(s); setTimeout(() => doSearch(s), 0); }}
                      className="text-xs px-3 py-1.5 rounded-full border transition-colors hover:border-[#6366f1]"
                      style={{ borderColor: 'var(--border)', color: 'var(--text-3)' }}
                    >
                      {s}
                    </button>
                  ))}
                </div>
              </div>
            )}

            {!searching && sortedResults.length > 0 && filteredResults.length === 0 && (
              <div className="flex flex-col items-center justify-center py-16 gap-3 text-center">
                <div className="text-4xl opacity-20">⚡</div>
                <p className="text-base font-medium" style={{ color: 'var(--text)' }}>No channels match your filters</p>
                <p className="text-sm" style={{ color: 'var(--text-3)' }}>Try widening the filter ranges.</p>
                <button
                  onClick={() => setFilters(DEFAULT_FILTERS)}
                  className="mt-1 px-4 py-1.5 rounded-lg text-sm font-medium"
                  style={{ background: '#6366f1', color: '#fff' }}
                >
                  Reset filters
                </button>
              </div>
            )}

            {!searching && filteredResults.length > 0 && (
              <>
                <div className="grid grid-cols-2 sm:grid-cols-3 lg:grid-cols-4 xl:grid-cols-5 gap-4">
                  {filteredResults.map(ch => (
                    <ChannelCard
                      key={ch.id}
                      channel={ch}
                      bookmarked={bookmarkIds.has(ch.id)}
                      onSelect={() => openDrawer(ch)}
                      onToggleBookmark={e => handleToggleBookmark(ch, e)}
                    />
                  ))}
                </div>

                {nextPageToken && (
                  <div className="flex flex-col items-center gap-2 mt-6">
                    {loadingMore && activeFilterCount > 0 && (
                      <p className="text-xs" style={{ color: 'var(--text-3)' }}>
                        {filters.countries.length > 0
                          ? `Scanning all pages for ${filters.countries.map(c => WORLD_COUNTRIES.find(w => w.code === c)?.name ?? c).join(', ')} channels…`
                          : 'Searching for more matches…'}
                      </p>
                    )}
                    <button
                      onClick={() => doSearch(lastQuery, nextPageToken)}
                      disabled={loadingMore}
                      className="px-6 py-2.5 rounded-lg text-sm font-medium transition-colors disabled:opacity-40"
                      style={{ background: 'var(--surface-2)', color: 'var(--text)', border: '1px solid var(--border)' }}
                    >
                      {loadingMore ? 'Loading…' : activeFilterCount > 0 ? 'Load more results' : 'Load more'}
                    </button>
                    {activeFilterCount > 0 && !loadingMore && (
                      <p className="text-xs" style={{ color: 'var(--text-3)' }}>
                        {filteredResults.length} match{filteredResults.length !== 1 ? 'es' : ''} from {results.length} loaded — more pages available
                      </p>
                    )}
                  </div>
                )}
              </>
            )}
          </div>
        </div>
      )}

      {/* Bookmarks tab */}
      {tab === 'bookmarks' && (
        <div className="flex-1 overflow-y-auto px-6 py-4">
          {bookmarks.length === 0 ? (
            <div className="flex flex-col items-center justify-center py-20 gap-3 text-center">
              <div className="text-5xl opacity-20">★</div>
              <p className="text-base font-medium" style={{ color: 'var(--text)' }}>No bookmarks yet</p>
              <p className="text-sm max-w-sm" style={{ color: 'var(--text-3)' }}>
                Bookmark channels from search results to save them here for future analysis.
              </p>
              <button
                onClick={() => setTab('search')}
                className="mt-2 px-4 py-2 rounded-lg text-sm font-medium"
                style={{ background: '#6366f1', color: '#fff' }}
              >
                Start searching
              </button>
            </div>
          ) : (
            <div className="grid grid-cols-2 sm:grid-cols-3 lg:grid-cols-4 gap-4">
              {bookmarks
                .sort((a, b) => new Date(b.savedAt).getTime() - new Date(a.savedAt).getTime())
                .map(bm => (
                  <BookmarkCard
                    key={bm.channel.id}
                    bookmark={bm}
                    onSelect={() => openDrawer(bm.channel)}
                    onRemove={async e => {
                      e.stopPropagation();
                      await storage.deleteBookmark(bm.channel.id);
                      await refreshBookmarks();
                    }}
                  />
                ))}
            </div>
          )}
        </div>
      )}

      {/* Channel detail drawer */}
      {selectedChannel && (
        <ChannelDrawer
          channel={selectedChannel}
          bookmarked={bookmarkIds.has(selectedChannel.id)}
          bookmarkNote={drawerNote}
          bookmarkTags={drawerTags}
          onClose={() => setSelectedChannel(null)}
          onToggleBookmark={() => handleToggleBookmark(selectedChannel)}
          onSaveNote={handleSaveNote}
        />
      )}
    </div>
  );
}
