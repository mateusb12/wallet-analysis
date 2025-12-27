export const formatChartDate = (dateInput) => {
  if (!dateInput) return '';

  let date;

  if (dateInput instanceof Date) {
    date = dateInput;
  } else if (typeof dateInput === 'string' && /^\d{4}-\d{2}-\d{2}/.test(dateInput)) {
    const [year, month, day] = dateInput.slice(0, 10).split('-').map(Number);
    date = new Date(year, month - 1, day);
  } else if (typeof dateInput === 'string' && /^\d{2}\/\d{2}\/\d{4}$/.test(dateInput)) {
    const [day, month, year] = dateInput.split('/').map(Number);
    date = new Date(year, month - 1, day);
  } else if (typeof dateInput === 'number') {
    date = new Date(dateInput);
  } else {
    date = new Date(dateInput);
  }

  if (isNaN(date.getTime())) return dateInput;

  const day = String(date.getDate()).padStart(2, '0');
  const month = date.toLocaleString('pt-BR', { month: 'short' }).replace('.', '').toLowerCase();
  const year = String(date.getFullYear()).slice(2);

  return `${day}/${month}/${year}`;
};

export const formatFullDate = (dateInput) => {
  if (!dateInput) return '';

  const date = new Date(dateInput);
  return new Intl.DateTimeFormat('pt-BR', { timeZone: 'UTC' }).format(date);
};
