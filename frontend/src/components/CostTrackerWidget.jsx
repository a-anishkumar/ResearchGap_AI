import React from "react";

export default function CostTrackerWidget({ costData }) {
  if (!costData) return null;

  const {
    total_tokens = 0,
    total_prompt_tokens = 0,
    total_completion_tokens = 0,
    total_requests = 0,
    estimated_cost_usd = 0.0,
  } = costData;

  return (
    <div className="rounded-xl border border-slate-800 bg-slate-900/80 backdrop-blur-md p-4 shadow-lg text-slate-200">
      <div className="flex items-center justify-between mb-3">
        <div className="flex items-center gap-2">
          <span className="text-lg">💳</span>
          <h3 className="font-semibold text-sm text-slate-100">LLM Telemetry & API Usage</h3>
        </div>
        <span className="text-xs font-mono px-2 py-0.5 rounded bg-emerald-500/10 text-emerald-400 border border-emerald-500/20">
          Est. Cost: ${Number(estimated_cost_usd).toFixed(4)}
        </span>
      </div>

      <div className="grid grid-cols-3 gap-2 text-center text-xs">
        <div className="p-2 rounded-lg bg-slate-950/60 border border-slate-800/60">
          <div className="text-slate-400 text-[10px] uppercase font-mono">Requests</div>
          <div className="font-bold text-slate-100 mt-0.5">{total_requests}</div>
        </div>

        <div className="p-2 rounded-lg bg-slate-950/60 border border-slate-800/60">
          <div className="text-slate-400 text-[10px] uppercase font-mono">Tokens</div>
          <div className="font-bold text-indigo-400 mt-0.5">
            {total_tokens > 1000 ? `${(total_tokens / 1000).toFixed(1)}k` : total_tokens}
          </div>
        </div>

        <div className="p-2 rounded-lg bg-slate-950/60 border border-slate-800/60">
          <div className="text-slate-400 text-[10px] uppercase font-mono">In / Out</div>
          <div className="font-bold text-slate-300 mt-0.5">
            {Math.round(total_prompt_tokens / 1000)}k / {Math.round(total_completion_tokens / 1000)}k
          </div>
        </div>
      </div>
    </div>
  );
}
