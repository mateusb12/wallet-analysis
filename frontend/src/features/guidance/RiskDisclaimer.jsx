import React, { useState } from 'react';
import {
  AlertTriangle,
  ChevronDown,
  ChevronUp,
  Info,
  Activity,
  History,
  PieChart,
} from 'lucide-react';

export default function RiskDisclaimer() {
  const [isOpen, setIsOpen] = useState(false);

  return (
    <div className="w-full max-w-[90rem] mx-auto mt-10 mb-16 transition-all duration-300">
      <button
        onClick={() => setIsOpen(!isOpen)}
        className={`w-full flex items-center justify-between p-4 rounded-xl border transition-all duration-300 group ${
          isOpen
            ? 'bg-indigo-50 border-indigo-200 dark:bg-indigo-900/20 dark:border-indigo-800 rounded-b-none'
            : 'bg-white dark:bg-gray-800 border-gray-200 dark:border-gray-700 hover:bg-gray-50 dark:hover:bg-gray-700/50 shadow-sm'
        }`}
      >
        <div className="flex items-center gap-4">
          <div
            className={`p-3 rounded-lg transition-colors ${
              isOpen
                ? 'bg-indigo-100 text-indigo-700 dark:bg-indigo-800 dark:text-indigo-300'
                : 'bg-yellow-100 text-yellow-700 dark:bg-yellow-900/30 dark:text-yellow-500 group-hover:bg-yellow-200 dark:group-hover:bg-yellow-900/50'
            }`}
          >
            <AlertTriangle size={24} />
          </div>
          <div className="text-left">
            <h3 className="font-bold text-lg text-gray-900 dark:text-white">
              Limitações do Modelo & Isenção de Responsabilidade
            </h3>
            <p className="text-sm text-gray-500 dark:text-gray-400 hidden md:block">
              Entenda os riscos matemáticos e conceituais do Trend Following antes de investir.
            </p>
          </div>
        </div>
        {isOpen ? (
          <ChevronUp className="text-indigo-500" size={24} />
        ) : (
          <ChevronDown
            className="text-gray-400 group-hover:text-gray-600 dark:group-hover:text-gray-300"
            size={24}
          />
        )}
      </button>

      {isOpen && (
        <div className="bg-gray-50 dark:bg-gray-800/50 border-x border-b border-gray-200 dark:border-gray-700 p-6 rounded-b-xl animate-in fade-in slide-in-from-top-2 duration-300 space-y-6">
          {}
          <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
            {}
            <div className="p-6 bg-white dark:bg-gray-900 rounded-xl border-2 border-gray-100 dark:border-gray-700/80 shadow-sm flex gap-5 hover:border-indigo-500/30 dark:hover:border-indigo-500/30 transition-colors group">
              <History
                className="shrink-0 text-blue-500 mt-1 group-hover:scale-110 transition-transform"
                size={28}
              />
              <div>
                <h4 className="font-bold text-gray-900 dark:text-white text-base mb-2">
                  Retorno Passado ≠ Retorno Futuro
                </h4>
                <p className="text-sm text-gray-600 dark:text-gray-300 leading-relaxed">
                  O ranking utiliza o CAGR histórico (passado). Um ativo que subiu 20% ao ano nos
                  últimos anos não tem garantia nenhuma de que ele vai repetir essa performance. O
                  mercado é cíclico.
                </p>
              </div>
            </div>

            {}
            <div className="p-6 bg-white dark:bg-gray-900 rounded-xl border-2 border-gray-100 dark:border-gray-700/80 shadow-sm flex gap-5 hover:border-indigo-500/30 dark:hover:border-indigo-500/30 transition-colors group">
              <Activity
                className="shrink-0 text-orange-500 mt-1 group-hover:scale-110 transition-transform"
                size={28}
              />
              <div>
                <h4 className="font-bold text-gray-900 dark:text-white text-base mb-2">
                  O Perigo da Lateralização (Whipsaw)
                </h4>
                <p className="text-sm text-gray-600 dark:text-gray-300 leading-relaxed">
                  A Média Móvel (MM200) sofre em mercados sem tendência ("andando de lado"). O
                  sistema pode gerar vários falsos positivos de compra e venda (stop) consecutivos,
                  corroendo o seu capital com pequenos prejuízos.
                </p>
              </div>
            </div>

            {}
            <div className="p-6 bg-white dark:bg-gray-900 rounded-xl border-2 border-gray-100 dark:border-gray-700/80 shadow-sm flex gap-5 hover:border-indigo-500/30 dark:hover:border-indigo-500/30 transition-colors group">
              <Info
                className="shrink-0 text-purple-500 mt-1 group-hover:scale-110 transition-transform"
                size={28}
              />
              <div>
                <h4 className="font-bold text-gray-900 dark:text-white text-base mb-2">
                  Delay da Tendência (Lag)
                </h4>
                <p className="text-sm text-gray-600 dark:text-gray-300 leading-relaxed">
                  Por usar uma média longa (200 dias), o sistema é lento. Você vai entrar na
                  tendência depois do início da alta e vai sair depois que a queda já começou. O
                  objetivo aqui é evitar o "grande crash", não acertar o topo e fundo do gráfico.
                </p>
              </div>
            </div>

            {}
            <div className="p-6 bg-white dark:bg-gray-900 rounded-xl border-2 border-gray-100 dark:border-gray-700/80 shadow-sm flex gap-5 hover:border-indigo-500/30 dark:hover:border-indigo-500/30 transition-colors group">
              <PieChart
                className="shrink-0 text-green-500 mt-1 group-hover:scale-110 transition-transform"
                size={28}
              />
              <div>
                <h4 className="font-bold text-gray-900 dark:text-white text-base mb-2">
                  Não aposte tudo no Líder
                </h4>
                <p className="text-sm text-gray-600 dark:text-gray-300 leading-relaxed">
                  O sistema destaca um "Líder", mas isso não elimina a necessidade de
                  diversificação. Concentrar todo o capital em um único ativo, por melhores que
                  sejam seus indicadores técnicos, aumenta drasticamente o risco de você arruinar a
                  carteira toda
                </p>
              </div>
            </div>
          </div>

          {}
          <div className="p-4 bg-gray-200/50 dark:bg-gray-950/30 rounded-lg text-center border border-gray-300/50 dark:border-gray-800/50">
            <p className="text-xs text-gray-600 dark:text-gray-400 leading-normal">
              <strong>Disclaimer Importante:</strong> Esta ferramenta é fornecida exclusivamente
              para fins educacionais e de análise técnica quantitativa. Os dados apresentados{' '}
              <strong>não constituem</strong> recomendação de investimento, solicitação de compra ou
              venda de quaisquer valores mobiliários. O desempenho passado não é garantia de
              resultados futuros. Consulte sempre um consultor financeiro certificado e
              regulamentado pela CVM antes de tomar qualquer decisão de investimento.
            </p>
          </div>
        </div>
      )}
    </div>
  );
}
