import React from "react";
import { CheckCircle, Play, Trash2, Clock, FileText, Check, Volume2 } from "lucide-react";

export default function TakeHistory({
  takes = [],
  onSelectActiveTake,
  onDeleteTake,
  onUpdateTranscript
}) {
  if (takes.length === 0) {
    return (
      <div className="glass-panel p-6 text-center border-dashed border-white/10 bg-slate-900/40">
        <p className="text-slate-400 text-xs">
          No recording takes captured yet for this question. Use the studio above to record Take 1.
        </p>
      </div>
    );
  }

  return (
    <div className="space-y-3">
      <div className="flex items-center justify-between">
        <h4 className="text-xs font-bold uppercase tracking-wider text-slate-300 flex items-center gap-2">
          <Clock className="h-3.5 w-3.5 text-indigo-400" />
          <span>Multiple Takes History ({takes.length})</span>
        </h4>
        <span className="text-[11px] text-slate-400">
          Click checkmark to select primary take for Sandy's Excel Export
        </span>
      </div>

      <div className="space-y-3">
        {takes.map((take) => (
          <div
            key={take.id}
            className={`glass-panel p-4 transition-all ${
              take.isActive
                ? "bg-indigo-950/40 border-indigo-500/50 ring-1 ring-indigo-500/30"
                : "bg-slate-900/60 border-white/10 opacity-80 hover:opacity-100"
            }`}
          >
            <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3 mb-3">
              <div className="flex items-center gap-3">
                {/* Active check toggle */}
                <button
                  onClick={() => onSelectActiveTake(take.id)}
                  className={`h-6 w-6 rounded-md flex items-center justify-center border transition-all ${
                    take.isActive
                      ? "bg-emerald-500 border-emerald-400 text-slate-950 shadow-md"
                      : "border-slate-600 bg-slate-800 text-slate-400 hover:text-white"
                  }`}
                  title={take.isActive ? "Selected as Primary Take" : "Set as Primary Take"}
                >
                  <Check className="h-4 w-4 stroke-[3]" />
                </button>

                <div>
                  <div className="flex items-center gap-2">
                    <span className="text-sm font-bold text-white">
                      Take {take.takeNumber}
                    </span>
                    {take.isActive && (
                      <span className="badge badge-completed text-[10px]">
                        Primary Take
                      </span>
                    )}
                  </div>
                  <div className="flex items-center gap-3 text-xs text-slate-400 mt-0.5 font-mono">
                    <span>{take.timestamp}</span>
                    <span>•</span>
                    <span>{take.durationSeconds}s duration</span>
                  </div>
                </div>
              </div>

              {/* Audio playback player */}
              {take.audioUrl && (
                <div className="flex items-center gap-2">
                  <audio src={take.audioUrl} controls className="h-8 max-w-[220px] bg-slate-950 rounded-md" />
                </div>
              )}

              {/* Delete Take Button */}
              <button
                onClick={() => onDeleteTake(take.id)}
                className="btn btn-secondary text-xs p-2 hover:text-rose-400 self-end sm:self-center"
                title="Delete Take"
              >
                <Trash2 className="h-3.5 w-3.5" />
              </button>
            </div>

            {/* Take Transcript Box */}
            <div className="space-y-1 bg-slate-950/50 p-3 rounded-lg border border-white/5">
              <div className="flex items-center justify-between text-[11px] text-slate-400 font-semibold uppercase">
                <span className="flex items-center gap-1">
                  <FileText className="h-3 w-3 text-indigo-400" /> Take Transcript
                </span>
              </div>
              <p className="text-xs font-mono text-slate-200 leading-relaxed whitespace-pre-wrap">
                {take.transcript || "[No transcript]"}
              </p>
              {take.notes && (
                <p className="text-[11px] text-slate-400 italic pt-1 border-t border-white/5">
                  Notes: {take.notes}
                </p>
              )}
            </div>
          </div>
        ))}
      </div>
    </div>
  );
}
