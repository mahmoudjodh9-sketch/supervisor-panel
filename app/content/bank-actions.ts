"use server";

import { revalidatePath } from "next/cache";
import { randomUUID } from "crypto";
import { createServerClient } from "@/lib/supabase/server";
import { getSupervisorId } from "@/lib/supervisor-auth";
import { ownsLecture } from "@/lib/supervisor-content";

type ActionResult = { error: string | null };

export type BankQuestionType = "true_false" | "mcq" | "essay";
export type BankUnlockMode = "all" | "selected" | "immediate";
export type BankOrderMode = "sheet" | "random";

export interface BankOptionRow {
  id: string;
  optionText: string;
  isCorrect: boolean;
  orderIndex: number;
}

export interface BankQuestionRow {
  id: string;
  type: BankQuestionType;
  questionText: string;
  answerText: string | null;
  explanation: string | null;
  requirement: string | null;
  groupId: string | null;
  groupOrder: number;
  orderIndex: number;
  options: BankOptionRow[];
}

export interface BankSettings {
  unlockMode: BankUnlockMode;
  orderMode: BankOrderMode;
  unlockItemIds: string[];
}

export interface BankQuestionInput {
  type: BankQuestionType;
  questionText: string;
  options: { text: string; isCorrect: boolean }[];
  answerText: string;
  explanation: string;
  requirement: string;
  groupId: string | null;
}

/* ------------------------------------------------------------------ */
/*  فحص الصلاحية: المشرف لازم يكون مالك المحاضرة                        */
/* ------------------------------------------------------------------ */

async function checkLecture(lectureId: string): Promise<string | null> {
  const supervisorId = await getSupervisorId();
  if (!supervisorId) return "غير مصرّح";
  if (!lectureId) return "المحاضرة مطلوبة";
  const owned = await ownsLecture(supervisorId, lectureId);
  return owned ? null : "غير مصرّح";
}

async function lectureOfQuestion(questionId: string): Promise<string | null> {
  const supabase = createServerClient();
  const { data } = await supabase
    .from("question_bank_questions")
    .select("lecture_id")
    .eq("id", questionId)
    .maybeSingle();
  return data?.lecture_id ?? null;
}

function validateInput(input: BankQuestionInput): string | null {
  if (!input.questionText.trim()) return "نص السؤال مطلوب";

  const requirement = input.requirement.trim();
  if ((requirement && !input.groupId) || (!requirement && input.groupId)) {
    return "المطلوب واسم المجموعة لازم يتحددوا مع بعض";
  }

  if (input.type === "essay") {
    if (!input.answerText.trim()) return "إجابة السؤال المقالي مطلوبة";
    return null;
  }

  if (input.type === "true_false") {
    if (input.options.length !== 2) return "سؤال صح/غلط لازم يبقى فيه اختيارين";
  } else if (input.options.length < 2) {
    return "لازم خيارين على الأقل";
  }
  if (input.options.some((o) => !o.text.trim())) return "فيه خيار فاضي";
  if (input.options.filter((o) => o.isCorrect).length !== 1) return "لازم تحدد إجابة صحيحة واحدة";
  return null;
}

/* ------------------------------------------------------------------ */
/*  تفعيل/إلغاء البنك                                                  */
/* ------------------------------------------------------------------ */

export async function setLectureHasBank(
  lectureId: string,
  hasBank: boolean,
  lecturePath: string
): Promise<ActionResult> {
  const denied = await checkLecture(lectureId);
  if (denied) return { error: denied };

  const supabase = createServerClient();
  const { error } = await supabase.from("lectures").update({ has_question_bank: hasBank }).eq("id", lectureId);
  if (error) return { error: error.message };
  revalidatePath(lecturePath);
  return { error: null };
}

/** حذف البنك كله (الأسئلة + شروط الفتح) وإخفاء الكارت. */
export async function deleteQuestionBank(lectureId: string, lecturePath: string): Promise<ActionResult> {
  const denied = await checkLecture(lectureId);
  if (denied) return { error: denied };

  const supabase = createServerClient();
  const { error: qError } = await supabase.from("question_bank_questions").delete().eq("lecture_id", lectureId);
  if (qError) return { error: qError.message };
  const { error: uError } = await supabase.from("question_bank_unlock_items").delete().eq("lecture_id", lectureId);
  if (uError) return { error: uError.message };
  const { error: lError } = await supabase
    .from("lectures")
    .update({ has_question_bank: false, bank_unlock_mode: "immediate", bank_order_mode: "sheet" })
    .eq("id", lectureId);
  if (lError) return { error: lError.message };

  revalidatePath(lecturePath);
  return { error: null };
}

