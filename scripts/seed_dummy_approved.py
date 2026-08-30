import json, urllib.request, urllib.error, urllib.parse
from pathlib import Path
from datetime import date, timedelta

env={}
for line in Path(r"D:/scm-app/scm-tower/.env.local").read_text(encoding="utf-8").splitlines():
    if "=" in line and line.strip() and not line.strip().startswith("#"):
        k,v=line.split("=",1); env[k.strip()]=v.strip()
URL=env["NEXT_PUBLIC_SUPABASE_URL"]; SRK=env["NEXT_PUBLIC_SUPABASE_SERVICE_ROLE_KEY"]
HDR={"apikey":SRK,"Authorization":"Bearer "+SRK,"Content-Type":"application/json"}

def post(table, rows):
    data=json.dumps(rows).encode()
    req=urllib.request.Request(f"{URL}/rest/v1/{table}", data=data, headers={**HDR,"Prefer":"return=representation"}, method="POST")
    try:
        with urllib.request.urlopen(req) as r:
            body=r.read().decode()
            return True, json.loads(body) if body else []
    except urllib.error.HTTPError as e:
        body=e.read().decode()
        return False, body

def get_count(table):
    req=urllib.request.Request(f"{URL}/rest/v1/{table}?select=*", headers={**HDR,"Prefer":"count=exact"}, method="HEAD")
    try:
        with urllib.request.urlopen(req) as r:
            cr=r.headers.get("Content-Range","")
            return cr
    except Exception as e:
        return str(e)

print("BEFORE:", {t:get_count(t) for t in ["shipments","transport_fleet","issue_log","warehouse_checklist","shipment_status_logs"]})

# 1) SHIPMENTS — valid status: Draft, In Transit, Delayed, Cancelled, Dispatched, Completed, Arrived
#    sla_status: On Time, Late, Pending
#    pod_status: Pending, Missing
today = date(2026,8,30)
shipments = [
    {"shipment_no":"SHP-2026-08-001","shipment_date":str(today - timedelta(days=5)),"origin_warehouse":"SRU MEDAN","destination_city":"BANDA ACEH","destination_name":"RSUD ZAINOEL ABIDIN","vendor_name":"PT. RIANG SARANA ARTHA","vehicle_no":"BK 1234 AA","driver_name":"BUDI SANTOSO","status":"Dispatched","sla_status":"On Time","pod_status":"Pending","shipment_type":"trucking","eta":str(today - timedelta(days=3)),"notes":"DUMMY APPROVED — MEDAN-BANDA ACEH R6","delay_reason":None},
    {"shipment_no":"SHP-2026-08-002","shipment_date":str(today - timedelta(days=4)),"origin_warehouse":"SRU MEDAN","destination_city":"LHOKSEUMAWE","destination_name":"RS ARUN LHOKSEUMAWE","vendor_name":"PT. ADI SARANA ARMADA TBK - MEDAN","vehicle_no":"BK 5678 BB","driver_name":"AGUS WIRANTO","status":"In Transit","sla_status":"On Time","pod_status":"Pending","shipment_type":"trucking","eta":str(today - timedelta(days=2)),"notes":"DUMMY APPROVED — MEDAN-LHOKSEUMAWE","delay_reason":None},
    {"shipment_no":"SHP-2026-08-003","shipment_date":str(today - timedelta(days=3)),"origin_warehouse":"SRU MEDAN","destination_city":"PEMATANG SIANTAR","destination_name":"RSUD PEMATANG SIANTAR","vendor_name":"INDAH LOGISTIK","vehicle_no":"BK 9012 CC","driver_name":"JOKO SUSILO","status":"Arrived","sla_status":"Late","pod_status":"Pending","shipment_type":"trucking","eta":str(today - timedelta(days=1)),"notes":"DUMMY APPROVED — TERLAMBAT 1 HARI KARENA HUJAN","delay_reason":None},
    {"shipment_no":"SHP-2026-08-004","shipment_date":str(today - timedelta(days=2)),"origin_warehouse":"SRU MEDAN","destination_city":"MEDAN","destination_name":"RSUP H ADAM MALIK MEDAN","vendor_name":"PT. RIANG SARANA ARTHA","vehicle_no":"BK 3456 DD","driver_name":"RIZAL ANWAR","status":"Completed","sla_status":"On Time","pod_status":"Missing","shipment_type":"trucking","eta":str(today),"notes":"DUMMY APPROVED — POD HILANG, FOLLOW UP","delay_reason":None},
    {"shipment_no":"SHP-2026-08-005","shipment_date":str(today - timedelta(days=1)),"origin_warehouse":"SRU MEDAN","destination_city":"TEBING TINGGI","destination_name":"RS SRI PAMELA TEBING TINGGI","vendor_name":"PT. RIANG SARANA ARTHA","vehicle_no":"BK 7890 EE","driver_name":"HENDRA GUNAWAN","status":"Draft","sla_status":"Pending","pod_status":"Pending","shipment_type":"trucking","eta":str(today + timedelta(days=1)),"notes":"DUMMY APPROVED — DRAFT BELUM DISPATCH","delay_reason":None},
    {"shipment_no":"SHP-2026-08-006","shipment_date":str(today),"origin_warehouse":"SRU MEDAN","destination_city":"KISARAN","destination_name":"RSUD H ABDUL MANAN SIMATUPANG","vendor_name":"PT. ADI SARANA ARMADA TBK - MEDAN","vehicle_no":"BK 2345 FF","driver_name":"SUTRISNO","status":"Delayed","sla_status":"Late","pod_status":"Pending","shipment_type":"trucking","eta":str(today),"delay_reason":"JALAN LONGSOR ACEH TENGAH","notes":"DUMMY APPROVED — DELAYED"},
    {"shipment_no":"SHP-2026-08-007","shipment_date":str(today),"origin_warehouse":"SRU MEDAN","destination_city":"SIBOLGA","destination_name":"RS FL TOBING SIBOLGA","vendor_name":"INDAH LOGISTIK","vehicle_no":"BK 6789 GG","driver_name":"FAISAL RAHMAN","status":"Cancelled","sla_status":"Pending","pod_status":"Missing","shipment_type":"trucking","eta":str(today + timedelta(days=2)),"notes":"DUMMY APPROVED — CANCELLED CUSTOMER REQUEST","delay_reason":None},
    {"shipment_no":"SHP-2026-08-008","shipment_date":str(today),"origin_warehouse":"SRU MEDAN","destination_city":"PADANG SIDEMPUAN","destination_name":"RSUD PADANG SIDEMPUAN","vendor_name":"PT. RIANG SARANA ARTHA","vehicle_no":"BK 1122 HH","driver_name":"DEDY PRANOTO","status":"In Transit","sla_status":"On Time","pod_status":"Pending","shipment_type":"trucking","eta":str(today + timedelta(days=1)),"notes":"DUMMY APPROVED — ON TIME","delay_reason":None},
]

