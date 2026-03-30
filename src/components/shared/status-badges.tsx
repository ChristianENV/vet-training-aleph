import type { VariantProps } from "class-variance-authority";
import { AnalysisStatus, SessionStatus } from "@/generated/prisma/enums";
import { Badge, badgeVariants } from "@/components/ui/badge";
import { cn } from "@/lib/utils";
import { ANALYSIS_STATUS_LABEL } from "@/modules/analyses/presentation/analysis-labels";
import { SESSION_STATUS_LABEL } from "@/modules/sessions/presentation/session-labels";

type BadgeVariant = NonNullable<VariantProps<typeof badgeVariants>["variant"]>;

export function sessionStatusBadgeVariant(status: SessionStatus): BadgeVariant {
  switch (status) {
    case SessionStatus.COMPLETED:
      return "success";
    case SessionStatus.ACTIVE:
    case SessionStatus.GENERATING_QUESTIONS:
    case SessionStatus.SAVING_FINAL_RESPONSES:
    case SessionStatus.TRANSCRIBING:
    case SessionStatus.ANALYZING:
      return "progress";
    case SessionStatus.TRANSCRIPTION_FAILED:
    case SessionStatus.PAUSED:
      return "warning";
    case SessionStatus.DRAFT:
      return "outline";
    case SessionStatus.CANCELLED:
    case SessionStatus.ARCHIVED:
    default:
      return "secondary";
  }
}

export function analysisStatusBadgeVariant(status: AnalysisStatus): BadgeVariant {
  switch (status) {
    case AnalysisStatus.COMPLETED:
      return "success";
    case AnalysisStatus.FAILED:
      return "destructive";
    case AnalysisStatus.PENDING:
    case AnalysisStatus.RUNNING:
      return "progress";
    default:
      return "secondary";
  }
}

export function SessionStatusBadge({
  status,
  className,
}: {
  status: SessionStatus;
  className?: string;
}) {
  return (
    <Badge variant={sessionStatusBadgeVariant(status)} className={cn(className)}>
      {SESSION_STATUS_LABEL[status]}
    </Badge>
  );
}

export function AnalysisStatusBadge({
  status,
  className,
}: {
  status: AnalysisStatus;
  className?: string;
}) {
  return (
    <Badge variant={analysisStatusBadgeVariant(status)} className={cn(className)}>
      {ANALYSIS_STATUS_LABEL[status]}
    </Badge>
  );
}
