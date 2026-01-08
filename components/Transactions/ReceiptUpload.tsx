import React, { useState, useRef, useCallback } from 'react';
import {
  uploadReceipt,
  deleteReceipt,
  validateFile,
  formatFileSize,
  isImageFile,
  isPdfFile,
  UploadResult,
  UploadError,
} from '../../services/receiptService';
import { ReceiptStatus } from '../../types';

interface ReceiptUploadProps {
  transactionId: string;
  userId: string;
  currentReceiptUrl?: string;
  currentReceiptFilename?: string;
  receiptStatus?: ReceiptStatus;
  onUploadComplete: (result: UploadResult) => void;
  onDeleteComplete: () => void;
  onStatusChange: (status: ReceiptStatus) => void;
  disabled?: boolean;
}

export const ReceiptUpload: React.FC<ReceiptUploadProps> = ({
  transactionId,
  userId,
  currentReceiptUrl,
  currentReceiptFilename,
  receiptStatus,
  onUploadComplete,
  onDeleteComplete,
  onStatusChange,
  disabled = false,
}) => {
  const [isUploading, setIsUploading] = useState(false);
  const [uploadProgress, setUploadProgress] = useState(0);
  const [error, setError] = useState<string | null>(null);
  const [isDragging, setIsDragging] = useState(false);
  const fileInputRef = useRef<HTMLInputElement>(null);

  const handleFileSelect = useCallback(
    async (file: File) => {
      setError(null);

      // Validar arquivo
      const validationError = validateFile(file);
      if (validationError) {
        setError(validationError.message);
        return;
      }

      setIsUploading(true);
      setUploadProgress(0);

      try {
        // Simular progresso (Firebase não fornece progresso real para uploadBytes)
        const progressInterval = setInterval(() => {
          setUploadProgress((prev) => Math.min(prev + 10, 90));
        }, 100);

        // Timeout de 30 segundos para evitar travamento eterno
        const uploadPromise = uploadReceipt(file, userId, transactionId);
        const timeoutPromise = new Promise<never>((_, reject) => {
          setTimeout(() => {
            reject({
              code: 'upload-timeout',
              message: 'O envio demorou muito. Verifique sua conexão.'
            });
          }, 30000);
        });

        const result = await Promise.race([uploadPromise, timeoutPromise]);

        clearInterval(progressInterval);
        setUploadProgress(100);

        onUploadComplete(result);
        onStatusChange(ReceiptStatus.ATTACHED);

        // Reset após sucesso
        setTimeout(() => {
          setUploadProgress(0);
        }, 500);
      } catch (err) {
        // Limpar intervalo em caso de erro
        // @ts-ignore
        if (typeof progressInterval !== 'undefined') clearInterval(progressInterval);

        const uploadError = err as UploadError;
        console.error('Erro upload:', err);
        setError(uploadError.message || 'Erro ao enviar arquivo');
      } finally {
        setIsUploading(false);
      }
    },
    [userId, transactionId, onUploadComplete, onStatusChange]
  );

  const handleInputChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (file) {
      handleFileSelect(file);
    }
    // Reset input para permitir selecionar o mesmo arquivo novamente
    e.target.value = '';
  };

  const handleDragOver = (e: React.DragEvent) => {
    e.preventDefault();
    if (!disabled && !isUploading) {
      setIsDragging(true);
    }
  };

  const handleDragLeave = (e: React.DragEvent) => {
    e.preventDefault();
    setIsDragging(false);
  };

  const handleDrop = (e: React.DragEvent) => {
    e.preventDefault();
    setIsDragging(false);

    if (disabled || isUploading) return;

    const file = e.dataTransfer.files?.[0];
    if (file) {
      handleFileSelect(file);
    }
  };

  const handleDelete = async () => {
    if (!currentReceiptUrl) return;

    const confirmDelete = window.confirm(
      'Tem certeza que deseja excluir o comprovante?'
    );
    if (!confirmDelete) return;

    try {
      await deleteReceipt(currentReceiptUrl);
      onDeleteComplete();
      onStatusChange(ReceiptStatus.HAS_BUT_NOT_ATTACHED);
    } catch (err) {
      setError('Erro ao excluir comprovante');
    }
  };

  const openReceipt = () => {
    if (currentReceiptUrl) {
      window.open(currentReceiptUrl, '_blank');
    }
  };

  // Se já tem comprovante anexado
  if (currentReceiptUrl && receiptStatus === ReceiptStatus.ATTACHED) {
    return (
      <div className="border border-green-200 dark:border-green-800 rounded-lg p-3 bg-green-50 dark:bg-green-900/20">
        <div className="flex items-center justify-between">
          <div className="flex items-center gap-2 min-w-0">
            {/* Ícone baseado no tipo de arquivo */}
            {currentReceiptFilename && isImageFile(currentReceiptFilename) ? (
              <svg
                className="w-5 h-5 text-green-600 dark:text-green-400 flex-shrink-0"
                fill="none"
                stroke="currentColor"
                viewBox="0 0 24 24"
              >
                <path
                  strokeLinecap="round"
                  strokeLinejoin="round"
                  strokeWidth={2}
                  d="M4 16l4.586-4.586a2 2 0 012.828 0L16 16m-2-2l1.586-1.586a2 2 0 012.828 0L20 14m-6-6h.01M6 20h12a2 2 0 002-2V6a2 2 0 00-2-2H6a2 2 0 00-2 2v12a2 2 0 002 2z"
                />
              </svg>
            ) : isPdfFile(currentReceiptFilename || '') ? (
              <svg
                className="w-5 h-5 text-red-600 dark:text-red-400 flex-shrink-0"
                fill="none"
                stroke="currentColor"
                viewBox="0 0 24 24"
              >
                <path
                  strokeLinecap="round"
                  strokeLinejoin="round"
                  strokeWidth={2}
                  d="M7 21h10a2 2 0 002-2V9.414a1 1 0 00-.293-.707l-5.414-5.414A1 1 0 0012.586 3H7a2 2 0 00-2 2v14a2 2 0 002 2z"
                />
              </svg>
            ) : (
              <svg
                className="w-5 h-5 text-gray-600 dark:text-gray-400 flex-shrink-0"
                fill="none"
                stroke="currentColor"
                viewBox="0 0 24 24"
              >
                <path
                  strokeLinecap="round"
                  strokeLinejoin="round"
                  strokeWidth={2}
                  d="M9 12h6m-6 4h6m2 5H7a2 2 0 01-2-2V5a2 2 0 012-2h5.586a1 1 0 01.707.293l5.414 5.414a1 1 0 01.293.707V19a2 2 0 01-2 2z"
                />
              </svg>
            )}
            <span className="text-sm text-green-700 dark:text-green-300 truncate">
              {currentReceiptFilename || 'Comprovante anexado'}
            </span>
          </div>
          <div className="flex items-center gap-1 flex-shrink-0">
            <button
              onClick={openReceipt}
              className="p-1.5 text-green-600 hover:bg-green-100 dark:hover:bg-green-800 rounded"
              title="Ver comprovante"
            >
              <svg
                className="w-4 h-4"
                fill="none"
                stroke="currentColor"
                viewBox="0 0 24 24"
              >
                <path
                  strokeLinecap="round"
                  strokeLinejoin="round"
                  strokeWidth={2}
                  d="M15 12a3 3 0 11-6 0 3 3 0 016 0z"
                />
                <path
                  strokeLinecap="round"
                  strokeLinejoin="round"
                  strokeWidth={2}
                  d="M2.458 12C3.732 7.943 7.523 5 12 5c4.478 0 8.268 2.943 9.542 7-1.274 4.057-5.064 7-9.542 7-4.477 0-8.268-2.943-9.542-7z"
                />
              </svg>
            </button>
            {!disabled && (
              <button
                onClick={handleDelete}
                className="p-1.5 text-red-600 hover:bg-red-100 dark:hover:bg-red-900/40 rounded"
                title="Excluir comprovante"
              >
                <svg
                  className="w-4 h-4"
                  fill="none"
                  stroke="currentColor"
                  viewBox="0 0 24 24"
                >
                  <path
                    strokeLinecap="round"
                    strokeLinejoin="round"
                    strokeWidth={2}
                    d="M19 7l-.867 12.142A2 2 0 0116.138 21H7.862a2 2 0 01-1.995-1.858L5 7m5 4v6m4-6v6m1-10V4a1 1 0 00-1-1h-4a1 1 0 00-1 1v3M4 7h16"
                  />
                </svg>
              </button>
            )}
          </div>
        </div>
      </div>
    );
  }

  // Área de upload
  return (
    <div className="space-y-2">
      <input
        ref={fileInputRef}
        type="file"
        accept="image/jpeg,image/png,image/gif,image/webp,application/pdf"
        onChange={handleInputChange}
        className="hidden"
        disabled={disabled || isUploading}
      />

      <div
        onDragOver={handleDragOver}
        onDragLeave={handleDragLeave}
        onDrop={handleDrop}
        onClick={() => !disabled && !isUploading && fileInputRef.current?.click()}
        className={`
          border-2 border-dashed rounded-lg p-4 text-center cursor-pointer
          transition-colors duration-200
          ${isDragging
            ? 'border-indigo-500 bg-indigo-50 dark:bg-indigo-900/20'
            : 'border-gray-300 dark:border-gray-600 hover:border-indigo-400 dark:hover:border-indigo-500'
          }
          ${disabled || isUploading ? 'opacity-50 cursor-not-allowed' : ''}
        `}
      >
        {isUploading ? (
          <div className="space-y-2">
            <div className="w-full bg-gray-200 dark:bg-gray-700 rounded-full h-2">
              <div
                className="bg-indigo-600 h-2 rounded-full transition-all duration-200"
                style={{ width: `${uploadProgress}%` }}
              />
            </div>
            <p className="text-sm text-gray-500">Enviando...</p>
          </div>
        ) : (
          <>
            <svg
              className="mx-auto h-8 w-8 text-gray-400"
              fill="none"
              stroke="currentColor"
              viewBox="0 0 24 24"
            >
              <path
                strokeLinecap="round"
                strokeLinejoin="round"
                strokeWidth={2}
                d="M7 16a4 4 0 01-.88-7.903A5 5 0 1115.9 6L16 6a5 5 0 011 9.9M15 13l-3-3m0 0l-3 3m3-3v12"
              />
            </svg>
            <p className="mt-1 text-sm text-gray-600 dark:text-gray-400">
              Arraste um arquivo ou clique para selecionar
            </p>
            <p className="text-xs text-gray-500 dark:text-gray-500">
              JPEG, PNG, GIF, WebP ou PDF (máx. 10MB)
            </p>
          </>
        )}
      </div>

      {error && (
        <p className="text-sm text-red-600 dark:text-red-400">{error}</p>
      )}
    </div>
  );
};

export default ReceiptUpload;
