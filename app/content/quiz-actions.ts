"use server";

import { revalidatePath } from "next/cache";
import { createServerClient } from "@/lib/supabase/server";

type ActionResult = { error: string | null };

export type QuizQuestionType = "mcq" | "true_false";

export interface QuizOptionRow {
  id: string;
  optionText: string;
  isCorrect: boolean;
  orderIndex: number;
}

export interface QuizQuestionRow {
  id: string;
  questionText: string;
  type: QuizQuestionType;
  orderIndex: number;
  options: QuizOptionRow[];
}

/* ------------------------------------------------------------------ */
/*  تفعيل/إلغاء الكويز للمحاضرة (lectures.has_quiz)                     */
/* ------------------------------------------------------------------ */

export async function setLectureHasQuiz(
  lectureId: string,
  hasQuiz: boolean,
  lecturePath: string
): Promise<ActionResult> {
  const supabase = createServerClient();
  const { error } = await supabase.from("lectures").update({ has_quiz: hasQuiz }).eq("id", lectureId);
  if (error) return { error: error.message };
  revalidatePath(lecturePath);
  return { error: null };
}

/* ------------------------------------------------------------------ */
/*  إعدادات الكويز: عدد الأسئلة/المحاولات/الإجبارية/وضع المراجعة       */
/* ------------------------------------------------------------------ */

export type QuizReviewMode = "never" | "anytime" | "scheduled";

export interface QuizSettings {
  quizQuestionCount: number | null;
  quizMaxAttempts: number | null;
  quizMandatory: boolean;
  quizDurationMinutes: number | null;
  quizReviewMode: QuizReviewMode;
  quizReviewAvailableAt: string | null; // ISO datetime string
  quizReviewLockedMessage: string | null;
  quizAttemptsExhaustedMessage: string | null;
}

export async function fetchQuizSettings(
  lectureId: string
): Promise<{ settings: QuizSettings | null; error: string | null }> {
  const supabase = createServerClient();
  const { data, error } = await supabase
    .from("lectures")
    .select(
      "quiz_question_count, quiz_max_attempts, quiz_mandatory, quiz_duration_minutes, quiz_review_mode, quiz_review_available_at, quiz_review_locked_message, quiz_attempts_exhausted_message"
    )
    .eq("id", lectureId)
    .maybeSingle();
  if (error) return { settings: null, error: error.message };
  if (!data) return { settings: null, error: "المحاضرة غير موجودة" };
  return {
    settings: {
      quizQuestionCount: data.quiz_question_count,
      quizMaxAttempts: data.quiz_max_attempts,
      quizMandatory: data.quiz_mandatory !== false,
      quizDurationMinutes: data.quiz_duration_minutes,
      quizReviewMode: (data.quiz_review_mode as QuizReviewMode) ?? "never",
      quizReviewAvailableAt: data.quiz_review_available_at,
      quizReviewLockedMessage: data.quiz_review_locked_message,
      quizAttemptsExhaustedMessage: data.quiz_attempts_exhausted_message,
    },
    error: null,
  };
}

export async function updateQuizSettings(
  lectureId: string,
  settings: QuizSettings,
  lecturePath: string
): Promise<ActionResult> {
  const supabase = createServerClient();

  if (settings.quizReviewMode === "scheduled" && !settings.quizReviewAvailableAt) {
    return { error: "لازم تحدد تاريخ ووقت فتح المراجعة" };
  }

  const { error } = await supabase
    .from("lectures")
    .update({
      quiz_question_count: settings.quizQuestionCount,
      quiz_max_attempts: settings.quizMaxAttempts,
      quiz_mandatory: settings.quizMandatory,
      quiz_duration_minutes: settings.quizDurationMinutes,
      quiz_review_mode: settings.quizReviewMode,
      quiz_review_available_at: settings.quizReviewMode === "scheduled" ? settings.quizReviewAvailableAt : null,
      quiz_review_locked_message: settings.quizReviewLockedMessage?.trim() || null,
      quiz_attempts_exhausted_message: settings.quizAttemptsExhaustedMessage?.trim() || null,
    })
    .eq("id", lectureId);

  if (error) return { error: error.message };
  revalidatePath(lecturePath);
  return { error: null };
}

