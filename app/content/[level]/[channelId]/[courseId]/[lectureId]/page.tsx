import { redirect } from "next/navigation";
import { getLectureItems } from "@/lib/lectures";
import { getBreadcrumbNames } from "@/lib/content";
import { createServerClient } from "@/lib/supabase/server";
import { getSupervisorId } from "@/lib/supervisor-auth";
import { ownsLecture } from "@/lib/supervisor-content";
import { ContentItemsClient } from "@/components/ContentItemsClient";

export const dynamic = "force-dynamic";

export default async function LecturePage({
  params,
}: {
  params: Promise<{ level: string; channelId: string; courseId: string; lectureId: string }>;
}) {
  const supervisorId = await getSupervisorId();
  if (!supervisorId) redirect("/login");

  const { level: levelParam, channelId, courseId, lectureId } = await params;
  const level = Number(levelParam);

  const owned = await ownsLecture(supervisorId, lectureId);
  if (!owned) redirect("/content");

  const supabase = createServerClient();
  const [{ items, error }, { channelName, courseTitle, lectureTitle }, lectureRes] = await Promise.all([
    getLectureItems(lectureId),
    getBreadcrumbNames({ channelId, courseId, lectureId }),
    supabase
      .from("lectures")
      .select(
        "has_quiz, quiz_mandatory, quiz_question_count, quiz_max_attempts, quiz_duration_minutes, quiz_review_mode, quiz_review_available_at, quiz_review_locked_message, quiz_attempts_exhausted_message"
      )
      .eq("id", lectureId)
      .maybeSingle(),
  ]);

  return (
    <ContentItemsClient
      level={level}
      channelId={channelId}
      channelName={channelName ?? ""}
      courseId={courseId}
      courseTitle={courseTitle ?? ""}
      lectureId={lectureId}
      lectureTitle={lectureTitle ?? ""}
      hasQuizInitial={Boolean(lectureRes.data?.has_quiz)}
      quizSettingsInitial={{
        quizQuestionCount: lectureRes.data?.quiz_question_count ?? null,
        quizMaxAttempts: lectureRes.data?.quiz_max_attempts ?? null,
        quizMandatory: lectureRes.data?.quiz_mandatory !== false,
        quizDurationMinutes: lectureRes.data?.quiz_duration_minutes ?? null,
        quizReviewMode: (lectureRes.data?.quiz_review_mode as "never" | "anytime" | "scheduled") ?? "never",
        quizReviewAvailableAt: lectureRes.data?.quiz_review_available_at ?? null,
        quizReviewLockedMessage: lectureRes.data?.quiz_review_locked_message ?? null,
        quizAttemptsExhaustedMessage: lectureRes.data?.quiz_attempts_exhausted_message ?? null,
      }}
      initialItems={items}
      loadError={error}
    />
  );
}