ok, res = post("shipments", shipments)
if ok:
    print(f"SHIPMENTS inserted {len(res)} rows")
    for r in res[:3]: print(" ", r.get("shipment_no"), r.get("status"))
else:
    print("SHIPMENTS FAIL", res[:2000])

# 2) TRANSPORT_FLEET — valid cols: vendor_id, vehicle_no, vehicle_type, driver_name, driver_phone, status='aktif', notes
fleet = [
    {"vendor_id":1, "vehicle_no":"BK 1234 AA","vehicle_type":"CDD","driver_name":"BUDI SANTOSO","driver_phone":"081234567801","status":"aktif","notes":"ISUZU ELF - 4 TON"},
    {"vendor_id":1, "vehicle_no":"BK 5678 BB","vehicle_type":"CDD","driver_name":"AGUS WIRANTO","driver_phone":"081234567802","status":"aktif","notes":"MITSUBISHI CANTER - 6 TON"},
    {"vendor_id":2, "vehicle_no":"BK 9012 CC","vehicle_type":"CDE","driver_name":"JOKO SUSILO","driver_phone":"081234567803","status":"aktif","notes":"HINO DUTRO - 8 TON"},
    {"vendor_id":1, "vehicle_no":"BK 3456 DD","vehicle_type":"BOX","driver_name":"RIZAL ANWAR","driver_phone":"081234567804","status":"aktif","notes":"ISUZU NMR - 4 TON"},
    {"vendor_id":2, "vehicle_no":"BK 7890 EE","vehicle_type":"TRONTON","driver_name":"HENDRA GUNAWAN","driver_phone":"081234567805","status":"aktif","notes":"HINO RANGER - 15 TON"},
    {"vendor_id":1, "vehicle_no":"BK 2345 FF","vehicle_type":"CDD","driver_name":"SUTRISNO","driver_phone":"081234567806","status":"aktif","notes":"ISUZU ELF - 4 TON"},
    {"vendor_id":1, "vehicle_no":"BK 6789 GG","vehicle_type":"PICKUP","driver_name":"FAISAL RAHMAN","driver_phone":"081234567807","status":"aktif","notes":"GRAN MAX PICKUP - 1.5 TON"},
    {"vendor_id":2, "vehicle_no":"BK 1122 HH","vehicle_type":"FUSO","driver_name":"DEDY PRANOTO","driver_phone":"081234567808","status":"aktif","notes":"MITSUBISHI FUSO - 10 TON"},
]
ok, res = post("transport_fleet", fleet)
if ok:
    print(f"FLEET inserted {len(res)} rows")
