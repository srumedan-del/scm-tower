import { supabaseAdmin as supabase } from "@/lib/supabaseAdmin";
import {
  OutboundHeaderUploadButton,
  OutboundDetailUploadButton,
} from "@/components/outbound/OutboundUploadButton";
import PssDetailModal from "@/components/outbound/PssDetailModal";
import OutboundFilter from "@/components/outbound/OutboundFilter";
import { Suspense } from "react";

export const dynamic = "force-dynamic";

function getNextMonthFirstDay(month: string): string {
  const [y, m] = month.split("-").map(Number);
  const next =
    m === 12 ? `${y + 1}-01-01` : `${y}-${String(m + 1).padStart(2, "0")}-01`;
  return next;
}

async function getAvailableMonths() {
  const { data } = await supabase
    .from("outbound_header")
    .select("document_date")
    .not("document_date", "is", null)
    .order("document_date", { ascending: true })
    .limit(1);

  const minDate = data?.[0]?.document_date;
  const minDateNorm = minDate ?? "2026-01";
  const [minYear, minMonth] = minDateNorm.slice(0, 7).split("-").map(Number);

  const now = new Date();
  const maxYear = now.getFullYear();
  const maxMonth = now.getMonth() + 1;

  const months: string[] = [];
  for (let y = minYear; y <= maxYear; y++) {
    const startM = y === minYear ? minMonth : 1;
    const endM = y === maxYear ? maxMonth : 12;
    for (let m = startM; m <= endM; m++) {
      months.push(`${y}-${String(m).padStart(2, "0")}`);
    }
  }
  return months.sort().reverse();
}

async function getOutboundHeaders(months: string[], customer: string) {
  let query = supabase
    .from("outbound_header")
    .select(
      "id, pss_no, shipment_no, document_date, document_created_at, order_no, " +
        "customer_no, customer_name, " +
        "delivery_delay_days, is_late",
    )
    .order("document_date", { ascending: false })
    .order("pss_no", { ascending: false });

  if (months.length > 0) {
    const conditions = months
      .map(
        (m) =>
          `and(document_date.gte.${m}-01,document_date.lt.${getNextMonthFirstDay(m)})`,
      )
      .join(",");
    query = query.or(conditions);
  }

  if (customer) {
    query = query.ilike("customer_name", `%${customer}%`);
  }

  const { data } = await query.limit(500);
  const rows = (data ?? []) as unknown as Array<{
    customer_no: string | null;
    document_created_at: string | null;
    [key: string]: any;
  }>;
  const customerCodes = [
    ...new Set(rows.map((row) => row.customer_no).filter(Boolean)),
  ];
  const regionByCustomer = new Map<string, string>();

  if (customerCodes.length) {
    const { data: customers } = await supabase
      .from("customers")
      .select("customer_code, dk_lk")
      .in("customer_code", customerCodes);

    for (const item of customers ?? []) {
      if (item.customer_code && item.dk_lk)
        regionByCustomer.set(item.customer_code, item.dk_lk);
    }
  }

  return rows.map((row) => {
    const region = row.customer_no
      ? regionByCustomer.get(row.customer_no)
      : null;
    const hours = region === "DK" ? 48 : region === "LK" ? 72 : null;
    const createdAt = row.document_created_at
      ? new Date(row.document_created_at).getTime()
      : NaN;
    const mta =
      hours !== null && Number.isFinite(createdAt)
        ? new Date(createdAt + hours * 60 * 60 * 1000).toISOString()
        : null;

    return { ...row, dk_lk: region, mta };
  });
}

function formatDateTime(value: string | null, includeTime = true) {
  if (!value) return "-";
  const date = new Date(value);
  if (Number.isNaN(date.getTime())) return "-";
  const parts = new Intl.DateTimeFormat("en-GB", {
    day: "2-digit",
    month: "2-digit",
    year: "numeric",
    ...(includeTime
      ? { hour: "2-digit", minute: "2-digit", hour12: false }
      : {}),
    timeZone: "Asia/Jakarta",
  }).formatToParts(date);
  const get = (type: string) =>
    parts.find((part) => part.type === type)?.value ?? "";
  const day = get("day");
  const month = get("month");
  const year = get("year");
  return includeTime
    ? `${day}/${month}/${year}, ${get("hour")}:${get("minute")}`
    : `${day}/${month}/${year}`;
}

