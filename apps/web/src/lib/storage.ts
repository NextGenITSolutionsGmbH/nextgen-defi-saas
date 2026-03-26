// ---------------------------------------------------------------------------
// File Storage Utility for Export Files
// Handles reading/writing export files to local disk storage.
// Storage base path is configurable via EXPORT_STORAGE_PATH env var.
// ---------------------------------------------------------------------------

import { existsSync, mkdirSync, writeFileSync, readFileSync, unlinkSync } from 'fs';
import { join, dirname } from 'path';

const STORAGE_BASE = process.env.EXPORT_STORAGE_PATH || join(process.cwd(), 'data', 'exports');

/**
 * Returns the full filesystem path for an export file.
 *
 * @param userId - Owner of the export
 * @param filename - Export filename (e.g. "2025_FIFO_abc123.csv")
 * @returns Absolute path under the storage base directory
 */
export function getStoragePath(userId: string, filename: string): string {
  return join(STORAGE_BASE, userId, filename);
}

/**
 * Writes an export file to disk, creating parent directories as needed.
 *
 * @param userId - Owner of the export
 * @param filename - Export filename
 * @param data - File content as a Buffer
 * @returns Absolute path where the file was written
 */
export function writeExportFile(userId: string, filename: string, data: Buffer): string {
  const filePath = getStoragePath(userId, filename);
  const dir = dirname(filePath);
  if (!existsSync(dir)) {
    mkdirSync(dir, { recursive: true });
  }
  writeFileSync(filePath, data);
  return filePath;
}

/**
 * Reads an export file from disk.
 *
 * @param filePath - Absolute path to the export file
 * @returns File content as a Buffer
 */
export function readExportFile(filePath: string): Buffer {
  return readFileSync(filePath);
}

/**
 * Deletes an export file from disk if it exists.
 *
 * @param filePath - Absolute path to the export file
 */
export function deleteExportFile(filePath: string): void {
  if (existsSync(filePath)) {
    unlinkSync(filePath);
  }
}

/**
 * Checks whether an export file exists on disk.
 *
 * @param filePath - Absolute path to the export file
 * @returns true if the file exists
 */
export function exportFileExists(filePath: string): boolean {
  return existsSync(filePath);
}
