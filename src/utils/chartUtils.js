import { useState, useEffect } from 'react';

export const useMediaQuery = (query) => {
  const [matches, setMatches] = useState(() =>
    typeof window !== 'undefined' ? window.matchMedia(query).matches : false
  );

  useEffect(() => {
    if (typeof window === 'undefined') {
      return;
    }
    const media = window.matchMedia(query);
    if (media.matches !== matches) {
      setMatches(media.matches);
    }
    const listener = () => {
      setMatches(media.matches);
    };
    media.addEventListener('change', listener);
    return () => media.removeEventListener('change', listener);
  }, [matches, query]);

  return matches;
};

export const formatCurrency = (value) =>
  new Intl.NumberFormat('pt-BR', {
    style: 'currency',
    currency: 'BRL',
  }).format(value);

export const formatCurrencyMobile = (value) => {
  if (value === 0) return 'R$\u00A00';
  if (Math.abs(value) >= 1000000) {
    const formattedValue = (value / 1000000).toLocaleString('pt-BR', {
      maximumFractionDigits: 1,
    });
    return `R$\u00A0${formattedValue}M`;
  }
  if (Math.abs(value) >= 1000) {
    const formattedValue = (value / 1000).toLocaleString('pt-BR', {
      maximumFractionDigits: 1,
    });
    return `R$\u00A0${formattedValue}k`;
  }
  return new Intl.NumberFormat('pt-BR', {
    style: 'currency',
    currency: 'BRL',
    maximumFractionDigits: 0,
  }).format(value);
};

export const tooltipFormatter = (value, name) => {
  const formattedValue = formatCurrency(value);
  let formattedName = name;
  if (name === 'price') formattedName = 'Preço';

  return [formattedValue, formattedName];
};
