import type { RequestHandler } from "./$types";
import { adminSupabase } from "$lib/supabaseAdminClient";
import { parseQR } from "$lib/qrParser";

export const POST: RequestHandler = async ({ request }) => {
  const payload = await request.json();

  // payload shape: { id, raw_scan_data, parsed, scanned_at, synced }
  const raw = payload.raw_scan_data ?? payload.raw ?? "";
  const parsed = payload.parsed ?? parseQR(raw);

  // insert audit log first
  const { error: logErr } = await adminSupabase.from("qr_scans").insert({
    raw_scan_data: raw,
    parsed_successfully: true,
    scan_stage: parsed.current_stage ?? null,
    scanned_at: new Date(payload.scanned_at ?? Date.now()).toISOString(),
    mr_number: parsed.mr_number ?? null,
  });

  if (logErr) {
    return new Response(JSON.stringify({ error: logErr.message }), {
      status: 500,
    });
  }

  console.log(parsed);

  // upsert into lumber_stacks by stack_id (ensure parsed.stack_id exists)
  const upsertObj: any = {
    stack_id: parsed.stack_id ?? crypto.randomUUID(),
    product_code: parsed.product_code ?? "UNKNOWN",
    description: parsed.description ?? "No description",
    quantity: parsed.quantity ?? 0,
    location_code: parsed.location_code ?? "UNASSIGNED",
    treatment: parsed.treatment ?? "NONE",
    supplier: parsed.supplier ?? null,
    mr_number: parsed.mr_number ?? null,
  };

  const { error: upsertErr } = await adminSupabase
    .from("lumber_stacks")
    .upsert(upsertObj, {
      onConflict: "stack_id",
    });

  if (upsertErr) {
    return new Response(JSON.stringify({ error: upsertErr.message }), {
      status: 500,
    });
  }

  return new Response(JSON.stringify({ success: true }), { status: 200 });
};
