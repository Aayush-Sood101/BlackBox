'use client';

import { useCallback, useState } from 'react';
import { useDropzone, FileRejection } from 'react-dropzone';
import { Upload, File, X, AlertCircle } from 'lucide-react';

interface FileUploadProps {
  onFileSelect: (file: File | null) => void;
  selectedFile: File | null;
  disabled?: boolean;
}

export function FileUpload({ onFileSelect, selectedFile, disabled }: FileUploadProps) {
  const [error, setError] = useState<string | null>(null);

  const onDrop = useCallback((acceptedFiles: File[], rejectedFiles: FileRejection[]) => {
    setError(null);
    
    if (rejectedFiles.length > 0) {
      const rejection = rejectedFiles[0];
      if (rejection.errors[0]?.code === 'file-invalid-type') {
        setError('Only .exe files are allowed');
      } else if (rejection.errors[0]?.code === 'file-too-large') {
        setError('File is too large (max 10MB)');
      } else {
        setError('Invalid file');
      }
      return;
    }

    if (acceptedFiles.length > 0) {
      onFileSelect(acceptedFiles[0]);
    }
  }, [onFileSelect]);

  const { getRootProps, getInputProps, isDragActive } = useDropzone({
    onDrop,
    accept: {
      'application/x-msdownload': ['.exe'],
      'application/x-msdos-program': ['.exe'],
      'application/octet-stream': ['.exe'],
    },
    maxSize: 10 * 1024 * 1024, // 10MB
    multiple: false,
    disabled,
  });

  const removeFile = () => {
    onFileSelect(null);
    setError(null);
  };

  return (
    <div className="w-full">
      <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-2">
        Executable File
      </label>
      
      {selectedFile ? (
        <div className="flex items-center justify-between p-4 border-2 border-green-300 dark:border-green-700 bg-green-50 dark:bg-green-900/20 rounded-lg">
          <div className="flex items-center gap-3">
            <File className="w-8 h-8 text-green-600 dark:text-green-400" />
            <div>
              <p className="font-medium text-gray-900 dark:text-white">{selectedFile.name}</p>
              <p className="text-sm text-gray-500 dark:text-gray-400">
                {(selectedFile.size / 1024).toFixed(1)} KB
              </p>
            </div>
          </div>
          <button
            onClick={removeFile}
            disabled={disabled}
            className="p-2 hover:bg-green-100 dark:hover:bg-green-800 rounded-full transition-colors disabled:opacity-50"
          >
            <X className="w-5 h-5 text-gray-500 dark:text-gray-400" />
          </button>
        </div>
      ) : (
        <div
          {...getRootProps()}
          className={`
            flex flex-col items-center justify-center p-8 border-2 border-dashed rounded-lg cursor-pointer transition-colors
            ${isDragActive 
              ? 'border-blue-500 bg-blue-50 dark:bg-blue-900/20' 
              : 'border-gray-300 dark:border-gray-600 hover:border-gray-400 dark:hover:border-gray-500'
            }
            ${disabled ? 'opacity-50 cursor-not-allowed' : ''}
          `}
        >
          <input {...getInputProps()} />
          <Upload className={`w-12 h-12 mb-4 ${isDragActive ? 'text-blue-500' : 'text-gray-400'}`} />
          {isDragActive ? (
            <p className="text-blue-600 dark:text-blue-400 font-medium">Drop the file here...</p>
          ) : (
            <>
              <p className="text-gray-600 dark:text-gray-300 font-medium">
                Drag & drop your .exe file here
              </p>
              <p className="text-sm text-gray-500 dark:text-gray-400 mt-1">
                or click to browse (max 10MB)
              </p>
            </>
          )}
        </div>
      )}

      {error && (
        <div className="flex items-center gap-2 mt-2 text-red-600 dark:text-red-400">
          <AlertCircle className="w-4 h-4" />
          <span className="text-sm">{error}</span>
        </div>
      )}
    </div>
  );
}
