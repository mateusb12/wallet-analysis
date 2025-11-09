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
    // --- ATUALIZAÇÃO ESTRUTURAL ---
    // Removemos o card (div com border/shadow/p-6) e o <h3> daqui.
    // O componente pai (FiiSimulator) já fornece o "card".
    // Este componente agora é *apenas* o gráfico.

    return (
        // Define uma altura fixa para o container do gráfico
        <div style={{ width: '100%', height: 400 }}>
            <ResponsiveContainer width="100%" height="100%">
                <LineChart
                    data={data}
                    /*
                     * --- CORREÇÃO PRINCIPAL DE RESPONSIVIDADE ---
                     * A margem estática (left: 90, right: 60) foi REMOVIDA.
                     *
                     * Esta margem era a causa do problema no mobile,
                     * pois "espremia" o gráfico.
                     *
                     * Ao remover a margem, o Recharts irá calcular
                     * automaticamente o espaço necessário para os rótulos
                     * dos Eixos Y (YAxis) em qualquer tamanho de tela.
                     */
                    // margin={{ ... }} // <-- REMOVIDO
                >
                    <CartesianGrid strokeDasharray="3 3" stroke="#e0e0e0" />

                    {/* Eixo X (Meses) */}
                    <XAxis dataKey="month" />

                    {/* Eixo Y Esquerdo (Patrimônio) */}
                    <YAxis
                        yAxisId="left"
                        tickFormatter={(value) => formatCurrency(value)}
                        // width={100} // <-- Corretamente removido/comentado
                    />

                    {/* Eixo Y Direito (Preço da Cota) */}
                    <YAxis
                        yAxisId="right"
                        orientation="right"
                        tickFormatter={(value) => formatCurrency(value)}
                        // width={100} // <-- Corretamente removido/comentado
                    />

                    <Tooltip formatter={tooltipFormatter} />
                    <Legend />

                    {/* Linha: Montante Sem Reinvestir */}
                    <Line
                        yAxisId="left"
                        type="monotone"
                        dataKey="noReinvestEnd"
                        name="Montante (Sem Reinvestir)"
                        stroke="#7e22ce" // Roxo
                        strokeWidth={2}
                        strokeOpacity={0.75}
                    />

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
    );
}

export default SimulationChart;