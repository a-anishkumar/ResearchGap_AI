import React from "react";

export default function CorpusSkewBanner({ coverageData, onOpenCuration }) {
  if (!coverageData) return null;

  const {
    is_skewed,
    skew_warning,
    corpus_health_score,
    domain_entropy,
    domain_normalized_entropy,
    domain_gini_coefficient,
    unique_domains,
    unique_methods,
  } = coverageData;

  // Determine indicator colors
  const healthColor =
    corpus_health_score >= 75
      ? "text-emerald-400 bg-emerald-500/10 border-emerald-500/30"
      : corpus_health_score >= 45
      ? "text-amber-400 bg-amber-500/10 border-amber-500/30"
      : "text-rose-400 bg-rose-500/10 border-rose-500/30";

  return (
    <div className="w-full mb-6 rounded-xl border border-slate-800 bg-slate-900/80 backdrop-blur-md p-4 shadow-lg">
      <div className="flex flex-col md:flex-row md:items-center justify-between gap-4">
        {/* Left: Health & Status */}
        <div className="flex items-center gap-3">
          <div
            className={`flex flex-col items-center justify-center w-14 h-14 rounded-lg border font-mono font-bold ${healthColor}`}
          >
            <span className="text-xs text-slate-400 font-sans uppercase tracking-wider">Health</span>
            <span className="text-lg">{corpus_health_score || 0}</span>
          </div>

          <div>
            <div className="flex items-center gap-2">
              <h3 className="font-semibold text-slate-100">Corpus Diversity & Coverage Index</h3>
              {is_skewed && (
                <span className="px-2 py-0.5 text-xs font-medium rounded-full bg-amber-500/20 text-amber-300 border border-amber-500/30 animate-pulse">
                  ⚠️ Skewed Sample Warning
                </span>
              )}
            </div>
            <p className="text-xs text-slate-400 mt-1">
              Shannon Entropy: <strong className="text-slate-200">{domain_entropy || 0}</strong> (Norm: {domain_normalized_entropy || 0}) • Gini Index:{" "}
              <strong className="text-slate-200">{domain_gini_coefficient || 0}</strong> • {unique_domains || 0} Domains, {unique_methods || 0} Methods
            </p>
          </div>
        </div>

        {/* Right: Actions */}
        {onOpenCuration && (
          <button
            onClick={onOpenCuration}
            className="flex items-center justify-center gap-2 px-3 py-2 text-xs font-medium rounded-lg bg-indigo-600/80 hover:bg-indigo-600 text-white transition-all shadow-md shadow-indigo-600/20 border border-indigo-500/30"
          >
            <span>🛠️ Manage Taxonomies</span>
          </button>
        )}
      </div>

      {/* Skew Warning Alert Box */}
      {is_skewed && skew_warning && (
        <div className="mt-3 p-3 rounded-lg bg-amber-500/10 border border-amber-500/20 text-xs text-amber-200 flex items-start gap-2">
          <span className="text-amber-400 font-bold shrink-0">⚠️</span>
          <span>{skew_warning}</span>
        </div>
      )}
    </div>
  );
}
