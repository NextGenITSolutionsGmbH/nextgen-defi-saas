import { NextRequest, NextResponse } from "next/server";
import { auth } from "@/lib/auth";
import { prisma } from "@defi-tracker/db";
import { existsSync, readFileSync } from "fs";

const CONTENT_TYPES: Record<string, string> = {
  CSV: "text/csv; charset=utf-8",
  XLSX: "application/vnd.openxmlformats-officedocument.spreadsheetml.sheet",
  PDF: "text/html; charset=utf-8", // PDF stored as HTML for now
};

export async function GET(
  _request: NextRequest,
  { params }: { params: Promise<{ exportId: string }> },
) {
  try {
    // 1. Authenticate via NextAuth v5
    const session = await auth();
    if (!session?.user?.id) {
      return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
    }

    const { exportId } = await params;

    // 2. Look up export record — only the owner can download
    const exportRecord = await prisma.export.findFirst({
      where: {
        id: exportId,
        userId: session.user.id,
      },
    });

    if (!exportRecord) {
      return NextResponse.json({ error: "Export not found" }, { status: 404 });
    }

    if (exportRecord.status !== "COMPLETED" || !exportRecord.filePath) {
      return NextResponse.json(
        { error: "Export is not ready for download" },
        { status: 400 },
      );
    }

    // 3. Read file from storage
    if (!existsSync(exportRecord.filePath)) {
      return NextResponse.json(
        { error: "Export file not found on disk" },
        { status: 404 },
      );
    }

    const fileBuffer = readFileSync(exportRecord.filePath);

    // 4. Determine content type and filename
    const contentType =
      CONTENT_TYPES[exportRecord.format] || "application/octet-stream";
    const ext =
      exportRecord.format === "PDF"
        ? "html"
        : exportRecord.format.toLowerCase();
    const filename = `defi-tracker_${exportRecord.taxYear}_${exportRecord.method}.${ext}`;

    // 5. Return file with integrity header
    return new NextResponse(fileBuffer, {
      status: 200,
      headers: {
        "Content-Type": contentType,
        "Content-Disposition": `attachment; filename="${filename}"`,
        "Content-Length": fileBuffer.length.toString(),
        "X-File-Hash": exportRecord.fileHash || "",
        "Cache-Control": "private, no-cache",
      },
    });
  } catch (error) {
    console.error("Export download error:", error);
    return NextResponse.json(
      { error: "Internal server error" },
      { status: 500 },
    );
  }
}