/* ------------------------------------------------------------------ */
/*  الإعدادات: شرط الفتح + الترتيب                                      */
/* ------------------------------------------------------------------ */

export async function fetchBankSettings(
  lectureId: string
): Promise<{ settings: BankSettings; error: string | null }> {
  const fallback: BankSettings = { unlockMode: "immediate", orderMode: "sheet", unlockItemIds: [] };
  const denied = await checkLecture(lectureId);
  if (denied) return { settings: fallback, error: denied };

  const supabase = createServerClient();
  const [lectureRes, itemsRes] = await Promise.all([
    supabase.from("lectures").select("bank_unlock_mode, bank_order_mode").eq("id", lectureId).maybeSingle(),
    supabase.from("question_bank_unlock_items").select("lecture_item_id").eq("lecture_id", lectureId),
  ]);
  if (lectureRes.error) return { settings: fallback, error: lectureRes.error.message };
  if (itemsRes.error) return { settings: fallback, error: itemsRes.error.message };

  return {
    settings: {
      unlockMode: (lectureRes.data?.bank_unlock_mode as BankUnlockMode) ?? "immediate",
      orderMode: (lectureRes.data?.bank_order_mode as BankOrderMode) ?? "sheet",
      unlockItemIds: (itemsRes.data ?? []).map((r) => r.lecture_item_id as string),
    },
    error: null,
  };
}

export async function updateBankSettings(
  lectureId: string,
  settings: BankSettings,
  lecturePath: string
): Promise<ActionResult> {
  const denied = await checkLecture(lectureId);
  if (denied) return { error: denied };

  const supabase = createServerClient();

  let itemIds: string[] = [];
  if (settings.unlockMode === "selected") {
    if (settings.unlockItemIds.length === 0) return { error: "اختار ملف واحد على الأقل لشرط الفتح" };

    // نتأكد إن العناصر المختارة تخص المحاضرة دي وإنها فيديو أو PDF
    const { data: valid, error: vError } = await supabase
      .from("lecture_items")
      .select("id")
      .eq("lecture_id", lectureId)
      .in("type", ["video", "pdf"])
      .in("id", settings.unlockItemIds);
    if (vError) return { error: vError.message };
    itemIds = (valid ?? []).map((r) => r.id as string);
    if (itemIds.length === 0) return { error: "العناصر المختارة غير صالحة" };
  }

  const { error: lError } = await supabase
    .from("lectures")
    .update({ bank_unlock_mode: settings.unlockMode, bank_order_mode: settings.orderMode })
    .eq("id", lectureId);
  if (lError) return { error: lError.message };

  const { error: dError } = await supabase.from("question_bank_unlock_items").delete().eq("lecture_id", lectureId);
  if (dError) return { error: dError.message };

  if (itemIds.length > 0) {
    const { error: iError } = await supabase
      .from("question_bank_unlock_items")
      .insert(itemIds.map((id) => ({ lecture_id: lectureId, lecture_item_id: id })));
    if (iError) return { error: iError.message };
  }

  revalidatePath(lecturePath);
  return { error: null };
}

/* ------------------------------------------------------------------ */
/*  قراءة الأسئلة                                                       */
/* ------------------------------------------------------------------ */

export async function fetchBankQuestions(
  lectureId: string
): Promise<{ questions: BankQuestionRow[]; error: string | null }> {
  const denied = await checkLecture(lectureId);
  if (denied) return { questions: [], error: denied };

  const supabase = createServerClient();
  const { data: qs, error: qError } = await supabase
    .from("question_bank_questions")
    .select("id, type, question_text, answer_text, explanation, requirement, group_id, group_order, order_index")
    .eq("lecture_id", lectureId)
    .eq("is_archived", false)
    .order("order_index", { ascending: true })
    .order("group_order", { ascending: true });
  if (qError) return { questions: [], error: qError.message };

  const ids = (qs ?? []).map((q) => q.id as string);
  const optionsByQuestion = new Map<string, BankOptionRow[]>();
  if (ids.length > 0) {
    const { data: opts, error: oError } = await supabase
      .from("question_bank_options")
      .select("id, question_id, option_text, is_correct, order_index")
      .in("question_id", ids)
      .order("order_index", { ascending: true });
    if (oError) return { questions: [], error: oError.message };
    for (const o of opts ?? []) {
      const list = optionsByQuestion.get(o.question_id as string) ?? [];
      list.push({
        id: o.id as string,
        optionText: o.option_text as string,
        isCorrect: Boolean(o.is_correct),
        orderIndex: (o.order_index as number) ?? 0,
      });
      optionsByQuestion.set(o.question_id as string, list);
    }
  }

  return {
    questions: (qs ?? []).map((q) => ({
      id: q.id as string,
      type: q.type as BankQuestionType,
      questionText: q.question_text as string,
      answerText: (q.answer_text as string | null) ?? null,
      explanation: (q.explanation as string | null) ?? null,
      requirement: (q.requirement as string | null) ?? null,
      groupId: (q.group_id as string | null) ?? null,
      groupOrder: (q.group_order as number) ?? 0,
      orderIndex: (q.order_index as number) ?? 0,
      options: optionsByQuestion.get(q.id as string) ?? [],
    })),
    error: null,
  };
}

