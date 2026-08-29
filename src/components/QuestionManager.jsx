import React, { useState } from "react";
import { FileSpreadsheet, Plus, X, Trash2 } from "lucide-react";

export default function QuestionManager({
  questions,
  onAddCustomQuestion,
  onDeleteQuestion,
  onExportExcel,
  onLogout
}) {
  const [showAddForm, setShowAddForm] = useState(false);
  const [text, setText] = useState("");
  const [category, setCategory] = useState("Technical");
  const [description, setDescription] = useState("");

  const handleAddSubmit = (e) => {
    e.preventDefault();
    if (!text.trim()) return;

    onAddCustomQuestion({
      text: text.trim(),
      category,
      description: description.trim(),
      isCustom: true
    });

    setText("");
    setDescription("");
    setShowAddForm(false);
  };

  return (
    <div>
      {/* Topbar */}
      <div className="topbar">
        <span className="mark">SIGNAL</span>
        <h1>Question Bank</h1>
        <div className="flex-1" />
        <button onClick={onExportExcel} className="ghost-btn font-mono text-xs">
          <FileSpreadsheet className="h-3.5 w-3.5 inline mr-1 text-[var(--teal)]" />
          Export Excel
        </button>
        <button onClick={onLogout} className="ghost-btn font-mono text-xs">
          Log out
        </button>
      </div>

      {/* Body */}
      <div className="p-[26px_28px] max-w-[1080px] mx-auto space-y-6">
        <div className="flex items-center">
          <h2 className="m-0 text-[15px] text-[var(--muted)] font-mono font-semibold tracking-[0.04em] uppercase">
            {questions.length} PRE-DECIDED &amp; CUSTOM QUESTIONS
          </h2>
          <div className="flex-1" />
          <button onClick={() => setShowAddForm(!showAddForm)} className="btn-amber">
            {showAddForm ? <X className="h-4 w-4" /> : <Plus className="h-4 w-4" />} Add question
          </button>
        </div>

        {/* Add Question Form */}
        {showAddForm && (
          <form
            onSubmit={handleAddSubmit}
            className="bg-[var(--panel)] border border-[var(--line)] rounded-xl p-5 space-y-4"
          >
            <h3 className="text-sm font-semibold font-mono text-[var(--amber)]">
              + ADD CUSTOM QUESTION
            </h3>
            <div>
              <label className="field-label">Question Text *</label>
              <textarea
                rows="2"
                required
                placeholder="Type question prompt..."
                value={text}
                onChange={(e) => setText(e.target.value)}
                className="form-textarea"
              />
            </div>

            <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
              <div>
                <label className="field-label">Category</label>
                <select
                  value={category}
                  onChange={(e) => setCategory(e.target.value)}
                  className="form-select"
                >
                  <option value="Technical">Technical</option>
                  <option value="Behavioral">Behavioral</option>
                  <option value="General">General</option>
                  <option value="Wrap-Up">Wrap-Up</option>
                </select>
              </div>
              <div>
                <label className="field-label">Evaluation Focus / Notes</label>
                <input
                  type="text"
                  placeholder="Key traits to evaluate..."
                  value={description}
                  onChange={(e) => setDescription(e.target.value)}
                  className="form-input"
                />
              </div>
            </div>

            <div className="flex justify-end gap-3 pt-2">
              <button
                type="button"
                onClick={() => setShowAddForm(false)}
                className="ghost-btn text-xs"
              >
                Cancel
              </button>
              <button type="submit" className="btn-primary text-xs">
                Save Question
              </button>
            </div>
          </form>
        )}

        {/* Questions List */}
        <div className="space-y-3">
          {questions.map((q) => {
            const categoryClass =
              q.category?.toLowerCase() === "behavioral"
                ? "behavioral"
                : q.category?.toLowerCase() === "technical"
                ? "technical"
                : "general";

            return (
              <div
                key={q.id}
                className="panel-card flex items-center justify-between gap-4 flex-wrap sm:flex-nowrap"
              >
                <div className="flex items-center gap-3 flex-1">
                  <span className={`q-cat ${categoryClass}`}>{q.category || "General"}</span>
                  <div>
                    <p className="text-[14px] font-medium text-[var(--text)] m-0">{q.text}</p>
                    {q.description && (
                      <p className="text-[12px] text-[var(--muted)] m-[2px_0_0_0]">{q.description}</p>
                    )}
                  </div>
                </div>

                {q.isCustom && (
                  <button
                    onClick={() => onDeleteQuestion(q.id)}
                    className="ghost-btn text-xs hover:border-[var(--red)] hover:text-[var(--red)]"
                    title="Delete Question"
                  >
                    <Trash2 className="h-3.5 w-3.5" />
                  </button>
                )}
              </div>
            );
          })}
        </div>
      </div>
    </div>
  );
}