/* ------------------------------------------------------------------ */
/*  منح محاولة إضافية لطالب معيّن باستخدام اليوزر نيم بتاعه              */
/* ------------------------------------------------------------------ */

export async function grantExtraQuizAttempt(
  lectureId: string,
  username: string,
  lecturePath: string
): Promise<ActionResult> {
  const supabase = createServerClient();
  const trimmed = username.trim();
  if (!trimmed) return { error: "اكتب يوزر نيم الطالب" };

  const { data: studentRows, error: findError } = await supabase.rpc("find_student_by_username", {
    input_username: trimmed,
  });
  if (findError) return { error: findError.message };

  const student = (studentRows as { student_id: string; student_username: string }[] | null)?.[0];
  if (!student) return { error: "لا يوجد طالب بهذا اليوزر نيم" };

  const { error } = await supabase.from("quiz_attempt_grants").insert({
    lecture_id: lectureId,
    student_id: student.student_id,
  });
  if (error) return { error: error.message };

  revalidatePath(lecturePath);
  return { error: null };
}

/* ------------------------------------------------------------------ */
/*  نتائج الطلاب في اختبار المحاضرة، مرتبة من الأعلى للأقل              */
/*  وعند تساوي الدرجة، الأسبقية لمين دخل الاختبار الأول                 */
/* ------------------------------------------------------------------ */

export interface QuizLeaderboardEntry {
  resultId: string;
  studentId: string;
  username: string;
  score: number;
  passed: boolean;
  durationSeconds: number | null;
  answeredCount: number;
  totalCount: number;
}

export async function fetchQuizLeaderboard(
  lectureId: string
): Promise<{ entries: QuizLeaderboardEntry[]; error: string | null }> {
  const supabase = createServerClient();

  const { data: results, error: resultsError } = await supabase
    .from("quiz_results")
    .select("id, student_id, score, passed, completed_at, session_id")
    .eq("lecture_id", lectureId);
  if (resultsError) return { entries: [], error: resultsError.message };
  if (!results || results.length === 0) return { entries: [], error: null };

  const sessionIds = Array.from(new Set(results.map((r) => r.session_id).filter(Boolean)));
  const studentIds = Array.from(new Set(results.map((r) => r.student_id)));
  const resultIds = results.map((r) => r.id);

  const [sessionsRes, usersRes, answersRes] = await Promise.all([
    sessionIds.length
      ? supabase.from("quiz_sessions").select("id, created_at, question_ids").in("id", sessionIds)
      : Promise.resolve({ data: [] as { id: string; created_at: string; question_ids: string[] }[] }),
    supabase.from("users").select("id, username").in("id", studentIds),
    supabase.from("quiz_attempt_answers").select("result_id").in("result_id", resultIds),
  ]);

  const sessionById = new Map((sessionsRes.data ?? []).map((s) => [s.id, s]));
  const usernameById = new Map((usersRes.data ?? []).map((u) => [u.id, u.username as string]));
  const answeredCountByResult = new Map<string, number>();
  for (const a of answersRes.data ?? []) {
    answeredCountByResult.set(a.result_id, (answeredCountByResult.get(a.result_id) ?? 0) + 1);
  }

  type Merged = {
    resultId: string;
    studentId: string;
    score: number;
    passed: boolean;
    enteredAt: string;
    durationSeconds: number | null;
    answeredCount: number;
    totalCount: number;
  };

  const bestByStudent = new Map<string, Merged>();
  for (const r of results) {
    const session = r.session_id ? sessionById.get(r.session_id) : undefined;
    const enteredAt = session?.created_at ?? r.completed_at;
    const durationSeconds = session?.created_at
      ? Math.round((new Date(r.completed_at).getTime() - new Date(session.created_at).getTime()) / 1000)
      : null;
    const answeredCount = answeredCountByResult.get(r.id) ?? 0;
    const totalCount = session?.question_ids?.length ?? answeredCount;

    const candidate: Merged = {
      resultId: r.id,
      studentId: r.student_id,
      score: r.score,
      passed: r.passed,
      enteredAt,
      durationSeconds,
      answeredCount,
      totalCount,
    };
    const current = bestByStudent.get(r.student_id);
    if (!current) {
      bestByStudent.set(r.student_id, candidate);
      continue;
    }
    const better =
      candidate.passed !== current.passed
        ? candidate.passed
        : candidate.score !== current.score
          ? candidate.score > current.score
          : new Date(candidate.enteredAt).getTime() < new Date(current.enteredAt).getTime();
    if (better) bestByStudent.set(r.student_id, candidate);
  }

  const entries: QuizLeaderboardEntry[] = Array.from(bestByStudent.values())
    .sort((a, b) => {
      if (a.passed !== b.passed) return a.passed ? -1 : 1;
      if (a.score !== b.score) return b.score - a.score;
      return new Date(a.enteredAt).getTime() - new Date(b.enteredAt).getTime();
    })
    .map((m) => ({
      resultId: m.resultId,
      studentId: m.studentId,
      username: usernameById.get(m.studentId) ?? "—",
      score: m.score,
      passed: m.passed,
      durationSeconds: m.durationSeconds,
      answeredCount: m.answeredCount,
      totalCount: m.totalCount,
    }));

  return { entries, error: null };
}