/* ------------------------------------------------------------------ */
/*  إضافة / تعديل / حذف سؤال                                           */
/* ------------------------------------------------------------------ */

async function insertOptions(
  questionId: string,
  options: { text: string; isCorrect: boolean }[]
): Promise<string | null> {
  if (options.length === 0) return null;
  const supabase = createServerClient();
  const { error } = await supabase.from("question_bank_options").insert(
    options.map((o, idx) => ({
      question_id: questionId,
      option_text: o.text.trim(),
      is_correct: o.isCorrect,
      order_index: idx,
    }))
  );
  return error ? error.message : null;
}

async function nextOrderIndex(lectureId: string): Promise<number> {
  const supabase = createServerClient();
  const { data } = await supabase
    .from("question_bank_questions")
    .select("order_index")
    .eq("lecture_id", lectureId)
    .order("order_index", { ascending: false })
    .limit(1)
    .maybeSingle();
  return (data?.order_index ?? -1) + 1;
}

export async function createBankQuestion(
  lectureId: string,
  input: BankQuestionInput,
  lecturePath: string
): Promise<ActionResult> {
  const denied = await checkLecture(lectureId);
  if (denied) return { error: denied };
  const invalid = validateInput(input);
  if (invalid) return { error: invalid };

  const supabase = createServerClient();
  const orderIndex = await nextOrderIndex(lectureId);

  // ترتيب المطلب جوه مجموعته = عدد أسئلة المجموعة الحالية
  let groupOrder = 0;
  if (input.groupId) {
    const { count } = await supabase
      .from("question_bank_questions")
      .select("id", { count: "exact", head: true })
      .eq("lecture_id", lectureId)
      .eq("group_id", input.groupId)
      .eq("is_archived", false);
    groupOrder = count ?? 0;
  }

  const { data: question, error } = await supabase
    .from("question_bank_questions")
    .insert({
      lecture_id: lectureId,
      type: input.type,
      question_text: input.questionText.trim(),
      answer_text: input.type === "essay" ? input.answerText.trim() : null,
      explanation: input.explanation.trim() || null,
      requirement: input.requirement.trim() || null,
      group_id: input.groupId,
      group_order: groupOrder,
      order_index: orderIndex,
    })
    .select("id")
    .single();
  if (error) return { error: error.message };

  if (input.type !== "essay") {
    const optError = await insertOptions(question.id as string, input.options);
    if (optError) return { error: optError };
  }

  await setLectureHasBank(lectureId, true, lecturePath);
  revalidatePath(lecturePath);
  return { error: null };
}

export async function updateBankQuestion(
  questionId: string,
  input: BankQuestionInput,
  lecturePath: string
): Promise<ActionResult> {
  const lectureId = await lectureOfQuestion(questionId);
  if (!lectureId) return { error: "السؤال غير موجود" };
  const denied = await checkLecture(lectureId);
  if (denied) return { error: denied };
  const invalid = validateInput(input);
  if (invalid) return { error: invalid };

  const supabase = createServerClient();
  const { error: qError } = await supabase
    .from("question_bank_questions")
    .update({
      type: input.type,
      question_text: input.questionText.trim(),
      answer_text: input.type === "essay" ? input.answerText.trim() : null,
      explanation: input.explanation.trim() || null,
      requirement: input.requirement.trim() || null,
      group_id: input.groupId,
    })
    .eq("id", questionId);
  if (qError) return { error: qError.message };

  // نمسح الاختيارات القديمة ونعيد إدخالها (نفس أسلوب الكويز)
  const { error: dError } = await supabase.from("question_bank_options").delete().eq("question_id", questionId);
  if (dError) return { error: dError.message };
  if (input.type !== "essay") {
    const optError = await insertOptions(questionId, input.options);
    if (optError) return { error: optError };
  }

  revalidatePath(lecturePath);
  return { error: null };
}

export async function deleteBankQuestion(questionId: string, lecturePath: string): Promise<ActionResult> {
  const lectureId = await lectureOfQuestion(questionId);
  if (!lectureId) return { error: "السؤال غير موجود" };
  const denied = await checkLecture(lectureId);
  if (denied) return { error: denied };

  // بنك الأسئلة للمذاكرة بس (مفيش درجات ولا مراجعة نتايج)، فالحذف فعلي مش أرشفة
  const supabase = createServerClient();
  const { error } = await supabase.from("question_bank_questions").delete().eq("id", questionId);
  if (error) return { error: error.message };

  revalidatePath(lecturePath);
  return { error: null };
}

