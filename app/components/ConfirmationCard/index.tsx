"use client";

import { useState } from "react";
import type { PendingConfirmation } from "../../hooks/useAgentChat";

interface ConfirmationCardProps {
  confirmation: PendingConfirmation;
  onResolve: (confirmationId: string, approved: boolean, feedback?: string) => Promise<void>;
}

export function ConfirmationCard({ confirmation, onResolve }: ConfirmationCardProps) {
  const [feedback, setFeedback] = useState("");
  const [resolving, setResolving] = useState(false);
  const [showFeedback, setShowFeedback] = useState(false);

  const handleResolve = async (approved: boolean) => {
    setResolving(true);
    await onResolve(
      confirmation.confirmationId,
      approved,
      feedback.trim() || undefined,
    );
    setResolving(false);
  };

  return (
    <div className="py-4 max-w-[672px] mx-auto w-full">
      <div className="border border-accent/30 bg-accent-muted/30 rounded-xl px-5 py-4">
        <div className="flex items-start gap-3">
          <div className="mt-0.5 flex-shrink-0 w-5 h-5 rounded-full bg-accent/20 flex items-center justify-center">
            <svg width="12" height="12" viewBox="0 0 12 12" fill="none" className="text-accent">
              <path
                d="M6 1v6M6 9.5v.5"
                stroke="currentColor"
                strokeWidth="1.5"
                strokeLinecap="round"
              />
            </svg>
          </div>
          <div className="flex-1 min-w-0">
            <p className="text-[11px] font-medium text-foreground-muted mb-1">
              Approval required — {confirmation.actionName}
            </p>
            <p className="text-sm text-foreground leading-snug">
              {confirmation.message}
            </p>

            {showFeedback && (
              <textarea
                value={feedback}
                onChange={(e) => setFeedback(e.target.value)}
                placeholder="Optional feedback..."
                rows={2}
                className="mt-3 w-full bg-background border border-border rounded-lg px-3 py-2 text-sm text-foreground placeholder:text-foreground-muted/50 resize-none focus:outline-none focus:border-accent/50"
              />
            )}

            <div className="flex items-center gap-2 mt-3">
              <button
                type="button"
                disabled={resolving}
                onClick={() => handleResolve(true)}
                className="px-3 py-1.5 text-xs font-medium rounded-lg bg-accent text-background hover:bg-accent-hover transition-colors disabled:opacity-50 cursor-pointer disabled:cursor-not-allowed"
              >
                Approve
              </button>
              <button
                type="button"
                disabled={resolving}
                onClick={() => handleResolve(false)}
                className="px-3 py-1.5 text-xs font-medium rounded-lg border border-border text-foreground-muted hover:text-foreground hover:border-foreground-muted/50 transition-colors disabled:opacity-50 cursor-pointer disabled:cursor-not-allowed"
              >
                Reject
              </button>
              {!showFeedback && (
                <button
                  type="button"
                  onClick={() => setShowFeedback(true)}
                  className="ml-auto text-[11px] text-foreground-muted/60 hover:text-foreground-muted transition-colors cursor-pointer"
                >
                  Add feedback
                </button>
              )}
            </div>
          </div>
        </div>
      </div>
    </div>
  );
}