/* ------------------------------------------------------------------ */
/*  حذف محاولة طالب معيّن بالكامل (النتيجة + إجاباته + الجلسة نفسها)    */
/*  عشان تبقى كأنه مدخلش الاختبار أصلًا، ومحاولاته ترجع تقل تلقائي      */
/* ------------------------------------------------------------------ */

export async function deleteQuizAttempt(resultId: string, lecturePath: string): Promise<ActionResult> {
  const supabase = createServerClient();

  const { data: result, error: resultError } = await supabase
    .from("quiz_results")
    .select("id, session_id")
    .eq("id", resultId)
    .maybeSingle();
  if (resultError) return { error: resultError.message };
  if (!result) return { error: "المحاولة غير موجودة" };

  const { error: answersError } = await supabase.from("quiz_attempt_answers").delete().eq("result_id", resultId);
  if (answersError) return { error: answersError.message };

  const { error: resultDeleteError } = await supabase.from("quiz_results").delete().eq("id", resultId);
  if (resultDeleteError) return { error: resultDeleteError.message };

  if (result.session_id) {
    const { error: sessionDeleteError } = await supabase
      .from("quiz_sessions")
      .delete()
      .eq("id", result.session_id);
    if (sessionDeleteError) return { error: sessionDeleteError.message };
  }

  revalidatePath(lecturePath);
  return { error: null };
}

/* ------------------------------------------------------------------ */
/*  مراجعة إجابات طالب معيّن بالتفصيل (للمالك، بغض النظر عن وضع المراجعة) */
/* ------------------------------------------------------------------ */

export interface QuizAttemptAnswerDetail {
  questionText: string;
  selectedOptionText: string | null;
  isCorrect: boolean | null;
  correctOptionText: string | null;
}

export interface QuizAttemptDetail {
  score: number;
  passed: boolean;
  durationSeconds: number | null;
  answeredCount: number;
  totalCount: number;
  answers: QuizAttemptAnswerDetail[];
}

export async function fetchQuizAttemptDetail(
  resultId: string
): Promise<{ detail: QuizAttemptDetail | null; error: string | null }> {
  const supabase = createServerClient();

  const { data: result, error: resultError } = await supabase
    .from("quiz_results")
    .select("id, session_id, score, passed, completed_at")
    .eq("id", resultId)
    .maybeSingle();
  if (resultError) return { detail: null, error: resultError.message };
  if (!result) return { detail: null, error: "المحاولة غير موجودة" };

  const { data: session } = result.session_id
    ? await supabase.from("quiz_sessions").select("id, created_at, question_ids").eq("id", result.session_id).maybeSingle()
    : { data: null };

  const questionIds: string[] = session?.question_ids ?? [];

  const { data: answers } = await supabase
    .from("quiz_attempt_answers")
    .select("question_id, selected_option_id, is_correct")
    .eq("result_id", resultId);

  const answerByQuestion = new Map((answers ?? []).map((a) => [a.question_id, a]));
  const orderedQuestionIds = questionIds.length ? questionIds : Array.from(answerByQuestion.keys());

  const { data: questions } = orderedQuestionIds.length
    ? await supabase.from("quiz_questions").select("id, question_text").in("id", orderedQuestionIds)
    : { data: [] as { id: string; question_text: string }[] };
  const questionTextById = new Map((questions ?? []).map((q) => [q.id, q.question_text]));

  const { data: options } = orderedQuestionIds.length
    ? await supabase
        .from("quiz_options")
        .select("id, question_id, option_text, is_correct")
        .in("question_id", orderedQuestionIds)
    : { data: [] as { id: string; question_id: string; option_text: string; is_correct: boolean }[] };
  const optionsById = new Map((options ?? []).map((o) => [o.id, o]));
  const correctOptionByQuestion = new Map(
    (options ?? []).filter((o) => o.is_correct).map((o) => [o.question_id, o.option_text])
  );

  const answersDetail: QuizAttemptAnswerDetail[] = orderedQuestionIds.map((qid) => {
    const answer = answerByQuestion.get(qid);
    const selectedOption = answer?.selected_option_id ? optionsById.get(answer.selected_option_id) : undefined;
    return {
      questionText: questionTextById.get(qid) ?? "—",
      selectedOptionText: selectedOption?.option_text ?? null,
      isCorrect: answer?.is_correct ?? null,
      correctOptionText: correctOptionByQuestion.get(qid) ?? null,
    };
  });

  const durationSeconds = session?.created_at
    ? Math.round((new Date(result.completed_at).getTime() - new Date(session.created_at).getTime()) / 1000)
    : null;

  return {
    detail: {
      score: result.score,
      passed: result.passed,
      durationSeconds,
      answeredCount: answers?.length ?? 0,
      totalCount: orderedQuestionIds.length,
      answers: answersDetail,
    },
    error: null,
  };
}

