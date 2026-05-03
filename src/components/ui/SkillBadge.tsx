'use client';

import { cn } from '@/lib/utils';

interface SkillBadgeProps {
  skill: string;
  variant?: 'default' | 'primary' | 'outline';
  size?: 'sm' | 'md';
  className?: string;
}

export function SkillBadge({ skill, variant = 'default', size = 'sm', className }: SkillBadgeProps) {
  const variantClasses = {
    default: 'bg-gray-100 text-gray-700 hover:bg-gray-200',
    primary: 'bg-cdata-yellow/20 text-cdata-black hover:bg-cdata-yellow/30',
    outline: 'bg-transparent border border-gray-300 text-gray-600 hover:border-cdata-yellow',
  };

  const sizeClasses = {
    sm: 'px-2 py-0.5 text-xs',
    md: 'px-3 py-1 text-sm',
  };

  return (
    <span
      className={cn(
        'rounded-full font-medium transition-colors inline-flex items-center',
        variantClasses[variant],
        sizeClasses[size],
        className
      )}
    >
      {skill}
    </span>
  );
}

interface SkillBadgeListProps {
  skills: string | string[];
  maxVisible?: number;
  variant?: 'default' | 'primary' | 'outline';
  size?: 'sm' | 'md';
  className?: string;
}

export function SkillBadgeList({
  skills,
  maxVisible = 5,
  variant = 'default',
  size = 'sm',
  className,
}: SkillBadgeListProps) {
  // Parse skills - handle pipe-delimited string or array
  const skillArray = typeof skills === 'string'
    ? skills.split('|').map((s) => s.trim()).filter(Boolean)
    : skills.filter(Boolean);

  const visibleSkills = skillArray.slice(0, maxVisible);
  const remainingCount = skillArray.length - maxVisible;

  return (
    <div className={cn('flex flex-wrap gap-1.5', className)}>
      {visibleSkills.map((skill, index) => (
        <SkillBadge key={`${skill}-${index}`} skill={skill} variant={variant} size={size} />
      ))}
      {remainingCount > 0 && (
        <span
          className={cn(
            'rounded-full font-medium bg-cdata-navy text-white cursor-default',
            size === 'sm' ? 'px-2 py-0.5 text-xs' : 'px-3 py-1 text-sm'
          )}
          title={skillArray.slice(maxVisible).join(', ')}
        >
          +{remainingCount}
        </span>
      )}
    </div>
  );
}
