// src/components/SimulationChart.jsx
import React from 'react';
import {
    ResponsiveContainer,
    LineChart,
    Line,
    XAxis,
    YAxis,
    CartesianGrid,
    Tooltip,
    Legend,
} from 'recharts';

// Helper para formatar moeda para os eixos e tooltips
const formatCurrency = (value) =>
    new Intl.NumberFormat('pt-BR', {
        style: 'currency',
        currency: 'BRL',
    }).format(value);

// Helper para formatar valores no tooltip
const tooltipFormatter = (value, name) => {
    // Formata o valor como moeda
    const formattedValue = formatCurrency(value);
    // Retorna um array [valorFormatado, nome]
    return [formattedValue, name];
};

function SimulationChart({ data }) {
    // Não precisamos do "Mês 0" (investimento inicial) para o gráfico de linha,
    // pois ele pode achatar o visual inicial. Vamos pegar do Mês 1 em diante,
    // onde já existe "Ganho/Perda".
    // O Mês 0 tem reinvestGain === 0.
    // Vamos filtrar para remover a primeira linha se o ganho for 0 (Mês 0)
    // const chartData = data.length > 1 && data[0].reinvestGain === 0
    //     ? data.slice(1)
    //     : data;

    // Atualização: Vamos manter o Mês 0. É o ponto de partida.
    // O gráfico fica correto começando do investimento inicial.

    return (
        <div className="border border-gray-300 bg-white rounded-lg shadow-lg p-6">
            <h3 className="text-2xl font-bold mb-6 text-gray-800">
                Evolução do Patrimônio vs. Preço da Cota
            </h3>

            {/* Define uma altura fixa para o container do gráfico */}
            <div style={{ width: '100%', height: 400 }}>
                <ResponsiveContainer width="100%" height="100%">
                    <LineChart
                        data={data}
                        margin={{
                            top: 5,
                            right: 30, // Espaço para o eixo Y da direita
                            left: 30,  // Espaço para o eixo Y da esquerda
                            bottom: 5,
                        }}
                    >
                        <CartesianGrid strokeDasharray="3 3" stroke="#e0e0e0" />

                        {/* Eixo X (Meses) */}
                        <XAxis dataKey="month" />

                        {/* Eixo Y Esquerdo (Patrimônio) */}
                        <YAxis
                            yAxisId="left"
                            tickFormatter={(value) => formatCurrency(value)}
                            width={100} // Aloca espaço para os R$
                        />

                        {/* Eixo Y Direito (Preço da Cota) */}
                        <YAxis
                            yAxisId="right"
                            orientation="right"
                            tickFormatter={(value) => formatCurrency(value)}
                            width={100} // Aloca espaço
                        />

                        <Tooltip formatter={tooltipFormatter} />
                        <Legend />

                        {/* Linha: Montante Reinvestindo */}
                        <Line
                            yAxisId="left"
                            type="monotone"
                            dataKey="reinvestEnd"
                            name="Montante (Reinvestindo)"
                            stroke="#16a34a" // Verde
                            strokeWidth={2}
                            activeDot={{ r: 8 }}
                        />

                        {/* Linha: Montante Sem Reinvestir */}
                        <Line
                            yAxisId="left"
                            type="monotone"
                            dataKey="noReinvestEnd"
                            name="Montante (Sem Reinvestir)"
                            stroke="#7e22ce" // Roxo
                            strokeWidth={2}
                        />

                        {/* Linha: Preço da Cota */}
                        <Line
                            yAxisId="right"
                            type="monotone"
                            dataKey="currentPrice"
                            name="Preço da Cota"
                            stroke="#2563eb" // Azul
                            strokeWidth={2}
                            strokeDasharray="5 5" // Linha tracejada
                        />
                    </LineChart>
                </ResponsiveContainer>
            </div>
        </div>
    );
}

export default SimulationChart;