/* ------------------------------------------------------------------ */
/*  حذف الاختبار (أرشفة، مش حذف فعلي): الطالب اللي امتحن قبل كده يفضل   */
/*  شايف اختباره ودرجته زي ما هي، واللي لسه ما امتحنش الكارت يختفي عنده */
/*  لحد ما يترفع اختبار جديد                                            */
/* ------------------------------------------------------------------ */

export async function archiveLectureQuiz(lectureId: string, lecturePath: string): Promise<ActionResult> {
  const supabase = createServerClient();

  const { error: archiveError } = await supabase
    .from("quiz_questions")
    .update({ is_archived: true })
    .eq("lecture_id", lectureId)
    .eq("is_archived", false);
  if (archiveError) return { error: archiveError.message };

  const { error: flagError } = await supabase.from("lectures").update({ has_quiz: false }).eq("id", lectureId);
  if (flagError) return { error: flagError.message };

  revalidatePath(lecturePath);
  return { error: null };
}

/* ------------------------------------------------------------------ */
/*  قراءة الأسئلة + خياراتها                                            */
/* ------------------------------------------------------------------ */

export async function fetchQuizQuestions(
  lectureId: string
): Promise<{ questions: QuizQuestionRow[]; error: string | null }> {
  const supabase = createServerClient();

  const [questionsRes, optionsRes] = await Promise.all([
    supabase
      .from("quiz_questions")
      .select("id, question_text, type, order_index")
      .eq("lecture_id", lectureId)
      .eq("is_archived", false)
      .order("order_index", { ascending: true, nullsFirst: false }),
    supabase
      .from("quiz_options")
      .select("id, question_id, option_text, is_correct, order_index")
      .order("order_index", { ascending: true, nullsFirst: false }),
  ]);

  if (questionsRes.error) return { questions: [], error: questionsRes.error.message };
  if (optionsRes.error) return { questions: [], error: optionsRes.error.message };

  const optionsByQuestion = new Map<string, QuizOptionRow[]>();
  for (const o of optionsRes.data ?? []) {
    const row = o as { id: string; question_id: string; option_text: string; is_correct: boolean; order_index: number };
    if (!optionsByQuestion.has(row.question_id)) optionsByQuestion.set(row.question_id, []);
    optionsByQuestion.get(row.question_id)!.push({
      id: row.id,
      optionText: row.option_text,
      isCorrect: row.is_correct,
      orderIndex: row.order_index ?? 0,
    });
  }

  const questions: QuizQuestionRow[] = (questionsRes.data ?? []).map((q) => ({
    id: q.id,
    questionText: q.question_text,
    type: q.type,
    orderIndex: q.order_index ?? 0,
    options: (optionsByQuestion.get(q.id) ?? []).sort((a, b) => a.orderIndex - b.orderIndex),
  }));

  return { questions, error: null };
}

