# Investment Calculator

A React-based investment calculator application built with Vite and Tailwind CSS.

## Features

- **Compound Interest Calculator**: Calculate compound interest with customizable principal, rate, time period, and compounding frequency
- **Rentability Comparison Calculator**: Compare returns between LCI/LCAs and CDB investments

## Tech Stack

- React
- Vite
- Tailwind CSS
- JavaScript

## Getting Started

### Prerequisites

- Node.js (v14 or higher)
- npm

### Installation

1. Install dependencies:
```bash
npm install
```

2. Start the development server:
```bash
npm run dev
```

3. Open your browser and navigate to `http://localhost:5173`

## Available Scripts

- `npm run dev` - Start the development server
- `npm run build` - Build the application for production
- `npm run preview` - Preview the production build locally
- `npm run lint` - Run ESLint to check code quality

## Project Structure

```
src/
├── components/
│   ├── Sidebar.jsx                           # Sidebar navigation component
│   ├── CompoundInterestCalculator.jsx        # Compound interest calculator
│   └── RentabilityComparisonCalculator.jsx   # Rentability comparison calculator
├── App.jsx                                    # Main application component
├── main.jsx                                   # Application entry point
└── index.css                                  # Global styles with Tailwind directives
```

## License

This project is open source and available under the MIT License.
