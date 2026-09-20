import { createServerClient } from "@/lib/supabase/server";
import { getChannels, type ChannelRow } from "@/lib/channels";

/** All channels assigned to this supervisor (across all levels). */
export async function getMyChannels(
  supervisorId: string
): Promise<{ channels: ChannelRow[]; error: string | null }> {
  const { channels, error } = await getChannels();
  if (error) return { channels: [], error };
  return { channels: channels.filter((c) => c.supervisorId === supervisorId), error: null };
}

/** Distinct level numbers (1-4) where this supervisor has at least one channel. */
export async function getMyLevels(supervisorId: string): Promise<number[]> {
  const { channels } = await getMyChannels(supervisorId);
  return Array.from(new Set(channels.map((c) => c.levelNumber))).sort((a, b) => a - b);
}

/** True if this channel belongs to this supervisor. */
export async function ownsChannel(supervisorId: string, channelId: string): Promise<boolean> {
  const supabase = createServerClient();
  const { data } = await supabase
    .from("channels")
    .select("supervisor_id")
    .eq("id", channelId)
    .maybeSingle();
  return data?.supervisor_id === supervisorId;
}

/** True if the course's channel belongs to this supervisor. */
export async function ownsCourse(supervisorId: string, courseId: string): Promise<boolean> {
  const supabase = createServerClient();
  const { data } = await supabase
    .from("courses")
    .select("channel_id")
    .eq("id", courseId)
    .maybeSingle();
  if (!data?.channel_id) return false;
  return ownsChannel(supervisorId, data.channel_id);
}

/** True if the lecture's course's channel belongs to this supervisor. */
export async function ownsLecture(supervisorId: string, lectureId: string): Promise<boolean> {
  const supabase = createServerClient();
  const { data } = await supabase
    .from("lectures")
    .select("course_id")
    .eq("id", lectureId)
    .maybeSingle();
  if (!data?.course_id) return false;
  return ownsCourse(supervisorId, data.course_id);
}
