import { readFileSync } from "node:fs";
import { resolve } from "node:path";
import { describe, expect, it } from "vitest";

const auditarSource = readFileSync(
  resolve(process.cwd(), "client/src/pages/Auditar.tsx"),
  "utf8",
);

describe("Auditar DOCX support markers", () => {
  it("routes document reading and persistence through mobile-ready adapters", () => {
    expect(auditarSource).toContain('readWebFileAsDataUrl');
    expect(auditarSource).toContain('platformStorageGetJSON');
    expect(auditarSource).toContain('platformStorageSetJSON');
    expect(auditarSource).toContain('async function fileToBase64(file: File)');
    expect(auditarSource).toContain('return readWebFileAsDataUrl(file);');
  });

  it("connects native camera and gallery triggers through the platform document adapter", () => {
    expect(auditarSource).toContain('canUseNativeDocumentInput');
    expect(auditarSource).toContain('selectNativeDocumentForCaptureMode("camera")');
    expect(auditarSource).toContain('selectNativeDocumentForCaptureMode("file")');
    expect(auditarSource).toContain('handleSelectedDocumentFile(selection.file ?? null);');
    expect(auditarSource).toContain('isNativeDocumentSelectionCancelled(error)');
    expect(auditarSource).toContain('getNativeDocumentSelectionErrorMessage("camera")');
    expect(auditarSource).toContain('getNativeDocumentSelectionErrorMessage("file")');
  });

  it("persists a lightweight pending draft snapshot for mobile recovery without reviving binary payloads", () => {
    expect(auditarSource).toContain('type AuditarPersistedDraftSnapshot = {');
    expect(auditarSource).toContain('pendingDraftSnapshot?: AuditarPersistedDraftSnapshot | null;');
    expect(auditarSource).toContain('setRestoredDraftSnapshot(persistedState.pendingDraftSnapshot ?? null);');
    expect(auditarSource).toContain('pendingDraftSnapshot: pendingDraft');
    expect(auditarSource).toContain('fileName: pendingDraft.previewAsset.fileName');
    expect(auditarSource).toContain('summary: pendingDraft.preliminaryAnalysis.summary');
    expect(auditarSource).toContain('Recuperamos tu contexto. Había una revisión sin confirmar de ${restoredDraftSnapshot.fileName}.');
  });

  it("persists editable draft context and restores the note safely during the eighth mobile wave", () => {
    expect(auditarSource).toContain('type AuditarPersistedEditableDraftContext = {');
    expect(auditarSource).toContain('textHint?: string;');
    expect(auditarSource).toContain('editableDraftContext?: AuditarPersistedEditableDraftContext | null;');
    expect(auditarSource).toContain('setTextHint(persistedState.textHint ?? "");');
    expect(auditarSource).toContain('setRestoredEditableDraftContext(');
    expect(auditarSource).toContain('editableDraftContext: pendingDraft');
    expect(auditarSource).toContain('manualFieldValues: Object.fromEntries(');
    expect(auditarSource).toContain('Recuperamos tu nota y tus ajustes editables para que sigas sin empezar de cero.');
  });

  it("keeps DOCX in the upload picker and validation copy", () => {
    expect(auditarSource).toContain(".docx");
    expect(auditarSource).toContain(
      "application/vnd.openxmlformats-officedocument.wordprocessingml.document",
    );
    expect(auditarSource).toContain("DOCX");
  });

  it("keeps the user-facing guardrails aligned with DOCX support", () => {
    expect(auditarSource).toContain(
      "Formatos compatibles: PDF, XML, JPG, PNG, WEBP o DOCX",
    );
    expect(auditarSource).toContain(
      "Este archivo no es compatible todavía. Sube PDF, XML, JPG, PNG, WEBP o DOCX para continuar.",
    );
  });
});
