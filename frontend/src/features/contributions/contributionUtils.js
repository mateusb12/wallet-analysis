export const getDetailedTimeElapsed = (dateString) => {
  if (!dateString) return { short: '-', long: '-' };
  const start = new Date(dateString);
  const end = new Date();
  start.setHours(0, 0, 0, 0);
  end.setHours(0, 0, 0, 0);

  let years = end.getFullYear() - start.getFullYear();
  let months = end.getMonth() - start.getMonth();
  let days = end.getDate() - start.getDate();

  if (days < 0) {
    months--;
    const prevMonth = new Date(end.getFullYear(), end.getMonth(), 0);
    days += prevMonth.getDate();
  }
  if (months < 0) {
    years--;
    months += 12;
  }

  const partsShort = [];
  if (years > 0) partsShort.push(`${years}a`);
  if (months > 0) partsShort.push(`${months}m`);
  if (days > 0 && years === 0) partsShort.push(`${days}d`);
  else if (days > 0 && years > 0 && months === 0) partsShort.push(`${days}d`);

  if (partsShort.length === 0) return { short: 'Hoje', long: 'Menos de 24h' };

  return { short: partsShort.join(' '), long: '' };
};

export const getTypeColor = (type) => {
  switch (type) {
    case 'stock':
      return 'bg-blue-100 text-blue-800 dark:bg-blue-900/30 dark:text-blue-300';
    case 'fii':
      return 'bg-purple-100 text-purple-800 dark:bg-purple-900/30 dark:text-purple-300';
    case 'etf':
      return 'bg-orange-100 text-orange-800 dark:bg-orange-900/30 dark:text-orange-300';
    default:
      return 'bg-gray-100 text-gray-800 dark:bg-gray-800 dark:text-gray-300';
  }
};
