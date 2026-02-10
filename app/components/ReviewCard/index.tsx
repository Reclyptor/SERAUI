"use client";

import { useState } from "react";
import clsx from "clsx";
import { Check, ChevronDown } from "lucide-react";
import {
  submitReviewDecision,
  type ReviewItem,
} from "@/app/actions/media";

interface ReviewCardProps {
  review: ReviewItem;
  folderWorkflowId: string;
  onResolved?: () => void;
}

function ConfidenceBadge({ confidence }: { confidence: number }) {
  const percentage = Math.round(confidence * 100);
  const color =
    confidence >= 0.7
      ? "text-amber-400 bg-amber-400/10"
      : confidence >= 0.4
        ? "text-orange-400 bg-orange-400/10"
        : "text-red-400 bg-red-400/10";

  return (
    <span
      className={clsx(
        "inline-flex items-center px-1.5 py-0.5 rounded text-[10px] font-medium tabular-nums",
        color,
      )}
    >
      {percentage}%
    </span>
  );
}

export function ReviewCard({
  review,
  folderWorkflowId,
  onResolved,
}: ReviewCardProps) {
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [isResolved, setIsResolved] = useState(false);
  const [resolvedAction, setResolvedAction] = useState<"approved" | null>(null);
  const [selectedEpisode, setSelectedEpisode] = useState(
    review.suggestedEpisodeNumber,
  );
  const [isDropdownOpen, setIsDropdownOpen] = useState(false);

  const handleApprove = async () => {
    setIsSubmitting(true);
    try {
      const correctedEpisodeNumber =
        selectedEpisode !== review.suggestedEpisodeNumber
          ? selectedEpisode
          : undefined;

      await submitReviewDecision(folderWorkflowId, {
        reviewItemId: review.id,
        approved: true,
        correctedEpisodeNumber,
      });
      setIsResolved(true);
      setResolvedAction("approved");
      onResolved?.();
    } catch (error) {
      console.error("Failed to submit review:", error);
    } finally {
      setIsSubmitting(false);
    }
  };

  if (isResolved) {
    return (
      <div className="bg-background-secondary border border-border rounded-xl px-4 py-3 opacity-60">
        <div className="flex items-center gap-2 text-xs text-foreground-muted">
          {resolvedAction === "approved" && (
            <>
              <Check className="w-3.5 h-3.5 text-emerald-400" />
              <span>
                Approved: {review.fileName} as Episode {selectedEpisode}
              </span>
            </>
          )}
        </div>
      </div>
    );
  }

  const selectedEpisodeData = review.availableEpisodes.find(
    (e) => e.number === selectedEpisode,
  );

  return (
    <div className="bg-background-secondary border border-border rounded-xl overflow-hidden">
      {/* Header */}
      <div className="px-4 py-3 border-b border-border">
        <div className="flex items-center justify-between gap-2">
          <div className="flex items-center gap-2 min-w-0">
            <span className="text-sm font-medium text-foreground truncate">
              {review.fileName}
            </span>
            <ConfidenceBadge confidence={review.confidence} />
          </div>
        </div>
      </div>

      {/* Suggestion */}
      <div className="px-4 py-3">
        {/* Episode selector */}
        <div className="flex items-center gap-2 mb-2">
          <span className="text-xs text-foreground-muted shrink-0">
            Episode:
          </span>
          <div className="relative">
            <button
              onClick={() => setIsDropdownOpen(!isDropdownOpen)}
              className="flex items-center gap-1.5 px-2 py-1 bg-background-tertiary rounded-md text-xs text-foreground hover:bg-background-tertiary/80 transition-colors"
            >
              <span className="tabular-nums">
                E{String(selectedEpisode).padStart(2, "0")}
              </span>
              {selectedEpisodeData?.title && (
                <span className="text-foreground-muted max-w-[150px] truncate">
                  {selectedEpisodeData.title}
                </span>
              )}
              <ChevronDown className="w-3 h-3 text-foreground-muted" />
            </button>

            {isDropdownOpen && (
              <div className="absolute left-0 top-full mt-1 z-10 bg-background-secondary border border-border rounded-lg shadow-lg max-h-[200px] overflow-y-auto min-w-[220px]">
                {review.availableEpisodes.map((ep) => (
                  <button
                    key={ep.number}
                    onClick={() => {
                      setSelectedEpisode(ep.number);
                      setIsDropdownOpen(false);
                    }}
                    className={clsx(
                      "w-full text-left px-3 py-1.5 text-xs hover:bg-background-tertiary transition-colors flex items-center gap-2",
                      ep.number === selectedEpisode &&
                        "bg-background-tertiary text-foreground",
                    )}
                  >
                    <span className="tabular-nums text-foreground-muted shrink-0">
                      E{String(ep.number).padStart(2, "0")}
                    </span>
                    <span className="text-foreground truncate">
                      {ep.title ?? "—"}
                    </span>
                  </button>
                ))}
              </div>
            )}
          </div>
        </div>

        {/* Reasoning */}
        <p className="text-xs text-foreground-muted leading-relaxed mb-3">
          {review.reasoning}
        </p>

        {/* Subtitle snippet */}
        {review.subtitleSnippet && (
          <details className="mb-3">
            <summary className="text-[10px] text-foreground-muted cursor-pointer hover:text-foreground transition-colors">
              Subtitle excerpt
            </summary>
            <div className="mt-1 p-2 bg-background rounded-md text-[10px] text-foreground-muted font-mono leading-relaxed max-h-[100px] overflow-y-auto whitespace-pre-wrap">
              {review.subtitleSnippet}
            </div>
          </details>
        )}

        {/* Actions */}
        <div className="flex items-center gap-2">
          <button
            onClick={handleApprove}
            disabled={isSubmitting}
            className="flex items-center gap-1.5 px-3 py-1.5 bg-accent hover:bg-accent-hover text-background text-xs font-medium rounded-lg transition-colors disabled:opacity-50"
          >
            <Check className="w-3.5 h-3.5" />
            <span>Approve</span>
          </button>
        </div>
      </div>
    </div>
  );
}

/**
 * Container that renders review cards for all pending reviews
 * across active workflows.
 */
export function ReviewCardList({
  reviews,
  folderWorkflowId,
  onAllResolved,
}: {
  reviews: ReviewItem[];
  folderWorkflowId: string;
  onAllResolved?: () => void;
}) {
  const [resolvedCount, setResolvedCount] = useState(0);

  const handleResolved = () => {
    const newCount = resolvedCount + 1;
    setResolvedCount(newCount);
    if (newCount >= reviews.length) {
      onAllResolved?.();
    }
  };

  if (reviews.length === 0) return null;

  return (
    <div className="flex flex-col gap-3 py-2">
      <div className="text-xs text-foreground-muted">
        {reviews.length} file{reviews.length !== 1 ? "s" : ""} need
        {reviews.length === 1 ? "s" : ""} your review:
      </div>
      {reviews.map((review) => (
        <ReviewCard
          key={review.id}
          review={review}
          folderWorkflowId={folderWorkflowId}
          onResolved={handleResolved}
        />
      ))}
    </div>
  );
}