export default async function OutboundPage({
  searchParams,
}: {
  searchParams: Promise<{ month?: string | string[]; customer?: string }>;
}) {
  const sp = await searchParams;
  const monthParam = sp.month;
  const months =
    typeof monthParam === "string"
      ? monthParam.split(",").filter(Boolean)
      : (monthParam ?? []);
  const customer =
    typeof sp.customer === "string" ? sp.customer.trim().slice(0, 100) : "";

  const [rows, availableMonths] = await Promise.all([
    getOutboundHeaders(months, customer),
    getAvailableMonths(),
  ]);

  return (
    <div className="space-y-4">
      <header className="flex items-center justify-between gap-4">
        <h1 className="text-3xl font-bold">OUTBOUND</h1>
        <div className="flex items-center gap-3">
          <Suspense>
            <OutboundFilter months={availableMonths} />
          </Suspense>
          <OutboundHeaderUploadButton />
          <OutboundDetailUploadButton />
        </div>
      </header>

      <div className="receiving-table-scroll data-list-scroll max-h-[calc(100vh-7.5rem)] overflow-auto rounded-2xl border border-[#E5E7EB] bg-white shadow-sm">
        <table className="w-full min-w-[980px] whitespace-nowrap text-xs">
          <colgroup>
            <col className="w-[18%]" />
            <col className="w-[12%]" />
            <col className="w-[15%]" />
            <col className="w-[32%]" />
            <col className="w-[14%]" />
            <col className="w-[9%]" />
          </colgroup>
          <thead className="sticky top-0 z-10 border-b border-[#E5E7EB] bg-[#F8FAFC]">
            <tr>
              <th className="px-4 py-2.5 text-xs font-bold uppercase tracking-[0.1em] text-[#64748B] whitespace-nowrap">
                DOCUMENT DATE TIME
              </th>
              <th className="px-4 py-2.5 text-xs font-bold uppercase tracking-[0.1em] text-[#64748B] whitespace-nowrap">
                PSS NO
              </th>
              <th className="px-4 py-2.5 text-xs font-bold uppercase tracking-[0.1em] text-[#64748B] whitespace-nowrap">
                ORDER NO
              </th>
              <th className="px-4 py-2.5 text-xs font-bold uppercase tracking-[0.1em] text-[#64748B] whitespace-nowrap">
                CUSTOMER NAME
              </th>
              <th className="px-4 py-2.5 text-xs font-bold uppercase tracking-[0.1em] text-[#64748B] whitespace-nowrap">
                MTA
              </th>
              <th className="px-4 py-2.5 text-xs font-bold uppercase tracking-[0.1em] text-[#64748B] whitespace-nowrap">
                DELAY
              </th>
            </tr>
          </thead>
          <tbody className="divide-y divide-[#EEF0F4]">
            {rows.map((r: any) => {
              const pssNo = String(r.pss_no ?? r.shipment_no ?? "-");
              const isLate = r.is_late === true;
              const delayDays = r.delivery_delay_days ?? null;

              return (
                <tr key={r.id} className="group border-t border-[#EEF0F4] transition-colors hover:bg-[#F8FAFC]">
                  <td className="px-4 py-1.5 text-xs font-medium text-[#475569]">
                    {formatDateTime(r.document_created_at)}
                  </td>
                  <td className="px-4 py-1.5 text-xs font-medium text-[#475569]">
                    <PssDetailModal pssNo={pssNo} />
                  </td>
                  <td className="px-4 py-1.5 text-xs font-medium text-[#475569]">
                    {String(r.order_no ?? "-").toUpperCase()}
                  </td>
                  <td className="px-4 py-1.5 text-xs font-medium text-[#475569]">
                    <div className="truncate font-medium text-text">
                      <span className="mr-1.5 text-[10px] font-normal text-text-muted">
                        {r.customer_no ?? ""}
                      </span>
                      {String(r.customer_name ?? "-")}
                    </div>
                  </td>
                  <td className="px-4 py-1.5 text-xs font-medium text-[#475569]">
                    {formatDateTime(r.mta)}
                  </td>
                  <td className="px-4 py-1.5 text-xs font-medium text-[#475569]">
                    {delayDays !== null ? (
                      <span
                        className={`inline-block rounded-md px-2 py-0.5 text-xs font-bold ${
                          isLate
                            ? "bg-red-100 text-red-700"
                            : "bg-green-100 text-green-700"
                        }`}
                      >
                        {delayDays} HARI
                      </span>
                    ) : (
                      <span className="text-text-muted text-xs">-</span>
                    )}
                  </td>
                </tr>
              );
            })}
            {rows.length === 0 && (
              <tr>
                <td className="px-4 py-1.5 text-xs font-medium text-[#475569]">
                  {customer
                    ? "TIDAK ADA DATA UNTUK CUSTOMER YANG DICARI"
                    : months.length > 0
                      ? "TIDAK ADA DATA UNTUK BULAN YANG DIPILIH"
                      : "BELUM ADA DATA OUTBOUND"}
                </td>
              </tr>
            )}
          </tbody>
        </table>
      </div>
    </div>
  );
}
