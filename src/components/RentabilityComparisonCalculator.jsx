import { useState } from 'react';

function RentabilityComparisonCalculator() {
  const [amount, setAmount] = useState(10000);
  const [lciRate, setLciRate] = useState(4.5);
  const [cdbRate, setCdbRate] = useState(6.0);
  const [time, setTime] = useState(12);
  const [result, setResult] = useState(null);

  const calculateComparison = () => {
    const lciReturn = amount * (1 + (lciRate / 100) * (time / 12));
    const cdbReturn = amount * (1 + (cdbRate / 100) * (time / 12));
    
    const lciProfit = lciReturn - amount;
    const cdbProfit = cdbReturn - amount;
    const difference = cdbReturn - lciReturn;
    const betterOption = cdbReturn > lciReturn ? 'CDB' : 'LCI/LCAs';

    setResult({
      lci: {
        total: lciReturn.toFixed(2),
        profit: lciProfit.toFixed(2)
      },
      cdb: {
        total: cdbReturn.toFixed(2),
        profit: cdbProfit.toFixed(2)
      },
      difference: Math.abs(difference).toFixed(2),
      betterOption
    });
  };

  return (
    <div className="p-8">
      <h2 className="text-3xl font-bold mb-6 text-gray-800">Rentability Comparison Calculator</h2>
      <p className="text-gray-600 mb-6">Compare returns between LCI/LCAs and CDB investments</p>
      
      <div className="bg-white rounded-lg shadow-md p-6 max-w-2xl">
        <div className="space-y-4">
          <div>
            <label className="block text-sm font-medium text-gray-700 mb-2">
              Investment Amount ($)
            </label>
            <input
              type="number"
              value={amount}
              onChange={(e) => setAmount(Number(e.target.value))}
              className="w-full px-4 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-transparent"
              min="0"
              step="1000"
            />
          </div>

          <div>
            <label className="block text-sm font-medium text-gray-700 mb-2">
              LCI/LCAs Annual Rate (%)
            </label>
            <input
              type="number"
              value={lciRate}
              onChange={(e) => setLciRate(Number(e.target.value))}
              className="w-full px-4 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-green-500 focus:border-transparent"
              min="0"
              step="0.1"
            />
          </div>

          <div>
            <label className="block text-sm font-medium text-gray-700 mb-2">
              CDB Annual Rate (%)
            </label>
            <input
              type="number"
              value={cdbRate}
              onChange={(e) => setCdbRate(Number(e.target.value))}
              className="w-full px-4 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-purple-500 focus:border-transparent"
              min="0"
              step="0.1"
            />
          </div>

          <div>
            <label className="block text-sm font-medium text-gray-700 mb-2">
              Time Period (months)
            </label>
            <input
              type="number"
              value={time}
              onChange={(e) => setTime(Number(e.target.value))}
              className="w-full px-4 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-transparent"
              min="1"
              step="1"
            />
          </div>

          <button
            onClick={calculateComparison}
            className="w-full bg-blue-600 hover:bg-blue-700 text-white font-semibold py-3 px-4 rounded-lg transition-colors duration-200"
          >
            Compare Returns
          </button>
        </div>

        {result && (
          <div className="mt-6 space-y-4">
            <div className="p-4 bg-green-50 rounded-lg border-2 border-green-200">
              <h3 className="text-lg font-semibold text-green-800 mb-3">LCI/LCAs Results:</h3>
              <div className="space-y-1">
                <p className="text-gray-700">
                  <span className="font-medium">Total Amount:</span> ${result.lci.total}
                </p>
                <p className="text-gray-700">
                  <span className="font-medium">Profit:</span> ${result.lci.profit}
                </p>
              </div>
            </div>

            <div className="p-4 bg-purple-50 rounded-lg border-2 border-purple-200">
              <h3 className="text-lg font-semibold text-purple-800 mb-3">CDB Results:</h3>
              <div className="space-y-1">
                <p className="text-gray-700">
                  <span className="font-medium">Total Amount:</span> ${result.cdb.total}
                </p>
                <p className="text-gray-700">
                  <span className="font-medium">Profit:</span> ${result.cdb.profit}
                </p>
              </div>
            </div>

            <div className="p-4 bg-blue-50 rounded-lg border-2 border-blue-300">
              <h3 className="text-lg font-semibold text-blue-800 mb-3">Comparison:</h3>
              <div className="space-y-1">
                <p className="text-gray-700">
                  <span className="font-medium">Difference:</span> ${result.difference}
                </p>
                <p className="text-lg font-bold text-blue-900 mt-2">
                  Better Option: {result.betterOption}
                </p>
              </div>
            </div>
          </div>
        )}
      </div>
    </div>
  );
}

export default RentabilityComparisonCalculator;