else:
    print("FLEET FAIL", res[:2000])

# 3) ISSUE_LOG — valid category: Vendor, Receiving, Warehouse, System, Inventory, Outbound, Shipment, Other
#    status: Open, In Progress, Closed, Cancelled
#    impact/probability: Low, Medium, High (impact also Critical)
issues = [
    {"issue_no":"ISS-DUMMY-2026-001","category":"Shipment","title":"KETERLAMBATAN PENGIRIMAN MEDAN - BANDA ACEH AKIBAT CUACA","description":"HUJAN DERAS DAN LONGSOR DI ACEH TENGAH MENYEBABKAN DELAY 1 HARI","impact":"High","probability":"Medium","status":"In Progress","due_date":str(today + timedelta(days=2)),"mitigation_plan":"UPDATE ETA REAL-TIME KE CUSTOMER DAN KOORDINASI VENDOR ALTERNATIF"},
    {"issue_no":"ISS-DUMMY-2026-002","category":"Receiving","title":"LEAD TIME JKT-CKPA TINGGI 19 HARI","description":"RATA-RATA LEAD TIME DARI SUPPLIER JKT-CKPA 19 HARI MELEBIHI SLA 7 HARI","impact":"Medium","probability":"High","status":"Open","due_date":str(today + timedelta(days=5)),"mitigation_plan":"KOORDINASI DENGAN PLANNER, NAIKKAN SAFETY STOCK 20%"},
    {"issue_no":"ISS-DUMMY-2026-003","category":"Warehouse","title":"PALLET RUSAK DI AREA RECEIVING","description":"3 PALLET KAYU LAPUK DI AREA RECEIVING, 1 BOX TERJATUH","impact":"Low","probability":"Medium","status":"Closed","due_date":str(today - timedelta(days=1)),"mitigation_plan":"INSPEKSI PALLET HARIAN DAN GANTI PALLET PLASTIK"},
    {"issue_no":"ISS-DUMMY-2026-004","category":"Vendor","title":"VENDOR RAJA CEPAT BUTUH NDA SEBELUM ONBOARDING","description":"KONTRAK DAN NDA HARUS DITANDATANGANI SEBELUM SHIPMENT PERTAMA","impact":"Medium","probability":"Low","status":"Open","due_date":str(today + timedelta(days=7)),"mitigation_plan":"FOLLOW UP LEGAL UNTUK PERCEPAT NDA"},
    {"issue_no":"ISS-DUMMY-2026-005","category":"System","title":"SYNC STOK VIEW VW_INVENTORY_ALERT KOSONG","description":"VIEW INVENTORY MASIH KOSONG KARENA BELUM ADA TRANSAKSI STOK","impact":"Low","probability":"Low","status":"Closed","due_date":str(today), "mitigation_plan":"ISI DATA TRANSAKSI DAN REFRESH VIEW"},
    {"issue_no":"ISS-DUMMY-2026-006","category":"Inventory","title":"SAFETY STOCK HD PACK MASIH NULL","description":"MASTER SKU 90 ITEM SAFETY_STOCK MASIH NULL MENUNGGU FASE SAFETY_STOCK","impact":"Medium","probability":"Medium","status":"In Progress","due_date":str(today + timedelta(days=14)),"mitigation_plan":"HITUNG SAFETY STOCK BERDASARKAN KONSUMSI BMHP/BULAN X LEAD TIME"},
    {"issue_no":"ISS-DUMMY-2026-007","category":"Outbound","title":"DOKUMEN PSS-2601 DUPLIKAT DI OUTBOUND_DETAIL","description":"BEBERAPA DOCUMENT_NO MUNCUL DUPLIKAT KARENA MULTI-LINE","impact":"Low","probability":"Low","status":"Closed","due_date":str(today - timedelta(days=2)),"mitigation_plan":"AGREGASI PER DOCUMENT_NO DI OUTBOUND PAGE SUDAH DIBUAT"},
    {"issue_no":"ISS-DUMMY-2026-008","category":"Other","title":"KOORDINAT CUSTOMER BARU 20% BELUM TERISI","description":"DARI 74 CUSTOMER BARU 2 YANG SUDAH ADA KOORDINAT LENGKAP, SISANYA MASIH NULL","impact":"Medium","probability":"High","status":"Open","due_date":str(today + timedelta(days=10)),"mitigation_plan":"UPDATE KOORDINAT SATU PER SATU VIA MASTER CUSTOMERS - PASTE DARI GOOGLE MAPS"},
]
ok, res = post("issue_log", issues)
if ok:
    print(f"ISSUE_LOG inserted {len(res)} rows")
