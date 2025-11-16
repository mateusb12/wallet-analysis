import React, { useState } from 'react';
import { getIpcaRange, calculateAccumulatedFactor, correctValue } from '../services/ipcaService.js';
import IpcaChart from '../components/IpcaChart.jsx';
import DatePicker from 'react-datepicker';

import 'react-datepicker/dist/react-datepicker.css';

const formatCurrency = (num) =>
  new Intl.NumberFormat('pt-BR', {
    style: 'currency',
    currency: 'BRL',
  }).format(num);

const formatDate = (date) => {
  return new Intl.DateTimeFormat('pt-BR', {
    month: 'short',
    year: 'numeric',
    timeZone: 'UTC',
  }).format(date);
};

const parseUTCDate = (dateString) => {
  const [year, month, day] = dateString.split('-').map(Number);
  return new Date(Date.UTC(year, month - 1, day));
};

function IpcaCalculator() {
  const [initialValue, setInitialValue] = useState('1000');
  const [startDate, setStartDate] = useState(new Date('2000-01-01T12:00:00Z'));
  const [endDate, setEndDate] = useState(new Date('2023-12-01T12:00:00Z'));

  const [loading, setLoading] = useState(false);
  const [error, setError] = useState(null);
  const [chartData, setChartData] = useState([]);
  const [summaryData, setSummaryData] = useState(null);

  const handleCalculate = async (e) => {
    e.preventDefault();
    setLoading(true);
    setError(null);
    setChartData([]);
    setSummaryData(null);

    try {
      const value = parseFloat(initialValue);
      if (isNaN(value) || value < 0) {
        throw new Error('O valor a corrigir deve ser um número positivo.');
      }
      if (!startDate || !endDate) {
        throw new Error('Por favor, preencha a data inicial e final.');
      }
      if (endDate < startDate) {
        throw new Error('A data final deve ser maior ou igual à data inicial.');
      }

      const startYear = startDate.getUTCFullYear();
      const startMonth = startDate.getUTCMonth() + 1;
      const endYear = endDate.getUTCFullYear();
      const endMonth = endDate.getUTCMonth() + 1;

      const ipcaSeries = await getIpcaRange(startYear, startMonth, endYear, endMonth);

      if (!ipcaSeries || ipcaSeries.length === 0) {
        throw new Error('Não foram encontrados dados do IPCA para o período selecionado.');
      }

      let newChartData = [];
      let currentValue = value;
      let accumulatedFactor = 1;
      const startDateObj = startDate;

      newChartData.push({
        month: formatDate(startDateObj),
        correctedValue: currentValue,
        ipca: 0,
      });

      for (const row of ipcaSeries) {
        const monthlyIpca = parseFloat(row.ipca);
        if (isNaN(monthlyIpca)) {
          console.warn(`IPCA inválido para ${row.ref_date}: ${row.ipca}`);
          continue;
        }

        const monthlyFactor = 1 + monthlyIpca / 100;
        currentValue = currentValue * monthlyFactor;
        accumulatedFactor = accumulatedFactor * monthlyFactor;

        const dateObj = parseUTCDate(row.ref_date);

        newChartData.push({
          month: formatDate(dateObj),
          correctedValue: currentValue,
          ipca: monthlyIpca,
        });
      }

      setChartData(newChartData);
      setSummaryData({
        initialValue: value,
        correctedValue: currentValue,
        accumulatedFactor: accumulatedFactor,
        startDate: formatDate(startDateObj),
        endDate: formatDate(parseUTCDate(ipcaSeries[ipcaSeries.length - 1].ref_date)),
      });
    } catch (err) {
      console.error(err);
      setError(err.message || 'Erro ao calcular a correção.');
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className="p-8">
      <h2 className="text-3xl font-bold mb-6 text-gray-800">Calculadora de Correção (IPCA)</h2>

      <div className="border border-gray-500 bg-white rounded-lg shadow-md p-6 max-w-2xl mb-8">
        <form onSubmit={handleCalculate} className="space-y-4">
          <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
            <div>
              <label
                htmlFor="initial-value"
                className="block text-sm font-medium text-gray-700 mb-2"
              >
                Valor a Corrigir (R$)
              </label>
              <input
                type="number"
                id="initial-value"
                value={initialValue}
                onChange={(e) => setInitialValue(e.target.value)}
                disabled={loading}
                className="w-full px-4 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500"
                placeholder="1000"
                step="0.01"
              />
            </div>

            {}
            <div className="relative z-20">
              <label htmlFor="start-date" className="block text-sm font-medium text-gray-700 mb-2">
                Data Inicial
              </label>
              <DatePicker
                id="start-date"
                selected={startDate}
                onChange={(date) => setStartDate(date)}
                dateFormat="yyyy-MM"
                showMonthYearPicker
                disabled={loading}
                className="w-full px-4 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500"
              />
            </div>

            {}
            <div className="relative z-10">
              <label htmlFor="end-date" className="block text-sm font-medium text-gray-700 mb-2">
                Data Final
              </label>
              <DatePicker
                id="end-date"
                selected={endDate}
                onChange={(date) => setEndDate(date)}
                dateFormat="yyyy-MM"
                showMonthYearPicker
                disabled={loading}
                className="w-full px-4 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500"
                showMonthYearDropdown={true}
              />
            </div>

            {}
          </div>

          <button
            type="submit"
            disabled={loading}
            className="w-full bg-blue-600 hover:bg-blue-700 text-white font-semibold py-3 px-4 rounded-lg transition-colors duration-200 disabled:opacity-50"
          >
            {loading ? 'Calculando...' : 'Calcular Correção'}
          </button>
        </form>
      </div>

      <div className="space-y-8">
        {loading && <p className="text-gray-500 text-lg">Carregando cálculo...</p>}

        {error && <p className="mt-6 p-4 rounded-lg text-red-700 bg-red-100">{error}</p>}

        {summaryData && !loading && (
          <div className="border border-gray-300 bg-white rounded-lg shadow-lg p-6">
            <h3 className="text-2xl font-bold mb-4 text-gray-800">
              Resultado da Correção
              <span className="text-lg font-normal text-gray-600 ml-2">
                ({summaryData.startDate} a {summaryData.endDate})
              </span>
            </h3>
            <div className="grid grid-cols-1 md:grid-cols-3 gap-6">
              <div className="bg-gray-100 p-4 rounded-lg">
                <h4 className="text-sm font-semibold text-gray-600 uppercase mb-2">
                  Valor Inicial
                </h4>
                <p className="text-2xl font-bold text-gray-900">
                  {formatCurrency(summaryData.initialValue)}
                </p>
              </div>
              <div className="bg-blue-50 p-4 rounded-lg border border-blue-200">
                <h4 className="text-sm font-semibold text-blue-700 uppercase mb-2">
                  Fator de Correção
                </h4>
                <p className="text-2xl font-bold text-blue-800">
                  {summaryData.accumulatedFactor.toFixed(6)}
                </p>
              </div>
              <div className="bg-green-50 p-4 rounded-lg border border-green-200">
                <h4 className="text-sm font-semibold text-green-700 uppercase mb-2">
                  Valor Final Corrigido
                </h4>
                <p className="text-2xl font-bold text-green-800">
                  {formatCurrency(summaryData.correctedValue)}
                </p>
              </div>
            </div>
          </div>
        )}

        {chartData.length > 1 && !loading && (
          <div className="border border-gray-300 bg-white rounded-lg shadow-lg p-6 space-y-6">
            <h3 className="text-2xl font-bold pt-4 text-gray-800">
              Evolução do Valor Corrigido vs. IPCA Mensal
            </h3>
            <div className="-mx-6 mt-4 mb-2">
              <IpcaChart data={chartData} />
            </div>
          </div>
        )}
      </div>
    </div>
  );
}

export default IpcaCalculator;