/* ------------------------------------------------------------------ */
/*  إضافة / تعديل / حذف سؤال يدويًا                                     */
/* ------------------------------------------------------------------ */

interface OptionInput {
  text: string;
  isCorrect: boolean;
}

export async function createQuizQuestion(
  lectureId: string,
  questionText: string,
  type: QuizQuestionType,
  options: OptionInput[],
  lecturePath: string
): Promise<ActionResult> {
  const supabase = createServerClient();

  if (!lectureId) return { error: "المحاضرة مطلوبة" };
  if (!questionText.trim()) return { error: "نص السؤال مطلوب" };
  if (options.length < 2) return { error: "لازم خيارين على الأقل" };
  if (!options.some((o) => o.isCorrect)) return { error: "لازم تحدد الإجابة الصحيحة" };

  const { data: maxRow } = await supabase
    .from("quiz_questions")
    .select("order_index")
    .eq("lecture_id", lectureId)
    .order("order_index", { ascending: false, nullsFirst: false })
    .limit(1)
    .maybeSingle();
  const nextOrderIndex = (maxRow?.order_index ?? -1) + 1;

  const { data: question, error } = await supabase
    .from("quiz_questions")
    .insert({
      lecture_id: lectureId,
      question_text: questionText.trim(),
      type,
      order_index: nextOrderIndex,
    })
    .select("id")
    .single();

  if (error) return { error: error.message };

  const { error: optionsError } = await supabase.from("quiz_options").insert(
    options.map((o, idx) => ({
      question_id: question.id,
      option_text: o.text.trim(),
      is_correct: o.isCorrect,
      order_index: idx,
    }))
  );

  if (optionsError) return { error: optionsError.message };

  await setLectureHasQuiz(lectureId, true, lecturePath);
  revalidatePath(lecturePath);
  return { error: null };
}

export async function updateQuizQuestion(
  questionId: string,
  questionText: string,
  type: QuizQuestionType,
  options: OptionInput[],
  lecturePath: string
): Promise<ActionResult> {
  const supabase = createServerClient();

  if (!questionId) return { error: "بيانات غير مكتملة" };
  if (!questionText.trim()) return { error: "نص السؤال مطلوب" };
  if (options.length < 2) return { error: "لازم خيارين على الأقل" };
  if (!options.some((o) => o.isCorrect)) return { error: "لازم تحدد الإجابة الصحيحة" };

  const { error: qError } = await supabase
    .from("quiz_questions")
    .update({ question_text: questionText.trim(), type })
    .eq("id", questionId);
  if (qError) return { error: qError.message };

  // أبسط طريقة آمنة: نمسح الخيارات القديمة ونعيد إدخالها بدل ما نحاول نطابقها واحد بواحد
  const { error: deleteError } = await supabase.from("quiz_options").delete().eq("question_id", questionId);
  if (deleteError) return { error: deleteError.message };

  const { error: insertError } = await supabase.from("quiz_options").insert(
    options.map((o, idx) => ({
      question_id: questionId,
      option_text: o.text.trim(),
      is_correct: o.isCorrect,
      order_index: idx,
    }))
  );
  if (insertError) return { error: insertError.message };

  revalidatePath(lecturePath);
  return { error: null };
}

export async function deleteQuizQuestion(questionId: string, lecturePath: string): Promise<ActionResult> {
  const supabase = createServerClient();
  // أرشفة بدل حذف فعلي، عشان أي طالب سبق وأجاب على السؤال ده يفضل شايفه صح في مراجعته
  const { error } = await supabase.from("quiz_questions").update({ is_archived: true }).eq("id", questionId);
  if (error) return { error: error.message };

  revalidatePath(lecturePath);
  return { error: null };
}

/* ------------------------------------------------------------------ */
/*  رفع أسئلة من ملف Excel — نسخة مبسّطة مربوطة مباشرة بالمحاضرة الحالية */
/*  (بدون أعمدة level/channel_name/course_title/lecture_title القديمة)  */
/* ------------------------------------------------------------------ */

interface SheetRow {
  question_text?: string;
  type?: string;
  option_1?: string;
  option_2?: string;
  option_3?: string;
  option_4?: string;
  correct_option?: string | number;
}

