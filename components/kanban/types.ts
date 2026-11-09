export type TaskStatus = 
  | 'TRIAGE'
  | 'TODO'
  | 'SCHEDULED'
  | 'READY'
  | 'RUNNING'
  | 'BLOCKED'
  | 'REVIEW'
  | 'DONE'

export type TaskFrequency = 'Sekali saja' | 'Harian' | 'Mingguan' | 'Bulanan'

export interface ScmTask {
  id: string
  name: string
  description?: string
  status: TaskStatus
  deadline: string // YYYY-MM-DD
  pic: string
  assigner?: string
  frequency: TaskFrequency
  tags?: string[]
  subtasks?: string
  warningCount?: number
  commentsCount?: number
  icon?: string
}

export const STATUS_CONFIG: Record<TaskStatus, { label: string; tableLabel: string; color: string; dotColor: string; bgBadge: string; textBadge: string; borderAccent: string }> = {
  TRIAGE: {
    label: 'TRIAGE',
    tableLabel: 'Triage',
    color: '#64748B',
    dotColor: 'bg-slate-400',
    bgBadge: 'bg-slate-100',
    textBadge: 'text-slate-700',
    borderAccent: 'border-l-slate-400',
  },
  TODO: {
    label: 'TODO',
    tableLabel: 'Belum dikerjakan',
    color: '#64748B',
    dotColor: 'bg-slate-400',
    bgBadge: 'bg-slate-100',
    textBadge: 'text-slate-700',
    borderAccent: 'border-l-slate-400',
  },
  SCHEDULED: {
    label: 'SCHEDULED',
    tableLabel: 'Terjadwal',
    color: '#8B5CF6',
    dotColor: 'bg-purple-500',
    bgBadge: 'bg-purple-50',
    textBadge: 'text-purple-700',
    borderAccent: 'border-l-purple-500',
  },
  READY: {
    label: 'READY',
    tableLabel: 'Siap',
    color: '#06B6D4',
    dotColor: 'bg-cyan-500',
    bgBadge: 'bg-cyan-50',
    textBadge: 'text-cyan-700',
    borderAccent: 'border-l-cyan-500',
  },
  RUNNING: {
    label: 'RUNNING',
    tableLabel: 'In Progress',
    color: '#0284C7',
    dotColor: 'bg-sky-500',
    bgBadge: 'bg-sky-50',
    textBadge: 'text-sky-700',
    borderAccent: 'border-l-sky-500',
  },
  BLOCKED: {
    label: 'BLOCKED',
    tableLabel: 'Blocked',
    color: '#EF4444',
    dotColor: 'bg-red-500',
    bgBadge: 'bg-red-50',
    textBadge: 'text-red-700',
    borderAccent: 'border-l-red-500',
  },
  REVIEW: {
    label: 'REVIEW',
    tableLabel: 'Under Review',
    color: '#F59E0B',
    dotColor: 'bg-amber-500',
    bgBadge: 'bg-amber-50',
    textBadge: 'text-amber-700',
    borderAccent: 'border-l-amber-500',
  },
  DONE: {
    label: 'DONE',
    tableLabel: 'Done',
    color: '#10B981',
    dotColor: 'bg-emerald-500',
    bgBadge: 'bg-emerald-50',
    textBadge: 'text-emerald-700',
    borderAccent: 'border-l-emerald-500',
  },
}

export const KANBAN_COLUMNS: TaskStatus[] = [
  'TRIAGE',
  'TODO',
  'SCHEDULED',
  'READY',
  'RUNNING',
  'BLOCKED',
  'REVIEW',
  'DONE',
]

