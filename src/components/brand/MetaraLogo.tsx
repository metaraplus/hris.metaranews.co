import React from 'react';

interface MetaraLogoProps {
  className?: string;
  size?: 'sm' | 'md' | 'lg' | 'xl';
}

export const MetaraLogo: React.FC<MetaraLogoProps> = ({
  className = '',
  size = 'md',
}) => {
  const sizeClasses = {
    sm: 'w-10 h-10',
    md: 'w-14 h-14',
    lg: 'w-24 h-24 sm:w-28 sm:h-28',
    xl: 'w-28 h-28 sm:w-32 sm:h-32',
  }[size];

  return (
    <div className={`relative inline-flex items-center justify-center shrink-0 ${className}`}>
      <img
        src="/logo-metara.png"
        alt="Logo Metara"
        className={`${sizeClasses} object-contain rounded-full shadow-md bg-white`}
        onError={(e) => {
          const target = e.currentTarget;
          target.onerror = null;
          target.src = '/src/assets/images/metara_circular_badge_1790953093074.jpg';
        }}
      />
    </div>
  );
};
