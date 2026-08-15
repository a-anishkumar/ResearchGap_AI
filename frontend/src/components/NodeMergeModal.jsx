import React, { useState, useEffect } from "react";
import axios from "axios";

export default function NodeMergeModal({ isOpen, onClose, onMergeSuccess }) {
  const [entityType, setEntityType] = useState("Method");
  const [targetName, setTargetName] = useState("");
  const [sourceName, setSourceName] = useState("");
  const [candidates, setCandidates] = useState([]);
  const [loading, setLoading] = useState(false);
  const [submitting, setSubmitting] = useState(false);
  const [message, setMessage] = useState(null);

  useEffect(() => {
    if (isOpen) {
      fetchCandidates();
    }
  }, [isOpen]);

  const fetchCandidates = async () => {
    setLoading(true);
    try {
      const res = await axios.get("/api/curate/candidates");
      setCandidates(res.data?.candidates || []);
    } catch (err) {
      console.error("Failed fetching candidates:", err);
    } finally {
      setLoading(false);
    }
  };

  const handleMerge = async (e) => {
    e.preventDefault();
    if (!targetName.trim() || !sourceName.trim()) {
      setMessage({ type: "error", text: "Please enter both target and source entity names." });
      return;
    }

    setSubmitting(true);
    setMessage(null);

    try {
      const res = await axios.post("/api/curate/merge", {
        target_name: targetName,
        source_name: sourceName,
        entity_type: entityType,
      });

      setMessage({ type: "success", text: res.data.message || "Successfully merged taxonomy nodes." });
      setTargetName("");
      setSourceName("");
      fetchCandidates();
      if (onMergeSuccess) onMergeSuccess();
    } catch (err) {
      setMessage({
        type: "error",
        text: err.response?.data?.detail || "Failed to merge nodes. Please check names.",
      });
    } finally {
      setSubmitting(false);
    }
  };

  const applyCandidate = (cand) => {
    setEntityType(cand.entity_type);
    setTargetName(cand.recommended_target);
    setSourceName(cand.node_a === cand.recommended_target ? cand.node_b : cand.node_a);
  };

  if (!isOpen) return null;

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/70 backdrop-blur-sm p-4">
      <div className="w-full max-w-xl rounded-2xl border border-slate-800 bg-slate-900 shadow-2xl overflow-hidden flex flex-col max-h-[90vh]">
        {/* Header */}
        <div className="flex items-center justify-between px-6 py-4 border-b border-slate-800 bg-slate-950/60">
          <div className="flex items-center gap-2">
            <span className="text-xl">🛠️</span>
            <h2 className="text-lg font-bold text-slate-100">Human-in-the-Loop Taxonomy Curation</h2>
          </div>
          <button
            onClick={onClose}
            className="text-slate-400 hover:text-slate-200 p-1 rounded-lg hover:bg-slate-800 transition-colors"
          >
            ✕
          </button>
        </div>

        {/* Content */}
        <div className="p-6 overflow-y-auto space-y-6">
          {/* Merge Form */}
          <form onSubmit={handleMerge} className="space-y-4">
            <div className="grid grid-cols-3 gap-3">
              <div>
                <label className="block text-xs font-medium text-slate-400 mb-1">Entity Type</label>
                <select
                  value={entityType}
                  onChange={(e) => setEntityType(e.target.value)}
                  className="w-full bg-slate-950 border border-slate-800 rounded-lg px-3 py-2 text-sm text-slate-200 focus:outline-none focus:border-indigo-500"
                >
                  <option value="Method">Method</option>
                  <option value="Domain">Domain</option>
                  <option value="Dataset">Dataset</option>
                </select>
              </div>

              <div>
                <label className="block text-xs font-medium text-slate-400 mb-1">Source (ToDelete)</label>
                <input
                  type="text"
                  placeholder="e.g. XAI"
                  value={sourceName}
                  onChange={(e) => setSourceName(e.target.value)}
                  className="w-full bg-slate-950 border border-slate-800 rounded-lg px-3 py-2 text-sm text-slate-200 placeholder-slate-600 focus:outline-none focus:border-rose-500"
                />
              </div>

              <div>
                <label className="block text-xs font-medium text-slate-400 mb-1">Target (ToKeep)</label>
                <input
                  type="text"
                  placeholder="e.g. Explainable AI"
                  value={targetName}
                  onChange={(e) => setTargetName(e.target.value)}
                  className="w-full bg-slate-950 border border-slate-800 rounded-lg px-3 py-2 text-sm text-slate-200 placeholder-slate-600 focus:outline-none focus:border-emerald-500"
                />
              </div>
            </div>

            <button
              type="submit"
              disabled={submitting}
              className="w-full py-2.5 px-4 bg-indigo-600 hover:bg-indigo-500 disabled:opacity-50 text-white font-medium text-sm rounded-xl transition-all shadow-md shadow-indigo-600/20"
            >
              {submitting ? "Merging Nodes..." : "Merge Duplicate Entities"}
            </button>
          </form>

          {message && (
            <div
              className={`p-3 rounded-lg text-xs border ${
                message.type === "success"
                  ? "bg-emerald-500/10 border-emerald-500/20 text-emerald-300"
                  : "bg-rose-500/10 border-rose-500/20 text-rose-300"
              }`}
            >
              {message.text}
            </div>
          )}

          {/* Candidate Synonyms */}
          <div>
            <h3 className="text-xs font-bold uppercase tracking-wider text-slate-400 mb-3">
              Suggested Synonym / Alias Candidates ({candidates.length})
            </h3>

            {loading ? (
              <div className="text-xs text-slate-500 py-4 text-center">Scanning taxonomy graph...</div>
            ) : candidates.length === 0 ? (
              <div className="text-xs text-slate-500 py-4 text-center bg-slate-950/40 rounded-xl border border-slate-800/60">
                No automatic duplicate candidates found. Use manual merge above.
              </div>
            ) : (
              <div className="space-y-2 max-h-48 overflow-y-auto pr-1">
                {candidates.map((cand, idx) => (
                  <div
                    key={idx}
                    className="p-3 rounded-xl bg-slate-950/60 border border-slate-800/80 flex items-center justify-between text-xs"
                  >
                    <div>
                      <div className="font-semibold text-slate-200">
                        <span className="text-rose-400">{cand.node_a}</span> ↔{" "}
                        <span className="text-emerald-400">{cand.node_b}</span>
                      </div>
                      <div className="text-[10px] text-slate-500 mt-0.5">
                        {cand.entity_type} • {cand.reason}
                      </div>
                    </div>

                    <button
                      onClick={() => applyCandidate(cand)}
                      className="px-2.5 py-1 bg-slate-800 hover:bg-slate-700 text-slate-200 rounded-lg text-[11px] transition-colors"
                    >
                      Select
                    </button>
                  </div>
                ))}
              </div>
            )}
          </div>
        </div>
      </div>
    </div>
  );
}