export const INITIAL_TASKS: ScmTask[] = [
  {
    id: 't-f9518b',
    name: 'Download stock cabang dari SIRUP SRU',
    description: 'Cannot access SIRUP stock data: the datawh portal (https://datawh.sinarrodotama.co.id/...) butuh kredensial valid.',
    status: 'BLOCKED',
    deadline: '2026-11-04',
    pic: 'Erwin',
    assigner: 'Erwin',
    frequency: 'Harian',
    tags: ['needs_input'],
    commentsCount: 3,
    warningCount: 1,
  },
  {
    id: 't-65d48a',
    name: 'Buat perpanjangan kontrak kerjasama sewa forklift Jayatrade',
    description: 'Butuh detail kontrak untuk membuat perpanjangan: (1) Nomor/tanggal kontrak sewa aktif, (2) Periode penambahan.',
    status: 'BLOCKED',
    deadline: '2026-11-05',
    pic: 'Erwin',
    assigner: 'Erwin',
    frequency: 'Sekali saja',
    tags: ['needs_input'],
    warningCount: 1,
  },
  {
    id: 't-3572c7',
    name: 'Kirim pengajuan forecast NHD Bu Rita',
    description: 'Menyiapkan draft forecast NHD untuk review Bu Rita sebelum submit ke finance pusat.',
    status: 'BLOCKED',
    deadline: '2026-11-06',
    pic: 'Erwin',
    assigner: 'Erwin',
    frequency: 'Bulanan',
    warningCount: 2,
  },
  {
    id: 't-notion-3',
    name: 'Buat Pengajuan PA Bulanan',
    description: 'Rekapitulasi pengeluaran operasional gudang dan kantor serta pembuatan PA bulanan cabang Medan.',
    status: 'RUNNING',
    deadline: '2026-11-06',
    pic: 'Erwin',
    assigner: 'Erwin',
    frequency: 'Bulanan',
    icon: '📊',
  },
  {
    id: 't-notion-4',
    name: 'Check kenapa D:\\project\\cetak-fot...',
    description: 'Investigasi log sync foto dan dokumen PO yang tersendat di direktori D:\\project\\cetak-fot...',
    status: 'TODO',
    deadline: '2026-10-28',
    pic: 'Slack-Ops',
    assigner: 'Erwin',
    frequency: 'Harian',
  },
  {
    id: 't-notion-1',
    name: 'Koreksi PA RSA, salah kode COA',
    description: 'Koreksi pembebanan kode akun COA pada pengajuan reimbursement RS Adam Malik.',
    status: 'DONE',
    deadline: '2026-10-28',
    pic: 'Erwin',
    assigner: 'Erwin',
    frequency: 'Sekali saja',
  },
  {
    id: 't-notion-2',
    name: 'Setup Notion board tugas',
    description: 'Integrasi dan konfigurasi board tugas operasional tim SCM.',
    status: 'DONE',
    deadline: '2026-10-22',
    pic: 'Slack-Ops',
    assigner: 'Erwin',
    frequency: 'Sekali saja',
  },
  {
    id: 't-cb8e1a',
    name: 'Carikan saya pekerjaan Remote',
    description: 'Telah mengumpulkan semua dokumen dari 4 task induk (t_489f9dd4, t_4436adc...)',
    status: 'DONE',
    deadline: '2026-10-25',
    pic: 'Slack-Ops',
    assigner: 'Erwin',
    frequency: 'Sekali saja',
    commentsCount: 2,
    subtasks: '4',
  },
  {
    id: 't-4436ad',
    name: 'Persiapkan diri untuk wawancara remote',
    description: 'Selesai menyelesaikan persiapan wawancara remote untuk Erwin Sapta.',
    status: 'DONE',
    deadline: '2026-10-24',
    pic: 'Slack-Ops',
    assigner: 'Erwin',
    frequency: 'Sekali saja',
    subtasks: '1/1',
  },
  {
    id: 't-489f9d',
    name: 'Siapkan profil dan dokumen kerja remote',
    description: 'Selesai menyiapkan profil dan dokumen kerja remote untuk Erwin. Telah dibuat 4 portofolio ringkas.',
    status: 'DONE',
    deadline: '2026-10-23',
    pic: 'Slack-Ops',
    assigner: 'Erwin',
    frequency: 'Sekali saja',
    subtasks: '2/2',
  },
  {
    id: 't-8c410e',
    name: 'Lacak aplikasi dan proses rekrutmen',
    description: 'Sudah membuat spreadsheet tracking rekrutmen dan notifikasi otomatis.',
    status: 'DONE',
    deadline: '2026-10-22',
    pic: 'Slack-Ops',
    assigner: 'Erwin',
    frequency: 'Sekali saja',
    subtasks: '1/1',
  },
]
