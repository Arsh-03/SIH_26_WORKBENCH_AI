import React, { useState } from 'react'
import {
  ShieldAlert,
  AlertTriangle,
  CheckCircle2,
  XCircle,
  Lock,
  UserCheck
} from 'lucide-react'
import type { HitlApprovalRequest } from '../../lib/types'

interface HitlApprovalCardProps {
  request: HitlApprovalRequest
  onDecision: (request: HitlApprovalRequest, approved: boolean, operatorNotes?: string) => void
}

export const HitlApprovalCard: React.FC<HitlApprovalCardProps> = ({
  request,
  onDecision
}) => {
  const [hasConfirmed, setHasConfirmed] = useState(false)
  const isPending = request.status === 'pending' || !request.status

  const getSeverityStyle = () => {
    switch (request.severity?.toUpperCase()) {
      case 'CRITICAL':
        return {
          border: 'border-red-500/70',
          bg: 'bg-red-950/20',
          badge: 'bg-red-900/60 text-red-300 border-red-500/40',
          header: 'text-red-400'
        }
      case 'WARNING':
        return {
          border: 'border-amber-500/70',
          bg: 'bg-amber-950/20',
          badge: 'bg-amber-900/60 text-amber-300 border-amber-500/40',
          header: 'text-amber-400'
        }
      default:
        return {
          border: 'border-accent-primary/70',
          bg: 'bg-surface-1',
          badge: 'bg-surface-2 text-accent-primary border-accent-primary/40',
          header: 'text-accent-primary'
        }
    }
  }

  const style = getSeverityStyle()

  return (
    <div
      className={`my-3 w-full rounded-md border ${style.border} ${style.bg} p-4 font-mono text-xs shadow-md transition-all`}
    >
      {/* Header */}
      <div className="flex items-center justify-between border-b border-border/60 pb-2.5 flex-wrap gap-2">
        <div className="flex items-center gap-2">
          <ShieldAlert className={`w-4 h-4 ${style.header}`} />
          <span className={`font-bold tracking-wider ${style.header}`}>
            OPERATOR SAFETY INTERLOCK &bull; HUMAN-IN-THE-LOOP AUTHORIZATION
          </span>
        </div>
        <div className="flex items-center gap-1.5">
          <span className={`px-2 py-0.5 rounded text-[10px] font-bold border ${style.badge}`}>
            {request.severity || 'CRITICAL'} HAZARD
          </span>
          <span className="text-[10px] text-text-muted bg-surface-2 px-2 py-0.5 rounded border border-border/70">
            {request.operation_type || 'SAFETY_GATE'}
          </span>
        </div>
      </div>

      {/* Target Equipment & Parameter Overview */}
      <div className="mt-3 grid grid-cols-1 md:grid-cols-2 gap-3">
        <div className="bg-[#12100E] p-2.5 rounded border border-border/60">
          <span className="text-[10px] text-text-muted uppercase tracking-wider block">
            Target Equipment / Process Tag
          </span>
          <span className="font-bold text-text-primary text-[13px] mt-0.5 block">
            {request.target_equipment}
          </span>
        </div>
        <div className="bg-[#12100E] p-2.5 rounded border border-border/60">
          <span className="text-[10px] text-text-muted uppercase tracking-wider block">
            Mandatory Standard & SOP Reference
          </span>
          <span className="font-bold text-accent-primary text-[12px] mt-0.5 block">
            {request.standard_reference}
          </span>
        </div>
      </div>

      {/* Proposed Parameter */}
      <div className="mt-2.5 bg-[#171410] p-3 rounded border border-border/70">
        <span className="text-[10px] text-text-muted uppercase tracking-wider block">
          Proposed Direct Operating Parameter Adjustment
        </span>
        <p className="font-bold text-white text-[13px] mt-1">
          {request.proposed_parameter}
        </p>
      </div>

      {/* Safety Advisory */}
      <div className="mt-2.5 flex items-start gap-2 text-[11px] text-text-muted leading-relaxed bg-surface-2/40 p-2.5 rounded border border-border/40">
        <AlertTriangle className="w-4 h-4 text-amber-400 shrink-0 mt-0.5" />
        <div>
          <span className="font-semibold text-text-primary">Engineering Advisory: </span>
          {request.advisory}
        </div>
      </div>

      {/* Action Decision Area */}
      {isPending ? (
        <div className="mt-3 pt-3 border-t border-border/60 space-y-3">
          <label className="flex items-start gap-2 cursor-pointer select-none bg-[#110F0C] p-2.5 rounded border border-border hover:border-accent-primary/50 transition-colors">
            <input
              type="checkbox"
              checked={hasConfirmed}
              onChange={(e) => setHasConfirmed(e.target.checked)}
              className="mt-0.5 rounded border-border text-accent-primary focus:ring-accent-primary"
            />
            <span className="text-[11px] text-text-body leading-tight">
              I certify that I am a licensed <strong>MRPL Lead Operations / Inspection Engineer</strong>. I have verified the thermal stress and effective MAWP parameters and authorize this safe operating state.
            </span>
          </label>

          <div className="flex items-center gap-2 justify-end pt-1">
            <button
              onClick={() => onDecision(request, false)}
              className="flex items-center gap-1.5 px-3 py-1.5 rounded bg-surface-2 hover:bg-surface-3 text-text-muted hover:text-white border border-border text-xs transition-colors"
            >
              <XCircle className="w-3.5 h-3.5 text-red-400" />
              <span>Reject & Abort</span>
            </button>
            <button
              disabled={!hasConfirmed}
              onClick={() => onDecision(request, true)}
              className={`flex items-center gap-1.5 px-3.5 py-1.5 rounded font-bold text-xs transition-all ${
                hasConfirmed
                  ? 'bg-emerald-600 hover:bg-emerald-500 text-white shadow-md'
                  : 'bg-surface-2 text-text-muted opacity-50 cursor-not-allowed border border-border'
              }`}
            >
              <UserCheck className="w-3.5 h-3.5" />
              <span>Approve & Apply Digital Signature</span>
            </button>
          </div>
        </div>
      ) : (
        <div className="mt-3 pt-2.5 border-t border-border/60 flex items-center justify-between text-[11px]">
          <div className="flex items-center gap-1.5">
            {request.status === 'approved' ? (
              <>
                <CheckCircle2 className="w-4 h-4 text-emerald-400" />
                <span className="text-emerald-300 font-bold">
                  OPERATOR AUTHORIZATION CONFIRMED &amp; SIGNED
                </span>
              </>
            ) : (
              <>
                <XCircle className="w-4 h-4 text-red-400" />
                <span className="text-red-300 font-bold">
                  OPERATOR REJECTED &amp; DIRECTIVE ABORTED
                </span>
              </>
            )}
          </div>
          <span className="text-[10px] text-text-muted font-mono flex items-center gap-1">
            <Lock className="w-3 h-3 text-accent-primary" />
            CRYPTOGRAPHIC ENCLAVE STAMP RECORDED
          </span>
        </div>
      )}
    </div>
  )
}
