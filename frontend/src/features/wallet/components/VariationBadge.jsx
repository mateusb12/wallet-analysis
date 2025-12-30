import React from 'react';
import { ArrowUp, ArrowDown, Minus } from 'lucide-react';

const formatCurrency = (value) =>
  new Intl.NumberFormat('pt-BR', { style: 'currency', currency: 'BRL' }).format(value);

const formatPercent = (value) =>
  new Intl.NumberFormat('pt-BR', {
    style: 'percent',
    minimumFractionDigits: 2,
    maximumFractionDigits: 2,
  }).format(value / 100);

const VariationBadge = ({ value, isPercent = false }) => {
  const numValue = parseFloat(value);
  if (Math.abs(numValue) < 0.001) {
    return (
      <span className="text-gray-500 font-medium flex items-center">
        <Minus className="w-3 h-3 mr-1" />
        0,00{isPercent ? '%' : ''}
      </span>
    );
  }

  const isPositive = numValue > 0;
  const ColorClass = isPositive
    ? 'text-green-600 dark:text-green-400'
    : 'text-red-600 dark:text-red-400';
  const BgClass = isPositive
    ? 'bg-green-100 dark:bg-green-900/30'
    : 'bg-red-100 dark:bg-red-900/30';
  const Icon = isPositive ? ArrowUp : ArrowDown;

  return (
    <div
      className={`
      flex items-center justify-center gap-1 px-2 py-0.5 rounded-md min-w-[80px]
      ${BgClass} ${ColorClass}
      border border-solid
      ${isPositive ? 'border-green-500/40' : 'border-red-500/40'}
    `}
    >
      <Icon className="w-3 h-3" />
      <span className="font-bold text-xs">
        {isPercent ? formatPercent(numValue) : formatCurrency(numValue)}
      </span>
    </div>
  );
};

export default VariationBadge;