else:
    print("ISSUE_LOG FAIL", res[:3000])

# 4) SHIPMENT_STATUS_LOGS — need shipment_id FK
# fetch shipment ids we just created
import urllib.request as ur
try:
    req=ur.Request(f"{URL}/rest/v1/shipments?select=id,shipment_no&shipment_no=like.SHP-2026-08-%", headers=HDR)
    with ur.urlopen(req) as r:
        ships=json.loads(r.read().decode())
except Exception as e:
    print("fetch shipments fail", e)
    ships=[]
    print(f"Fetched {len(ships)} shipments for logs")
    id_map={s["shipment_no"]:s["id"] for s in ships}

logs=[]
if id_map:
    # create 1-2 logs per shipment that is not Draft/Cancelled
    for no, sid in id_map.items():
        # find original status
        orig = next((s for s in shipments if s["shipment_no"]==no), None)
        if not orig: continue
        st = orig["status"]
        if st=="Draft": logs.append({"shipment_id":sid,"status_from":"Draft","status_to":"Dispatched","notes":"DUMMY LOG — CREATE TO DISPATCH"})
        elif st=="In Transit": 
            logs.append({"shipment_id":sid,"status_from":"Draft","status_to":"Dispatched","notes":"DUMMY LOG"})
            logs.append({"shipment_id":sid,"status_from":"Dispatched","status_to":"In Transit","notes":"DUMMY LOG — ON THE ROAD"})
        elif st=="Arrived": 
            logs.append({"shipment_id":sid,"status_from":"In Transit","status_to":"Arrived","notes":"DUMMY LOG — ARRIVED"})
        elif st=="Completed": 
            logs.append({"shipment_id":sid,"status_from":"Arrived","status_to":"Completed","notes":"DUMMY LOG — COMPLETED POD MISSING"})
        elif st=="Delayed": 
            logs.append({"shipment_id":sid,"status_from":"In Transit","status_to":"Delayed","notes":"DUMMY LOG — DELAY LONGSOR"})
        elif st=="Dispatched": 
            logs.append({"shipment_id":sid,"status_from":"Draft","status_to":"Dispatched","notes":"DUMMY LOG"})

    if logs:
        ok, res = post("shipment_status_logs", logs)
        if ok:
            print(f"STATUS_LOGS inserted {len(res)} rows")
        else:
            print("STATUS_LOGS FAIL", res[:2000])
    else:
        print("No logs to insert")

# 5) WAREHOUSE_CHECKLIST — add 2 more for today to fill 5->7
checklists=[
    {"checklist_date":str(today),"warehouse_code":"MDN-PAR9C","shift":"Siang","area_receiving_clean":True,"dock_available":True,"forklift_ready":True,"pallet_available":True,"damaged_goods_separated":True,"inbound_documents_complete":True,"outbound_staging_done":True,"safety_check_done":True,"issue_notes":"DUMMY — SIANG SHIFT LENGKAP"},
    {"checklist_date":str(today),"warehouse_code":"MDN-PAR9F","shift":"Pagi","area_receiving_clean":True,"dock_available":False,"forklift_ready":True,"pallet_available":True,"damaged_goods_separated":True,"inbound_documents_complete":True,"outbound_staging_done":False,"safety_check_done":True,"issue_notes":"DUMMY — DOCK PAR9F SEDANG MAINTENANCE"},
]
ok, res = post("warehouse_checklist", checklists)
if ok: print(f"CHECKLIST inserted {len(res)} rows")
else: print("CHECKLIST FAIL", res[:2000])

print("AFTER:", {t:get_count(t) for t in ["shipments","transport_fleet","issue_log","warehouse_checklist","shipment_status_logs"]})
