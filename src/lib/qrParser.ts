import { debug } from "./debug";

// Parser for comma-separated QR code format
// Example: 1257,21212Y2,2 X 12 - 12' #2 SYP,128,1041,PYRO-GUARD,Tri State Forest Products
// Format: MR#, Product Code, Description, Quantity, Stack ID, Treatment, Supplier

export function parseQR(raw: string) {
  const out: any = { raw };

  debug.log("Parsing QR code", { raw });

  // Check if it's comma-separated format
  if (raw.includes(",")) {
    debug.info("Detected CSV format QR code");
    const parts = raw.split(",").map((s) => s.trim());

    // CSV Format: MR#, Product Code, Description, Quantity, Stack ID, Treatment, Supplier
    if (parts.length >= 7) {
      out.mr_number = parts[0] || null;
      out.product_code = parts[1] || null;
      out.description = parts[2] || "No description";
      out.quantity = parts[3] ? Number(parts[3]) : 0;
      out.stack_id = parts[4] || null;
      out.treatment = parts[5] ? parts[5].toUpperCase() : "NONE";
      out.supplier = parts[6] || null;
      out.location_code = null; // Not in this format

      debug.info("CSV Parse result", {
        mr_number: out.mr_number,
        product_code: out.product_code,
        quantity: out.quantity,
        stack_id: out.stack_id,
        treatment: out.treatment,
      });
    } else {
      debug.warn("CSV format detected but not enough fields", {
        expected: 7,
        found: parts.length,
      });
      // Fall back to defaults
      out.mr_number = parts[0] || null;
      out.product_code = parts[1] || null;
      out.description = parts[2] || "No description";
      out.quantity = parts[3] ? Number(parts[3]) : 0;
      out.stack_id = parts[4] || null;
      out.treatment = parts[5] ? parts[5].toUpperCase() : "NONE";
      out.supplier = parts[6] || null;
      out.location_code = null;
    }
  } else {
    // Legacy format with labels (QTY:, CRG:, etc.)
    debug.info("Detected legacy label format");

    // Try multiple quantity patterns
    const qty =
      raw.match(/QTY[:\s]*([0-9]+)/i) ||
      raw.match(/QUANTITY[:\s]*([0-9]+)/i) ||
      raw.match(/QTY\s*=\s*([0-9]+)/i) ||
      raw.match(/Q[:\s]*([0-9]+)/i);
    debug.log("QTY regex match result", {
      qty,
      matched: qty ? qty[1] : "none",
    });
    out.quantity = qty ? Number(qty[1]) : 0;

    const crg = raw.match(/CRG[:\s]*([0-9]+)/i);
    debug.log("CRG regex match result", {
      crg,
      matched: crg ? crg[1] : "none",
    });
    out.location_code = crg ? crg[1] : null;

    const mr = raw.match(/MR[:\s]*([0-9]+)/i);
    debug.log("MR regex match result", { mr, matched: mr ? mr[1] : "none" });
    out.mr_number = mr ? mr[1] : null;

    const stack =
      raw.match(/STACK[:\s]*([0-9]+)/i) || raw.match(/\b(\d{3,6})\b/g);
    debug.log("STACK regex match result", { stack });
    out.stack_id = stack ? stack.pop() : null;

    const treat = raw.match(/(PYRO-GUARD|MCA-C\s?.06\s?AG|NONE|OTHER)/i);
    debug.log("Treatment regex match result", {
      treat,
      matched: treat ? treat[1] : "none",
    });
    out.treatment = treat ? treat[1].toUpperCase() : "NONE";

    // product code like "21212Y2"
    const product = raw.match(/\b[A-Z0-9-]{4,12}\b/);
    debug.log("Product code regex match result", {
      product,
      matched: product ? product[0] : "none",
    });
    out.product_code = product ? product[0] : null;

    // description heuristics (e.g., "2X4X8 SYP" or "2 X 12 - 12' #2 SYP")
    const desc = raw.match(/\d+\s*X\s*\d+.*SYP/i);
    debug.log("Description regex match result", {
      desc,
      matched: desc ? desc[0] : "none",
    });
    out.description = desc
      ? desc[0]
      : raw.length > 0
        ? raw.substring(0, 40)
        : "No description";

    out.supplier = null; // Not in legacy format
  }

  debug.info("Final parsed result", out);

  return out;
}