export async function uploadQuizSheet(
  lectureId: string,
  file: File,
  replaceExisting: boolean,
  lecturePath: string
): Promise<ActionResult & { imported?: number }> {
  const supabase = createServerClient();

  if (!lectureId) return { error: "المحاضرة مطلوبة" };
  if (!file || file.size === 0) return { error: "لازم تختار ملف Excel" };

  let XLSX: typeof import("xlsx");
  try {
    XLSX = await import("xlsx");
  } catch {
    return { error: "مكتبة xlsx غير مثبتة على السيرفر — شغّل npm install xlsx" };
  }

  const buffer = Buffer.from(await file.arrayBuffer());
  const workbook = XLSX.read(buffer, { type: "buffer" });
  const sheetName = workbook.SheetNames[0];
  if (!sheetName) return { error: "الملف فاضي" };
  const rows = XLSX.utils.sheet_to_json<SheetRow>(workbook.Sheets[sheetName], { defval: "" });

  if (rows.length === 0) return { error: "لا توجد صفوف في الملف" };

  // نتحقق من كل الصفوف الأول قبل ما نكتب أي حاجة في الداتابيز
  const parsed: { questionText: string; type: QuizQuestionType; options: OptionInput[] }[] = [];
  for (let i = 0; i < rows.length; i++) {
    const row = rows[i];
    const rowNum = i + 2; // +1 للهيدر +1 لأن الفهرسة بتبدأ من صفر
    const questionText = String(row.question_text || "").trim();
    const rawType = String(row.type || "").trim().toLowerCase();
    if (!questionText) return { error: `صف ${rowNum}: نص السؤال مفقود` };
    if (rawType !== "mcq" && rawType !== "true_false") {
      return { error: `صف ${rowNum}: النوع لازم يكون mcq أو true_false` };
    }

    let options: OptionInput[];
    const correctIndex = parseInt(String(row.correct_option ?? ""), 10);

    if (rawType === "true_false") {
      if (correctIndex !== 1 && correctIndex !== 2) {
        return { error: `صف ${rowNum}: correct_option لازم يكون 1 أو 2 لسؤال صح/خطأ` };
      }
      options = [
        { text: "صح", isCorrect: correctIndex === 1 },
        { text: "خطأ", isCorrect: correctIndex === 2 },
      ];
    } else {
      const rawOptions = [row.option_1, row.option_2, row.option_3, row.option_4]
        .map((o) => String(o ?? "").trim())
        .filter((o) => o.length > 0);
      if (rawOptions.length < 2) return { error: `صف ${rowNum}: لازم خيارين على الأقل` };
      if (!correctIndex || correctIndex < 1 || correctIndex > rawOptions.length) {
        return { error: `صف ${rowNum}: correct_option غير صحيح` };
      }
      options = rawOptions.map((text, idx) => ({ text, isCorrect: idx + 1 === correctIndex }));
    }

    parsed.push({ questionText, type: rawType as QuizQuestionType, options });
  }

  if (replaceExisting) {
    // أرشفة بدل حذف فعلي، عشان أي طالب امتحن الأسئلة القديمة يفضل شايف اختباره ودرجته
    const { error: archiveError } = await supabase
      .from("quiz_questions")
      .update({ is_archived: true })
      .eq("lecture_id", lectureId)
      .eq("is_archived", false);
    if (archiveError) return { error: archiveError.message };
  }

  const { data: maxRow } = await supabase
    .from("quiz_questions")
    .select("order_index")
    .eq("lecture_id", lectureId)
    .order("order_index", { ascending: false, nullsFirst: false })
    .limit(1)
    .maybeSingle();
  let nextOrderIndex = (maxRow?.order_index ?? -1) + 1;

  for (const q of parsed) {
    const { data: question, error: qError } = await supabase
      .from("quiz_questions")
      .insert({
        lecture_id: lectureId,
        question_text: q.questionText,
        type: q.type,
        order_index: nextOrderIndex,
      })
      .select("id")
      .single();
    if (qError) return { error: qError.message };

    const { error: optError } = await supabase.from("quiz_options").insert(
      q.options.map((o, idx) => ({
        question_id: question.id,
        option_text: o.text,
        is_correct: o.isCorrect,
        order_index: idx,
      }))
    );
    if (optError) return { error: optError.message };

    nextOrderIndex++;
  }

  await setLectureHasQuiz(lectureId, true, lecturePath);
  revalidatePath(lecturePath);
  return { error: null, imported: parsed.length };
}
