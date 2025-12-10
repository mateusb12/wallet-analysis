export const formatChartDate = (dateInput) => {
  if (!dateInput) return '';

  let date;

  if (typeof dateInput === 'string' && dateInput.includes('-')) {
    const [year, month, day] = dateInput.split('-').map(Number);
    date = new Date(year, month - 1, day);
  } else {
    date = new Date(dateInput);
  }

  if (isNaN(date.getTime())) return dateInput;

  const day = String(date.getDate()).padStart(2, '0');

  const month = date.toLocaleString('pt-BR', { month: 'short' }).replace('.', '');
  const year = String(date.getFullYear()).slice(2);

  return `${day}/${month}/${year}`;
};

export const formatFullDate = (dateInput) => {
  if (!dateInput) return '';

  const date = new Date(dateInput);
  return new Intl.DateTimeFormat('pt-BR', { timeZone: 'UTC' }).format(date);
};
