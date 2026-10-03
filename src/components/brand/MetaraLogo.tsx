import React from 'react';

interface MetaraLogoProps {
  className?: string;
  size?: 'sm' | 'md' | 'lg' | 'xl';
  variant?: 'mark' | 'full';
}

export const MetaraLogo: React.FC<MetaraLogoProps> = ({
  className = '',
  size = 'md',
  variant = 'mark',
}) => {
  const sizeClasses = {
    sm: 'w-10 h-10',
    md: 'w-14 h-14',
    lg: 'w-24 h-24 sm:w-28 sm:h-28',
    xl: 'w-28 h-28 sm:w-32 sm:h-32',
  }[size];

  if (variant === 'full') {
    return (
      <div className={`relative inline-flex items-center justify-center shrink-0 ${className}`}>
        <img
          src="/logo-metara-tagline.png"
          alt="Metaranews - Setara Bercerita"
          className="h-10 sm:h-12 w-auto object-contain drop-shadow-sm"
          onError={(e) => {
            const target = e.currentTarget;
            target.onerror = null;
            target.src = '/logo-metara.png';
          }}
        />
      </div>
    );
  }

  return (
    <div className={`relative inline-flex items-center justify-center shrink-0 ${className}`}>
      <img
        src="/logo-metara.png"
        alt="Logo Metara"
        className={`${sizeClasses} object-contain rounded-2xl p-2 bg-white shadow-xl border border-white/20`}
        onError={(e) => {
          const target = e.currentTarget;
          target.onerror = null;
          target.src = '/logo-m.png';
        }}
      />
    </div>
  );
};
