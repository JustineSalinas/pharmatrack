import { NextResponse } from "next/server";
import { supabase } from "@/lib/supabase";
import { StudentIdSchema } from "@/schema";

export async function GET(request: Request) {
  // 1. Get the ID from the URL (e.g., ?id=2024-00001-USA)
  const { searchParams } = new URL(request.url);
  const id = searchParams.get("id");

  if (!id) {
    return NextResponse.json({ error: "Missing Student ID" }, { status: 400 });
  }

  // 2. Validate the format using the Schema you built earlier
  const validation = StudentIdSchema.safeParse(id);
  if (!validation.success) {
    return NextResponse.json({ error: "Invalid Student ID format" }, { status: 400 });
  }

  // 3. Fetch from Supabase
  const { data, error } = await supabase
    .from("profiles")
    .select("*")
    .eq("student_id", id)
    .single();

  if (error || !data) {
    return NextResponse.json({ error: "Student not found" }, { status: 404 });
  }

  // 4. Return the data to the Frontend
  return NextResponse.json(data);
}