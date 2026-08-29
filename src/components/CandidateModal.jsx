import React, { useState } from "react";
import { X, UserPlus, Mail, Briefcase, Building } from "lucide-react";

export default function CandidateModal({ isOpen, onClose, onSave }) {
  const [name, setName] = useState("");
  const [role, setRole] = useState("");
  const [department, setDepartment] = useState("Engineering");
  const [email, setEmail] = useState("");
  const [notes, setNotes] = useState("");

  if (!isOpen) return null;

  const handleSubmit = (e) => {
    e.preventDefault();
    if (!name.trim()) return;

    onSave({
      id: `cand_${Date.now()}`,
      name: name.trim(),
      role: role.trim() || "Candidate",
      department: department.trim() || "General",
      email: email.trim() || `${name.toLowerCase().replace(/\s+/g, ".")}@example.com`,
      status: "Pending",
      avatar: `https://api.dicebear.com/7.x/avataaars/svg?seed=${encodeURIComponent(name)}`,
      dateAdded: new Date().toISOString().split("T")[0],
      sessionsCount: 0,
      notes: notes.trim()
    });

    // Reset
    setName("");
    setRole("");
    setNotes("");
    setEmail("");
    onClose();
  };

  return (
    <div className="modal-overlay">
      <div className="glass-panel w-full max-w-lg p-6 relative bg-[#0f172a] border border-indigo-500/20 shadow-2xl">
        <button
          onClick={onClose}
          className="absolute top-5 right-5 text-slate-400 hover:text-white transition-colors"
        >
          <X className="h-5 w-5" />
        </button>

        <div className="flex items-center gap-3 mb-6">
          <div className="p-3 rounded-xl bg-indigo-500/10 text-indigo-400 border border-indigo-500/20">
            <UserPlus className="h-6 w-6" />
          </div>
          <div>
            <h3 className="text-xl font-bold text-white">Add New Candidate</h3>
            <p className="text-xs text-slate-400">
              Create an interviewee profile to start recording sessions.
            </p>
          </div>
        </div>

        <form onSubmit={handleSubmit} className="space-y-4">
          <div>
            <label className="block text-xs font-semibold text-slate-300 uppercase tracking-wider mb-1.5">
              Full Name *
            </label>
            <input
              type="text"
              required
              placeholder="e.g. Jordan Miller"
              value={name}
              onChange={(e) => setName(e.target.value)}
              className="form-input"
            />
          </div>

          <div className="grid grid-cols-2 gap-4">
            <div>
              <label className="block text-xs font-semibold text-slate-300 uppercase tracking-wider mb-1.5">
                Role / Title
              </label>
              <div className="relative">
                <input
                  type="text"
                  placeholder="e.g. Senior Frontend Dev"
                  value={role}
                  onChange={(e) => setRole(e.target.value)}
                  className="form-input"
                />
              </div>
            </div>

            <div>
              <label className="block text-xs font-semibold text-slate-300 uppercase tracking-wider mb-1.5">
                Department
              </label>
              <select
                value={department}
                onChange={(e) => setDepartment(e.target.value)}
                className="form-select"
              >
                <option value="Engineering">Engineering</option>
                <option value="Product & Design">Product & Design</option>
                <option value="Data Science & AI">Data Science & AI</option>
                <option value="Leadership & Management">Leadership & Management</option>
                <option value="Sales & Marketing">Sales & Marketing</option>
                <option value="Operations">Operations</option>
              </select>
            </div>
          </div>

          <div>
            <label className="block text-xs font-semibold text-slate-300 uppercase tracking-wider mb-1.5">
              Email Address
            </label>
            <input
              type="email"
              placeholder="jordan.miller@company.com"
              value={email}
              onChange={(e) => setEmail(e.target.value)}
              className="form-input"
            />
          </div>

          <div>
            <label className="block text-xs font-semibold text-slate-300 uppercase tracking-wider mb-1.5">
              Interview Notes / Focus Areas
            </label>
            <textarea
              rows="3"
              placeholder="Key skills to assess, candidate resume highlights..."
              value={notes}
              onChange={(e) => setNotes(e.target.value)}
              className="form-textarea"
            />
          </div>

          <div className="flex items-center justify-end gap-3 pt-4 border-t border-white/10">
            <button
              type="button"
              onClick={onClose}
              className="btn btn-secondary"
            >
              Cancel
            </button>
            <button type="submit" className="btn btn-primary">
              Create Candidate
            </button>
          </div>
        </form>
      </div>
    </div>
  );
}
