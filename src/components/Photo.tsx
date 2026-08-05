'use client';

import Image from 'next/image';
import { useState } from 'react';
import { imagenes } from '@/data';

const BLUR =
  'data:image/svg+xml;base64,' +
  Buffer.from(
    '<svg xmlns="http://www.w3.org/2000/svg" width="8" height="8"><rect width="8" height="8" fill="#12121A"/></svg>'
  ).toString('base64');

type Props = {
  src: string;
  alt: string;
  sizes?: string;
  priority?: boolean;
  className?: string;
  treat?: boolean;
};

export default function Photo({
  src,
  alt,
  sizes = '100vw',
  priority = false,
  className = '',
  treat = true,
}: Props) {
  const [source, setSource] = useState(src);

  return (
    <Image
      src={source}
      alt={alt}
      fill
      sizes={sizes}
      priority={priority}
      loading={priority ? undefined : 'lazy'}
      placeholder="blur"
      blurDataURL={BLUR}
      onError={() => setSource(imagenes.fallback)}
      className={`object-cover ${treat ? 'photo-treat' : ''} ${className}`}
    />
  );
}
