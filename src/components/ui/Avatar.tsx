'use client';

import { useState } from 'react';
import { cn } from '@/lib/utils';

interface AvatarProps {
  candidateId: string;
  name: string;
  size?: 'sm' | 'md' | 'lg' | 'xl';
  className?: string;
}

const sizeClasses = {
  sm: 'w-8 h-8 text-xs',
  md: 'w-12 h-12 text-sm',
  lg: 'w-16 h-16 text-lg',
  xl: 'w-24 h-24 text-2xl',
};

export function Avatar({ candidateId, name, size = 'md', className }: AvatarProps) {
  const [imageError, setImageError] = useState(false);

  // Generate DiceBear Notionists avatar URL
  const avatarUrl = `https://api.dicebear.com/7.x/notionists/svg?seed=${encodeURIComponent(candidateId || name)}&backgroundColor=ffd54f,ffecb3,fff9c4`;

  // Fallback initials
  const initials = name
    .split(' ')
    .map((n) => n[0])
    .join('')
    .toUpperCase()
    .slice(0, 2);

  if (imageError) {
    return (
      <div
        className={cn(
          'rounded-full bg-gradient-to-br from-cdata-yellow to-yellow-400 flex items-center justify-center font-semibold text-cdata-black flex-shrink-0',
          sizeClasses[size],
          className
        )}
      >
        {initials}
      </div>
    );
  }

  return (
    <img
      src={avatarUrl}
      alt={name}
      onError={() => setImageError(true)}
      className={cn(
        'rounded-full bg-cdata-yellow/20 flex-shrink-0 object-cover',
        sizeClasses[size],
        className
      )}
    />
  );
}
