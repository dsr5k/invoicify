e client"
import { Archive } from "lucide-react"
export default function ArchivePage() {
  return (
    <div className="p-8 space-y-6">
      <div>
        <h1 className="text-2xl font-bold">Archive</h1>
        <p className="text-white/40 text-sm mt-1">Archived and completed invoices</p>
      </div>
      <div className="bg-white/[0.03] border border-white/5 rounded-xl p-12 flex flex-col items-center justify-center text-center gap-4">
        <div className="h-16 w-16 rounded-2xl bg-white/5 flex items-center justify-center">
          <Archive className="h-8 w-8 text-white/30" />
        </div>
        <div>
          <span className="text-xs font-bold uppercase tracking-wider px-2 py-1 rounded-full bg-violet-500/10 text-violet-400">Coming Soon</span>
          <h2 className="text-xl font-bold mt-3 mb-2">Invoice Archive</h2>
          <p className="text-white/40 text-sm max-w-md">Long-term storage for completed and closed invoices. Search, filter, and download any historical document in seconds.</p>
        </div>
        <div className="grid grid-cols-1 sm:grid-cols-2 gap-3 mt-4 w-full max-w-lg">
          {["Full-text search in archive", "Restore to active", "Download as PDF or Excel", "Audit trail per invoice"].map(f => (
            <div key={f} className="flex items-center gap-2 bg-white/[0.02] border border-white/5 rounded-lg px-4 py-3 text-sm text-white/30">
              <div className="h-4 w-4 rounded border border-white/10 shrink-0" />
              {f}
            </div>
          ))}
        </div>
      </div>
    </div>
  )
}