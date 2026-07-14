import { NextRequest, NextResponse } from "next/server";
import prisma from "@/lib/prisma";
import { successResponse, errorResponse } from "@/lib/api-utils";
import { z } from "zod";

const documentTypeUpdateSchema = z.object({
  name: z.string().min(1, "Nazwa typu jest wymagana").max(100),
});

export async function PUT(
  request: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  try {
    const { id } = await params;
    const body = await request.json();
    const validated = documentTypeUpdateSchema.parse(body);
    const type = await prisma.documentType.update({
      where: { id },
      data: { name: validated.name },
    });
    return successResponse(type);
  } catch (error) {
    return errorResponse(error);
  }
}

export async function DELETE(
  _request: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  try {
    const { id } = await params;
    const docType = await prisma.documentType.findUnique({
      where: { id },
      include: { _count: { select: { documents: true } } },
    });

    if (!docType) {
      return NextResponse.json({ error: "Nie znaleziono typu dokumentu" }, { status: 404 });
    }

    if (docType.isSystem) {
      return NextResponse.json({ error: "Nie można usunąć systemowego typu dokumentu" }, { status: 400 });
    }

    await prisma.documentType.delete({ where: { id } });
    return successResponse({ deleted: true });
  } catch (error) {
    return errorResponse(error);
  }
}
