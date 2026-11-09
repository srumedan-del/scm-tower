import { supabaseAdmin as supabase } from "@/lib/supabaseAdmin";
import {
  OutboundHeaderUploadButton,

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

  const pssNos = [
    ...new Set(
      rows
        .map((r) => String(r.pss_no ?? r.shipment_no ?? "").trim())
        .filter(Boolean),
    ),
  ];
  const trackingByPss = new Map<string, { status: string; trip_id: string | null }>();

  if (pssNos.length) {
    const { data: trackings } = await supabase
      .from("shipment_tracking")
      .select("pss_no, status, trip_id")
      .in("pss_no", pssNos);

    for (const t of trackings ?? []) {
      if (t.pss_no) {
        trackingByPss.set(String(t.pss_no).trim(), {
          status: t.status,
          trip_id: t.trip_id ?? null,
        });
      }
    }
  }

  return rows.map((row) => {
    const region = row.customer_no
      ? regionByCustomer.get(row.customer_no)
      : null;
    const targetLeadTimeDays = region === "DK" ? 1 : region === "LK" ? 5 : null;
    const hours = targetLeadTimeDays !== null ? targetLeadTimeDays * 24 : null;
    const dateSource = row.document_created_at || (row.document_date ? `${row.document_date}T00:00:00+07:00` : null);
    const createdAt = dateSource
      ? new Date(dateSource).getTime()
      : NaN;
    const mta =
      hours !== null && Number.isFinite(createdAt)
        ? new Date(createdAt + hours * 60 * 60 * 1000).toISOString()
        : null;

    const pssKey = String(row.pss_no ?? row.shipment_no ?? "").trim();
    const tracking = trackingByPss.get(pssKey);
    const status = tracking?.status ?? "Belum Dikirim";

    return {
      ...row,
      dk_lk: region,
      target_lead_time_days: targetLeadTimeDays,
      mta,
      status,
      trip_id: tracking?.trip_id ?? null,
    };
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
  const availableMonths = await getAvailableMonths();
  const currentMonthStr = new Date().toISOString().slice(0, 7);
  const defaultMonth = availableMonths.includes(currentMonthStr)
    ? currentMonthStr
    : (availableMonths[0] ?? currentMonthStr);

  const rawMonth = sp.month;
  let months: string[] = [];
  if (rawMonth === undefined) {
    months = [defaultMonth];
  } else if (rawMonth === "all") {
    months = [];
  } else if (typeof rawMonth === "string") {
    months = rawMonth.split(",").filter(Boolean);
  } else if (Array.isArray(rawMonth)) {
    months = rawMonth.filter(Boolean);
  }

  const customer =
    typeof sp.customer === "string" ? sp.customer.trim().slice(0, 100) : "";

  const rows = await getOutboundHeaders(months, customer);

  return (
    <div className="space-y-4">
      <header className="flex items-center justify-between gap-4">
        <h1 className="text-3xl font-bold">OUTBOUND</h1>
        <div className="flex items-center gap-3">
          <Suspense>
            <OutboundFilter months={availableMonths} defaultMonth={defaultMonth} />
          </Suspense>
          <OutboundHeaderUploadButton />

        </div>
      </header>

      <div className="receiving-table-scroll data-list-scroll max-h-[calc(100vh-7.5rem)] overflow-auto rounded-2xl border border-slate-200 bg-white shadow-sm">
        <table className="w-full min-w-[980px] whitespace-nowrap text-sm">
          <colgroup>
            <col className="w-[16%]" />
            <col className="w-[12%]" />
            <col className="w-[13%]" />
            <col className="w-[28%]" />
            <col className="w-[13%]" />
            <col className="w-[9%]" />
            <col className="w-[9%]" />
          </colgroup>
          <thead className="sticky top-0 z-10 border-b border-slate-200 bg-slate-50">
            <tr>
              <th className="px-4 py-3 text-left text-sm font-bold uppercase tracking-wider text-slate-800 whitespace-nowrap">
                DOCUMENT DATE TIME
              </th>
              <th className="px-4 py-3 text-left text-sm font-bold uppercase tracking-wider text-slate-800 whitespace-nowrap">
                PSS NO
              </th>
              <th className="px-4 py-3 text-left text-sm font-bold uppercase tracking-wider text-slate-800 whitespace-nowrap">
                ORDER NO
              </th>
              <th className="px-4 py-3 text-left text-sm font-bold uppercase tracking-wider text-slate-800 whitespace-nowrap">
                CUSTOMER NAME
              </th>
              <th className="px-4 py-3 text-left text-sm font-bold uppercase tracking-wider text-slate-800 whitespace-nowrap">
                MTA
              </th>
              <th className="px-4 py-3 text-left text-sm font-bold uppercase tracking-wider text-slate-800 whitespace-nowrap">
                LEAD TIME TARGET
              </th>
              <th className="px-4 py-3 text-left text-sm font-bold uppercase tracking-wider text-slate-800 whitespace-nowrap">
                STATUS
              </th>
            </tr>
          </thead>
          <tbody className="divide-y divide-slate-100">
            {rows.map((r: any) => {
              const pssNo = String(r.pss_no ?? r.shipment_no ?? "-");



              return (
                <tr key={r.id} className="group border-t border-gray-100 transition-colors hover:bg-slate-50">
                  <td className="px-4 py-3 text-sm font-medium text-slate-600">
                    {r.document_created_at
                      ? formatDateTime(r.document_created_at, true)
                      : r.document_date
                        ? formatDateTime(r.document_date, false)
                        : "-"}
                  </td>
                  <td className="px-4 py-3 text-sm font-medium text-slate-600">
                    <PssDetailModal pssNo={pssNo} />
                  </td>
                  <td className="px-4 py-3 text-sm font-medium text-slate-600">
                    {String(r.order_no ?? "-").toUpperCase()}
                  </td>
                  <td className="px-4 py-3 text-sm font-medium text-slate-600">
                    <div className="truncate font-medium text-text">
                      <span className="mr-1.5 text-[10px] font-normal text-text-muted">
                        {r.customer_no ?? ""}
                      </span>
                      {String(r.customer_name ?? "-")}
                    </div>
                  </td>
                  <td className="px-4 py-3 text-sm font-medium text-slate-600">
                    {formatDateTime(r.mta)}
                  </td>
                  <td className="px-4 py-3 text-sm font-medium text-slate-600">
                    {r.target_lead_time_days !== null && r.target_lead_time_days !== undefined ? (
                      <span
                        className={`inline-block rounded-md px-2.5 py-0.5 text-xs font-bold ${
                          r.dk_lk === "DK"
                            ? "bg-blue-100 text-blue-700"
                            : "bg-purple-100 text-purple-700"
                        }`}
                      >
                        {r.target_lead_time_days} HARI
                      </span>
                    ) : (
                      <span className="text-text-muted text-sm">-</span>
                    )}
                  </td>
                  <td className="px-4 py-3 text-sm font-medium text-slate-600">
                    <span
                      className={`inline-block rounded-md px-2.5 py-0.5 text-xs font-bold ${
                        r.status === "Delivered"
                          ? "bg-green-100 text-green-700"
                          : r.status === "In Transit"
                            ? "bg-orange-100 text-orange-700"
                            : r.status === "Dispatched"
                              ? "bg-blue-100 text-blue-700"
                              : r.status === "Draft"
                                ? "bg-amber-100 text-amber-700"
                                : "bg-slate-100 text-slate-600"
                      }`}
                    >
                      {r.status || "Belum Dikirim"}
                    </span>
                  </td>
                </tr>
              );
            })}
            {rows.length === 0 && (
              <tr>
                <td colSpan={7} className="px-4 py-3 text-sm font-medium text-slate-600">
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
