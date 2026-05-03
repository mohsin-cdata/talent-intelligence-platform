'use client';

import { useState, useRef, useEffect } from 'react';
import { Pencil, Check, X, Loader2 } from 'lucide-react';
import { cn } from '@/lib/utils';
import { useAppStore } from '@/lib/store';
import {
  generateMutationId,
  buildUpdateSQL,
  executeMutation,
  assessRisk,
  type PendingMutation,
} from '@/lib/mutation-manager';

interface EditableFieldProps {
  value: string;
  field: string;
  idField: string;
  idValue: string;
  fullyQualifiedTable: string;
  displayLabel?: string;
  type?: 'text' | 'select';
  options?: string[];       // for select type
  className?: string;
  onOptimisticUpdate?: (newValue: string) => void;
  onRollback?: (oldValue: string) => void;
}

export function EditableField({
  value,
  field,
  idField,
  idValue,
  fullyQualifiedTable,
  displayLabel,
  type = 'text',
  options,
  className,
  onOptimisticUpdate,
  onRollback,
}: EditableFieldProps) {
  const [isEditing, setIsEditing] = useState(false);
  const [editValue, setEditValue] = useState(value);
  const [isSaving, setIsSaving] = useState(false);
  const inputRef = useRef<HTMLInputElement | HTMLSelectElement>(null);
  const { addPendingMutation, updatePendingMutation } = useAppStore();

  useEffect(() => {
    if (isEditing && inputRef.current) {
      inputRef.current.focus();
      if (type === 'text' && inputRef.current instanceof HTMLInputElement) {
        inputRef.current.select();
      }
    }
  }, [isEditing, type]);

  const handleSave = async () => {
    if (editValue === value) {
      setIsEditing(false);
      return;
    }

    const sql = buildUpdateSQL(fullyQualifiedTable, field, editValue, idField, idValue);
    const risk = assessRisk(sql);
    const mutationId = generateMutationId();

    const mutation: PendingMutation = {
      id: mutationId,
      sql,
      description: `Update ${field} to "${editValue}"`,
      table: fullyQualifiedTable,
      recordId: idValue,
      field,
      oldValue: value,
      newValue: editValue,
      status: 'executing',
      riskLevel: risk,
      createdAt: Date.now(),
    };

    // Optimistic update
    addPendingMutation(mutation);
    onOptimisticUpdate?.(editValue);
    setIsEditing(false);
    setIsSaving(true);

    try {
      const result = await executeMutation(mutation);

      if (result.success) {
        updatePendingMutation(mutationId, {
          status: 'success',
          resolvedAt: Date.now(),
          rowsAffected: result.rowsAffected,
        });
      } else {
        // Rollback
        updatePendingMutation(mutationId, {
          status: 'failed',
          resolvedAt: Date.now(),
          error: result.error,
        });
        onRollback?.(value);
        setEditValue(value);
      }
    } catch (err) {
      updatePendingMutation(mutationId, {
        status: 'failed',
        resolvedAt: Date.now(),
        error: err instanceof Error ? err.message : 'Unknown error',
      });
      onRollback?.(value);
      setEditValue(value);
    } finally {
      setIsSaving(false);
    }
  };

  const handleCancel = () => {
    setEditValue(value);
    setIsEditing(false);
  };

  const handleKeyDown = (e: React.KeyboardEvent) => {
    if (e.key === 'Enter') handleSave();
    if (e.key === 'Escape') handleCancel();
  };

  if (isSaving) {
    return (
      <span className={cn('inline-flex items-center gap-1 text-gray-400', className)}>
        <Loader2 className="w-3 h-3 animate-spin" />
        {editValue}
      </span>
    );
  }

  if (isEditing) {
    return (
      <span className={cn('inline-flex items-center gap-1', className)}>
        {type === 'select' && options ? (
          <select
            ref={inputRef as React.RefObject<HTMLSelectElement>}
            value={editValue}
            onChange={(e) => setEditValue(e.target.value)}
            onBlur={handleSave}
            onKeyDown={handleKeyDown}
            className="px-2 py-0.5 text-sm border border-cdata-yellow rounded bg-white focus:outline-none focus:ring-1 focus:ring-cdata-yellow"
          >
            {options.map(opt => (
              <option key={opt} value={opt}>{opt}</option>
            ))}
          </select>
        ) : (
          <input
            ref={inputRef as React.RefObject<HTMLInputElement>}
            type="text"
            value={editValue}
            onChange={(e) => setEditValue(e.target.value)}
            onKeyDown={handleKeyDown}
            className="px-2 py-0.5 text-sm border border-cdata-yellow rounded bg-white focus:outline-none focus:ring-1 focus:ring-cdata-yellow min-w-[60px]"
          />
        )}
        <button onClick={handleSave} className="p-0.5 hover:bg-green-100 rounded" title="Save">
          <Check className="w-3.5 h-3.5 text-green-600" />
        </button>
        <button onClick={handleCancel} className="p-0.5 hover:bg-red-100 rounded" title="Cancel">
          <X className="w-3.5 h-3.5 text-red-500" />
        </button>
      </span>
    );
  }

  return (
    <span
      className={cn(
        'group inline-flex items-center gap-1 cursor-pointer hover:bg-cdata-yellow/10 rounded px-1 -mx-1 transition-colors',
        className
      )}
      onClick={() => setIsEditing(true)}
      title={displayLabel ? `Edit ${displayLabel}` : `Edit ${field}`}
    >
      {value || <span className="text-gray-400 italic">empty</span>}
      <Pencil className="w-3 h-3 text-gray-300 opacity-0 group-hover:opacity-100 transition-opacity" />
    </span>
  );
}