/* ------------------------------------------------------------------ */
/*  رفع أسئلة من Excel                                                 */
/*  الأعمدة: type, question_text, option_1..option_4, correct_option,   */
/*           answer_text (للمقالي), explanation, requirement, group_id   */
/* ------------------------------------------------------------------ */

interface SheetRow {
  type?: string;
  question_text?: string;
  option_1?: string;
  option_2?: string;
  option_3?: string;
  option_4?: string;
  correct_option?: string | number;
  answer_text?: string;
  explanation?: string;
  requirement?: string | number;
  group_id?: string | number;
}

export async function uploadBankSheet(
  lectureId: string,
  file: File,
  replaceExisting: boolean,
  lecturePath: string
): Promise<ActionResult & { imported?: number }> {
  const denied = await checkLecture(lectureId);
  if (denied) return { error: denied };
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

  // نتحقق من كل الصفوف الأول قبل ما نكتب أي حاجة
  const parsed: (BankQuestionInput & { groupLabel: string })[] = [];
  for (let i = 0; i < rows.length; i++) {
    const row = rows[i];
    const rowNum = i + 2;
    const questionText = String(row.question_text ?? "").trim();
    const rawType = String(row.type ?? "").trim().toLowerCase();
    const explanation = String(row.explanation ?? "").trim();
    const requirement = String(row.requirement ?? "").trim();
    const groupLabel = String(row.group_id ?? "").trim();
    const answerText = String(row.answer_text ?? "").trim();

    if (!questionText) return { error: `صف ${rowNum}: نص السؤال مفقود` };
    if (rawType !== "mcq" && rawType !== "true_false" && rawType !== "essay") {
      return { error: `صف ${rowNum}: النوع لازم يكون mcq أو true_false أو essay` };
    }
    if ((requirement && !groupLabel) || (!requirement && groupLabel)) {
      return { error: `صف ${rowNum}: group_id و requirement لازم يتكتبوا مع بعض` };
    }

    let options: { text: string; isCorrect: boolean }[] = [];
    const correctIndex = parseInt(String(row.correct_option ?? ""), 10);

    if (rawType === "essay") {
      if (!answerText) return { error: `صف ${rowNum}: answer_text مطلوب للسؤال المقالي` };
    } else if (rawType === "true_false") {
      if (correctIndex !== 1 && correctIndex !== 2) {
        return { error: `صف ${rowNum}: correct_option لازم يكون 1 (صح) أو 2 (غلط)` };
      }
      options = [
        { text: "صح", isCorrect: correctIndex === 1 },
        { text: "غلط", isCorrect: correctIndex === 2 },
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

    parsed.push({
      type: rawType as BankQuestionType,
      questionText,
      options,
      answerText,
      explanation,
      requirement,
      groupId: null,
      groupLabel,
    });
  }

  const supabase = createServerClient();

  if (replaceExisting) {
    const { error: delError } = await supabase.from("question_bank_questions").delete().eq("lecture_id", lectureId);
    if (delError) return { error: delError.message };
  }

  let orderIndex = await nextOrderIndex(lectureId);
  const groupIds = new Map<string, string>();
  const groupOrders = new Map<string, number>();

  for (const q of parsed) {
    let groupId: string | null = null;
    let groupOrder = 0;
    if (q.groupLabel) {
      if (!groupIds.has(q.groupLabel)) groupIds.set(q.groupLabel, randomUUID());
      groupId = groupIds.get(q.groupLabel)!;
      groupOrder = groupOrders.get(q.groupLabel) ?? 0;
      groupOrders.set(q.groupLabel, groupOrder + 1);
    }

    const { data: question, error: qError } = await supabase
      .from("question_bank_questions")
      .insert({
        lecture_id: lectureId,
        type: q.type,
        question_text: q.questionText,
        answer_text: q.type === "essay" ? q.answerText : null,
        explanation: q.explanation || null,
        requirement: q.requirement || null,
        group_id: groupId,
        group_order: groupOrder,
        order_index: orderIndex,
      })
      .select("id")
      .single();
    if (qError) return { error: qError.message };

    if (q.type !== "essay") {
      const optError = await insertOptions(question.id as string, q.options);
      if (optError) return { error: optError };
    }
    orderIndex++;
  }

  await setLectureHasBank(lectureId, true, lecturePath);
  revalidatePath(lecturePath);
  return { error: null, imported: parsed.length };
}
