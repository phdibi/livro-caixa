import {
  ref,
  uploadBytes,
  getDownloadURL,
  deleteObject,
} from 'firebase/storage';
import { storage } from '../firebase';

// Tipos de arquivo permitidos
const ALLOWED_TYPES = [
  'image/jpeg',
  'image/png',
  'image/gif',
  'image/webp',
  'application/pdf',
];

// Tamanho máximo: 10MB
const MAX_FILE_SIZE = 10 * 1024 * 1024;

export interface UploadResult {
  url: string;
  filename: string;
  uploadedAt: number;
}

export interface UploadError {
  code: 'invalid-type' | 'file-too-large' | 'upload-failed' | 'storage-not-configured';
  message: string;
}

/**
 * Valida um arquivo antes do upload
 */
export function validateFile(file: File): UploadError | null {
  if (!ALLOWED_TYPES.includes(file.type)) {
    return {
      code: 'invalid-type',
      message: `Tipo de arquivo não permitido. Use: JPEG, PNG, GIF, WebP ou PDF.`,
    };
  }

  if (file.size > MAX_FILE_SIZE) {
    return {
      code: 'file-too-large',
      message: `Arquivo muito grande. Máximo: ${MAX_FILE_SIZE / 1024 / 1024}MB.`,
    };
  }

  return null;
}

/**
 * Gera um nome único para o arquivo
 */
function generateUniqueFilename(originalName: string): string {
  const timestamp = Date.now();
  const randomString = Math.random().toString(36).substring(2, 8);
  const extension = originalName.split('.').pop() || 'bin';
  const baseName = originalName
    .replace(/\.[^/.]+$/, '') // Remove extensão
    .replace(/[^a-zA-Z0-9]/g, '_') // Sanitiza
    .substring(0, 50); // Limita tamanho

  return `${baseName}_${timestamp}_${randomString}.${extension}`;
}

/**
 * Faz upload de um comprovante para o Firebase Storage
 */
export async function uploadReceipt(
  file: File,
  userId: string,
  transactionId: string
): Promise<UploadResult> {
  // Verificar se storage está configurado
  if (!storage) {
    throw {
      code: 'storage-not-configured',
      message: 'Firebase Storage não está configurado.',
    } as UploadError;
  }

  // Validar arquivo
  const validationError = validateFile(file);
  if (validationError) {
    throw validationError;
  }

  try {
    // Gerar nome único
    const filename = generateUniqueFilename(file.name);

    // Criar referência no storage: receipts/{userId}/{transactionId}/{filename}
    const storagePath = `receipts/${userId}/${transactionId}/${filename}`;
    const storageRef = ref(storage, storagePath);

    // Fazer upload
    const snapshot = await uploadBytes(storageRef, file, {
      contentType: file.type,
      customMetadata: {
        originalName: file.name,
        transactionId,
        uploadedBy: userId,
      },
    });

    // Obter URL de download
    const url = await getDownloadURL(snapshot.ref);

    return {
      url,
      filename: file.name,
      uploadedAt: Date.now(),
    };
  } catch (error) {
    console.error('Erro ao fazer upload:', error);
    throw {
      code: 'upload-failed',
      message: 'Falha ao enviar arquivo. Tente novamente.',
    } as UploadError;
  }
}

/**
 * Exclui um comprovante do Firebase Storage
 */
export async function deleteReceipt(
  receiptUrl: string
): Promise<void> {
  if (!storage || !receiptUrl) return;

  try {
    // Extrair o path do storage a partir da URL
    const storageRef = ref(storage, receiptUrl);
    await deleteObject(storageRef);
  } catch (error) {
    // Ignora erro se arquivo não existe
    console.warn('Erro ao excluir comprovante (pode já ter sido excluído):', error);
  }
}

/**
 * Formata o tamanho do arquivo para exibição
 */
export function formatFileSize(bytes: number): string {
  if (bytes === 0) return '0 Bytes';

  const k = 1024;
  const sizes = ['Bytes', 'KB', 'MB', 'GB'];
  const i = Math.floor(Math.log(bytes) / Math.log(k));

  return parseFloat((bytes / Math.pow(k, i)).toFixed(2)) + ' ' + sizes[i];
}

/**
 * Verifica se um arquivo é uma imagem
 */
export function isImageFile(filename: string): boolean {
  const imageExtensions = ['jpg', 'jpeg', 'png', 'gif', 'webp'];
  const ext = filename.split('.').pop()?.toLowerCase() || '';
  return imageExtensions.includes(ext);
}

/**
 * Verifica se um arquivo é PDF
 */
export function isPdfFile(filename: string): boolean {
  return filename.toLowerCase().endsWith('.pdf');
}
